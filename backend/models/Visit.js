const mongoose = require('mongoose');
const Counter = require('./Counter');
const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('Visit');

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

  consultationSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConsultationSession'
  },

  // Link to surgery case if this visit involves surgery
  // Bidirectional: SurgeryCase.visit ↔ Visit.surgeryCase
  surgeryCase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SurgeryCase',
    index: true
  },

  // Multi-Clinic: Which clinic this visit occurred at
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    index: true
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
    price: {
      type: Number,
      default: 0
    },
    // Price audit trail fields (HIGH PRIORITY FIX: Track price capture at service time)
    feeScheduleRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeSchedule',
      index: true
    },
    priceCapturedAt: {
      type: Date
    },
    priceSource: {
      type: String,
      enum: ['manual', 'fee-schedule', 'fee-schedule-fallback'],
      default: 'fee-schedule'
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
      heartRate: {
        type: Number,
        min: [20, 'Heart rate must be at least 20 bpm'],
        max: [300, 'Heart rate must not exceed 300 bpm']
      },
      temperature: {
        type: Number,
        min: [0, 'Temperature must be at least 0°C'],
        max: [45, 'Temperature must not exceed 45°C']
      },
      respiratoryRate: {
        type: Number,
        min: [4, 'Respiratory rate must be at least 4 breaths/min'],
        max: [60, 'Respiratory rate must not exceed 60 breaths/min']
      },
      oxygenSaturation: {
        type: Number,
        min: [0, 'Oxygen saturation must be at least 0%'],
        max: [100, 'Oxygen saturation must not exceed 100%']
      },
      weight: {
        type: Number,
        min: [0.3, 'Weight must be at least 0.3 kg'],
        max: [500, 'Weight must not exceed 500 kg']
      },
      height: {
        type: Number,
        min: [20, 'Height must be at least 20 cm'],
        max: [280, 'Height must not exceed 280 cm']
      },
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

  // Pathology Findings (Template-based clinical findings)
  pathologyFindings: [{
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PathologyTemplate'
    },
    category: String, // e.g., "LAF", "Cataracte", "Diabète"
    subcategory: String, // e.g., "Cornée", "Cristallin"
    type: {
      type: String,
      enum: ['symptom', 'description', 'finding']
    },
    name: String, // Name of the finding from template
    value: String, // Optional additional value/description
    laterality: {
      type: String,
      // OD=Right eye, OS/OG=Left eye, OU/ODG=Both eyes (supporting both standards)
      enum: ['OD', 'OS', 'OU', 'OG', 'ODG']
    },
    severity: {
      type: String,
      enum: ['-', '+/-', '+', '++', '+++', '++++', '0']
    },
    location: {
      type: String,
      enum: ['Nasal', 'Temporal', 'Inférieur', 'Supérieur', 'Central', 'Périphérique']
    },
    clockPosition: {
      type: String,
      enum: ['1h', '2h', '3h', '4h', '5h', '6h', '7h', '8h', '9h', '10h', '11h', '12h', 'toute la périph']
    },
    notes: String, // Free-text notes for this finding
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    recordedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Laboratory Orders (Template-based lab test orders)
  // CRITICAL: These can be synced from standalone LabOrder documents via labOrderId
  laboratoryOrders: [{
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LaboratoryTemplate'
    },
    category: String,
    testName: String,
    testCode: String,
    specimen: {
      type: String,
      enum: ['Sang', 'Urine', 'Selles', 'LCR', 'Prélèvement', 'Autre']
    },
    orderedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    orderedAt: {
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
      enum: ['ordered', 'collected', 'processing', 'completed', 'cancelled'],
      default: 'ordered'
    },
    result: String,
    resultValue: String,
    resultUnit: String,
    normalRange: String,
    isAbnormal: Boolean,
    resultedAt: Date,
    resultedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String,
    // CRITICAL FIX: Link to standalone LabOrder for bidirectional sync
    labOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabOrder'
    },
    labOrderNum: String // e.g., "LAB2025000123"
  }],

  // Examination Orders (Template-based examination/procedure orders)
  examinationOrders: [{
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExaminationTemplate'
    },
    category: String, // TYPE REFRACTION, OPHTALMOLOGIE, ECHOGRAPHIE
    examinationName: String,
    examinationCode: String,
    orderedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    orderedAt: {
      type: Date,
      default: Date.now
    },
    scheduledDate: Date,
    status: {
      type: String,
      enum: ['ordered', 'scheduled', 'in-progress', 'completed', 'cancelled'],
      default: 'ordered'
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedAt: Date,
    results: mongoose.Schema.Types.Mixed,
    notes: String
  }],

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

  // IVT Treatments (Intravitreal Injections)
  ivtTreatments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IVTInjection' // Fixed: model is IVTInjection not IVTTreatment
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
    },
    // CRITICAL: Convention snapshot at check-in time
    // Prevents pricing issues if patient's convention changes mid-visit
    // IMMUTABLE SNAPSHOT: Stores calculated values at capture time, not mutable configuration
    conventionSnapshot: {
      conventionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company'
      },
      conventionName: String,
      conventionCode: String,
      capturedAt: {
        type: Date,
        default: Date.now
      },
      isFrozen: {
        type: Boolean,
        default: true
      },
      // Store CALCULATED values at capture time, not mutable rules
      patientSharePercentage: Number,  // The actual % patient pays
      companySharePercentage: Number,  // The actual % company pays
      maxCoverage: Number              // Max amount company covers
      // REMOVED: discountPercentage (can be derived from company)
      // REMOVED: coverageRules (too complex, mutable, can change)
    }
  },

  // ============================================
  // EXTERNAL FULFILLMENT TRACKING
  // For services to be performed outside this clinic
  // Patient pays here, gets dispatched elsewhere
  // ============================================
  externalFulfillment: {
    // Does this visit have external services?
    hasExternalServices: {
      type: Boolean,
      default: false
    },

    // Summary of external fulfillment status
    summary: {
      totalServices: { type: Number, default: 0 },
      pendingDispatch: { type: Number, default: 0 },
      dispatched: { type: Number, default: 0 },
      completed: { type: Number, default: 0 }
    },

    // Individual external service dispatches
    services: [{
      // Type of service being dispatched
      serviceType: {
        type: String,
        enum: [
          'surgery',           // External surgery
          'pharmacy',          // External pharmacy
          'laboratory',        // External lab
          'imaging',           // External imaging center
          'therapy',           // External therapy (PT, OT, etc.)
          'specialist',        // Specialist consultation
          'optical',           // External optical shop
          'injection',         // External injection service
          'other'
        ],
        required: true
      },

      // What is being ordered/referred
      description: String,
      serviceCode: String, // CPT or service code
      quantity: { type: Number, default: 1 },

      // Linked invoice item (for payment tracking)
      invoiceItemId: String,

      // External facility
      externalFacility: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ExternalFacility'
      },

      // Manual facility info (if not in directory)
      facilityInfo: {
        name: String,
        type: String,
        address: String,
        phone: String,
        email: String,
        contactPerson: String
      },

      // Dispatch status
      status: {
        type: String,
        enum: ['pending', 'dispatched', 'acknowledged', 'in_progress', 'completed', 'cancelled', 'failed'],
        default: 'pending'
      },

      // Dispatch details
      dispatchedAt: Date,
      dispatchedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      dispatchMethod: {
        type: String,
        enum: ['email', 'fax', 'print', 'api', 'phone', 'manual']
      },

      // Reference documents
      referralLetter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document'
      },
      prescriptionRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prescription'
      },
      labOrderRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LabOrder'
      },
      imagingOrderRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ImagingOrder'
      },
      surgeryRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SurgeryCase'
      },

      // External tracking
      externalReference: String, // Reference number from external facility
      estimatedCompletionDate: Date,

      // Acknowledgment
      acknowledgedAt: Date,
      acknowledgedBy: String,

      // Completion
      completedAt: Date,
      completedBy: String,
      completionProof: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document'
      },
      completionNotes: String,
      resultReceived: Boolean,
      resultDocument: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document'
      },

      // Link to unified FulfillmentDispatch record
      fulfillmentDispatch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FulfillmentDispatch'
      },

      // Priority
      priority: {
        type: String,
        enum: ['routine', 'urgent', 'stat'],
        default: 'routine'
      },

      // Instructions
      instructions: String,
      patientInstructions: String, // Instructions given to patient

      // Status history
      statusHistory: [{
        status: String,
        timestamp: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        notes: String
      }],

      // Created tracking
      createdAt: { type: Date, default: Date.now },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],

    // Overall dispatch notes
    notes: String,

    // Last updated
    lastUpdatedAt: Date,
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
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
  },

  // Optimistic locking - prevents lost updates from concurrent modifications
  version: {
    type: Number,
    default: 0
  },

  // Edit lock - prevents concurrent editing by multiple users
  editLock: {
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lockedAt: Date,
    lockExpires: Date
  },

  // Soft delete fields
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  optimisticConcurrency: true,
  versionKey: 'version'
});

