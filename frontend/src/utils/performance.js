/**
 * Performance utilities for optimizing event handlers and reducing re-renders
 */

/**
 * Debounce function - delays execution until after wait ms have elapsed
 * since the last time the debounced function was invoked.
 * @param {Function} fn - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function with .cancel() method
 */
export function debounce(fn, wait = 300) {
  let timeoutId = null;

  const debounced = function(...args) {
    const later = () => {
      timeoutId = null;
      fn.apply(this, args);
    };

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(later, wait);
  };

  debounced.cancel = function() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  debounced.flush = function() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
      fn.apply(this);
    }
  };

  return debounced;
}

/**
 * Throttle function - ensures fn is called at most once per wait ms
 * @param {Function} fn - Function to throttle
 * @param {number} wait - Milliseconds between calls
 * @returns {Function} Throttled function with .cancel() method
 */
export function throttle(fn, wait = 100) {
  let timeoutId = null;
  let lastArgs = null;
  let lastTime = 0;

  const throttled = function(...args) {
    const now = Date.now();
    const remaining = wait - (now - lastTime);

    if (remaining <= 0 || remaining > wait) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastTime = now;
      fn.apply(this, args);
    } else if (!timeoutId) {
      lastArgs = args;
      timeoutId = setTimeout(() => {
        lastTime = Date.now();
        timeoutId = null;
        fn.apply(this, lastArgs);
      }, remaining);
    }
  };

  throttled.cancel = function() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
    lastTime = 0;
  };

  return throttled;
}

/**
 * Shallow equality comparison for objects (useful for useMemo deps)
 * @param {Object} a - First object
 * @param {Object} b - Second object
 * @returns {boolean} True if shallowly equal
 */
export function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }

  return true;
}

/**
 * LRU Cache with maximum size limit
 * Automatically evicts least recently used entries when full
 */
export class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;

    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    // If key exists, delete first to update order
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest (first) entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
    return this;
  }

  has(key) {
    return this.cache.has(key);
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }

  // Get all keys that match a prefix
  keysWithPrefix(prefix) {
    return Array.from(this.cache.keys()).filter(k => k.startsWith(prefix));
  }

  // Delete all entries matching a prefix
  deleteByPrefix(prefix) {
    const keys = this.keysWithPrefix(prefix);
    keys.forEach(k => this.cache.delete(k));
    return keys.length;
  }
}

/**
 * Simple hash function for creating cache keys (faster than JSON.stringify)
 * @param {Object} obj - Object to hash
 * @returns {string} Hash string
 */
export function simpleHash(obj) {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return String(obj);

  const keys = Object.keys(obj).sort();
  const parts = keys.map(k => `${k}:${simpleHash(obj[k])}`);
  return `{${parts.join(',')}}`;
}

/**
 * Batch multiple state updates into a single update
 * Useful for React 17 and below (React 18+ auto-batches)
 * @param {Function} callback - Function containing multiple setState calls
 */
export function batchUpdates(callback) {
  // React 18+ handles this automatically via automatic batching
  // For older versions, use unstable_batchedUpdates from react-dom
  if (typeof window !== 'undefined' && window.ReactDOM?.unstable_batchedUpdates) {
    window.ReactDOM.unstable_batchedUpdates(callback);
  } else {
    callback();
  }
}

/**
 * Create an abort controller that auto-cancels previous requests
 * @returns {Object} Object with getSignal() and abort() methods
 */
export function createAbortManager() {
  let controller = null;

  return {
    getSignal() {
      // Abort previous request
      if (controller) {
        controller.abort();
      }
      controller = new AbortController();
      return controller.signal;
    },
    abort() {
      if (controller) {
        controller.abort();
        controller = null;
      }
    }
  };
}

/**
 * Queue microtask for batching synchronous operations
 * @param {Function} fn - Function to queue
 */
export function queueUpdate(fn) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(fn);
  } else {
    Promise.resolve().then(fn);
  }
}
