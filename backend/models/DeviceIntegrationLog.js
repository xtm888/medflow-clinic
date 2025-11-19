const mongoose = require('mongoose');

const deviceIntegrationLogSchema = new mongoose.Schema({
  // Log identification
  logId: {
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

  // Event details
  eventType: {
    type: String,
    enum: [
      'WEBHOOK_RECEIVED',
      'IMAGE_UPLOAD',
      'MEASUREMENT_IMPORT',
      'DATA_SYNC',
      'FOLDER_SCAN',
      'FILE_PROCESSED',
      'DEVICE_CONNECTED',
      'DEVICE_DISCONNECTED',
      'CALIBRATION',
      'ERROR',
      'WARNING',
      'CONFIG_CHANGE',
      'STATUS_CHANGE',
      'RETRY_ATTEMPT',
      'VALIDATION',
      'CLEANUP'
    ],
    required: true
  },

  // Integration method
  integrationMethod: {
    type: String,
    enum: ['webhook', 'folder-sync', 'manual', 'api', 'scheduled'],
    required: true
  },

  // Event status
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'SUCCESS', 'PARTIAL', 'FAILED', 'RETRY'],
    required: true,
    default: 'PENDING'
  },

  // Timing
  initiatedAt: {
    type: Date,
    default: Date.now
  },

  startedAt: Date,

  completedAt: Date,

  processingTime: Number, // milliseconds

  // Who/what initiated the event
  initiatedBy: {
    type: String,
    enum: ['DEVICE', 'SYSTEM', 'MANUAL', 'SCHEDULED', 'API', 'WEBHOOK'],
    required: true
  },

  operator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Source information
  source: {
    ipAddress: String,
    userAgent: String,
    webhookUrl: String,
    folderPath: String,
    fileName: String,
    fileSize: Number,
    checksum: String
  },

  // Processing details
  processing: {
    recordsReceived: {
      type: Number,
      default: 0
    },
    recordsProcessed: {
      type: Number,
      default: 0
    },
    recordsFailed: {
      type: Number,
      default: 0
    },
    recordsSkipped: {
      type: Number,
      default: 0
    },
    filesProcessed: {
      type: Number,
      default: 0
    },
    filesFailed: {
      type: Number,
      default: 0
    },
    bytesProcessed: {
      type: Number,
      default: 0
    },
    imagesUploaded: {
      type: Number,
      default: 0
    },
    measurementsCreated: {
      type: Number,
      default: 0
    }
  },

  // Patient/exam references (if applicable)
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient'
  },

  visit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Visit'
  },

  ophthalmologyExam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OphthalmologyExam'
  },

  // Created records
  createdRecords: {
    deviceMeasurements: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeviceMeasurement'
    }],
    deviceImages: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeviceImage'
    }],
    count: {
      type: Number,
      default: 0
    }
  },

  // Webhook-specific data
  webhook: {
    signature: String,
    signatureVerified: Boolean,
    headers: mongoose.Schema.Types.Mixed,
    payload: mongoose.Schema.Types.Mixed,
    responseCode: Number,
    responseTime: Number
  },

  // Folder sync-specific data
  folderSync: {
    folderPath: String,
    filesScanned: {
      type: Number,
      default: 0
    },
    filesNew: {
      type: Number,
      default: 0
    },
    filesProcessed: [{
      fileName: String,
      fileSize: Number,
      processedAt: Date,
      status: String,
      error: String
    }],
    syncDuration: Number
  },

  // Error and warning details
  errorDetails: {
    code: String,
    message: String,
    stack: String,
    field: String,
    value: mongoose.Schema.Types.Mixed,
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    },
    recoverable: Boolean
  },

  warnings: [{
    code: String,
    message: String,
    field: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

  // Retry information
  retry: {
    attempt: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 3
    },
    nextRetryAt: Date,
    lastError: String,
    backoffMultiplier: {
      type: Number,
      default: 2
    }
  },

  // Validation results
  validation: {
    passed: Boolean,
    checks: [{
      name: String,
      passed: Boolean,
      message: String,
      value: mongoose.Schema.Types.Mixed
    }],
    errorList: [{ // Renamed from 'errors' to avoid Mongoose warning
      field: String,
      message: String,
      value: mongoose.Schema.Types.Mixed
    }]
  },

  // Data transformation
  transformation: {
    adapterUsed: String,
    inputFormat: String,
    outputFormat: String,
    rulesApplied: [String],
    fieldsMapping: mongoose.Schema.Types.Mixed
  },

  // Performance metrics
  performance: {
    queueTime: Number, // Time waiting in queue
    parseTime: Number, // Time to parse data
    validationTime: Number, // Time to validate
    transformTime: Number, // Time to transform
    saveTime: Number, // Time to save to database
    totalTime: Number // Total processing time
  },

  // Request/Response data (for debugging)
  request: {
    method: String,
    headers: mongoose.Schema.Types.Mixed,
    body: mongoose.Schema.Types.Mixed,
    query: mongoose.Schema.Types.Mixed,
    params: mongoose.Schema.Types.Mixed
  },

  response: {
    statusCode: Number,
    headers: mongoose.Schema.Types.Mixed,
    body: mongoose.Schema.Types.Mixed,
    sent: Boolean
  },

  // Alert/notification status
  alert: {
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: Date,
    recipients: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    alertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert'
    }
  },

  // Related logs (for tracking sequences)
  relatedLogs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeviceIntegrationLog'
  }],

  parentLog: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeviceIntegrationLog'
  },

  // Resolution tracking
  resolution: {
    resolved: {
      type: Boolean,
      default: false
    },
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolutionNotes: String,
    resolutionAction: {
      type: String,
      enum: ['RETRY', 'IGNORE', 'MANUAL_FIX', 'RECONFIGURE', 'OTHER']
    }
  },

  // Additional metadata
  metadata: mongoose.Schema.Types.Mixed,

  // Tags for filtering
  tags: [String],

  // Notes
  notes: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Archive status
  archived: {
    type: Boolean,
    default: false
  },

  archivedAt: Date

}, {
  timestamps: true
});

