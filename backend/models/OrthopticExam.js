const mongoose = require('mongoose');

const orthopticExamSchema = new mongoose.Schema({
  examId: {
    type: String,
    unique: true,
    required: true
  },

  // Patient and visit information
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },

  visit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Visit'
  },

  examiner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  examDate: {
    type: Date,
    required: true,
    default: Date.now
  },

  examType: {
    type: String,
    enum: ['initial', 'follow-up', 'pre-treatment', 'post-treatment', 'maintenance'],
    default: 'initial'
  },

  // Session information for treatment tracking
  sessionInfo: {
    sessionNumber: Number,
    totalSessions: Number,
    treatmentPlan: {
      type: String,
      enum: ['6_sessions', '12_sessions', '20_sessions', 'ongoing', 'custom']
    },
    previousExam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OrthopticExam'
    }
  },

  // VISUAL ACUITY
  visualAcuity: {
    distance: {
      OD: {
        withoutCorrection: String, // e.g., "5/10"
        withCorrection: String,
        scale: {
          type: String,
          enum: ['dixiemes', 'vingtiemes', 'decimal', 'logMAR', 'snellen']
        }
      },
      OS: {
        withoutCorrection: String,
        withCorrection: String,
        scale: {
          type: String,
          enum: ['dixiemes', 'vingtiemes', 'decimal', 'logMAR', 'snellen']
        }
      },
      OU: {
        withoutCorrection: String,
        withCorrection: String,
        scale: {
          type: String,
          enum: ['dixiemes', 'vingtiemes', 'decimal', 'logMAR', 'snellen']
        }
      }
    },
    near: {
      OD: {
        withoutCorrection: String, // Parinaud scale: "N° 1.5" to "N° 20"
        withCorrection: String,
        scale: {
          type: String,
          enum: ['parinaud', 'jaeger', 'point']
        }
      },
      OS: {
        withoutCorrection: String,
        withCorrection: String,
        scale: {
          type: String,
          enum: ['parinaud', 'jaeger', 'point']
        }
      },
      OU: {
        withoutCorrection: String,
        withCorrection: String,
        scale: {
          type: String,
          enum: ['parinaud', 'jaeger', 'point']
        }
      }
    },
    pediatric: {
      test: {
        type: String,
        enum: ['nombres', 'dessins_rossano', 'cadet', 'lea_symbols', 'allen_pictures']
      },
      OD: String,
      OS: String,
      notes: String
    }
  },

  // MOTILITY ASSESSMENT
  motility: {
    OD: {
      droitExterne: {
        type: String,
        enum: ['Normal', '++', '+++', 'Abaissement', 'Abduction', 'Adduction', 'Élévation',
               'Hyperaction', 'Limitation', 'Paralysie', 'Parésie', 'Sous action']
      },
      droitInterne: {
        type: String,
        enum: ['Normal', '++', '+++', 'Abaissement', 'Abduction', 'Adduction', 'Élévation',
               'Hyperaction', 'Limitation', 'Paralysie', 'Parésie', 'Sous action']
      },
      droitSuperieur: {
        type: String,
        enum: ['Normal', '++', '+++', 'Abaissement', 'Abduction', 'Adduction', 'Élévation',
               'Hyperaction', 'Limitation', 'Paralysie', 'Parésie', 'Sous action']
      },
      droitInferieur: {
        type: String,
        enum: ['Normal', '++', '+++', 'Abaissement', 'Abduction', 'Adduction', 'Élévation',
               'Hyperaction', 'Limitation', 'Paralysie', 'Parésie', 'Sous action']
      },
      grandOblique: {
        type: String,
        enum: ['Normal', '++', '+++', 'Abaissement', 'Abduction', 'Adduction', 'Élévation',
               'Hyperaction', 'Limitation', 'Paralysie', 'Parésie', 'Sous action']
      },
      petitOblique: {
        type: String,
        enum: ['Normal', '++', '+++', 'Abaissement', 'Abduction', 'Adduction', 'Élévation',
               'Hyperaction', 'Limitation', 'Paralysie', 'Parésie', 'Sous action']
      }
    },
    OS: {
      droitExterne: {
        type: String,
        enum: ['Normal', '++', '+++', 'Abaissement', 'Abduction', 'Adduction', 'Élévation',
               'Hyperaction', 'Limitation', 'Paralysie', 'Parésie', 'Sous action']
      },
      droitInterne: {
        type: String,
        enum: ['Normal', '++', '+++', 'Abaissement', 'Abduction', 'Adduction', 'Élévation',
               'Hyperaction', 'Limitation', 'Paralysie', 'Parésie', 'Sous action']
      },
      droitSuperieur: {
        type: String,
        enum: ['Normal', '++', '+++', 'Abaissement', 'Abduction', 'Adduction', 'Élévation',
               'Hyperaction', 'Limitation', 'Paralysie', 'Parésie', 'Sous action']
      },
      droitInferieur: {
        type: String,
        enum: ['Normal', '++', '+++', 'Abaissement', 'Abduction', 'Adduction', 'Élévation',
               'Hyperaction', 'Limitation', 'Paralysie', 'Parésie', 'Sous action']
      },
      grandOblique: {
        type: String,
        enum: ['Normal', '++', '+++', 'Abaissement', 'Abduction', 'Adduction', 'Élévation',
               'Hyperaction', 'Limitation', 'Paralysie', 'Parésie', 'Sous action']
      },
      petitOblique: {
        type: String,
        enum: ['Normal', '++', '+++', 'Abaissement', 'Abduction', 'Adduction', 'Élévation',
               'Hyperaction', 'Limitation', 'Paralysie', 'Parésie', 'Sous action']
      }
    },
    versions: String, // Free text for version testing
    ductions: String, // Free text for duction testing
    specialSyndromes: [{
      type: String,
      enum: ['Duane', 'Brown', 'Pattern A', 'Pattern V', 'Pattern X', 'DVD', 'Nystagmus']
    }],
    notes: String
  },

  // SYNOPTOPHORE TEST
  synoptophore: {
    objectiveAngle: {
      horizontal: Number, // in degrees
      vertical: Number,
      torsion: Number
    },
    subjectiveAngle: {
      horizontal: Number,
      vertical: Number
    },
    firstDegree: {
      // Superposition
      OD: String,
      OS: String,
      simultaneousPerception: Boolean,
      result: {
        type: String,
        enum: ['normal', 'suppression_OD', 'suppression_OS', 'alternating_suppression']
      }
    },
    secondDegree: {
      // Fusion
      fusionAmplitude: {
        convergence: Number, // in degrees
        divergence: Number
      },
      fusionQuality: {
        type: String,
        enum: ['good', 'medium', 'poor', 'absent']
      }
    },
    thirdDegree: {
      // Stereopsis/Relief
      present: Boolean,
      quality: {
        type: String,
        enum: ['excellent', 'good', 'fair', 'poor', 'absent']
      }
    },
    stability: {
      type: String,
      enum: ['stable', 'unstable', 'very_unstable']
    }
  },

  // STEREOPSIS TESTS
  stereopsis: {
    wirtTest: {
      fly: Boolean, // 3000 seconds of arc
      animals: {
        type: String,
        enum: ['all_correct', 'partial', 'none']
      },
      circles: String, // Best level: "40", "50", "60", "80", "100", "140", "200", "400", "800"
      secondsOfArc: Number
    },
    langTest: {
      chat: Boolean, // Cat
      etoile: Boolean, // Star
      voiture: Boolean, // Car
      level: String, // "550", "600", "1200"
      secondsOfArc: Number
    },
    tnoTest: {
      plates: Number, // Number of plates correctly identified
      stereopsis: {
        type: String,
        enum: ['excellent', 'good', 'fair', 'poor', 'absent']
      },
      dominance: {
        type: String,
        enum: ['OD', 'OS', 'none', 'alternating']
      }
    }
  },

  // WORTH 4-DOT TEST
  worthTest: {
    distance: {
      result: {
        type: String,
        enum: ['fusion', 'diplopie_croisee', 'diplopie_homonyme', 'neutralisation_OD',
               'neutralisation_OS', 'suppression_alternante']
      },
      description: String
    },
    near: {
      result: {
        type: String,
        enum: ['fusion', 'diplopie_croisee', 'diplopie_homonyme', 'neutralisation_OD',
               'neutralisation_OS', 'suppression_alternante']
      },
      description: String
    }
  },

  // RED GLASS TEST (Verre Rouge)
  redGlassTest: {
    distance: {
      horizontal: String, // Angle measurement
      vertical: String,
      torsion: String
    },
    near: {
      horizontal: String,
      vertical: String,
      torsion: String
    },
    notes: String
  },

  // BAGOLINI STRIATED GLASSES
  bagoliniTest: {
    withCorrection: {
      result: {
        type: String,
        enum: ['fusion', 'croisement', 'neutralisation_OD', 'neutralisation_OS']
      },
      description: String
    },
    withoutCorrection: {
      result: {
        type: String,
        enum: ['fusion', 'croisement', 'neutralisation_OD', 'neutralisation_OS']
      },
      description: String
    }
  },

  // POST-IMAGES BIELSCHOWSKI TEST
  postImagesTest: {
    retinalCorrespondence: {
      type: String,
      enum: ['CRN', 'CRA', 'CRA_harmonieuse', 'CRA_dysharmonieuse']
    },
    description: String,
    angle: Number
  },

  // PHYSIOLOGICAL DIPLOPIA
  physiologicalDiplopia: {
    present: Boolean,
    quality: {
      type: String,
      enum: ['normal', 'abnormal', 'absent']
    },
    notes: String
  },

  // COVER TEST (Test à l'écran)
  coverTest: {
    distance: {
      uncover: {
        type: String,
        enum: ['E', "E'", 'Et', 'HD', 'HG', 'X', "X'", 'Xt', 'Orthophorie']
      },
      alternating: {
        type: String,
        enum: ['E', "E'", 'Et', 'HD', 'HG', 'X', "X'", 'Xt', 'Orthophorie']
      },
      measurement: String, // Prism measurement
      notes: String
    },
    near: {
      uncover: {
        type: String,
        enum: ['E', "E'", 'Et', 'HD', 'HG', 'X', "X'", 'Xt', 'Orthophorie']
      },
      alternating: {
        type: String,
        enum: ['E', "E'", 'Et', 'HD', 'HG', 'X', "X'", 'Xt', 'Orthophorie']
      },
      measurement: String,
      notes: String
    }
  },

  // MADDOX ROD TEST
  maddoxTest: {
    horizontal: {
      E: Number, // Esophoria measurement
      Et: Number, // Esotropia measurement
      X: Number, // Exophoria measurement
      Xt: Number // Exotropia measurement
    },
    vertical: {
      HD: Number, // Right hyperphoria/hypertropia
      HG: Number // Left hyperphoria/hypertropia
    },
    notes: String
  },

  // NEAR POINT OF CONVERGENCE (PPC)
  nearPointConvergence: {
    break: Number, // Distance in cm where fusion breaks
    recovery: Number, // Distance in cm where fusion recovers
    ease: {
      type: String,
      enum: ['facile', 'moyen', 'difficile', 'impossible']
    },
    quality: {
      type: String,
      enum: ['bon', 'moyen', 'faible', 'nul']
    }
  },

  // CONVERGENCE REFLEX
  convergenceReflex: {
    quality: {
      type: String,
      enum: ['bon', 'moyen', 'faible', 'nul']
    },
    symmetry: Boolean,
    notes: String
  },

  // VERGENCES
  vergences: {
    convergence: {
      C: Number, // Base out prisms
      Cprime: Number // C'
    },
    divergence: {
      D: Number, // Base in prisms
      Dprime: Number // D'
    },
    vertical: {
      up: Number,
      down: Number
    },
    notes: String
  },

  // HESS-LANCASTER TEST
  hessLancaster: {
    chartData: String, // JSON or encoded chart data
    affectedMuscle: String,
    pattern: {
      type: String,
      enum: ['paresis', 'paralysis', 'restriction', 'normal']
    },
    interpretation: String,
    image: String // URL to chart image
  },

  // FUNCTIONAL SIGNS AND SYMPTOMS
  functionalSigns: {
    cephalees: Boolean, // Headaches
    diplopie: Boolean, // Diplopia
    fatigue: Boolean, // Fatigue
    brulures: Boolean, // Burning
    flou: Boolean, // Blurred vision
    photophobie: Boolean, // Photophobia
    douleurOculaire: Boolean, // Eye pain
    vertiges: Boolean, // Dizziness
    nausees: Boolean, // Nausea
    asthenopie: Boolean, // Eyestrain
    other: [String]
  },

  // ORTHOPTIC TREATMENT
  treatment: {
    prescribed: Boolean,
    type: {
      type: String,
      enum: ['reeducation_orthoptique', 'barre_lecture', 'diploscope', 'synoptophore',
             'exercices_domicile', 'prismes', 'occlusion', 'combined']
    },
    frequency: String, // e.g., "2 times per week"
    duration: String, // e.g., "12 weeks"
    exercises: [{
      name: String,
      description: String,
      frequency: String
    }],
    prisms: {
      prescribed: Boolean,
      OD: {
        horizontal: Number,
        vertical: Number,
        base: String // "in", "out", "up", "down"
      },
      OS: {
        horizontal: Number,
        vertical: Number,
        base: String
      }
    },
    occlusion: {
      prescribed: Boolean,
      eye: {
        type: String,
        enum: ['OD', 'OS', 'alternating']
      },
      duration: String, // e.g., "2 hours per day"
      schedule: String
    }
  },

  // PROGRESS TRACKING
  progress: {
    comparedToPrevious: {
      improvement: {
        type: String,
        enum: ['significant', 'moderate', 'slight', 'none', 'worse']
      },
      areas: [String], // e.g., ["fusion", "stereopsis", "motility"]
      notes: String
    },
    goalsMet: [{
      goal: String,
      achieved: Boolean,
      percentage: Number
    }]
  },

  // DIAGNOSIS AND CONCLUSIONS
  diagnosis: [{
    code: String, // ICD-10 code
    description: String,
    descriptionFr: String,
    eye: {
      type: String,
      enum: ['OD', 'OS', 'OU']
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe']
    }
  }],

  conclusion: {
    type: {
      type: String,
      enum: [
        'Phorie décompensée VL',
        'Phorie décompensée VP',
        'Phorie compensée',
        'Tropie',
        'Micro tropie',
        'Paralysie',
        'Parésie',
        'Insuffisance de convergence',
        'Excès de convergence',
        'Insuffisance de divergence',
        'Excès de divergence',
        'Custom'
      ]
    },
    customText: String,
    recommendations: [String],
    followUpRequired: Boolean,
    followUpTiming: String, // e.g., "6 weeks", "3 months"
    referralNeeded: Boolean,
    referralTo: String
  },

  // PROFESSIONAL CLOSING
  salutation: {
    type: String,
    enum: [
      'Veuillez agréer, Cher confrère, l\'expression de mes salutations distinguées',
      'Recevez, Cher confrère, mes salutations les meilleures',
      'Avec mes remerciements, recevez mes salutations confraternelles',
      'Custom'
    ]
  },
  customSalutation: String,

  // EXAM STATUS
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'reviewed', 'signed'],
    default: 'in-progress'
  },

  completedAt: Date,

  signedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  signedAt: Date,

  // ATTACHMENTS AND NOTES
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'chart', 'report', 'other']
    },
    url: String,
    description: String,
    uploadedAt: Date
  }],

  notes: String,

  internalNotes: String // Private notes not included in reports

}, {
  timestamps: true
});

