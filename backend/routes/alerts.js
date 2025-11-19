const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// GET /api/alerts/unread - Get unread alerts for logged-in user
router.get('/unread',
  alertController.getUnreadAlerts
);

// GET /api/alerts/count - Get unread count
router.get('/count',
  alertController.getUnreadCount
);

// GET /api/alerts/category/:category - Get alerts by category
router.get('/category/:category',
  alertController.getAlertsByCategory
);

// GET /api/alerts - Get all alerts for logged-in user
router.get('/',
  alertController.getAllAlerts
);

// GET /api/alerts/:id - Get single alert
router.get('/:id',
  alertController.getAlertById
);

// POST /api/alerts - Create new alert
router.post('/',
  authorize(['admin', 'doctor', 'nurse', 'receptionist']),
  alertController.createAlert
);

// POST /api/alerts/:id/read - Mark alert as read
router.post('/:id/read',
  alertController.markAsRead
);

// POST /api/alerts/read-multiple - Mark multiple alerts as read
router.post('/read-multiple',
  alertController.markMultipleAsRead
);

// POST /api/alerts/:id/dismiss - Dismiss alert
router.post('/:id/dismiss',
  alertController.dismissAlert
);

// POST /api/alerts/:id/complete-action - Complete alert action
router.post('/:id/complete-action',
  alertController.completeAction
);

// DELETE /api/alerts/:id - Delete alert
router.delete('/:id',
  authorize(['admin', 'doctor', 'nurse']),
  alertController.deleteAlert
);

module.exports = router;
