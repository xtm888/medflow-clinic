# MedFlow Comprehensive Refactoring Plan

**Date**: December 9, 2025
**Last Updated**: December 9, 2025 (Post Impact Analysis)
**Approach**: Full Rewrite Sprint (temporary breakage acceptable)
**Estimated Scope**: ~8,000 lines consolidated, ~3,000 lines removed
**Estimated Timeline**: 8-10 weeks (revised from 2-3 weeks)

---

## Executive Summary

This plan consolidates 5 major refactoring initiatives based on deep dependency analysis. Template model unification was **excluded** after analysis revealed 9/10 risk score due to fundamentally different purposes across models.

### IMPACT ANALYSIS FINDINGS (December 9, 2025)

**Plan Accuracy Score: 72%** - Several critical gaps were discovered during cross-checking.

### What We're Doing (REVISED)

| Phase | Target | Risk | Lines Affected | Result | Notes |
|-------|--------|------|----------------|--------|-------|
| 5 | Frontend Services | LOW | ~800-1,200 | 5 inventory services consolidated | **DO FIRST** - Only 5 services are pure CRUD |
| 3 | Notification Services | MEDIUM | ~1,800 | 4 services → 1 unified | **14 direct callers must be updated** |
| 1 | Inventory System | MEDIUM | ~7,000 | 7 controllers → 1 factory + 7 extensions | **177 functions, not ~50** |
| 2 | Billing Split | HIGH | ~7,100 | 1 mega-controller → 5 focused | **CRITICAL: invoices.js imports 5 functions** |
| 4 | Laboratory Migration | CRITICAL | ~3,500 | Dual architecture → Single LabOrder | **Bidirectional sync hook + report gap** |

### What We're NOT Doing

- **Template Model Unification** - Analysis showed 10 models serve fundamentally different purposes (reference data vs workflows vs documents). Risk too high, benefit too low.

---

## CRITICAL FINDINGS FROM IMPACT ANALYSIS

### Finding 1: Inventory Has 177 Functions (Not ~50)
- 7 controllers have **177 total functions** with inconsistent naming
- Two import patterns used: dot notation AND destructured
- Type-specific functions that CANNOT be factored out:
  - Reagent: `consumeForQC()`, `expireBatch()`, `linkTemplate()`, `getQCHistory()`
  - Lab Consumable: `getCollectionTubes()`, `getTubeStats()`, `getTubeTypes()`
  - Surgical: `findIOLByPower()`, `reserveForSurgery()`, `consumeForSurgery()`
  - Pharmacy: `dispenseFromInventory()`, `dispensePrescription()`, `exportInventory()`

### Finding 2: Billing Has Cross-Import Dependency
**BREAKING CHANGE RISK**: `invoices.js` imports 5 functions from billingController:
```javascript
const { getPayments, applyDiscount, writeOff, generateInvoicePDF, generateReceiptPDF }
  = require('../controllers/billingController');
```
These routes will break if split incorrectly.

### Finding 3: Notifications Have 14 Direct Callers
- 14 files call `sendEmail()` directly, bypassing notification services
- 2 scheduler services (`reminderScheduler`, `invoiceReminderScheduler`) bypass services entirely
- WebSocket notifications are separate from notification services

### Finding 4: Laboratory Has Bidirectional Sync Hook
- `LabOrder.post('save')` auto-syncs to `Visit.laboratoryOrders`
- Report generation reads ONLY from Visit (labs via `/api/lab-orders` CANNOT generate reports)
- Different pending endpoints return different results

### Finding 5: Frontend Only Has 5 Pure CRUD Services
- Original estimate: 78 → 40 services (50% reduction)
- Reality: 78 → ~65 services (17% reduction)
- 7 class-based services CANNOT be factory-generated (websocket, sync, offline, database)

---

## CROSS-CUTTING CONCERNS TO PRESERVE

| Concern | Scope | Must Preserve |
|---------|-------|---------------|
| Audit Logging | 599+ middleware calls | All `logAction()`, `logCriticalOperation()` calls |
| Rate Limiting | 8 limiters | `sensitiveLimiter` on billing, pharmacy, prescriptions |
| Clinic Filtering | 19 route files | All `optionalClinic()`, `requireClinic()` middleware |
| Transactions | 11 controllers | `atomicMultiInvoicePayment`, `atomicRefund` wrappers |
| Schedulers | 13 background jobs | All scheduler start/stop in server.js |
| WebSocket Events | 7 controllers | All `websocketService.emit()` calls |
| Session Management | All auth routes | Redis session validation |

---

## Phase 1: Inventory System Factory Pattern

### ⚠️ REVISED SCOPE (Post Impact Analysis)

**Original Estimate**: 7 controllers with ~50 functions, 2-3 days
**Actual Scope**: 7 controllers with **177 functions**, 5-7 days

**Key Complexities Discovered**:
- Function naming is **inconsistent** (getFrame vs getMedication vs getLens)
- **Two different import patterns** used across routes:
  - Dot notation: `controller.method()`
  - Destructured: `const { method } = require('controller')`
- **Type-specific functions that CANNOT be factored out**:
  - Reagent: `consumeForQC()`, `expireBatch()`, `linkTemplate()`, `getQCHistory()`
  - Lab Consumable: `getCollectionTubes()`, `getTubeStats()`, `getTubeTypes()`
  - Surgical: `findIOLByPower()`, `reserveForSurgery()`, `consumeForSurgery()`
  - Pharmacy: `dispenseFromInventory()`, `dispensePrescription()`, `exportInventory()`

**Good News**: crossClinicInventoryController and inventoryTransferController use **models directly**, not controllers. They won't break.

### Current State (7 controllers, 177 functions)

```
backend/controllers/
├── frameInventoryController.js        (478 lines, 20 functions)
├── contactLensInventoryController.js  (462 lines, 23 functions)
├── reagentInventoryController.js      (445 lines, 23 functions)
├── labConsumableInventoryController.js (438 lines, 22 functions)
├── opticalLensInventoryController.js  (451 lines, 19 functions)
├── surgicalSupplyInventoryController.js (429 lines, 23 functions)
└── pharmacyController.js              (partial overlap, 27 inventory functions)
```

### Target State (1 factory + 7 thin wrappers)

```
backend/controllers/inventory/
├── index.js                           (factory export)
├── InventoryControllerFactory.js      (shared logic ~400 lines)
├── frameInventory.js                  (type-specific ~50 lines)
├── contactLensInventory.js            (type-specific ~50 lines)
├── reagentInventory.js                (type-specific ~60 lines)
├── labConsumableInventory.js          (type-specific ~40 lines)
├── opticalLensInventory.js            (type-specific ~50 lines)
└── surgicalSupplyInventory.js         (type-specific ~40 lines)
```

### Implementation Steps

#### Step 1.1: Create Base Factory

