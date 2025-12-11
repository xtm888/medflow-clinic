/**
 * Utility functions for input sanitization
 * Prevents NoSQL injection, prototype pollution, and other security vulnerabilities
 */

/**
 * Dangerous keys that can cause prototype pollution
 */
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Sanitize an object to prevent prototype pollution
 * Removes dangerous keys like __proto__, constructor, prototype
 * @param {any} obj - The object to sanitize
 * @returns {any} - Sanitized object safe for Object.assign
 */
function sanitizeForAssign(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForAssign);
  }

  const sanitized = {};
  for (const key of Object.keys(obj)) {
    // Skip dangerous prototype pollution keys
    if (DANGEROUS_KEYS.includes(key)) {
      continue;
    }
    // Recursively sanitize nested objects
    sanitized[key] = sanitizeForAssign(obj[key]);
  }
  return sanitized;
}

/**
 * Safe Object.assign that prevents prototype pollution
 * @param {object} target - Target object
 * @param {...object} sources - Source objects (will be sanitized)
 * @returns {object} - The target object with sanitized properties assigned
 */
function safeAssign(target, ...sources) {
  const sanitizedSources = sources.map(sanitizeForAssign);
  return Object.assign(target, ...sanitizedSources);
}

/**
 * Escape special regex characters in a string
 * Prevents NoSQL injection through regex patterns
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string safe for use in regex
 */
function escapeRegex(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a safe regex pattern from user input
 * @param {string} str - The user input string
 * @param {string} flags - Optional regex flags (default: 'i' for case-insensitive)
 * @returns {RegExp} - Safe RegExp object
 */
function safeRegex(str, flags = 'i') {
  return new RegExp(escapeRegex(str), flags);
}

/**
 * Create a safe search regex with additional validation
 * @param {string} query - The user input query
 * @param {object} options - Configuration options
 * @param {number} options.maxLength - Maximum query length (default: 50)
 * @param {number} options.minLength - Minimum query length (default: 1)
 * @param {boolean} options.anchorStart - Anchor pattern to start of string (default: false)
 * @param {boolean} options.caseInsensitive - Case insensitive matching (default: true)
 * @returns {RegExp|null} - Safe RegExp object or null if invalid
 */
function createSafeSearchRegex(query, options = {}) {
  const { maxLength = 50, minLength = 1, anchorStart = false, caseInsensitive = true } = options;
  if (!query || typeof query !== 'string') return null;
  const trimmed = query.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) return null;
  const escaped = escapeRegex(trimmed);
  const pattern = anchorStart ? `^${escaped}` : escaped;
  return new RegExp(pattern, caseInsensitive ? 'i' : '');
}

/**
 * Validate if a string is a valid MongoDB ObjectId
 * @param {any} id - The value to validate
 * @returns {boolean} - True if valid ObjectId
 */
function isValidObjectId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[a-fA-F0-9]{24}$/.test(id);
}

/**
 * Sanitize a number with validation
 * @param {any} value - The value to sanitize
 * @param {object} options - Configuration options
 * @param {number} options.min - Minimum allowed value (default: -Infinity)
 * @param {number} options.max - Maximum allowed value (default: Infinity)
 * @param {boolean} options.allowNegative - Allow negative numbers (default: false)
 * @param {any} options.defaultValue - Default value if invalid (default: null)
 * @returns {number|null} - Sanitized number or default value
 */
function sanitizeNumber(value, options = {}) {
  const { min = -Infinity, max = Infinity, allowNegative = false, defaultValue = null } = options;
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) return defaultValue;
  if (!allowNegative && num < 0) return defaultValue;
  if (num < min || num > max) return defaultValue;
  return num;
}

/**
 * Sanitize a price value
 * @param {any} value - The value to sanitize
 * @param {object} options - Configuration options
 * @param {number} options.maxPrice - Maximum allowed price (default: 100000000)
 * @param {boolean} options.allowZero - Allow zero values (default: false)
 * @returns {number|null} - Sanitized price rounded to 2 decimals or null
 */
function sanitizePrice(value, options = {}) {
  const { maxPrice = 100000000, allowZero = false } = options;
  const price = sanitizeNumber(value, { min: allowZero ? 0 : 0.01, max: maxPrice });
  if (price === null) return null;
  return Math.round(price * 100) / 100;
}

/**
 * Sanitize MongoDB query object to prevent injection
 * Removes dangerous operators from user input
 * @param {any} obj - The object to sanitize
 * @returns {any} - Sanitized object
 */
function sanitizeMongoQuery(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeMongoQuery);
  }

  const sanitized = {};
  for (const key in obj) {
    // Block dangerous MongoDB operators in user input
    if (key.startsWith('$')) {
      continue; // Skip MongoDB operators
    }
    sanitized[key] = sanitizeMongoQuery(obj[key]);
  }
  return sanitized;
}

module.exports = {
  escapeRegex,
  safeRegex,
  createSafeSearchRegex,
  isValidObjectId,
  sanitizeNumber,
  sanitizePrice,
  sanitizeMongoQuery,
  sanitizeForAssign,
  safeAssign
};
