// Sync Service - Manages data synchronization between offline and online
import databaseService from './database';
import api from './apiConfig';
import { toast } from 'react-toastify';

// ============================================
// CLINIC-SPECIFIC SYNC CONFIGURATION
// ============================================

/**
 * Clinic-specific sync intervals (milliseconds)
 * Configured based on network conditions at each location
 */
export const CLINIC_SYNC_INTERVALS = {
  'DEPOT_CENTRAL': 300000,    // 5 min - hub/warehouse, good connectivity
  'TOMBALBAYE_KIN': 300000,   // 5 min - main clinic, fiber connection
  'MATRIX_KIN': 600000,       // 10 min - satellite, LAN connectivity
  'MATADI_KC': 1800000        // 30 min - satellite, slow 3G/4G
};

/**
 * Extended entities list for comprehensive offline support
 * Phase 3.2: 23 entities (up from 18)
 */
export const SYNC_ENTITIES = [
  // Original entities
  'patients',
  'appointments',
  'prescriptions',
  'ophthalmologyExams',
  'users',
  'visits',
  'labOrders',
  'labResults',
  'invoices',
  'queue',
  // Phase 1: New entities for multi-clinic offline
  'pharmacyInventory',
  'orthopticExams',
  'glassesOrders',
  'frameInventory',
  'contactLensInventory',
  'clinics',
  'approvals',
  'stockReconciliations',
  // Phase 3.2: Additional clinical entities
  'treatmentProtocols',
  'ivtVials',
  'surgeryCases',
  'consultationSessions',
  'devices'
];

/**
 * Default sync interval for unknown/unspecified clinics
 */
export const DEFAULT_SYNC_INTERVAL = 900000; // 15 minutes

/**
 * Get sync interval for a specific clinic
 * @param {string} clinicId - The clinic identifier
 * @returns {number} Sync interval in milliseconds (default 15 min)
 */
export const getSyncIntervalForClinic = (clinicId) => {
  return CLINIC_SYNC_INTERVALS[clinicId] || DEFAULT_SYNC_INTERVAL;
};

// Exponential backoff configuration
const BACKOFF_CONFIG = {
  BASE_DELAY_MS: 1000,        // 1 second
  MAX_DELAY_MS: 300000,       // 5 minutes
  MAX_RETRIES: 5,
  JITTER_PERCENT: 0.30        // ±30%
};

/**
 * Calculate exponential backoff delay with jitter
 * @param {number} retryCount - Current retry attempt (0-indexed)
 * @returns {number} Delay in milliseconds
 */
