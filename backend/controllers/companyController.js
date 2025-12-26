const Company = require('../models/Company');
const ConventionFeeSchedule = require('../models/ConventionFeeSchedule');
const Patient = require('../models/Patient');
const Invoice = require('../models/Invoice');
const Approval = require('../models/Approval');
const { asyncHandler } = require('../middleware/errorHandler');
const { success, error, notFound, paginated } = require('../utils/apiResponse');
const { createContextLogger } = require('../utils/structuredLogger');
const companyLogger = createContextLogger('Company');
const { PAGINATION } = require('../config/constants');

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
 * @desc    Get company invoices
 * @route   GET /api/companies/:id/invoices
 * @access  Private
 */
exports.getCompanyInvoices = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    dateFrom,
    dateTo
  } = req.query;

  const company = await Company.findById(req.params.id);
  if (!company) {
    return notFound(res, 'Company');
  }

  const query = {
    'companyBilling.company': company._id
  };

  if (status) {
    query.status = status;
  }

  if (dateFrom || dateTo) {
    query.dateIssued = {};
    if (dateFrom) query.dateIssued.$gte = new Date(dateFrom);
    if (dateTo) query.dateIssued.$lte = new Date(dateTo);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [invoices, total, summary] = await Promise.all([
    Invoice.find(query)
      .populate('patient', 'patientId firstName lastName')
      .sort({ dateIssued: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Invoice.countDocuments(query),
    Invoice.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalBilled: { $sum: '$companyBilling.companyAmount' },
          totalPaid: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'paid'] },
                '$companyBilling.companyAmount',
                0
              ]
            }
          },
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  // Standardized API response format:
  // - data: array of invoices (not wrapped in object)
  // - meta: summary statistics
  // - pagination: standard pagination object
  const summaryData = summary[0] || { totalBilled: 0, totalPaid: 0, count: 0 };

  return success(res, {
    data: invoices,
    meta: {
      totalBilled: summaryData.totalBilled,
      totalPaid: summaryData.totalPaid,
      totalOutstanding: summaryData.totalBilled - summaryData.totalPaid,
      count: summaryData.count
    },
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

/**
 * @desc    Get company statement (relevé de compte)
 * @route   GET /api/companies/:id/statement
 * @access  Private
 */
exports.getCompanyStatement = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;

  const company = await Company.findById(req.params.id);
  if (!company) {
    return notFound(res, 'Company');
  }

  const dateQuery = {};
  if (dateFrom) dateQuery.$gte = new Date(dateFrom);
  if (dateTo) dateQuery.$lte = new Date(dateTo);

  // Get all invoices for this company
  const invoiceQuery = { 'companyBilling.company': company._id };
  if (Object.keys(dateQuery).length > 0) {
    invoiceQuery.dateIssued = dateQuery;
  }

  const invoices = await Invoice.find(invoiceQuery)
    .populate('patient', 'patientId firstName lastName convention.employeeId')
    .sort({ dateIssued: 1 })
    .lean();

  // Build statement entries
  const entries = invoices.map(inv => ({
    date: inv.dateIssued,
    type: 'invoice',
    reference: inv.invoiceId,
    patient: {
      id: inv.patient?._id,
      name: `${inv.patient?.lastName || ''} ${inv.patient?.firstName || ''}`.trim(),
      employeeId: inv.patient?.convention?.employeeId
    },
    debit: inv.companyBilling?.companyAmount || 0,
    credit: 0,
    status: inv.status,
    description: `Facture ${inv.invoiceId}`
  }));

  // Add payments (if tracked separately, this would need adjustment)
  // For now, payments are tracked within invoices

  // Calculate totals
  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
  const balance = totalDebit - totalCredit;

  return success(res, {
    data: {
      company: {
        id: company._id,
        companyId: company.companyId,
        name: company.name
      },
      period: {
        from: dateFrom || 'Début',
        to: dateTo || 'Aujourd\'hui'
      },
      entries,
      summary: {
        totalDebit,
        totalCredit,
        balance,
        currency: company.defaultCoverage?.currency || 'CDF'
      }
    }
  });
});

/**
 * @desc    Record company payment
 * @route   POST /api/companies/:id/payments
 * @access  Private (Admin/Billing)
 */
exports.recordCompanyPayment = asyncHandler(async (req, res) => {
  const { amount, currency, method, reference, notes, invoiceIds, allocationType } = req.body;

  const company = await Company.findById(req.params.id);
  if (!company) {
    return notFound(res, 'Company');
  }

  if (!amount || amount <= 0) {
    return error(res, 'Montant invalide', 400);
  }

  let remainingAmount = amount;
  const allocations = [];

  if (invoiceIds && invoiceIds.length > 0) {
    // Allocate to specific invoices
    for (const invoiceId of invoiceIds) {
      if (remainingAmount <= 0) break;

      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) continue;

      const companyDue = (invoice.companyBilling?.companyAmount || 0) -
        (invoice.companyBilling?.paidAmount || 0);

      if (companyDue <= 0) continue;

      const allocatedAmount = Math.min(remainingAmount, companyDue);

      // Update invoice
      invoice.companyBilling.paidAmount = (invoice.companyBilling.paidAmount || 0) + allocatedAmount;
      invoice.companyBilling.lastPaymentDate = new Date();

      // Add payment record
      invoice.payments.push({
        amount: allocatedAmount,
        currency: currency || 'CDF',
        method: method || 'bank-transfer',
        date: new Date(),
        reference: `Company Payment: ${reference || ''}`,
        notes: notes,
        receivedBy: req.user.id
      });

      // Update status if fully paid
      const totalDue = invoice.summary?.amountDue || invoice.summary?.total || 0;
      const totalPaid = invoice.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      if (totalPaid >= totalDue) {
        invoice.status = 'paid';
      } else if (totalPaid > 0) {
        invoice.status = 'partial';
      }

      await invoice.save();

      allocations.push({
        invoiceId: invoice.invoiceId,
        amount: allocatedAmount
      });

      remainingAmount -= allocatedAmount;
    }
  } else {
    // Auto-allocate to oldest unpaid invoices
    const unpaidInvoices = await Invoice.find({
      'companyBilling.company': company._id,
      status: { $in: ['issued', 'sent', 'partial', 'overdue'] }
    }).sort({ dateIssued: 1 });

    for (const invoice of unpaidInvoices) {
      if (remainingAmount <= 0) break;

      const companyDue = (invoice.companyBilling?.companyAmount || 0) -
        (invoice.companyBilling?.paidAmount || 0);

      if (companyDue <= 0) continue;

      const allocatedAmount = Math.min(remainingAmount, companyDue);

      invoice.companyBilling.paidAmount = (invoice.companyBilling.paidAmount || 0) + allocatedAmount;
      invoice.companyBilling.lastPaymentDate = new Date();

      invoice.payments.push({
        amount: allocatedAmount,
        currency: currency || 'CDF',
        method: method || 'bank-transfer',
        date: new Date(),
        reference: `Company Payment: ${reference || ''}`,
        notes: notes,
        receivedBy: req.user.id
      });

      const totalDue = invoice.summary?.amountDue || invoice.summary?.total || 0;
      const totalPaid = invoice.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      if (totalPaid >= totalDue) {
        invoice.status = 'paid';
      } else if (totalPaid > 0) {
        invoice.status = 'partial';
      }

      await invoice.save();

      allocations.push({
        invoiceId: invoice.invoiceId,
        amount: allocatedAmount
      });

      remainingAmount -= allocatedAmount;
    }
  }

  // Update company balance
  await company.updateBalance(amount, 'paid');

  companyLogger.info('Company payment recorded', {
    companyId: company._id,
    amount,
    allocated: amount - remainingAmount,
    userId: req.user.id
  });

  return success(res, {
    data: {
      totalPaid: amount,
      allocated: amount - remainingAmount,
      unallocated: remainingAmount,
      allocations,
      newBalance: company.balance
    }
  });
});

