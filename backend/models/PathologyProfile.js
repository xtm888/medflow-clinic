const mongoose = require('mongoose');

const pathologyProfileSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    unique: true
  },

  // Active medical conditions
  activeConditions: [{
    conditionId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    condition: {
      type: String,
      required: true
    },
    icdCode: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ['cardiovascular', 'endocrine', 'respiratory', 'neurological', 'musculoskeletal',
              'gastrointestinal', 'genitourinary', 'hematologic', 'psychiatric', 'ophthalmologic',
              'dermatologic', 'immunologic', 'oncologic', 'infectious', 'genetic', 'other']
    },
    onset: {
      type: Date,
      required: true
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe', 'critical'],
      default: 'mild'
    },
    status: {
      type: String,
      enum: ['active', 'resolved', 'chronic', 'in-remission', 'controlled', 'uncontrolled'],
      default: 'active'
    },
    laterality: {
      type: String,
      enum: ['bilateral', 'right', 'left', 'NA'],
      default: 'NA'
    },

    // Disease progression tracking
    progression: [{
      date: {
        type: Date,
        default: Date.now
      },
      assessment: String,
      severity: {
        type: String,
        enum: ['improving', 'stable', 'worsening', 'resolved']
      },
      metrics: {
        // Disease-specific metrics (e.g., HbA1c for diabetes, CD4 count for HIV)
        type: Map,
        of: mongoose.Schema.Types.Mixed
      },
      notes: String,
      assessedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }],

    // Complications
    complications: [{
      complication: String,
      dateIdentified: Date,
      severity: String,
      status: String
    }],

    // Related conditions
    relatedConditions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PathologyProfile.activeConditions'
    }],

    // Treatment response
    treatments: [{
      treatment: String,
      startDate: Date,
      endDate: Date,
      response: {
        type: String,
        enum: ['excellent', 'good', 'partial', 'poor', 'no-response', 'adverse']
      },
      notes: String
    }],

    // Clinical indicators
    clinicalIndicators: {
      labValues: [{
        test: String,
        value: String,
        unit: String,
        date: Date,
        abnormal: Boolean
      }],
      imagingFindings: [{
        study: String,
        findings: String,
        date: Date
      }],
      symptoms: [{
        symptom: String,
        severity: Number, // 1-10 scale
        frequency: String,
        lastReported: Date
      }]
    },

    // Management plan
    managementPlan: {
      currentTreatment: [String],
      medications: [{
        name: String,
        dosage: String,
        frequency: String
      }],
      lifestyle: [String],
      monitoring: {
        frequency: String,
        nextReview: Date,
        testsRequired: [String]
      }
    }
  }],

  // Systemic conditions grouped by body system
  systemicConditions: {
    cardiovascular: {
      hypertension: {
        present: Boolean,
        controlled: Boolean,
        readings: [{
          systolic: Number,
          diastolic: Number,
          date: Date
        }],
        medications: [String]
      },
      coronaryArteryDisease: {
        present: Boolean,
        stents: Number,
        bypassSurgery: Boolean,
        lastCardiacEvent: Date
      },
      arrhythmia: {
        present: Boolean,
        type: String,
        pacemaker: Boolean
      },
      heartFailure: {
        present: Boolean,
        ejectionFraction: Number,
        nyhaClass: Number
      }
    },

    endocrine: {
      diabetes: {
        present: Boolean,
        type: {
          type: String,
          enum: ['type1', 'type2', 'gestational', 'other']
        },
        diagnosisDate: Date,
        hba1c: [{
          value: Number,
          date: Date
        }],
        complications: {
          retinopathy: Boolean,
          nephropathy: Boolean,
          neuropathy: Boolean,
          footUlcers: Boolean
        },
        management: {
          insulin: Boolean,
          oralMedications: [String],
          diet: Boolean,
          exercise: Boolean
        }
      },
      thyroid: {
        disorder: String,
        tsh: [{
          value: Number,
          date: Date
        }],
        medication: String
      },
      metabolicSyndrome: {
        present: Boolean,
        components: [String]
      }
    },

    respiratory: {
      asthma: {
        present: Boolean,
        severity: String,
        triggers: [String],
        controller: String,
        rescueInhaler: String,
        lastExacerbation: Date
      },
      copd: {
        present: Boolean,
        goldStage: String,
        fev1: Number,
        oxygenTherapy: Boolean,
        smokingHistory: {
          current: Boolean,
          packYears: Number,
          quitDate: Date
        }
      },
      sleepApnea: {
        present: Boolean,
        ahi: Number,
        cpap: Boolean,
        compliance: String
      }
    },

    neurological: {
      migraines: {
        present: Boolean,
        frequency: String,
        triggers: [String],
        prophylaxis: String
      },
      seizures: {
        present: Boolean,
        type: String,
        lastSeizure: Date,
        medications: [String]
      },
      neuropathy: {
        present: Boolean,
        type: String,
        distribution: String,
        etiology: String
      },
      dementia: {
        present: Boolean,
        type: String,
        stage: String,
        mmse: Number
      }
    },

    musculoskeletal: {
      arthritis: {
        present: Boolean,
        type: String,
        joints: [String],
        treatments: [String]
      },
      osteoporosis: {
        present: Boolean,
        tScore: Number,
        fractures: [String],
        medications: [String]
      },
      chronicPain: {
        present: Boolean,
        location: [String],
        severity: Number,
        management: [String]
      }
    },

    psychiatric: {
      depression: {
        present: Boolean,
        severity: String,
        phq9: Number,
        treatments: [String]
      },
      anxiety: {
        present: Boolean,
        type: String,
        gad7: Number,
        treatments: [String]
      },
      bipolar: {
        present: Boolean,
        type: String,
        moodStabilizers: [String]
      },
      substanceUse: {
        present: Boolean,
        substances: [String],
        inRecovery: Boolean,
        lastUse: Date
      }
    }
  },

  // Ocular-specific conditions
  ocularConditions: {
    glaucoma: {
      present: Boolean,
      type: {
        type: String,
        enum: ['open-angle', 'angle-closure', 'normal-tension', 'secondary', 'congenital']
      },
      laterality: {
        type: String,
        enum: ['OD', 'OS', 'OU']
      },
      iop: {
        OD: [{
          value: Number,
          date: Date,
          time: String
        }],
        OS: [{
          value: Number,
          date: Date,
          time: String
        }]
      },
      targetIOP: {
        OD: Number,
        OS: Number
      },
      medications: [{
        name: String,
        eye: String,
        frequency: String
      }],
      procedures: [{
        procedure: String,
        eye: String,
        date: Date
      }],
      visualField: {
        OD: {
          md: Number,
          psd: Number,
          vfi: Number,
          date: Date
        },
        OS: {
          md: Number,
          psd: Number,
          vfi: Number,
          date: Date
        }
      },
      oct: {
        rnfl: {
          OD: Number,
          OS: Number
        },
        gccThickness: {
          OD: Number,
          OS: Number
        },
        lastExam: Date
      }
    },

    diabeticRetinopathy: {
      present: Boolean,
      stage: {
        OD: {
          type: String,
          enum: ['none', 'mild-npdr', 'moderate-npdr', 'severe-npdr', 'pdr']
        },
        OS: {
          type: String,
          enum: ['none', 'mild-npdr', 'moderate-npdr', 'severe-npdr', 'pdr']
        }
      },
      maculopathy: {
        OD: Boolean,
        OS: Boolean
      },
      treatments: [{
        treatment: String,
        eye: String,
        date: Date
      }],
      lastFundusPhoto: Date,
      lastFA: Date,
      nextScreening: Date
    },

    macularDegeneration: {
      present: Boolean,
      type: {
        type: String,
        enum: ['dry', 'wet', 'mixed']
      },
      laterality: {
        type: String,
        enum: ['OD', 'OS', 'OU']
      },
      areds: Boolean,
      injections: [{
        medication: String,
        eye: String,
        date: Date,
        number: Number
      }],
      visualAcuity: {
        OD: String,
        OS: String
      },
      amslerGrid: {
        OD: String,
        OS: String,
        lastChecked: Date
      }
    },

    cataracts: {
      present: Boolean,
      laterality: {
        type: String,
        enum: ['OD', 'OS', 'OU']
      },
      type: {
        OD: String,
        OS: String
      },
      grade: {
        OD: String,
        OS: String
      },
      surgery: [{
        eye: String,
        date: Date,
        iol: String,
        complications: String
      }],
      visualImpact: String
    },

    dryEye: {
      present: Boolean,
      severity: String,
      tbut: {
        OD: Number,
        OS: Number
      },
      schirmer: {
        OD: Number,
        OS: Number
      },
      treatments: [String],
      artificalTears: String,
      plugs: Boolean
    },

    keratoconus: {
      present: Boolean,
      laterality: {
        type: String,
        enum: ['OD', 'OS', 'OU']
      },
      stage: {
        OD: String,
        OS: String
      },
      kmax: {
        OD: Number,
        OS: Number
      },
      crosslinking: {
        OD: {
          done: Boolean,
          date: Date
        },
        OS: {
          done: Boolean,
          date: Date
        }
      },
      correction: String
    }
  },

  // Risk scores and assessments
  riskAssessments: {
    cardiovascularRisk: {
      score: Number,
      calculator: String, // ASCVD, Framingham, etc.
      category: String,
      lastCalculated: Date
    },
    diabeticRetinopathyRisk: {
      score: Number,
      riskFactors: [String],
      screeningInterval: String,
      lastAssessed: Date
    },
    glaucomaRisk: {
      score: Number,
      riskFactors: [String],
      familyHistory: Boolean,
      lastAssessed: Date
    },
    fallRisk: {
      score: Number,
      factors: [String],
      interventions: [String],
      lastAssessed: Date
    },
    strokeRisk: {
      chadScore: Number,
      anticoagulation: Boolean,
      lastAssessed: Date
    }
  },

  // Family history relevant to conditions
  familyHistory: [{
    condition: String,
    affectedRelatives: [{
      relationship: String,
      ageAtDiagnosis: Number
    }]
  }],

  // Treatment preferences and limitations
  treatmentPreferences: {
    limitations: [String],
    allergies: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient.medicalHistory.allergies'
    }],
    preferences: [String],
    advanceDirectives: Boolean,
    codeStatus: String
  },

  // Last comprehensive review
  lastReview: {
    date: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    nextReviewDue: Date,
    notes: String
  },

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
pathologyProfileSchema.index({ patient: 1 });
pathologyProfileSchema.index({ 'activeConditions.status': 1 });
pathologyProfileSchema.index({ 'activeConditions.icdCode': 1 });
pathologyProfileSchema.index({ 'lastReview.nextReviewDue': 1 });

// Methods
pathologyProfileSchema.methods.addCondition = function(conditionData) {
  this.activeConditions.push(conditionData);
  return this.save();
};

pathologyProfileSchema.methods.updateProgression = function(conditionId, progressionData) {
  const condition = this.activeConditions.id(conditionId);
  if (condition) {
    condition.progression.push(progressionData);
    return this.save();
  }
  throw new Error('Condition not found');
};

pathologyProfileSchema.methods.resolveCondition = function(conditionId) {
  const condition = this.activeConditions.id(conditionId);
  if (condition) {
    condition.status = 'resolved';
    return this.save();
  }
  throw new Error('Condition not found');
};

// Static methods
pathologyProfileSchema.statics.getActiveProblems = async function(patientId) {
  const profile = await this.findOne({ patient: patientId });
  if (!profile) return [];

  return profile.activeConditions.filter(c =>
    ['active', 'chronic', 'uncontrolled'].includes(c.status)
  );
};

pathologyProfileSchema.statics.getRiskProfile = async function(patientId) {
  const profile = await this.findOne({ patient: patientId });
  if (!profile) return null;

  return profile.riskAssessments;
};

module.exports = mongoose.model('PathologyProfile', pathologyProfileSchema);