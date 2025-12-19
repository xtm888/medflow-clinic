/**
 * Data Sync Service
 * Handles bi-directional sync between local clinic database and central server
 * Designed for unreliable internet conditions (offline-first)
 */

const mongoose = require('mongoose');
const SyncQueue = require('../models/SyncQueue');
const axios = require('axios');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('DataSync');

// Models that need syncing
const SYNCABLE_MODELS = {
  patients: require('../models/Patient'),
  visits: require('../models/Visit'),
  appointments: require('../models/Appointment'),
  invoices: require('../models/Invoice'),
  prescriptions: require('../models/Prescription'),
  ophthalmologyExams: require('../models/OphthalmologyExam'),
  imagingStudies: require('../models/ImagingStudy'),
  users: require('../models/User')
};

// Sync configuration
const SYNC_CONFIG = {
  centralServerUrl: process.env.CENTRAL_SERVER_URL || 'http://localhost:5002/api/sync',
  clinicId: process.env.CLINIC_ID || 'clinic-main',
  syncToken: process.env.SYNC_TOKEN || '',
  syncInterval: parseInt(process.env.SYNC_INTERVAL) || 60000, // 1 minute
  batchSize: 50,
  maxRetries: 5,
  conflictStrategy: process.env.CONFLICT_STRATEGY || 'last_write_wins', // or 'central_wins', 'local_wins', 'manual'
  enabled: process.env.CENTRAL_SYNC_ENABLED === 'true'
};

let syncInterval = null;
let isSyncing = false;

/**
 * Initialize sync service
 */
async function initialize() {
  if (!SYNC_CONFIG.enabled) {
    log.info('Central sync is disabled. Set CENTRAL_SYNC_ENABLED=true to enable.');
    return;
  }

  if (!SYNC_CONFIG.syncToken) {
    log.info('Warning: No SYNC_TOKEN configured. Sync will fail authentication.');
  }

  log.info(`Initializing sync service for clinic: ${SYNC_CONFIG.clinicId}`);
  log.info(`Central server: ${SYNC_CONFIG.centralServerUrl}`);

  // Set up change stream listeners for each model
  for (const [name, Model] of Object.entries(SYNCABLE_MODELS)) {
    setupChangeStream(name, Model);
  }

  // Start periodic sync
  startPeriodicSync();

  log.info('Service initialized');
}

/**
 * Set up MongoDB change stream to capture local changes
 */
function setupChangeStream(collectionName, Model) {
  try {
    const changeStream = Model.watch([], { fullDocument: 'updateLookup' });

    changeStream.on('change', async (change) => {
      // Don't queue changes that came from sync (would cause infinite loop)
      if (change.fullDocument?._syncedFromCentral) {
        return;
      }

      await queueChange(collectionName, change);
    });

    changeStream.on('error', (err) => {
      log.error(`[SYNC] Change stream error for ${collectionName}:`, err.message);
      // Reconnect after delay
      setTimeout(() => setupChangeStream(collectionName, Model), 5000);
    });

    log.info(`Change stream active for: ${collectionName}`);
  } catch (err) {
    log.error(`[SYNC] Failed to setup change stream for ${collectionName}:`, err.message);
  }
}

/**
 * Queue a local change for syncing
 */
async function queueChange(collection, change) {
  try {
    let operation, documentId, data, changedFields;

    switch (change.operationType) {
      case 'insert':
        operation = 'create';
        documentId = change.fullDocument._id;
        data = change.fullDocument;
        break;

      case 'update':
        operation = 'update';
        documentId = change.documentKey._id;
        data = change.fullDocument;
        changedFields = Object.keys(change.updateDescription?.updatedFields || {});
        break;

      case 'delete':
        operation = 'delete';
        documentId = change.documentKey._id;
        break;

      default:
        return; // Ignore other operations
    }

    // Determine priority based on collection
    const priority = getPriority(collection, operation);

    await SyncQueue.create({
      clinicId: SYNC_CONFIG.clinicId,
      operation,
      collection,
      documentId,
      data,
      changedFields,
      priority
    });

    log.info(`Queued ${operation} for ${collection}/${documentId}`);
  } catch (err) {
    log.error('[SYNC] Failed to queue change:', err.message);
  }
}

/**
 * Get sync priority (lower = higher priority)
 */
