# Unified Visit Invoice Billing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Single invoice per visit with category-based permissions, allowing pharmacy/optical to collect payments for their items while clinic receptionist handles the rest.

**Architecture:** Extend existing Invoice model with per-item payment tracking and category permissions. Add filtered API endpoints for each department. Update pharmacy dispensing to add items to visit invoice instead of creating separate invoices.

**Tech Stack:** Node.js/Express backend, MongoDB/Mongoose, React frontend, existing RolePermission system.

---

## Task 1: Update Invoice Model Schema

**Files:**
- Modify: `backend/models/Invoice.js:50-150` (items schema)

**Step 1: Add new fields to invoice item schema**

In `backend/models/Invoice.js`, find the `items` array schema and add these fields:

```javascript
// Inside items array schema, add after existing fields:

    // Service completion tracking
    completedAt: Date,
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    // Per-item payment tracking
    paidTo: {
      type: String,
      enum: ['pharmacy', 'optical', 'clinic', null],
      default: null
    },
    paymentCollectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    paymentCollectedAt: Date,

    // External tracking (patient getting service elsewhere)
    isExternal: {
      type: Boolean,
      default: false
    },
    markedExternalBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    markedExternalAt: Date,
    externalReason: String
```

**Step 2: Verify model loads without errors**

Run: `node -e "require('./backend/models/Invoice.js'); console.log('Invoice model OK')"`
Expected: "Invoice model OK"

**Step 3: Commit**

```bash
git add backend/models/Invoice.js
git commit -m "feat(invoice): add per-item payment and external tracking fields"
```

---

## Task 2: Add Category Permissions to RolePermission

**Files:**
- Modify: `backend/scripts/seedRolePermissions.js`

**Step 1: Add category-specific invoice permissions**

Add these permissions to the appropriate roles in `seedRolePermissions.js`:

```javascript
// Pharmacist permissions - add to pharmacist role
'invoice.view.medication',
'invoice.dispense.medication',
'invoice.external.medication',

// Pharmacy receptionist - add to receptionist role OR create pharmacy_receptionist
'invoice.view.medication',
'invoice.payment.medication',
'invoice.external.medication',

// Optician permissions
'invoice.view.optical',
'invoice.dispense.optical',
'invoice.external.optical',

// Optical receptionist
'invoice.view.optical',
'invoice.payment.optical',
'invoice.external.optical',

// Lab technician
'invoice.view.laboratory',
'invoice.complete.laboratory',

// Clinic receptionist - add to receptionist role
'invoice.view.all',
'invoice.payment.consultation',
'invoice.payment.laboratory',
'invoice.payment.imaging',
'invoice.payment.surgery',
'invoice.payment.examination',

// Cashier/Admin - full access
'invoice.view.all',
'invoice.payment.all',
```

**Step 2: Run seed script**

Run: `node backend/scripts/seedRolePermissions.js`
Expected: "Role permissions seeded successfully"

**Step 3: Commit**

```bash
git add backend/scripts/seedRolePermissions.js
git commit -m "feat(permissions): add category-specific invoice permissions"
```

---

## Task 3: Create Invoice Category Filter Middleware

**Files:**
- Create: `backend/middleware/invoiceCategoryFilter.js`

**Step 1: Create the middleware**

