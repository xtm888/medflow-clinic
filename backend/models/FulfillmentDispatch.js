const mongoose = require('mongoose');

const fulfillmentDispatchSchema = new mongoose.Schema({
  // What is being dispatched
  sourceType: {
    type: String,
    enum: [
      'invoice_item',      // Individual invoice item
      'prescription',      // Entire prescription or medication
      'lab_order',         // Lab order
      'imaging_order',     // Imaging order
      'surgery_referral',  // Surgery referral
      'glasses_order',     // Glasses/optical order
      'therapy_referral',  // Therapy/rehabilitation referral
      'specialist_referral' // Specialist consultation referral
    ],
    required: true
  },

  // Reference to the source document
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'sourceModel'
  },

  sourceModel: {
    type: String,
    required: true,
    enum: ['Invoice', 'Prescription', 'LabOrder', 'ImagingOrder', 'SurgeryCase', 'GlassesOrder', 'Visit']
  },

  // For invoice items, track which item
  invoiceItemId: String,

  // For prescriptions, track which medication
  medicationIndex: Number,

  // Patient reference
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },

  // Visit reference
  visit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Visit'
  },

  // What service/item is being dispatched
  serviceDetails: {
    code: String,            // Service code
    name: {                  // Service/item name
      type: String,
      required: true
    },
    description: String,     // Additional details
    quantity: Number,
    unit: String,
    instructions: String     // Special instructions for external provider
  },

  // Where it's going
  externalFacility: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExternalFacility'
  },

  // Manual facility details (if not in directory)
  manualFacility: {
    name: String,
    type: String,
    address: String,
    phone: String,
    email: String,
    contactPerson: String
  },

  // Dispatch Status
  status: {
    type: String,
    enum: [
      'pending',          // Ready to dispatch
      'dispatched',       // Sent to external facility
      'acknowledged',     // External facility confirmed receipt
      'in_progress',      // External facility working on it
      'completed',        // Service completed by external facility
      'cancelled',        // Cancelled
      'failed',           // Dispatch failed
      'returned'          // Returned to clinic (e.g., patient came back)
    ],
    default: 'pending'
  },

  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String,
    metadata: mongoose.Schema.Types.Mixed
  }],

  // Dispatch Details
  dispatch: {
    method: {
      type: String,
      enum: ['email', 'fax', 'api', 'print', 'sms', 'portal', 'manual'],
      default: 'manual'
    },
    dispatchedAt: Date,
    dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Email dispatch
    email: {
      sentTo: [String],
      subject: String,
      attachments: [String],
      messageId: String
    },

    // Print dispatch
    print: {
      copies: Number,
      printedAt: Date,
      printedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },

    // API dispatch
    api: {
      endpoint: String,
      requestId: String,
      responseCode: Number,
      responseMessage: String
    },

    // Reference number from external facility
    externalReference: String,

    // Documents sent
    documents: [{
      type: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
      name: String,
      url: String
    }]
  },

  // Acknowledgment
  acknowledgment: {
    received: { type: Boolean, default: false },
    receivedAt: Date,
    receivedBy: String,         // Name of person at external facility
    referenceNumber: String,    // Their reference number
    estimatedCompletionDate: Date,
    notes: String
  },

  // Completion
  completion: {
    completed: { type: Boolean, default: false },
    completedAt: Date,
    completedBy: String,        // Name of person at external facility
    reportReceived: Boolean,
    reportDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    results: mongoose.Schema.Types.Mixed,  // Any result data
    notes: String,

    // Confirmation by clinic staff
    confirmedAt: Date,
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },

  // For follow-up
  followUp: {
    required: { type: Boolean, default: false },
    scheduledDate: Date,
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    notes: String,
    completed: { type: Boolean, default: false }
  },

  // Priority
  priority: {
    type: String,
    enum: ['routine', 'urgent', 'stat', 'asap'],
    default: 'routine'
  },

  // Due date for completion
  dueDate: Date,

  // Reminders
  reminders: [{
    type: { type: String },     // 'patient', 'facility', 'staff'
    method: String,             // 'email', 'sms', 'call'
    sentAt: Date,
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    response: String
  }],

  // Financial
  financial: {
    paidAtClinic: { type: Boolean, default: false },
    amountPaid: Number,
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    paymentReceiptUrl: String,

    // If patient pays at external facility
    externalPayment: {
      required: Boolean,
      estimatedAmount: Number,
      actualAmount: Number,
      paidAt: Date,
      receiptUrl: String
    }
  },

  // Notes
  notes: String,
  internalNotes: String,

  // Clinic
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic'
  },

  // Ordering provider
  orderingProvider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