/**
 * @desc    Get company fee schedule
 * @route   GET /api/companies/:id/fee-schedule
 * @access  Private
 */
exports.getCompanyFeeSchedule = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) {
    return notFound(res, 'Company');
  }

  const feeSchedule = await ConventionFeeSchedule.getEffectiveForCompany(company._id);

  if (!feeSchedule) {
    return success(res, { data: null, message: 'Aucune grille tarifaire spécifique - tarifs standards appliqués' });
  }

  return success(res, { data: feeSchedule });
});

/**
 * @desc    Update company fee schedule
 * @route   PUT /api/companies/:id/fee-schedule
 * @access  Private (Admin)
 */
exports.updateCompanyFeeSchedule = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) {
    return notFound(res, 'Company');
  }

  const { items, defaults, name, effectiveFrom, effectiveTo } = req.body;

  let feeSchedule = await ConventionFeeSchedule.getEffectiveForCompany(company._id);

  if (!feeSchedule) {
    // Create new fee schedule
    feeSchedule = new ConventionFeeSchedule({
      company: company._id,
      name: name || `Grille tarifaire ${company.name}`,
      currency: company.defaultCoverage?.currency || 'CDF',
      effectiveFrom: effectiveFrom || new Date(),
      effectiveTo,
      defaults: defaults || {},
      items: [],
      createdBy: req.user.id
    });
  } else {
    feeSchedule.name = name || feeSchedule.name;
    feeSchedule.effectiveFrom = effectiveFrom || feeSchedule.effectiveFrom;
    feeSchedule.effectiveTo = effectiveTo;
    if (defaults) feeSchedule.defaults = { ...feeSchedule.defaults, ...defaults };
    feeSchedule.updatedBy = req.user.id;
  }

  // Update items
  if (items && Array.isArray(items)) {
    for (const item of items) {
      feeSchedule.setItemPrice(item.code, item);
    }
  }

  await feeSchedule.save();

  // Link to company
  company.customFeeSchedule = feeSchedule._id;
  await company.save();

  companyLogger.info('Company fee schedule updated', { companyId: company._id, userId: req.user.id });
  return success(res, { data: feeSchedule });
});

/**
 * @desc    Get pending approvals for company
 * @route   GET /api/companies/:id/approvals
 * @access  Private
 */
