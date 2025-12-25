const Invoice = require('../models/Invoice');
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const FeeSchedule = require('../models/FeeSchedule');
const Company = require('../models/Company');
const Approval = require('../models/Approval');
const SurgeryCase = require('../models/SurgeryCase');
const ClinicalAct = require('../models/ClinicalAct');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/errorHandler');
const currencyService = require('../services/currencyService');
const websocketService = require('../services/websocketService');
const { success, error, notFound, paginated, badRequest } = require('../utils/apiResponse');
const { findPatientByIdOrCode } = require('../utils/patientLookup');
const { invoice: invoiceLogger } = require('../utils/structuredLogger');
const { INVOICE, PAGINATION, CANCELLATION } = require('../config/constants');

// Domain services for orchestration
const { BillingService, SurgeryService } = require('../services/domain');

/**
 * Helper function to check if invoice contains surgery items and create surgery cases.
 * REFACTORED: Now delegates to SurgeryService for centralized logic.
 * @param {Object} invoice - The invoice document
 * @param {string} userId - The user ID performing the operation
 * @param {Object} session - Optional MongoDB session for transaction support
 * @deprecated Use SurgeryService.createCasesIfNeeded directly for new code.
 */
async function createSurgeryCasesIfNeeded(invoice, userId, session = null) {
  return SurgeryService.createCasesIfNeeded(invoice, userId, session);
}

/**
 * Helper function to create surgery cases for specific paid items.
 * REFACTORED: Now delegates to SurgeryService for centralized logic.
 * @param {Object} invoice - The invoice document
 * @param {Array} paidItems - Array of paid items
 * @param {string} userId - The user ID performing the operation
 * @param {Object} session - Optional MongoDB session for transaction support
 * @deprecated Use SurgeryService.createCasesForPaidItems directly for new code.
 */
async function createSurgeryCasesForPaidItems(invoice, paidItems, userId, session = null) {
  return SurgeryService.createCasesForPaidItems(invoice, paidItems, userId, session);
}

// =====================================================
// LEGACY CODE BELOW - Kept for reference during migration
// The logic has been moved to SurgeryService
// =====================================================

/*
// Original createSurgeryCasesIfNeeded implementation (now in SurgeryService):
async function _legacy_createSurgeryCasesIfNeeded(invoice, userId) {
  try {
    const surgeryActs = await ClinicalAct.find({
      category: { $regex: /chirurgie/i }
    }).select('_id code name category');

    const surgeryActCodes = surgeryActs.map(act => act.code?.toLowerCase()).filter(Boolean);

    const surgeryKeywords = [
      'phaco', 'phacoémulsification', 'cataracte', 'cataract',
      'trabéculectomie', 'trabeculectomie', 'trabeculectomy',
      'vitrectomie', 'vitrectomy',
      'kératoplastie', 'keratoplastie', 'keratoplasty',
      'implant', 'iol', 'lentille intraoculaire',
      'chirurgie', 'surgery', 'opération',
      'greffe', 'transplant', 'cornée',
      'glaucome', 'glaucoma',
      'strabisme', 'ptosis', 'blépharoplastie',
      'injection intravitréenne', 'ivt'
    ];

    const surgeryCasesToCreate = [];

    for (let i = 0; i < invoice.items.length; i++) {
      const item = invoice.items[i];

      // Skip if surgery case already created for this item
      if (item.surgeryCaseCreated) {
        continue;
      }

      const itemCode = item.code?.toLowerCase() || '';
      const itemCategory = item.category?.toLowerCase() || '';
      const itemDesc = item.description?.toLowerCase() || '';

      // Check if item is a surgery by multiple criteria
      const isSurgery =
        // 1. Item category is 'surgery' (Invoice schema enum)
        itemCategory === 'surgery' ||
        // 2. Item code matches a surgery clinical act code
        surgeryActCodes.includes(itemCode) ||
        // 3. Item category contains 'chirurgie'
        itemCategory.includes('chirurgie') ||
        // 4. Description contains surgery keywords
        surgeryKeywords.some(keyword => itemDesc.includes(keyword));

      if (isSurgery) {
        // Find the matching clinical act for surgeryType
        let surgeryType = null;

        // Try to match by code first
        if (item.code) {
          const matchingAct = surgeryActs.find(act =>
            act.code?.toLowerCase() === itemCode
          );
          if (matchingAct) surgeryType = matchingAct._id;
        }

        // If no code match, try to find by name similarity
        if (!surgeryType && item.description) {
          const matchingAct = surgeryActs.find(act =>
            itemDesc.includes(act.name?.toLowerCase() || '')
          );
          if (matchingAct) surgeryType = matchingAct._id;
        }

        // If still no match, use the first surgery act as fallback
        if (!surgeryType && surgeryActs.length > 0) {
          // Try to find a generic match
          const genericMatch = surgeryActs.find(act =>
            act.code?.toLowerCase().includes('phaco') ||
            act.name?.toLowerCase().includes('cataracte')
          );
          if (genericMatch) surgeryType = genericMatch._id;
        }

        // Determine eye if mentioned
        let eye = 'N/A';
        if (itemDesc.includes(' od') || itemDesc.includes('(od)') || itemDesc.includes('œil droit') || itemDesc.includes('oeil droit')) {
          eye = 'OD';
        } else if (itemDesc.includes(' os') || itemDesc.includes('(os)') || itemDesc.includes('œil gauche') || itemDesc.includes('oeil gauche')) {
          eye = 'OS';
        } else if (itemDesc.includes(' ou') || itemDesc.includes('(ou)') || itemDesc.includes('deux yeux') || itemDesc.includes('bilatéral')) {
          eye = 'OU';
        }

        surgeryCasesToCreate.push({
          patient: invoice.patient,
          clinic: invoice.clinic,
          consultation: invoice.consultation,
          invoice: invoice._id,
          surgeryType: surgeryType,
          surgeryDescription: !surgeryType ? item.description : undefined, // Fallback if no type matched
          eye: eye,
          status: 'awaiting_scheduling',
          paymentDate: new Date(),
          createdBy: userId,
          statusHistory: [{
            status: 'awaiting_scheduling',
            changedAt: new Date(),
            changedBy: userId,
            notes: `Créé automatiquement après paiement de la facture ${invoice.invoiceId}`
          }],
          _invoiceItemIndex: i
        });

        invoiceLogger.info('Detected surgery item', {
          description: item.description,
          category: item.category,
          code: item.code,
          surgeryType: surgeryType || 'none'
        });
      }
    }

    // Create surgery cases
    if (surgeryCasesToCreate.length > 0) {
      const createdCases = await SurgeryCase.insertMany(surgeryCasesToCreate);

      // Update invoice items to mark surgery case created
      for (let j = 0; j < createdCases.length; j++) {
        const surgeryCase = createdCases[j];
        const itemIndex = surgeryCasesToCreate[j]._invoiceItemIndex;

        if (itemIndex !== undefined && invoice.items[itemIndex]) {
          invoice.items[itemIndex].surgeryCaseCreated = true;
          invoice.items[itemIndex].surgeryCaseId = surgeryCase._id;
        }
      }

      await invoice.save();

      invoiceLogger.info('Created surgery cases from invoice', {
        invoiceId: invoice.invoiceId,
        count: createdCases.length
      });
      return createdCases;
    }

    return [];
  } catch (err) {
    invoiceLogger.error('Error creating surgery cases from invoice', { error: err.message, stack: err.stack });
    // Don't throw - let the payment succeed even if surgery case creation fails
    return [];
  }
}

// Original createSurgeryCasesForPaidItems implementation (now in SurgeryService):
// This function is also deprecated - logic moved to SurgeryService.createCasesForPaidItems
*/

