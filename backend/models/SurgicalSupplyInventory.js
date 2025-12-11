const mongoose = require('mongoose');

/**
 * Surgical Supply Inventory Model
 * Tracks surgical supplies, instruments, and IOLs for ophthalmology surgery center
 * Includes sterile packs, sutures, viscoelastic, IOLs, and consumables
 */

const batchSchema = new mongoose.Schema({
  lotNumber: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  reserved: { type: Number, default: 0, min: 0 },
  receivedDate: { type: Date, default: Date.now },
  expirationDate: { type: Date, required: true }, // Critical for surgical items
  sterilizationDate: Date, // For sterilizable instruments
  sterilizationExpiry: Date,
  status: {
    type: String,
    enum: ['active', 'reserved', 'depleted', 'expired', 'quarantine', 'recalled'],
    default: 'active'
  },
  cost: {
    unitCost: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    currency: { type: String, default: 'CDF' }
  },
  supplier: {
    name: String,
    invoiceNumber: String
  },
  traceability: {
    // For regulatory compliance
    manufacturerLot: String,
    serialNumber: String, // For implants like IOLs
    udi: String // Unique Device Identifier
  }
}, { _id: true });

const surgicalSupplyInventorySchema = new mongoose.Schema({
  // Clinic association
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  isDepot: { type: Boolean, default: false },

  // Identification
  sku: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  barcode: String,

  // ========================================
  // CATEGORY & TYPE
  // ========================================
  category: {
    type: String,
    enum: [
      'iol',                    // Intraocular Lenses
      'viscoelastic',           // OVD - Ophthalmic Viscosurgical Devices
      'suture',                 // Surgical sutures
      'blade-knife',            // Surgical blades and knives
      'cannula',                // Cannulas and needles
      'phaco-consumable',       // Phaco tips, tubing, cassettes
      'sterile-pack',           // Pre-packaged sterile surgical packs
      'drape',                  // Surgical drapes
      'implant-accessory',      // IOL injectors, cartridges
      'intravitreal',           // Intravitreal injection supplies
      'laser-consumable',       // Laser surgery consumables
      'instrument',             // Reusable surgical instruments
      'sterilization-supply',   // Sterilization indicators, wraps
      'surgical-consumable'     // General surgical consumables
    ],
    required: true
  },

  // ========================================
  // PRODUCT IDENTIFICATION
  // ========================================
  brand: {
    type: String,
    required: true,
    trim: true
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },
  model: String,
  manufacturer: {
    type: String,
    required: true,
    trim: true
  },

  // ========================================
  // IOL SPECIFIC FIELDS
  // ========================================
  iol: {
    // Only for category='iol'
    type: {
      type: String,
      enum: ['monofocal', 'multifocal', 'toric', 'toric-multifocal', 'edof', 'accommodating', 'phakic']
    },
    material: {
      type: String,
      enum: ['hydrophobic-acrylic', 'hydrophilic-acrylic', 'silicone', 'pmma', 'collamer']
    },
    design: {
      type: String,
      enum: ['1-piece', '3-piece', 'plate-haptic']
    },
    optic: {
      diameter: Number, // mm
      type: { type: String, enum: ['spherical', 'aspheric', 'aberration-free'] }
    },
    haptic: {
      design: String,
      angulation: Number // degrees
    },
    aConstant: Number, // For IOL power calculation
    surgeonFactor: Number,

    // Power range available
    powerRange: {
      min: Number, // e.g., 0
      max: Number, // e.g., 34
      step: { type: Number, default: 0.5 }
    },

    // Specific power (for stock IOLs with specific power)
    power: Number,
    cylinderPower: Number, // For toric IOLs
    axis: Number,

    // Implantation specs
    incisionSize: Number, // Minimum incision size in mm
    injectorCompatible: [String], // Compatible injector models
    uvBlocking: { type: Boolean, default: true },
    blueBlocking: Boolean
  },

  // ========================================
  // VISCOELASTIC SPECIFIC
  // ========================================
  viscoelastic: {
    type: {
      type: String,
      enum: ['cohesive', 'dispersive', 'viscoadaptive', 'combination']
    },
    volume: Number, // ml
    concentration: Number, // %
    molecularWeight: String, // High, Low, etc.
    composition: [String] // e.g., ['sodium hyaluronate', 'chondroitin sulfate']
  },

  // ========================================
  // SUTURE SPECIFIC
  // ========================================
  suture: {
    material: {
      type: String,
      enum: ['nylon', 'silk', 'vicryl', 'prolene', 'mersilene', 'chromic-gut']
    },
    size: String, // e.g., '10-0', '9-0', '8-0'
    length: Number, // cm
    needleType: {
      type: String,
      enum: ['spatula', 'tapered', 'cutting', 'reverse-cutting']
    },
    needleSize: String, // e.g., '6mm', '8mm'
    absorbable: Boolean,
    color: String
  },

  // ========================================
  // INSTRUMENT SPECIFIC
  // ========================================
  instrument: {
    type: {
      type: String,
      enum: ['forceps', 'scissors', 'speculum', 'cannula', 'hook', 'spatula', 'marker', 'caliper', 'other']
    },
    material: {
      type: String,
      enum: ['titanium', 'stainless-steel', 'plastic-disposable']
    },
    reusable: { type: Boolean, default: true },
    maxSterilizations: Number, // For reusable items
    currentSterilizations: { type: Number, default: 0 }
  },

  // ========================================
  // PHACO CONSUMABLE SPECIFIC
  // ========================================
  phacoConsumable: {
    type: {
      type: String,
      enum: ['phaco-tip', 'irrigation-sleeve', 'tubing-pack', 'cassette', 'test-chamber']
    },
    compatibility: [String], // Compatible phaco machine models
    angle: Number, // For tips (degrees)
    gaugeSize: String
  },

  // ========================================
  // GENERAL SPECIFICATIONS
  // ========================================
  specifications: {
    size: String,
    dimensions: String,
    volume: String,
    weight: String,
    sterile: { type: Boolean, default: true },
    singleUse: { type: Boolean, default: true },
    latexFree: { type: Boolean, default: true }
  },

  // Regulatory
  regulatory: {
    ceMarking: Boolean,
    fdaApproved: Boolean,
    registrationNumber: String,
    classificationClass: {
      type: String,
      enum: ['I', 'IIa', 'IIb', 'III'] // Medical device classification
    }
  },

  // ========================================
  // INVENTORY TRACKING
  // ========================================
  inventory: {
    currentStock: { type: Number, default: 0, min: 0 },
    reserved: { type: Number, default: 0, min: 0 },
    available: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: 'units' },
    minimumStock: { type: Number, default: 2 },
    reorderPoint: { type: Number, default: 5 },
    reorderQuantity: { type: Number, default: 10 },
    status: {
      type: String,
      enum: ['in-stock', 'low-stock', 'out-of-stock', 'discontinued', 'on-order', 'expired'],
      default: 'in-stock'
    },
    lastStockCheck: Date,
    lastReorder: Date,
    // Critical expiry tracking
    nearestExpiry: Date,
    expiringWithin30Days: { type: Number, default: 0 },
    expiredUnits: { type: Number, default: 0 }
  },

  // Batch tracking (FEFO - First Expiry First Out for surgical items)
  batches: [batchSchema],

  // ========================================
  // PRICING
  // ========================================
  pricing: {
    costPrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    margin: { type: Number, default: 0 },
    currency: { type: String, default: 'CDF' },
    insuranceReimbursement: Number // Expected reimbursement amount
  },

  // ========================================
  // SUPPLIER INFO
  // ========================================
  suppliers: [{
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier'
    },
    supplierName: String,
    supplierSku: String,
    isPreferred: { type: Boolean, default: false },
    leadTimeDays: Number,
    minimumOrderQuantity: Number,
    lastOrderDate: Date,
    lastPrice: Number
  }],

  // ========================================
  // USAGE TRACKING
  // ========================================
  usage: {
    totalUsed: { type: Number, default: 0 },
    totalWasted: { type: Number, default: 0 },
    lastUsed: Date,
    averageMonthlyUsage: Number,
    usageHistory: [{
      surgery: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SurgeryCase'
      },
      patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient'
      },
      quantity: Number,
      batchLotNumber: String,
      serialNumber: String, // For IOLs
      usedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      usedAt: { type: Date, default: Date.now },
      outcome: {
        type: String,
        enum: ['successful', 'complication', 'wasted', 'defective']
      },
      notes: String
    }]
  },

  // ========================================
  // ALERTS
  // ========================================
  alerts: [{
    type: {
      type: String,
      enum: ['low-stock', 'expiring-soon', 'expired', 'reorder', 'recall', 'sterilization-due']
    },
    message: String,
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'warning'
    },
    createdAt: { type: Date, default: Date.now },
    acknowledged: { type: Boolean, default: false },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    acknowledgedAt: Date
  }],

  // ========================================
  // METADATA
  // ========================================
  active: { type: Boolean, default: true },
  discontinued: { type: Boolean, default: false },
  discontinuedDate: Date,
  replacementSku: String,

  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  version: { type: Number, default: 0 }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ========================================
