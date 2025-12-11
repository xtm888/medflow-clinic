# Optical Shop Security Fixes + Try-On Photos Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 73+ security/performance vulnerabilities in the Optical Shop system and add frame try-on photo feature for opticians.

**Architecture:**
- Add clinic multi-tenancy filtering to all optical shop queries
- Implement input validation and sanitization across all endpoints
- Add transaction support for inventory operations
- Create new frameTryOnPhotos schema and upload endpoints
- Build React UI component for photo capture during frame selection

**Tech Stack:** Node.js/Express, MongoDB/Mongoose, React, Multer for uploads

---

## Phase 1: P0 Critical Security Fixes

### Task 1: Add Clinic Filtering Utility

**Files:**
- Create: `backend/utils/clinicFilter.js`

**Step 1: Create clinic filter utility**

```javascript
// backend/utils/clinicFilter.js
/**
 * Utility for consistent clinic-based multi-tenancy filtering
 */

/**
 * Build clinic filter for queries
 * @param {Object} req - Express request object
 * @param {String} clinicField - Field name for clinic (default: 'clinic')
 * @returns {Object} MongoDB filter object
 */
const buildClinicFilter = (req, clinicField = 'clinic') => {
  // Admin with accessAllClinics can see everything
  if (req.user?.accessAllClinics || req.user?.role === 'superadmin') {
    return {};
  }

  // Get clinic from user or request
  const clinicId = req.user?.clinic || req.clinicId;

  if (!clinicId) {
    // No clinic context - return filter that matches nothing for safety
    return { [clinicField]: null };
  }

  return { [clinicField]: clinicId };
};

/**
 * Verify resource belongs to user's clinic
 * @param {Object} resource - MongoDB document with clinic field
 * @param {Object} req - Express request object
 * @param {String} clinicField - Field name for clinic
 * @returns {Boolean} true if authorized
 */
const verifyClinicAccess = (resource, req, clinicField = 'clinic') => {
  if (req.user?.accessAllClinics || req.user?.role === 'superadmin') {
    return true;
  }

  const userClinic = req.user?.clinic || req.clinicId;
  const resourceClinic = resource[clinicField];

  if (!userClinic || !resourceClinic) {
    return false;
  }

  return userClinic.toString() === resourceClinic.toString();
};

/**
 * Middleware to verify clinic access on resource
 */
const requireClinicAccess = (getResource, clinicField = 'clinic') => {
  return async (req, res, next) => {
    try {
      const resource = await getResource(req);

      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found'
        });
      }

      if (!verifyClinicAccess(resource, req, clinicField)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - resource belongs to different clinic'
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  buildClinicFilter,
  verifyClinicAccess,
  requireClinicAccess
};
```

**Step 2: Commit**

```bash
git add backend/utils/clinicFilter.js
git commit -m "feat: add clinic filtering utility for multi-tenancy security"
```

---

### Task 2: Add Input Sanitization Utility

**Files:**
- Modify: `backend/utils/sanitize.js`

**Step 1: Enhance sanitize utility with regex escaping**

Add to existing sanitize.js:

```javascript
/**
 * Escape special regex characters to prevent ReDoS attacks
 * @param {String} str - Input string
 * @returns {String} Escaped string safe for RegExp
 */
const escapeRegex = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Create safe search regex with length limits
 * @param {String} query - Search query
 * @param {Object} options - Options
 * @returns {RegExp|null} Safe regex or null if invalid
 */
const createSafeSearchRegex = (query, options = {}) => {
  const {
    maxLength = 50,
    minLength = 1,
    anchorStart = false,
    caseInsensitive = true
  } = options;

  if (!query || typeof query !== 'string') return null;

  const trimmed = query.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) return null;

  const escaped = escapeRegex(trimmed);
  const pattern = anchorStart ? `^${escaped}` : escaped;

  return new RegExp(pattern, caseInsensitive ? 'i' : '');
};

/**
 * Validate MongoDB ObjectId format
 * @param {String} id - ID to validate
 * @returns {Boolean} true if valid ObjectId format
 */
const isValidObjectId = (id) => {
  if (!id || typeof id !== 'string') return false;
  return /^[a-fA-F0-9]{24}$/.test(id);
};

/**
 * Sanitize and validate numeric input
 * @param {*} value - Input value
 * @param {Object} options - Validation options
 * @returns {Number|null} Validated number or null
 */
const sanitizeNumber = (value, options = {}) => {
  const { min = -Infinity, max = Infinity, allowNegative = false, defaultValue = null } = options;

  const num = Number(value);

  if (isNaN(num) || !isFinite(num)) return defaultValue;
  if (!allowNegative && num < 0) return defaultValue;
  if (num < min || num > max) return defaultValue;

  return num;
};

/**
 * Sanitize price/currency values
 * @param {*} value - Input value
 * @param {Object} options - Options
 * @returns {Number|null} Valid price or null
 */
const sanitizePrice = (value, options = {}) => {
  const { maxPrice = 100000000, allowZero = false } = options;

  const price = sanitizeNumber(value, { min: allowZero ? 0 : 0.01, max: maxPrice });

  if (price === null) return null;

  // Round to 2 decimal places for currency
  return Math.round(price * 100) / 100;
};

// Add to exports
module.exports = {
  ...module.exports,
  escapeRegex,
  createSafeSearchRegex,
  isValidObjectId,
  sanitizeNumber,
  sanitizePrice
};
```

**Step 2: Commit**

```bash
git add backend/utils/sanitize.js
git commit -m "feat: add input sanitization utilities for security"
```

---

### Task 3: Fix opticalShopController - Add Clinic Filtering

**Files:**
- Modify: `backend/controllers/opticalShopController.js`

**Step 1: Add imports and fix getDashboardStats**

At top of file, add imports:

```javascript
const { buildClinicFilter, verifyClinicAccess } = require('../utils/clinicFilter');
const { createSafeSearchRegex, isValidObjectId, sanitizeNumber, sanitizePrice } = require('../utils/sanitize');
```

**Step 2: Fix getDashboardStats (lines ~23-91)**

Replace the function to add clinic filtering:

```javascript
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const clinicFilter = buildClinicFilter(req);

    // Today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get stats with clinic filter
    const [myStats] = await GlassesOrder.aggregate([
      {
        $match: {
          'opticalShop.optician': new mongoose.Types.ObjectId(userId),
          ...clinicFilter,
          createdAt: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.finalTotal' },
          pendingVerification: {
            $sum: { $cond: [{ $eq: ['$status', 'pending_verification'] }, 1, 0] }
          }
        }
      }
    ]);

    // Recent orders with clinic filter
    const recentOrders = await GlassesOrder.find({
      'opticalShop.optician': userId,
      ...clinicFilter
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('patient', 'firstName lastName fileNumber')
      .select('orderNumber status patient pricing.finalTotal createdAt')
      .lean();

    // Verification queue with clinic filter
    const verificationQueue = await GlassesOrder.find({
      status: 'pending_verification',
      ...clinicFilter
    })
      .sort({ 'opticalShop.verification.submittedAt': 1 })
      .limit(5)
      .populate('patient', 'firstName lastName fileNumber')
      .populate('opticalShop.optician', 'firstName lastName')
      .select('orderNumber patient opticalShop.optician opticalShop.verification.submittedAt')
      .lean();

    res.json({
      success: true,
      data: {
        today: myStats || { totalOrders: 0, totalRevenue: 0, pendingVerification: 0 },
        recentOrders,
        verificationQueue
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard stats'
    });
  }
};
```

**Step 3: Fix searchPatients (lines ~96-119) - Add input sanitization**

