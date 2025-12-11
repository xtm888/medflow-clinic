const mongoose = require('mongoose');

const pharmacyInventorySchema = new mongoose.Schema({
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

  // Medication reference
  drug: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Drug',
    required: true,
    index: true
  },

  // Medication identification
  medication: {
    genericName: {
      type: String,
      required: true,
      index: true
    },
    brandName: String,
    nameFr: String,
    strength: String,        // e.g., "500mg", "0.5%"
    formulation: {
      type: String,
      enum: ['tablet', 'capsule', 'liquid', 'injection', 'drops', 'ointment',
             'gel', 'cream', 'patch', 'spray', 'inhaler', 'suppository', 'implant', 'powder']
    },
    route: {
      type: String,
      enum: ['oral', 'ophthalmic', 'topical', 'injectable', 'nasal', 'otic', 'rectal', 'other']
    }
  },

  // Category and classification
  category: {
    type: String,
    enum: ['antibiotic', 'anti-inflammatory', 'anti-glaucoma', 'anti-VEGF', 'steroid',
           'mydriatic', 'anesthetic', 'artificial-tears', 'antihistamine', 'antiviral',
           'antifungal', 'vitamin', 'supplement', 'other'],
    index: true
  },

  categoryFr: {
    id: String,
    name: String
  },

  // Storage location
  location: {
    pharmacy: {
      type: String,
      default: 'Main Pharmacy'
    },
    section: String,         // e.g., "Refrigerated", "Controlled Substances", "General"
    shelf: String,
    bin: String,
    position: String
  },

  // Stock levels
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
      enum: ['units', 'bottles', 'boxes', 'vials', 'ampules', 'tubes', 'packets', 'strips'],
      default: 'units'
    },
    unitsPerPackage: Number,   // e.g., 30 tablets per bottle

    // Threshold levels
    minimumStock: {
      type: Number,
      required: true,
      default: 10
    },
    reorderPoint: {
      type: Number,
      required: true,
      default: 20
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

  // Batch/Lot tracking
  batches: [{
    lotNumber: {
      type: String,
      required: true,
      index: true
    },
    batchNumber: String,
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
        default: 'EUR'
      }
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'recalled', 'quarantined', 'depleted'],
      default: 'active'
    },
    notes: String
  }],

  // Reservations (for prescriptions/procedures not yet dispensed)
  reservations: [{
    reservationId: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['prescription', 'ivt', 'procedure'],
      required: true
    },
    reference: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'reservations.referenceModel',
      required: true
    },
    referenceModel: {
      type: String,
      enum: ['Prescription', 'IVTInjection', 'ClinicalAct']
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
      // Default: 24 hours from reservation
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
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
    costPrice: Number,        // What pharmacy pays
    sellingPrice: Number,     // What patient pays
    wholesalePrice: Number,
    insurancePrice: Number,
    margin: Number,           // Percentage
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
    leadTime: Number,         // Days
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

  // Usage tracking
  usage: {
    averageMonthlyUsage: Number,
    lastDispensedDate: Date,
    totalDispensed: {
      type: Number,
      default: 0
    },
    dispensingHistory: [{
      date: Date,
      quantity: Number,
      prescription: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prescription'
      },
      patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient'
      },
      dispensedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      lotNumber: String
    }]
  },

  // Storage requirements
  storage: {
    temperature: {
      type: String,
      enum: ['room_temperature', 'refrigerated', 'frozen', 'controlled_room_temperature'],
      default: 'room_temperature'
    },
    temperatureRange: String,   // e.g., "2-8°C"
    lightProtection: Boolean,
    humidityControl: Boolean,
    specialInstructions: String,
    shelfLife: String,          // e.g., "24 months"
    afterOpeningShelfLife: String  // e.g., "30 days after opening"
  },

  // Controlled substance information
  controlledSubstance: {
    isControlled: {
      type: Boolean,
      default: false
    },
    schedule: {
      type: String,
      enum: ['I', 'II', 'III', 'IV', 'V']
    },
    requiresSpecialHandling: Boolean,
    requiresSignature: Boolean,
    regulatoryNotes: String
  },

  // Alerts and notifications
  alerts: [{
    type: {
      type: String,
      enum: ['low-stock', 'expired', 'expiring-soon', 'recall', 'discontinued', 'overstocked']
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
      enum: ['received', 'dispensed', 'returned', 'expired', 'damaged', 'recalled', 'adjusted', 'transferred']
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
    reference: String,        // Prescription, PO, etc.
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

  // Optimistic locking - prevents lost updates from concurrent modifications (CRITICAL for inventory)
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
pharmacyInventorySchema.index({ 'medication.genericName': 'text', 'medication.brandName': 'text' });
pharmacyInventorySchema.index({ category: 1, active: 1 });
pharmacyInventorySchema.index({ 'inventory.status': 1 });
pharmacyInventorySchema.index({ 'batches.expirationDate': 1 });
pharmacyInventorySchema.index({ 'batches.lotNumber': 1 });

// CRITICAL: Multi-clinic indexes for data isolation
pharmacyInventorySchema.index({ clinic: 1, active: 1 }); // Clinic-scoped active inventory
pharmacyInventorySchema.index({ clinic: 1, category: 1 }); // Clinic-scoped category filtering
pharmacyInventorySchema.index({ clinic: 1, 'inventory.status': 1 }); // Clinic-scoped status
pharmacyInventorySchema.index({ clinic: 1, 'medication.genericName': 1 }); // Clinic-scoped medication lookup

// Virtuals
pharmacyInventorySchema.virtual('inventory.available').get(function() {
  return this.inventory.currentStock - (this.inventory.reserved || 0);
});

pharmacyInventorySchema.virtual('isLowStock').get(function() {
  const available = this.inventory.currentStock - (this.inventory.reserved || 0);
  return available <= this.inventory.minimumStock;
});

pharmacyInventorySchema.virtual('isOutOfStock').get(function() {
  const available = this.inventory.currentStock - (this.inventory.reserved || 0);
  return available === 0;
});

pharmacyInventorySchema.virtual('daysToExpiry').get(function() {
  if (!this.batches || this.batches.length === 0) return null;

  const earliestExpiry = this.batches
    .filter(b => b.status === 'active' && b.quantity > 0)
    .sort((a, b) => a.expirationDate - b.expirationDate)[0];

  if (!earliestExpiry) return null;

  const now = new Date();
  const diff = earliestExpiry.expirationDate - now;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// Methods
pharmacyInventorySchema.methods.updateStock = async function(quantity, type, userId, reference, notes) {
  const transaction = {
    type,
    quantity: Math.abs(quantity),
    date: new Date(),
    performedBy: userId,
    reference,
    notes,
    balanceBefore: this.inventory.currentStock
  };

  // Update stock
  if (['received', 'returned', 'adjusted'].includes(type)) {
    this.inventory.currentStock += Math.abs(quantity);
  } else if (['dispensed', 'expired', 'damaged', 'recalled', 'transferred'].includes(type)) {
    this.inventory.currentStock -= Math.abs(quantity);
  }

  transaction.balanceAfter = this.inventory.currentStock;

  // Add transaction to history
  this.transactions.push(transaction);

  // Update stock status
  this.updateStockStatus();

  // Create alerts if necessary
  this.checkAndCreateAlerts();

  return this.save();
};

pharmacyInventorySchema.methods.addBatch = async function(batchData, userId) {
  const batch = {
    ...batchData,
    receivedDate: new Date(),
    status: 'active'
  };

  this.batches.push(batch);

  // Add transaction
  await this.updateStock(batchData.quantity, 'received', userId, batchData.lotNumber, 'New batch received');

  return this.save();
};

// Reserve stock for prescriptions/procedures
// NOW WITH TRANSACTION SUPPORT - Prevents race conditions when wrapped in transaction
pharmacyInventorySchema.methods.reserveStock = async function(quantity, type, referenceId, referenceModel, userId, session = null) {
  const available = this.inventory.currentStock - (this.inventory.reserved || 0);

  if (available < quantity) {
    throw new Error(`Insufficient available stock. Available: ${available}, Requested: ${quantity}`);
  }

  // Generate reservation ID
  const reservationId = `RES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Find batches to reserve from (FEFO - First Expiry First Out)
  const activeBatches = this.batches
    .filter(b => b.status === 'active' && (b.quantity - (b.reserved || 0)) > 0)
    .sort((a, b) => a.expirationDate - b.expirationDate);

  if (activeBatches.length === 0) {
    throw new Error('No active batches available');
  }

  // CRITICAL: Check for expired batches before reserving
  const now = new Date();
  for (const batch of activeBatches) {
    if (batch.expirationDate && new Date(batch.expirationDate) < now) {
      throw new Error(`Cannot reserve expired medication: Lot ${batch.lotNumber} expired on ${batch.expirationDate}`);
    }
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
    type,
    reference: referenceId,
    referenceModel,
    quantity,
    batches: reservedBatches,
    reservedBy: userId,
    status: 'active'
  });

  // Update total reserved
  this.inventory.reserved = (this.inventory.reserved || 0) + quantity;

  // Use session for save if provided (transaction support)
  await this.save(session ? { session } : {});

  return {
    reservationId,
    quantity,
    batches: reservedBatches
  };
};

// Release a reservation
// NOW WITH TRANSACTION SUPPORT
pharmacyInventorySchema.methods.releaseReservation = async function(reservationId, session = null) {
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

  // Use session for save if provided (transaction support)
  await this.save(session ? { session } : {});

  return {
    released: reservation.quantity
  };
};

// CRITICAL FIX: Fulfill a reservation (consume reserved stock)
// This method properly decrements both currentStock AND reserved when dispensing reserved items
pharmacyInventorySchema.methods.fulfillReservation = async function(reservationId, userId, session = null) {
  const reservation = this.reservations.find(r => r.reservationId === reservationId && r.status === 'active');

  if (!reservation) {
    throw new Error('Reservation not found or already processed');
  }

  // Decrement from batches
  for (const reservedBatch of reservation.batches) {
    const batch = this.batches.find(b => b.lotNumber === reservedBatch.lotNumber);
    if (batch) {
      // Decrease actual quantity (it was reserved, now being consumed)
      batch.quantity = Math.max(0, batch.quantity - reservedBatch.quantity);
      // Decrease reserved count
      batch.reserved = Math.max(0, (batch.reserved || 0) - reservedBatch.quantity);

      if (batch.quantity === 0) {
        batch.status = 'depleted';
      }

      // Add to dispensing history
      this.usage.dispensingHistory.push({
        date: new Date(),
        quantity: reservedBatch.quantity,
        prescription: reservation.reference,
        dispensedBy: userId,
        lotNumber: batch.lotNumber
      });
    }
  }

  // Update totals
  this.inventory.currentStock = Math.max(0, this.inventory.currentStock - reservation.quantity);
  this.inventory.reserved = Math.max(0, (this.inventory.reserved || 0) - reservation.quantity);

  // Update usage stats
  this.usage.totalDispensed = (this.usage.totalDispensed || 0) + reservation.quantity;
  this.usage.lastDispensedDate = new Date();

  // Mark reservation as fulfilled
  reservation.status = 'fulfilled';
  reservation.fulfilledAt = new Date();
  reservation.fulfilledBy = userId;

  // Add transaction record
  this.transactions.push({
    type: 'dispensed',
    quantity: reservation.quantity,
    date: new Date(),
    performedBy: userId,
    reference: reservation.reference?.toString(),
    notes: `Fulfilled reservation ${reservationId}`,
    balanceBefore: this.inventory.currentStock + reservation.quantity,
    balanceAfter: this.inventory.currentStock
  });

  // Update stock status
  this.updateStockStatus();

  // Check and create alerts
  this.checkAndCreateAlerts();

  // Use session for save if provided (transaction support)
  await this.save(session ? { session } : {});

  return {
    fulfilled: reservation.quantity,
    reservationId
  };
};

pharmacyInventorySchema.methods.dispenseMedication = async function(quantity, prescriptionId, patientId, userId, lotNumber) {
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

  // Add to dispensing history
  this.usage.dispensingHistory.push({
    date: new Date(),
    quantity,
    prescription: prescriptionId,
    patient: patientId,
    dispensedBy: userId,
    lotNumber: batch.lotNumber
  });

  this.usage.totalDispensed += quantity;
  this.usage.lastDispensedDate = new Date();

  // Update stock
  await this.updateStock(quantity, 'dispensed', userId, prescriptionId, `Dispensed from lot ${batch.lotNumber}`);

  return this.save();
};

pharmacyInventorySchema.methods.updateStockStatus = function() {
  if (this.inventory.currentStock === 0) {
    this.inventory.status = 'out-of-stock';
  } else if (this.inventory.currentStock <= this.inventory.minimumStock) {
    this.inventory.status = 'low-stock';
  } else if (this.inventory.maximumStock && this.inventory.currentStock > this.inventory.maximumStock) {
    this.inventory.status = 'overstocked';
  } else {
    this.inventory.status = 'in-stock';
  }
};

pharmacyInventorySchema.methods.checkAndCreateAlerts = function() {
  // Low stock alert
  if (this.isLowStock && !this.isOutOfStock) {
    const existingAlert = this.alerts.find(a => a.type === 'low-stock' && !a.resolved);
    if (!existingAlert) {
      this.alerts.push({
        type: 'low-stock',
        severity: 'medium',
        message: `Stock level (${this.inventory.currentStock}) is below minimum (${this.inventory.minimumStock})`,
        createdAt: new Date()
      });
    }
  }

  // Out of stock alert
  if (this.isOutOfStock) {
    const existingAlert = this.alerts.find(a => a.type === 'out-of-stock' && !a.resolved);
    if (!existingAlert) {
      this.alerts.push({
        type: 'out-of-stock',
        severity: 'high',
        message: 'Medication is out of stock',
        createdAt: new Date()
      });
    }
  }

  // Expiring soon alert (30 days)
  const daysToExpiry = this.daysToExpiry;
  if (daysToExpiry !== null && daysToExpiry <= 30 && daysToExpiry > 0) {
    const existingAlert = this.alerts.find(a => a.type === 'expiring-soon' && !a.resolved);
    if (!existingAlert) {
      this.alerts.push({
        type: 'expiring-soon',
        severity: daysToExpiry <= 7 ? 'high' : 'medium',
        message: `Medication expiring in ${daysToExpiry} days`,
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
        message: 'Medication has expired',
        createdAt: new Date()
      });
    }
  }
};

pharmacyInventorySchema.methods.markBatchExpired = async function(lotNumber, userId) {
  const batch = this.batches.find(b => b.lotNumber === lotNumber);

  if (!batch) {
    throw new Error('Batch not found');
  }

  const expiredQuantity = batch.quantity;
  batch.status = 'expired';
  batch.quantity = 0;

  await this.updateStock(expiredQuantity, 'expired', userId, lotNumber, 'Batch expired');

  return this.save();
};

// Static methods
pharmacyInventorySchema.statics.searchMedications = async function(query, options = {}) {
  const searchOptions = {
    $or: [
      { 'medication.genericName': new RegExp(query, 'i') },
      { 'medication.brandName': new RegExp(query, 'i') }
    ],
    active: true
  };

  if (options.category) {
    searchOptions.category = options.category;
  }

  if (options.inStockOnly) {
    searchOptions['inventory.currentStock'] = { $gt: 0 };
  }

  return this.find(searchOptions)
    .limit(options.limit || 20)
    .populate('drug')
    .select('medication inventory pricing batches');
};

pharmacyInventorySchema.statics.getLowStockItems = async function() {
  return this.find({
    'inventory.status': 'low-stock',
    active: true
  })
    .sort({ 'inventory.currentStock': 1 })
    .populate('drug');
};

pharmacyInventorySchema.statics.getExpiringItems = async function(days = 30) {
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
    .populate('drug')
    .sort({ 'batches.expirationDate': 1 });
};

pharmacyInventorySchema.statics.getInventoryValue = async function() {
  return this.aggregate([
    { $match: { active: true } },
    {
      $project: {
        totalValue: {
          $multiply: ['$inventory.currentStock', '$pricing.costPrice']
        }
      }
    },
    {
      $group: {
        _id: null,
        totalInventoryValue: { $sum: '$totalValue' }
      }
    }
  ]);
};

// Middleware
pharmacyInventorySchema.pre('save', function(next) {
  // Update stock status before saving
  this.updateStockStatus();

  // Check and create alerts
  this.checkAndCreateAlerts();

  next();
});

module.exports = mongoose.model('PharmacyInventory', pharmacyInventorySchema);
