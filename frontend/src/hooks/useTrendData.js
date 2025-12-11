/**
 * useTrendData Hook
 *
 * Fetches and manages clinical trend data for ophthalmology patients.
 * Supports IOP, Visual Acuity, Cup/Disc ratio, and Refraction trends.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import api from '../services/apiConfig';
import { LRUCache } from '../utils/performance';

// LRU Cache for trend data to avoid redundant API calls (max 100 entries to prevent memory leaks)
const trendCache = new LRUCache(100);
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Hook for fetching and managing clinical trend data
 * @param {string} patientId - Patient ID
 * @param {Object} options - Configuration options
 */
export function useTrendData(patientId, options = {}) {
  const {
    autoFetch = true,
    months = 24,
    useCache = true
  } = options;

  // State
  const [iopData, setIopData] = useState({ dataPoints: [], stats: {}, loading: false, error: null });
  const [vaData, setVaData] = useState({ dataPoints: [], stats: {}, loading: false, error: null });
  const [cupDiscData, setCupDiscData] = useState({ dataPoints: [], stats: {}, loading: false, error: null });
  const [refractionData, setRefractionData] = useState({ dataPoints: [], stats: {}, loading: false, error: null });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  // Refs to track fetch state
  const fetchingRef = useRef(new Set());

  /**
   * Get cache key for a specific trend type
   */
  const getCacheKey = useCallback((type) => {
    return `${patientId}-${type}-${months}`;
  }, [patientId, months]);

  /**
   * Check if cache is valid
   */
  const isCacheValid = useCallback((key) => {
    const cached = trendCache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < CACHE_TTL;
  }, []);

  /**
   * Get from cache
   */
  const getFromCache = useCallback((key) => {
    const cached = trendCache.get(key);
    return cached?.data || null;
  }, []);

  /**
   * Set to cache
   */
  const setToCache = useCallback((key, data) => {
    trendCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }, []);

  /**
   * Fetch IOP trend data
   */
  const fetchIOPTrends = useCallback(async () => {
    if (!patientId) return;

    const cacheKey = getCacheKey('iop');

    // Check cache
    if (useCache && isCacheValid(cacheKey)) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        setIopData({ ...cached, loading: false, error: null });
        return cached;
      }
    }

    // Prevent duplicate fetches
    if (fetchingRef.current.has('iop')) return;
    fetchingRef.current.add('iop');

    setIopData(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await api.get(`/clinical-trends/patient/${patientId}/iop`, {
        params: { months }
      });

      const data = response.data?.data || {};
      const result = {
        dataPoints: data.dataPoints || [],
        stats: data.stats || {},
        concerns: data.concerns || [],
        meta: data.meta || {}
      };

      setToCache(cacheKey, result);
      setIopData({ ...result, loading: false, error: null });
      return result;
    } catch (err) {
      console.error('Error fetching IOP trends:', err);
      setIopData(prev => ({ ...prev, loading: false, error: 'Failed to fetch IOP data' }));
      return null;
    } finally {
      fetchingRef.current.delete('iop');
    }
  }, [patientId, months, useCache, getCacheKey, isCacheValid, getFromCache, setToCache]);

  /**
   * Fetch Visual Acuity trend data
   */
  const fetchVATrends = useCallback(async (type = 'corrected') => {
    if (!patientId) return;

    const cacheKey = getCacheKey(`va-${type}`);

    if (useCache && isCacheValid(cacheKey)) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        setVaData({ ...cached, loading: false, error: null });
        return cached;
      }
    }

    if (fetchingRef.current.has('va')) return;
    fetchingRef.current.add('va');

    setVaData(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await api.get(`/clinical-trends/patient/${patientId}/visual-acuity`, {
        params: { months, type }
      });

      const data = response.data?.data || {};
      const result = {
        dataPoints: data.dataPoints || [],
        stats: data.stats || {},
        concerns: data.concerns || [],
        meta: data.meta || {}
      };

      setToCache(cacheKey, result);
      setVaData({ ...result, loading: false, error: null });
      return result;
    } catch (err) {
      console.error('Error fetching VA trends:', err);
      setVaData(prev => ({ ...prev, loading: false, error: 'Failed to fetch VA data' }));
      return null;
    } finally {
      fetchingRef.current.delete('va');
    }
  }, [patientId, months, useCache, getCacheKey, isCacheValid, getFromCache, setToCache]);

  /**
   * Fetch Cup/Disc ratio trend data
   */
  const fetchCupDiscTrends = useCallback(async () => {
    if (!patientId) return;

    const cacheKey = getCacheKey('cupdisc');

    if (useCache && isCacheValid(cacheKey)) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        setCupDiscData({ ...cached, loading: false, error: null });
        return cached;
      }
    }

    if (fetchingRef.current.has('cupdisc')) return;
    fetchingRef.current.add('cupdisc');

    setCupDiscData(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await api.get(`/clinical-trends/patient/${patientId}/cup-disc`, {
        params: { months: 36 } // Longer timeframe for C/D
      });

      const data = response.data?.data || {};
      const result = {
        dataPoints: data.dataPoints || [],
        stats: data.stats || {},
        concerns: data.concerns || [],
        meta: data.meta || {}
      };

      setToCache(cacheKey, result);
      setCupDiscData({ ...result, loading: false, error: null });
      return result;
    } catch (err) {
      console.error('Error fetching C/D trends:', err);
      setCupDiscData(prev => ({ ...prev, loading: false, error: 'Failed to fetch C/D data' }));
      return null;
    } finally {
      fetchingRef.current.delete('cupdisc');
    }
  }, [patientId, useCache, getCacheKey, isCacheValid, getFromCache, setToCache]);

  /**
   * Fetch Refraction trend data
   */
  const fetchRefractionTrends = useCallback(async () => {
    if (!patientId) return;

    const cacheKey = getCacheKey('refraction');

    if (useCache && isCacheValid(cacheKey)) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        setRefractionData({ ...cached, loading: false, error: null });
        return cached;
      }
    }

    if (fetchingRef.current.has('refraction')) return;
    fetchingRef.current.add('refraction');

    setRefractionData(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await api.get(`/clinical-trends/patient/${patientId}/refraction`, {
        params: { months: 60 } // 5 years for refraction
      });

      const data = response.data?.data || {};
      const result = {
        dataPoints: data.dataPoints || [],
        stats: data.stats || {},
        concerns: data.concerns || [],
        meta: data.meta || {}
      };

      setToCache(cacheKey, result);
      setRefractionData({ ...result, loading: false, error: null });
      return result;
    } catch (err) {
      console.error('Error fetching refraction trends:', err);
      setRefractionData(prev => ({ ...prev, loading: false, error: 'Failed to fetch refraction data' }));
      return null;
    } finally {
      fetchingRef.current.delete('refraction');
    }
  }, [patientId, useCache, getCacheKey, isCacheValid, getFromCache, setToCache]);

  /**
   * Fetch trend summary
   */
  const fetchSummary = useCallback(async () => {
    if (!patientId) return;

    try {
      const response = await api.get(`/clinical-trends/patient/${patientId}/summary`);
      const data = response.data?.data || {};
      setSummary(data);
      return data;
    } catch (err) {
      console.error('Error fetching trend summary:', err);
      return null;
    }
  }, [patientId]);

  /**
   * Fetch all trend data
   */
  const fetchAllTrends = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);

    try {
      await Promise.all([
        fetchIOPTrends(),
        fetchVATrends(),
        fetchCupDiscTrends(),
        fetchSummary()
      ]);
    } finally {
      setLoading(false);
    }
  }, [patientId, fetchIOPTrends, fetchVATrends, fetchCupDiscTrends, fetchSummary]);

  /**
   * Compare two exams
   */
  const compareExams = useCallback(async (examId1, examId2) => {
    try {
      const response = await api.post('/clinical-trends/compare', {
        examId1,
        examId2
      });
      return response.data?.data || null;
    } catch (err) {
      console.error('Error comparing exams:', err);
      return null;
    }
  }, []);

  /**
   * Clear cache for patient
   */
  const clearCache = useCallback(() => {
    trendCache.deleteByPrefix(patientId);
  }, [patientId]);

  /**
   * Refresh all data (bypassing cache)
   */
  const refresh = useCallback(async () => {
    clearCache();
    await fetchAllTrends();
  }, [clearCache, fetchAllTrends]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && patientId) {
      fetchAllTrends();
    }
  }, [autoFetch, patientId, fetchAllTrends]);

  return {
    // Data
    iopData,
    vaData,
    cupDiscData,
    refractionData,
    summary,

    // State
    loading,
    hasData: iopData.dataPoints.length > 0 || vaData.dataPoints.length > 0 || cupDiscData.dataPoints.length > 0,

    // Actions
    fetchIOPTrends,
    fetchVATrends,
    fetchCupDiscTrends,
    fetchRefractionTrends,
    fetchSummary,
    fetchAllTrends,
    compareExams,
    refresh,
    clearCache
  };
}

export default useTrendData;