```javascript
exports.searchPatients = async (req, res) => {
  try {
    const { query } = req.query;
    const clinicFilter = buildClinicFilter(req);

    // Validate and sanitize search input
    const searchRegex = createSafeSearchRegex(query, {
      maxLength: 50,
      minLength: 2,
      anchorStart: false
    });

    if (!searchRegex) {
      return res.json({ success: true, data: [] });
    }

    const patients = await Patient.find({
      ...clinicFilter,
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { fileNumber: searchRegex },
        { phoneNumber: searchRegex }
      ]
    })
      .limit(15)
      .select('firstName lastName fileNumber phoneNumber dateOfBirth convention')
      .populate('convention.company', 'name conventionCode')
      .lean();

    res.json({
      success: true,
      data: patients
    });
  } catch (error) {
    console.error('Patient search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed'
    });
  }
};
```

**Step 4: Fix getPatientConventionInfo (lines ~143-269) - Add access control**

```javascript
exports.getPatientConventionInfo = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Validate ObjectId
    if (!isValidObjectId(patientId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid patient ID format'
      });
    }

    const patient = await Patient.findById(patientId)
      .select('firstName lastName convention clinic')
      .populate('convention.company', 'name companyId conventionCode coveredCategories defaultCoverage approvalRules');

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // CRITICAL: Verify clinic access
    if (!verifyClinicAccess(patient, req)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Rest of the existing logic...
    if (!patient.convention?.company) {
      return res.json({
        success: true,
        data: {
          hasConvention: false,
          opticalCovered: false
        }
      });
    }

    const company = patient.convention.company;

    // Find optical coverage settings
    const opticalSettings = company.coveredCategories?.find(
      cat => cat.category?.toLowerCase() === 'optical' ||
             cat.category?.toLowerCase() === 'optique'
    );

    if (!opticalSettings || opticalSettings.notCovered) {
      return res.json({
        success: true,
        data: {
          hasConvention: true,
          opticalCovered: false,
          company: { id: company._id, name: company.name }
        }
      });
    }

    // Build effective settings
    const baseCoveragePercentage = patient.convention.coveragePercentage ||
      opticalSettings.coveragePercentage ||
      company.defaultCoverage?.percentage || 100;

    const effectiveSettings = {
      coveragePercentage: Math.min(100, Math.max(0, baseCoveragePercentage)), // Clamp 0-100
      maxPerItem: opticalSettings.maxPerItem || company.approvalRules?.maxPerItem,
      maxPerItemCurrency: opticalSettings.maxPerItemCurrency || company.approvalRules?.maxPerItemCurrency || 'CDF',
      requiresApproval: opticalSettings.requiresPreApproval || company.approvalRules?.requiresPreApproval,
      autoApproveUnder: opticalSettings.autoApproveUnder || company.approvalRules?.autoApproveUnder,
      additionalDiscount: opticalSettings.additionalDiscount || 0
    };

    // Only expose sensitive thresholds to admin/billing roles
    const sensitiveRoles = ['admin', 'billing', 'manager'];
    const includeSensitive = sensitiveRoles.includes(req.user?.role);

    res.json({
      success: true,
      data: {
        hasConvention: true,
        opticalCovered: true,
        company: {
          id: company._id,
          name: company.name,
          conventionCode: company.conventionCode
        },
        coveragePercentage: effectiveSettings.coveragePercentage,
        patientPays: 100 - effectiveSettings.coveragePercentage,
        requiresApproval: effectiveSettings.requiresApproval,
        // Only include sensitive data for authorized roles
        ...(includeSensitive && {
          autoApproveUnder: effectiveSettings.autoApproveUnder,
          maxPerItem: effectiveSettings.maxPerItem,
          additionalDiscount: effectiveSettings.additionalDiscount
        })
      }
    });
  } catch (error) {
    console.error('Convention info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get convention info'
    });
  }
};
```

**Step 5: Fix getPatientPrescription (lines ~274-322) - Add access control**

```javascript
exports.getPatientPrescription = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Validate ObjectId
    if (!isValidObjectId(patientId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid patient ID format'
      });
    }

    // First verify patient exists and user has access
    const patient = await Patient.findById(patientId).select('clinic');

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // CRITICAL: Verify clinic access
    if (!verifyClinicAccess(patient, req)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get latest exam with refraction
    const latestExam = await OphthalmologyExam.findOne({
      patient: patientId,
      'refraction.finalRx': { $exists: true }
    })
      .sort({ examDate: -1 })
      .populate('performedBy', 'firstName lastName')
      .select('examDate refraction performedBy')
      .lean();

    // Get recent glasses orders
    const recentOrders = await GlassesOrder.find({
      patient: patientId,
      status: { $in: ['delivered', 'ready'] }
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('orderNumber prescriptionData glasses.frame createdAt')
      .lean();

    res.json({
      success: true,
      data: {
        latestExam: latestExam ? {
          date: latestExam.examDate,
          refraction: latestExam.refraction,
          performedBy: latestExam.performedBy
        } : null,
        recentOrders
      }
    });
  } catch (error) {
    console.error('Prescription fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get prescription'
    });
  }
};
```

**Step 6: Commit**

```bash
git add backend/controllers/opticalShopController.js
git commit -m "fix: add clinic filtering and input validation to opticalShopController"
```

---

### Task 4: Fix Pricing Validation - Prevent Negative Totals

**Files:**
- Modify: `backend/controllers/opticalShopController.js`

**Step 1: Fix calculatePricing function (lines ~1427-1608)**

Add validation to the calculatePricing helper function:

