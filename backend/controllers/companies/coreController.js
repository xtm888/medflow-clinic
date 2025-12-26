/**
 * Company Core Controller
 *
 * Handles CRUD operations, employees, search, and hierarchy.
 */

const {
  Company,
  Patient,
  Invoice,
  Approval,
  asyncHandler,
  success,
  error,
  notFound,
  companyLogger,
  PAGINATION
} = require('./shared');

/**
 * @desc    Get all companies
 * @route   GET /api/companies
 * @access  Private
 */
exports.getCompanies = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    type,
    search,
    hasOutstanding
  } = req.query;

  const query = {};

  // Filter by status
  if (status) {
    query['contract.status'] = status;
  } else {
    // Default: show active companies
    query.isActive = true;
  }

  // Filter by type
  if (type) {
    query.type = type;
  }

  // Search by name
  if (search) {
    query.$or = [
      { name: new RegExp(search, 'i') },
      { shortName: new RegExp(search, 'i') },
      { companyId: new RegExp(search, 'i') }
    ];
  }

  // Filter companies with outstanding balance
  if (hasOutstanding === 'true') {
    query['balance.outstanding'] = { $gt: 0 };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [companies, total] = await Promise.all([
    Company.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Company.countDocuments(query)
  ]);

  // OPTIMIZATION: Use aggregation to get all employee counts in a single query
  // instead of N+1 individual countByCompany calls
  const companyIds = companies.map(c => c._id);
  const employeeCounts = await Patient.aggregate([
    { $match: {
      'convention.company': { $in: companyIds },
      isDeleted: { $ne: true }
    }},
    { $group: { _id: '$convention.company', count: { $sum: 1 } }}
  ]);

  const countMap = new Map(
    employeeCounts.map(e => [e._id.toString(), e.count])
  );

  const companiesWithStats = companies.map(company => ({
    ...company,
    employeeCount: countMap.get(company._id.toString()) || 0
  }));

  return success(res, {
    data: companiesWithStats,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

/**
 * @desc    Get single company
 * @route   GET /api/companies/:id
 * @access  Private
 */
exports.getCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id)
    .populate('customFeeSchedule')
    .populate('documents.documentId');

  if (!company) {
    return notFound(res, 'Company');
  }

  // Get additional statistics
  const [employeeCount, pendingApprovals, recentInvoices] = await Promise.all([
    Patient.countByCompany(company._id),
    Approval.countDocuments({ company: company._id, status: 'pending' }),
    Invoice.find({ 'companyBilling.company': company._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('invoiceId dateIssued summary.total status')
  ]);

  return success(res, {
    data: {
      ...company.toObject(),
      stats: {
        ...company.stats,
        activeEmployees: employeeCount,
        pendingApprovals
      },
      recentInvoices
    }
  });
});

/**
 * @desc    Create company
 * @route   POST /api/companies
 * @access  Private (Admin)
 */
exports.createCompany = asyncHandler(async (req, res) => {
  req.body.createdBy = req.user.id;

  const company = await Company.create(req.body);

  companyLogger.info('Company created', { companyId: company._id, userId: req.user.id });
  return success(res, { data: company });
});

/**
 * @desc    Update company
 * @route   PUT /api/companies/:id
 * @access  Private (Admin)
 */
exports.updateCompany = asyncHandler(async (req, res) => {
  req.body.updatedBy = req.user.id;

  const company = await Company.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!company) {
    return notFound(res, 'Company');
  }

  companyLogger.info('Company updated', { companyId: company._id, userId: req.user.id });
  return success(res, { data: company });
});

/**
 * @desc    Delete company (soft delete)
 * @route   DELETE /api/companies/:id
 * @access  Private (Admin)
 */
exports.deleteCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);

  if (!company) {
    return notFound(res, 'Company');
  }

  // Check for active patients
  const activePatients = await Patient.countByCompany(company._id);
  if (activePatients > 0) {
    return error(res, `Impossible de supprimer: ${activePatients} patient(s) actif(s) rattaché(s) à cette entreprise`, 400);
  }

  company.isActive = false;
  company.contract.status = 'terminated';
  company.updatedBy = req.user.id;
  await company.save();

  companyLogger.info('Company deactivated', { companyId: company._id, userId: req.user.id });
  return success(res, {}, 'Entreprise désactivée avec succès');
});

/**
 * @desc    Get company employees (patients)
 * @route   GET /api/companies/:id/employees
 * @access  Private
 */
