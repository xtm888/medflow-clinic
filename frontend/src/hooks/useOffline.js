import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import databaseService, { db } from '../services/database';
import syncService from '../services/syncService';

/**
 * Hook for managing offline functionality
 * REFACTORED: Uses modern database.js and syncService.js
 * instead of the legacy offlineService.js
 */
export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'error'
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const syncInProgress = useRef(false);

  // Store names (for backwards compatibility)
  const STORES = {
    PATIENTS: 'patients',
    APPOINTMENTS: 'appointments',
    PRESCRIPTIONS: 'prescriptions',
    QUEUE: 'queue',
    SYNC_QUEUE: 'syncQueue',
    VISITS: 'visits',
    INVOICES: 'invoices',
    LAB_ORDERS: 'labOrders',
    LAB_RESULTS: 'labResults',
  };

  // Sync operation types (for backwards compatibility)
  const SYNC_OPERATIONS = {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE'
  };

  // Update pending count from the modern sync queue
  const updatePendingCount = useCallback(async () => {
    try {
      const pending = await db.syncQueue.where('status').equals('pending').count();
      setPendingCount(pending);
    } catch (error) {
      console.warn('[useOffline] Failed to get pending count:', error);
      setPendingCount(0);
    }
  }, []);

  // Handle online status change
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      toast.info('Connexion rétablie', { icon: '🌐' });

      // Auto-sync when back online
      if (pendingCount > 0) {
        await triggerSync();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Mode hors ligne activé', { icon: '📴' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingCount]);

  // Initialize and load pending count
  useEffect(() => {
    databaseService.init().then(() => {
      updatePendingCount();
    });
  }, [updatePendingCount]);

  // Trigger sync with server using modern syncService
  const triggerSync = useCallback(async () => {
    if (syncInProgress.current || !isOnline) {
      return { synced: 0, failed: 0 };
    }

    syncInProgress.current = true;
    setSyncStatus('syncing');

    try {
      const result = await syncService.sync();

      setLastSyncTime(Date.now());
      await updatePendingCount();

      if (result.synced > 0) {
        toast.success(`${result.synced} opération(s) synchronisée(s)`);
      }

      if (result.failed > 0) {
        toast.warning(`${result.failed} opération(s) en échec`);
        setSyncStatus('error');
      } else {
        setSyncStatus('idle');
      }

      return result;
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('error');
      toast.error('Erreur de synchronisation');
      return { synced: 0, failed: 0, error };
    } finally {
      syncInProgress.current = false;
    }
  }, [isOnline, updatePendingCount]);

  // Cache data for offline use
  const cacheData = useCallback(async (data, storeName) => {
    try {
      if (Array.isArray(data)) {
        await databaseService.bulkSave(storeName, data);
      } else {
        await databaseService.saveEncrypted(storeName, data);
      }
      await updatePendingCount();
    } catch (error) {
      console.error('[useOffline] Failed to cache data:', error);
    }
  }, [updatePendingCount]);

  // Queue an operation for sync using modern database
  const queueOperation = useCallback(async (operation, storeName, data) => {
    try {
      // Add to sync queue
      await databaseService.addToSyncQueue(operation, storeName, data._id || data.id, data);
      await updatePendingCount();

      // If online, try immediate sync
      if (isOnline) {
        // Don't await - let it sync in background
        triggerSync();
      }
    } catch (error) {
      console.error('[useOffline] Failed to queue operation:', error);
      throw error;
    }
  }, [isOnline, triggerSync, updatePendingCount]);

  // Fetch with offline fallback
  const fetchWithFallback = useCallback(async (fetchFn, storeName, key) => {
    // If online, try to fetch from API
    if (isOnline) {
      try {
        const data = await fetchFn();

        // Cache the result
        if (data) {
          await cacheData(data, storeName);
        }

        return { data, source: 'online' };
      } catch (error) {
        console.warn('API fetch failed, falling back to offline cache:', error);
      }
    }

    // Fallback to cached data
    try {
      const cached = key
        ? await databaseService.getDecrypted(storeName, key)
        : await databaseService.getAllDecrypted(storeName);

      if (cached) {
        return { data: cached, source: 'cache' };
      }
    } catch (error) {
      console.error('[useOffline] Cache read failed:', error);
    }

    return { data: null, source: 'none' };
  }, [isOnline, cacheData]);

  // Get cached data
  const getCached = useCallback(async (storeName, key) => {
    try {
      return key
        ? await databaseService.getDecrypted(storeName, key)
        : await databaseService.getAllDecrypted(storeName);
    } catch (error) {
      console.error('[useOffline] Failed to get cached data:', error);
      return null;
    }
  }, []);

  // Clear offline cache
  const clearCache = useCallback(async (storeName) => {
    try {
      if (storeName && db[storeName]) {
        await db[storeName].clear();
      } else {
        await databaseService.clearAll();
      }
      await updatePendingCount();
      toast.info('Cache hors ligne vidé');
    } catch (error) {
      console.error('[useOffline] Failed to clear cache:', error);
    }
  }, [updatePendingCount]);

  return {
    // State
    isOnline,
    syncStatus,
    pendingCount,
    lastSyncTime,

    // Actions
    triggerSync,
    cacheData,
    queueOperation,
    fetchWithFallback,
    getCached,
    clearCache,

    // Constants
    STORES,
    SYNC_OPERATIONS
  };
}

export default useOffline;