```javascript
async function calculatePricing(order) {
  let framePrice = 0;
  let lensPrice = 0;
  let optionsPrice = 0;

  // Frame pricing
  if (order.frame?.inventoryItem) {
    const frame = await FrameInventory.findById(order.frame.inventoryItem);
    if (frame) {
      framePrice = sanitizePrice(frame.pricing?.retailPrice, { allowZero: true }) || 0;
    }
  } else if (order.frame?.price) {
    framePrice = sanitizePrice(order.frame.price, { allowZero: true }) || 0;
  }

  // Lens pricing from fee schedule or fallback
  if (order.rightLens || order.leftLens) {
    const lensType = order.lensType || order.rightLens?.material || 'cr39';

    // Try to get from fee schedule
    const feeSchedule = await FeeSchedule.findOne({
      code: { $regex: new RegExp(`^LENS-${lensType}$`, 'i') },
      isActive: true
    });

    if (feeSchedule) {
      lensPrice = sanitizePrice(feeSchedule.price) || 0;
    } else {
      // Fallback pricing - should be moved to database
      const lensPrices = {
        'cr39': 15000,
        'cr39-1.56': 25000,
        'polycarbonate': 35000,
        'hi-index-1.60': 50000,
        'hi-index-1.67': 75000,
        'hi-index-1.74': 100000
      };
      lensPrice = lensPrices[lensType] || 15000;
    }

    // Double for both eyes if applicable
    if (order.rightLens && order.leftLens) {
      lensPrice *= 2;
    }
  }

  // Options/coatings pricing
  if (order.lensOptions?.coatings?.length > 0) {
    for (const coating of order.lensOptions.coatings) {
      const coatingFee = await FeeSchedule.findOne({
        code: { $regex: new RegExp(`^COATING-${coating}$`, 'i') },
        isActive: true
      });
      optionsPrice += sanitizePrice(coatingFee?.price, { allowZero: true }) || 5000;
    }
  }

  // Calculate subtotal
  const subtotal = framePrice + lensPrice + optionsPrice;

  // CRITICAL: Validate and clamp discount
  let discount = sanitizePrice(order.pricing?.discount, { allowZero: true }) || 0;

  // Discount cannot exceed subtotal
  if (discount > subtotal) {
    discount = subtotal;
    console.warn(`Discount clamped from ${order.pricing?.discount} to ${subtotal} for order ${order._id}`);
  }

  let discountedTotal = subtotal - discount;

  // Get convention info if applicable
  let conventionInfo = null;
  if (order.patient) {
    const patient = await Patient.findById(order.patient)
      .populate('convention.company');

    if (patient?.convention?.company) {
      const company = patient.convention.company;
      const opticalSettings = company.coveredCategories?.find(
        cat => cat.category?.toLowerCase() === 'optical'
      );

      if (opticalSettings && !opticalSettings.notCovered) {
        conventionInfo = {
          coveragePercentage: Math.min(100, Math.max(0,
            patient.convention.coveragePercentage ||
            opticalSettings.coveragePercentage ||
            company.defaultCoverage?.percentage || 0
          )),
          maxPerItem: opticalSettings.maxPerItem,
          additionalDiscount: opticalSettings.additionalDiscount || 0
        };
      }
    }
  }

  // Apply convention additional discount
  if (conventionInfo?.additionalDiscount > 0 && discountedTotal > 0) {
    const additionalDiscountAmount = Math.floor(discountedTotal * (conventionInfo.additionalDiscount / 100));
    discountedTotal = Math.max(0, discountedTotal - additionalDiscountAmount);
  }

  // CRITICAL: Ensure non-negative
  discountedTotal = Math.max(0, discountedTotal);

  // Tax calculation
  const taxRate = 0; // DRC typically 0% for medical
  const taxAmount = Math.round(discountedTotal * (taxRate / 100));
  const finalTotal = discountedTotal + taxAmount;

  // Convention billing split
  let companyPortion = 0;
  let patientPortion = finalTotal;

  if (conventionInfo && conventionInfo.coveragePercentage > 0) {
    companyPortion = Math.round(finalTotal * conventionInfo.coveragePercentage / 100);

    // Apply frame limit if applicable
    if (conventionInfo.maxPerItem && framePrice > 0) {
      // Get exchange rate from config (TODO: move to database)
      const exchangeRate = await getExchangeRate('USD', 'CDF') || 2800;
      const limitInCDF = (conventionInfo.maxPerItem || 0) * exchangeRate;

      if (framePrice > limitInCDF) {
        const frameOverage = framePrice - limitInCDF;
        // Adjust company portion - they only cover up to limit
        companyPortion = Math.round((finalTotal - frameOverage) * conventionInfo.coveragePercentage / 100);

        order.conventionBilling = order.conventionBilling || {};
        order.conventionBilling.frameLimit = limitInCDF;
        order.conventionBilling.frameOverage = frameOverage;
      }
    }

    patientPortion = finalTotal - companyPortion;
  }

  // CRITICAL: Validate final calculations
  if (companyPortion + patientPortion !== finalTotal) {
    // Rounding adjustment
    patientPortion = finalTotal - companyPortion;
  }

  // Update order pricing
  order.pricing = {
    framePrice,
    lensPrice,
    optionsPrice,
    subtotal,
    discount,
    discountedTotal,
    taxRate,
    taxAmount,
    finalTotal,
    companyPortion,
    patientPortion
  };

  return order.pricing;
}

// Helper to get exchange rate (placeholder - should be from database/service)
async function getExchangeRate(from, to) {
  // TODO: Implement proper exchange rate service
  const rates = {
    'USD_CDF': 2800,
    'EUR_CDF': 3000
  };
  return rates[`${from}_${to}`] || null;
}
```

**Step 2: Commit**

```bash
git add backend/controllers/opticalShopController.js
git commit -m "fix: add pricing validation to prevent negative totals"
```

---

### Task 5: Fix generateInvoice - Add Status Check

**Files:**
- Modify: `backend/controllers/opticalShopController.js`

**Step 1: Fix generateInvoice function (lines ~909-1112)**

Add status and clinic validation:

