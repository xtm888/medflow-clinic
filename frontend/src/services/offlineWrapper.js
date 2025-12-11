/**
 * Offline Wrapper Service
 * Provides offline-first capability for any API service
 *
 * Strategy:
 * - READS: Try network first, fall back to cache, update cache on success
 * - WRITES: Try network, queue if offline, optimistic update local
 * - BACKGROUND SYNC: Register with Service Worker for automatic sync when online
 */

import databaseService, { db } from './database';
import syncService from './syncService';

class OfflineWrapper {
  constructor() {
    this.isOnline = navigator.onLine;
    this.backgroundSyncSupported = false;
    this.setupListeners();
    this.checkBackgroundSyncSupport();
  }

  setupListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[OfflineWrapper] Back online');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[OfflineWrapper] Gone offline');
    });
  }

  /**
   * Check if Background Sync API is supported
   */
  async checkBackgroundSyncSupport() {
    try {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        if (registration.sync) {
          this.backgroundSyncSupported = true;
          console.log('[OfflineWrapper] Background Sync is supported');
        }
      }
    } catch (error) {
      console.log('[OfflineWrapper] Background Sync not available:', error.message);
    }
  }

  /**
   * Register background sync to process queue when device comes online
   */
  async registerBackgroundSync() {
    if (!this.backgroundSyncSupported) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('medflow-sync-queue');
      console.log('[OfflineWrapper] Background sync registered: medflow-sync-queue');
      return true;
    } catch (error) {
      // Background sync may be blocked by user or not supported
      console.warn('[OfflineWrapper] Background sync registration failed:', error.message);
      return false;
    }
  }

  /**
   * Wrap a GET request with offline fallback
   * @param {Function} apiFn - The API function to call
   * @param {string} entity - Entity type (patients, appointments, etc.)
   * @param {string|Object} cacheKey - Key or query for cache lookup
   * @param {Object} options - Additional options
   */
  async get(apiFn, entity, cacheKey, options = {}) {
    const {
      transform = (data) => data, // Transform API response before caching
      cacheExpiry = 3600, // Cache expiry in seconds (1 hour default)
      forceRefresh = false,
    } = options;

    // If we need to force refresh and we're online, skip cache
    if (!forceRefresh && !this.isOnline) {
      const cachedData = await this.getFromCache(entity, cacheKey);
      if (cachedData) {
        return {
          success: true,
          data: cachedData,
          _fromCache: true,
          _cachedAt: cachedData.lastSync || cachedData._cachedAt || null
        };
      }
      // No cache, throw offline error
      throw new Error('Offline and no cached data available');
    }

    try {
      // Try network first
      const response = await apiFn();
      const data = transform(response);

      // Cache the result
      await this.cacheData(entity, data, cacheKey);

      // Mark as from network
      return {
        ...response,
        _fromCache: false,
        _cachedAt: null
      };
    } catch (error) {
      console.warn(`[OfflineWrapper] Network request failed for ${entity}, using cache:`, error.message);

      // Fall back to cache
      const cachedData = await this.getFromCache(entity, cacheKey);

      if (cachedData) {
        return {
          success: true,
          data: cachedData,
          _fromCache: true,
          _cachedAt: cachedData.lastSync || null
        };
      }

      // No cache available, throw the original error
      throw error;
    }
  }

  /**
   * Wrap a POST/PUT/DELETE request with offline queue
   * @param {Function} apiFn - The API function to call
   * @param {string} operation - CREATE, UPDATE, DELETE
   * @param {string} entity - Entity type
   * @param {Object} data - The data to send
   * @param {string} entityId - ID of the entity (for UPDATE/DELETE)
   */
  async mutate(apiFn, operation, entity, data, entityId = null) {
    // Generate temp ID for new records
    const tempId = entityId || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (this.isOnline) {
      try {
        // Try network first
        const response = await apiFn();

        // Update local cache with server response
        if (response.data) {
          await this.cacheData(entity, response.data, response.data._id || response.data.id);
        }

        return {
          ...response,
          _offline: false,
          _synced: true
        };
      } catch (error) {
        // Check if this is a validation error or other client error (4xx)
        // These should be shown to the user, not queued for sync
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          console.error(`[OfflineWrapper] Client error (${error.response.status}):`, error.response.data?.error || error.message);
          // Re-throw validation/client errors so user can fix them
          throw error;
        }

        // Network errors (no response) or server errors (5xx) can be queued
        console.warn(`[OfflineWrapper] Network mutation failed, queuing:`, error.message);
        // If network fails, fall through to offline handling
      }
    }

    // Offline or network failed - queue for later
    console.log(`[OfflineWrapper] Queuing ${operation} for ${entity}`);

    // Add to sync queue
    await databaseService.addToSyncQueue(operation, entity, tempId, data);

    // Register background sync to process queue when device comes online
    this.registerBackgroundSync();

    // Optimistic local update
    const localData = {
      ...data,
      id: tempId,
      _id: tempId,
      _offline: true,
      _pendingSync: true,
      lastSync: new Date().toISOString()
    };

    if (operation === 'CREATE' || operation === 'UPDATE') {
      await this.cacheData(entity, localData, tempId);
    } else if (operation === 'DELETE') {
      await this.removeFromCache(entity, entityId);
    }

    return {
      success: true,
      data: localData,
      _offline: true,
      _synced: false,
      _tempId: tempId
    };
  }

  /**
   * Get data from local cache
   */
  async getFromCache(entity, cacheKey) {
    try {
      const table = db[entity];
      if (!table) {
        console.warn(`[OfflineWrapper] Unknown entity: ${entity}`);
        return null;
      }

      // If cacheKey is an ID, get single record
      if (typeof cacheKey === 'string') {
        return await table.get(cacheKey);
      }

      // If cacheKey is a query object, filter
      if (typeof cacheKey === 'object' && cacheKey !== null) {
        let query = table;

        // Handle common filters
        if (cacheKey.patientId) {
          query = query.where('patientId').equals(cacheKey.patientId);
        } else if (cacheKey.date) {
          query = query.where('date').equals(cacheKey.date);
        } else if (cacheKey.status) {
          query = query.where('status').equals(cacheKey.status);
        }

        return await query.toArray();
      }

      // Return all records for the entity
      return await table.toArray();
    } catch (error) {
      console.error(`[OfflineWrapper] Cache read error:`, error);
      return null;
    }
  }

  /**
   * Cache data locally
   */
  async cacheData(entity, data, cacheKey) {
    try {
      const table = db[entity];
      if (!table) {
        console.warn(`[OfflineWrapper] Unknown entity for caching: ${entity}`);
        return;
      }

      const timestamp = new Date().toISOString();

      // Extract actual data array - handle various response formats
      let itemsToCache = data;
      if (data?.data && Array.isArray(data.data)) {
        // Format: { success: true, data: [...], total, pages }
        itemsToCache = data.data;
      }

      // Handle array of items
      if (Array.isArray(itemsToCache)) {
        const itemsWithSync = itemsToCache.map(item => ({
          ...item,
          id: item._id || item.id,
          lastSync: timestamp
        }));
        if (itemsWithSync.length > 0) {
          await table.bulkPut(itemsWithSync);
        }
      } else if (itemsToCache && typeof itemsToCache === 'object' && (itemsToCache._id || itemsToCache.id)) {
        // Single item with valid ID
        await table.put({
          ...itemsToCache,
          id: itemsToCache._id || itemsToCache.id || cacheKey,
          lastSync: timestamp
        });
      }
      // Skip caching if data is not a valid format (e.g., response wrapper without items)

      // Update cache metadata
      await databaseService.setCacheMetadata(`${entity}:${cacheKey}`, 3600);
    } catch (error) {
      // Check for quota errors
      if (error.name === 'QuotaExceededError') {
        console.error('[OfflineWrapper] Storage quota exceeded');
        throw new Error('Stockage local plein. Impossible de sauvegarder les données hors ligne.');
      }
      console.error(`[OfflineWrapper] Cache write error:`, error);
      throw error;
    }
  }

  /**
   * Remove item from cache
   */
  async removeFromCache(entity, id) {
    try {
      const table = db[entity];
      if (table) {
        await table.delete(id);
      }
    } catch (error) {
      console.error(`[OfflineWrapper] Cache delete error:`, error);
    }
  }

  /**
   * Get all cached data for an entity
   */
  async getAllCached(entity) {
    try {
      const table = db[entity];
      if (!table) return [];
      return await table.toArray();
    } catch (error) {
      console.error(`[OfflineWrapper] Error getting all cached:`, error);
      return [];
    }
  }

  /**
   * Search cached data
   */
  async searchCached(entity, query) {
    try {
      const table = db[entity];
      if (!table) return [];

      const lowerQuery = query.toLowerCase();

      return await table.filter(item => {
        // Search common fields
        const searchFields = ['firstName', 'lastName', 'patientId', 'email', 'phoneNumber', 'name'];
        return searchFields.some(field =>
          item[field]?.toLowerCase?.()?.includes(lowerQuery)
        );
      }).toArray();
    } catch (error) {
      console.error(`[OfflineWrapper] Search error:`, error);
      return [];
    }
  }

  /**
   * Check if data exists in cache and is valid
   */
  async isCacheValid(entity, cacheKey) {
    return await databaseService.isCacheValid(`${entity}:${cacheKey}`);
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    return await syncService.getStatus();
  }

  /**
   * Force sync
   */
  async sync() {
    if (this.isOnline) {
      await syncService.sync();
    }
  }

  /**
   * Check if currently online
   */
  checkOnline() {
    return this.isOnline;
  }
}

// Export singleton
const offlineWrapper = new OfflineWrapper();
export default offlineWrapper;
