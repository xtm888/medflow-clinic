/**
 * Distributed Lock Service
 *
 * Uses Redis to ensure only one instance of a scheduler runs at a time
 * across multiple server instances. Prevents race conditions and
 * duplicate job execution in multi-server deployments.
 *
 * Implementation follows the Redlock algorithm principles for distributed
 * locking with automatic expiration to prevent deadlocks.
 */

const redis = require('../config/redis');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

class DistributedLock {
  /**
   * Create a new distributed lock
   * @param {string} lockName - Unique name for this lock
   * @param {Object} options - Configuration options
   * @param {number} options.ttl - Lock TTL in seconds (default 60)
   * @param {number} options.retryDelay - Delay between retries in ms (default 100)
   * @param {number} options.maxRetries - Max retry attempts (default 10)
   */
  constructor(lockName, options = {}) {
    this.lockName = `lock:${lockName}`;
    this.lockId = uuidv4();
    this.ttl = options.ttl || 60;
    this.retryDelay = options.retryDelay || 100;
    this.maxRetries = options.maxRetries || 10;
    this.acquired = false;
  }

  /**
   * Attempt to acquire the lock
   * @returns {Promise<boolean>} - True if lock acquired
   */
  async acquire() {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Use SET NX EX for atomic lock acquisition
        const result = await redis.set(
          this.lockName,
          this.lockId,
          'EX',
          this.ttl,
          'NX'
        );

        if (result === 'OK') {
          this.acquired = true;
          logger.debug(`Lock acquired: ${this.lockName}`, { lockId: this.lockId });
          return true;
        }

        // Lock held by another process, wait and retry
        if (attempt < this.maxRetries - 1) {
          await new Promise(r => setTimeout(r, this.retryDelay));
        }
      } catch (error) {
        logger.warn(`Lock acquisition error: ${this.lockName}`, { error: error.message });
        // If Redis is unavailable, allow operation to proceed (fail-open)
        // This prevents total system lockup if Redis goes down
        if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
          logger.warn('Redis unavailable, proceeding without lock (fail-open)');
          return true;
        }
      }
    }

    logger.debug(`Could not acquire lock: ${this.lockName} (held by another process)`);
    return false;
  }

  /**
   * Release the lock (only if we own it)
   * Uses Lua script for atomic check-and-delete
   */
  async release() {
    if (!this.acquired) return;

    // Lua script to atomically check ownership and delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      await redis.eval(script, 1, this.lockName, this.lockId);
      logger.debug(`Lock released: ${this.lockName}`);
    } catch (error) {
      logger.warn(`Failed to release lock: ${this.lockName}`, { error: error.message });
    } finally {
      this.acquired = false;
    }
  }

  /**
   * Extend the lock TTL (for long-running operations)
   * @param {number} additionalSeconds - Extra time to add
   * @returns {Promise<boolean>} - True if extended successfully
   */
  async extend(additionalSeconds) {
    if (!this.acquired) return false;

    // Lua script to atomically check ownership and extend
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    try {
      const result = await redis.eval(
        script,
        1,
        this.lockName,
        this.lockId,
        additionalSeconds
      );
      return result === 1;
    } catch (error) {
      logger.warn(`Failed to extend lock: ${this.lockName}`, { error: error.message });
      return false;
    }
  }
}

/**
 * Execute a function with a distributed lock
 * Automatically acquires and releases the lock
 *
 * @param {string} lockName - Unique name for this lock
 * @param {Function} fn - Async function to execute while holding lock
 * @param {Object} options - Lock options (ttl, retryDelay, maxRetries)
 * @returns {Promise<*>} - Result of fn, or null if lock not acquired
 *
 * @example
 * await withLock('scheduler:alerts', async () => {
 *   // This code runs only on one instance
 *   await processAlerts();
 * }, { ttl: 300 });
 */
async function withLock(lockName, fn, options = {}) {
  const lock = new DistributedLock(lockName, options);

  if (!await lock.acquire()) {
    logger.debug(`Skipping ${lockName} - another instance is processing`);
    return null;
  }

  try {
    return await fn();
  } finally {
    await lock.release();
  }
}

/**
 * Create a wrapped scheduler function with distributed locking
 * Use this to wrap scheduler job functions
 *
 * @param {string} schedulerName - Name of the scheduler (for lock key)
 * @param {Function} jobFn - The job function to wrap
 * @param {Object} options - Lock options
 * @returns {Function} - Wrapped function with locking
 *
 * @example
 * const processAlertsWithLock = wrapWithLock('alerts', processAlerts, { ttl: 300 });
 * cron.schedule('* * * * *', processAlertsWithLock);
 */
function wrapWithLock(schedulerName, jobFn, options = {}) {
  return async function wrappedJob(...args) {
    return withLock(`scheduler:${schedulerName}`, () => jobFn(...args), options);
  };
}

module.exports = {
  DistributedLock,
  withLock,
  wrapWithLock
};
