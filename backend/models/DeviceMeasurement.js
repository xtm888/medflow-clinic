const mongoose = require('mongoose');

const deviceMeasurementSchema = new mongoose.Schema({
  // Measurement identification
  measurementId: {
    type: String,
    unique: true,
    sparse: true
  },

  // Device reference
  device: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },

  deviceType: {
    type: String,
    required: true
  },

  // Patient and visit association
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },

  visit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Visit'
  },

  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },

  // Measurement metadata
  measurementDate: {
    type: Date,
    required: true,
    default: Date.now
  },

  measurementType: {
    type: String,
    required: true
  },

  eye: {
    type: String,
    enum: ['OD', 'OS', 'OU', 'NA'],
    default: 'OU'
  },

  // Auto-refractor measurements
  autoRefraction: {
    OD: {
      sphere: Number,
      cylinder: Number,
      axis: Number,
      va: String,
      confidence: Number,
      pupilSize: Number,
      vertexDistance: Number
    },
    OS: {
      sphere: Number,
      cylinder: Number,
      axis: Number,
      va: String,
      confidence: Number,
      pupilSize: Number,
      vertexDistance: Number
    }
  },

  // Keratometry measurements
  keratometry: {
    OD: {
      k1: {
        power: Number,
        axis: Number,
        radius: Number
      },
      k2: {
        power: Number,
        axis: Number,
        radius: Number
      },
      average: Number,
      cylinder: Number,
      axisOfCylinder: Number
    },
    OS: {
      k1: {
        power: Number,
        axis: Number,
        radius: Number
      },
      k2: {
        power: Number,
        axis: Number,
        radius: Number
      },
      average: Number,
      cylinder: Number,
      axisOfCylinder: Number
    }
  },

  // Tonometry measurements
  tonometry: {
    OD: {
      iop: Number,
      method: String, // 'applanation', 'non-contact', 'rebound'
      time: String,
      correctionFactor: Number,
      correctedIOP: Number,
      pachymetry: Number,
      readings: [Number] // Multiple readings if taken
    },
    OS: {
      iop: Number,
      method: String,
      time: String,
      correctionFactor: Number,
      correctedIOP: Number,
      pachymetry: Number,
      readings: [Number]
    }
  },

  // Visual field / Perimetry
  perimetry: {
    OD: {
      testType: String, // '24-2', '30-2', '10-2', etc.
      strategy: String, // 'SITA-Standard', 'SITA-Fast', etc.
      md: Number, // Mean Deviation
      psd: Number, // Pattern Standard Deviation
      vfi: Number, // Visual Field Index
      reliability: {
        fixationLosses: Number,
        falsePositives: Number,
        falseNegatives: Number
      },
      testDuration: Number, // seconds
      fovea: String,
      defects: [String],
      progression: String
    },
    OS: {
      testType: String,
      strategy: String,
      md: Number,
      psd: Number,
      vfi: Number,
      reliability: {
        fixationLosses: Number,
        falsePositives: Number,
        falseNegatives: Number
      },
      testDuration: Number,
      fovea: String,
      defects: [String],
      progression: String
    }
  },

  // OCT measurements
  oct: {
    OD: {
      rnfl: { // Retinal Nerve Fiber Layer
        average: Number,
        superior: Number,
        inferior: Number,
        nasal: Number,
        temporal: Number,
        classification: String // 'normal', 'borderline', 'abnormal'
      },
      macula: {
        centralThickness: Number,
        volume: Number,
        gccThickness: Number, // Ganglion Cell Complex
        grid: mongoose.Schema.Types.Mixed // 9-zone grid values
      },
      opticDisc: {
        cupToDiscRatio: Number,
        cupVolume: Number,
        rimArea: Number,
        discArea: Number
      },
      quality: Number,
      signalStrength: Number
    },
    OS: {
      rnfl: {
        average: Number,
        superior: Number,
        inferior: Number,
        nasal: Number,
        temporal: Number,
        classification: String
      },
      macula: {
        centralThickness: Number,
        volume: Number,
        gccThickness: Number,
        grid: mongoose.Schema.Types.Mixed
      },
      opticDisc: {
        cupToDiscRatio: Number,
        cupVolume: Number,
        rimArea: Number,
        discArea: Number
      },
      quality: Number,
      signalStrength: Number
    }
  },

  // Topography measurements
  topography: {
    OD: {
      simK: {
        steep: Number,
        flat: Number,
        average: Number,
        astigmatism: Number
      },
      elevation: {
        anterior: mongoose.Schema.Types.Mixed,
        posterior: mongoose.Schema.Types.Mixed
      },
      pachymetry: {
        central: Number,
        thinnest: Number,
        location: { x: Number, y: Number }
      },
      indices: {
        kmax: Number,
        isa: Number, // Index of Surface Asymmetry
        ivi: Number, // Index of Vertical Asymmetry
        kpi: Number, // Keratoconus Prediction Index
        rmin: Number
      }
    },
    OS: {
      simK: {
        steep: Number,
        flat: Number,
        average: Number,
        astigmatism: Number
      },
      elevation: {
        anterior: mongoose.Schema.Types.Mixed,
        posterior: mongoose.Schema.Types.Mixed
      },
      pachymetry: {
        central: Number,
        thinnest: Number,
        location: { x: Number, y: Number }
      },
      indices: {
        kmax: Number,
        isa: Number,
        ivi: Number,
        kpi: Number,
        rmin: Number
      }
    }
  },

  // Biometry measurements
  biometry: {
    OD: {
      axialLength: Number,
      kReadings: {
        k1: Number,
        k2: Number,
        average: Number
      },
      acd: Number, // Anterior Chamber Depth
      lensThickness: Number,
      whiteToWhite: Number,
      pupilSize: Number,
      iolCalculations: [{
        formula: String,
        iolPower: Number,
        targetRefraction: Number,
        predictedRefraction: Number
      }]
    },
    OS: {
      axialLength: Number,
      kReadings: {
        k1: Number,
        k2: Number,
        average: Number
      },
      acd: Number,
      lensThickness: Number,
      whiteToWhite: Number,
      pupilSize: Number,
      iolCalculations: [{
        formula: String,
        iolPower: Number,
        targetRefraction: Number,
        predictedRefraction: Number
      }]
    }
  },

  // Pachymetry measurements
  pachymetry: {
    OD: {
      central: Number,
      readings: [{
        location: String,
        thickness: Number
      }],
      map: mongoose.Schema.Types.Mixed,
      thinnest: Number,
      average: Number
    },
    OS: {
      central: Number,
      readings: [{
        location: String,
        thickness: Number
      }],
      map: mongoose.Schema.Types.Mixed,
      thinnest: Number,
      average: Number
    }
  },

  // Visual acuity measurements
  visualAcuity: {
    OD: {
      uncorrected: {
        distance: String,
        near: String,
        intermediate: String
      },
      corrected: {
        distance: String,
        near: String,
        intermediate: String
      },
      pinhole: String,
      bestCorrected: String
    },
    OS: {
      uncorrected: {
        distance: String,
        near: String,
        intermediate: String
      },
      corrected: {
        distance: String,
        near: String,
        intermediate: String
      },
      pinhole: String,
      bestCorrected: String
    }
  },

  // Raw data from device
  rawData: {
    format: String, // 'json', 'xml', 'dicom', 'proprietary'
    data: mongoose.Schema.Types.Mixed,
    file: {
      path: String,
      size: Number,
      checksum: String
    }
  },

  // Images and attachments
  images: [{
    type: String, // 'fundus', 'oct-scan', 'topography-map', etc.
    eye: String,
    path: String,
    thumbnailPath: String,
    metadata: mongoose.Schema.Types.Mixed
  }],

  // Quality indicators
  quality: {
    overall: Number, // 0-100
    factors: [{
      name: String,
      value: Number,
      acceptable: Boolean
    }],
    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    repeatMeasurement: Boolean,
    reason: String
  },

  // Interpretation and notes
  interpretation: {
    automatic: String, // Device-generated interpretation
    manual: String, // Doctor's interpretation
    findings: [String],
    recommendations: [String],
    interpretedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    interpretedAt: Date
  },

  // Comparison with previous
  comparison: {
    previousMeasurement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeviceMeasurement'
    },
    changes: [{
      parameter: String,
      previousValue: mongoose.Schema.Types.Mixed,
      currentValue: mongoose.Schema.Types.Mixed,
      change: Number,
      percentageChange: Number,
      significance: String // 'stable', 'improved', 'worsened', 'significant'
    }],
    progression: String,
    trend: String
  },

  // Validation and review
  validation: {
    status: {
      type: String,
      enum: ['pending', 'validated', 'rejected', 'requires-repeat'],
      default: 'pending'
    },
    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    validatedAt: Date,
    comments: String,
    flags: [String]
  },

  // Integration tracking
  source: {
    type: String,
    enum: ['device', 'manual', 'import', 'api'],
    default: 'device'
  },

  imported: {
    at: Date,
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    from: String // Source system or file
  },

  // Billing and coding
  billing: {
    cptCodes: [String],
    icdCodes: [String],
    billed: Boolean,
    billedAt: Date
  },

  // Status
  status: {
    type: String,
    enum: ['complete', 'partial', 'error', 'pending'],
    default: 'complete'
  },

  // Error handling
  errors: [{
    timestamp: Date,
    type: String,
    message: String,
    field: String
  }],

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
deviceMeasurementSchema.index({ patient: 1, measurementDate: -1 });
deviceMeasurementSchema.index({ device: 1, measurementDate: -1 });
deviceMeasurementSchema.index({ visit: 1 });
deviceMeasurementSchema.index({ measurementType: 1, eye: 1 });

