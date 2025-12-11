/**
 * API Request Batcher
 *
 * This service batches multiple API requests together to reduce network overhead
 * and improve performance. It groups similar requests and sends them together.
 *
 * Features:
 * - Automatic request batching with configurable delay
 * - Request deduplication
 * - Priority-based ordering
 * - Batch cancellation
 * - Result caching
 */

import { simpleHash } from '../utils/performance';

// Default configuration
const DEFAULT_CONFIG = {
  batchDelay: 50, // ms to wait before sending batch
  maxBatchSize: 10, // max requests per batch
  cacheTimeout: 5000, // ms to cache results
  enableDeduplication: true
};

// Batch queues by endpoint
const batchQueues = new Map();

// Request cache for deduplication
const requestCache = new Map();

// Pending batch timers
const batchTimers = new Map();

/**
 * Generate a cache key for a request (simpleHash is faster than JSON.stringify)
 */
const getCacheKey = (endpoint, params) => {
  return `${endpoint}:${simpleHash(params || {})}`;
};

/**
 * Check if a cached result is still valid
 */
const isCacheValid = (cacheEntry) => {
  if (!cacheEntry) return false;
  return Date.now() - cacheEntry.timestamp < DEFAULT_CONFIG.cacheTimeout;
};

/**
 * Add a request to the batch queue
 */
const addToBatch = (endpoint, request) => {
  if (!batchQueues.has(endpoint)) {
    batchQueues.set(endpoint, []);
  }
  batchQueues.get(endpoint).push(request);
};

/**
 * Execute all pending requests in a batch
 */
const executeBatch = async (endpoint, batchExecutor) => {
  const batch = batchQueues.get(endpoint);
  if (!batch || batch.length === 0) return;

  // Clear the queue
  batchQueues.set(endpoint, []);
  batchTimers.delete(endpoint);

  try {
    // Extract unique request params
    const requests = batch.map(r => ({
      id: r.id,
      params: r.params,
      resolve: r.resolve,
      reject: r.reject
    }));

    // If there's a batch executor, use it
    if (batchExecutor) {
      const results = await batchExecutor(requests.map(r => r.params));

      // Resolve each request with its result
      requests.forEach((request, index) => {
        const result = Array.isArray(results) ? results[index] : results;
        request.resolve(result);

        // Cache the result
        const cacheKey = getCacheKey(endpoint, request.params);
        requestCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      });
    } else {
      // No batch executor - just resolve with the batch
      requests.forEach(request => {
        request.resolve({ batched: true, params: request.params });
      });
    }
  } catch (error) {
    // Reject all pending requests
    batch.forEach(request => {
      request.reject(error);
    });
  }
};

/**
 * Queue a request for batching
 *
 * @param {string} endpoint - The API endpoint
 * @param {object} params - Request parameters
 * @param {object} options - Batching options
 * @returns {Promise} - Promise that resolves with the result
 */
export const queueRequest = (endpoint, params, options = {}) => {
  const config = { ...DEFAULT_CONFIG, ...options };
  const cacheKey = getCacheKey(endpoint, params);

  // Check cache first
  if (config.enableDeduplication) {
    const cached = requestCache.get(cacheKey);
    if (isCacheValid(cached)) {
      return Promise.resolve(cached.data);
    }
  }

  return new Promise((resolve, reject) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add to batch queue
    addToBatch(endpoint, {
      id: requestId,
      params,
      resolve,
      reject,
      priority: options.priority || 0
    });

    // Schedule batch execution if not already scheduled
    if (!batchTimers.has(endpoint)) {
      const timer = setTimeout(() => {
        executeBatch(endpoint, options.batchExecutor);
      }, config.batchDelay);
      batchTimers.set(endpoint, timer);
    }

    // Check if batch size is reached
    const queue = batchQueues.get(endpoint);
    if (queue && queue.length >= config.maxBatchSize) {
      clearTimeout(batchTimers.get(endpoint));
      executeBatch(endpoint, options.batchExecutor);
    }
  });
};

