const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  createNotification,
  broadcastNotification,
  getPreferences,
  updatePreferences
} = require('../controllers/notificationController');

const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// User notification routes
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllAsRead);
router.delete('/clear-all', clearAllNotifications);

// Preferences
router
  .route('/preferences')
  .get(getPreferences)
  .put(updatePreferences);

// Admin routes
router.post('/', authorize('admin'), createNotification);
router.post('/broadcast', authorize('admin'), broadcastNotification);

// Individual notification routes
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;