// The following legacy function is kept for emergency rollback but should not be called:
/*
async function _legacy_createSurgeryCasesForPaidItems(invoice, paidItems, userId) {
  try {
    const surgeryActs = await ClinicalAct.find({
      category: { $regex: /chirurgie/i }
    }).select('_id code name category');

    const surgeryActCodes = surgeryActs.map(act => act.code?.toLowerCase()).filter(Boolean);

    const surgeryKeywords = [
      'phaco', 'phacoémulsification', 'cataracte', 'cataract',
      'trabéculectomie', 'trabeculectomie', 'trabeculectomy',
      'vitrectomie', 'vitrectomy',
      'kératoplastie', 'keratoplastie', 'keratoplasty',
      'implant', 'iol', 'lentille intraoculaire',
      'chirurgie', 'surgery', 'opération',
      'greffe', 'transplant', 'cornée',
      'glaucome', 'glaucoma',
      'strabisme', 'ptosis', 'blépharoplastie',
      'injection intravitréenne', 'ivt'
    ];

    const surgeryCasesToCreate = [];

    for (const { itemIndex, item } of paidItems) {
      // Skip if surgery case already created for this item
      if (item.surgeryCaseCreated) {
        continue;
      }

      const itemCode = item.code?.toLowerCase() || '';
      const itemCategory = item.category?.toLowerCase() || '';
      const itemDesc = item.description?.toLowerCase() || '';

      // Check if item is a surgery
      const isSurgery =
        itemCategory === 'surgery' ||
        surgeryActCodes.includes(itemCode) ||
        itemCategory.includes('chirurgie') ||
        surgeryKeywords.some(keyword => itemDesc.includes(keyword));

      if (isSurgery) {
        // Find matching clinical act
        let surgeryType = null;

        if (item.code) {
          const matchingAct = surgeryActs.find(act =>
            act.code?.toLowerCase() === itemCode
          );
          if (matchingAct) surgeryType = matchingAct._id;
        }

        if (!surgeryType && item.description) {
          const matchingAct = surgeryActs.find(act =>
            itemDesc.includes(act.name?.toLowerCase() || '')
          );
          if (matchingAct) surgeryType = matchingAct._id;
        }

        // Determine eye
        let eye = 'N/A';
        if (itemDesc.includes(' od') || itemDesc.includes('(od)') || itemDesc.includes('œil droit') || itemDesc.includes('oeil droit')) {
          eye = 'OD';
        } else if (itemDesc.includes(' os') || itemDesc.includes('(os)') || itemDesc.includes('œil gauche') || itemDesc.includes('oeil gauche')) {
          eye = 'OS';
        } else if (itemDesc.includes(' ou') || itemDesc.includes('(ou)') || itemDesc.includes('deux yeux') || itemDesc.includes('bilatéral')) {
          eye = 'OU';
        }

        surgeryCasesToCreate.push({
          patient: invoice.patient,
          clinic: invoice.clinic,
          consultation: invoice.consultation,
          invoice: invoice._id,
          surgeryType: surgeryType,
          surgeryDescription: !surgeryType ? item.description : undefined,
          eye: eye,
          status: 'awaiting_scheduling',
          paymentDate: new Date(),
          createdBy: userId,
          statusHistory: [{
            status: 'awaiting_scheduling',
            changedAt: new Date(),
            changedBy: userId,
            notes: `Créé après paiement de l'item "${item.description}" sur facture ${invoice.invoiceId}`
          }],
          // Store item index for reference
          _invoiceItemIndex: itemIndex
        });

        invoiceLogger.info('Item fully paid', { description: item.description, itemIndex });
      }
    }

    // Create surgery cases and update invoice items
    if (surgeryCasesToCreate.length > 0) {
      const createdCases = await SurgeryCase.insertMany(surgeryCasesToCreate);

      // Update invoice items to mark surgery case created
      for (let i = 0; i < createdCases.length; i++) {
        const surgeryCase = createdCases[i];
        const itemIndex = surgeryCasesToCreate[i]._invoiceItemIndex;

        if (itemIndex !== undefined && invoice.items[itemIndex]) {
          invoice.items[itemIndex].surgeryCaseCreated = true;
          invoice.items[itemIndex].surgeryCaseId = surgeryCase._id;
        }
      }

      await invoice.save();

      invoiceLogger.info('Created surgery cases for paid items', {
        invoiceId: invoice.invoiceId,
        count: createdCases.length
      });
      return createdCases;
    }

    return [];
  } catch (err) {
    invoiceLogger.error('Error creating surgery cases for paid items', { error: err.message, stack: err.stack });
    return [];
  }
}
*/

// Helper function to validate invoice items against fee schedule
async function validateItemsAgainstFeeSchedule(items, options = {}) {
  const { requireMatch = false, allowPriceOverride = true, tolerance = 0.01 } = options;
  const validationResults = [];
  let hasWarnings = false;
  let hasErrors = false;

  for (const item of items) {
    const result = {
      description: item.description,
      code: item.code,
      providedPrice: item.unitPrice,
      feeSchedulePrice: null,
      priceMatch: null,
      warning: null,
      error: null
    };

    // Try to find matching fee schedule item
    if (item.code) {
      const feeItem = await FeeSchedule.findOne({
        code: item.code.toUpperCase(),
        active: true,
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: new Date() } }
        ],
        effectiveFrom: { $lte: new Date() }
      });

      if (feeItem) {
        result.feeSchedulePrice = feeItem.price;
        result.feeScheduleItem = {
          code: feeItem.code,
          name: feeItem.name,
          category: feeItem.category,
          price: feeItem.price,
          minPrice: feeItem.minPrice,
          maxPrice: feeItem.maxPrice
        };

        // Check price match
        const priceDiff = Math.abs(item.unitPrice - feeItem.price);
        const percentDiff = feeItem.price > 0 ? priceDiff / feeItem.price : 0;

        if (priceDiff <= tolerance) {
          result.priceMatch = 'exact';
        } else if (percentDiff <= 0.1) {
          result.priceMatch = 'close';
          result.warning = `Price differs by ${(percentDiff * 100).toFixed(1)}% from fee schedule`;
          hasWarnings = true;
        } else {
          result.priceMatch = 'different';

          // Check if within min/max bounds
          if (feeItem.minPrice && item.unitPrice < feeItem.minPrice) {
            result.error = `Price ${item.unitPrice} is below minimum ${feeItem.minPrice}`;
            hasErrors = true;
          } else if (feeItem.maxPrice && item.unitPrice > feeItem.maxPrice) {
            result.error = `Price ${item.unitPrice} exceeds maximum ${feeItem.maxPrice}`;
            hasErrors = true;
          } else if (!allowPriceOverride) {
            result.error = `Price ${item.unitPrice} does not match fee schedule price ${feeItem.price}`;
            hasErrors = true;
          } else {
            result.warning = `Price override: ${item.unitPrice} vs fee schedule ${feeItem.price}`;
            hasWarnings = true;
          }
        }
      } else if (requireMatch) {
        result.error = `No active fee schedule item found for code: ${item.code}`;
        hasErrors = true;
      } else {
        result.warning = `No fee schedule item found for code: ${item.code}`;
        hasWarnings = true;
      }
    } else if (requireMatch) {
      result.error = 'Item missing billing code';
      hasErrors = true;
    }

    validationResults.push(result);
  }

  return {
    valid: !hasErrors,
    hasWarnings,
    hasErrors,
    results: validationResults
  };
}