function getPriority(collection, operation) {
  // Patient data is highest priority
  if (collection === 'patients') return 1;
  // Visits and appointments
  if (['visits', 'appointments'].includes(collection)) return 2;
  // Clinical data
  if (['prescriptions', 'ophthalmologyExams'].includes(collection)) return 3;
  // Financial data
  if (collection === 'invoices') return 4;
  // Everything else
  return 5;
}

/**
 * Start periodic sync with central server
 */
function startPeriodicSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  syncInterval = setInterval(async () => {
    await performSync();
  }, SYNC_CONFIG.syncInterval);

  // Also sync immediately on start
  performSync();
}

/**
 * Stop sync service
 */
function stopSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

/**
 * Perform sync with central server
 */
async function performSync() {
  if (isSyncing) {
    log.info('Sync already in progress, skipping');
    return;
  }

  isSyncing = true;

  try {
    log.info('Starting sync cycle...');

    // Step 1: Push local changes to central
    await pushChangesToCentral();

    // Step 2: Pull changes from central
    await pullChangesFromCentral();

    log.info('Sync cycle completed');
  } catch (err) {
    log.error('[SYNC] Sync failed:', err.message);
  } finally {
    isSyncing = false;
  }
}

/**
 * Make HTTP request with retry and exponential backoff
 * Following pattern from enhancedNotificationService.js
 */