// Indexes
orthopticExamSchema.index({ patient: 1, examDate: -1 });
orthopticExamSchema.index({ examiner: 1, examDate: -1 });
orthopticExamSchema.index({ visit: 1 });
orthopticExamSchema.index({ status: 1 });
orthopticExamSchema.index({ 'sessionInfo.sessionNumber': 1 });

// Virtual for exam summary
orthopticExamSchema.virtual('summary').get(function() {
  const parts = [];

  if (this.diagnosis && this.diagnosis.length > 0) {
    parts.push(this.diagnosis.map(d => d.descriptionFr || d.description).join(', '));
  }

  if (this.conclusion && this.conclusion.type) {
    parts.push(this.conclusion.type);
  }

  return parts.join(' - ');
});

// Methods
orthopticExamSchema.methods.completeExam = async function(userId) {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

orthopticExamSchema.methods.signExam = async function(userId) {
  this.status = 'signed';
  this.signedBy = userId;
  this.signedAt = new Date();
  return this.save();
};

orthopticExamSchema.methods.generateReport = function(language = 'fr') {
  // Generate a formatted report (to be implemented)
  const report = {
    patient: this.patient,
    examDate: this.examDate,
    examiner: this.examiner,
    visualAcuity: this.visualAcuity,
    motility: this.motility,
    tests: {
      synoptophore: this.synoptophore,
      stereopsis: this.stereopsis,
      worth: this.worthTest,
      coverTest: this.coverTest
    },
    diagnosis: this.diagnosis,
    conclusion: this.conclusion,
    treatment: this.treatment
  };

  return report;
};

orthopticExamSchema.methods.compareWithPrevious = async function() {
  if (!this.sessionInfo || !this.sessionInfo.previousExam) {
    return null;
  }

  const OrthopticExam = mongoose.model('OrthopticExam');
  const previous = await OrthopticExam.findById(this.sessionInfo.previousExam);

  if (!previous) {
    return null;
  }

  // Compare key metrics
  const comparison = {
    visualAcuity: {
      improved: this._compareVA(previous.visualAcuity, this.visualAcuity)
    },
    stereopsis: {
      improved: this._compareStereopsis(previous.stereopsis, this.stereopsis)
    },
    ppc: {
      improved: previous.nearPointConvergence?.break > this.nearPointConvergence?.break
    }
  };

  return comparison;
};

orthopticExamSchema.methods._compareVA = function(prev, curr) {
  // Simple comparison logic - to be enhanced
  return curr?.distance?.OU?.withCorrection > prev?.distance?.OU?.withCorrection;
};

orthopticExamSchema.methods._compareStereopsis = function(prev, curr) {
  // Simple comparison logic - to be enhanced
  return curr?.wirtTest?.secondsOfArc < prev?.wirtTest?.secondsOfArc;
};

// Static methods
orthopticExamSchema.statics.getPatientExams = async function(patientId, limit = 10) {
  return this.find({ patient: patientId })
    .sort({ examDate: -1 })
    .limit(limit)
    .populate('examiner', 'firstName lastName')
    .populate('visit');
};

orthopticExamSchema.statics.getTreatmentProgress = async function(patientId) {
  const exams = await this.find({ patient: patientId })
    .sort({ examDate: 1 })
    .select('examDate sessionInfo nearPointConvergence stereopsis visualAcuity');

  // Generate progress data
  return exams.map(exam => ({
    date: exam.examDate,
    session: exam.sessionInfo?.sessionNumber,
    ppc: exam.nearPointConvergence?.break,
    stereopsis: exam.stereopsis?.wirtTest?.secondsOfArc,
    va: exam.visualAcuity?.distance?.OU?.withCorrection
  }));
};

// Middleware
orthopticExamSchema.pre('save', function(next) {
  // Auto-generate examId if not set
  if (!this.examId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.examId = `ORTHO${timestamp}${random}`;
  }

  next();
});

module.exports = mongoose.model('OrthopticExam', orthopticExamSchema);
