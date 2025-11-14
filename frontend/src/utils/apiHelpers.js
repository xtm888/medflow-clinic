/**
 * API Response Normalization Utilities
 *
 * These utilities help handle different API response structures
 * and prevent React Error #31 (rendering objects as children)
 */

/**
 * Normalize API response to extract data
 * Handles multiple response structure patterns:
 * - { data: [...] }
 * - { data: { data: [...], stats: {...} } }
 * - { success: true, data: [...] }
 * - Direct array [...]
 *
 * @param {*} response - The API response object
 * @returns {*} The normalized data
 */
export const normalizeResponse = (response) => {
  // Handle null/undefined
  if (!response) return null;

  // If response has a nested data.data structure
  if (response.data?.data !== undefined) {
    return response.data.data;
  }

  // If response.data exists and is the actual data
  if (response.data !== undefined) {
    return response.data;
  }

  // If it's already the data (direct array or object)
  return response;
};

/**
 * Ensure response is an array
 * Converts various response types to array or returns empty array
 *
 * @param {*} response - The API response
 * @returns {Array} Normalized array
 */
export const normalizeToArray = (response) => {
  const data = normalizeResponse(response);

  if (Array.isArray(data)) {
    return data;
  }

  if (data === null || data === undefined) {
    return [];
  }

  // If it's a single object, wrap in array
  if (typeof data === 'object') {
    return [data];
  }

  return [];
};

/**
 * Safe number formatter
 * Ensures value is a number before formatting
 *
 * @param {*} value - Value to format
 * @param {number} decimals - Number of decimal places
 * @param {string} fallback - Fallback value if not a number
 * @returns {string} Formatted number or fallback
 */
export const safeFormatNumber = (value, decimals = 2, fallback = '0.00') => {
  if (typeof value === 'number' && !isNaN(value)) {
    return value.toFixed(decimals);
  }

  // Try to extract number from object
  if (value && typeof value === 'object') {
    if (typeof value.amount === 'number') {
      return value.amount.toFixed(decimals);
    }
    if (typeof value.value === 'number') {
      return value.value.toFixed(decimals);
    }
  }

  return fallback;
};

/**
 * Safe string extraction
 * Handles both strings and objects with name/title properties
 *
 * @param {*} value - Value to extract string from
 * @param {string} fallback - Fallback value
 * @returns {string} Extracted string or fallback
 */
export const safeString = (value, fallback = '') => {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object') {
    return value.name || value.title || value.label || fallback;
  }

  return fallback;
};

/**
 * Validate and extract object properties safely
 * Prevents rendering objects as React children
 *
 * @param {*} obj - Object to validate
 * @param {string} property - Property to extract
 * @param {*} fallback - Fallback value
 * @returns {*} Property value or fallback
 */
export const safeProp = (obj, property, fallback = null) => {
  if (!obj || typeof obj !== 'object') {
    return fallback;
  }

  const value = obj[property];

  // If value is an object, try to extract meaningful data
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    // Try common property names
    return value.name || value.value || value.label || fallback;
  }

  return value !== undefined ? value : fallback;
};

/**
 * Type guard for arrays
 *
 * @param {*} value - Value to check
 * @returns {boolean} True if value is array
 */
export const isArray = (value) => {
  return Array.isArray(value);
};

/**
 * Type guard for objects (excluding arrays and null)
 *
 * @param {*} value - Value to check
 * @returns {boolean} True if value is plain object
 */
export const isPlainObject = (value) => {
  return value !== null &&
         typeof value === 'object' &&
         !Array.isArray(value);
};

/**
 * Extract stats from API response
 * Handles both direct stats object and nested structures
 *
 * @param {*} response - API response
 * @returns {Object} Stats object with safe defaults
 */
export const extractStats = (response) => {
  const data = normalizeResponse(response);

  // If data has stats property
  if (data && data.stats) {
    return data.stats;
  }

  // If data itself is the stats object
  if (isPlainObject(data)) {
    return data;
  }

  // Return safe defaults
  return {
    total: 0,
    count: 0,
    average: 0
  };
};

/**
 * Format currency safely
 *
 * @param {*} value - Value to format
 * @param {string} currency - Currency symbol
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value, currency = '$') => {
  const formatted = safeFormatNumber(value, 2, '0.00');
  return `${currency}${formatted}`;
};

/**
 * Validate response before setting state
 * Returns validated data or throws descriptive error
 *
 * @param {*} response - API response
 * @param {string} expectedType - Expected type ('array' or 'object')
 * @returns {*} Validated data
 * @throws {Error} If validation fails
 */
export const validateResponse = (response, expectedType = 'array') => {
  const data = normalizeResponse(response);

  if (expectedType === 'array') {
    if (!Array.isArray(data)) {
      console.error('Expected array but got:', data);
      throw new Error(`Invalid response format: expected array, got ${typeof data}`);
    }
  }

  if (expectedType === 'object') {
    if (!isPlainObject(data)) {
      console.error('Expected object but got:', data);
      throw new Error(`Invalid response format: expected object, got ${typeof data}`);
    }
  }

  return data;
};

/**
 * Safe ID extraction
 * Handles both _id (MongoDB) and id (SQL) patterns
 *
 * @param {*} item - Item to extract ID from
 * @returns {string|number|null} ID or null
 */
export const safeId = (item) => {
  if (!item) return null;
  return item._id || item.id || null;
};
