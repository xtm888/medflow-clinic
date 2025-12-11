const express = require('express');
const router = express.Router();
const {
  getIntegrations,
  getGoogleAuthUrl,
  googleCallback,
  getMicrosoftAuthUrl,
  microsoftCallback,
  disconnectIntegration,
  updateSyncSettings,
  triggerSync,
  syncAppointment,
  getAppointmentSyncStatus,
  getCalendars,
  refreshCalendarList,
  // iCal exports
  exportAppointmentToICal,
  exportAppointmentsToICal,
  getICalSubscription,
  getICalFeed
} = require('../controllers/calendarController');

const { protect } = require('../middleware/auth');

// ===========================
// PUBLIC ROUTES (OAuth Callbacks)
// ===========================

// Google OAuth callback - must be public for OAuth redirect
router.get('/google/callback', googleCallback);

// Microsoft OAuth callback - must be public for OAuth redirect
router.get('/outlook/callback', microsoftCallback);

// Public iCal feed - no auth required (uses token in URL)
router.get('/ical/:token/feed.ics', getICalFeed);

// ===========================
// PROTECTED ROUTES
// ===========================

// Protect all routes below
router.use(protect);

// Get all user integrations
router.get('/integrations', getIntegrations);

// Get available calendars from all connected accounts
router.get('/calendars', getCalendars);

// ===========================
// GOOGLE CALENDAR
// ===========================

// Get Google OAuth URL to initiate connection
router.get('/google/auth', getGoogleAuthUrl);

// ===========================
// MICROSOFT OUTLOOK
// ===========================

// Get Microsoft OAuth URL to initiate connection
router.get('/outlook/auth', getMicrosoftAuthUrl);

// ===========================
// INTEGRATION MANAGEMENT
// ===========================

// Disconnect a calendar integration
router.delete('/integrations/:provider', disconnectIntegration);

// Update sync settings for a provider
router.put('/integrations/:provider/settings', updateSyncSettings);

// Refresh calendar list from provider
router.post('/integrations/:provider/refresh-calendars', refreshCalendarList);

// ===========================
// SYNC OPERATIONS
// ===========================

// Trigger full sync for user
router.post('/sync', triggerSync);

// Sync single appointment
router.post('/sync/:appointmentId', syncAppointment);

// Get sync status for an appointment
router.get('/status/:appointmentId', getAppointmentSyncStatus);

// ===========================
// iCAL EXPORT ROUTES
// ===========================

// Export single appointment to .ics
router.get('/ical/appointment/:appointmentId', exportAppointmentToICal);

// Export multiple appointments to .ics (for logged in user)
router.get('/ical/export', exportAppointmentsToICal);

// Get/generate iCal subscription URL
router.get('/ical/subscription', getICalSubscription);

module.exports = router;
