/**
 * Invoice Billing Controller
 *
 * Handles convention billing and category-filtered invoice views:
 * - previewCompanyBilling, applyCompanyBilling, consumeApprovals
 * - getPharmacyInvoiceView, getOpticalInvoiceView, getClinicInvoiceView
 * - markItemCompleted, markItemExternal, collectItemPayment, getInvoiceItems
 */

const {
  Invoice,
  Visit,
  Company,
  Approval,
  asyncHandler,
  success,
  error,
  notFound,
  badRequest,
  findPatientByIdOrCode,
  websocketService,
  invoiceLogger
} = require('./shared');

// Import category filter middleware functions
const {
  getAllowedCategories,
  canPerformAction,
  filterInvoiceItems,
  getCollectionPoint
} = require('../../middleware/invoiceCategoryFilter');

// =====================================================
// CONVENTION BILLING FUNCTIONS
// =====================================================

// @desc    Preview company billing before applying (with approval validation)
// @route   POST /api/invoices/:id/preview-company-billing
// @access  Private (Admin, Accountant, Receptionist)
const previewCompanyBilling = asyncHandler(async (req, res, next) => {
  const { companyId, exchangeRateUSD } = req.body;

  // Get the invoice
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) {
    return notFound(res, 'Facture');
  }

  // Get the company
  const company = await Company.findById(companyId);
  if (!company) {
    return notFound(res, 'Entreprise');
  }

  // Check contract status
  const contractIssues = [];
  if (company.contract?.status !== 'active') {
    contractIssues.push(`Contrat non actif (${company.contract?.status})`);
  }
  if (company.contract?.endDate && new Date(company.contract.endDate) < new Date()) {
    contractIssues.push('Contrat expiré');
  }

  // Get patient for coverage info
  const patient = await findPatientByIdOrCode(invoice.patient);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Determine base coverage
  let baseCoveragePercentage = company.defaultCoverage.percentage;
  if (patient.convention?.coveragePercentage != null) {
    baseCoveragePercentage = patient.convention.coveragePercentage;
  }

  // Validate each item for approvals
  let totalCompanyShare = 0;
  let totalPatientShare = 0;
  const itemValidations = [];
  const approvalWarnings = [];
  let hasApprovalIssues = false;

  for (let i = 0; i < invoice.items.length; i++) {
    const item = invoice.items[i];
    const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);

    // Check if requires approval
    let approvalRequired = false;
    let approvalReason = null;

    // Check specific acts
    if (company.actsRequiringApproval?.length > 0) {
      const specificAct = company.actsRequiringApproval.find(
        a => a.actCode?.toUpperCase() === item.code?.toUpperCase()
      );
      if (specificAct) {
        approvalRequired = true;
        approvalReason = specificAct.reason || 'Acte spécifique nécessitant une approbation';
      }
    }

    // Check category
    if (!approvalRequired && company.coveredCategories?.length > 0) {
      const categorySettings = company.coveredCategories.find(c => c.category === item.category);
      if (categorySettings?.requiresApproval) {
        approvalRequired = true;
        approvalReason = `Catégorie "${item.category}" nécessite une approbation`;
      }
    }

    const validation = {
      index: i,
      code: item.code,
      description: item.description,
      category: item.category,
      itemTotal,
      approvalRequired,
      approvalReason,
      approvalStatus: 'not_required',
      approval: null,
      companyShare: 0,
      patientShare: itemTotal
    };

    if (approvalRequired) {
      // Check for valid approval
      const now = new Date();
      const approval = await Approval.findOne({
        patient: invoice.patient,
        company: company._id,
        actCode: item.code?.toUpperCase(),
        status: 'approved',
        $or: [{ validFrom: null }, { validFrom: { $lte: now } }]
      }).sort({ createdAt: -1 });

      const isValid = approval &&
        (!approval.validUntil || new Date(approval.validUntil) >= now) &&
        (!approval.quantityApproved || approval.usedCount < approval.quantityApproved);

      if (isValid) {
        validation.approvalStatus = 'approved';
        validation.approval = {
          _id: approval._id,
          approvalId: approval.approvalId,
          approvedAmount: approval.approvedAmount,
          remainingQuantity: approval.quantityApproved ? (approval.quantityApproved - approval.usedCount) : null,
          validUntil: approval.validUntil
        };

        // Calculate coverage
        const categorySettings = company.getCategorySettings(item.category);
        const itemCoveragePercentage = categorySettings.percentage ?? baseCoveragePercentage;
        let itemCompanyShare = Math.round((itemTotal * itemCoveragePercentage) / 100);
        if (categorySettings.maxAmount && itemCompanyShare > categorySettings.maxAmount) {
          itemCompanyShare = categorySettings.maxAmount;
        }

        validation.companyShare = itemCompanyShare;
        validation.patientShare = itemTotal - itemCompanyShare;
        totalCompanyShare += itemCompanyShare;
        totalPatientShare += validation.patientShare;

        // Warn if approved amount is less than item total
        if (approval.approvedAmount && itemTotal > approval.approvedAmount) {
          approvalWarnings.push(`Ligne ${i + 1}: Montant approuvé (${approval.approvedAmount}) < facturé (${itemTotal})`);
        }
      } else {
        // No valid approval
        validation.approvalStatus = 'missing';
        validation.companyShare = 0;
        validation.patientShare = itemTotal;
        totalPatientShare += itemTotal;
        hasApprovalIssues = true;

        approvalWarnings.push(`Ligne ${i + 1} (${item.description}): Délibération manquante - Patient responsable à 100%`);
      }
    } else {
      // No approval required - apply coverage
      const categorySettings = company.getCategorySettings(item.category);
      const itemCoveragePercentage = categorySettings.percentage ?? baseCoveragePercentage;
      let itemCompanyShare = Math.round((itemTotal * itemCoveragePercentage) / 100);
      if (categorySettings.maxAmount && itemCompanyShare > categorySettings.maxAmount) {
        itemCompanyShare = categorySettings.maxAmount;
      }

      validation.companyShare = itemCompanyShare;
      validation.patientShare = itemTotal - itemCompanyShare;
      totalCompanyShare += itemCompanyShare;
      totalPatientShare += validation.patientShare;
    }

    itemValidations.push(validation);
  }

  // Apply max per visit
  let maxPerVisitApplied = false;
  if (company.defaultCoverage.maxPerVisit && totalCompanyShare > company.defaultCoverage.maxPerVisit) {
    const excess = totalCompanyShare - company.defaultCoverage.maxPerVisit;
    totalCompanyShare = company.defaultCoverage.maxPerVisit;
    totalPatientShare += excess;
    maxPerVisitApplied = true;
    approvalWarnings.push(`Plafond par visite (${company.defaultCoverage.maxPerVisit} ${company.defaultCoverage.currency}) appliqué`);
  }

  const total = invoice.summary.total;
  const effectiveCoveragePercentage = total > 0 ? Math.round((totalCompanyShare / total) * 100) : 0;

  // Calculate USD if rate provided
  let companyShareUSD = null;
  let patientShareUSD = null;
  if (exchangeRateUSD && exchangeRateUSD > 0) {
    companyShareUSD = Math.round((totalCompanyShare / exchangeRateUSD) * 100) / 100;
    patientShareUSD = Math.round((totalPatientShare / exchangeRateUSD) * 100) / 100;
  }

  return success(res, {
    data: {
      invoice: {
        _id: invoice._id,
        invoiceId: invoice.invoiceId,
        total: invoice.summary.total
      },
      company: {
        _id: company._id,
        companyId: company.companyId,
        name: company.name,
        contractStatus: company.contract?.status,
        contractIssues
      },
      patient: {
        _id: patient._id,
        patientId: patient.patientId,
        name: `${patient.firstName} ${patient.lastName}`,
        employeeId: patient.convention?.employeeId
      },
      coverage: {
        baseCoveragePercentage,
        effectiveCoveragePercentage,
        maxPerVisit: company.defaultCoverage.maxPerVisit,
        maxPerVisitApplied,
        currency: company.defaultCoverage.currency
      },
      summary: {
        total,
        companyShare: totalCompanyShare,
        patientShare: totalPatientShare,
        companyShareUSD,
        patientShareUSD
      },
      approvalValidation: {
        hasIssues: hasApprovalIssues,
        warnings: approvalWarnings,
        itemsNeedingApproval: itemValidations.filter(v => v.approvalStatus === 'missing').length
      },
      items: itemValidations,
      canApply: contractIssues.length === 0
    }
  });
});

