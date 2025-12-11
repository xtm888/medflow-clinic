const FeeSchedule = require('../../models/FeeSchedule');
const TaxConfig = require('../../models/TaxConfig');
const { asyncHandler } = require('../../middleware/errorHandler');

// =====================
// FEE SCHEDULE
// =====================

// @desc    Get fee schedule
// @route   GET /api/billing/fee-schedule
// @access  Private
exports.getFeeSchedule = asyncHandler(async (req, res) => {
  const { category, search, active = true, clinic, templates } = req.query;

  // If requesting templates
  if (templates === 'true') {
    const templateItems = await FeeSchedule.getTemplates({ category, search, includeInactive: active === 'false' });
    return res.status(200).json({
      success: true,
      count: templateItems.length,
      data: templateItems
    });
  }

  // If clinic specified, get clinic-specific prices
  if (clinic) {
    const clinicItems = await FeeSchedule.getForClinic(clinic, {
      category,
      search,
      includeInactive: active === 'false'
    });
    return res.status(200).json({
      success: true,
      count: clinicItems.length,
      data: clinicItems
    });
  }

  // Legacy behavior: get all (for backward compatibility)
  let query = { active: active !== 'false' };
  if (category) query.category = category;

  let feeSchedule;
  if (search) {
    feeSchedule = await FeeSchedule.search(search);
  } else {
    feeSchedule = await FeeSchedule.find(query).sort('category name');
  }

  res.status(200).json({
    success: true,
    count: feeSchedule.length,
    data: feeSchedule
  });
});

// @desc    Create fee schedule item
// @route   POST /api/billing/fee-schedule
// @access  Private (Admin)
exports.createFeeItem = asyncHandler(async (req, res) => {
  req.body.createdBy = req.user.id;
  const feeItem = await FeeSchedule.create(req.body);

  res.status(201).json({
    success: true,
    data: feeItem
  });
});

// @desc    Update fee schedule item
// @route   PUT /api/billing/fee-schedule/:id
// @access  Private (Admin)
exports.updateFeeItem = asyncHandler(async (req, res) => {
  req.body.updatedBy = req.user.id;
  const feeItem = await FeeSchedule.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!feeItem) {
    return res.status(404).json({ success: false, error: 'Fee item not found' });
  }

  res.status(200).json({
    success: true,
    data: feeItem
  });
});

// @desc    Delete fee schedule item
// @route   DELETE /api/billing/fee-schedule/:id
// @access  Private (Admin)
exports.deleteFeeItem = asyncHandler(async (req, res) => {
  const feeItem = await FeeSchedule.findByIdAndUpdate(req.params.id, { active: false });

  if (!feeItem) {
    return res.status(404).json({ success: false, error: 'Fee item not found' });
  }

  res.status(200).json({
    success: true,
    message: 'Fee item deactivated'
  });
});

// @desc    Copy fee schedules to a clinic
// @route   POST /api/billing/fee-schedule/copy-to-clinic
// @access  Private (Admin)
exports.copyFeeScheduleToClinic = asyncHandler(async (req, res) => {
  const { sourceClinic, targetClinic, overwrite = false } = req.body;

  if (!targetClinic) {
    return res.status(400).json({
      success: false,
      error: 'Target clinic is required'
    });
  }

  // sourceClinic can be null (for templates) or a clinic ID
  const results = await FeeSchedule.copyToClinic(
    sourceClinic || null,
    targetClinic,
    { overwrite, userId: req.user.id }
  );

  res.status(200).json({
    success: true,
    message: `Copied ${results.created} items, updated ${results.updated}, skipped ${results.skipped}`,
    data: results
  });
});

// @desc    Get clinic pricing status (completeness check)
// @route   GET /api/billing/fee-schedule/clinic-status
// @access  Private (Admin)
exports.getClinicPricingStatus = asyncHandler(async (req, res) => {
  const { clinics } = req.query;

  const clinicIds = clinics ? clinics.split(',') : [];
  const status = await FeeSchedule.getClinicPricingStatus(clinicIds);

  res.status(200).json({
    success: true,
    data: status
  });
});

// @desc    Get templates (central fee schedule)
// @route   GET /api/billing/fee-schedule/templates
// @access  Private
exports.getFeeScheduleTemplates = asyncHandler(async (req, res) => {
  const { category, search, active } = req.query;

  const templates = await FeeSchedule.getTemplates({
    category,
    search,
    includeInactive: active === 'false'
  });

  res.status(200).json({
    success: true,
    count: templates.length,
    data: templates
  });
});

