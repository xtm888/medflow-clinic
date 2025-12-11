const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * SurgeryReport Model
 *
 * Operative report filled by surgeon after surgery.
 * Auto-populated fields: surgeon name, date, procedure type
 * Surgeon fills in: narrative, findings, complications, recommendations
 */
const SurgeryReportSchema = new Schema({
  // Link to surgery case
  surgeryCase: {
    type: Schema.Types.ObjectId,
    ref: 'SurgeryCase',
    required: true,
    unique: true
  },

  // Patient (denormalized for quick access)
  patient: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },

  // Clinic Reference
  clinic: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic'
  },

  // === AUTO-POPULATED FIELDS ===

  // Surgery Type (from ClinicalAct)
  surgeryType: {
    type: Schema.Types.ObjectId,
    ref: 'ClinicalAct',
    required: true
  },

  // Surgeon who performed the surgery
  surgeon: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Assistant Surgeon (if any)
  assistantSurgeon: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  // Date and time of surgery
  surgeryDate: {
    type: Date,
    required: true
  },

  // Eye operated on
  eye: {
    type: String,
    enum: ['OD', 'OS', 'OU', 'N/A']
  },

  // Surgery duration (auto-calculated from case)
  durationMinutes: Number,

  // === SURGEON-FILLED FIELDS ===

  // Pre-operative diagnosis
  preOpDiagnosis: {
    type: String,
    required: true
  },

  // Post-operative diagnosis
  postOpDiagnosis: {
    type: String,
    required: true
  },

  // Procedure performed (free text - surgeon's description)
  procedurePerformed: {
    type: String,
    required: true
  },

  // Detailed surgical narrative
  operativeFindings: {
    type: String,
    required: true
  },

  // Step-by-step procedure description
  procedureDetails: {
    type: String
  },

  // === IOL DETAILS (for cataract surgery) ===

  iolImplanted: {
    type: Boolean,
    default: false
  },

  iolDetails: {
    model: String,
    manufacturer: String,
    power: String,
    targetRefraction: String,
    lotNumber: String,
    serialNumber: String
  },

  // === ANESTHESIA (simplified - just type) ===

  anesthesiaType: {
    type: String,
    enum: ['topical', 'peribulbar', 'retrobulbar', 'general', 'local', 'none'],
    default: 'topical'
  },

  anesthesiaAgent: String,

  // === COMPLICATIONS ===

  complications: {
    occurred: {
      type: Boolean,
      default: false
    },
    description: String,
    management: String
  },

  // Common ophthalmic complications checklist
  complicationChecklist: {
    posteriorCapsuleRupture: { type: Boolean, default: false },
    vitreousLoss: { type: Boolean, default: false },
    zonularDehiscence: { type: Boolean, default: false },
    irisTrauma: { type: Boolean, default: false },
    cornealEdema: { type: Boolean, default: false },
    hyphema: { type: Boolean, default: false },
    elevatedIOP: { type: Boolean, default: false },
    otherComplication: String
  },

  // === ESTIMATED BLOOD LOSS ===

  estimatedBloodLoss: {
    type: String,
    enum: ['minimal', 'moderate', 'significant'],
    default: 'minimal'
  },

  // === SPECIMENS ===

  specimensCollected: [{
    specimenType: {
      type: String,
      required: true
    },
    description: String,
    source: String,  // Where it was collected from (e.g., "lens capsule", "cornea", "vitreous")
    eye: {
      type: String,
      enum: ['OD', 'OS', 'OU', 'N/A'],
      default: 'N/A'
    },
    collectedAt: {
      type: Date,
      default: Date.now
    },
    collectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    // Pathology lab tracking
    sentToLab: {
      type: Boolean,
      default: false
    },
    sentTo: String,  // Lab name
    sentAt: Date,
    // Auto-generated lab order reference
    labOrder: {
      type: Schema.Types.ObjectId,
      ref: 'LabOrder'
    },
    labOrderStatus: {
      type: String,
      enum: ['pending', 'ordered', 'received', 'in-progress', 'completed'],
      default: 'pending'
    },
    // Results
    resultReceived: {
      type: Boolean,
      default: false
    },
    resultReceivedAt: Date,
    pathologyDiagnosis: String,
    notes: String
  }],

  // === POST-OP INSTRUCTIONS ===

  postOpMedications: [{
    medication: String,
    dosage: String,
    frequency: String,
    duration: String,
    eye: {
      type: String,
      enum: ['OD', 'OS', 'OU']
    }
  }],

  postOpInstructions: {
    type: String
  },

  activityRestrictions: {
    type: String
  },

  // Follow-up appointment
  followUpDate: Date,

  followUpInstructions: String,

  // === PROGNOSIS ===

  prognosis: {
    type: String,
    enum: ['excellent', 'good', 'guarded', 'poor'],
    default: 'good'
  },

  prognosisNotes: String,

  // === SIGNATURE/VERIFICATION ===

  signedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  signedAt: Date,

  // Draft or finalized
  status: {
    type: String,
    enum: ['draft', 'finalized'],
    default: 'draft'
  },

  // === REPORT TEMPLATE USED ===

  templateUsed: {
    type: String  // Template name for reference
  },

  // === ATTACHMENTS ===

  attachments: [{
    filename: String,
    url: String,
    type: String,  // 'intraop_photo', 'video', 'document'
    uploadedAt: Date
  }]

}, {
  timestamps: true
});

