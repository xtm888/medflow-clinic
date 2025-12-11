const mongoose = require('mongoose');

/**
 * Optical Lens Inventory Model
 * Tracks prescription lens blanks and finished lenses for glasses
 * Includes materials, coatings, designs, and power ranges
 */

const batchSchema = new mongoose.Schema({
  lotNumber: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  reserved: { type: Number, default: 0, min: 0 },
  receivedDate: { type: Date, default: Date.now },
  expirationDate: Date, // Some coated lenses have expiry
  status: {
    type: String,
    enum: ['active', 'reserved', 'depleted', 'expired', 'quarantine'],
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
  }
}, { _id: true });

const opticalLensInventorySchema = new mongoose.Schema({
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

  // Brand and Product Info
  brand: {
    type: String,
    required: true,
    trim: true
  },
  productLine: {
    type: String,
    required: true,
    trim: true
  },
  manufacturer: {
    type: String,
    trim: true
  },

  // ========================================
  // LENS TYPE & DESIGN
  // ========================================
  lensType: {
    type: String,
    enum: ['blank', 'semi-finished', 'finished', 'stock'],
    default: 'blank'
  },

  design: {
    type: String,
    enum: [
      'single-vision',
      'bifocal-ft28',
      'bifocal-ft35',
      'bifocal-round',
      'progressive',
      'office-progressive', // For computer/office use
      'degressive',
      'lenticular'
    ],
    required: true
  },

  // Progressive lens specific
  progressiveType: {
    type: String,
    enum: [
      'standard',
      'premium',
      'personalized',
      'digital-freeform',
      'occupational'
    ]
  },
  progressiveBrand: String, // e.g., "Varilux Comfort", "Hoya iD"

  // ========================================
  // MATERIAL
  // ========================================
  material: {
    type: String,
    enum: [
      'cr39',           // Standard plastic 1.50
      'cr39-1.56',      // Mid-index plastic
      'polycarbonate',  // 1.59, impact resistant
      'trivex',         // 1.53, lightweight
      'hi-index-1.60',
      'hi-index-1.67',
      'hi-index-1.74',  // Ultra thin
      'glass-1.52',     // Crown glass
      'glass-1.70',     // High-index glass
      'glass-1.80',
      'glass-1.90'
    ],
    required: true
  },

  refractiveIndex: {
    type: Number,
    min: 1.4,
    max: 2.0
  },

  // ========================================
  // COATINGS & TREATMENTS
  // ========================================
  coatings: [{
    type: String,
    enum: [
      'uncoated',
      'hard-coat',        // Basic scratch resistant
      'hmc',              // Hard Multi-Coat (AR + hard coat)
      'shmc',             // Super HMC
      'anti-reflective',
      'blue-light-filter',
      'uv400',
      'hydrophobic',      // Water repellent
      'oleophobic',       // Oil/smudge resistant
      'anti-static',
      'easy-clean'
    ]
  }],

  // Photochromic
  isPhotochromic: { type: Boolean, default: false },
  photochromicType: {
    type: String,
    enum: [
      'transitions-signature',
      'transitions-xtractive',
      'transitions-vantage',
      'sensity',          // Hoya
      'photofusion',      // Zeiss
      'photomax',
      'other'
    ]
  },
  photochromicColor: {
    type: String,
    enum: ['gray', 'brown', 'green', 'graphite-green', 'amber', 'sapphire', 'amethyst', 'emerald']
  },

  // Polarized
  isPolarized: { type: Boolean, default: false },
  polarizedColor: String,

  // Tinted
  isTinted: { type: Boolean, default: false },
  tintType: {
    type: String,
    enum: ['solid', 'gradient', 'mirror', 'fashion']
  },
  tintColor: String,
  tintDensity: Number, // Percentage 0-100

  // ========================================
  // POWER RANGE (for stock lenses)
  // ========================================
  powerRange: {
    // Sphere power
    sphereMin: { type: Number, default: -20 },
    sphereMax: { type: Number, default: +20 },
    sphereStep: { type: Number, default: 0.25 },

    // Cylinder power
    cylinderMin: { type: Number, default: 0 },
    cylinderMax: { type: Number, default: -6 },
    cylinderStep: { type: Number, default: 0.25 },

    // Add power (for progressives/bifocals)
    addMin: { type: Number, default: 0.75 },
    addMax: { type: Number, default: 3.50 },
    addStep: { type: Number, default: 0.25 }
  },

  // Specific power (for finished/stock lenses)
  specificPower: {
    sphere: Number,
    cylinder: Number,
    axis: Number,
    add: Number
  },

  // ========================================
  // PHYSICAL SPECIFICATIONS
  // ========================================
  diameter: {
    type: Number, // in mm
    required: true
  },

  minFittingHeight: Number, // For progressives

  centerThickness: Number, // in mm

  abbe: Number, // Abbe value for optical clarity

  specificGravity: Number, // Weight factor

  // ========================================
  // INVENTORY TRACKING
  // ========================================
  inventory: {
    currentStock: { type: Number, default: 0, min: 0 },
    reserved: { type: Number, default: 0, min: 0 },
    available: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: 'pairs' }, // pairs, singles
    minimumStock: { type: Number, default: 5 },
    reorderPoint: { type: Number, default: 10 },
    reorderQuantity: { type: Number, default: 20 },
    status: {
      type: String,
      enum: ['in-stock', 'low-stock', 'out-of-stock', 'discontinued', 'on-order'],
      default: 'in-stock'
    },
    lastStockCheck: Date,
    lastReorder: Date
  },

  // Batch tracking (FIFO for expiring items)
  batches: [batchSchema],

  // ========================================
  // PRICING
  // ========================================
  pricing: {
    costPrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    margin: { type: Number, default: 0 },
    currency: { type: String, default: 'CDF' },

    // Tiered pricing based on power
    powerSurcharges: [{
      powerType: { type: String, enum: ['sphere', 'cylinder', 'add'] },
      threshold: Number, // e.g., > +/-6.00
      surcharge: Number,
      surchargeType: { type: String, enum: ['fixed', 'percentage'] }
    }],

    // Coating add-on prices
    coatingPrices: {
      hmc: { type: Number, default: 0 },
      shmc: { type: Number, default: 0 },
      blueLightFilter: { type: Number, default: 0 },
      photochromic: { type: Number, default: 0 },
      polarized: { type: Number, default: 0 }
    }
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
  // METADATA
  // ========================================
  category: {
    type: String,
    enum: ['standard', 'premium', 'economy', 'specialty'],
    default: 'standard'
  },

  features: [String], // e.g., ['UV400', 'Impact Resistant', 'Lightweight']

  compatibleFrameTypes: [{
    type: String,
    enum: ['full-rim', 'half-rim', 'rimless', 'sport', 'safety']
  }],

  // Lab processing info
  labProcessing: {
    surfacingRequired: { type: Boolean, default: true }, // For blanks
    edgingDifficulty: {
      type: String,
      enum: ['easy', 'medium', 'difficult']
    },
    specialInstructions: String
  },

  // Status
  active: { type: Boolean, default: true },
  discontinued: { type: Boolean, default: false },
  discontinuedDate: Date,
  replacementSku: String,

  // Usage tracking
  usage: {
    totalSold: { type: Number, default: 0 },
    totalReturned: { type: Number, default: 0 },
    lastSold: Date,
    averageMonthlyUsage: Number
  },

  // Alerts
  alerts: [{
    type: {
      type: String,
      enum: ['low-stock', 'expiring', 'reorder', 'discontinued']
    },
    message: String,
    createdAt: { type: Date, default: Date.now },
    acknowledged: { type: Boolean, default: false },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

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
opticalLensInventorySchema.index({ clinic: 1, sku: 1 });
opticalLensInventorySchema.index({ clinic: 1, brand: 1 });
opticalLensInventorySchema.index({ clinic: 1, material: 1, design: 1 });
opticalLensInventorySchema.index({ clinic: 1, 'inventory.status': 1 });
opticalLensInventorySchema.index({ 'inventory.currentStock': 1 });
opticalLensInventorySchema.index({ isPhotochromic: 1 });
opticalLensInventorySchema.index({ isPolarized: 1 });

// ========================================
// VIRTUALS
// ========================================
opticalLensInventorySchema.virtual('displayName').get(function() {
  let name = `${this.brand} ${this.productLine}`;
  if (this.material) name += ` ${this.material.toUpperCase()}`;
  if (this.isPhotochromic) name += ` ${this.photochromicType || 'Photochromic'}`;
  return name;
});

opticalLensInventorySchema.virtual('isLowStock').get(function() {
  return this.inventory.currentStock <= this.inventory.minimumStock;
});

opticalLensInventorySchema.virtual('isOutOfStock').get(function() {
  return this.inventory.currentStock === 0;
});

opticalLensInventorySchema.virtual('availableStock').get(function() {
  return Math.max(0, this.inventory.currentStock - this.inventory.reserved);
});

// ========================================
// PRE-SAVE HOOKS
// ========================================
opticalLensInventorySchema.pre('save', function(next) {
  // Calculate available stock
  this.inventory.available = Math.max(0, this.inventory.currentStock - this.inventory.reserved);

  // Update status based on stock levels
  if (this.inventory.currentStock === 0) {
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

  // Set refractive index based on material if not set
  if (!this.refractiveIndex) {
    const indexMap = {
      'cr39': 1.50,
      'cr39-1.56': 1.56,
      'polycarbonate': 1.59,
      'trivex': 1.53,
      'hi-index-1.60': 1.60,
      'hi-index-1.67': 1.67,
      'hi-index-1.74': 1.74,
      'glass-1.52': 1.52,
      'glass-1.70': 1.70,
      'glass-1.80': 1.80,
      'glass-1.90': 1.90
    };
    this.refractiveIndex = indexMap[this.material] || 1.50;
  }

  this.version += 1;
  next();
});

// ========================================
// STATIC METHODS
// ========================================

// Find lenses by specifications
opticalLensInventorySchema.statics.findBySpecs = function(clinic, specs) {
  const query = { clinic, active: true };

  if (specs.material) query.material = specs.material;
  if (specs.design) query.design = specs.design;
  if (specs.isPhotochromic !== undefined) query.isPhotochromic = specs.isPhotochromic;
  if (specs.isPolarized !== undefined) query.isPolarized = specs.isPolarized;
  if (specs.coatings && specs.coatings.length) {
    query.coatings = { $all: specs.coatings };
  }

  return this.find(query).sort({ 'pricing.sellingPrice': 1 });
};

// Get low stock items
opticalLensInventorySchema.statics.getLowStock = function(clinic) {
  return this.find({
    clinic,
    active: true,
    $expr: { $lte: ['$inventory.currentStock', '$inventory.minimumStock'] }
  }).sort({ 'inventory.currentStock': 1 });
};

// ========================================
// INSTANCE METHODS
// ========================================

// Reserve stock
// @param {number} quantity - Amount to reserve
// @param {string} orderId - Optional order reference
// @param {Session} session - Optional MongoDB session for transactions
opticalLensInventorySchema.methods.reserveStock = async function(quantity, orderId = null, session = null) {
  if (this.availableStock < quantity) {
    throw new Error('Insufficient stock available');
  }

  this.inventory.reserved += quantity;

  // Find oldest batch with stock (FIFO)
  let remaining = quantity;
  for (const batch of this.batches.filter(b => b.status === 'active' && b.quantity - b.reserved > 0)) {
    const available = batch.quantity - batch.reserved;
    const toReserve = Math.min(available, remaining);
    batch.reserved += toReserve;
    remaining -= toReserve;
    if (remaining <= 0) break;
  }

  await this.save(session ? { session } : {});
  return { success: true, reserved: quantity, orderId };
};

// Release reserved stock (for order cancellation)
// @param {number} quantity - Amount to release
// @param {Session} session - Optional MongoDB session for transactions
opticalLensInventorySchema.methods.releaseReservation = async function(quantity, session = null) {
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

  await this.save(session ? { session } : {});
  return { success: true, released: toRelease };
};

// Fulfill reservation (deduct stock)
// @param {number} quantity - Amount to fulfill
// @param {Session} session - Optional MongoDB session for transactions
opticalLensInventorySchema.methods.fulfillReservation = async function(quantity, session = null) {
  if (this.inventory.reserved < quantity) {
    throw new Error('Not enough reserved stock to fulfill');
  }

  this.inventory.currentStock -= quantity;
  this.inventory.reserved -= quantity;

  // Deduct from batches
  let remaining = quantity;
  for (const batch of this.batches.filter(b => b.reserved > 0)) {
    const deduct = Math.min(batch.reserved, remaining);
    batch.quantity -= deduct;
    batch.reserved -= deduct;
    if (batch.quantity <= 0) batch.status = 'depleted';
    remaining -= deduct;
    if (remaining <= 0) break;
  }

  this.usage.totalSold += quantity;
  this.usage.lastSold = new Date();

  await this.save(session ? { session } : {});
  return { success: true, fulfilled: quantity };
};

module.exports = mongoose.model('OpticalLensInventory', opticalLensInventorySchema);