```javascript
// backend/controllers/inventory/InventoryControllerFactory.js

const asyncHandler = require('express-async-handler');

class InventoryControllerFactory {
  constructor(Model, options = {}) {
    this.Model = Model;
    this.options = {
      searchFields: ['name', 'sku', 'barcode'],
      defaultSort: { name: 1 },
      populateFields: [],
      ...options
    };
  }

  // Standard CRUD operations
  getAll = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search, status, category, clinic, sortBy, sortOrder } = req.query;
    const query = { isActive: { $ne: false } };

    // Multi-clinic support
    if (req.user.clinicId && !req.user.isCentralAdmin) {
      query.clinic = req.user.clinicId;
    } else if (clinic) {
      query.clinic = clinic;
    }

    // Search across configured fields
    if (search) {
      query.$or = this.options.searchFields.map(field => ({
        [field]: { $regex: search, $options: 'i' }
      }));
    }

    // Status filter
    if (status) {
      if (status === 'low_stock') {
        query.$expr = { $lte: ['$currentStock', '$reorderPoint'] };
      } else if (status === 'out_of_stock') {
        query.currentStock = 0;
      }
    }

    // Category filter (type-specific)
    if (category) {
      query.category = category;
    }

    // Sorting
    const sort = {};
    if (sortBy) {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    } else {
      Object.assign(sort, this.options.defaultSort);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let queryBuilder = this.Model.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Apply population
    if (this.options.populateFields.length > 0) {
      this.options.populateFields.forEach(field => {
        queryBuilder = queryBuilder.populate(field);
      });
    }

    const [items, total] = await Promise.all([
      queryBuilder,
      this.Model.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  });

  getById = asyncHandler(async (req, res) => {
    const item = await this.Model.findById(req.params.id);
    if (!item) {
      res.status(404);
      throw new Error('Item not found');
    }
    res.json({ success: true, data: item });
  });

  create = asyncHandler(async (req, res) => {
    const data = { ...req.body };

    // Auto-assign clinic if not central admin
    if (req.user.clinicId && !data.clinic) {
      data.clinic = req.user.clinicId;
    }

    data.createdBy = req.user._id;

    const item = await this.Model.create(data);
    res.status(201).json({ success: true, data: item });
  });

  update = asyncHandler(async (req, res) => {
    const item = await this.Model.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!item) {
      res.status(404);
      throw new Error('Item not found');
    }
    res.json({ success: true, data: item });
  });

  delete = asyncHandler(async (req, res) => {
    const item = await this.Model.findByIdAndUpdate(
      req.params.id,
      { isActive: false, deletedBy: req.user._id, deletedAt: new Date() },
      { new: true }
    );
    if (!item) {
      res.status(404);
      throw new Error('Item not found');
    }
    res.json({ success: true, message: 'Item deleted' });
  });

  // Stock management operations
  adjustStock = asyncHandler(async (req, res) => {
    const { quantity, reason, reference, type = 'adjustment' } = req.body;

    const item = await this.Model.findById(req.params.id);
    if (!item) {
      res.status(404);
      throw new Error('Item not found');
    }

    const previousStock = item.currentStock;
    item.currentStock += quantity;

    // Prevent negative stock unless configured
    if (item.currentStock < 0 && !this.options.allowNegativeStock) {
      res.status(400);
      throw new Error('Insufficient stock');
    }

    // Add to stock history
    if (!item.stockHistory) item.stockHistory = [];
    item.stockHistory.push({
      type,
      quantity,
      previousStock,
      newStock: item.currentStock,
      reason,
      reference,
      performedBy: req.user._id,
      performedAt: new Date()
    });

    await item.save();
    res.json({ success: true, data: item });
  });

  getLowStock = asyncHandler(async (req, res) => {
    const query = {
      isActive: { $ne: false },
      $expr: { $lte: ['$currentStock', '$reorderPoint'] }
    };

    if (req.user.clinicId && !req.user.isCentralAdmin) {
      query.clinic = req.user.clinicId;
    }

    const items = await this.Model.find(query).sort({ currentStock: 1 });
    res.json({ success: true, data: items });
  });

  getStats = asyncHandler(async (req, res) => {
    const matchStage = { isActive: { $ne: false } };

    if (req.user.clinicId && !req.user.isCentralAdmin) {
      matchStage.clinic = req.user.clinicId;
    }

    const stats = await this.Model.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$currentStock', '$unitCost'] } },
          lowStockCount: {
            $sum: { $cond: [{ $lte: ['$currentStock', '$reorderPoint'] }, 1, 0] }
          },
          outOfStockCount: {
            $sum: { $cond: [{ $eq: ['$currentStock', 0] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({ success: true, data: stats[0] || {} });
  });

  // Batch operations
  batchUpdate = asyncHandler(async (req, res) => {
    const { items } = req.body;

    const results = await Promise.all(
      items.map(item =>
        this.Model.findByIdAndUpdate(
          item._id,
          { ...item, updatedBy: req.user._id },
          { new: true }
        )
      )
    );

    res.json({ success: true, data: results });
  });

  // Export to controller object
  toController() {
    return {
      getAll: this.getAll,
      getById: this.getById,
      create: this.create,
      update: this.update,
      delete: this.delete,
      adjustStock: this.adjustStock,
      getLowStock: this.getLowStock,
      getStats: this.getStats,
      batchUpdate: this.batchUpdate
    };
  }
}

module.exports = InventoryControllerFactory;
```

#### Step 1.2: Create Type-Specific Extensions

```javascript
// backend/controllers/inventory/frameInventory.js

const InventoryControllerFactory = require('./InventoryControllerFactory');
const FrameInventory = require('../../models/FrameInventory');
const asyncHandler = require('express-async-handler');

const factory = new InventoryControllerFactory(FrameInventory, {
  searchFields: ['name', 'sku', 'barcode', 'brand', 'model'],
  populateFields: ['supplier', 'clinic'],
  defaultSort: { brand: 1, model: 1 }
});

// Frame-specific: Virtual try-on photos
const getTryOnPhotos = asyncHandler(async (req, res) => {
  const frame = await FrameInventory.findById(req.params.id)
    .populate('tryOnPhotos');

  if (!frame) {
    res.status(404);
    throw new Error('Frame not found');
  }

  res.json({ success: true, data: frame.tryOnPhotos || [] });
});

// Frame-specific: Filter by specifications
const getBySpecifications = asyncHandler(async (req, res) => {
  const { frameWidth, bridgeWidth, templeLength, frameType, material } = req.query;

  const query = { isActive: { $ne: false } };

  if (frameWidth) query['specifications.frameWidth'] = { $gte: frameWidth - 2, $lte: frameWidth + 2 };
  if (bridgeWidth) query['specifications.bridgeWidth'] = { $gte: bridgeWidth - 1, $lte: bridgeWidth + 1 };
  if (templeLength) query['specifications.templeLength'] = templeLength;
  if (frameType) query.frameType = frameType;
  if (material) query.material = material;

  const frames = await FrameInventory.find(query);
  res.json({ success: true, data: frames });
});

module.exports = {
  ...factory.toController(),
  getTryOnPhotos,
  getBySpecifications
};
```

```javascript
// backend/controllers/inventory/reagentInventory.js

const InventoryControllerFactory = require('./InventoryControllerFactory');
const ReagentInventory = require('../../models/ReagentInventory');
const asyncHandler = require('express-async-handler');

const factory = new InventoryControllerFactory(ReagentInventory, {
  searchFields: ['name', 'sku', 'catalogNumber', 'manufacturer'],
  populateFields: ['analyzer', 'clinic'],
  defaultSort: { expiryDate: 1 }
});

// Reagent-specific: Expiry tracking
const getExpiringSoon = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const expiryThreshold = new Date();
  expiryThreshold.setDate(expiryThreshold.getDate() + parseInt(days));

  const query = {
    isActive: { $ne: false },
    expiryDate: { $lte: expiryThreshold, $gte: new Date() }
  };

  if (req.user.clinicId) {
    query.clinic = req.user.clinicId;
  }

  const reagents = await ReagentInventory.find(query)
    .sort({ expiryDate: 1 })
    .populate('analyzer');

  res.json({ success: true, data: reagents });
});

// Reagent-specific: Cold chain validation
const validateColdChain = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { temperature, recordedAt } = req.body;

  const reagent = await ReagentInventory.findById(id);
  if (!reagent) {
    res.status(404);
    throw new Error('Reagent not found');
  }

  const isValid = temperature >= reagent.storageTemp.min &&
                  temperature <= reagent.storageTemp.max;

  if (!reagent.coldChainLog) reagent.coldChainLog = [];
  reagent.coldChainLog.push({
    temperature,
    recordedAt: recordedAt || new Date(),
    isValid,
    recordedBy: req.user._id
  });

  if (!isValid) {
    reagent.coldChainBreached = true;
  }

  await reagent.save();
  res.json({ success: true, data: reagent, isValid });
});

// Reagent-specific: Lot tracking
const getByLot = asyncHandler(async (req, res) => {
  const { lotNumber } = req.params;

  const reagents = await ReagentInventory.find({
    lotNumber,
    isActive: { $ne: false }
  }).populate('analyzer');

  res.json({ success: true, data: reagents });
});

module.exports = {
  ...factory.toController(),
  getExpiringSoon,
  validateColdChain,
  getByLot
};
```

#### Step 1.3: Update Routes (Minimal Changes)

```javascript
// backend/routes/frameInventory.js (updated)

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const controller = require('../controllers/inventory/frameInventory');

router.use(protect);

router.route('/')
  .get(controller.getAll)
  .post(authorize('admin', 'inventory_manager'), controller.create);

router.get('/low-stock', controller.getLowStock);
router.get('/stats', controller.getStats);
router.get('/specifications', controller.getBySpecifications);

router.route('/:id')
  .get(controller.getById)
  .put(authorize('admin', 'inventory_manager'), controller.update)
  .delete(authorize('admin'), controller.delete);

router.post('/:id/adjust-stock', authorize('admin', 'inventory_manager'), controller.adjustStock);
router.get('/:id/try-on-photos', controller.getTryOnPhotos);

module.exports = router;
```

#### Step 1.4: Update Cross-Clinic Controller

The `crossClinicInventoryController.js` aggregates ALL inventory types. Update to use new factory:

```javascript
// backend/controllers/crossClinicInventoryController.js (updated imports)

const inventoryModels = {
  frame: require('../models/FrameInventory'),
  contactLens: require('../models/ContactLensInventory'),
  opticalLens: require('../models/OpticalLensInventory'),
  reagent: require('../models/ReagentInventory'),
  labConsumable: require('../models/LabConsumableInventory'),
  surgicalSupply: require('../models/SurgicalSupplyInventory'),
  pharmacy: require('../models/PharmacyInventory')
};

// Rest of controller remains unchanged - it queries models directly
```

### Phase 1 Verification Checklist

- [ ] All 7 inventory types return same data shape
- [ ] Stock adjustments create history entries
- [ ] Low stock alerts work for all types
- [ ] Cross-clinic queries aggregate correctly
- [ ] Inventory transfers work between clinics
- [ ] Clinic-scoped queries filter correctly
- [ ] Central admin sees all clinics
- [ ] Barcode scanning works
- [ ] Batch updates work

### Rollback Plan

Keep original controllers as `.backup` files for 2 weeks:
```bash
mv frameInventoryController.js frameInventoryController.js.backup
```

---

## Phase 2: Billing Controller Split

### ⚠️ CRITICAL DEPENDENCY DISCOVERED (Post Impact Analysis)

