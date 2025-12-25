/**
 * Unified Inventory Model
 *
 * Consolidates 7 inventory types into one model using Mongoose discriminators:
 * - pharmacy (medications/drugs)
 * - frame (eyeglass frames)
 * - contact_lens (contact lenses)
 * - optical_lens (optical lenses)
 * - reagent (laboratory reagents)
 * - lab_consumable (laboratory consumables)
 * - surgical_supply (surgical supplies)
 *
 * @module models/Inventory
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ============================================================================
// SHARED SUB-SCHEMAS (used by all inventory types)
// ============================================================================

/**
 * Batch/Lot tracking sub-schema
 */
const BatchSchema = new Schema({
  lotNumber: { type: String, required: true },
  quantity: { type: Number, required: true, default: 0 },
  expirationDate: Date,
  receivedDate: { type: Date, default: Date.now },
  cost: { type: Number, default: 0 },
  supplier: { type: Schema.Types.ObjectId, ref: 'Supplier' },
  supplierName: String,
  purchaseOrderNumber: String,
  notes: String,
  status: {
    type: String,
    enum: ['available', 'reserved', 'expired', 'recalled', 'quarantine'],
    default: 'available'
  }
}, { _id: true });

/**
 * Pricing sub-schema
 */
const PricingSchema = new Schema({
  costPrice: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  wholesalePrice: { type: Number, default: 0 },
  margin: { type: Number, default: 0 },
  currency: { type: String, default: 'XAF' },
  taxRate: { type: Number, default: 0 },
  lastPriceUpdate: Date,
  priceHistory: [{
    price: Number,
    date: { type: Date, default: Date.now },
    reason: String,
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  }]
}, { _id: false });

/**
 * Supplier info sub-schema
 */
const SupplierInfoSchema = new Schema({
  supplier: { type: Schema.Types.ObjectId, ref: 'Supplier' },
  supplierName: String,
  supplierCode: String,
  leadTimeDays: { type: Number, default: 7 },
  minimumOrderQuantity: { type: Number, default: 1 },
  preferredSupplier: { type: Boolean, default: false },
  lastOrderDate: Date,
  contractPrice: Number
}, { _id: true });

/**
 * Alert sub-schema
 */
const AlertSchema = new Schema({
  type: {
    type: String,
    enum: ['low_stock', 'expiring', 'expired', 'reorder', 'price_change', 'recall', 'quality'],
    required: true
  },
  message: String,
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'warning'
  },
  createdAt: { type: Date, default: Date.now },
  acknowledgedAt: Date,
  acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  resolved: { type: Boolean, default: false }
}, { _id: true });

/**
 * Transaction/audit sub-schema
 */
const TransactionSchema = new Schema({
  type: {
    type: String,
    enum: ['received', 'dispensed', 'adjusted', 'transferred', 'returned', 'expired', 'damaged', 'reserved', 'released'],
    required: true
  },
  quantity: { type: Number, required: true },
  previousQuantity: Number,
  newQuantity: Number,
  batchId: Schema.Types.ObjectId,
  lotNumber: String,
  reason: String,
  reference: String, // prescription ID, invoice ID, etc.
  referenceType: String, // 'prescription', 'invoice', 'transfer', etc.
  performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  performedAt: { type: Date, default: Date.now },
  notes: String
}, { _id: true });

/**
 * Usage tracking sub-schema
 */
const UsageSchema = new Schema({
  totalDispensed: { type: Number, default: 0 },
  totalReceived: { type: Number, default: 0 },
  totalAdjusted: { type: Number, default: 0 },
  lastUsedDate: Date,
  lastReceivedDate: Date,
  averageMonthlyUsage: { type: Number, default: 0 },
  usageHistory: [{
    month: String, // YYYY-MM format
    dispensed: Number,
    received: Number
  }]
}, { _id: false });

/**
 * Reorder settings sub-schema
 */
const ReorderSchema = new Schema({
  autoReorder: { type: Boolean, default: false },
  reorderQuantity: { type: Number, default: 0 },
  preferredSupplier: { type: Schema.Types.ObjectId, ref: 'Supplier' },
  lastReorderDate: Date,
  pendingOrderQuantity: { type: Number, default: 0 }
}, { _id: false });

// ============================================================================
// BASE INVENTORY SCHEMA
// ============================================================================