// Indexes
visitSchema.index({ patient: 1, visitDate: -1 });
visitSchema.index({ visitId: 1 }, { unique: true, sparse: true });
visitSchema.index({ primaryProvider: 1, visitDate: -1 });
visitSchema.index({ status: 1 });
// Index on appointment for queries (non-unique to allow multiple walk-in consultations)
visitSchema.index({ 'appointment': 1 });

// CRITICAL: Multi-clinic indexes for data isolation
visitSchema.index({ clinic: 1, visitDate: -1 }); // Clinic-scoped visit list
visitSchema.index({ clinic: 1, status: 1 }); // Clinic-scoped status filtering
visitSchema.index({ clinic: 1, patient: 1 }); // Clinic-scoped patient visits
visitSchema.index({ clinic: 1, primaryProvider: 1, visitDate: -1 }); // Clinic-scoped provider visits

// Additional compound indexes for common query patterns
visitSchema.index({ patient: 1, primaryProvider: 1 }); // Patient-provider visit history
visitSchema.index({ clinic: 1, visitDate: -1, status: 1 }); // Clinic visit list with status filter
visitSchema.index({ clinic: 1, status: 1, createdAt: -1 }); // Recent visits by status per clinic
// Soft delete index
visitSchema.index({ clinic: 1, isDeleted: 1 });

