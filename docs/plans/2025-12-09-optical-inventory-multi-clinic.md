# Optical Inventory Multi-Clinic Integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Link optical shop inventory (frames, lenses) with multi-clinic system - central depot with clinic-specific pricing (Matrix +30%, Matadi -25%)

**Architecture:**
- Central depot holds master inventory with base prices
- Each clinic has `opticalPriceModifier` field for automatic price adjustments
- InventoryTransfer handles depot→clinic stock movements
- Optical shop automatically uses clinic-adjusted prices

**Tech Stack:** MongoDB, Express, React, existing InventoryTransfer model

---

## Task 1: Add Pricing Modifiers to Clinic Model

**Files:**
- Modify: `backend/models/Clinic.js`

**Step 1: Add opticalPriceModifier field to Clinic schema**

Add after line ~100 (after services array):

```javascript
  // Pricing modifiers for inventory (percentage adjustment from base/depot price)
  pricingModifiers: {
    optical: {
      type: Number,
      default: 0,  // 0 = no change, 30 = +30%, -25 = -25%
      min: -100,
      max: 500
    },
    pharmacy: {
      type: Number,
      default: 0,
      min: -100,
      max: 500
    }
  },
```

**Step 2: Verify change**

```bash
node -e "const m = require('./models/Clinic'); console.log(m.schema.paths['pricingModifiers.optical'] ? 'OK' : 'FAIL')"
```

---

## Task 2: Create Script to Set Clinic Price Modifiers

**Files:**
- Create: `backend/scripts/setClinicPriceModifiers.js`

**Step 1: Create the script**

```javascript
/**
 * Set pricing modifiers for each clinic
 * Matrix: +30%
 * Matadi: -25%
 * Tombalbaye: 0% (base price)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Clinic = require('../models/Clinic');

const CLINIC_MODIFIERS = {
  'MATRIX': { optical: 30, pharmacy: 30 },      // +30%
  'MATADI': { optical: -25, pharmacy: -25 },    // -25%
  'TOMBALBAYE': { optical: 0, pharmacy: 0 }     // Base price
};

async function setModifiers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    for (const [clinicId, modifiers] of Object.entries(CLINIC_MODIFIERS)) {
      const result = await Clinic.findOneAndUpdate(
        { clinicId: { $regex: new RegExp(clinicId, 'i') } },
        { $set: { pricingModifiers: modifiers } },
        { new: true }
      );

      if (result) {
        console.log(`✅ ${result.name}: optical=${modifiers.optical}%, pharmacy=${modifiers.pharmacy}%`);
      } else {
        console.log(`⚠️  Clinic ${clinicId} not found`);
      }
    }

    console.log('\n✅ Pricing modifiers set successfully');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

setModifiers();
```

**Step 2: Run the script**

```bash
node scripts/setClinicPriceModifiers.js
```

---

## Task 3: Add Price Calculation Helper to FrameInventory

**Files:**
- Modify: `backend/models/FrameInventory.js`

**Step 1: Add static method for clinic-adjusted price**

Add before `module.exports`:

```javascript
// Static: Get price adjusted for clinic modifier
frameInventorySchema.statics.getClinicPrice = async function(frameId, clinicId) {
  const Clinic = require('./Clinic');

  const frame = await this.findById(frameId);
  if (!frame) return null;

  const basePrice = frame.pricing?.sellingPrice || 0;

  // If this is depot inventory, apply clinic modifier
  if (frame.isDepot && clinicId) {
    const clinic = await Clinic.findById(clinicId).select('pricingModifiers');
    if (clinic?.pricingModifiers?.optical) {
      const modifier = clinic.pricingModifiers.optical / 100;
      return Math.round(basePrice * (1 + modifier));
    }
  }

  return basePrice;
};

// Static: Get all frames with clinic-adjusted prices
frameInventorySchema.statics.getForClinicWithPrices = async function(clinicId, query = {}) {
  const Clinic = require('./Clinic');

  // Get clinic's price modifier
  const clinic = await Clinic.findById(clinicId).select('pricingModifiers');
  const modifier = clinic?.pricingModifiers?.optical || 0;
  const multiplier = 1 + (modifier / 100);

  // Get frames for this clinic
  const frames = await this.find({ clinic: clinicId, ...query }).lean();

  // Apply price modifier
  return frames.map(frame => ({
    ...frame,
    pricing: {
      ...frame.pricing,
      clinicPrice: Math.round((frame.pricing?.sellingPrice || 0) * multiplier),
      basePrice: frame.pricing?.sellingPrice,
      modifier: modifier
    }
  }));
};
```

