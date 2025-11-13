const express = require('express');
const router = express.Router();
const {
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  checkInAppointment,
  completeAppointment,
  getAvailableSlots,
  getTodaysAppointments,
  rescheduleAppointment
} = require('../controllers/appointmentController');

const { protect, authorize } = require('../middleware/auth');
const { logAction } = require('../middleware/auditLogger');

// Protect all routes
router.use(protect);

// Routes
router
  .route('/')
  .get(getAppointments)
  .post(authorize('admin', 'receptionist', 'doctor', 'nurse'), logAction('APPOINTMENT_CREATE'), createAppointment);

router.get('/today', getTodaysAppointments);
router.get('/available-slots', getAvailableSlots);

router
  .route('/:id')
  .get(getAppointment)
  .put(authorize('admin', 'receptionist', 'doctor'), logAction('APPOINTMENT_UPDATE'), updateAppointment);

router.put('/:id/cancel', authorize('admin', 'receptionist', 'doctor'), logAction('APPOINTMENT_CANCEL'), cancelAppointment);
router.put('/:id/checkin', authorize('admin', 'receptionist', 'nurse'), checkInAppointment);
router.put('/:id/complete', authorize('doctor', 'ophthalmologist'), completeAppointment);
router.put('/:id/reschedule', authorize('admin', 'receptionist'), rescheduleAppointment);

module.exports = router;