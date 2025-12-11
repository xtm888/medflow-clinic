/**
 * Comprehensive Caching Service
 *
 * Provides domain-specific caching for frequently accessed data to improve performance.
 * Uses Redis when available, with automatic fallback to in-memory cache when Redis is unavailable.
 *
 * Cached Data Types:
 * - Fee Schedules (most frequently accessed)
 * - User data
 * - Patient basic info
 * - Clinic settings
 * - Convention rules
 *
 * Features:
 * - Automatic TTL management
 * - Cache invalidation strategies
 * - Cache warming
 * - Cache statistics
 * - Graceful fallback to memory cache
 */

const { cache, isRedisConnected } = require('../config/redis');
const CONSTANTS = require('../config/constants');

// In-memory fallback cache when Redis is unavailable
const memoryCache = new Map();

// Cache statistics
const stats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  errors: 0
};

/**
 * Get cache statistics
 */
function getStats() {
  return {
    ...stats,
    hitRate: stats.hits + stats.misses > 0
      ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(2) + '%'
      : '0%',
    isRedisConnected: isRedisConnected(),
    memoryCache: {
      size: memoryCache.size,
      keys: Array.from(memoryCache.keys())
    }
  };
}

/**
 * Reset cache statistics
 */
function resetStats() {
  stats.hits = 0;
  stats.misses = 0;
  stats.sets = 0;
  stats.deletes = 0;
  stats.errors = 0;
}

/**
 * Generic get with automatic fallback to memory cache
 */
async function get(key) {
  try {
    // Try Redis first
    if (isRedisConnected()) {
      const value = await cache.get(key);
      if (value !== null) {
        stats.hits++;
        return value;
      }
    } else {
      // Fallback to memory cache
      const memoryCacheEntry = memoryCache.get(key);
      if (memoryCacheEntry) {
        // Check if expired
        if (memoryCacheEntry.expiry > Date.now()) {
          stats.hits++;
          return memoryCacheEntry.value;
        } else {
          // Remove expired entry
          memoryCache.delete(key);
        }
      }
    }

    stats.misses++;
    return null;
  } catch (error) {
    console.error('Cache get error:', error.message);
    stats.errors++;
    return null;
  }
}

/**
 * Generic set with automatic fallback to memory cache
 */
async function set(key, value, ttlSeconds) {
  try {
    if (isRedisConnected()) {
      await cache.set(key, value, ttlSeconds);
    } else {
      // Fallback to memory cache
      memoryCache.set(key, {
        value,
        expiry: Date.now() + (ttlSeconds * 1000)
      });
    }
    stats.sets++;
    return true;
  } catch (error) {
    console.error('Cache set error:', error.message);
    stats.errors++;
    return false;
  }
}

/**
 * Generic delete with automatic fallback to memory cache
 */
async function del(key) {
  try {
    if (isRedisConnected()) {
      await cache.delete(key);
    } else {
      memoryCache.delete(key);
    }
    stats.deletes++;
    return true;
  } catch (error) {
    console.error('Cache delete error:', error.message);
    stats.errors++;
    return false;
  }
}

/**
 * Delete by pattern (Redis only)
 */
async function deletePattern(pattern) {
  try {
    if (isRedisConnected()) {
      await cache.deletePattern(pattern);
      stats.deletes++;
    } else {
      // Memory cache: delete matching keys
      const keys = Array.from(memoryCache.keys());
      const regex = new RegExp(pattern.replace('*', '.*'));
      keys.forEach(key => {
        if (regex.test(key)) {
          memoryCache.delete(key);
          stats.deletes++;
        }
      });
    }
    return true;
  } catch (error) {
    console.error('Cache deletePattern error:', error.message);
    stats.errors++;
    return false;
  }
}

/**
 * Clear all cache
 */
async function clear() {
  try {
    if (isRedisConnected()) {
      await cache.deletePattern('*');
    }
    memoryCache.clear();
    return true;
  } catch (error) {
    console.error('Cache clear error:', error.message);
    return false;
  }
}

// ==========================================
// DOMAIN-SPECIFIC CACHE HELPERS
// ==========================================

/**
 * Fee Schedule Cache
 * Most frequently accessed data - cache aggressively
 */