exports.getCompanyApprovals = asyncHandler(async (req, res) => {
  const { status = 'pending', page = 1, limit = 20 } = req.query;

  const company = await Company.findById(req.params.id);
  if (!company) {
    return notFound(res, 'Company');
  }

  const query = { company: company._id };
  if (status !== 'all') {
    query.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [approvals, total] = await Promise.all([
    Approval.find(query)
      .populate('patient', 'patientId firstName lastName convention.employeeId')
      .populate('requestedBy', 'firstName lastName')
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Approval.countDocuments(query)
  ]);

  return success(res, {
    data: approvals,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

/**
 * @desc    Get company statistics/dashboard
 * @route   GET /api/companies/:id/stats
 * @access  Private
 */
exports.getCompanyStats = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) {
    return notFound(res, 'Company');
  }

  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const startOfMonth = new Date(currentYear, new Date().getMonth(), 1);

  const [
    employeeCount,
    pendingApprovals,
    yearlyInvoices,
    monthlyInvoices,
    invoicesByStatus
  ] = await Promise.all([
    Patient.countByCompany(company._id),
    Approval.countDocuments({ company: company._id, status: 'pending' }),
    Invoice.aggregate([
      {
        $match: {
          'companyBilling.company': company._id,
          dateIssued: { $gte: startOfYear }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$companyBilling.companyAmount' },
          paid: {
            $sum: {
              $cond: [{ $eq: ['$status', 'paid'] }, '$companyBilling.companyAmount', 0]
            }
          },
          count: { $sum: 1 }
        }
      }
    ]),
    Invoice.aggregate([
      {
        $match: {
          'companyBilling.company': company._id,
          dateIssued: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$companyBilling.companyAmount' },
          count: { $sum: 1 }
        }
      }
    ]),
    Invoice.aggregate([
      { $match: { 'companyBilling.company': company._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$companyBilling.companyAmount' }
        }
      }
    ])
  ]);

  return success(res, {
    data: {
      company: {
        id: company._id,
        companyId: company.companyId,
        name: company.name,
        status: company.contract?.status
      },
      employees: {
        total: employeeCount,
        active: employeeCount // For now, same as total since we filter by active
      },
      balance: company.balance,
      pendingApprovals,
      yearToDate: yearlyInvoices[0] || { total: 0, paid: 0, count: 0 },
      monthToDate: monthlyInvoices[0] || { total: 0, count: 0 },
      invoicesByStatus: invoicesByStatus.reduce((acc, item) => {
        acc[item._id] = { count: item.count, total: item.total };
        return acc;
      }, {})
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

  // OPTIMIZATION: Fetch all employee counts in a single aggregation instead of N+1 queries
  let employeeCountMap = new Map();
  if (includeStats === 'true') {
    const allCompanyIds = [
      ...parentConventions.map(c => c._id),
      ...companiesWithParent.map(c => c._id),
      ...standaloneCompanies.map(c => c._id)
    ];

    const employeeCounts = await Patient.aggregate([
      { $match: {
        'convention.company': { $in: allCompanyIds },
        isDeleted: { $ne: true }
      }},
      { $group: { _id: '$convention.company', count: { $sum: 1 } }}
    ]);

    employeeCountMap = new Map(
      employeeCounts.map(e => [e._id.toString(), e.count])
    );
  }

  // Helper to add stats from pre-fetched map
  const addStats = (company) => {
    if (includeStats === 'true') {
      return { ...company, employeeCount: employeeCountMap.get(company._id.toString()) || 0 };
    }
    return company;
  };

  // Build hierarchy
  const hierarchy = [];

  // Add parent conventions with their sub-companies
  for (const parent of parentConventions) {
    const subCompanies = subCompaniesByParent[parent._id.toString()] || [];
    const parentWithStats = addStats(parent);

    const subCompaniesWithStats = subCompanies.map(sub => addStats(sub));

    hierarchy.push({
      ...parentWithStats,
      isParent: true,
      subCompanies: subCompaniesWithStats,
      subCompanyCount: subCompanies.length
    });
  }

  // Add standalone companies
  for (const company of standaloneCompanies) {
    const companyWithStats = addStats(company);
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

/**
 * @desc    Get unrealized items for company (actes non réalisés)
 * @route   GET /api/companies/:id/unrealized-items
 * @access  Private (Admin/Billing)
 */
exports.getUnrealizedItems = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, dateFrom, dateTo } = req.query;

  const company = await Company.findById(req.params.id);
  if (!company) {
    return notFound(res, 'Company');
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const result = await Invoice.getUnrealizedItemsForCompany(company._id, {
    dateFrom,
    dateTo,
    limit: parseInt(limit),
    skip
  });

  return success(res, {
    data: {
      items: result.items,
      summary: {
        total: result.total,
        totalCompanyShare: result.totalCompanyShare,
        currency: company.defaultCoverage?.currency || 'CDF'
      }
    },
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: result.total,
      pages: Math.ceil(result.total / parseInt(limit))
    }
  });
});

/**
 * @desc    Generate batch invoice (bordereau) for company
 * @route   POST /api/companies/:id/generate-batch-invoice
 * @access  Private (Admin/Billing)
 */
exports.generateBatchInvoice = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo, includeUnpaid = true, groupBy = 'patient' } = req.body;

  const company = await Company.findById(req.params.id);
  if (!company) {
    return notFound(res, 'Company');
  }

  // Build query for invoices
  const query = {
    'companyBilling.company': company._id,
    isConventionInvoice: true,
    status: { $nin: ['cancelled', 'voided'] }
  };

  // Filter by date range
  if (dateFrom || dateTo) {
    query.dateIssued = {};
    if (dateFrom) query.dateIssued.$gte = new Date(dateFrom);
    if (dateTo) query.dateIssued.$lte = new Date(dateTo);
  }

  // Filter by status (only unpaid if requested)
  if (includeUnpaid) {
    query['companyBilling.companyInvoiceStatus'] = { $in: ['pending', 'sent'] };
  }

  // Get all matching invoices
  const invoices = await Invoice.find(query)
    .populate('patient', 'patientId firstName lastName convention.employeeId')
    .sort({ dateIssued: 1 })
    .lean();

  if (invoices.length === 0) {
    return success(res, { data: null, message: 'Aucune facture à inclure dans le bordereau' });
  }

  // Group invoices
  let groupedData = [];
  let totalCompanyShare = 0;
  let totalPatientShare = 0;

  if (groupBy === 'patient') {
    // Group by patient
    const patientMap = {};
    for (const inv of invoices) {
      const patientKey = inv.patient?._id?.toString() || 'unknown';
      if (!patientMap[patientKey]) {
        patientMap[patientKey] = {
          patient: {
            _id: inv.patient?._id,
            patientId: inv.patient?.patientId,
            name: `${inv.patient?.lastName || ''} ${inv.patient?.firstName || ''}`.trim(),
            employeeId: inv.patient?.convention?.employeeId
          },
          invoices: [],
          totalCompanyShare: 0,
          totalPatientShare: 0
        };
      }
      patientMap[patientKey].invoices.push({
        _id: inv._id,
        invoiceId: inv.invoiceId,
        dateIssued: inv.dateIssued,
        total: inv.summary?.total || 0,
        companyShare: inv.companyBilling?.companyShare || 0,
        patientShare: inv.companyBilling?.patientShare || 0
      });
      patientMap[patientKey].totalCompanyShare += inv.companyBilling?.companyShare || 0;
      patientMap[patientKey].totalPatientShare += inv.companyBilling?.patientShare || 0;
      totalCompanyShare += inv.companyBilling?.companyShare || 0;
      totalPatientShare += inv.companyBilling?.patientShare || 0;
    }
    groupedData = Object.values(patientMap);
  } else {
    // Group by date (month)
    const monthMap = {};
    for (const inv of invoices) {
      const monthKey = new Date(inv.dateIssued).toISOString().substring(0, 7);
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          period: monthKey,
          invoices: [],
          totalCompanyShare: 0,
          totalPatientShare: 0
        };
      }
      monthMap[monthKey].invoices.push({
        _id: inv._id,
        invoiceId: inv.invoiceId,
        dateIssued: inv.dateIssued,
        patient: {
          name: `${inv.patient?.lastName || ''} ${inv.patient?.firstName || ''}`.trim(),
          employeeId: inv.patient?.convention?.employeeId
        },
        total: inv.summary?.total || 0,
        companyShare: inv.companyBilling?.companyShare || 0,
        patientShare: inv.companyBilling?.patientShare || 0
      });
      monthMap[monthKey].totalCompanyShare += inv.companyBilling?.companyShare || 0;
      monthMap[monthKey].totalPatientShare += inv.companyBilling?.patientShare || 0;
      totalCompanyShare += inv.companyBilling?.companyShare || 0;
      totalPatientShare += inv.companyBilling?.patientShare || 0;
    }
    groupedData = Object.values(monthMap).sort((a, b) => a.period.localeCompare(b.period));
  }

  // Generate batch reference
  const batchReference = `BATCH-${company.companyId}-${new Date().toISOString().substring(0, 10).replace(/-/g, '')}`;

  companyLogger.info('Batch invoice generated', {
    companyId: company._id,
    batchReference,
    invoiceCount: invoices.length
  });

  return success(res, {
    data: {
      batchReference,
      company: {
        _id: company._id,
        companyId: company.companyId,
        name: company.name
      },
      period: {
        from: dateFrom || 'Début',
        to: dateTo || 'Aujourd\'hui'
      },
      groupBy,
      groups: groupedData,
      summary: {
        invoiceCount: invoices.length,
        totalCompanyShare,
        totalPatientShare,
        totalAmount: totalCompanyShare + totalPatientShare,
        currency: company.defaultCoverage?.currency || 'CDF'
      }
    }
  });
});

