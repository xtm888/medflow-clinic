const mongoose = require('mongoose');
const Counter = require('./Counter');

/**
 * Lab Order Model
 * Manages laboratory test orders for patients
 */
const labOrderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true
  },

  patient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient is required']
  },

  clinic: {
    type: mongoose.Schema.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic is required for multi-tenant isolation'],
    index: true
  },

  visit: {
    type: mongoose.Schema.ObjectId,
    ref: 'Visit'
  },

  appointment: {
    type: mongoose.Schema.ObjectId,
    ref: 'Appointment'
  },

  orderedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Ordering provider is required']
  },

  orderDate: {
    type: Date,
    default: Date.now
  },

  priority: {
    type: String,
    enum: ['routine', 'urgent', 'stat'],
    default: 'routine'
  },

  status: {
    type: String,
    enum: ['ordered', 'collected', 'received', 'in-progress', 'completed', 'cancelled'],
    default: 'ordered'
  },

  tests: [{
    template: {
      type: mongoose.Schema.ObjectId,
      ref: 'LaboratoryTemplate'
    },
    testName: {
      type: String,
      required: true
    },
    testCode: String,
    category: String,
    specimen: String,
    status: {
      type: String,
      enum: ['pending', 'collected', 'received', 'in-progress', 'completed', 'cancelled'],
      default: 'pending'
    },
    results: {
      type: mongoose.Schema.ObjectId,
      ref: 'LabResult'
    },
    notes: String
  }],

  specimen: {
    collectedAt: Date,
    collectedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    specimenType: String,
    barcode: {
      type: String,
      sparse: true
    },
    volume: String,
    container: String,
    receivedAt: Date,
    receivedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    quality: {
      type: String,
      enum: ['acceptable', 'hemolyzed', 'lipemic', 'icteric', 'clotted', 'insufficient', 'rejected'],
      default: 'acceptable'
    },
    rejectionReason: String
  },

  clinicalNotes: String,
  diagnosis: String,
  icdCode: String,
  fasting: {
    required: {
      type: Boolean,
      default: false
    },
    confirmed: Boolean,
    hours: Number
  },

  // Insurance/billing
  billing: {
    billable: {
      type: Boolean,
      default: true
    },
    invoice: {
      type: mongoose.Schema.ObjectId,
      ref: 'Invoice'
    },
    estimatedCost: Number,
    insurancePreAuth: String,
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'refunded'],
      default: 'pending'
    },
    paidAt: Date
  },

  // Scheduling
  scheduledDate: Date,
  scheduledTime: String,
  location: String,

  // Status history
  statusHistory: [{
    status: String,
    changedAt: {
      type: Date,
      default: Date.now
    },
    changedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    notes: String
  }],

  // External lab integration
  externalLab: {
    sent: Boolean,
    sentAt: Date,
    labName: String,
    referenceNumber: String,
    expectedResultsAt: Date
  },

  // Notifications
  notifications: {
    patientNotified: Boolean,
    patientNotifiedAt: Date,
    providerNotified: Boolean,
    providerNotifiedAt: Date
  },

  specialInstructions: String,
  urgentCallback: {
    type: Boolean,
    default: false
  },

  // Check-in tracking
  checkIn: {
    arrivedAt: Date,
    checkedInBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    fastingVerified: Boolean,
    fastingHours: Number,
    preparationVerified: Boolean,
    notes: String
  },

  // Rejection/Reschedule tracking
  rejection: {
    rejected: {
      type: Boolean,
      default: false
    },
    rejectedAt: Date,
    rejectedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: [
        'patient_ate',           // Patient a mangé (jeûne non respecté)
        'medication_taken',      // Médicaments pris
        'wrong_preparation',     // Mauvaise préparation
        'patient_sick',          // Patient malade
        'no_show',               // Patient absent
        'wrong_time',            // Mauvais horaire
        'insufficient_fasting',  // Jeûne insuffisant
        'other'                  // Autre
      ]
    },
    reasonDetails: String,
    penaltyApplied: {
      type: Boolean,
      default: false
    },
    penaltyAmount: {
      type: Number,
      default: 0
    },
    penaltyInvoice: {
      type: mongoose.Schema.ObjectId,
      ref: 'Invoice'
    },
    rescheduledTo: Date,
    rescheduledNotes: String
  },

  // Rejection history (for repeat offenders)
  rejectionHistory: [{
    rejectedAt: Date,
    rejectedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    reason: String,
    reasonDetails: String,
    penaltyAmount: Number
  }],

  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  // Soft delete support
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
labOrderSchema.index({ patient: 1, orderDate: -1 });
labOrderSchema.index({ clinic: 1, status: 1, orderDate: -1 });
labOrderSchema.index({ clinic: 1, patient: 1, orderDate: -1 });
labOrderSchema.index({ status: 1, priority: 1 });
labOrderSchema.index({ orderId: 1 }, { unique: true });
labOrderSchema.index({ 'specimen.barcode': 1 }, { sparse: true });
labOrderSchema.index({ orderedBy: 1, orderDate: -1 });
labOrderSchema.index({ scheduledDate: 1 });
labOrderSchema.index({ createdAt: -1 });

