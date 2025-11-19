// Sync Service - Manages data synchronization between offline and online
import databaseService from './database';
import api from './api';

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = null;
    this.listeners = new Set();
    this.conflictResolutionStrategy = 'last-write-wins'; // Options: 'last-write-wins', 'server-wins', 'client-wins', 'manual'
  }

  // Initialize sync service
  init() {
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
        if (event.data.type === 'SYNC_START') {
          this.sync();
        }
      });
    }
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

    // Sync every 30 seconds when online
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.sync();
      }
    }, 30000);
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

      this.notifyListeners('sync-complete');
      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Sync failed:', error);
      this.notifyListeners('sync-error', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Process sync queue (push local changes to server)
  async processSyncQueue() {
    const syncQueue = await databaseService.getSyncQueue();

    if (syncQueue.length === 0) return;

    console.log(`Processing ${syncQueue.length} queued operations`);

    for (const item of syncQueue) {
      try {
        await this.processSyncItem(item);

        // Mark as completed
        await databaseService.updateSyncItem(item.id, {
          status: 'completed',
          syncedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);

        // Increment retry count
        await databaseService.updateSyncItem(item.id, {
          status: 'failed',
          retryCount: item.retryCount + 1,
          lastError: error.message
        });

        // If max retries reached, mark as error
        if (item.retryCount >= 3) {
          await databaseService.updateSyncItem(item.id, {
            status: 'error'
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
        entities: [
          'patients',
          'appointments',
          'prescriptions',
          'ophthalmologyExams',
          'users'
        ]
      });

      if (!response.data.changes) return;

      const { changes } = response.data;

      for (const [entity, items] of Object.entries(changes)) {
        await this.processServerChanges(entity, items);
      }
    } catch (error) {
      console.error('Failed to pull server changes:', error);
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

    return {
      isOnline: navigator.onLine,
      isSyncing: this.isSyncing,
      lastSync,
      pendingOperations: syncQueue.length,
      unresolvedConflicts: conflicts.filter(c => c.resolution === 'pending').length,
      totalConflicts: conflicts.length,
      localRecords: stats
    };
  }

  // Clear all sync data (use with caution)
  async clearSyncData() {
    await databaseService.db.syncQueue.clear();
    await databaseService.db.conflicts.clear();
    await databaseService.setSetting('lastSync', new Date().toISOString());
  }
}

// Create singleton instance
const syncService = new SyncService();

// Initialize on load
if (typeof window !== 'undefined') {
  syncService.init();
}

export default syncService;