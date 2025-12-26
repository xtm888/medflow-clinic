const mongoose = require('mongoose');

const emailQueueSchema = new mongoose.Schema({
  // Email content
  to: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true
  },
  html: {
    type: String,
    required: true
  },
  text: String,
  from: {
    type: String,
    default: 'CareVision Medical <noreply@carevision.com>'
  },

  // Template info (for debugging/logging)
  template: String,
  templateData: mongoose.Schema.Types.Mixed,

  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'processing', 'sent', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },

  // Priority (lower = higher priority)
  priority: {
    type: Number,
    default: 5,
    min: 1,
    max: 10,
    index: true
  },

  // Retry logic
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 5
  },
  lastAttempt: Date,
  nextAttempt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Error tracking
  lastError: String,
  errorHistory: [{
    error: String,
    timestamp: { type: Date, default: Date.now },
    attempt: Number
  }],

  // Result
  sentAt: Date,
  messageId: String,

  // Scheduling
  scheduledFor: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Context for debugging
  context: {
    type: String,
    enum: ['appointment', 'prescription', 'invoice', 'auth', 'notification', 'other'],
    default: 'other'
  },
  relatedId: mongoose.Schema.Types.ObjectId,
  relatedModel: String,

  // User who triggered the email
  createdBy: {
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

// Compound index for queue processing
emailQueueSchema.index({ status: 1, nextAttempt: 1, priority: 1 });

// Index for cleanup
emailQueueSchema.index({ createdAt: 1 });

// Calculate exponential backoff delay
emailQueueSchema.methods.calculateNextAttempt = function() {
  // Exponential backoff: 1min, 2min, 4min, 8min, 16min
  const baseDelay = 60 * 1000; // 1 minute
  const delay = baseDelay * Math.pow(2, this.attempts);
  const maxDelay = 30 * 60 * 1000; // 30 minutes max
  return new Date(Date.now() + Math.min(delay, maxDelay));
};

// Mark email as failed with error
emailQueueSchema.methods.markFailed = function(error) {
  this.attempts += 1;
  this.lastAttempt = new Date();
  this.lastError = error.message || String(error);
  this.errorHistory.push({
    error: this.lastError,
    attempt: this.attempts
  });

  if (this.attempts >= this.maxAttempts) {
    this.status = 'failed';
  } else {
    this.status = 'pending';
    this.nextAttempt = this.calculateNextAttempt();
  }
};

// Mark email as sent
emailQueueSchema.methods.markSent = function(messageId) {
  this.status = 'sent';
  this.sentAt = new Date();
  this.messageId = messageId;
  this.lastAttempt = new Date();
};

// Static: Get emails ready to process
emailQueueSchema.statics.getReadyEmails = function(limit = 10) {
  return this.find({
    status: 'pending',
    nextAttempt: { $lte: new Date() },
    scheduledFor: { $lte: new Date() }
  })
    .sort({ priority: 1, nextAttempt: 1 })
    .limit(limit);
};

// Static: Clean up old emails
emailQueueSchema.statics.cleanupOld = async function(daysOld = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const result = await this.deleteMany({
    status: { $in: ['sent', 'cancelled'] },
    createdAt: { $lt: cutoff }
  });

  return result.deletedCount;
};

// Static: Get queue stats
emailQueueSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
    total: 0
  };

  stats.forEach(s => {
    result[s._id] = s.count;
    result.total += s.count;
  });

  // Get recent failures
  const recentFailures = await this.countDocuments({
    status: 'failed',
    updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });

  result.recentFailures = recentFailures;

  return result;
};

module.exports = mongoose.model('EmailQueue', emailQueueSchema);
