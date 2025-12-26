const mongoose = require('mongoose');
const Counter = require('./Counter');

/**
 * Imaging Study Model
 * Stores medical imaging studies and reports
 */
const imagingStudySchema = new mongoose.Schema({
  studyId: {
    type: String,
    unique: true
  },

  imagingOrder: {
    type: mongoose.Schema.ObjectId,
    ref: 'ImagingOrder'
  },

  patient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient is required']
  },

  // DICOM identifiers
  studyInstanceUID: {
    type: String,
    sparse: true
  },
  accessionNumber: {
    type: String,
    sparse: true
  },

  // Study details
  studyDate: {
    type: Date,
    default: Date.now
  },
  studyTime: String,

  modality: {
    type: String,
    required: true
  },

  description: String,

  bodyPart: String,
  laterality: {
    type: String,
    enum: ['left', 'right', 'bilateral', 'na']
  },

  status: {
    type: String,
    enum: ['acquired', 'preliminary', 'final', 'addendum', 'cancelled'],
    default: 'acquired'
  },

  // Images/Series
  numberOfSeries: {
    type: Number,
    default: 0
  },
  numberOfImages: {
    type: Number,
    default: 0
  },

  series: [{
    seriesInstanceUID: String,
    seriesNumber: Number,
    seriesDescription: String,
    modality: String,
    numberOfImages: Number,
    bodyPart: String
  }],

  images: [{
    sopInstanceUID: String,
    seriesIndex: Number,
    imageNumber: Number,
    url: String,
    thumbnailUrl: String,
    acquisitionDate: Date,
    description: String,
    windowCenter: Number,
    windowWidth: Number,
    rows: Number,
    columns: Number,
    annotations: [{
      type: String,
      coordinates: mongoose.Schema.Types.Mixed,
      text: String,
      createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      createdAt: Date
    }]
  }],

  // Report
  report: {
    status: {
      type: String,
      enum: ['pending', 'draft', 'preliminary', 'final', 'addendum'],
      default: 'pending'
    },
    findings: String,
    impression: String,
    recommendations: String,
    comparison: String,
    technique: String,
    limitationsOrDifficulties: String,
    additionalComments: String,

    // Structured findings (for specific modalities)
    structuredFindings: mongoose.Schema.Types.Mixed,

    // Measurements
    measurements: [{
      name: String,
      value: Number,
      unit: String,
      location: String,
      referenceRange: {
        low: Number,
        high: Number
      },
      flag: {
        type: String,
        enum: ['normal', 'abnormal', 'critical']
      }
    }],

    // Critical findings
    criticalFindings: {
      present: {
        type: Boolean,
        default: false
      },
      description: String,
      notifiedAt: Date,
      notifiedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      acknowledgedAt: Date,
      acknowledgedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      }
    },

    // Report workflow
    draftedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    draftedAt: Date,

    reportedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    reportedAt: Date,

    verifiedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date,

    // Addendum
    addenda: [{
      text: String,
      createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      },
      createdAt: Date,
      reason: String
    }]
  },

  // Technician info
  technician: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  // Equipment
  equipment: {
    type: mongoose.Schema.ObjectId,
    ref: 'Device'
  },
  equipmentInfo: {
    manufacturer: String,
    model: String,
    stationName: String
  },

  // Radiation dose (for applicable modalities)
  radiation: {
    applicable: {
      type: Boolean,
      default: false
    },
    dose: Number,
    unit: String,
    dlp: Number,
    ctdi: Number,
    dap: Number
  },

  // Contrast
  contrast: {
    used: Boolean,
    type: String,
    volume: String,
    route: String,
    adverseReaction: Boolean,
    reactionDescription: String
  },

  // Storage location
  storage: {
    location: String,
    archiveStatus: {
      type: String,
      enum: ['online', 'nearline', 'offline', 'archived'],
      default: 'online'
    },
    size: Number,
    pacsStudyId: String,
    // Multi-clinic support
    clinicId: String,
    clinicName: String,
    networkPath: String
  },

  // Attachments (non-DICOM files)
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
    description: String,
    category: {
      type: String,
      enum: ['report', 'image', 'video', 'other']
    }
  }],

  // Billing
  billing: {
    professionalComponent: {
      billed: Boolean,
      invoice: {
        type: mongoose.Schema.ObjectId,
        ref: 'Invoice'
      }
    },
    technicalComponent: {
      billed: Boolean,
      invoice: {
        type: mongoose.Schema.ObjectId,
        ref: 'Invoice'
      }
    }
  },

  // Sharing
  sharing: [{
    sharedWith: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    sharedAt: Date,
    accessLevel: {
      type: String,
      enum: ['view', 'report']
    },
    expiresAt: Date
  }],

  // External sharing
  externalSharing: [{
    recipientEmail: String,
    recipientName: String,
    sharedAt: Date,
    accessToken: String,
    expiresAt: Date,
    accessCount: Number,
    lastAccessed: Date
  }],

  notes: String,

  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  updatedBy: {
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
imagingStudySchema.index({ patient: 1, studyDate: -1 });
imagingStudySchema.index({ imagingOrder: 1 });
imagingStudySchema.index({ studyId: 1 }, { unique: true });
imagingStudySchema.index({ accessionNumber: 1 }, { sparse: true });
imagingStudySchema.index({ studyInstanceUID: 1 }, { sparse: true });
imagingStudySchema.index({ modality: 1, studyDate: -1 });
imagingStudySchema.index({ 'report.status': 1 });
imagingStudySchema.index({ createdAt: -1 });
// Multi-clinic indexes
imagingStudySchema.index({ 'storage.clinicId': 1, studyDate: -1 });
imagingStudySchema.index({ 'storage.clinicId': 1, patient: 1 });

// Virtual for has report
imagingStudySchema.virtual('hasReport').get(function() {
  return this.report && this.report.status !== 'pending';
});

// Virtual for is finalized
imagingStudySchema.virtual('isFinalized').get(function() {
  return this.report && this.report.status === 'final';
});

// Generate study ID before saving
imagingStudySchema.pre('save', async function(next) {
  if (this.isNew && !this.studyId) {
    const counterId = Counter.getYearlyCounterId('imagingStudy');
    const sequence = await Counter.getNextSequence(counterId);
    const year = new Date().getFullYear();
    this.studyId = `STU${year}${String(sequence).padStart(6, '0')}`;
  }
  next();
});

// Post save - update imaging order
imagingStudySchema.post('save', async function() {
  try {
    if (this.imagingOrder) {
      const ImagingOrder = mongoose.model('ImagingOrder');
      await ImagingOrder.findByIdAndUpdate(this.imagingOrder, {
        study: this._id,
        status: 'completed'
      });
    }
  } catch (error) {
    console.error('Error updating imaging order after study save:', error);
  }
});

// Static method to get unreported studies
imagingStudySchema.statics.getUnreported = async function(options = {}) {
  const query = {
    'report.status': { $in: ['pending', 'draft'] }
  };

  if (options.modality) query.modality = options.modality;
  if (options.radiologist) query['report.reportedBy'] = options.radiologist;

  return this.find(query)
    .populate('patient', 'firstName lastName patientId dateOfBirth')
    .populate('imagingOrder', 'orderedBy clinicalIndication priority')
    .sort({ studyDate: 1 });
};

// Static method to get patient's imaging history
imagingStudySchema.statics.getPatientHistory = async function(patientId, options = {}) {
  const query = { patient: patientId };

  if (options.modality) query.modality = options.modality;
  if (options.bodyPart) query.bodyPart = options.bodyPart;

  return this.find(query)
    .populate('imagingOrder', 'orderedBy examType')
    .sort({ studyDate: -1 })
    .limit(options.limit || 50);
};

// Static method to get studies with critical findings needing acknowledgment
imagingStudySchema.statics.getUnacknowledgedCritical = async function() {
  return this.find({
    'report.criticalFindings.present': true,
    'report.criticalFindings.acknowledgedAt': { $exists: false }
  })
    .populate('patient', 'firstName lastName patientId phoneNumber')
    .populate('imagingOrder', 'orderedBy')
    .sort({ studyDate: -1 });
};

// Instance method to draft report
imagingStudySchema.methods.draftReport = async function(draftedBy, reportData) {
  this.report = {
    ...this.report,
    ...reportData,
    status: 'draft',
    draftedBy,
    draftedAt: new Date()
  };
  this.status = 'preliminary';
  this.updatedBy = draftedBy;
  return this.save();
};

// Instance method to finalize report
imagingStudySchema.methods.finalizeReport = async function(reportedBy, reportData) {
  this.report = {
    ...this.report,
    ...reportData,
    status: 'final',
    reportedBy,
    reportedAt: new Date()
  };
  this.status = 'final';
  this.updatedBy = reportedBy;
  return this.save();
};

// Instance method to verify report
imagingStudySchema.methods.verifyReport = async function(verifiedBy) {
  this.report.verifiedBy = verifiedBy;
  this.report.verifiedAt = new Date();
  this.updatedBy = verifiedBy;
  return this.save();
};

// Instance method to add addendum
imagingStudySchema.methods.addAddendum = async function(createdBy, text, reason) {
  if (!this.report.addenda) this.report.addenda = [];

  this.report.addenda.push({
    text,
    createdBy,
    createdAt: new Date(),
    reason
  });

  this.report.status = 'addendum';
  this.status = 'addendum';
  this.updatedBy = createdBy;
  return this.save();
};

// Instance method to acknowledge critical findings
imagingStudySchema.methods.acknowledgeCritical = async function(acknowledgedBy) {
  this.report.criticalFindings.acknowledgedAt = new Date();
  this.report.criticalFindings.acknowledgedBy = acknowledgedBy;
  this.updatedBy = acknowledgedBy;
  return this.save();
};

// Instance method to add image
imagingStudySchema.methods.addImage = async function(imageData, uploadedBy) {
  this.images.push({
    ...imageData,
    uploadedAt: new Date()
  });
  this.numberOfImages = this.images.length;
  this.updatedBy = uploadedBy;
  return this.save();
};

module.exports = mongoose.model('ImagingStudy', imagingStudySchema);
