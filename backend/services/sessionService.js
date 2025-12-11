/**
 * Session Management Service
 *
 * Provides secure session management using Redis for:
 * - Session creation and validation
 * - Multi-device session tracking
 * - Session invalidation (logout)
 * - Session activity tracking
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sessionStore, isRedisConnected } = require('../config/redis');

// Session configuration
const SESSION_CONFIG = {
  // Session TTL in seconds (24 hours by default)
  defaultTTL: parseInt(process.env.SESSION_TTL) || 24 * 60 * 60,
  // Extended TTL for "remember me" (30 days)
  extendedTTL: 30 * 24 * 60 * 60,
  // Maximum concurrent sessions per user
  maxConcurrentSessions: parseInt(process.env.MAX_SESSIONS) || 5,
  // Session inactivity timeout (2 hours)
  inactivityTimeout: 2 * 60 * 60,
};

/**
 * Generate a secure session ID
 */
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new session for a user
 *
 * @param {Object} user - User document
 * @param {Object} options - Session options
 * @returns {Promise<Object>} - Session data with tokens
 */
async function createSession(user, options = {}) {
  const {
    rememberMe = false,
    deviceInfo = {},
    ipAddress = null,
  } = options;

  const sessionId = generateSessionId();
  const ttl = rememberMe ? SESSION_CONFIG.extendedTTL : SESSION_CONFIG.defaultTTL;

  // Create JWT token
  const token = jwt.sign(
    {
      id: user._id,
      sessionId,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: ttl,
    }
  );

  // Create refresh token
  const refreshToken = jwt.sign(
    {
      id: user._id,
      sessionId,
      type: 'refresh',
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    {
      expiresIn: rememberMe ? SESSION_CONFIG.extendedTTL * 2 : SESSION_CONFIG.defaultTTL * 2,
    }
  );

  // Session data to store
  const sessionData = {
    userId: user._id.toString(),
    sessionId,
    role: user.role,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    rememberMe,
    device: {
      userAgent: deviceInfo.userAgent || null,
      platform: deviceInfo.platform || null,
      browser: deviceInfo.browser || null,
      ip: ipAddress,
    },
  };

  // Store session in Redis
  if (isRedisConnected()) {
    await sessionStore.set(sessionId, sessionData, ttl);

    // Enforce max concurrent sessions
    await enforceMaxSessions(user._id.toString());
  }

  // Also update user's sessions array in DB (fallback/audit)
  if (user.sessions) {
    user.sessions.push({
      sessionId,
      token: token.slice(-10), // Store only last 10 chars for reference
      createdAt: new Date(),
      lastActivity: new Date(),
      device: sessionData.device,
    });

    // Limit stored sessions in DB
    if (user.sessions.length > SESSION_CONFIG.maxConcurrentSessions * 2) {
      user.sessions = user.sessions.slice(-SESSION_CONFIG.maxConcurrentSessions);
    }

    await user.save({ validateBeforeSave: false });
  }

  return {
    token,
    refreshToken,
    sessionId,
    expiresIn: ttl,
    expiresAt: sessionData.expiresAt,
  };
}

/**
 * Validate a session
 *
 * @param {string} sessionId - Session ID to validate
 * @returns {Promise<Object|null>} - Session data if valid, null otherwise
 */
async function validateSession(sessionId) {
  if (!sessionId) return null;

  if (!isRedisConnected()) {
    // Fallback: Trust the JWT (which is validated separately)
    return { valid: true, fallback: true };
  }

  try {
    const session = await sessionStore.get(sessionId);

    if (!session) {
      return null;
    }

    // Check if session has expired
    if (new Date(session.expiresAt) < new Date()) {
      await sessionStore.delete(sessionId);
      return null;
    }

    // Check inactivity timeout (unless rememberMe is set)
    if (!session.rememberMe) {
      const lastActivity = new Date(session.lastActivity);
      const inactiveFor = (Date.now() - lastActivity.getTime()) / 1000;

      if (inactiveFor > SESSION_CONFIG.inactivityTimeout) {
        await sessionStore.delete(sessionId);
        return null;
      }
    }

    return session;
  } catch (error) {
    console.error('Session validation error:', error.message);
    return null;
  }
}

/**
 * Update session activity timestamp
 *
 * @param {string} sessionId - Session ID
 */
async function updateActivity(sessionId) {
  if (!sessionId || !isRedisConnected()) return;

  try {
    const session = await sessionStore.get(sessionId);

    if (session) {
      session.lastActivity = new Date().toISOString();

      // Calculate remaining TTL
      const expiresAt = new Date(session.expiresAt);
      const remainingTTL = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));

      if (remainingTTL > 0) {
        await sessionStore.set(sessionId, session, remainingTTL);
      }
    }
  } catch (error) {
    console.error('Update activity error:', error.message);
  }
}

/**
 * Invalidate a session (logout)
 *
 * @param {string} sessionId - Session ID to invalidate
 * @param {Object} user - User document (optional)
 */
async function invalidateSession(sessionId, user = null) {
  if (!sessionId) return;

  // Remove from Redis
  if (isRedisConnected()) {
    await sessionStore.delete(sessionId);
  }

  // Remove from user's sessions array
  if (user && user.sessions) {
    user.sessions = user.sessions.filter(s => s.sessionId !== sessionId);
    await user.save({ validateBeforeSave: false });
  }
}

