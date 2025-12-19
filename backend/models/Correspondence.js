const mongoose = require('mongoose');

const correspondenceSchema = new mongoose.Schema({
  correspondenceId: {
    type: String,
    unique: true,
    sparse: true
  },

  type: {
    type: String,
    enum: ['referral', 'summary', 'report', 'insurance', 'patient', 'consultation', 'follow-up', 'authorization', 'results'],
    required: true
  },

  visit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Visit'
  },

  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },

  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },

  // Recipient information
  recipient: {
    type: {
      type: String,
      enum: ['patient', 'provider', 'insurance', 'pharmacy', 'laboratory', 'other'],
      required: true
    },
    name: {
      type: String,
      required: true
    },
    title: String,
    organization: String,
    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String
    },
    email: String,
    fax: String,
    phone: String,
    preferredMethod: {
      type: String,
      enum: ['email', 'fax', 'mail', 'portal', 'phone']
    }
  },

  // Carbon copy recipients
  cc: [{
    name: String,
    email: String,
    type: String
  }],

  // Letter content
  content: {
    subject: {
      type: String,
      required: true
    },
    salutation: String,
    body: {
      type: String,
      required: true
    },
    closing: String,
    signature: {
      name: String,
      title: String,
      credentials: String,
      electronic: Boolean
    },
    footer: String
  },

  // Attachments
  attachments: [{
    name: String,
    type: String,
    url: String,
    size: Number,
    uploadedAt: Date
  }],

  // Template used (if any)
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template'
  },

  // Clinical information included
  clinicalSummary: {
    diagnoses: [{
      code: String,
      description: String
    }],
    medications: [String],
    allergies: [String],
    procedures: [String],
    labResults: [{
      test: String,
      result: String,
      date: Date
    }],
    vitalSigns: mongoose.Schema.Types.Mixed,
    findings: String,
    plan: String
  },

  // Referral specific fields
  referralDetails: {
    urgency: {
      type: String,
      enum: ['routine', 'urgent', 'emergent', 'elective']
    },
    reason: String,
    specialty: String,
    providerRequested: String,
    appointmentRequested: Boolean,
    consultationOnly: Boolean,
    assumeCare: Boolean,
    returnToSender: Boolean,
    clinicalQuestion: String,
    relevantHistory: String,
    priorTreatments: String
  },

  // Insurance authorization fields
  authorizationDetails: {
    authorizationNumber: String,
    procedureCode: String,
    diagnosisCode: String,
    numberOfVisits: Number,
    validFrom: Date,
    validTo: Date,
    status: {
      type: String,
      enum: ['pending', 'approved', 'denied', 'partial']
    }
  },

  // Status and tracking
  status: {
    type: String,
    enum: ['draft', 'pending-review', 'approved', 'sent', 'delivered', 'failed', 'read', 'responded'],
    default: 'draft'
  },

  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },

  // Review and approval
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  reviewNotes: String,

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,

  // Sending information
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  sentAt: Date,

  deliveryMethod: {
    type: String,
    enum: ['email', 'fax', 'mail', 'portal', 'hand-delivered', 'phone']
  },

  // Delivery tracking
  tracking: {
    messageId: String, // Email message ID or fax ID
    opened: Boolean,
    openedAt: Date,
    clicks: Number,
    downloads: [{
      fileName: String,
      downloadedAt: Date
    }],
    bounced: Boolean,
    bounceReason: String,
    delivered: Boolean,
    deliveredAt: Date,
    faxConfirmation: String,
    mailingTrackingNumber: String
  },

  // Response tracking
  response: {
    received: Boolean,
    receivedAt: Date,
    responseType: String,
    responseContent: String,
    responseAttachments: [{
      name: String,
      url: String
    }],
    actionRequired: Boolean,
    actionTaken: String
  },

  // Follow-up
  followUp: {
    required: Boolean,
    date: Date,
    reason: String,
    completed: Boolean,
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    completedAt: Date,
    notes: String
  },

  // Compliance and legal
  compliance: {
    hipaaCompliant: {
      type: Boolean,
      default: true
    },
    consentObtained: Boolean,
    consentDate: Date,
    releaseOfInformation: Boolean,
    roiExpirationDate: Date,
    legalReview: Boolean,
    legalReviewBy: String,
    legalReviewDate: Date
  },

  // Version control
  version: {
    type: Number,
    default: 1
  },

  revisions: [{
    version: Number,
    content: mongoose.Schema.Types.Mixed,
    revisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    revisedAt: Date,
    changeReason: String
  }],

  // Metadata
  tags: [String],

  relatedCorrespondence: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Correspondence'
  }],

  // Audit
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
correspondenceSchema.index({ patient: 1, createdAt: -1 });
correspondenceSchema.index({ correspondenceId: 1 });
correspondenceSchema.index({ type: 1, status: 1 });
correspondenceSchema.index({ 'recipient.type': 1 });
correspondenceSchema.index({ sentAt: -1 });
correspondenceSchema.index({ 'followUp.required': 1, 'followUp.date': 1 });

// Generate unique correspondenceId
correspondenceSchema.pre('save', async function(next) {
  if (!this.correspondenceId) {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    const prefix = this.type.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();

    this.correspondenceId = `COR-${prefix}-${year}${month}-${random}`;
  }

  // Save revision if content changed
  if (this.isModified('content') && !this.isNew) {
    this.revisions = this.revisions || [];
    this.revisions.push({
      version: this.version,
      content: this.content,
      revisedBy: this.updatedBy,
      revisedAt: new Date(),
      changeReason: 'Content updated'
    });
    this.version += 1;
  }

  next();
});

// Method to send correspondence
correspondenceSchema.methods.send = async function(userId, method) {
  this.status = 'sent';
  this.sentBy = userId;
  this.sentAt = new Date();
  this.deliveryMethod = method;
  return this.save();
};

// Method to mark as delivered
correspondenceSchema.methods.markDelivered = function() {
  this.status = 'delivered';
  this.tracking.delivered = true;
  this.tracking.deliveredAt = new Date();
  return this.save();
};

// Method to record response
correspondenceSchema.methods.recordResponse = function(responseData) {
  this.status = 'responded';
  this.response = {
    received: true,
    receivedAt: new Date(),
    ...responseData
  };
  return this.save();
};

// Static method to get pending follow-ups
correspondenceSchema.statics.getPendingFollowUps = async function(userId, daysAhead = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return this.find({
    'followUp.required': true,
    'followUp.completed': { $ne: true },
    'followUp.date': { $lte: futureDate }
  })
    .populate('patient', 'firstName lastName')
    .populate('createdBy', 'firstName lastName')
    .sort({ 'followUp.date': 1 });
};

// Static method to get correspondence history
correspondenceSchema.statics.getHistory = async function(patientId, limit = 20) {
  return this.find({ patient: patientId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('createdBy', 'firstName lastName')
    .select('correspondenceId type recipient.name subject status sentAt');
};

module.exports = mongoose.model('Correspondence', correspondenceSchema);
