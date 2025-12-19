/**
 * Error Response Utilities
 *
 * Provides consistent error response formatting across the API.
 * Use these helpers instead of creating error responses manually.
 *
 * @deprecated For new code, prefer importing from '../utils/response.js'
 * which provides a unified interface combining apiResponse, errorResponse,
 * and errorHandler utilities.
 */

const ERROR_MESSAGES = require('../config/errorMessages');

/**
 * Base error response class
 */
class ErrorResponse extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // Distinguish operational errors from programming errors
  }
}

/**
 * Create a standardized error response object
 */
function createErrorResponse(message, statusCode = 500, details = null) {
  return {
    success: false,
    error: message,
    statusCode,
    ...(details && { details }),
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a standardized success response object
 */
function createSuccessResponse(data, message = null, meta = null) {
  return {
    success: true,
    ...(message && { message }),
    ...(data !== undefined && { data }),
    ...(meta && { meta }),
    timestamp: new Date().toISOString()
  };
}

// ==========================================
// 400 BAD REQUEST ERRORS
// ==========================================

/**
 * Validation error (400)
 */
function badRequest(message, details = null) {
  return createErrorResponse(message, 400, details);
}

/**
 * Missing required field (400)
 */
function missingField(fieldName) {
  return createErrorResponse(
    ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD(fieldName),
    400
  );
}

/**
 * Invalid field format (400)
 */
function invalidFormat(fieldName) {
  return createErrorResponse(
    ERROR_MESSAGES.VALIDATION.INVALID_FORMAT(fieldName),
    400
  );
}

/**
 * Invalid field value (400)
 */
function invalidValue(fieldName, details = null) {
  return createErrorResponse(
    ERROR_MESSAGES.VALIDATION.INVALID_VALUE(fieldName),
    400,
    details
  );
}

// ==========================================
// 401 UNAUTHORIZED ERRORS
// ==========================================

/**
 * Authentication required (401)
 */
function unauthorized(message = ERROR_MESSAGES.AUTH.TOKEN_MISSING) {
  return createErrorResponse(message, 401);
}

/**
 * Invalid credentials (401)
 */
function invalidCredentials() {
  return createErrorResponse(ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS, 401);
}

/**
 * Token expired (401)
 */
function tokenExpired() {
  return createErrorResponse(ERROR_MESSAGES.AUTH.SESSION_EXPIRED, 401);
}

// ==========================================
// 403 FORBIDDEN ERRORS
// ==========================================

/**
 * Insufficient permissions (403)
 */
function forbidden(message = ERROR_MESSAGES.AUTH.INSUFFICIENT_PERMISSIONS) {
  return createErrorResponse(message, 403);
}

/**
 * Account disabled (403)
 */
function accountDisabled() {
  return createErrorResponse(ERROR_MESSAGES.AUTH.ACCOUNT_DISABLED, 403);
}

// ==========================================
// 404 NOT FOUND ERRORS
// ==========================================

/**
 * Generic not found (404)
 */
function notFound(resourceType = 'Resource') {
  return createErrorResponse(`${resourceType} not found`, 404);
}

/**
 * Patient not found (404)
 */
function patientNotFound() {
  return createErrorResponse(ERROR_MESSAGES.PATIENT.NOT_FOUND, 404);
}

/**
 * Appointment not found (404)
 */
function appointmentNotFound() {
  return createErrorResponse(ERROR_MESSAGES.APPOINTMENT.NOT_FOUND, 404);
}

/**
 * Visit not found (404)
 */
function visitNotFound() {
  return createErrorResponse(ERROR_MESSAGES.VISIT.NOT_FOUND, 404);
}

/**
 * Prescription not found (404)
 */
function prescriptionNotFound() {
  return createErrorResponse(ERROR_MESSAGES.PRESCRIPTION.NOT_FOUND, 404);
}

/**
 * Invoice not found (404)
 */
function invoiceNotFound() {
  return createErrorResponse(ERROR_MESSAGES.INVOICE.NOT_FOUND, 404);
}

// ==========================================
// 409 CONFLICT ERRORS
// ==========================================

/**
 * Resource conflict (409)
 */
function conflict(message, details = null) {
  return createErrorResponse(message, 409, details);
}

/**
 * Duplicate resource (409)
 */
function duplicateResource(message = 'Resource already exists') {
  return createErrorResponse(message, 409);
}

/**
 * Already exists (409)
 */
function alreadyExists(resourceType) {
  return createErrorResponse(`${resourceType} already exists`, 409);
}

// ==========================================
// 422 UNPROCESSABLE ENTITY ERRORS
// ==========================================

/**
 * Validation failed with multiple errors (422)
 */
function validationFailed(errors) {
  return createErrorResponse(
    'Validation failed',
    422,
    { validationErrors: errors }
  );
}

/**
 * Business rule violation (422)
 */
function businessRuleViolation(message, details = null) {
  return createErrorResponse(message, 422, details);
}

// ==========================================
// 429 TOO MANY REQUESTS
// ==========================================

/**
 * Rate limit exceeded (429)
 */
function rateLimitExceeded() {
  return createErrorResponse(ERROR_MESSAGES.SYSTEM.RATE_LIMIT_EXCEEDED, 429);
}

// ==========================================
// 500 INTERNAL SERVER ERRORS
// ==========================================

/**
 * Internal server error (500)
 */
function internalError(message = ERROR_MESSAGES.SYSTEM.INTERNAL_ERROR, details = null) {
  // Don't expose internal details in production
  const safeDetails = process.env.NODE_ENV === 'production' ? null : details;
  return createErrorResponse(message, 500, safeDetails);
}

/**
 * Database error (500)
 */
function databaseError(details = null) {
  return internalError(ERROR_MESSAGES.SYSTEM.DATABASE_ERROR, details);
}

/**
 * Service unavailable (503)
 */
function serviceUnavailable(message = ERROR_MESSAGES.SYSTEM.SERVICE_UNAVAILABLE) {
  return createErrorResponse(message, 503);
}

// ==========================================
// DOMAIN-SPECIFIC HELPERS
// ==========================================

/**
 * Insufficient stock error
 */
function insufficientStock(medicationName, available, requested) {
  return createErrorResponse(
    ERROR_MESSAGES.PHARMACY.INSUFFICIENT_STOCK,
    422,
    { medication: medicationName, available, requested }
  );
}

/**
 * Expired resource error
 */
function resourceExpired(resourceType) {
  return createErrorResponse(
    `${resourceType} has expired`,
    422
  );
}

/**
 * Already processed error
 */
function alreadyProcessed(resourceType, action) {
  return createErrorResponse(
    `${resourceType} has already been ${action}`,
    422
  );
}

/**
 * Invalid state transition error
 */
function invalidStateTransition(currentState, attemptedState) {
  return createErrorResponse(
    `Cannot transition from ${currentState} to ${attemptedState}`,
    422,
    { currentState, attemptedState }
  );
}

// ==========================================
// EXPRESS MIDDLEWARE HELPER
// ==========================================

/**
 * Send error response via Express
 * Usage: return sendError(res, errorResponse);
 */
function sendError(res, error) {
  const statusCode = error.statusCode || 500;
  const response = typeof error === 'object' && error.error
    ? error
    : createErrorResponse(error.message || error, statusCode);

  return res.status(statusCode).json(response);
}

/**
 * Send success response via Express
 * Usage: return sendSuccess(res, data, 'Created successfully', 201);
 */
function sendSuccess(res, data, message = null, statusCode = 200, meta = null) {
  const response = createSuccessResponse(data, message, meta);
  return res.status(statusCode).json(response);
}

// ==========================================
// ERROR LOGGER
// ==========================================

/**
 * Log error with context
 */
function logError(error, context = {}) {
  const logData = {
    message: error.message || error,
    stack: error.stack,
    statusCode: error.statusCode,
    isOperational: error.isOperational,
    context,
    timestamp: new Date().toISOString()
  };

  if (error.statusCode >= 500 || !error.isOperational) {
    // Log server errors
    console.error('❌ Server Error:', JSON.stringify(logData, null, 2));
  } else {
    // Log client errors at warn level
    console.warn('⚠️  Client Error:', JSON.stringify(logData, null, 2));
  }
}

module.exports = {
  ErrorResponse,
  createErrorResponse,
  createSuccessResponse,

  // Status code helpers
  badRequest,
  missingField,
  invalidFormat,
  invalidValue,
  unauthorized,
  invalidCredentials,
  tokenExpired,
  forbidden,
  accountDisabled,
  notFound,
  patientNotFound,
  appointmentNotFound,
  visitNotFound,
  prescriptionNotFound,
  invoiceNotFound,
  conflict,
  duplicateResource,
  alreadyExists,
  validationFailed,
  businessRuleViolation,
  rateLimitExceeded,
  internalError,
  databaseError,
  serviceUnavailable,

  // Domain-specific
  insufficientStock,
  resourceExpired,
  alreadyProcessed,
  invalidStateTransition,

  // Express helpers
  sendError,
  sendSuccess,

  // Logging
  logError,

  // Direct access to error messages
  ERROR_MESSAGES
};
