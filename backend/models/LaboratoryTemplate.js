const mongoose = require('mongoose');

// Component schema for individual test components
const componentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  code: String,
  unit: String,
  // Structured reference ranges
  referenceRange: {
    // Text representation for display
    text: String,
    // Structured numeric ranges
    min: Number,
    max: Number,
    // Critical value thresholds
    criticalLow: Number,
    criticalHigh: Number,
    // Age-specific ranges
    ageSpecific: [{
      ageMin: Number,
      ageMax: Number,
      min: Number,
      max: Number,
      unit: String
    }],
    // Gender-specific ranges
    male: {
      min: Number,
      max: Number
    },
    female: {
      min: Number,
      max: Number
    }
  },
  resultType: {
    type: String,
    enum: ['numeric', 'text', 'select', 'boolean'],
    default: 'numeric'
  },
  // For select type results
  selectOptions: [String],
  // For numeric results
  decimalPlaces: {
    type: Number,
    default: 2
  },
  order: {
    type: Number,
    default: 0
  }
});

const laboratoryTemplateSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: [
      'CHECK UP PROMO',
      'HEMOGRAMME',
      'CHIRURGIE OPHTALMOLOGIQUE',
      'FONCTION HEPATO-RENALE',
      'PROFIL DIABETIQUE A',
      'PROFIL DIABETIQUE B',
      'PROFIL INFECTIEUX',
      'PROFIL LIPIDIQUE',
      'BACTERIOLOGIE',
      'BIOCHIMIE FONCTION HEPATIQUE',
      'BIOCHIMIE FONCTION RENALE',
      'BIOCHIMIE LIPIDES',
      'BIOCHIMIE MYOCARDE',
      'BIOCHIMIE PANCREAS',
      'BIOCHIMIE TEST INFLAMMATOIRE',
      'BIOCHIMIE URINAIRE',
      'DIVERS',
      'HEMATOLOGIE',
      'HORMONOLOGIE',
      'IMMUNO-SEROLOGIE',
      'PARASITOLOGIE',
      'SEDIMENT URINAIRE',
      'SEROLOGIE',
      'SEROLOGIE VIRALE',
      'COAGULATION',
      'PROTEINES',
      'IONOGRAMME SANGUIN',
      'REINS',
      'FOIE',
      'PANCREAS',
      'THYROIDE',
      'SEROLOGIE AUTO IMMUNE',
      'DIABETE',
      'COPRO-PARASITOLOGIE',
      'MARQUEURS TUMORAUX',
      'MARQUEURS CARDIAQUES',
      'URINES',
      'URINES DE 24',
      'PROFIL UVEITE'
    ]
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  nameEn: {
    type: String,
    trim: true
  },
  code: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  description: {
    type: String,
    trim: true
  },
  specimen: {
    type: String,
    enum: ['Sang', 'Urine', 'Selles', 'LCR', 'Prélèvement', 'Liquide synovial', 'Crachat', 'Autre'],
    default: 'Sang'
  },
  // Specimen collection details
  specimenDetails: {
    container: String, // Tube type (EDTA, Heparin, etc.)
    containerColor: String, // Purple, Red, Green, etc.
    volume: String, // Minimum volume required
    handling: String, // Special handling instructions
    stability: {
      roomTemp: String,
      refrigerated: String,
      frozen: String
    }
  },
  // Legacy string format (kept for backwards compatibility)
  normalRange: {
    type: String,
    trim: true
  },
  // NEW: Structured reference ranges
  referenceRange: {
    text: String,
    min: Number,
    max: Number,
    criticalLow: Number,
    criticalHigh: Number,
    ageSpecific: [{
      ageMin: Number,
      ageMax: Number,
      min: Number,
      max: Number,
      unit: String
    }],
    male: {
      min: Number,
      max: Number
    },
    female: {
      min: Number,
      max: Number
    }
  },
  unit: {
    type: String,
    trim: true
  },
  resultType: {
    type: String,
    enum: ['numeric', 'text', 'select', 'boolean'],
    default: 'numeric'
  },
  selectOptions: [String],
  decimalPlaces: {
    type: Number,
    default: 2
  },
  turnaroundTime: {
    type: Number, // in hours
    default: 24
  },
  price: {
    type: Number,
    default: 0
  },
  isProfile: {
    type: Boolean,
    default: false // true if this is a collection of tests (e.g., CHECK UP PROMO)
  },
  profileTests: [{
    type: mongoose.Schema.ObjectId,
    ref: 'LaboratoryTemplate'
  }],
  // NEW: Components for profile tests - individual test items
  components: [componentSchema],
  // Method requirements
  requiresFasting: {
    type: Boolean,
    default: false
  },
  fastingHours: {
    type: Number,
    default: 8
  },
  // Clinical information
  clinicalSignificance: String,
  interpretation: {
    low: String,
    normal: String,
    high: String,
    critical: String
  },

  // ============================================
  // UNIT CONVERSION SUPPORT
  // ============================================
  units: {
    // Primary reporting unit
    primary: {
      type: String,
      trim: true
    },
    primaryType: {
      type: String,
      enum: ['SI', 'conventional'],
      default: 'conventional'
    },
    // Alternative units for display
    alternatives: [{
      unit: String,
      type: {
        type: String,
        enum: ['SI', 'conventional']
      }
    }]
  },

  // Link to UnitConversion table
  unitConversion: {
    type: mongoose.Schema.ObjectId,
    ref: 'UnitConversion'
  },

  // ============================================
  // ANALYZER-SPECIFIC CONFIGURATIONS
  // ============================================
  analyzerConfigs: [{
    analyzer: {
      type: mongoose.Schema.ObjectId,
      ref: 'LabAnalyzer'
    },
    analyzerName: String,   // Cached for display
    manufacturer: String,    // Cached for display

    // Method info for this analyzer
    methodName: String,
    methodCode: String,

    // Analyzer-specific reference range
    referenceRange: {
      text: String,
      min: Number,
      max: Number,
      criticalLow: Number,
      criticalHigh: Number,
      unit: String,
      ageSpecific: [{
        ageMin: Number,
        ageMax: Number,
        min: Number,
        max: Number
      }],
      male: { min: Number, max: Number },
      female: { min: Number, max: Number }
    },

    // Source of reference range
    referenceSource: {
      type: String,
      enum: ['manufacturer', 'lab-validated', 'literature', 'caliper'],
      default: 'manufacturer'
    },
    packageInsertRef: String,
    validationDate: Date,

    // Whether this is the default analyzer for this test
    isDefault: {
      type: Boolean,
      default: false
    },

    isActive: {
      type: Boolean,
      default: true
    }
  }],

  // Default analyzer for this test
  defaultAnalyzer: {
    type: mongoose.Schema.ObjectId,
    ref: 'LabAnalyzer'
  },

  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

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