// @desc    Apply company billing to invoice
// @route   POST /api/invoices/:id/apply-company-billing
// @access  Private (Admin, Accountant, Receptionist)
const applyCompanyBilling = asyncHandler(async (req, res, next) => {
  const { companyId, exchangeRateUSD, acknowledgeApprovalIssues } = req.body;

  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) {
    return notFound(res, 'Facture');
  }

  // Check if already has company billing
  if (invoice.isConventionInvoice && invoice.companyBilling?.company) {
    return badRequest(res, 'Cette facture a déjà une facturation convention appliquée');
  }

  try {
    const result = await invoice.applyCompanyBilling(companyId, req.user._id, exchangeRateUSD);

    // Check if there are approval issues and user didn't acknowledge
    if (result.approvalIssues?.hasIssues && !acknowledgeApprovalIssues) {
      return res.status(200).json({
        success: true,
        requiresAcknowledgement: true,
        message: 'Délibérations manquantes pour certains actes - le patient sera responsable à 100% pour ces lignes',
        data: result
      });
    }

    return success(res, { data: result });
  } catch (err) {
    return badRequest(res, err.message);
  }
});

// @desc    Consume approvals for a paid invoice
// @route   POST /api/invoices/:id/consume-approvals
// @access  Private (Admin, Accountant)
const consumeApprovals = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) {
    return notFound(res, 'Facture');
  }

  if (!invoice.isConventionInvoice) {
    return badRequest(res, 'Cette facture n\'est pas une facture convention');
  }

  try {
    const result = await invoice.consumeApprovals(req.user._id);

    return success(res, { data: result });
  } catch (err) {
    return badRequest(res, err.message);
  }
});

