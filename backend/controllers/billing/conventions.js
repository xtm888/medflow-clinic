const Invoice = require('../../models/Invoice');
const Company = require('../../models/Company');
const ConventionFeeSchedule = require('../../models/ConventionFeeSchedule');
const Approval = require('../../models/Approval');
const currencyService = require('../../services/currencyService');
const { asyncHandler } = require('../../middleware/errorHandler');

// @desc    Apply convention/company billing to invoice
// @route   POST /api/billing/convention/apply/:invoiceId
// @access  Private (Admin, Billing)
exports.applyConventionBilling = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;
  const { companyId, exchangeRateUSD } = req.body;

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Facture non trouvée'
    });
  }

  if (invoice.isConventionInvoice) {
    return res.status(400).json({
      success: false,
      message: 'Cette facture a déjà une facturation convention appliquée'
    });
  }

  // Get exchange rate if not provided
  let rate = exchangeRateUSD;
  if (!rate) {
    try {
      const rates = await currencyService.getExchangeRates('CDF');
      rate = rates.USD || null;
    } catch (err) {
      console.warn('Could not get exchange rate:', err.message);
    }
  }

  await invoice.applyCompanyBilling(companyId, req.user.id, rate);

  await invoice.populate([
    { path: 'patient', select: 'firstName lastName patientId convention' },
    { path: 'companyBilling.company', select: 'name companyId' }
  ]);

  res.status(200).json({
    success: true,
    message: 'Facturation convention appliquée',
    data: invoice
  });
});

// @desc    Mark invoice item as realized
// @route   POST /api/billing/realize/:invoiceId/item/:itemIndex
// @access  Private
exports.markItemRealized = asyncHandler(async (req, res) => {
  const { invoiceId, itemIndex } = req.params;
  const { notes } = req.body;

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Facture non trouvée'
    });
  }

  await invoice.markItemRealized(parseInt(itemIndex), req.user.id, notes);

  res.status(200).json({
    success: true,
    message: 'Acte marqué comme réalisé',
    data: {
      invoiceId: invoice.invoiceId,
      item: invoice.items[itemIndex]
    }
  });
});

// @desc    Mark all invoice items as realized
// @route   POST /api/billing/realize/:invoiceId/all
// @access  Private
exports.markAllRealized = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;
  const { notes } = req.body;

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Facture non trouvée'
    });
  }

  const result = await invoice.markAllRealized(req.user.id, notes);

  res.status(200).json({
    success: true,
    message: `${result.realizedCount} acte(s) réalisé(s)`,
    data: result
  });
});

// @desc    Update company invoice status
// @route   PUT /api/billing/convention/:invoiceId/status
// @access  Private (Admin, Billing)
exports.updateCompanyInvoiceStatus = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;
  const { status, reference, notes } = req.body;

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Facture non trouvée'
    });
  }

  await invoice.updateCompanyInvoiceStatus(status, req.user.id, reference, notes);

  res.status(200).json({
    success: true,
    message: 'Statut mis à jour',
    data: {
      invoiceId: invoice.invoiceId,
      companyInvoiceStatus: invoice.companyBilling.companyInvoiceStatus
    }
  });
});

// @desc    Record company payment on invoice
// @route   POST /api/billing/convention/:invoiceId/payment
// @access  Private (Admin, Billing)
exports.recordConventionPayment = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;
  const { amount, reference, notes } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Montant invalide'
    });
  }

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Facture non trouvée'
    });
  }

  await invoice.recordCompanyPayment(amount, req.user.id, reference, notes);

  res.status(200).json({
    success: true,
    message: 'Paiement enregistré',
    data: {
      invoiceId: invoice.invoiceId,
      companyPayment: invoice.companyBilling.companyPayment,
      companyInvoiceStatus: invoice.companyBilling.companyInvoiceStatus
    }
  });
});

