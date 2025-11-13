const mongoose = require('mongoose');

const ophthalmologyExamSchema = new mongoose.Schema({
  // Identification
  examId: {
    type: String,
    unique: true,
    required: true
  },

  // Patient and Provider
  patient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Patient',
    required: true
  },
  examiner: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  appointment: {
    type: mongoose.Schema.ObjectId,
    ref: 'Appointment'
  },

  // Exam Type
  examType: {
    type: String,
    enum: ['comprehensive', 'routine', 'refraction', 'follow-up', 'emergency', 'screening', 'pre-operative', 'post-operative'],
    required: true
  },

  // Chief Complaint
  chiefComplaint: {
    complaint: String,
    duration: String,
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe']
    },
    laterality: {
      type: String,
      enum: ['OD', 'OS', 'OU']
    }
  },

  // History
  history: {
    presentIllness: String,
    ocularHistory: [{
      condition: String,
      eye: {
        type: String,
        enum: ['OD', 'OS', 'OU']
      },
      date: Date,
      treatment: String,
      outcome: String
    }],
    medications: [{
      name: String,
      dosage: String,
      frequency: String,
      startDate: Date
    }],
    allergies: [{
      allergen: String,
      reaction: String
    }],
    familyHistory: [{
      relation: String,
      condition: String,
      age: Number
    }],
    socialHistory: {
      occupation: String,
      computerUse: {
        hoursPerDay: Number,
        symptoms: [String]
      },
      driving: {
        frequency: String,
        nightDifficulty: Boolean
      },
      smoking: {
        status: String,
        packsPerDay: Number,
        years: Number
      }
    }
  },

  // Visual Acuity
  visualAcuity: {
    distance: {
      OD: {
        uncorrected: String,
        corrected: String,
        pinhole: String
      },
      OS: {
        uncorrected: String,
        corrected: String,
        pinhole: String
      },
      OU: {
        uncorrected: String,
        corrected: String
      }
    },
    near: {
      OD: {
        uncorrected: String,
        corrected: String
      },
      OS: {
        uncorrected: String,
        corrected: String
      },
      OU: {
        uncorrected: String,
        corrected: String
      },
      testDistance: String // e.g., "40cm", "14 inches"
    },
    method: {
      type: String,
      enum: ['snellen', 'etdrs', 'logmar', 'decimal', 'metric']
    }
  },

  // Current Glasses/Contact Prescription
  currentCorrection: {
    glasses: {
      OD: {
        sphere: Number,
        cylinder: Number,
        axis: Number,
        add: Number,
        prism: String,
        va: String
      },
      OS: {
        sphere: Number,
        cylinder: Number,
        axis: Number,
        add: Number,
        prism: String,
        va: String
      },
      age: String, // How old are the glasses
      condition: String
    },
    contacts: {
      OD: {
        brand: String,
        power: Number,
        baseCurve: Number,
        diameter: Number,
        va: String
      },
      OS: {
        brand: String,
        power: Number,
        baseCurve: Number,
        diameter: Number,
        va: String
      },
      wearingSchedule: String,
      lastReplaced: Date,
      comfort: {
        type: String,
        enum: ['excellent', 'good', 'fair', 'poor']
      }
    }
  },

  // Refraction
  refraction: {
    objective: {
      autorefractor: {
        OD: {
          sphere: Number,
          cylinder: Number,
          axis: Number,
          confidence: Number
        },
        OS: {
          sphere: Number,
          cylinder: Number,
          axis: Number,
          confidence: Number
        }
      },
      retinoscopy: {
        OD: {
          sphere: Number,
          cylinder: Number,
          axis: Number
        },
        OS: {
          sphere: Number,
          cylinder: Number,
          axis: Number
        },
        workingDistance: Number,
        cycloplegic: Boolean
      }
    },
    subjective: {
      OD: {
        sphere: Number,
        cylinder: Number,
        axis: Number,
        va: String
      },
      OS: {
        sphere: Number,
        cylinder: Number,
        axis: Number,
        va: String
      },
      add: Number,
      vertexDistance: Number,
      balanceMethod: String
    },
    finalPrescription: {
      OD: {
        sphere: Number,
        cylinder: Number,
        axis: Number,
        add: Number,
        prism: String,
        base: String,
        va: String
      },
      OS: {
        sphere: Number,
        cylinder: Number,
        axis: Number,
        add: Number,
        prism: String,
        base: String,
        va: String
      },
      pd: {
        distance: Number,
        near: Number,
        monocular: {
          OD: Number,
          OS: Number
        }
      }
    }
  },

  // Keratometry
  keratometry: {
    OD: {
      k1: {
        power: Number,
        axis: Number
      },
      k2: {
        power: Number,
        axis: Number
      },
      average: Number,
      cylinder: Number,
      axis: Number
    },
    OS: {
      k1: {
        power: Number,
        axis: Number
      },
      k2: {
        power: Number,
        axis: Number
      },
      average: Number,
      cylinder: Number,
      axis: Number
    },
    method: String // manual, auto-k, topography
  },

  // Pupils
  pupils: {
    OD: {
      size: {
        photopic: Number,
        scotopic: Number
      },
      shape: {
        type: String,
        enum: ['round', 'irregular', 'oval']
      },
      reaction: {
        direct: {
          type: String,
          enum: ['brisk', 'sluggish', 'absent']
        },
        consensual: {
          type: String,
          enum: ['present', 'absent']
        }
      },
      apd: {
        type: String,
        enum: ['absent', 'present', 'trace']
      }
    },
    OS: {
      size: {
        photopic: Number,
        scotopic: Number
      },
      shape: {
        type: String,
        enum: ['round', 'irregular', 'oval']
      },
      reaction: {
        direct: {
          type: String,
          enum: ['brisk', 'sluggish', 'absent']
        },
        consensual: {
          type: String,
          enum: ['present', 'absent']
        }
      },
      apd: {
        type: String,
        enum: ['absent', 'present', 'trace']
      }
    }
  },

  // Extraocular Motility
  motility: {
    versions: {
      type: String,
      enum: ['full', 'restricted'],
      description: String
    },
    convergence: {
      nearPoint: Number, // cm
      amplitude: Number
    },
    npc: Number, // Near Point of Convergence in cm
    stereopsis: {
      test: String,
      result: String
    },
    coverTest: {
      distance: {
        uncover: String,
        alternating: String
      },
      near: {
        uncover: String,
        alternating: String
      }
    },
    nystagmus: {
      present: Boolean,
      type: String,
      direction: String
    }
  },

  // Confrontation Visual Fields
  visualFields: {
    OD: {
      method: String,
      result: {
        type: String,
        enum: ['full', 'restricted'],
        description: String
      },
      defects: [String]
    },
    OS: {
      method: String,
      result: {
        type: String,
        enum: ['full', 'restricted'],
        description: String
      },
      defects: [String]
    }
  },

  // Intraocular Pressure
  iop: {
    OD: {
      value: Number,
      time: String,
      method: {
        type: String,
        enum: ['goldmann', 'tonopen', 'icare', 'nct']
      }
    },
    OS: {
      value: Number,
      time: String,
      method: {
        type: String,
        enum: ['goldmann', 'tonopen', 'icare', 'nct']
      }
    },
    pachymetry: {
      OD: Number,
      OS: Number
    }
  },

  // Slit Lamp Examination
  slitLamp: {
    OD: {
      lids: {
        normal: Boolean,
        findings: String
      },
      lashes: {
        normal: Boolean,
        findings: String
      },
      conjunctiva: {
        normal: Boolean,
        findings: String
      },
      cornea: {
        normal: Boolean,
        findings: String,
        staining: String
      },
      anteriorChamber: {
        depth: {
          type: String,
          enum: ['deep', 'average', 'shallow']
        },
        clarity: {
          type: String,
          enum: ['clear', 'cells', 'flare']
        },
        vanHerick: String
      },
      iris: {
        normal: Boolean,
        findings: String
      },
      lens: {
        clarity: {
          type: String,
          enum: ['clear', 'trace', '1+', '2+', '3+', '4+']
        },
        type: String,
        findings: String
      },
      vitreous: {
        normal: Boolean,
        findings: String
      }
    },
    OS: {
      lids: {
        normal: Boolean,
        findings: String
      },
      lashes: {
        normal: Boolean,
        findings: String
      },
      conjunctiva: {
        normal: Boolean,
        findings: String
      },
      cornea: {
        normal: Boolean,
        findings: String,
        staining: String
      },
      anteriorChamber: {
        depth: {
          type: String,
          enum: ['deep', 'average', 'shallow']
        },
        clarity: {
          type: String,
          enum: ['clear', 'cells', 'flare']
        },
        vanHerick: String
      },
      iris: {
        normal: Boolean,
        findings: String
      },
      lens: {
        clarity: {
          type: String,
          enum: ['clear', 'trace', '1+', '2+', '3+', '4+']
        },
        type: String,
        findings: String
      },
      vitreous: {
        normal: Boolean,
        findings: String
      }
    }
  },

  // Fundus Examination
  fundus: {
    dilated: {
      type: Boolean,
      default: false
    },
    dilatingAgent: String,
    OD: {
      disc: {
        size: String,
        color: String,
        margins: String,
        cupToDisc: Number,
        notching: String
      },
      vessels: {
        arteries: String,
        veins: String,
        avRatio: String,
        crossing: String
      },
      macula: {
        normal: Boolean,
        findings: String,
        fovealReflex: String
      },
      periphery: {
        normal: Boolean,
        findings: String
      }
    },
    OS: {
      disc: {
        size: String,
        color: String,
        margins: String,
        cupToDisc: Number,
        notching: String
      },
      vessels: {
        arteries: String,
        veins: String,
        avRatio: String,
        crossing: String
      },
      macula: {
        normal: Boolean,
        findings: String,
        fovealReflex: String
      },
      periphery: {
        normal: Boolean,
        findings: String
      }
    }
  },

  // Additional Tests
  additionalTests: {
    colorVision: {
      test: String,
      OD: String,
      OS: String
    },
    amslerGrid: {
      OD: {
        normal: Boolean,
        findings: String
      },
      OS: {
        normal: Boolean,
        findings: String
      }
    },
    gonioscopy: {
      performed: Boolean,
      OD: String,
      OS: String
    },
    oct: {
      performed: Boolean,
      findings: String
    },
    visualField: {
      performed: Boolean,
      test: String,
      findings: String
    },
    fundusPhotography: {
      performed: Boolean,
      findings: String
    },
    cornealTopography: {
      performed: Boolean,
      findings: String
    }
  },

  // Assessment and Plan
  assessment: {
    diagnoses: [{
      eye: {
        type: String,
        enum: ['OD', 'OS', 'OU']
      },
      diagnosis: String,
      icdCode: String,
      severity: String,
      status: {
        type: String,
        enum: ['new', 'stable', 'worsening', 'improving', 'resolved']
      }
    }],
    summary: String
  },

  plan: {
    prescriptions: [{
      type: mongoose.Schema.ObjectId,
      ref: 'Prescription'
    }],
    procedures: [{
      name: String,
      eye: {
        type: String,
        enum: ['OD', 'OS', 'OU']
      },
      scheduled: Boolean,
      date: Date
    }],
    medications: [{
      name: String,
      dosage: String,
      frequency: String,
      duration: String,
      eye: {
        type: String,
        enum: ['OD', 'OS', 'OU']
      }
    }],
    followUp: {
      required: Boolean,
      timeframe: String,
      reason: String
    },
    referrals: [{
      to: String,
      specialty: String,
      reason: String,
      urgency: String
    }],
    education: [String],
    lifestyle: [String]
  },

  // Images and Attachments
  images: [{
    type: String, // fundus, oct, visual-field, etc.
    eye: {
      type: String,
      enum: ['OD', 'OS', 'OU']
    },
    url: String,
    caption: String,
    takenAt: Date
  }],

  // Notes
  notes: {
    clinical: String,
    technician: String,
    internal: String
  },

  // Billing
  billing: {
    cptCodes: [String],
    icdCodes: [String],
    modifiers: [String],
    level: String
  },

  // Status
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'reviewed', 'amended'],
    default: 'in-progress'
  },
  completedAt: Date,
  reviewedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,

  // Audit
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
ophthalmologyExamSchema.index({ patient: 1, createdAt: -1 });
ophthalmologyExamSchema.index({ examiner: 1, status: 1 });
ophthalmologyExamSchema.index({ examId: 1 });
ophthalmologyExamSchema.index({ appointment: 1 });