/**
 * @desc    Preview coverage for a patient before invoice creation
 * @route   POST /api/companies/:id/preview-coverage
 * @access  Private
 */
exports.previewCoverage = asyncHandler(async (req, res) => {
  const { patientId, items } = req.body;

  const company = await Company.findById(req.params.id);
  if (!company) {
    return notFound(res, 'Company');
  }

  const patient = await Patient.findById(patientId);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Check contract status
  const warnings = [];
  if (company.contract?.status !== 'active') {
    warnings.push(`Contrat non actif (${company.contract?.status})`);
  }
  if (company.contract?.endDate && new Date(company.contract.endDate) < new Date()) {
    warnings.push('Contrat expiré');
  }

  // Check waiting period
  const waitingPeriodDays = company.defaultCoverage?.waitingPeriod || 0;
  if (waitingPeriodDays > 0 && patient.convention?.startDate) {
    const startDate = new Date(patient.convention.startDate);
    const waitingEndDate = new Date(startDate);
    waitingEndDate.setDate(waitingEndDate.getDate() + waitingPeriodDays);

    if (new Date() < waitingEndDate) {
      const daysRemaining = Math.ceil((waitingEndDate - new Date()) / (1000 * 60 * 60 * 24));
      warnings.push(`Période d'attente: ${daysRemaining} jour(s) restant(s)`);
    }
  }

  // Get YTD usage
  const ytdUsage = await Invoice.getPatientYTDCategoryUsage(
    patientId,
    company._id,
    new Date().getFullYear()
  );

  // Calculate coverage preview for each item
  const baseCoveragePercentage = patient.convention?.coveragePercentage ?? company.defaultCoverage.percentage;
  const itemPreviews = [];
  let totalCompanyShare = 0;
  let totalPatientShare = 0;

  const categoryCompanyShareCumulative = {};

  for (const item of items || []) {
    const category = item.category || 'other';
    const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);

    // Initialize with YTD
    if (categoryCompanyShareCumulative[category] === undefined) {
      categoryCompanyShareCumulative[category] = ytdUsage[category]?.totalCompanyShare || 0;
    }

    const categorySettings = company.getCategorySettings(category);
    const coveragePercentage = categorySettings.percentage ?? baseCoveragePercentage;
    let companyShare = Math.round((itemTotal * coveragePercentage) / 100);

    const itemWarnings = [];

    // Check if not covered
    if (categorySettings.notCovered) {
      companyShare = 0;
      itemWarnings.push('Catégorie non couverte');
    }

    // Check category max per item
    if (categorySettings.maxAmount && companyShare > categorySettings.maxAmount) {
      companyShare = categorySettings.maxAmount;
      itemWarnings.push(`Plafond par acte: ${categorySettings.maxAmount}`);
    }

    // Check annual limit
    if (categorySettings.maxPerCategory) {
      const remainingBudget = categorySettings.maxPerCategory - categoryCompanyShareCumulative[category];
      if (remainingBudget <= 0) {
        companyShare = 0;
        itemWarnings.push(`Plafond annuel épuisé (${categorySettings.maxPerCategory}/an)`);
      } else if (companyShare > remainingBudget) {
        companyShare = remainingBudget;
        itemWarnings.push(`Plafond annuel partiellement épuisé (reste ${remainingBudget})`);
      }
    }

    // Check if requires approval
    if (categorySettings.requiresApproval) {
      itemWarnings.push('Délibération requise');
    }

    categoryCompanyShareCumulative[category] += companyShare;
    const patientShare = itemTotal - companyShare;

    itemPreviews.push({
      description: item.description,
      code: item.code,
      category,
      itemTotal,
      coveragePercentage: itemTotal > 0 ? Math.round((companyShare / itemTotal) * 100) : 0,
      companyShare,
      patientShare,
      warnings: itemWarnings
    });

    totalCompanyShare += companyShare;
    totalPatientShare += patientShare;
  }

  // Apply max per visit
  if (company.defaultCoverage.maxPerVisit && totalCompanyShare > company.defaultCoverage.maxPerVisit) {
    warnings.push(`Plafond par visite appliqué: ${company.defaultCoverage.maxPerVisit}`);
    const excess = totalCompanyShare - company.defaultCoverage.maxPerVisit;
    totalCompanyShare = company.defaultCoverage.maxPerVisit;
    totalPatientShare += excess;
  }

  return success(res, {
    data: {
      company: {
        _id: company._id,
        name: company.name,
        contractStatus: company.contract?.status
      },
      patient: {
        _id: patient._id,
        name: `${patient.firstName} ${patient.lastName}`,
        employeeId: patient.convention?.employeeId,
        baseCoveragePercentage
      },
      items: itemPreviews,
      summary: {
        totalCompanyShare,
        totalPatientShare,
        totalAmount: totalCompanyShare + totalPatientShare,
        effectiveCoveragePercentage: (totalCompanyShare + totalPatientShare) > 0
          ? Math.round((totalCompanyShare / (totalCompanyShare + totalPatientShare)) * 100)
          : 0,
        currency: company.defaultCoverage?.currency || 'CDF'
      },
      ytdUsage,
      warnings,
      canProceed: warnings.filter(w => w.includes('non actif') || w.includes('expiré')).length === 0
    }
  });
});