// Method to check if a result is abnormal
laboratoryTemplateSchema.methods.isAbnormal = function(value, patientAge, patientGender) {
  if (value === null || value === undefined || this.resultType !== 'numeric') {
    return { isAbnormal: false, flag: null };
  }

  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return { isAbnormal: false, flag: null };
  }

  let range = this.referenceRange || {};

  // Check gender-specific ranges first
  if (patientGender && range[patientGender.toLowerCase()]) {
    range = { ...range, ...range[patientGender.toLowerCase()] };
  }

  // Check age-specific ranges
  if (patientAge && range.ageSpecific && range.ageSpecific.length > 0) {
    const ageRange = range.ageSpecific.find(ar =>
      patientAge >= ar.ageMin && patientAge <= ar.ageMax
    );
    if (ageRange) {
      range = { ...range, min: ageRange.min, max: ageRange.max };
    }
  }

  // Check critical values first
  if (range.criticalLow !== undefined && numValue < range.criticalLow) {
    return { isAbnormal: true, flag: 'critical_low', severity: 'critical' };
  }
  if (range.criticalHigh !== undefined && numValue > range.criticalHigh) {
    return { isAbnormal: true, flag: 'critical_high', severity: 'critical' };
  }

  // Check normal range
  if (range.min !== undefined && numValue < range.min) {
    return { isAbnormal: true, flag: 'low', severity: 'abnormal' };
  }
  if (range.max !== undefined && numValue > range.max) {
    return { isAbnormal: true, flag: 'high', severity: 'abnormal' };
  }

  return { isAbnormal: false, flag: 'normal', severity: 'normal' };
};