// Generate exam ID
ophthalmologyExamSchema.pre('save', async function(next) {
  if (!this.examId) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      }
    });
    this.examId = `EYE${year}${month}${day}${String(count + 1).padStart(4, '0')}`;
  }

  // Mark as completed when all sections are filled
  if (this.status === 'in-progress' && this.assessment.diagnoses.length > 0 && this.plan) {
    this.status = 'completed';
    this.completedAt = new Date();
  }

  next();
});

// Calculate spherical equivalent
ophthalmologyExamSchema.methods.calculateSphericalEquivalent = function(eye) {
  const refraction = this.refraction.finalPrescription[eye];
  if (!refraction) return null;
  return refraction.sphere + (refraction.cylinder / 2);
};

// Generate prescription from exam
ophthalmologyExamSchema.methods.generatePrescription = async function() {
  const Prescription = mongoose.model('Prescription');

  const prescription = new Prescription({
    patient: this.patient,
    prescriber: this.examiner,
    appointment: this.appointment,
    type: 'optical',
    optical: {
      prescriptionType: 'glasses',
      OD: this.refraction.finalPrescription.OD,
      OS: this.refraction.finalPrescription.OS,
      pd: this.refraction.finalPrescription.pd
    },
    diagnosis: this.assessment.diagnoses.map(d => ({
      code: d.icdCode,
      description: d.diagnosis
    }))
  });

  await prescription.save();
  this.plan.prescriptions.push(prescription._id);
  await this.save();

  return prescription;
};

module.exports = mongoose.model('OphthalmologyExam', ophthalmologyExamSchema);