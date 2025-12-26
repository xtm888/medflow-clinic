const mongoose = require('mongoose');
const Counter = require('./Counter');

/**
 * Approval Model (Prior Authorization / Approbation Préalable)
 * Tracks pre-authorizations required for certain medical acts
 * Used when company conventions require approval before procedures
 */

const approvalSchema = new mongoose.Schema({
  // Unique approval ID
  approvalId: {
    type: String,
    unique: true
  },

  // Patient reference
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },

  // Company that requires approval
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },

  // Medical act/service requiring approval
  actCode: {
    type: String,
    required: true,
    uppercase: true
  },
  actName: {
    type: String,
    required: true
  },
  actCategory: {
    type: String,
    enum: ['consultation', 'procedure', 'medication', 'imaging', 'laboratory', 'therapy', 'device', 'surgery', 'examination', 'optical', 'other']
  },

  // Quantity requested
  quantityRequested: {
    type: Number,
    default: 1
  },
  quantityApproved: {
    type: Number
  },

  // Estimated cost
  estimatedCost: {
    type: Number
  },
  approvedAmount: {
    type: Number
  },
  currency: {
    type: String,
    enum: ['CDF', 'USD', 'EUR'],
    default: 'CDF'
  },

  // Medical justification
  medicalJustification: {
    diagnosis: String,
    clinicalNotes: String,
    urgency: {
      type: String,
      enum: ['routine', 'urgent', 'emergency'],
      default: 'routine'
    }
  },

  // Request details
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },

  // Company response
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired', 'cancelled', 'used'],
    default: 'pending'
  },
  respondedBy: String, // Company contact name
  respondedAt: Date,
  responseNotes: String,
  rejectionReason: String,

  // Validity period
  validFrom: {
    type: Date
  },
  validUntil: {
    type: Date
  },

  // Usage tracking
  usedCount: {
    type: Number,
    default: 0
  },
  usageHistory: [{
    usedAt: Date,
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice'
    },
    quantity: Number,
    notes: String
  }],

  // Reference documents (approval letters, etc.)
  documents: [{
    name: String,
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // External reference (company's approval number)
  externalReference: String,

  // Related visit/appointment
  visit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Visit'
  },
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },

  // Notes
  internalNotes: String,

  // Audit
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

// Indexes
approvalSchema.index({ approvalId: 1 }, { unique: true });
approvalSchema.index({ patient: 1, status: 1 });
approvalSchema.index({ company: 1, status: 1 });
approvalSchema.index({ patient: 1, actCode: 1, status: 1 });
approvalSchema.index({ status: 1, validUntil: 1 });
approvalSchema.index({ requestedAt: -1 });

// Pre-save hook to generate approvalId
approvalSchema.pre('save', async function(next) {
  if (!this.approvalId) {
    try {
      const counterId = Counter.getDailyCounterId('approval');
      const sequence = await Counter.getNextSequence(counterId);
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      this.approvalId = `APP${year}${month}${String(sequence).padStart(4, '0')}`;
    } catch (error) {
      const timestamp = Date.now().toString(36).toUpperCase();
      this.approvalId = `APP${timestamp}`;
    }
  }

  // Check expiry
  if (this.validUntil && new Date(this.validUntil) < new Date() && this.status === 'approved') {
    this.status = 'expired';
  }

  next();
});

// Virtual for status display
approvalSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    pending: 'En attente',
    approved: 'Approuvé',
    rejected: 'Refusé',
    expired: 'Expiré',
    cancelled: 'Annulé',
    used: 'Utilisé'
  };
  return statusMap[this.status] || this.status;
});

// Virtual for remaining quantity
approvalSchema.virtual('remainingQuantity').get(function() {
  if (!this.quantityApproved) return null;
  return this.quantityApproved - this.usedCount;
});

