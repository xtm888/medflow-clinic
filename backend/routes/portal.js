const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getMyAppointments,
  requestAppointment,
  cancelMyAppointment,
  getMyPrescriptions,
  getMyBills,
  getMyProfile,
  updateMyProfile,
  getMyResults,
  getAvailableSlots
} = require('../controllers/portalController');

const { protect } = require('../middleware/auth');
const { logPatientDataAccess } = require('../middleware/auditLogger');

// Protect all routes - any authenticated user can access their own data
router.use(protect);

// Dashboard
router.get('/dashboard', getDashboard);

// Appointments
router.get('/appointments', getMyAppointments);
router.post('/appointments', requestAppointment);
router.put('/appointments/:id/cancel', cancelMyAppointment);
router.get('/available-slots', getAvailableSlots);

// Prescriptions
router.get('/prescriptions', getMyPrescriptions);

// Bills
router.get('/bills', getMyBills);

// Profile
router
  .route('/profile')
  .get(getMyProfile)
  .put(updateMyProfile);

// Results
router.get('/results', getMyResults);

module.exports = router;
