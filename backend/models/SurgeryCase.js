const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * SurgeryCase Model
 *
 * Tracks surgical cases from payment through completion.
 * Created automatically when surgery invoice is paid.
 *
 * Workflow:
 * awaiting_scheduling → scheduled → checked_in → in_surgery → completed
 *                    ↘ cancelled (with reason)
 */
const SurgeryCaseSchema = new Schema({
  // Patient Reference
  patient: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },

  // Clinic Reference (multi-clinic support)
  clinic: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    index: true
  },

  // Link to consultation that recommended surgery
  consultation: {
    type: Schema.Types.ObjectId,
    ref: 'ConsultationSession'
  },

  // Link to the Visit that contains this surgery
  // Bidirectional: Visit.surgeryCase ↔ SurgeryCase.visit
  visit: {
    type: Schema.Types.ObjectId,
    ref: 'Visit',
    index: true
  },

  // Link to paid invoice
  invoice: {
    type: Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true
  },

  // Surgery Type - references ClinicalAct (optional - can be set later)
  surgeryType: {
    type: Schema.Types.ObjectId,
    ref: 'ClinicalAct'
  },

  // Surgery description (when surgeryType is not matched)
  surgeryDescription: {
    type: String
  },

  // Affected Eye (for ophthalmic surgeries)
  eye: {
    type: String,
    enum: ['OD', 'OS', 'OU', 'N/A'],
    default: 'N/A'
  },

  // Case Status
  status: {
    type: String,
    enum: [
      'awaiting_scheduling',  // Paid, waiting to be scheduled
      'scheduled',            // Date booked in agenda
      'checked_in',           // Patient arrived, surgeon reviewing
      'in_surgery',           // Surgery in progress
      'completed',            // Surgery done, report filed
      'cancelled'             // Cancelled with reason
    ],
    default: 'awaiting_scheduling',
    index: true
  },

  // Priority Level
  priority: {
    type: String,
    enum: ['routine', 'urgent', 'emergency'],
    default: 'routine'
  },

  // === TIMELINE TRACKING ===

  // When invoice was paid (case created)
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now
  },

  // Scheduled surgery date/time
  scheduledDate: {
    type: Date,
    index: true
  },

  // Scheduled end time (for room availability calculations)
  scheduledEndTime: {
    type: Date
  },

  // Estimated duration in minutes
  estimatedDuration: {
    type: Number,
    default: 60
  },

  // Operating Room Assignment
  operatingRoom: {
    type: Schema.Types.ObjectId,
    ref: 'Room',
    index: true
  },

  // When patient checked in
  checkInTime: {
    type: Date
  },

  // When surgery started
  surgeryStartTime: {
    type: Date
  },

  // When surgery ended
  surgeryEndTime: {
    type: Date
  },

  // === SURGEON ASSIGNMENT (at check-in) ===

  surgeon: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  // Assistant surgeon (optional)
  assistantSurgeon: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  // === CANCELLATION/RESCHEDULE ===

  cancellationReason: {
    type: String,
    enum: [
      'patient_no_show',
      'patient_request',
      'medical_contraindication',
      'equipment_unavailable',
      'surgeon_unavailable',
      'other'
    ]
  },

  cancellationNotes: String,

  cancelledAt: Date,

  cancelledBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  // Track reschedules
  rescheduleHistory: [{
    previousDate: Date,
    newDate: Date,
    reason: String,
    rescheduledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    rescheduledAt: {
      type: Date,
      default: Date.now
    }
  }],

  // === CONSUMABLES/EQUIPMENT TRACKING ===

  consumablesUsed: [{
    item: {
      type: Schema.Types.ObjectId,
      ref: 'Inventory' // Unified inventory (pharmacy or surgical_supply type)
    },
    itemName: String,
    quantity: {
      type: Number,
      default: 1
    },
    lotNumber: String,
    expiryDate: Date,
    serialNumber: String  // For tracked equipment like IOLs
  }],

  equipmentUsed: [{
    name: String,
    serialNumber: String,
    notes: String
  }],

  // IOL Details (for cataract surgery)
  iolDetails: {
    model: String,
    power: String,
    lotNumber: String,
    expiryDate: Date,
    serialNumber: String
  },

  // === PRE-OP CHECKLIST ===

  preOpChecklist: {
    identityVerified: { type: Boolean, default: false },
    siteMarked: { type: Boolean, default: false },
    allergiesReviewed: { type: Boolean, default: false },
    fastingConfirmed: { type: Boolean, default: false },
    eyeDropsAdministered: { type: Boolean, default: false },
    pupilDilated: { type: Boolean, default: false },
    vitalsSigned: { type: Boolean, default: false },
    checklistCompletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    checklistCompletedAt: Date
  },

  // === SURGERY REPORT REFERENCE ===

  surgeryReport: {
    type: Schema.Types.ObjectId,
    ref: 'SurgeryReport'
  },

  // === CLINICAL NOTES ===

  preOpNotes: String,

  intraOpNotes: String,

  postOpInstructions: String,

  // === WAIT TIME ALERT ===

  waitTimeAlertSent: {
    type: Boolean,
    default: false
  },

  waitTimeAlertSentAt: Date,

  // === AUDIT TRAIL ===

  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  statusHistory: [{
    status: String,
    changedAt: {
      type: Date,
      default: Date.now
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
  }],

  // === FOLLOW-UP TRACKING ===

  followUpAppointment: {
    type: Schema.Types.ObjectId,
    ref: 'Appointment'
  },

  followUpScheduled: {
    type: Boolean,
    default: false
  },

  followUpCompleted: {
    type: Boolean,
    default: false
  },

  followUpCompletedAt: Date,

  followUpNotes: String,

  // === EXTERNAL SURGERY REFERRAL ===
  // For surgeries performed at external facilities

  externalSurgery: {
    // Is this surgery being performed externally?
    isExternal: {
      type: Boolean,
      default: false
    },

    // Reason for external referral
    reason: {
      type: String,
      enum: [
        'specialty_required',       // Need specialized surgeon/equipment
        'patient_preference',       // Patient chooses external facility
        'capacity_issue',           // Our OR is full
        'equipment_unavailable',    // Required equipment not available
        'surgeon_unavailable',      // Required surgeon not at this clinic
        'insurance_requirement',    // Insurance requires specific facility
        'other'
      ]
    },
    reasonNotes: String,

    // External facility reference
    externalFacility: {
      type: Schema.Types.ObjectId,
      ref: 'ExternalFacility'
    },

    // Manual facility info (if not in directory)
    facilityInfo: {
      name: String,
      address: String,
      phone: String,
      fax: String,
      email: String
    },

    // External surgeon info
    externalSurgeon: {
      name: String,
      specialty: String,
      phone: String,
      email: String,
      credentials: String
    },

    // Dispatch status
    dispatchStatus: {
      type: String,
      enum: ['pending', 'dispatched', 'acknowledged', 'scheduled', 'completed', 'cancelled'],
      default: 'pending'
    },

    // Dispatch details
    dispatchedAt: Date,
    dispatchedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    dispatchMethod: {
      type: String,
      enum: ['email', 'fax', 'phone', 'print', 'api', 'manual']
    },

    // Referral letter / documents
    referralLetter: {
      type: Schema.Types.ObjectId,
      ref: 'Document'
    },
    supportingDocuments: [{
      type: Schema.Types.ObjectId,
      ref: 'Document'
    }],

    // External acknowledgment
    acknowledgment: {
      received: { type: Boolean, default: false },
      receivedAt: Date,
      receivedBy: String,
      externalCaseNumber: String, // Their case reference
      proposedDate: Date,
      notes: String
    },

    // Estimated surgery date at external facility
    estimatedSurgeryDate: Date,
    confirmedSurgeryDate: Date,

    // Completion tracking
    completedAt: Date,
    completedBy: String, // External surgeon name
    operativeReport: {
      type: Schema.Types.ObjectId,
      ref: 'Document'
    },
    dischargeSummary: {
      type: Schema.Types.ObjectId,
      ref: 'Document'
    },
    complications: String,
    outcome: {
      type: String,
      enum: ['success', 'partial_success', 'complication', 'failed', 'unknown']
    },

    // Post-op care handoff
    postOpCareReturned: {
      type: Boolean,
      default: false
    },
    postOpCareReturnedAt: Date,
    postOpInstructions: String,
    postOpMedications: String,
    followUpRequired: Boolean,
    followUpDate: Date,

    // Link to FulfillmentDispatch for unified tracking
    fulfillmentDispatch: {
      type: Schema.Types.ObjectId,
      ref: 'FulfillmentDispatch'
    },

    // Status history
    statusHistory: [{
      status: String,
      timestamp: { type: Date, default: Date.now },
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      notes: String
    }],

    // Special instructions for external facility
    instructions: String,
    patientInstructions: String
  },

  // === PAYMENT STATUS TRACKING ===

  paymentStatus: {
    type: String,
    enum: ['paid', 'refunded', 'partial'],
    default: 'paid'
  },

  paymentIssue: {
    type: Boolean,
    default: false
  },

  paymentIssueNotes: String
,

  // Soft delete support
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date
}, {
  timestamps: true
});

