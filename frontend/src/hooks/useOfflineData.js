/**
 * useOfflineData Hook
 * React hook for offline-first data fetching
 *
 * Features:
 * - Automatic network/cache fallback
 * - Loading and error states
 * - Cache status indicators
 * - Manual refresh capability
 * - Optimistic updates for mutations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import offlineWrapper from '../services/offlineWrapper';
import syncService from '../services/syncService';

/**
 * Main hook for fetching data with offline support
 * @param {Function} fetchFn - Function that returns a promise (API call)
 * @param {string} entity - Entity type for caching (patients, appointments, etc.)
 * @param {string|Object} cacheKey - Cache key or query params
 * @param {Object} options - Additional options
 */
export function useOfflineData(fetchFn, entity, cacheKey, options = {}) {
  const {
    enabled = true,
    refetchOnFocus = true,
    refetchOnReconnect = true,
    cacheTime = 3600,
    staleTime = 60,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [cachedAt, setCachedAt] = useState(null);
  const [isStale, setIsStale] = useState(false);

  const fetchRef = useRef(fetchFn);
  const mountedRef = useRef(true);

  // Update ref when fetchFn changes
  useEffect(() => {
    fetchRef.current = fetchFn;
  }, [fetchFn]);

  // Fetch function
  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const result = await offlineWrapper.get(
        fetchRef.current,
        entity,
        cacheKey,
        { forceRefresh, cacheExpiry: cacheTime }
      );

      if (mountedRef.current) {
        setData(result.data || result);
        setIsFromCache(result._fromCache || false);
        setCachedAt(result._cachedAt || null);
        setIsStale(result._fromCache && result._cachedAt &&
          (Date.now() - new Date(result._cachedAt).getTime()) > staleTime * 1000);
        setLoading(false);

        if (onSuccess) {
          onSuccess(result.data || result);
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
        setLoading(false);

        if (onError) {
          onError(err);
        }
      }
    }
  }, [enabled, entity, cacheKey, cacheTime, staleTime, onSuccess, onError]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnFocus) return;

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleFocus);
    return () => document.removeEventListener('visibilitychange', handleFocus);
  }, [refetchOnFocus, fetchData]);

  // Refetch on reconnect
  useEffect(() => {
    if (!refetchOnReconnect) return;

    const handleOnline = () => {
      fetchData(true); // Force refresh when back online
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refetchOnReconnect, fetchData]);

  // Manual refetch
  const refetch = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    isFromCache,
    cachedAt,
    isStale,
    refetch,
  };
}

/**
 * Hook for mutations (create, update, delete) with offline support
 * @param {string} entity - Entity type
 */
export function useOfflineMutation(entity) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(async (operation, apiFn, data, entityId = null) => {
    setLoading(true);
    setError(null);

    try {
      const result = await offlineWrapper.mutate(apiFn, operation, entity, data, entityId);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err);
      setLoading(false);
      throw err;
    }
  }, [entity]);

  const create = useCallback((apiFn, data) => {
    return mutate('CREATE', apiFn, data);
  }, [mutate]);

  const update = useCallback((apiFn, data, entityId) => {
    return mutate('UPDATE', apiFn, data, entityId);
  }, [mutate]);

  const remove = useCallback((apiFn, entityId) => {
    return mutate('DELETE', apiFn, {}, entityId);
  }, [mutate]);

  return {
    mutate,
    create,
    update,
    remove,
    loading,
    error,
  };
}

/**
 * Hook for tracking online/offline status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastOnlineAt, setLastOnlineAt] = useState(navigator.onLine ? new Date() : null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(new Date());
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, lastOnlineAt };
}

/**
 * Hook for sync status
 */
export function useSyncStatus() {
  const [syncStatus, setSyncStatus] = useState({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSync: null,
    pendingOperations: 0,
    unresolvedConflicts: 0,
  });

  useEffect(() => {
    // Initial status
    const loadStatus = async () => {
      try {
        const status = await syncService.getStatus();
        setSyncStatus(status);
      } catch (error) {
        console.error('Failed to get sync status:', error);
      }
    };
    loadStatus();

    // Listen for sync events
    const unsubscribe = syncService.addListener((event, data) => {
      loadStatus();
    });

    // Refresh periodically
    const interval = setInterval(loadStatus, 10000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const triggerSync = useCallback(async () => {
    if (navigator.onLine) {
      await syncService.sync();
    }
  }, []);

  return { ...syncStatus, triggerSync };
}

/**
 * Hook for cached search
 */
export function useOfflineSearch(entity, initialQuery = '') {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);

      try {
        // If offline, search local cache only
        if (!navigator.onLine) {
          const cached = await offlineWrapper.searchCached(entity, query);
          setResults(cached);
          setIsFromCache(true);
        } else {
          // Online: let the component handle API search
          // This hook just provides offline fallback
          setIsFromCache(false);
        }
      } catch (error) {
        console.error('Offline search error:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query, entity]);

  return {
    query,
    setQuery,
    results,
    loading,
    isFromCache,
  };
}

/**
 * Hook for pending sync items (items waiting to sync)
 */
export function usePendingSync() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPending = async () => {
      try {
        const { db } = await import('../services/database');
        const items = await db.syncQueue.where('status').equals('pending').toArray();
        setPending(items);
      } catch (error) {
        console.error('Failed to load pending sync items:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPending();

    // Refresh when sync events occur
    const unsubscribe = syncService.addListener(() => {
      loadPending();
    });

    return () => unsubscribe();
  }, []);

  return { pending, loading, count: pending.length };
}

/**
 * Hook specifically for today's data (appointments, queue)
 * Critical for offline medical operations
 */
export function useTodaysData(fetchFn, entity) {
  const today = new Date().toISOString().split('T')[0];

  return useOfflineData(fetchFn, entity, { date: today }, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
    staleTime: 30, // Consider stale after 30 seconds
  });
}

export default {
  useOfflineData,
  useOfflineMutation,
  useOnlineStatus,
  useSyncStatus,
  useOfflineSearch,
  usePendingSync,
  useTodaysData,
};
