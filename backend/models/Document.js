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
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic is required for multi-tenant isolation'],
    index: true
  },

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
documentSchema.index({ patient: 1, visit: 1 });
documentSchema.index({ clinic: 1, category: 1, createdAt: -1 });
documentSchema.index({ clinic: 1, patient: 1, createdAt: -1 });
documentSchema.index({ patient: 1, createdAt: -1 });
documentSchema.index({ prescription: 1 });
documentSchema.index({ appointment: 1 });
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
  throw new Error('Audio transcription feature not available');
};

documentSchema.methods.ocrDocument = async function() {
  throw new Error('OCR feature not available');
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

/**
 * Track a generated PDF document in the Document collection
 * This creates a record of system-generated documents for audit and retrieval
 * @param {Object} options - Document tracking options
 * @param {String} options.type - Type of document (invoice, prescription, report, etc.)
 * @param {String} options.title - Document title
 * @param {ObjectId} options.patientId - Associated patient ID
 * @param {ObjectId} options.visitId - Associated visit ID (optional)
 * @param {ObjectId} options.userId - User who generated the document
 * @param {Object} options.metadata - Additional metadata (invoiceId, prescriptionId, etc.)
 * @param {String} options.filename - Generated filename
 * @param {Number} options.fileSize - Size of the PDF in bytes (optional)
 * @returns {Promise<Document>} Created document record
 */
documentSchema.statics.trackGeneratedPDF = async function(options) {
  const {
    type,
    title,
    patientId,
    visitId,
    userId,
    metadata = {},
    filename,
    fileSize = 0
  } = options;

  // Map type to category
  const categoryMap = {
    'invoice': 'administrative',
    'receipt': 'administrative',
    'statement': 'administrative',
    'claim': 'insurance',
    'prescription': 'clinical',
    'lab_report': 'laboratory',
    'patient_record': 'clinical',
    'patient_list': 'administrative',
    'company_statement': 'administrative',
    'aging_report': 'administrative',
    'batch_invoice': 'administrative'
  };

  try {
    const doc = await this.create({
      title,
      category: categoryMap[type] || 'report',
      subCategory: type,
      patient: patientId,
      visit: visitId,
      type: 'pdf',
      file: {
        filename,
        mimeType: 'application/pdf',
        size: fileSize,
        isGenerated: true,
        generatedAt: new Date()
      },
      status: 'final',
      metadata: {
        documentType: type,
        generatedBy: 'system',
        ...metadata
      },
      createdBy: userId,
      updatedBy: userId,
      source: 'system',
      access: {
        level: 'restricted'
      }
    });

    console.log(`[DOCUMENT] Tracked generated PDF: ${doc.documentId} - ${title}`);
    return doc;
  } catch (error) {
    // Log error but don't fail the PDF generation
    console.error(`[DOCUMENT] Error tracking generated PDF: ${error.message}`);
    return null;
  }
};

module.exports = mongoose.model('Document', documentSchema);
