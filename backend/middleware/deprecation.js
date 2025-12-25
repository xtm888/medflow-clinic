/**
 * Deprecation middleware for marking API endpoints as deprecated
 *
 * Adds standard HTTP deprecation headers and logs usage for monitoring.
 * Follows RFC 8594 for deprecation headers.
 *
 * Usage:
 *   router.put('/:id/checkin',
 *     deprecate('Use POST /api/queue with appointmentId instead', '2026-03-01'),
 *     controller.checkIn
 *   );
 */

const { appointment: appointmentLogger } = require('../utils/structuredLogger');

/**
 * Create a deprecation middleware
 * @param {string} message - Message explaining what to use instead
 * @param {string} sunsetDate - Date when endpoint will be removed (YYYY-MM-DD)
 * @param {string} successorUrl - URL of the replacement endpoint
 * @returns {Function} Express middleware
 */
const deprecate = (message, sunsetDate = '2026-03-01', successorUrl = null) => {
  return (req, res, next) => {
    // Set standard deprecation headers (RFC 8594)
    res.set('Deprecation', 'true');

    if (sunsetDate) {
      // Convert to HTTP date format
      const sunset = new Date(sunsetDate);
      res.set('Sunset', sunset.toUTCString());
    }

    if (successorUrl) {
      res.set('Link', `<${successorUrl}>; rel="successor-version"`);
    }

    // Add custom header with deprecation message
    res.set('X-Deprecation-Notice', message);

    // Log deprecation usage for monitoring
    appointmentLogger.warn('Deprecated endpoint accessed', {
      endpoint: req.originalUrl,
      method: req.method,
      message,
      sunsetDate,
      userId: req.user?.id,
      userAgent: req.get('User-Agent'),
      clientIp: req.ip
    });

    next();
  };
};

/**
 * Middleware to completely block deprecated endpoints after sunset date
 * @param {string} sunsetDate - Date when endpoint is removed (YYYY-MM-DD)
 * @param {string} message - Message explaining what to use instead
 */
const sunsetBlock = (sunsetDate, message) => {
  return (req, res, next) => {
    const sunset = new Date(sunsetDate);
    const now = new Date();

    if (now >= sunset) {
      return res.status(410).json({
        success: false,
        error: 'Cet endpoint a été supprimé',
        message,
        removedAt: sunsetDate,
        hint: 'Veuillez utiliser le nouvel endpoint indiqué'
      });
    }

    // Not yet sunset, just deprecate
    return deprecate(message, sunsetDate)(req, res, next);
  };
};

module.exports = {
  deprecate,
  sunsetBlock
};
