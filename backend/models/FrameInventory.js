const mongoose = require('mongoose');

const frameInventorySchema = new mongoose.Schema({
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

  // Frame identification (SKU + Brand/Model/Color/Size)
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

  // Frame details
  brand: {
    type: String,
    required: true,
    index: true
  },
  model: {
    type: String,
    required: true
  },
  color: {
    type: String,
    required: true
  },
  colorCode: String,
  size: String, // e.g., "52-18-140" (lens width - bridge - temple)

  // Categorization
  category: {
    type: String,
    enum: ['economic', 'standard', 'premium', 'luxury', 'children', 'sport'],
    default: 'standard',
    index: true
  },
  material: {
    type: String,
    enum: ['metal', 'plastic', 'titanium', 'acetate', 'tr90', 'wood', 'carbon-fiber', 'stainless-steel', 'memory-metal', 'mixed'],
    default: 'plastic'
  },
  frameType: {
    type: String,
    enum: ['full-rim', 'half-rim', 'rimless'],
    default: 'full-rim'
  },
  gender: {
    type: String,
    enum: ['unisex', 'men', 'women', 'children'],
    default: 'unisex'
  },
  style: {
    type: String,
    enum: ['classic', 'modern', 'vintage', 'sport', 'fashion', 'professional'],
    default: 'classic'
  },

  // Product images (catalog photos from manufacturer/supplier)
  images: [{
    url: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['front', 'side', 'folded', 'detail', 'worn', 'other'],
      default: 'front'
    },
    isPrimary: {
      type: Boolean,
      default: false
    },
    alt: String
  }],

  // Frame dimensions (for fitting)
  dimensions: {
    lensWidth: Number,      // mm
    bridgeWidth: Number,    // mm
    templeLength: Number,   // mm
    lensHeight: Number,     // mm
    frameWidth: Number      // mm (total width)
  },

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

  // Stock levels (following PharmacyInventory pattern exactly)
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
      enum: ['units', 'pieces', 'pairs'],
      default: 'units'
    },

    // Threshold levels
    minimumStock: {
      type: Number,
      required: true,
      default: 2
    },
    reorderPoint: {
      type: Number,
      required: true,
      default: 5
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

  // Batch/Lot tracking (simplified - no expiration for frames)
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
    purchaseOrderNumber: String,
    supplier: {
      name: String,
      contact: String,
      reference: String
    },
    cost: {
      unitCost: Number,
      totalCost: Number,
      currency: {
        type: String,
        default: 'CDF'
      }
    },
    status: {
      type: String,
      enum: ['active', 'damaged', 'returned', 'depleted'],
      default: 'active'
    },
    warrantyExpiry: Date, // Optional warranty tracking
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
      enum: ['glasses-order', 'hold', 'display'],
      required: true
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
      // Default: 7 days for frames (longer than medications)
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
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
    margin: Number, // Percentage
    currency: {
      type: String,
      default: 'CDF'
    },
    lastUpdated: Date
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
    leadTime: Number, // Days
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
      enum: ['low-stock', 'out-of-stock', 'damaged', 'discontinued', 'overstocked']
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

  // Audit trail
  transactions: [{
    type: {
      type: String,
      enum: ['received', 'sold', 'returned', 'damaged', 'adjusted', 'transferred', 'reserved', 'released']
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

  // Optimistic locking - prevents lost updates from concurrent modifications
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
frameInventorySchema.index({ brand: 'text', model: 'text', sku: 'text' });
frameInventorySchema.index({ category: 1, active: 1 });
frameInventorySchema.index({ 'inventory.status': 1 });
frameInventorySchema.index({ 'batches.lotNumber': 1 });
frameInventorySchema.index({ brand: 1, model: 1, color: 1 });

// Virtuals
frameInventorySchema.virtual('inventory.available').get(function() {
  return this.inventory.currentStock - (this.inventory.reserved || 0);
});

frameInventorySchema.virtual('isLowStock').get(function() {
  const available = this.inventory.currentStock - (this.inventory.reserved || 0);
  return available <= this.inventory.minimumStock && available > 0;
});

frameInventorySchema.virtual('isOutOfStock').get(function() {
  const available = this.inventory.currentStock - (this.inventory.reserved || 0);
  return available <= 0;
});

frameInventorySchema.virtual('displayName').get(function() {
  return `${this.brand} ${this.model} - ${this.color}`;
});

// Methods
frameInventorySchema.methods.updateStock = async function(quantity, type, userId, reference, notes) {
  const transaction = {
    type,
    quantity: Math.abs(quantity),
    date: new Date(),
    performedBy: userId,
    reference,
    notes,
    balanceBefore: this.inventory.currentStock
  };

  // Update stock based on transaction type
  if (['received', 'returned', 'adjusted'].includes(type)) {
    this.inventory.currentStock += Math.abs(quantity);
  } else if (['sold', 'damaged', 'transferred'].includes(type)) {
    this.inventory.currentStock -= Math.abs(quantity);
  }

  transaction.balanceAfter = this.inventory.currentStock;

  // Add transaction to history
  this.transactions.push(transaction);

  // Update stock status
  this.updateStockStatus();

  // Check and create alerts
  this.checkAndCreateAlerts();

  return this.save();
};

frameInventorySchema.methods.addBatch = async function(batchData, userId) {
  const batch = {
    ...batchData,
    receivedDate: new Date(),
    status: 'active'
  };

  this.batches.push(batch);

  // Add transaction
  await this.updateStock(batchData.quantity, 'received', userId, batchData.lotNumber, 'New batch received');

  // CRITICAL FIX: Actually save the document to persist changes
  return this.save();
};

// Reserve stock for glasses orders (with transaction support)
frameInventorySchema.methods.reserveStock = async function(quantity, orderId, userId, session = null) {
  const available = this.inventory.currentStock - (this.inventory.reserved || 0);

  if (available < quantity) {
    throw new Error(`Insufficient available stock. Available: ${available}, Requested: ${quantity}`);
  }

  // Generate reservation ID
  const reservationId = `FRM-RES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Find batches to reserve from (FIFO - First In First Out for frames)
  const activeBatches = this.batches
    .filter(b => b.status === 'active' && (b.quantity - (b.reserved || 0)) > 0)
    .sort((a, b) => a.receivedDate - b.receivedDate);

  if (activeBatches.length === 0) {
    throw new Error('No active batches available');
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

  // Create reservation record
  this.reservations.push({
    reservationId,
    type: 'glasses-order',
    reference: orderId,
    referenceModel: 'GlassesOrder',
    quantity,
    batches: reservedBatches,
    reservedBy: userId,
    status: 'active'
  });

  // Update total reserved
  this.inventory.reserved = (this.inventory.reserved || 0) + quantity;

  // Add transaction
  this.transactions.push({
    type: 'reserved',
    quantity,
    date: new Date(),
    performedBy: userId,
    reference: `Order: ${orderId}`,
    notes: `Reserved for glasses order`,
    balanceBefore: this.inventory.currentStock,
    balanceAfter: this.inventory.currentStock
  });

  // Use session for save if provided (transaction support)
  await this.save(session ? { session } : {});

  return {
    reservationId,
    quantity,
    batches: reservedBatches
  };
};

// Release a reservation (with transaction support)
frameInventorySchema.methods.releaseReservation = async function(reservationId, session = null) {
  const reservation = this.reservations.find(r => r.reservationId === reservationId && r.status === 'active');

  if (!reservation) {
    throw new Error('Reservation not found or already processed');
  }

  // Release from batches
  for (const reservedBatch of reservation.batches) {
    const batch = this.batches.find(b => b.lotNumber === reservedBatch.lotNumber);
    if (batch) {
      batch.reserved = Math.max(0, (batch.reserved || 0) - reservedBatch.quantity);
    }
  }

  // Update total reserved
  this.inventory.reserved = Math.max(0, (this.inventory.reserved || 0) - reservation.quantity);

  // Mark reservation as cancelled
  reservation.status = 'cancelled';

  // Add transaction
  this.transactions.push({
    type: 'released',
    quantity: reservation.quantity,
    date: new Date(),
    reference: `Reservation: ${reservationId}`,
    notes: 'Reservation released/cancelled',
    balanceBefore: this.inventory.currentStock,
    balanceAfter: this.inventory.currentStock
  });

  // Update stock status
  this.updateStockStatus();

  // Use session for save if provided
  await this.save(session ? { session } : {});

  return {
    released: reservation.quantity
  };
};

// Fulfill reservation and record sale
frameInventorySchema.methods.fulfillReservation = async function(reservationId, patientId, userId, salePrice, session = null) {
  const reservation = this.reservations.find(r => r.reservationId === reservationId && r.status === 'active');

  if (!reservation) {
    throw new Error('Reservation not found or already processed');
  }

  // Deduct from batches
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

  // Update inventory
  this.inventory.currentStock -= reservation.quantity;
  this.inventory.reserved = Math.max(0, (this.inventory.reserved || 0) - reservation.quantity);

  // Mark reservation as fulfilled
  reservation.status = 'fulfilled';
  reservation.fulfilledAt = new Date();

  // Add to sales history
  this.usage.salesHistory.push({
    date: new Date(),
    quantity: reservation.quantity,
    order: reservation.reference,
    patient: patientId,
    soldBy: userId,
    lotNumber: reservation.batches[0]?.lotNumber,
    salePrice
  });

  this.usage.totalSold = (this.usage.totalSold || 0) + reservation.quantity;
  this.usage.lastSoldDate = new Date();

  // Add transaction
  this.transactions.push({
    type: 'sold',
    quantity: reservation.quantity,
    lotNumber: reservation.batches[0]?.lotNumber,
    date: new Date(),
    performedBy: userId,
    reference: `Order: ${reservation.reference}`,
    notes: 'Frame sold',
    balanceBefore: this.inventory.currentStock + reservation.quantity,
    balanceAfter: this.inventory.currentStock
  });

  // Update stock status
  this.updateStockStatus();

  // Check alerts
  this.checkAndCreateAlerts();

  // Use session for save if provided
  await this.save(session ? { session } : {});

  return {
    sold: reservation.quantity
  };
};

// Direct sale without prior reservation
frameInventorySchema.methods.sellFrame = async function(quantity, orderId, patientId, userId, lotNumber, salePrice) {
  // Find the batch
  const batch = lotNumber
    ? this.batches.find(b => b.lotNumber === lotNumber && b.status === 'active')
    : this.batches.find(b => b.status === 'active' && b.quantity > 0);

  if (!batch) {
    throw new Error('No active batch available');
  }

  if (batch.quantity < quantity) {
    throw new Error('Insufficient quantity in batch');
  }

  // Update batch quantity
  batch.quantity -= quantity;
  if (batch.quantity === 0) {
    batch.status = 'depleted';
  }

  // Add to sales history
  this.usage.salesHistory.push({
    date: new Date(),
    quantity,
    order: orderId,
    patient: patientId,
    soldBy: userId,
    lotNumber: batch.lotNumber,
    salePrice
  });

  this.usage.totalSold = (this.usage.totalSold || 0) + quantity;
  this.usage.lastSoldDate = new Date();

  // Update stock
  await this.updateStock(quantity, 'sold', userId, orderId, `Sold from lot ${batch.lotNumber}`);

  return this.save();
};

frameInventorySchema.methods.updateStockStatus = function() {
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

frameInventorySchema.methods.checkAndCreateAlerts = function() {
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
        message: `Frame ${this.brand} ${this.model} - ${this.color} is out of stock`,
        createdAt: new Date()
      });
    }
  }

  // Overstocked alert
  if (this.inventory.maximumStock && this.inventory.currentStock > this.inventory.maximumStock) {
    const existingAlert = this.alerts.find(a => a.type === 'overstocked' && !a.resolved);
    if (!existingAlert) {
      this.alerts.push({
        type: 'overstocked',
        severity: 'low',
        message: `Stock level (${this.inventory.currentStock}) exceeds maximum (${this.inventory.maximumStock})`,
        createdAt: new Date()
      });
    }
  }
};

frameInventorySchema.methods.markAsDamaged = async function(quantity, lotNumber, userId, notes) {
  const batch = this.batches.find(b => b.lotNumber === lotNumber && b.status === 'active');

  if (!batch) {
    throw new Error('Batch not found');
  }

  if (batch.quantity < quantity) {
    throw new Error('Cannot mark more as damaged than available in batch');
  }

  batch.quantity -= quantity;
  if (batch.quantity === 0) {
    batch.status = 'damaged';
  }

  // Create alert
  this.alerts.push({
    type: 'damaged',
    severity: 'medium',
    message: `${quantity} unit(s) from lot ${lotNumber} marked as damaged: ${notes}`,
    createdAt: new Date()
  });

  await this.updateStock(quantity, 'damaged', userId, lotNumber, notes);

  return this.save();
};

// Static methods
frameInventorySchema.statics.searchFrames = async function(query, options = {}) {
  const searchRegex = new RegExp(query.trim(), 'i');

  const searchOptions = {
    $or: [
      { brand: searchRegex },
      { model: searchRegex },
      { color: searchRegex },
      { sku: searchRegex },
      { barcode: searchRegex },
      { frameType: searchRegex },
      { material: searchRegex }
    ],
    active: true,
    isDepot: { $ne: true }  // Exclude depot items from search (users should see clinic inventory)
  };

  // Filter by clinic if provided
  if (options.clinicId) {
    searchOptions.clinic = options.clinicId;
  }

  if (options.category) {
    searchOptions.category = options.category;
  }

  if (options.brand) {
    searchOptions.brand = new RegExp(options.brand, 'i');
  }

  if (options.inStockOnly) {
    searchOptions['inventory.currentStock'] = { $gt: 0 };
  }

  if (options.gender) {
    searchOptions.gender = options.gender;
  }

  // Sort by stock status (in-stock first), then by brand/model
  return this.find(searchOptions)
    .limit(options.limit || 50)
    .sort(options.sort || { 'inventory.currentStock': -1, brand: 1, model: 1 })
    .select('sku brand model color size category material frameType gender inventory pricing images');
};

frameInventorySchema.statics.getLowStockItems = async function() {
  return this.find({
    $or: [
      { 'inventory.status': 'low-stock' },
      { 'inventory.status': 'out-of-stock' }
    ],
    active: true,
    discontinued: false
  })
    .sort({ 'inventory.currentStock': 1 })
    .select('sku brand model color inventory pricing reorder');
};

frameInventorySchema.statics.getInventoryValue = async function() {
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

frameInventorySchema.statics.getByCategory = async function(category) {
  return this.find({
    category,
    active: true,
    discontinued: false
  })
    .sort({ brand: 1, model: 1 })
    .select('sku brand model color size inventory pricing');
};

frameInventorySchema.statics.getBrands = async function() {
  return this.distinct('brand', { active: true, discontinued: false });
};

frameInventorySchema.statics.getStats = async function() {
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

  const byCategory = await this.aggregate([
    { $match: { active: true, discontinued: false } },
    {
      $group: {
        _id: '$category',
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
    byCategory,
    topBrands: byBrand
  };
};

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

// Middleware
frameInventorySchema.pre('save', function(next) {
  // Update stock status before saving
  this.updateStockStatus();

  // Check and create alerts
  this.checkAndCreateAlerts();

  // Calculate margin if both prices are set
  if (this.pricing.costPrice && this.pricing.sellingPrice) {
    this.pricing.margin = ((this.pricing.sellingPrice - this.pricing.costPrice) / this.pricing.costPrice) * 100;
    this.pricing.lastUpdated = new Date();
  }

  next();
});

module.exports = mongoose.model('FrameInventory', frameInventorySchema);
