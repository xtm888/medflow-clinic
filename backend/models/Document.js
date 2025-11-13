const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  // Basic document information
  documentId: {
    type: String,
    unique: true,
    sparse: true
  },

  title: {
    type: String,
    required: true
  },

  description: String,

  // Document categorization
  category: {
    type: String,
    enum: ['clinical', 'administrative', 'imaging', 'laboratory', 'correspondence',
           'consent', 'insurance', 'referral', 'report', 'audio', 'photo', 'other'],
    required: true
  },

  subCategory: {
    type: String,
    enum: ['fundus-photo', 'oct', 'visual-field', 'topography', 'ultrasound',
           'blood-test', 'urinalysis', 'culture', 'pathology',
           'letter', 'email', 'fax', 'sms',
           'surgical-consent', 'treatment-consent', 'research-consent',
           'prior-auth', 'claim', 'eob',
           'specialist-referral', 'therapy-referral',
           'surgical-report', 'consultation-report', 'progress-note',
           'voice-memo', 'dictation', 'patient-photo', 'wound-photo']
  },

  // Document type and format
  type: {
    type: String,
    enum: ['pdf', 'image', 'audio', 'video', 'text', 'dicom', 'html', 'other'],
    required: true
  },

  mimeType: String,

  // File information
  file: {
    filename: String,
    originalName: String,
    size: Number,
    path: String,
    url: String,
    cloudUrl: String,
    thumbnailUrl: String,
    hash: String // For deduplication
  },

  // Audio-specific fields
  audio: {
    duration: Number, // seconds
    transcription: {
      text: String,
      confidence: Number,
      language: String,
      timestamp: Date,
      engine: String // 'whisper', 'google', 'azure'
    },
    waveformData: [Number],
    keywords: [String],
    summary: String
  },

  // Image-specific fields
  image: {
    width: Number,
    height: Number,
    annotations: [{
      id: String,
      type: String, // 'arrow', 'circle', 'rectangle', 'text', 'measurement'
      coordinates: mongoose.Schema.Types.Mixed,
      label: String,
      color: String,
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: Date
    }],
    aiAnalysis: {
      findings: [String],
      confidence: Number,
      processedAt: Date
    }
  },

  // Document associations
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

  prescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription'
  },

  correspondence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Correspondence'
  },

  // Related documents
  relatedDocuments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],

  parentDocument: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  },

  // Metadata and content
  metadata: {
    dateCreated: Date,
    dateModified: Date,
    source: {
      type: String,
      enum: ['upload', 'scan', 'fax', 'email', 'api', 'device', 'generated']
    },
    device: String,
    software: String,
    version: String
  },

  // OCR and searchable content
  content: {
    extracted: String, // OCR or transcribed text
    searchable: String, // Processed text for search
    language: String,
    pages: Number,
    wordCount: Number
  },

  // Tags and labels
  tags: [String],

  labels: [{
    name: String,
    value: String,
    color: String
  }],

  customFields: mongoose.Schema.Types.Mixed,

  // Version control
  version: {
    number: {
      type: Number,
      default: 1
    },
    history: [{
      version: Number,
      modifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      modifiedAt: Date,
      changes: String,
      file: {
        filename: String,
        path: String,
        size: Number
      }
    }]
  },

  // Security and privacy
  security: {
    encrypted: Boolean,
    encryptionMethod: String,
    sensitiveData: Boolean,
    accessLevel: {
      type: String,
      enum: ['public', 'staff', 'provider', 'admin', 'patient-only'],
      default: 'staff'
    },
    sharedWith: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      permission: {
        type: String,
        enum: ['view', 'edit', 'delete']
      },
      sharedAt: Date,
      expiresAt: Date
    }]
  },

  // Workflow status
  status: {
    type: String,
    enum: ['draft', 'pending', 'reviewed', 'approved', 'archived', 'deleted'],
    default: 'pending'
  },

  reviewStatus: {
    required: Boolean,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date,
    comments: String,
    flags: [String]
  },

  // Legal and compliance
  legal: {
    retentionPeriod: Number, // days
    retentionExpiry: Date,
    complianceFlags: [String],
    signatureRequired: Boolean,
    signatures: [{
      signedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      signedAt: Date,
      signatureType: String, // 'electronic', 'digital', 'biometric'
      signatureData: String,
      ipAddress: String
    }]
  },

  // Full-text search index
  searchIndex: {
    content: String,
    boost: Number
  },

  // Statistics
  stats: {
    views: Number,
    downloads: Number,
    prints: Number,
    lastViewed: Date,
    lastDownloaded: Date,
    lastPrinted: Date
  },

  // Deletion tracking (soft delete)
  deleted: {
    type: Boolean,
    default: false
  },

  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Audit fields
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
documentSchema.index({ patient: 1, visit: 1 });
documentSchema.index({ category: 1, subCategory: 1 });
documentSchema.index({ status: 1 });
documentSchema.index({ 'content.searchable': 'text', title: 'text', tags: 'text' });
documentSchema.index({ 'file.hash': 1 });
documentSchema.index({ deleted: 1 });
documentSchema.index({ createdAt: -1 });

