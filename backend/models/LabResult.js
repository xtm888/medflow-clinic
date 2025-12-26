const mongoose = require('mongoose');
const Counter = require('./Counter');

/**
 * Lab Result Model
 * Stores laboratory test results for patients
 */
const labResultSchema = new mongoose.Schema({
  resultId: {
    type: String,
    unique: true
  },

  labOrder: {
    type: mongoose.Schema.ObjectId,
    ref: 'LabOrder',
    required: [true, 'Lab order reference is required']
  },

  patient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient is required']
  },

  clinic: {
    type: mongoose.Schema.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic is required for multi-tenant isolation'],
    index: true
  },

  test: {
    template: {
      type: mongoose.Schema.ObjectId,
      ref: 'LaboratoryTemplate'
    },
    testName: {
      type: String,
      required: true
    },
    testCode: String,
    category: String,
    method: String
  },

  results: [{
    parameter: {
      type: String,
      required: true
    },
    value: mongoose.Schema.Types.Mixed,
    numericValue: Number,
    textValue: String,
    unit: String,
    referenceRange: {
      low: Number,
      high: Number,
      text: String,
      ageSpecific: Boolean,
      genderSpecific: Boolean
    },
    flag: {
      type: String,
      enum: ['normal', 'low', 'high', 'critical-low', 'critical-high', 'abnormal', 'panic'],
      default: 'normal'
    },
    interpretation: String,
    delta: {
      previousValue: mongoose.Schema.Types.Mixed,
      change: Number,
      changePercent: Number,
      trend: {
        type: String,
        enum: ['increasing', 'decreasing', 'stable', 'na']
      }
    }
  }],

  overallInterpretation: String,

  status: {
    type: String,
    enum: ['preliminary', 'partial', 'final', 'corrected', 'amended', 'cancelled'],
    default: 'preliminary'
  },

  // Workflow tracking
  performedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  performedAt: Date,

  reviewedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,

  verifiedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,

  reportedAt: Date,

  // Correction/Amendment tracking
  corrections: [{
    correctedAt: Date,
    correctedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    reason: String,
    previousResults: mongoose.Schema.Types.Mixed
  }],

  // Critical value notification
  criticalValue: {
    detected: {
      type: Boolean,
      default: false
    },
    parameters: [String],
    notifiedAt: Date,
    notifiedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    acknowledgedAt: Date,
    acknowledgedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    callbackNumber: String,
    callbackNotes: String
  },

  // Quality control and traceability
  qc: {
    instrumentId: String, // Legacy field for backwards compatibility
    reagentLot: String,   // Legacy field for backwards compatibility
    calibrationDate: Date,
    controlResults: [{
      level: String,
      expected: Number,
      actual: Number,
      withinLimits: Boolean
    }]
  },

  // =====================================================
  // ANALYZER & REAGENT LOT TRACEABILITY
  // =====================================================
  analyzer: {
    type: mongoose.Schema.ObjectId,
    ref: 'LabAnalyzer'
  },
  analyzerInfo: {
    code: String,
    name: String,
    manufacturer: String,
    model: String
  },

  reagentLot: {
    type: mongoose.Schema.ObjectId,
    ref: 'ReagentLot'
  },
  reagentLotInfo: {
    lotNumber: String,
    expirationDate: Date,
    manufacturer: String
  },

  // Reference range used for this result
  referenceRangeUsed: {
    source: {
      type: String,
      enum: ['template-default', 'analyzer-specific', 'reagent-lot', 'lab-validated', 'manual'],
      default: 'template-default'
    },
    min: Number,
    max: Number,
    criticalLow: Number,
    criticalHigh: Number,
    unit: String,
    text: String,
    appliedFor: {
      patientAge: Number,
      patientGender: String
    }
  },

  // Unit information
  resultUnit: {
    reported: String,      // Unit in which result is reported
    reportedType: {
      type: String,
      enum: ['SI', 'conventional']
    },
    originalUnit: String,   // Original unit from analyzer
    conversionApplied: Boolean
  },

  comments: String,

  attachments: [{
    filename: String,
    originalName: String,
    url: String,
    mimeType: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    description: String
  }],

  // Integration data
  externalData: {
    source: String,
    messageId: String,
    receivedAt: Date,
    rawData: mongoose.Schema.Types.Mixed
  },

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

// Indexes for performance
labResultSchema.index({ patient: 1, performedAt: -1 });
labResultSchema.index({ clinic: 1, status: 1, performedAt: -1 });
labResultSchema.index({ clinic: 1, patient: 1, performedAt: -1 });
labResultSchema.index({ labOrder: 1 });
labResultSchema.index({ resultId: 1 }, { unique: true });
labResultSchema.index({ status: 1 });
labResultSchema.index({ 'test.testCode': 1, patient: 1, performedAt: -1 });
labResultSchema.index({ 'criticalValue.detected': 1, 'criticalValue.acknowledgedAt': 1 });
labResultSchema.index({ createdAt: -1 });
labResultSchema.index({ analyzer: 1 });
labResultSchema.index({ reagentLot: 1 });
labResultSchema.index({ 'reagentLotInfo.lotNumber': 1 });
// Soft delete index
labResultSchema.index({ clinic: 1, isDeleted: 1 });

// Query middleware - exclude deleted records by default
labResultSchema.pre('find', function() {
  if (!this.getQuery().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

labResultSchema.pre('findOne', function() {
  if (!this.getQuery().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

labResultSchema.pre('countDocuments', function() {
  if (!this.getQuery().includeDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

// Soft delete method
labResultSchema.methods.softDelete = async function(deletedByUserId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedByUserId;
  return await this.save();
};

// Restore method
labResultSchema.methods.restore = async function() {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return await this.save();
};

// Virtual for abnormal count
labResultSchema.virtual('abnormalCount').get(function() {
  if (!this.results) return 0;
  return this.results.filter(r => r.flag && r.flag !== 'normal').length;
});

// Virtual for critical flag
labResultSchema.virtual('hasCritical').get(function() {
  if (!this.results) return false;
  return this.results.some(r => r.flag && (r.flag.includes('critical') || r.flag === 'panic'));
});

// Generate result ID before saving
labResultSchema.pre('save', async function(next) {
  if (this.isNew && !this.resultId) {
    const counterId = Counter.getYearlyCounterId('labResult');
    const sequence = await Counter.getNextSequence(counterId);
    const year = new Date().getFullYear();
    this.resultId = `RES${year}${String(sequence).padStart(6, '0')}`;
  }

  // Check for critical values
  if (this.isModified('results')) {
    const criticalParams = this.results.filter(r =>
      r.flag && (r.flag.includes('critical') || r.flag === 'panic')
    ).map(r => r.parameter);

    if (criticalParams.length > 0) {
      this.criticalValue.detected = true;
      this.criticalValue.parameters = criticalParams;
    }
  }

  next();
});

// Post save - update lab order
labResultSchema.post('save', async function() {
  try {
    const LabOrder = mongoose.model('LabOrder');
    const labOrder = await LabOrder.findById(this.labOrder);

    if (labOrder) {
      // Update the test status in the order
      const testIndex = labOrder.tests.findIndex(t =>
        t.results && t.results.toString() === this._id.toString()
      );

      if (testIndex === -1) {
        // Link result to first matching pending test
        const pendingTest = labOrder.tests.find(t =>
          t.testName === this.test.testName && !t.results
        );
        if (pendingTest) {
          pendingTest.results = this._id;
          pendingTest.status = this.status === 'final' ? 'completed' : 'in-progress';
        }
      }

      // Update order status if all tests completed
      const allCompleted = labOrder.tests.every(t => t.status === 'completed');
      if (allCompleted) {
        labOrder.status = 'completed';
      } else if (labOrder.tests.some(t => t.status === 'completed' || t.status === 'in-progress')) {
        labOrder.status = 'in-progress';
      }

      await labOrder.save();
    }
  } catch (error) {
    console.error('Error updating lab order after result save:', error);
  }
});

// Static method to get patient's result history for a specific test
labResultSchema.statics.getTestHistory = async function(patientId, testCode, options = {}) {
  const query = {
    patient: patientId,
    'test.testCode': testCode,
    status: { $in: ['final', 'corrected', 'amended'] }
  };

  return this.find(query)
    .sort({ performedAt: -1 })
    .limit(options.limit || 20)
    .select('resultId test results performedAt status');
};

// Static method to get unacknowledged critical results
labResultSchema.statics.getUnacknowledgedCritical = async function() {
  return this.find({
    'criticalValue.detected': true,
    'criticalValue.acknowledgedAt': { $exists: false }
  })
    .populate('patient', 'firstName lastName patientId phoneNumber')
    .populate('labOrder', 'orderedBy')
    .sort({ createdAt: -1 });
};

// Instance method to verify result
labResultSchema.methods.verify = async function(verifiedBy) {
  this.status = 'final';
  this.verifiedBy = verifiedBy;
  this.verifiedAt = new Date();
  this.reportedAt = new Date();
  this.updatedBy = verifiedBy;
  return this.save();
};

// Instance method to correct result
labResultSchema.methods.correct = async function(correctedBy, newResults, reason) {
  this.corrections.push({
    correctedAt: new Date(),
    correctedBy,
    reason,
    previousResults: this.results
  });

  this.results = newResults;
  this.status = 'corrected';
  this.updatedBy = correctedBy;
  return this.save();
};

// Instance method to acknowledge critical value
labResultSchema.methods.acknowledgeCritical = async function(acknowledgedBy, notes) {
  this.criticalValue.acknowledgedAt = new Date();
  this.criticalValue.acknowledgedBy = acknowledgedBy;
  if (notes) this.criticalValue.callbackNotes = notes;
  this.updatedBy = acknowledgedBy;
  return this.save();
};

// Instance method to set analyzer and auto-populate info
labResultSchema.methods.setAnalyzer = async function(analyzerId) {
  const LabAnalyzer = mongoose.model('LabAnalyzer');
  const analyzer = await LabAnalyzer.findById(analyzerId);

  if (!analyzer) {
    throw new Error('Analyseur non trouvé');
  }

  this.analyzer = analyzerId;
  this.analyzerInfo = {
    code: analyzer.code,
    name: analyzer.name,
    manufacturer: analyzer.manufacturer,
    model: analyzer.model
  };

  // Also set legacy field for backwards compatibility
  this.qc.instrumentId = analyzer.code;

  return this;
};

// Instance method to set reagent lot and auto-populate info
labResultSchema.methods.setReagentLot = async function(reagentLotId, recordUsage = true) {
  const ReagentLot = mongoose.model('ReagentLot');
  const lot = await ReagentLot.findById(reagentLotId);

  if (!lot) {
    throw new Error('Lot de réactif non trouvé');
  }

  this.reagentLot = reagentLotId;
  this.reagentLotInfo = {
    lotNumber: lot.lotNumber,
    expirationDate: lot.expirationDate,
    manufacturer: lot.manufacturer
  };

  // Also set legacy field for backwards compatibility
  this.qc.reagentLot = lot.lotNumber;

  // Record usage on the lot
  if (recordUsage) {
    lot.recordUsage(1);
    await lot.save();
  }

  return this;
};

// Instance method to calculate and apply reference range
labResultSchema.methods.applyReferenceRange = async function(patientAge, patientGender) {
  const LaboratoryTemplate = mongoose.model('LaboratoryTemplate');
  const ReagentLot = mongoose.model('ReagentLot');

  let range = null;
  let source = 'template-default';

  // Priority: ReagentLot > Analyzer-specific > Template default
  if (this.reagentLot) {
    const lot = await ReagentLot.findById(this.reagentLot);
    if (lot) {
      range = lot.getReferenceRangeForPatient(patientAge, patientGender);
      if (range && range.min !== undefined) {
        source = lot.useValidatedRange ? 'lab-validated' : 'reagent-lot';
      }
    }
  }

  if (!range && this.test.template) {
    const template = await LaboratoryTemplate.findById(this.test.template);
    if (template) {
      if (this.analyzer) {
        range = template.getReferenceRangeForAnalyzer(this.analyzer, patientAge, patientGender);
        source = range.source === 'analyzer-specific' ? 'analyzer-specific' : 'template-default';
      } else {
        // Use default template range
        const result = template.isAbnormal(null, patientAge, patientGender);
        // Get range from template directly
        let templateRange = template.referenceRange || {};
        if (patientGender && templateRange[patientGender.toLowerCase()]) {
          templateRange = { ...templateRange, ...templateRange[patientGender.toLowerCase()] };
        }
        range = {
          min: templateRange.min,
          max: templateRange.max,
          criticalLow: templateRange.criticalLow,
          criticalHigh: templateRange.criticalHigh,
          unit: template.unit,
          text: templateRange.text
        };
      }
    }
  }

  if (range) {
    this.referenceRangeUsed = {
      source,
      min: range.min,
      max: range.max,
      criticalLow: range.criticalLow,
      criticalHigh: range.criticalHigh,
      unit: range.unit,
      text: range.text,
      appliedFor: {
        patientAge,
        patientGender
      }
    };

    // Update individual result flags based on the reference range
    if (this.results && this.results.length > 0) {
      this.results.forEach(r => {
        if (r.numericValue !== undefined && r.numericValue !== null) {
          // Update individual result reference range
          r.referenceRange = {
            low: range.min,
            high: range.max,
            text: range.text
          };

          // Calculate flag
          const value = r.numericValue;
          if (range.criticalLow !== undefined && value < range.criticalLow) {
            r.flag = 'critical-low';
          } else if (range.criticalHigh !== undefined && value > range.criticalHigh) {
            r.flag = 'critical-high';
          } else if (range.min !== undefined && value < range.min) {
            r.flag = 'low';
          } else if (range.max !== undefined && value > range.max) {
            r.flag = 'high';
          } else {
            r.flag = 'normal';
          }
        }
      });
    }
  }

  return this;
};

// Static method to find results by reagent lot (for lot investigation)
labResultSchema.statics.findByReagentLot = function(reagentLotId, options = {}) {
  const query = { reagentLot: reagentLotId };

  return this.find(query)
    .populate('patient', 'firstName lastName patientId')
    .populate('test.template', 'name code')
    .sort({ performedAt: -1 })
    .limit(options.limit || 100);
};

// Static method to find results by analyzer (for instrument investigation)
labResultSchema.statics.findByAnalyzer = function(analyzerId, options = {}) {
  const query = { analyzer: analyzerId };

  if (options.startDate || options.endDate) {
    query.performedAt = {};
    if (options.startDate) query.performedAt.$gte = options.startDate;
    if (options.endDate) query.performedAt.$lte = options.endDate;
  }

  return this.find(query)
    .populate('patient', 'firstName lastName patientId')
    .populate('test.template', 'name code')
    .sort({ performedAt: -1 })
    .limit(options.limit || 100);
};

module.exports = mongoose.model('LabResult', labResultSchema);