/**
 * @desc    Download company statement as PDF
 * @route   GET /api/companies/:id/statement/pdf
 * @access  Private (Admin/Billing)
 */
exports.downloadCompanyStatementPDF = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;

  const company = await Company.findById(req.params.id);
  if (!company) {
    return notFound(res, 'Company');
  }

  // Build query
  const query = {
    'companyBilling.company': company._id,
    isConventionInvoice: true,
    status: { $nin: ['cancelled', 'voided'] }
  };

  if (dateFrom || dateTo) {
    query.dateIssued = {};
    if (dateFrom) query.dateIssued.$gte = new Date(dateFrom);
    if (dateTo) query.dateIssued.$lte = new Date(dateTo);
  }

  const invoices = await Invoice.find(query)
    .populate('patient', 'patientId firstName lastName convention.employeeId')
    .sort({ dateIssued: 1 })
    .lean();

  // Build entries for PDF
  const entries = invoices.map(inv => ({
    date: inv.dateIssued,
    reference: inv.invoiceId,
    patient: {
      name: `${inv.patient?.lastName || ''} ${inv.patient?.firstName || ''}`.trim(),
      employeeId: inv.patient?.convention?.employeeId
    },
    debit: inv.companyBilling?.companyShare || 0,
    credit: 0, // Company payments would go here
    status: inv.status
  }));

  // Calculate summary
  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

  const summary = {
    totalDebit,
    totalCredit,
    balance: totalDebit - totalCredit,
    currency: company.defaultCoverage?.currency || 'CDF'
  };

  const dateRange = {
    from: dateFrom ? new Date(dateFrom) : null,
    to: dateTo ? new Date(dateTo) : new Date()
  };

  // Generate PDF
  const pdfGenerator = require('../services/pdfGenerator');
  const pdfBuffer = await pdfGenerator.generateCompanyStatementPDF(company, entries, summary, dateRange);

  // Send PDF
  const filename = `releve_${company.companyId}_${new Date().toISOString().split('T')[0]}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.send(pdfBuffer);
});

/**
 * @desc    Download batch invoice as PDF (bordereau)
 * @route   POST /api/companies/:id/generate-batch-invoice/pdf
 * @access  Private (Admin/Billing)
 */
exports.downloadBatchInvoicePDF = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo, includeUnpaid = true, groupBy = 'patient' } = req.body;

  const company = await Company.findById(req.params.id);
  if (!company) {
    return notFound(res, 'Company');
  }

  // Build query
  const query = {
    'companyBilling.company': company._id,
    isConventionInvoice: true,
    status: { $nin: ['cancelled', 'voided'] }
  };

  if (dateFrom || dateTo) {
    query.dateIssued = {};
    if (dateFrom) query.dateIssued.$gte = new Date(dateFrom);
    if (dateTo) query.dateIssued.$lte = new Date(dateTo);
  }

  if (includeUnpaid) {
    query['companyBilling.companyInvoiceStatus'] = { $in: ['pending', 'sent'] };
  }

  const invoices = await Invoice.find(query)
    .populate('patient', 'patientId firstName lastName convention.employeeId')
    .sort({ dateIssued: 1 })
    .lean();

  if (invoices.length === 0) {
    return error(res, 'Aucune facture à inclure dans le bordereau', 400);
  }

  // Group data (same logic as generateBatchInvoice)
  let groupedData = [];
  let totalCompanyShare = 0;
  let totalPatientShare = 0;

  if (groupBy === 'patient') {
    const patientMap = {};
    for (const inv of invoices) {
      const patientKey = inv.patient?._id?.toString() || 'unknown';
      if (!patientMap[patientKey]) {
        patientMap[patientKey] = {
          patient: {
            _id: inv.patient?._id,
            patientId: inv.patient?.patientId,
            name: `${inv.patient?.lastName || ''} ${inv.patient?.firstName || ''}`.trim(),
            employeeId: inv.patient?.convention?.employeeId
          },
          invoices: [],
          totalCompanyShare: 0,
          totalPatientShare: 0
        };
      }
      patientMap[patientKey].invoices.push(inv);
      patientMap[patientKey].totalCompanyShare += inv.companyBilling?.companyShare || 0;
      patientMap[patientKey].totalPatientShare += inv.companyBilling?.patientShare || 0;
      totalCompanyShare += inv.companyBilling?.companyShare || 0;
      totalPatientShare += inv.companyBilling?.patientShare || 0;
    }
    groupedData = Object.values(patientMap);
  } else {
    const monthMap = {};
    for (const inv of invoices) {
      const monthKey = new Date(inv.dateIssued).toISOString().substring(0, 7);
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          period: monthKey,
          invoices: [],
          totalCompanyShare: 0,
          totalPatientShare: 0
        };
      }
      monthMap[monthKey].invoices.push(inv);
      monthMap[monthKey].totalCompanyShare += inv.companyBilling?.companyShare || 0;
      monthMap[monthKey].totalPatientShare += inv.companyBilling?.patientShare || 0;
      totalCompanyShare += inv.companyBilling?.companyShare || 0;
      totalPatientShare += inv.companyBilling?.patientShare || 0;
    }
    groupedData = Object.values(monthMap).sort((a, b) => a.period.localeCompare(b.period));
  }

  const batchReference = `BATCH-${company.companyId}-${new Date().toISOString().substring(0, 10).replace(/-/g, '')}`;

  const batchData = {
    batchReference,
    company: {
      _id: company._id,
      companyId: company.companyId,
      name: company.name
    },
    period: {
      from: dateFrom || 'Début',
      to: dateTo || 'Aujourd\'hui'
    },
    groupBy,
    groups: groupedData,
    summary: {
      invoiceCount: invoices.length,
      totalCompanyShare,
      totalPatientShare,
      totalAmount: totalCompanyShare + totalPatientShare,
      currency: company.defaultCoverage?.currency || 'CDF'
    }
  };

  // Generate PDF
  const pdfGenerator = require('../services/pdfGenerator');
  const pdfBuffer = await pdfGenerator.generateBatchInvoicePDF(batchData);

  // Send PDF
  const filename = `bordereau_${company.companyId}_${new Date().toISOString().split('T')[0]}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.send(pdfBuffer);
});

