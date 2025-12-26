/**
 * NoSQL Injection Protection Middleware
 * Sanitizes incoming request body, query, and params to prevent MongoDB injection attacks
 */

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('NoSQLProtection');

/**
 * Dangerous MongoDB operators that should be blocked in user input
 */
const DANGEROUS_OPERATORS = [
  '$gt', '$gte', '$lt', '$lte', '$ne', '$nin', '$in',
  '$and', '$or', '$not', '$nor',
  '$exists', '$type', '$mod', '$regex', '$text', '$where',
  '$all', '$elemMatch', '$size',
  '$bitsAllClear', '$bitsAllSet', '$bitsAnyClear', '$bitsAnySet',
  '$geoIntersects', '$geoWithin', '$near', '$nearSphere',
  '$expr', '$jsonSchema',
  '$comment', '$natural',
  // Aggregation operators that could be dangerous
  '$lookup', '$merge', '$out', '$function'
];

/**
 * Keys that indicate prototype pollution attempts
 */
const PROTOTYPE_POLLUTION_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Recursively sanitize an object
 * @param {any} obj - The object to sanitize
 * @param {string} path - Current path for logging
 * @param {Set} blocked - Set to collect blocked keys
 * @returns {any} - Sanitized object
 */
function sanitizeDeep(obj, path = '', blocked = new Set()) {
  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitives
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item, index) => sanitizeDeep(item, `${path}[${index}]`, blocked));
  }

  // Handle objects
  const sanitized = {};
  for (const key of Object.keys(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    // Block prototype pollution
    if (PROTOTYPE_POLLUTION_KEYS.includes(key)) {
      blocked.add(currentPath);
      continue;
    }

    // Block dangerous MongoDB operators in user input
    if (key.startsWith('$')) {
      blocked.add(currentPath);
      continue;
    }

    // Check if value contains MongoDB operators (nested injection attempt)
    const value = obj[key];
    if (typeof value === 'object' && value !== null) {
      const hasOperator = Object.keys(value).some(k => k.startsWith('$'));
      if (hasOperator) {
        // Only allow certain safe patterns like { $regex: ... } when explicitly intended
        // For now, we'll recursively sanitize and let the inner keys get blocked
        sanitized[key] = sanitizeDeep(value, currentPath, blocked);
        continue;
      }
    }

    // Recursively sanitize nested objects
    sanitized[key] = sanitizeDeep(value, currentPath, blocked);
  }

  return sanitized;
}

/**
 * Check if an object contains any dangerous patterns
 * @param {any} obj - The object to check
 * @returns {Array} - Array of found dangerous patterns
 */
function findDangerousPatterns(obj, path = '', found = []) {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return found;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => findDangerousPatterns(item, `${path}[${index}]`, found));
    return found;
  }

  for (const key of Object.keys(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (PROTOTYPE_POLLUTION_KEYS.includes(key)) {
      found.push({ path: currentPath, type: 'prototype_pollution' });
    }

    if (key.startsWith('$')) {
      found.push({ path: currentPath, type: 'mongodb_operator', operator: key });
    }

    findDangerousPatterns(obj[key], currentPath, found);
  }

  return found;
}

/**
 * NoSQL Injection Protection Middleware
 * Sanitizes req.body, req.query, and req.params
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.logBlocked - Log when patterns are blocked (default: true)
 * @param {boolean} options.strict - Reject request if dangerous patterns found (default: false in dev, true in prod)
 * @param {Array<string>} options.excludePaths - Array of paths to exclude from sanitization
 * @returns {Function} - Express middleware function
 */
function noSqlInjectionProtection(options = {}) {
  const {
    logBlocked = true,
    strict = process.env.NODE_ENV === 'production',
    excludePaths = []
  } = options;

  return (req, res, next) => {
    try {
      // Check if path is excluded
      if (excludePaths.some(path => req.path.startsWith(path))) {
        return next();
      }

      let totalBlocked = 0;

      // Sanitize request body
      if (req.body && typeof req.body === 'object') {
        const blocked = new Set();
        req.body = sanitizeDeep(req.body, 'body', blocked);
        totalBlocked += blocked.size;

        if (blocked.size > 0 && logBlocked) {
          log.warn('Blocked patterns in request body', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            blocked: Array.from(blocked)
          });
        }

        // In strict mode, reject if dangerous patterns found
        if (strict && blocked.size > 0) {
          return res.status(400).json({
            error: 'Invalid request format',
            message: 'Request contains invalid field names'
          });
        }
      }

      // Sanitize query string
      if (req.query && typeof req.query === 'object') {
        const blocked = new Set();
        req.query = sanitizeDeep(req.query, 'query', blocked);
        totalBlocked += blocked.size;

        if (blocked.size > 0 && logBlocked) {
          log.warn('Blocked patterns in query string', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            blocked: Array.from(blocked)
          });
        }

        if (strict && blocked.size > 0) {
          return res.status(400).json({
            error: 'Invalid request format',
            message: 'Query contains invalid field names'
          });
        }
      }

      // Sanitize params (less common attack vector but still possible)
      if (req.params && typeof req.params === 'object') {
        const blocked = new Set();
        const sanitizedParams = sanitizeDeep(req.params, 'params', blocked);
        // Copy sanitized values back to req.params
        Object.keys(req.params).forEach(key => {
          req.params[key] = sanitizedParams[key];
        });
        totalBlocked += blocked.size;

        if (blocked.size > 0 && logBlocked) {
          log.warn('Blocked patterns in params', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            blocked: Array.from(blocked)
          });
        }
      }

      next();
    } catch (error) {
      log.error('Error in NoSQL injection protection middleware', { error: error.message });
      next(error);
    }
  };
}

/**
 * Sanitize a single value for safe use in MongoDB queries
 * Use this for individual values that need sanitization
 * @param {any} value - The value to sanitize
 * @returns {any} - Sanitized value
 */
function sanitizeValue(value) {
  return sanitizeDeep(value);
}

/**
 * Check if a value is safe (no dangerous patterns)
 * @param {any} value - The value to check
 * @returns {boolean} - True if safe
 */
function isSafe(value) {
  const dangers = findDangerousPatterns(value);
  return dangers.length === 0;
}

module.exports = {
  noSqlInjectionProtection,
  sanitizeValue,
  sanitizeDeep,
  findDangerousPatterns,
  isSafe,
  DANGEROUS_OPERATORS,
  PROTOTYPE_POLLUTION_KEYS
};
