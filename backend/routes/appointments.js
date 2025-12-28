const express = require('express');
const router = express.Router();
const {
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  checkInAppointment,
  startConsultation,
  completeAppointment,
  getAvailableSlots,
  getTodaysAppointments,
  rescheduleAppointment,
  // New endpoints
  getAppointmentsByProvider,
  getAppointmentsByPatient,
  getUpcomingAppointments,
  getAppointmentStatistics,
  sendReminder,
  addNote,
  getNotes,
  markNoShow,
  getWaitingList,
  addToWaitingList,
  removeFromWaitingList,
  getAppointmentTypes,
  checkConflicts,
  bulkUpdate,
  getCalendarView,
  getQueueStatus,
  updateQueuePosition,
  getRecurringSeries,
  createRecurring,
  confirmAppointment,
  getProviderAvailability,
  updateProviderAvailability,
  addProviderTimeOff,
  getProviders
} = require('../controllers/appointmentController');

const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logAction } = require('../middleware/auditLogger');
const { optionalClinic } = require('../middleware/clinicAuth');
const { deprecate } = require('../middleware/deprecation');

// Protect all routes and add clinic context
router.use(protect);
router.use(optionalClinic);

// =====================================================
// STATIC ROUTES (must come before parameterized routes)
// =====================================================

// Batch fetch appointments by IDs - for API request batching
router.post('/batch', requirePermission('view_appointments'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'IDs array required' });
    }

    // Limit batch size for performance
    const limitedIds = ids.slice(0, 50);

    const Appointment = require('../models/Appointment');
    const appointments = await Appointment.find({
      _id: { $in: limitedIds }
    })
      .populate('patient', 'firstName lastName patientId')
      .populate('provider', 'firstName lastName role')
      .select('patient provider date startTime endTime status type reason notes room');

    res.json(appointments);
  } catch (error) {
    console.error('Batch fetch appointments error:', error);
    res.status(500).json({ message: 'Error fetching appointments' });
  }
});

// Today's appointments
router.get('/today', requirePermission('view_appointments'), getTodaysAppointments);

// Available time slots
router.get('/available-slots', requirePermission('view_appointments'), getAvailableSlots);

// Upcoming appointments
router.get('/upcoming', requirePermission('view_appointments'), getUpcomingAppointments);

// Appointment statistics
router.get('/statistics', requirePermission('view_reports'), getAppointmentStatistics);

// Calendar view
router.get('/calendar', requirePermission('view_appointments'), getCalendarView);

// Queue status
router.get('/queue', requirePermission('view_appointments'), getQueueStatus);

// Appointment types
router.get('/types', requirePermission('view_appointments'), getAppointmentTypes);

// Waiting list
router
  .route('/waiting-list')
  .get(requirePermission('view_appointments'), getWaitingList)
  .post(requirePermission('manage_appointments'), logAction('WAITING_LIST_ADD'), addToWaitingList);

router.delete(
  '/waiting-list/:id',
  requirePermission('manage_appointments'),
  logAction('WAITING_LIST_REMOVE'),
  removeFromWaitingList
);

// Check conflicts
router.post('/check-conflicts', requirePermission('view_appointments'), checkConflicts);