// @desc    Get billing codes
// @route   GET /api/billing/codes
// @access  Private
exports.getBillingCodes = asyncHandler(async (req, res) => {
  const { type } = req.query;

  // Sample billing codes (ICD-10, CPT equivalents for ophthalmology)
  const codes = {
    diagnosis: [
      { code: 'H52.1', name: 'Myopie', category: 'Réfraction' },
      { code: 'H52.0', name: 'Hypermétropie', category: 'Réfraction' },
      { code: 'H52.2', name: 'Astigmatisme', category: 'Réfraction' },
      { code: 'H40.1', name: 'Glaucome primaire à angle ouvert', category: 'Glaucome' },
      { code: 'H35.3', name: 'DMLA', category: 'Rétine' },
      { code: 'E11.3', name: 'Rétinopathie diabétique', category: 'Rétine' },
      { code: 'H25.0', name: 'Cataracte sénile', category: 'Cristallin' }
    ],
    procedure: [
      { code: '92004', name: 'Examen ophtalmologique complet, nouveau patient', category: 'Consultation' },
      { code: '92012', name: 'Examen ophtalmologique complet, patient établi', category: 'Consultation' },
      { code: '92015', name: 'Détermination de réfraction', category: 'Réfraction' },
      { code: '92134', name: 'OCT', category: 'Imagerie' },
      { code: '67028', name: 'Injection intravitréenne', category: 'Procédure' }
    ]
  };

  const result = type ? { [type]: codes[type] || [] } : codes;

  res.status(200).json({
    success: true,
    data: result
  });
});

// @desc    Search billing codes
// @route   GET /api/billing/codes/search
// @access  Private
exports.searchBillingCodes = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({
      success: false,
      error: 'Search query is required'
    });
  }

  // This would typically search a database
  // For now, return sample results
  const allCodes = [
    { code: 'H52.1', name: 'Myopie', type: 'diagnosis' },
    { code: 'H40.1', name: 'Glaucome primaire à angle ouvert', type: 'diagnosis' },
    { code: '92004', name: 'Examen ophtalmologique complet', type: 'procedure' },
    { code: '67028', name: 'Injection intravitréenne', type: 'procedure' }
  ];

  const results = allCodes.filter(code =>
    code.code.toLowerCase().includes(q.toLowerCase()) ||
    code.name.toLowerCase().includes(q.toLowerCase())
  );

  res.status(200).json({
    success: true,
    data: results
  });
});

// =====================
// TAX CONFIGURATION
// =====================

// @desc    Get tax rates
// @route   GET /api/billing/taxes
// @access  Private
exports.getTaxRates = asyncHandler(async (req, res) => {
  const { active = true, category } = req.query;

  let query = {};
  if (active !== 'all') query.active = active === 'true';
  if (category) query.applicableCategories = { $in: [category, 'all'] };

  const taxes = await TaxConfig.find(query).sort('name');

  res.status(200).json({
    success: true,
    count: taxes.length,
    data: taxes
  });
});

// @desc    Create tax rate
// @route   POST /api/billing/taxes
// @access  Private (Admin)
exports.createTaxRate = asyncHandler(async (req, res) => {
  req.body.createdBy = req.user.id;
  const tax = await TaxConfig.create(req.body);

  res.status(201).json({
    success: true,
    data: tax
  });
});

// @desc    Update tax rate
// @route   PUT /api/billing/taxes/:id
// @access  Private (Admin)
exports.updateTaxRate = asyncHandler(async (req, res) => {
  req.body.updatedBy = req.user.id;
  const tax = await TaxConfig.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!tax) {
    return res.status(404).json({ success: false, error: 'Tax rate not found' });
  }

  res.status(200).json({
    success: true,
    data: tax
  });
});

// @desc    Delete tax rate
// @route   DELETE /api/billing/taxes/:id
// @access  Private (Admin)
exports.deleteTaxRate = asyncHandler(async (req, res) => {
  const tax = await TaxConfig.findByIdAndUpdate(req.params.id, { active: false });

  if (!tax) {
    return res.status(404).json({ success: false, error: 'Tax rate not found' });
  }

  res.status(200).json({
    success: true,
    message: 'Tax rate deactivated'
  });
});

// @desc    Calculate tax for amount
// @route   POST /api/billing/taxes/calculate
// @access  Private
exports.calculateTax = asyncHandler(async (req, res) => {
  const { amount, category } = req.body;

  if (!amount) {
    return res.status(400).json({ success: false, error: 'Amount is required' });
  }

  const taxResult = await TaxConfig.calculateTax(amount, category);

  res.status(200).json({
    success: true,
    data: taxResult
  });
});
