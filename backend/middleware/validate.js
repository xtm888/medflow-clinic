const logger = require('../config/logger');

/**
 * Joi Validation Middleware
 *
 * Generic middleware for validating request data using Joi schemas
 *
 * Usage:
 * const { validate } = require('../middleware/validate');
 * const { createPatientSchema } = require('../validators/patientValidator');
 *
 * router.post('/patients', validate(createPatientSchema), patientController.create);
 */

/**
 * Validate request body against Joi schema
 */
function validate(schema, options = {}) {
  const defaultOptions = {
    abortEarly: false, // Return all errors, not just first
    stripUnknown: true, // Remove unknown fields
    ...options
  };

  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, defaultOptions);

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type
      }));

      logger.warn('Validation failed', {
        endpoint: req.originalUrl,
        method: req.method,
        errors,
        userId: req.user?.id
      });

      return res.status(422).json({
        success: false,
        error: 'Validation failed',
        statusCode: 422,
        details: {
          validationErrors: errors
        },
        timestamp: new Date().toISOString()
      });
    }

    // Replace request body with validated and sanitized value
    req.body = value;

    next();
  };
}

/**
 * Validate request params against Joi schema
 */
function validateParams(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(422).json({
        success: false,
        error: 'Invalid parameters',
        statusCode: 422,
        details: { validationErrors: errors }
      });
    }

    req.params = value;
    next();
  };
}

/**
 * Validate request query against Joi schema
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(422).json({
        success: false,
        error: 'Invalid query parameters',
        statusCode: 422,
        details: { validationErrors: errors }
      });
    }

    req.query = value;
    next();
  };
}

module.exports = {
  validate,
  validateParams,
  validateQuery
};