// Virtual for test count
labOrderSchema.virtual('testCount').get(function() {
  return this.tests ? this.tests.length : 0;
});

// Virtual for completion percentage
labOrderSchema.virtual('completionPercentage').get(function() {
  if (!this.tests || this.tests.length === 0) return 0;
  const completedTests = this.tests.filter(t => t.status === 'completed').length;
  return Math.round((completedTests / this.tests.length) * 100);
});

// Generate order ID before saving
labOrderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderId) {
    const counterId = Counter.getYearlyCounterId('labOrder');
    const sequence = await Counter.getNextSequence(counterId);
    const year = new Date().getFullYear();
    this.orderId = `LAB${year}${String(sequence).padStart(6, '0')}`;
  }

  // Track status changes
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date(),
      changedBy: this.updatedBy
    });
  }

  next();
});

// Static method to get pending orders
labOrderSchema.statics.getPending = async function(options = {}) {
  const query = { status: { $in: ['ordered', 'collected', 'received', 'in-progress'] } };

  if (options.priority) query.priority = options.priority;
  if (options.orderedBy) query.orderedBy = options.orderedBy;

  return this.find(query)
    .populate('patient', 'firstName lastName patientId dateOfBirth')
    .populate('orderedBy', 'firstName lastName')
    .sort({ priority: -1, orderDate: 1 });
};

// Static method to get patient's lab history
labOrderSchema.statics.getPatientHistory = async function(patientId, options = {}) {
  const query = { patient: patientId };

  if (options.status) query.status = options.status;
  if (options.startDate) query.orderDate = { $gte: options.startDate };
  if (options.endDate) {
    query.orderDate = query.orderDate || {};
    query.orderDate.$lte = options.endDate;
  }

  return this.find(query)
    .populate('orderedBy', 'firstName lastName')
    .populate('tests.results')
    .sort({ orderDate: -1 })
    .limit(options.limit || 50);
};

// Instance method to collect specimen
labOrderSchema.methods.collectSpecimen = async function(collectedBy, specimenData) {
  this.specimen = {
    ...this.specimen,
    ...specimenData,
    collectedAt: new Date(),
    collectedBy
  };
  this.status = 'collected';
  this.tests.forEach(test => {
    if (test.status === 'pending') test.status = 'collected';
  });
  this.updatedBy = collectedBy;
  return this.save();
};

// Instance method to receive specimen
labOrderSchema.methods.receiveSpecimen = async function(receivedBy, qualityData = {}) {
  this.specimen.receivedAt = new Date();
  this.specimen.receivedBy = receivedBy;
  if (qualityData.quality) this.specimen.quality = qualityData.quality;
  if (qualityData.rejectionReason) this.specimen.rejectionReason = qualityData.rejectionReason;

  if (qualityData.quality === 'rejected') {
    this.status = 'cancelled';
    this.tests.forEach(test => test.status = 'cancelled');
  } else {
    this.status = 'received';
    this.tests.forEach(test => {
      if (test.status === 'collected') test.status = 'received';
    });
  }

  this.updatedBy = receivedBy;
  return this.save();
};

// Instance method to cancel order
labOrderSchema.methods.cancel = async function(cancelledBy, reason) {
  this.status = 'cancelled';
  this.tests.forEach(test => test.status = 'cancelled');
  this.statusHistory.push({
    status: 'cancelled',
    changedAt: new Date(),
    changedBy: cancelledBy,
    notes: reason
  });
  this.updatedBy = cancelledBy;
  return this.save();
};