const feeScheduleCache = {
  /**
   * Get fee schedule by ID
   */
  async get(feeScheduleId) {
    const key = `${CONSTANTS.CACHE.PREFIX_FEE}${feeScheduleId}`;
    return await get(key);
  },

  /**
   * Set fee schedule
   */
  async set(feeScheduleId, feeScheduleData) {
    const key = `${CONSTANTS.CACHE.PREFIX_FEE}${feeScheduleId}`;
    return await set(key, feeScheduleData, CONSTANTS.CACHE.FEE_SCHEDULE_TTL);
  },

  /**
   * Get all fee schedules
   */
  async getAll() {
    const key = `${CONSTANTS.CACHE.PREFIX_FEE}all`;
    return await get(key);
  },

  /**
   * Set all fee schedules
   */
  async setAll(feeSchedules) {
    const key = `${CONSTANTS.CACHE.PREFIX_FEE}all`;
    return await set(key, feeSchedules, CONSTANTS.CACHE.FEE_SCHEDULE_TTL);
  },

  /**
   * Invalidate fee schedule cache
   */
  async invalidate(feeScheduleId = null) {
    if (feeScheduleId) {
      await del(`${CONSTANTS.CACHE.PREFIX_FEE}${feeScheduleId}`);
    }
    // Always invalidate the "all" cache
    await del(`${CONSTANTS.CACHE.PREFIX_FEE}all`);
  },

  /**
   * Invalidate all fee schedules
   */
  async invalidateAll() {
    await deletePattern(`${CONSTANTS.CACHE.PREFIX_FEE}*`);
  }
};

/**
 * User Cache
 */
const userCache = {
  /**
   * Get user by ID
   */
  async get(userId) {
    const key = `${CONSTANTS.CACHE.PREFIX_USER}${userId}`;
    return await get(key);
  },

  /**
   * Set user
   */
  async set(userId, userData) {
    const key = `${CONSTANTS.CACHE.PREFIX_USER}${userId}`;
    // Remove sensitive data before caching
    const { password, resetPasswordToken, ...safeUserData } = userData;
    return await set(key, safeUserData, CONSTANTS.CACHE.USER_TTL);
  },

  /**
   * Get user by email
   */
  async getByEmail(email) {
    const key = `${CONSTANTS.CACHE.PREFIX_USER}email:${email}`;
    return await get(key);
  },

  /**
   * Set user by email
   */
  async setByEmail(email, userData) {
    const key = `${CONSTANTS.CACHE.PREFIX_USER}email:${email}`;
    const { password, resetPasswordToken, ...safeUserData } = userData;
    return await set(key, safeUserData, CONSTANTS.CACHE.USER_TTL);
  },

  /**
   * Invalidate user cache
   */
  async invalidate(userId, email = null) {
    await del(`${CONSTANTS.CACHE.PREFIX_USER}${userId}`);
    if (email) {
      await del(`${CONSTANTS.CACHE.PREFIX_USER}email:${email}`);
    }
  },

  /**
   * Invalidate all users
   */
  async invalidateAll() {
    await deletePattern(`${CONSTANTS.CACHE.PREFIX_USER}*`);
  }
};

/**
 * Patient Cache
 * Cache basic patient info for quick lookups
 */
const patientCache = {
  /**
   * Get patient basic info by ID
   */
  async get(patientId) {
    const key = `${CONSTANTS.CACHE.PREFIX_PATIENT}${patientId}`;
    return await get(key);
  },

  /**
   * Set patient basic info
   */
  async set(patientId, patientData) {
    const key = `${CONSTANTS.CACHE.PREFIX_PATIENT}${patientId}`;
    // Only cache basic demographic info, not full medical history
    const basicInfo = {
      _id: patientData._id,
      patientId: patientData.patientId,
      firstName: patientData.firstName,
      lastName: patientData.lastName,
      dateOfBirth: patientData.dateOfBirth,
      gender: patientData.gender,
      phoneNumber: patientData.phoneNumber,
      email: patientData.email,
      bloodGroup: patientData.bloodGroup,
      photo: patientData.photo,
      status: patientData.status,
      homeClinic: patientData.homeClinic
    };
    return await set(key, basicInfo, CONSTANTS.CACHE.PATIENT_TTL);
  },

  /**
   * Get patient by MRN (Medical Record Number)
   */
  async getByMRN(mrn) {
    const key = `${CONSTANTS.CACHE.PREFIX_PATIENT}mrn:${mrn}`;
    return await get(key);
  },

  /**
   * Set patient by MRN
   */
  async setByMRN(mrn, patientId) {
    const key = `${CONSTANTS.CACHE.PREFIX_PATIENT}mrn:${mrn}`;
    return await set(key, patientId, CONSTANTS.CACHE.PATIENT_TTL);
  },

  /**
   * Invalidate patient cache
   */
  async invalidate(patientId, mrn = null) {
    await del(`${CONSTANTS.CACHE.PREFIX_PATIENT}${patientId}`);
    if (mrn) {
      await del(`${CONSTANTS.CACHE.PREFIX_PATIENT}mrn:${mrn}`);
    }
  },

  /**
   * Invalidate all patients
   */
  async invalidateAll() {
    await deletePattern(`${CONSTANTS.CACHE.PREFIX_PATIENT}*`);
  }
};