// Pre-save middleware
deviceMeasurementSchema.pre('save', async function(next) {
  if (this.isNew && !this.measurementId) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await mongoose.model('DeviceMeasurement').countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      }
    });
    this.measurementId = `DM${dateStr}${(count + 1).toString().padStart(4, '0')}`;
  }

  next();
});

// Methods
deviceMeasurementSchema.methods.validate = function(userId) {
  this.validation.status = 'validated';
  this.validation.validatedBy = userId;
  this.validation.validatedAt = new Date();
  return this.save();
};

deviceMeasurementSchema.methods.reject = function(userId, reason) {
  this.validation.status = 'rejected';
  this.validation.validatedBy = userId;
  this.validation.validatedAt = new Date();
  this.validation.comments = reason;
  return this.save();
};

deviceMeasurementSchema.methods.compareWithPrevious = async function() {
  const previous = await mongoose.model('DeviceMeasurement').findOne({
    patient: this.patient,
    deviceType: this.deviceType,
    measurementType: this.measurementType,
    _id: { $ne: this._id },
    measurementDate: { $lt: this.measurementDate }
  }).sort('-measurementDate');

  if (!previous) return null;

  const comparison = {
    previousMeasurement: previous._id,
    changes: []
  };

  // Compare based on measurement type
  // This would be expanded based on specific measurement comparisons needed

  this.comparison = comparison;
  return this.save();
};

// Static methods
deviceMeasurementSchema.statics.getPatientMeasurements = async function(patientId, type, limit = 10) {
  const query = { patient: patientId };
  if (type) query.measurementType = type;

  return this.find(query)
    .populate('device', 'name manufacturer model')
    .sort('-measurementDate')
    .limit(limit);
};

deviceMeasurementSchema.statics.getVisitMeasurements = async function(visitId) {
  return this.find({ visit: visitId })
    .populate('device', 'name manufacturer model')
    .sort('measurementDate');
};

deviceMeasurementSchema.statics.getLatestMeasurement = async function(patientId, type) {
  return this.findOne({
    patient: patientId,
    measurementType: type,
    'validation.status': { $ne: 'rejected' }
  }).sort('-measurementDate');
};

module.exports = mongoose.model('DeviceMeasurement', deviceMeasurementSchema);