/**
 * Unified Response Utilities
 *
 * This is the PRIMARY response utility for the MedFlow API.
 * It consolidates apiResponse.js and errorResponse.js functionality.
 *
 * USAGE:
 * - Import from this file for new code
 * - Existing imports from apiResponse.js and errorResponse.js still work
 *
 * @example
 * // In controllers:
 * const { success, paginated, error, notFound } = require('../utils/response');
 * return success(res, { data: users });
 * return notFound(res, 'Patient');
 *
 * // For error objects (without sending):
 * const { createError, ErrorResponse } = require('../utils/response');
 * throw new ErrorResponse('Not found', 404);
 */

// ==========================================
// RE-EXPORT FROM apiResponse (primary)
// ==========================================
const apiResponse = require('./apiResponse');
const {
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
  attachToResponse
} = apiResponse;

// ==========================================
// RE-EXPORT FROM errorResponse
// ==========================================
const errorResponse = require('./errorResponse');
const {
  ErrorResponse,
  createErrorResponse,
  createSuccessResponse,
  // Domain-specific helpers
  missingField,
  invalidFormat,
  invalidValue,
  invalidCredentials,
  tokenExpired,
  accountDisabled,
  patientNotFound,
  appointmentNotFound,
  visitNotFound,
  prescriptionNotFound,
  invoiceNotFound,
  duplicateResource,
  alreadyExists,
  validationFailed,
  businessRuleViolation,
  rateLimitExceeded,
  internalError,
  databaseError,
  serviceUnavailable,
  insufficientStock,
  resourceExpired,
  alreadyProcessed,
  invalidStateTransition,
  sendError,
  sendSuccess,
  logError,
  ERROR_MESSAGES
} = errorResponse;

// ==========================================
// RE-EXPORT FROM errorHandler
// ==========================================
const errorHandler = require('../middleware/errorHandler');
const {
  asyncHandler,
  errorHandler: expressErrorHandler,
  notFound: notFoundMiddleware,
  mongooseErrorHandler,
  validationErrorHandler,
  corsErrorHandler,
  securityErrorHandler,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  InternalServerError
} = errorHandler;

// ==========================================
// UNIFIED EXPORTS
// ==========================================

module.exports = {
  // === Primary Response Helpers (send immediately) ===
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

  // === Error Object Creators (return objects) ===
  createErrorResponse,
  createSuccessResponse,
  sendError,
  sendSuccess,

  // === Domain-Specific Helpers ===
  missingField,
  invalidFormat,
  invalidValue,
  invalidCredentials,
  tokenExpired,
  accountDisabled,
  patientNotFound,
  appointmentNotFound,
  visitNotFound,
  prescriptionNotFound,
  invoiceNotFound,
  duplicateResource,
  alreadyExists,
  validationFailed,
  businessRuleViolation,
  rateLimitExceeded,
  internalError,
  databaseError,
  serviceUnavailable,
  insufficientStock,
  resourceExpired,
  alreadyProcessed,
  invalidStateTransition,

  // === Error Classes ===
  ErrorResponse,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  InternalServerError,

  // === Middleware ===
  asyncHandler,
  expressErrorHandler,
  notFoundMiddleware,
  mongooseErrorHandler,
  validationErrorHandler,
  corsErrorHandler,
  securityErrorHandler,

  // === Utilities ===
  logError,
  ERROR_MESSAGES
};