const BaseInventorySchema = new Schema({
  // Inventory type discriminator
  inventoryType: {
    type: String,
    required: true,
    enum: ['pharmacy', 'frame', 'contact_lens', 'optical_lens', 'reagent', 'lab_consumable', 'surgical_supply'],
    index: true
  },

  // Multi-clinic support
  clinic: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true,
    index: true
  },
  isDepot: {
    type: Boolean,
    default: false,
    index: true
  },

  // Product identification
  sku: {
    type: String,
    required: true,
    index: true
  },
  barcode: {
    type: String,
    sparse: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    index: true
  },
  brand: String,
  manufacturer: String,
  description: String,
  category: {
    type: String,
    index: true
  },
  subcategory: String,

  // Core inventory tracking
  inventory: {
    currentStock: { type: Number, default: 0, min: 0 },
    reserved: { type: Number, default: 0, min: 0 },
    available: { type: Number, default: 0, min: 0 }, // currentStock - reserved
    unit: { type: String, default: 'unit' },
    minimumStock: { type: Number, default: 0 },
    reorderPoint: { type: Number, default: 0 },
    maximumStock: { type: Number, default: 1000 },
    status: {
      type: String,
      enum: ['in_stock', 'low_stock', 'out_of_stock', 'overstocked', 'discontinued'],
      default: 'in_stock',
      index: true
    }
  },

  // Batch/lot tracking
  batches: [BatchSchema],

  // Pricing
  pricing: PricingSchema,

  // Suppliers
  suppliers: [SupplierInfoSchema],

  // Reorder settings
  reorder: ReorderSchema,

  // Usage tracking
  usage: UsageSchema,

  // Alerts
  alerts: [AlertSchema],

  // Transaction history
  transactions: [TransactionSchema],

  // Location within clinic
  location: {
    zone: String,
    shelf: String,
    bin: String,
    notes: String
  },

  // Status flags
  active: { type: Boolean, default: true, index: true },
  discontinued: { type: Boolean, default: false },
  discontinuedDate: Date,
  discontinuedReason: String,

  // Type-specific data (populated by discriminators)
  typeData: Schema.Types.Mixed,

  // Audit fields
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  version: { type: Number, default: 0 }

}, {
  timestamps: true,
  discriminatorKey: 'inventoryType',
  collection: 'inventories'
});

// ============================================================================
// INDEXES
// ============================================================================

// Compound indexes for common queries
BaseInventorySchema.index({ clinic: 1, inventoryType: 1, 'inventory.status': 1 });
BaseInventorySchema.index({ clinic: 1, sku: 1 }, { unique: true });
BaseInventorySchema.index({ clinic: 1, barcode: 1 }, { sparse: true });
BaseInventorySchema.index({ clinic: 1, name: 1, brand: 1 });
BaseInventorySchema.index({ 'batches.expirationDate': 1 });
BaseInventorySchema.index({ 'inventory.currentStock': 1, 'inventory.reorderPoint': 1 });

// Text search index
BaseInventorySchema.index({
  name: 'text',
  brand: 'text',
  manufacturer: 'text',
  sku: 'text',
  barcode: 'text',
  description: 'text'
});

// Additional indexes for pharmacy and stock management queries
BaseInventorySchema.index({ clinic: 1, 'inventory.currentStock': 1 }); // Low stock queries
BaseInventorySchema.index({ inventoryType: 1, clinic: 1, 'inventory.status': 1 }); // Type-specific queries

// ============================================================================
// VIRTUALS
// ============================================================================

BaseInventorySchema.virtual('availableStock').get(function() {
  return Math.max(0, (this.inventory?.currentStock || 0) - (this.inventory?.reserved || 0));
});

BaseInventorySchema.virtual('needsReorder').get(function() {
  return (this.inventory?.currentStock || 0) <= (this.inventory?.reorderPoint || 0);
});

BaseInventorySchema.virtual('isLowStock').get(function() {
  return (this.inventory?.currentStock || 0) <= (this.inventory?.minimumStock || 0);
});

BaseInventorySchema.virtual('totalBatchQuantity').get(function() {
  if (!this.batches || this.batches.length === 0) return 0;
  return this.batches.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
});

BaseInventorySchema.virtual('expiringBatches').get(function() {
  if (!this.batches || this.batches.length === 0) return [];
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return this.batches.filter(b =>
    b.expirationDate &&
    b.expirationDate <= thirtyDaysFromNow &&
    b.quantity > 0
  );
});

// ============================================================================
// METHODS
// ============================================================================

/**
 * Adjust stock quantity
 */
