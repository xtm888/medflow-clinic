/**
 * Stock Reconciliation Model
 * Tracks inventory counts and discrepancy reconciliation
 */

const mongoose = require('mongoose');

const ReconciliationItemSchema = new mongoose.Schema({
  inventoryType: {
    type: String,
    enum: ['pharmacy', 'frame', 'contactLens', 'opticalLens', 'reagent', 'labConsumable', 'surgicalSupply'],
    required: true
  },
  inventoryItemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  itemName: { type: String, required: true },
  itemCode: { type: String },
  location: { type: String },
  unit: { type: String, required: true },

  // Quantities
  systemQuantity: { type: Number, required: true },
  countedQuantity: { type: Number, required: true },
  variance: { type: Number },
  variancePercent: { type: Number },
  varianceValue: { type: Number }, // Financial impact

  // Variance details
  varianceType: {
    type: String,
    enum: ['none', 'overage', 'shortage', 'damaged', 'expired'],
    default: 'none'
  },
  varianceReason: {
    type: String,
    enum: [
      'counting_error',
      'theft',
      'damage',
      'expiration',
      'system_error',
      'receiving_error',
      'dispensing_error',
      'transfer_not_recorded',
      'breakage',
      'spillage',
      'unknown',
      'other'
    ]
  },
  varianceNotes: { type: String },

  // Lot tracking
  lotNumber: { type: String },
  expirationDate: { type: Date },

  // Adjustment
  adjustmentMade: { type: Boolean, default: false },
  adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adjustedAt: { type: Date },
  adjustmentNotes: { type: String },

  // Verification
  countedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  countedAt: { type: Date },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date }
});

// Calculate variance before save
ReconciliationItemSchema.pre('save', function (next) {
  this.variance = this.countedQuantity - this.systemQuantity;
  this.variancePercent = this.systemQuantity !== 0
    ? ((this.variance / this.systemQuantity) * 100)
    : (this.countedQuantity > 0 ? 100 : 0);

  if (this.variance > 0) {
    this.varianceType = 'overage';
  } else if (this.variance < 0) {
    this.varianceType = 'shortage';
  } else {
    this.varianceType = 'none';
  }

  next();
});

