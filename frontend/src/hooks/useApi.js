/**
 * useApi - Standardized API call hook with error handling
 *
 * Reduces boilerplate for API calls across components by providing:
 * - Consistent loading/error states
 * - Automatic error message extraction
 * - Request cancellation support
 * - Retry functionality
 *
 * Usage:
 * const { data, loading, error, execute, reset } = useApi(patientService.getPatient);
 *
 * // In effect or handler:
 * execute(patientId);
 *
 * // With immediate execution:
 * const { data, loading } = useApi(patientService.getPatients, { immediate: true });
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Extract user-friendly error message from various error formats
 */
const extractErrorMessage = (error) => {
  if (!error) return 'Une erreur est survenue';

  // Axios error with response
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  // Axios error with response data as string
  if (error.response?.data && typeof error.response.data === 'string') {
    return error.response.data;
  }

  // Network error
  if (error.message === 'Network Error') {
    return 'Erreur de connexion au serveur';
  }

  // Timeout
  if (error.code === 'ECONNABORTED') {
    return 'La requête a expiré';
  }

  // Standard error message
  if (error.message) {
    return error.message;
  }

  return 'Une erreur est survenue';
};

/**
 * Main useApi hook
 */
export default function useApi(apiFunction, options = {}) {
  const {
    immediate = false,
    initialData = null,
    onSuccess = null,
    onError = null,
    transform = null,
    retryCount = 0,
    retryDelay = 1000
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const [retries, setRetries] = useState(0);

  // Track mounted state for cleanup
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);

  // Execute the API call
  const execute = useCallback(async (...args) => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      // Pass abort signal if the API function accepts options
      const result = await apiFunction(...args);

      if (!mountedRef.current) return;

      // Transform data if transformer provided
      const transformedData = transform ? transform(result) : result;

      setData(transformedData);
      setRetries(0);

      if (onSuccess) {
        onSuccess(transformedData);
      }

      return transformedData;
    } catch (err) {
      if (!mountedRef.current) return;

      // Ignore abort errors
      if (err.name === 'AbortError' || err.name === 'CanceledError') {
        return;
      }

      const errorMessage = extractErrorMessage(err);

      // Retry logic
      if (retries < retryCount) {
        setRetries(prev => prev + 1);
        setTimeout(() => {
          if (mountedRef.current) {
            execute(...args);
          }
        }, retryDelay * (retries + 1)); // Exponential backoff
        return;
      }

      setError(errorMessage);

      if (onError) {
        onError(err, errorMessage);
      }

      throw err;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiFunction, transform, onSuccess, onError, retryCount, retryDelay, retries]);

  // Reset state
  const reset = useCallback(() => {
    setData(initialData);
    setLoading(false);
    setError(null);
    setRetries(0);
  }, [initialData]);

  // Cancel pending request
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Immediate execution
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
    cancel,
    isError: !!error,
    isSuccess: !!data && !error && !loading
  };
}

/**
 * useApiMutation - For POST/PUT/DELETE operations
 * Similar to useApi but doesn't execute immediately and tracks success state
 */
export function useApiMutation(apiFunction, options = {}) {
  const {
    onSuccess = null,
    onError = null,
    successMessage = null
  } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [data, setData] = useState(null);

  const mountedRef = useRef(true);

  const mutate = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    setIsSuccess(false);

    try {
      const result = await apiFunction(...args);

      if (!mountedRef.current) return;

      setData(result);
      setIsSuccess(true);

      if (onSuccess) {
        onSuccess(result, successMessage);
      }

      return result;
    } catch (err) {
      if (!mountedRef.current) return;

      const errorMessage = extractErrorMessage(err);
      setError(errorMessage);

      if (onError) {
        onError(err, errorMessage);
      }

      throw err;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiFunction, onSuccess, onError, successMessage]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setIsSuccess(false);
    setData(null);
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    mutate,
    loading,
    error,
    isSuccess,
    data,
    reset
  };
}

/**
 * usePaginatedApi - For paginated list endpoints
 */
export function usePaginatedApi(apiFunction, options = {}) {
  const {
    initialPage = 1,
    initialLimit = 20,
    onSuccess = null,
    onError = null
  } = options;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const mountedRef = useRef(true);

  const fetchPage = useCallback(async (pageNum = page, params = {}) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiFunction({
        page: pageNum,
        limit,
        ...params
      });

      if (!mountedRef.current) return;

      // Handle different response formats
      const items = result.data || result.items || result;
      const totalCount = result.total || result.totalCount || items.length;

      setData(items);
      setTotal(totalCount);
      setHasMore(items.length === limit);
      setPage(pageNum);

      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (err) {
      if (!mountedRef.current) return;

      const errorMessage = extractErrorMessage(err);
      setError(errorMessage);

      if (onError) {
        onError(err, errorMessage);
      }

      throw err;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiFunction, page, limit, onSuccess, onError]);

  const nextPage = useCallback(() => {
    if (hasMore && !loading) {
      fetchPage(page + 1);
    }
  }, [fetchPage, hasMore, loading, page]);

  const prevPage = useCallback(() => {
    if (page > 1 && !loading) {
      fetchPage(page - 1);
    }
  }, [fetchPage, page, loading]);

  const goToPage = useCallback((pageNum) => {
    if (pageNum >= 1 && !loading) {
      fetchPage(pageNum);
    }
  }, [fetchPage, loading]);

  const refresh = useCallback(() => {
    fetchPage(page);
  }, [fetchPage, page]);

  const reset = useCallback(() => {
    setData([]);
    setPage(initialPage);
    setTotal(0);
    setHasMore(true);
    setError(null);
  }, [initialPage]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    data,
    loading,
    error,
    page,
    limit,
    total,
    hasMore,
    totalPages: Math.ceil(total / limit),
    fetchPage,
    nextPage,
    prevPage,
    goToPage,
    refresh,
    reset,
    setLimit
  };
}