// =====================================================
// CATEGORY-FILTERED INVOICE VIEWS
// =====================================================

// @desc    Get pharmacy view of invoice by visit
// @route   GET /api/invoices/pharmacy/:visitId
// @access  Private (pharmacist, pharmacy_receptionist)
const getPharmacyInvoiceView = asyncHandler(async (req, res, next) => {
  const { visitId } = req.params;

  // Find visit and its invoice
  const visit = await Visit.findById(visitId);
  if (!visit) {
    return notFound(res, 'Visite');
  }

  // Find invoice for this visit
  const invoice = await Invoice.findOne({ visit: visitId })
    .populate('patient', 'firstName lastName patientId phoneNumber convention')
    .populate('items.completedBy', 'firstName lastName')
    .populate('items.paymentCollectedBy', 'firstName lastName');

  if (!invoice) {
    return notFound(res, 'Aucune facture trouvée pour cette visite');
  }

  // Filter to medication category only
  const allowedCategories = ['medication'];
  const filteredInvoice = filterInvoiceItems(invoice, allowedCategories);

  // Add prescriptions context
  const Prescription = require('../../models/Prescription');
  const prescriptions = await Prescription.find({ visit: visitId })
    .populate('prescriber', 'firstName lastName')
    .select('medications status dispensing createdAt');

  return success(res, {
    data: {
      invoice: filteredInvoice,
      prescriptions,
      collectionPoint: 'pharmacy',
      canDispense: await canPerformAction(req.user, 'medication', 'complete'),
      canCollectPayment: await canPerformAction(req.user, 'medication', 'payment'),
      canMarkExternal: await canPerformAction(req.user, 'medication', 'external')
    }
  });
});

