/**
 * CSRF Protection Middleware
 *
 * Protects against Cross-Site Request Forgery attacks.
 * Uses double-submit cookie pattern with csurf.
 *
 * In production, all state-changing requests require a valid CSRF token.
 * Certain endpoints (health checks, webhooks, machine-to-machine APIs) are exempt.
 */

// Routes that should be excluded from CSRF (public endpoints, webhooks, etc.)
const CSRF_EXEMPT_ROUTES = [
  '/api/health',
  '/api/health/ready',
  '/api/health/live',
  '/api/health/startup',
  '/api/webhooks',
  '/api/lis/hl7', // LIS integration uses machine-to-machine auth
  '/api/central', // Central server sync uses API keys
  '/api/sync' // Multi-clinic sync uses API keys
];

// Check if route is exempt
function isExempt(path) {
  return CSRF_EXEMPT_ROUTES.some(route => path.startsWith(route));
}

/**
 * Simple CSRF protection without external dependency
 * Uses double-submit cookie pattern
 */
function generateCsrfToken() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF middleware - validates token on state-changing requests
 */
function csrfProtection(req, res, next) {
  // Skip CSRF for exempt routes
  if (isExempt(req.path)) {
    return next();
  }

  // Skip CSRF for safe methods (GET, HEAD, OPTIONS)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    // Generate token for later use
    if (!req.cookies || !req.cookies._csrf) {
      const token = generateCsrfToken();
      res.cookie('_csrf', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600000 // 1 hour
      });
      req.csrfToken = () => token;
    } else {
      req.csrfToken = () => req.cookies._csrf;
    }
    return next();
  }

  // Skip CSRF for requests with valid API key (machine-to-machine)
  if (req.headers['x-api-key'] && req.headers['x-api-key'] === process.env.INTERNAL_API_KEY) {
    return next();
  }

  // Validate CSRF token for state-changing requests
  const cookieToken = req.cookies && req.cookies._csrf;
  const headerToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
  const bodyToken = req.body && req.body._csrf;

  const submittedToken = headerToken || bodyToken;

  if (!cookieToken || !submittedToken || cookieToken !== submittedToken) {
    return res.status(403).json({
      success: false,
      error: 'CSRF_ERROR',
      message: 'Invalid or missing CSRF token. Please refresh and try again.'
    });
  }

  // Token is valid, proceed
  req.csrfToken = () => cookieToken;
  next();
}

/**
 * Endpoint to get CSRF token
 */
function getCsrfToken(req, res) {
  const token = req.csrfToken ? req.csrfToken() : generateCsrfToken();

  // Set cookie if not already set
  if (!req.cookies || !req.cookies._csrf) {
    res.cookie('_csrf', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000
    });
  }

  res.json({ csrfToken: token });
}

/**
 * Error handler for CSRF errors
 */
function csrfErrorHandler(err, req, res, next) {
  if (err.code === 'EBADCSRFTOKEN' || err.message?.includes('CSRF')) {
    return res.status(403).json({
      success: false,
      error: 'CSRF_ERROR',
      message: 'Invalid or missing CSRF token. Your session may have expired. Please refresh and try again.'
    });
  }
  next(err);
}

module.exports = {
  csrfProtection,
  getCsrfToken,
  csrfErrorHandler,
  CSRF_EXEMPT_ROUTES
};
