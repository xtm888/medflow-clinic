/**
 * Logger Service
 * Provides centralized logging functionality with environment-aware behavior
 *
 * Production Error Tracking:
 * To enable Sentry error tracking in production:
 * 1. Install: npm install @sentry/react
 * 2. Add VITE_SENTRY_DSN to your .env file
 * 3. Uncomment the Sentry integration code below
 */

const isDevelopment = import.meta.env.MODE === 'development';
const isProduction = import.meta.env.MODE === 'production';

// Sentry configuration placeholder
// const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
let Sentry = null;
let sentryInitialized = false;

class Logger {
  /**
   * Log error messages (always logged, even in production)
   * @param {string} message - Error message
   * @param {any} data - Additional data to log
   */
  error(message, data = null) {
    if (data) {
      console.error(`[ERROR] ${message}`, data);
    } else {
      console.error(`[ERROR] ${message}`);
    }

    // Send to Sentry in production (when configured)
    if (isProduction && Sentry && sentryInitialized) {
      try {
        Sentry.captureException(data instanceof Error ? data : new Error(message), {
          extra: {
            message,
            data: data instanceof Error ? data.message : data,
            timestamp: new Date().toISOString()
          }
        });
      } catch (e) {
        // Silently fail if Sentry is not properly configured
      }
    }
  }

  /**
   * Capture a specific exception with context
   * @param {Error} error - Error object
   * @param {object} context - Additional context
   */
  captureException(error, context = {}) {
    console.error('[ERROR]', error);

    if (isProduction && Sentry && sentryInitialized) {
      try {
        Sentry.captureException(error, {
          extra: {
            ...context,
            timestamp: new Date().toISOString()
          }
        });
      } catch (e) {
        // Silently fail
      }
    }
  }

  /**
   * Set user context for error tracking
   * @param {object} user - User information
   */
  setUser(user) {
    if (isProduction && Sentry && sentryInitialized && user) {
      try {
        Sentry.setUser({
          id: user.id || user._id,
          email: user.email,
          username: user.username || `${user.firstName} ${user.lastName}`,
          role: user.role
        });
      } catch (e) {
        // Silently fail
      }
    }
  }

  /**
   * Clear user context
   */
  clearUser() {
    if (isProduction && Sentry && sentryInitialized) {
      try {
        Sentry.setUser(null);
      } catch (e) {
        // Silently fail
      }
    }
  }

  /**
   * Add breadcrumb for error tracking context
   * @param {string} category - Breadcrumb category
   * @param {string} message - Breadcrumb message
   * @param {object} data - Additional data
   */
  addBreadcrumb(category, message, data = {}) {
    if (isProduction && Sentry && sentryInitialized) {
      try {
        Sentry.addBreadcrumb({
          category,
          message,
          data,
          level: 'info',
          timestamp: Date.now() / 1000
        });
      } catch (e) {
        // Silently fail
      }
    }
  }

  /**
   * Log warning messages (development only)
   * @param {string} message - Warning message
   * @param {any} data - Additional data to log
   */
  warn(message, data = null) {
    if (isDevelopment) {
      if (data) {
        console.warn(`[WARN] ${message}`, data);
      } else {
        console.warn(`[WARN] ${message}`);
      }
    }
  }

  /**
   * Log informational messages (development only)
   * @param {string} message - Info message
   * @param {any} data - Additional data to log
   */
  info(message, data = null) {
    if (isDevelopment) {
      if (data) {
        console.log(`[INFO] ${message}`, data);
      } else {
        console.log(`[INFO] ${message}`);
      }
    }
  }

  /**
   * Log debug messages (development only)
   * @param {string} message - Debug message
   * @param {any} data - Additional data to log
   */
  debug(message, data = null) {
    if (isDevelopment) {
      if (data) {
        console.debug(`[DEBUG] ${message}`, data);
      } else {
        console.debug(`[DEBUG] ${message}`);
      }
    }
  }

  /**
   * Log API calls (development only)
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {any} data - Request data
   */
  api(method, endpoint, data = null) {
    if (isDevelopment) {
      if (data) {
        console.log(`[API] ${method} ${endpoint}`, data);
      } else {
        console.log(`[API] ${method} ${endpoint}`);
      }
    }
  }