// Instance method to check-in patient
labOrderSchema.methods.checkInPatient = async function(checkedInBy, checkInData = {}) {
  this.checkIn = {
    arrivedAt: new Date(),
    checkedInBy,
    fastingVerified: checkInData.fastingVerified || false,
    fastingHours: checkInData.fastingHours,
    preparationVerified: checkInData.preparationVerified || false,
    notes: checkInData.notes
  };

  this.statusHistory.push({
    status: 'checked_in',
    changedAt: new Date(),
    changedBy: checkedInBy,
    notes: 'Patient arrived for specimen collection'
  });

  this.updatedBy = checkedInBy;
  return this.save();
};

// Instance method to reject with penalty and reschedule
// ENHANCED: Auto-calculates 25% penalty and creates penalty invoice
labOrderSchema.methods.rejectAndReschedule = async function(rejectedBy, rejectionData) {
  const Invoice = require('./Invoice');

  // Add to rejection history if this is a repeat
  if (this.rejection?.rejected) {
    this.rejectionHistory.push({
      rejectedAt: this.rejection.rejectedAt,
      rejectedBy: this.rejection.rejectedBy,
      reason: this.rejection.reason,
      reasonDetails: this.rejection.reasonDetails,
      penaltyAmount: this.rejection.penaltyAmount
    });
  }

  // CRITICAL: Calculate 25% penalty from original invoice/billing
  let penaltyAmount = rejectionData.penaltyAmount || 0;
  let originalInvoiceTotal = 0;

  if (!penaltyAmount && this.billing?.invoice) {
    // Get original invoice to calculate 25% penalty
    const originalInvoice = await Invoice.findById(this.billing.invoice);
    if (originalInvoice) {
      originalInvoiceTotal = originalInvoice.summary?.total || 0;
      penaltyAmount = Math.round(originalInvoiceTotal * 0.25); // 25% penalty
      console.log(`[LAB REJECTION] Calculated 25% penalty: ${penaltyAmount} CDF from original ${originalInvoiceTotal} CDF`);
    }
  } else if (!penaltyAmount && this.billing?.estimatedCost) {
    // Fallback to estimated cost if no invoice
    originalInvoiceTotal = this.billing.estimatedCost;
    penaltyAmount = Math.round(originalInvoiceTotal * 0.25);
    console.log(`[LAB REJECTION] Calculated 25% penalty from estimated cost: ${penaltyAmount} CDF`);
  }

  this.rejection = {
    rejected: true,
    rejectedAt: new Date(),
    rejectedBy,
    reason: rejectionData.reason,
    reasonDetails: rejectionData.reasonDetails,
    penaltyApplied: penaltyAmount > 0,
    penaltyAmount: penaltyAmount,
    rescheduledTo: null, // CHANGED: Clear - reception will set new date
    rescheduledNotes: rejectionData.rescheduledNotes
  };

  // CHANGED: Clear scheduled date - patient must go to reception to reschedule
  this.scheduledDate = null;

  // Reset check-in
  this.checkIn = undefined;

  this.statusHistory.push({
    status: 'rejected_awaiting_reschedule',
    changedAt: new Date(),
    changedBy: rejectedBy,
    notes: `Rejected: ${rejectionData.reason}. Penalty: ${penaltyAmount} CDF. ${rejectionData.reasonDetails || ''}`
  });

  this.updatedBy = rejectedBy;
  await this.save();

  // CRITICAL: Auto-create penalty invoice if penalty amount > 0
  let penaltyInvoice = null;
  if (penaltyAmount > 0) {
    try {
      // Get rejection reason label for description
      const reasonLabels = {
        'patient_ate': 'Patient a mangé (jeûne non respecté)',
        'medication_taken': 'Médicaments pris',
        'wrong_preparation': 'Mauvaise préparation',
        'patient_sick': 'Patient malade',
        'no_show': 'Patient absent',
        'wrong_time': 'Mauvais horaire',
        'insufficient_fasting': 'Jeûne insuffisant',
        'other': 'Autre raison'
      };
      const reasonLabel = reasonLabels[rejectionData.reason] || rejectionData.reason;

      penaltyInvoice = await Invoice.create({
        patient: this.patient,
        labOrder: this._id,
        dateIssued: new Date(),
        dueDate: new Date(), // Due immediately
        items: [{
          description: `Frais de non-conformité laboratoire - ${reasonLabel}`,
          category: 'other',
          code: 'LAB-PENALTY',
          quantity: 1,
          unitPrice: penaltyAmount,
          subtotal: penaltyAmount,
          tax: 0,
          total: penaltyAmount
        }],
        summary: {
          subtotal: penaltyAmount,
          tax: 0,
          total: penaltyAmount,
          amountDue: penaltyAmount,
          amountPaid: 0
        },
        currency: process.env.BASE_CURRENCY || 'CDF',
        status: 'issued',  // 'issued' = finalized invoice ready for payment
        notes: {
          internal: `Pénalité 25% pour non-respect des conditions de prélèvement. Réf: ${this.orderId}. Motif: ${reasonLabel}`
        },
        createdBy: rejectedBy
      });

      // Link penalty invoice to rejection
      this.rejection.penaltyInvoice = penaltyInvoice._id;
      await this.save();

      console.log(`[LAB REJECTION] Created penalty invoice ${penaltyInvoice.invoiceId} for ${penaltyAmount} CDF`);
    } catch (invoiceError) {
      console.error('[LAB REJECTION] Error creating penalty invoice:', invoiceError.message);
      // Continue - rejection is still valid even if invoice creation fails
    }
  }

  // Emit WebSocket event to notify reception
  try {
    const websocketService = require('../services/websocketService');
    websocketService.broadcast('lab_rejection', {
      type: 'lab_rejection',
      labOrderId: this._id,
      orderId: this.orderId,
      patientId: this.patient,
      reason: rejectionData.reason,
      reasonDetails: rejectionData.reasonDetails,
      penaltyAmount: penaltyAmount,
      penaltyInvoiceId: penaltyInvoice?._id,
      rejectedAt: this.rejection.rejectedAt,
      message: `Patient rejeté au laboratoire - ${penaltyAmount} CDF à payer`
    });
    console.log(`[LAB REJECTION] WebSocket notification sent for ${this.orderId}`);
  } catch (wsError) {
    console.log('[LAB REJECTION] WebSocket notification skipped:', wsError.message);
  }

  return {
    labOrder: this,
    penaltyInvoice,
    penaltyAmount
  };
};