---

## Task 4: Create Depot Frame Seeder with Clinic Distribution

**Files:**
- Create: `backend/scripts/seedDepotFrames.js`

**Step 1: Create comprehensive seeder**

```javascript
/**
 * Seed depot frames and distribute to clinics with adjusted prices
 * 1. Creates frames in depot with base prices
 * 2. Creates copies in each clinic with adjusted prices
 */
require('dotenv').config();
const mongoose = require('mongoose');
const FrameInventory = require('../models/FrameInventory');
const Clinic = require('../models/Clinic');

// Sample depot frames with base prices (in CDF)
const DEPOT_FRAMES = [
  { brand: 'Ray-Ban', model: 'Aviator Classic', color: 'Gold', sku: 'RB-AVI-GLD', category: 'premium', basePrice: 150000, costPrice: 80000 },
  { brand: 'Ray-Ban', model: 'Wayfarer', color: 'Black', sku: 'RB-WAY-BLK', category: 'premium', basePrice: 140000, costPrice: 75000 },
  { brand: 'Oakley', model: 'Holbrook', color: 'Matte Black', sku: 'OAK-HOL-MBK', category: 'sport', basePrice: 180000, costPrice: 95000 },
  { brand: 'Essilor', model: 'Basic Frame', color: 'Brown', sku: 'ESS-BAS-BRN', category: 'economic', basePrice: 45000, costPrice: 20000 },
  { brand: 'Essilor', model: 'Comfort Plus', color: 'Black', sku: 'ESS-CMP-BLK', category: 'standard', basePrice: 75000, costPrice: 35000 },
  { brand: 'Silhouette', model: 'Titan Minimal', color: 'Silver', sku: 'SIL-TMN-SLV', category: 'luxury', basePrice: 350000, costPrice: 180000 },
  { brand: 'Tom Ford', model: 'FT5401', color: 'Havana', sku: 'TF-5401-HAV', category: 'luxury', basePrice: 420000, costPrice: 220000 },
  { brand: 'Nike', model: 'Flexon', color: 'Blue', sku: 'NIK-FLX-BLU', category: 'sport', basePrice: 95000, costPrice: 50000 },
  { brand: 'Carrera', model: 'Champion', color: 'Red', sku: 'CAR-CHP-RED', category: 'standard', basePrice: 85000, costPrice: 45000 },
  { brand: 'Local Brand', model: 'Economy Basic', color: 'Black', sku: 'LOC-ECO-BLK', category: 'economic', basePrice: 25000, costPrice: 12000 },
];

async function seedFrames() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all clinics with their modifiers
    const clinics = await Clinic.find({ status: { $ne: 'inactive' } });
    console.log(`Found ${clinics.length} active clinics`);

    // Find or create depot clinic
    let depotClinic = clinics.find(c => c.type === 'main' || c.name.toLowerCase().includes('depot'));
    if (!depotClinic) {
      depotClinic = clinics[0]; // Use first clinic as depot
      console.log(`Using ${depotClinic.name} as depot`);
    }

    let created = 0;
    let skipped = 0;

    for (const frameData of DEPOT_FRAMES) {
      // Check if depot frame exists
      const existingDepot = await FrameInventory.findOne({ sku: frameData.sku, isDepot: true });

      if (!existingDepot) {
        // Create depot frame
        await FrameInventory.create({
          clinic: depotClinic._id,
          isDepot: true,
          sku: frameData.sku,
          brand: frameData.brand,
          model: frameData.model,
          color: frameData.color,
          category: frameData.category,
          material: 'mixed',
          frameType: 'full-rim',
          gender: 'unisex',
          inventory: {
            currentStock: 50,
            minimumStock: 5,
            reorderPoint: 10,
            status: 'in-stock'
          },
          pricing: {
            costPrice: frameData.costPrice,
            sellingPrice: frameData.basePrice,
            wholesalePrice: frameData.costPrice * 1.2,
            currency: 'CDF'
          },
          active: true
        });
        console.log(`✅ Created depot: ${frameData.brand} ${frameData.model}`);
        created++;
      } else {
        skipped++;
      }

      // Create clinic copies with adjusted prices
      for (const clinic of clinics) {
        if (clinic._id.equals(depotClinic._id)) continue; // Skip depot

        const modifier = clinic.pricingModifiers?.optical || 0;
        const clinicPrice = Math.round(frameData.basePrice * (1 + modifier / 100));
        const clinicSku = `${frameData.sku}-${clinic.shortName || clinic.clinicId}`;

        const existingClinic = await FrameInventory.findOne({
          sku: clinicSku,
          clinic: clinic._id
        });

        if (!existingClinic) {
          await FrameInventory.create({
            clinic: clinic._id,
            isDepot: false,
            sku: clinicSku,
            brand: frameData.brand,
            model: frameData.model,
            color: frameData.color,
            category: frameData.category,
            material: 'mixed',
            frameType: 'full-rim',
            gender: 'unisex',
            inventory: {
              currentStock: 5, // Initial stock for clinic
              minimumStock: 2,
              reorderPoint: 3,
              status: 'in-stock'
            },
            pricing: {
              costPrice: frameData.costPrice,
              sellingPrice: clinicPrice, // Adjusted price
              wholesalePrice: frameData.costPrice * 1.2,
              currency: 'CDF',
              basePrice: frameData.basePrice, // Store base for reference
              priceModifier: modifier
            },
            active: true
          });
          console.log(`   ├─ ${clinic.shortName || clinic.name}: ${clinicPrice.toLocaleString()} CDF (${modifier >= 0 ? '+' : ''}${modifier}%)`);
          created++;
        }
      }
    }

    console.log(`\n✅ Complete: ${created} created, ${skipped} skipped (already exist)`);

    // Show summary
    console.log('\n📊 Price Summary by Clinic:');
    for (const clinic of clinics) {
      const modifier = clinic.pricingModifiers?.optical || 0;
      const count = await FrameInventory.countDocuments({ clinic: clinic._id, active: true });
      console.log(`   ${clinic.name}: ${count} frames (${modifier >= 0 ? '+' : ''}${modifier}%)`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

seedFrames();
```

