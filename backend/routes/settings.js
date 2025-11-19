const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSettings,
  updateTwilioSettings,
  testTwilioConnection,
  getProfile,
  updateProfile,
  changePassword,
  getNotificationPreferences,
  updateNotificationPreferences
} = require('../controllers/settingsController');

const { protect, authorize } = require('../middleware/auth');
const { logAction } = require('../middleware/auditLogger');

// Protect all routes
router.use(protect);

// Clinic settings (admin only for updates)
router
  .route('/')
  .get(getSettings)
  .put(authorize('admin'), logAction('SETTINGS_UPDATE'), updateSettings);

// Twilio configuration (admin only)
router
  .route('/twilio')
  .put(authorize('admin'), logAction('TWILIO_CONFIG_UPDATE'), updateTwilioSettings);

router.post('/twilio/test', authorize('admin'), testTwilioConnection);

// User profile (any authenticated user)
router
  .route('/profile')
  .get(getProfile)
  .put(logAction('PROFILE_UPDATE'), updateProfile);

// Password change
router.put('/password', logAction('PASSWORD_CHANGE'), changePassword);

// Notification preferences
router
  .route('/notifications')
  .get(getNotificationPreferences)
  .put(updateNotificationPreferences);

module.exports = router;