```javascript
exports.generateInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order ID format'
      });
    }

    const order = await GlassesOrder.findById(id)
      .populate('patient', 'firstName lastName patientId fileNumber convention clinic')
      .populate('conventionBilling.company.id', 'name companyId conventionCode')
      .session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // CRITICAL: Verify clinic access
    if (!verifyClinicAccess(order, req)) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // CRITICAL: Check order status - cannot invoice cancelled orders
    const invoiceableStatuses = ['verified', 'confirmed', 'ready', 'delivered'];
    if (!invoiceableStatuses.includes(order.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: `Cannot generate invoice for order with status: ${order.status}`,
        allowedStatuses: invoiceableStatuses
      });
    }

    // Check for existing invoice
    if (order.invoice) {
      const existingInvoice = await Invoice.findById(order.invoice).session(session);
      if (existingInvoice) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          error: 'Invoice already exists for this order',
          invoiceId: existingInvoice._id,
          invoiceNumber: existingInvoice.invoiceNumber
        });
      }
    }

    // CRITICAL: Verify patient still exists
    if (!order.patient) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: 'Patient record not found - cannot generate invoice'
      });
    }

    // CRITICAL: Validate pricing
    if (!order.pricing?.finalTotal || order.pricing.finalTotal <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: 'Invalid order total - cannot generate invoice',
        finalTotal: order.pricing?.finalTotal
      });
    }

    // Build invoice items
    const invoiceItems = [];
    const orderRef = `GlassesOrder:${order.orderNumber}`;

    // Frame item
    if (order.frame && order.pricing.framePrice > 0) {
      invoiceItems.push({
        description: `Monture: ${order.frame.brand || ''} ${order.frame.model || ''}`.trim() || 'Monture optique',
        category: 'optical',
        code: 'FRAME-OPT',
        quantity: 1,
        unitPrice: order.pricing.framePrice,
        discount: 0,
        subtotal: order.pricing.framePrice,
        tax: 0,
        total: order.pricing.framePrice,
        reference: orderRef
      });
    }

    // Lens item
    if (order.pricing.lensPrice > 0) {
      invoiceItems.push({
        description: `Verres: ${order.lensType || 'Standard'}`,
        category: 'optical',
        code: 'LENS-OPT',
        quantity: 1,
        unitPrice: order.pricing.lensPrice,
        discount: 0,
        subtotal: order.pricing.lensPrice,
        tax: 0,
        total: order.pricing.lensPrice,
        reference: orderRef
      });
    }

    // Options/coatings
    if (order.pricing.optionsPrice > 0) {
      invoiceItems.push({
        description: `Options: ${order.lensOptions?.coatings?.join(', ') || 'Traitements'}`,
        category: 'optical',
        code: 'OPT-COATING',
        quantity: 1,
        unitPrice: order.pricing.optionsPrice,
        discount: 0,
        subtotal: order.pricing.optionsPrice,
        tax: 0,
        total: order.pricing.optionsPrice,
        reference: orderRef
      });
    }

    // Create invoice
    const invoiceData = {
      patient: order.patient._id,
      clinic: order.clinic,
      createdBy: req.user._id,
      items: invoiceItems,
      summary: {
        subtotal: order.pricing.subtotal,
        discount: order.pricing.discount,
        tax: order.pricing.taxAmount,
        total: order.pricing.finalTotal,
        amountDue: order.pricing.patientPortion,
        amountPaid: 0
      },
      paymentStatus: 'unpaid',
      status: 'issued',
      notes: `Commande optique #${order.orderNumber}`
    };

    // Add convention billing if applicable
    if (order.conventionBilling?.company?.id) {
      invoiceData.companyBilling = {
        company: order.conventionBilling.company.id,
        companyName: order.conventionBilling.company.name,
        coveragePercentage: order.pricing.companyPortion / order.pricing.finalTotal * 100,
        companyAmount: order.pricing.companyPortion,
        patientAmount: order.pricing.patientPortion,
        approvalRequired: order.conventionBilling.requiresApproval,
        approvalStatus: order.conventionBilling.approvalStatus || 'pending'
      };
    }

    const invoice = await Invoice.create([invoiceData], { session });

    // Link invoice to order
    order.invoice = invoice[0]._id;
    await order.save({ session });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      data: invoice[0]
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Generate invoice error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate invoice'
    });
  } finally {
    session.endSession();
  }
};
```

**Step 2: Commit**

```bash
git add backend/controllers/opticalShopController.js
git commit -m "fix: add status check and validation to generateInvoice"
```

---

### Task 6: Fix frameInventoryController - Input Validation

**Files:**
- Modify: `backend/controllers/frameInventoryController.js`

**Step 1: Add imports**

```javascript
const { buildClinicFilter, verifyClinicAccess } = require('../utils/clinicFilter');
const { createSafeSearchRegex, isValidObjectId, sanitizeNumber, sanitizePrice } = require('../utils/sanitize');
```

**Step 2: Fix adjustStock function (lines ~272-339)**

```javascript
exports.adjustStock = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid frame ID format'
      });
    }

    const frame = await FrameInventory.findById(id).session(session);

    if (!frame) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        error: 'Frame not found'
      });
    }

    // Verify clinic access
    if (!verifyClinicAccess(frame, req)) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const { quantity, type, reason, lotNumber } = req.body;

    // CRITICAL: Validate quantity
    const validatedQuantity = sanitizeNumber(quantity, {
      min: 1,
      max: 10000,
      allowNegative: false
    });

    if (validatedQuantity === null) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: 'Quantity must be a positive number between 1 and 10,000'
      });
    }

    // Validate adjustment type
    const validTypes = ['adjusted', 'damaged', 'returned', 'transferred', 'correction'];
    if (!validTypes.includes(type)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: `Invalid adjustment type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // For negative adjustments (damaged, transferred out), check stock won't go negative
    if (['damaged', 'transferred'].includes(type)) {
      const currentStock = frame.inventory.currentStock || 0;
      if (currentStock < validatedQuantity) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          error: `Insufficient stock. Current: ${currentStock}, Requested adjustment: ${validatedQuantity}`
        });
      }
    }

    // Perform adjustment
    if (type === 'damaged' && lotNumber) {
      await frame.markAsDamaged(validatedQuantity, lotNumber, req.user._id, reason, session);
    } else {
      await frame.updateStock(validatedQuantity, type, req.user._id, 'Manual adjustment', reason, session);
    }

    await session.commitTransaction();

    res.json({
      success: true,
      message: `Stock adjusted by ${validatedQuantity} (${type})`,
      data: {
        sku: frame.sku,
        currentStock: frame.inventory.currentStock,
        status: frame.inventory.status
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Stock adjustment error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to adjust stock'
    });
  } finally {
    session.endSession();
  }
};
```

**Step 3: Fix fulfillReservation (lines ~481-524)**

```javascript
exports.fulfillReservation = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id, reservationId } = req.params;
    const { patientId, salePrice } = req.body;

    // Validate ObjectIds
    if (!isValidObjectId(id) || !isValidObjectId(reservationId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }

    const frame = await FrameInventory.findById(id).session(session);

    if (!frame) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        error: 'Frame not found'
      });
    }

    // Verify clinic access
    if (!verifyClinicAccess(frame, req)) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Find reservation
    const reservation = frame.reservations?.find(
      r => r._id.toString() === reservationId && r.status === 'active'
    );

    if (!reservation) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        error: 'Active reservation not found'
      });
    }

    // CRITICAL: Validate sale price if provided
    let validatedSalePrice = frame.pricing?.sellingPrice || 0;

    if (salePrice !== undefined && salePrice !== null) {
      validatedSalePrice = sanitizePrice(salePrice);

      if (validatedSalePrice === null || validatedSalePrice <= 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          error: 'Sale price must be a positive number'
        });
      }

      // Check price is within reasonable bounds (not less than cost, not more than 3x retail)
      const costPrice = frame.pricing?.costPrice || 0;
      const maxPrice = (frame.pricing?.sellingPrice || costPrice) * 3;

      if (costPrice > 0 && validatedSalePrice < costPrice) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          error: `Sale price (${validatedSalePrice}) cannot be less than cost price (${costPrice})`
        });
      }

      if (maxPrice > 0 && validatedSalePrice > maxPrice) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          error: `Sale price (${validatedSalePrice}) exceeds maximum allowed (${maxPrice})`
        });
      }
    }

    // Fulfill reservation
    const result = await frame.fulfillReservation(
      reservationId,
      patientId,
      req.user._id,
      validatedSalePrice,
      session
    );

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Reservation fulfilled successfully',
      data: result
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Fulfill reservation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fulfill reservation'
    });
  } finally {
    session.endSession();
  }
};
```

**Step 4: Commit**

```bash
git add backend/controllers/frameInventoryController.js
git commit -m "fix: add input validation and clinic filtering to frameInventoryController"
```

---

## Phase 2: Try-On Photos Feature

### Task 7: Update GlassesOrder Model

**Files:**
- Modify: `backend/models/GlassesOrder.js`

**Step 1: Add frameTryOnPhotos schema**

Add after line ~165 (after contactLenses schema):

```javascript
  // Frame try-on photos for customer visualization
  frameTryOnPhotos: [{
    frameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FrameInventory'
    },
    frameName: {
      type: String,
      trim: true
    },
    frontPhoto: {
      path: String,
      url: String,
      filename: String,
      capturedAt: Date,
      capturedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    sidePhoto: {
      path: String,
      url: String,
      filename: String,
      capturedAt: Date,
      capturedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    isSelectedFrame: {
      type: Boolean,
      default: false
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
```

**Step 2: Add index for efficient queries**

Add after schema definition:

```javascript
glassesOrderSchema.index({ 'frameTryOnPhotos.frameId': 1 });
```

**Step 3: Commit**

```bash
git add backend/models/GlassesOrder.js
git commit -m "feat: add frameTryOnPhotos schema to GlassesOrder model"
```

---

### Task 8: Add Upload Directory for Try-On Photos

**Files:**
- Modify: `backend/middleware/fileUpload.js`

**Step 1: Add optical-tryons directory**

Update uploadDirs object (around line 7):

```javascript
const uploadDirs = {
  patients: 'uploads/patients',
  documents: 'uploads/documents',
  lab: 'uploads/lab',
  imaging: 'uploads/imaging',
  prescriptions: 'uploads/prescriptions',
  opticalTryons: 'uploads/optical-tryons',  // NEW
  temp: 'uploads/temp'
};
```

**Step 2: Add tryOnPhotos upload handler**

Add after line ~163:

```javascript
  // Optical shop try-on photos (exactly 2 photos: front + side)
  tryOnPhotos: multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        // Create order-specific subdirectory
        const orderId = req.params.orderId || 'temp';
        const orderDir = path.join(uploadDirs.opticalTryons, orderId);

        if (!fs.existsSync(orderDir)) {
          fs.mkdirSync(orderDir, { recursive: true });
        }

        cb(null, orderDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = crypto.randomBytes(4).toString('hex');
        const timestamp = Date.now();
        const photoType = file.fieldname; // 'frontPhoto' or 'sidePhoto'
        const ext = path.extname(file.originalname);

        cb(null, `${photoType}_${timestamp}_${uniqueSuffix}${ext}`);
      }
    }),
    fileFilter: fileFilters.images,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB per photo
      files: 2 // Max 2 files (front + side)
    }
  }).fields([
    { name: 'frontPhoto', maxCount: 1 },
    { name: 'sidePhoto', maxCount: 1 }
  ]),
```

**Step 3: Commit**

```bash
git add backend/middleware/fileUpload.js
git commit -m "feat: add try-on photos upload handler"
```

---

### Task 9: Create Try-On Photos Controller

**Files:**
- Create: `backend/controllers/tryOnPhotoController.js`

**Step 1: Create controller file**

```javascript
// backend/controllers/tryOnPhotoController.js
const mongoose = require('mongoose');
const GlassesOrder = require('../models/GlassesOrder');
const FrameInventory = require('../models/FrameInventory');
const { fileUtils } = require('../middleware/fileUpload');
const { buildClinicFilter, verifyClinicAccess } = require('../utils/clinicFilter');
const { isValidObjectId } = require('../utils/sanitize');

const MAX_TRYON_PHOTOS_PER_ORDER = 5;

/**
 * @desc    Upload try-on photos for a frame
 * @route   POST /api/optical-shop/orders/:orderId/try-on-photos
 * @access  Private (Optician, Admin)
 */
exports.uploadTryOnPhotos = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { frameId, notes } = req.body;

    // Validate IDs
    if (!isValidObjectId(orderId)) {
      // Clean up uploaded files
      if (req.files) {
        for (const fieldFiles of Object.values(req.files)) {
          for (const file of fieldFiles) {
            await fileUtils.deleteFile(file.path).catch(console.error);
          }
        }
      }
      return res.status(400).json({
        success: false,
        error: 'Invalid order ID format'
      });
    }

    // Get order
    const order = await GlassesOrder.findById(orderId);

    if (!order) {
      // Clean up uploaded files
      if (req.files) {
        for (const fieldFiles of Object.values(req.files)) {
          for (const file of fieldFiles) {
            await fileUtils.deleteFile(file.path).catch(console.error);
          }
        }
      }
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Verify clinic access
    if (!verifyClinicAccess(order, req)) {
      // Clean up uploaded files
      if (req.files) {
        for (const fieldFiles of Object.values(req.files)) {
          for (const file of fieldFiles) {
            await fileUtils.deleteFile(file.path).catch(console.error);
          }
        }
      }
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Check order is in modifiable state
    const modifiableStatuses = ['draft', 'pending_verification', 'verification_rejected'];
    if (!modifiableStatuses.includes(order.status)) {
      // Clean up uploaded files
      if (req.files) {
        for (const fieldFiles of Object.values(req.files)) {
          for (const file of fieldFiles) {
            await fileUtils.deleteFile(file.path).catch(console.error);
          }
        }
      }
      return res.status(400).json({
        success: false,
        error: `Cannot add photos to order with status: ${order.status}`
      });
    }

    // Check max photos limit
    if ((order.frameTryOnPhotos?.length || 0) >= MAX_TRYON_PHOTOS_PER_ORDER) {
      // Clean up uploaded files
      if (req.files) {
        for (const fieldFiles of Object.values(req.files)) {
          for (const file of fieldFiles) {
            await fileUtils.deleteFile(file.path).catch(console.error);
          }
        }
      }
      return res.status(400).json({
        success: false,
        error: `Maximum ${MAX_TRYON_PHOTOS_PER_ORDER} try-on photo sets allowed per order`
      });
    }

    // Validate files uploaded
    if (!req.files?.frontPhoto?.[0] || !req.files?.sidePhoto?.[0]) {
      // Clean up any uploaded files
      if (req.files) {
        for (const fieldFiles of Object.values(req.files)) {
          for (const file of fieldFiles) {
            await fileUtils.deleteFile(file.path).catch(console.error);
          }
        }
      }
      return res.status(400).json({
        success: false,
        error: 'Both front photo and side photo are required'
      });
    }

    // Get frame details if frameId provided
    let frameName = 'Unknown Frame';
    if (frameId && isValidObjectId(frameId)) {
      const frame = await FrameInventory.findById(frameId).select('brand model color');
      if (frame) {
        frameName = `${frame.brand || ''} ${frame.model || ''} ${frame.color || ''}`.trim();
      }
    }

    // Build photo set
    const frontFile = req.files.frontPhoto[0];
    const sideFile = req.files.sidePhoto[0];

    const photoSet = {
      frameId: frameId && isValidObjectId(frameId) ? frameId : undefined,
      frameName,
      frontPhoto: {
        path: frontFile.path,
        url: fileUtils.getFileUrl(frontFile.path),
        filename: frontFile.filename,
        capturedAt: new Date(),
        capturedBy: req.user._id
      },
      sidePhoto: {
        path: sideFile.path,
        url: fileUtils.getFileUrl(sideFile.path),
        filename: sideFile.filename,
        capturedAt: new Date(),
        capturedBy: req.user._id
      },
      isSelectedFrame: false,
      notes: notes?.substring(0, 500) || '',
      createdAt: new Date()
    };

    // Add to order
    if (!order.frameTryOnPhotos) {
      order.frameTryOnPhotos = [];
    }
    order.frameTryOnPhotos.push(photoSet);
    await order.save();

    // Return the added photo set
    const addedPhotoSet = order.frameTryOnPhotos[order.frameTryOnPhotos.length - 1];

    res.status(201).json({
      success: true,
      message: 'Try-on photos uploaded successfully',
      data: addedPhotoSet
    });
  } catch (error) {
    // Clean up uploaded files on error
    if (req.files) {
      for (const fieldFiles of Object.values(req.files)) {
        for (const file of fieldFiles) {
          await fileUtils.deleteFile(file.path).catch(console.error);
        }
      }
    }
    console.error('Upload try-on photos error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload try-on photos'
    });
  }
};

/**
 * @desc    Get all try-on photos for an order
 * @route   GET /api/optical-shop/orders/:orderId/try-on-photos
 * @access  Private
 */
exports.getTryOnPhotos = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!isValidObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order ID format'
      });
    }

    const order = await GlassesOrder.findById(orderId)
      .select('frameTryOnPhotos clinic status')
      .populate('frameTryOnPhotos.frontPhoto.capturedBy', 'firstName lastName')
      .populate('frameTryOnPhotos.sidePhoto.capturedBy', 'firstName lastName');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Verify clinic access
    if (!verifyClinicAccess(order, req)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      count: order.frameTryOnPhotos?.length || 0,
      data: order.frameTryOnPhotos || []
    });
  } catch (error) {
    console.error('Get try-on photos error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get try-on photos'
    });
  }
};

/**
 * @desc    Delete a try-on photo set
 * @route   DELETE /api/optical-shop/orders/:orderId/try-on-photos/:photoSetId
 * @access  Private (Optician, Admin)
 */
exports.deleteTryOnPhotos = async (req, res) => {
  try {
    const { orderId, photoSetId } = req.params;

    if (!isValidObjectId(orderId) || !isValidObjectId(photoSetId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }

    const order = await GlassesOrder.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Verify clinic access
    if (!verifyClinicAccess(order, req)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Check order is modifiable
    const modifiableStatuses = ['draft', 'pending_verification', 'verification_rejected'];
    if (!modifiableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete photos from order with status: ${order.status}`
      });
    }

    // Find photo set
    const photoSetIndex = order.frameTryOnPhotos?.findIndex(
      p => p._id.toString() === photoSetId
    );

    if (photoSetIndex === -1 || photoSetIndex === undefined) {
      return res.status(404).json({
        success: false,
        error: 'Photo set not found'
      });
    }

    const photoSet = order.frameTryOnPhotos[photoSetIndex];

    // Delete files from disk
    if (photoSet.frontPhoto?.path) {
      await fileUtils.deleteFile(photoSet.frontPhoto.path).catch(console.error);
    }
    if (photoSet.sidePhoto?.path) {
      await fileUtils.deleteFile(photoSet.sidePhoto.path).catch(console.error);
    }

    // Remove from array
    order.frameTryOnPhotos.splice(photoSetIndex, 1);
    await order.save();

    res.json({
      success: true,
      message: 'Try-on photos deleted successfully'
    });
  } catch (error) {
    console.error('Delete try-on photos error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete try-on photos'
    });
  }
};