// Indexes
deviceIntegrationLogSchema.index({ device: 1, createdAt: -1 });
deviceIntegrationLogSchema.index({ eventType: 1, status: 1 });
deviceIntegrationLogSchema.index({ integrationMethod: 1, createdAt: -1 });
deviceIntegrationLogSchema.index({ status: 1, initiatedAt: -1 });
deviceIntegrationLogSchema.index({ patient: 1, createdAt: -1 });
deviceIntegrationLogSchema.index({ 'retry.nextRetryAt': 1 });
deviceIntegrationLogSchema.index({ 'errorDetails.severity': 1 });
deviceIntegrationLogSchema.index({ archived: 1, createdAt: -1 });

// Pre-save middleware
deviceIntegrationLogSchema.pre('save', async function(next) {
  if (this.isNew && !this.logId) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await mongoose.model('DeviceIntegrationLog').countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      }
    });
    this.logId = `DIL${dateStr}${(count + 1).toString().padStart(4, '0')}`;
  }

  // Calculate processing time if completed
  if (this.completedAt && this.startedAt) {
    this.processingTime = this.completedAt - this.startedAt;
  }

  // Calculate total time for performance
  if (this.performance) {
    const { queueTime = 0, parseTime = 0, validationTime = 0, transformTime = 0, saveTime = 0 } = this.performance;
    this.performance.totalTime = queueTime + parseTime + validationTime + transformTime + saveTime;
  }

  next();
});

// Methods
deviceIntegrationLogSchema.methods.markSuccess = function() {
  this.status = 'SUCCESS';
  this.completedAt = new Date();
  return this.save();
};

