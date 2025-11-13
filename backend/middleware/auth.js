const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  let token;

  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
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

    // Update last activity
    req.user.lastActivity = Date.now();
    await req.user.save({ validateBeforeSave: false });

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

// Check specific permissions
exports.checkPermission = (module, action) => {
  return (req, res, next) => {
    if (!req.user.hasPermission(module, action)) {
      return res.status(403).json({
        success: false,
        error: `You don't have permission to ${action} ${module}`
      });
    }
    next();
  };
};

// Rate limiting for authentication routes
exports.authRateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!attempts.has(key)) {
      attempts.set(key, []);
    }

    // Clean old attempts
    const userAttempts = attempts.get(key).filter(timestamp => timestamp > windowStart);
    attempts.set(key, userAttempts);

    if (userAttempts.length >= maxAttempts) {
      return res.status(429).json({
        success: false,
        error: 'Too many authentication attempts. Please try again later.'
      });
    }

    // Add current attempt
    userAttempts.push(now);
    attempts.set(key, userAttempts);

    next();
  };
};

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
        return res.status(403).json({
          success: false,
          error: 'You are not authorized to access this resource'
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

// Session validation
exports.validateSession = async (req, res, next) => {
  if (!req.user) {
    return next();
  }

  // Check if session exists and is valid
  const sessionToken = req.headers.authorization?.split(' ')[1] || req.cookies?.token;

  if (sessionToken) {
    const session = req.user.sessions.find(s => s.token === sessionToken);

    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session'
      });
    }

    // Update last activity
    session.lastActivity = Date.now();
    await req.user.save({ validateBeforeSave: false });
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

// Helper function to verify 2FA code (placeholder)
async function verifyTwoFactorCode(user, code) {
  // Implement your 2FA verification logic here
  // This could use TOTP, SMS, or other methods
  return true; // Placeholder
}