/**
 * Settings Cache
 * Cache clinic/system settings
 */
const settingsCache = {
  /**
   * Get settings by key
   */
  async get(settingKey) {
    const key = `${CONSTANTS.CACHE.PREFIX_SETTINGS}${settingKey}`;
    return await get(key);
  },

  /**
   * Set settings
   */
  async set(settingKey, settingValue) {
    const key = `${CONSTANTS.CACHE.PREFIX_SETTINGS}${settingKey}`;
    return await set(key, settingValue, CONSTANTS.CACHE.SETTINGS_TTL);
  },

  /**
   * Get clinic settings
   */
  async getClinicSettings(clinicId) {
    const key = `${CONSTANTS.CACHE.PREFIX_SETTINGS}clinic:${clinicId}`;
    return await get(key);
  },

  /**
   * Set clinic settings
   */
  async setClinicSettings(clinicId, settings) {
    const key = `${CONSTANTS.CACHE.PREFIX_SETTINGS}clinic:${clinicId}`;
    return await set(key, settings, CONSTANTS.CACHE.CLINIC_TTL);
  },

  /**
   * Invalidate settings
   */
  async invalidate(settingKey) {
    await del(`${CONSTANTS.CACHE.PREFIX_SETTINGS}${settingKey}`);
  },

  /**
   * Invalidate clinic settings
   */
  async invalidateClinic(clinicId) {
    await del(`${CONSTANTS.CACHE.PREFIX_SETTINGS}clinic:${clinicId}`);
  },

  /**
   * Invalidate all settings
   */
  async invalidateAll() {
    await deletePattern(`${CONSTANTS.CACHE.PREFIX_SETTINGS}*`);
  }
};

/**
 * Cache warming function
 * Preload frequently accessed data into cache
 */
async function warmCache() {
  console.log('🔥 Warming cache...');

  try {
    // Warm fee schedules
    const FeeSchedule = require('../models/FeeSchedule');
    const feeSchedules = await FeeSchedule.find({ status: 'active' }).lean();
    if (feeSchedules && feeSchedules.length > 0) {
      await feeScheduleCache.setAll(feeSchedules);
      console.log(`  ✓ Cached ${feeSchedules.length} fee schedules`);
    }

    // Warm active users
    const User = require('../models/User');
    const users = await User.find({ active: true }).select('-password -resetPasswordToken').lean();
    if (users && users.length > 0) {
      for (const user of users) {
        await userCache.set(user._id.toString(), user);
        if (user.email) {
          await userCache.setByEmail(user.email, user);
        }
      }
      console.log(`  ✓ Cached ${users.length} active users`);
    }

    console.log('✅ Cache warming complete');
  } catch (error) {
    console.error('❌ Cache warming failed:', error.message);
  }
}

/**
 * Cache invalidation middleware
 * Automatically invalidate cache when models are updated
 */
function createInvalidationMiddleware(cacheHelper, getIdField = '_id') {
  return async function(doc, next) {
    try {
      const id = typeof getIdField === 'function'
        ? getIdField(doc)
        : doc[getIdField];

      if (id) {
        await cacheHelper.invalidate(id.toString());
      }
    } catch (error) {
      console.error('Cache invalidation middleware error:', error.message);
    }
    next();
  };
}

/**
 * Memory cache cleanup
 * Remove expired entries from memory cache
 */
function cleanupMemoryCache() {
  const now = Date.now();
  let removed = 0;

  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiry <= now) {
      memoryCache.delete(key);
      removed++;
    }
  }

  if (removed > 0) {
    console.log(`🧹 Cleaned up ${removed} expired cache entries`);
  }
}

// Run memory cache cleanup every 5 minutes
setInterval(cleanupMemoryCache, 5 * 60 * 1000);

module.exports = {
  // Generic cache operations
  get,
  set,
  del,
  deletePattern,
  clear,

  // Domain-specific caches
  feeSchedule: feeScheduleCache,
  user: userCache,
  patient: patientCache,
  settings: settingsCache,

  // Cache management
  warmCache,
  createInvalidationMiddleware,
  getStats,
  resetStats,
  cleanupMemoryCache
};