// @desc    Get optical view of invoice by visit
// @route   GET /api/invoices/optical/:visitId
// @access  Private (optician, optical_receptionist, optometrist)
const getOpticalInvoiceView = asyncHandler(async (req, res, next) => {
  const { visitId } = req.params;

  const visit = await Visit.findById(visitId);
  if (!visit) {
    return notFound(res, 'Visite');
  }

  const invoice = await Invoice.findOne({ visit: visitId })
    .populate('patient', 'firstName lastName patientId phoneNumber convention')
    .populate('items.completedBy', 'firstName lastName')
    .populate('items.paymentCollectedBy', 'firstName lastName');

  if (!invoice) {
    return notFound(res, 'Aucune facture trouvée pour cette visite');
  }

  // Filter to optical category only
  const allowedCategories = ['optical'];
  const filteredInvoice = filterInvoiceItems(invoice, allowedCategories);

  // Add glasses orders context
  const GlassesOrder = require('../../models/GlassesOrder');
  const glassesOrders = await GlassesOrder.find({ visit: visitId })
    .select('orderNumber status prescription pricing paymentStatus');

  return success(res, {
    data: {
      invoice: filteredInvoice,
      glassesOrders,
      collectionPoint: 'optical',
      canComplete: await canPerformAction(req.user, 'optical', 'complete'),
      canCollectPayment: await canPerformAction(req.user, 'optical', 'payment'),
      canMarkExternal: await canPerformAction(req.user, 'optical', 'external')
    }
  });
});

// @desc    Get clinic view of invoice by visit (all categories)
// @route   GET /api/invoices/clinic/:visitId
// @access  Private (receptionist, cashier, admin)
const getClinicInvoiceView = asyncHandler(async (req, res, next) => {
  const { visitId } = req.params;

  const visit = await Visit.findById(visitId);
  if (!visit) {
    return notFound(res, 'Visite');
  }

  const invoice = await Invoice.findOne({ visit: visitId })
    .populate('patient', 'firstName lastName patientId phoneNumber convention')
    .populate('items.completedBy', 'firstName lastName')
    .populate('items.paymentCollectedBy', 'firstName lastName')
    .populate('payments.receivedBy', 'firstName lastName');

  if (!invoice) {
    return notFound(res, 'Aucune facture trouvée pour cette visite');
  }

  // Get user's allowed categories
  const allowedCategories = await getAllowedCategories(req.user);
  const filteredInvoice = filterInvoiceItems(invoice, allowedCategories);

  // Group items by category for display
  const itemsByCategory = {};
  for (const item of filteredInvoice.items) {
    const cat = item.category || 'other';
    if (!itemsByCategory[cat]) {
      itemsByCategory[cat] = [];
    }
    itemsByCategory[cat].push(item);
  }

  // Mark items that were paid elsewhere
  for (const item of filteredInvoice.items) {
    if (item.paidTo && item.paidTo !== 'clinic') {
      item.paidElsewhere = true;
      item.paidLocation = item.paidTo === 'pharmacy' ? 'Pharmacie' : 'Optique';
    }
  }

  return success(res, {
    data: {
      invoice: filteredInvoice,
      itemsByCategory,
      collectionPoint: 'clinic',
      allowedCategories,
      // Permissions for each category the user can manage
      categoryPermissions: Object.fromEntries(
        await Promise.all(
          allowedCategories.map(async (cat) => [
            cat,
            {
              canComplete: await canPerformAction(req.user, cat, 'complete'),
              canCollectPayment: await canPerformAction(req.user, cat, 'payment'),
              canMarkExternal: await canPerformAction(req.user, cat, 'external')
            }
          ])
        )
      )
    }
  });
});

