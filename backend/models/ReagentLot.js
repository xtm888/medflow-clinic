const mongoose = require('mongoose');

/**
 * ReagentLot Model
 * Tracks reagent lots with manufacturer-provided reference ranges
 * Supports lot-to-lot validation and reference range versioning
 */

// Reference range schema (reusable)
const referenceRangeSchema = new mongoose.Schema({
  // Display text (from package insert)
  text: String,

  // Numeric bounds
  min: Number,
  max: Number,

  // Critical thresholds
  criticalLow: Number,
  criticalHigh: Number,

  // Unit for this range
  unit: {
    type: String,
    required: true
  },

  // Age-specific ranges
  ageSpecific: [{
    ageMin: Number,
    ageMax: Number,
    ageUnit: {
      type: String,
      enum: ['days', 'months', 'years'],
      default: 'years'
    },
    min: Number,
    max: Number
  }],

  // Gender-specific ranges
  male: {
    min: Number,
    max: Number
  },
  female: {
    min: Number,
    max: Number
  },

  // Soft delete support
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date
}, { _id: false });

// Validation result schema
const validationResultSchema = new mongoose.Schema({
  sampleId: String,
  expectedValue: Number,
  actualValue: Number,
  percentDifference: Number,
  withinAcceptance: Boolean,
  notes: String
}, { _id: true });