async function makeRequestWithRetry(url, data, options = {}) {
  const { maxRetries = 3, timeout = 30000 } = options;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = 1000 * Math.pow(2, attempt - 1);
        log.info(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      return await axios.post(url, data, {
        timeout,
        headers: {
          'X-Clinic-ID': SYNC_CONFIG.clinicId,
          'X-Sync-Token': SYNC_CONFIG.syncToken
        }
      });
    } catch (error) {
      lastError = error;

      // Don't retry on client errors (4xx) - these won't succeed on retry
      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error;
      }

      // Network errors and 5xx are retryable
      if (attempt === maxRetries - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * Sync a single item to central server
 * Returns result for individual tracking
 */
async function syncSingleItem(item) {
  try {
    const response = await makeRequestWithRetry(
      `${SYNC_CONFIG.centralServerUrl}/push-single`,
      {
        clinicId: SYNC_CONFIG.clinicId,
        change: {
          syncId: item.syncId,
          operation: item.operation,
          collection: item.collection,
          documentId: item.documentId,
          data: item.data,
          changedFields: item.changedFields,
          changedAt: item.changedAt
        }
      },
      { maxRetries: 2, timeout: 15000 }
    );

    if (response.data.conflict) {
      return { status: 'conflict', conflict: response.data.conflict };
    }

    return { status: 'synced' };
  } catch (error) {
    return { status: 'failed', error };
  }
}

/**
 * Push local changes to central server with per-item tracking
 * Uses Promise.allSettled for concurrent processing with individual error handling
 */
async function pushChangesToCentral() {
  const pending = await SyncQueue.getPendingForSync(
    SYNC_CONFIG.clinicId,
    SYNC_CONFIG.batchSize
  );

  if (pending.length === 0) {
    log.info('No pending changes to push');
    return;
  }

  log.info(`Pushing ${pending.length} changes to central...`);

  // Check if central server is reachable first
  const isOnline = await checkCentralConnection();
  if (!isOnline) {
    log.info('Central server unreachable - items will retry with backoff');
    return;
  }

  // Process items concurrently (max 3 at a time to avoid overwhelming server)
  const CONCURRENCY = 3;
  const results = {
    synced: 0,
    failed: 0,
    conflicts: 0
  };

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);

    const batchResults = await Promise.allSettled(
      batch.map(async (item) => {
        const result = await syncSingleItem(item);

        if (result.status === 'synced') {
          await item.markSynced('central');
          results.synced++;
        } else if (result.status === 'conflict') {
          await handleConflicts([{
            syncId: item.syncId,
            localVersion: item.data,
            centralVersion: result.conflict.centralVersion,
            collection: item.collection,
            documentId: item.documentId
          }]);
          results.conflicts++;
        } else {
          // Use instance method with exponential backoff
          await item.markFailed(result.error);
          results.failed++;
        }

        return result;
      })
    );

    // Small delay between batches to avoid rate limiting
    if (i + CONCURRENCY < pending.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  log.info(`Push complete: ${results.synced} synced, ${results.failed} failed, ${results.conflicts} conflicts`);
}

/**
 * Make GET request with retry and exponential backoff
 */
async function makeGetRequestWithRetry(url, params, options = {}) {
  const { maxRetries = 3, timeout = 30000 } = options;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        log.info(`Pull retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      return await axios.get(url, {
        params,
        timeout,
        headers: {
          'X-Clinic-ID': SYNC_CONFIG.clinicId,
          'X-Sync-Token': SYNC_CONFIG.syncToken
        }
      });
    } catch (error) {
      lastError = error;

      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error;
      }

      if (attempt === maxRetries - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * Pull changes from central server with retry logic
 */
async function pullChangesFromCentral() {
  try {
    // Get last sync timestamp for this clinic
    const lastSync = await getLastPullTimestamp();

    const response = await makeGetRequestWithRetry(
      `${SYNC_CONFIG.centralServerUrl}/pull`,
      {
        clinicId: SYNC_CONFIG.clinicId,
        since: lastSync
      },
      { maxRetries: 3, timeout: 60000 } // Longer timeout for pulls
    );

    const { changes, timestamp } = response.data;

    if (!changes || changes.length === 0) {
      log.info('No new changes from central');
      return;
    }

    log.info(`Pulling ${changes.length} changes from central...`);

    // Apply changes locally with error tracking
    const results = { applied: 0, failed: 0 };

    for (const change of changes) {
      try {
        await applyRemoteChange(change);
        results.applied++;
      } catch (err) {
        log.error(`[SYNC] Failed to apply change for ${change.collection}/${change.documentId}:`, err.message);
        results.failed++;
        // Continue with other changes - don't fail entire batch
      }
    }

    // Update last sync timestamp only if we successfully applied at least some changes
    if (results.applied > 0) {
      await setLastPullTimestamp(timestamp);
    }

    log.info(`Pull complete: ${results.applied} applied, ${results.failed} failed`);
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      log.info('Central server unreachable - will retry later');
    } else {
      log.error('[SYNC] Pull failed:', err.message);
    }
  }
}

/**
 * Apply a change received from central server
 */
async function applyRemoteChange(change) {
  const { collection, operation, documentId, data } = change;
  const Model = SYNCABLE_MODELS[collection];

  if (!Model) {
    log.error(`[SYNC] Unknown collection: ${collection}`);
    return;
  }

  try {
    // Mark as synced from central (to avoid re-syncing)
    if (data) {
      data._syncedFromCentral = true;
    }

    switch (operation) {
      case 'create':
        // Check if document already exists
        const existing = await Model.findById(documentId);
        if (!existing) {
          await Model.create({ ...data, _id: documentId });
        }
        break;

      case 'update':
        await Model.findByIdAndUpdate(documentId, data, { upsert: true });
        break;

      case 'delete':
        await Model.findByIdAndDelete(documentId);
        break;
    }
  } catch (err) {
    log.error(`[SYNC] Failed to apply change for ${collection}/${documentId}:`, err.message);
  }
}

/**
 * Handle sync conflicts
 */
async function handleConflicts(conflicts) {
  log.info(`Handling ${conflicts.length} conflicts...`);

  for (const conflict of conflicts) {
    const { syncId, localVersion, centralVersion } = conflict;

    switch (SYNC_CONFIG.conflictStrategy) {
      case 'last_write_wins':
        // Compare timestamps, most recent wins
        if (localVersion.updatedAt > centralVersion.updatedAt) {
          // Local wins - retry push
          await SyncQueue.findOneAndUpdate(
            { syncId },
            { $set: { status: 'pending', attempts: 0 } }
          );
        } else {
          // Central wins - apply central version locally
          await applyRemoteChange({
            collection: conflict.collection,
            operation: 'update',
            documentId: conflict.documentId,
            data: centralVersion
          });
          await SyncQueue.findOneAndUpdate(
            { syncId },
            { $set: { status: 'synced', 'conflict.resolution': 'central_wins' } }
          );
        }
        break;

      case 'central_wins':
        // Always use central version
        await applyRemoteChange({
          collection: conflict.collection,
          operation: 'update',
          documentId: conflict.documentId,
          data: centralVersion
        });
        await SyncQueue.findOneAndUpdate(
          { syncId },
          { $set: { status: 'synced', 'conflict.resolution': 'central_wins' } }
        );
        break;

      case 'local_wins':
        // Keep local, force push
        await SyncQueue.findOneAndUpdate(
          { syncId },
          { $set: { status: 'pending', 'conflict.resolution': 'local_wins' } }
        );
        break;

      case 'manual':
        // Mark for manual resolution
        await SyncQueue.findOneAndUpdate(
          { syncId },
          {
            $set: {
              status: 'conflict',
              'conflict.detected': true,
              'conflict.centralVersion': centralVersion,
              'conflict.resolution': 'pending'
            }
          }
        );
        break;
    }
  }
}

/**
 * Get last pull timestamp from local storage
 */
async function getLastPullTimestamp() {
  // Use a simple key-value collection for sync metadata
  const SyncMeta = mongoose.connection.collection('sync_metadata');
  const meta = await SyncMeta.findOne({ key: 'lastPullTimestamp' });
  return meta?.value || new Date(0).toISOString();
}

/**
 * Set last pull timestamp
 */
async function setLastPullTimestamp(timestamp) {
  const SyncMeta = mongoose.connection.collection('sync_metadata');
  await SyncMeta.updateOne(
    { key: 'lastPullTimestamp' },
    { $set: { value: timestamp, updatedAt: new Date() } },
    { upsert: true }
  );
}

/**
 * Force immediate sync
 */
async function forceSync() {
  log.info('Force sync requested');
  await performSync();
}

/**
 * Get sync status
 */
async function getStatus() {
  const stats = await SyncQueue.getStats(SYNC_CONFIG.clinicId);
  const lastPull = await getLastPullTimestamp();

  return {
    clinicId: SYNC_CONFIG.clinicId,
    isOnline: await checkCentralConnection(),
    isSyncing,
    lastPullTimestamp: lastPull,
    queue: stats,
    config: {
      syncInterval: SYNC_CONFIG.syncInterval,
      batchSize: SYNC_CONFIG.batchSize
    }
  };
}

/**
 * Check if central server is reachable
 */
async function checkCentralConnection() {
  try {
    // Replace /api/sync with /health for health check
    const baseUrl = SYNC_CONFIG.centralServerUrl.replace('/api/sync', '');
    await axios.get(`${baseUrl}/health`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Manually queue a document for sync
 */
async function queueForSync(collection, documentId, operation = 'update') {
  const Model = SYNCABLE_MODELS[collection];
  if (!Model) throw new Error(`Unknown collection: ${collection}`);

  const doc = await Model.findById(documentId).lean();

  await SyncQueue.create({
    clinicId: SYNC_CONFIG.clinicId,
    operation,
    collection,
    documentId,
    data: doc,
    priority: getPriority(collection, operation)
  });
}

// ============================================
// DEAD LETTER QUEUE MANAGEMENT
// ============================================

/**
 * Get items that have permanently failed (dead letter queue)
 */
async function getDeadLetterQueue(limit = 100) {
  return SyncQueue.getDeadLetterItems(SYNC_CONFIG.clinicId, limit);
}

/**
 * Retry a specific dead letter item
 */
async function retryDeadLetterItem(syncId) {
  const item = await SyncQueue.retryDeadLetter(syncId);
  if (!item) {
    throw new Error(`Item ${syncId} not found in dead letter queue`);
  }
  log.info(`Dead letter item ${syncId} moved back to pending queue`);
  return item;
}

/**
 * Retry all items in dead letter queue
 */
async function retryAllDeadLetter() {
  const deadItems = await SyncQueue.find({
    clinicId: SYNC_CONFIG.clinicId,
    status: 'dead_letter'
  });

  let retried = 0;
  for (const item of deadItems) {
    item.status = 'pending';
    item.attempts = 0;
    item.nextAttempt = new Date();
    item.errorHistory.push({
      error: 'Bulk retry from dead letter queue',
      timestamp: new Date(),
      attempt: 0
    });
    await item.save();
    retried++;
  }

  log.info(`Retried ${retried} items from dead letter queue`);
  return { retried };
}

/**
 * Delete items from dead letter queue (after review)
 */
async function clearDeadLetterItems(syncIds) {
  const result = await SyncQueue.deleteMany({
    clinicId: SYNC_CONFIG.clinicId,
    syncId: { $in: syncIds },
    status: 'dead_letter'
  });
  log.info(`Cleared ${result.deletedCount} items from dead letter queue`);
  return { deleted: result.deletedCount };
}

module.exports = {
  initialize,
  stopSync,
  forceSync,
  getStatus,
  queueForSync,
  performSync,
  SYNC_CONFIG,
  // Dead letter queue management
  getDeadLetterQueue,
  retryDeadLetterItem,
  retryAllDeadLetter,
  clearDeadLetterItems
};