// INDEXES
// ========================================
surgicalSupplyInventorySchema.index({ clinic: 1, sku: 1 });
surgicalSupplyInventorySchema.index({ clinic: 1, category: 1 });
surgicalSupplyInventorySchema.index({ clinic: 1, 'inventory.status': 1 });
surgicalSupplyInventorySchema.index({ 'inventory.nearestExpiry': 1 });
surgicalSupplyInventorySchema.index({ 'iol.type': 1 });
surgicalSupplyInventorySchema.index({ 'iol.power': 1 });
surgicalSupplyInventorySchema.index({ 'batches.expirationDate': 1 });
surgicalSupplyInventorySchema.index({ 'batches.serialNumber': 1 });

// ========================================
// VIRTUALS
// ========================================
surgicalSupplyInventorySchema.virtual('displayName').get(function() {
  return `${this.brand} ${this.productName}${this.model ? ' ' + this.model : ''}`;
});

surgicalSupplyInventorySchema.virtual('isLowStock').get(function() {
  return this.inventory.currentStock <= this.inventory.minimumStock;
});

surgicalSupplyInventorySchema.virtual('availableStock').get(function() {
  return Math.max(0, this.inventory.currentStock - this.inventory.reserved);
});

surgicalSupplyInventorySchema.virtual('hasExpiringSoon').get(function() {
  if (!this.inventory.nearestExpiry) return false;
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return this.inventory.nearestExpiry <= thirtyDaysFromNow;
});

