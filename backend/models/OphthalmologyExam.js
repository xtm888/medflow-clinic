const mongoose = require('mongoose');

// =====================================================
// CLINICAL VALIDATION CONSTANTS
// French Medical Standards for Ophthalmology
// =====================================================

/**
 * Monoyer Scale - French standard for distance visual acuity measurement
 * Scale: 10/10 (normal) to 1/10, then 1/20, 1/50 for very low vision
 * Special notations:
 *   - CLD (Compte Les Doigts / Counts Fingers)
 *   - VBLM (Voit Bouger La Main / Sees Hand Movement)
 *   - PL+ (Perception Lumineuse Positive / Light Perception Positive)
 *   - PL- (Perception Lumineuse Negative / No Light Perception)
 */
const MONOYER_DISTANCE_VALUES = [
  '10/10', '9/10', '8/10', '7/10', '6/10', '5/10', '4/10', '3/10', '2/10', '1/10',
  '1/20', '1/50',
  'CLD', 'VBLM', 'PL+', 'PL-'
];

/**
 * Parinaud Scale - French standard for near vision measurement
 * P1.5 (excellent) to P20 (very poor near vision)
 * Measured at standard reading distance (typically 33-40 cm)
 */
const PARINAUD_NEAR_VALUES = [
  'P1.5', 'P2', 'P3', 'P4', 'P5', 'P6', 'P8', 'P10', 'P14', 'P20'
];

/**
 * Refraction limits based on clinical standards
 * Sphere: -25.00 to +25.00 diopters (covers high myopia/hyperopia)
 * Cylinder: -10.00 to +10.00 diopters (covers high astigmatism)
 * Axis: 0 to 180 degrees
 * Addition: +0.25 to +4.00 diopters (presbyopia correction)
 */
const REFRACTION_LIMITS = {
  sphere: { min: -25, max: 25 },
  cylinder: { min: -10, max: 10 },
  axis: { min: 0, max: 180 },
  addition: { min: 0.25, max: 4.00 }
};

/**
 * IOP (Intraocular Pressure) limits
 * Normal range: 10-21 mmHg
 * Extended range for pathological cases: 0-80 mmHg
 */
const IOP_LIMITS = {
  min: 0,
  max: 80
};

// =====================================================
// CUSTOM VALIDATOR FUNCTIONS
// Allow empty/null values but validate when present
// =====================================================

/**
 * Creates a validator that allows empty values but validates against enum when present
 * @param {Array} validValues - Array of valid enum values
 * @param {String} fieldName - Name of the field for error messages
 */
function createOptionalEnumValidator(validValues, fieldName) {
  return {
    validator: function(value) {
      // Allow null, undefined, or empty string
      if (value === null || value === undefined || value === '') {
        return true;
      }
      return validValues.includes(value);
    },
    message: props => `${props.value} n'est pas une valeur valide pour ${fieldName}. Valeurs acceptees: ${validValues.join(', ')}`
  };
}

/**
 * Creates a validator for numeric range that allows empty values
 * @param {Number} min - Minimum value
 * @param {Number} max - Maximum value
 * @param {String} fieldName - Name of the field for error messages
 */
function createOptionalRangeValidator(min, max, fieldName) {
  return {
    validator: function(value) {
      // Allow null or undefined
      if (value === null || value === undefined) {
        return true;
      }
      return value >= min && value <= max;
    },
    message: props => `${props.value} est hors limites pour ${fieldName}. Plage acceptee: ${min} a ${max}`
  };
}

// Visual acuity field schema with Monoyer validation
const distanceVAFieldSchema = {
  type: String,
  validate: createOptionalEnumValidator(MONOYER_DISTANCE_VALUES, 'acuite visuelle de loin (echelle Monoyer)')
};

// Near vision field schema with Parinaud validation
const nearVAFieldSchema = {
  type: String,
  validate: createOptionalEnumValidator(PARINAUD_NEAR_VALUES, 'acuite visuelle de pres (echelle Parinaud)')
};

// Refraction field schemas with range validation
const sphereFieldSchema = {
  type: Number,
  validate: createOptionalRangeValidator(REFRACTION_LIMITS.sphere.min, REFRACTION_LIMITS.sphere.max, 'sphere')
};

const cylinderFieldSchema = {
  type: Number,
  validate: createOptionalRangeValidator(REFRACTION_LIMITS.cylinder.min, REFRACTION_LIMITS.cylinder.max, 'cylindre')
};

const axisFieldSchema = {
  type: Number,
  validate: createOptionalRangeValidator(REFRACTION_LIMITS.axis.min, REFRACTION_LIMITS.axis.max, 'axe')
};

const additionFieldSchema = {
  type: Number,
  validate: createOptionalRangeValidator(REFRACTION_LIMITS.addition.min, REFRACTION_LIMITS.addition.max, 'addition')
};

// IOP field schema with range validation
const iopValueFieldSchema = {
  type: Number,
  validate: createOptionalRangeValidator(IOP_LIMITS.min, IOP_LIMITS.max, 'pression intraoculaire (mmHg)')
};