**Original Estimate**: 3-4 days
**Revised Estimate**: 5-6 days

**BREAKING CHANGE RISK**: `/backend/routes/invoices.js` imports 5 functions from billingController:
```javascript
// Line 32 in invoices.js
const { getPayments, applyDiscount, writeOff, generateInvoicePDF, generateReceiptPDF }
  = require('../controllers/billingController');
```

**These routes will break if split incorrectly:**
- `GET /api/invoices/payments`
- `POST /api/invoices/:id/apply-discount`
- `POST /api/invoices/:id/write-off`
- `GET /api/invoices/:id/pdf`
- `GET /api/invoices/:id/receipt/:paymentIndex`

**Transaction wrappers must remain accessible:**
```javascript
const { atomicMultiInvoicePayment, atomicRefund, withTransaction }
  = require('../utils/transactions');
```
Used in `allocatePaymentToInvoices()` and `processRefund()`.

**32 audit logging operations must be preserved** (CREATE_FEE_ITEM, DISCOUNT_APPLY, WRITE_OFF, etc.)

### Current State (1 mega-controller)

```
backend/controllers/billingController.js - 4,657 lines, 85 functions
backend/controllers/invoiceController.js - 2,528 lines, 25 functions (overlapping)
```

### Target State (5 focused controllers)

```
backend/controllers/billing/
├── index.js                    (exports all)
├── paymentController.js        (~600 lines) - Payment processing
├── invoiceController.js        (~800 lines) - Invoice CRUD + generation
├── conventionController.js     (~700 lines) - Insurance/convention billing
├── reportingController.js      (~500 lines) - Financial reports
└── refundController.js         (~400 lines) - Refunds + adjustments
```

### Critical Paths to Preserve

1. **Payment Processing Chain**:
   ```
   createPayment → updateInvoicePaymentStatus → createReceipt →
   triggerSurgeryAutoCreation → sendPaymentNotification
   ```

2. **Convention Billing Chain**:
   ```
   calculateConventionAmount → applyConventionRules →
   splitPatientVsConvention → createApprovalRequest
   ```

3. **Multi-Currency Chain**:
   ```
   acceptPayment → convertCurrency → recordExchangeRate →
   updateBalances
   ```

### Implementation Steps

#### Step 2.0: Update invoices.js Imports FIRST (CRITICAL)

**Before ANY split, update `/backend/routes/invoices.js` to use the new module structure:**

```javascript
// backend/routes/invoices.js (updated imports)
// OLD:
// const { getPayments, applyDiscount, writeOff, generateInvoicePDF, generateReceiptPDF }
//   = require('../controllers/billingController');

// NEW:
const { getPayments, applyDiscount, writeOff } = require('../controllers/billing/paymentController');
const { generateInvoicePDF, generateReceiptPDF } = require('../controllers/billing/invoiceController');
```

**Or use the unified export:**
```javascript
const billing = require('../controllers/billing');
// Routes use: billing.getPayments, billing.applyDiscount, etc.
```

**Test that all 5 routes still work after this change before proceeding.**

#### Step 2.1: Extract Payment Controller

```javascript
// backend/controllers/billing/paymentController.js

const asyncHandler = require('express-async-handler');
const Invoice = require('../../models/Invoice');
const Payment = require('../../models/Payment');
const SurgeryCase = require('../../models/SurgeryCase');
const { currencyService } = require('../../services/currencyService');
const websocketService = require('../../services/websocketService');

// Payment processing
exports.createPayment = asyncHandler(async (req, res) => {
  const { invoiceId, amount, method, currency, reference, exchangeRate } = req.body;

  const invoice = await Invoice.findById(invoiceId).populate('patient');
  if (!invoice) {
    res.status(404);
    throw new Error('Invoice not found');
  }

  // Multi-currency handling
  let finalAmount = amount;
  let usedExchangeRate = null;

  if (currency && currency !== invoice.currency) {
    const conversion = await currencyService.convert(amount, currency, invoice.currency);
    finalAmount = conversion.amount;
    usedExchangeRate = exchangeRate || conversion.rate;
  }

  // Create payment record
  const payment = await Payment.create({
    invoice: invoiceId,
    patient: invoice.patient._id,
    amount: finalAmount,
    originalAmount: amount,
    originalCurrency: currency,
    exchangeRate: usedExchangeRate,
    method,
    reference,
    processedBy: req.user._id,
    clinic: req.user.clinicId
  });

  // Update invoice
  invoice.amountPaid += finalAmount;
  invoice.payments.push(payment._id);

  if (invoice.amountPaid >= invoice.totalAmount) {
    invoice.status = 'paid';
    invoice.paidAt = new Date();

    // Trigger surgery auto-creation if applicable
    await this._checkSurgeryAutoCreation(invoice);
  } else {
    invoice.status = 'partial';
  }

  await invoice.save();

  // Real-time notification
  websocketService.emit('payment:created', {
    invoiceId,
    patientId: invoice.patient._id,
    amount: finalAmount,
    status: invoice.status
  });

  res.status(201).json({ success: true, data: payment, invoice });
});

// Internal: Auto-create surgery case when surgery invoice is paid
exports._checkSurgeryAutoCreation = async (invoice) => {
  if (invoice.category !== 'surgery' || invoice.status !== 'paid') return;

  const existingCase = await SurgeryCase.findOne({ invoice: invoice._id });
  if (existingCase) return;

  // Extract surgery details from invoice items
  const surgeryItem = invoice.items.find(i => i.category === 'surgery');
  if (!surgeryItem) return;

  await SurgeryCase.create({
    patient: invoice.patient,
    invoice: invoice._id,
    procedure: surgeryItem.service,
    scheduledDate: invoice.surgeryDate,
    status: 'scheduled',
    createdBy: invoice.createdBy,
    clinic: invoice.clinic
  });
};

exports.getPaymentHistory = asyncHandler(async (req, res) => {
  const { patientId, invoiceId, startDate, endDate, method } = req.query;

  const query = {};
  if (patientId) query.patient = patientId;
  if (invoiceId) query.invoice = invoiceId;
  if (method) query.method = method;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const payments = await Payment.find(query)
    .populate('invoice', 'invoiceNumber totalAmount')
    .populate('patient', 'firstName lastName')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: payments });
});

exports.voidPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const payment = await Payment.findById(id);
  if (!payment) {
    res.status(404);
    throw new Error('Payment not found');
  }

  if (payment.voided) {
    res.status(400);
    throw new Error('Payment already voided');
  }

  // Reverse the payment
  const invoice = await Invoice.findById(payment.invoice);
  invoice.amountPaid -= payment.amount;
  invoice.status = invoice.amountPaid > 0 ? 'partial' : 'pending';

  payment.voided = true;
  payment.voidedAt = new Date();
  payment.voidedBy = req.user._id;
  payment.voidReason = reason;

  await Promise.all([payment.save(), invoice.save()]);

  res.json({ success: true, data: payment });
});
```

#### Step 2.2: Extract Convention Controller

