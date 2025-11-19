const mongoose = require('mongoose');

/**
 * Counter Model for Atomic Sequential Number Generation
 * Used for: Queue numbers, invoice numbers, any sequential IDs
 */
const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
    // Format examples:
    // 'queueNumber-2025-01-18'
    // 'invoiceNumber-2025-01'
    // 'visitNumber-2025'
  },

  sequence: {
    type: Number,
    default: 0,
    required: true
  },

  // Metadata for tracking
  lastUsed: {
    type: Date,
    default: Date.now
  },

  description: String
}, {
  timestamps: true
});

// Note: MongoDB automatically indexes _id, no need to specify it

/**
 * Get next sequence number atomically
 * @param {String} name - Counter name/identifier
 * @returns {Number} - Next sequence number
 */
counterSchema.statics.getNextSequence = async function(name) {
  const counter = await this.findByIdAndUpdate(
    name,
    {
      $inc: { sequence: 1 },
      $set: { lastUsed: new Date() }
    },
    {
      new: true,
      upsert: true, // Create if doesn't exist
      setDefaultsOnInsert: true
    }
  );

  return counter.sequence;
};

/**
 * Get current sequence without incrementing
 * @param {String} name - Counter name/identifier
 * @returns {Number} - Current sequence number
 */
counterSchema.statics.getCurrentSequence = async function(name) {
  const counter = await this.findById(name);
  return counter ? counter.sequence : 0;
};

/**
 * Reset sequence to specific value
 * @param {String} name - Counter name/identifier
 * @param {Number} value - Value to reset to
 */
counterSchema.statics.resetSequence = async function(name, value = 0) {
  await this.findByIdAndUpdate(
    name,
    {
      sequence: value,
      lastUsed: new Date()
    },
    { upsert: true }
  );
};

/**
 * Delete old daily counters (cleanup job)
 * @param {Number} daysToKeep - Number of days to keep counters
 */
counterSchema.statics.cleanupOldCounters = async function(daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await this.deleteMany({
    _id: { $regex: /^queueNumber-/ }, // Only cleanup queue number counters
    lastUsed: { $lt: cutoffDate }
  });

  return result.deletedCount;
};

/**
 * Helper function to generate today's queue counter ID
 */
counterSchema.statics.getTodayQueueCounterId = function() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `queueNumber-${year}-${month}-${day}`;
};

/**
 * Helper function to generate monthly invoice counter ID
 */
counterSchema.statics.getMonthlyInvoiceCounterId = function() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `invoiceNumber-${year}-${month}`;
};

/**
 * Helper function to generate yearly visit counter ID
 */
counterSchema.statics.getYearlyVisitCounterId = function() {
  const year = new Date().getFullYear();
  return `visitNumber-${year}`;
};

module.exports = mongoose.model('Counter', counterSchema);