// Indexes for common queries
SurgeryCaseSchema.index({ status: 1, scheduledDate: 1 });
SurgeryCaseSchema.index({ patient: 1, status: 1 });
SurgeryCaseSchema.index({ surgeon: 1, scheduledDate: 1 });
SurgeryCaseSchema.index({ paymentDate: 1, status: 1 });
SurgeryCaseSchema.index({ clinic: 1, status: 1, scheduledDate: 1 });

// Virtual: Days waiting since payment
SurgeryCaseSchema.virtual('daysWaiting').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') {
    return 0;
  }
  const now = new Date();
  const payment = new Date(this.paymentDate);
  return Math.floor((now - payment) / (1000 * 60 * 60 * 24));
});

// Virtual: Surgery duration
SurgeryCaseSchema.virtual('surgeryDuration').get(function() {
  if (this.surgeryStartTime && this.surgeryEndTime) {
    return Math.floor((this.surgeryEndTime - this.surgeryStartTime) / (1000 * 60)); // minutes
  }
  return null;
});

// Method: Update status with history tracking
SurgeryCaseSchema.methods.updateStatus = function(newStatus, userId, notes = '') {
  this.statusHistory.push({
    status: newStatus,
    changedAt: new Date(),
    changedBy: userId,
    notes
  });
  this.status = newStatus;

  // Set timestamps based on status
  switch (newStatus) {
    case 'checked_in':
      this.checkInTime = new Date();
      break;
    case 'in_surgery':
      this.surgeryStartTime = new Date();
      break;
    case 'completed':
      this.surgeryEndTime = new Date();
      break;
    case 'cancelled':
      this.cancelledAt = new Date();
      this.cancelledBy = userId;
      break;
  }

  return this;
};