  /**
   * Initialize Sentry (call this manually when Sentry is installed)
   * @param {object} SentryModule - The imported Sentry module
   * @param {string} dsn - Sentry DSN
   */
  initSentry(SentryModule, dsn) {
    if (isProduction && dsn && !sentryInitialized) {
      try {
        Sentry = SentryModule;
        Sentry.init({
          dsn,
          environment: import.meta.env.MODE,

          // Performance sampling (10%)
          tracesSampleRate: 0.1,

          // Session replay (disabled for PHI compliance)
          replaysSessionSampleRate: 0,
          replaysOnErrorSampleRate: 0,

          // App version
          release: import.meta.env.VITE_APP_VERSION || '1.0.0',

          // PHI/PII Scrubbing - Remove sensitive medical data from error reports
          beforeSend(event, hint) {
            return scrubPHI(event);
          },

          // Also scrub breadcrumbs
          beforeBreadcrumb(breadcrumb) {
            if (breadcrumb.data) {
              breadcrumb.data = scrubObjectPHI(breadcrumb.data);
            }
            return breadcrumb;
          },

          // Ignore specific error types
          ignoreErrors: [
            // Browser extensions
            /^chrome-extension:\/\//,
            /^moz-extension:\/\//,
            // Network errors (already handled by offline system)
            'Network Error',
            'Failed to fetch',
            'Load failed',
            // Authentication errors (not actionable)
            'Token expired',
            'Invalid token'
          ],

          // Deny URLs
          denyUrls: [
            /localhost/,
            /127\.0\.0\.1/,
            /extensions\//i,
            /^chrome:\/\//i
          ]
        });
        sentryInitialized = true;
        console.log('[Logger] Sentry initialized with PHI scrubbing');
      } catch (err) {
        console.warn('[Logger] Failed to initialize Sentry:', err.message);
      }
    }
  }
}

// PHI/PII fields that must be scrubbed from error reports
const PHI_FIELDS = [
  'firstName', 'lastName', 'name', 'fullName',
  'nationalId', 'ssn', 'idNumber',
  'phoneNumber', 'phone', 'mobile', 'telephone',
  'email', 'emailAddress',
  'address', 'streetAddress', 'city', 'postalCode', 'zipCode',
  'dateOfBirth', 'dob', 'birthDate',
  'diagnosis', 'chiefComplaint', 'medicalHistory',
  'allergies', 'medications', 'prescription',
  'findings', 'notes', 'clinicalNotes',
  'results', 'labResults', 'interpretation',
  'visualAcuity', 'refraction', 'intraocularPressure',
  'password', 'token', 'accessToken', 'refreshToken',
  'cardNumber', 'cvv', 'accountNumber'
];

/**
 * Scrub PHI from an object recursively
 * @param {object} obj - Object to scrub
 * @returns {object} - Scrubbed object
 */
function scrubObjectPHI(obj) {
  if (!obj || typeof obj !== 'object') return obj;

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
    } else if (typeof value === 'object' && value !== null) {
      scrubbed[key] = scrubObjectPHI(value);
    } else if (typeof value === 'string') {
      // Scrub potential email patterns
      if (value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        scrubbed[key] = '[EMAIL REDACTED]';
      }
      // Scrub potential phone patterns
      else if (value.match(/^\+?[\d\s\-()]{8,}$/)) {
        scrubbed[key] = '[PHONE REDACTED]';
      }
      // Scrub potential national ID patterns
      else if (value.match(/^[A-Z0-9]{8,}$/i)) {
        scrubbed[key] = '[ID REDACTED]';
      }
      else {
        scrubbed[key] = value;
      }
    } else {
      scrubbed[key] = value;
    }
  }

  return scrubbed;
}

/**
 * Scrub PHI from Sentry event
 * @param {object} event - Sentry event
 * @returns {object} - Scrubbed event
 */
function scrubPHI(event) {
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

  // Scrub exception message if it contains PHI patterns
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map(exc => {
      if (exc.value) {
        // Redact email patterns in error messages
        exc.value = exc.value.replace(
          /[^\s@]+@[^\s@]+\.[^\s@]+/g,
          '[EMAIL REDACTED]'
        );
        // Redact phone patterns
        exc.value = exc.value.replace(
          /\+?[\d\s\-()]{8,}/g,
          '[PHONE REDACTED]'
        );
      }
      return exc;
    });
  }

  // Remove user PII (keep only ID and role)
  if (event.user) {
    event.user = {
      id: event.user.id,
      role: event.user.role
    };
  }

  return event;
}

// Export singleton instance
const logger = new Logger();
export default logger;
