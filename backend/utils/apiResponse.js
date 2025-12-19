/**
 * Standardized API Response Utility
 * Ensures consistent response format across all endpoints
 *
 * @deprecated For new code, prefer importing from '../utils/response.js'
 * which provides a unified interface combining apiResponse, errorResponse,
 * and errorHandler utilities.
 *
 * Standard Response Format:
 * {
 *   success: boolean,
 *   message?: string,
 *   data?: any,
 *   error?: string,
 *   details?: any,
 *   pagination?: { page, limit, total, pages },
 *   meta?: { timestamp, requestId }
 * }
 */

/**
 * Send a successful response
 * @param {Response} res - Express response object
 * @param {Object} options - Response options
 * @param {number} [options.statusCode=200] - HTTP status code
 * @param {string} [options.message] - Success message
 * @param {any} [options.data] - Response data
 * @param {Object} [options.pagination] - Pagination info
 * @param {Object} [options.meta] - Additional metadata
 */
const success = (res, options = {}) => {
  const {
    statusCode = 200,
    message = '',
    data = null,
    pagination = null,
    meta = {}
  } = options;

  const response = {
    success: true,
    ...(message && { message }),
    ...(data !== null && { data }),
    ...(pagination && { pagination }),
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };

  return res.status(statusCode).json(response);
};

/**
 * Send a paginated response
 * Supports multiple calling conventions for backwards compatibility:
 * - paginated(res, { data, page, limit, total }) - new style
 * - paginated(res, data, { page, limit, total }) - common style
 * - paginated(res, data, page, limit, total) - legacy style
 *
 * @param {Response} res - Express response object
 * @param {Object|Array} dataOrOptions - Data array or options object
 * @param {Object|number} optionsOrPage - Options object or page number
 * @param {number} [limitArg] - Limit (for legacy calls)
 * @param {number} [totalArg] - Total (for legacy calls)
 */
const paginated = (res, dataOrOptions, optionsOrPage, limitArg, totalArg) => {
  let data, page, limit, total, message, statusCode, meta;

  // Detect calling convention
  if (Array.isArray(dataOrOptions)) {
    // Called as: paginated(res, data, ...)
    data = dataOrOptions;

    if (typeof optionsOrPage === 'object' && optionsOrPage !== null) {
      // paginated(res, data, { page, limit, total })
      ({ page = 1, limit = 20, total = 0, message = '', statusCode = 200, meta = {} } = optionsOrPage);
    } else {
      // paginated(res, data, page, limit, total) - legacy
      page = optionsOrPage || 1;
      limit = limitArg || 20;
      total = totalArg || 0;
      message = '';
      statusCode = 200;
      meta = {};
    }
  } else if (typeof dataOrOptions === 'object' && dataOrOptions !== null) {
    // Called as: paginated(res, { data, page, limit, total }) - new style
    ({
      data = [],
      page = 1,
      limit = 20,
      total = 0,
      message = '',
      statusCode = 200,
      meta = {}
    } = dataOrOptions);
  } else {
    // Fallback
    data = [];
    page = 1;
    limit = 20;
    total = 0;
    message = '';
    statusCode = 200;
    meta = {};
  }

  return success(res, {
    statusCode,
    message,
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
      hasMore: page * limit < total
    },
    meta
  });
};

/**
 * Send an error response
 * @param {Response} res - Express response object
 * @param {Object} options - Error options
 * @param {number} [options.statusCode=500] - HTTP status code
 * @param {string} [options.error] - Error message
 * @param {any} [options.details] - Error details (for debugging)
 * @param {string} [options.code] - Error code for client handling
 */
const error = (res, options = {}) => {
  const {
    statusCode = 500,
    error: errorMessage = 'An error occurred',
    details = null,
    code = null
  } = options;

  const response = {
    success: false,
    error: errorMessage,
    ...(code && { code }),
    ...(details && process.env.NODE_ENV !== 'production' && { details }),
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  return res.status(statusCode).json(response);
};

/**
 * Send a 400 Bad Request response
 */
const badRequest = (res, message = 'Bad request', details = null) => {
  return error(res, { statusCode: 400, error: message, details, code: 'BAD_REQUEST' });
};

/**
 * Send a 401 Unauthorized response
 */
const unauthorized = (res, message = 'Unauthorized') => {
  return error(res, { statusCode: 401, error: message, code: 'UNAUTHORIZED' });
};

/**
 * Send a 403 Forbidden response
 */
const forbidden = (res, message = 'Forbidden') => {
  return error(res, { statusCode: 403, error: message, code: 'FORBIDDEN' });
};

/**
 * Send a 404 Not Found response
 */
const notFound = (res, resource = 'Resource') => {
  return error(res, { statusCode: 404, error: `${resource} not found`, code: 'NOT_FOUND' });
};

/**
 * Send a 409 Conflict response
 */
const conflict = (res, message = 'Conflict') => {
  return error(res, { statusCode: 409, error: message, code: 'CONFLICT' });
};

/**
 * Send a 422 Validation Error response
 */
const validationError = (res, errors = []) => {
  return error(res, {
    statusCode: 422,
    error: 'Validation failed',
    details: errors,
    code: 'VALIDATION_ERROR'
  });
};

/**
 * Send a 500 Internal Server Error response
 */
const serverError = (res, message = 'Internal server error', details = null) => {
  return error(res, { statusCode: 500, error: message, details, code: 'SERVER_ERROR' });
};

/**
 * Response helper attached to request for convenience
 * Usage: res.api.success({ data: users })
 */
const attachToResponse = (req, res, next) => {
  res.api = {
    success: (options) => success(res, options),
    paginated: (options) => paginated(res, options),
    error: (options) => error(res, options),
    badRequest: (message, details) => badRequest(res, message, details),
    unauthorized: (message) => unauthorized(res, message),
    forbidden: (message) => forbidden(res, message),
    notFound: (resource) => notFound(res, resource),
    conflict: (message) => conflict(res, message),
    validationError: (errors) => validationError(res, errors),
    serverError: (message, details) => serverError(res, message, details)
  };
  next();
};

/**
 * Legacy apiResponse helper for backwards compatibility
 * Signature: apiResponse(success, message, data)
 * Returns a response object (does NOT send - caller uses res.json)
 */
const apiResponse = (isSuccess, message, data = null) => {
  const response = {
    success: isSuccess,
    ...(message && { message }),
    ...(data !== null && { data })
  };
  return response;
};

module.exports = {
  success,
  paginated,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validationError,
  serverError,
  attachToResponse,
  // Legacy helper for backwards compatibility
  apiResponse
};