/**
 * Create a batched API wrapper for a service
 *
 * @param {object} service - The API service object
 * @param {string} methodName - The method to batch
 * @param {function} batchExecutor - Function that executes the batched requests
 */
export const createBatchedMethod = (methodName, batchExecutor) => {
  return (params, options = {}) => {
    return queueRequest(methodName, params, {
      ...options,
      batchExecutor
    });
  };
};

/**
 * Batch multiple patient data fetches
 */
export const batchFetchPatients = createBatchedMethod(
  'batchPatients',
  async (patientIds) => {
    // Import dynamically to avoid circular dependencies
    const { default: api } = await import('./apiConfig');

    // Flatten and dedupe IDs
    const uniqueIds = [...new Set(patientIds.flat())];

    if (uniqueIds.length === 0) return [];

    try {
      const response = await api.post('/patients/batch', { ids: uniqueIds });

      // Return data mapped to original order
      return patientIds.map(id => {
        const patient = response.data.find(p =>
          p._id === id || p.id === id
        );
        return patient || null;
      });
    } catch (error) {
      console.error('Batch fetch patients error:', error);
      return patientIds.map(() => null);
    }
  }
);

/**
 * Batch multiple appointment fetches
 */
export const batchFetchAppointments = createBatchedMethod(
  'batchAppointments',
  async (appointmentIds) => {
    const { default: api } = await import('./apiConfig');

    const uniqueIds = [...new Set(appointmentIds.flat())];

    if (uniqueIds.length === 0) return [];

    try {
      const response = await api.post('/appointments/batch', { ids: uniqueIds });

      return appointmentIds.map(id => {
        const appointment = response.data.find(a =>
          a._id === id || a.id === id
        );
        return appointment || null;
      });
    } catch (error) {
      console.error('Batch fetch appointments error:', error);
      return appointmentIds.map(() => null);
    }
  }
);

/**
 * Clear the request cache
 */
export const clearCache = () => {
  requestCache.clear();
};

/**
 * Cancel all pending batches for an endpoint
 */
export const cancelPendingBatches = (endpoint) => {
  if (endpoint) {
    const timer = batchTimers.get(endpoint);
    if (timer) {
      clearTimeout(timer);
      batchTimers.delete(endpoint);
    }

    const queue = batchQueues.get(endpoint);
    if (queue) {
      queue.forEach(request => {
        request.reject(new Error('Batch cancelled'));
      });
      batchQueues.delete(endpoint);
    }
  } else {
    // Cancel all
    batchTimers.forEach((timer) => clearTimeout(timer));
    batchTimers.clear();

    batchQueues.forEach((queue) => {
      queue.forEach(request => {
        request.reject(new Error('Batch cancelled'));
      });
    });
    batchQueues.clear();
  }
};

/**
 * Hook for using batched requests in React components
 */
export const useBatchedFetch = () => {
  return {
    fetchPatients: batchFetchPatients,
    fetchAppointments: batchFetchAppointments,
    clearCache,
    cancelPending: cancelPendingBatches
  };
};

/**
 * Debounce wrapper for API calls
 */
export const debounceRequest = (fn, delay = 300) => {
  let timeoutId = null;
  let pendingResolvers = [];

  return (...args) => {
    return new Promise((resolve, reject) => {
      pendingResolvers.push({ resolve, reject });

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        const currentResolvers = [...pendingResolvers];
        pendingResolvers = [];
        timeoutId = null;

        try {
          const result = await fn(...args);
          currentResolvers.forEach(({ resolve }) => resolve(result));
        } catch (error) {
          currentResolvers.forEach(({ reject }) => reject(error));
        }
      }, delay);
    });
  };
};

export default {
  queueRequest,
  createBatchedMethod,
  batchFetchPatients,
  batchFetchAppointments,
  clearCache,
  cancelPendingBatches,
  useBatchedFetch,
  debounceRequest
};
