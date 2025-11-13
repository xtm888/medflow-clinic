const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
  visitId: {
    type: String,
    unique: true,
    sparse: true
  },

  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },

  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },

  visitDate: {
    type: Date,
    default: Date.now,
    required: true
  },

  visitType: {
    type: String,
    enum: ['routine', 'emergency', 'follow-up', 'initial', 'procedure', 'consultation'],
    default: 'routine'
  },

  primaryProvider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  additionalProviders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Clinical Acts within the visit
  clinicalActs: [{
    actId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    actType: {
      type: String,
      enum: ['consultation', 'procedure', 'examination', 'imaging', 'laboratory', 'therapy'],
      required: true
    },
    actCode: String, // CPT/procedure code
    actName: String,
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    startTime: Date,
    endTime: Date,
    duration: Number, // in minutes
    location: String,
    notes: String,
    status: {
      type: String,
      enum: ['planned', 'in-progress', 'completed', 'cancelled', 'deferred'],
      default: 'planned'
    },
    results: mongoose.Schema.Types.Mixed,
    attachments: [{
      type: String,
      url: String,
      description: String
    }]
  }],

  // Chief Complaint & History
  chiefComplaint: {
    complaint: String,
    duration: String,
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe', 'critical']
    },
    onset: String,
    associatedSymptoms: [String]
  },

  historyOfPresentIllness: String,

  reviewOfSystems: {
    constitutional: String,
    eyes: String,
    ears: String,
    cardiovascular: String,
    respiratory: String,
    gastrointestinal: String,
    genitourinary: String,
    musculoskeletal: String,
    neurological: String,
    psychiatric: String,
    endocrine: String,
    hematologic: String,
    allergic: String
  },

  // Physical Examination
  physicalExamination: {
    general: String,
    vitalSigns: {
      bloodPressure: String,
      heartRate: Number,
      temperature: Number,
      respiratoryRate: Number,
      oxygenSaturation: Number,
      weight: Number,
      height: Number,
      bmi: Number
    },
    heent: String,
    cardiovascular: String,
    respiratory: String,
    abdomen: String,
    extremities: String,
    neurological: String,
    skin: String,
    psychiatric: String
  },

  // Link to specialized examinations
  examinations: {
    refraction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OphthalmologyExam'
    },
    keratometry: {
      OD: {
        k1: Number,
        k2: Number,
        axis: Number,
        average: Number
      },
      OS: {
        k1: Number,
        k2: Number,
        axis: Number,
        average: Number
      },
      method: String
    },
    additionalTests: [{
      testName: String,
      result: mongoose.Schema.Types.Mixed,
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      performedAt: Date
    }]
  },

  // Diagnoses
  diagnoses: [{
    code: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['primary', 'secondary', 'rule-out', 'resolved'],
      default: 'primary'
    },
    laterality: {
      type: String,
      enum: ['OD', 'OS', 'OU', 'NA'],
      default: 'NA'
    },
    dateOfDiagnosis: Date,
    severity: String,
    notes: String
  }],

  // Linked prescriptions and procedures
  prescriptions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription'
  }],

  procedures: [{
    procedureCode: String,
    procedureName: String,
    laterality: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedAt: Date,
    notes: String,
    outcome: String,
    complications: String
  }],

  // Treatment Plan
  plan: {
    medications: [{
      medication: String,
      dosage: String,
      frequency: String,
      duration: String,
      route: String,
      instructions: String,
      prescribedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    followUp: {
      required: Boolean,
      timeframe: String,
      reason: String,
      withProvider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      scheduledDate: Date
    },
    referrals: [{
      toSpecialty: String,
      toProvider: String,
      reason: String,
      urgency: {
        type: String,
        enum: ['routine', 'urgent', 'emergent']
      },
      sentDate: Date,
      status: {
        type: String,
        enum: ['pending', 'sent', 'accepted', 'completed']
      }
    }],
    patientEducation: [{
      topic: String,
      materials: String,
      providedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],
    lifestyle: [{
      recommendation: String,
      category: String
    }]
  },

  // Documents and attachments
  documents: [{
    type: {
      type: String,
      enum: ['image', 'pdf', 'audio', 'video', 'letter', 'report', 'lab', 'imaging'],
      required: true
    },
    name: String,
    url: String,
    description: String,
    category: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    metadata: mongoose.Schema.Types.Mixed
  }],

  // Billing information
  billing: {
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'submitted', 'approved', 'denied', 'paid'],
      default: 'pending'
    },
    codes: [{
      type: String,
      code: String,
      description: String,
      modifier: String
    }],
    totalCharges: Number,
    insuranceCoverage: Number,
    patientResponsibility: Number,
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice'
    }
  },

  // Clinical and internal notes
  notes: {
    clinical: String,
    internal: String,
    nursing: String,
    administrative: String
  },

  // Visit status and completion
  status: {
    type: String,
    enum: ['scheduled', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },

  checkInTime: Date,
  startTime: Date,
  endTime: Date,

  completedAt: Date,
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  signedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  signedAt: Date,
  signatureStatus: {
    type: String,
    enum: ['unsigned', 'signed', 'locked'],
    default: 'unsigned'
  },

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Quality metrics
  qualityMetrics: {
    documentationComplete: Boolean,
    timeSpent: Number, // minutes
    patientSatisfaction: Number,
    clinicalQualityScore: Number
  }
}, {
  timestamps: true
});