// Virtual to check if valid and usable
approvalSchema.virtual('isUsable').get(function() {
  if (this.status !== 'approved') return false;
  if (this.validUntil && new Date(this.validUntil) < new Date()) return false;
  if (this.validFrom && new Date(this.validFrom) > new Date()) return false;
  if (this.quantityApproved && this.usedCount >= this.quantityApproved) return false;
  return true;
});

// Method to approve
approvalSchema.methods.approve = function(data) {
  this.status = 'approved';
  this.respondedBy = data.respondedBy;
  this.respondedAt = new Date();
  this.responseNotes = data.notes;
  this.quantityApproved = data.quantityApproved || this.quantityRequested;
  this.approvedAmount = data.approvedAmount || this.estimatedCost;
  this.externalReference = data.externalReference;
  this.validFrom = data.validFrom || new Date();
  this.validUntil = data.validUntil;
  return this.save();
};

// Method to reject
approvalSchema.methods.reject = function(data) {
  this.status = 'rejected';
  this.respondedBy = data.respondedBy;
  this.respondedAt = new Date();
  this.rejectionReason = data.reason;
  this.responseNotes = data.notes;
  return this.save();
};

// Method to use approval
approvalSchema.methods.use = async function(userId, invoiceId, quantity = 1, notes = '') {
  if (!this.isUsable) {
    throw new Error('Cette approbation n\'est plus valide ou utilisable');
  }

  this.usedCount += quantity;
  this.usageHistory.push({
    usedAt: new Date(),
    usedBy: userId,
    invoiceId,
    quantity,
    notes
  });

  // Mark as used if fully consumed
  if (this.quantityApproved && this.usedCount >= this.quantityApproved) {
    this.status = 'used';
  }

  return this.save();
};

// Method to cancel
approvalSchema.methods.cancel = function(reason, userId) {
  this.status = 'cancelled';
  this.responseNotes = reason;
  this.updatedBy = userId;
  return this.save();
};

// Static method to check if approval exists for patient/act
approvalSchema.statics.checkApproval = async function(patientId, companyId, actCode) {
  const now = new Date();

  const approval = await this.findOne({
    patient: patientId,
    company: companyId,
    actCode: actCode.toUpperCase(),
    status: 'approved',
    // Use $and to combine both $or conditions (duplicate $or keys would overwrite)
    $and: [
      {
        $or: [
          { validFrom: null },
          { validFrom: { $lte: now } }
        ]
      },
      {
        $or: [
          { validUntil: null },
          { validUntil: { $gte: now } }
        ]
      }
    ]
  }).sort({ createdAt: -1 });

  if (!approval) {
    return { hasApproval: false };
  }

  // Check if still has remaining quantity
  if (approval.quantityApproved && approval.usedCount >= approval.quantityApproved) {
    return { hasApproval: false, reason: 'Quantité approuvée épuisée' };
  }

  return {
    hasApproval: true,
    approval,
    remainingQuantity: approval.remainingQuantity
  };
};

// Static method to get pending approvals for a company
approvalSchema.statics.getPendingForCompany = function(companyId) {
  return this.find({
    company: companyId,
    status: 'pending'
  })
    .populate('patient', 'firstName lastName patientId')
    .populate('requestedBy', 'firstName lastName')
    .sort({ requestedAt: -1 });
};

// Static method to get patient's approvals
approvalSchema.statics.getForPatient = function(patientId, includeExpired = false) {
  const query = { patient: patientId };

  if (!includeExpired) {
    query.status = { $in: ['pending', 'approved'] };
  }

  return this.find(query)
    .populate('company', 'name companyId')
    .sort({ createdAt: -1 });
};

// Static method to get expiring approvals
approvalSchema.statics.getExpiring = function(daysAhead = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return this.find({
    status: 'approved',
    validUntil: {
      $lte: futureDate,
      $gte: new Date()
    }
  })
    .populate('patient', 'firstName lastName patientId')
    .populate('company', 'name')
    .sort({ validUntil: 1 });
};

// Ensure virtuals are included
approvalSchema.set('toJSON', { virtuals: true });
approvalSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Approval', approvalSchema);