**Step 2: Run the seeder**

```bash
node scripts/seedDepotFrames.js
```

---

## Task 5: Update Optical Shop Controller to Use Clinic Prices

**Files:**
- Modify: `backend/controllers/opticalShopController.js`

**Step 1: Update searchFrames/getFrames to include clinic-adjusted prices**

Find `checkAvailability` function and update to use clinic pricing:

```javascript
// Add at top of file after existing requires
const Clinic = require('../models/Clinic');

// Helper: Apply clinic price modifier
const applyClinicPricing = async (frame, clinicId) => {
  if (!clinicId) return frame;

  const clinic = await Clinic.findById(clinicId).select('pricingModifiers').lean();
  const modifier = clinic?.pricingModifiers?.optical || 0;

  if (modifier === 0) return frame;

  const basePrice = frame.pricing?.sellingPrice || 0;
  const clinicPrice = Math.round(basePrice * (1 + modifier / 100));

  return {
    ...frame,
    pricing: {
      ...frame.pricing,
      clinicPrice,
      basePrice,
      modifier
    }
  };
};
```

**Step 2: Update checkAvailability to return clinic-adjusted price**

In the `checkAvailability` function, after fetching frame:

```javascript
// Apply clinic pricing
const clinicId = req.user?.clinic || req.clinicId;
if (clinicId && frame) {
  const clinic = await Clinic.findById(clinicId).select('pricingModifiers').lean();
  const modifier = clinic?.pricingModifiers?.optical || 0;
  if (modifier !== 0) {
    frame.clinicPrice = Math.round((frame.pricing?.sellingPrice || 0) * (1 + modifier / 100));
    frame.priceModifier = modifier;
  }
}
```

---

## Task 6: Update calculatePricing to Use Clinic Modifier

**Files:**
- Modify: `backend/controllers/opticalShopController.js`

**Step 1: Update calculatePricing function**

Find the `calculatePricing` function and modify to fetch clinic modifier:

```javascript
// Inside calculatePricing, after getting frame/lens prices:
const clinicId = req.user?.clinic || req.clinicId;
let priceModifier = 0;

if (clinicId) {
  const clinic = await Clinic.findById(clinicId).select('pricingModifiers').lean();
  priceModifier = clinic?.pricingModifiers?.optical || 0;
}

// Apply modifier to frame price
if (framePrice && priceModifier !== 0) {
  framePrice = Math.round(framePrice * (1 + priceModifier / 100));
}

// Apply modifier to lens price
if (lensPrice && priceModifier !== 0) {
  lensPrice = Math.round(lensPrice * (1 + priceModifier / 100));
}
```

---