// Indexes
visitSchema.index({ patient: 1, visitDate: -1 });
visitSchema.index({ visitId: 1 });
visitSchema.index({ primaryProvider: 1, visitDate: -1 });
visitSchema.index({ status: 1 });
visitSchema.index({ 'appointment': 1 });

// Generate unique visitId before saving
visitSchema.pre('save', async function(next) {
  if (!this.visitId) {
    const date = new Date(this.visitDate);
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    // Find the last visit of the day
    const lastVisit = await this.constructor.findOne({
      visitId: new RegExp(`^VIS${dateStr}`)
    }).sort({ visitId: -1 });

    let sequence = 1;
    if (lastVisit && lastVisit.visitId) {
      const lastSequence = parseInt(lastVisit.visitId.slice(-4));
      sequence = lastSequence + 1;
    }

    this.visitId = `VIS${dateStr}${sequence.toString().padStart(4, '0')}`;
  }

  // Calculate BMI if height and weight are provided
  if (this.physicalExamination?.vitalSigns?.height && this.physicalExamination?.vitalSigns?.weight) {
    const heightInMeters = this.physicalExamination.vitalSigns.height / 100;
    this.physicalExamination.vitalSigns.bmi =
      (this.physicalExamination.vitalSigns.weight / (heightInMeters * heightInMeters)).toFixed(1);
  }

  // Calculate total time spent
  if (this.startTime && this.endTime) {
    this.qualityMetrics = this.qualityMetrics || {};
    this.qualityMetrics.timeSpent = Math.round((this.endTime - this.startTime) / 60000); // minutes
  }

  next();
});

// Virtual for visit duration
visitSchema.virtual('duration').get(function() {
  if (this.startTime && this.endTime) {
    return Math.round((this.endTime - this.startTime) / 60000); // minutes
  }
  return null;
});

// Method to add clinical act
visitSchema.methods.addClinicalAct = function(actData) {
  this.clinicalActs.push(actData);
  return this.save();
};

// Method to complete visit
visitSchema.methods.completeVisit = function(userId) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.completedBy = userId;
  this.endTime = new Date();
  return this.save();
};

// Method to sign visit
visitSchema.methods.signVisit = function(userId) {
  this.signedBy = userId;
  this.signedAt = new Date();
  this.signatureStatus = 'signed';
  return this.save();
};

// Method to lock visit (no further edits)
visitSchema.methods.lockVisit = function() {
  this.signatureStatus = 'locked';
  return this.save();
};

// Static method to get visit timeline
visitSchema.statics.getTimeline = async function(patientId, limit = 10) {
  return this.find({ patient: patientId })
    .sort({ visitDate: -1 })
    .limit(limit)
    .populate('primaryProvider', 'firstName lastName')
    .populate('appointment', 'type reason')
    .select('visitId visitDate visitType status diagnoses chiefComplaint');
};

module.exports = mongoose.model('Visit', visitSchema);