/**
 * Helper function to detect and apply package deals
 * Automatically bundles individual acts into package pricing when:
 * 1. Patient's company has active packageDeals
 * 2. All acts in a package are present in the invoice items
 *
 * @param {Array} items - Invoice line items
 * @param {Object} company - Company document with packageDeals
 * @returns {Object} { bundledItems, packagesApplied, originalItems }
 */
function applyPackageDeals(items, company) {
  // Return original items if no package deals
  if (!company?.packageDeals || company.packageDeals.length === 0) {
    return { bundledItems: items, packagesApplied: [], originalItems: items };
  }

  // Get active package deals only
  const activePackages = company.packageDeals.filter(pkg => pkg.active !== false);
  if (activePackages.length === 0) {
    return { bundledItems: items, packagesApplied: [], originalItems: items };
  }

  // Clone items to avoid mutating original
  let remainingItems = [...items];
  const packagesApplied = [];
  const originalItems = [...items];

  // Try to apply each package
  for (const pkg of activePackages) {
    if (!pkg.includedActs || pkg.includedActs.length === 0) continue;

    // Get all act codes in this package (normalized to uppercase)
    const packageActCodes = pkg.includedActs
      .map(act => act.actCode?.toUpperCase())
      .filter(Boolean);

    if (packageActCodes.length === 0) continue;

    // Check if all package acts are present in remaining items
    const matchedItems = [];
    const unmatchedCodes = [...packageActCodes];

    for (const item of remainingItems) {
      const itemCode = item.code?.toUpperCase();
      if (!itemCode) continue;

      // Check for exact match or partial match (e.g., "CONSULT" matches "CONSULT-OPHTA")
      const matchIndex = unmatchedCodes.findIndex(code =>
        itemCode === code ||
        itemCode.startsWith(`${code}-`) ||
        itemCode.startsWith(`${code}_`) ||
        code.startsWith(`${itemCode}-`) ||
        code.startsWith(`${itemCode}_`)
      );

      if (matchIndex !== -1) {
        matchedItems.push(item);
        unmatchedCodes.splice(matchIndex, 1);
      }
    }

    // Only apply package if ALL acts are present
    if (unmatchedCodes.length === 0 && matchedItems.length >= packageActCodes.length) {
      // Calculate what the total would have been without package
      const originalTotal = matchedItems.reduce((sum, item) => {
        return sum + ((item.quantity || 1) * (item.unitPrice || 0));
      }, 0);

      // Only apply if package offers savings (or is required by convention)
      const packagePrice = pkg.price || 0;

      // Remove matched items from remaining items
      remainingItems = remainingItems.filter(item => !matchedItems.includes(item));

      // Create package line item
      const packageItem = {
        description: pkg.name || 'Forfait Consultation',
        code: pkg.code || 'PKG-CONSULT',
        category: 'consultation', // Package is typically consultation category
        quantity: 1,
        unitPrice: packagePrice,
        discount: 0,
        subtotal: packagePrice,
        tax: 0,
        total: packagePrice,
        isPackage: true,
        packageDetails: {
          packageId: pkg._id,
          packageCode: pkg.code,
          packageName: pkg.name,
          includedActs: matchedItems.map(item => ({
            code: item.code,
            description: item.description,
            originalPrice: item.unitPrice
          })),
          originalTotal: originalTotal,
          savings: originalTotal - packagePrice,
          currency: pkg.currency || 'USD'
        }
      };

      // Add package item to remaining items
      remainingItems.unshift(packageItem);

      packagesApplied.push({
        packageCode: pkg.code,
        packageName: pkg.name,
        packagePrice: packagePrice,
        originalTotal: originalTotal,
        savings: originalTotal - packagePrice,
        actsIncluded: matchedItems.length,
        currency: pkg.currency || 'USD'
      });

      invoiceLogger.info('Applied package deal', {
        packageName: pkg.name,
        packagePrice,
        savings: (originalTotal - packagePrice).toFixed(2),
        company: company.name
      });
    }
  }

  return {
    bundledItems: remainingItems,
    packagesApplied,
    originalItems
  };
}

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private (Admin, Accountant, Receptionist)
exports.getInvoices = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = PAGINATION.DEFAULT_PAGE_SIZE,
    status,
    patient,
    dateFrom,
    dateTo,
    search,
    sort = '-createdAt',
    overdue
  } = req.query;

  // Build query
  const query = {};

  // Multi-clinic: Filter by clinic unless admin with accessAllClinics
  if (req.clinicId && !req.accessAllClinics) {
    query.clinic = req.clinicId;
  }

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by patient
  if (patient) {
    query.patient = patient;
  }

  // Filter by date range
  if (dateFrom || dateTo) {
    query.dateIssued = {};
    if (dateFrom) query.dateIssued.$gte = new Date(dateFrom);
    if (dateTo) query.dateIssued.$lte = new Date(dateTo);
  }

  // Filter overdue invoices
  if (overdue === 'true') {
    query.status = { $in: ['issued', 'sent', 'viewed', 'partial'] };
    query.dueDate = { $lt: new Date() };
    query['summary.amountDue'] = { $gt: 0 };
  }

  // Search by invoice ID or patient name
  if (search) {
    // Escape special regex characters to prevent ReDoS/injection attacks
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { invoiceId: new RegExp(escapedSearch, 'i') }
    ];
  }

  // Execute query with pagination
  const skip = (page - 1) * limit;
  const invoices = await Invoice.find(query)
    .populate('patient', 'firstName lastName patientId phoneNumber email')
    .populate('visit', 'visitId visitDate')
    .populate('createdBy', 'firstName lastName')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .lean(); // Performance: return plain JS objects for read-only list

  // Get total count for pagination
  const total = await Invoice.countDocuments(query);

  return paginated(res, {
    data: invoices,
    page,
    limit,
    total
  });
});

// @desc    Get single invoice
// @route   GET /api/invoices/:id
// @access  Private
exports.getInvoice = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId phoneNumber email address')
    .populate('visit', 'visitId visitDate diagnoses')
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName')
    .populate('payments.receivedBy', 'firstName lastName');

  if (!invoice) {
    return notFound(res, 'Invoice');
  }

  return success(res, { data: invoice });
});

