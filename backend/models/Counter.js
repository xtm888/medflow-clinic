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

  // Clean up old daily/monthly counters, but preserve critical yearly counters
  const result = await this.deleteMany({
    lastUsed: { $lt: cutoffDate },
    // Exclude critical yearly counters that should be kept indefinitely
    _id: {
      $not: /^(patient-|visit-|appointment-|prescription-|invoice-|employee-)\d{4}$/
    }
  });

  return result.deletedCount;
};

/**
 * Helper function to generate daily counter ID
 * @param {String} prefix - Counter prefix (e.g., 'queue', 'alert', 'consultation')
 * @returns {String} - Daily counter ID (e.g., 'queue-20250120')
 */
counterSchema.statics.getDailyCounterId = function(prefix) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${prefix}-${year}${month}${day}`;
};

/**
 * Helper function to generate yearly counter ID
 * @param {String} prefix - Counter prefix (e.g., 'patient', 'visit')
 * @returns {String} - Yearly counter ID (e.g., 'patient-2025')
 */
counterSchema.statics.getYearlyCounterId = function(prefix) {
  const year = new Date().getFullYear();
  return `${prefix}-${year}`;
};

/**
 * Helper function to generate monthly counter ID
 * @param {String} prefix - Counter prefix (e.g., 'invoice', 'glassesOrder')
 * @returns {String} - Monthly counter ID (e.g., 'invoice-202501')
 */
counterSchema.statics.getMonthlyCounterId = function(prefix) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${prefix}-${year}${month}`;
};

/**
 * Helper function to generate today's queue counter ID
 * @deprecated Use getDailyCounterId('queue') instead
 */
counterSchema.statics.getTodayQueueCounterId = function() {
  return this.getDailyCounterId('queue');
};

/**
 * Helper function to generate monthly invoice counter ID
 * @deprecated Use getMonthlyCounterId('invoice') instead
 */
counterSchema.statics.getMonthlyInvoiceCounterId = function() {
  return this.getMonthlyCounterId('invoice');
};

/**
 * Helper function to generate yearly visit counter ID
 * @deprecated Use getYearlyCounterId('visit') instead
 */
counterSchema.statics.getYearlyVisitCounterId = function() {
  return this.getYearlyCounterId('visit');
};

module.exports = mongoose.model('Counter', counterSchema);