/**
 * @desc    Get patient's remaining coverage for current year
 * @route   GET /api/companies/:id/patient/:patientId/remaining-coverage
 * @access  Private
 */
exports.getPatientRemainingCoverage = asyncHandler(async (req, res) => {
  const { id: companyId, patientId } = req.params;
  const { year = new Date().getFullYear() } = req.query;

  const company = await Company.findById(companyId);
  if (!company) {
    return notFound(res, 'Company');
  }

  const patient = await Patient.findById(patientId);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Get YTD usage
  const ytdUsage = await Invoice.getPatientYTDCategoryUsage(patientId, companyId, parseInt(year));

  // Calculate remaining per category
  const categoryLimits = [];
  for (const cat of company.coveredCategories || []) {
    const used = ytdUsage[cat.category]?.totalCompanyShare || 0;
    const limit = cat.maxPerCategory || null;
    const remaining = limit ? Math.max(0, limit - used) : null;

    categoryLimits.push({
      category: cat.category,
      coveragePercentage: cat.coveragePercentage,
      annualLimit: limit,
      used,
      remaining,
      isExhausted: limit ? remaining <= 0 : false,
      requiresApproval: cat.requiresApproval || false,
      notCovered: cat.notCovered || false
    });
  }

  return success(res, {
    data: {
      company: {
        _id: company._id,
        name: company.name
      },
      patient: {
        _id: patient._id,
        patientId: patient.patientId,
        name: `${patient.firstName} ${patient.lastName}`,
        employeeId: patient.convention?.employeeId
      },
      year: parseInt(year),
      maxPerVisit: company.defaultCoverage?.maxPerVisit,
      categoryLimits,
      currency: company.defaultCoverage?.currency || 'CDF'
    }
  });
});

/**
 * @desc    Get parent conventions financial dashboard (all assurances with totals)
 * @route   GET /api/companies/financial-dashboard
 * @access  Private (Admin/Billing)
 */
