/**
 * useAbortController - Simple hook for request cancellation
 *
 * Provides an easy way to add request cancellation to existing pages
 * without restructuring them to use useApi.
 *
 * Usage:
 * const { signal, abort, getSignal } = useAbortController();
 *
 * useEffect(() => {
 *   const fetchData = async () => {
 *     try {
 *       const response = await patientService.getPatients({ signal: getSignal() });
 *       if (!signal.aborted) {
 *         setPatients(response.data);
 *       }
 *     } catch (err) {
 *       if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
 *         setError(err.message);
 *       }
 *     }
 *   };
 *   fetchData();
 *   return () => abort();
 * }, [dependencies]);
 */

import { useRef, useEffect, useCallback } from 'react';

export default function useAbortController() {
  const abortControllerRef = useRef(null);
  const mountedRef = useRef(true);

  // Get or create a new AbortController and return its signal
  const getSignal = useCallback(() => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // Create new controller
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current.signal;
  }, []);

  // Abort any pending request
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Check if component is still mounted
  const isMounted = useCallback(() => mountedRef.current, []);

  // Get current signal without creating a new one
  const getCurrentSignal = useCallback(() => {
    return abortControllerRef.current?.signal || null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abort();
    };
  }, [abort]);

  return {
    getSignal,
    abort,
    isMounted,
    getCurrentSignal,
    // Expose signal directly for convenience (read-only)
    get signal() {
      return abortControllerRef.current?.signal || null;
    }
  };
}

/**
 * isAbortError - Helper to check if error is an abort error
 */
export function isAbortError(error) {
  return error?.name === 'AbortError' || error?.name === 'CanceledError';
}

/**
 * withAbortSignal - Higher-order function to add signal to service calls
 *
 * Usage:
 * const { getSignal } = useAbortController();
 * const fetchPatient = withAbortSignal(patientService.getPatient, getSignal);
 * const data = await fetchPatient(patientId);
 */
export function withAbortSignal(fn, getSignal) {
  return async (...args) => {
    const signal = getSignal();
    // If the last arg is an options object, add signal to it
    const lastArg = args[args.length - 1];
    if (lastArg && typeof lastArg === 'object' && !Array.isArray(lastArg)) {
      args[args.length - 1] = { ...lastArg, signal };
    } else {
      args.push({ signal });
    }
    return fn(...args);
  };
}
