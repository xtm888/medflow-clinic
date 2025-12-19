/**
 * Redis-backed Rate Limiting Middleware
 *
 * Provides distributed rate limiting using Redis for:
 * - API endpoints
 * - Authentication attempts
 * - Sensitive operations
 */

const rateLimit = require('express-rate-limit');
const { RedisStore, isRedisConnected } = require('../config/redis');
const CONSTANTS = require('../config/constants');

// Whitelist IPs that skip rate limiting
const whitelistedIPs = (process.env.RATE_LIMIT_WHITELIST || '127.0.0.1,::1,localhost')
  .split(',')
  .map(ip => ip.trim());

/**
 * Check if request should skip rate limiting
 */
const shouldSkip = (req) => {
  const clientIP = req.ip || req.connection.remoteAddress || '';
  return whitelistedIPs.some(ip => clientIP.includes(ip));
};

/**
 * Create a Redis-backed rate limiter
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    message = 'Too many requests from this IP, please try again later.',
    prefix = 'rl:api:',
    skipFailedRequests = false,
    skipSuccessfulRequests = false
  } = options;

  // Create Redis store
  const store = new RedisStore({
    prefix,
    windowMs
  });

  // Initialize store (non-blocking)
  store.init().catch(err => {
    console.warn('Rate limiter Redis store init warning:', err.message);
  });

  return rateLimit({
    windowMs,
    max: process.env.NODE_ENV === 'production' ? max : max * 10,
    message: { success: false, error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkip,
    skipFailedRequests,
    skipSuccessfulRequests,
    store: isRedisConnected() ? store : undefined, // Fall back to memory store
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise use IP
      return req.user?._id?.toString() || req.ip;
    }
  });
}

/**
 * General API rate limiter
 * Uses constants from config/constants.js
 */
const apiLimiter = createRateLimiter({
  windowMs: CONSTANTS.RATE_LIMIT.GENERAL_WINDOW_MS,
  max: CONSTANTS.RATE_LIMIT.GENERAL_MAX_REQUESTS,
  prefix: 'rl:api:',
  message: 'Too many requests from this IP, please try again later.'
});

/**
 * Authentication rate limiter (stricter)
 * Uses constants from config/constants.js
 */
const authLimiter = createRateLimiter({
  windowMs: CONSTANTS.RATE_LIMIT.LOGIN_WINDOW_MS,
  max: CONSTANTS.RATE_LIMIT.LOGIN_MAX_ATTEMPTS,
  prefix: 'rl:auth:',
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  skipSuccessfulRequests: true // Don't count successful logins
});

/**
 * Password reset rate limiter
 * Uses constants from config/constants.js
 */
const passwordResetLimiter = createRateLimiter({
  windowMs: CONSTANTS.RATE_LIMIT.RESET_WINDOW_MS,
  max: CONSTANTS.RATE_LIMIT.RESET_MAX_ATTEMPTS,
  prefix: 'rl:pwreset:',
  message: 'Too many password reset requests. Please try again in an hour.'
});

/**
 * Account creation rate limiter
 * 3 accounts per hour per IP
 */
const registrationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  prefix: 'rl:register:',
  message: 'Too many accounts created from this IP. Please try again later.'
});

/**
 * File upload rate limiter
 * 20 uploads per 15 minutes
 */
const uploadLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  prefix: 'rl:upload:',
  message: 'Too many file uploads. Please try again later.'
});

/**
 * Report generation rate limiter
 * Uses constants from config/constants.js
 */
const reportLimiter = createRateLimiter({
  windowMs: CONSTANTS.RATE_LIMIT.REPORT_WINDOW_MS,
  max: CONSTANTS.RATE_LIMIT.REPORT_MAX_REQUESTS,
  prefix: 'rl:report:',
  message: 'Too many report generation requests. Please try again later.'
});

/**
 * Sensitive operations rate limiter (payments, prescriptions)
 * 30 per 15 minutes
 */
const sensitiveLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  prefix: 'rl:sensitive:',
  message: 'Too many sensitive operations. Please slow down.'
});

/**
 * Search rate limiter (to prevent scraping)
 * Uses constants from config/constants.js
 */
const searchLimiter = createRateLimiter({
  windowMs: CONSTANTS.RATE_LIMIT.SEARCH_WINDOW_MS,
  max: CONSTANTS.RATE_LIMIT.SEARCH_MAX_REQUESTS,
  prefix: 'rl:search:',
  message: 'Too many search requests. Please slow down.'
});

/**
 * WebSocket connection rate limiter
 * 10 connections per minute per IP
 */
const wsConnectionLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  prefix: 'rl:ws:',
  message: 'Too many WebSocket connections. Please try again later.'
});

module.exports = {
  createRateLimiter,
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  registrationLimiter,
  uploadLimiter,
  reportLimiter,
  sensitiveLimiter,
  searchLimiter,
  wsConnectionLimiter
};