exports.getConventionsFinancialDashboard = asyncHandler(async (req, res) => {
  const { year = new Date().getFullYear(), includeSubCompanies = true } = req.query;

  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);

  // Get all parent conventions (assurances)
  const parentConventions = await Company.find({
    isParentConvention: true,
    isActive: true
  }).lean();

  // Get all sub-companies grouped by parent
  const subCompanies = await Company.find({
    parentConvention: { $in: parentConventions.map(p => p._id) },
    isActive: true
  }).lean();

  // Create a map of parent -> sub-companies
  const subCompanyMap = {};
  for (const sub of subCompanies) {
    const parentId = sub.parentConvention?.toString();
    if (!subCompanyMap[parentId]) {
      subCompanyMap[parentId] = [];
    }
    subCompanyMap[parentId].push(sub);
  }

  // Aggregate invoice data for each parent convention (including sub-companies)
  const dashboardData = [];

  for (const parent of parentConventions) {
    // Get company IDs to include (parent + sub-companies if flag set)
    const companyIds = [parent._id];
    const subs = subCompanyMap[parent._id.toString()] || [];
    if (includeSubCompanies === 'true' || includeSubCompanies === true) {
      companyIds.push(...subs.map(s => s._id));
    }

    // Aggregate invoices for all these companies
    const invoiceStats = await Invoice.aggregate([
      {
        $match: {
          'companyBilling.company': { $in: companyIds },
          isConventionInvoice: true,
          status: { $nin: ['cancelled', 'voided'] },
          dateIssued: { $gte: startOfYear, $lte: endOfYear }
        }
      },
      {
        $group: {
          _id: null,
          totalBilled: { $sum: { $ifNull: ['$companyBilling.companyShare', 0] } },
          totalPaid: { $sum: { $ifNull: ['$companyBilling.paidAmount', 0] } },
          invoiceCount: { $sum: 1 },
          paidCount: {
            $sum: {
              $cond: [{ $eq: ['$companyBilling.companyInvoiceStatus', 'paid'] }, 1, 0]
            }
          }
        }
      }
    ]);

    const stats = invoiceStats[0] || { totalBilled: 0, totalPaid: 0, invoiceCount: 0, paidCount: 0 };

    // Get aging data
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const agingData = await Invoice.aggregate([
      {
        $match: {
          'companyBilling.company': { $in: companyIds },
          isConventionInvoice: true,
          status: { $nin: ['cancelled', 'voided', 'paid'] },
          'companyBilling.companyInvoiceStatus': { $ne: 'paid' }
        }
      },
      {
        $project: {
          companyShare: { $ifNull: ['$companyBilling.companyShare', 0] },
          paidAmount: { $ifNull: ['$companyBilling.paidAmount', 0] },
          dateIssued: 1,
          outstanding: {
            $subtract: [
              { $ifNull: ['$companyBilling.companyShare', 0] },
              { $ifNull: ['$companyBilling.paidAmount', 0] }
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          current: {
            $sum: {
              $cond: [{ $gte: ['$dateIssued', thirtyDaysAgo] }, '$outstanding', 0]
            }
          },
          days30: {
            $sum: {
              $cond: [
                { $and: [{ $lt: ['$dateIssued', thirtyDaysAgo] }, { $gte: ['$dateIssued', sixtyDaysAgo] }] },
                '$outstanding', 0
              ]
            }
          },
          days60: {
            $sum: {
              $cond: [
                { $and: [{ $lt: ['$dateIssued', sixtyDaysAgo] }, { $gte: ['$dateIssued', ninetyDaysAgo] }] },
                '$outstanding', 0
              ]
            }
          },
          days90Plus: {
            $sum: {
              $cond: [{ $lt: ['$dateIssued', ninetyDaysAgo] }, '$outstanding', 0]
            }
          },
          totalOutstanding: { $sum: '$outstanding' }
        }
      }
    ]);

    const aging = agingData[0] || { current: 0, days30: 0, days60: 0, days90Plus: 0, totalOutstanding: 0 };

    dashboardData.push({
      company: {
        _id: parent._id,
        companyId: parent.companyId,
        name: parent.name,
        conventionCode: parent.conventionCode,
        type: parent.type
      },
      subCompanyCount: subs.length,
      employeeCount: subs.reduce((sum, s) => sum + (s.employeeCount || 0), 0) + (parent.employeeCount || 0),
      contract: {
        status: parent.contract?.status,
        endDate: parent.contract?.endDate
      },
      yearToDate: {
        totalBilled: stats.totalBilled,
        totalPaid: stats.totalPaid,
        outstanding: stats.totalBilled - stats.totalPaid,
        invoiceCount: stats.invoiceCount,
        paidCount: stats.paidCount,
        paymentRate: stats.totalBilled > 0 ? Math.round((stats.totalPaid / stats.totalBilled) * 100) : 0
      },
      aging: {
        current: aging.current,
        days30: aging.days30,
        days60: aging.days60,
        days90Plus: aging.days90Plus,
        totalOutstanding: aging.totalOutstanding
      },
      currency: parent.defaultCoverage?.currency || 'CDF'
    });
  }

  // Sort by outstanding amount (highest first)
  dashboardData.sort((a, b) => b.aging.totalOutstanding - a.aging.totalOutstanding);

  // Calculate grand totals
  const grandTotals = {
    totalBilled: dashboardData.reduce((sum, d) => sum + d.yearToDate.totalBilled, 0),
    totalPaid: dashboardData.reduce((sum, d) => sum + d.yearToDate.totalPaid, 0),
    totalOutstanding: dashboardData.reduce((sum, d) => sum + d.aging.totalOutstanding, 0),
    totalInvoices: dashboardData.reduce((sum, d) => sum + d.yearToDate.invoiceCount, 0),
    agingBreakdown: {
      current: dashboardData.reduce((sum, d) => sum + d.aging.current, 0),
      days30: dashboardData.reduce((sum, d) => sum + d.aging.days30, 0),
      days60: dashboardData.reduce((sum, d) => sum + d.aging.days60, 0),
      days90Plus: dashboardData.reduce((sum, d) => sum + d.aging.days90Plus, 0)
    }
  };

  return success(res, {
    data: {
      dashboardData,
      summary: {
        parentConventionCount: parentConventions.length,
        year: parseInt(year),
        grandTotals
      }
    }
  });
});

/**
 * @desc    Get payment history for a company (with sub-company aggregation for parents)
 * @route   GET /api/companies/:id/payment-history
 * @access  Private (Admin/Billing)
 */
exports.getCompanyPaymentHistory = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo, includeSubCompanies = true } = req.query;

  const company = await Company.findById(req.params.id);
  if (!company) {
    return notFound(res, 'Company');
  }

  // Get company IDs to include
  const companyIds = [company._id];
  let subCompanies = [];

  if (company.isParentConvention && (includeSubCompanies === 'true' || includeSubCompanies === true)) {
    subCompanies = await Company.find({ parentConvention: company._id }).lean();
    companyIds.push(...subCompanies.map(s => s._id));
  }

  // Build date query
  const dateQuery = {};
  if (dateFrom) dateQuery.$gte = new Date(dateFrom);
  if (dateTo) dateQuery.$lte = new Date(dateTo);

  // Get all invoices with payments for these companies
  const invoiceQuery = {
    'companyBilling.company': { $in: companyIds },
    isConventionInvoice: true,
    'payments.0': { $exists: true } // Has at least one payment
  };

  if (Object.keys(dateQuery).length > 0) {
    invoiceQuery['payments.date'] = dateQuery;
  }

  const invoices = await Invoice.find(invoiceQuery)
    .populate('patient', 'patientId firstName lastName convention.employeeId')
    .populate('companyBilling.company', 'name companyId')
    .sort({ 'payments.date': -1 })
    .lean();

  // Extract payment entries
  const payments = [];
  for (const inv of invoices) {
    for (const payment of inv.payments || []) {
      // Filter by date if specified
      if (dateFrom && new Date(payment.date) < new Date(dateFrom)) continue;
      if (dateTo && new Date(payment.date) > new Date(dateTo)) continue;

      // Check if this is a company payment (method = 'company' or 'convention')
      if (payment.method === 'company' || payment.method === 'convention' || payment.isCompanyPayment) {
        payments.push({
          date: payment.date,
          amount: payment.amount,
          currency: payment.currency || 'CDF',
          method: payment.method,
          reference: payment.reference,
          notes: payment.notes,
          invoice: {
            _id: inv._id,
            invoiceId: inv.invoiceId,
            dateIssued: inv.dateIssued,
            companyShare: inv.companyBilling?.companyShare || 0
          },
          patient: {
            name: `${inv.patient?.lastName || ''} ${inv.patient?.firstName || ''}`.trim(),
            employeeId: inv.patient?.convention?.employeeId
          },
          company: {
            _id: inv.companyBilling?.company?._id,
            name: inv.companyBilling?.company?.name || 'N/A'
          },
          recordedBy: payment.receivedBy
        });
      }
    }
  }

  // Sort by date descending
  payments.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Calculate totals
  const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return success(res, {
    data: {
      company: {
        _id: company._id,
        companyId: company.companyId,
        name: company.name,
        isParentConvention: company.isParentConvention
      },
      includesSubCompanies: company.isParentConvention && subCompanies.length > 0,
      subCompanyCount: subCompanies.length,
      period: {
        from: dateFrom || 'Début',
        to: dateTo || 'Aujourd\'hui'
      },
      payments,
      summary: {
        paymentCount: payments.length,
        totalPayments,
        currency: company.defaultCoverage?.currency || 'CDF'
      }
    }
  });
});

/**
 * @desc    Get aging report for all conventions
 * @route   GET /api/companies/aging-report
 * @access  Private (Admin/Billing)
 */