// Static method to get rejected lab orders awaiting rescheduling (for reception)
labOrderSchema.statics.getRejectedAwaitingReschedule = async function() {
  return this.find({
    'rejection.rejected': true,
    scheduledDate: null, // Not yet rescheduled
    status: { $ne: 'cancelled' }
  })
    .populate('patient', 'firstName lastName patientId dateOfBirth phone phoneNumber')
    .populate('orderedBy', 'firstName lastName')
    .populate('rejection.rejectedBy', 'firstName lastName')
    .populate('rejection.penaltyInvoice', 'invoiceId status summary.total summary.amountPaid')
    .sort({ 'rejection.rejectedAt': -1 });
};

// Instance method to reschedule after rejection (called by reception)
labOrderSchema.methods.rescheduleAfterRejection = async function(rescheduledBy, newDate, notes = '') {
  if (!this.rejection?.rejected) {
    throw new Error('Cannot reschedule - lab order was not rejected');
  }

  this.scheduledDate = newDate;
  this.rejection.rescheduledTo = newDate;
  this.rejection.rescheduledNotes = notes;

  this.statusHistory.push({
    status: 'rescheduled',
    changedAt: new Date(),
    changedBy: rescheduledBy,
    notes: `Rescheduled to ${newDate.toLocaleDateString('fr-FR')}. ${notes}`
  });

  this.updatedBy = rescheduledBy;
  await this.save();

  // Emit WebSocket event
  try {
    const websocketService = require('../services/websocketService');
    websocketService.broadcast('lab_rescheduled', {
      type: 'lab_rescheduled',
      labOrderId: this._id,
      orderId: this.orderId,
      patientId: this.patient,
      newDate: newDate,
      message: `Examen laboratoire reprogrammé pour le ${newDate.toLocaleDateString('fr-FR')}`
    });
  } catch (wsError) {
    console.log('[LAB RESCHEDULE] WebSocket notification skipped:', wsError.message);
  }

  return this;
};

// Static method to get orders scheduled for today
labOrderSchema.statics.getScheduledForToday = async function(options = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const query = {
    scheduledDate: { $gte: today, $lt: tomorrow },
    status: { $in: ['ordered', 'collected'] },
    'rejection.rejected': { $ne: true }
  };

  if (options.priority) query.priority = options.priority;

  return this.find(query)
    .populate('patient', 'firstName lastName patientId dateOfBirth phone')
    .populate('orderedBy', 'firstName lastName')
    .sort({ scheduledTime: 1, priority: -1 });
};