// @desc    Create new invoice
// @route   POST /api/invoices
// @access  Private (Admin, Receptionist)
exports.createInvoice = asyncHandler(async (req, res, next) => {
  const { patient, visit, items, billing, insurance, notes, dueDate, validatePrices = true, strictPriceValidation = false } = req.body;

  // Validate patient exists
  const patientDoc = await findPatientByIdOrCode(patient);
  if (!patientDoc) {
    return notFound(res, 'Patient');
  }

  // If visit provided, validate it exists and check for convention snapshot
  let visitDoc = null;
  let conventionSnapshot = null;

  if (visit) {
    visitDoc = await Visit.findById(visit);
    if (!visitDoc) {
      return notFound(res, 'Visit');
    }

    // CRITICAL: Use convention snapshot from visit if available
    // This ensures pricing is based on convention at check-in time, not current time
    if (visitDoc.billing?.conventionSnapshot?.conventionId) {
      conventionSnapshot = visitDoc.billing.conventionSnapshot;
      invoiceLogger.info('Using convention snapshot from visit', {
        visitId: visitDoc.visitId,
        conventionName: conventionSnapshot.conventionName
      });
    }
  }

  // ============================================
  // PACKAGE DEAL AUTO-DETECTION
  // If patient has active convention with package deals,
  // automatically bundle matching acts into package pricing
  // ============================================
  let itemsToProcess = items;
  let packagesApplied = [];
  let packageCompany = null;

  // Use convention snapshot if available, otherwise fall back to patient's current convention
  const activeConventionId = conventionSnapshot?.conventionId || patientDoc.convention?.company;
  // CRITICAL FIX: Use correct field 'status' not 'isActive' (which doesn't exist)
  // Also check validity dates
  const now = new Date();
  const isConventionValid = patientDoc.convention?.company &&
    patientDoc.convention?.status === 'active' &&
    (!patientDoc.convention?.validUntil || new Date(patientDoc.convention.validUntil) >= now) &&
    (!patientDoc.convention?.validFrom || new Date(patientDoc.convention.validFrom) <= now);
  const hasActiveConvention = conventionSnapshot ? true : isConventionValid;

  if (hasActiveConvention && activeConventionId) {
    try {
      packageCompany = await Company.findById(activeConventionId);

      if (packageCompany && packageCompany.contract?.status === 'active' && packageCompany.isActive) {
        // Check for package deals and apply them
        if (packageCompany.packageDeals?.length > 0) {
          const packageResult = applyPackageDeals(items, packageCompany);
          itemsToProcess = packageResult.bundledItems;
          packagesApplied = packageResult.packagesApplied;

          if (packagesApplied.length > 0) {
            invoiceLogger.info('Auto-applied packages', {
              patientId: patientDoc.patientId,
              company: packageCompany.name,
              count: packagesApplied.length
            });
          }
        }
      }
    } catch (pkgError) {
      invoiceLogger.error('Error checking package deals', { error: pkgError.message });
      // Continue without package - use original items
      itemsToProcess = items;
    }
  }

  // Validate item prices against fee schedule
  let priceValidation = null;
  if (validatePrices && itemsToProcess && itemsToProcess.length > 0) {
    priceValidation = await validateItemsAgainstFeeSchedule(itemsToProcess, {
      requireMatch: strictPriceValidation,
      allowPriceOverride: !strictPriceValidation
    });

    // If strict validation and errors found, reject the invoice
    if (strictPriceValidation && !priceValidation.valid) {
      return badRequest(res, 'Invoice items failed price validation', priceValidation);
    }
  }

  // Calculate item totals (using bundled items if packages applied)
  const processedItems = itemsToProcess.map(item => {
    const subtotal = item.quantity * item.unitPrice;
    const discount = item.discount || 0;
    const subtotalAfterDiscount = subtotal - discount;
    const tax = item.tax || 0;
    const total = subtotalAfterDiscount + tax;

    return {
      ...item,
      subtotal,
      total
    };
  });

  // Calculate invoice summary
  const summary = {
    subtotal: processedItems.reduce((sum, item) => sum + item.subtotal, 0),
    discountTotal: processedItems.reduce((sum, item) => sum + (item.discount || 0), 0),
    taxTotal: processedItems.reduce((sum, item) => sum + (item.tax || 0), 0),
    total: processedItems.reduce((sum, item) => sum + item.total, 0),
    amountPaid: 0,
    amountDue: processedItems.reduce((sum, item) => sum + item.total, 0)
  };

  // Helper function to create invoice with or without transaction
  const createInvoiceOps = async (useSession = false, session = null) => {
    const createOptions = useSession ? { session } : {};
    const updateOptions = useSession ? { session } : {};

    // Create invoice
    const invoices = await Invoice.create([{
      patient,
      visit,
      items: processedItems,
      summary,
      billing: billing || {
        billTo: {
          name: `${patientDoc.firstName} ${patientDoc.lastName}`,
          phone: patientDoc.phoneNumber,
          email: patientDoc.email
        },
        currency: billing?.currency || 'CDF',
        taxRate: billing?.taxRate || 0
      },
      insurance,
      notes,
      dueDate,
      dateIssued: new Date(),
      createdBy: req.user.id,
      status: 'issued'
    }], createOptions);

    const invoice = invoices[0];

    // Update patient's invoices array
    await Patient.findByIdAndUpdate(
      patient,
      { $addToSet: { invoices: invoice._id } },
      updateOptions
    );

    // If visit provided, link invoice to visit
    if (visit) {
      await Visit.findByIdAndUpdate(
        visit,
        { $set: { 'billing.invoice': invoice._id } },
        updateOptions
      );
    }

    return invoice;
  };

  let invoice;

  // Try with transaction first, fall back to non-transactional if not supported
  try {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      invoice = await createInvoiceOps(true, session);
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (err) {
    // If transaction not supported (standalone MongoDB), retry without transaction
    if (err.code === 20 || err.codeName === 'IllegalOperation') {
      invoiceLogger.info('Transactions not supported, saving without transaction');
      invoice = await createInvoiceOps(false);
    } else {
      throw err;
    }
  }

  // Auto-apply convention billing if patient has active convention
  let conventionApplied = false;
  let conventionResult = null;

  if (hasActiveConvention && activeConventionId) {
    try {
      // Reuse company from package detection if available, otherwise fetch
      const company = packageCompany || await Company.findById(activeConventionId);

      if (company && company.contract?.status === 'active' && company.isActive) {
        // Calculate convention split for each item
        // CRITICAL: Use snapshot's coverage percentage if available (from check-in time)
        const baseCoveragePercentage = conventionSnapshot?.discountPercentage
          ?? patientDoc.convention?.coveragePercentage
          ?? company.defaultCoverage.percentage;

        let totalCompanyShare = 0;
        let totalPatientShare = 0;
        const itemsWithConvention = [];

        // FIXED: Track cumulative company share per category to enforce maxPerCategory correctly
        // This ensures that if category max is $500, and we have 3 items of $400 each,
        // we stop at $500 total for that category, not $500 per item
        const categoryCompanyShareTotals = {};

        for (const item of invoice.items) {
          const itemTotal = item.total || ((item.quantity || 1) * (item.unitPrice || 0));

          // Check if category is covered and get settings
          const categorySettings = company.coveredCategories?.find(c => c.category === item.category);

          // Check if not covered at all
          if (categorySettings?.notCovered) {
            itemsWithConvention.push({
              ...item.toObject ? item.toObject() : item,
              companyShare: 0,
              patientShare: itemTotal,
              coveragePercentage: 0,
              notCovered: true
            });
            totalPatientShare += itemTotal;
            continue;
          }

          // Check if requires approval
          let approvalRequired = false;
          let hasValidApproval = false;

          // Check specific acts requiring approval
          if (company.actsRequiringApproval?.some(a => a.actCode?.toUpperCase() === item.code?.toUpperCase())) {
            approvalRequired = true;
          }

          // Check category requiring approval
          if (!approvalRequired && categorySettings?.requiresApproval) {
            approvalRequired = true;
          }

          // Check price threshold auto-approval
          // IMPORTANT: Auto-approve does NOT override category-level requiresApproval
          // (e.g., ACTIVA: "Surgery and optical ALWAYS require approval, auto-approve only for other categories under $100")
          const categoryLevelRequiresApproval = categorySettings?.requiresApproval || false;
          if (approvalRequired && !categoryLevelRequiresApproval && company.approvalRules?.autoApproveUnderAmount) {
            const threshold = company.approvalRules.autoApproveUnderAmount;
            // FIXED: Use currencyService instead of hardcoded rate
            // Get USD rate from fallback rates (1 CDF = 0.00036 USD means 1 USD ≈ 2778 CDF)
            const usdRate = currencyService.fallbackRates?.USD || 0.00036;
            const cdfToUsd = usdRate; // Rate to convert CDF to USD
            const priceInUSD = company.approvalRules.autoApproveUnderCurrency === 'USD'
              ? itemTotal * cdfToUsd  // Convert CDF to USD using service rate
              : itemTotal;
            if (priceInUSD < threshold) {
              approvalRequired = false;
            }
          }

          // If approval required, check for valid approval
          if (approvalRequired) {
            const approval = await Approval.findOne({
              patient: patientDoc._id,
              company: company._id,
              actCode: item.code?.toUpperCase(),
              status: 'approved',
              $or: [
                { validUntil: null },
                { validUntil: { $gte: new Date() } }
              ]
            });
            hasValidApproval = !!approval;
          }

          // Calculate coverage
          let coveragePercentage = 0;
          if (!approvalRequired || hasValidApproval) {
            coveragePercentage = categorySettings?.coveragePercentage ?? baseCoveragePercentage;
          }

          // Apply global discount if configured (e.g., TEMOINS DE JEHOVAH 25%, LISUNGI 15% surgery)
          // Discount reduces the effective price the convention pays
          let effectiveItemTotal = itemTotal;
          let discountApplied = 0;
          let discountPercentage = 0;

          if (company.approvalRules?.globalDiscount?.percentage > 0) {
            const excludeCategories = company.approvalRules.globalDiscount.excludeCategories || [];
            if (!excludeCategories.includes(item.category)) {
              discountPercentage = company.approvalRules.globalDiscount.percentage;
              discountApplied = Math.round((itemTotal * discountPercentage) / 100);
              effectiveItemTotal = itemTotal - discountApplied;
            }
          }

          // Also check category-specific discount (e.g., LISUNGI 15% on surgery)
          if (categorySettings?.additionalDiscount > 0 && discountPercentage === 0) {
            discountPercentage = categorySettings.additionalDiscount;
            discountApplied = Math.round((itemTotal * discountPercentage) / 100);
            effectiveItemTotal = itemTotal - discountApplied;
          }

          let companyShare = Math.round((effectiveItemTotal * coveragePercentage) / 100);

          // FIXED: Apply category max CUMULATIVELY across all items
          // Track how much company has already paid for this category
          const category = item.category || 'other';
          if (!categoryCompanyShareTotals[category]) {
            categoryCompanyShareTotals[category] = 0;
          }

          if (categorySettings?.maxPerCategory) {
            const maxForCategory = categorySettings.maxPerCategory;
            const alreadyPaidForCategory = categoryCompanyShareTotals[category];
            const remainingBudget = maxForCategory - alreadyPaidForCategory;

            if (remainingBudget <= 0) {
              // Category budget exhausted - patient pays 100%
              companyShare = 0;
            } else if (companyShare > remainingBudget) {
              // Partial coverage - company pays what's left in budget
              companyShare = remainingBudget;
            }
          }

          // Update cumulative tracker
          categoryCompanyShareTotals[category] += companyShare;

          // Patient pays: effective price (after discount) - company share
          // Discount reduces TOTAL bill, benefiting both convention and patient
          const patientShare = effectiveItemTotal - companyShare;

          itemsWithConvention.push({
            ...item.toObject ? item.toObject() : item,
            companyShare,
            patientShare,
            coveragePercentage,
            requiresApproval: approvalRequired,
            hasApproval: hasValidApproval,
            // Track discount info for reporting
            discountApplied: discountApplied > 0 ? discountApplied : undefined,
            discountPercentage: discountPercentage > 0 ? discountPercentage : undefined,
            effectivePrice: discountApplied > 0 ? effectiveItemTotal : undefined
          });

          totalCompanyShare += companyShare;
          totalPatientShare += patientShare;
        }

        // Update invoice with convention billing
        // Use invoiceDisplayName for proper sub-company display (e.g., "MSO VODACOM" not just "VODACOM")
        const displayName = company.getInvoiceDisplayName ? company.getInvoiceDisplayName() : (company.invoiceDisplayName || company.name);

        invoice.items = itemsWithConvention;
        invoice.companyBilling = {
          company: company._id,
          companyName: displayName, // Use display name for invoices
          companyId: company.companyId,
          conventionCode: company.conventionCode, // Parent convention code (e.g., "MSO")
          parentConvention: company.parentConvention, // Reference to parent if sub-company
          employeeId: patientDoc.convention.employeeId,
          coveragePercentage: baseCoveragePercentage,
          companyShare: totalCompanyShare,
          patientShare: totalPatientShare,
          appliedAt: new Date(),
          appliedBy: req.user.id
        };
        invoice.isConventionInvoice = true;
        invoice.summary.companyShare = totalCompanyShare;
        invoice.summary.patientShare = totalPatientShare;
        invoice.summary.amountDue = totalPatientShare; // Patient only owes their share

        await invoice.save();

        conventionApplied = true;
        conventionResult = {
          company: company.name,
          coveragePercentage: baseCoveragePercentage,
          companyShare: totalCompanyShare,
          patientShare: totalPatientShare
        };
      }
    } catch (convError) {
      invoiceLogger.error('Error auto-applying convention', { error: convError.message });
      // Continue without convention - invoice still created
    }
  }

  // Build response message
  let message = 'Invoice created successfully';
  if (packagesApplied.length > 0 && conventionApplied) {
    const pkgNames = packagesApplied.map(p => p.packageName).join(', ');
    message = `Facture créée avec forfait "${pkgNames}" et convention ${conventionResult.company} appliqués`;
  } else if (packagesApplied.length > 0) {
    const pkgNames = packagesApplied.map(p => p.packageName).join(', ');
    message = `Facture créée avec forfait "${pkgNames}" appliqué`;
  } else if (conventionApplied) {
    message = `Facture créée avec convention ${conventionResult.company} appliquée`;
  }

  const response = {
    success: true,
    message,
    data: invoice,
    conventionApplied,
    conventionResult,
    // Package deal information
    packagesApplied: packagesApplied.length > 0 ? packagesApplied : undefined,
    packageSavings: packagesApplied.length > 0
      ? packagesApplied.reduce((sum, p) => sum + (p.savings || 0), 0)
      : undefined
  };

  // Include price validation warnings if any
  if (priceValidation && priceValidation.hasWarnings) {
    response.priceValidationWarnings = priceValidation.results.filter(r => r.warning);
  }

  // Send WebSocket notification for new invoice
  websocketService.emitBillingUpdate({
    event: 'invoice_created',
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber || invoice.invoiceId,
    patientId: invoice.patient,
    total: invoice.summary?.total,
    status: invoice.status,
    conventionApplied
  });

  res.status(201).json(response);
});

// @desc    Validate invoice items against fee schedule
// @route   POST /api/invoices/validate-prices
// @access  Private (Admin, Accountant, Receptionist)
exports.validateInvoicePrices = asyncHandler(async (req, res, next) => {
  const { items, strict = false } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return badRequest(res, 'Items array is required');
  }

  const validation = await validateItemsAgainstFeeSchedule(items, {
    requireMatch: strict,
    allowPriceOverride: !strict
  });

  return success(res, { data: validation });
});

