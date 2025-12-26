const mongoose = require('mongoose');
const crypto = require('crypto');

const insuranceClaimSchema = new mongoose.Schema({
  claimNumber: {
    type: String,
    unique: true,
    required: true
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true,
    index: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  // Multi-clinic support
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    index: true
  },
  provider: {
    name: { type: String, required: true },
    policyNumber: { type: String, required: true },
    groupNumber: String,
    memberId: String,
    relationToSubscriber: {
      type: String,
      enum: ['self', 'spouse', 'child', 'other'],
      default: 'self'
    },
    subscriberName: String,
    subscriberDOB: Date,
    contactPhone: String,
    contactEmail: String
  },
  services: [{
    code: String,
    description: String,
    dateOfService: Date,
    units: { type: Number, default: 1 },
    chargedAmount: Number,
    claimedAmount: Number,
    diagnosisCode: String,
    modifier: String,
    placeOfService: String
  }],
  amounts: {
    totalCharged: { type: Number, required: true },
    totalClaimed: { type: Number, required: true },
    approvedAmount: { type: Number, default: 0 },
    patientResponsibility: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    writeOffAmount: { type: Number, default: 0 },
    adjustments: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'submitted', 'processing', 'approved', 'partially-approved', 'rejected', 'appealed', 'paid', 'closed'],
    default: 'draft',
    index: true
  },
  statusHistory: [{
    status: String,
    date: { type: Date, default: Date.now },
    notes: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  submissionDetails: {
    method: { type: String, enum: ['electronic', 'paper', 'portal'] },
    submittedAt: Date,
    referenceNumber: String,
    batchId: String
  },
  processingDetails: {
    receivedAt: Date,
    processedAt: Date,
    adjudicatedAt: Date,
    paidAt: Date,
    checkNumber: String,
    eraNumber: String,
    remitDate: Date
  },
  denialDetails: {
    reason: String,
    code: String,
    date: Date,
    appealDeadline: Date
  },
  appealDetails: {
    appealedAt: Date,
    appealReason: String,
    appealStatus: String,
    appealReference: String,
    documents: [String]
  },
  attachments: [{
    name: String,
    type: String,
    path: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  notes: [{
    content: String,
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  followUpDate: Date,
  timelyFiling: { // Track timely filing deadline
    deadline: Date,
    daysRemaining: Number
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

insuranceClaimSchema.index({ claimNumber: 1 }, { unique: true });
insuranceClaimSchema.index({ status: 1, createdAt: -1 });
insuranceClaimSchema.index({ 'provider.name': 1, status: 1 });

// Multi-clinic compound indexes
insuranceClaimSchema.index({ clinic: 1, status: 1 });
insuranceClaimSchema.index({ clinic: 1, patient: 1, createdAt: -1 });
insuranceClaimSchema.index({ clinic: 1, createdAt: -1 });

insuranceClaimSchema.pre('save', async function(next) {
  if (!this.claimNumber) {
    const year = new Date().getFullYear();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    this.claimNumber = `CLM${year}${random}`;
  }

  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      date: new Date(),
      updatedBy: this.updatedBy
    });
  }

  next();
});

insuranceClaimSchema.methods.submit = async function(userId, method = 'electronic') {
  if (this.status !== 'draft' && this.status !== 'pending') {
    throw new Error('Can only submit draft or pending claims');
  }

  this.status = 'submitted';
  this.submissionDetails = {
    method,
    submittedAt: new Date(),
    referenceNumber: `SUB${Date.now()}`
  };
  this.updatedBy = userId;

  await this.save();
  return this;
};

insuranceClaimSchema.methods.approve = async function(userId, approvedAmount, patientResponsibility = 0, notes = '') {
  this.status = approvedAmount < this.amounts.totalClaimed ? 'partially-approved' : 'approved';
  this.amounts.approvedAmount = approvedAmount;
  this.amounts.patientResponsibility = patientResponsibility;
  this.processingDetails.adjudicatedAt = new Date();
  this.updatedBy = userId;

  if (notes) {
    this.notes.push({ content: notes, createdBy: userId });
  }

  await this.save();

  // Sync to invoice
  await this.syncToInvoice(userId);

  return this;
};

insuranceClaimSchema.methods.deny = async function(userId, reason, code, appealDeadline) {
  this.status = 'rejected';
  this.denialDetails = {
    reason,
    code,
    date: new Date(),
    appealDeadline
  };
  this.updatedBy = userId;

  await this.save();

  // Sync to invoice
  await this.syncToInvoice(userId);

  return this;
};

insuranceClaimSchema.methods.markPaid = async function(userId, paidAmount, checkNumber, eraNumber) {
  this.status = 'paid';
  this.amounts.paidAmount = paidAmount;
  this.processingDetails.paidAt = new Date();
  this.processingDetails.checkNumber = checkNumber;
  this.processingDetails.eraNumber = eraNumber;
  this.updatedBy = userId;

  await this.save();

  // Sync to invoice
  await this.syncToInvoice(userId);

  return this;
};

// Sync insurance claim adjustments to the linked invoice
insuranceClaimSchema.methods.syncToInvoice = async function(userId) {
  const Invoice = require('./Invoice');
  const invoice = await Invoice.findById(this.invoice);

  if (!invoice) {
    console.error(`Invoice not found for claim ${this.claimNumber}`);
    return;
  }

  const adjustmentData = {
    claimNumber: this.claimNumber,
    status: this.status,
    syncedAt: new Date(),
    syncedBy: userId
  };

  // Initialize insurance tracking if not exists
  if (!invoice.insuranceAdjustments) {
    invoice.insuranceAdjustments = [];
  }

  // Calculate adjustment amounts
  const totalClaimed = this.amounts.totalClaimed || 0;
  const approvedAmount = this.amounts.approvedAmount || 0;
  const paidAmount = this.amounts.paidAmount || 0;
  const patientResponsibility = this.amounts.patientResponsibility || 0;
  const adjustments = totalClaimed - approvedAmount; // Amount not covered
  const writeOffAmount = this.amounts.writeOffAmount || 0;

  // Record the adjustment
  const adjustment = {
    claimId: this._id,
    claimNumber: this.claimNumber,
    providerName: this.provider?.name,
    status: this.status,
    totalClaimed,
    approvedAmount,
    paidAmount,
    patientResponsibility,
    adjustmentAmount: adjustments,
    writeOffAmount,
    processedAt: new Date(),
    processedBy: userId,
    notes: ''
  };

  // Handle based on claim status
  switch (this.status) {
    case 'approved':
    case 'partially-approved':
      adjustment.notes = `Insurance approved ${approvedAmount} of ${totalClaimed} claimed. Patient responsibility: ${patientResponsibility}`;

      // Update invoice insurance summary
      invoice.insuranceSummary = invoice.insuranceSummary || {};
      invoice.insuranceSummary.totalClaimed = totalClaimed;
      invoice.insuranceSummary.approvedAmount = approvedAmount;
      invoice.insuranceSummary.patientResponsibility = patientResponsibility;
      invoice.insuranceSummary.adjustments = adjustments;
      invoice.insuranceSummary.status = this.status;
      invoice.insuranceSummary.lastUpdated = new Date();
      break;

    case 'rejected':
      adjustment.notes = `Insurance claim denied: ${this.denialDetails?.reason || 'Unknown reason'}. Full amount is patient responsibility.`;

      invoice.insuranceSummary = invoice.insuranceSummary || {};
      invoice.insuranceSummary.totalClaimed = totalClaimed;
      invoice.insuranceSummary.approvedAmount = 0;
      invoice.insuranceSummary.patientResponsibility = totalClaimed;
      invoice.insuranceSummary.adjustments = totalClaimed;
      invoice.insuranceSummary.status = 'rejected';
      invoice.insuranceSummary.denialReason = this.denialDetails?.reason;
      invoice.insuranceSummary.denialCode = this.denialDetails?.code;
      invoice.insuranceSummary.lastUpdated = new Date();
      break;

    case 'paid':
      adjustment.notes = `Insurance payment received: ${paidAmount}. Check#: ${this.processingDetails?.checkNumber || 'N/A'}`;

      // Add insurance payment to invoice
      if (paidAmount > 0) {
        const paymentId = `INS${Date.now()}${require('crypto').randomBytes(3).toString('hex').toUpperCase()}`;

        // Check if payment already exists
        const existingPayment = invoice.payments.find(p =>
          p.reference?.includes(this.claimNumber) && p.method === 'insurance'
        );

        if (!existingPayment) {
          invoice.payments.push({
            paymentId,
            amount: paidAmount,
            currency: process.env.BASE_CURRENCY || 'CDF',
            amountInBaseCurrency: paidAmount,
            exchangeRate: 1,
            method: 'insurance',
            date: this.processingDetails?.paidAt || new Date(),
            reference: `Insurance: ${this.claimNumber}`,
            notes: `Insurance payment from ${this.provider?.name}. ERA#: ${this.processingDetails?.eraNumber || 'N/A'}`,
            receivedBy: userId,
            insuranceClaimId: this._id
          });
        }
      }

      // Update insurance summary
      invoice.insuranceSummary = invoice.insuranceSummary || {};
      invoice.insuranceSummary.paidAmount = paidAmount;
      invoice.insuranceSummary.status = 'paid';
      invoice.insuranceSummary.paidAt = this.processingDetails?.paidAt;
      invoice.insuranceSummary.checkNumber = this.processingDetails?.checkNumber;
      invoice.insuranceSummary.eraNumber = this.processingDetails?.eraNumber;
      invoice.insuranceSummary.lastUpdated = new Date();
      break;
  }

  // Add to adjustment history
  invoice.insuranceAdjustments.push(adjustment);

  // Record in invoice edit history if method exists
  if (invoice.recordEdit) {
    invoice.recordEdit('insurance_adjustment', {
      claimNumber: this.claimNumber,
      status: this.status,
      approvedAmount,
      paidAmount,
      patientResponsibility
    }, null, userId, `Insurance claim ${this.status}`);
  }

  invoice.updatedBy = userId;
  await invoice.save();

  return adjustment;
};

// Static method to sync all pending insurance adjustments
insuranceClaimSchema.statics.syncAllPendingToInvoices = async function(userId) {
  const claimsToSync = await this.find({
    status: { $in: ['approved', 'partially-approved', 'paid', 'rejected'] },
    $or: [
      { 'syncDetails.syncedToInvoice': { $ne: true } },
      { 'syncDetails.syncedToInvoice': { $exists: false } }
    ]
  });

  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: []
  };

  for (const claim of claimsToSync) {
    try {
      await claim.syncToInvoice(userId);
      claim.syncDetails = claim.syncDetails || {};
      claim.syncDetails.syncedToInvoice = true;
      claim.syncDetails.syncedAt = new Date();
      await claim.save();
      results.successful++;
    } catch (err) {
      results.failed++;
      results.errors.push({
        claimNumber: claim.claimNumber,
        error: err.message
      });
    }
    results.processed++;
  }

  return results;
};

insuranceClaimSchema.statics.getByStatus = function(status) {
  return this.find({ status })
    .populate('patient', 'firstName lastName patientId')
    .populate('invoice', 'invoiceId summary')
    .sort('-createdAt');
};

insuranceClaimSchema.statics.getPendingClaims = function() {
  return this.find({ status: { $in: ['submitted', 'processing'] } })
    .populate('patient', 'firstName lastName patientId')
    .populate('invoice', 'invoiceId summary')
    .sort('createdAt');
};

insuranceClaimSchema.statics.getClaimsReport = async function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalClaimed: { $sum: '$amounts.totalClaimed' },
        totalApproved: { $sum: '$amounts.approvedAmount' },
        totalPaid: { $sum: '$amounts.paidAmount' }
      }
    }
  ]);
};

module.exports = mongoose.model('InsuranceClaim', insuranceClaimSchema);