## Task 7: Add Depot Transfer Route to Optical Shop

**Files:**
- Modify: `backend/routes/opticalShop.js`
- Modify: `backend/controllers/opticalShopController.js`

**Step 1: Add requestFromDepot endpoint to controller**

```javascript
/**
 * @desc    Request frames from depot
 * @route   POST /api/optical-shop/request-from-depot
 * @access  Private (optician, manager)
 */
exports.requestFromDepot = asyncHandler(async (req, res) => {
  const { items, priority = 'normal', reason = 'replenishment', notes } = req.body;
  const clinicId = req.user?.clinic || req.clinicId;

  if (!clinicId) {
    return res.status(400).json({ success: false, error: 'Clinic not identified' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'No items specified' });
  }

  // Find depot clinic
  const depotClinic = await Clinic.findOne({
    $or: [{ type: 'main' }, { name: /depot/i }]
  });

  if (!depotClinic) {
    return res.status(400).json({ success: false, error: 'Depot not configured' });
  }

  const destinationClinic = await Clinic.findById(clinicId);

  // Build transfer items
  const transferItems = [];
  for (const item of items) {
    const frame = await FrameInventory.findOne({
      sku: item.sku,
      isDepot: true
    });

    if (!frame) {
      return res.status(404).json({
        success: false,
        error: `Frame ${item.sku} not found in depot`
      });
    }

    transferItems.push({
      inventoryType: 'frame',
      inventoryId: frame._id,
      inventoryModel: 'FrameInventory',
      productName: `${frame.brand} ${frame.model}`,
      productSku: frame.sku,
      productDetails: `${frame.color} - ${frame.category}`,
      requestedQuantity: item.quantity
    });
  }

  // Create transfer request
  const InventoryTransfer = require('../models/InventoryTransfer');
  const transfer = await InventoryTransfer.create({
    type: 'depot-to-clinic',
    source: {
      clinic: depotClinic._id,
      isDepot: true,
      name: depotClinic.name
    },
    destination: {
      clinic: clinicId,
      name: destinationClinic.name
    },
    items: transferItems,
    status: 'requested',
    priority,
    reason,
    reasonNotes: notes,
    requestedBy: req.user.id,
    dates: { requested: new Date() },
    approvalHistory: [{
      action: 'submitted',
      performedBy: req.user.id,
      date: new Date(),
      previousStatus: 'draft',
      newStatus: 'requested'
    }]
  });

  res.status(201).json({
    success: true,
    message: 'Transfer request created',
    data: transfer
  });
});
```

**Step 2: Add route**

In `backend/routes/opticalShop.js`, add:

```javascript
// Request frames from depot
router.post('/request-from-depot',
  authorize('admin', 'optician', 'manager'),
  logCriticalOperation('OPTICAL_DEPOT_REQUEST'),
  opticalShopController.requestFromDepot
);
```

---

## Task 8: Create Frontend Depot Request Component

**Files:**
- Create: `frontend/src/components/optical/DepotRequestModal.jsx`

**Step 1: Create the component**