// Pre-save middleware
documentSchema.pre('save', async function(next) {
  // Generate document ID
  if (this.isNew && !this.documentId) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await mongoose.model('Document').countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      }
    });
    this.documentId = `DOC${dateStr}${(count + 1).toString().padStart(4, '0')}`;
  }

  // Set retention expiry if retention period is specified
  if (this.legal && this.legal.retentionPeriod && !this.legal.retentionExpiry) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + this.legal.retentionPeriod);
    this.legal.retentionExpiry = expiryDate;
  }

  next();
});

// Methods
documentSchema.methods.addAnnotation = function(annotationData) {
  if (!this.image) {
    this.image = { annotations: [] };
  }
  if (!this.image.annotations) {
    this.image.annotations = [];
  }

  const annotation = {
    id: new mongoose.Types.ObjectId().toString(),
    ...annotationData,
    createdAt: new Date()
  };

  this.image.annotations.push(annotation);
  return this.save();
};

documentSchema.methods.transcribeAudio = async function(engine = 'whisper') {
  if (this.type !== 'audio' || !this.file.path) {
    throw new Error('Document is not an audio file');
  }

  // This would integrate with actual transcription service
  // For now, return mock transcription
  this.audio.transcription = {
    text: 'Mock transcription of audio content',
    confidence: 0.95,
    language: 'en',
    timestamp: new Date(),
    engine: engine
  };

  // Extract keywords (mock)
  this.audio.keywords = ['patient', 'examination', 'treatment'];

  // Generate summary (mock)
  this.audio.summary = 'Patient discussed symptoms and treatment options';

  // Update searchable content
  this.content.searchable = this.audio.transcription.text;

  return this.save();
};

documentSchema.methods.ocrDocument = async function() {
  if (this.type !== 'pdf' && this.type !== 'image') {
    throw new Error('Document type not suitable for OCR');
  }

  // This would integrate with actual OCR service
  // For now, return mock OCR result
  this.content.extracted = 'Mock OCR extracted text from document';
  this.content.searchable = this.content.extracted;
  this.content.wordCount = 100;

  return this.save();
};

documentSchema.methods.shareWith = function(userId, permission = 'view', expiresInDays = null) {
  if (!this.security.sharedWith) {
    this.security.sharedWith = [];
  }

  const shareData = {
    user: userId,
    permission: permission,
    sharedAt: new Date()
  };

  if (expiresInDays) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiresInDays);
    shareData.expiresAt = expiryDate;
  }

  this.security.sharedWith.push(shareData);
  return this.save();
};

documentSchema.methods.createVersion = function(file, userId, changes) {
  this.version.history.push({
    version: this.version.number,
    modifiedBy: userId,
    modifiedAt: new Date(),
    changes: changes,
    file: {
      filename: this.file.filename,
      path: this.file.path,
      size: this.file.size
    }
  });

  this.version.number += 1;
  this.file = file;
  this.updatedBy = userId;

  return this.save();
};

documentSchema.methods.trackView = function() {
  if (!this.stats) {
    this.stats = {};
  }
  this.stats.views = (this.stats.views || 0) + 1;
  this.stats.lastViewed = new Date();
  return this.save();
};

// Static methods
documentSchema.statics.searchDocuments = async function(query, options = {}) {
  const searchQuery = {
    $text: { $search: query },
    deleted: false
  };

  if (options.patientId) {
    searchQuery.patient = options.patientId;
  }

  if (options.visitId) {
    searchQuery.visit = options.visitId;
  }

  if (options.category) {
    searchQuery.category = options.category;
  }

  if (options.dateFrom || options.dateTo) {
    searchQuery.createdAt = {};
    if (options.dateFrom) searchQuery.createdAt.$gte = options.dateFrom;
    if (options.dateTo) searchQuery.createdAt.$lte = options.dateTo;
  }

  return this.find(searchQuery)
    .select('title category type createdAt patient visit')
    .populate('patient', 'firstName lastName')
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 50);
};

documentSchema.statics.getByVisit = async function(visitId) {
  return this.find({ visit: visitId, deleted: false })
    .populate('createdBy', 'firstName lastName')
    .sort('-createdAt');
};

documentSchema.statics.getRecentAudioNotes = async function(patientId, limit = 10) {
  return this.find({
    patient: patientId,
    type: 'audio',
    deleted: false
  })
    .select('title audio.duration audio.summary createdAt')
    .sort('-createdAt')
    .limit(limit);
};

documentSchema.statics.checkDuplicate = async function(fileHash) {
  return this.findOne({ 'file.hash': fileHash, deleted: false });
};

documentSchema.statics.getRetentionExpired = async function() {
  return this.find({
    'legal.retentionExpiry': { $lte: new Date() },
    deleted: false
  });
};

module.exports = mongoose.model('Document', documentSchema);