```javascript
// backend/middleware/invoiceCategoryFilter.js
const RolePermission = require('../models/RolePermission');

// Map roles to their allowed categories
const CATEGORY_PERMISSIONS = {
  medication: {
    view: ['invoice.view.medication', 'invoice.view.all'],
    complete: ['invoice.dispense.medication'],
    payment: ['invoice.payment.medication', 'invoice.payment.all'],
    external: ['invoice.external.medication']
  },
  optical: {
    view: ['invoice.view.optical', 'invoice.view.all'],
    complete: ['invoice.dispense.optical'],
    payment: ['invoice.payment.optical', 'invoice.payment.all'],
    external: ['invoice.external.optical']
  },
  laboratory: {
    view: ['invoice.view.laboratory', 'invoice.view.all'],
    complete: ['invoice.complete.laboratory'],
    payment: ['invoice.payment.laboratory', 'invoice.payment.all'],
    external: []
  },
  consultation: {
    view: ['invoice.view.consultation', 'invoice.view.all'],
    complete: ['invoice.complete.consultation'],
    payment: ['invoice.payment.consultation', 'invoice.payment.all'],
    external: []
  },
  surgery: {
    view: ['invoice.view.surgery', 'invoice.view.all'],
    complete: ['invoice.complete.surgery'],
    payment: ['invoice.payment.surgery', 'invoice.payment.all'],
    external: []
  },
  imaging: {
    view: ['invoice.view.imaging', 'invoice.view.all'],
    complete: ['invoice.complete.imaging'],
    payment: ['invoice.payment.imaging', 'invoice.payment.all'],
    external: []
  },
  examination: {
    view: ['invoice.view.examination', 'invoice.view.all'],
    complete: ['invoice.complete.examination'],
    payment: ['invoice.payment.examination', 'invoice.payment.all'],
    external: []
  }
};

// Get categories user can view
const getAllowedCategories = async (user) => {
  const rolePerms = await RolePermission.findOne({ role: user.role });
  const userPerms = [...(rolePerms?.permissions || []), ...(user.permissions || [])];

  // Check for full access
  if (userPerms.includes('invoice.view.all')) {
    return Object.keys(CATEGORY_PERMISSIONS);
  }

  // Filter to allowed categories
  const allowed = [];
  for (const [category, perms] of Object.entries(CATEGORY_PERMISSIONS)) {
    if (perms.view.some(p => userPerms.includes(p))) {
      allowed.push(category);
    }
  }
  return allowed;
};

// Check if user can perform action on category
const canPerformAction = async (user, category, action) => {
  const rolePerms = await RolePermission.findOne({ role: user.role });
  const userPerms = [...(rolePerms?.permissions || []), ...(user.permissions || [])];

  const categoryPerms = CATEGORY_PERMISSIONS[category];
  if (!categoryPerms || !categoryPerms[action]) return false;

  return categoryPerms[action].some(p => userPerms.includes(p));
};

// Filter invoice items by user's allowed categories
const filterInvoiceItems = (invoice, allowedCategories) => {
  if (!invoice || !invoice.items) return invoice;

  const filtered = { ...invoice.toObject ? invoice.toObject() : invoice };
  filtered.items = filtered.items.filter(item =>
    allowedCategories.includes(item.category)
  );

  // Recalculate summary for filtered items
  filtered.filteredSummary = {
    subtotal: filtered.items.reduce((sum, i) => sum + (i.subtotal || 0), 0),
    total: filtered.items.reduce((sum, i) => sum + (i.total || 0), 0),
    paidAmount: filtered.items.reduce((sum, i) => sum + (i.paidAmount || 0), 0),
    pendingAmount: filtered.items
      .filter(i => !i.isPaid && !i.isExternal)
      .reduce((sum, i) => sum + (i.total || 0), 0)
  };

  return filtered;
};

module.exports = {
  CATEGORY_PERMISSIONS,
  getAllowedCategories,
  canPerformAction,
  filterInvoiceItems
};
```

**Step 2: Verify middleware loads**

Run: `node -e "require('./backend/middleware/invoiceCategoryFilter.js'); console.log('Middleware OK')"`
Expected: "Middleware OK"

**Step 3: Commit**

```bash
git add backend/middleware/invoiceCategoryFilter.js
git commit -m "feat(middleware): add invoice category filter for role-based access"
```

---

## Task 4: Add Category-Filtered Invoice Endpoints

**Files:**
- Modify: `backend/routes/invoices.js`
- Modify: `backend/controllers/invoiceController.js`

**Step 1: Add routes for category-filtered views**

In `backend/routes/invoices.js`, add:

```javascript
// Category-filtered invoice views
router.get('/pharmacy/visit/:visitId', auth, invoiceController.getPharmacyInvoiceView);
router.get('/optical/visit/:visitId', auth, invoiceController.getOpticalInvoiceView);
router.get('/clinic/visit/:visitId', auth, invoiceController.getClinicInvoiceView);

// Item actions
router.patch('/:id/items/:itemId/complete', auth, invoiceController.markItemCompleted);
router.patch('/:id/items/:itemId/external', auth, invoiceController.markItemExternal);
router.post('/:id/items/:itemId/payment', auth, invoiceController.collectItemPayment);
```

**Step 2: Add controller methods**

In `backend/controllers/invoiceController.js`, add:

```javascript
const { getAllowedCategories, canPerformAction, filterInvoiceItems } = require('../middleware/invoiceCategoryFilter');

// Get pharmacy view of invoice (medication items only)
exports.getPharmacyInvoiceView = asyncHandler(async (req, res) => {
  const { visitId } = req.params;

  const invoice = await Invoice.findOne({ visit: visitId })
    .populate('patient', 'firstName lastName patientId');

  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found for this visit' });
  }

  // Filter to medication items only
  const filtered = filterInvoiceItems(invoice, ['medication']);

  res.json({ success: true, data: filtered });
});

// Get optical view of invoice
exports.getOpticalInvoiceView = asyncHandler(async (req, res) => {
  const { visitId } = req.params;

  const invoice = await Invoice.findOne({ visit: visitId })
    .populate('patient', 'firstName lastName patientId');

  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found for this visit' });
  }

  const filtered = filterInvoiceItems(invoice, ['optical']);

  res.json({ success: true, data: filtered });
});

// Get clinic view (all categories)
exports.getClinicInvoiceView = asyncHandler(async (req, res) => {
  const { visitId } = req.params;

  const invoice = await Invoice.findOne({ visit: visitId })
    .populate('patient', 'firstName lastName patientId');

  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found for this visit' });
  }

  // Get user's allowed categories
  const allowedCategories = await getAllowedCategories(req.user);
  const filtered = filterInvoiceItems(invoice, allowedCategories);

  res.json({ success: true, data: filtered });
});

// Mark item as completed/dispensed
exports.markItemCompleted = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;

  const invoice = await Invoice.findById(id);
  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found' });
  }

  const item = invoice.items.id(itemId);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }

  // Check permission
  const canComplete = await canPerformAction(req.user, item.category, 'complete');
  if (!canComplete) {
    return res.status(403).json({ success: false, error: 'Not authorized to complete this item type' });
  }

  item.realization = { realized: true, realizedAt: new Date(), realizedBy: req.user._id };
  item.completedAt = new Date();
  item.completedBy = req.user._id;

  await invoice.save();

  res.json({ success: true, data: item });
});

// Mark item as external (patient getting elsewhere)
exports.markItemExternal = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { reason } = req.body;

  const invoice = await Invoice.findById(id);
  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found' });
  }

  const item = invoice.items.id(itemId);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }

  // Check permission
  const canMarkExternal = await canPerformAction(req.user, item.category, 'external');
  if (!canMarkExternal) {
    return res.status(403).json({ success: false, error: 'Not authorized to mark this item as external' });
  }

  item.isExternal = true;
  item.markedExternalBy = req.user._id;
  item.markedExternalAt = new Date();
  item.externalReason = reason || 'Patient obtaining elsewhere';

  // Recalculate invoice totals
  invoice.summary.amountDue = invoice.items
    .filter(i => !i.isExternal && !i.isPaid)
    .reduce((sum, i) => sum + (i.total || 0), 0);

  await invoice.save();

  res.json({ success: true, data: item });
});

// Collect payment for specific item
exports.collectItemPayment = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { amount, paymentMethod, collectionPoint } = req.body;

  const invoice = await Invoice.findById(id);
  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found' });
  }

  const item = invoice.items.id(itemId);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }

  // Check permission
  const canCollect = await canPerformAction(req.user, item.category, 'payment');
  if (!canCollect) {
    return res.status(403).json({ success: false, error: 'Not authorized to collect payment for this item type' });
  }

  // Validate collection point matches category
  const validCollectionPoints = {
    medication: 'pharmacy',
    optical: 'optical',
    consultation: 'clinic',
    laboratory: 'clinic',
    imaging: 'clinic',
    surgery: 'clinic',
    examination: 'clinic'
  };

  const expectedPoint = validCollectionPoints[item.category];
  if (collectionPoint && collectionPoint !== expectedPoint && collectionPoint !== 'clinic') {
    return res.status(400).json({
      success: false,
      error: `${item.category} payments should be collected at ${expectedPoint}`
    });
  }

  // Update item payment
  const paymentAmount = amount || item.total;
  item.paidAmount = (item.paidAmount || 0) + paymentAmount;
  item.isPaid = item.paidAmount >= item.total;
  item.paidTo = collectionPoint || expectedPoint;
  item.paymentCollectedBy = req.user._id;
  item.paymentCollectedAt = new Date();

  // Add to invoice payments array
  invoice.payments.push({
    amount: paymentAmount,
    method: paymentMethod || 'cash',
    date: new Date(),
    receivedBy: req.user._id,
    reference: `Item:${itemId}`,
    notes: `Payment for ${item.description} at ${item.paidTo}`
  });

  // Update invoice summary
  invoice.summary.amountPaid = invoice.items.reduce((sum, i) => sum + (i.paidAmount || 0), 0);
  invoice.summary.amountDue = invoice.items
    .filter(i => !i.isExternal)
    .reduce((sum, i) => sum + ((i.total || 0) - (i.paidAmount || 0)), 0);

  // Update invoice status
  const allNonExternalPaid = invoice.items
    .filter(i => !i.isExternal)
    .every(i => i.isPaid);

  if (allNonExternalPaid) {
    invoice.status = 'paid';
  } else if (invoice.summary.amountPaid > 0) {
    invoice.status = 'partial';
  }

  await invoice.save();

  res.json({
    success: true,
    data: {
      item,
      invoiceSummary: invoice.summary,
      invoiceStatus: invoice.status
    }
  });
});
```