// =====================================================
// ITEM-LEVEL OPERATIONS
// =====================================================

// @desc    Mark invoice item as completed/dispensed
// @route   PATCH /api/invoices/:id/items/:itemId/status
// @access  Private (role-based per category)
const markItemCompleted = asyncHandler(async (req, res, next) => {
  const { id, itemId } = req.params;
  const { status } = req.body; // 'completed' | 'pending'

  const invoice = await Invoice.findById(id);
  if (!invoice) {
    return notFound(res, 'Facture');
  }

  // Find the item
  const item = invoice.items.id(itemId);
  if (!item) {
    return notFound(res, 'Article');
  }

  // Check permission for this category
  const canComplete = await canPerformAction(req.user, item.category, 'complete');
  if (!canComplete) {
    return error(res, {
      statusCode: 403,
      error: `Vous n'avez pas la permission de marquer les articles ${item.category} comme complétés`
    });
  }

  // Update item status
  if (status === 'completed') {
    item.status = 'completed';
    item.completedAt = new Date();
    item.completedBy = req.user._id;
  } else {
    item.status = 'pending';
    item.completedAt = undefined;
    item.completedBy = undefined;
  }

  await invoice.save();

  // WebSocket notification
  websocketService.emitBillingUpdate({
    event: 'item_status_changed',
    invoiceId: invoice._id,
    itemId: item._id,
    category: item.category,
    newStatus: item.status
  });

  return success(res, {
    statusCode: 200,
    message: status === 'completed' ? 'Article marqué comme complété' : 'Statut réinitialisé',
    data: item
  });
});

// @desc    Mark invoice item as external (patient getting service elsewhere)
// @route   PATCH /api/invoices/:id/items/:itemId/external
// @access  Private (role-based per category)
const markItemExternal = asyncHandler(async (req, res, next) => {
  const { id, itemId } = req.params;
  const { isExternal, reason } = req.body;

  const invoice = await Invoice.findById(id);
  if (!invoice) {
    return notFound(res, 'Facture');
  }

  const item = invoice.items.id(itemId);
  if (!item) {
    return notFound(res, 'Article');
  }

  // Check permission
  const canMarkExternal = await canPerformAction(req.user, item.category, 'external');
  if (!canMarkExternal) {
    return error(res, {
      statusCode: 403,
      error: `Vous n'avez pas la permission de marquer les articles ${item.category} comme externes`
    });
  }

  // Can't mark as external if already paid
  if (item.isPaid) {
    return badRequest(res, 'Impossible de marquer un article déjà payé comme externe');
  }

  if (isExternal) {
    item.status = 'external';
    item.isExternal = true;
    item.markedExternalBy = req.user._id;
    item.markedExternalAt = new Date();
    item.externalReason = reason || 'Patient obtient ce service ailleurs';
  } else {
    item.status = 'pending';
    item.isExternal = false;
    item.markedExternalBy = undefined;
    item.markedExternalAt = undefined;
    item.externalReason = undefined;
  }

  // Recalculate invoice totals (external items don't count towards amount due)
  invoice.recalculateTotals();
  await invoice.save();

  return success(res, {
    statusCode: 200,
    message: isExternal ? 'Article marqué comme externe' : 'Article remis en attente',
    data: {
      item,
      updatedSummary: invoice.summary
    }
  });
});