// Method: Reschedule surgery
SurgeryCaseSchema.methods.reschedule = function(newDate, reason, userId) {
  this.rescheduleHistory.push({
    previousDate: this.scheduledDate,
    newDate: newDate,
    reason: reason,
    rescheduledBy: userId,
    rescheduledAt: new Date()
  });
  this.scheduledDate = newDate;
  return this;
};

// Static: Find cases awaiting scheduling
SurgeryCaseSchema.statics.findAwaitingScheduling = function(clinicId) {
  const query = { status: 'awaiting_scheduling' };
  if (clinicId) query.clinic = clinicId;
  return this.find(query)
    .populate('patient', 'firstName lastName dateOfBirth medicalRecordNumber')
    .populate('surgeryType', 'name code category')
    .sort({ paymentDate: 1 });
};

// Static: Find cases for agenda by date range
SurgeryCaseSchema.statics.findScheduledByDateRange = function(startDate, endDate, clinicId) {
  const query = {
    status: { $in: ['scheduled', 'checked_in', 'in_surgery'] },
    scheduledDate: { $gte: startDate, $lte: endDate }
  };
  if (clinicId) query.clinic = clinicId;
  return this.find(query)
    .populate('patient', 'firstName lastName dateOfBirth medicalRecordNumber phone')
    .populate('surgeryType', 'name code category')
    .populate('surgeon', 'firstName lastName')
    .sort({ scheduledDate: 1 });
};

// Static: Find overdue cases (waiting too long)
SurgeryCaseSchema.statics.findOverdue = function(maxDays = 30, clinicId) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxDays);

  const query = {
    status: 'awaiting_scheduling',
    paymentDate: { $lte: cutoffDate }
  };
  if (clinicId) query.clinic = clinicId;

  return this.find(query)
    .populate('patient', 'firstName lastName dateOfBirth medicalRecordNumber phone')
    .populate('surgeryType', 'name code category')
    .sort({ paymentDate: 1 });
};

// Static: Get surgeon's schedule for a date
SurgeryCaseSchema.statics.findSurgeonSchedule = function(surgeonId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    surgeon: surgeonId,
    scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: ['cancelled'] }
  })
    .populate('patient', 'firstName lastName dateOfBirth medicalRecordNumber')
    .populate('surgeryType', 'name code')
    .sort({ scheduledDate: 1 });
};

// Ensure virtual fields are serialized
SurgeryCaseSchema.set('toJSON', { virtuals: true });
SurgeryCaseSchema.set('toObject', { virtuals: true });

// POST-SAVE HOOK: Maintain bidirectional link with Visit
SurgeryCaseSchema.post('save', async (doc) => {
  try {
    // If surgeryCase has a visit link, ensure Visit.surgeryCase is set
    if (doc.visit) {
      const Visit = require('./Visit');
      await Visit.findByIdAndUpdate(doc.visit, { surgeryCase: doc._id });
      console.log(`[SURGERY_CASE] Synced bidirectional link: Visit ${doc.visit} ↔ SurgeryCase ${doc._id}`);
    }
  } catch (error) {
    console.error('[SURGERY_CASE] Error syncing visit link:', error.message);
  }
});

module.exports = mongoose.model('SurgeryCase', SurgeryCaseSchema);
