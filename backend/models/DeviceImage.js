const mongoose = require('mongoose');

const deviceImageSchema = new mongoose.Schema({
  // Image identification
  imageId: {
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

  ophthalmologyExam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OphthalmologyExam'
  },

  deviceMeasurement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeviceMeasurement'
  },

  // Image metadata
  imageType: {
    type: String,
    enum: ['OCT', 'fundus', 'topography', 'angiography', 'ultrasound',
      'slit-lamp', 'anterior-segment', 'visual-field', 'pachymetry',
      'biometry', 'specular-microscopy', 'other'],
    required: true
  },

  eye: {
    type: String,
    enum: ['OD', 'OS', 'OU', 'NA'],
    default: 'OU'
  },

  capturedAt: {
    type: Date,
    required: true,
    default: Date.now
  },

  // File information
  file: {
    originalName: String,
    fileName: String, // Stored filename
    path: String, // Full path or S3 URL
    size: Number, // Bytes
    mimeType: String,
    checksum: String, // SHA256 hash for integrity
    format: {
      type: String,
      enum: ['DICOM', 'JPEG', 'PNG', 'TIFF', 'BMP', 'PDF', 'RAW']
    }
  },

  // Thumbnail for quick preview
  thumbnail: {
    path: String,
    size: Number,
    generated: {
      type: Boolean,
      default: false
    }
  },

  // DICOM-specific metadata
  dicom: {
    studyInstanceUID: String,
    seriesInstanceUID: String,
    sopInstanceUID: String,
    studyDate: Date,
    studyTime: String,
    modality: String, // 'OPT', 'OP', 'US', etc.
    manufacturer: String,
    manufacturerModel: String,
    stationName: String,
    studyDescription: String,
    seriesDescription: String,
    patientPosition: String,
    imageComments: String,
    acquisitionDateTime: Date,
    contentDate: Date,
    contentTime: String,
    instanceNumber: Number,
    numberOfFrames: Number,
    photometricInterpretation: String,
    samplesPerPixel: Number,
    rows: Number,
    columns: Number,
    bitsAllocated: Number,
    bitsStored: Number,
    highBit: Number,
    pixelRepresentation: Number,
    windowCenter: Number,
    windowWidth: Number,
    rescaleIntercept: Number,
    rescaleSlope: Number,
    transferSyntaxUID: String,
    customTags: mongoose.Schema.Types.Mixed
  },

  // Image quality metrics
  quality: {
    overall: Number, // 0-100
    signalStrength: Number,
    noiseLevel: Number,
    contrast: Number,
    sharpness: Number,
    factors: [{
      name: String,
      value: Number,
      acceptable: Boolean,
      threshold: Number
    }],
    acceptable: {
      type: Boolean,
      default: true
    },
    issues: [String]
  },

  // Processing status
  processing: {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'requires-review'],
      default: 'pending'
    },
    uploadedAt: Date,
    processedAt: Date,
    thumbnailGenerated: {
      type: Boolean,
      default: false
    },
    dicomParsed: {
      type: Boolean,
      default: false
    },
    metadataExtracted: {
      type: Boolean,
      default: false
    },
    errorList: [String], // Renamed from 'errors' to avoid Mongoose warning
    warnings: [String]
  },

  // Clinical metadata
  clinical: {
    findings: [String],
    measurements: [{
      name: String,
      value: Number,
      unit: String,
      normalRange: {
        min: Number,
        max: Number
      },
      isNormal: Boolean
    }],
    diagnosis: [String],
    severity: {
      type: String,
      enum: ['normal', 'mild', 'moderate', 'severe', 'critical']
    },
    urgency: {
      type: String,
      enum: ['routine', 'urgent', 'emergency']
    }
  },

  // Annotations and markings
  annotations: [{
    type: {
      type: String,
      enum: ['arrow', 'circle', 'rectangle', 'polygon', 'line', 'text', 'measurement']
    },
    coordinates: mongoose.Schema.Types.Mixed, // Array of points
    label: String,
    color: String,
    thickness: Number,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Comparison with previous images
  comparison: {
    previousImage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeviceImage'
    },
    registrationApplied: Boolean,
    differences: [{
      location: String,
      type: String,
      description: String,
      significance: {
        type: String,
        enum: ['stable', 'improved', 'worsened', 'new-finding']
      }
    }],
    progression: String,
    changeScore: Number
  },

  // Review and validation
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
    flags: [String],
    requiresFollowUp: Boolean,
    followUpDate: Date
  },

  // Interpretation
  interpretation: {
    automatic: String, // AI/device-generated interpretation
    manual: String, // Doctor's interpretation
    interpretedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    interpretedAt: Date,
    confidence: Number, // 0-100 for AI interpretations
    findings: [String],
    recommendations: [String]
  },

  // Series and multi-image sets
  series: {
    isPartOfSeries: Boolean,
    seriesId: String,
    imageNumber: Number,
    totalImages: Number,
    relatedImages: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeviceImage'
    }]
  },

  // Storage metadata
  storage: {
    location: {
      type: String,
      enum: ['local', 's3', 'azure', 'gcs', 'pacs'],
      default: 'local'
    },
    bucket: String, // For cloud storage
    region: String,
    archived: {
      type: Boolean,
      default: false
    },
    archivedAt: Date,
    retentionPolicy: String,
    deleteAfter: Date
  },

  // Integration tracking
  source: {
    type: String,
    enum: ['webhook', 'folder-sync', 'manual-upload', 'pacs', 'api'],
    required: true
  },

  imported: {
    at: {
      type: Date,
      default: Date.now
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    from: String, // Source system, file path, or webhook URL
    integrationLog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DeviceIntegrationLog'
    }
  },

  // Access and sharing
  access: {
    public: {
      type: Boolean,
      default: false
    },
    sharedWith: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      permissions: {
        type: String,
        enum: ['view', 'annotate', 'edit', 'full']
      },
      sharedAt: Date
    }],
    viewCount: {
      type: Number,
      default: 0
    },
    lastViewedAt: Date,
    downloadCount: {
      type: Number,
      default: 0
    }
  },

  // Billing and coding
  billing: {
    cptCodes: [String],
    icdCodes: [String],
    billed: {
      type: Boolean,
      default: false
    },
    billedAt: Date,
    amount: Number
  },

  // Tags for organization
  tags: [String],

  // Custom metadata
  customMetadata: mongoose.Schema.Types.Mixed,

  // Notes
  notes: [{
    date: {
      type: Date,
      default: Date.now
    },
    note: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Status
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted', 'error'],
    default: 'active'
  },

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
deviceImageSchema.index({ patient: 1, capturedAt: -1 });
deviceImageSchema.index({ device: 1, capturedAt: -1 });
deviceImageSchema.index({ visit: 1 });
deviceImageSchema.index({ ophthalmologyExam: 1 });
deviceImageSchema.index({ imageType: 1, eye: 1 });
deviceImageSchema.index({ 'dicom.studyInstanceUID': 1 });
deviceImageSchema.index({ 'dicom.seriesInstanceUID': 1 });
deviceImageSchema.index({ 'validation.status': 1 });
deviceImageSchema.index({ source: 1, 'imported.at': -1 });

// Pre-save middleware
deviceImageSchema.pre('save', async function(next) {
  if (this.isNew && !this.imageId) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await mongoose.model('DeviceImage').countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      }
    });
    this.imageId = `IMG${dateStr}${(count + 1).toString().padStart(4, '0')}`;
  }

  // Track upload time if not set
  if (this.isNew && !this.processing.uploadedAt) {
    this.processing.uploadedAt = new Date();
  }

  next();
});