```javascript
// backend/controllers/billing/conventionController.js

const asyncHandler = require('express-async-handler');
const Invoice = require('../../models/Invoice');
const ConventionFeeSchedule = require('../../models/ConventionFeeSchedule');
const Approval = require('../../models/Approval');
const Patient = require('../../models/Patient');

// Calculate convention coverage
exports.calculateConventionCoverage = asyncHandler(async (req, res) => {
  const { patientId, items, conventionId } = req.body;

  const patient = await Patient.findById(patientId).populate('convention');
  if (!patient) {
    res.status(404);
    throw new Error('Patient not found');
  }

  const convention = conventionId
    ? await ConventionFeeSchedule.findById(conventionId)
    : patient.convention;

  if (!convention) {
    return res.json({
      success: true,
      data: {
        conventionAmount: 0,
        patientAmount: items.reduce((sum, i) => sum + i.amount, 0),
        coverage: null
      }
    });
  }

  // Apply convention rules to each item
  const calculatedItems = await Promise.all(items.map(async (item) => {
    const rule = convention.rules.find(r =>
      r.serviceCode === item.serviceCode ||
      r.category === item.category
    );

    if (!rule) {
      return { ...item, conventionAmount: 0, patientAmount: item.amount };
    }

    let conventionAmount;
    if (rule.coverageType === 'percentage') {
      conventionAmount = item.amount * (rule.coveragePercentage / 100);
    } else if (rule.coverageType === 'fixed') {
      conventionAmount = Math.min(rule.fixedAmount, item.amount);
    } else {
      conventionAmount = 0;
    }

    // Apply caps
    if (rule.maxCoverage) {
      conventionAmount = Math.min(conventionAmount, rule.maxCoverage);
    }

    return {
      ...item,
      conventionAmount,
      patientAmount: item.amount - conventionAmount,
      ruleApplied: rule._id
    };
  }));

  const totals = calculatedItems.reduce((acc, item) => ({
    conventionAmount: acc.conventionAmount + item.conventionAmount,
    patientAmount: acc.patientAmount + item.patientAmount
  }), { conventionAmount: 0, patientAmount: 0 });

  res.json({
    success: true,
    data: {
      items: calculatedItems,
      ...totals,
      convention: convention._id,
      conventionName: convention.name
    }
  });
});

// Create convention invoice (requires approval)
exports.createConventionInvoice = asyncHandler(async (req, res) => {
  const { patientId, items, conventionCoverage } = req.body;

  // Validate convention coverage was calculated
  if (!conventionCoverage || conventionCoverage.conventionAmount <= 0) {
    res.status(400);
    throw new Error('No convention coverage applicable');
  }

  // Create invoice with pending approval status
  const invoice = await Invoice.create({
    patient: patientId,
    items,
    totalAmount: conventionCoverage.patientAmount + conventionCoverage.conventionAmount,
    patientAmount: conventionCoverage.patientAmount,
    conventionAmount: conventionCoverage.conventionAmount,
    convention: conventionCoverage.convention,
    status: 'pending_approval',
    requiresApproval: true,
    clinic: req.user.clinicId,
    createdBy: req.user._id
  });

  // Create approval request
  const approval = await Approval.create({
    invoice: invoice._id,
    patient: patientId,
    convention: conventionCoverage.convention,
    requestedAmount: conventionCoverage.conventionAmount,
    items: items.map(i => ({
      description: i.description,
      amount: i.conventionAmount,
      serviceCode: i.serviceCode
    })),
    status: 'pending',
    requestedBy: req.user._id,
    clinic: req.user.clinicId
  });

  invoice.approval = approval._id;
  await invoice.save();

  res.status(201).json({ success: true, data: { invoice, approval } });
});

// Process approval decision
exports.processApprovalDecision = asyncHandler(async (req, res) => {
  const { approvalId } = req.params;
  const { decision, approvedAmount, notes, rejectionReason } = req.body;

  const approval = await Approval.findById(approvalId).populate('invoice');
  if (!approval) {
    res.status(404);
    throw new Error('Approval not found');
  }

  approval.status = decision; // 'approved', 'rejected', 'partial'
  approval.decidedBy = req.user._id;
  approval.decidedAt = new Date();
  approval.notes = notes;

  if (decision === 'approved') {
    approval.approvedAmount = approval.requestedAmount;
  } else if (decision === 'partial') {
    approval.approvedAmount = approvedAmount;
  } else {
    approval.approvedAmount = 0;
    approval.rejectionReason = rejectionReason;
  }

  await approval.save();

  // Update invoice
  const invoice = approval.invoice;
  invoice.conventionAmount = approval.approvedAmount;
  invoice.patientAmount = invoice.totalAmount - approval.approvedAmount;
  invoice.status = decision === 'rejected' ? 'pending' : 'approved';
  invoice.requiresApproval = false;

  await invoice.save();

  res.json({ success: true, data: { approval, invoice } });
});

// Get pending approvals
exports.getPendingApprovals = asyncHandler(async (req, res) => {
  const { convention, clinic } = req.query;

  const query = { status: 'pending' };
  if (convention) query.convention = convention;
  if (clinic) query.clinic = clinic;

  const approvals = await Approval.find(query)
    .populate('patient', 'firstName lastName conventionNumber')
    .populate('invoice', 'invoiceNumber totalAmount')
    .populate('convention', 'name')
    .sort({ createdAt: 1 });

  res.json({ success: true, data: approvals });
});
```

#### Step 2.3: Extract Reporting Controller

```javascript
// backend/controllers/billing/reportingController.js

const asyncHandler = require('express-async-handler');
const Invoice = require('../../models/Invoice');
const Payment = require('../../models/Payment');

exports.getDailyReport = asyncHandler(async (req, res) => {
  const { date, clinic } = req.query;
  const targetDate = date ? new Date(date) : new Date();

  const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

  const matchStage = {
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  };

  if (clinic) {
    matchStage.clinic = clinic;
  } else if (req.user.clinicId && !req.user.isCentralAdmin) {
    matchStage.clinic = req.user.clinicId;
  }

  const [invoiceStats, paymentStats] = await Promise.all([
    Invoice.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$totalAmount' }
        }
      }
    ]),
    Payment.aggregate([
      { $match: { ...matchStage, voided: { $ne: true } } },
      {
        $group: {
          _id: '$method',
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      }
    ])
  ]);

  res.json({
    success: true,
    data: {
      date: startOfDay,
      invoices: invoiceStats,
      payments: paymentStats,
      summary: {
        totalInvoiced: invoiceStats.reduce((sum, s) => sum + s.total, 0),
        totalCollected: paymentStats.reduce((sum, s) => sum + s.total, 0)
      }
    }
  });
});

exports.getRevenueByCategory = asyncHandler(async (req, res) => {
  const { startDate, endDate, clinic } = req.query;

  const matchStage = {
    status: { $in: ['paid', 'partial'] }
  };

  if (startDate) matchStage.createdAt = { $gte: new Date(startDate) };
  if (endDate) matchStage.createdAt = { ...matchStage.createdAt, $lte: new Date(endDate) };
  if (clinic) matchStage.clinic = clinic;

  const revenue = await Invoice.aggregate([
    { $match: matchStage },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.category',
        count: { $sum: 1 },
        revenue: { $sum: '$items.amount' }
      }
    },
    { $sort: { revenue: -1 } }
  ]);

  res.json({ success: true, data: revenue });
});

exports.getOutstandingBalances = asyncHandler(async (req, res) => {
  const { clinic, minAge } = req.query;

  const matchStage = {
    status: { $in: ['pending', 'partial'] },
    $expr: { $gt: [{ $subtract: ['$totalAmount', '$amountPaid'] }, 0] }
  };

  if (clinic) matchStage.clinic = clinic;

  if (minAge) {
    const ageThreshold = new Date();
    ageThreshold.setDate(ageThreshold.getDate() - parseInt(minAge));
    matchStage.createdAt = { $lte: ageThreshold };
  }

  const outstanding = await Invoice.find(matchStage)
    .populate('patient', 'firstName lastName phone email')
    .select('invoiceNumber totalAmount amountPaid createdAt patient')
    .sort({ createdAt: 1 });

  const totalOutstanding = outstanding.reduce(
    (sum, inv) => sum + (inv.totalAmount - inv.amountPaid),
    0
  );

  res.json({
    success: true,
    data: {
      invoices: outstanding,
      total: totalOutstanding,
      count: outstanding.length
    }
  });
});

exports.getConventionSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate, convention } = req.query;

  const matchStage = {
    convention: { $exists: true, $ne: null },
    status: { $in: ['paid', 'partial', 'approved'] }
  };

  if (startDate) matchStage.createdAt = { $gte: new Date(startDate) };
  if (endDate) matchStage.createdAt = { ...matchStage.createdAt, $lte: new Date(endDate) };
  if (convention) matchStage.convention = convention;

  const summary = await Invoice.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$convention',
        invoiceCount: { $sum: 1 },
        totalBilled: { $sum: '$conventionAmount' },
        totalPaid: {
          $sum: {
            $cond: [
              { $eq: ['$status', 'paid'] },
              '$conventionAmount',
              0
            ]
          }
        },
        totalPending: {
          $sum: {
            $cond: [
              { $in: ['$status', ['partial', 'approved']] },
              '$conventionAmount',
              0
            ]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'conventionfeeschedules',
        localField: '_id',
        foreignField: '_id',
        as: 'conventionDetails'
      }
    },
    { $unwind: '$conventionDetails' },
    {
      $project: {
        conventionName: '$conventionDetails.name',
        invoiceCount: 1,
        totalBilled: 1,
        totalPaid: 1,
        totalPending: 1
      }
    }
  ]);

  res.json({ success: true, data: summary });
});
```

#### Step 2.4: Extract Refund Controller

```javascript
// backend/controllers/billing/refundController.js

const asyncHandler = require('express-async-handler');
const Invoice = require('../../models/Invoice');
const Payment = require('../../models/Payment');
const Refund = require('../../models/Refund');

exports.createRefund = asyncHandler(async (req, res) => {
  const { invoiceId, paymentId, amount, reason, method } = req.body;

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    res.status(404);
    throw new Error('Invoice not found');
  }

  // Validate refund amount
  const maxRefundable = invoice.amountPaid;
  if (amount > maxRefundable) {
    res.status(400);
    throw new Error(`Maximum refundable amount is ${maxRefundable}`);
  }

  // Create refund record
  const refund = await Refund.create({
    invoice: invoiceId,
    payment: paymentId,
    patient: invoice.patient,
    amount,
    reason,
    method: method || 'cash',
    processedBy: req.user._id,
    clinic: req.user.clinicId
  });

  // Update invoice
  invoice.amountPaid -= amount;
  invoice.refundedAmount = (invoice.refundedAmount || 0) + amount;

  if (invoice.amountPaid <= 0) {
    invoice.status = 'refunded';
  } else if (invoice.amountPaid < invoice.totalAmount) {
    invoice.status = 'partial';
  }

  await invoice.save();

  res.status(201).json({ success: true, data: refund });
});

exports.getRefunds = asyncHandler(async (req, res) => {
  const { patientId, startDate, endDate } = req.query;

  const query = {};
  if (patientId) query.patient = patientId;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  if (req.user.clinicId && !req.user.isCentralAdmin) {
    query.clinic = req.user.clinicId;
  }

  const refunds = await Refund.find(query)
    .populate('patient', 'firstName lastName')
    .populate('invoice', 'invoiceNumber')
    .populate('processedBy', 'name')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: refunds });
});

exports.voidRefund = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const refund = await Refund.findById(id);
  if (!refund) {
    res.status(404);
    throw new Error('Refund not found');
  }

  if (refund.voided) {
    res.status(400);
    throw new Error('Refund already voided');
  }

  // Reverse the refund
  const invoice = await Invoice.findById(refund.invoice);
  invoice.amountPaid += refund.amount;
  invoice.refundedAmount -= refund.amount;

  if (invoice.amountPaid >= invoice.totalAmount) {
    invoice.status = 'paid';
  } else if (invoice.amountPaid > 0) {
    invoice.status = 'partial';
  }

  refund.voided = true;
  refund.voidedAt = new Date();
  refund.voidedBy = req.user._id;
  refund.voidReason = reason;

  await Promise.all([refund.save(), invoice.save()]);

  res.json({ success: true, data: refund });
});
```