BaseInventorySchema.methods.adjustStock = async function(quantity, type, reason, userId, options = {}) {
  const previousQuantity = this.inventory.currentStock;
  this.inventory.currentStock = Math.max(0, previousQuantity + quantity);
  this.inventory.available = Math.max(0, this.inventory.currentStock - this.inventory.reserved);

  // Update status
  this.updateInventoryStatus();

  // Add transaction
  this.transactions.push({
    type: type || 'adjusted',
    quantity,
    previousQuantity,
    newQuantity: this.inventory.currentStock,
    reason,
    reference: options.reference,
    referenceType: options.referenceType,
    performedBy: userId,
    notes: options.notes
  });

  // Update usage stats
  if (quantity < 0) {
    this.usage.totalDispensed = (this.usage.totalDispensed || 0) + Math.abs(quantity);
    this.usage.lastUsedDate = new Date();
  } else if (quantity > 0 && type === 'received') {
    this.usage.totalReceived = (this.usage.totalReceived || 0) + quantity;
    this.usage.lastReceivedDate = new Date();
  }

  this.updatedBy = userId;
  this.version += 1;

  return this.save();
};

/**
 * Reserve stock for an order
 */
BaseInventorySchema.methods.reserveStock = async function(quantity, reference, userId) {
  if (this.availableStock < quantity) {
    throw new Error(`Insufficient stock. Available: ${this.availableStock}, Requested: ${quantity}`);
  }

  this.inventory.reserved = (this.inventory.reserved || 0) + quantity;
  this.inventory.available = Math.max(0, this.inventory.currentStock - this.inventory.reserved);

  this.transactions.push({
    type: 'reserved',
    quantity,
    reference,
    referenceType: 'reservation',
    performedBy: userId
  });

  this.updatedBy = userId;
  this.version += 1;

  return this.save();
};

/**
 * Release reserved stock
 */
BaseInventorySchema.methods.releaseReservation = async function(quantity, reference, userId) {
  this.inventory.reserved = Math.max(0, (this.inventory.reserved || 0) - quantity);
  this.inventory.available = Math.max(0, this.inventory.currentStock - this.inventory.reserved);

  this.transactions.push({
    type: 'released',
    quantity,
    reference,
    referenceType: 'reservation',
    performedBy: userId
  });

  this.updatedBy = userId;
  this.version += 1;

  return this.save();
};

/**
 * Update inventory status based on current stock levels
 */
BaseInventorySchema.methods.updateInventoryStatus = function() {
  const stock = this.inventory.currentStock || 0;
  const min = this.inventory.minimumStock || 0;
  const max = this.inventory.maximumStock || 1000;
  const reorder = this.inventory.reorderPoint || 0;

  if (this.discontinued) {
    this.inventory.status = 'discontinued';
  } else if (stock === 0) {
    this.inventory.status = 'out_of_stock';
  } else if (stock <= min || stock <= reorder) {
    this.inventory.status = 'low_stock';
  } else if (stock > max) {
    this.inventory.status = 'overstocked';
  } else {
    this.inventory.status = 'in_stock';
  }

  return this.inventory.status;
};

/**
 * Add a new batch
 */
BaseInventorySchema.methods.addBatch = async function(batchData, userId) {
  this.batches.push(batchData);

  // Update total stock
  this.inventory.currentStock = (this.inventory.currentStock || 0) + (batchData.quantity || 0);
  this.inventory.available = Math.max(0, this.inventory.currentStock - this.inventory.reserved);
  this.updateInventoryStatus();

  // Add transaction
  this.transactions.push({
    type: 'received',
    quantity: batchData.quantity,
    previousQuantity: this.inventory.currentStock - batchData.quantity,
    newQuantity: this.inventory.currentStock,
    lotNumber: batchData.lotNumber,
    performedBy: userId,
    notes: `Batch ${batchData.lotNumber} received`
  });

  this.usage.totalReceived = (this.usage.totalReceived || 0) + (batchData.quantity || 0);
  this.usage.lastReceivedDate = new Date();

  this.updatedBy = userId;
  this.version += 1;

  return this.save();
};

/**
 * Check for expiring batches and create alerts
 */