const reagentLotSchema = new mongoose.Schema({
  // Clinic reference
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true,
    index: true
  },

  // Which analyzer this lot is for
  analyzer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabAnalyzer',
    required: true,
    index: true
  },

  // Which test this reagent is for
  test: {
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LaboratoryTemplate'
    },
    testCode: {
      type: String,
      required: true,
      uppercase: true,
      index: true
    },
    testName: String
  },

  // Lot identification
  lotNumber: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true
  },
  batchNumber: String,

  // Manufacturer info
  manufacturer: {
    type: String,
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  catalogNumber: String,
  packageInsertRef: String,
  packageInsertDate: Date,

  // Dates
  manufactureDate: Date,
  expirationDate: {
    type: Date,
    required: true,
    index: true
  },
  receivedDate: {
    type: Date,
    default: Date.now
  },
  openedDate: Date,
  stabilityAfterOpening: Number, // Days stable after opening

  // ============================================
  // MANUFACTURER REFERENCE RANGES (from package insert)
  // ============================================
  manufacturerReferenceRange: referenceRangeSchema,

  // Alternative unit reference (if manufacturer provides both)
  manufacturerReferenceRangeAlt: referenceRangeSchema,

  // ============================================
  // LAB-VALIDATED REFERENCE RANGES
  // ============================================
  // Lab may adjust ranges after validation
  validatedReferenceRange: referenceRangeSchema,

  // Which range to use
  useValidatedRange: {
    type: Boolean,
    default: false
  },

  // ============================================
  // LOT VALIDATION
  // ============================================
  validation: {
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'passed', 'failed', 'waived'],
      default: 'pending',
      index: true
    },

    // Validation method
    method: {
      type: String,
      enum: ['manufacturer-verification', 'parallel-testing', 'qc-only', 'waived'],
      default: 'manufacturer-verification'
    },

    // Acceptance criteria
    acceptanceCriteria: {
      maxPercentDifference: {
        type: Number,
        default: 10 // 10% difference tolerance
      },
      minSamples: {
        type: Number,
        default: 5
      }
    },

    // Validation results
    results: [validationResultSchema],

    // Summary
    summary: {
      totalSamples: Number,
      passedSamples: Number,
      failedSamples: Number,
      averagePercentDifference: Number,
      maxPercentDifference: Number
    },

    // Validation dates
    startedAt: Date,
    completedAt: Date,
    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,

    // Notes
    notes: String,
    failureReason: String
  },

  // ============================================
  // ACTIVATION STATUS
  // ============================================
  status: {
    type: String,
    enum: ['received', 'validating', 'validated', 'active', 'depleted', 'expired', 'rejected'],
    default: 'received',
    index: true
  },

  // When this lot was activated/deactivated
  activatedAt: Date,
  activatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deactivatedAt: Date,
  deactivatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deactivationReason: String,

  // Stock tracking
  stock: {
    initialQuantity: Number,
    currentQuantity: Number,
    unit: {
      type: String,
      enum: ['tests', 'ml', 'units', 'kits'],
      default: 'tests'
    }
  },

  // Usage tracking
  testsPerformed: {
    type: Number,
    default: 0
  },
  firstUsedAt: Date,
  lastUsedAt: Date,

  // QC data for this lot
  qcHistory: [{
    date: Date,
    level: String,
    targetValue: Number,
    actualValue: Number,
    sd: Number,
    cv: Number,
    withinLimits: Boolean,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Notes
  notes: String,
  storageConditions: String,

  // Audit
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
reagentLotSchema.index({ clinic: 1, analyzer: 1, 'test.testCode': 1, status: 1 });
reagentLotSchema.index({ clinic: 1, lotNumber: 1 });
reagentLotSchema.index({ expirationDate: 1, status: 1 });

// Virtual for days until expiration
reagentLotSchema.virtual('daysUntilExpiration').get(function() {
  if (!this.expirationDate) return null;
  const now = new Date();
  const diff = this.expirationDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual for effective reference range
reagentLotSchema.virtual('effectiveReferenceRange').get(function() {
  if (this.useValidatedRange && this.validatedReferenceRange) {
    return this.validatedReferenceRange;
  }
  return this.manufacturerReferenceRange;
});

// Virtual to check if expired
reagentLotSchema.virtual('isExpired').get(function() {
  return this.expirationDate && new Date() > this.expirationDate;
});

// Virtual to check if expiring soon (within 30 days)
reagentLotSchema.virtual('isExpiringSoon').get(function() {
  const daysLeft = this.daysUntilExpiration;
  return daysLeft !== null && daysLeft <= 30 && daysLeft > 0;
});

// Method to get reference range for a patient
reagentLotSchema.methods.getReferenceRangeForPatient = function(patientAge, patientGender) {
  const range = this.effectiveReferenceRange;
  if (!range) return null;

  const result = {
    min: range.min,
    max: range.max,
    criticalLow: range.criticalLow,
    criticalHigh: range.criticalHigh,
    unit: range.unit,
    text: range.text
  };

  // Check gender-specific
  if (patientGender && range[patientGender.toLowerCase()]) {
    const genderRange = range[patientGender.toLowerCase()];
    if (genderRange.min !== undefined) result.min = genderRange.min;
    if (genderRange.max !== undefined) result.max = genderRange.max;
  }

  // Check age-specific
  if (patientAge !== undefined && range.ageSpecific && range.ageSpecific.length > 0) {
    const ageRange = range.ageSpecific.find(ar =>
      patientAge >= ar.ageMin && patientAge <= ar.ageMax
    );
    if (ageRange) {
      if (ageRange.min !== undefined) result.min = ageRange.min;
      if (ageRange.max !== undefined) result.max = ageRange.max;
    }
  }

  return result;
};

// Method to add validation result
reagentLotSchema.methods.addValidationResult = function(result) {
  if (!this.validation.results) {
    this.validation.results = [];
  }

  const percentDiff = Math.abs((result.actualValue - result.expectedValue) / result.expectedValue * 100);
  const withinAcceptance = percentDiff <= (this.validation.acceptanceCriteria?.maxPercentDifference || 10);

  this.validation.results.push({
    ...result,
    percentDifference: percentDiff,
    withinAcceptance
  });

  // Update summary
  this.updateValidationSummary();

  return this;
};

// Method to update validation summary
reagentLotSchema.methods.updateValidationSummary = function() {
  const results = this.validation.results || [];
  if (results.length === 0) return;

  const passed = results.filter(r => r.withinAcceptance).length;
  const percentDiffs = results.map(r => r.percentDifference);

  this.validation.summary = {
    totalSamples: results.length,
    passedSamples: passed,
    failedSamples: results.length - passed,
    averagePercentDifference: percentDiffs.reduce((a, b) => a + b, 0) / percentDiffs.length,
    maxPercentDifference: Math.max(...percentDiffs)
  };
};

// Method to complete validation
reagentLotSchema.methods.completeValidation = function(userId, approved, notes) {
  const minSamples = this.validation.acceptanceCriteria?.minSamples || 5;
  const summary = this.validation.summary;

  if (!summary || summary.totalSamples < minSamples) {
    throw new Error(`Minimum ${minSamples} samples required for validation`);
  }

  // Check if passed (90% of samples within acceptance)
  const passRate = summary.passedSamples / summary.totalSamples;
  const passed = passRate >= 0.9 && approved;

  this.validation.status = passed ? 'passed' : 'failed';
  this.validation.completedAt = new Date();
  this.validation.validatedBy = userId;
  this.validation.notes = notes;

  if (passed) {
    this.status = 'validated';
    this.validation.approvedBy = userId;
    this.validation.approvedAt = new Date();
  } else {
    this.status = 'rejected';
    this.validation.failureReason = notes || 'Validation criteria not met';
  }

  return this;
};

// Method to activate lot
reagentLotSchema.methods.activate = function(userId) {
  if (this.status !== 'validated' && this.validation.status !== 'waived') {
    throw new Error('Lot must be validated before activation');
  }
  if (this.isExpired) {
    throw new Error('Cannot activate expired lot');
  }

  this.status = 'active';
  this.activatedAt = new Date();
  this.activatedBy = userId;

  return this;
};

// Method to record test usage
reagentLotSchema.methods.recordUsage = function(count = 1) {
  this.testsPerformed += count;
  this.lastUsedAt = new Date();
  if (!this.firstUsedAt) {
    this.firstUsedAt = new Date();
  }

  // Update stock if tracked
  if (this.stock.currentQuantity !== undefined) {
    this.stock.currentQuantity = Math.max(0, this.stock.currentQuantity - count);
    if (this.stock.currentQuantity === 0) {
      this.status = 'depleted';
    }
  }

  return this;
};

// Static to find active lot for analyzer/test
reagentLotSchema.statics.findActiveLot = function(clinicId, analyzerId, testCode) {
  return this.findOne({
    clinic: clinicId,
    analyzer: analyzerId,
    'test.testCode': testCode,
    status: 'active',
    isActive: true,
    expirationDate: { $gt: new Date() }
  }).sort({ activatedAt: -1 });
};

// Static to find lots expiring soon
reagentLotSchema.statics.findExpiringSoon = function(clinicId, daysAhead = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return this.find({
    clinic: clinicId,
    status: { $in: ['validated', 'active'] },
    isActive: true,
    expirationDate: {
      $gt: new Date(),
      $lte: futureDate
    }
  }).sort({ expirationDate: 1 });
};

// Static to find lots needing validation
reagentLotSchema.statics.findPendingValidation = function(clinicId) {
  return this.find({
    clinic: clinicId,
    'validation.status': { $in: ['pending', 'in-progress'] },
    isActive: true
  }).sort({ receivedDate: 1 });
};

// Ensure virtuals are included
reagentLotSchema.set('toJSON', { virtuals: true });
reagentLotSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ReagentLot', reagentLotSchema);