// Methods (renamed from 'validate' to avoid Mongoose warning)
deviceImageSchema.methods.markAsValidated = function(userId, comments) {
  this.validation.status = 'validated';
  this.validation.validatedBy = userId;
  this.validation.validatedAt = new Date();
  if (comments) {
    this.validation.comments = comments;
  }
  return this.save();
};

deviceImageSchema.methods.reject = function(userId, reason) {
  this.validation.status = 'rejected';
  this.validation.validatedBy = userId;
  this.validation.validatedAt = new Date();
  this.validation.comments = reason;
  return this.save();
};

deviceImageSchema.methods.markAsViewed = function() {
  this.access.viewCount += 1;
  this.access.lastViewedAt = new Date();
  return this.save();
};

deviceImageSchema.methods.archive = function() {
  this.storage.archived = true;
  this.storage.archivedAt = new Date();
  this.status = 'archived';
  return this.save();
};

deviceImageSchema.methods.addAnnotation = function(annotation, userId) {
  this.annotations.push({
    ...annotation,
    createdBy: userId,
    createdAt: new Date()
  });
  return this.save();
};

// Static methods
deviceImageSchema.statics.getPatientImages = async function(patientId, imageType, limit = 20) {
  const query = { patient: patientId, status: 'active' };
  if (imageType) query.imageType = imageType;

  return this.find(query)
    .populate('device', 'name manufacturer model type')
    .populate('validatedBy', 'firstName lastName')
    .sort('-capturedAt')
    .limit(limit);
};

deviceImageSchema.statics.getExamImages = async function(examId) {
  return this.find({
    ophthalmologyExam: examId,
    status: 'active'
  })
    .populate('device', 'name manufacturer model type')
    .sort('capturedAt');
};

deviceImageSchema.statics.getUnvalidatedImages = async function(limit = 50) {
  return this.find({
    'validation.status': 'pending',
    status: 'active'
  })
    .populate('patient', 'firstName lastName patientNumber')
    .populate('device', 'name type')
    .sort('capturedAt')
    .limit(limit);
};

deviceImageSchema.statics.getImagesBySeries = async function(seriesId) {
  return this.find({
    'series.seriesId': seriesId,
    status: 'active'
  }).sort('series.imageNumber');
};

deviceImageSchema.statics.findByDICOMUID = async function(sopInstanceUID) {
  return this.findOne({
    'dicom.sopInstanceUID': sopInstanceUID
  });
};

deviceImageSchema.statics.getRecentImages = async function(deviceId, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const query = {
    capturedAt: { $gte: since },
    status: 'active'
  };

  if (deviceId) query.device = deviceId;

  return this.find(query)
    .populate('device', 'name type')
    .populate('patient', 'firstName lastName patientNumber')
    .sort('-capturedAt');
};

module.exports = mongoose.model('DeviceImage', deviceImageSchema);