BaseInventorySchema.methods.checkExpirations = function(daysThreshold = 30) {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

  const alerts = [];

  this.batches.forEach(batch => {
    if (batch.expirationDate && batch.quantity > 0) {
      if (batch.expirationDate <= new Date()) {
        alerts.push({
          type: 'expired',
          message: `Batch ${batch.lotNumber} has expired`,
          severity: 'critical'
        });
        batch.status = 'expired';
      } else if (batch.expirationDate <= thresholdDate) {
        alerts.push({
          type: 'expiring',
          message: `Batch ${batch.lotNumber} expires on ${batch.expirationDate.toISOString().split('T')[0]}`,
          severity: 'warning'
        });
      }
    }
  });

  // Add new alerts (avoid duplicates)
  alerts.forEach(alert => {
    const exists = this.alerts.some(a =>
      a.type === alert.type &&
      a.message === alert.message &&
      !a.resolved
    );
    if (!exists) {
      this.alerts.push(alert);
    }
  });

  return alerts;
};

// ============================================================================
// STATICS
// ============================================================================

/**
 * Get low stock items for a clinic
 */
BaseInventorySchema.statics.getLowStock = function(clinicId, inventoryType = null) {
  const query = {
    clinic: clinicId,
    active: true,
    'inventory.status': { $in: ['low_stock', 'out_of_stock'] }
  };
  if (inventoryType) query.inventoryType = inventoryType;
  return this.find(query).sort({ 'inventory.currentStock': 1 });
};

/**
 * Get expiring items
 */
BaseInventorySchema.statics.getExpiring = function(clinicId, daysThreshold = 30) {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

  return this.find({
    clinic: clinicId,
    active: true,
    'batches.expirationDate': { $lte: thresholdDate },
    'batches.quantity': { $gt: 0 }
  });
};

/**
 * Search inventory
 */
BaseInventorySchema.statics.search = function(clinicId, searchTerm, options = {}) {
  const query = {
    clinic: clinicId,
    active: true,
    $text: { $search: searchTerm }
  };

  if (options.inventoryType) query.inventoryType = options.inventoryType;
  if (options.category) query.category = options.category;

  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 50);
};

/**
 * Get inventory summary by type
 */
BaseInventorySchema.statics.getSummary = async function(clinicId) {
  return this.aggregate([
    { $match: { clinic: mongoose.Types.ObjectId(clinicId), active: true } },
    {
      $group: {
        _id: '$inventoryType',
        totalItems: { $sum: 1 },
        totalValue: { $sum: { $multiply: ['$inventory.currentStock', '$pricing.costPrice'] } },
        lowStockCount: {
          $sum: { $cond: [{ $in: ['$inventory.status', ['low_stock', 'out_of_stock']] }, 1, 0] }
        },
        outOfStockCount: {
          $sum: { $cond: [{ $eq: ['$inventory.status', 'out_of_stock'] }, 1, 0] }
        }
      }
    }
  ]);
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Pre-save: update computed fields
BaseInventorySchema.pre('save', function(next) {
  // Update available stock
  this.inventory.available = Math.max(0, (this.inventory.currentStock || 0) - (this.inventory.reserved || 0));

  // Update status
  this.updateInventoryStatus();

  // Increment version on updates
  if (!this.isNew) {
    this.version = (this.version || 0) + 1;
  }

  next();
});

// Pre-validate: ensure required fields
BaseInventorySchema.pre('validate', function(next) {
  // Generate SKU if not provided
  if (!this.sku) {
    const prefix = this.inventoryType.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase();
    this.sku = `${prefix}-${timestamp}`;
  }
  next();
});

// ============================================================================
// CREATE MODEL
// ============================================================================

const Inventory = mongoose.model('Inventory', BaseInventorySchema);

// ============================================================================
// DISCRIMINATOR SCHEMAS (Type-specific fields)
// ============================================================================

// --- PHARMACY DISCRIMINATOR ---
const PharmacySchema = new Schema({
  // Medication reference
  medication: {
    type: Schema.Types.ObjectId,
    ref: 'Drug'
  },

  // Drug-specific fields
  genericName: String,
  dosageForm: {
    type: String,
    enum: ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'patch', 'suppository', 'other']
  },
  strength: String,
  strengthUnit: String,
  routeOfAdministration: [String],

  // Controlled substance tracking
  controlled: { type: Boolean, default: false },
  controlledSchedule: String,

  // Storage requirements
  storageConditions: {
    temperature: { min: Number, max: Number },
    humidity: { min: Number, max: Number },
    lightSensitive: Boolean,
    refrigerated: Boolean
  },

  // Prescription requirements
  prescriptionRequired: { type: Boolean, default: true },

  // Therapeutic classification
  therapeuticClass: String,
  pharmacologicalClass: String,

  // Interactions and contraindications (cached from Drug model)
  interactionWarnings: [String],
  contraindications: [String]
});

