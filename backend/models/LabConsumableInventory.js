const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * LabConsumableInventory Model
 * Manages laboratory consumables: tubes, needles, slides, containers, etc.
 * Uses FIFO (First In First Out) - most consumables don't expire quickly
 * Some items (like certain tubes) may have expiration tracking
 */

const LabConsumableInventorySchema = new Schema({
  // ============================================
  // CLINIC/LOCATION - Multi-clinic support
  // ============================================
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true,
    index: true
  },
  isDepot: {
    type: Boolean,
    default: false,
    index: true
  },

  // ============================================
  // IDENTIFICATION
  // ============================================
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
    sparse: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  description: String,
  manufacturer: {
    type: String,
    trim: true
  },
  catalogNumber: String,

  // ============================================
  // CATEGORIZATION
  // ============================================
  category: {
    type: String,
    enum: [
      'collection-tube',      // Tubes de prélèvement (EDTA, Héparine, SEC, etc.)
      'needle',               // Aiguilles
      'syringe',              // Seringues
      'lancet',               // Lancettes
      'slide',                // Lames
      'coverslip',            // Lamelles
      'container',            // Conteneurs (urine, selles, etc.)
      'swab',                 // Écouvillons
      'pipette-tip',          // Embouts de pipette
      'cuvette',              // Cuvettes pour analyseurs
      'filter',               // Filtres
      'glove',                // Gants
      'mask',                 // Masques
      'protective-wear',      // Équipement de protection
      'cleaning-supply',      // Produits de nettoyage
      'label',                // Étiquettes
      'transport-media',      // Milieux de transport
      'other'
    ],
    required: true,
    index: true
  },

  // Subcategory for collection tubes (color coding)
  tubeType: {
    type: String,
    enum: [
      'edta-purple',          // EDTA (violet) - Hématologie
      'heparin-green',        // Héparine (vert) - Chimie plasma
      'sst-gold',             // SST (or/jaune) - Sérum avec gel
      'citrate-blue',         // Citrate (bleu) - Coagulation
      'fluoride-gray',        // Fluorure (gris) - Glucose
      'plain-red',            // Sec (rouge) - Sérum
      'edta-pink',            // EDTA (rose) - Banque de sang
      'acd-yellow',           // ACD (jaune) - Banque de sang
      'trace-royal-blue',     // Trace elements (bleu royal)
      'other'
    ]
  },

  // Size specifications
  specifications: {
    size: String,             // e.g., "5ml", "10ml", "21G", "22G"
    volume: String,           // Volume capacity
    gauge: String,            // For needles: "21G", "22G", etc.
    length: String,           // e.g., "1.5 inch"
    material: String,         // e.g., "Glass", "Plastic", "Latex-free"
    color: String,            // Color coding
    sterile: {
      type: Boolean,
      default: true
    },
    latexFree: {
      type: Boolean,
      default: false
    },
    unitsPerBox: {
      type: Number,
      default: 1
    }
  },

  // ============================================
  // INVENTORY TRACKING
  // ============================================
  inventory: {
    currentStock: {
      type: Number,
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
      enum: ['piece', 'box', 'pack', 'case', 'bag', 'roll', 'pair'],
      default: 'piece'
    },
    minimumStock: {
      type: Number,
      default: 50      // Consumables often need higher minimums
    },
    reorderPoint: {
      type: Number,
      default: 100
    },
    maximumStock: Number,
    status: {
      type: String,
      enum: ['in-stock', 'low-stock', 'out-of-stock', 'on-order', 'discontinued'],
      default: 'out-of-stock',
      index: true
    }
  },

  // ============================================
  // BATCH TRACKING (FIFO - First In First Out)
  // ============================================
  batches: [{
    lotNumber: {
      type: String,
      required: true
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
    // Some consumables have expiration (tubes, sterile items)
    expirationDate: Date,
    receivedDate: {
      type: Date,
      default: Date.now
    },
    supplier: {
      name: String,
      contact: String,
      invoiceNumber: String,
      poNumber: String
    },
    cost: {
      unitCost: Number,
      boxCost: Number,
      totalCost: Number,
      currency: {
        type: String,
        default: 'CDF'
      }
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'damaged', 'recalled', 'depleted'],
      default: 'active'
    },
    notes: String
  }],

  // ============================================
  // STORAGE
  // ============================================
  storage: {
    location: String,
    temperature: {
      type: String,
      enum: ['room-temp', 'refrigerated', 'frozen', 'ambient'],
      default: 'room-temp'
    },
    specialHandling: String
  },

  // ============================================
  // USAGE TRACKING
  // ============================================
  usage: {
    totalConsumed: {
      type: Number,
      default: 0
    },
    lastUsedDate: Date,
    averageDailyUsage: Number,
    usageHistory: [{
      date: {
        type: Date,
        default: Date.now
      },
      quantity: Number,
      lotNumber: String,
      department: String,
      usedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      purpose: String,
      notes: String
    }]
  },

  // ============================================
  // PRICING
  // ============================================
  pricing: {
    costPerUnit: {
      type: Number,
      default: 0
    },
    costPerBox: Number,
    currency: {
      type: String,
      default: 'CDF'
    },
    lastPurchaseDate: Date
  },

  // ============================================
  // SUPPLIERS
  // ============================================
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
    catalogNumber: String,
    isPrimary: {
      type: Boolean,
      default: false
    },
    leadTime: Number,
    minimumOrder: Number,
    pricePerUnit: Number,
    pricePerBox: Number
  }],

  // ============================================
  // TRANSACTION HISTORY
  // ============================================
  transactions: [{
    type: {
      type: String,
      enum: ['received', 'consumed', 'adjusted', 'expired', 'damaged', 'returned', 'transferred', 'disposed'],
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    lotNumber: String,
    date: {
      type: Date,
      default: Date.now
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    department: String,
    reference: String,
    notes: String,
    balanceBefore: Number,
    balanceAfter: Number
  }],

  // ============================================
  // ALERTS
  // ============================================
  alerts: [{
    type: {
      type: String,
      enum: ['low-stock', 'out-of-stock', 'expiring-soon', 'expired', 'recall', 'damaged'],
      required: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
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
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // ============================================
  // REORDER
  // ============================================
  reorder: {
    autoReorder: {
      type: Boolean,
      default: false
    },
    reorderQuantity: Number,
    preferredSupplier: String,
    lastOrderDate: Date,
    onOrder: {
      type: Boolean,
      default: false
    },
    orderQuantity: Number,
    expectedDeliveryDate: Date,
    poNumber: String
  },

  // ============================================
  // METADATA
  // ============================================
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  notes: String,
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  version: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  optimisticConcurrency: true,
  versionKey: 'version'
});

// ============================================
// INDEXES
// ============================================
LabConsumableInventorySchema.index({ name: 'text', manufacturer: 'text', sku: 'text' });
LabConsumableInventorySchema.index({ category: 1, tubeType: 1 });
LabConsumableInventorySchema.index({ 'inventory.status': 1, isActive: 1 });
LabConsumableInventorySchema.index({ 'batches.lotNumber': 1 });

// ============================================
// VIRTUALS
// ============================================
LabConsumableInventorySchema.virtual('inventory.available').get(function() {
  return this.inventory.currentStock - this.inventory.reserved;
});

LabConsumableInventorySchema.virtual('isLowStock').get(function() {
  const available = this.inventory.currentStock - this.inventory.reserved;
  return available <= this.inventory.minimumStock;
});

LabConsumableInventorySchema.virtual('isOutOfStock').get(function() {
  const available = this.inventory.currentStock - this.inventory.reserved;
  return available <= 0;
});

// ============================================
// PRE-SAVE HOOKS
// ============================================
LabConsumableInventorySchema.pre('save', function(next) {
  // Recalculate current stock from batches
  const totalStock = this.batches
    .filter(b => b.status === 'active')
    .reduce((sum, b) => sum + b.quantity, 0);

  const totalReserved = this.batches
    .filter(b => b.status === 'active')
    .reduce((sum, b) => sum + (b.reserved || 0), 0);

  this.inventory.currentStock = totalStock;
  this.inventory.reserved = totalReserved;

  // Update status
  const available = totalStock - totalReserved;
  if (available <= 0) {
    this.inventory.status = 'out-of-stock';
  } else if (available <= this.inventory.minimumStock) {
    this.inventory.status = 'low-stock';
  } else {
    this.inventory.status = 'in-stock';
  }

  // Check for expiring batches (if applicable)
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  this.batches.forEach(batch => {
    if (batch.status === 'active' && batch.expirationDate) {
      const expDate = new Date(batch.expirationDate);

      if (expDate < now) {
        batch.status = 'expired';
        this.addAlert('expired', 'critical', `Lot ${batch.lotNumber} expiré`);
      } else if (expDate < thirtyDaysFromNow) {
        this.addAlert('expiring-soon', 'medium', `Lot ${batch.lotNumber} expire bientôt`);
      }
    }
  });

  // Low stock alert
  if (this.inventory.status === 'low-stock') {
    this.addAlert('low-stock', 'medium', `Stock bas: ${available} ${this.inventory.unit}(s)`);
  } else if (this.inventory.status === 'out-of-stock') {
    this.addAlert('out-of-stock', 'critical', 'Rupture de stock');
  }

  next();
});

// ============================================
// METHODS
// ============================================

/**
 * Add alert (avoiding duplicates)
 */
LabConsumableInventorySchema.methods.addAlert = function(type, severity, message) {
  const existingAlert = this.alerts.find(a =>
    a.type === type &&
    !a.resolved &&
    a.message === message
  );

  if (!existingAlert) {
    this.alerts.push({
      type,
      severity,
      message,
      createdAt: new Date()
    });
  }
};

/**
 * Add new batch (receive stock)
 */
LabConsumableInventorySchema.methods.addBatch = async function(batchData, userId) {
  const batch = {
    lotNumber: batchData.lotNumber,
    quantity: batchData.quantity,
    reserved: 0,
    expirationDate: batchData.expirationDate,
    receivedDate: new Date(),
    supplier: batchData.supplier,
    cost: batchData.cost,
    status: 'active',
    notes: batchData.notes
  };

  this.batches.push(batch);

  // Record transaction
  this.transactions.push({
    type: 'received',
    quantity: batchData.quantity,
    lotNumber: batchData.lotNumber,
    date: new Date(),
    performedBy: userId,
    reference: batchData.supplier?.invoiceNumber,
    notes: `Réception lot ${batchData.lotNumber}`,
    balanceBefore: this.inventory.currentStock,
    balanceAfter: this.inventory.currentStock + batchData.quantity
  });

  // Update pricing
  if (batchData.cost?.unitCost) {
    this.pricing.costPerUnit = batchData.cost.unitCost;
    this.pricing.lastPurchaseDate = new Date();
  }

  this.updatedBy = userId;
  return this.save();
};

/**
 * Consume consumable (FIFO - First In First Out)
 */
LabConsumableInventorySchema.methods.consumeItem = async function(quantity, consumptionData, userId, session = null) {
  // Get active batches sorted by received date (FIFO)
  const activeBatches = this.batches
    .filter(b => b.status === 'active' && (b.quantity - (b.reserved || 0)) > 0)
    .sort((a, b) => new Date(a.receivedDate) - new Date(b.receivedDate));

  // Check total availability
  const totalAvailable = activeBatches.reduce((sum, b) => sum + (b.quantity - (b.reserved || 0)), 0);
  if (totalAvailable < quantity) {
    throw new Error(`Stock insuffisant. Disponible: ${totalAvailable}, Demandé: ${quantity}`);
  }

  // Consume from batches (FIFO)
  let remaining = quantity;
  const consumedFromBatches = [];

  for (const batch of activeBatches) {
    if (remaining <= 0) break;

    const available = batch.quantity - (batch.reserved || 0);
    const toConsume = Math.min(available, remaining);

    batch.quantity -= toConsume;
    remaining -= toConsume;

    consumedFromBatches.push({
      lotNumber: batch.lotNumber,
      quantity: toConsume
    });

    // Mark as depleted if empty
    if (batch.quantity <= 0) {
      batch.status = 'depleted';
    }
  }

  // Record usage
  this.usage.usageHistory.push({
    date: new Date(),
    quantity,
    lotNumber: consumedFromBatches.map(b => b.lotNumber).join(', '),
    department: consumptionData.department,
    usedBy: userId,
    purpose: consumptionData.purpose,
    notes: consumptionData.notes
  });

  this.usage.totalConsumed += quantity;
  this.usage.lastUsedDate = new Date();

  // Record transaction
  this.transactions.push({
    type: 'consumed',
    quantity,
    lotNumber: consumedFromBatches.map(b => b.lotNumber).join(', '),
    date: new Date(),
    performedBy: userId,
    department: consumptionData.department,
    reference: consumptionData.reference,
    notes: consumptionData.notes || consumptionData.purpose,
    balanceBefore: this.inventory.currentStock,
    balanceAfter: this.inventory.currentStock - quantity
  });

  this.updatedBy = userId;

  if (session) {
    return this.save({ session });
  }
  return this.save();
};

/**
 * Adjust stock manually
 */
LabConsumableInventorySchema.methods.adjustStock = async function(adjustment, userId) {
  const { lotNumber, quantity, reason, notes } = adjustment;

  const batch = this.batches.find(b => b.lotNumber === lotNumber && b.status === 'active');
  if (!batch) {
    throw new Error(`Lot ${lotNumber} non trouvé ou inactif`);
  }

  const balanceBefore = batch.quantity;
  batch.quantity += quantity;

  if (batch.quantity < 0) {
    throw new Error(`Ajustement invalide. Stock ne peut pas être négatif.`);
  }

  if (batch.quantity === 0) {
    batch.status = 'depleted';
  }

  this.transactions.push({
    type: 'adjusted',
    quantity,
    lotNumber,
    date: new Date(),
    performedBy: userId,
    reference: reason,
    notes,
    balanceBefore,
    balanceAfter: batch.quantity
  });

  this.updatedBy = userId;
  return this.save();
};

/**
 * Mark batch as damaged
 */
LabConsumableInventorySchema.methods.markBatchDamaged = async function(lotNumber, quantity, reason, userId) {
  const batch = this.batches.find(b => b.lotNumber === lotNumber && b.status === 'active');
  if (!batch) {
    throw new Error(`Lot ${lotNumber} non trouvé ou inactif`);
  }

  if (batch.quantity < quantity) {
    throw new Error(`Quantité insuffisante dans le lot`);
  }

  batch.quantity -= quantity;
  if (batch.quantity === 0) {
    batch.status = 'depleted';
  }

  this.transactions.push({
    type: 'damaged',
    quantity: -quantity,
    lotNumber,
    date: new Date(),
    performedBy: userId,
    reference: reason,
    notes: `Dommage: ${reason}`,
    balanceBefore: this.inventory.currentStock,
    balanceAfter: this.inventory.currentStock - quantity
  });

  this.addAlert('damaged', 'medium', `${quantity} unité(s) endommagée(s) - Lot ${lotNumber}`);

  this.updatedBy = userId;
  return this.save();
};

// ============================================
// STATICS
// ============================================

/**
 * Get low stock items
 */
LabConsumableInventorySchema.statics.getLowStockItems = function() {
  return this.find({
    isActive: true,
    'inventory.status': { $in: ['low-stock', 'out-of-stock'] }
  }).sort({ 'inventory.status': 1, name: 1 });
};

/**
 * Get items by category
 */
LabConsumableInventorySchema.statics.getByCategory = function(category) {
  return this.find({
    isActive: true,
    category
  }).sort({ name: 1 });
};

/**
 * Get collection tubes
 */
LabConsumableInventorySchema.statics.getCollectionTubes = function() {
  return this.find({
    isActive: true,
    category: 'collection-tube'
  }).sort({ tubeType: 1, name: 1 });
};

/**
 * Search consumables
 */
LabConsumableInventorySchema.statics.searchConsumables = function(query) {
  return this.find({
    isActive: true,
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { manufacturer: { $regex: query, $options: 'i' } },
      { sku: { $regex: query, $options: 'i' } },
      { 'batches.lotNumber': { $regex: query, $options: 'i' } }
    ]
  }).limit(20);
};

/**
 * Get inventory value
 */
LabConsumableInventorySchema.statics.getInventoryValue = async function() {
  const items = await this.find({ isActive: true });

  let totalValue = 0;
  let totalItems = 0;

  items.forEach(item => {
    const value = item.inventory.currentStock * (item.pricing.costPerUnit || 0);
    totalValue += value;
    totalItems += item.inventory.currentStock;
  });

  return {
    totalValue,
    totalItems,
    currency: 'CDF'
  };
};

/**
 * Get tube color stats (for dashboard)
 */
LabConsumableInventorySchema.statics.getTubeStats = async function() {
  return this.aggregate([
    {
      $match: {
        isActive: true,
        category: 'collection-tube'
      }
    },
    {
      $group: {
        _id: '$tubeType',
        totalStock: { $sum: '$inventory.currentStock' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

// Enable virtuals in JSON
LabConsumableInventorySchema.set('toJSON', { virtuals: true });
LabConsumableInventorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LabConsumableInventory', LabConsumableInventorySchema);