/**
 * @desc    Mark a frame as selected
 * @route   PUT /api/optical-shop/orders/:orderId/try-on-photos/:photoSetId/select
 * @access  Private (Optician, Admin)
 */
exports.selectFrame = async (req, res) => {
  try {
    const { orderId, photoSetId } = req.params;

    if (!isValidObjectId(orderId) || !isValidObjectId(photoSetId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }

    const order = await GlassesOrder.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Verify clinic access
    if (!verifyClinicAccess(order, req)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Find photo set
    const photoSet = order.frameTryOnPhotos?.find(
      p => p._id.toString() === photoSetId
    );

    if (!photoSet) {
      return res.status(404).json({
        success: false,
        error: 'Photo set not found'
      });
    }

    // Clear previous selection and mark new one
    order.frameTryOnPhotos.forEach(p => {
      p.isSelectedFrame = p._id.toString() === photoSetId;
    });

    await order.save();

    res.json({
      success: true,
      message: 'Frame selected successfully',
      data: {
        selectedFrameId: photoSet.frameId,
        selectedFrameName: photoSet.frameName
      }
    });
  } catch (error) {
    console.error('Select frame error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to select frame'
    });
  }
};
```

**Step 2: Commit**

```bash
git add backend/controllers/tryOnPhotoController.js
git commit -m "feat: create try-on photo controller with CRUD operations"
```

---

### Task 10: Add Try-On Photo Routes

**Files:**
- Modify: `backend/routes/opticalShop.js`

**Step 1: Add routes for try-on photos**

Add after line 5 (imports):

```javascript
const tryOnPhotoController = require('../controllers/tryOnPhotoController');
const { uploads, handleUploadError } = require('../middleware/fileUpload');
```

Add before `module.exports` (around line 148):

```javascript
// ============================================================
// FRAME TRY-ON PHOTOS
// ============================================================

// Upload try-on photos for a frame
router.post('/orders/:orderId/try-on-photos',
  authorize('admin', 'optician', 'receptionist', 'ophthalmologist'),
  handleUploadError(uploads.tryOnPhotos),
  logAction('OPTICAL_TRYON_PHOTO_UPLOAD'),
  tryOnPhotoController.uploadTryOnPhotos
);

// Get all try-on photos for an order
router.get('/orders/:orderId/try-on-photos',
  logAction('OPTICAL_TRYON_PHOTOS_VIEW'),
  tryOnPhotoController.getTryOnPhotos
);

// Delete a try-on photo set
router.delete('/orders/:orderId/try-on-photos/:photoSetId',
  authorize('admin', 'optician'),
  logCriticalOperation('OPTICAL_TRYON_PHOTO_DELETE'),
  tryOnPhotoController.deleteTryOnPhotos
);

// Mark frame as selected
router.put('/orders/:orderId/try-on-photos/:photoSetId/select',
  authorize('admin', 'optician', 'receptionist'),
  logAction('OPTICAL_TRYON_FRAME_SELECT'),
  tryOnPhotoController.selectFrame
);
```

**Step 2: Commit**

```bash
git add backend/routes/opticalShop.js
git commit -m "feat: add try-on photo routes to optical shop"
```

---

### Task 11: Create Frontend Try-On Photo Service

**Files:**
- Create: `frontend/src/services/tryOnPhotoService.js`

**Step 1: Create service file**

```javascript
// frontend/src/services/tryOnPhotoService.js
import api from './apiConfig';

const tryOnPhotoService = {
  /**
   * Upload try-on photos for a frame
   * @param {string} orderId - Order ID
   * @param {File} frontPhoto - Front view photo file
   * @param {File} sidePhoto - 3/4 angle photo file
   * @param {string} frameId - Optional frame inventory ID
   * @param {string} notes - Optional notes
   */
  uploadPhotos: async (orderId, frontPhoto, sidePhoto, frameId = null, notes = '') => {
    const formData = new FormData();
    formData.append('frontPhoto', frontPhoto);
    formData.append('sidePhoto', sidePhoto);

    if (frameId) {
      formData.append('frameId', frameId);
    }
    if (notes) {
      formData.append('notes', notes);
    }

    const response = await api.post(
      `/optical-shop/orders/${orderId}/try-on-photos`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response.data;
  },

  /**
   * Get all try-on photos for an order
   * @param {string} orderId - Order ID
   */
  getPhotos: async (orderId) => {
    const response = await api.get(`/optical-shop/orders/${orderId}/try-on-photos`);
    return response.data;
  },

  /**
   * Delete a try-on photo set
   * @param {string} orderId - Order ID
   * @param {string} photoSetId - Photo set ID
   */
  deletePhotos: async (orderId, photoSetId) => {
    const response = await api.delete(
      `/optical-shop/orders/${orderId}/try-on-photos/${photoSetId}`
    );
    return response.data;
  },

  /**
   * Mark a frame as selected
   * @param {string} orderId - Order ID
   * @param {string} photoSetId - Photo set ID
   */
  selectFrame: async (orderId, photoSetId) => {
    const response = await api.put(
      `/optical-shop/orders/${orderId}/try-on-photos/${photoSetId}/select`
    );
    return response.data;
  }
};

export default tryOnPhotoService;
```

**Step 2: Commit**

```bash
git add frontend/src/services/tryOnPhotoService.js
git commit -m "feat: create try-on photo service for frontend"
```

---

### Task 12: Create TryOnPhotoCapture Component

**Files:**
- Create: `frontend/src/components/optical/TryOnPhotoCapture.jsx`

**Step 1: Create component file**

```jsx
// frontend/src/components/optical/TryOnPhotoCapture.jsx
import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Check, RotateCcw, Image } from 'lucide-react';
import tryOnPhotoService from '../../services/tryOnPhotoService';

const TryOnPhotoCapture = ({
  orderId,
  frameId,
  frameName,
  onPhotosCaptured,
  onClose
}) => {
  const [frontPhoto, setFrontPhoto] = useState(null);
  const [sidePhoto, setSidePhoto] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [sidePreview, setSidePreview] = useState(null);
  const [activeCapture, setActiveCapture] = useState('front'); // 'front' or 'side'
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState('');
  const [useCamera, setUseCamera] = useState(true);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error('Camera error:', err);
      setUseCamera(false);
      setError('Camera not available. Please use file upload.');
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Capture photo from camera
  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      const file = new File([blob], `${activeCapture}_photo.jpg`, { type: 'image/jpeg' });
      const previewUrl = URL.createObjectURL(blob);

      if (activeCapture === 'front') {
        setFrontPhoto(file);
        setFrontPreview(previewUrl);
        setActiveCapture('side');
      } else {
        setSidePhoto(file);
        setSidePreview(previewUrl);
      }
    }, 'image/jpeg', 0.9);
  }, [activeCapture]);

  // Handle file input
  const handleFileSelect = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);

    if (activeCapture === 'front') {
      setFrontPhoto(file);
      setFrontPreview(previewUrl);
      setActiveCapture('side');
    } else {
      setSidePhoto(file);
      setSidePreview(previewUrl);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [activeCapture]);

  // Reset specific photo
  const resetPhoto = useCallback((type) => {
    if (type === 'front') {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setFrontPhoto(null);
      setFrontPreview(null);
      setActiveCapture('front');
    } else {
      if (sidePreview) URL.revokeObjectURL(sidePreview);
      setSidePhoto(null);
      setSidePreview(null);
      setActiveCapture('side');
    }
  }, [frontPreview, sidePreview]);

  // Upload photos
  const handleUpload = async () => {
    if (!frontPhoto || !sidePhoto) {
      setError('Both photos are required');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const result = await tryOnPhotoService.uploadPhotos(
        orderId,
        frontPhoto,
        sidePhoto,
        frameId,
        notes
      );

      // Cleanup
      stopCamera();
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      if (sidePreview) URL.revokeObjectURL(sidePreview);

      onPhotosCaptured(result.data);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload photos');
    } finally {
      setIsUploading(false);
    }
  };

  // Initialize camera on mount
  React.useEffect(() => {
    if (useCamera) {
      startCamera();
    }
    return () => stopCamera();
  }, [useCamera, startCamera, stopCamera]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Capture Try-On Photos</h3>
            <p className="text-sm text-gray-500">{frameName || 'Selected Frame'}</p>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Front Photo */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Front View {frontPhoto && <Check className="inline w-4 h-4 text-green-500" />}
              </label>
              <div className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                {frontPreview ? (
                  <>
                    <img
                      src={frontPreview}
                      alt="Front view"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => resetPhoto('front')}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </>
                ) : activeCapture === 'front' && useCamera ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Image className="w-12 h-12 text-gray-300" />
                  </div>
                )}
              </div>
            </div>

            {/* Side Photo */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                3/4 Angle View {sidePhoto && <Check className="inline w-4 h-4 text-green-500" />}
              </label>
              <div className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                {sidePreview ? (
                  <>
                    <img
                      src={sidePreview}
                      alt="Side view"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => resetPhoto('side')}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </>
                ) : activeCapture === 'side' && useCamera && frontPhoto ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Image className="w-12 h-12 text-gray-300" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Capture Controls */}
          <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
            {useCamera ? (
              <button
                onClick={capturePhoto}
                disabled={frontPhoto && sidePhoto}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <Camera className="w-5 h-5" />
                Capture {activeCapture === 'front' ? 'Front' : 'Side'} Photo
              </button>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={frontPhoto && sidePhoto}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Upload className="w-5 h-5" />
              Upload {activeCapture === 'front' ? 'Front' : 'Side'} Photo
            </button>
          </div>

          {/* Notes */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about the frame fit..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              maxLength={500}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!frontPhoto || !sidePhoto || isUploading}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <span className="animate-spin">⏳</span>
                Uploading...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Save Photos
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TryOnPhotoCapture;
```

**Step 2: Commit**

```bash
git add frontend/src/components/optical/TryOnPhotoCapture.jsx
git commit -m "feat: create TryOnPhotoCapture component with camera support"
```

---

### Task 13: Create TryOnPhotoGallery Component

**Files:**
- Create: `frontend/src/components/optical/TryOnPhotoGallery.jsx`

**Step 1: Create component file**

```jsx
// frontend/src/components/optical/TryOnPhotoGallery.jsx
import React, { useState } from 'react';
import { Star, Trash2, Eye, X } from 'lucide-react';
import tryOnPhotoService from '../../services/tryOnPhotoService';

const TryOnPhotoGallery = ({
  orderId,
  photos = [],
  onPhotosChange,
  canEdit = true
}) => {
  const [selectedView, setSelectedView] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);
  const [isSelecting, setIsSelecting] = useState(null);

  const handleDelete = async (photoSetId) => {
    if (!confirm('Delete these try-on photos?')) return;

    setIsDeleting(photoSetId);
    try {
      await tryOnPhotoService.deletePhotos(orderId, photoSetId);
      onPhotosChange(photos.filter(p => p._id !== photoSetId));
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete photos');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSelect = async (photoSetId) => {
    setIsSelecting(photoSetId);
    try {
      await tryOnPhotoService.selectFrame(orderId, photoSetId);
      onPhotosChange(photos.map(p => ({
        ...p,
        isSelectedFrame: p._id === photoSetId
      })));
    } catch (error) {
      console.error('Select error:', error);
      alert('Failed to select frame');
    } finally {
      setIsSelecting(null);
    }
  };

  if (photos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No try-on photos yet</p>
        <p className="text-sm">Capture photos to help the customer choose</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {photos.map((photoSet) => (
          <div
            key={photoSet._id}
            className={`border rounded-lg p-4 ${
              photoSet.isSelectedFrame
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {photoSet.isSelectedFrame && (
                  <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                    <Star className="w-4 h-4 fill-current" />
                    Selected
                  </span>
                )}
                <span className="font-medium text-gray-900">
                  {photoSet.frameName || 'Unknown Frame'}
                </span>
              </div>

              {canEdit && (
                <div className="flex items-center gap-2">
                  {!photoSet.isSelectedFrame && (
                    <button
                      onClick={() => handleSelect(photoSet._id)}
                      disabled={isSelecting === photoSet._id}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Star className="w-4 h-4" />
                      {isSelecting === photoSet._id ? 'Selecting...' : 'Select'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(photoSet._id)}
                    disabled={isDeleting === photoSet._id}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isDeleting === photoSet._id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </div>

            {/* Photos */}
            <div className="grid grid-cols-2 gap-3">
              {/* Front Photo */}
              <div
                className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden cursor-pointer group"
                onClick={() => setSelectedView({
                  url: photoSet.frontPhoto?.url,
                  title: `${photoSet.frameName} - Front View`
                })}
              >
                {photoSet.frontPhoto?.url ? (
                  <>
                    <img
                      src={photoSet.frontPhoto.url}
                      alt="Front view"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                      <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No photo
                  </div>
                )}
                <span className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                  Front
                </span>
              </div>

              {/* Side Photo */}
              <div
                className="relative aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden cursor-pointer group"
                onClick={() => setSelectedView({
                  url: photoSet.sidePhoto?.url,
                  title: `${photoSet.frameName} - 3/4 Angle`
                })}
              >
                {photoSet.sidePhoto?.url ? (
                  <>
                    <img
                      src={photoSet.sidePhoto.url}
                      alt="Side view"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                      <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No photo
                  </div>
                )}
                <span className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                  3/4 Angle
                </span>
              </div>
            </div>

            {/* Notes */}
            {photoSet.notes && (
              <p className="mt-3 text-sm text-gray-600 italic">
                "{photoSet.notes}"
              </p>
            )}

            {/* Metadata */}
            <p className="mt-2 text-xs text-gray-400">
              Captured {new Date(photoSet.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Full-size viewer modal */}
      {selectedView && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedView(null)}
        >
          <button
            onClick={() => setSelectedView(null)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full"
          >
            <X className="w-8 h-8" />
          </button>
          <div className="max-w-4xl max-h-[90vh]">
            <img
              src={selectedView.url}
              alt={selectedView.title}
              className="max-w-full max-h-[85vh] object-contain"
            />
            <p className="text-center text-white mt-2">{selectedView.title}</p>
          </div>
        </div>
      )}
    </>
  );
};

export default TryOnPhotoGallery;
```

**Step 2: Commit**

```bash
git add frontend/src/components/optical/TryOnPhotoGallery.jsx
git commit -m "feat: create TryOnPhotoGallery component with selection support"
```

---

### Task 14: Create Component Index

**Files:**
- Create: `frontend/src/components/optical/index.js`

**Step 1: Create index file**

```javascript
// frontend/src/components/optical/index.js
export { default as TryOnPhotoCapture } from './TryOnPhotoCapture';
export { default as TryOnPhotoGallery } from './TryOnPhotoGallery';
```

**Step 2: Commit**

```bash
git add frontend/src/components/optical/index.js
git commit -m "feat: create optical components index"
```

---

### Task 15: Integrate Try-On Photos into NewSale.jsx

**Files:**
- Modify: `frontend/src/pages/OpticalShop/NewSale.jsx`

**Step 1: Add imports**

At top of file, add:

```javascript
import { TryOnPhotoCapture, TryOnPhotoGallery } from '../../components/optical';
import tryOnPhotoService from '../../services/tryOnPhotoService';
```

**Step 2: Add state for try-on photos**

In the component state section, add:

```javascript
const [tryOnPhotos, setTryOnPhotos] = useState([]);
const [showPhotoCapture, setShowPhotoCapture] = useState(false);
const [loadingPhotos, setLoadingPhotos] = useState(false);
```

**Step 3: Add effect to load existing photos**

After other useEffect hooks:

```javascript
// Load try-on photos when order exists
useEffect(() => {
  const loadTryOnPhotos = async () => {
    if (!orderId) return;

    setLoadingPhotos(true);
    try {
      const result = await tryOnPhotoService.getPhotos(orderId);
      setTryOnPhotos(result.data || []);
    } catch (error) {
      console.error('Failed to load try-on photos:', error);
    } finally {
      setLoadingPhotos(false);
    }
  };

  loadTryOnPhotos();
}, [orderId]);
```

**Step 4: Add handler for new photos**

```javascript
const handlePhotosCaptured = (newPhotoSet) => {
  setTryOnPhotos(prev => [...prev, newPhotoSet]);
  setShowPhotoCapture(false);
};
```

**Step 5: Add Try-On Photos section to Frame Selection step**

In the Frame Selection step (Step 2), add after frame selection UI:

```jsx
{/* Try-On Photos Section */}
<div className="mt-6 border-t pt-6">
  <div className="flex items-center justify-between mb-4">
    <h4 className="text-lg font-medium text-gray-900">
      Try-On Photos
    </h4>
    <button
      onClick={() => setShowPhotoCapture(true)}
      disabled={!selectedFrame || tryOnPhotos.length >= 5}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
    >
      <Camera className="w-4 h-4" />
      Capture Photos
    </button>
  </div>

  {loadingPhotos ? (
    <div className="text-center py-4 text-gray-500">
      Loading photos...
    </div>
  ) : (
    <TryOnPhotoGallery
      orderId={orderId}
      photos={tryOnPhotos}
      onPhotosChange={setTryOnPhotos}
      canEdit={['draft', 'pending_verification', 'verification_rejected'].includes(orderStatus)}
    />
  )}
</div>

{/* Photo Capture Modal */}
{showPhotoCapture && (
  <TryOnPhotoCapture
    orderId={orderId}
    frameId={selectedFrame?._id}
    frameName={selectedFrame ? `${selectedFrame.brand} ${selectedFrame.model}` : null}
    onPhotosCaptured={handlePhotosCaptured}
    onClose={() => setShowPhotoCapture(false)}
  />
)}
```

**Step 6: Add Camera icon import**

Make sure Camera is imported from lucide-react:

```javascript
import { ..., Camera } from 'lucide-react';
```

**Step 7: Commit**

```bash
git add frontend/src/pages/OpticalShop/NewSale.jsx
git commit -m "feat: integrate try-on photos into NewSale page"
```

---

## Phase 3: Performance Fixes

### Task 16: Add Missing Database Indexes

**Files:**
- Create: `backend/scripts/createOpticalShopIndexes.js`

**Step 1: Create index script**

```javascript
// backend/scripts/createOpticalShopIndexes.js
const mongoose = require('mongoose');
require('dotenv').config();

async function createIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // GlassesOrder indexes
    console.log('Creating GlassesOrder indexes...');
    await db.collection('glassesorders').createIndexes([
      { key: { clinic: 1, status: 1 }, name: 'clinic_status' },
      { key: { 'opticalShop.optician': 1, createdAt: -1 }, name: 'optician_created' },
      { key: { patient: 1, createdAt: -1 }, name: 'patient_created' },
      { key: { status: 1, 'opticalShop.verification.submittedAt': 1 }, name: 'status_verification' },
      { key: { 'frameTryOnPhotos.frameId': 1 }, name: 'tryon_frame', sparse: true }
    ]);

    // FrameInventory indexes
    console.log('Creating FrameInventory indexes...');
    await db.collection('frameinventories').createIndexes([
      { key: { clinic: 1, 'inventory.status': 1 }, name: 'clinic_status' },
      { key: { brand: 'text', model: 'text', sku: 'text', color: 'text' }, name: 'text_search' }
    ]);

    // Invoice indexes
    console.log('Creating Invoice indexes...');
    await db.collection('invoices').createIndexes([
      { key: { patient: 1, dateIssued: -1 }, name: 'patient_date' },
      { key: { clinic: 1, paymentStatus: 1 }, name: 'clinic_payment' }
    ]);

    // Approval indexes
    console.log('Creating Approval indexes...');
    await db.collection('approvals').createIndexes([
      { key: { patient: 1, company: 1, actCode: 1, status: 1 }, name: 'patient_company_act_status' }
    ]);

    // OpticalLensInventory indexes
    console.log('Creating OpticalLensInventory indexes...');
    await db.collection('opticallensinventories').createIndexes([
      { key: { material: 1, design: 1, isActive: 1, 'inventory.currentStock': 1 }, name: 'material_design_stock' }
    ]);

    console.log('All indexes created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  }
}

createIndexes();
```

**Step 2: Run the script**

```bash
node backend/scripts/createOpticalShopIndexes.js
```

**Step 3: Commit**

```bash
git add backend/scripts/createOpticalShopIndexes.js
git commit -m "feat: add database indexes for optical shop performance"
```

---

## Final Task: Run All Tests and Verify

### Task 17: Verify Implementation

**Step 1: Start backend server**

```bash
cd /Users/xtm888/magloire/backend && npm run dev
```

**Step 2: Start frontend**

```bash
cd /Users/xtm888/magloire/frontend && npm run dev
```

**Step 3: Test endpoints manually**

```bash
# Test try-on photo upload
curl -X POST http://localhost:5001/api/optical-shop/orders/{orderId}/try-on-photos \
  -H "Authorization: Bearer {token}" \
  -F "frontPhoto=@test-front.jpg" \
  -F "sidePhoto=@test-side.jpg" \
  -F "frameId={frameId}"
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete optical shop fixes and try-on photo feature"
```

---

## Summary

**Total Tasks:** 17
**Estimated Time:** 4-6 hours

**What This Plan Covers:**

1. **Security Fixes (Tasks 1-6)**
   - Clinic multi-tenancy filtering
   - Input sanitization (NoSQL injection prevention)
   - Access control on patient data
   - Pricing validation
   - Status checks on invoice generation

2. **Try-On Photo Feature (Tasks 7-15)**
   - GlassesOrder model update
   - Upload middleware configuration
   - Backend controller with CRUD operations
   - API routes
   - Frontend service
   - Camera capture component
   - Photo gallery component
   - Integration into NewSale page

3. **Performance Fixes (Task 16)**
   - Database indexes for common queries

4. **Verification (Task 17)**
   - Manual testing of all changes
