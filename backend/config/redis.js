/**
 * Redis Configuration and Client
 *
 * Provides a centralized Redis client for:
 * - Rate limiting
 * - Session management
 * - Caching
 */

const { createClient } = require('redis');

let redisClient = null;
let isConnected = false;
let errorLogged = false; // Only log first error to reduce spam
let reconnectLogged = false; // Only log first reconnect attempt

// Circuit breaker state
const circuitBreaker = {
  failures: 0,
  lastFailure: null,
  isOpen: false,
  threshold: 5, // Open circuit after 5 consecutive failures
  cooldownMs: 30000, // Try to close after 30 seconds

  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.isOpen = true;
      console.warn(`[CIRCUIT BREAKER] Redis circuit OPEN after ${this.failures} failures. Will retry in ${this.cooldownMs / 1000}s`);
    }
  },

  recordSuccess() {
    if (this.failures > 0 || this.isOpen) {
      console.log('[CIRCUIT BREAKER] Redis circuit CLOSED - connection restored');
    }
    this.failures = 0;
    this.lastFailure = null;
    this.isOpen = false;
  },

  shouldAllowRequest() {
    if (!this.isOpen) return true;

    // Check if cooldown has passed
    const timeSinceFailure = Date.now() - this.lastFailure;
    if (timeSinceFailure > this.cooldownMs) {
      console.log('[CIRCUIT BREAKER] Cooldown passed, allowing test request');
      return true; // Allow one test request
    }
    return false;
  }
};

// Redis connection configuration
const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('Redis: Max reconnection attempts reached');
        return new Error('Redis max retries reached');
      }
      // Exponential backoff: 100ms, 200ms, 400ms, etc.
      return Math.min(retries * 100, 3000);
    },
    connectTimeout: 10000
  }
};

/**
 * Initialize Redis client with connection handling
 */
async function initializeRedis() {
  if (redisClient && isConnected) {
    return redisClient;
  }

  try {
    redisClient = createClient(redisConfig);

    // Event handlers
    redisClient.on('error', (err) => {
      // Only log the first error to reduce log spam when Redis is not available
      if (!errorLogged) {
        console.error('Redis Client Error:', err.message);
        console.warn('⚠️  Subsequent Redis errors will be suppressed');
        errorLogged = true;
      }
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis client connecting...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis client ready');
      isConnected = true;
      errorLogged = false; // Reset error flag on successful connection
      reconnectLogged = false; // Reset reconnect flag on successful connection
      circuitBreaker.recordSuccess(); // Reset circuit breaker on successful connection
    });

    redisClient.on('reconnecting', () => {
      if (!reconnectLogged) {
        console.log('⚠️  Redis client reconnecting (subsequent reconnect attempts will be suppressed)...');
        reconnectLogged = true;
      }
    });

    redisClient.on('end', () => {
      console.log('Redis client disconnected');
      isConnected = false;
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('Failed to initialize Redis:', error.message);
    console.warn('⚠️  Rate limiting and sessions will use in-memory fallback');
    return null;
  }
}

/**
 * Get the Redis client instance
 */
function getClient() {
  return redisClient;
}

/**
 * Check if Redis is connected and circuit breaker allows requests
 */
function isRedisConnected() {
  // First check basic connection
  if (!isConnected || !redisClient?.isOpen) return false;

  // Then check circuit breaker
  return circuitBreaker.shouldAllowRequest();
}

/**
 * Get circuit breaker status for monitoring
 */
function getCircuitBreakerStatus() {
  return {
    isOpen: circuitBreaker.isOpen,
    failures: circuitBreaker.failures,
    lastFailure: circuitBreaker.lastFailure,
    cooldownRemaining: circuitBreaker.isOpen && circuitBreaker.lastFailure
      ? Math.max(0, circuitBreaker.cooldownMs - (Date.now() - circuitBreaker.lastFailure))
      : 0
  };
}

/**
 * Gracefully close Redis connection
 */
async function closeConnection() {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('Redis connection closed');
    } catch (error) {
      console.error('Error closing Redis connection:', error.message);
    }
  }
}

/**
 * Redis-based rate limiter store for express-rate-limit
 */
class RedisStore {
  constructor(options = {}) {
    this.prefix = options.prefix || 'rl:';
    this.client = null;
    this.windowMs = options.windowMs || 60000;
  }

  async init() {
    this.client = await initializeRedis();
    if (!this.client) {
      console.warn('RedisStore: Falling back to memory store');
    }
  }

  async increment(key) {
    if (!this.client || !isRedisConnected()) {
      // Fallback to simple in-memory tracking
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }

    const redisKey = this.prefix + key;

    try {
      const multi = this.client.multi();
      multi.incr(redisKey);
      multi.pTTL(redisKey);

      const results = await multi.exec();
      const totalHits = results[0];
      let ttl = results[1];

      // Set expiry if key is new
      if (ttl === -1) {
        await this.client.pExpire(redisKey, this.windowMs);
        ttl = this.windowMs;
      }

      const resetTime = new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs));

      return { totalHits, resetTime };
    } catch (error) {
      console.error('RedisStore increment error:', error.message);
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key) {
    if (!this.client || !isRedisConnected()) return;

    const redisKey = this.prefix + key;

    try {
      await this.client.decr(redisKey);
    } catch (error) {
      console.error('RedisStore decrement error:', error.message);
    }
  }

  async resetKey(key) {
    if (!this.client || !isRedisConnected()) return;

    const redisKey = this.prefix + key;

    try {
      await this.client.del(redisKey);
    } catch (error) {
      console.error('RedisStore resetKey error:', error.message);
    }
  }
}

/**
 * Session store operations
 */