// @desc    Update invoice
// @route   PUT /api/invoices/:id
// @access  Private (Admin, Receptionist)
exports.updateInvoice = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return notFound(res, 'Invoice');
  }

  // Don't allow updating paid or cancelled invoices
  if (['paid', 'cancelled', 'refunded'].includes(invoice.status)) {
    return badRequest(res, `Cannot update invoice with status: ${invoice.status}`);
  }

  const { items, billing, insurance, notes, status, dueDate } = req.body;

  // Update items if provided
  if (items) {
    const processedItems = items.map(item => {
      const subtotal = item.quantity * item.unitPrice;
      const discount = item.discount || 0;
      const subtotalAfterDiscount = subtotal - discount;
      const tax = item.tax || 0;
      const total = subtotalAfterDiscount + tax;

      return {
        ...item,
        subtotal,
        total
      };
    });
    invoice.items = processedItems;
  }

  // Update other fields
  if (billing) invoice.billing = billing;
  if (insurance) invoice.insurance = insurance;
  if (notes) invoice.notes = notes;
  if (status) invoice.status = status;
  if (dueDate) invoice.dueDate = dueDate;

  invoice.updatedBy = req.user.id;

  await invoice.save();

  return success(res, {
    statusCode: 200,
    message: 'Invoice updated successfully',
    data: invoice
  });
});

