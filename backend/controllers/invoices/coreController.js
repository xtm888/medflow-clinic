/**
 * Invoice Core Controller
 *
 * Handles core CRUD operations for invoices:
 * - getInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice
 * - validateInvoicePrices, getInvoiceHistory, markAsSent
 *
 * Also includes helper functions:
 * - createSurgeryCasesIfNeeded, createSurgeryCasesForPaidItems (delegates to SurgeryService)
 * - validateItemsAgainstFeeSchedule, applyPackageDeals
 */

const {
  Invoice,
  Patient,
  Visit,
  FeeSchedule,
  Company,
  mongoose,
  asyncHandler,
  success,
  notFound,
  paginated,
  badRequest,
  findPatientByIdOrCode,
  websocketService,
  SurgeryService,
  invoiceLogger,
  PAGINATION
} = require('./shared');

// =====================================================
// HELPER FUNCTIONS
// =====================================================

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

/**
 * Helper function to validate invoice items against fee schedule
 */
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

// =====================================================
// CONTROLLER FUNCTIONS
// =====================================================

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private (Admin, Accountant, Receptionist)
const getInvoices = asyncHandler(async (req, res, next) => {
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
const getInvoice = asyncHandler(async (req, res, next) => {
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
const createInvoice = asyncHandler(async (req, res, next) => {
  const Approval = require('../../models/Approval');
  const currencyService = require('../../services/currencyService');

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
          const categoryLevelRequiresApproval = categorySettings?.requiresApproval || false;
          if (approvalRequired && !categoryLevelRequiresApproval && company.approvalRules?.autoApproveUnderAmount) {
            const threshold = company.approvalRules.autoApproveUnderAmount;
            const usdRate = currencyService.fallbackRates?.USD || 0.00036;
            const cdfToUsd = usdRate;
            const priceInUSD = company.approvalRules.autoApproveUnderCurrency === 'USD'
              ? itemTotal * cdfToUsd
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

          // Apply global discount if configured
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

          // Also check category-specific discount
          if (categorySettings?.additionalDiscount > 0 && discountPercentage === 0) {
            discountPercentage = categorySettings.additionalDiscount;
            discountApplied = Math.round((itemTotal * discountPercentage) / 100);
            effectiveItemTotal = itemTotal - discountApplied;
          }

          let companyShare = Math.round((effectiveItemTotal * coveragePercentage) / 100);

          // FIXED: Apply category max CUMULATIVELY across all items
          const category = item.category || 'other';
          if (!categoryCompanyShareTotals[category]) {
            categoryCompanyShareTotals[category] = 0;
          }

          if (categorySettings?.maxPerCategory) {
            const maxForCategory = categorySettings.maxPerCategory;
            const alreadyPaidForCategory = categoryCompanyShareTotals[category];
            const remainingBudget = maxForCategory - alreadyPaidForCategory;

            if (remainingBudget <= 0) {
              companyShare = 0;
            } else if (companyShare > remainingBudget) {
              companyShare = remainingBudget;
            }
          }

          // Update cumulative tracker
          categoryCompanyShareTotals[category] += companyShare;

          // Patient pays: effective price (after discount) - company share
          const patientShare = effectiveItemTotal - companyShare;

          itemsWithConvention.push({
            ...item.toObject ? item.toObject() : item,
            companyShare,
            patientShare,
            coveragePercentage,
            requiresApproval: approvalRequired,
            hasApproval: hasValidApproval,
            discountApplied: discountApplied > 0 ? discountApplied : undefined,
            discountPercentage: discountPercentage > 0 ? discountPercentage : undefined,
            effectivePrice: discountApplied > 0 ? effectiveItemTotal : undefined
          });

          totalCompanyShare += companyShare;
          totalPatientShare += patientShare;
        }

        // Update invoice with convention billing
        const displayName = company.getInvoiceDisplayName ? company.getInvoiceDisplayName() : (company.invoiceDisplayName || company.name);

        invoice.items = itemsWithConvention;
        invoice.companyBilling = {
          company: company._id,
          companyName: displayName,
          companyId: company.companyId,
          conventionCode: company.conventionCode,
          parentConvention: company.parentConvention,
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
        invoice.summary.amountDue = totalPatientShare;

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
const validateInvoicePrices = asyncHandler(async (req, res, next) => {
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
const updateInvoice = asyncHandler(async (req, res, next) => {
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

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
// @access  Private (Admin only)
const deleteInvoice = asyncHandler(async (req, res, next) => {
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
const getInvoiceHistory = asyncHandler(async (req, res, next) => {
  try {
    const history = await Invoice.getInvoiceHistory(req.params.id);

    return success(res, { data: history });
  } catch (err) {
    return notFound(res, err.message);
  }
});

// @desc    Mark invoice as sent
// @route   PUT /api/invoices/:id/send
// @access  Private (Admin, Receptionist)
const markAsSent = asyncHandler(async (req, res, next) => {
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

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  // Helper functions (for use by other modules)
  createSurgeryCasesIfNeeded,
  createSurgeryCasesForPaidItems,
  validateItemsAgainstFeeSchedule,
  applyPackageDeals,

  // Controller functions
  getInvoices,
  getInvoice,
  createInvoice,
  validateInvoicePrices,
  updateInvoice,
  deleteInvoice,
  getInvoiceHistory,
  markAsSent
};
