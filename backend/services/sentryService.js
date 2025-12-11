/**
 * Sentry Error Tracking Service
 *
 * Provides centralized error tracking with PHI/PII scrubbing for HIPAA compliance.
 *
 * Setup:
 * 1. npm install @sentry/node @sentry/profiling-node
 * 2. Add SENTRY_DSN to your .env file
 * 3. Import and call initSentry() in server.js
 */

const logger = require('../config/logger');

// PHI/PII fields that must be scrubbed from error reports
const PHI_FIELDS = [
  // Patient identifiers
  'firstName', 'lastName', 'name', 'fullName', 'patientName',
  'nationalId', 'ssn', 'idNumber', 'passportNumber',

  // Contact information
  'phoneNumber', 'phone', 'mobile', 'telephone', 'fax',
  'email', 'emailAddress',
  'address', 'streetAddress', 'city', 'postalCode', 'zipCode', 'country',

  // Dates
  'dateOfBirth', 'dob', 'birthDate',

  // Medical information (PHI)
  'diagnosis', 'diagnoses', 'chiefComplaint', 'medicalHistory',
  'allergies', 'medications', 'prescription', 'prescriptions',
  'findings', 'notes', 'clinicalNotes', 'doctorNotes',
  'results', 'labResults', 'interpretation', 'recommendation',
  'visualAcuity', 'refraction', 'intraocularPressure', 'iop',
  'treatment', 'treatmentPlan', 'surgeryNotes', 'operativeNotes',

  // Security tokens
  'password', 'token', 'accessToken', 'refreshToken', 'apiKey',
  'secret', 'privateKey', 'authorization',

  // Financial
  'cardNumber', 'cvv', 'accountNumber', 'bankAccount',
  'insuranceNumber', 'policyNumber'
];

// Patterns to detect and scrub
const SCRUB_PATTERNS = {
  email: /[^\s@]+@[^\s@]+\.[^\s@]+/g,
  phone: /\+?[\d\s\-()]{8,}/g,
  nationalId: /[A-Z0-9]{8,}/gi,
  creditCard: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g
};

let Sentry = null;
let sentryInitialized = false;

/**
 * Scrub PHI from an object recursively
 * @param {object} obj - Object to scrub
 * @param {number} depth - Current recursion depth
 * @returns {object} - Scrubbed object
 */
function scrubObjectPHI(obj, depth = 0) {
  // Prevent infinite recursion
  if (depth > 10 || !obj || typeof obj !== 'object') return obj;

  const scrubbed = Array.isArray(obj) ? [] : {};

  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase();
    const value = obj[key];

    // Check if this is a PHI field
    const isPHI = PHI_FIELDS.some(field =>
      lowerKey.includes(field.toLowerCase())
    );

    if (isPHI) {
      scrubbed[key] = '[REDACTED]';
    } else if (value === null || value === undefined) {
      scrubbed[key] = value;
    } else if (typeof value === 'object') {
      scrubbed[key] = scrubObjectPHI(value, depth + 1);
    } else if (typeof value === 'string') {
      scrubbed[key] = scrubStringPHI(value);
    } else {
      scrubbed[key] = value;
    }
  }

  return scrubbed;
}

/**
 * Scrub PHI patterns from a string
 * @param {string} str - String to scrub
 * @returns {string} - Scrubbed string
 */
function scrubStringPHI(str) {
  if (!str || typeof str !== 'string') return str;

  let result = str;

  // Scrub email patterns
  if (SCRUB_PATTERNS.email.test(result)) {
    result = result.replace(SCRUB_PATTERNS.email, '[EMAIL REDACTED]');
  }

  // Scrub phone patterns (only if looks like a phone number)
  if (SCRUB_PATTERNS.phone.test(result) && result.match(/\d/g)?.length >= 8) {
    result = result.replace(SCRUB_PATTERNS.phone, '[PHONE REDACTED]');
  }

  // Scrub credit card patterns
  if (SCRUB_PATTERNS.creditCard.test(result)) {
    result = result.replace(SCRUB_PATTERNS.creditCard, '[CARD REDACTED]');
  }

  return result;
}

/**
 * Scrub PHI from Sentry event
 * @param {object} event - Sentry event
 * @returns {object} - Scrubbed event
 */
function scrubEvent(event) {
  // Scrub extra data
  if (event.extra) {
    event.extra = scrubObjectPHI(event.extra);
  }

  // Scrub contexts
  if (event.contexts) {
    event.contexts = scrubObjectPHI(event.contexts);
  }

  // Scrub tags
  if (event.tags) {
    event.tags = scrubObjectPHI(event.tags);
  }

  // Scrub request body if present
  if (event.request?.data) {
    if (typeof event.request.data === 'string') {
      try {
        const parsed = JSON.parse(event.request.data);
        event.request.data = JSON.stringify(scrubObjectPHI(parsed));
      } catch {
        event.request.data = scrubStringPHI(event.request.data);
      }
    } else {
      event.request.data = scrubObjectPHI(event.request.data);
    }
  }

  // Scrub exception messages
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map(exc => {
      if (exc.value) {
        exc.value = scrubStringPHI(exc.value);
      }
      return exc;
    });
  }

  // Keep only non-PHI user info
  if (event.user) {
    event.user = {
      id: event.user.id,
      role: event.user.role,
      clinic: event.user.clinic
    };
  }

  return event;
}