// @desc    Add payment to invoice
// @route   POST /api/invoices/:id/payments
// @access  Private (Admin, Receptionist)
exports.addPayment = asyncHandler(async (req, res, next) => {
  const mongoose = require('mongoose');
  const { withTransactionRetry } = require('../utils/transactions');

  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return notFound(res, 'Invoice');
  }

  const { amount, method, reference, notes, date, currency, exchangeRate, itemAllocations } = req.body;

  // Validate amount
  if (!amount || amount <= 0) {
    return badRequest(res, 'Payment amount must be greater than 0');
  }

  // For multi-currency payments, validate using converted amount
  const paymentCurrency = currency || 'CDF';
  const rate = exchangeRate || 1;
  const amountInCDF = paymentCurrency === 'CDF' ? amount : amount * rate;

  if (amountInCDF > invoice.summary.amountDue) {
    return badRequest(res, `Payment amount (${amountInCDF.toFixed(0)} CDF) exceeds amount due (${invoice.summary.amountDue} CDF)`);
  }

  // CRITICAL: Use transaction to ensure payment + surgery case creation is atomic
  let paymentResult;
  const surgeryCases = [];

  try {
    await withTransactionRetry(async (session) => {
      // Add payment using model method with currency support
      paymentResult = await invoice.addPayment(
        { amount, method, reference, notes, date, currency: paymentCurrency, exchangeRate: rate, itemAllocations },
        req.user.id,
        session // Pass session to model method
      );

      // Create surgery cases for newly paid surgery items (within transaction)
      if (paymentResult.newlyPaidItems && paymentResult.newlyPaidItems.length > 0) {
        const newSurgeryCases = await createSurgeryCasesForPaidItems(
          invoice,
          paymentResult.newlyPaidItems,
          req.user.id,
          session
        );
        surgeryCases.push(...newSurgeryCases);
      }

      // Also check if invoice is now fully paid (legacy behavior for any remaining surgery items)
      if (invoice.status === 'paid') {
        const remainingCases = await createSurgeryCasesIfNeeded(invoice, req.user.id, session);
        surgeryCases.push(...remainingCases);
      }
    });
  } catch (txError) {
    invoiceLogger.error('Payment transaction failed', {
      invoiceId: invoice.invoiceId,
      error: txError.message
    });
    return error(res, {
      statusCode: 500,
      error: 'Failed to process payment - transaction rolled back',
      details: txError.message
    });
  }

  // === SYNC PAYMENT STATUS TO RELATED SERVICES ===
  const paymentSyncResults = {
    glassesOrders: [],
    prescriptions: [],
    labOrders: []
  };

  try {
    // Determine payment status based on invoice status
    const newPaymentStatus = invoice.status === 'paid' ? 'paid' : 'partial';

    // PERFORMANCE: Use bulk operations instead of N+1 queries
    const GlassesOrder = require('../models/GlassesOrder');
    const Prescription = require('../models/Prescription');
    const LabOrder = require('../models/LabOrder');

    // Bulk update linked GlassesOrders
    const linkedGlassesOrders = await GlassesOrder.find({ invoice: invoice._id });
    if (linkedGlassesOrders.length > 0) {
      await GlassesOrder.updateMany(
        { invoice: invoice._id },
        {
          $set: {
            paymentStatus: newPaymentStatus,
            amountPaid: invoice.summary.amountPaid
          }
        }
      );
      linkedGlassesOrders.forEach(order => {
        paymentSyncResults.glassesOrders.push({
          id: order._id,
          orderNumber: order.orderNumber,
          status: newPaymentStatus
        });
      });
    }

    // Extract item references for batch processing
    if (invoice.items && invoice.items.length > 0) {
      const glassesOrderNumbers = [];
      const prescriptionIds = [];
      const labOrderIds = [];
      const itemAmounts = {}; // Track amounts per order

      for (const item of invoice.items) {
        if (item.reference) {
          if (item.reference.startsWith('GlassesOrder:')) {
            const orderNumber = item.reference.split(':')[1];
            glassesOrderNumbers.push(orderNumber);
            itemAmounts[orderNumber] = (itemAmounts[orderNumber] || 0) + (item.amountPaid || 0);
          } else if (item.reference.startsWith('Prescription:')) {
            prescriptionIds.push(item.reference.split(':')[1]);
          } else if (item.reference.startsWith('LabOrder:')) {
            labOrderIds.push(item.reference.split(':')[1]);
          }
        }
      }

      // Bulk update GlassesOrders by reference (excluding already updated ones)
      if (glassesOrderNumbers.length > 0) {
        const existingOrderNumbers = paymentSyncResults.glassesOrders.map(o => o.orderNumber);
        const newOrderNumbers = glassesOrderNumbers.filter(n => !existingOrderNumbers.includes(n));
        if (newOrderNumbers.length > 0) {
          await GlassesOrder.updateMany(
            { orderNumber: { $in: newOrderNumbers } },
            { $set: { paymentStatus: newPaymentStatus } }
          );
          newOrderNumbers.forEach(orderNumber => {
            paymentSyncResults.glassesOrders.push({
              orderNumber,
              status: newPaymentStatus
            });
          });
        }
      }

      // Bulk update Prescriptions
      if (prescriptionIds.length > 0) {
        await Prescription.updateMany(
          { _id: { $in: prescriptionIds } },
          {
            $set: {
              'dispensing.paymentStatus': newPaymentStatus,
              'dispensing.paidAt': new Date()
            }
          }
        );
        prescriptionIds.forEach(id => {
          paymentSyncResults.prescriptions.push({
            id,
            status: newPaymentStatus
          });
        });
      }

      // Bulk update LabOrders
      if (labOrderIds.length > 0) {
        await LabOrder.updateMany(
          { _id: { $in: labOrderIds } },
          {
            $set: {
              'billing.paymentStatus': newPaymentStatus,
              'billing.paidAt': invoice.status === 'paid' ? new Date() : null
            }
          }
        );
        // Get orderId for logging
        const labOrders = await LabOrder.find({ _id: { $in: labOrderIds } }).select('orderId');
        labOrders.forEach(lo => {
          paymentSyncResults.labOrders.push({
            id: lo._id,
            orderId: lo.orderId,
            status: newPaymentStatus
          });
        });
      }
    }

    invoiceLogger.info('Service payment status synced', paymentSyncResults);
  } catch (syncError) {
    invoiceLogger.error('Error syncing payment to services (non-blocking)', { error: syncError.message });
  }

  // CRITICAL FIX: Send WebSocket notification for billing update
  // Frontend hooks listen to 'billing_update' event
  websocketService.emitBillingUpdate({
    event: 'payment_received',
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber || invoice.invoiceId,
    patientId: invoice.patient,
    amount: paymentResult.payment?.amount,
    newStatus: invoice.status,
    amountPaid: invoice.summary?.amountPaid,
    amountDue: invoice.summary?.amountDue
  });

  // AUDIT: Log payment for financial compliance
  try {
    await AuditLog.log({
      user: req.user._id,
      action: 'PAYMENT_ADD',
      resource: 'invoice',
      resourceId: invoice._id,
      details: {
        invoiceNumber: invoice.invoiceNumber || invoice.invoiceId,
        patientId: invoice.patient,
        amount: paymentResult.payment?.amount,
        currency: paymentCurrency,
        method: method,
        newStatus: invoice.status,
        totalPaid: invoice.summary?.amountPaid,
        remainingDue: invoice.summary?.amountDue
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
  } catch (auditErr) {
    invoiceLogger.error('Failed to create audit log for payment', { error: auditErr.message });
    // Non-blocking - payment already processed
  }

  return success(res, {
    statusCode: 200,
    message: 'Payment added successfully',
    data: {
      invoice,
      payment: paymentResult.payment,
      surgeryCases: surgeryCases.length > 0 ? surgeryCases : undefined,
      paymentSync: paymentSyncResults
    }
  });
});

// @desc    Cancel invoice
// @route   PUT /api/invoices/:id/cancel
// @access  Private (Admin)
exports.cancelInvoice = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return notFound(res, 'Invoice');
  }

  const { reason } = req.body;

  if (!reason) {
    return badRequest(res, 'Cancellation reason is required');
  }

  try {
    const beforeStatus = invoice.status;
    const beforeAmountPaid = invoice.summary?.amountPaid || 0;

    await invoice.cancel(req.user.id, reason);

    // AUDIT: Log cancellation for financial compliance
    try {
      await AuditLog.log({
        user: req.user._id,
        action: 'INVOICE_CANCEL',
        resource: 'invoice',
        resourceId: invoice._id,
        details: {
          invoiceNumber: invoice.invoiceNumber || invoice.invoiceId,
          patientId: invoice.patient,
          reason: reason,
          previousStatus: beforeStatus,
          amountPaid: beforeAmountPaid,
          totalAmount: invoice.summary?.total
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (auditErr) {
      invoiceLogger.error('Failed to create audit log for invoice cancellation', { error: auditErr.message });
    }

    return success(res, {
      statusCode: 200,
      message: 'Invoice cancelled successfully',
      data: invoice
    });
  } catch (err) {
    return badRequest(res, err.message);
  }
});

// @desc    Issue refund
// @route   POST /api/invoices/:id/refund
// @access  Private (Admin)
exports.issueRefund = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return notFound(res, 'Invoice');
  }

  const { amount, reason, method } = req.body;

  if (!amount || amount <= 0) {
    return badRequest(res, 'Refund amount must be greater than 0');
  }

  if (!reason) {
    return badRequest(res, 'Refund reason is required');
  }

  try {
    await invoice.issueRefund(amount, req.user.id, reason, method);

    // === HANDLE RELATED SERVICE REVERSALS ===
    const serviceUpdates = {
      surgeryCases: [],
      glassesOrders: [],
      prescriptions: []
    };

    // Handle Surgery Cases
    if (invoice.items && invoice.items.length > 0) {
      const SurgeryCase = require('../models/SurgeryCase');

      for (const item of invoice.items) {
        // Check for surgery cases linked to this invoice
        if (item.surgeryCaseId) {
          try {
            const surgeryCase = await SurgeryCase.findById(item.surgeryCaseId);
            if (surgeryCase) {
              if (surgeryCase.status === 'awaiting_scheduling') {
                // Cancel the surgery case if not yet scheduled
                surgeryCase.status = 'cancelled';
                surgeryCase.cancellationReason = 'other';
                surgeryCase.cancellationNotes = `Payment refunded: ${reason}`;
                surgeryCase.cancelledAt = new Date();
                surgeryCase.cancelledBy = req.user.id;
                surgeryCase.paymentStatus = 'refunded';
                await surgeryCase.save();
                serviceUpdates.surgeryCases.push({
                  id: surgeryCase._id,
                  action: 'cancelled'
                });
              } else if (['scheduled', 'checked_in'].includes(surgeryCase.status)) {
                // Mark as payment issue - requires manual resolution
                surgeryCase.paymentStatus = 'refunded';
                surgeryCase.paymentIssue = true;
                surgeryCase.paymentIssueNotes = `Invoice refunded: ${reason}. Manual review required.`;
                await surgeryCase.save();
                serviceUpdates.surgeryCases.push({
                  id: surgeryCase._id,
                  action: 'flagged',
                  warning: 'Surgery already scheduled - manual review required'
                });
              } else {
                // Surgery completed - just mark payment status
                surgeryCase.paymentStatus = 'refunded';
                surgeryCase.paymentIssueNotes = `Refund issued after surgery completion: ${reason}`;
                await surgeryCase.save();
                serviceUpdates.surgeryCases.push({
                  id: surgeryCase._id,
                  action: 'marked_refunded'
                });
              }
            }
          } catch (surgeryError) {
            invoiceLogger.error('Error updating surgery case', { error: surgeryError.message });
          }
        }

        // Check for glasses orders linked via reference
        if (item.reference && item.reference.startsWith('GlassesOrder:')) {
          try {
            const GlassesOrder = require('../models/GlassesOrder');
            const orderNumber = item.reference.split(':')[1];
            const glassesOrder = await GlassesOrder.findOne({ orderNumber });

            if (glassesOrder) {
              glassesOrder.paymentStatus = 'refunded';
              glassesOrder.internalNotes = `${glassesOrder.internalNotes || ''}\n[${new Date().toISOString()}] Refund issued: ${reason}`;
              await glassesOrder.save();
              serviceUpdates.glassesOrders.push({
                id: glassesOrder._id,
                orderNumber: glassesOrder.orderNumber,
                action: 'marked_refunded'
              });
            }
          } catch (glassesError) {
            invoiceLogger.error('Error updating glasses order', { error: glassesError.message });
          }
        }

        // Check for prescriptions linked via reference
        if (item.reference && item.reference.startsWith('Prescription:')) {
          try {
            const Prescription = require('../models/Prescription');
            const prescId = item.reference.split(':')[1];
            const prescription = await Prescription.findById(prescId);

            if (prescription) {
              prescription.dispensing = prescription.dispensing || {};
              prescription.dispensing.refundIssued = true;
              prescription.dispensing.refundDate = new Date();
              prescription.dispensing.refundNotes = reason;
              await prescription.save();
              serviceUpdates.prescriptions.push({
                id: prescription._id,
                action: 'marked_refunded'
              });
            }
          } catch (prescError) {
            invoiceLogger.error('Error updating prescription', { error: prescError.message });
          }
        }
      }
    }

    // Also check for glasses orders linked directly to invoice
    try {
      const GlassesOrder = require('../models/GlassesOrder');
      const linkedOrders = await GlassesOrder.find({ invoice: invoice._id });
      for (const order of linkedOrders) {
        if (!serviceUpdates.glassesOrders.find(o => o.id.toString() === order._id.toString())) {
          order.paymentStatus = 'refunded';
          await order.save();
          serviceUpdates.glassesOrders.push({
            id: order._id,
            orderNumber: order.orderNumber,
            action: 'marked_refunded'
          });
        }
      }
    } catch (glassesError) {
      invoiceLogger.error('Error finding linked glasses orders', { error: glassesError.message });
    }

    invoiceLogger.info('Service updates applied', serviceUpdates);

    return success(res, {
      statusCode: 200,
      message: 'Refund issued successfully',
      data: invoice,
      meta: { serviceUpdates }
    });
  } catch (err) {
    return badRequest(res, err.message);
  }
});