// Static method to validate result against reference range
laboratoryTemplateSchema.statics.validateResult = function(templateId, value, patientAge, patientGender) {
  return this.findById(templateId).then(template => {
    if (!template) return { valid: false, error: 'Template not found' };
    return template.isAbnormal(value, patientAge, patientGender);
  });
};

// ============================================
// ANALYZER-SPECIFIC METHODS
// ============================================

// Method to get reference range for a specific analyzer
laboratoryTemplateSchema.methods.getReferenceRangeForAnalyzer = function(analyzerId, patientAge, patientGender) {
  // Find analyzer-specific config
  const analyzerConfig = this.analyzerConfigs?.find(
    ac => ac.analyzer?.toString() === analyzerId?.toString() && ac.isActive
  );

  // Use analyzer-specific range if available, otherwise fall back to default
  const range = analyzerConfig?.referenceRange || this.referenceRange || {};

  const result = {
    min: range.min,
    max: range.max,
    criticalLow: range.criticalLow,
    criticalHigh: range.criticalHigh,
    unit: range.unit || this.unit,
    text: range.text,
    source: analyzerConfig ? 'analyzer-specific' : 'default',
    analyzerId: analyzerConfig?.analyzer,
    analyzerName: analyzerConfig?.analyzerName
  };

  // Apply gender-specific adjustments
  if (patientGender && range[patientGender.toLowerCase()]) {
    const genderRange = range[patientGender.toLowerCase()];
    if (genderRange.min !== undefined) result.min = genderRange.min;
    if (genderRange.max !== undefined) result.max = genderRange.max;
  }

  // Apply age-specific adjustments
  if (patientAge !== undefined && range.ageSpecific && range.ageSpecific.length > 0) {
    const ageRange = range.ageSpecific.find(ar =>
      patientAge >= ar.ageMin && patientAge <= ar.ageMax
    );
    if (ageRange) {
      if (ageRange.min !== undefined) result.min = ageRange.min;
      if (ageRange.max !== undefined) result.max = ageRange.max;
    }
  }

  // Generate text if not provided
  if (!result.text && result.min !== undefined && result.max !== undefined) {
    result.text = `${result.min} - ${result.max} ${result.unit || ''}`.trim();
  }

  return result;
};

// Method to check abnormal with analyzer-specific range
laboratoryTemplateSchema.methods.isAbnormalForAnalyzer = function(value, analyzerId, patientAge, patientGender) {
  if (value === null || value === undefined || this.resultType !== 'numeric') {
    return { isAbnormal: false, flag: null };
  }

  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return { isAbnormal: false, flag: null };
  }

  const range = this.getReferenceRangeForAnalyzer(analyzerId, patientAge, patientGender);

  // Check critical values first
  if (range.criticalLow !== undefined && numValue < range.criticalLow) {
    return { isAbnormal: true, flag: 'critical_low', severity: 'critical', range };
  }
  if (range.criticalHigh !== undefined && numValue > range.criticalHigh) {
    return { isAbnormal: true, flag: 'critical_high', severity: 'critical', range };
  }

  // Check normal range
  if (range.min !== undefined && numValue < range.min) {
    return { isAbnormal: true, flag: 'low', severity: 'abnormal', range };
  }
  if (range.max !== undefined && numValue > range.max) {
    return { isAbnormal: true, flag: 'high', severity: 'abnormal', range };
  }

  return { isAbnormal: false, flag: 'normal', severity: 'normal', range };
};