const ophthalmologyExamSchema = new mongoose.Schema({
  // Identification
  examId: {
    type: String,
    unique: true,
    required: false // Auto-generated in pre-save hook
  },

  // Multi-Clinic: Which clinic this exam was performed at
  // This allows a patient from Clinic A to have exams at Clinic B
  clinic: {
    type: mongoose.Schema.ObjectId,
    ref: 'Clinic',
    required: true,
    index: true
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
  // Uses French Monoyer scale for distance vision and Parinaud scale for near vision
  visualAcuity: {
    // Distance visual acuity - Monoyer scale (10/10 to 1/50, CLD, VBLM, PL+, PL-)
    distance: {
      OD: {
        uncorrected: distanceVAFieldSchema,
        corrected: distanceVAFieldSchema,
        pinhole: distanceVAFieldSchema
      },
      OS: {
        uncorrected: distanceVAFieldSchema,
        corrected: distanceVAFieldSchema,
        pinhole: distanceVAFieldSchema
      },
      OU: {
        uncorrected: distanceVAFieldSchema,
        corrected: distanceVAFieldSchema
      }
    },
    // Near visual acuity - Parinaud scale (P1.5 to P20)
    near: {
      OD: {
        uncorrected: nearVAFieldSchema,
        corrected: nearVAFieldSchema
      },
      OS: {
        uncorrected: nearVAFieldSchema,
        corrected: nearVAFieldSchema
      },
      OU: {
        uncorrected: nearVAFieldSchema,
        corrected: nearVAFieldSchema
      },
      testDistance: String // e.g., "40cm", "33cm" (standard French reading distance)
    },
    method: {
      type: String,
      enum: ['snellen', 'etdrs', 'logmar', 'decimal', 'metric', 'monoyer']
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
  // Sphere: -25 to +25 D, Cylinder: -10 to +10 D, Axis: 0-180 degrees, Addition: 0.25 to 4.00 D
  refraction: {
    objective: {
      autorefractor: {
        OD: {
          sphere: sphereFieldSchema,
          cylinder: cylinderFieldSchema,
          axis: axisFieldSchema,
          confidence: Number
        },
        OS: {
          sphere: sphereFieldSchema,
          cylinder: cylinderFieldSchema,
          axis: axisFieldSchema,
          confidence: Number
        },
        // Device source tracking
        sourceDevice: {
          type: mongoose.Schema.ObjectId,
          ref: 'Device'
        },
        sourceMeasurement: {
          type: mongoose.Schema.ObjectId,
          ref: 'DeviceMeasurement'
        },
        importedAt: Date,
        importedBy: {
          type: mongoose.Schema.ObjectId,
          ref: 'User'
        }
      },
      retinoscopy: {
        OD: {
          sphere: sphereFieldSchema,
          cylinder: cylinderFieldSchema,
          axis: axisFieldSchema
        },
        OS: {
          sphere: sphereFieldSchema,
          cylinder: cylinderFieldSchema,
          axis: axisFieldSchema
        },
        workingDistance: Number,
        cycloplegic: Boolean
      }
    },
    subjective: {
      OD: {
        sphere: sphereFieldSchema,
        cylinder: cylinderFieldSchema,
        axis: axisFieldSchema,
        va: distanceVAFieldSchema,  // Visual acuity with correction (Monoyer scale)
        parinaud: nearVAFieldSchema  // Near vision (Parinaud scale: P2, P3, etc.)
      },
      OS: {
        sphere: sphereFieldSchema,
        cylinder: cylinderFieldSchema,
        axis: axisFieldSchema,
        va: distanceVAFieldSchema,
        parinaud: nearVAFieldSchema
      },
      add: additionFieldSchema,
      vertexDistance: Number,
      balanceMethod: String
    },
    finalPrescription: {
      OD: {
        sphere: sphereFieldSchema,
        cylinder: cylinderFieldSchema,
        axis: axisFieldSchema,
        add: additionFieldSchema,
        prism: String,
        base: String,
        va: distanceVAFieldSchema,
        parinaud: nearVAFieldSchema
      },
      OS: {
        sphere: sphereFieldSchema,
        cylinder: cylinderFieldSchema,
        axis: axisFieldSchema,
        add: additionFieldSchema,
        prism: String,
        base: String,
        va: distanceVAFieldSchema,
        parinaud: nearVAFieldSchema
      },
      pd: {
        distance: Number,
        near: Number,
        monocular: {
          OD: Number,
          OS: Number
        }
      },
      // Prescription status and lens types
      prescriptionStatus: {
        status: {
          type: String,
          enum: ['prescribed', 'not_prescribed', 'renewed', 'external', 'pending'],
          default: 'pending'
        },
        lensTypes: [{
          type: String,
          enum: ['far', 'near', 'two_pairs', 'progressive', 'bifocal', 'varifocal']
        }],
        prescribedAt: Date,
        printedAt: Date,
        viewedAt: Date
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
    method: String, // manual, auto-k, topography
    // Device source tracking
    sourceDevice: {
      type: mongoose.Schema.ObjectId,
      ref: 'Device'
    },
    sourceMeasurement: {
      type: mongoose.Schema.ObjectId,
      ref: 'DeviceMeasurement'
    },
    importedAt: Date,
    importedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
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

  // Intraocular Pressure (IOP / Tension Oculaire)
  // Normal range: 10-21 mmHg, pathological values can reach higher
  // Extended validation range: 0-80 mmHg
  iop: {
    OD: {
      value: iopValueFieldSchema,
      time: String,
      method: {
        type: String,
        enum: ['goldmann', 'tonopen', 'icare', 'nct']
      }
    },
    OS: {
      value: iopValueFieldSchema,
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
      performed: {
        type: Boolean,
        default: false
      },
      method: {
        type: String,
        enum: ['indentation', 'compression', 'static']
      },
      lens: {
        type: String,
        enum: ['zeiss_4_mirror', 'goldmann_3_mirror', 'sussman', 'posner', 'other']
      },
      // Legacy fields for backward compatibility
      OD: String,
      OS: String,
      // Enhanced grading data
      gradingSystem: {
        type: String,
        enum: ['shaffer', 'scheie', 'spaeth', 'van_herick'],
        default: 'shaffer'
      },
      ODDetailed: {
        quadrants: {
          superior: {
            shaffer: { type: String, enum: ['0', 'I', 'II', 'III', 'IV'] },
            scheie: { type: String, enum: ['wide_open', 'grade_I', 'grade_II', 'grade_III', 'grade_IV'] },
            spaeth: {
              irisInsertion: { type: String, enum: ['A', 'B', 'C', 'D', 'E'] },
              angularWidth: { type: Number, min: 0, max: 45 },
              irisConfiguration: { type: String, enum: ['s', 'r', 'q', 'f', 'b', 'p'] }
            },
            pigmentation: { type: Number, min: 0, max: 4 }
          },
          inferior: {
            shaffer: { type: String, enum: ['0', 'I', 'II', 'III', 'IV'] },
            scheie: { type: String, enum: ['wide_open', 'grade_I', 'grade_II', 'grade_III', 'grade_IV'] },
            spaeth: {
              irisInsertion: { type: String, enum: ['A', 'B', 'C', 'D', 'E'] },
              angularWidth: { type: Number, min: 0, max: 45 },
              irisConfiguration: { type: String, enum: ['s', 'r', 'q', 'f', 'b', 'p'] }
            },
            pigmentation: { type: Number, min: 0, max: 4 }
          },
          nasal: {
            shaffer: { type: String, enum: ['0', 'I', 'II', 'III', 'IV'] },
            scheie: { type: String, enum: ['wide_open', 'grade_I', 'grade_II', 'grade_III', 'grade_IV'] },
            spaeth: {
              irisInsertion: { type: String, enum: ['A', 'B', 'C', 'D', 'E'] },
              angularWidth: { type: Number, min: 0, max: 45 },
              irisConfiguration: { type: String, enum: ['s', 'r', 'q', 'f', 'b', 'p'] }
            },
            pigmentation: { type: Number, min: 0, max: 4 }
          },
          temporal: {
            shaffer: { type: String, enum: ['0', 'I', 'II', 'III', 'IV'] },
            scheie: { type: String, enum: ['wide_open', 'grade_I', 'grade_II', 'grade_III', 'grade_IV'] },
            spaeth: {
              irisInsertion: { type: String, enum: ['A', 'B', 'C', 'D', 'E'] },
              angularWidth: { type: Number, min: 0, max: 45 },
              irisConfiguration: { type: String, enum: ['s', 'r', 'q', 'f', 'b', 'p'] }
            },
            pigmentation: { type: Number, min: 0, max: 4 }
          }
        },
        synechiae: {
          pas: {
            present: { type: Boolean, default: false },
            extent: { type: Number, min: 0, max: 12 }, // clock hours
            locations: [String] // e.g., ['12_oclock', '1_oclock']
          },
          posterior: {
            present: { type: Boolean, default: false },
            extent: { type: String, enum: ['minimal', 'partial', 'extensive', 'secluded_pupil'] }
          }
        },
        neovascularization: {
          present: { type: Boolean, default: false },
          location: [String],
          extent: { type: String, enum: ['trace', 'mild', 'moderate', 'severe'] }
        },
        bloodInCanal: { type: Boolean, default: false },
        notes: String
      },
      OSDetailed: {
        quadrants: {
          superior: {
            shaffer: { type: String, enum: ['0', 'I', 'II', 'III', 'IV'] },
            scheie: { type: String, enum: ['wide_open', 'grade_I', 'grade_II', 'grade_III', 'grade_IV'] },
            spaeth: {
              irisInsertion: { type: String, enum: ['A', 'B', 'C', 'D', 'E'] },
              angularWidth: { type: Number, min: 0, max: 45 },
              irisConfiguration: { type: String, enum: ['s', 'r', 'q', 'f', 'b', 'p'] }
            },
            pigmentation: { type: Number, min: 0, max: 4 }
          },
          inferior: {
            shaffer: { type: String, enum: ['0', 'I', 'II', 'III', 'IV'] },
            scheie: { type: String, enum: ['wide_open', 'grade_I', 'grade_II', 'grade_III', 'grade_IV'] },
            spaeth: {
              irisInsertion: { type: String, enum: ['A', 'B', 'C', 'D', 'E'] },
              angularWidth: { type: Number, min: 0, max: 45 },
              irisConfiguration: { type: String, enum: ['s', 'r', 'q', 'f', 'b', 'p'] }
            },
            pigmentation: { type: Number, min: 0, max: 4 }
          },
          nasal: {
            shaffer: { type: String, enum: ['0', 'I', 'II', 'III', 'IV'] },
            scheie: { type: String, enum: ['wide_open', 'grade_I', 'grade_II', 'grade_III', 'grade_IV'] },
            spaeth: {
              irisInsertion: { type: String, enum: ['A', 'B', 'C', 'D', 'E'] },
              angularWidth: { type: Number, min: 0, max: 45 },
              irisConfiguration: { type: String, enum: ['s', 'r', 'q', 'f', 'b', 'p'] }
            },
            pigmentation: { type: Number, min: 0, max: 4 }
          },
          temporal: {
            shaffer: { type: String, enum: ['0', 'I', 'II', 'III', 'IV'] },
            scheie: { type: String, enum: ['wide_open', 'grade_I', 'grade_II', 'grade_III', 'grade_IV'] },
            spaeth: {
              irisInsertion: { type: String, enum: ['A', 'B', 'C', 'D', 'E'] },
              angularWidth: { type: Number, min: 0, max: 45 },
              irisConfiguration: { type: String, enum: ['s', 'r', 'q', 'f', 'b', 'p'] }
            },
            pigmentation: { type: Number, min: 0, max: 4 }
          }
        },
        synechiae: {
          pas: {
            present: { type: Boolean, default: false },
            extent: { type: Number, min: 0, max: 12 },
            locations: [String]
          },
          posterior: {
            present: { type: Boolean, default: false },
            extent: { type: String, enum: ['minimal', 'partial', 'extensive', 'secluded_pupil'] }
          }
        },
        neovascularization: {
          present: { type: Boolean, default: false },
          location: [String],
          extent: { type: String, enum: ['trace', 'mild', 'moderate', 'severe'] }
        },
        bloodInCanal: { type: Boolean, default: false },
        notes: String
      }
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
    type: { type: String }, // fundus, oct, visual-field, etc.
    eye: {
      type: String,
      enum: ['OD', 'OS', 'OU']
    },
    url: String,
    caption: String,
    takenAt: Date
  }],

  // Device Integration - Link to device measurements and images
  deviceMeasurements: [{
    measurement: {
      type: mongoose.Schema.ObjectId,
      ref: 'DeviceMeasurement'
    },
    device: {
      type: mongoose.Schema.ObjectId,
      ref: 'Device'
    },
    measurementType: String, // 'autorefractor', 'tonometer', 'keratometer', 'oct'
    linkedAt: {
      type: Date,
      default: Date.now
    },
    linkedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    appliedToExam: {
      type: Boolean,
      default: false
    }
  }],

  deviceImages: [{
    image: {
      type: mongoose.Schema.ObjectId,
      ref: 'DeviceImage'
    },
    device: {
      type: mongoose.Schema.ObjectId,
      ref: 'Device'
    },
    imageType: String, // 'OCT', 'fundus', 'topography', etc.
    linkedAt: {
      type: Date,
      default: Date.now
    },
    linkedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  }],

  // Notes
  notes: {
    clinical: String,
    technician: String,
    internal: String
  },

  // Historical Tracking
  previousExams: [{
    type: mongoose.Schema.ObjectId,
    ref: 'OphthalmologyExam'
  }],
  copiedFrom: {
    type: mongoose.Schema.ObjectId,
    ref: 'OphthalmologyExam'
  },
  isPreviousCopy: {
    type: Boolean,
    default: false
  },

  // Comments and Documentation
  comments: {
    standardTemplate: {
      type: mongoose.Schema.ObjectId,
      ref: 'CommentTemplate'
    },
    customComment: String,
    personalNotes: String, // Perso field from screenshot
    adaptationNotes: String
  },

  // Generated Summaries
  summaries: {
    refraction: {
      text: String,
      generatedAt: Date,
      generatedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      }
    },
    keratometry: {
      text: String,
      generatedAt: Date,
      generatedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      }
    }
  },

  // =====================================================
  // CONTACT LENS FITTING - StudioVision 4-Tab Parity
  // =====================================================
  contactLensFitting: {
    // Tab 1: PATIENT HISTORY (HISTORIQUE)
    wearingHistory: {
      isWearer: Boolean,
      yearsWearing: Number,
      schedule: {
        type: String,
        enum: ['daily', 'extended', 'occasional', 'ortho_k']
      },
      frequency: {
        type: String,
        enum: ['daily_disposable', 'biweekly', 'monthly', 'quarterly', 'annual']
      },
      // Compliance star rating (1-5)
      compliance: {
        rating: {
          type: Number,
          min: 1,
          max: 5
        },
        notes: String
      },
      currentBrand: String,
      currentParameters: {
        OD: {
          sphere: Number,
          cylinder: Number,
          axis: Number,
          baseCurve: Number,
          diameter: Number
        },
        OS: {
          sphere: Number,
          cylinder: Number,
          axis: Number,
          baseCurve: Number,
          diameter: Number
        }
      },
      // Current issues checklist
      currentIssues: [{
        type: {
          type: String,
          enum: [
            'dryness', 'redness', 'irritation', 'blurry_vision',
            'halos_glare', 'difficult_insertion', 'difficult_removal',
            'discomfort_after_6hrs', 'lens_decentration', 'none'
          ]
        },
        severity: {
          type: String,
          enum: ['mild', 'moderate', 'severe']
        }
      }]
    },

    // Tab 2: FITTING PARAMETERS (PARAMÈTRES)
    lensType: {
      type: String,
      enum: ['soft_spherical', 'soft_toric', 'soft_multifocal', 'rgp', 'scleral', 'hybrid', 'ortho_k']
    },
    trialLens: {
      OD: {
        brand: String,
        power: Number,
        cylinder: Number,
        axis: Number,
        baseCurve: Number,
        diameter: Number,
        fromInventory: {
          type: mongoose.Schema.ObjectId,
          ref: 'Inventory' // Unified inventory (contact_lens type)
        }
      },
      OS: {
        brand: String,
        power: Number,
        cylinder: Number,
        axis: Number,
        baseCurve: Number,
        diameter: Number,
        fromInventory: {
          type: mongoose.Schema.ObjectId,
          ref: 'Inventory' // Unified inventory (contact_lens type)
        }
      }
    },
    assessment: {
      OD: {
        centration: {
          type: String,
          enum: ['centered', 'decentered_nasal', 'decentered_temporal', 'decentered_superior', 'decentered_inferior']
        },
        centrationDirection: String,
        movement: {
          type: String,
          enum: ['optimal', 'tight', 'loose']
        },
        coverage: {
          type: String,
          enum: ['full', 'partial', 'inadequate']
        },
        comfort: {
          type: Number,
          min: 1,
          max: 10
        },
        visionQuality: {
          type: Number,
          min: 1,
          max: 10
        },
        // Over-refraction
        overRefraction: {
          needed: Boolean,
          sphere: Number,
          cylinder: Number,
          axis: Number,
          finalPower: Number // Auto-calculated
        },
        // Fluorescein pattern for RGP
        fluoresceinPattern: {
          type: String,
          enum: ['alignment', 'apical_clearance', 'apical_bearing', 'three_point_touch']
        },
        fluoresceinImageId: {
          type: mongoose.Schema.ObjectId,
          ref: 'DeviceImage'
        }
      },
      OS: {
        centration: {
          type: String,
          enum: ['centered', 'decentered_nasal', 'decentered_temporal', 'decentered_superior', 'decentered_inferior']
        },
        centrationDirection: String,
        movement: {
          type: String,
          enum: ['optimal', 'tight', 'loose']
        },
        coverage: {
          type: String,
          enum: ['full', 'partial', 'inadequate']
        },
        comfort: {
          type: Number,
          min: 1,
          max: 10
        },
        visionQuality: {
          type: Number,
          min: 1,
          max: 10
        },
        overRefraction: {
          needed: Boolean,
          sphere: Number,
          cylinder: Number,
          axis: Number,
          finalPower: Number
        },
        fluoresceinPattern: {
          type: String,
          enum: ['alignment', 'apical_clearance', 'apical_bearing', 'three_point_touch']
        },
        fluoresceinImageId: {
          type: mongoose.Schema.ObjectId,
          ref: 'DeviceImage'
        }
      }
    },
    finalPrescription: {
      OD: {
        brand: String,
        power: Number,
        cylinder: Number,
        axis: Number,
        baseCurve: Number,
        diameter: Number,
        addPower: Number, // For multifocal
        material: String,
        modality: {
          type: String,
          enum: ['daily', 'biweekly', 'monthly', 'quarterly', 'annual', 'extended']
        }
      },
      OS: {
        brand: String,
        power: Number,
        cylinder: Number,
        axis: Number,
        baseCurve: Number,
        diameter: Number,
        addPower: Number,
        material: String,
        modality: {
          type: String,
          enum: ['daily', 'biweekly', 'monthly', 'quarterly', 'annual', 'extended']
        }
      }
    },

    // Tab 3: CARE & SUPPLIES (ENTRETIEN)
    careInstructions: {
      solutionType: {
        type: String,
        enum: ['multipurpose', 'hydrogen_peroxide', 'saline', 'rgp_solution', 'not_applicable']
      },
      solutionBrand: String,
      solutionQuantity: Number,
      // Annual supply calculator
      annualSupply: {
        wearingDaysPerWeek: {
          type: Number,
          default: 7
        },
        boxesNeeded: {
          OD: Number,
          OS: Number
        },
        totalBoxes: Number,
        addToPrescription: Boolean
      },
      specialInstructions: String,
      // Rebate tracking
      rebateInfo: {
        available: Boolean,
        amount: Number,
        manufacturerProgram: String,
        expirationDate: Date
      }
    },

    // Tab 4: FOLLOW-UP & EDUCATION (SUIVI)
    followUp: {
      fittingStatus: {
        type: String,
        enum: ['initial', 'refit', 'routine']
      },
      recommendedIntervals: {
        firstFollowUp: {
          type: String,
          default: '1-2 weeks'
        },
        secondFollowUp: {
          type: String,
          default: '1 month'
        },
        annualExam: {
          type: String,
          default: '12 months'
        }
      },
      // Patient education checklist
      educationChecklist: {
        insertionRemovalDemo: { completed: Boolean, date: Date },
        cleaningStorageInstructions: { completed: Boolean, date: Date },
        wearingScheduleDiscussed: { completed: Boolean, date: Date },
        complicationSignsReviewed: { completed: Boolean, date: Date },
        emergencyContactProvided: { completed: Boolean, date: Date },
        replacementScheduleEmphasized: { completed: Boolean, date: Date },
        writtenInstructionsGiven: { completed: Boolean, date: Date },
        patientDemonstratedSkill: { completed: Boolean, date: Date }
      },
      educationNotes: String,
      nextAppointment: {
        type: mongoose.Schema.ObjectId,
        ref: 'Appointment'
      }
    },

    // Fitting notes
    notes: String,
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'failed', 'ordered'],
      default: 'in_progress'
    }
  },

  // =====================================================
  // LOCS III CATARACT GRADING - StudioVision Parity
  // =====================================================
  locsGrading: {
    performed: {
      type: Boolean,
      default: false
    },
    OD: {
      // Nuclear Opalescence (NO) - 0.1 to 6.9
      nuclearOpalescence: {
        grade: {
          type: Number,
          min: 0.1,
          max: 6.9
        },
        selectedImage: {
          type: Number,
          min: 1,
          max: 6
        }
      },
      // Nuclear Color (NC) - 0.1 to 6.9
      nuclearColor: {
        grade: {
          type: Number,
          min: 0.1,
          max: 6.9
        },
        selectedImage: {
          type: Number,
          min: 1,
          max: 6
        }
      },
      // Cortical (C) - 0.1 to 5.9
      cortical: {
        grade: {
          type: Number,
          min: 0.1,
          max: 5.9
        },
        selectedImage: {
          type: Number,
          min: 1,
          max: 5
        }
      },
      // Posterior Subcapsular (P) - 0.1 to 5.9
      posteriorSubcapsular: {
        grade: {
          type: Number,
          min: 0.1,
          max: 5.9
        },
        selectedImage: {
          type: Number,
          min: 1,
          max: 5
        }
      },
      notes: String
    },
    OS: {
      nuclearOpalescence: {
        grade: {
          type: Number,
          min: 0.1,
          max: 6.9
        },
        selectedImage: {
          type: Number,
          min: 1,
          max: 6
        }
      },
      nuclearColor: {
        grade: {
          type: Number,
          min: 0.1,
          max: 6.9
        },
        selectedImage: {
          type: Number,
          min: 1,
          max: 6
        }
      },
      cortical: {
        grade: {
          type: Number,
          min: 0.1,
          max: 5.9
        },
        selectedImage: {
          type: Number,
          min: 1,
          max: 5
        }
      },
      posteriorSubcapsular: {
        grade: {
          type: Number,
          min: 0.1,
          max: 5.9
        },
        selectedImage: {
          type: Number,
          min: 1,
          max: 5
        }
      },
      notes: String
    },
    // Grading metadata
    gradedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    gradedAt: Date,
    // Comparison to previous
    previousGrading: {
      examId: {
        type: mongoose.Schema.ObjectId,
        ref: 'OphthalmologyExam'
      },
      date: Date,
      progression: {
        type: String,
        enum: ['stable', 'progressing', 'improved']
      }
    },
    notes: String
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
    enum: ['in-progress', 'in_progress', 'completed', 'reviewed', 'amended'],
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
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
ophthalmologyExamSchema.index({ clinic: 1, patient: 1, createdAt: -1 });
ophthalmologyExamSchema.index({ clinic: 1, examiner: 1, status: 1 });
ophthalmologyExamSchema.index({ examId: 1 });
ophthalmologyExamSchema.index({ appointment: 1 });
// Index for cross-clinic patient history lookup (all exams for a patient regardless of clinic)
ophthalmologyExamSchema.index({ patient: 1, createdAt: -1 });
// Soft delete index
ophthalmologyExamSchema.index({ clinic: 1, isDeleted: 1 });

// Query middleware - exclude deleted records by default
ophthalmologyExamSchema.pre('find', function() {
  if (!this.getQuery().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

ophthalmologyExamSchema.pre('findOne', function() {
  if (!this.getQuery().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

ophthalmologyExamSchema.pre('countDocuments', function() {
  if (!this.getQuery().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

// Soft delete method
ophthalmologyExamSchema.methods.softDelete = async function(deletedByUserId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedByUserId;
  return await this.save();
};

// Restore method
ophthalmologyExamSchema.methods.restore = async function() {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return await this.save();
};

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

// Static method: Copy from previous exam
ophthalmologyExamSchema.statics.copyFromPrevious = async function(patientId, userId) {
  try {
    const previousExam = await this.findOne({
      patient: patientId,
      status: { $in: ['completed', 'reviewed'] }
    })
      .sort({ createdAt: -1 });

    if (!previousExam) {
      return null;
    }

    const newExam = new this({
      patient: patientId,
      examiner: userId,
      examType: 'refraction',
      copiedFrom: previousExam._id,
      isPreviousCopy: true,

      // Copy refraction data
      refraction: {
        objective: previousExam.refraction?.objective,
        subjective: previousExam.refraction?.subjective,
        finalPrescription: previousExam.refraction?.finalPrescription
      },

      // Copy keratometry
      keratometry: previousExam.keratometry,

      // Copy visual acuity baseline
      visualAcuity: previousExam.visualAcuity,

      // Copy current correction (becomes previous)
      currentCorrection: previousExam.currentCorrection,

      // Copy IOP baseline
      iop: previousExam.iop
    });

    // Update previous exam's history
    if (!previousExam.previousExams) {
      previousExam.previousExams = [];
    }
    previousExam.previousExams.push(newExam._id);
    await previousExam.save();

    return newExam;
  } catch (error) {
    console.error('Error copying from previous exam:', error);
    throw error;
  }
};

// Static method: Get patient's refraction history
ophthalmologyExamSchema.statics.getRefractionHistory = async function(patientId, limit = 20) {
  return await this.find({
    patient: patientId,
    examType: 'refraction',
    status: { $in: ['completed', 'reviewed'] }
  })
    .select('examId createdAt examiner refraction.finalPrescription iop copiedFrom isPreviousCopy')
    .populate('examiner', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Instance method: Generate refraction summary
ophthalmologyExamSchema.methods.generateRefractionSummary = function() {
  const fp = this.refraction?.finalPrescription;
  if (!fp) return null;

  const formatEye = (eye, eyeLabel) => {
    const data = fp[eye];
    if (!data) return '';

    let summary = `${eyeLabel}: `;

    // Sphere
    if (data.sphere !== undefined && data.sphere !== null) {
      summary += `Sphère ${data.sphere >= 0 ? '+' : ''}${data.sphere.toFixed(2)} `;
    }

    // Cylinder
    if (data.cylinder !== undefined && data.cylinder !== null && data.cylinder !== 0) {
      summary += `Cylindre ${data.cylinder >= 0 ? '+' : ''}${data.cylinder.toFixed(2)} `;
      if (data.axis !== undefined && data.axis !== null) {
        summary += `Axe ${data.axis}° `;
      }
    }

    // Visual Acuity
    if (data.va) {
      summary += `AV: ${data.va} `;
    }

    // Addition
    if (data.add !== undefined && data.add !== null && data.add !== 0) {
      summary += `Addition: +${data.add.toFixed(2)} `;
    }

    // Parinaud
    if (data.parinaud) {
      summary += `Parinaud: ${data.parinaud} `;
    }

    // Prism
    if (data.prism) {
      summary += `Prisme: ${data.prism} Base ${data.base || ''} `;
    }

    return summary.trim();
  };

  let summary = `RÉFRACTION DU ${new Date(this.createdAt).toLocaleDateString('fr-FR')}\n\n`;

  summary += `${formatEye('OD', 'OD (Œil Droit)')}\n`;
  summary += `${formatEye('OS', 'OG (Œil Gauche)')}\n\n`;

  // PD if available
  if (fp.pd?.distance) {
    summary += `Écart pupillaire de loin: ${fp.pd.distance} mm\n`;
  }
  if (fp.pd?.near) {
    summary += `Écart pupillaire de près: ${fp.pd.near} mm\n`;
  }

  // IOP if available
  if (this.iop?.OD?.value || this.iop?.OS?.value) {
    summary += '\nTension oculaire:\n';
    if (this.iop.OD?.value) {
      summary += `TOD: ${this.iop.OD.value} mmHg `;
    }
    if (this.iop.OS?.value) {
      summary += `TOG: ${this.iop.OS.value} mmHg`;
    }
    summary += '\n';
  }

  // Add custom comments
  if (this.comments?.customComment) {
    summary += `\nCommentaires: ${this.comments.customComment}\n`;
  }

  this.summaries = this.summaries || {};
  this.summaries.refraction = {
    text: summary,
    generatedAt: new Date()
  };

  return summary;
};

// Instance method: Generate keratometry summary
ophthalmologyExamSchema.methods.generateKeratometrySummary = function() {
  const kerato = this.keratometry;
  if (!kerato || (!kerato.OD && !kerato.OS)) return null;

  let summary = `KÉRATOMÉTRIE DU ${new Date(this.createdAt).toLocaleDateString('fr-FR')}\n\n`;

  const formatEyeKerato = (eye, eyeLabel) => {
    const data = kerato[eye];
    if (!data) return '';

    let text = `${eyeLabel}:\n`;

    if (data.k1?.power) {
      text += `  K1: ${data.k1.power.toFixed(2)} D`;
      if (data.k1.axis) text += ` @ ${data.k1.axis}°`;
      text += '\n';
    }

    if (data.k2?.power) {
      text += `  K2: ${data.k2.power.toFixed(2)} D`;
      if (data.k2.axis) text += ` @ ${data.k2.axis}°`;
      text += '\n';
    }

    if (data.average) {
      text += `  K moyen: ${data.average.toFixed(2)} D\n`;
    }

    if (data.cylinder) {
      text += `  Cylindre cornéen: ${data.cylinder.toFixed(2)} D`;
      if (data.axis) text += ` @ ${data.axis}°`;
      text += '\n';
    }

    return text;
  };

  summary += `${formatEyeKerato('OD', 'OD (Œil Droit)')}\n`;
  summary += `${formatEyeKerato('OS', 'OG (Œil Gauche)')}\n`;

  if (kerato.method) {
    summary += `Méthode: ${kerato.method}\n`;
  }

  this.summaries = this.summaries || {};
  this.summaries.keratometry = {
    text: summary,
    generatedAt: new Date()
  };

  return summary;
};

// Instance method: Mark prescription as printed
ophthalmologyExamSchema.methods.markPrescriptionPrinted = function() {
  if (!this.refraction?.finalPrescription?.prescriptionStatus) {
    this.refraction.finalPrescription.prescriptionStatus = {};
  }
  this.refraction.finalPrescription.prescriptionStatus.printedAt = new Date();
  return this.save();
};

// Instance method: Mark prescription as viewed
ophthalmologyExamSchema.methods.markPrescriptionViewed = function() {
  if (!this.refraction?.finalPrescription?.prescriptionStatus) {
    this.refraction.finalPrescription.prescriptionStatus = {};
  }
  this.refraction.finalPrescription.prescriptionStatus.viewedAt = new Date();
  return this.save();
};

// Instance method: Link device measurement to exam
ophthalmologyExamSchema.methods.linkDeviceMeasurement = async function(measurementId, deviceId, userId) {
  const DeviceMeasurement = mongoose.model('DeviceMeasurement');
  const measurement = await DeviceMeasurement.findById(measurementId);

  if (!measurement) {
    throw new Error('Measurement not found');
  }

  // Add to deviceMeasurements array if not already linked
  const alreadyLinked = this.deviceMeasurements.some(
    dm => dm.measurement.toString() === measurementId.toString()
  );

  if (!alreadyLinked) {
    this.deviceMeasurements.push({
      measurement: measurementId,
      device: deviceId,
      measurementType: measurement.measurementType,
      linkedAt: new Date(),
      linkedBy: userId,
      appliedToExam: false
    });
    await this.save();
  }

  return this;
};

// Instance method: Apply device measurement data to exam fields
ophthalmologyExamSchema.methods.applyDeviceMeasurement = async function(measurementId, userId) {
  const DeviceMeasurement = mongoose.model('DeviceMeasurement');
  const measurement = await DeviceMeasurement.findById(measurementId).populate('device');

  if (!measurement) {
    throw new Error('Measurement not found');
  }

  // Apply based on measurement type
  switch (measurement.measurementType.toLowerCase()) {
    case 'autorefractor':
    case 'auto-refractor':
      if (measurement.data.refraction) {
        this.refraction = this.refraction || { objective: {} };
        this.refraction.objective.autorefractor = {
          OD: measurement.data.refraction.OD || {},
          OS: measurement.data.refraction.OS || {},
          sourceDevice: measurement.device._id,
          sourceMeasurement: measurement._id,
          importedAt: new Date(),
          importedBy: userId
        };
      }
      break;

    case 'keratometer':
    case 'keratometry':
      if (measurement.data.keratometry) {
        this.keratometry = {
          OD: measurement.data.keratometry.OD || {},
          OS: measurement.data.keratometry.OS || {},
          method: 'auto-k',
          sourceDevice: measurement.device._id,
          sourceMeasurement: measurement._id,
          importedAt: new Date(),
          importedBy: userId
        };
      }
      break;

    case 'tonometer':
    case 'tonometry':
      if (measurement.data.iop) {
        this.iop = this.iop || {};
        if (measurement.data.iop.OD) {
          this.iop.OD = {
            value: measurement.data.iop.OD.value,
            time: measurement.measurementDate,
            method: measurement.device.model || 'device'
          };
        }
        if (measurement.data.iop.OS) {
          this.iop.OS = {
            value: measurement.data.iop.OS.value,
            time: measurement.measurementDate,
            method: measurement.device.model || 'device'
          };
        }
      }
      break;
  }

  // Mark as applied
  const linkedMeasurement = this.deviceMeasurements.find(
    dm => dm.measurement.toString() === measurementId.toString()
  );
  if (linkedMeasurement) {
    linkedMeasurement.appliedToExam = true;
  }

  await this.save();
  return this;
};

// Instance method: Link device image to exam
ophthalmologyExamSchema.methods.linkDeviceImage = async function(imageId, deviceId, userId) {
  const DeviceImage = mongoose.model('DeviceImage');
  const image = await DeviceImage.findById(imageId);

  if (!image) {
    throw new Error('Image not found');
  }

  // Add to deviceImages array if not already linked
  const alreadyLinked = this.deviceImages.some(
    di => di.image.toString() === imageId.toString()
  );

  if (!alreadyLinked) {
    this.deviceImages.push({
      image: imageId,
      device: deviceId,
      imageType: image.imageType,
      linkedAt: new Date(),
      linkedBy: userId
    });
    await this.save();
  }

  return this;
};

// Instance method: Get all linked device measurements with details
ophthalmologyExamSchema.methods.getDeviceMeasurements = async function() {
  await this.populate({
    path: 'deviceMeasurements.measurement',
    populate: { path: 'device' }
  });

  await this.populate({
    path: 'deviceMeasurements.linkedBy',
    select: 'firstName lastName'
  });

  return this.deviceMeasurements;
};

// Instance method: Get all linked device images with details
ophthalmologyExamSchema.methods.getDeviceImages = async function() {
  await this.populate({
    path: 'deviceImages.image',
    populate: { path: 'device' }
  });

  await this.populate({
    path: 'deviceImages.linkedBy',
    select: 'firstName lastName'
  });

  return this.deviceImages;
};

// Static method: Get available device measurements for a patient/exam
ophthalmologyExamSchema.statics.getAvailableDeviceMeasurements = async function(patientId, examDate) {
  const DeviceMeasurement = mongoose.model('DeviceMeasurement');

  // Get measurements from 24 hours before exam to 1 hour after
  const startDate = new Date(examDate);
  startDate.setHours(startDate.getHours() - 24);

  const endDate = new Date(examDate);
  endDate.setHours(endDate.getHours() + 1);

  const measurements = await DeviceMeasurement.find({
    patient: patientId,
    measurementDate: {
      $gte: startDate,
      $lte: endDate
    }
  })
    .populate('device')
    .sort({ measurementDate: -1 });

  return measurements;
};

module.exports = mongoose.model('OphthalmologyExam', ophthalmologyExamSchema);