exports.getConventionsAgingReport = asyncHandler(async (req, res) => {
  const { asOfDate = new Date() } = req.query;
  const asOf = new Date(asOfDate);

  const thirtyDaysAgo = new Date(asOf.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(asOf.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(asOf.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Get aging data by company
  const agingData = await Invoice.aggregate([
    {
      $match: {
        isConventionInvoice: true,
        status: { $nin: ['cancelled', 'voided'] },
        'companyBilling.companyInvoiceStatus': { $nin: ['paid'] },
        dateIssued: { $lte: asOf }
      }
    },
    {
      $project: {
        company: '$companyBilling.company',
        companyName: '$companyBilling.companyName',
        invoiceId: 1,
        dateIssued: 1,
        companyShare: { $ifNull: ['$companyBilling.companyShare', 0] },
        paidAmount: { $ifNull: ['$companyBilling.paidAmount', 0] },
        outstanding: {
          $subtract: [
            { $ifNull: ['$companyBilling.companyShare', 0] },
            { $ifNull: ['$companyBilling.paidAmount', 0] }
          ]
        },
        bucket: {
          $switch: {
            branches: [
              { case: { $gte: ['$dateIssued', thirtyDaysAgo] }, then: 'current' },
              { case: { $gte: ['$dateIssued', sixtyDaysAgo] }, then: 'days30' },
              { case: { $gte: ['$dateIssued', ninetyDaysAgo] }, then: 'days60' }
            ],
            default: 'days90Plus'
          }
        }
      }
    },
    {
      $group: {
        _id: {
          company: '$company',
          companyName: '$companyName',
          bucket: '$bucket'
        },
        amount: { $sum: '$outstanding' },
        invoiceCount: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: {
          company: '$_id.company',
          companyName: '$_id.companyName'
        },
        buckets: {
          $push: {
            bucket: '$_id.bucket',
            amount: '$amount',
            invoiceCount: '$invoiceCount'
          }
        },
        totalOutstanding: { $sum: '$amount' },
        totalInvoices: { $sum: '$invoiceCount' }
      }
    },
    { $sort: { totalOutstanding: -1 } }
  ]);

  // Get company details
  const companyIds = agingData.map(a => a._id.company);
  const companies = await Company.find({ _id: { $in: companyIds } })
    .select('companyId name parentConvention isParentConvention contract')
    .lean();

  const companyMap = {};
  for (const c of companies) {
    companyMap[c._id.toString()] = c;
  }

  // Format report data
  const reportData = agingData.map(item => {
    const company = companyMap[item._id.company?.toString()] || {};
    const bucketMap = {};
    for (const b of item.buckets) {
      bucketMap[b.bucket] = { amount: b.amount, count: b.invoiceCount };
    }

    return {
      company: {
        _id: item._id.company,
        companyId: company.companyId,
        name: item._id.companyName || company.name,
        isParentConvention: company.isParentConvention,
        contractStatus: company.contract?.status
      },
      aging: {
        current: bucketMap.current || { amount: 0, count: 0 },
        days30: bucketMap.days30 || { amount: 0, count: 0 },
        days60: bucketMap.days60 || { amount: 0, count: 0 },
        days90Plus: bucketMap.days90Plus || { amount: 0, count: 0 }
      },
      totalOutstanding: item.totalOutstanding,
      totalInvoices: item.totalInvoices
    };
  });

  // Calculate grand totals
  const grandTotals = {
    current: reportData.reduce((sum, r) => sum + (r.aging.current.amount || 0), 0),
    days30: reportData.reduce((sum, r) => sum + (r.aging.days30.amount || 0), 0),
    days60: reportData.reduce((sum, r) => sum + (r.aging.days60.amount || 0), 0),
    days90Plus: reportData.reduce((sum, r) => sum + (r.aging.days90Plus.amount || 0), 0),
    total: reportData.reduce((sum, r) => sum + r.totalOutstanding, 0),
    invoiceCount: reportData.reduce((sum, r) => sum + r.totalInvoices, 0)
  };

  return success(res, {
    data: {
      reportData,
      summary: {
        asOfDate: asOf,
        companyCount: reportData.length,
        grandTotals
      }
    }
  });
});

/**
 * @desc    Download aging report as PDF
 * @route   GET /api/companies/aging-report/pdf
 * @access  Private (Admin/Billing)
 */
exports.downloadAgingReportPDF = asyncHandler(async (req, res) => {
  const { asOfDate = new Date() } = req.query;

  // Get the same data as aging report
  const asOf = new Date(asOfDate);
  const thirtyDaysAgo = new Date(asOf.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(asOf.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(asOf.getTime() - 90 * 24 * 60 * 60 * 1000);

  const agingData = await Invoice.aggregate([
    {
      $match: {
        isConventionInvoice: true,
        status: { $nin: ['cancelled', 'voided'] },
        'companyBilling.companyInvoiceStatus': { $nin: ['paid'] },
        dateIssued: { $lte: asOf }
      }
    },
    {
      $project: {
        company: '$companyBilling.company',
        companyName: '$companyBilling.companyName',
        outstanding: {
          $subtract: [
            { $ifNull: ['$companyBilling.companyShare', 0] },
            { $ifNull: ['$companyBilling.paidAmount', 0] }
          ]
        },
        bucket: {
          $switch: {
            branches: [
              { case: { $gte: ['$dateIssued', thirtyDaysAgo] }, then: 'current' },
              { case: { $gte: ['$dateIssued', sixtyDaysAgo] }, then: 'days30' },
              { case: { $gte: ['$dateIssued', ninetyDaysAgo] }, then: 'days60' }
            ],
            default: 'days90Plus'
          }
        }
      }
    },
    {
      $group: {
        _id: { company: '$company', companyName: '$companyName', bucket: '$bucket' },
        amount: { $sum: '$outstanding' },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: { company: '$_id.company', companyName: '$_id.companyName' },
        buckets: { $push: { bucket: '$_id.bucket', amount: '$amount', count: '$count' } },
        total: { $sum: '$amount' }
      }
    },
    { $sort: { total: -1 } }
  ]);

  // Format for PDF
  const reportRows = agingData.map(item => {
    const bucketMap = {};
    for (const b of item.buckets) {
      bucketMap[b.bucket] = b.amount;
    }
    return {
      company: item._id.companyName || 'N/A',
      current: bucketMap.current || 0,
      days30: bucketMap.days30 || 0,
      days60: bucketMap.days60 || 0,
      days90Plus: bucketMap.days90Plus || 0,
      total: item.total
    };
  });

  const grandTotals = {
    current: reportRows.reduce((sum, r) => sum + r.current, 0),
    days30: reportRows.reduce((sum, r) => sum + r.days30, 0),
    days60: reportRows.reduce((sum, r) => sum + r.days60, 0),
    days90Plus: reportRows.reduce((sum, r) => sum + r.days90Plus, 0),
    total: reportRows.reduce((sum, r) => sum + r.total, 0)
  };

  // Generate PDF
  const pdfGenerator = require('../services/pdfGenerator');
  const pdfBuffer = await pdfGenerator.generateAgingReportPDF(reportRows, grandTotals, asOf);

  const filename = `aging_report_${new Date().toISOString().split('T')[0]}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.send(pdfBuffer);
});