// ========================================
// PRE-SAVE HOOKS
// ========================================
surgicalSupplyInventorySchema.pre('save', function(next) {
  // Calculate available stock
  this.inventory.available = Math.max(0, this.inventory.currentStock - this.inventory.reserved);

  // Update status based on stock and expiry
  if (this.inventory.expiredUnits > 0 && this.inventory.currentStock === this.inventory.expiredUnits) {
    this.inventory.status = 'expired';
  } else if (this.inventory.currentStock === 0) {
    this.inventory.status = 'out-of-stock';
  } else if (this.inventory.currentStock <= this.inventory.minimumStock) {
    this.inventory.status = 'low-stock';
  } else {
    this.inventory.status = 'in-stock';
  }

  // Calculate margin
  if (this.pricing.sellingPrice > 0 && this.pricing.costPrice > 0) {
    this.pricing.margin = Math.round(
      ((this.pricing.sellingPrice - this.pricing.costPrice) / this.pricing.costPrice) * 100
    );
  }

  // Update nearest expiry from batches
  if (this.batches && this.batches.length > 0) {
    const activeBatches = this.batches.filter(b =>
      b.status === 'active' && b.quantity > 0 && b.expirationDate
    );
    if (activeBatches.length > 0) {
      activeBatches.sort((a, b) => a.expirationDate - b.expirationDate);
      this.inventory.nearestExpiry = activeBatches[0].expirationDate;
    }

    // Count expiring soon and expired
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    this.inventory.expiringWithin30Days = 0;
    this.inventory.expiredUnits = 0;

    for (const batch of this.batches) {
      if (batch.expirationDate <= now) {
        this.inventory.expiredUnits += batch.quantity;
        batch.status = 'expired';
      } else if (batch.expirationDate <= thirtyDaysFromNow) {
        this.inventory.expiringWithin30Days += batch.quantity;
      }
    }
  }

  this.version += 1;
  next();
});

// ========================================
// STATIC METHODS
// ========================================

