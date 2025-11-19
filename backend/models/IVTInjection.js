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

}, {
  timestamps: true
});

// Indexes
ivtInjectionSchema.index({ patient: 1, injectionDate: -1 });
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

// Middleware
ivtInjectionSchema.pre('save', function(next) {
  // Auto-generate injectionId if not set
  if (!this.injectionId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.injectionId = `IVT${timestamp}${random}`;
  }

  // Calculate interval from last injection if previous injection exists
  if (this.series.previousInjection && this.injectionDate) {
    // This would need to be calculated from the actual previous injection date
    // Implementation would require fetching the previous injection
  }

  next();
});

module.exports = mongoose.model('IVTInjection', ivtInjectionSchema);