const PharmacyInventory = Inventory.discriminator('pharmacy', PharmacySchema);

// --- FRAME DISCRIMINATOR ---
const FrameSchema = new Schema({
  // Frame specifications
  frameStyle: {
    type: String,
    enum: ['full_rim', 'semi_rimless', 'rimless', 'half_eye', 'safety', 'sport']
  },
  material: {
    type: String,
    enum: ['metal', 'plastic', 'titanium', 'acetate', 'carbon_fiber', 'wood', 'mixed']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'unisex', 'child']
  },

  // Dimensions
  dimensions: {
    lensWidth: Number,
    bridgeWidth: Number,
    templeLength: Number,
    lensHeight: Number,
    totalWidth: Number
  },

  // Color options
  color: String,
  colorCode: String,
  availableColors: [String],

  // Model info
  model: String,
  collection: String,
  year: Number,

  // Pricing tiers
  tier: {
    type: String,
    enum: ['economy', 'standard', 'premium', 'luxury']
  },

  // Display/trial
  isDisplaySample: { type: Boolean, default: false },

  // Images
  images: [{
    url: String,
    alt: String,
    isPrimary: Boolean
  }]
});

const FrameInventory = Inventory.discriminator('frame', FrameSchema);

// --- CONTACT LENS DISCRIMINATOR ---
const ContactLensSchema = new Schema({
  // Lens parameters
  parameters: {
    baseCurve: [Number], // Available base curves
    diameter: [Number], // Available diameters
    powerRange: {
      sphereMin: Number,
      sphereMax: Number,
      cylinderMin: Number,
      cylinderMax: Number,
      addMin: Number,
      addMax: Number
    },
    availableAxes: [Number]
  },

  // Current stock parameters (for tracking specific combinations)
  stockedParameters: [{
    baseCurve: Number,
    diameter: Number,
    sphere: Number,
    cylinder: Number,
    axis: Number,
    add: Number,
    quantity: Number
  }],

  // Lens type
  lensType: {
    type: String,
    enum: ['soft', 'rgp', 'hybrid', 'scleral', 'ortho_k']
  },

  // Wear schedule
  wearSchedule: {
    type: String,
    enum: ['daily', 'bi_weekly', 'monthly', 'quarterly', 'yearly', 'extended']
  },

  // Design
  design: {
    type: String,
    enum: ['spherical', 'toric', 'multifocal', 'bifocal', 'cosmetic', 'therapeutic']
  },

  // Material
  material: String,
  waterContent: Number,
  oxygenPermeability: Number, // Dk/t

  // Trial lenses
  isTrial: { type: Boolean, default: false },
  trialTracking: [{
    patient: { type: Schema.Types.ObjectId, ref: 'Patient' },
    dispensedDate: Date,
    parameters: Schema.Types.Mixed,
    returnedDate: Date,
    outcome: String
  }],

  // UV protection
  uvBlocking: Boolean,
  uvClass: String
});

const ContactLensInventory = Inventory.discriminator('contact_lens', ContactLensSchema);

// --- OPTICAL LENS DISCRIMINATOR ---
const OpticalLensSchema = new Schema({
  // Lens design
  design: {
    type: String,
    enum: ['single_vision', 'bifocal', 'progressive', 'occupational', 'digital']
  },

  // Lens type
  lensType: {
    type: String,
    enum: ['stock', 'semi_finished', 'finished', 'freeform']
  },

  // Material
  material: {
    type: String,
    enum: ['cr39', 'polycarbonate', 'trivex', 'hi_index_1.60', 'hi_index_1.67', 'hi_index_1.74', 'glass']
  },
  refractiveIndex: Number,

  // Power range available
  powerRange: {
    sphereMin: Number,
    sphereMax: Number,
    cylinderMin: Number,
    cylinderMax: Number,
    addMin: Number,
    addMax: Number
  },

  // Coatings
  coatings: {
    antiReflective: { type: Boolean, default: false },
    arType: String,
    scratch: { type: Boolean, default: true },
    uv: { type: Boolean, default: true },
    blueLight: { type: Boolean, default: false },
    hydrophobic: { type: Boolean, default: false },
    oleophobic: { type: Boolean, default: false }
  },

  // Special features
  photochromic: { type: Boolean, default: false },
  photochromicType: String,
  polarized: { type: Boolean, default: false },
  tinted: { type: Boolean, default: false },
  tintColor: String,
  tintPercentage: Number,

  // Diameter
  blankDiameter: Number,

  // Processing info
  surfacingRequired: Boolean,
  edgingCompatible: [String] // Compatible edging machines
});