// Find IOLs by power
surgicalSupplyInventorySchema.statics.findIOLByPower = function(clinic, power, type) {
  const query = {
    clinic,
    category: 'iol',
    active: true,
    'inventory.currentStock': { $gt: 0 }
  };

  if (power) {
    query['iol.power'] = power;
  }
  if (type) {
    query['iol.type'] = type;
  }

  return this.find(query)
    .sort({ 'inventory.nearestExpiry': 1 }) // FEFO
    .lean();
};

// Get expiring items
surgicalSupplyInventorySchema.statics.getExpiringSoon = function(clinic, days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return this.find({
    clinic,
    active: true,
    'inventory.nearestExpiry': { $lte: futureDate, $gt: new Date() }
  })
    .sort({ 'inventory.nearestExpiry': 1 })
    .lean();
};

// Get low stock items
surgicalSupplyInventorySchema.statics.getLowStock = function(clinic) {
  return this.find({
    clinic,
    active: true,
    $expr: { $lte: ['$inventory.currentStock', '$inventory.minimumStock'] }
  }).sort({ 'inventory.currentStock': 1 });
};

// ========================================
// INSTANCE METHODS
// ========================================

// Reserve for surgery
surgicalSupplyInventorySchema.methods.reserveForSurgery = async function(quantity, surgeryId, userId) {
  if (this.availableStock < quantity) {
    throw new Error('Insufficient stock available');
  }

  this.inventory.reserved += quantity;

  // Reserve from oldest batch first (FEFO)
  let remaining = quantity;
  for (const batch of this.batches.filter(b => b.status === 'active' && b.quantity - b.reserved > 0)) {
    const available = batch.quantity - batch.reserved;
    const toReserve = Math.min(available, remaining);
    batch.reserved += toReserve;
    remaining -= toReserve;
    if (remaining <= 0) break;
  }

  await this.save();
  return { success: true, reserved: quantity, reservationId: `SUR-${Date.now()}` };
};

// Use for surgery (consume)
surgicalSupplyInventorySchema.methods.useForSurgery = async function(quantity, surgeryId, patientId, userId, serialNumber, lotNumber) {
  if (this.inventory.reserved < quantity) {
    throw new Error('Not enough reserved stock');
  }

  this.inventory.currentStock -= quantity;
  this.inventory.reserved -= quantity;

  // Consume from oldest batch first (FEFO)
  let remaining = quantity;
  let consumedBatch = null;
  for (const batch of this.batches.filter(b => b.reserved > 0)) {
    const consume = Math.min(batch.reserved, remaining);
    batch.quantity -= consume;
    batch.reserved -= consume;
    if (batch.quantity <= 0) batch.status = 'depleted';
    remaining -= consume;
    consumedBatch = batch;
    if (remaining <= 0) break;
  }

  // Record usage
  this.usage.totalUsed += quantity;
  this.usage.lastUsed = new Date();
  this.usage.usageHistory.push({
    surgery: surgeryId,
    patient: patientId,
    quantity,
    batchLotNumber: lotNumber || consumedBatch?.lotNumber,
    serialNumber: serialNumber || consumedBatch?.traceability?.serialNumber,
    usedBy: userId,
    usedAt: new Date(),
    outcome: 'successful'
  });

  await this.save();
  return { success: true, consumed: quantity };
};

// Release reservation
surgicalSupplyInventorySchema.methods.releaseReservation = async function(quantity) {
  const toRelease = Math.min(quantity, this.inventory.reserved);
  this.inventory.reserved -= toRelease;

  // Release from batches
  let remaining = toRelease;
  for (const batch of this.batches.filter(b => b.reserved > 0)) {
    const release = Math.min(batch.reserved, remaining);
    batch.reserved -= release;
    remaining -= release;
    if (remaining <= 0) break;
  }

  await this.save();
  return { success: true, released: toRelease };
};

// Check IOL availability by power
surgicalSupplyInventorySchema.methods.checkIOLPowerAvailability = function(power) {
  if (this.category !== 'iol') return false;

  if (this.iol.power) {
    // Specific power IOL
    return this.iol.power === power && this.availableStock > 0;
  } else if (this.iol.powerRange) {
    // Power range IOL
    return power >= this.iol.powerRange.min &&
           power <= this.iol.powerRange.max &&
           this.availableStock > 0;
  }
  return false;
};

module.exports = mongoose.model('SurgicalSupplyInventory', surgicalSupplyInventorySchema);