exports.getCompanyEmployees = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, status, search } = req.query;

  const company = await Company.findById(req.params.id);
  if (!company) {
    return notFound(res, 'Company');
  }

  const query = {
    'convention.company': company._id,
    status: 'active',
    isDeleted: { $ne: true }
  };

  if (status) {
    query['convention.status'] = status;
  }

  if (search) {
    query.$or = [
      { firstName: new RegExp(search, 'i') },
      { lastName: new RegExp(search, 'i') },
      { 'convention.employeeId': new RegExp(search, 'i') }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [employees, total] = await Promise.all([
    Patient.find(query)
      .select('patientId firstName lastName dateOfBirth gender phoneNumber convention')
      .sort({ lastName: 1, firstName: 1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Patient.countDocuments(query)
  ]);

  return success(res, {
    data: employees,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

/**
 * @desc    Search companies
 * @route   GET /api/companies/search
 * @access  Private
 */
exports.searchCompanies = asyncHandler(async (req, res) => {
  const { q, limit = 10 } = req.query;

  if (!q || q.length < 2) {
    return success(res, { data: [] });
  }

  const companies = await Company.search(q).limit(parseInt(limit));

  return success(res, { data: companies });
});

/**
 * @desc    Get companies with expiring contracts
 * @route   GET /api/companies/expiring
 * @access  Private (Admin)
 */
exports.getExpiringContracts = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;

  const companies = await Company.getExpiringContracts(parseInt(days));

  return success(res, { data: companies });
});

/**
 * @desc    Get companies with outstanding balance
 * @route   GET /api/companies/outstanding
 * @access  Private (Admin/Billing)
 */
exports.getCompaniesWithOutstanding = asyncHandler(async (req, res) => {
  const { minAmount = 0 } = req.query;

  const companies = await Company.getWithOutstanding(parseFloat(minAmount));

  return success(res, { data: companies });
});

/**
 * @desc    Get companies in hierarchical view (parent conventions with sub-companies)
 * @route   GET /api/companies/hierarchy
 * @access  Private
 */
exports.getCompaniesHierarchy = asyncHandler(async (req, res) => {
  const { status, includeStats } = req.query;

  const baseQuery = { isActive: true };
  if (status) {
    baseQuery['contract.status'] = status;
  }

  // Get all parent conventions (insurance companies)
  const parentConventions = await Company.find({
    ...baseQuery,
    isParentConvention: true
  }).sort({ name: 1 }).lean();

  // Get all companies that have a parent
  const companiesWithParent = await Company.find({
    ...baseQuery,
    parentConvention: { $ne: null }
  }).sort({ name: 1 }).lean();

  // Get standalone companies (no parent and not a parent convention)
  const standaloneCompanies = await Company.find({
    ...baseQuery,
    isParentConvention: { $ne: true },
    parentConvention: null
  }).sort({ name: 1 }).lean();

  // Group sub-companies by parent
  const subCompaniesByParent = {};
  for (const company of companiesWithParent) {
    const parentId = company.parentConvention.toString();
    if (!subCompaniesByParent[parentId]) {
      subCompaniesByParent[parentId] = [];
    }
    subCompaniesByParent[parentId].push(company);
  }

  // Add employee counts if requested
  const addStats = async (company) => {
    if (includeStats === 'true') {
      const employeeCount = await Patient.countByCompany(company._id);
      return { ...company, employeeCount };
    }
    return company;
  };

  // Build hierarchy
  const hierarchy = [];

  // Add parent conventions with their sub-companies
  for (const parent of parentConventions) {
    const subCompanies = subCompaniesByParent[parent._id.toString()] || [];
    const parentWithStats = await addStats(parent);

    const subCompaniesWithStats = await Promise.all(
      subCompanies.map(sub => addStats(sub))
    );

    hierarchy.push({
      ...parentWithStats,
      isParent: true,
      subCompanies: subCompaniesWithStats,
      subCompanyCount: subCompanies.length
    });
  }

  // Add standalone companies
  for (const company of standaloneCompanies) {
    const companyWithStats = await addStats(company);
    hierarchy.push({
      ...companyWithStats,
      isParent: false,
      subCompanies: [],
      subCompanyCount: 0
    });
  }

  return success(res, {
    data: hierarchy,
    meta: {
      summary: {
        parentConventions: parentConventions.length,
        subCompanies: companiesWithParent.length,
        standalone: standaloneCompanies.length,
        total: parentConventions.length + companiesWithParent.length + standaloneCompanies.length
      }
    }
  });
});
