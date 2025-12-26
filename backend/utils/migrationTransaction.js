/**
 * Migration Transaction Helper
 *
 * Provides MongoDB transaction support for migration scripts with graceful
 * fallback for standalone instances (non-replica set deployments).
 *
 * Usage:
 *   const { withTransaction } = require('../utils/migrationTransaction');
 *
 *   await withTransaction(async (session) => {
 *     // Your migration logic here
 *     await Model.insertMany(docs, { session });
 *   });
 */

const mongoose = require('mongoose');

/**
 * Check if MongoDB supports transactions (requires replica set)
 * @returns {Promise<boolean>}
 */
async function supportsTransactions() {
  try {
    const admin = mongoose.connection.db.admin();
    const serverStatus = await admin.serverStatus();

    // Check if we're on a replica set
    if (serverStatus.repl && serverStatus.repl.setName) {
      return true;
    }

    // Check for transactions support in sharded cluster
    if (serverStatus.sharding) {
      return true;
    }

    return false;
  } catch (error) {
    // If we can't check, assume no transaction support
    console.warn('Could not determine transaction support:', error.message);
    return false;
  }
}

/**
 * Execute migration with transaction support (if available)
 *
 * @param {Function} migrationFn - Async function that receives optional session
 * @param {Object} options - Options
 * @param {boolean} options.requireTransaction - If true, fails when transactions unsupported
 * @param {string} options.operationName - Name for logging purposes
 * @returns {Promise<Object>} - Result with success status and details
 */
async function withTransaction(migrationFn, options = {}) {
  const { requireTransaction = false, operationName = 'migration' } = options;

  const hasTransactionSupport = await supportsTransactions();

  if (!hasTransactionSupport) {
    if (requireTransaction) {
      throw new Error(
        'Transaction required but MongoDB is not running as replica set. ' +
        'Either convert to replica set or set requireTransaction: false'
      );
    }

    console.log(`⚠️  Running ${operationName} WITHOUT transaction (standalone MongoDB)`);
    console.log('   For production, consider using a replica set for atomicity.');

    // Execute without transaction
    const result = await migrationFn(null);
    return {
      success: true,
      usedTransaction: false,
      result
    };
  }

  // Use transaction
  const session = await mongoose.startSession();

  try {
    console.log(`🔒 Starting ${operationName} with transaction...`);

    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' }
    });

    const result = await migrationFn(session);

    await session.commitTransaction();
    console.log(`✅ Transaction committed successfully`);

    return {
      success: true,
      usedTransaction: true,
      result
    };

  } catch (error) {
    console.error(`❌ Transaction failed: ${error.message}`);

    try {
      await session.abortTransaction();
      console.log('🔄 Transaction rolled back');
    } catch (abortError) {
      console.error('Failed to abort transaction:', abortError.message);
    }

    throw error;

  } finally {
    session.endSession();
  }
}

/**
 * Batch insert with optional transaction
 *
 * @param {Collection} collection - MongoDB collection
 * @param {Array} documents - Documents to insert
 * @param {Object} options - Options including session
 * @returns {Promise<Object>} - Insert result
 */
async function batchInsertWithTransaction(collection, documents, options = {}) {
  const { session, ordered = false, batchSize = 100 } = options;

  const results = {
    insertedCount: 0,
    errors: []
  };

  // Process in batches
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);

    try {
      const insertOptions = { ordered };
      if (session) {
        insertOptions.session = session;
      }

      const result = await collection.insertMany(batch, insertOptions);
      results.insertedCount += result.insertedCount || batch.length;

    } catch (error) {
      // With ordered: false, some might have succeeded
      if (error.result) {
        results.insertedCount += error.result.insertedCount || 0;
      }
      results.errors.push({
        batchIndex: Math.floor(i / batchSize),
        error: error.message
      });

      // If using transaction, re-throw to trigger rollback
      if (session) {
        throw error;
      }
    }
  }

  return results;
}

/**
 * Batch update with optional transaction
 *
 * @param {Collection} collection - MongoDB collection
 * @param {Array} operations - Array of { filter, update } objects
 * @param {Object} options - Options including session
 * @returns {Promise<Object>} - Update result
 */
async function batchUpdateWithTransaction(collection, operations, options = {}) {
  const { session, batchSize = 100 } = options;

  const results = {
    modifiedCount: 0,
    matchedCount: 0,
    errors: []
  };

  // Process in batches using bulkWrite
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);

    const bulkOps = batch.map(op => ({
      updateOne: {
        filter: op.filter,
        update: op.update,
        upsert: op.upsert || false
      }
    }));

    try {
      const bulkOptions = { ordered: false };
      if (session) {
        bulkOptions.session = session;
      }

      const result = await collection.bulkWrite(bulkOps, bulkOptions);
      results.modifiedCount += result.modifiedCount || 0;
      results.matchedCount += result.matchedCount || 0;

    } catch (error) {
      if (error.result) {
        results.modifiedCount += error.result.modifiedCount || 0;
        results.matchedCount += error.result.matchedCount || 0;
      }
      results.errors.push({
        batchIndex: Math.floor(i / batchSize),
        error: error.message
      });

      // If using transaction, re-throw to trigger rollback
      if (session) {
        throw error;
      }
    }
  }

  return results;
}

module.exports = {
  supportsTransactions,
  withTransaction,
  batchInsertWithTransaction,
  batchUpdateWithTransaction
};