#### Step 2.5: Create Unified Export

```javascript
// backend/controllers/billing/index.js

const paymentController = require('./paymentController');
const invoiceController = require('./invoiceController');
const conventionController = require('./conventionController');
const reportingController = require('./reportingController');
const refundController = require('./refundController');

module.exports = {
  // Payment
  createPayment: paymentController.createPayment,
  getPaymentHistory: paymentController.getPaymentHistory,
  voidPayment: paymentController.voidPayment,

  // Invoice (existing invoiceController functions)
  ...invoiceController,

  // Convention
  calculateConventionCoverage: conventionController.calculateConventionCoverage,
  createConventionInvoice: conventionController.createConventionInvoice,
  processApprovalDecision: conventionController.processApprovalDecision,
  getPendingApprovals: conventionController.getPendingApprovals,

  // Reporting
  getDailyReport: reportingController.getDailyReport,
  getRevenueByCategory: reportingController.getRevenueByCategory,
  getOutstandingBalances: reportingController.getOutstandingBalances,
  getConventionSummary: reportingController.getConventionSummary,

  // Refunds
  createRefund: refundController.createRefund,
  getRefunds: refundController.getRefunds,
  voidRefund: refundController.voidRefund
};
```

### Phase 2 Verification Checklist

- [ ] Payment creation triggers invoice status update
- [ ] Surgery case auto-creation fires on paid surgery invoice
- [ ] Convention coverage calculation matches existing logic
- [ ] Approval workflow creates/updates approval records
- [ ] Multi-currency payments convert correctly
- [ ] Refunds properly reverse payment amounts
- [ ] Daily reports aggregate correctly
- [ ] Outstanding balances filter by age
- [ ] Convention summary groups by insurance provider
- [ ] All existing API routes still work

### Rollback Plan

1. Keep `billingController.js` and `invoiceController.js` as backups
2. Routes can quickly switch back to original controllers
3. Database schema unchanged - no migration needed

---

## Phase 3: Notification Services Consolidation

### ⚠️ INCOMPLETE CALLER MAPPING (Post Impact Analysis)

**Original Estimate**: Just merge 4 services
**Revised Scope**: Merge 4 services + update 14 direct callers + update 2 schedulers

**14 files directly call sendEmail utility** (bypassing notification services):
1. appointmentController.js (2 locations)
2. authController.js (2 locations)
3. queueController.js
4. userController.js
5. reminderScheduler.js
6. invoiceReminderScheduler.js
7. auditLogger.js
8. glassesOrderController.js
9. backupScheduler.js
10. ivtController.js
11. labOrderController.js
12. pharmacyController.js
13. surgeryController.js
14. patientController.js

**Scheduled jobs bypass notification services entirely:**
- `reminderScheduler` calls `sendEmail()` directly
- `invoiceReminderScheduler` calls `sendEmail()` directly
- These won't use the new unified service unless explicitly updated

**WebSocket notifications are separate:**
- `websocketService.sendNotificationToUser()`
- `websocketService.sendNotificationToRole()`
- NOT integrated with notification services - need to be connected

### Current State (4 overlapping services)

```
backend/services/
├── notificationService.js         (in-app notifications)
├── enhancedNotificationService.js (SMS + push + email)
├── emailQueueService.js           (queued email delivery)
└── (sendEmail in utils/)          (direct email - 14 direct callers!)
```

### Target State (1 unified service)

```
backend/services/notification/
├── index.js                       (unified export)
├── NotificationService.js         (core orchestrator)
├── channels/
│   ├── EmailChannel.js            (email delivery)
│   ├── SmsChannel.js              (SMS delivery)
│   ├── PushChannel.js             (push notifications)
│   └── InAppChannel.js            (in-app + WebSocket)
└── templates/
    └── TemplateEngine.js          (message templating)
```

### Implementation Steps

#### Step 3.1: Create Unified Notification Service

```javascript
// backend/services/notification/NotificationService.js

const EmailChannel = require('./channels/EmailChannel');
const SmsChannel = require('./channels/SmsChannel');
const PushChannel = require('./channels/PushChannel');
const InAppChannel = require('./channels/InAppChannel');
const TemplateEngine = require('./templates/TemplateEngine');

class NotificationService {
  constructor() {
    this.channels = {
      email: new EmailChannel(),
      sms: new SmsChannel(),
      push: new PushChannel(),
      inApp: new InAppChannel()
    };
    this.templateEngine = new TemplateEngine();
  }

  /**
   * Send notification through specified channels
   * @param {Object} options
   * @param {string} options.type - Notification type (appointment_reminder, payment_received, etc.)
   * @param {Object} options.recipient - { userId, email, phone, pushToken }
   * @param {Object} options.data - Template variables
   * @param {string[]} options.channels - ['email', 'sms', 'push', 'inApp']
   * @param {Object} options.options - Channel-specific options
   */
  async send({ type, recipient, data, channels = ['inApp'], options = {} }) {
    const template = await this.templateEngine.getTemplate(type);
    const results = {};

    for (const channelName of channels) {
      const channel = this.channels[channelName];
      if (!channel) {
        results[channelName] = { success: false, error: 'Channel not found' };
        continue;
      }

      try {
        const message = this.templateEngine.render(template, channelName, data);
        const result = await channel.send(recipient, message, options[channelName] || {});
        results[channelName] = { success: true, ...result };
      } catch (error) {
        results[channelName] = { success: false, error: error.message };
        console.error(`Notification failed on ${channelName}:`, error);
      }
    }

    return results;
  }

  // Convenience methods for common notifications
  async sendAppointmentReminder(appointment, patient) {
    return this.send({
      type: 'appointment_reminder',
      recipient: {
        userId: patient._id,
        email: patient.email,
        phone: patient.phone
      },
      data: {
        patientName: `${patient.firstName} ${patient.lastName}`,
        appointmentDate: appointment.date,
        appointmentTime: appointment.time,
        doctorName: appointment.doctor?.name,
        location: appointment.clinic?.name
      },
      channels: patient.notificationPreferences || ['email', 'sms', 'inApp']
    });
  }

  async sendPaymentReceipt(payment, invoice, patient) {
    return this.send({
      type: 'payment_receipt',
      recipient: {
        userId: patient._id,
        email: patient.email
      },
      data: {
        patientName: `${patient.firstName} ${patient.lastName}`,
        invoiceNumber: invoice.invoiceNumber,
        amountPaid: payment.amount,
        paymentMethod: payment.method,
        remainingBalance: invoice.totalAmount - invoice.amountPaid
      },
      channels: ['email', 'inApp']
    });
  }

  async sendLabResultsReady(labOrder, patient) {
    return this.send({
      type: 'lab_results_ready',
      recipient: {
        userId: patient._id,
        email: patient.email,
        phone: patient.phone
      },
      data: {
        patientName: `${patient.firstName} ${patient.lastName}`,
        testNames: labOrder.tests.map(t => t.name).join(', '),
        orderId: labOrder.orderNumber
      },
      channels: ['email', 'sms', 'inApp']
    });
  }

  async sendCriticalLabAlert(labResult, patient, staff) {
    // Critical alerts go to staff, not patient
    return this.send({
      type: 'critical_lab_value',
      recipient: {
        userId: staff._id,
        email: staff.email,
        phone: staff.phone
      },
      data: {
        patientName: `${patient.firstName} ${patient.lastName}`,
        testName: labResult.testName,
        value: labResult.value,
        referenceRange: labResult.referenceRange,
        urgency: 'CRITICAL'
      },
      channels: ['email', 'sms', 'push', 'inApp'],
      options: {
        push: { priority: 'high', sound: 'critical' },
        sms: { priority: 'high' }
      }
    });
  }

  async sendPrescriptionReady(prescription, patient) {
    return this.send({
      type: 'prescription_ready',
      recipient: {
        userId: patient._id,
        email: patient.email,
        phone: patient.phone
      },
      data: {
        patientName: `${patient.firstName} ${patient.lastName}`,
        prescriptionId: prescription._id,
        pharmacyName: prescription.pharmacy?.name
      },
      channels: ['sms', 'inApp']
    });
  }

  async sendLowStockAlert(inventory, staff) {
    return this.send({
      type: 'low_stock_alert',
      recipient: {
        userId: staff._id,
        email: staff.email
      },
      data: {
        itemName: inventory.name,
        currentStock: inventory.currentStock,
        reorderPoint: inventory.reorderPoint,
        sku: inventory.sku
      },
      channels: ['email', 'inApp']
    });
  }

  // Queue notification for batch processing
  async queue(notification) {
    // Uses email queue for deferred delivery
    return this.channels.email.queue(notification);
  }

  // Get notification history for a user
  async getHistory(userId, options = {}) {
    return this.channels.inApp.getHistory(userId, options);
  }

  // Mark notifications as read
  async markAsRead(userId, notificationIds) {
    return this.channels.inApp.markAsRead(userId, notificationIds);
  }
}

module.exports = new NotificationService();
```