fulfillmentDispatchSchema.index({ patient: 1, status: 1 });
fulfillmentDispatchSchema.index({ externalFacility: 1, status: 1 });
fulfillmentDispatchSchema.index({ sourceType: 1, sourceId: 1 });
fulfillmentDispatchSchema.index({ status: 1, createdAt: -1 });
fulfillmentDispatchSchema.index({ 'dispatch.dispatchedAt': 1 });
fulfillmentDispatchSchema.index({ dueDate: 1, status: 1 });
fulfillmentDispatchSchema.index({ clinic: 1, status: 1 });
fulfillmentDispatchSchema.index({ visit: 1 });
// Compound index for default listing query (sorted by createdAt desc)
fulfillmentDispatchSchema.index({ createdAt: -1 });
fulfillmentDispatchSchema.index({ clinic: 1, createdAt: -1 });

// Pre-save hook to add status history
fulfillmentDispatchSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      by: this._statusChangeBy,
      notes: this._statusChangeNotes
    });
  }
  next();
});

// Instance method to update status
fulfillmentDispatchSchema.methods.updateStatus = async function(newStatus, userId, notes) {
  this._statusChangeBy = userId;
  this._statusChangeNotes = notes;
  this.status = newStatus;

  if (newStatus === 'dispatched') {
    this.dispatch.dispatchedAt = new Date();
    this.dispatch.dispatchedBy = userId;
  } else if (newStatus === 'acknowledged') {
    this.acknowledgment.received = true;
    this.acknowledgment.receivedAt = new Date();
  } else if (newStatus === 'completed') {
    this.completion.completed = true;
    this.completion.completedAt = new Date();
  }

  await this.save();
  return this;
};

// Instance method to mark as dispatched
fulfillmentDispatchSchema.methods.markDispatched = async function(dispatchData, userId) {
  this.status = 'dispatched';
  this.dispatch = {
    ...this.dispatch,
    ...dispatchData,
    dispatchedAt: new Date(),
    dispatchedBy: userId
  };
  this._statusChangeBy = userId;
  await this.save();
  return this;
};

// Instance method to confirm completion
fulfillmentDispatchSchema.methods.confirmCompletion = async function(completionData, userId) {
  this.status = 'completed';
  this.completion = {
    ...this.completion,
    ...completionData,
    completed: true,
    completedAt: completionData.completedAt || new Date(),
    confirmedAt: new Date(),
    confirmedBy: userId
  };
  this._statusChangeBy = userId;
  await this.save();
  return this;
};

// Static method to find pending dispatches
fulfillmentDispatchSchema.statics.findPending = function(options = {}) {
  const query = { status: 'pending' };
  if (options.clinic) query.clinic = options.clinic;
  if (options.sourceType) query.sourceType = options.sourceType;
  return this.find(query)
    .populate('patient', 'firstName lastName fileNumber')
    .populate('externalFacility', 'name type contact')
    .sort({ priority: -1, createdAt: 1 });
};

// Static method to find overdue
fulfillmentDispatchSchema.statics.findOverdue = function(options = {}) {
  const query = {
    status: { $in: ['dispatched', 'acknowledged', 'in_progress'] },
    dueDate: { $lt: new Date() }
  };
  if (options.clinic) query.clinic = options.clinic;
  return this.find(query)
    .populate('patient', 'firstName lastName fileNumber')
    .populate('externalFacility', 'name type')
    .sort({ dueDate: 1 });
};

// Static method to get summary stats
fulfillmentDispatchSchema.statics.getStats = async function(options = {}) {
  const matchStage = {};
  if (options.clinic) matchStage.clinic = new mongoose.Types.ObjectId(options.clinic);
  if (options.startDate) matchStage.createdAt = { $gte: options.startDate };
  if (options.endDate) {
    matchStage.createdAt = matchStage.createdAt || {};
    matchStage.createdAt.$lte = options.endDate;
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const byType = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$sourceType',
        count: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        dispatched: { $sum: { $cond: [{ $eq: ['$status', 'dispatched'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
      }
    }
  ]);

  return {
    byStatus: stats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    byType: byType,
    total: stats.reduce((acc, s) => acc + s.count, 0)
  };
};

module.exports = mongoose.model('FulfillmentDispatch', fulfillmentDispatchSchema);
