/**
 * LegacyMapping Model
 *
 * Tracks migration status for legacy patient records from old EMR systems.
 * Used during data migration to:
 * - Track which legacy records have been processed
 * - Store match confidence and method
 * - Enable resume of interrupted migrations
 * - Provide audit trail for data import
 */

const mongoose = require('mongoose');

const legacyMappingSchema = new mongoose.Schema({
  // Legacy system identifier (unique per source system)
  legacyId: {
    type: String,
    required: true,
    index: true
  },

  // Source system name
  legacySystem: {
    type: String,
    enum: ['carevision', 'folder_based', 'nidek', 'zeiss', 'old_emr', 'excel_import', 'other'],
    default: 'folder_based'
  },

  // Reference to MedFlow patient (if matched/created)
  medflowPatientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    index: true
  },

  // Migration status
  status: {
    type: String,
    enum: [
      'pending',      // Not yet processed
      'matched',      // Matched to existing patient
      'created',      // New patient created
      'merged',       // Merged with existing patient
      'skipped',      // Intentionally skipped
      'error',        // Error during processing
      'review'        // Needs manual review
    ],
    default: 'pending',
    index: true
  },

  // Match confidence (0-1)
  matchConfidence: {
    type: Number,
    min: 0,
    max: 1
  },

  // How the match was made
  matchMethod: {
    type: String,
    enum: [
      'exact_id',       // Exact legacy ID match
      'name_dob',       // Name + DOB match
      'name_phone',     // Name + phone match
      'folder_name',    // Folder name parsing
      'face',           // Face recognition
      'manual',         // Manual linking by user
      'fuzzy_name',     // Fuzzy name matching
      'none'            // No match attempted/found
    ]
  },

  // Snapshot of imported data from legacy system
  importedData: {
    firstName: String,
    lastName: String,
    dateOfBirth: Date,
    gender: String,
    phone: String,
    email: String,
    nationalId: String,
    folderPath: String,
    folderName: String,
    // Raw data from source (device exports, etc.)
    rawData: mongoose.Schema.Types.Mixed
  },

  // Import statistics
  importStats: {
    examsImported: { type: Number, default: 0 },
    documentsImported: { type: Number, default: 0 },
    imagesImported: { type: Number, default: 0 },
    measurementsImported: { type: Number, default: 0 }
  },

  // Suggested matches (for review queue)
  suggestedMatches: [{
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient'
    },
    confidence: Number,
    matchMethod: String,
    matchedFields: [String]
  }],

  // Migration timestamps
  discoveredAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date,
  migratedAt: Date,
  migratedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Review information
  reviewedAt: Date,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewNotes: String,

  // Error tracking
  errorDetails: {
    code: String,
    message: String,
    stack: String,
    occurredAt: Date,
    retryCount: { type: Number, default: 0 }
  },

  // General notes
  notes: String,

  // Batch/job tracking
  batchId: String,
  jobId: String
}, {
  timestamps: true
});

// Compound indexes
legacyMappingSchema.index({ legacySystem: 1, legacyId: 1 }, { unique: true });
legacyMappingSchema.index({ status: 1, legacySystem: 1 });
legacyMappingSchema.index({ batchId: 1, status: 1 });
legacyMappingSchema.index({ 'importedData.lastName': 1, 'importedData.firstName': 1 });

// Static: Get migration statistics
legacyMappingSchema.statics.getMigrationStats = async function(legacySystem = null) {
  const match = legacySystem ? { legacySystem } : {};

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    total: 0,
    pending: 0,
    matched: 0,
    created: 0,
    merged: 0,
    skipped: 0,
    error: 0,
    review: 0
  };

  stats.forEach(s => {
    result[s._id] = s.count;
    result.total += s.count;
  });

  result.processed = result.matched + result.created + result.merged;
  result.successRate = result.total > 0
    ? ((result.processed / result.total) * 100).toFixed(2)
    : 0;

  return result;
};

// Static: Get pending records for processing
legacyMappingSchema.statics.getPending = function(options = {}) {
  const { legacySystem, limit = 100, skip = 0 } = options;

  const query = { status: 'pending' };
  if (legacySystem) query.legacySystem = legacySystem;

  return this.find(query)
    .sort({ discoveredAt: 1 })
    .skip(skip)
    .limit(limit);
};

// Static: Get records needing review
legacyMappingSchema.statics.getReviewQueue = function(options = {}) {
  const { legacySystem, limit = 50, skip = 0 } = options;

  const query = { status: 'review' };
  if (legacySystem) query.legacySystem = legacySystem;

  return this.find(query)
    .populate('suggestedMatches.patientId', 'patientId firstName lastName dateOfBirth')
    .sort({ discoveredAt: 1 })
    .skip(skip)
    .limit(limit);
};

// Static: Find by legacy ID
legacyMappingSchema.statics.findByLegacyId = function(legacyId, legacySystem = null) {
  const query = { legacyId };
  if (legacySystem) query.legacySystem = legacySystem;
  return this.findOne(query);
};

// Static: Mark as matched
legacyMappingSchema.statics.markMatched = async function(legacyId, medflowPatientId, matchInfo, userId) {
  return this.findOneAndUpdate(
    { legacyId },
    {
      $set: {
        status: 'matched',
        medflowPatientId,
        matchConfidence: matchInfo.confidence,
        matchMethod: matchInfo.method,
        migratedAt: new Date(),
        migratedBy: userId,
        processedAt: new Date()
      }
    },
    { new: true }
  );
};

// Static: Mark as error
legacyMappingSchema.statics.markError = async function(legacyId, error) {
  return this.findOneAndUpdate(
    { legacyId },
    {
      $set: {
        status: 'error',
        'errorDetails.code': error.code || 'UNKNOWN',
        'errorDetails.message': error.message,
        'errorDetails.stack': error.stack,
        'errorDetails.occurredAt': new Date()
      },
      $inc: { 'errorDetails.retryCount': 1 }
    },
    { new: true }
  );
};

// Static: Reset errors for retry
legacyMappingSchema.statics.resetErrors = async function(legacySystem = null) {
  const query = { status: 'error' };
  if (legacySystem) query.legacySystem = legacySystem;

  return this.updateMany(query, {
    $set: { status: 'pending' }
  });
};

// Instance: Add suggested match
legacyMappingSchema.methods.addSuggestedMatch = function(patientId, confidence, matchMethod, matchedFields = []) {
  if (!this.suggestedMatches) {
    this.suggestedMatches = [];
  }

  // Don't add duplicates
  const exists = this.suggestedMatches.some(
    m => m.patientId.toString() === patientId.toString()
  );

  if (!exists) {
    this.suggestedMatches.push({
      patientId,
      confidence,
      matchMethod,
      matchedFields
    });

    // Sort by confidence
    this.suggestedMatches.sort((a, b) => b.confidence - a.confidence);
  }

  return this;
};

// Instance: Update import stats
legacyMappingSchema.methods.updateImportStats = function(type, count = 1) {
  if (!this.importStats) {
    this.importStats = {};
  }

  const fieldMap = {
    exam: 'examsImported',
    document: 'documentsImported',
    image: 'imagesImported',
    measurement: 'measurementsImported'
  };

  const field = fieldMap[type];
  if (field) {
    this.importStats[field] = (this.importStats[field] || 0) + count;
  }

  return this;
};

module.exports = mongoose.model('LegacyMapping', legacyMappingSchema);