**Step 3: Verify syntax**

Run: `node --check backend/controllers/invoiceController.js`
Expected: No output (no syntax errors)

**Step 4: Commit**

```bash
git add backend/routes/invoices.js backend/controllers/invoiceController.js
git commit -m "feat(api): add category-filtered invoice endpoints and item payment"
```

---

## Task 5: Update Prescription Dispensing to Use Visit Invoice

**Files:**
- Modify: `backend/controllers/pharmacyController.js`

**Step 1: Update dispense function to add items to visit invoice**

Find the `dispensePrescription` or similar function and update to:

```javascript
// In dispensePrescription function, after successful dispensing:

// Find or create visit invoice
let invoice = await Invoice.findOne({ visit: prescription.visit });

if (invoice) {
  // Add medication items to existing invoice
  for (const med of prescription.medications) {
    // Check if item already exists
    const existingItem = invoice.items.find(
      i => i.reference === `Prescription:${prescription._id}:${med._id}`
    );

    if (!existingItem) {
      // Get price from inventory or fee schedule
      const inventoryItem = await PharmacyInventory.findOne({
        genericName: { $regex: med.genericName, $options: 'i' }
      });
      const unitPrice = inventoryItem?.sellingPrice || med.price || 0;

      invoice.items.push({
        category: 'medication',
        description: med.name || med.genericName,
        code: med.code || 'MED-GEN',
        quantity: med.quantity || 1,
        unitPrice,
        subtotal: unitPrice * (med.quantity || 1),
        total: unitPrice * (med.quantity || 1),
        reference: `Prescription:${prescription._id}:${med._id}`,
        addedBy: req.user._id,
        addedAt: new Date(),
        realization: { realized: true, realizedAt: new Date(), realizedBy: req.user._id },
        completedAt: new Date(),
        completedBy: req.user._id
      });
    }
  }

  // Recalculate totals
  invoice.summary.subtotal = invoice.items.reduce((sum, i) => sum + (i.subtotal || 0), 0);
  invoice.summary.total = invoice.items.reduce((sum, i) => sum + (i.total || 0), 0);
  invoice.summary.amountDue = invoice.items
    .filter(i => !i.isExternal && !i.isPaid)
    .reduce((sum, i) => sum + (i.total || 0), 0);

  await invoice.save();
}

// Update prescription status
prescription.status = 'dispensed';
prescription.pharmacyStatus = 'dispensed';
prescription.dispensedAt = new Date();
prescription.dispensedBy = req.user._id;
await prescription.save();
```

**Step 2: Commit**

```bash
git add backend/controllers/pharmacyController.js
git commit -m "feat(pharmacy): add dispensed meds to visit invoice instead of separate billing"
```

---

## Task 6: Create Pharmacy Invoice View Component

**Files:**
- Create: `frontend/src/components/pharmacy/PharmacyInvoiceView.jsx`

**Step 1: Create the component**