// @desc    Get convention invoices report
// @route   GET /api/billing/convention/invoices
// @access  Private (Admin, Billing, Manager)
exports.getConventionInvoices = asyncHandler(async (req, res) => {
  const { companyId, status, startDate, endDate, page = 1, limit = 50 } = req.query;

  const query = {
    isConventionInvoice: true,
    status: { $nin: ['cancelled', 'refunded'] }
  };

  if (companyId) {
    query['companyBilling.company'] = companyId;
  }

  if (status) {
    query['companyBilling.companyInvoiceStatus'] = status;
  }

  if (startDate || endDate) {
    query.dateIssued = {};
    if (startDate) query.dateIssued.$gte = new Date(startDate);
    if (endDate) query.dateIssued.$lte = new Date(endDate);
  }

  const total = await Invoice.countDocuments(query);
  const invoices = await Invoice.find(query)
    .populate('patient', 'firstName lastName patientId')
    .populate('companyBilling.company', 'name companyId')
    .select('invoiceId dateIssued patient summary companyBilling status')
    .sort({ dateIssued: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  // Calculate summary
  const allInvoices = await Invoice.find(query).select('companyBilling');
  const summary = {
    totalInvoices: total,
    totalCompanyShare: allInvoices.reduce((sum, inv) => sum + (inv.companyBilling?.companyShare || 0), 0),
    totalPatientShare: allInvoices.reduce((sum, inv) => sum + (inv.companyBilling?.patientShare || 0), 0),
    totalPaid: allInvoices.reduce((sum, inv) => sum + (inv.companyBilling?.companyPayment?.amount || 0), 0)
  };
  summary.outstanding = summary.totalCompanyShare - summary.totalPaid;

  res.status(200).json({
    success: true,
    data: invoices,
    summary,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get company billing summary
// @route   GET /api/billing/convention/summary/:companyId
// @access  Private (Admin, Billing, Manager)
exports.getCompanyBillingSummary = asyncHandler(async (req, res) => {
  const { companyId } = req.params;
  const { startDate, endDate } = req.query;

  const company = await Company.findById(companyId);
  if (!company) {
    return res.status(404).json({
      success: false,
      message: 'Entreprise non trouvée'
    });
  }

  const summary = await Invoice.getCompanyBillingSummary(companyId, startDate, endDate);

  res.status(200).json({
    success: true,
    data: {
      company: {
        id: company._id,
        companyId: company.companyId,
        name: company.name,
        balance: company.balance
      },
      billing: summary
    }
  });
});

// @desc    Get unrealized items report
// @route   GET /api/billing/convention/unrealized
// @access  Private (Admin, Billing, Manager)
exports.getUnrealizedItems = asyncHandler(async (req, res) => {
  const { companyId, startDate, endDate } = req.query;

  const invoices = await Invoice.getUnrealizedItems({
    companyId,
    startDate,
    endDate
  });

  // Extract unrealized items with invoice context
  const unrealizedItems = [];
  for (const invoice of invoices) {
    for (let i = 0; i < invoice.items.length; i++) {
      const item = invoice.items[i];
      if (!item.realization?.realized) {
        unrealizedItems.push({
          invoiceId: invoice.invoiceId,
          invoiceDbId: invoice._id,
          itemIndex: i,
          patient: invoice.patient,
          company: invoice.companyBilling?.company,
          dateIssued: invoice.dateIssued,
          item: {
            description: item.description,
            code: item.code,
            category: item.category,
            quantity: item.quantity,
            total: item.total,
            prescriber: item.prescriber,
            approvalRequired: item.approvalRequired,
            approvalStatus: item.approvalStatus
          }
        });
      }
    }
  }

  res.status(200).json({
    success: true,
    data: unrealizedItems,
    count: unrealizedItems.length
  });
});

// @desc    Check approval requirement for act
// @route   GET /api/billing/convention/check-approval
// @access  Private
exports.checkApprovalRequirement = asyncHandler(async (req, res) => {
  const { patientId, companyId, actCode } = req.query;

  if (!patientId || !companyId || !actCode) {
    return res.status(400).json({
      success: false,
      message: 'Patient, entreprise et code acte requis'
    });
  }

  // Check if company requires approval for this act
  const company = await Company.findById(companyId);
  if (!company) {
    return res.status(404).json({
      success: false,
      message: 'Entreprise non trouvée'
    });
  }

  const requiresApproval = company.requiresApproval(actCode);

  // Check if approval already exists
  const existingApproval = await Approval.checkApproval(patientId, companyId, actCode);

  res.status(200).json({
    success: true,
    data: {
      requiresApproval,
      hasApproval: existingApproval.hasApproval,
      approval: existingApproval.approval ? {
        approvalId: existingApproval.approval.approvalId,
        status: existingApproval.approval.status,
        validUntil: existingApproval.approval.validUntil,
        remainingQuantity: existingApproval.remainingQuantity
      } : null
    }
  });
});

// @desc    Get convention price for service
// @route   GET /api/billing/convention/price
// @access  Private
exports.getConventionPrice = asyncHandler(async (req, res) => {
  const { companyId, code } = req.query;

  if (!companyId || !code) {
    return res.status(400).json({
      success: false,
      message: 'Entreprise et code acte requis'
    });
  }

  const priceInfo = await ConventionFeeSchedule.getPriceForCompanyAndCode(companyId, code);

  // Get exchange rate for USD display
  let priceUSD = null;
  if (priceInfo.found && priceInfo.price) {
    try {
      const rates = await currencyService.getExchangeRates('CDF');
      if (rates.USD) {
        priceUSD = Math.round((priceInfo.price / rates.USD) * 100) / 100;
      }
    } catch (err) {
      console.warn('Could not get exchange rate:', err.message);
    }
  }

  res.status(200).json({
    success: true,
    data: {
      ...priceInfo,
      priceUSD
    }
  });
});