// Static method to get checked-in patients awaiting collection
labOrderSchema.statics.getCheckedIn = async function() {
  return this.find({
    'checkIn.arrivedAt': { $exists: true },
    status: 'ordered'
  })
    .populate('patient', 'firstName lastName patientId dateOfBirth phone')
    .populate('orderedBy', 'firstName lastName')
    .populate('checkIn.checkedInBy', 'firstName lastName')
    .sort({ 'checkIn.arrivedAt': 1 });
};

// Static method to get rejection statistics
labOrderSchema.statics.getRejectionStats = async function(startDate, endDate) {
  const query = {
    'rejection.rejected': true,
    'rejection.rejectedAt': { $gte: startDate, $lte: endDate }
  };

  const stats = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$rejection.reason',
        count: { $sum: 1 },
        totalPenalties: { $sum: '$rejection.penaltyAmount' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  return stats;
};

// ============================================
// POST-SAVE HOOK: Sync with Visit.laboratoryOrders
// ============================================
// CRITICAL FIX: Lab data is fragmented between Visit.laboratoryOrders (embedded)
// and the standalone LabOrder model. This hook ensures both are in sync.
// When a LabOrder is saved, update the corresponding Visit's laboratoryOrders entry.
labOrderSchema.post('save', async (doc) => {
  try {
    if (!doc.visit) {
      return; // No visit linked, nothing to sync
    }

    const Visit = require('./Visit');
    const visit = await Visit.findById(doc.visit);

    if (!visit) {
      console.warn(`[LABORDER] Visit ${doc.visit} not found for sync`);
      return;
    }

    // Map LabOrder tests to Visit.laboratoryOrders format
    const ordersToSync = doc.tests.map(test => ({
      template: test.template,
      category: test.category,
      testName: test.testName,
      testCode: test.testCode,
      specimen: test.specimen,
      orderedBy: doc.orderedBy,
      orderedAt: doc.orderDate,
      priority: doc.priority,
      status: test.status === 'completed' ? 'completed' :
        test.status === 'cancelled' ? 'cancelled' :
          test.status === 'in-progress' ? 'processing' :
            test.status === 'received' ? 'processing' :
              test.status === 'collected' ? 'collected' : 'ordered',
      // Link back to the LabOrder
      labOrderId: doc._id,
      labOrderNum: doc.orderId
    }));

    // Find and update existing entries or add new ones
    let modified = false;
    for (const orderData of ordersToSync) {
      const existingIndex = visit.laboratoryOrders?.findIndex(
        lo => lo.testCode === orderData.testCode ||
              lo.testName === orderData.testName ||
              (lo.labOrderId && lo.labOrderId.toString() === doc._id.toString())
      );

      if (existingIndex >= 0) {
        // Update existing entry
        Object.assign(visit.laboratoryOrders[existingIndex], orderData);
        modified = true;
      } else {
        // Add new entry
        if (!visit.laboratoryOrders) {
          visit.laboratoryOrders = [];
        }
        visit.laboratoryOrders.push(orderData);
        modified = true;
      }
    }

    if (modified) {
      await visit.save();
      console.log(`[LABORDER] Synced ${ordersToSync.length} lab tests to Visit ${visit.visitId || visit._id}`);
    }
  } catch (error) {
    console.error('[LABORDER] Error syncing with Visit:', error);
    // Don't throw - sync is non-critical
  }
});

// POST-SAVE HOOK: Update LabResult with test results and sync to Visit
labOrderSchema.post('save', async (doc) => {
  try {
    // If order is completed and has results, emit WebSocket event for notifications
    if (doc.status === 'completed' && doc.patient) {
      // Emit to websocket service if available
      try {
        const websocketService = require('../services/websocketService');
        websocketService.emitToUser(doc.patient.toString(), 'lab_results', {
          orderId: doc._id,
          orderNum: doc.orderId,
          patientId: doc.patient,
          testCount: doc.tests?.length || 0,
          completedAt: new Date()
        });
      } catch (wsError) {
        // WebSocket service might not be initialized during startup
        console.log('[LABORDER] WebSocket notification skipped:', wsError.message);
      }
    }
  } catch (error) {
    console.error('[LABORDER] Error sending completion notification:', error);
  }
});

module.exports = mongoose.model('LabOrder', labOrderSchema);