// Method to add or update analyzer configuration
laboratoryTemplateSchema.methods.setAnalyzerConfig = function(analyzerId, config) {
  if (!this.analyzerConfigs) {
    this.analyzerConfigs = [];
  }

  const existingIndex = this.analyzerConfigs.findIndex(
    ac => ac.analyzer?.toString() === analyzerId?.toString()
  );

  const configData = {
    analyzer: analyzerId,
    analyzerName: config.analyzerName,
    manufacturer: config.manufacturer,
    methodName: config.methodName,
    methodCode: config.methodCode,
    referenceRange: config.referenceRange,
    referenceSource: config.referenceSource || 'manufacturer',
    packageInsertRef: config.packageInsertRef,
    validationDate: config.validationDate,
    isDefault: config.isDefault || false,
    isActive: config.isActive !== false
  };

  if (existingIndex >= 0) {
    this.analyzerConfigs[existingIndex] = {
      ...this.analyzerConfigs[existingIndex].toObject(),
      ...configData
    };
  } else {
    this.analyzerConfigs.push(configData);
  }

  // Update default analyzer if this is marked as default
  if (config.isDefault) {
    this.defaultAnalyzer = analyzerId;
    // Unset other defaults
    this.analyzerConfigs.forEach(ac => {
      if (ac.analyzer?.toString() !== analyzerId?.toString()) {
        ac.isDefault = false;
      }
    });
  }

  return this;
};

// Method to convert result to different unit
laboratoryTemplateSchema.methods.convertResult = async function(value, fromUnit, toUnit) {
  const UnitConversion = mongoose.model('UnitConversion');

  // Try to find conversion by linked unitConversion
  let conversion;
  if (this.unitConversion) {
    conversion = await UnitConversion.findById(this.unitConversion);
  }

  // Or by test code
  if (!conversion && this.code) {
    conversion = await UnitConversion.findForTest(this.code);
  }

  if (!conversion) {
    throw new Error(`No unit conversion found for test ${this.name}`);
  }

  return conversion.convert(value, fromUnit, toUnit);
};

// ============================================
// STATIC METHODS
// ============================================

// Static to find templates that support a specific analyzer
laboratoryTemplateSchema.statics.findByAnalyzer = function(analyzerId) {
  return this.find({
    isActive: true,
    $or: [
      { 'analyzerConfigs.analyzer': analyzerId, 'analyzerConfigs.isActive': true },
      { defaultAnalyzer: analyzerId }
    ]
  });
};

// Static to get reference range for test/analyzer combination
laboratoryTemplateSchema.statics.getReferenceRange = async function(testCode, analyzerId, patientAge, patientGender) {
  const template = await this.findOne({
    $or: [{ code: testCode }, { name: testCode }],
    isActive: true
  });

  if (!template) {
    return { found: false, error: 'Test template not found' };
  }

  const range = template.getReferenceRangeForAnalyzer(analyzerId, patientAge, patientGender);
  return {
    found: true,
    testCode: template.code,
    testName: template.name,
    ...range
  };
};

// Indexes
laboratoryTemplateSchema.index({ name: 'text', description: 'text' });
laboratoryTemplateSchema.index({ category: 1, name: 1 });
laboratoryTemplateSchema.index({ code: 1 });
laboratoryTemplateSchema.index({ isProfile: 1 });
laboratoryTemplateSchema.index({ 'analyzerConfigs.analyzer': 1 });
laboratoryTemplateSchema.index({ defaultAnalyzer: 1 });

module.exports = mongoose.model('LaboratoryTemplate', laboratoryTemplateSchema);