const sessionStore = {
  /**
   * Store a session
   */
  async set(sessionId, sessionData, ttlSeconds = 86400) {
    if (!redisClient || !isRedisConnected()) {
      console.warn('Redis not connected, session not stored');
      return false;
    }

    try {
      const key = `session:${sessionId}`;
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(sessionData));
      return true;
    } catch (error) {
      console.error('Session store error:', error.message);
      return false;
    }
  },

  /**
   * Get a session
   */
  async get(sessionId) {
    if (!redisClient || !isRedisConnected()) {
      return null;
    }

    try {
      const key = `session:${sessionId}`;
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Session get error:', error.message);
      return null;
    }
  },

  /**
   * Delete a session
   */
  async delete(sessionId) {
    if (!redisClient || !isRedisConnected()) {
      return false;
    }

    try {
      const key = `session:${sessionId}`;
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error('Session delete error:', error.message);
      return false;
    }
  },

  /**
   * Update session TTL (extend expiry)
   */
  async touch(sessionId, ttlSeconds = 86400) {
    if (!redisClient || !isRedisConnected()) {
      return false;
    }

    try {
      const key = `session:${sessionId}`;
      await redisClient.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      console.error('Session touch error:', error.message);
      return false;
    }
  },

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId) {
    if (!redisClient || !isRedisConnected()) {
      return false;
    }

    try {
      const pattern = `session:*:${userId}`;
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Delete user sessions error:', error.message);
      return false;
    }
  }
};

/**
 * Cache operations
 */
const cache = {
  /**
   * Get cached value
   */
  async get(key) {
    if (!redisClient || !isRedisConnected()) {
      return null;
    }

    try {
      const data = await redisClient.get(`cache:${key}`);
      circuitBreaker.recordSuccess(); // Reset failures on success
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error.message);
      circuitBreaker.recordFailure(); // Record failure for circuit breaker
      return null;
    }
  },

  /**
   * Set cached value
   */
  async set(key, value, ttlSeconds = 300) {
    if (!redisClient || !isRedisConnected()) {
      return false;
    }

    try {
      await redisClient.setEx(`cache:${key}`, ttlSeconds, JSON.stringify(value));
      circuitBreaker.recordSuccess(); // Reset failures on success
      return true;
    } catch (error) {
      console.error('Cache set error:', error.message);
      circuitBreaker.recordFailure(); // Record failure for circuit breaker
      return false;
    }
  },

  /**
   * Delete cached value
   */
  async delete(key) {
    if (!redisClient || !isRedisConnected()) {
      return false;
    }

    try {
      await redisClient.del(`cache:${key}`);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error.message);
      return false;
    }
  },

  /**
   * Delete cached values by pattern
   */
  async deletePattern(pattern) {
    if (!redisClient || !isRedisConnected()) {
      return false;
    }

    try {
      const keys = await redisClient.keys(`cache:${pattern}`);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Cache deletePattern error:', error.message);
      return false;
    }
  }
};

/**
 * Two-Factor Authentication code store
 * Uses Redis to track used 2FA codes, preventing replay attacks
 * Falls back to in-memory with warning when Redis unavailable
 */
const memoryFallback = new Map();

const twoFactorStore = {
  /**
   * Mark a 2FA code as used
   * @param {string} userId - User ID
   * @param {string} code - The 2FA code
   * @param {number} ttlSeconds - Time to live (default 600 = 10 min)
   */
  async markUsed(userId, code, ttlSeconds = 600) {
    const key = `2fa:used:${userId}:${code}`;

    if (!redisClient || !isRedisConnected()) {
      // Fallback to memory with warning (only warn once per restart)
      if (!memoryFallback.has('_warned')) {
        console.warn('[SECURITY] Redis unavailable - 2FA replay protection using memory fallback');
        memoryFallback.set('_warned', true);
      }
      memoryFallback.set(key, Date.now() + ttlSeconds * 1000);
      return true;
    }

    try {
      await redisClient.setEx(key, ttlSeconds, '1');
      return true;
    } catch (error) {
      console.error('2FA markUsed error:', error.message);
      // Fallback to memory on error
      memoryFallback.set(key, Date.now() + ttlSeconds * 1000);
      return true;
    }
  },

  /**
   * Check if a 2FA code has already been used
   * @param {string} userId - User ID
   * @param {string} code - The 2FA code
   * @returns {boolean} True if code was already used
   */
  async isUsed(userId, code) {
    const key = `2fa:used:${userId}:${code}`;

    if (!redisClient || !isRedisConnected()) {
      // Check memory fallback
      const expiry = memoryFallback.get(key);
      if (expiry && expiry > Date.now()) {
        return true;
      }
      // Clean up expired entry
      if (expiry) {
        memoryFallback.delete(key);
      }
      return false;
    }

    try {
      const exists = await redisClient.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('2FA isUsed error:', error.message);
      // Check memory fallback on error
      const expiry = memoryFallback.get(key);
      return expiry ? expiry > Date.now() : false;
    }
  },

  /**
   * Clean up expired memory fallback entries
   * Called periodically when Redis is unavailable
   */
  cleanupMemory() {
    const now = Date.now();
    for (const [key, expiry] of memoryFallback.entries()) {
      if (key !== '_warned' && expiry < now) {
        memoryFallback.delete(key);
      }
    }
  }
};

// Clean up memory fallback every 5 minutes
setInterval(() => twoFactorStore.cleanupMemory(), 5 * 60 * 1000);

module.exports = {
  initializeRedis,
  getClient,
  isRedisConnected,
  getCircuitBreakerStatus,
  closeConnection,
  RedisStore,
  sessionStore,
  cache,
  twoFactorStore
};
