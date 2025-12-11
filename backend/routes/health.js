const router = require('express').Router();
const mongoose = require('mongoose');
const redis = require('../config/redis');
const logger = require('../config/logger');
const { healthAuth } = require('../middleware/healthAuth');

/**
 * Health Check Endpoints
 *
 * Provides various health check endpoints for monitoring and orchestration:
 * - /health - Basic health check
 * - /health/detailed - Detailed system health with dependencies
 * - /health/ready - Kubernetes readiness probe
 * - /health/live - Kubernetes liveness probe
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 */
router.get('/', (req, res) => {
  // Minimal public health check - safe for load balancers
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
    // Note: uptime and environment removed to minimize info disclosure
  });
});

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check with dependency status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Detailed health status
 */
router.get('/detailed', healthAuth, async (req, res) => {
  const startTime = Date.now();

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    checks: {},
    performance: {}
  };

  // MongoDB health check
  try {
    const mongoStart = Date.now();
    const mongoState = mongoose.connection.readyState;
    const mongoDuration = Date.now() - mongoStart;

    health.checks.mongodb = {
      status: mongoState === 1 ? 'ok' : 'error',
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoState],
      responseTime: `${mongoDuration}ms`
    };

    if (mongoState === 1) {
      // Get database stats
      try {
        const admin = mongoose.connection.db.admin();
        const dbStats = await admin.serverStatus();
        health.checks.mongodb.version = dbStats.version;
        health.checks.mongodb.connections = {
          current: dbStats.connections.current,
          available: dbStats.connections.available
        };
      } catch (error) {
        logger.warn('Could not fetch MongoDB stats', { error: error.message });
      }
    } else {
      health.status = 'degraded';
    }
  } catch (error) {
    health.checks.mongodb = {
      status: 'error',
      error: error.message
    };
    health.status = 'degraded';
  }

  // Redis health check
  try {
    const redisStart = Date.now();
    await redis.ping();
    const redisDuration = Date.now() - redisStart;

    health.checks.redis = {
      status: 'ok',
      responseTime: `${redisDuration}ms`
    };

    // Get Redis info
    try {
      const redisInfo = await redis.info();
      const lines = redisInfo.split('\r\n');
      const versionLine = lines.find(line => line.startsWith('redis_version:'));
      if (versionLine) {
        health.checks.redis.version = versionLine.split(':')[1];
      }
    } catch (error) {
      // Redis info not critical
    }
  } catch (error) {
    health.checks.redis = {
      status: 'error',
      error: error.message
    };
    health.status = 'degraded';
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  const memUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  health.checks.memory = {
    status: memUsedPercent < 90 ? 'ok' : 'warning',
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
    usedPercent: `${memUsedPercent.toFixed(1)}%`
  };

  if (memUsedPercent >= 90) {
    health.status = 'warning';
  }

  // CPU usage (simplified)
  const cpuUsage = process.cpuUsage();
  health.checks.cpu = {
    status: 'ok',
    user: `${(cpuUsage.user / 1000000).toFixed(2)}s`,
    system: `${(cpuUsage.system / 1000000).toFixed(2)}s`
  };

  // Event loop lag (if event loop is blocked)
  const eventLoopStart = Date.now();
  setImmediate(() => {
    const eventLoopLag = Date.now() - eventLoopStart;
    health.performance.eventLoopLag = `${eventLoopLag}ms`;

    if (eventLoopLag > 100) {
      health.checks.eventLoop = {
        status: 'warning',
        lag: `${eventLoopLag}ms`,
        message: 'Event loop is lagging'
      };
      health.status = 'warning';
    } else {
      health.checks.eventLoop = {
        status: 'ok',
        lag: `${eventLoopLag}ms`
      };
    }
  });

  // System info
  health.system = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    pid: process.pid
  };

  // Overall health check duration
  health.performance.checkDuration = `${Date.now() - startTime}ms`;

  // Determine HTTP status code
  const statusCode = health.status === 'ok' ? 200 : health.status === 'warning' ? 200 : 503;

  res.status(statusCode).json(health);
});

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe (Kubernetes)
 *     description: Returns 200 when service is ready to accept traffic
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *       503:
 *         description: Service is not ready
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if MongoDB is connected
    const mongoState = mongoose.connection.readyState;

    if (mongoState !== 1) {
      return res.status(503).json({
        ready: false,
        reason: 'Database not connected',
        mongoState: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoState]
      });
    }

    // Service is ready
    res.json({
      ready: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness probe (Kubernetes)
 *     description: Returns 200 when service is alive (not deadlocked)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/live', (req, res) => {
  // Simple liveness check - if we can respond, we're alive
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * @swagger
 * /health/startup:
 *   get:
 *     summary: Startup probe (Kubernetes)
 *     description: Returns 200 when service has completed initialization
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service has started
 */
router.get('/startup', async (req, res) => {
  try {
    // Check if essential services are initialized
    const mongoState = mongoose.connection.readyState;

    if (mongoState !== 1) {
      return res.status(503).json({
        started: false,
        reason: 'Database initialization incomplete'
      });
    }

    res.json({
      started: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      started: false,
      error: error.message
    });
  }
});

module.exports = router;
