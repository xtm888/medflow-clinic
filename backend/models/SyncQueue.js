const mongoose = require('mongoose');

/**
 * Sync Queue Model
 * Stores changes made locally that need to be synced to central server
 * Used for offline-first architecture in unreliable network conditions
 */
const syncQueueSchema = new mongoose.Schema({
  // Unique sync ID
  syncId: {
    type: String,
    unique: true,
    default: () => `SYNC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },

  // Which clinic made this change
  clinicId: {
    type: String,
    required: true,
    index: true
  },

  // What type of operation
  operation: {
    type: String,
    enum: ['create', 'update', 'delete'],
    required: true
  },

  // Which collection/model was affected
  collection: {
    type: String,
    required: true,
    enum: [
      'patients', 'visits', 'appointments', 'invoices',
      'prescriptions', 'ophthalmologyExams', 'imagingStudies',
      'laboratoryResults', 'documents', 'users'
    ]
  },

  // The document ID that was changed
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  // The actual data (for create/update)
  data: {
    type: mongoose.Schema.Types.Mixed
  },

  // For updates, what fields changed
  changedFields: [String],

  // Timestamp of original change
  changedAt: {
    type: Date,
    default: Date.now,
    required: true
  },

  // Who made the change
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Sync status
  status: {
    type: String,
    enum: ['pending', 'syncing', 'synced', 'failed', 'conflict', 'dead_letter'],
    default: 'pending',
    index: true
  },

  // Retry logic (following EmailQueue pattern)
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
  lastError: String,
  errorHistory: [{
    error: String,
    timestamp: { type: Date, default: Date.now },
    attempt: Number
  }],

  // If synced successfully
  syncedAt: Date,
  syncedTo: String, // Central server ID

  // Conflict resolution
  conflict: {
    detected: { type: Boolean, default: false },
    centralVersion: mongoose.Schema.Types.Mixed,
    resolution: {
      type: String,
      enum: ['pending', 'local_wins', 'central_wins', 'merged', 'manual']
    },
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },

  // Priority (urgent changes sync first)
  priority: {
    type: Number,
    default: 5, // 1 = highest, 10 = lowest
    min: 1,
    max: 10
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
syncQueueSchema.index({ status: 1, priority: 1, changedAt: 1 });
syncQueueSchema.index({ clinicId: 1, status: 1 });
syncQueueSchema.index({ collection: 1, documentId: 1 });
syncQueueSchema.index({ status: 1, nextAttempt: 1, priority: 1 }); // For queue processing

// ============================================
// INSTANCE METHODS (following EmailQueue pattern)
// ============================================

/**
 * Calculate exponential backoff delay for next retry
 * Pattern: 1min, 2min, 4min, 8min, 16min (capped at 30min)
 */
syncQueueSchema.methods.calculateNextAttempt = function() {
  const baseDelay = 60 * 1000; // 1 minute
  const delay = baseDelay * Math.pow(2, this.attempts);
  const maxDelay = 30 * 60 * 1000; // 30 minutes max
  return new Date(Date.now() + Math.min(delay, maxDelay));
};

/**
 * Mark sync item as failed with error tracking and exponential backoff
 */
syncQueueSchema.methods.markFailed = function(error) {
  this.attempts += 1;
  this.lastAttempt = new Date();
  this.lastError = error?.message || String(error);

  // Track error history for debugging
  this.errorHistory.push({
    error: this.lastError,
    timestamp: new Date(),
    attempt: this.attempts
  });

  if (this.attempts >= this.maxAttempts) {
    // Move to dead letter queue - requires manual intervention
    this.status = 'dead_letter';
    console.log(`[SYNC] Item ${this.syncId} moved to dead letter queue after ${this.attempts} attempts`);
  } else {
    // Schedule retry with exponential backoff
    this.status = 'pending';
    this.nextAttempt = this.calculateNextAttempt();
    console.log(`[SYNC] Item ${this.syncId} scheduled for retry at ${this.nextAttempt} (attempt ${this.attempts}/${this.maxAttempts})`);
  }

  return this.save();
};

/**
 * Mark sync item as successfully synced
 */
syncQueueSchema.methods.markSynced = function(centralServerId) {
  this.status = 'synced';
  this.syncedAt = new Date();
  this.syncedTo = centralServerId;
  this.lastAttempt = new Date();
  return this.save();
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Get items ready to sync (respecting exponential backoff timing)
 */
syncQueueSchema.statics.getPendingForSync = async function(clinicId, limit = 100) {
  return this.find({
    clinicId,
    status: 'pending',
    nextAttempt: { $lte: new Date() }, // Only items due for retry
    attempts: { $lt: 5 }
  })
    .sort({ priority: 1, nextAttempt: 1 })
    .limit(limit);
  // Note: removed .lean() so instance methods are available
};

/**
 * Get items in dead letter queue (permanently failed)
 */
syncQueueSchema.statics.getDeadLetterItems = async function(clinicId, limit = 100) {
  return this.find({
    clinicId,
    status: 'dead_letter'
  })
    .sort({ updatedAt: -1 })
    .limit(limit);
};

/**
 * Retry a dead letter item (reset attempts and move back to pending)
 */
syncQueueSchema.statics.retryDeadLetter = async function(syncId) {
  return this.findOneAndUpdate(
    { syncId, status: 'dead_letter' },
    {
      $set: {
        status: 'pending',
        attempts: 0,
        nextAttempt: new Date(),
        lastError: null
      },
      $push: {
        errorHistory: {
          error: 'Manual retry from dead letter queue',
          timestamp: new Date(),
          attempt: 0
        }
      }
    },
    { new: true }
  );
};

// Mark items as synced
syncQueueSchema.statics.markSynced = async function(syncIds, centralServerId) {
  return this.updateMany(
    { syncId: { $in: syncIds } },
    {
      $set: {
        status: 'synced',
        syncedAt: new Date(),
        syncedTo: centralServerId
      }
    }
  );
};

/**
 * Mark item as failed using instance method (with exponential backoff)
 * This static version finds the document and calls the instance method
 */
syncQueueSchema.statics.markFailedWithBackoff = async function(syncId, error) {
  const item = await this.findOne({ syncId });
  if (!item) return null;
  return item.markFailed(error);
};

/**
 * Get comprehensive sync statistics including dead letter queue
 */
syncQueueSchema.statics.getStats = async function(clinicId) {
  const stats = await this.aggregate([
    { $match: { clinicId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    pending: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
    conflict: 0,
    dead_letter: 0,
    total: 0
  };

  stats.forEach(s => {
    result[s._id] = s.count;
    result.total += s.count;
  });

  // Get items due for retry (ready now)
  const readyForRetry = await this.countDocuments({
    clinicId,
    status: 'pending',
    nextAttempt: { $lte: new Date() }
  });

  // Get recent failures (last 24 hours)
  const recentFailures = await this.countDocuments({
    clinicId,
    status: { $in: ['failed', 'dead_letter'] },
    updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });

  result.readyForRetry = readyForRetry;
  result.recentFailures = recentFailures;

  return result;
};

// Clean up old synced items (keep 30 days)
syncQueueSchema.statics.cleanup = async function(daysToKeep = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);

  return this.deleteMany({
    status: 'synced',
    syncedAt: { $lt: cutoff }
  });
};

module.exports = mongoose.model('SyncQueue', syncQueueSchema);