/**
 * Initialize Sentry for backend
 * Call this in server.js before starting the server
 */
async function initSentry() {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.info('Sentry DSN not configured - error tracking disabled');
    return;
  }

  if (sentryInitialized) {
    logger.warn('Sentry already initialized');
    return;
  }

  try {
    // Dynamic import to handle missing package gracefully
    Sentry = require('@sentry/node');

    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_VERSION || '1.0.0',

      // Performance monitoring (10% of transactions)
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

      // PHI Scrubbing - critical for HIPAA compliance
      beforeSend(event, hint) {
        return scrubEvent(event);
      },

      // Also scrub breadcrumbs
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.data) {
          breadcrumb.data = scrubObjectPHI(breadcrumb.data);
        }
        if (breadcrumb.message) {
          breadcrumb.message = scrubStringPHI(breadcrumb.message);
        }
        return breadcrumb;
      },

      // Ignore specific error types
      ignoreErrors: [
        // Network errors
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        // Auth errors (expected behavior)
        'TokenExpiredError',
        'JsonWebTokenError',
        'NotBeforeError',
        // Validation errors (user input)
        'ValidationError',
        'CastError'
      ],

      // Don't send events for these paths
      denyUrls: [
        /\/api\/health/,
        /\/api\/metrics/
      ]
    });

    sentryInitialized = true;
    logger.info('Sentry initialized with PHI scrubbing enabled');
  } catch (err) {
    logger.warn('Failed to initialize Sentry:', err.message);
    logger.info('Install Sentry: npm install @sentry/node');
  }
}

/**
 * Capture an exception with context
 * @param {Error} error - Error to capture
 * @param {object} context - Additional context (will be scrubbed)
 */
function captureException(error, context = {}) {
  logger.error('Exception captured:', error.message);

  if (Sentry && sentryInitialized) {
    Sentry.captureException(error, {
      extra: scrubObjectPHI(context)
    });
  }
}

/**
 * Capture a message
 * @param {string} message - Message to capture
 * @param {string} level - Sentry level (info, warning, error)
 * @param {object} context - Additional context
 */
function captureMessage(message, level = 'info', context = {}) {
  if (Sentry && sentryInitialized) {
    Sentry.captureMessage(scrubStringPHI(message), {
      level,
      extra: scrubObjectPHI(context)
    });
  }
}

/**
 * Set user context for error tracking
 * Only stores non-PHI: id, role, clinic
 * @param {object} user - User object
 */
function setUser(user) {
  if (Sentry && sentryInitialized && user) {
    Sentry.setUser({
      id: user._id || user.id,
      role: user.role,
      clinic: user.clinic
    });
  }
}

/**
 * Clear user context
 */
function clearUser() {
  if (Sentry && sentryInitialized) {
    Sentry.setUser(null);
  }
}

/**
 * Add a breadcrumb for tracking user flow
 * @param {string} category - Category (e.g., 'navigation', 'api', 'user')
 * @param {string} message - Description
 * @param {object} data - Additional data (will be scrubbed)
 */
function addBreadcrumb(category, message, data = {}) {
  if (Sentry && sentryInitialized) {
    Sentry.addBreadcrumb({
      category,
      message: scrubStringPHI(message),
      data: scrubObjectPHI(data),
      level: 'info',
      timestamp: Date.now() / 1000
    });
  }
}

/**
 * Express error handler middleware
 * Add this after all routes: app.use(sentryErrorHandler)
 */
function errorHandler(err, req, res, next) {
  // Capture the error
  captureException(err, {
    url: req.url,
    method: req.method,
    userId: req.user?.id,
    clinicId: req.headers['x-clinic-id']
  });

  // Continue to next error handler
  next(err);
}

/**
 * Express request handler middleware
 * Add this before routes: app.use(sentryRequestHandler)
 */
function requestHandler(req, res, next) {
  if (Sentry && sentryInitialized) {
    // Start a new transaction for this request
    const transaction = Sentry.startTransaction({
      op: 'http.server',
      name: `${req.method} ${req.path}`
    });

    // Attach to request for later use
    req.__sentryTransaction = transaction;

    // Finish transaction when response ends
    res.on('finish', () => {
      transaction.setHttpStatus(res.statusCode);
      transaction.finish();
    });
  }

  next();
}

// Export PHI scrubbing functions for testing
module.exports = {
  initSentry,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  errorHandler,
  requestHandler,

  // Export for testing
  _scrubObjectPHI: scrubObjectPHI,
  _scrubStringPHI: scrubStringPHI,
  _scrubEvent: scrubEvent,
  _PHI_FIELDS: PHI_FIELDS
};