/**
 * Invalidate all sessions for a user
 *
 * @param {string} userId - User ID
 * @param {string} exceptSessionId - Optional session to keep (current session)
 */
async function invalidateAllUserSessions(userId, exceptSessionId = null) {
  if (isRedisConnected()) {
    await sessionStore.deleteUserSessions(userId);

    // Re-create the excepted session if provided
    // This is handled by the caller if needed
  }

  // Clear from database
  const User = require('../models/User');
  const user = await User.findById(userId);

  if (user && user.sessions) {
    if (exceptSessionId) {
      user.sessions = user.sessions.filter(s => s.sessionId === exceptSessionId);
    } else {
      user.sessions = [];
    }
    await user.save({ validateBeforeSave: false });
  }
}

/**
 * Enforce maximum concurrent sessions limit
 *
 * @param {string} userId - User ID
 */
async function enforceMaxSessions(userId) {
  const User = require('../models/User');
  const user = await User.findById(userId);

  if (!user || !user.sessions) return;

  // Sort by last activity (newest first)
  user.sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

  // Remove oldest sessions if over limit
  if (user.sessions.length > SESSION_CONFIG.maxConcurrentSessions) {
    const sessionsToRemove = user.sessions.slice(SESSION_CONFIG.maxConcurrentSessions);

    // Remove from Redis
    if (isRedisConnected()) {
      for (const session of sessionsToRemove) {
        await sessionStore.delete(session.sessionId);
      }
    }

    // Remove from user document
    user.sessions = user.sessions.slice(0, SESSION_CONFIG.maxConcurrentSessions);
    await user.save({ validateBeforeSave: false });
  }
}

/**
 * Get all active sessions for a user
 *
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of session data
 */
async function getUserSessions(userId) {
  const User = require('../models/User');
  const user = await User.findById(userId);

  if (!user || !user.sessions) {
    return [];
  }

  const sessions = [];

  for (const dbSession of user.sessions) {
    let sessionData = dbSession.toObject();

    // Enrich with Redis data if available
    if (isRedisConnected()) {
      const redisSession = await sessionStore.get(dbSession.sessionId);
      if (redisSession) {
        sessionData = {
          ...sessionData,
          lastActivity: redisSession.lastActivity,
          expiresAt: redisSession.expiresAt,
          isActive: true,
        };
      } else {
        sessionData.isActive = false;
      }
    } else {
      sessionData.isActive = true; // Assume active if Redis not available
    }

    sessions.push(sessionData);
  }

  return sessions;
}

/**
 * Refresh an existing session
 *
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object|null>} - New tokens or null if invalid
 */
async function refreshSession(refreshToken) {
  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );

    if (decoded.type !== 'refresh') {
      return null;
    }

    // Validate the session still exists
    const session = await validateSession(decoded.sessionId);
    if (!session) {
      return null;
    }

    // Get user
    const User = require('../models/User');
    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.isActive) {
      return null;
    }

    // Generate new access token
    const token = jwt.sign(
      {
        id: user._id,
        sessionId: decoded.sessionId,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: session.rememberMe
          ? SESSION_CONFIG.extendedTTL
          : SESSION_CONFIG.defaultTTL,
      }
    );

    // Update session activity
    await updateActivity(decoded.sessionId);

    return {
      token,
      sessionId: decoded.sessionId,
    };
  } catch (error) {
    console.error('Refresh session error:', error.message);
    return null;
  }
}

/**
 * Middleware to validate and refresh session activity
 */
async function sessionMiddleware(req, res, next) {
  // Extract session ID from JWT if present
  if (req.user && req.user.sessionId) {
    const session = await validateSession(req.user.sessionId);

    if (!session && isRedisConnected()) {
      return res.status(401).json({
        success: false,
        error: 'Session expired or invalid',
        code: 'SESSION_EXPIRED',
      });
    }

    // Update activity (non-blocking)
    updateActivity(req.user.sessionId).catch(err => {
      console.error('Activity update error:', err.message);
    });
  }

  next();
}

/**
 * Invalidate all sessions for users with a specific role
 * Forces users to re-login to get updated permissions
 *
 * @param {string} role - Role name
 * @returns {Promise<Object>} - Result with count of invalidated sessions
 */
async function invalidateSessionsByRole(role) {
  try {
    const User = require('../models/User');

    // Find all users with this role
    const users = await User.find({ role, isActive: true }).select('_id');
    const userIds = users.map(u => u._id);

    // Increment tokenVersion for all users with this role
    // This will invalidate all their existing JWT tokens
    await User.updateMany(
      { _id: { $in: userIds } },
      { $inc: { tokenVersion: 1 } }
    );

    console.log(`✓ Invalidated ${userIds.length} sessions for role: ${role}`);
    return { invalidated: userIds.length };
  } catch (error) {
    console.error('Session invalidation error:', error);
    throw error;
  }
}

module.exports = {
  SESSION_CONFIG,
  generateSessionId,
  createSession,
  validateSession,
  updateActivity,
  invalidateSession,
  invalidateAllUserSessions,
  enforceMaxSessions,
  getUserSessions,
  refreshSession,
  sessionMiddleware,
  invalidateSessionsByRole,
};