// Indexes
SurgeryReportSchema.index({ patient: 1, surgeryDate: -1 });
SurgeryReportSchema.index({ surgeon: 1, surgeryDate: -1 });
SurgeryReportSchema.index({ clinic: 1, surgeryDate: -1 });
SurgeryReportSchema.index({ status: 1 });

// Pre-save: Auto-populate from surgery case if available
SurgeryReportSchema.pre('save', async function(next) {
  if (this.isNew && this.surgeryCase) {
    try {
      const SurgeryCase = mongoose.model('SurgeryCase');
      const surgeryCase = await SurgeryCase.findById(this.surgeryCase)
        .populate('surgeryType');

      if (surgeryCase) {
        // Auto-populate fields from case
        this.patient = this.patient || surgeryCase.patient;
        this.surgeryType = this.surgeryType || surgeryCase.surgeryType;
        this.surgeon = this.surgeon || surgeryCase.surgeon;
        this.assistantSurgeon = this.assistantSurgeon || surgeryCase.assistantSurgeon;
        this.eye = this.eye || surgeryCase.eye;
        this.clinic = this.clinic || surgeryCase.clinic;

        // Set surgery date from case
        this.surgeryDate = this.surgeryDate || surgeryCase.surgeryStartTime || new Date();

        // Calculate duration if available
        if (surgeryCase.surgeryStartTime && surgeryCase.surgeryEndTime) {
          this.durationMinutes = Math.floor(
            (surgeryCase.surgeryEndTime - surgeryCase.surgeryStartTime) / (1000 * 60)
          );
        }

        // Copy IOL details if available
        if (surgeryCase.iolDetails && surgeryCase.iolDetails.model) {
          this.iolImplanted = true;
          this.iolDetails = surgeryCase.iolDetails;
        }
      }
    } catch (error) {
      console.error('Error auto-populating surgery report:', error);
    }
  }
  next();
});

// Method: Finalize report
SurgeryReportSchema.methods.finalize = function(userId) {
  this.status = 'finalized';
  this.signedBy = userId;
  this.signedAt = new Date();
  return this;
};

// Method: Generate printable summary
SurgeryReportSchema.methods.generateSummary = async function() {
  await this.populate([
    { path: 'patient', select: 'firstName lastName dateOfBirth medicalRecordNumber' },
    { path: 'surgeon', select: 'firstName lastName title' },
    { path: 'surgeryType', select: 'name code' }
  ]);

  return {
    patientName: `${this.patient.firstName} ${this.patient.lastName}`,
    mrn: this.patient.medicalRecordNumber,
    dob: this.patient.dateOfBirth,
    surgeonName: `${this.surgeon.title || 'Dr.'} ${this.surgeon.firstName} ${this.surgeon.lastName}`,
    procedureName: this.surgeryType.name,
    procedureCode: this.surgeryType.code,
    surgeryDate: this.surgeryDate,
    eye: this.eye,
    duration: this.durationMinutes,
    preOpDiagnosis: this.preOpDiagnosis,
    postOpDiagnosis: this.postOpDiagnosis,
    procedurePerformed: this.procedurePerformed,
    operativeFindings: this.operativeFindings,
    complications: this.complications,
    prognosis: this.prognosis,
    followUpDate: this.followUpDate
  };
};

// Static: Find reports by patient
SurgeryReportSchema.statics.findByPatient = function(patientId) {
  return this.find({ patient: patientId })
    .populate('surgeryType', 'name code category')
    .populate('surgeon', 'firstName lastName title')
    .sort({ surgeryDate: -1 });
};

// Static: Find unsigned reports for surgeon
SurgeryReportSchema.statics.findDraftsBySurgeon = function(surgeonId) {
  return this.find({
    surgeon: surgeonId,
    status: 'draft'
  })
    .populate('patient', 'firstName lastName medicalRecordNumber')
    .populate('surgeryType', 'name code')
    .sort({ surgeryDate: -1 });
};

// Ensure virtuals are serialized
SurgeryReportSchema.set('toJSON', { virtuals: true });
SurgeryReportSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SurgeryReport', SurgeryReportSchema);
