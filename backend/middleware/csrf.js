/**
 * CSRF Protection Middleware
 *
 * Implements double-submit cookie pattern for CSRF protection.
 * Works with HttpOnly authentication cookies to provide complete XSS/CSRF protection.
 *
 * Flow:
 * 1. Server sets XSRF-TOKEN cookie (readable by JS - NOT HttpOnly)
 * 2. Frontend reads cookie and sends value in X-XSRF-TOKEN header
 * 3. Server validates header matches cookie
 *
 * This protects against CSRF because:
 * - Attacker can't read cross-origin cookies to get the token
 * - Attacker can't set custom headers on cross-origin requests
 */

const crypto = require('crypto');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('Csrf');

// Routes that should be excluded from CSRF (public endpoints, webhooks, etc.)
const CSRF_EXEMPT_ROUTES = [
  '/api/health',
  '/api/health/ready',
  '/api/health/live',
  '/api/health/startup',
  '/api/webhooks',
  '/api/lis/hl7', // LIS integration uses machine-to-machine auth
  '/api/central', // Central server sync uses API keys
  '/api/sync', // Multi-clinic sync uses API keys
  '/api/auth/login', // Login doesn't have token yet
  '/api/auth/register', // Register doesn't have token yet
  '/api/auth/refresh', // Refresh uses HttpOnly cookie auth
  '/api/auth/forgot-password', // Public endpoint
  '/api/auth/verify-2fa' // 2FA verification during login
];

// Check if route is exempt
function isExempt(path) {
  return CSRF_EXEMPT_ROUTES.some(route => path.startsWith(route));
}

/**
 * Generate a cryptographically secure CSRF token
 */
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF middleware - validates token on state-changing requests
 * Uses double-submit cookie pattern
 */
function csrfProtection(req, res, next) {
  // Skip CSRF for exempt routes
  if (isExempt(req.path)) {
    return next();
  }

  // Skip CSRF for requests with valid API key (machine-to-machine)
  if (req.headers['x-api-key'] && req.headers['x-api-key'] === process.env.INTERNAL_API_KEY) {
    return next();
  }

  // For safe methods (GET, HEAD, OPTIONS), generate token if needed
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    // Generate new token if none exists
    if (!req.cookies || !req.cookies['XSRF-TOKEN']) {
      const token = generateCsrfToken();
      res.cookie('XSRF-TOKEN', token, {
        httpOnly: false, // JS MUST be able to read this
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
    }
    return next();
  }

  // For state-changing methods, validate the token
  const cookieToken = req.cookies && req.cookies['XSRF-TOKEN'];
  const headerToken = req.headers['x-xsrf-token'];

  // Must have both cookie and header
  if (!cookieToken) {
    log.warn(`[CSRF] Missing cookie token for ${req.method} ${req.path} from ${req.ip}`);
    return res.status(403).json({
      success: false,
      error: 'CSRF_MISSING_COOKIE',
      message: 'CSRF protection error. Please refresh the page and try again.'
    });
  }

  if (!headerToken) {
    log.warn(`[CSRF] Missing header token for ${req.method} ${req.path} from ${req.ip}`);
    return res.status(403).json({
      success: false,
      error: 'CSRF_MISSING_HEADER',
      message: 'CSRF protection error. Please refresh the page and try again.'
    });
  }

  // Validate tokens match using timing-safe comparison
  try {
    const cookieBuffer = Buffer.from(cookieToken);
    const headerBuffer = Buffer.from(headerToken);

    if (cookieBuffer.length !== headerBuffer.length ||
        !crypto.timingSafeEqual(cookieBuffer, headerBuffer)) {
      log.warn(`[CSRF] Token mismatch for ${req.method} ${req.path} from ${req.ip}`);
      return res.status(403).json({
        success: false,
        error: 'CSRF_INVALID',
        message: 'Invalid CSRF token. Please refresh the page and try again.'
      });
    }
  } catch (error) {
    log.error('[CSRF] Validation error:', error.message);
    return res.status(403).json({
      success: false,
      error: 'CSRF_ERROR',
      message: 'CSRF validation error. Please refresh the page and try again.'
    });
  }

  // Token is valid, proceed
  next();
}

/**
 * Endpoint to get/refresh CSRF token
 * Call this after login to ensure token is set
 */
function getCsrfToken(req, res) {
  const token = generateCsrfToken();

  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false, // JS MUST be able to read this
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    message: 'CSRF token set in cookie'
  });
}

/**
 * Middleware to set CSRF cookie on authenticated responses
 * Use this after authentication middleware
 */
function setCsrfCookie(req, res, next) {
  // Only set if user is authenticated and no token exists
  if (req.user && (!req.cookies || !req.cookies['XSRF-TOKEN'])) {
    const token = generateCsrfToken();
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });
  }
  next();
}

/**
 * Error handler for CSRF errors
 */
function csrfErrorHandler(err, req, res, next) {
  if (err.code === 'EBADCSRFTOKEN' || err.message?.includes('CSRF')) {
    return res.status(403).json({
      success: false,
      error: 'CSRF_ERROR',
      message: 'Invalid or missing CSRF token. Please refresh the page and try again.'
    });
  }
  next(err);
}

module.exports = {
  csrfProtection,
  getCsrfToken,
  setCsrfCookie,
  csrfErrorHandler,
  CSRF_EXEMPT_ROUTES
};
