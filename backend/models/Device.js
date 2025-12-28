const mongoose = require('mongoose');
const Counter = require('./Counter');

const deviceSchema = new mongoose.Schema({
  // Device identification
  deviceId: {
    type: String,
    unique: true,
    sparse: true
  },

  name: {
    type: String,
    required: true
  },

  manufacturer: {
    type: String,
    required: true
  },

  model: {
    type: String,
    required: true
  },

  serialNumber: {
    type: String,
    unique: true,
    sparse: true
  },

  // Device type and category
  type: {
    type: String,
    enum: ['auto-refractor', 'keratometer', 'tonometer', 'perimeter', 'oct', 'fundus-camera',
      'slit-lamp', 'phoropter', 'lensmeter', 'topographer', 'biometer', 'pachymeter',
      'ultrasound', 'retinal-camera', 'specular-microscope', 'aberrometer', 'angiography',
      'wavefront', 'iol-master', 'visual-acuity', 'contrast-sensitivity', 'other'],
    required: true
  },

  category: {
    type: String,
    enum: ['diagnostic', 'imaging', 'measurement', 'therapeutic', 'surgical'],
    required: true
  },

  // Connection details
  connection: {
    type: {
      type: String,
      enum: ['network', 'serial', 'usb', 'bluetooth', 'wifi', 'manual'],
      required: true
    },
    protocol: {
      type: String,
      enum: ['dicom', 'hl7', 'proprietary', 'api', 'file-based', 'manual']
    },
    ipAddress: String,
    port: Number,
    serialPort: String,
    apiEndpoint: String,
    credentials: {
      username: String,
      password: String,
      apiKey: String
    },
    settings: mongoose.Schema.Types.Mixed
  },

  // Data mapping configuration
  dataMapping: {
    fields: [{
      deviceField: String,
      systemField: String,
      dataType: String,
      unit: String,
      transformation: String // JavaScript expression for data transformation
    }],
    dateFormat: String,
    encoding: String,
    delimiter: String
  },

  // Capabilities and measurements
  capabilities: {
    measurements: [{
      name: String,
      code: String,
      unit: String,
      range: {
        min: Number,
        max: Number
      },
      precision: Number
    }],
    features: [String],
    exportFormats: [String],
    autoCapture: Boolean,
    batchMode: Boolean,
    remoteControl: Boolean
  },

  // Clinic assignment (multi-tenant)
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic is required for multi-tenant isolation'],
    index: true
  },

  // Location and assignment
  location: {
    facility: String,
    department: String,
    room: String,
    station: String
  },

  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Calibration and maintenance
  calibration: {
    required: Boolean,
    frequency: String, // 'daily', 'weekly', 'monthly', 'quarterly', 'annual'
    lastCalibration: Date,
    nextCalibration: Date,
    calibrationHistory: [{
      date: Date,
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      results: {
        passed: Boolean,
        measurements: mongoose.Schema.Types.Mixed,
        notes: String
      },
      certificateNumber: String
    }]
  },

  maintenance: {
    schedule: String,
    lastService: Date,
    nextService: Date,
    serviceHistory: [{
      date: Date,
      type: {
        type: String,
        enum: ['preventive', 'corrective', 'emergency', 'upgrade']
      },
      description: String,
      performedBy: String,
      cost: Number,
      partsReplaced: [String],
      nextAction: String
    }],
    warrantyExpiry: Date,
    serviceContract: {
      provider: String,
      contractNumber: String,
      expiryDate: Date
    }
  },

  // Quality control
  qualityControl: {
    enabled: Boolean,
    checks: [{
      parameter: String,
      frequency: String,
      acceptableRange: {
        min: Number,
        max: Number
      },
      lastCheck: Date,
      lastValue: Number
    }],
    alerts: [{
      type: String,
      threshold: Number,
      action: String
    }]
  },

  // Integration status
  integration: {
    status: {
      type: String,
      enum: ['connected', 'disconnected', 'error', 'pending', 'not-configured'],
      default: 'not-configured'
    },

    // Integration method (Phase 1 Enhancement)
    method: {
      type: String,
      enum: ['webhook', 'folder-sync', 'manual', 'api', 'none'],
      default: 'none'
    },

    // Webhook integration (for real-time push from devices)
    webhook: {
      enabled: {
        type: Boolean,
        default: false
      },
      url: String, // Full webhook URL for device to push to
      apiKey: String, // API key for device authentication
      secret: String, // Secret for HMAC signature verification
      headers: mongoose.Schema.Types.Mixed, // Custom headers expected from device
      retryPolicy: {
        maxAttempts: {
          type: Number,
          default: 3
        },
        backoffMultiplier: {
          type: Number,
          default: 2
        }
      },
      lastWebhookReceived: Date,
      webhookCount: {
        type: Number,
        default: 0
      }
    },

    // Folder sync integration (for scheduled polling)
    folderSync: {
      enabled: {
        type: Boolean,
        default: false
      },
      sharedFolderPath: String, // Network path to shared folder
      filePattern: String, // e.g., '*.csv', '*.dcm', '*.json'
      fileFormat: {
        type: String,
        enum: ['csv', 'json', 'xml', 'txt', 'dicom', 'hl7', 'proprietary']
      },
      syncSchedule: {
        type: String,
        default: '0 */1 * * *' // Every hour (cron format)
      },
      processedFolder: String, // Path to move processed files
      errorFolder: String, // Path to move files with errors
      lastFolderSync: Date,
      filesProcessed: {
        type: Number,
        default: 0
      },
      filesFailed: {
        type: Number,
        default: 0
      }
    },

    lastConnection: Date,
    lastSync: Date,
    lastSyncStatus: {
      type: String,
      enum: ['success', 'partial', 'failed', 'pending'],
      default: 'pending'
    },
    syncFrequency: String, // 'realtime', 'hourly', 'daily', 'manual'
    autoSync: Boolean,
    consecutiveErrors: {
      type: Number,
      default: 0
    },
    errorLog: [{
      timestamp: Date,
      error: String,
      resolved: Boolean,
      resolvedAt: Date
    }]
  },

  // Data storage settings
  dataStorage: {
    storeRawData: Boolean,
    storageLocation: String, // 'local', 'cloud', 'both'
    retentionPeriod: Number, // days
    compressionEnabled: Boolean,
    encryptionEnabled: Boolean
  },

  // Measurement presets
  presets: [{
    name: String,
    description: String,
    settings: mongoose.Schema.Types.Mixed,
    isDefault: Boolean,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Device-specific configurations
  configurations: {
    autoRefractor: {
      sphereRange: { min: Number, max: Number },
      cylinderRange: { min: Number, max: Number },
      axisStep: Number,
      pupilSizeThreshold: Number,
      measurementMode: String, // 'automatic', 'manual', 'keratometry'
      numberOfMeasurements: Number
    },

    tonometer: {
      type: String, // 'applanation', 'non-contact', 'rebound'
      correctionFactor: Number,
      pachymetryIntegration: Boolean,
      multipleReadings: Number,
      averageReadings: Boolean
    },

    perimeter: {
      testPatterns: [String],
      strategy: String, // 'threshold', 'screening', 'kinetic'
      fixationMonitoring: Boolean,
      reliability: {
        fixationLosses: Number,
        falsePositives: Number,
        falseNegatives: Number
      }
    },

    oct: {
      scanProtocols: [String],
      resolution: String,
      scanSpeed: Number,
      averageScans: Number,
      followUpMode: Boolean,
      analysisModules: [String]
    },

    fundusCamera: {
      fieldOfView: Number,
      filterOptions: [String],
      mydriatic: Boolean,
      stereoscopic: Boolean,
      autoFocus: Boolean,
      flashIntensity: Number
    }
  },

  // Usage statistics
  statistics: {
    totalMeasurements: Number,
    dailyAverage: Number,
    lastUsed: Date,
    mostFrequentUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    errorRate: Number,
    averageSessionDuration: Number
  },

  // Status and availability
  status: {
    operational: {
      type: Boolean,
      default: true
    },
    currentStatus: {
      type: String,
      enum: ['available', 'in-use', 'maintenance', 'error', 'offline'],
      default: 'available'
    },
    statusMessage: String,
    lastStatusChange: Date
  },

  // Audit and compliance
  compliance: {
    certifications: [{
      type: String,
      number: String,
      issuedBy: String,
      issuedDate: Date,
      expiryDate: Date
    }],
    regulatoryApproval: {
      fda: Boolean,
      ce: Boolean,
      other: [String]
    }
  },

  // Notes and documentation
  documentation: {
    manual: String, // URL or path
    quickGuide: String,
    troubleshooting: String,
    videos: [String]
  },

  notes: [{
    date: Date,
    note: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Lifecycle management
  lifecycle: {
    purchaseDate: Date,
    installationDate: Date,
    commissioningDate: Date,
    expectedLifespan: Number, // years
    replacementDate: Date,
    disposalMethod: String
  },

  // Financial information
  financial: {
    purchaseCost: Number,
    annualMaintenanceCost: Number,
    costPerUse: Number,
    reimbursementCodes: [String]
  },

  active: {
    type: Boolean,
    default: true
  },

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
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

// Indexes
deviceSchema.index({ type: 1, status: 1 });
deviceSchema.index({ clinic: 1, type: 1, status: 1 });
deviceSchema.index({ clinic: 1, 'integration.status': 1 });
deviceSchema.index({ serialNumber: 1 });
deviceSchema.index({ 'location.facility': 1, 'location.department': 1 });
deviceSchema.index({ 'integration.status': 1 });

// Pre-save middleware
deviceSchema.pre('save', async function(next) {
  if (this.isNew && !this.deviceId) {
    const prefix = this.type.substring(0, 3).toUpperCase();
    const counterId = `device-${prefix}`;
    const sequence = await Counter.getNextSequence(counterId);
    this.deviceId = `${prefix}${sequence.toString().padStart(4, '0')}`;
  }

  // Calculate next calibration date
  if (this.calibration?.required && this.calibration.lastCalibration) {
    const frequencyDays = {
      'daily': 1,
      'weekly': 7,
      'monthly': 30,
      'quarterly': 90,
      'annual': 365
    };

    if (frequencyDays[this.calibration.frequency]) {
      const nextDate = new Date(this.calibration.lastCalibration);
      nextDate.setDate(nextDate.getDate() + frequencyDays[this.calibration.frequency]);
      this.calibration.nextCalibration = nextDate;
    }
  }

  next();
});

// Methods
deviceSchema.methods.connect = async function() {
  // Implement device-specific connection logic
  this.integration.lastConnection = new Date();
  this.integration.status = 'connected';
  return this.save();
};

deviceSchema.methods.disconnect = async function() {
  this.integration.status = 'disconnected';
  return this.save();
};

deviceSchema.methods.syncData = async function() {
  // Implement data synchronization logic
  this.integration.lastSync = new Date();
  return this.save();
};

deviceSchema.methods.performCalibration = async function(userId, results) {
  if (!this.calibration) {
    this.calibration = { calibrationHistory: [] };
  }

  this.calibration.lastCalibration = new Date();
  this.calibration.calibrationHistory.push({
    date: new Date(),
    performedBy: userId,
    results: results
  });

  return this.save();
};

deviceSchema.methods.recordMaintenance = async function(maintenanceData) {
  if (!this.maintenance) {
    this.maintenance = { serviceHistory: [] };
  }

  this.maintenance.lastService = new Date();
  this.maintenance.serviceHistory.push({
    date: new Date(),
    ...maintenanceData
  });

  return this.save();
};

deviceSchema.methods.checkCalibrationDue = function() {
  if (!this.calibration?.required || !this.calibration.nextCalibration) {
    return false;
  }

  return new Date() >= this.calibration.nextCalibration;
};

// Static methods
deviceSchema.statics.getAvailableDevices = async function(type) {
  const query = {
    active: true,
    'status.operational': true,
    'status.currentStatus': 'available'
  };

  if (type) {
    query.type = type;
  }

  return this.find(query);
};

deviceSchema.statics.getDevicesByLocation = async function(facility, department) {
  const query = { active: true };

  if (facility) query['location.facility'] = facility;
  if (department) query['location.department'] = department;

  return this.find(query);
};

deviceSchema.statics.getMaintenanceDue = async function() {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  return this.find({
    active: true,
    $or: [
      { 'maintenance.nextService': { $lte: thirtyDaysFromNow } },
      { 'calibration.nextCalibration': { $lte: thirtyDaysFromNow } }
    ]
  });
};

// =====================================================
// SOFT DELETE MIDDLEWARE
// Automatically filter out deleted documents on queries
// Use { includeSoftDeleted: true } to include deleted docs
// =====================================================
deviceSchema.pre(/^find/, function(next) {
  if (this.getOptions().includeSoftDeleted) {
    return next();
  }
  this.where({ $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] });
  next();
});

deviceSchema.pre('countDocuments', function(next) {
  if (this.getOptions().includeSoftDeleted) {
    return next();
  }
  this.where({ $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }] });
  next();
});

module.exports = mongoose.model('Device', deviceSchema);