#### Step 3.2: Create Channel Implementations

```javascript
// backend/services/notification/channels/EmailChannel.js

const nodemailer = require('nodemailer');
const EmailQueue = require('../../../models/EmailQueue');

class EmailChannel {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async send(recipient, message, options = {}) {
    if (!recipient.email) {
      throw new Error('No email address provided');
    }

    const mailOptions = {
      from: options.from || process.env.EMAIL_FROM,
      to: recipient.email,
      subject: message.subject,
      html: message.html,
      text: message.text
    };

    if (options.attachments) {
      mailOptions.attachments = options.attachments;
    }

    const result = await this.transporter.sendMail(mailOptions);
    return { messageId: result.messageId };
  }

  async queue(notification) {
    return EmailQueue.create({
      to: notification.recipient.email,
      subject: notification.message.subject,
      html: notification.message.html,
      text: notification.message.text,
      scheduledFor: notification.scheduledFor || new Date(),
      priority: notification.priority || 'normal',
      metadata: notification.metadata
    });
  }

  async processQueue() {
    const pendingEmails = await EmailQueue.find({
      status: 'pending',
      scheduledFor: { $lte: new Date() }
    }).limit(50);

    for (const email of pendingEmails) {
      try {
        await this.send(
          { email: email.to },
          { subject: email.subject, html: email.html, text: email.text }
        );
        email.status = 'sent';
        email.sentAt = new Date();
      } catch (error) {
        email.status = 'failed';
        email.error = error.message;
        email.attempts = (email.attempts || 0) + 1;

        // Retry logic
        if (email.attempts < 3) {
          email.status = 'pending';
          email.scheduledFor = new Date(Date.now() + email.attempts * 60000);
        }
      }
      await email.save();
    }
  }
}

module.exports = EmailChannel;
```

```javascript
// backend/services/notification/channels/InAppChannel.js

const Notification = require('../../../models/Notification');
const websocketService = require('../../websocketService');

class InAppChannel {
  async send(recipient, message, options = {}) {
    if (!recipient.userId) {
      throw new Error('No user ID provided');
    }

    const notification = await Notification.create({
      user: recipient.userId,
      title: message.title,
      body: message.body,
      type: message.type,
      data: message.data,
      priority: options.priority || 'normal',
      expiresAt: options.expiresAt
    });

    // Real-time delivery via WebSocket
    websocketService.emitToUser(recipient.userId, 'notification', {
      id: notification._id,
      title: message.title,
      body: message.body,
      type: message.type,
      createdAt: notification.createdAt
    });

    return { notificationId: notification._id };
  }

  async getHistory(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    const query = { user: userId };
    if (unreadOnly) {
      query.read = false;
    }

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Notification.countDocuments(query)
    ]);

    return { notifications, total, page, pages: Math.ceil(total / limit) };
  }

  async markAsRead(userId, notificationIds) {
    const query = { user: userId };
    if (notificationIds && notificationIds.length > 0) {
      query._id = { $in: notificationIds };
    }

    await Notification.updateMany(query, { read: true, readAt: new Date() });
    return { success: true };
  }

  async getUnreadCount(userId) {
    return Notification.countDocuments({ user: userId, read: false });
  }
}

module.exports = InAppChannel;
```

### Phase 3 Verification Checklist

- [ ] Appointment reminders send via configured channels
- [ ] Payment receipts deliver email + in-app
- [ ] Critical lab alerts use high priority push
- [ ] Email queue processes pending emails
- [ ] WebSocket real-time notifications work
- [ ] Notification history retrieves correctly
- [ ] Mark as read updates all specified notifications
- [ ] SMS delivery works (if configured)
- [ ] Template variables render correctly

### Rollback Plan

Original services preserved for 2 weeks. Routes can switch imports back instantly.

---

## Phase 4: Laboratory System Migration

### ⚠️ SIGNIFICANTLY MORE COMPLEX (Post Impact Analysis)

**Original Estimate**: HIGH risk, 4 weeks
**Revised Assessment**: **CRITICAL risk (9/10)**, 6-8 weeks

**CRITICAL ISSUE #1: Bidirectional sync hook exists**
```javascript
// LabOrder.post('save') hook - Line 664 of LabOrder.js
// Auto-syncs LabOrder.tests back to Visit.laboratoryOrders
```
This means:
- Data exists in BOTH places simultaneously
- Deleting one breaks the other
- Migration must handle this sync hook carefully

**CRITICAL ISSUE #2: Report generation reads ONLY from Visit**
```javascript
// laboratoryController.generateReport() - Line 469
// ONLY reads from Visit.laboratoryOrders
// Does NOT read from LabOrder model
```
**Labs created via `/api/lab-orders` CANNOT generate reports currently!** This must be fixed BEFORE migration.

**CRITICAL ISSUE #3: Different query patterns**
- `laboratoryController.getPendingTests()` queries BOTH Visit AND LabOrder
- `labOrderController.getPendingOrders()` queries ONLY LabOrder
- Inconsistent results depending on which endpoint you call

**Barcode collision detection has risk:**
- Uses timestamp + random (second precision)
- Checks BOTH Visit.specimens.barcode AND LabOrder.specimen.barcode
- Risk: If system clock resets, all barcodes become predictable

### Current State (Dual Architecture)

**Architecture A: Visit-Embedded Tests** (legacy, still used)
```javascript
// Visit.tests[] array
{
  tests: [{
    name: String,
    result: String,
    normalRange: String,
    status: String,
    performedBy: ObjectId
  }]
}
```

**Architecture B: Standalone LabOrder** (newer, preferred)
```javascript
// LabOrder collection
{
  orderNumber: String,
  patient: ObjectId,
  tests: [{
    template: ObjectId,  // References LaboratoryTemplate
    result: Mixed,
    validatedBy: ObjectId
  }],
  status: String
}
```

### Target State (Unified LabOrder)

All lab tests go through LabOrder. Visit.tests becomes a reference array.

### Migration Strategy (REVISED)

This is the **CRITICAL risk** phase. We use a gradual migration with additional pre-work:

1. **Week 1 (PRE-WORK)**: Fix report generation to read from LabOrder
2. **Week 2 (PRE-WORK)**: Create unified pending endpoint that queries both
3. **Week 3**: Create migration script, run in dry-run mode
4. **Week 4**: Migrate historical data (background job)
5. **Week 5**: Disable sync hook, update controllers to use LabOrder exclusively
6. **Week 6**: Remove Visit.tests write paths
7. **Week 7-8**: 2-week parallel operation with monitoring before final cutover

#### Step 4.1: Create Migration Script

```javascript
// backend/scripts/migrateVisitTestsToLabOrders.js

const mongoose = require('mongoose');
const Visit = require('../models/Visit');
const LabOrder = require('../models/LabOrder');
const LaboratoryTemplate = require('../models/LaboratoryTemplate');

const DRY_RUN = process.env.DRY_RUN === 'true';

async function migrateVisitTests() {
  console.log(`Starting migration (DRY_RUN: ${DRY_RUN})`);

  // Find visits with embedded tests that don't have corresponding LabOrders
  const visits = await Visit.find({
    'tests.0': { $exists: true }
  }).populate('patient');

  console.log(`Found ${visits.length} visits with embedded tests`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const visit of visits) {
    try {
      // Check if LabOrder already exists for this visit
      const existingOrder = await LabOrder.findOne({ visit: visit._id });
      if (existingOrder) {
        skipped++;
        continue;
      }

      // Map embedded tests to LabOrder format
      const tests = await Promise.all(visit.tests.map(async (test) => {
        // Try to find matching template
        const template = await LaboratoryTemplate.findOne({
          $or: [
            { name: test.name },
            { code: test.code },
            { aliases: test.name }
          ]
        });

        return {
          template: template?._id,
          name: test.name,
          result: test.result,
          unit: test.unit || template?.unit,
          referenceRange: test.normalRange || template?.referenceRange,
          status: test.status || 'completed',
          performedBy: test.performedBy,
          performedAt: test.performedAt || visit.createdAt,
          validatedBy: test.validatedBy,
          validatedAt: test.validatedAt,
          // Preserve original data
          _migratedFrom: 'visit.tests',
          _originalData: test
        };
      }));

      const labOrderData = {
        orderNumber: `MIG-${visit._id.toString().slice(-8).toUpperCase()}`,
        patient: visit.patient._id,
        visit: visit._id,
        clinic: visit.clinic,
        tests,
        status: visit.tests.every(t => t.status === 'completed') ? 'completed' : 'in_progress',
        orderedBy: visit.doctor,
        orderedAt: visit.createdAt,
        _migrated: true,
        _migratedAt: new Date()
      };

      if (!DRY_RUN) {
        await LabOrder.create(labOrderData);

        // Add reference to visit
        visit.labOrder = labOrderData._id;
        await visit.save();
      }

      migrated++;

      if (migrated % 100 === 0) {
        console.log(`Progress: ${migrated} migrated, ${skipped} skipped`);
      }
    } catch (error) {
      console.error(`Error migrating visit ${visit._id}:`, error.message);
      errors++;
    }
  }

  console.log('\n=== Migration Summary ===');
  console.log(`Total visits: ${visits.length}`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped (already had LabOrder): ${skipped}`);
  console.log(`Errors: ${errors}`);

  return { migrated, skipped, errors };
}