function calculateBackoffDelay(retryCount) {
  // Exponential: 1s, 2s, 4s, 8s, 16s...
  const exponentialDelay = BACKOFF_CONFIG.BASE_DELAY_MS * Math.pow(2, retryCount);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, BACKOFF_CONFIG.MAX_DELAY_MS);

  // Add jitter (±30%)
  const jitterRange = cappedDelay * BACKOFF_CONFIG.JITTER_PERCENT;
  const jitter = (Math.random() * 2 - 1) * jitterRange; // Random between -jitterRange and +jitterRange

  return Math.max(0, Math.round(cappedDelay + jitter));
}

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = null;
    this.listeners = new Set();
    this.conflictResolutionStrategy = 'last-write-wins'; // Options: 'last-write-wins', 'server-wins', 'client-wins', 'manual'
    this.hadPermanentFailure = false; // Track if we had a permanent sync failure
  }

  /**
   * Get current conflict resolution strategy
   * @returns {string} Current strategy
   */
  getConflictStrategy() {
    return this.conflictResolutionStrategy;
  }

  /**
   * Set conflict resolution strategy
   * @param {string} strategy - 'last-write-wins' | 'server-wins' | 'client-wins' | 'manual'
   */
  setConflictStrategy(strategy) {
    const validStrategies = ['last-write-wins', 'server-wins', 'client-wins', 'manual'];
    if (!validStrategies.includes(strategy)) {
      console.warn(`Invalid conflict strategy: ${strategy}. Using 'last-write-wins'`);
      strategy = 'last-write-wins';
    }
    this.conflictResolutionStrategy = strategy;
    // Persist to localStorage
    localStorage.setItem('medflow_conflict_strategy', strategy);
    console.log(`[Sync] Conflict resolution strategy set to: ${strategy}`);
  }

  /**
   * Load conflict strategy from localStorage
   */
  loadConflictStrategy() {
    const saved = localStorage.getItem('medflow_conflict_strategy');
    if (saved) {
      this.conflictResolutionStrategy = saved;
      console.log(`[Sync] Loaded conflict resolution strategy: ${saved}`);
    }
  }

  // Initialize sync service
  init() {
    // Load saved conflict strategy
    this.loadConflictStrategy();

    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Start sync interval if online
    if (navigator.onLine) {
      this.startAutoSync();
    }

    // Listen for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_START' || event.data.type === 'BACKGROUND_SYNC') {
          console.log('[Sync] Received sync request from service worker');
          this.sync();
        }
      });

      // Register global sync handler for service worker to call
      window.__medflowSync = () => this.sync();
    }
  }

  // Trigger sync from service worker background sync event
  async handleBackgroundSync() {
    console.log('[Sync] Background sync triggered');
    await this.sync();
    return true;
  }

  // Handle online event
  handleOnline() {
    console.log('Connection restored - starting sync');
    this.notifyListeners('online');
    this.startAutoSync();
    this.sync(); // Immediate sync when coming online
  }

  // Handle offline event
  handleOffline() {
    console.log('Connection lost - entering offline mode');
    this.notifyListeners('offline');
    this.stopAutoSync();
  }

  // Start automatic sync
  startAutoSync() {
    if (this.syncInterval) return;

    // Sync every 15 minutes when online
    // Balances data freshness with server load and unreliable connectivity
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.sync();
      }
    }, 900000); // 15 minutes = 900000ms
  }

  // Stop automatic sync
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Main sync function
  async sync() {
    if (this.isSyncing || !navigator.onLine) return;

    this.isSyncing = true;
    this.notifyListeners('sync-start');

    try {
      // Get last sync timestamp
      const lastSync = await databaseService.getSetting('lastSync') || '1970-01-01T00:00:00.000Z';

      // 1. Process sync queue (local changes)
      await this.processSyncQueue();

      // 2. Pull server changes
      await this.pullServerChanges(lastSync);

      // 3. Update last sync timestamp
      await databaseService.setSetting('lastSync', new Date().toISOString());

      // 4. Clean up completed sync items
      await databaseService.clearSyncQueue();

      // 5. Check if we recovered from a permanent failure
      if (this.hadPermanentFailure) {
        toast.success(
          'Synchronisation rétablie. Toutes les données ont été synchronisées.',
          { toastId: 'sync-recovered' }
        );
        this.hadPermanentFailure = false;
        this.notifyListeners('sync-recovered');
      }

      this.notifyListeners('sync-complete');
      console.log('[Sync] Completed successfully');
    } catch (error) {
      // Only log sync failures at warning level to reduce console spam
      console.warn('[Sync] Failed:', error.message || error);
      this.notifyListeners('sync-error', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Process sync queue (push local changes to server)
  async processSyncQueue() {
    const syncQueue = await databaseService.getSyncQueue();

    if (syncQueue.length === 0) return;

    // Filter items ready for retry (nextRetryAt is null/undefined or in the past)
    const now = new Date().toISOString();
    const readyItems = syncQueue.filter(item =>
      !item.nextRetryAt || item.nextRetryAt <= now
    );

    if (readyItems.length === 0) {
      const nextItem = syncQueue.reduce((earliest, item) =>
        !earliest || (item.nextRetryAt && item.nextRetryAt < earliest.nextRetryAt) ? item : earliest
      , null);
      if (nextItem?.nextRetryAt) {
        console.log(`[Sync] ${syncQueue.length} items waiting, next retry at ${nextItem.nextRetryAt}`);
      }
      return;
    }

    console.log(`[Sync] Processing ${readyItems.length} of ${syncQueue.length} queued operations`);

    for (const item of readyItems) {
      try {
        await this.processSyncItem(item);

        // Mark as completed
        await databaseService.updateSyncItem(item.id, {
          status: 'completed',
          syncedAt: new Date().toISOString(),
          nextRetryAt: null
        });
      } catch (error) {
        console.error(`[Sync] Failed to sync item ${item.id}:`, error.message || error);

        const newRetryCount = (item.retryCount || 0) + 1;

        // If max retries reached, mark as error
        if (newRetryCount >= BACKOFF_CONFIG.MAX_RETRIES) {
          await databaseService.updateSyncItem(item.id, {
            status: 'error',
            retryCount: newRetryCount,
            lastError: error.message,
            nextRetryAt: null
          });

          // Log conflict for manual resolution
          await databaseService.logConflict(
            item.entity,
            item.entityId,
            item.data,
            null,
            'error',
            'system'
          );

          console.error(`[Sync] Item ${item.id} exceeded max retries (${BACKOFF_CONFIG.MAX_RETRIES}), marked as error`);

          // Notify user of permanent failure (only once)
          if (!this.hadPermanentFailure) {
            this.hadPermanentFailure = true;

            // Get count of all pending items
            const syncQueue = await databaseService.getSyncQueue();
            const pendingCount = syncQueue.length;

            toast.error(
              'Échec de synchronisation après plusieurs tentatives. Vos données locales seront synchronisées dès que possible.',
              {
                autoClose: false, // Don't auto-dismiss - this is important
                toastId: 'sync-permanent-failure' // Prevent duplicates
              }
            );

            // Emit event for other components
            this.notifyListeners('sync-permanent-failure', {
              failedAt: new Date().toISOString(),
              pendingCount,
              lastError: error.message
            });
          }
        } else {
          // Calculate next retry time with exponential backoff
          const backoffDelay = calculateBackoffDelay(newRetryCount - 1);
          const nextRetryAt = new Date(Date.now() + backoffDelay).toISOString();

          await databaseService.updateSyncItem(item.id, {
            status: 'pending',
            retryCount: newRetryCount,
            lastError: error.message,
            nextRetryAt
          });

          console.log(`[Sync] Item ${item.id} retry ${newRetryCount}/${BACKOFF_CONFIG.MAX_RETRIES}, next attempt in ${Math.round(backoffDelay / 1000)}s`);
        }
      }
    }
  }

  // Process individual sync item
  async processSyncItem(item) {
    const { operation, entity, entityId, data } = item;

    let response;

    switch (operation) {
      case 'CREATE':
        response = await api.post(`/${entity}`, data);
        // Update local ID with server ID
        if (response.data.id !== entityId) {
          await this.updateLocalId(entity, entityId, response.data.id);
        }
        break;

      case 'UPDATE':
        response = await api.put(`/${entity}/${entityId}`, data);
        break;

      case 'DELETE':
        response = await api.delete(`/${entity}/${entityId}`);
        // Remove from local database
        await this.deleteLocal(entity, entityId);
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return response;
  }

  // Pull server changes
  async pullServerChanges(lastSync) {
    try {
      // Get changes from server since last sync
      const response = await api.post('/sync/pull', {
        lastSync,
        entities: SYNC_ENTITIES
      });

      if (!response.data.changes) return;

      const { changes } = response.data;

      for (const [entity, items] of Object.entries(changes)) {
        await this.processServerChanges(entity, items);
      }
    } catch (error) {
      // Don't spam console with errors - just log once
      if (error.response?.status === 401) {
        console.warn('[Sync] Authentication required - token may be expired');
      } else if (error.code === 'ECONNABORTED') {
        console.warn('[Sync] Request timeout - server may be slow or unreachable');
      } else if (!error.response) {
        console.warn('[Sync] Network error - check internet connection');
      } else {
        console.error('[Sync] Failed to pull server changes:', error.message);
      }
      throw error;
    }
  }

  // Process server changes
  async processServerChanges(entity, items) {
    for (const item of items) {
      try {
        // Check for conflicts
        const localItem = await this.getLocalItem(entity, item.id);

        if (localItem && localItem.lastSync > item.lastModified) {
          // Conflict detected
          await this.resolveConflict(entity, localItem, item);
        } else {
          // No conflict, update local
          await databaseService.bulkSave(entity, [item]);
        }
      } catch (error) {
        console.error(`Failed to process server change for ${entity}:`, error);
      }
    }
  }

  // Resolve conflicts
  async resolveConflict(entity, localData, serverData) {
    let resolution;
    let resolvedData;

    switch (this.conflictResolutionStrategy) {
      case 'server-wins':
        resolvedData = serverData;
        resolution = 'server';
        break;

      case 'client-wins':
        resolvedData = localData;
        resolution = 'local';
        break;

      case 'last-write-wins':
        resolvedData = new Date(localData.lastSync) > new Date(serverData.lastModified)
          ? localData
          : serverData;
        resolution = resolvedData === localData ? 'local' : 'server';
        break;

      case 'manual':
        // Queue for manual resolution
        await databaseService.logConflict(
          entity,
          localData.id,
          localData,
          serverData,
          'pending',
          'user'
        );
        this.notifyListeners('conflict', { entity, localData, serverData });
        return;

      default:
        resolvedData = serverData;
        resolution = 'server';
    }

    // Apply resolution
    await databaseService.bulkSave(entity, [resolvedData]);

    // Log conflict resolution
    await databaseService.logConflict(
      entity,
      localData.id,
      localData,
      serverData,
      resolution,
      'system'
    );
  }

  // Helper: Get local item
  async getLocalItem(entity, id) {
    if (!databaseService.db) return null;
    const table = databaseService.db[entity];
    if (!table) return null;
    return await table.get(id);
  }

  // Helper: Update local ID
  async updateLocalId(entity, oldId, newId) {
    if (!databaseService.db) return;
    const table = databaseService.db[entity];
    if (!table) return;

    const item = await table.get(oldId);
    if (item) {
      item.id = newId;
      await table.delete(oldId);
      await table.put(item);
    }
  }

  // Helper: Delete local item
  async deleteLocal(entity, id) {
    const table = databaseService.db[entity];
    if (!table) return;
    await table.delete(id);
  }

  // Add listener for sync events
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notify listeners
  notifyListeners(event, data = null) {
    this.listeners.forEach(callback => callback(event, data));
  }

  // Manual conflict resolution
  async resolveManualConflict(conflictId, resolution, mergedData = null) {
    const conflict = await databaseService.db.conflicts.get(conflictId);
    if (!conflict) throw new Error('Conflict not found');

    let resolvedData;

    switch (resolution) {
      case 'local':
        resolvedData = conflict.localData;
        break;
      case 'server':
        resolvedData = conflict.serverData;
        break;
      case 'merged':
        resolvedData = mergedData || { ...conflict.serverData, ...conflict.localData };
        break;
      default:
        throw new Error('Invalid resolution type');
    }

    // Apply resolution
    await databaseService.bulkSave(conflict.entity, [resolvedData]);

    // Update conflict record
    await databaseService.db.conflicts.update(conflictId, {
      resolution,
      resolvedData,
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'user'
    });

    // Sync to server
    await this.sync();
  }

  // Force sync (ignore online status)
  async forceSync() {
    const wasOnline = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });

    try {
      await this.sync();
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: wasOnline, writable: true });
    }
  }

  // Get sync status
  async getStatus() {
    const syncQueue = await databaseService.getSyncQueue();
    const conflicts = await databaseService.getConflicts();
    const lastSync = await databaseService.getSetting('lastSync');
    const stats = await databaseService.getStats();

    // Calculate backoff statistics
    const now = new Date().toISOString();
    const readyItems = syncQueue.filter(item => !item.nextRetryAt || item.nextRetryAt <= now);
    const waitingItems = syncQueue.filter(item => item.nextRetryAt && item.nextRetryAt > now);
    const errorItems = syncQueue.filter(item => item.status === 'error');

    // Find next scheduled retry
    const nextRetry = waitingItems.reduce((earliest, item) =>
      !earliest || item.nextRetryAt < earliest ? item.nextRetryAt : earliest
    , null);

    return {
      isOnline: navigator.onLine,
      isSyncing: this.isSyncing,
      lastSync,
      pendingOperations: syncQueue.length,
      readyToSync: readyItems.length,
      waitingForRetry: waitingItems.length,
      failedOperations: errorItems.length,
      nextScheduledRetry: nextRetry,
      unresolvedConflicts: conflicts.filter(c => c.resolution === 'pending').length,
      totalConflicts: conflicts.length,
      localRecords: stats,
      backoffConfig: {
        maxRetries: BACKOFF_CONFIG.MAX_RETRIES,
        baseDelayMs: BACKOFF_CONFIG.BASE_DELAY_MS,
        maxDelayMs: BACKOFF_CONFIG.MAX_DELAY_MS
      }
    };
  }

  // Clear all sync data (use with caution)
  async clearSyncData() {
    await databaseService.db.syncQueue.clear();
    await databaseService.db.conflicts.clear();
    await databaseService.setSetting('lastSync', new Date().toISOString());
  }

  // Reset a failed sync item to retry immediately
  async resetFailedItem(itemId) {
    const item = await databaseService.db.syncQueue.get(itemId);
    if (!item) throw new Error('Sync item not found');

    if (item.status !== 'error') {
      throw new Error('Can only reset items with error status');
    }

    await databaseService.updateSyncItem(itemId, {
      status: 'pending',
      retryCount: 0,
      nextRetryAt: null,
      lastError: null
    });

    console.log(`[Sync] Reset item ${itemId} for retry`);

    // Trigger immediate sync attempt
    if (navigator.onLine) {
      this.sync();
    }

    return true;
  }

  // Reset all failed items
  async resetAllFailedItems() {
    const syncQueue = await databaseService.getSyncQueue();
    const errorItems = syncQueue.filter(item => item.status === 'error');

    for (const item of errorItems) {
      await databaseService.updateSyncItem(item.id, {
        status: 'pending',
        retryCount: 0,
        nextRetryAt: null,
        lastError: null
      });
    }

    console.log(`[Sync] Reset ${errorItems.length} failed items for retry`);

    // Trigger immediate sync attempt
    if (navigator.onLine && errorItems.length > 0) {
      this.sync();
    }

    return errorItems.length;
  }

  // Get detailed queue info (for debugging)
  async getQueueDetails() {
    const syncQueue = await databaseService.getSyncQueue();
    return syncQueue.map(item => ({
      id: item.id,
      entity: item.entity,
      operation: item.operation,
      status: item.status,
      retryCount: item.retryCount || 0,
      nextRetryAt: item.nextRetryAt,
      lastError: item.lastError,
      timestamp: item.timestamp
    }));
  }
}

// Create singleton instance
const syncService = new SyncService();

// Initialize on load
if (typeof window !== 'undefined') {
  syncService.init();
}

// Export config for testing
export { BACKOFF_CONFIG };

// Export conflict strategy methods
export const getConflictStrategy = () => syncService.getConflictStrategy();
export const setConflictStrategy = (strategy) => syncService.setConflictStrategy(strategy);

export default syncService;