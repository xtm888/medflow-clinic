const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * ReagentInventory Model
 * Manages laboratory reagents, stains, solutions, culture media, and QC materials
 * Follows FEFO (First Expiry First Out) algorithm
 * Integrates with LaboratoryTemplate for auto-consumption tracking
 */

const ReagentInventorySchema = new Schema({
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
  manufacturer: {
    type: String,
    trim: true,
    index: true
  },
  catalogNumber: {
    type: String,
    trim: true
  },

  // ============================================
  // CATEGORIZATION
  // ============================================
  category: {
    type: String,
    enum: [
      'stain',              // Colorants (Giemsa, Wright, Gram, etc.)
      'solution',           // Solutions (saline, buffer, etc.)
      'culture-media',      // Milieux de culture
      'reagent-kit',        // Kits de réactifs (analyseurs)
      'calibrator',         // Calibrateurs
      'control-material',   // Matériels de contrôle QC
      'antibody',           // Anticorps (immunologie)
      'enzyme',             // Enzymes
      'substrate',          // Substrats
      'diluent',            // Diluants
      'wash-buffer',        // Tampons de lavage
      'preservative',       // Conservateurs
      'fixative',           // Fixateurs
      'mounting-medium',    // Milieux de montage
      'other'
    ],
    required: true,
    index: true
  },
  subcategory: {
    type: String,
    trim: true
  },

  // Laboratory section this reagent is used in
  labSection: {
    type: String,
    enum: [
      'hematology',         // Hématologie
      'biochemistry',       // Biochimie
      'microbiology',       // Microbiologie
      'immunology',         // Immunologie/Sérologie
      'urinalysis',         // Analyse d'urine
      'coagulation',        // Coagulation
      'parasitology',       // Parasitologie
      'histopathology',     // Histopathologie
      'cytology',           // Cytologie
      'molecular',          // Biologie moléculaire
      'blood-bank',         // Banque de sang
      'general'             // Général
    ],
    default: 'general',
    index: true
  },

  // ============================================
  // REAGENT SPECIFICATIONS
  // ============================================
  specifications: {
    concentration: String,       // e.g., "10%", "0.9%", "1:10"
    volume: String,              // e.g., "500ml", "1L", "100ml"
    unitSize: String,            // Package size
    unitsPerPackage: {
      type: Number,
      default: 1
    },
    testsPerUnit: Number,        // Number of tests per unit
    grade: {
      type: String,
      enum: ['analytical', 'reagent', 'laboratory', 'clinical', 'molecular', 'other']
    },
    purity: String,              // e.g., "99.9%", ">95%"
    pH: String,                  // pH value if applicable
    color: String                // Color coding
  },

  // ============================================
  // COMPATIBILITY
  // ============================================
  compatibility: {
    instruments: [String],       // Compatible analyzers/instruments
    testPanels: [String],        // Compatible test panels
    linkedTemplates: [{
      type: Schema.Types.ObjectId,
      ref: 'LaboratoryTemplate'
    }]
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
      enum: ['bottle', 'vial', 'kit', 'box', 'pack', 'liter', 'ml', 'unit', 'piece'],
      default: 'unit'
    },
    minimumStock: {
      type: Number,
      default: 2
    },
    reorderPoint: {
      type: Number,
      default: 5
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
  // BATCH TRACKING (FEFO - First Expiry First Out)
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
    expirationDate: {
      type: Date,
      required: true,
      index: true
    },
    manufactureDate: Date,
    receivedDate: {
      type: Date,
      default: Date.now
    },
    openedDate: Date,           // Date first opened
    openedExpiryDate: Date,     // Expiry after opening (often shorter)
    supplier: {
      name: String,
      contact: String,
      invoiceNumber: String
    },
    cost: {
      unitCost: Number,
      totalCost: Number,
      currency: {
        type: String,
        default: 'CDF'
      }
    },
    certificateOfAnalysis: String,  // COA reference
    status: {
      type: String,
      enum: ['active', 'expired', 'quarantine', 'recalled', 'depleted', 'damaged'],
      default: 'active'
    },
    notes: String
  }],

  // ============================================
  // STORAGE CONDITIONS
  // ============================================
  storage: {
    temperature: {
      type: String,
      enum: ['room-temp', 'refrigerated', 'frozen', 'deep-frozen', 'ambient'],
      default: 'room-temp'
    },
    tempRange: {
      min: Number,
      max: Number,
      unit: {
        type: String,
        default: 'C'
      }
    },
    lightSensitive: {
      type: Boolean,
      default: false
    },
    moistureSensitive: {
      type: Boolean,
      default: false
    },
    hazardous: {
      type: Boolean,
      default: false
    },
    hazardClass: String,         // e.g., "Flammable", "Corrosive", "Toxic"
    location: String,            // Storage location
    shelfLife: Number,           // Months
    afterOpeningShelfLife: Number // Days after opening
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
    averageMonthlyUsage: Number,
    usageHistory: [{
      date: {
        type: Date,
        default: Date.now
      },
      quantity: Number,
      lotNumber: String,
      labOrder: {
        type: Schema.Types.ObjectId,
        ref: 'LabOrder'
      },
      template: {
        type: Schema.Types.ObjectId,
        ref: 'LaboratoryTemplate'
      },
      usedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      instrument: String,
      notes: String
    }]
  },

  // ============================================
  // QC (QUALITY CONTROL) TRACKING
  // ============================================
  qc: {
    requiresQC: {
      type: Boolean,
      default: false
    },
    qcFrequency: {
      type: String,
      enum: ['per-run', 'daily', 'weekly', 'monthly', 'per-lot', 'none'],
      default: 'none'
    },
    lastQCDate: Date,
    qcResults: [{
      date: Date,
      lotNumber: String,
      level: String,              // e.g., "Level 1", "Level 2", "Normal", "Abnormal"
      expectedValue: Number,
      actualValue: Number,
      unit: String,
      acceptable: Boolean,
      performedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      notes: String
    }]
  },

  // ============================================
  // PRICING
  // ============================================
  pricing: {
    costPrice: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'CDF'
    },
    lastPurchaseDate: Date,
    priceHistory: [{
      date: Date,
      price: Number,
      supplier: String
    }]
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
    leadTime: Number,           // Days
    minimumOrder: Number,
    lastOrderDate: Date
  }],

  // ============================================
  // TRANSACTION HISTORY
  // ============================================
  transactions: [{
    type: {
      type: String,
      enum: ['received', 'consumed', 'adjusted', 'expired', 'damaged', 'returned', 'transferred', 'qc-used', 'disposed'],
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
      enum: ['low-stock', 'out-of-stock', 'expiring-soon', 'expired', 'qc-failed', 'recall', 'storage-issue'],
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
  safetyDataSheet: String,      // SDS/MSDS reference
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
ReagentInventorySchema.index({ name: 'text', manufacturer: 'text', sku: 'text' });
ReagentInventorySchema.index({ 'batches.expirationDate': 1 });
ReagentInventorySchema.index({ 'batches.lotNumber': 1 });
ReagentInventorySchema.index({ category: 1, labSection: 1 });
ReagentInventorySchema.index({ 'inventory.status': 1, isActive: 1 });

// ============================================
// VIRTUALS
// ============================================
ReagentInventorySchema.virtual('inventory.available').get(function() {
  return this.inventory.currentStock - this.inventory.reserved;
});

ReagentInventorySchema.virtual('isLowStock').get(function() {
  const available = this.inventory.currentStock - this.inventory.reserved;
  return available <= this.inventory.minimumStock;
});

ReagentInventorySchema.virtual('isOutOfStock').get(function() {
  const available = this.inventory.currentStock - this.inventory.reserved;
  return available <= 0;
});

ReagentInventorySchema.virtual('earliestExpiry').get(function() {
  const activeBatches = this.batches.filter(b => b.status === 'active' && b.quantity > 0);
  if (activeBatches.length === 0) return null;

  activeBatches.sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));
  return activeBatches[0].expirationDate;
});

ReagentInventorySchema.virtual('daysToExpiry').get(function() {
  const earliest = this.earliestExpiry;
  if (!earliest) return null;

  const now = new Date();
  const diffTime = new Date(earliest) - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// ============================================
// PRE-SAVE HOOKS
// ============================================
ReagentInventorySchema.pre('save', function(next) {
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

  // Check for expiring batches and create alerts
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  this.batches.forEach(batch => {
    if (batch.status === 'active' && batch.expirationDate) {
      const expDate = new Date(batch.expirationDate);

      if (expDate < now) {
        batch.status = 'expired';
        this.addAlert('expired', 'critical', `Lot ${batch.lotNumber} expiré le ${expDate.toLocaleDateString('fr-FR')}`);
      } else if (expDate < sevenDaysFromNow) {
        this.addAlert('expiring-soon', 'high', `Lot ${batch.lotNumber} expire dans moins de 7 jours`);
      } else if (expDate < thirtyDaysFromNow) {
        this.addAlert('expiring-soon', 'medium', `Lot ${batch.lotNumber} expire dans moins de 30 jours`);
      }
    }
  });

  // Low stock alert
  if (this.inventory.status === 'low-stock') {
    this.addAlert('low-stock', 'medium', `Stock bas: ${available} ${this.inventory.unit}(s) disponible(s)`);
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
ReagentInventorySchema.methods.addAlert = function(type, severity, message) {
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
ReagentInventorySchema.methods.addBatch = async function(batchData, userId) {
  const batch = {
    lotNumber: batchData.lotNumber,
    quantity: batchData.quantity,
    reserved: 0,
    expirationDate: batchData.expirationDate,
    manufactureDate: batchData.manufactureDate,
    receivedDate: new Date(),
    supplier: batchData.supplier,
    cost: batchData.cost,
    certificateOfAnalysis: batchData.certificateOfAnalysis,
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
    this.pricing.costPrice = batchData.cost.unitCost;
    this.pricing.lastPurchaseDate = new Date();
  }

  this.updatedBy = userId;
  return this.save();
};

/**
 * Consume reagent (FEFO - First Expiry First Out)
 */
ReagentInventorySchema.methods.consumeReagent = async function(quantity, consumptionData, userId, session = null) {
  const now = new Date();

  // Get active batches sorted by expiration (FEFO)
  const activeBatches = this.batches
    .filter(b => b.status === 'active' && (b.quantity - (b.reserved || 0)) > 0)
    .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));

  // Check total availability
  const totalAvailable = activeBatches.reduce((sum, b) => sum + (b.quantity - (b.reserved || 0)), 0);
  if (totalAvailable < quantity) {
    throw new Error(`Stock insuffisant. Disponible: ${totalAvailable}, Demandé: ${quantity}`);
  }

  // Validate no expired batches
  for (const batch of activeBatches) {
    if (batch.expirationDate && new Date(batch.expirationDate) < now) {
      batch.status = 'expired';
      throw new Error(`Le lot ${batch.lotNumber} est expiré. Veuillez le retirer du stock.`);
    }
  }

  // Consume from batches (FEFO)
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
    date: now,
    quantity,
    lotNumber: consumedFromBatches.map(b => b.lotNumber).join(', '),
    labOrder: consumptionData.labOrderId,
    template: consumptionData.templateId,
    usedBy: userId,
    instrument: consumptionData.instrument,
    notes: consumptionData.notes
  });

  this.usage.totalConsumed += quantity;
  this.usage.lastUsedDate = now;

  // Record transaction
  this.transactions.push({
    type: 'consumed',
    quantity,
    lotNumber: consumedFromBatches.map(b => b.lotNumber).join(', '),
    date: now,
    performedBy: userId,
    reference: consumptionData.labOrderId?.toString() || consumptionData.reference,
    notes: consumptionData.notes || 'Consommation pour analyse',
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
 * Record QC consumption
 */
ReagentInventorySchema.methods.consumeForQC = async function(quantity, qcData, userId) {
  await this.consumeReagent(quantity, {
    notes: `QC: ${qcData.level || 'Standard'}`,
    instrument: qcData.instrument
  }, userId);

  // Record QC result
  this.qc.qcResults.push({
    date: new Date(),
    lotNumber: qcData.lotNumber,
    level: qcData.level,
    expectedValue: qcData.expectedValue,
    actualValue: qcData.actualValue,
    unit: qcData.unit,
    acceptable: qcData.acceptable,
    performedBy: userId,
    notes: qcData.notes
  });

  this.qc.lastQCDate = new Date();

  if (!qcData.acceptable) {
    this.addAlert('qc-failed', 'high', `QC échoué pour lot ${qcData.lotNumber}`);
  }

  return this.save();
};

/**
 * Adjust stock manually
 */
ReagentInventorySchema.methods.adjustStock = async function(adjustment, userId) {
  const { lotNumber, quantity, reason, notes } = adjustment;

  const batch = this.batches.find(b => b.lotNumber === lotNumber && b.status === 'active');
  if (!batch) {
    throw new Error(`Lot ${lotNumber} non trouvé ou inactif`);
  }

  const balanceBefore = batch.quantity;
  batch.quantity += quantity; // Can be negative for reduction

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
 * Mark batch as expired
 */
ReagentInventorySchema.methods.markBatchExpired = async function(lotNumber, userId) {
  const batch = this.batches.find(b => b.lotNumber === lotNumber);
  if (!batch) {
    throw new Error(`Lot ${lotNumber} non trouvé`);
  }

  const previousQuantity = batch.quantity;
  batch.status = 'expired';

  this.transactions.push({
    type: 'expired',
    quantity: -previousQuantity,
    lotNumber,
    date: new Date(),
    performedBy: userId,
    notes: 'Lot marqué comme expiré',
    balanceBefore: this.inventory.currentStock,
    balanceAfter: this.inventory.currentStock - previousQuantity
  });

  this.addAlert('expired', 'critical', `Lot ${lotNumber} marqué comme expiré`);

  this.updatedBy = userId;
  return this.save();
};

/**
 * Dispose of reagent
 */
ReagentInventorySchema.methods.disposeReagent = async function(lotNumber, quantity, reason, userId) {
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
    type: 'disposed',
    quantity: -quantity,
    lotNumber,
    date: new Date(),
    performedBy: userId,
    reference: reason,
    notes: `Élimination: ${reason}`,
    balanceBefore: this.inventory.currentStock,
    balanceAfter: this.inventory.currentStock - quantity
  });

  this.updatedBy = userId;
  return this.save();
};

// ============================================
// STATICS
// ============================================

/**
 * Get low stock items
 */
ReagentInventorySchema.statics.getLowStockItems = function() {
  return this.find({
    isActive: true,
    'inventory.status': { $in: ['low-stock', 'out-of-stock'] }
  }).sort({ 'inventory.status': 1, name: 1 });
};

/**
 * Get expiring items (within days)
 */
ReagentInventorySchema.statics.getExpiringItems = function(days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return this.find({
    isActive: true,
    'batches': {
      $elemMatch: {
        status: 'active',
        expirationDate: {
          $lte: futureDate,
          $gte: new Date()
        }
      }
    }
  }).sort({ 'batches.expirationDate': 1 });
};

/**
 * Get items by lab section
 */
ReagentInventorySchema.statics.getByLabSection = function(section) {
  return this.find({
    isActive: true,
    labSection: section
  }).sort({ name: 1 });
};

/**
 * Search reagents
 */
ReagentInventorySchema.statics.searchReagents = function(query) {
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
ReagentInventorySchema.statics.getInventoryValue = async function() {
  const items = await this.find({ isActive: true });

  let totalValue = 0;
  let totalItems = 0;

  items.forEach(item => {
    const value = item.inventory.currentStock * (item.pricing.costPrice || 0);
    totalValue += value;
    totalItems += item.inventory.currentStock;
  });

  return {
    totalValue,
    totalItems,
    currency: 'CDF'
  };
};

// Enable virtuals in JSON
ReagentInventorySchema.set('toJSON', { virtuals: true });
ReagentInventorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ReagentInventory', ReagentInventorySchema);
