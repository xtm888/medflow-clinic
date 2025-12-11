/**
 * Warranty Tracking Model
 * Tracks warranties for optical products, equipment, and devices
 */

const mongoose = require('mongoose');

const WarrantyCoverageSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['manufacturer', 'extended', 'store', 'third_party'],
    required: true
  },
  provider: { type: String, required: true },
  coverageType: {
    type: String,
    enum: ['full', 'limited', 'parts_only', 'labor_only'],
    default: 'full'
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  coverageDetails: { type: String },
  exclusions: [{ type: String }],
  deductible: { type: Number, default: 0 },
  maxClaims: { type: Number },
  claimsUsed: { type: Number, default: 0 },
  policyNumber: { type: String },
  contactPhone: { type: String },
  contactEmail: { type: String },
  documentUrl: { type: String }
});

const WarrantyClaimSchema = new mongoose.Schema({
  claimNumber: { type: String, required: true },
  claimDate: { type: Date, default: Date.now },
  issue: { type: String, required: true },
  issueDescription: { type: String },
  warrantyType: { type: String }, // Which warranty used
  status: {
    type: String,
    enum: ['submitted', 'under_review', 'approved', 'denied', 'completed', 'cancelled'],
    default: 'submitted'
  },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvalDate: { type: Date },
  denialReason: { type: String },
  resolutionType: {
    type: String,
    enum: ['repair', 'replacement', 'refund', 'credit', 'other']
  },
  resolutionDetails: { type: String },
  resolutionDate: { type: Date },
  costCovered: { type: Number },
  customerCost: { type: Number },
  notes: { type: String },
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: Date
  }]
});

const WarrantyTrackingSchema = new mongoose.Schema({
  warrantyNumber: {
    type: String,
    unique: true,
    required: true
  },
  itemType: {
    type: String,
    enum: ['eyeglasses', 'frame', 'lens', 'contact_lens', 'equipment', 'device', 'hearing_aid', 'other'],
    required: true
  },
  itemDescription: { type: String, required: true },
  serialNumber: { type: String },
  modelNumber: { type: String },
  manufacturer: { type: String },
  brand: { type: String },

  // Purchase information
  purchase: {
    date: { type: Date, required: true },
    price: { type: Number },
    invoiceNumber: { type: String },
    orderId: { type: mongoose.Schema.Types.ObjectId }
  },

  // Customer/Patient information
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  customerName: { type: String },

  // Warranty coverage
  warranties: [WarrantyCoverageSchema],

  // Claims history
  claims: [WarrantyClaimSchema],

  // Status
  status: {
    type: String,
    enum: ['active', 'expired', 'voided', 'transferred'],
    default: 'active'
  },

  // Registration
  registered: { type: Boolean, default: true },
  registrationDate: { type: Date, default: Date.now },
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Expiration tracking
  expirationNotified: { type: Boolean, default: false },
  expirationNotificationDate: { type: Date },

  // Transfer history
  transferHistory: [{
    fromCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    toCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    transferDate: { type: Date },
    transferredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String }
  }],

  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },

  notes: { type: String },

  // Audit trail
  history: [{
    action: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date, default: Date.now },
    details: mongoose.Schema.Types.Mixed
  }]
}, {
  timestamps: true
});

// Generate warranty number
WarrantyTrackingSchema.pre('save', async function (next) {
  if (this.isNew && !this.warrantyNumber) {
    const date = new Date();
    const year = date.getFullYear();

    const lastWarranty = await this.constructor.findOne({
      warrantyNumber: new RegExp(`^WTY-${year}`)
    }).sort({ warrantyNumber: -1 });

    let sequence = 1;
    if (lastWarranty) {
      const lastSequence = parseInt(lastWarranty.warrantyNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    this.warrantyNumber = `WTY-${year}-${String(sequence).padStart(6, '0')}`;
  }

  // Update status based on warranty expiration
  this.updateStatus();

  next();
});

// Update warranty status
WarrantyTrackingSchema.methods.updateStatus = function () {
  if (this.status === 'voided' || this.status === 'transferred') return;

  const now = new Date();
  const activeWarranties = this.warranties.filter(w => new Date(w.endDate) > now);

  if (activeWarranties.length === 0) {
    this.status = 'expired';
  } else {
    this.status = 'active';
  }
};

// Check if warranty is active
WarrantyTrackingSchema.methods.isWarrantyActive = function () {
  if (this.status !== 'active') return false;

  const now = new Date();
  return this.warranties.some(w => new Date(w.endDate) > now);
};

// Get active warranty
WarrantyTrackingSchema.methods.getActiveWarranty = function () {
  const now = new Date();
  return this.warranties.find(w => new Date(w.endDate) > now);
};

// File a claim
WarrantyTrackingSchema.methods.fileClaim = function (userId, issue, issueDescription, warrantyType) {
  const activeWarranty = this.warranties.find(w =>
    w.type === warrantyType && new Date(w.endDate) > new Date()
  );

  if (!activeWarranty) {
    throw new Error('No active warranty of the specified type');
  }

  if (activeWarranty.maxClaims && activeWarranty.claimsUsed >= activeWarranty.maxClaims) {
    throw new Error('Maximum number of claims reached for this warranty');
  }

  const claimNumber = `CLM-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  this.claims.push({
    claimNumber,
    claimDate: new Date(),
    issue,
    issueDescription,
    warrantyType,
    status: 'submitted',
    submittedBy: userId
  });

  activeWarranty.claimsUsed++;

  this.history.push({
    action: 'claim_filed',
    performedBy: userId,
    performedAt: new Date(),
    details: { claimNumber, issue }
  });

  return this.save();
};

// Approve claim
WarrantyTrackingSchema.methods.approveClaim = function (claimNumber, userId, resolutionType, resolutionDetails, costCovered) {
  const claim = this.claims.find(c => c.claimNumber === claimNumber);
  if (!claim) throw new Error('Claim not found');

  claim.status = 'approved';
  claim.approvedBy = userId;
  claim.approvalDate = new Date();
  claim.resolutionType = resolutionType;
  claim.resolutionDetails = resolutionDetails;
  claim.costCovered = costCovered;

  this.history.push({
    action: 'claim_approved',
    performedBy: userId,
    performedAt: new Date(),
    details: { claimNumber, resolutionType }
  });

  return this.save();
};

// Transfer warranty
WarrantyTrackingSchema.methods.transfer = function (userId, toCustomerId, reason) {
  this.transferHistory.push({
    fromCustomer: this.customer,
    toCustomer: toCustomerId,
    transferDate: new Date(),
    transferredBy: userId,
    reason
  });

  const previousCustomer = this.customer;
  this.customer = toCustomerId;

  this.history.push({
    action: 'warranty_transferred',
    performedBy: userId,
    performedAt: new Date(),
    details: { from: previousCustomer, to: toCustomerId, reason }
  });

  return this.save();
};

// Indexes
WarrantyTrackingSchema.index({ warrantyNumber: 1 });
WarrantyTrackingSchema.index({ customer: 1 });
WarrantyTrackingSchema.index({ status: 1 });
WarrantyTrackingSchema.index({ 'warranties.endDate': 1 });
WarrantyTrackingSchema.index({ serialNumber: 1 });
WarrantyTrackingSchema.index({ clinic: 1, status: 1 });

module.exports = mongoose.model('WarrantyTracking', WarrantyTrackingSchema);
