const mongoose = require('mongoose');

const ivtInjectionSchema = new mongoose.Schema({
  injectionId: {
    type: String,
    unique: true,
    required: true
  },

  // Patient and visit information
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },

  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic is required for multi-tenant isolation'],
    index: true
  },

  visit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Visit'
  },

  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },

  // Eye being treated
  eye: {
    type: String,
    enum: ['OD', 'OS'],
    required: true
  },

  // Injection date and time
  injectionDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },

  // Physician who performed injection
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  assistedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // MEDICATION INFORMATION
  medication: {
    type: {
      type: String,
      enum: ['anti-VEGF', 'steroid', 'antibiotic', 'antifungal', 'other'],
      required: true
    },
    name: {
      type: String,
      required: true,
      enum: [
        'Avastin', 'Bevacizumab',           // Anti-VEGF
        'Lucentis', 'Ranibizumab',          // Anti-VEGF
        'Eylea', 'Aflibercept',             // Anti-VEGF
        'Beovu', 'Brolucizumab',            // Anti-VEGF
        'Vabysmo', 'Faricimab',             // Anti-VEGF dual
        'Kenacort', 'Triamcinolone',        // Steroid
        'Ozurdex', 'Dexamethasone implant', // Steroid implant
        'Iluvien', 'Fluocinolone implant',  // Steroid implant
        'Vancomycin',                        // Antibiotic
        'Ceftazidime',                       // Antibiotic
        'Amphotericin B',                    // Antifungal
        'Other'
      ]
    },
    genericName: String,
    dose: {
      value: Number,
      unit: {
        type: String,
        enum: ['mg', 'mcg', 'IU']
      }
    },
    volume: {
      value: Number,
      unit: {
        type: String,
        default: 'ml'
      }
    },
    lotNumber: String,
    expirationDate: Date,
    manufacturer: String,
    cost: {
      medication: Number,
      procedure: Number,
      total: Number,
      currency: {
        type: String,
        default: 'EUR'
      }
    }
  },

  // INDICATION AND DIAGNOSIS
  indication: {
    primary: {
      type: String,
      required: true,
      enum: [
        'wet_AMD',              // Wet age-related macular degeneration
        'dry_AMD',              // Dry AMD (rare for IVT)
        'DME',                  // Diabetic macular edema
        'PDR',                  // Proliferative diabetic retinopathy
        'BRVO',                 // Branch retinal vein occlusion
        'CRVO',                 // Central retinal vein occlusion
        'myopic_CNV',           // Myopic choroidal neovascularization
        'PCV',                  // Polypoidal choroidal vasculopathy
        'ROP',                  // Retinopathy of prematurity
        'neovascular_glaucoma', // Neovascular glaucoma
        'uveitis',              // Uveitis/inflammation
        'CME',                  // Cystoid macular edema
        'endophthalmitis',      // Endophthalmitis
        'other'
      ]
    },
    secondary: [String],
    icdCode: String,
    description: String,
    descriptionFr: String
  },

  // SERIES AND PROTOCOL TRACKING
  series: {
    // Which injection in the series
    injectionNumber: {
      type: Number,
      required: true,
      min: 1
    },

    // Treatment protocol
    protocol: {
      type: String,
      enum: [
        'loading',              // Loading phase (usually 3 monthly injections)
        'maintenance_monthly',  // Fixed monthly
        'maintenance_q6w',      // Every 6 weeks
        'maintenance_q8w',      // Every 8 weeks
        'maintenance_q12w',     // Every 12 weeks
        'PRN',                  // Pro re nata (as needed)
        'treat_and_extend',     // Treat and extend protocol
        'observe',              // Observation only
        'other'
      ],
      required: true
    },

    // Reference to first injection in series
    initialInjection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IVTInjection'
    },

    // Reference to previous injection
    previousInjection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IVTInjection'
    },

    // Total number of injections patient has received (this eye)
    totalInjectionsThisEye: Number,

    // Interval from last injection (in weeks)
    intervalFromLast: Number,

    // Protocol notes
    protocolNotes: String
  },

  // PRE-INJECTION ASSESSMENT
  preInjection: {
    visualAcuity: {
      distance: String,      // e.g., "6/10", "20/40"
      near: String,
      logMAR: Number,
      ETDRS: Number         // Early Treatment Diabetic Retinopathy Study letters
    },

    intraocularPressure: {
      value: Number,
      unit: {
        type: String,
        default: 'mmHg'
      },
      method: {
        type: String,
        enum: ['Goldmann', 'Tonopen', 'iCare', 'Perkins', 'NCT']
      }
    },

    oct: {
      centralMacularThickness: Number, // in microns
      subretinalFluid: Boolean,
      intraretinalFluid: Boolean,
      pigmentEpithelialDetachment: Boolean,
      notes: String,
      imageUrl: String
    },

    examination: {
      anteriorChamber: String,
      lens: String,
      vitreousActivity: String,
      retina: String,
      notes: String
    },

    patientSymptoms: [String]
  },

  // INJECTION PROCEDURE
  procedure: {
    anesthesia: {
      type: {
        type: String,
        enum: ['topical_drops', 'subconjunctival', 'gel', 'none'],
        default: 'topical_drops'
      },
      agent: String, // e.g., "Proparacaine", "Lidocaine gel"
      notes: String
    },

    antisepsis: {
      agent: String, // e.g., "Povidone-iodine 5%"
      duration: Number, // seconds
      notes: String
    },

    technique: {
      injectionSite: {
        type: String,
        enum: ['inferotemporal', 'superotemporal', 'superonasal', 'inferonasal'],
        default: 'inferotemporal'
      },
      distanceFromLimbus: {
        value: Number,
        unit: {
          type: String,
          default: 'mm'
        }
      },
      needleGauge: String,   // e.g., "30G"
      depth: String,          // e.g., "4mm"
      visualization: {
        type: String,
        enum: ['direct', 'indirect', 'speculum']
      }
    },

    // Immediate post-injection
    immediateAssessment: {
      reflux: Boolean,
      hemorrhage: Boolean,
      centralRetinalArteryPerfusion: Boolean,
      fingerCounting: Boolean,
      iop: Number,
      notes: String
    },

    complications: [{
      type: {
        type: String,
        enum: [
          'subconjunctival_hemorrhage',
          'vitreous_hemorrhage',
          'retinal_detachment',
          'endophthalmitis',
          'elevated_iop',
          'ocular_pain',
          'reduced_vision',
          'retinal_tear',
          'cataract',
          'uveitis',
          'none',
          'other'
        ]
      },
      severity: {
        type: String,
        enum: ['mild', 'moderate', 'severe']
      },
      description: String,
      treatment: String,
      resolved: Boolean
    }],

    procedureNotes: String
  },

  // POST-INJECTION INSTRUCTIONS
  postInjectionInstructions: {
    antibioticDrops: {
      prescribed: Boolean,
      medication: String,
      frequency: String,
      duration: String
    },

    antiInflammatoryDrops: {
      prescribed: Boolean,
      medication: String,
      frequency: String,
      duration: String
    },

    restrictions: [String],  // e.g., ["No swimming for 1 week", "Avoid rubbing eye"]

    warningSigns: [String],  // When to seek immediate care

    followUpTiming: String,

    customInstructions: String
  },

  // FOLLOW-UP ASSESSMENT
  followUp: {
    scheduled: Boolean,
    scheduledDate: Date,
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    },

    // Follow-up visit data (completed after follow-up)
    completed: Boolean,
    completedDate: Date,

    visualAcuity: {
      distance: String,
      logMAR: Number,
      ETDRS: Number,
      changeFromBaseline: Number  // Letter change
    },

    intraocularPressure: {
      value: Number,
      unit: String
    },

    oct: {
      centralMacularThickness: Number,
      changeFromBaseline: Number,  // microns change
      dryMacula: Boolean,
      notes: String
    },

    outcome: {
      type: String,
      enum: [
        'improved',
        'stable',
        'worse',
        'resolved',
        'partial_response',
        'no_response'
      ]
    },

    complications: [String],
    notes: String
  },

  // NEXT INJECTION PLANNING
  nextInjection: {
    recommended: Boolean,
    recommendedDate: Date,
    recommendedInterval: Number,  // weeks
    reasoning: String,

    // For treat-and-extend protocol
    extendInterval: Boolean,
    shortenInterval: Boolean,

    // If switching medications
    switchMedication: Boolean,
    newMedication: String,
    switchReason: String
  },

  // TREATMENT RESPONSE TRACKING
  response: {
    anatomic: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor', 'none']
    },
    functional: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor', 'none']
    },
    durability: {
      type: String,
      enum: ['sustained', 'diminishing', 'transient', 'none']
    },
    notes: String
  },

  // INSURANCE AND BILLING
  billing: {
    cptCode: {
      type: String,
      default: '67028'  // Intravitreal injection CPT code
    },
    icdCodes: [String],

    priorAuthorizationRequired: Boolean,
    priorAuthorizationNumber: String,
    priorAuthorizationDate: Date,

    insuranceCoverage: {
      approved: Boolean,
      copay: Number,
      patientResponsibility: Number,
      insurancePayment: Number
    },

    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice'
    }
  },

  // CONSENT AND DOCUMENTATION
  consent: {
    obtained: Boolean,
    obtainedDate: Date,
    obtainedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    formVersion: String,
    signedDocument: String,  // URL to signed consent form
    risksExplained: [String],
    benefitsExplained: [String],
    alternativesDiscussed: [String]
  },

  // STATUS AND METADATA
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'adverse-event'],
    default: 'scheduled'
  },

  completedAt: Date,

  cancelledAt: Date,
  cancellationReason: String,

  // ATTACHMENTS
  attachments: [{
    type: {
      type: String,
      enum: ['oct', 'angiography', 'fundus_photo', 'consent', 'report', 'other']
    },
    url: String,
    description: String,
    uploadedAt: Date,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // NOTES
  clinicalNotes: String,

  internalNotes: String,  // Private notes

  // QUALITY METRICS
  qualityMetrics: {
    consentDocumented: Boolean,
    preIopRecorded: Boolean,
    postIopRecorded: Boolean,
    complicationsDocumented: Boolean,
    followUpScheduled: Boolean,
    patientInstructionsGiven: Boolean
  }
,

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

// Indexes
ivtInjectionSchema.index({ patient: 1, injectionDate: -1 });
ivtInjectionSchema.index({ clinic: 1, status: 1, injectionDate: -1 });
ivtInjectionSchema.index({ clinic: 1, patient: 1, injectionDate: -1 });
ivtInjectionSchema.index({ patient: 1, eye: 1, injectionDate: -1 });
ivtInjectionSchema.index({ performedBy: 1, injectionDate: -1 });
ivtInjectionSchema.index({ 'indication.primary': 1 });
ivtInjectionSchema.index({ status: 1, injectionDate: -1 });
ivtInjectionSchema.index({ 'series.protocol': 1 });
ivtInjectionSchema.index({ 'nextInjection.recommendedDate': 1 });

// Virtual for days since injection
ivtInjectionSchema.virtual('daysSinceInjection').get(function() {
  const now = new Date();
  const diff = now - this.injectionDate;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// Virtual for weeks since injection
ivtInjectionSchema.virtual('weeksSinceInjection').get(function() {
  return Math.floor(this.daysSinceInjection / 7);
});

// Methods
ivtInjectionSchema.methods.completeInjection = async function(userId) {
  this.status = 'completed';
  this.completedAt = new Date();

  // Update quality metrics
  this.qualityMetrics = {
    consentDocumented: !!this.consent.obtained,
    preIopRecorded: !!this.preInjection.intraocularPressure?.value,
    postIopRecorded: !!this.procedure.immediateAssessment?.iop,
    complicationsDocumented: this.procedure.complications && this.procedure.complications.length > 0,
    followUpScheduled: !!this.followUp.scheduled,
    patientInstructionsGiven: !!this.postInjectionInstructions
  };

  return this.save();
};

ivtInjectionSchema.methods.scheduleFollowUp = async function(date, appointmentId) {
  this.followUp.scheduled = true;
  this.followUp.scheduledDate = date;
  if (appointmentId) {
    this.followUp.appointmentId = appointmentId;
  }
  return this.save();
};

ivtInjectionSchema.methods.recordFollowUp = async function(followUpData) {
  this.followUp = {
    ...this.followUp,
    ...followUpData,
    completed: true,
    completedDate: new Date()
  };

  // Calculate changes from baseline
  if (followUpData.visualAcuity && this.preInjection.visualAcuity) {
    this.followUp.visualAcuity.changeFromBaseline =
      (followUpData.visualAcuity.ETDRS || 0) - (this.preInjection.visualAcuity.ETDRS || 0);
  }

  if (followUpData.oct && this.preInjection.oct) {
    this.followUp.oct.changeFromBaseline =
      (this.preInjection.oct.centralMacularThickness || 0) - (followUpData.oct.centralMacularThickness || 0);
  }

  return this.save();
};

ivtInjectionSchema.methods.planNextInjection = async function(planData) {
  this.nextInjection = {
    ...this.nextInjection,
    ...planData
  };
  return this.save();
};

ivtInjectionSchema.methods.cancelInjection = async function(reason) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  return this.save();
};

ivtInjectionSchema.methods.getTreatmentSummary = function() {
  return {
    injectionId: this.injectionId,
    date: this.injectionDate,
    eye: this.eye,
    medication: this.medication.name,
    dose: `${this.medication.dose.value}${this.medication.dose.unit}`,
    indication: this.indication.primary,
    injectionNumber: this.series.injectionNumber,
    protocol: this.series.protocol,
    preVA: this.preInjection.visualAcuity?.ETDRS,
    preCMT: this.preInjection.oct?.centralMacularThickness,
    followUpVA: this.followUp.visualAcuity?.ETDRS,
    followUpCMT: this.followUp.oct?.centralMacularThickness,
    response: this.response.anatomic,
    complications: this.procedure.complications.filter(c => c.type !== 'none').map(c => c.type)
  };
};

// Static methods
ivtInjectionSchema.statics.getPatientInjections = async function(patientId, eye = null) {
  const query = { patient: patientId };
  if (eye) query.eye = eye;

  return this.find(query)
    .sort({ injectionDate: -1 })
    .populate('performedBy', 'firstName lastName')
    .populate('visit')
    .populate('series.previousInjection', 'injectionDate medication.name');
};

ivtInjectionSchema.statics.getTreatmentHistory = async function(patientId, eye) {
  const injections = await this.find({
    patient: patientId,
    eye,
    status: 'completed'
  })
    .sort({ injectionDate: 1 })
    .select('injectionDate medication series preInjection followUp response');

  return injections.map(inj => ({
    date: inj.injectionDate,
    number: inj.series.injectionNumber,
    medication: inj.medication.name,
    dose: inj.medication.dose,
    va: {
      pre: inj.preInjection.visualAcuity?.ETDRS,
      post: inj.followUp.visualAcuity?.ETDRS,
      change: inj.followUp.visualAcuity?.changeFromBaseline
    },
    cmt: {
      pre: inj.preInjection.oct?.centralMacularThickness,
      post: inj.followUp.oct?.centralMacularThickness,
      change: inj.followUp.oct?.changeFromBaseline
    },
    response: inj.response
  }));
};

ivtInjectionSchema.statics.getUpcomingInjections = async function(days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return this.find({
    'nextInjection.recommended': true,
    'nextInjection.recommendedDate': {
      $gte: new Date(),
      $lte: futureDate
    },
    status: { $ne: 'cancelled' }
  })
    .populate('patient', 'firstName lastName patientId phoneNumber')
    .sort({ 'nextInjection.recommendedDate': 1 });
};

ivtInjectionSchema.statics.getStatsByIndication = async function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        injectionDate: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$indication.primary',
        count: { $sum: 1 },
        medications: { $addToSet: '$medication.name' },
        avgPreVA: { $avg: '$preInjection.visualAcuity.ETDRS' },
        avgPostVA: { $avg: '$followUp.visualAcuity.ETDRS' },
        avgPreCMT: { $avg: '$preInjection.oct.centralMacularThickness' },
        avgPostCMT: { $avg: '$followUp.oct.centralMacularThickness' },
        complications: { $sum: { $size: { $filter: { input: '$procedure.complications', cond: { $ne: ['$$this.type', 'none'] } } } } }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

ivtInjectionSchema.statics.getPatientDueForInjection = async function() {
  const today = new Date();

  return this.find({
    'nextInjection.recommended': true,
    'nextInjection.recommendedDate': { $lte: today },
    status: 'completed'
  })
    .populate('patient', 'firstName lastName patientId phoneNumber email')
    .select('patient eye indication medication nextInjection injectionDate')
    .sort({ 'nextInjection.recommendedDate': 1 });
};

// ========== IVT SERIES VALIDATION RULES ==========
// Minimum intervals (in days) for each medication
const MEDICATION_MIN_INTERVALS = {
  // Anti-VEGF medications
  'Avastin': 21,           // Minimum 3 weeks (typically 4 weeks)
  'Bevacizumab': 21,
  'Lucentis': 21,          // Minimum 3 weeks (typically 4 weeks)
  'Ranibizumab': 21,
  'Eylea': 28,             // Minimum 4 weeks
  'Aflibercept': 28,
  'Beovu': 28,             // Minimum 4 weeks (8 weeks after loading)
  'Brolucizumab': 28,
  'Vabysmo': 28,           // Minimum 4 weeks
  'Faricimab': 28,

  // Steroid implants - much longer intervals
  'Ozurdex': 90,           // Minimum 3 months (implant)
  'Dexamethasone implant': 90,
  'Iluvien': 365,          // Minimum 12 months (36-month implant)
  'Fluocinolone implant': 365,

  // Other steroids
  'Kenacort': 90,
  'Triamcinolone': 90,

  // Antibiotics (for endophthalmitis - may need repeat)
  'Vancomycin': 2,
  'Ceftazidime': 2,
  'Amphotericin B': 2,

  // Default for unknown
  'Other': 21
};

// Maximum injections per protocol phase
const PROTOCOL_MAX_INJECTIONS = {
  'loading': 3,                    // Loading phase: typically 3 monthly
  'maintenance_monthly': 12,       // 1 year of monthly
  'maintenance_q6w': 9,            // ~1 year at 6-week intervals
  'maintenance_q8w': 7,            // ~1 year at 8-week intervals
  'maintenance_q12w': 5,           // ~1 year at 12-week intervals
  'PRN': 24,                       // 2 years limit for PRN
  'treat_and_extend': 24,          // 2 years limit
  'observe': 0,                    // No injections in observe phase
  'other': 24
};

// Expected intervals (in weeks) for protocols
const PROTOCOL_EXPECTED_INTERVALS = {
  'loading': { min: 3, max: 6 },           // 3-6 weeks during loading
  'maintenance_monthly': { min: 3, max: 6 },
  'maintenance_q6w': { min: 5, max: 8 },
  'maintenance_q8w': { min: 7, max: 10 },
  'maintenance_q12w': { min: 10, max: 14 },
  'PRN': { min: 3, max: 52 },              // Flexible
  'treat_and_extend': { min: 4, max: 16 },
  'observe': null,
  'other': { min: 3, max: 52 }
};

// Static method to validate a new injection
ivtInjectionSchema.statics.validateNewInjection = async function(injectionData, patientId, eye) {
  const warnings = [];
  const errors = [];

  // Get previous injections for this patient and eye
  const previousInjections = await this.find({
    patient: patientId,
    eye: eye,
    status: { $in: ['completed', 'scheduled'] }
  }).sort({ injectionDate: -1 }).limit(10);

  if (previousInjections.length === 0) {
    // First injection - no validation needed
    return { valid: true, warnings, errors };
  }

  const lastInjection = previousInjections[0];
  const lastDate = new Date(lastInjection.injectionDate);
  const newDate = new Date(injectionData.injectionDate || new Date());
  const daysSinceLast = Math.floor((newDate - lastDate) / (1000 * 60 * 60 * 24));

  const medicationName = injectionData.medication?.name || 'Other';
  const minInterval = MEDICATION_MIN_INTERVALS[medicationName] || 21;

  // Rule 1: Check minimum interval
  if (daysSinceLast < minInterval) {
    errors.push({
      code: 'MIN_INTERVAL_VIOLATION',
      message: `Minimum interval for ${medicationName} is ${minInterval} days. Last injection was ${daysSinceLast} days ago.`,
      severity: 'error',
      details: {
        lastInjectionDate: lastDate,
        daysSinceLast,
        minimumDays: minInterval,
        medication: medicationName
      }
    });
  }

  // Rule 2: Check protocol consistency (medication switch warning)
  if (lastInjection.medication?.name && medicationName !== 'Other') {
    const lastMed = lastInjection.medication.name;
    if (lastMed !== medicationName) {
      // Check if it's a valid switch or an accidental one
      const isSameClass = areSameDrugClass(lastMed, medicationName);
      if (isSameClass) {
        warnings.push({
          code: 'MEDICATION_SWITCH',
          message: `Switching from ${lastMed} to ${medicationName}. Ensure this is intentional and document the reason.`,
          severity: 'warning',
          requiresConfirmation: true
        });
      } else {
        warnings.push({
          code: 'MEDICATION_CLASS_SWITCH',
          message: `Switching drug class from ${lastMed} to ${medicationName}. This may affect treatment efficacy.`,
          severity: 'warning',
          requiresConfirmation: true
        });
      }
    }
  }

  // Rule 3: Check protocol phase limits
  const protocol = injectionData.series?.protocol || lastInjection.series?.protocol || 'other';
  const maxInjections = PROTOCOL_MAX_INJECTIONS[protocol] || 24;

  // Count injections in current protocol phase
  const injectionsInPhase = previousInjections.filter(inj =>
    inj.series?.protocol === protocol && inj.status === 'completed'
  ).length;

  if (injectionsInPhase >= maxInjections) {
    warnings.push({
      code: 'PROTOCOL_LIMIT_REACHED',
      message: `${protocol} protocol typically has ${maxInjections} injections. Consider transitioning to next phase.`,
      severity: 'warning'
    });
  }

  // Rule 4: Check for loading phase completion
  if (protocol === 'loading') {
    const loadingCount = previousInjections.filter(inj =>
      inj.series?.protocol === 'loading' && inj.status === 'completed'
    ).length;

    if (loadingCount >= 3) {
      warnings.push({
        code: 'LOADING_PHASE_COMPLETE',
        message: 'Loading phase (3 injections) is complete. Consider transitioning to maintenance protocol.',
        severity: 'info'
      });
    }
  }

  // Rule 5: Check treat-and-extend protocol intervals
  if (protocol === 'treat_and_extend') {
    const expectedInterval = PROTOCOL_EXPECTED_INTERVALS['treat_and_extend'];
    const weeksSinceLast = daysSinceLast / 7;

    if (weeksSinceLast < expectedInterval.min) {
      warnings.push({
        code: 'TAE_INTERVAL_TOO_SHORT',
        message: `Treat-and-extend interval is shorter than expected (${weeksSinceLast.toFixed(1)} weeks). Consider extending if macula is dry.`,
        severity: 'warning'
      });
    } else if (weeksSinceLast > expectedInterval.max) {
      warnings.push({
        code: 'TAE_INTERVAL_TOO_LONG',
        message: `Treat-and-extend interval is longer than expected (${weeksSinceLast.toFixed(1)} weeks). Check for disease activity.`,
        severity: 'warning'
      });
    }
  }

  // Rule 6: Check for missed follow-up from last injection
  if (lastInjection.followUp?.scheduled && !lastInjection.followUp?.completed) {
    const scheduledFollow = new Date(lastInjection.followUp.scheduledDate);
    if (scheduledFollow < newDate) {
      warnings.push({
        code: 'MISSED_FOLLOWUP',
        message: 'Previous injection follow-up was not completed. Ensure pre-injection assessment is thorough.',
        severity: 'warning'
      });
    }
  }

  // Rule 7: Check bilateral treatment (both eyes same day)
  if (injectionData.eye) {
    const otherEye = injectionData.eye === 'OD' ? 'OS' : 'OD';
    const sameDayOtherEye = await this.findOne({
      patient: patientId,
      eye: otherEye,
      injectionDate: {
        $gte: new Date(newDate.setHours(0, 0, 0, 0)),
        $lte: new Date(newDate.setHours(23, 59, 59, 999))
      },
      status: { $in: ['completed', 'scheduled'] }
    });

    if (sameDayOtherEye) {
      warnings.push({
        code: 'BILATERAL_SAME_DAY',
        message: 'Bilateral IVT on the same day. Ensure different lot numbers are used for each eye.',
        severity: 'info'
      });
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors
  };
};

// Helper function to check if medications are in the same class
function areSameDrugClass(drug1, drug2) {
  const antiVEGF = ['Avastin', 'Bevacizumab', 'Lucentis', 'Ranibizumab', 'Eylea', 'Aflibercept', 'Beovu', 'Brolucizumab', 'Vabysmo', 'Faricimab'];
  const steroids = ['Kenacort', 'Triamcinolone', 'Ozurdex', 'Dexamethasone implant', 'Iluvien', 'Fluocinolone implant'];
  const antibiotics = ['Vancomycin', 'Ceftazidime'];
  const antifungals = ['Amphotericin B'];

  const classes = [antiVEGF, steroids, antibiotics, antifungals];

  for (const drugClass of classes) {
    if (drugClass.includes(drug1) && drugClass.includes(drug2)) {
      return true;
    }
  }
  return false;
}

// Middleware
ivtInjectionSchema.pre('save', async function(next) {
  // Auto-generate injectionId if not set
  if (!this.injectionId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.injectionId = `IVT${timestamp}${random}`;
  }

  // Skip validation for cancellation or updates to completed injections
  if (this.status === 'cancelled' || (!this.isNew && this.status === 'completed')) {
    return next();
  }

  // Validate new injections (only on create or when scheduling)
  if (this.isNew || this.isModified('injectionDate') || this.isModified('medication')) {
    try {
      const validation = await this.constructor.validateNewInjection(
        {
          injectionDate: this.injectionDate,
          medication: this.medication,
          series: this.series,
          eye: this.eye
        },
        this.patient,
        this.eye
      );

      // Store validation warnings on the document for frontend display
      this._validationWarnings = validation.warnings;

      // Block save if there are errors (unless force flag is set)
      if (!validation.valid && !this._forceCreate) {
        const error = new Error(validation.errors[0]?.message || 'IVT validation failed');
        error.name = 'IVTValidationError';
        error.code = validation.errors[0]?.code;
        error.validationErrors = validation.errors;
        error.validationWarnings = validation.warnings;
        return next(error);
      }
    } catch (err) {
      console.error('IVT validation error:', err);
      // Don't block save on validation system errors, just log
    }
  }

  // Calculate interval from last injection
  if (this.series?.previousInjection && this.injectionDate) {
    try {
      const prevInjection = await this.constructor.findById(this.series.previousInjection);
      if (prevInjection) {
        const daysDiff = Math.floor((this.injectionDate - prevInjection.injectionDate) / (1000 * 60 * 60 * 24));
        this.series.intervalFromLast = Math.round(daysDiff / 7);
      }
    } catch (err) {
      console.error('Error calculating interval:', err);
    }
  }

  next();
});

module.exports = mongoose.model('IVTInjection', ivtInjectionSchema);
