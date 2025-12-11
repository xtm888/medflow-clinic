/**
 * Health Endpoint Authentication
 *
 * Protects detailed health endpoints that expose sensitive system info.
 * Basic health (/health) and probes (/health/ready, /health/live) remain public
 * for load balancers and orchestrators, but return minimal info.
 *
 * Detailed endpoints require either:
 * 1. HEALTH_API_KEY in header or query param
 * 2. Valid admin JWT token
 */

const jwt = require('jsonwebtoken');

/**
 * Authenticate access to detailed health endpoints
 */
function healthAuth(req, res, next) {
  // Check for health API key
  const healthKey = req.headers['x-health-key'] || req.query.key;
  const expectedKey = process.env.HEALTH_API_KEY;

  // If HEALTH_API_KEY is configured, validate it
  if (expectedKey) {
    if (healthKey === expectedKey) {
      return next();
    }
  }

  // If no HEALTH_API_KEY configured
  if (!expectedKey) {
    // Only allow in development
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }
    // In production without key, check for admin JWT
  }

  // Check for valid admin JWT as alternative
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'admin') {
        req.user = decoded;
        return next();
      }
    } catch (err) {
      // Invalid token, fall through to error
    }
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: 'Detailed health information requires authentication. ' +
      'Provide X-Health-Key header or admin Bearer token.'
  });
}

/**
 * Rate limit for health endpoints (prevent abuse)
 */
function healthRateLimit(req, res, next) {
  // Basic rate limiting - could be enhanced with Redis
  // For now, just proceed - main rate limiter handles this
  next();
}

module.exports = {
  healthAuth,
  healthRateLimit
};