deviceIntegrationLogSchema.methods.markFailed = function(error) {
  this.status = 'FAILED';
  this.completedAt = new Date();
  if (error) {
    this.errorDetails = {
      code: error.code || 'UNKNOWN',
      message: error.message,
      stack: error.stack,
      severity: error.severity || 'HIGH',
      recoverable: error.recoverable || false
    };
  }
  return this.save();
};

deviceIntegrationLogSchema.methods.markPartial = function(errors) {
  this.status = 'PARTIAL';
  this.completedAt = new Date();
  if (errors && errors.length > 0) {
    this.warnings = errors.map(err => ({
      code: err.code,
      message: err.message,
      field: err.field
    }));
  }
  return this.save();
};

deviceIntegrationLogSchema.methods.scheduleRetry = function() {
  this.status = 'RETRY';
  this.retry.attempt += 1;

  // Calculate next retry time with exponential backoff
  const backoffMs = Math.pow(this.retry.backoffMultiplier, this.retry.attempt) * 1000 * 60; // minutes
  this.retry.nextRetryAt = new Date(Date.now() + backoffMs);

  return this.save();
};

deviceIntegrationLogSchema.methods.resolve = function(userId, action, notes) {
  this.resolution.resolved = true;
  this.resolution.resolvedAt = new Date();
  this.resolution.resolvedBy = userId;
  this.resolution.resolutionAction = action;
  this.resolution.resolutionNotes = notes;
  return this.save();
};

deviceIntegrationLogSchema.methods.addNote = function(note, userId) {
  this.notes.push({
    note,
    createdBy: userId,
    timestamp: new Date()
  });
  return this.save();
};

deviceIntegrationLogSchema.methods.archive = function() {
  this.archived = true;
  this.archivedAt = new Date();
  return this.save();
};

// Static methods
deviceIntegrationLogSchema.statics.getDeviceLogs = async function(deviceId, limit = 50) {
  return this.find({ device: deviceId, archived: false })
    .populate('operator', 'firstName lastName')
    .sort('-createdAt')
    .limit(limit);
};

deviceIntegrationLogSchema.statics.getFailedLogs = async function(limit = 50) {
  return this.find({
    status: 'FAILED',
    'resolution.resolved': false,
    archived: false
  })
    .populate('device', 'name type')
    .populate('operator', 'firstName lastName')
    .sort('-createdAt')
    .limit(limit);
};

deviceIntegrationLogSchema.statics.getPendingRetries = async function() {
  return this.find({
    status: 'RETRY',
    'retry.nextRetryAt': { $lte: new Date() },
    $expr: { $lt: ['$retry.attempt', '$retry.maxAttempts'] },
    archived: false
  }).populate('device', 'name type');
};

deviceIntegrationLogSchema.statics.getEventStats = async function(deviceId, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const query = {
    createdAt: { $gte: since },
    archived: false
  };

  if (deviceId) query.device = deviceId;

  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: {
          eventType: '$eventType',
          status: '$status'
        },
        count: { $sum: 1 },
        totalRecordsProcessed: { $sum: '$processing.recordsProcessed' },
        totalRecordsFailed: { $sum: '$processing.recordsFailed' },
        avgProcessingTime: { $avg: '$processingTime' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

deviceIntegrationLogSchema.statics.getErrorSummary = async function(deviceId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const query = {
    status: { $in: ['FAILED', 'PARTIAL'] },
    createdAt: { $gte: since },
    archived: false
  };

  if (deviceId) query.device = deviceId;

  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$errorDetails.code',
        count: { $sum: 1 },
        lastOccurrence: { $max: '$createdAt' },
        severity: { $first: '$errorDetails.severity' },
        message: { $first: '$errorDetails.message' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

deviceIntegrationLogSchema.statics.cleanupOldLogs = async function(daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  return this.updateMany(
    {
      createdAt: { $lt: cutoffDate },
      status: 'SUCCESS',
      archived: false
    },
    {
      $set: {
        archived: true,
        archivedAt: new Date()
      }
    }
  );
};

module.exports = mongoose.model('DeviceIntegrationLog', deviceIntegrationLogSchema);
