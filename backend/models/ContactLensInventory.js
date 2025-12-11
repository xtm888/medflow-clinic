const mongoose = require('mongoose');

const contactLensInventorySchema = new mongoose.Schema({
  // Clinic/Location reference - REQUIRED for multi-clinic support
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true,
    index: true
  },

  // Flag for depot/central warehouse items
  isDepot: {
    type: Boolean,
    default: false,
    index: true
  },

  // Lens identification
  sku: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },

  // Brand and product line
  brand: {
    type: String,
    required: true,
    index: true
  },
  productLine: {
    type: String,
    required: true // e.g., "Acuvue Oasys", "Dailies Total 1"
  },
  manufacturer: String,

  // Lens parameters (what makes each SKU unique)
  parameters: {
    baseCurve: {
      type: Number,
      required: true // e.g., 8.4, 8.6
    },
    diameter: {
      type: Number,
      required: true // e.g., 14.0, 14.2
    },
    // Power can be specific value or range for inventory purposes
    power: {
      value: Number, // Specific power if tracking individual powers
      rangeFrom: Number, // Or range if grouping
      rangeTo: Number,
      step: Number // e.g., 0.25
    },
    // For toric lenses
    cylinder: Number,
    axis: Number,
    // For multifocal
    addPower: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    // For colored lenses
    color: String
  },

  // Lens type and wear schedule
  lensType: {
    type: String,
    enum: ['spherical', 'toric', 'multifocal', 'colored', 'therapeutic'],
    default: 'spherical',
    index: true
  },
  wearSchedule: {
    type: String,
    enum: ['daily', 'bi-weekly', 'monthly', 'extended', 'yearly'],
    required: true,
    index: true
  },
  packSize: {
    type: Number,
    required: true,
    default: 30 // Units per box (e.g., 30 dailies, 6 monthlies)
  },

  // Material and features
  material: {
    type: String,
    enum: ['hydrogel', 'silicone-hydrogel', 'rigid-gas-permeable', 'hybrid']
  },
  features: [{
    type: String,
    enum: ['uv-blocking', 'moisture-retention', 'aspheric', 'high-oxygen', 'colored']
  }],
  oxygenPermeability: Number, // Dk/t value
  waterContent: Number, // Percentage

  // Stocking type
  stockingType: {
    type: String,
    enum: ['in-stock', 'on-demand', 'special-order'],
    default: 'in-stock'
  },
  typicalLeadTime: Number, // Days for on-demand orders

  // Storage location
  location: {
    store: {
      type: String,
      default: 'Main Store'
    },
    section: String,
    shelf: String,
    position: String
  },

  // Stock levels (following PharmacyInventory pattern)
  inventory: {
    currentStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    reserved: {
      type: Number,
      default: 0,
      min: 0
    },
    unit: {
      type: String,
      enum: ['boxes', 'units', 'packs'],
      default: 'boxes'
    },

    // Threshold levels
    minimumStock: {
      type: Number,
      required: true,
      default: 5
    },
    reorderPoint: {
      type: Number,
      required: true,
      default: 10
    },
    maximumStock: Number,
    optimalStock: Number,

    // Stock status
    status: {
      type: String,
      enum: ['in-stock', 'low-stock', 'out-of-stock', 'overstocked', 'on-order', 'discontinued'],
      default: 'in-stock'
    }
  },

  // Batch/Lot tracking (WITH expiration - contacts expire)
  batches: [{
    lotNumber: {
      type: String,
      required: true,
      index: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    reserved: {
      type: Number,
      default: 0,
      min: 0
    },
    receivedDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    manufactureDate: Date,
    expirationDate: {
      type: Date,
      required: true,
      index: true
    },
    purchaseOrderNumber: String,
    supplier: {
      name: String,
      contact: String,
      reference: String
    },
    cost: {
      unitCost: Number, // Per box
      totalCost: Number,
      currency: {
        type: String,
        default: 'CDF'
      }
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'recalled', 'quarantined', 'depleted'],
      default: 'active'
    },
    notes: String
  }],

  // Reservations (for GlassesOrders)
  reservations: [{
    reservationId: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['glasses-order', 'trial', 'hold'],
      required: true
    },
    eye: {
      type: String,
      enum: ['od', 'os', 'both']
    },
    reference: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'reservations.referenceModel',
      required: true
    },
    referenceModel: {
      type: String,
      enum: ['GlassesOrder'],
      default: 'GlassesOrder'
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    batches: [{
      lotNumber: String,
      quantity: Number
    }],
    reservedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reservedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      // Default: 3 days for contact lenses
      default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    },
    status: {
      type: String,
      enum: ['active', 'fulfilled', 'cancelled', 'expired'],
      default: 'active'
    },
    fulfilledAt: Date,
    notes: String
  }],

  // Pricing information
  pricing: {
    costPrice: {
      type: Number,
      required: true,
      default: 0
    },
    sellingPrice: {
      type: Number,
      required: true,
      default: 0
    },
    wholesalePrice: Number,
    margin: Number,
    currency: {
      type: String,
      default: 'CDF'
    },
    lastUpdated: Date,
    // Price per unit (calculated from box price)
    pricePerLens: Number
  },

  // Supplier information
  suppliers: [{
    name: {
      type: String,
      required: true
    },
    contact: {
      phone: String,
      email: String,
      address: String
    },
    isPrimary: Boolean,
    leadTime: Number,
    minimumOrder: Number,
    notes: String
  }],

  // Reordering
  reorder: {
    autoReorder: {
      type: Boolean,
      default: false
    },
    reorderQuantity: Number,
    lastOrderDate: Date,
    lastOrderQuantity: Number,
    expectedDeliveryDate: Date,
    onOrder: {
      type: Boolean,
      default: false
    },
    orderQuantity: Number,
    orderDate: Date,
    orderReference: String,
    supplier: String
  },

  // Usage/Sales tracking
  usage: {
    totalSold: {
      type: Number,
      default: 0
    },
    lastSoldDate: Date,
    averageMonthlySales: Number,
    salesHistory: [{
      date: Date,
      quantity: Number,
      eye: String, // 'od', 'os', or 'both'
      order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GlassesOrder'
      },
      patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient'
      },
      soldBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      lotNumber: String,
      salePrice: Number
    }]
  },

  // Alerts and notifications
  alerts: [{
    type: {
      type: String,
      enum: ['low-stock', 'out-of-stock', 'expired', 'expiring-soon', 'recalled', 'discontinued', 'overstocked']
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    message: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    resolved: {
      type: Boolean,
      default: false
    },
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Recall information
  recalls: [{
    date: Date,
    lotNumbers: [String],
    reason: String,
    severity: {
      type: String,
      enum: ['Class I', 'Class II', 'Class III']
    },
    action: String,
    resolved: Boolean,
    notes: String
  }],

  // Audit trail
  transactions: [{
    type: {
      type: String,
      enum: ['received', 'sold', 'returned', 'expired', 'damaged', 'recalled', 'adjusted', 'transferred', 'reserved', 'released', 'trial']
    },
    quantity: Number,
    lotNumber: String,
    date: {
      type: Date,
      default: Date.now
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reference: String,
    notes: String,
    balanceBefore: Number,
    balanceAfter: Number
  }],

  // Status and metadata
  active: {
    type: Boolean,
    default: true
  },

  discontinued: {
    type: Boolean,
    default: false
  },

  discontinuedDate: Date,
  discontinuedReason: String,

  notes: String,

  lastStockCheck: Date,
  lastStockCheckBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Optimistic locking
  version: {
    type: Number,
    default: 0
  }

}, {
  timestamps: true,
  optimisticConcurrency: true,
  versionKey: 'version'
});

// Indexes
contactLensInventorySchema.index({ brand: 'text', productLine: 'text', sku: 'text' });
contactLensInventorySchema.index({ lensType: 1, wearSchedule: 1, active: 1 });
contactLensInventorySchema.index({ 'inventory.status': 1 });
contactLensInventorySchema.index({ 'batches.expirationDate': 1 });
contactLensInventorySchema.index({ 'batches.lotNumber': 1 });
contactLensInventorySchema.index({ 'parameters.baseCurve': 1, 'parameters.diameter': 1 });

// Virtuals
contactLensInventorySchema.virtual('inventory.available').get(function() {
  return this.inventory.currentStock - (this.inventory.reserved || 0);
});

contactLensInventorySchema.virtual('isLowStock').get(function() {
  const available = this.inventory.currentStock - (this.inventory.reserved || 0);
  return available <= this.inventory.minimumStock && available > 0;
});

contactLensInventorySchema.virtual('isOutOfStock').get(function() {
  const available = this.inventory.currentStock - (this.inventory.reserved || 0);
  return available <= 0;
});

contactLensInventorySchema.virtual('daysToExpiry').get(function() {
  if (!this.batches || this.batches.length === 0) return null;

  const earliestExpiry = this.batches
    .filter(b => b.status === 'active' && b.quantity > 0)
    .sort((a, b) => a.expirationDate - b.expirationDate)[0];

  if (!earliestExpiry) return null;

  const now = new Date();
  const diff = earliestExpiry.expirationDate - now;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

contactLensInventorySchema.virtual('displayName').get(function() {
  let name = `${this.brand} ${this.productLine}`;
  if (this.parameters.baseCurve) name += ` BC${this.parameters.baseCurve}`;
  if (this.parameters.diameter) name += ` D${this.parameters.diameter}`;
  if (this.parameters.color) name += ` - ${this.parameters.color}`;
  return name;
});

// Methods
contactLensInventorySchema.methods.updateStock = async function(quantity, type, userId, reference, notes) {
  const transaction = {
    type,
    quantity: Math.abs(quantity),
    date: new Date(),
    performedBy: userId,
    reference,
    notes,
    balanceBefore: this.inventory.currentStock
  };

  if (['received', 'returned', 'adjusted'].includes(type)) {
    this.inventory.currentStock += Math.abs(quantity);
  } else if (['sold', 'expired', 'damaged', 'recalled', 'transferred'].includes(type)) {
    this.inventory.currentStock -= Math.abs(quantity);
  }

  transaction.balanceAfter = this.inventory.currentStock;
  this.transactions.push(transaction);
  this.updateStockStatus();
  this.checkAndCreateAlerts();

  return this.save();
};

contactLensInventorySchema.methods.addBatch = async function(batchData, userId) {
  const batch = {
    ...batchData,
    receivedDate: new Date(),
    status: 'active'
  };

  this.batches.push(batch);
  await this.updateStock(batchData.quantity, 'received', userId, batchData.lotNumber, 'New batch received');

  return this;
};

// Reserve stock for glasses orders (with FEFO - First Expiry First Out)
contactLensInventorySchema.methods.reserveStock = async function(quantity, orderId, eye, userId, session = null) {
  const available = this.inventory.currentStock - (this.inventory.reserved || 0);

  if (available < quantity) {
    throw new Error(`Insufficient available stock. Available: ${available}, Requested: ${quantity}`);
  }

  const reservationId = `CL-RES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // FEFO - First Expiry First Out (critical for contact lenses)
  const now = new Date();
  const activeBatches = this.batches
    .filter(b => b.status === 'active' && (b.quantity - (b.reserved || 0)) > 0 && b.expirationDate > now)
    .sort((a, b) => a.expirationDate - b.expirationDate);

  if (activeBatches.length === 0) {
    throw new Error('No active non-expired batches available');
  }

  let remainingToReserve = quantity;
  const reservedBatches = [];

  for (const batch of activeBatches) {
    if (remainingToReserve <= 0) break;

    const batchAvailable = batch.quantity - (batch.reserved || 0);
    const toReserveFromBatch = Math.min(remainingToReserve, batchAvailable);

    batch.reserved = (batch.reserved || 0) + toReserveFromBatch;
    remainingToReserve -= toReserveFromBatch;

    reservedBatches.push({
      lotNumber: batch.lotNumber,
      quantity: toReserveFromBatch
    });
  }

  if (remainingToReserve > 0) {
    throw new Error(`Could not reserve full quantity. Still need ${remainingToReserve} more units`);
  }

  this.reservations.push({
    reservationId,
    type: 'glasses-order',
    eye,
    reference: orderId,
    referenceModel: 'GlassesOrder',
    quantity,
    batches: reservedBatches,
    reservedBy: userId,
    status: 'active'
  });

  this.inventory.reserved = (this.inventory.reserved || 0) + quantity;

  this.transactions.push({
    type: 'reserved',
    quantity,
    date: new Date(),
    performedBy: userId,
    reference: `Order: ${orderId}`,
    notes: `Reserved for ${eye} contact lens order`,
    balanceBefore: this.inventory.currentStock,
    balanceAfter: this.inventory.currentStock
  });

  await this.save(session ? { session } : {});

  return {
    reservationId,
    quantity,
    batches: reservedBatches
  };
};

contactLensInventorySchema.methods.releaseReservation = async function(reservationId, session = null) {
  const reservation = this.reservations.find(r => r.reservationId === reservationId && r.status === 'active');

  if (!reservation) {
    throw new Error('Reservation not found or already processed');
  }

  for (const reservedBatch of reservation.batches) {
    const batch = this.batches.find(b => b.lotNumber === reservedBatch.lotNumber);
    if (batch) {
      batch.reserved = Math.max(0, (batch.reserved || 0) - reservedBatch.quantity);
    }
  }

  this.inventory.reserved = Math.max(0, (this.inventory.reserved || 0) - reservation.quantity);
  reservation.status = 'cancelled';

  this.transactions.push({
    type: 'released',
    quantity: reservation.quantity,
    date: new Date(),
    reference: `Reservation: ${reservationId}`,
    notes: 'Reservation released/cancelled',
    balanceBefore: this.inventory.currentStock,
    balanceAfter: this.inventory.currentStock
  });

  this.updateStockStatus();
  await this.save(session ? { session } : {});

  return { released: reservation.quantity };
};

contactLensInventorySchema.methods.fulfillReservation = async function(reservationId, patientId, userId, salePrice, session = null) {
  const reservation = this.reservations.find(r => r.reservationId === reservationId && r.status === 'active');

  if (!reservation) {
    throw new Error('Reservation not found or already processed');
  }

  for (const reservedBatch of reservation.batches) {
    const batch = this.batches.find(b => b.lotNumber === reservedBatch.lotNumber);
    if (batch) {
      batch.quantity -= reservedBatch.quantity;
      batch.reserved = Math.max(0, (batch.reserved || 0) - reservedBatch.quantity);

      if (batch.quantity <= 0) {
        batch.status = 'depleted';
      }
    }
  }

  this.inventory.currentStock -= reservation.quantity;
  this.inventory.reserved = Math.max(0, (this.inventory.reserved || 0) - reservation.quantity);

  reservation.status = 'fulfilled';
  reservation.fulfilledAt = new Date();

  this.usage.salesHistory.push({
    date: new Date(),
    quantity: reservation.quantity,
    eye: reservation.eye,
    order: reservation.reference,
    patient: patientId,
    soldBy: userId,
    lotNumber: reservation.batches[0]?.lotNumber,
    salePrice
  });

  this.usage.totalSold = (this.usage.totalSold || 0) + reservation.quantity;
  this.usage.lastSoldDate = new Date();

  this.transactions.push({
    type: 'sold',
    quantity: reservation.quantity,
    lotNumber: reservation.batches[0]?.lotNumber,
    date: new Date(),
    performedBy: userId,
    reference: `Order: ${reservation.reference}`,
    notes: `Contact lenses sold (${reservation.eye})`,
    balanceBefore: this.inventory.currentStock + reservation.quantity,
    balanceAfter: this.inventory.currentStock
  });

  this.updateStockStatus();
  this.checkAndCreateAlerts();

  await this.save(session ? { session } : {});

  return { sold: reservation.quantity };
};

contactLensInventorySchema.methods.sellLenses = async function(quantity, orderId, eye, patientId, userId, lotNumber, salePrice) {
  const batch = lotNumber
    ? this.batches.find(b => b.lotNumber === lotNumber && b.status === 'active')
    : this.batches
        .filter(b => b.status === 'active' && b.quantity > 0 && b.expirationDate > new Date())
        .sort((a, b) => a.expirationDate - b.expirationDate)[0];

  if (!batch) {
    throw new Error('No active non-expired batch available');
  }

  if (batch.quantity < quantity) {
    throw new Error('Insufficient quantity in batch');
  }

  batch.quantity -= quantity;
  if (batch.quantity === 0) {
    batch.status = 'depleted';
  }

  this.usage.salesHistory.push({
    date: new Date(),
    quantity,
    eye,
    order: orderId,
    patient: patientId,
    soldBy: userId,
    lotNumber: batch.lotNumber,
    salePrice
  });

  this.usage.totalSold = (this.usage.totalSold || 0) + quantity;
  this.usage.lastSoldDate = new Date();

  await this.updateStock(quantity, 'sold', userId, orderId, `Sold from lot ${batch.lotNumber}`);

  return this.save();
};

contactLensInventorySchema.methods.updateStockStatus = function() {
  const available = this.inventory.currentStock - (this.inventory.reserved || 0);

  if (this.discontinued) {
    this.inventory.status = 'discontinued';
  } else if (available <= 0) {
    this.inventory.status = 'out-of-stock';
  } else if (available <= this.inventory.minimumStock) {
    this.inventory.status = 'low-stock';
  } else if (this.inventory.maximumStock && this.inventory.currentStock > this.inventory.maximumStock) {
    this.inventory.status = 'overstocked';
  } else if (this.reorder.onOrder) {
    this.inventory.status = 'on-order';
  } else {
    this.inventory.status = 'in-stock';
  }
};

contactLensInventorySchema.methods.checkAndCreateAlerts = function() {
  const available = this.inventory.currentStock - (this.inventory.reserved || 0);

  // Low stock alert
  if (available <= this.inventory.minimumStock && available > 0) {
    const existingAlert = this.alerts.find(a => a.type === 'low-stock' && !a.resolved);
    if (!existingAlert) {
      this.alerts.push({
        type: 'low-stock',
        severity: 'medium',
        message: `Stock level (${available} available) is at or below minimum (${this.inventory.minimumStock})`,
        createdAt: new Date()
      });
    }
  }

  // Out of stock alert
  if (available <= 0) {
    const existingAlert = this.alerts.find(a => a.type === 'out-of-stock' && !a.resolved);
    if (!existingAlert) {
      this.alerts.push({
        type: 'out-of-stock',
        severity: 'high',
        message: `Contact lens ${this.brand} ${this.productLine} is out of stock`,
        createdAt: new Date()
      });
    }
  }

  // Expiring soon alert (90 days for contacts - longer warning)
  const daysToExpiry = this.daysToExpiry;
  if (daysToExpiry !== null && daysToExpiry <= 90 && daysToExpiry > 0) {
    const existingAlert = this.alerts.find(a => a.type === 'expiring-soon' && !a.resolved);
    if (!existingAlert) {
      this.alerts.push({
        type: 'expiring-soon',
        severity: daysToExpiry <= 30 ? 'high' : 'medium',
        message: `Contact lenses expiring in ${daysToExpiry} days`,
        createdAt: new Date()
      });
    }
  }

  // Expired alert
  if (daysToExpiry !== null && daysToExpiry <= 0) {
    const existingAlert = this.alerts.find(a => a.type === 'expired' && !a.resolved);
    if (!existingAlert) {
      this.alerts.push({
        type: 'expired',
        severity: 'critical',
        message: 'Contact lenses have expired',
        createdAt: new Date()
      });
    }
  }
};

contactLensInventorySchema.methods.markBatchExpired = async function(lotNumber, userId) {
  const batch = this.batches.find(b => b.lotNumber === lotNumber);

  if (!batch) {
    throw new Error('Batch not found');
  }

  const expiredQuantity = batch.quantity;
  batch.status = 'expired';
  batch.quantity = 0;

  this.alerts.push({
    type: 'expired',
    severity: 'critical',
    message: `Batch ${lotNumber} expired (${expiredQuantity} units)`,
    createdAt: new Date()
  });

  await this.updateStock(expiredQuantity, 'expired', userId, lotNumber, 'Batch expired');

  return this.save();
};

// Static methods
contactLensInventorySchema.statics.searchLenses = async function(query, options = {}) {
  const searchOptions = {
    $or: [
      { brand: new RegExp(query, 'i') },
      { productLine: new RegExp(query, 'i') },
      { sku: new RegExp(query, 'i') },
      { barcode: new RegExp(query, 'i') }
    ],
    active: true
  };

  if (options.lensType) {
    searchOptions.lensType = options.lensType;
  }

  if (options.wearSchedule) {
    searchOptions.wearSchedule = options.wearSchedule;
  }

  if (options.brand) {
    searchOptions.brand = new RegExp(options.brand, 'i');
  }

  if (options.baseCurve) {
    searchOptions['parameters.baseCurve'] = options.baseCurve;
  }

  if (options.diameter) {
    searchOptions['parameters.diameter'] = options.diameter;
  }

  if (options.inStockOnly) {
    searchOptions['inventory.currentStock'] = { $gt: 0 };
  }

  return this.find(searchOptions)
    .limit(options.limit || 50)
    .sort(options.sort || { brand: 1, productLine: 1 })
    .select('sku brand productLine parameters lensType wearSchedule packSize inventory pricing stockingType');
};

contactLensInventorySchema.statics.getLowStockItems = async function() {
  return this.find({
    $or: [
      { 'inventory.status': 'low-stock' },
      { 'inventory.status': 'out-of-stock' }
    ],
    active: true,
    discontinued: false,
    stockingType: 'in-stock'
  })
    .sort({ 'inventory.currentStock': 1 })
    .select('sku brand productLine parameters inventory pricing reorder');
};

contactLensInventorySchema.statics.getExpiringItems = async function(days = 90) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return this.find({
    'batches.expirationDate': {
      $gte: new Date(),
      $lte: futureDate
    },
    'batches.status': 'active',
    active: true
  })
    .sort({ 'batches.expirationDate': 1 })
    .select('sku brand productLine batches inventory');
};

contactLensInventorySchema.statics.getInventoryValue = async function() {
  return this.aggregate([
    { $match: { active: true, discontinued: false } },
    {
      $project: {
        totalCostValue: {
          $multiply: ['$inventory.currentStock', '$pricing.costPrice']
        },
        totalSaleValue: {
          $multiply: ['$inventory.currentStock', '$pricing.sellingPrice']
        }
      }
    },
    {
      $group: {
        _id: null,
        totalCostValue: { $sum: '$totalCostValue' },
        totalSaleValue: { $sum: '$totalSaleValue' },
        itemCount: { $sum: 1 }
      }
    }
  ]);
};

contactLensInventorySchema.statics.findMatchingLens = async function(params) {
  const query = {
    active: true,
    discontinued: false,
    'inventory.currentStock': { $gt: 0 }
  };

  if (params.brand) query.brand = new RegExp(params.brand, 'i');
  if (params.baseCurve) query['parameters.baseCurve'] = params.baseCurve;
  if (params.diameter) query['parameters.diameter'] = params.diameter;
  if (params.wearSchedule) query.wearSchedule = params.wearSchedule;

  // Power matching - check if specific value or within range
  if (params.power) {
    query.$or = [
      { 'parameters.power.value': params.power },
      {
        'parameters.power.rangeFrom': { $lte: params.power },
        'parameters.power.rangeTo': { $gte: params.power }
      }
    ];
  }

  if (params.cylinder) query['parameters.cylinder'] = params.cylinder;
  if (params.axis) query['parameters.axis'] = params.axis;
  if (params.color) query['parameters.color'] = new RegExp(params.color, 'i');

  return this.find(query)
    .sort({ 'inventory.currentStock': -1 })
    .limit(10);
};

contactLensInventorySchema.statics.getBrands = async function() {
  return this.distinct('brand', { active: true, discontinued: false });
};

contactLensInventorySchema.statics.getProductLines = async function(brand) {
  const query = { active: true, discontinued: false };
  if (brand) query.brand = brand;
  return this.distinct('productLine', query);
};

contactLensInventorySchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    { $match: { active: true, discontinued: false } },
    {
      $group: {
        _id: null,
        totalItems: { $sum: 1 },
        totalStock: { $sum: '$inventory.currentStock' },
        totalReserved: { $sum: '$inventory.reserved' },
        lowStockCount: {
          $sum: { $cond: [{ $eq: ['$inventory.status', 'low-stock'] }, 1, 0] }
        },
        outOfStockCount: {
          $sum: { $cond: [{ $eq: ['$inventory.status', 'out-of-stock'] }, 1, 0] }
        },
        totalCostValue: {
          $sum: { $multiply: ['$inventory.currentStock', '$pricing.costPrice'] }
        },
        totalSaleValue: {
          $sum: { $multiply: ['$inventory.currentStock', '$pricing.sellingPrice'] }
        }
      }
    }
  ]);

  const byType = await this.aggregate([
    { $match: { active: true, discontinued: false } },
    {
      $group: {
        _id: '$lensType',
        count: { $sum: 1 },
        totalStock: { $sum: '$inventory.currentStock' }
      }
    }
  ]);

  const byWearSchedule = await this.aggregate([
    { $match: { active: true, discontinued: false } },
    {
      $group: {
        _id: '$wearSchedule',
        count: { $sum: 1 },
        totalStock: { $sum: '$inventory.currentStock' }
      }
    }
  ]);

  const byBrand = await this.aggregate([
    { $match: { active: true, discontinued: false } },
    {
      $group: {
        _id: '$brand',
        count: { $sum: 1 },
        totalStock: { $sum: '$inventory.currentStock' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  return {
    summary: stats[0] || {},
    byType,
    byWearSchedule,
    topBrands: byBrand
  };
};

// Middleware
contactLensInventorySchema.pre('save', function(next) {
  this.updateStockStatus();
  this.checkAndCreateAlerts();

  if (this.pricing.costPrice && this.pricing.sellingPrice) {
    this.pricing.margin = ((this.pricing.sellingPrice - this.pricing.costPrice) / this.pricing.costPrice) * 100;
    this.pricing.lastUpdated = new Date();
  }

  if (this.pricing.sellingPrice && this.packSize) {
    this.pricing.pricePerLens = this.pricing.sellingPrice / this.packSize;
  }

  next();
});

module.exports = mongoose.model('ContactLensInventory', contactLensInventorySchema);
