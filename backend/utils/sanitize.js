/**
 * Utility functions for input sanitization
 * Prevents NoSQL injection and other security vulnerabilities
 */

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
  sanitizeMongoQuery
};