// @desc    Send invoice reminder
// @route   POST /api/invoices/:id/reminder
// @access  Private (Admin, Receptionist)
exports.sendReminder = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return notFound(res, 'Invoice');
  }

  const { method } = req.body; // email, sms, phone, mail

  if (!method || !['email', 'sms', 'phone', 'mail'].includes(method)) {
    return badRequest(res, 'Valid reminder method required (email, sms, phone, mail)');
  }

  await invoice.sendReminder(method, req.user.id);

  return success(res, {
    statusCode: 200,
    message: `Reminder sent via ${method}`,
    data: invoice
  });
});

// @desc    Get patient invoices
// @route   GET /api/invoices/patient/:patientId
// @access  Private
exports.getPatientInvoices = asyncHandler(async (req, res, next) => {
  const { patientId } = req.params;
  const { includeBalance } = req.query;

  // Validate patient exists
  const patient = await findPatientByIdOrCode(patientId);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Get all invoices for patient
  const invoices = await Invoice.find({ patient: patient._id })
    .populate('visit', 'visitId visitDate')
    .sort('-dateIssued');

  const responseData = {
    count: invoices.length,
    data: invoices
  };

  // Include balance if requested
  if (includeBalance === 'true') {
    const balance = await Invoice.getPatientBalance(patient._id);
    responseData.balance = balance;
  }

  return success(res, { data: responseData });
});