// Query middleware - exclude deleted records by default
visitSchema.pre('find', function() {
  if (!this.getQuery().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

visitSchema.pre('findOne', function() {
  if (!this.getQuery().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

visitSchema.pre('countDocuments', function() {
  if (!this.getQuery().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

// Soft delete method
visitSchema.methods.softDelete = async function(deletedByUserId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedByUserId;
  return await this.save();
};

// Restore method
visitSchema.methods.restore = async function() {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return await this.save();
};

// CRITICAL: Validate dates to prevent future dates where inappropriate
visitSchema.pre('save', function(next) {
  const now = new Date();

  // Visit date should not be in the future (can't have a visit that hasn't happened)
  if (this.visitDate && new Date(this.visitDate) > now) {
    const error = new Error('Visit date cannot be in the future');
    error.name = 'ValidationError';
    error.statusCode = 400;
    return next(error);
  }

  // Check-in time should not be in the future
  if (this.checkIn?.checkInTime && new Date(this.checkIn.checkInTime) > now) {
    const error = new Error('Check-in time cannot be in the future');
    error.name = 'ValidationError';
    error.statusCode = 400;
    return next(error);
  }

  // Check-out time should not be in the future
  if (this.checkOut?.checkOutTime && new Date(this.checkOut.checkOutTime) > now) {
    const error = new Error('Check-out time cannot be in the future');
    error.name = 'ValidationError';
    error.statusCode = 400;
    return next(error);
  }

  // Completed visit time should not be in the future
  if (this.completedAt && new Date(this.completedAt) > now) {
    const error = new Error('Visit completion time cannot be in the future');
    error.name = 'ValidationError';
    error.statusCode = 400;
    return next(error);
  }

  next();
});

// Generate unique visitId before saving (ATOMIC - uses Counter model)
visitSchema.pre('save', async function(next) {
  if (!this.visitId) {
    const date = new Date(this.visitDate);
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const counterId = `visit-${dateStr}`;

    // Use atomic counter to prevent race conditions
    const sequence = await Counter.getNextSequence(counterId);
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

// HIGH PRIORITY FIX: Auto-populate clinical act prices from FeeSchedule at service time
visitSchema.pre('save', async function(next) {
  // Only process if clinicalActs have been modified
  if (this.isModified('clinicalActs') && this.clinicalActs?.length > 0) {
    const FeeSchedule = mongoose.model('FeeSchedule');

    for (const act of this.clinicalActs) {
      // Only auto-populate price if:
      // 1. Price is missing (undefined/null/0)
      // 2. AND we have an actCode to look up
      // 3. AND price hasn't already been captured (no priceCapturedAt timestamp)
      if ((act.price === undefined || act.price === null || act.price === 0) &&
          act.actCode &&
          !act.priceCapturedAt) {

        try {
          // Look up current price from FeeSchedule
          const fee = await FeeSchedule.findOne({
            code: act.actCode,
            active: true,
            $or: [
              { effectiveFrom: { $lte: new Date() }, effectiveTo: { $gte: new Date() } },
              { effectiveFrom: { $lte: new Date() }, effectiveTo: null }
            ]
          });

          if (fee) {
            act.price = fee.price;
            act.feeScheduleRef = fee._id;
            act.priceCapturedAt = new Date();
            act.priceSource = 'fee-schedule';
            log.info('Auto-populated price for clinical act', { actCode: act.actCode, price: fee.price });
          } else {
            log.warn('No FeeSchedule entry found for actCode', { actCode: act.actCode });
          }
        } catch (err) {
          log.error('Error looking up FeeSchedule for actCode', { actCode: act.actCode, error: err.message });
          // Don't block save on FeeSchedule lookup errors
        }
      }
    }
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

// Method to link prescription to visit
visitSchema.methods.addPrescription = async function(prescriptionId) {
  if (!this.prescriptions.includes(prescriptionId)) {
    this.prescriptions.push(prescriptionId);
    await this.save();
  }
  return this;
};

// Method to link IVT treatment to visit
visitSchema.methods.addIVTTreatment = async function(ivtTreatmentId) {
  if (!this.ivtTreatments.includes(ivtTreatmentId)) {
    this.ivtTreatments.push(ivtTreatmentId);
    await this.save();
  }
  return this;
};

/**
 * Capture patient's convention at check-in time
 * CRITICAL: This snapshot prevents pricing issues if convention changes mid-visit
 */
visitSchema.methods.captureConventionSnapshot = async function() {
  try {
    const Patient = require('./Patient');
    const Company = require('./Company');

    const patient = await Patient.findById(this.patient)
      .select('convention')
      .populate('convention.company', 'name companyId contract.status defaultCoverage coverageRules');

    if (!patient || !patient.convention?.company) {
      // No convention - that's OK, patient pays full price
      return null;
    }

    const convention = patient.convention;
    const company = convention.company;

    // Only capture if convention is active
    if (convention.status !== 'active' || company.contract?.status !== 'active') {
      return null;
    }

    // CRITICAL FIX: Also check validity dates
    const now = new Date();
    if (convention.validUntil && new Date(convention.validUntil) < now) {
      log.info('Convention expired', { validUntil: convention.validUntil });
      return null;
    }
    if (convention.validFrom && new Date(convention.validFrom) > now) {
      log.info('Convention not yet active', { validFrom: convention.validFrom });
      return null;
    }

    // Calculate IMMUTABLE values at capture time
    const companySharePercentage = convention.coveragePercentage || company.defaultCoverage?.percentage || 0;
    const patientSharePercentage = 100 - companySharePercentage;
    const maxCoverage = company.defaultCoverage?.maxAmount || company.coverageRules?.maxAmount || null;

    // Capture the IMMUTABLE snapshot - only calculated values, no mutable config
    this.billing.conventionSnapshot = {
      conventionId: company._id,
      conventionName: company.name,
      conventionCode: company.companyId,
      capturedAt: new Date(),
      isFrozen: true,
      // Store calculated percentages (immutable)
      patientSharePercentage,
      companySharePercentage,
      maxCoverage
    };

    await this.save();

    log.info('Convention snapshot captured', { visitId: this.visitId, companyName: company.name, companyId: company.companyId });

    return this.billing.conventionSnapshot;
  } catch (error) {
    log.error('[VISIT] Error capturing convention snapshot:', error.message);
    return null;
  }
};

/**
 * Static method to create visit with convention snapshot
 */
visitSchema.statics.createWithConventionSnapshot = async function(visitData, options = {}) {
  const visit = await this.create(visitData);

  // Capture convention if patient has one
  if (visit.patient) {
    await visit.captureConventionSnapshot();
  }

  return visit;
};

// Method to get complete visit summary
visitSchema.methods.getCompleteSummary = async function() {
  await this.populate([
    { path: 'patient', select: 'firstName lastName patientId dateOfBirth' },
    { path: 'primaryProvider', select: 'firstName lastName role' },
    { path: 'prescriptions' },
    { path: 'ivtTreatments' },
    { path: 'billing.invoice' }
  ]);

  return {
    visitId: this.visitId,
    visitDate: this.visitDate,
    patient: this.patient,
    provider: this.primaryProvider,
    chiefComplaint: this.chiefComplaint?.complaint,
    diagnoses: this.diagnoses,
    prescriptions: this.prescriptions,
    ivtTreatments: this.ivtTreatments,
    clinicalActs: this.clinicalActs,
    status: this.status,
    invoice: this.billing?.invoice,
    completedAt: this.completedAt
  };
};

// Valid visit status transitions (state machine)
const VALID_STATUS_TRANSITIONS = {
  'scheduled': ['checked-in', 'cancelled', 'no-show'],
  'checked-in': ['in-progress', 'cancelled', 'no-show'],
  'in-progress': ['completed', 'cancelled'],
  'completed': [], // Terminal state - no transitions allowed
  'cancelled': [], // Terminal state
  'no-show': ['checked-in'] // Can reschedule no-show
};

// Method to validate status transition
visitSchema.methods.canTransitionTo = function(newStatus) {
  const allowedTransitions = VALID_STATUS_TRANSITIONS[this.status] || [];
  return allowedTransitions.includes(newStatus);
};

// Method to complete visit with full cascade logic (WITH OPTIONAL TRANSACTION SUPPORT)
visitSchema.methods.completeVisit = async function(userId) {
  const mongoose = require('mongoose');
  const Invoice = require('./Invoice');
  const Prescription = require('./Prescription');
  const Appointment = require('./Appointment');

  // CRITICAL: Idempotency check - prevent double completion
  if (this.status === 'completed') {
    log.info(`Visit ${this.visitId} already completed at ${this.completedAt}`);
    return {
      success: true,
      visit: this,
      alreadyCompleted: true,
      message: 'Visit was already completed'
    };
  }

  // CRITICAL: Status transition validation
  if (!this.canTransitionTo('completed')) {
    throw new Error(`Cannot complete visit from status '${this.status}'. Visit must be 'in-progress' first.`);
  }

  // Try to start MongoDB transaction (only works with replica set)
  let session = null;
  let useTransaction = false;

  try {
    // Check if we're connected to a replica set BEFORE attempting transactions
    const client = mongoose.connection.getClient();
    const topology = client?.topology;
    const isReplicaSet = topology && (
      topology.s?.description?.type === 'ReplicaSetWithPrimary' ||
      topology.s?.description?.type === 'ReplicaSetNoPrimary'
    );

    if (isReplicaSet) {
      session = await mongoose.startSession();
      await session.startTransaction();
      useTransaction = true;
      log.info('[VISIT COMPLETION] Using MongoDB transaction for data consistency');
    } else {
      log.info('[VISIT COMPLETION] Standalone MongoDB detected, proceeding without transaction support');
    }
  } catch (transactionError) {
    log.warn('[VISIT COMPLETION] Transactions not available, proceeding without transaction:', transactionError.message);
    if (session) {
      try { session.endSession(); } catch (e) { /* ignore session cleanup errors */ }
      session = null;
    }
  }

  log.info('Starting visit completion', { visitId: this.visitId, objectId: this._id, patient: this.patient });
  log.info('Processing prescriptions', { visitId: this.visitId, prescriptionCount: this.prescriptions.length });

  // Track operations for compensating rollback (used when transactions unavailable)
  const rollbackStack = [];

  try {
    // 0. AUTO-CREATE PRESCRIPTIONS from plan.medications if not already linked
    // This ensures medications added during consultation become proper Prescription records
    if (this.plan?.medications && this.plan.medications.length > 0) {
      log.info(`[VISIT COMPLETION] Found ${this.plan.medications.length} medications in plan - creating Prescription records`);

      // Group all medications into a single prescription
      // If no inventory link is provided, mark as external item to allow dispensing elsewhere
      const medicationsForPrescription = this.plan.medications.map(med => ({
        name: med.medication || med.name,
        genericName: med.medication || med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        duration: med.duration,
        route: med.route,
        instructions: med.instructions,
        quantity: med.quantity || 1,
        unit: med.unit || 'unit',
        medication: med.inventoryId || null,  // Link to PharmacyInventory if provided
        isExternalItem: !med.inventoryId      // Mark as external if no inventory link
      }));

      try {
        // Create prescription without transaction (standalone MongoDB compatible)
        const prescriptionData = {
          patient: this.patient,
          prescriber: this.primaryProvider || userId,
          visit: this._id,
          appointment: this.appointment,
          type: 'medication',
          medications: medicationsForPrescription,
          status: 'pending',
          pharmacyStatus: 'pending',
          dateIssued: new Date(),
          validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          notes: {
            prescriber: `Auto-created from visit ${this.visitId} plan medications`
          },
          createdBy: userId
        };

        let createdPrescription;
        if (useTransaction && session) {
          const result = await Prescription.create([prescriptionData], { session });
          createdPrescription = result[0];
        } else {
          // Standalone MongoDB - create without session
          createdPrescription = await Prescription.create(prescriptionData);
        }

        // Link prescription to visit
        this.prescriptions.push(createdPrescription._id);

        // Track for rollback
        rollbackStack.push({
          type: 'prescription_create',
          prescriptionId: createdPrescription._id
        });

        log.info(`[VISIT COMPLETION] Created Prescription ${createdPrescription.prescriptionId || createdPrescription._id} with ${medicationsForPrescription.length} medications`);

        // Clear plan.medications since they're now in a proper Prescription
        this.plan.medications = [];
      } catch (prescriptionError) {
        log.error('[VISIT COMPLETION] Error creating prescription from plan.medications:', prescriptionError.message);
        // Continue - don't fail visit completion for this
      }
    }

    // 1. Reserve inventory for all prescriptions
    const reservationResults = [];
    for (const prescriptionId of this.prescriptions) {
      try {
        const prescription = useTransaction
          ? await Prescription.findById(prescriptionId).session(session)
          : await Prescription.findById(prescriptionId);
        if (prescription && prescription.type === 'medication') {
          const result = await prescription.reserveInventory(userId, useTransaction ? session : null);
          reservationResults.push({
            prescriptionId: prescription.prescriptionId,
            success: result.success,
            results: result.results
          });

          // Update prescription status - inventory reserved, ready for pharmacy review
          if (result.success) {
            // Set status to 'pending' for pharmacy workflow
            // Pharmacy staff will review → prepare → mark as ready
            prescription.status = 'pending';
            prescription.pharmacyStatus = 'pending'; // Start of pharmacy workflow
            prescription.inventoryReserved = true;
            prescription.inventoryReservedAt = new Date();
            prescription.inventoryReservedBy = userId;
            await prescription.save(useTransaction ? { session } : {});

            // Track for rollback
            rollbackStack.push({
              type: 'inventory_reservation',
              prescriptionId: prescription._id
            });
          }
        }
      } catch (error) {
        reservationResults.push({
          prescriptionId,
          success: false,
          error: error.message
        });
        // Continue processing other prescriptions
      }
    }

    // Log inventory reservation results
    const successfulReservations = reservationResults.filter(r => r.success).length;
    const failedReservations = reservationResults.filter(r => !r.success).length;
    log.info(`[VISIT COMPLETION] Inventory reservation complete: ${successfulReservations} successful, ${failedReservations} failed`);
    if (failedReservations > 0) {
      const failures = reservationResults.filter(r => !r.success);
      log.warn('[VISIT COMPLETION] Failed reservations:', failures);
    }

    // 2. Generate invoice if not already created
    let invoiceData = null;
    if (!this.billing.invoice) {
      log.info(`[VISIT COMPLETION] Generating invoice for Visit ${this.visitId}`);
      try {
        invoiceData = await this.generateInvoice(userId, useTransaction ? { session } : {});
        if (invoiceData.invoice) {
          this.billing.invoice = invoiceData.invoice._id;

          // Track for rollback
          rollbackStack.push({
            type: 'invoice_create',
            invoiceId: invoiceData.invoice._id
          });

          log.info(`[VISIT COMPLETION] Invoice ${invoiceData.invoice.invoiceId || invoiceData.invoice._id} generated successfully`);
        }
      } catch (error) {
        log.error(`[VISIT COMPLETION] Error generating invoice for Visit ${this.visitId}:`, error);
        // Continue without invoice if it fails
      }
    } else {
      log.info(`[VISIT COMPLETION] Visit ${this.visitId} already has invoice ${this.billing.invoice}`);
    }

    // 3. Update appointment status if linked
    if (this.appointment) {
      try {
        const appointment = useTransaction
          ? await Appointment.findById(this.appointment).session(session)
          : await Appointment.findById(this.appointment);
        if (appointment && appointment.status !== 'completed') {
          const previousStatus = appointment.status;
          appointment.status = 'completed';
          appointment.completedAt = new Date();
          await appointment.save(useTransaction ? { session } : {});

          // Track for rollback
          rollbackStack.push({
            type: 'appointment_update',
            appointmentId: this.appointment,
            previousStatus
          });
        }
      } catch (error) {
        log.error('Error updating appointment:', error);
        // Continue without appointment update if it fails
      }
    }

    // 4. Complete the visit
    this.status = 'completed';
    this.completedAt = new Date();
    this.completedBy = userId;
    this.endTime = this.endTime || new Date();

    await this.save(useTransaction ? { session } : {});

    // 5. CRITICAL: Update Patient.lastVisit for accurate patient history tracking
    if (this.patient) {
      try {
        const Patient = require('./Patient');
        const updateOptions = useTransaction ? { session } : {};
        await Patient.findByIdAndUpdate(
          this.patient,
          {
            lastVisit: this._id,
            lastVisitDate: this.visitDate,
            lastConsultationDate: new Date()
          },
          updateOptions
        );
      } catch (patientErr) {
        log.error('Error updating patient lastVisit:', patientErr);
        // Continue - don't fail visit completion if patient update fails
      }
    }

    // Commit transaction if using transactions
    if (useTransaction && session) {
      await session.commitTransaction();
    }

    log.info(`[VISIT COMPLETION] ✅ Visit ${this.visitId} completed successfully`);
    log.info(`[VISIT COMPLETION] Summary: ${reservationResults.length} prescriptions processed, Invoice: ${this.billing.invoice ? 'Generated' : 'None'}`);

    return {
      success: true,
      visit: this,
      reservations: reservationResults,
      invoiceGenerated: !!this.billing.invoice
    };

  } catch (error) {
    log.error('[VISIT COMPLETION] Error during visit completion:', error);

    // Rollback if using transactions
    if (useTransaction && session) {
      await session.abortTransaction();
      log.info('Transaction aborted for visit completion', { visitId: this.visitId });
    } else if (rollbackStack.length > 0) {
      // Execute compensating rollback for non-transaction mode
      log.info('Executing compensating rollback', { visitId: this.visitId, operationCount: rollbackStack.length });
      await this._executeCompensatingRollback(rollbackStack);
    }

    throw error;
  } finally {
    // Clean up session if created (safely - ignore cleanup errors)
    if (session) {
      try { session.endSession(); } catch (e) { /* ignore session cleanup errors */ }
    }
  }
};

// Helper method for compensating transactions (when MongoDB transactions unavailable)
visitSchema.methods._executeCompensatingRollback = async function(rollbackStack) {
  const Prescription = require('./Prescription');
  const Invoice = require('./Invoice');
  const Appointment = require('./Appointment');

  log.info(`[COMPENSATING ROLLBACK] Rolling back ${rollbackStack.length} operations for visit ${this.visitId}`);

  // Reverse order (LIFO - Last In First Out)
  while (rollbackStack.length > 0) {
    const operation = rollbackStack.pop();

    try {
      switch (operation.type) {
        case 'prescription_create':
          // Cancel the prescription that was created
          await Prescription.findByIdAndUpdate(operation.prescriptionId, {
            $set: {
              status: 'cancelled',
              cancelledAt: new Date(),
              cancellationReason: 'Visit completion failed - compensating rollback'
            }
          });
          log.info(`[COMPENSATING ROLLBACK] Cancelled prescription: ${operation.prescriptionId}`);
          break;

        case 'inventory_reservation':
          // Release inventory reservation
          const prescription = await Prescription.findById(operation.prescriptionId);
          if (prescription) {
            await prescription.releaseInventoryReservations();
            log.info(`[COMPENSATING ROLLBACK] Released inventory for prescription: ${operation.prescriptionId}`);
          }
          break;

        case 'invoice_create':
          // Cancel the invoice that was created
          await Invoice.findByIdAndUpdate(operation.invoiceId, {
            $set: {
              status: 'cancelled',
              cancelledAt: new Date(),
              cancellationReason: 'Visit completion failed - compensating rollback'
            }
          });
          log.info(`[COMPENSATING ROLLBACK] Cancelled invoice: ${operation.invoiceId}`);
          break;

        case 'appointment_update':
          // Revert appointment status
          await Appointment.findByIdAndUpdate(operation.appointmentId, {
            $set: {
              status: operation.previousStatus,
              completedAt: null
            }
          });
          log.info(`[COMPENSATING ROLLBACK] Reverted appointment: ${operation.appointmentId} to ${operation.previousStatus}`);
          break;

        default:
          log.warn(`[COMPENSATING ROLLBACK] Unknown operation type: ${operation.type}`);
      }
    } catch (rollbackError) {
      log.error(`[COMPENSATING ROLLBACK] Failed to rollback ${operation.type}:`, rollbackError);

      // Create critical alert for failed rollback
      await this._createCriticalAlert(
        `Rollback failed for visit ${this.visitId}`,
        {
          operationType: operation.type,
          operation,
          error: rollbackError.message,
          visitId: this.visitId,
          visitObjectId: this._id,
          patientId: this.patient
        }
      );
    }
  }

  log.info(`[COMPENSATING ROLLBACK] Rollback complete for visit ${this.visitId}`);
};

// Helper method to create critical alerts for system issues
visitSchema.methods._createCriticalAlert = async function(message, details) {
  const Alert = require('./Alert');
  try {
    await Alert.create({
      category: 'system',
      priority: 'critical',
      title: 'Transaction Rollback Failure',
      message,
      metadata: details,
      requiresAcknowledgment: true,
      createdAt: new Date()
    });
    log.error(`[CRITICAL ALERT] ${message}`, details);
  } catch (alertError) {
    log.error('[CRITICAL ALERT] Failed to create alert:', alertError);
  }
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

// Method to generate invoice from visit
// NOTE: Medications are NOT included - they are billed separately at pharmacy dispensing
visitSchema.methods.generateInvoice = async function(userId, options = {}) {
  const Invoice = require('./Invoice');

  // Check if invoice already exists
  if (this.billing.invoice) {
    const existingInvoice = await Invoice.findById(this.billing.invoice);
    if (existingInvoice) {
      return { success: true, invoice: existingInvoice, alreadyExists: true };
    }
  }

  const items = [];
  let subtotal = 0;

  // Helper function to get fee AND category from FeeSchedule with fallback
  const getFeeFromSchedule = async (code, defaultFee, defaultCategory = 'procedure') => {
    try {
      const FeeSchedule = require('./FeeSchedule');
      const feeSchedule = await FeeSchedule.findOne({
        code: code,
        active: true,
        $or: [
          { effectiveFrom: { $lte: new Date() }, effectiveTo: { $gte: new Date() } },
          { effectiveFrom: { $lte: new Date() }, effectiveTo: null }
        ]
      });
      if (feeSchedule) {
        return { price: feeSchedule.price, category: feeSchedule.category || defaultCategory };
      }
      return { price: defaultFee, category: defaultCategory };
    } catch (err) {
      // FeeSchedule model may not exist yet, use defaults
      return { price: defaultFee, category: defaultCategory };
    }
  };

  // 1. Add consultation/visit fee (from FeeSchedule or defaults)
  const consultationCode = this.visitType === 'initial' ? 'CONS-INIT' : 'CONS-FOLLOWUP';
  const defaultConsultationFee = this.visitType === 'initial' ? 15000 : 10000; // CFA
  const consultationFeeData = await getFeeFromSchedule(consultationCode, defaultConsultationFee, 'consultation');

  items.push({
    category: consultationFeeData.category,
    description: `Consultation - ${this.visitType}`,
    code: consultationCode,
    quantity: 1,
    unitPrice: consultationFeeData.price,
    subtotal: consultationFeeData.price,
    total: consultationFeeData.price,
    provider: this.primaryProvider
  });
  subtotal += consultationFeeData.price;

  // 2. Add clinical acts (with FeeSchedule lookup)
  // FIXED: Only bill COMPLETED acts, not planned ones
  // Planned acts should not be invoiced until they are actually performed
  let visitModified = false; // Track if we need to save the visit

  for (const act of this.clinicalActs || []) {
    if (act.status === 'completed') {
      // HIGH PRIORITY FIX: Validate that price is captured at service time
      // If act.price is missing, look it up from FeeSchedule and save it with audit trail
      if (act.price === undefined || act.price === null || act.price === 0) {
        log.warn(`[Visit.generateInvoice] Clinical act ${act.actCode || act.actType} missing price, looking up from FeeSchedule`);

        if (act.actCode) {
          const feeInfo = await getFeeFromSchedule(act.actCode, 5000, act.category || 'procedure');
          act.price = feeInfo.price;
          act.priceSource = 'fee-schedule-fallback';
          act.priceCapturedAt = new Date();

          // Look up the FeeSchedule reference for audit trail
          try {
            const FeeSchedule = require('./FeeSchedule');
            const fee = await FeeSchedule.findOne({
              code: act.actCode,
              active: true,
              $or: [
                { effectiveFrom: { $lte: new Date() }, effectiveTo: { $gte: new Date() } },
                { effectiveFrom: { $lte: new Date() }, effectiveTo: null }
              ]
            });
            if (fee) {
              act.feeScheduleRef = fee._id;
            }
          } catch (err) {
            log.error('[Visit.generateInvoice] Error looking up FeeSchedule reference:', err.message);
          }

          visitModified = true;
          log.info(`[Visit.generateInvoice] Set fallback price for act ${act.actCode}: ${act.price} CFA`);
        } else {
          // No actCode, use default
          act.price = 5000;
          act.priceSource = 'fee-schedule-fallback';
          act.priceCapturedAt = new Date();
          visitModified = true;
          log.warn(`[Visit.generateInvoice] No actCode for act ${act.actType}, using default price: 5000 CFA`);
        }
      }

      // Now use the captured price (either pre-existing or just populated)
      const actData = {
        price: act.price,
        category: act.category || 'procedure'
      };

      items.push({
        category: actData.category,
        description: act.actName || act.actType,
        code: act.actCode || 'PROC-GEN',
        quantity: act.quantity || 1,
        unitPrice: actData.price,
        subtotal: actData.price * (act.quantity || 1),
        total: actData.price * (act.quantity || 1),
        provider: act.provider
      });
      subtotal += actData.price * (act.quantity || 1);
    }
  }

  // Save the visit if we added any fallback prices
  if (visitModified) {
    await this.save();
    log.info('[Visit.generateInvoice] Saved visit with updated clinical act prices');
  }

  // 2.5 Add device/diagnostic charges (OCT, tonometry, autorefractor, etc.)
  const OphthalmologyExam = require('./OphthalmologyExam');
  try {
    const exam = await OphthalmologyExam.findOne({ visit: this._id });
    if (exam) {
      // Device pricing mapping to FeeSchedule codes
      const devicePriceMapping = {
        'autorefractor': { code: 'EXAM-AUTOREFRACTION', name: 'Autoréfractomètre', fallback: 3000 },
        'keratometer': { code: 'EXAM-KERATOMETRY', name: 'Kératométrie', fallback: 2500 },
        'tonometer': { code: 'EXAM-TONOMETRY', name: 'Tonométrie', fallback: 5000 },
        'oct': { code: 'EXAM-OCT-MACULA', name: 'OCT (Tomographie)', fallback: 25000 },
        'visual-field': { code: 'EXAM-VISUAL-FIELD-HUMPHREY', name: 'Champ Visuel', fallback: 15000 },
        'fundus-photo': { code: 'EXAM-RETINOGRAPHY', name: 'Photo du Fond d\'Oeil', fallback: 12000 },
        'topography': { code: 'EXAM-CORNEAL-TOPOGRAPHY', name: 'Topographie Cornéenne', fallback: 20000 },
        'pachymetry': { code: 'EXAM-PACHYMETRY', name: 'Pachymétrie', fallback: 8000 },
        'gonioscopy': { code: 'EXAM-GONIOSCOPY', name: 'Gonioscopie', fallback: 10000 },
        'biometry': { code: 'EXAM-IOL-BIOMETRY', name: 'Biométrie IOL', fallback: 15000 }
      };

      // Check for device measurements linked to exam
      if (exam.deviceMeasurements && exam.deviceMeasurements.length > 0) {
        for (const measurement of exam.deviceMeasurements) {
          const deviceType = measurement.measurementType?.toLowerCase();
          const deviceInfo = devicePriceMapping[deviceType];
          if (deviceInfo && !items.some(i => i.code === deviceInfo.code)) {
            const deviceData = await getFeeFromSchedule(deviceInfo.code, deviceInfo.fallback, 'examination');
            items.push({
              category: deviceData.category,
              description: deviceInfo.name,
              code: deviceInfo.code,
              quantity: 1,
              unitPrice: deviceData.price,
              subtotal: deviceData.price,
              total: deviceData.price
            });
            subtotal += deviceData.price;
          }
        }
      }

      // Check for specific diagnostic tests performed
      if (exam.additionalTests) {
        // OCT
        if (exam.additionalTests.oct?.performed && !items.some(i => i.code === 'EXAM-OCT-MACULA')) {
          const octData = await getFeeFromSchedule('EXAM-OCT-MACULA', 25000, 'imaging');
          items.push({ category: octData.category, description: 'OCT Macula/Nerf Optique', code: 'EXAM-OCT-MACULA', quantity: 1, unitPrice: octData.price, subtotal: octData.price, total: octData.price });
          subtotal += octData.price;
        }
        // Visual Field
        if (exam.additionalTests.visualField?.performed && !items.some(i => i.code === 'EXAM-VISUAL-FIELD-HUMPHREY')) {
          const vfData = await getFeeFromSchedule('EXAM-VISUAL-FIELD-HUMPHREY', 15000, 'examination');
          items.push({ category: vfData.category, description: 'Champ Visuel (Humphrey)', code: 'EXAM-VISUAL-FIELD-HUMPHREY', quantity: 1, unitPrice: vfData.price, subtotal: vfData.price, total: vfData.price });
          subtotal += vfData.price;
        }
        // Gonioscopy
        if (exam.additionalTests.gonioscopy?.performed && !items.some(i => i.code === 'EXAM-GONIOSCOPY')) {
          const gonioData = await getFeeFromSchedule('EXAM-GONIOSCOPY', 10000, 'examination');
          items.push({ category: gonioData.category, description: 'Gonioscopie', code: 'EXAM-GONIOSCOPY', quantity: 1, unitPrice: gonioData.price, subtotal: gonioData.price, total: gonioData.price });
          subtotal += gonioData.price;
        }
        // Fundus Photography
        if (exam.additionalTests.fundusPhotography?.performed && !items.some(i => i.code === 'EXAM-RETINOGRAPHY')) {
          const fundusData = await getFeeFromSchedule('EXAM-RETINOGRAPHY', 12000, 'imaging');
          items.push({ category: fundusData.category, description: 'Rétinographie', code: 'EXAM-RETINOGRAPHY', quantity: 1, unitPrice: fundusData.price, subtotal: fundusData.price, total: fundusData.price });
          subtotal += fundusData.price;
        }
        // Corneal Topography
        if (exam.additionalTests.cornealTopography?.performed && !items.some(i => i.code === 'EXAM-CORNEAL-TOPOGRAPHY')) {
          const topoData = await getFeeFromSchedule('EXAM-CORNEAL-TOPOGRAPHY', 20000, 'imaging');
          items.push({ category: topoData.category, description: 'Topographie cornéenne', code: 'EXAM-CORNEAL-TOPOGRAPHY', quantity: 1, unitPrice: topoData.price, subtotal: topoData.price, total: topoData.price });
          subtotal += topoData.price;
        }
      }

      // Pachymetry (from IOP section)
      if (exam.iop?.OD?.pachymetry || exam.iop?.OS?.pachymetry) {
        if (!items.some(i => i.code === 'EXAM-PACHYMETRY')) {
          const pachyData = await getFeeFromSchedule('EXAM-PACHYMETRY', 8000, 'examination');
          items.push({ category: pachyData.category, description: 'Pachymétrie', code: 'EXAM-PACHYMETRY', quantity: 1, unitPrice: pachyData.price, subtotal: pachyData.price, total: pachyData.price });
          subtotal += pachyData.price;
        }
      }
    }
  } catch (examError) {
    log.error('Error adding device charges to invoice:', examError);
    // Continue without device charges if exam lookup fails
  }

  // 2.6 Add IVT (Intravitreal Injection) treatments
  if (this.ivtTreatments && this.ivtTreatments.length > 0) {
    try {
      const IVTInjection = require('./IVTInjection');
      const ivtTreatments = await IVTInjection.find({ _id: { $in: this.ivtTreatments } });

      for (const ivt of ivtTreatments) {
        // Default IVT code based on drug type
        let ivtCode = 'PROC-IVT';
        let ivtDescription = 'Injection intravitréenne';

        if (ivt.drug && ivt.drug.name) {
          const drugName = ivt.drug.name.toLowerCase();
          if (drugName.includes('lucentis') || drugName.includes('ranibizumab')) {
            ivtCode = 'PROC-IVT-LUCENTIS';
            ivtDescription = 'IVT Lucentis (Ranibizumab)';
          } else if (drugName.includes('eylea') || drugName.includes('aflibercept')) {
            ivtCode = 'PROC-IVT-EYLEA';
            ivtDescription = 'IVT Eylea (Aflibercept)';
          } else if (drugName.includes('avastin') || drugName.includes('bevacizumab')) {
            ivtCode = 'PROC-IVT-AVASTIN';
            ivtDescription = 'IVT Avastin (Bevacizumab)';
          }
        }

        // Get price and category from FeeSchedule
        const ivtData = await getFeeFromSchedule(ivtCode, 50000, 'procedure'); // Default 50,000 CDF

        if (!items.some(i => i.reference === ivt._id.toString())) {
          items.push({
            category: ivtData.category,
            description: ivtDescription + (ivt.eye ? ` - ${ivt.eye}` : ''),
            code: ivtCode,
            quantity: 1,
            unitPrice: ivtData.price,
            subtotal: ivtData.price,
            total: ivtData.price,
            reference: ivt._id.toString()
          });
          subtotal += ivtData.price;
        }
      }
    } catch (ivtError) {
      log.error('Error adding IVT charges to invoice:', ivtError);
      // Continue without IVT charges if lookup fails
    }
  }

  // 2.7 Add Laboratory orders/tests
  if (this.laboratoryOrders && this.laboratoryOrders.length > 0) {
    try {
      const LabOrder = require('./LabOrder');

      for (const labOrderRef of this.laboratoryOrders) {
        // Fetch the full lab order to get all tests
        const labOrder = await LabOrder.findById(labOrderRef.labOrderId);

        if (labOrder && labOrder.tests) {
          for (const test of labOrder.tests) {
            // Skip if already invoiced
            if (test.invoiced) continue;

            // Look up price from FeeSchedule using test code
            const testCode = test.testCode || 'LAB-GEN';
            const defaultLabPrice = 5000; // Default price for lab tests
            const labData = await getFeeFromSchedule(testCode, defaultLabPrice, 'laboratory');

            // Add to invoice items
            items.push({
              category: labData.category,
              description: test.testName || 'Test de laboratoire',
              code: testCode,
              quantity: 1,
              unitPrice: labData.price,
              subtotal: labData.price,
              total: labData.price,
              reference: `LabOrder:${labOrder._id}:${test._id}`
            });
            subtotal += labData.price;
          }
        }
      }
    } catch (labError) {
      log.error('Error adding laboratory charges to invoice:', labError);
      // Continue without lab charges if lookup fails
    }
  }

  // 2.8 Add Examination Orders (template-based examinations)
  if (this.examinationOrders && this.examinationOrders.length > 0) {
    try {
      for (const examOrder of this.examinationOrders) {
        // Only bill completed examinations
        if (examOrder.status !== 'completed') continue;

        // Look up price from FeeSchedule
        const examCode = examOrder.examinationCode || 'EXAM-GEN';
        const defaultExamPrice = 10000;
        const examData = await getFeeFromSchedule(examCode, defaultExamPrice, 'examination');

        items.push({
          category: examData.category,
          description: examOrder.examinationName || 'Examen',
          code: examCode,
          quantity: 1,
          unitPrice: examData.price,
          subtotal: examData.price,
          total: examData.price,
          reference: `ExamOrder:${examOrder._id}`
        });
        subtotal += examData.price;
      }
    } catch (examOrderError) {
      log.error('Error adding examination order charges to invoice:', examOrderError);
    }
  }

  // 2.9 Add Surgery Case charges
  if (this.surgeryCase) {
    try {
      const SurgeryCase = require('./SurgeryCase');
      const surgery = await SurgeryCase.findById(this.surgeryCase);

      if (surgery && surgery.status === 'completed') {
        // Get surgery fee from FeeSchedule
        const surgeryCode = surgery.procedureCode || 'SURG-GEN';
        const defaultSurgeryPrice = surgery.estimatedCost || 100000;
        const surgeryData = await getFeeFromSchedule(surgeryCode, defaultSurgeryPrice, 'surgery');

        items.push({
          category: surgeryData.category,
          description: surgery.procedureName || 'Chirurgie',
          code: surgeryCode,
          quantity: 1,
          unitPrice: surgeryData.price,
          subtotal: surgeryData.price,
          total: surgeryData.price,
          reference: `Surgery:${surgery._id}`
        });
        subtotal += surgeryData.price;

        // Add anesthesia if applicable
        if (surgery.anesthesiaType && surgery.anesthesiaType !== 'none' && surgery.anesthesiaType !== 'topical') {
          const anesthCode = `ANES-${surgery.anesthesiaType.toUpperCase()}`;
          const anesthData = await getFeeFromSchedule(anesthCode, 25000, 'anesthesia');

          items.push({
            category: anesthData.category,
            description: `Anesthésie (${surgery.anesthesiaType})`,
            code: anesthCode,
            quantity: 1,
            unitPrice: anesthData.price,
            subtotal: anesthData.price,
            total: anesthData.price,
            reference: `Surgery:${surgery._id}:anesthesia`
          });
          subtotal += anesthData.price;
        }
      }
    } catch (surgeryError) {
      log.error('Error adding surgery charges to invoice:', surgeryError);
    }
  }

  // ============================================
  // 2.10 UNIFIED BILLING: Include Medications from Prescriptions
  // Medications are now included in visit invoice (status: pending)
  // They get marked as 'completed' when dispensed at pharmacy
  // ============================================
  if (this.prescriptions && this.prescriptions.length > 0) {
    try {
      const Prescription = require('./Prescription');

      for (const prescriptionId of this.prescriptions) {
        const prescription = await Prescription.findById(prescriptionId);

        if (prescription && prescription.type === 'medication' && prescription.medications) {
          for (const med of prescription.medications) {
            // Calculate price from medication pricing or inventory
            const unitPrice = med.pricing?.unitPrice || med.unitCost || 0;
            const quantity = med.quantity || 1;
            const total = med.pricing?.totalCost || (unitPrice * quantity);

            if (total > 0) {
              items.push({
                category: 'medication',
                description: med.name || med.genericName || 'Médicament',
                code: med.drug?.toString() || 'MED',
                quantity: quantity,
                unitPrice: unitPrice,
                discount: 0,
                subtotal: total,
                tax: 0,
                total: total,
                status: 'pending', // Will be marked 'completed' when dispensed
                reference: `Prescription:${prescriptionId}`
              });
              subtotal += total;
              log.info(`[INVOICE] Added medication: ${med.name} x${quantity} @ ${unitPrice} = ${total} CDF`);
            }
          }
        }
      }
    } catch (medError) {
      log.error('Error adding medications to invoice:', medError);
    }
  }

  // 3. Calculate totals (no tax for medical services in CFA zone)
  const taxRate = 0;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  // 4. Create invoice (invoiceId auto-generated by Invoice pre-save hook using atomic Counter)
  const invoice = await Invoice.create({
    patient: this.patient,
    visit: this._id,
    items,
    summary: {
      subtotal,
      tax,
      total,
      amountDue: total,
      amountPaid: 0
    },
    currency: process.env.BASE_CURRENCY || 'CDF', // Franc Congolais
    status: 'draft',
    dateIssued: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    createdBy: userId,
    notes: {
      internal: options.notes || `Facture générée automatiquement pour la visite ${this.visitId}.`
    }
  });

  // 5. Update visit billing
  this.billing.invoice = invoice._id;
  this.billing.totalCharges = total;
  this.billing.status = 'pending';
  await this.save();

  return {
    success: true,
    invoice,
    itemsCount: items.length,
    total,
    // UNIFIED BILLING: Medications are now included in this invoice
    prescriptionCount: this.prescriptions?.length || 0,
    medicationsIncluded: items.filter(i => i.category === 'medication').length
  };
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

// ============================================
// POST-SAVE HOOK: Auto-update Patient.lastVisit
// ============================================
// CRITICAL FIX: This ensures Patient.lastVisit is always updated when a visit
// is completed, regardless of whether completeVisit() method was used or
// the status was changed directly via save/updateOne.
// This prevents stale lastVisit data that breaks patient timeline displays.
//
// RACE CONDITION FIX: Uses atomic findOneAndUpdate with conditional update
// to prevent race conditions when multiple visits are saved concurrently.
visitSchema.post('save', async (doc) => {
  try {
    const Patient = require('./Patient');

    // Handle completed visits - atomic update to prevent race conditions
    if (doc.status === 'completed' && doc.patient) {
      // Atomic update - only update if this visit is more recent than current lastVisit
      await Patient.findOneAndUpdate(
        {
          _id: doc.patient,
          $or: [
            { lastVisit: null },
            { lastVisitDate: null },
            { lastVisitDate: { $lt: doc.visitDate } }
          ]
        },
        {
          $set: {
            lastVisit: doc._id,
            lastVisitDate: doc.visitDate,
            lastConsultationDate: doc.completedAt || new Date()
          }
        }
      );
      log.info('Auto-updated lastVisit for patient', { patientId: doc.patient, visitId: doc.visitId || doc._id });
    }

    // Handle cancelled visits - recalculate lastVisit if needed
    if (doc.status === 'cancelled' && doc.patient) {
      const currentPatient = await Patient.findById(doc.patient).select('lastVisit');

      // Only recalculate if this cancelled visit was the current lastVisit
      if (currentPatient && currentPatient.lastVisit && currentPatient.lastVisit.toString() === doc._id.toString()) {
        // Find next most recent non-cancelled visit
        const mostRecentVisit = await mongoose.model('Visit').findOne({
          patient: doc.patient,
          status: { $in: ['completed', 'checked-out'] },
          _id: { $ne: doc._id }
        }).sort({ visitDate: -1 });

        if (mostRecentVisit) {
          await Patient.findByIdAndUpdate(doc.patient, {
            lastVisit: mostRecentVisit._id,
            lastVisitDate: mostRecentVisit.visitDate,
            lastConsultationDate: mostRecentVisit.completedAt || mostRecentVisit.visitDate
          });
          log.info(`[VISIT] Recalculated lastVisit for patient ${doc.patient} after cancellation - new lastVisit: ${mostRecentVisit.visitId || mostRecentVisit._id}`);
        } else {
          // No other completed visits - clear lastVisit fields
          await Patient.findByIdAndUpdate(doc.patient, {
            $unset: { lastVisit: 1, lastVisitDate: 1, lastConsultationDate: 1 }
          });
          log.info(`[VISIT] Cleared lastVisit for patient ${doc.patient} - no other completed visits found`);
        }
      }
    }
  } catch (error) {
    log.error('[VISIT] Error auto-updating patient lastVisit:', error);
    // Don't throw - this is a non-critical operation
  }
});

// ==========================================
// EDIT LOCK METHODS
// ==========================================

// Lock duration in milliseconds (5 minutes default)
const LOCK_DURATION_MS = 5 * 60 * 1000;

/**
 * Acquire edit lock on visit
 * @param {ObjectId} userId - User acquiring the lock
 * @param {number} durationMs - Lock duration in ms (default 5 minutes)
 * @returns {boolean} True if lock acquired
 */
visitSchema.methods.acquireLock = async function(userId, durationMs = LOCK_DURATION_MS) {
  const now = new Date();

  // Check if already locked by another user
  if (this.editLock?.lockedBy &&
      this.editLock.lockedBy.toString() !== userId.toString() &&
      this.editLock.lockExpires > now) {
    return false; // Lock held by another user
  }

  // Acquire or extend lock
  this.editLock = {
    lockedBy: userId,
    lockedAt: now,
    lockExpires: new Date(now.getTime() + durationMs)
  };

  await this.save();
  return true;
};

/**
 * Release edit lock
 * @param {ObjectId} userId - User releasing the lock
 * @returns {boolean} True if lock released
 */
visitSchema.methods.releaseLock = async function(userId) {
  // Only the lock holder can release
  if (this.editLock?.lockedBy &&
      this.editLock.lockedBy.toString() !== userId.toString()) {
    return false;
  }

  this.editLock = undefined;
  await this.save();
  return true;
};

/**
 * Check if visit is locked by another user
 * @param {ObjectId} userId - Current user
 * @returns {object|null} Lock info if locked by another user, null if not locked
 */
visitSchema.methods.isLockedByOther = function(userId) {
  if (!this.editLock?.lockedBy) {
    return null; // Not locked
  }

  const now = new Date();
  if (this.editLock.lockExpires <= now) {
    return null; // Lock expired
  }

  if (this.editLock.lockedBy.toString() === userId.toString()) {
    return null; // Locked by current user (allowed)
  }

  return {
    lockedBy: this.editLock.lockedBy,
    lockedAt: this.editLock.lockedAt,
    lockExpires: this.editLock.lockExpires
  };
};

/**
 * Extend existing lock
 * @param {ObjectId} userId - User extending the lock
 * @param {number} durationMs - Additional duration in ms
 * @returns {boolean} True if lock extended
 */
visitSchema.methods.extendLock = async function(userId, durationMs = LOCK_DURATION_MS) {
  // Only lock holder can extend
  if (!this.editLock?.lockedBy ||
      this.editLock.lockedBy.toString() !== userId.toString()) {
    return false;
  }

  this.editLock.lockExpires = new Date(Date.now() + durationMs);
  await this.save();
  return true;
};

/**
 * Static method to clear expired locks (cleanup job)
 */
visitSchema.statics.clearExpiredLocks = async function() {
  const now = new Date();
  const result = await this.updateMany(
    { 'editLock.lockExpires': { $lte: now } },
    { $unset: { editLock: 1 } }
  );
  return result.modifiedCount;
};

module.exports = mongoose.model('Visit', visitSchema);
