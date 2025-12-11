import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import patientService from '../services/patientService';

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

const PatientCacheContext = createContext(null);

export function PatientCacheProvider({ children }) {
  // In-memory cache: { [patientId]: { data, timestamp } }
  const cacheRef = useRef({});
  const [cacheVersion, setCacheVersion] = useState(0); // For forcing re-renders when cache updates

  // Check if cached entry is still valid
  const isCacheValid = useCallback((patientId) => {
    const entry = cacheRef.current[patientId];
    if (!entry) return false;
    return (Date.now() - entry.timestamp) < CACHE_TTL;
  }, []);

  // Get patient from cache (returns null if not cached or expired)
  const getCachedPatient = useCallback((patientId) => {
    if (!patientId) return null;
    if (isCacheValid(patientId)) {
      return cacheRef.current[patientId].data;
    }
    return null;
  }, [isCacheValid]);

  // Add or update patient in cache
  const cachePatient = useCallback((patient) => {
    if (!patient?._id) return;
    cacheRef.current[patient._id] = {
      data: patient,
      timestamp: Date.now()
    };
    setCacheVersion(v => v + 1);
  }, []);

  // Add multiple patients to cache
  const cachePatients = useCallback((patients) => {
    if (!Array.isArray(patients)) return;
    patients.forEach(patient => {
      if (patient?._id) {
        cacheRef.current[patient._id] = {
          data: patient,
          timestamp: Date.now()
        };
      }
    });
    setCacheVersion(v => v + 1);
  }, []);

  // Fetch patient (uses cache if available, otherwise fetches from API)
  const getPatient = useCallback(async (patientId) => {
    if (!patientId) return null;

    // Check cache first
    const cached = getCachedPatient(patientId);
    if (cached) return cached;

    // Fetch from API
    try {
      const response = await patientService.getPatientById(patientId);
      const patient = response?.data || response;
      if (patient) {
        cachePatient(patient);
        return patient;
      }
    } catch (error) {
      console.error('Error fetching patient:', error);
    }
    return null;
  }, [getCachedPatient, cachePatient]);

  // Invalidate a specific patient (force refetch on next access)
  const invalidatePatient = useCallback((patientId) => {
    if (patientId && cacheRef.current[patientId]) {
      delete cacheRef.current[patientId];
      setCacheVersion(v => v + 1);
    }
  }, []);

  // Clear entire cache
  const clearCache = useCallback(() => {
    cacheRef.current = {};
    setCacheVersion(v => v + 1);
  }, []);

  // Prefetch multiple patients in background
  const prefetchPatients = useCallback(async (patientIds) => {
    if (!Array.isArray(patientIds)) return;

    const uncachedIds = patientIds.filter(id => id && !getCachedPatient(id));
    if (uncachedIds.length === 0) return;

    // Fetch uncached patients in parallel (batch of 10 at a time)
    const batchSize = 10;
    for (let i = 0; i < uncachedIds.length; i += batchSize) {
      const batch = uncachedIds.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (id) => {
          try {
            const response = await patientService.getPatientById(id);
            const patient = response?.data || response;
            if (patient) {
              cachePatient(patient);
            }
          } catch (error) {
            console.error(`Error prefetching patient ${id}:`, error);
          }
        })
      );
    }
  }, [getCachedPatient, cachePatient]);

  const value = {
    getCachedPatient,
    cachePatient,
    cachePatients,
    getPatient,
    invalidatePatient,
    clearCache,
    prefetchPatients,
    cacheVersion // For components that need to react to cache updates
  };

  return (
    <PatientCacheContext.Provider value={value}>
      {children}
    </PatientCacheContext.Provider>
  );
}

// Default values when not in provider (for error boundary recovery)
const defaultPatientCacheContext = {
  getPatient: () => Promise.resolve(null),
  prefetchPatients: () => {},
  getCachedPatient: () => null,
  invalidatePatient: () => {},
  clearCache: () => {},
  cacheSize: 0
};

// Hook to use patient cache
export function usePatientCache() {
  const context = useContext(PatientCacheContext);
  if (!context) {
    console.warn('usePatientCache called outside PatientCacheProvider - using default values');
    return defaultPatientCacheContext;
  }
  return context;
}

// Hook to get a single patient (with automatic caching)
export function useCachedPatient(patientId) {
  const { getCachedPatient, getPatient } = usePatientCache();
  const [patient, setPatient] = useState(() => getCachedPatient(patientId));
  const [loading, setLoading] = useState(!patient && !!patientId);

  // Fetch patient if not cached
  useEffect(() => {
    let cancelled = false;

    async function fetchPatient() {
      if (!patientId) {
        setPatient(null);
        setLoading(false);
        return;
      }

      const cached = getCachedPatient(patientId);
      if (cached) {
        setPatient(cached);
        setLoading(false);
        return;
      }

      setLoading(true);
      const fetchedPatient = await getPatient(patientId);
      if (!cancelled) {
        setPatient(fetchedPatient);
        setLoading(false);
      }
    }

    fetchPatient();

    return () => {
      cancelled = true;
    };
  }, [patientId, getCachedPatient, getPatient]);

  return { patient, loading };
}

export default PatientCacheContext;