const StockReconciliationSchema = new mongoose.Schema({
  reconciliationNumber: {
    type: String,
    unique: true,
    required: true
  },
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  department: {
    type: String,
    enum: ['pharmacy', 'optical', 'laboratory', 'surgery', 'all'],
    required: true
  },
  reconciliationType: {
    type: String,
    enum: ['full', 'partial', 'spot_check', 'cycle_count', 'annual'],
    default: 'partial'
  },
  status: {
    type: String,
    enum: ['draft', 'in_progress', 'pending_review', 'reviewed', 'adjusted', 'completed', 'cancelled'],
    default: 'draft'
  },

  // Scheduling
  scheduledDate: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },

  // Items
  items: [ReconciliationItemSchema],

  // Summary statistics
  summary: {
    totalItemsCounted: { type: Number, default: 0 },
    itemsWithVariance: { type: Number, default: 0 },
    totalOverage: { type: Number, default: 0 },
    totalShortage: { type: Number, default: 0 },
    overageValue: { type: Number, default: 0 },
    shortageValue: { type: Number, default: 0 },
    netVarianceValue: { type: Number, default: 0 },
    accuracyRate: { type: Number, default: 100 }
  },

  // Personnel
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  countTeam: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },

  // Notes and documentation
  notes: { type: String },
  findings: { type: String },
  recommendations: { type: String },
  correctiveActions: { type: String },

  // Attachments
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: Date,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  // Audit trail
  history: [{
    action: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date, default: Date.now },
    details: mongoose.Schema.Types.Mixed
  }],

  // Soft delete support
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date,

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Generate reconciliation number
StockReconciliationSchema.pre('save', async function (next) {
  if (this.isNew && !this.reconciliationNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const lastRec = await this.constructor.findOne({
      reconciliationNumber: new RegExp(`^REC-${year}${month}`)
    }).sort({ reconciliationNumber: -1 });

    let sequence = 1;
    if (lastRec) {
      const lastSequence = parseInt(lastRec.reconciliationNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    this.reconciliationNumber = `REC-${year}${month}-${String(sequence).padStart(4, '0')}`;
  }

  // Calculate summary
  this.calculateSummary();

  next();
});

// Calculate summary statistics
StockReconciliationSchema.methods.calculateSummary = function () {
  const items = this.items || [];

  this.summary.totalItemsCounted = items.length;
  this.summary.itemsWithVariance = items.filter(i => i.variance !== 0).length;
  this.summary.totalOverage = items.filter(i => i.variance > 0).reduce((sum, i) => sum + i.variance, 0);
  this.summary.totalShortage = Math.abs(items.filter(i => i.variance < 0).reduce((sum, i) => sum + i.variance, 0));
  this.summary.overageValue = items.filter(i => i.variance > 0).reduce((sum, i) => sum + (i.varianceValue || 0), 0);
  this.summary.shortageValue = Math.abs(items.filter(i => i.variance < 0).reduce((sum, i) => sum + (i.varianceValue || 0), 0));
  this.summary.netVarianceValue = this.summary.overageValue - this.summary.shortageValue;

  if (items.length > 0) {
    const matchingItems = items.filter(i => i.variance === 0).length;
    this.summary.accuracyRate = ((matchingItems / items.length) * 100).toFixed(1);
  }
};

// Add history entry
StockReconciliationSchema.methods.addHistory = function (action, userId, details) {
  this.history.push({
    action,
    performedBy: userId,
    performedAt: new Date(),
    details
  });
};

// Start reconciliation
StockReconciliationSchema.methods.start = function (userId) {
  if (this.status !== 'draft') {
    throw new Error('Can only start a draft reconciliation');
  }
  this.status = 'in_progress';
  this.startedAt = new Date();
  this.addHistory('started', userId);
  return this.save();
};

// Add count
StockReconciliationSchema.methods.addCount = function (userId, itemData) {
  itemData.countedBy = userId;
  itemData.countedAt = new Date();
  this.items.push(itemData);
  this.addHistory('item_counted', userId, { item: itemData.itemName });
  return this.save();
};

// Submit for review
StockReconciliationSchema.methods.submitForReview = function (userId) {
  if (this.status !== 'in_progress') {
    throw new Error('Can only submit in-progress reconciliation');
  }
  this.status = 'pending_review';
  this.addHistory('submitted_for_review', userId);
  return this.save();
};

// Review
StockReconciliationSchema.methods.review = function (userId, findings, recommendations) {
  if (this.status !== 'pending_review') {
    throw new Error('Can only review pending reconciliation');
  }
  this.status = 'reviewed';
  this.reviewedBy = userId;
  this.reviewedAt = new Date();
  this.findings = findings;
  this.recommendations = recommendations;
  this.addHistory('reviewed', userId, { findings });
  return this.save();
};

// Apply adjustments
StockReconciliationSchema.methods.applyAdjustments = async function (userId, adjustments) {
  for (const adj of adjustments) {
    const item = this.items.id(adj.itemId);
    if (item && !item.adjustmentMade) {
      item.adjustmentMade = true;
      item.adjustedBy = userId;
      item.adjustedAt = new Date();
      item.adjustmentNotes = adj.notes;

      // Here you would also update the actual inventory
      // This is a placeholder for the inventory update logic
    }
  }

  this.status = 'adjusted';
  this.addHistory('adjustments_applied', userId, { adjustmentCount: adjustments.length });
  return this.save();
};

// Complete
StockReconciliationSchema.methods.complete = function (userId, correctiveActions) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.approvedBy = userId;
  this.approvedAt = new Date();
  this.correctiveActions = correctiveActions;
  this.addHistory('completed', userId);
  return this.save();
};

// Indexes
StockReconciliationSchema.index({ reconciliationNumber: 1 });
StockReconciliationSchema.index({ clinic: 1, status: 1 });
StockReconciliationSchema.index({ department: 1 });
StockReconciliationSchema.index({ scheduledDate: 1 });
StockReconciliationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('StockReconciliation', StockReconciliationSchema);