```jsx
import React, { useState, useEffect } from 'react';
import { X, Package, Plus, Minus, Truck, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const DepotRequestModal = ({ isOpen, onClose, onSuccess }) => {
  const [depotFrames, setDepotFrames] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchDepotFrames();
    }
  }, [isOpen]);

  const fetchDepotFrames = async () => {
    setLoading(true);
    try {
      const response = await api.get('/frame-inventory', {
        params: { isDepot: true, hasStock: true }
      });
      setDepotFrames(response.data.data || []);
    } catch (err) {
      setError('Failed to load depot inventory');
    } finally {
      setLoading(false);
    }
  };

  const addItem = (frame) => {
    const existing = selectedItems.find(i => i.sku === frame.sku);
    if (existing) {
      setSelectedItems(prev => prev.map(i =>
        i.sku === frame.sku ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setSelectedItems(prev => [...prev, {
        sku: frame.sku,
        name: `${frame.brand} ${frame.model}`,
        color: frame.color,
        quantity: 1,
        available: frame.inventory?.currentStock || 0
      }]);
    }
  };

  const updateQuantity = (sku, delta) => {
    setSelectedItems(prev => prev.map(i => {
      if (i.sku === sku) {
        const newQty = Math.max(1, Math.min(i.available, i.quantity + delta));
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const removeItem = (sku) => {
    setSelectedItems(prev => prev.filter(i => i.sku !== sku));
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      await api.post('/optical-shop/request-from-depot', {
        items: selectedItems.map(i => ({ sku: i.sku, quantity: i.quantity })),
        priority,
        reason: 'replenishment',
        notes
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Request Frames from Depot</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Left: Depot inventory */}
          <div className="w-1/2 p-4 border-r overflow-y-auto">
            <h3 className="font-medium mb-3">Depot Inventory</h3>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : (
              <div className="space-y-2">
                {depotFrames.map(frame => (
                  <div
                    key={frame._id}
                    className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
                  >
                    <div>
                      <div className="font-medium">{frame.brand} {frame.model}</div>
                      <div className="text-sm text-gray-500">
                        {frame.color} • Stock: {frame.inventory?.currentStock || 0}
                      </div>
                    </div>
                    <button
                      onClick={() => addItem(frame)}
                      className="p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Selected items */}
          <div className="w-1/2 p-4 overflow-y-auto">
            <h3 className="font-medium mb-3">Your Request</h3>

            {selectedItems.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Package className="w-8 h-8 mx-auto mb-2" />
                <p>No items selected</p>
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {selectedItems.map(item => (
                  <div key={item.sku} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.color}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.sku, -1)}
                        className="p-1 bg-gray-100 rounded"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.sku, 1)}
                        className="p-1 bg-gray-100 rounded"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeItem(item.sku)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Priority and notes */}
            <div className="space-y-3 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full border rounded p-2"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border rounded p-2"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            {error && (
              <div className="mt-3 p-2 bg-red-50 text-red-600 rounded flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedItems.length === 0 || submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : `Request ${selectedItems.length} Items`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepotRequestModal;
```

---

## Task 9: Update Optical Component Index

**Files:**
- Modify: `frontend/src/components/optical/index.js`

**Step 1: Add export**

```javascript
export { default as DepotRequestModal } from './DepotRequestModal';
```

---

## Task 10: Integrate Depot Request into Frame Inventory Page

**Files:**
- Modify: `frontend/src/pages/FrameInventory/FrameInventoryList.jsx`

**Step 1: Add import and state**

```javascript
import { DepotRequestModal } from '../../components/optical';

// Add state
const [showDepotRequest, setShowDepotRequest] = useState(false);
```

**Step 2: Add button in header**

```jsx
<button
  onClick={() => setShowDepotRequest(true)}
  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
>
  <Truck className="w-4 h-4" />
  Request from Depot
</button>
```

**Step 3: Add modal at end**

```jsx
<DepotRequestModal
  isOpen={showDepotRequest}
  onClose={() => setShowDepotRequest(false)}
  onSuccess={() => {
    setShowDepotRequest(false);
    // Optionally refresh inventory
  }}
/>
```

---

## Task 11: Verify Implementation

**Step 1: Run all scripts**

```bash
# Set clinic modifiers
node scripts/setClinicPriceModifiers.js

# Seed depot frames
node scripts/seedDepotFrames.js
```

**Step 2: Restart backend**

```bash
pkill -f "node.*server.js" && node server.js &
```

**Step 3: Test API endpoints**

```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@medflow.com","password":"admin123"}' | jq -r '.token')

# Check clinic modifiers
curl -s http://localhost:5001/api/clinics -H "Authorization: Bearer $TOKEN" | jq '.data[] | {name, pricingModifiers}'

# Check depot frames
curl -s "http://localhost:5001/api/frame-inventory?isDepot=true" -H "Authorization: Bearer $TOKEN" | jq '.count'

# Check frame prices per clinic
curl -s "http://localhost:5001/api/frame-inventory" -H "Authorization: Bearer $TOKEN" -H "X-Clinic-ID: <clinic_id>" | jq '.data[0].pricing'
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add pricingModifiers to Clinic model | Clinic.js |
| 2 | Create script to set clinic modifiers | setClinicPriceModifiers.js |
| 3 | Add clinic price helpers to FrameInventory | FrameInventory.js |
| 4 | Create depot seeder with price distribution | seedDepotFrames.js |
| 5 | Update optical shop to use clinic prices | opticalShopController.js |
| 6 | Update calculatePricing for modifiers | opticalShopController.js |
| 7 | Add depot request endpoint | opticalShop.js, controller |
| 8 | Create depot request modal | DepotRequestModal.jsx |
| 9 | Update component exports | index.js |
| 10 | Integrate into Frame Inventory page | FrameInventoryList.jsx |
| 11 | Verify implementation | Scripts + API tests |
