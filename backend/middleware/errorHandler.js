const AuditLog = require('../models/AuditLog');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('ErrorHandler');

// Error handler middleware
exports.errorHandler = async (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error to console for dev
  log.error(err);

  // Log error to audit log
  try {
    await AuditLog.create({
      user: req.user ? req.user._id : null,
      action: 'SYSTEM_ERROR',
      resource: req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      responseStatus: err.statusCode || 500,
      metadata: {
        errorMessage: err.message,
        stackTrace: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        errorCode: err.code,
        errorName: err.name
      },
      security: {
        threatLevel: err.isSecurity ? 'high' : 'low',
        suspicious: err.isSuspicious || false
      }
    });
  } catch (logError) {
    log.error('Error logging failed:', { error: logError });
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new ErrorResponse(message, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value entered for ${field}`;
    error = new ErrorResponse(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new ErrorResponse(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new ErrorResponse(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new ErrorResponse(message, 401);
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File size is too large';
    error = new ErrorResponse(message, 400);
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Too many files uploaded';
    error = new ErrorResponse(message, 400);
  }

  // Rate limiting error
  if (err.statusCode === 429) {
    const message = 'Too many requests, please try again later';
    error = new ErrorResponse(message, 429);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// ErrorResponse Class
class ErrorResponse extends Error {
  constructor(message, statusCode, isSecurity = false) {
    super(message);
    this.statusCode = statusCode;
    this.isSecurity = isSecurity;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Async error handler wrapper
exports.asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Not found error handler
exports.notFound = (req, res, next) => {
  const error = new ErrorResponse(`Not found - ${req.originalUrl}`, 404);
  next(error);
};

// MongoDB connection error handler
exports.mongooseErrorHandler = (error) => {
  log.error('MongoDB Error:', { error: error });

  if (error.name === 'MongoNetworkError') {
    log.error('Failed to connect to MongoDB');
    process.exit(1);
  }

  if (error.name === 'MongooseServerSelectionError') {
    log.error('MongoDB server selection error');
    process.exit(1);
  }
};

// Validation error handler
exports.validationErrorHandler = (errors) => {
  const formattedErrors = {};

  errors.forEach(error => {
    if (!formattedErrors[error.param]) {
      formattedErrors[error.param] = [];
    }
    formattedErrors[error.param].push(error.msg);
  });

  return new ErrorResponse('Validation failed', 400);
};

// CORS error handler
exports.corsErrorHandler = (err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'CORS policy violation'
    });
  }
  next(err);
};

// Security error handler
exports.securityErrorHandler = (type, req, res, next) => {
  const securityErrors = {
    'xss': 'Potential XSS attack detected',
    'sql-injection': 'Potential SQL injection detected',
    'path-traversal': 'Path traversal attempt detected',
    'unauthorized': 'Unauthorized access attempt',
    'csrf': 'CSRF token validation failed'
  };

  const message = securityErrors[type] || 'Security violation detected';

  // Log security incident
  AuditLog.logSecurityEvent('SECURITY_ALERT', 'high', {
    type,
    resource: req.originalUrl,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    user: req.user ? req.user._id : null
  });

  const error = new ErrorResponse(message, 403, true);
  next(error);
};

// Custom error types
exports.BadRequestError = class BadRequestError extends ErrorResponse {
  constructor(message = 'Bad Request') {
    super(message, 400);
  }
};

exports.UnauthorizedError = class UnauthorizedError extends ErrorResponse {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
};

exports.ForbiddenError = class ForbiddenError extends ErrorResponse {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
};

exports.NotFoundError = class NotFoundError extends ErrorResponse {
  constructor(message = 'Not Found') {
    super(message, 404);
  }
};

exports.ConflictError = class ConflictError extends ErrorResponse {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
};

exports.ValidationError = class ValidationError extends ErrorResponse {
  constructor(message = 'Validation Failed', errors = {}) {
    super(message, 422);
    this.errors = errors;
  }
};

exports.InternalServerError = class InternalServerError extends ErrorResponse {
  constructor(message = 'Internal Server Error') {
    super(message, 500);
  }
};

module.exports.ErrorResponse = ErrorResponse;
