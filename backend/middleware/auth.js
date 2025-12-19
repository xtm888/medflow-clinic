const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validateSession, updateActivity } = require('../services/sessionService');
const { isRedisConnected, twoFactorStore } = require('../config/redis');
const { logPermissionDenial } = require('./auditLogger');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  let token;

  // SECURITY: Check cookies first (HttpOnly, XSS-safe), then header as fallback
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // SECURITY: Validate token type - prevent refresh tokens from being used as access tokens
    // This is critical because refresh tokens have a 30-day expiry while access tokens are 15 minutes
    if (decoded.tokenType && decoded.tokenType !== 'access') {
      console.warn(`[SECURITY] Token type mismatch: expected 'access', got '${decoded.tokenType}' for user ${decoded.id}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid token type',
        code: 'INVALID_TOKEN_TYPE'
      });
    }

    // Validate session in Redis (if available and session ID exists)
    if (decoded.sessionId && isRedisConnected()) {
      const session = await validateSession(decoded.sessionId);
      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'Session expired or invalid',
          code: 'SESSION_EXPIRED'
        });
      }
    }

    // Get user from token
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if user is active
    if (!req.user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account has been deactivated'
      });
    }

    // Check if account is locked
    if (req.user.isLocked) {
      return res.status(401).json({
        success: false,
        error: 'Account is locked due to multiple failed login attempts'
      });
    }

    // Store session ID on request for later use
    req.sessionId = decoded.sessionId;

    // Update session activity (non-blocking)
    if (decoded.sessionId) {
      updateActivity(decoded.sessionId).catch(err => log.debug('Promise error suppressed', { error: err?.message }));
    }

    // Update last activity in DB (less frequent)
    const now = Date.now();
    if (!req.user.lastActivity || now - req.user.lastActivity > 60000) {
      req.user.lastActivity = now;
      req.user.save({ validateBeforeSave: false }).catch(err => log.debug('Promise error suppressed', { error: err?.message }));
    }

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }
};

// Optional protect - sets req.user if token is valid, but doesn't fail if no token
exports.optionalProtect = async (req, res, next) => {
  let token;

  // SECURITY: Check cookies first (HttpOnly, XSS-safe), then header as fallback
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    // No token, continue without setting user
    req.user = null;
    return next();
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');

    if (req.user && !req.user.isActive) {
      req.user = null;
    }
  } catch (error) {
    // Invalid token, continue without setting user
    req.user = null;
  }

  next();
};

// Grant access to specific roles (LEGACY - use requirePermission() for new routes)
exports.authorize = (...roles) => {
  // Flatten in case an array is passed: authorize(['admin', 'doctor']) => ['admin', 'doctor']
  const flatRoles = roles.flat();
  return (req, res, next) => {
    if (!flatRoles.includes(req.user.role)) {
      // Log to audit trail (async, non-blocking)
      logPermissionDenial({
        userId: req.user._id,
        userRole: req.user.role,
        requiredRoles: flatRoles,
        denialType: 'role_mismatch',
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }).catch(err => console.error('Audit log error:', err));

      // Return generic response to client (no details)
      return res.status(403).json({
        success: false
      });
    }
    next();
  };
};

/**
 * Permission-based authorization middleware (database-driven)
 * Checks if the user's role has the required permission(s) from the RolePermission collection
 * @param {...string} permissions - One or more required permissions (OR logic - user needs ANY)
 * @returns {Function} Express middleware
 */
exports.requirePermission = (...permissions) => {
  return async (req, res, next) => {
    try {
      const userRole = req.user.role;

      // Admin bypass - admins have all permissions
      if (userRole === 'admin') {
        return next();
      }

      // Fetch role permissions from cache/database
      const RolePermission = require('../models/RolePermission');
      const rolePermissions = await RolePermission.getPermissionsForRoleCached(userRole);

      if (!rolePermissions || !rolePermissions.isActive) {
        // Log to audit trail
        logPermissionDenial({
          userId: req.user._id,
          userRole: userRole,
          requiredPermissions: permissions,
          denialType: 'role_not_configured',
          reason: 'Role not found or inactive',
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }).catch(err => console.error('Audit log error:', err));

        return res.status(403).json({
          success: false,
          message: 'Access denied: Role not configured'
        });
      }

      // Check if user has ANY of the required permissions (OR logic)
      const hasPermission = permissions.some(permission =>
        rolePermissions.permissions.includes(permission)
      );

      if (!hasPermission) {
        // Log to audit trail
        logPermissionDenial({
          userId: req.user._id,
          userRole: userRole,
          requiredPermissions: permissions,
          availablePermissions: rolePermissions.permissions,
          denialType: 'insufficient_permissions',
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }).catch(err => console.error('Audit log error:', err));

        return res.status(403).json({
          success: false,
          message: 'Access denied: Insufficient permissions'
        });
      }

      // User has permission, proceed
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization error'
      });
    }
  };
};

// Check specific permissions
exports.checkPermission = (module, action) => {
  return (req, res, next) => {
    if (!req.user.hasPermission(module, action)) {
      // Log to audit trail (async, non-blocking)
      logPermissionDenial({
        userId: req.user._id,
        userRole: req.user.role,
        requiredPermission: `${action} ${module}`,
        denialType: 'missing_permission',
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }).catch(err => console.error('Audit log error:', err));

      // Return generic response to client (no details)
      return res.status(403).json({
        success: false
      });
    }
    next();
  };
};

// Rate limiting for authentication routes (uses Redis-backed limiter)
// Imported from rateLimiter middleware for distributed rate limiting
const { authLimiter: redisAuthLimiter } = require('./rateLimiter');
exports.authRateLimit = () => redisAuthLimiter;

// Verify email token
exports.verifyEmailToken = async (req, res, next) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'No verification token provided'
    });
  }

  try {
    const hashedToken = require('crypto')
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error verifying email token'
    });
  }
};

// Verify password reset token
exports.verifyResetToken = async (req, res, next) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'No reset token provided'
    });
  }

  try {
    const hashedToken = require('crypto')
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Reset token verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error verifying reset token'
    });
  }
};

// Check if user owns the resource
exports.checkOwnership = (model, paramName = 'id') => {
  return async (req, res, next) => {
    try {
      const Model = require(`../models/${model}`);
      const resource = await Model.findById(req.params[paramName]);

      if (!resource) {
        return res.status(404).json({
          success: false,
          error: `${model} not found`
        });
      }

      // Check if user owns the resource or is an admin
      const ownerId = resource.patient || resource.user || resource.createdBy;
      if (ownerId && ownerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        // Log to audit trail (async, non-blocking)
        logPermissionDenial({
          userId: req.user._id,
          userRole: req.user.role,
          resourceId: req.params[paramName],
          resourceModel: model,
          denialType: 'ownership_check',
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }).catch(err => console.error('Audit log error:', err));

        // Return generic response to client (no details)
        return res.status(403).json({
          success: false
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Error checking resource ownership'
      });
    }
  };
};

// Session validation - uses Redis session store
exports.validateSession = async (req, res, next) => {
  if (!req.user || !req.sessionId) {
    return next();
  }

  // Validate session in Redis
  if (isRedisConnected()) {
    const session = await validateSession(req.sessionId);

    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Session expired or invalid',
        code: 'SESSION_EXPIRED'
      });
    }

    // Update activity (non-blocking)
    updateActivity(req.sessionId).catch(err => log.debug('Promise error suppressed', { error: err?.message }));
  }

  next();
};

// Two-factor authentication check
exports.requireTwoFactor = async (req, res, next) => {
  if (!req.user.twoFactorEnabled) {
    return next();
  }

  const { twoFactorCode } = req.body;

  if (!twoFactorCode) {
    return res.status(400).json({
      success: false,
      error: 'Two-factor authentication code required'
    });
  }

  // Verify two-factor code (implementation depends on your 2FA method)
  // This is a placeholder for actual 2FA verification
  const isValid = await verifyTwoFactorCode(req.user, twoFactorCode);

  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid two-factor authentication code'
    });
  }

  next();
};

// Helper function to verify 2FA code using TOTP
// Uses Redis-backed twoFactorStore for replay attack prevention (survives server restarts)
async function verifyTwoFactorCode(user, code) {
  // If user doesn't have 2FA secret configured, reject
  if (!user.twoFactorSecret) {
    console.error('2FA verification failed: User has 2FA enabled but no secret configured');
    return false;
  }

  // SECURITY: Check if code has already been used (prevent replay attacks)
  // Uses Redis-backed store that survives server restarts
  if (await twoFactorStore.isUsed(user._id.toString(), code)) {
    console.warn(`2FA code reuse attempt detected for user ${user._id}`);
    return false;
  }

  // Use speakeasy for TOTP verification
  const speakeasy = require('speakeasy');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('Auth');

  try {
    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1 // Allow 1 interval tolerance (30 seconds before/after)
    });

    if (!isValid) {
      console.warn(`2FA verification failed for user ${user._id}: Invalid code`);
      return false;
    }

    // SECURITY: Mark code as used for 90 seconds (3 TOTP intervals)
    // This prevents replay attacks within the valid window
    // TTL is 90 seconds = 90 seconds in Redis
    await twoFactorStore.markUsed(user._id.toString(), code, 90);

    return true;
  } catch (error) {
    console.error('2FA verification error:', error.message);
    return false;
  }
}
