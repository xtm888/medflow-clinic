const router = require('express').Router();
const backupService = require('../services/backupService');
const backupScheduler = require('../services/backupScheduler');
const { protect, authorize } = require('../middleware/auth');
const { sendSuccess, sendError, forbidden } = require('../utils/errorResponse');

/**
 * @swagger
 * tags:
 *   name: Backups
 *   description: Backup management endpoints
 */

/**
 * @swagger
 * /backups/trigger:
 *   post:
 *     summary: Trigger manual backup
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [daily, monthly, yearly, manual]
 *                 default: manual
 *     responses:
 *       200:
 *         description: Backup created successfully
 *       403:
 *         description: Admin access required
 */
router.post('/trigger', protect, authorize('admin'), async (req, res) => {
  try {
    const { type = 'manual' } = req.body;

    const result = await backupScheduler.runManualBackup(type);

    return sendSuccess(res, result, `${type} backup created successfully`, 200);
  } catch (error) {
    console.error('Manual backup failed:', error);
    return sendError(res, {
      message: 'Backup creation failed',
      error: error.message,
      statusCode: 500
    });
  }
});

/**
 * @swagger
 * /backups/list:
 *   get:
 *     summary: List all backups
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of backups
 *       403:
 *         description: Admin access required
 */
router.get('/list', protect, authorize('admin'), async (req, res) => {
  try {
    const backups = await backupService.listBackups();

    // Calculate total counts and sizes
    const summary = {
      daily: {
        count: backups.daily.length,
        totalSizeMB: backups.daily.reduce((sum, b) => sum + parseFloat(b.sizeMB), 0).toFixed(2),
        latest: backups.daily[0]
      },
      monthly: {
        count: backups.monthly.length,
        totalSizeMB: backups.monthly.reduce((sum, b) => sum + parseFloat(b.sizeMB), 0).toFixed(2),
        latest: backups.monthly[0]
      },
      yearly: {
        count: backups.yearly.length,
        totalSizeMB: backups.yearly.reduce((sum, b) => sum + parseFloat(b.sizeMB), 0).toFixed(2),
        latest: backups.yearly[0]
      }
    };

    return sendSuccess(res, { backups, summary }, 'Backups retrieved successfully');
  } catch (error) {
    console.error('Failed to list backups:', error);
    return sendError(res, {
      message: 'Failed to list backups',
      error: error.message,
      statusCode: 500
    });
  }
});

/**
 * @swagger
 * /backups/stats:
 *   get:
 *     summary: Get backup statistics
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backup statistics
 */
router.get('/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const stats = backupService.getStats();
    const schedulerStatus = backupScheduler.getStatus();

    return sendSuccess(res, {
      stats,
      scheduler: schedulerStatus
    });
  } catch (error) {
    console.error('Failed to get backup stats:', error);
    return sendError(res, {
      message: 'Failed to get backup statistics',
      error: error.message,
      statusCode: 500
    });
  }
});

/**
 * @swagger
 * /backups/restore:
 *   post:
 *     summary: Restore from backup
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - backupName
 *             properties:
 *               backupName:
 *                 type: string
 *               force:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Backup restored successfully
 *       403:
 *         description: Admin access required
 */
router.post('/restore', protect, authorize('admin'), async (req, res) => {
  try {
    const { backupName, force = false } = req.body;

    if (!backupName) {
      return sendError(res, {
        message: 'Backup name is required',
        statusCode: 400
      });
    }

    // Production safety check
    if (process.env.NODE_ENV === 'production' && !force) {
      return sendError(res, {
        message: 'Production restore requires force=true flag for safety',
        statusCode: 400
      });
    }

    const result = await backupService.restoreBackup(backupName, { force });

    return sendSuccess(res, result, 'Backup restored successfully', 200);
  } catch (error) {
    console.error('Backup restoration failed:', error);
    return sendError(res, {
      message: 'Backup restoration failed',
      error: error.message,
      statusCode: 500
    });
  }
});

/**
 * @swagger
 * /backups/test:
 *   post:
 *     summary: Test backup system
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test results
 */
router.post('/test', protect, authorize('admin'), async (req, res) => {
  try {
    const result = await backupService.testBackup();

    if (result.success) {
      return sendSuccess(res, result, 'Backup system test passed');
    } else {
      return sendError(res, {
        message: 'Backup system test failed',
        error: result.error,
        statusCode: 500
      });
    }
  } catch (error) {
    console.error('Backup test failed:', error);
    return sendError(res, {
      message: 'Backup test failed',
      error: error.message,
      statusCode: 500
    });
  }
});

/**
 * @swagger
 * /backups/scheduler/status:
 *   get:
 *     summary: Get backup scheduler status
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scheduler status
 */
router.get('/scheduler/status', protect, authorize('admin'), async (req, res) => {
  try {
    const status = backupScheduler.getStatus();
    return sendSuccess(res, status);
  } catch (error) {
    return sendError(res, {
      message: 'Failed to get scheduler status',
      error: error.message,
      statusCode: 500
    });
  }
});

/**
 * @swagger
 * /backups/scheduler/start:
 *   post:
 *     summary: Start backup scheduler
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scheduler started
 */
router.post('/scheduler/start', protect, authorize('admin'), async (req, res) => {
  try {
    backupScheduler.start();
    return sendSuccess(res, null, 'Backup scheduler started');
  } catch (error) {
    return sendError(res, {
      message: 'Failed to start scheduler',
      error: error.message,
      statusCode: 500
    });
  }
});

/**
 * @swagger
 * /backups/scheduler/stop:
 *   post:
 *     summary: Stop backup scheduler
 *     tags: [Backups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scheduler stopped
 */
router.post('/scheduler/stop', protect, authorize('admin'), async (req, res) => {
  try {
    backupScheduler.stop();
    return sendSuccess(res, null, 'Backup scheduler stopped');
  } catch (error) {
    return sendError(res, {
      message: 'Failed to stop scheduler',
      error: error.message,
      statusCode: 500
    });
  }
});

module.exports = router;