const OpticalLensInventory = Inventory.discriminator('optical_lens', OpticalLensSchema);

// --- REAGENT DISCRIMINATOR ---
const ReagentSchema = new Schema({
  // Reagent classification
  reagentType: {
    type: String,
    enum: ['hematology', 'chemistry', 'immunology', 'microbiology', 'urinalysis', 'coagulation', 'other']
  },

  // Test association
  testCodes: [String],
  testsPerUnit: Number,

  // Storage
  storageTemperature: {
    min: Number,
    max: Number,
    unit: { type: String, default: 'C' }
  },
  lightSensitive: { type: Boolean, default: false },

  // Calibration
  requiresCalibration: { type: Boolean, default: false },
  calibrationFrequency: String,
  lastCalibrationDate: Date,

  // QC requirements
  qcRequired: { type: Boolean, default: true },
  qcFrequency: String,
  qcLevels: [String],

  // Equipment compatibility
  compatibleAnalyzers: [{
    analyzer: { type: Schema.Types.ObjectId, ref: 'Device' },
    analyzerName: String
  }],

  // Hazard info
  hazardClass: String,
  msdsAvailable: Boolean,
  msdsUrl: String
});

const ReagentInventory = Inventory.discriminator('reagent', ReagentSchema);

// --- LAB CONSUMABLE DISCRIMINATOR ---
const LabConsumableSchema = new Schema({
  // Consumable type
  consumableType: {
    type: String,
    enum: ['tubes', 'slides', 'pipettes', 'tips', 'plates', 'containers', 'swabs', 'filters', 'gloves', 'other']
  },

  // Specifications
  specifications: {
    size: String,
    volume: String,
    color: String,
    material: String,
    sterile: Boolean,
    disposable: { type: Boolean, default: true }
  },

  // Package info
  unitsPerPackage: { type: Number, default: 1 },

  // Compatible equipment
  compatibleEquipment: [String],

  // Certifications
  certifications: [String] // ISO, CE, etc.
});

const LabConsumableInventory = Inventory.discriminator('lab_consumable', LabConsumableSchema);

// --- SURGICAL SUPPLY DISCRIMINATOR ---
const SurgicalSupplySchema = new Schema({
  // Supply type
  supplyType: {
    type: String,
    enum: ['iol', 'viscoelastic', 'suture', 'blade', 'cannula', 'implant', 'instrument', 'drape', 'other']
  },

  // IOL specific
  iol: {
    manufacturer: String,
    model: String,
    powerRange: { min: Number, max: Number },
    availablePowers: [Number],
    material: String,
    design: String, // monofocal, multifocal, toric, etc.
    aConstant: Number,
    opticalDiameter: Number,
    overallLength: Number,
    hapticDesign: String
  },

  // Viscoelastic specific
  viscoelastic: {
    type: { type: String }, // cohesive, dispersive, combined
    composition: String,
    volume: Number,
    viscosity: Number
  },

  // Suture specific
  suture: {
    material: String, // nylon, vicryl, silk, etc.
    size: String, // 10-0, 9-0, etc.
    length: Number,
    needleType: String,
    absorbable: Boolean
  },

  // Implant tracking (FDA/CE requirements)
  implantInfo: {
    udi: String, // Unique Device Identifier
    lotNumber: String,
    serialNumber: String,
    implantDate: Date,
    patient: { type: Schema.Types.ObjectId, ref: 'Patient' },
    surgeon: { type: Schema.Types.ObjectId, ref: 'User' },
    procedure: { type: Schema.Types.ObjectId, ref: 'SurgeryCase' }
  },

  // Sterilization
  sterile: { type: Boolean, default: true },
  sterilizationMethod: String,
  sterilizationDate: Date,

  // Size/specifications
  size: String,
  gauge: String
});

const SurgicalSupplyInventory = Inventory.discriminator('surgical_supply', SurgicalSupplySchema);

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  Inventory,
  PharmacyInventory,
  FrameInventory,
  ContactLensInventory,
  OpticalLensInventory,
  ReagentInventory,
  LabConsumableInventory,
  SurgicalSupplyInventory,
  // Sub-schemas for external use
  BatchSchema,
  PricingSchema,
  SupplierInfoSchema,
  AlertSchema,
  TransactionSchema
};