// @desc    Collect payment for specific invoice item
// @route   POST /api/invoices/:id/items/:itemId/payment
// @access  Private (role-based per category)
const collectItemPayment = asyncHandler(async (req, res, next) => {
  const { id, itemId } = req.params;
  const { amount, method, reference, notes, currency, exchangeRate } = req.body;

  const invoice = await Invoice.findById(id);
  if (!invoice) {
    return notFound(res, 'Facture');
  }

  const item = invoice.items.id(itemId);
  if (!item) {
    return notFound(res, 'Article');
  }

  // Check permission
  const canCollect = await canPerformAction(req.user, item.category, 'payment');
  if (!canCollect) {
    return error(res, {
      statusCode: 403,
      error: `Vous n'avez pas la permission de collecter les paiements pour ${item.category}`
    });
  }

  // Validate amount
  const itemAmountDue = (item.total || 0) - (item.paidAmount || 0);
  if (!amount || amount <= 0) {
    return badRequest(res, 'Le montant doit être supérieur à 0');
  }

  // Convert to CDF if different currency
  const paymentCurrency = currency || 'CDF';
  const rate = exchangeRate || 1;
  const amountInCDF = paymentCurrency === 'CDF' ? amount : amount * rate;

  if (amountInCDF > itemAmountDue) {
    return badRequest(res, `Le montant (${amountInCDF} CDF) dépasse le montant dû (${itemAmountDue} CDF)`);
  }

  // Update item payment
  item.paidAmount = (item.paidAmount || 0) + amountInCDF;
  item.isPaid = item.paidAmount >= item.total;
  item.paidAt = item.isPaid ? new Date() : undefined;
  item.paidTo = getCollectionPoint(item.category);
  item.paymentCollectedBy = req.user._id;
  item.paymentCollectedAt = new Date();

  // Also add to invoice payments array for audit trail
  invoice.payments.push({
    amount: amountInCDF,
    currency: paymentCurrency,
    exchangeRate: rate,
    method: method || 'cash',
    reference,
    notes: notes || `Paiement pour: ${item.description}`,
    receivedBy: req.user._id,
    date: new Date(),
    itemId: item._id,
    category: item.category,
    collectionPoint: item.paidTo
  });

  // Recalculate invoice totals
  invoice.recalculateTotals();
  await invoice.save();

  // WebSocket notification
  websocketService.emitBillingUpdate({
    event: 'item_payment_received',
    invoiceId: invoice._id,
    itemId: item._id,
    category: item.category,
    amount: amountInCDF,
    collectionPoint: item.paidTo,
    isPaid: item.isPaid
  });

  return success(res, {
    statusCode: 200,
    message: item.isPaid ? 'Article entièrement payé' : 'Paiement partiel enregistré',
    data: {
      item,
      payment: invoice.payments[invoice.payments.length - 1],
      updatedSummary: invoice.summary
    }
  });
});

// @desc    Get invoice items filtered by category (general endpoint)
// @route   GET /api/invoices/:id/items
// @access  Private (filtered by role permissions)
const getInvoiceItems = asyncHandler(async (req, res, next) => {
  const { category } = req.query;

  const invoice = await Invoice.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId')
    .populate('items.completedBy', 'firstName lastName')
    .populate('items.paymentCollectedBy', 'firstName lastName');

  if (!invoice) {
    return notFound(res, 'Facture');
  }

  // Get allowed categories for this user
  let allowedCategories = await getAllowedCategories(req.user);

  // If specific category requested, filter to that
  if (category && allowedCategories.includes(category)) {
    allowedCategories = [category];
  } else if (category && !allowedCategories.includes(category)) {
    return error(res, {
      statusCode: 403,
      error: `Vous n'avez pas accès à la catégorie ${category}`
    });
  }

  const filteredInvoice = filterInvoiceItems(invoice, allowedCategories);

  return success(res, {
    data: {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceId,
      patient: invoice.patient,
      items: filteredInvoice.items,
      summary: filteredInvoice.filteredSummary,
      allowedCategories
    }
  });
});

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  // Convention billing
  previewCompanyBilling,
  applyCompanyBilling,
  consumeApprovals,

  // Category-filtered views
  getPharmacyInvoiceView,
  getOpticalInvoiceView,
  getClinicInvoiceView,

  // Item-level operations
  markItemCompleted,
  markItemExternal,
  collectItemPayment,
  getInvoiceItems
};