```jsx
// frontend/src/components/pharmacy/PharmacyInvoiceView.jsx
import React, { useState, useEffect } from 'react';
import { DollarSign, ExternalLink, Check, AlertCircle } from 'lucide-react';
import api from '../../services/apiConfig';

const PharmacyInvoiceView = ({ visitId, onPaymentComplete }) => {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingItem, setProcessingItem] = useState(null);

  useEffect(() => {
    if (visitId) fetchInvoice();
  }, [visitId]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/invoices/pharmacy/visit/${visitId}`);
      setInvoice(response.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkExternal = async (itemId) => {
    try {
      setProcessingItem(itemId);
      await api.patch(`/invoices/${invoice._id}/items/${itemId}/external`, {
        reason: 'Patient obtaining medication elsewhere'
      });
      await fetchInvoice();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to mark as external');
    } finally {
      setProcessingItem(null);
    }
  };

  const handleCollectPayment = async (itemId, amount) => {
    try {
      setProcessingItem(itemId);
      await api.post(`/invoices/${invoice._id}/items/${itemId}/payment`, {
        amount,
        paymentMethod: 'cash',
        collectionPoint: 'pharmacy'
      });
      await fetchInvoice();
      onPaymentComplete?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to collect payment');
    } finally {
      setProcessingItem(null);
    }
  };

  if (loading) return <div className="p-4 text-center">Chargement...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!invoice?.items?.length) return <div className="p-4 text-gray-500">Aucun médicament sur cette facture</div>;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-green-600" />
        Facturation Pharmacie
      </h3>

      <div className="space-y-3">
        {invoice.items.map((item) => (
          <div
            key={item._id}
            className={`p-3 border rounded-lg ${
              item.isExternal ? 'bg-gray-50 opacity-60' :
              item.isPaid ? 'bg-green-50' : 'bg-white'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium">{item.description}</div>
                <div className="text-sm text-gray-500">
                  Qté: {item.quantity} × {item.unitPrice?.toLocaleString()} FC
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{item.total?.toLocaleString()} FC</div>
                {item.isExternal && (
                  <span className="text-xs bg-gray-200 px-2 py-1 rounded">Externe</span>
                )}
                {item.isPaid && (
                  <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">Payé</span>
                )}
              </div>
            </div>

            {!item.isExternal && !item.isPaid && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleCollectPayment(item._id, item.total)}
                  disabled={processingItem === item._id}
                  className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Encaisser
                </button>
                <button
                  onClick={() => handleMarkExternal(item._id)}
                  disabled={processingItem === item._id}
                  className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Externe
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t">
        <div className="flex justify-between text-sm">
          <span>Total médicaments:</span>
          <span className="font-semibold">{invoice.filteredSummary?.total?.toLocaleString()} FC</span>
        </div>
        <div className="flex justify-between text-sm text-green-600">
          <span>Payé:</span>
          <span>{invoice.filteredSummary?.paidAmount?.toLocaleString()} FC</span>
        </div>
        <div className="flex justify-between text-sm text-orange-600">
          <span>Restant:</span>
          <span>{invoice.filteredSummary?.pendingAmount?.toLocaleString()} FC</span>
        </div>
      </div>
    </div>
  );
};

export default PharmacyInvoiceView;
```

**Step 2: Commit**

```bash
git add frontend/src/components/pharmacy/PharmacyInvoiceView.jsx
git commit -m "feat(ui): add pharmacy invoice view component with payment collection"
```

---

## Task 7: Integrate Pharmacy Invoice View into Dispensing Workflow

**Files:**
- Modify: `frontend/src/pages/PharmacyDashboard/index.jsx` (or relevant pharmacy page)

**Step 1: Import and add PharmacyInvoiceView**

```jsx
import PharmacyInvoiceView from '../../components/pharmacy/PharmacyInvoiceView';

// In the component where prescription is displayed, add:
{selectedPrescription?.visit && (
  <PharmacyInvoiceView
    visitId={selectedPrescription.visit}
    onPaymentComplete={() => {
      // Refresh prescription list or show success message
      fetchPrescriptions();
    }}
  />
)}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/PharmacyDashboard/
git commit -m "feat(pharmacy): integrate invoice view into dispensing workflow"
```

---

## Task 8: Test End-to-End Flow

**Step 1: Create test prescription and verify invoice**

```bash
# Test the flow manually:
# 1. Create a visit with prescription
# 2. Check that medications appear in visit invoice
# 3. Test pharmacy view endpoint
# 4. Test marking item as external
# 5. Test collecting payment
```

**Step 2: Commit final changes**

```bash
git add .
git commit -m "feat: complete unified invoice billing system with category permissions"
```

---

## Summary

This implementation provides:
1. ✅ Single invoice per visit with all service categories
2. ✅ Category-based visibility (pharmacy sees only meds, etc.)
3. ✅ External tracking for items obtained elsewhere
4. ✅ Decentralized payment collection (pharmacy, optical, clinic)
5. ✅ Per-item payment tracking
6. ✅ Permission-based access control