// @desc    Get overdue invoices
// @route   GET /api/invoices/overdue
// @access  Private (Admin, Accountant)
exports.getOverdueInvoices = asyncHandler(async (req, res, next) => {
  // Build clinic filter
  const clinicFilter = (req.clinicId && !req.accessAllClinics) ? { clinic: req.clinicId } : {};

  // Get overdue invoices with optional clinic filter
  const invoices = await Invoice.getOverdueInvoices(clinicFilter);

  return success(res, {
    data: {
      count: invoices.length,
      invoices
    }
  });
});

// @desc    Get invoice statistics
// @route   GET /api/invoices/stats
// @access  Private (Admin, Accountant)
exports.getInvoiceStats = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  const dateFilter = {};

  // Multi-clinic: Filter by clinic unless admin with accessAllClinics
  if (req.clinicId && !req.accessAllClinics) {
    dateFilter.clinic = req.clinicId;
  }

  if (startDate || endDate) {
    dateFilter.dateIssued = {};
    if (startDate) dateFilter.dateIssued.$gte = new Date(startDate);
    if (endDate) dateFilter.dateIssued.$lte = new Date(endDate);
  }

  // Get stats using aggregation
  const stats = await Invoice.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$summary.total' },
        amountPaid: { $sum: '$summary.amountPaid' },
        amountDue: { $sum: '$summary.amountDue' }
      }
    }
  ]);

  // Calculate overall totals
  const overall = await Invoice.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        totalRevenue: { $sum: '$summary.total' },
        totalPaid: { $sum: '$summary.amountPaid' },
        totalDue: { $sum: '$summary.amountDue' }
      }
    }
  ]);

  return success(res, {
    data: {
      byStatus: stats,
      overall: overall[0] || {
        totalInvoices: 0,
        totalRevenue: 0,
        totalPaid: 0,
        totalDue: 0
      }
    }
  });
});

// @desc    Mark invoice as sent
// @route   PUT /api/invoices/:id/send
// @access  Private (Admin, Receptionist)
exports.markAsSent = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return notFound(res, 'Invoice');
  }

  if (invoice.status === 'draft') {
    invoice.status = 'sent';
    invoice.sentDate = new Date();
    invoice.updatedBy = req.user.id;
    await invoice.save();
  }

  return success(res, {
    statusCode: 200,
    message: 'Invoice marked as sent',
    data: invoice
  });
});

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
// @access  Private (Admin only)
exports.deleteInvoice = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return notFound(res, 'Facture');
  }

  // Only allow deletion of draft invoices or voided invoices
  if (!['draft', 'cancelled', 'voided'].includes(invoice.status)) {
    return badRequest(res, 'Seules les factures en brouillon, annulées ou annulées peuvent être supprimées');
  }

  // Check if invoice has payments
  if (invoice.payments && invoice.payments.length > 0) {
    const totalPaid = invoice.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    if (totalPaid > 0) {
      return badRequest(res, 'Impossible de supprimer une facture avec des paiements enregistrés');
    }
  }

  // CRITICAL FIX: Clean up Patient.invoices array to prevent orphaned references
  if (invoice.patient) {
    await Patient.findByIdAndUpdate(
      invoice.patient,
      { $pull: { invoices: invoice._id } }
    );
  }

  await invoice.deleteOne();

  return success(res, {
    statusCode: 200,
    message: 'Facture supprimée avec succès',
    data: {}
  });
});

// @desc    Get invoice edit history
// @route   GET /api/invoices/:id/history
// @access  Private (Admin, Accountant)
exports.getInvoiceHistory = asyncHandler(async (req, res, next) => {
  try {
    const history = await Invoice.getInvoiceHistory(req.params.id);

    return success(res, { data: history });
  } catch (err) {
    return notFound(res, err.message);
  }
});

// @desc    Preview company billing before applying (with approval validation)
// @route   POST /api/invoices/:id/preview-company-billing
// @access  Private (Admin, Accountant, Receptionist)
exports.previewCompanyBilling = asyncHandler(async (req, res, next) => {
  const { companyId, exchangeRateUSD } = req.body;
  const Company = require('../models/Company');
  const Approval = require('../models/Approval');

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
exports.applyCompanyBilling = asyncHandler(async (req, res, next) => {
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
exports.consumeApprovals = asyncHandler(async (req, res, next) => {
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

// ============================================
// CATEGORY-FILTERED INVOICE VIEWS
// ============================================

const {
  getAllowedCategories,
  canPerformAction,
  filterInvoiceItems,
  getCollectionPoint
} = require('../middleware/invoiceCategoryFilter');

// @desc    Get pharmacy view of invoice by visit
// @route   GET /api/invoices/pharmacy/:visitId
// @access  Private (pharmacist, pharmacy_receptionist)
exports.getPharmacyInvoiceView = asyncHandler(async (req, res, next) => {
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
  const Prescription = require('../models/Prescription');
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
exports.getOpticalInvoiceView = asyncHandler(async (req, res, next) => {
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
  const GlassesOrder = require('../models/GlassesOrder');
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
exports.getClinicInvoiceView = asyncHandler(async (req, res, next) => {
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

// @desc    Mark invoice item as completed/dispensed
// @route   PATCH /api/invoices/:id/items/:itemId/status
// @access  Private (role-based per category)
exports.markItemCompleted = asyncHandler(async (req, res, next) => {
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
exports.markItemExternal = asyncHandler(async (req, res, next) => {
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
exports.collectItemPayment = asyncHandler(async (req, res, next) => {
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
exports.getInvoiceItems = asyncHandler(async (req, res, next) => {
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