if (require.main === module) {
  require('dotenv').config();
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => migrateVisitTests())
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { migrateVisitTests };
```

#### Step 4.2: Update Laboratory Controller

```javascript
// backend/controllers/laboratoryController.js (updated)

const asyncHandler = require('express-async-handler');
const LabOrder = require('../models/LabOrder');
const Visit = require('../models/Visit');

// UNIFIED: Get pending tests (merges both sources during migration)
exports.getPendingTests = asyncHandler(async (req, res) => {
  const { clinic } = req.query;

  const matchStage = {
    status: { $in: ['ordered', 'in_progress', 'sample_collected'] }
  };

  if (clinic) {
    matchStage.clinic = clinic;
  } else if (req.user.clinicId) {
    matchStage.clinic = req.user.clinicId;
  }

  // Primary source: LabOrder collection
  const labOrders = await LabOrder.find(matchStage)
    .populate('patient', 'firstName lastName dateOfBirth')
    .populate('tests.template', 'name code category')
    .sort({ priority: -1, orderedAt: 1 });

  // Secondary source (legacy): Visit.tests that weren't migrated
  // This will be removed after migration is complete
  const INCLUDE_LEGACY = process.env.INCLUDE_LEGACY_TESTS !== 'false';

  let legacyTests = [];
  if (INCLUDE_LEGACY) {
    const visitsWithPendingTests = await Visit.find({
      'tests': { $elemMatch: { status: { $in: ['pending', 'ordered'] } } },
      labOrder: { $exists: false } // Only visits without LabOrder reference
    }).populate('patient', 'firstName lastName dateOfBirth');

    legacyTests = visitsWithPendingTests.map(visit => ({
      _id: `legacy-${visit._id}`,
      orderNumber: `V-${visit._id.toString().slice(-6)}`,
      patient: visit.patient,
      tests: visit.tests.filter(t => ['pending', 'ordered'].includes(t.status)),
      visit: visit._id,
      orderedAt: visit.createdAt,
      _isLegacy: true
    }));
  }

  const allTests = [...labOrders, ...legacyTests];

  res.json({
    success: true,
    data: allTests,
    meta: {
      labOrderCount: labOrders.length,
      legacyCount: legacyTests.length,
      migrationComplete: legacyTests.length === 0
    }
  });
});

// NEW: Create lab order (replaces adding tests to visit)
exports.createLabOrder = asyncHandler(async (req, res) => {
  const { patientId, visitId, tests, priority, notes } = req.body;

  // Generate order number
  const count = await LabOrder.countDocuments();
  const orderNumber = `LAB-${String(count + 1).padStart(6, '0')}`;

  const labOrder = await LabOrder.create({
    orderNumber,
    patient: patientId,
    visit: visitId,
    tests: tests.map(t => ({
      template: t.templateId,
      name: t.name,
      status: 'ordered'
    })),
    priority: priority || 'normal',
    notes,
    orderedBy: req.user._id,
    orderedAt: new Date(),
    clinic: req.user.clinicId
  });

  // Update visit reference if provided
  if (visitId) {
    await Visit.findByIdAndUpdate(visitId, { labOrder: labOrder._id });
  }

  res.status(201).json({ success: true, data: labOrder });
});

// Record result (works for both LabOrder and legacy)
exports.recordResult = asyncHandler(async (req, res) => {
  const { orderId, testId, result, unit, notes } = req.body;

  // Check if legacy format
  if (orderId.startsWith('legacy-')) {
    const visitId = orderId.replace('legacy-', '');
    const visit = await Visit.findById(visitId);

    const testIndex = visit.tests.findIndex(t => t._id.toString() === testId);
    if (testIndex === -1) {
      res.status(404);
      throw new Error('Test not found');
    }

    visit.tests[testIndex].result = result;
    visit.tests[testIndex].unit = unit;
    visit.tests[testIndex].notes = notes;
    visit.tests[testIndex].status = 'completed';
    visit.tests[testIndex].performedBy = req.user._id;
    visit.tests[testIndex].performedAt = new Date();

    await visit.save();
    return res.json({ success: true, data: visit.tests[testIndex] });
  }

  // Standard LabOrder format
  const labOrder = await LabOrder.findById(orderId);
  if (!labOrder) {
    res.status(404);
    throw new Error('Lab order not found');
  }

  const test = labOrder.tests.id(testId);
  if (!test) {
    res.status(404);
    throw new Error('Test not found');
  }

  test.result = result;
  test.unit = unit;
  test.notes = notes;
  test.status = 'completed';
  test.performedBy = req.user._id;
  test.performedAt = new Date();

  // Check if all tests completed
  const allCompleted = labOrder.tests.every(t => t.status === 'completed');
  if (allCompleted) {
    labOrder.status = 'pending_validation';
  }

  await labOrder.save();
  res.json({ success: true, data: test });
});
```

### Phase 4 Verification Checklist

- [ ] Migration script runs in dry-run without errors
- [ ] Migrated LabOrders have correct patient/visit references
- [ ] Test templates are matched correctly
- [ ] getPendingTests returns both sources during migration
- [ ] New lab orders create LabOrder documents (not Visit.tests)
- [ ] Result recording works for both formats
- [ ] Validation workflow completes correctly
- [ ] Barcode generation is unique across both systems
- [ ] Critical value alerts fire for both formats
- [ ] Lab reports generate from LabOrder data

### Rollback Plan

1. Migration adds `_migrated` flag - can filter out migrated records
2. Visit.tests data is preserved (not deleted)
3. Controllers can switch back to Visit.tests with env flag
4. `INCLUDE_LEGACY_TESTS=true` keeps dual-read active

---

## Phase 5: Frontend Service Factory Pattern

### ⚠️ SIGNIFICANTLY REDUCED SCOPE (Post Impact Analysis)

**Original Estimate**: 78 → ~40 services (50% reduction), ~4,000 lines removed
**Revised Scope**: 78 → ~65 services (17% reduction), ~800-1,200 lines savings

**7 services are CLASS-BASED and CANNOT use factory pattern:**
1. **websocketService.js** (565 lines) - Singleton connection, Redux dispatch
2. **syncService.js** (416 lines) - Conflict resolution strategies
3. **offlineWrapper.js** (328 lines) - Generic wrapper with transforms
4. **database.js** (410 lines) - IndexedDB schema
5. **offlineService.js** (495 lines) - Complex sync logic
6. **offlineQueueService.js** (318 lines) - Queue-specific offline
7. **offlinePatientService.js** (311 lines) - Patient-specific offline

**These 7 services total 2,843 lines - they must stay as-is.**

**Only 5 inventory services are truly pure CRUD candidates:**
1. frameInventoryService.js (~150 lines)
2. contactLensInventoryService.js (173 lines)
3. opticalLensInventoryService.js (~140 lines)
4. reagentInventoryService.js (213 lines) - Has static helper methods
5. labConsumableInventoryService.js (197 lines) - Has static helper methods

### Current State (78 services)

Many services follow identical patterns, but fewer than originally estimated:
```javascript
// Repeated in ~5 inventory services (not 32 as originally thought)
export const getItems = () => api.get('/endpoint');
export const getItem = (id) => api.get(`/endpoint/${id}`);
export const createItem = (data) => api.post('/endpoint', data);
export const updateItem = (id, data) => api.put(`/endpoint/${id}`, data);
export const deleteItem = (id) => api.delete(`/endpoint/${id}`);
```

### Target State (~65 services)

```
frontend/src/services/
├── core/
│   ├── ServiceFactory.js         (base factory)
│   └── ApiClient.js              (configured axios)
├── inventory/
│   └── index.js                  (5 factory-generated + extensions)
├── [other services]              (remain as-is, not factory candidates)
└── ... (offline services stay unchanged - 7 class-based services)
```

### Implementation Steps

#### Step 5.1: Create Service Factory

```javascript
// frontend/src/services/core/ServiceFactory.js

import api from '../apiConfig';

