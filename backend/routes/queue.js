const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  getCurrentQueue,
  addToQueue,
  updateQueueStatus,
  removeFromQueue,
  callNext,
  getQueueStats,
  getQueueAnalytics,
  callPatient,
  getDisplayBoardData
} = require('../controllers/queueController');

const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');
const { optionalClinic } = require('../middleware/clinicAuth');

// Rate limiter for public display board endpoint
// More restrictive since it's unauthenticated
const displayBoardLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute (allows refresh every 2 seconds)
  message: { success: false, error: 'Too many requests. Display board refresh rate limited.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Public route for display boards (rate-limited, no auth required)
// Returns only privacy-safe data: first name, last initial, queue number
router.get('/display-board', displayBoardLimiter, getDisplayBoardData);

// Protect all other routes and add clinic context
router.use(protect);
router.use(optionalClinic);

// Routes
router.get('/', logAction('QUEUE_VIEW'), getCurrentQueue);
router.post('/', requirePermission('manage_queue'), logAction('QUEUE_ADD'), addToQueue);
router.get('/stats', logAction('QUEUE_STATS_VIEW'), getQueueStats);
router.get('/analytics', requirePermission('view_reports'), logAction('QUEUE_ANALYTICS_VIEW'), getQueueAnalytics);
router.put('/:id', requirePermission('manage_queue'), logAction('QUEUE_UPDATE'), updateQueueStatus);
router.delete('/:id', requirePermission('manage_queue'), logAction('QUEUE_REMOVE'), removeFromQueue);
router.post('/next', requirePermission('manage_queue'), logAction('QUEUE_CALL_NEXT'), callNext);
router.post('/:id/call', requirePermission('manage_queue'), logAction('QUEUE_CALL_PATIENT'), callPatient);

module.exports = router;