// Enhanced appointment validation (buffer time, room conflicts, equipment)
router.post('/validate', requirePermission('view_appointments'), async (req, res) => {
  try {
    const appointmentValidationService = require('../services/appointmentValidationService');
    const validation = await appointmentValidationService.validateAppointment(req.body);
    res.json({ success: true, data: validation });
  } catch (error) {
    console.error('Appointment validation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Find next available slot
router.post('/find-slot', requirePermission('view_appointments'), async (req, res) => {
  try {
    const appointmentValidationService = require('../services/appointmentValidationService');
    const { providerId, appointmentType, preferredDate, preferredTime } = req.body;
    const slot = await appointmentValidationService.findNextAvailableSlot(
      providerId,
      appointmentType,
      preferredDate ? new Date(preferredDate) : new Date(),
      preferredTime
    );
    res.json({ success: true, data: slot });
  } catch (error) {
    console.error('Find slot error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get available slots for a date range
router.get('/slots/:providerId/:date', requirePermission('view_appointments'), async (req, res) => {
  try {
    const appointmentValidationService = require('../services/appointmentValidationService');
    const { providerId, date } = req.params;
    const { appointmentType, roomId } = req.query;
    const slots = await appointmentValidationService.getAvailableSlots(
      providerId,
      new Date(date),
      appointmentType,
      roomId
    );
    res.json({ success: true, data: slots });
  } catch (error) {
    console.error('Get slots error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk update (admin only)
router.put(
  '/bulk-update',
  requirePermission('manage_system'),
  logAction('APPOINTMENT_BULK_UPDATE'),
  bulkUpdate
);

// Recurring appointments
router.post(
  '/recurring',
  requirePermission('manage_appointments'),
  logAction('RECURRING_APPOINTMENT_CREATE'),
  createRecurring
);

// Get recurring series
router.get('/series/:seriesId', requirePermission('view_appointments'), getRecurringSeries);

// Get list of providers (doctors/ophthalmologists) - accessible to all staff
// MUST come before /provider/:providerId to avoid route collision
router.get('/providers', requirePermission('view_appointments'), getProviders);

// Provider-specific appointments
router.get('/provider/:providerId', requirePermission('view_appointments'), getAppointmentsByProvider);

// Patient-specific appointments
router.get('/patient/:patientId', requirePermission('view_appointments'), getAppointmentsByPatient);

// Provider availability
router
  .route('/provider-availability/:providerId')
  .get(requirePermission('view_appointments'), getProviderAvailability)
  .put(requirePermission('manage_system'), logAction('PROVIDER_AVAILABILITY_UPDATE'), updateProviderAvailability);

router.post(
  '/provider-availability/:providerId/time-off',
  requirePermission('manage_appointments'),
  logAction('PROVIDER_TIME_OFF_ADD'),
  addProviderTimeOff
);

// =====================================================
// MAIN CRUD ROUTES
// =====================================================

router
  .route('/')
  .get(requirePermission('view_appointments'), getAppointments)
  .post(requirePermission('manage_appointments'), logAction('APPOINTMENT_CREATE'), createAppointment);

router
  .route('/:id')
  .get(requirePermission('view_appointments'), getAppointment)
  .put(requirePermission('manage_appointments'), logAction('APPOINTMENT_UPDATE'), updateAppointment);

// =====================================================
// APPOINTMENT STATUS ACTIONS
// =====================================================

router.put(
  '/:id/cancel',
  requirePermission('manage_appointments'),
  logAction('APPOINTMENT_CANCEL'),
  cancelAppointment
);

// DEPRECATED: Use POST /api/queue with { appointmentId } instead
// This endpoint will be removed on 2026-03-01
// The queue endpoint provides unified check-in with proper transaction handling
router.put(
  '/:id/checkin',
  deprecate(
    'Utilisez POST /api/queue avec { appointmentId } pour le check-in',
    '2026-03-01',
    '/api/queue'
  ),
  requirePermission('manage_appointments'),
  checkInAppointment
);

router.put(
  '/:id/start-consultation',
  requirePermission('manage_appointments'),
  logAction('CONSULTATION_START'),
  startConsultation
);

router.put(
  '/:id/complete',
  requirePermission('manage_appointments'),
  completeAppointment
);

router.put(
  '/:id/reschedule',
  requirePermission('manage_appointments'),
  logAction('APPOINTMENT_RESCHEDULE'),
  rescheduleAppointment
);

router.put(
  '/:id/no-show',
  requirePermission('manage_appointments'),
  logAction('APPOINTMENT_NO_SHOW'),
  markNoShow
);

router.put(
  '/:id/confirm',
  requirePermission('manage_appointments'),
  logAction('APPOINTMENT_CONFIRM'),
  confirmAppointment
);

// =====================================================
// APPOINTMENT NOTES
// =====================================================

router
  .route('/:id/notes')
  .get(getNotes)
  .post(requirePermission('manage_appointments'), addNote);

// =====================================================
// REMINDERS
// =====================================================

router.post(
  '/:id/reminder',
  requirePermission('manage_appointments'),
  logAction('APPOINTMENT_REMINDER_SEND'),
  sendReminder
);

// =====================================================
// QUEUE MANAGEMENT
// =====================================================

router.put(
  '/:id/queue-position',
  requirePermission('manage_appointments'),
  updateQueuePosition
);

module.exports = router;