export function createCrudService(endpoint, options = {}) {
  const {
    idField = '_id',
    transformResponse = (data) => data,
    transformRequest = (data) => data,
    additionalMethods = {}
  } = options;

  return {
    getAll: async (params = {}) => {
      const response = await api.get(endpoint, { params });
      return transformResponse(response.data);
    },

    getById: async (id) => {
      const response = await api.get(`${endpoint}/${id}`);
      return transformResponse(response.data);
    },

    create: async (data) => {
      const response = await api.post(endpoint, transformRequest(data));
      return transformResponse(response.data);
    },

    update: async (id, data) => {
      const response = await api.put(`${endpoint}/${id}`, transformRequest(data));
      return transformResponse(response.data);
    },

    delete: async (id) => {
      const response = await api.delete(`${endpoint}/${id}`);
      return response.data;
    },

    search: async (query, params = {}) => {
      const response = await api.get(endpoint, {
        params: { search: query, ...params }
      });
      return transformResponse(response.data);
    },

    ...additionalMethods
  };
}

// Inventory-specific factory
export function createInventoryService(endpoint) {
  const baseService = createCrudService(endpoint);

  return {
    ...baseService,

    getLowStock: async () => {
      const response = await api.get(`${endpoint}/low-stock`);
      return response.data;
    },

    getStats: async () => {
      const response = await api.get(`${endpoint}/stats`);
      return response.data;
    },

    adjustStock: async (id, adjustment) => {
      const response = await api.post(`${endpoint}/${id}/adjust-stock`, adjustment);
      return response.data;
    },

    batchUpdate: async (items) => {
      const response = await api.put(`${endpoint}/batch`, { items });
      return response.data;
    },

    export: async (format = 'csv') => {
      const response = await api.get(`${endpoint}/export`, {
        params: { format },
        responseType: 'blob'
      });
      return response.data;
    }
  };
}
```

#### Step 5.2: Create Inventory Services

```javascript
// frontend/src/services/inventory/index.js

import { createInventoryService } from '../core/ServiceFactory';
import api from '../apiConfig';

// Factory-generated services
export const frameInventoryService = createInventoryService('/api/frame-inventory');
export const contactLensInventoryService = createInventoryService('/api/contact-lens-inventory');
export const opticalLensInventoryService = createInventoryService('/api/optical-lens-inventory');
export const reagentInventoryService = createInventoryService('/api/reagent-inventory');
export const labConsumableInventoryService = createInventoryService('/api/lab-consumable-inventory');
export const surgicalSupplyInventoryService = createInventoryService('/api/surgical-supply-inventory');

// Extended services with type-specific methods
export const frameInventoryServiceExtended = {
  ...frameInventoryService,

  getTryOnPhotos: async (frameId) => {
    const response = await api.get(`/api/frame-inventory/${frameId}/try-on-photos`);
    return response.data;
  },

  getBySpecifications: async (specs) => {
    const response = await api.get('/api/frame-inventory/specifications', { params: specs });
    return response.data;
  }
};

export const reagentInventoryServiceExtended = {
  ...reagentInventoryService,

  getExpiringSoon: async (days = 30) => {
    const response = await api.get('/api/reagent-inventory/expiring', { params: { days } });
    return response.data;
  },

  validateColdChain: async (id, data) => {
    const response = await api.post(`/api/reagent-inventory/${id}/cold-chain`, data);
    return response.data;
  },

  getByLot: async (lotNumber) => {
    const response = await api.get(`/api/reagent-inventory/lot/${lotNumber}`);
    return response.data;
  }
};

// Unified cross-clinic inventory
export const crossClinicInventoryService = {
  getSummary: async () => {
    const response = await api.get('/api/cross-clinic-inventory/summary');
    return response.data;
  },

  getByType: async (type, params = {}) => {
    const response = await api.get(`/api/cross-clinic-inventory/${type}`, { params });
    return response.data;
  },

  requestTransfer: async (data) => {
    const response = await api.post('/api/inventory-transfers', data);
    return response.data;
  },

  getTransfers: async (params = {}) => {
    const response = await api.get('/api/inventory-transfers', { params });
    return response.data;
  }
};
```

#### Step 5.3: Update Component Imports

```javascript
// Before (in components)
import { getFrames, createFrame, updateFrame } from '../services/frameInventoryService';

// After
import { frameInventoryService } from '../services/inventory';
// Usage: frameInventoryService.getAll(), frameInventoryService.create(data), etc.
```

### Phase 5 Verification Checklist

- [ ] All inventory CRUD operations work
- [ ] Low stock queries return correct data
- [ ] Stock adjustments update correctly
- [ ] Cross-clinic inventory aggregates properly
- [ ] Inventory transfers create/process correctly
- [ ] Type-specific methods (try-on photos, cold chain) work
- [ ] Batch updates process all items
- [ ] Export generates correct file format
- [ ] Search filters work across all types

### Rollback Plan

Keep original service files as `.backup`. Components can switch imports back instantly.

---

## Execution Order (REVISED)

### ⚠️ ORDER CHANGED BASED ON IMPACT ANALYSIS

The original order has been revised based on actual risk assessment:

### Week 1: Frontend Services (Phase 5) - LOWEST RISK
- Only consolidate 5 inventory services
- Quick win with minimal risk
- ~800-1,200 lines saved

### Week 2: Notifications (Phase 3) - MEDIUM RISK
- Merge 4 services
- Update 14 direct callers
- Update 2 schedulers
- Integrate WebSocket notifications

### Weeks 3-4: Inventory Backend (Phase 1) - MEDIUM RISK
- Create factory with ALL 177 functions mapped
- Handle destructured vs dot notation imports
- Preserve type-specific functions (reagent QC, surgical IOL, etc.)

### Weeks 5-6: Billing Split (Phase 2) - HIGH RISK
- **CRITICAL**: Update invoices.js imports FIRST
- Split controllers
- Verify all 32 audit operations
- Test all 6 payment flows

### Weeks 7-10: Laboratory Migration (Phase 4) - CRITICAL RISK
- Week 7: Fix report generation to read LabOrder
- Week 8: Create unified pending endpoint, run migration dry-run
- Week 9: Migrate historical data, disable sync hook
- Week 10: 2-week parallel operation, cut over only after verification

---

## Testing Strategy

### For Each Phase

1. **Unit Tests**: Test factory methods in isolation
2. **Integration Tests**: Test API endpoints with database
3. **E2E Tests**: Test critical user flows
4. **Regression Tests**: Run full test suite before/after

### Critical Flows to Test

| Flow | Test Type | Priority |
|------|-----------|----------|
| Payment processing | E2E | CRITICAL |
| Convention billing | Integration | CRITICAL |
| Lab result recording | E2E | HIGH |
| Inventory stock adjustment | Integration | HIGH |
| Cross-clinic transfer | E2E | HIGH |
| Notification delivery | Integration | MEDIUM |

---

## Monitoring

### Metrics to Watch Post-Deployment

1. **Error Rates**: Monitor 500 errors on affected endpoints
2. **Response Times**: Watch for degradation in API latency
3. **Payment Success Rate**: Critical - any drop requires immediate rollback
4. **Queue Processing**: Email/notification queue depth
5. **Lab Order Completion**: Track time to result

### Alerts to Set

```javascript
// Example monitoring config
{
  "alerts": [
    {
      "name": "Payment Failure Spike",
      "condition": "payment_failures > 5 in 5min",
      "action": "page_oncall"
    },
    {
      "name": "API Error Rate",
      "condition": "error_rate > 1% for 10min",
      "action": "notify_slack"
    },
    {
      "name": "Lab Order Backlog",
      "condition": "pending_lab_orders > 100",
      "action": "notify_email"
    }
  ]
}
```

---

## Summary (REVISED)

| What | Original Risk | Revised Risk | Lines Affected | Effort |
|------|---------------|--------------|----------------|--------|
| Frontend Services (Phase 5) | LOW | **LOW** | ~800-1,200 | 2-3 days |
| Notification Merge (Phase 3) | LOW | **MEDIUM** | ~1,800 | 3-4 days |
| Inventory Factory (Phase 1) | LOW | **MEDIUM** | ~7,000 | 5-7 days |
| Billing Split (Phase 2) | MEDIUM | **HIGH** | ~7,100 | 5-6 days |
| Laboratory Migration (Phase 4) | HIGH | **CRITICAL** | ~3,500 | 6-8 weeks |

**Total revised effort**: 8-10 weeks (was 2-3 weeks)

**Key Changes from Original Plan**:
1. Execution order reversed - start with lowest risk (frontend), end with highest (laboratory)
2. Inventory has 177 functions (not ~50) - more extension modules needed
3. Billing has cross-import to invoices.js - must update imports FIRST
4. Notifications have 14 direct callers - more files to update
5. Laboratory has bidirectional sync hook - must fix report generation BEFORE migration
6. Frontend only has 5 services suitable for factory pattern (not 32)

**NOT included** (by design):
- Template model unification (9/10 risk, low benefit)

**MANDATORY PRE-REFACTORING CHECKLIST**:
- [ ] Create database backup
- [ ] Document all current API endpoints with response shapes
- [ ] Run full test suite (if exists)
- [ ] Create feature flags for gradual rollout
- [ ] Set up monitoring for payment failure rates, API error rates, lab order completion times, scheduler execution success

---

*Generated by deep dependency analysis - December 9, 2025*
*Updated with Impact Analysis findings - December 9, 2025*
