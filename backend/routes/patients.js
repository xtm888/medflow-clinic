const express = require('express');
const router = express.Router();
const {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientHistory,
  getPatientAppointments,
  getPatientPrescriptions,
  uploadPatientDocument,
  searchPatients
} = require('../controllers/patientController');

const { protect, authorize } = require('../middleware/auth');
const { logPatientDataAccess, logAction } = require('../middleware/auditLogger');

// Protect all routes
router.use(protect);

// Routes
router
  .route('/')
  .get(authorize('admin', 'doctor', 'nurse', 'receptionist', 'ophthalmologist'), getPatients)
  .post(authorize('admin', 'receptionist', 'nurse'), logAction('PATIENT_CREATE'), createPatient);

router.get('/search', authorize('admin', 'doctor', 'nurse', 'receptionist', 'ophthalmologist'), searchPatients);

router
  .route('/:id')
  .get(logPatientDataAccess, getPatient)
  .put(authorize('admin', 'doctor', 'nurse'), logAction('PATIENT_UPDATE'), updatePatient)
  .delete(authorize('admin'), logAction('PATIENT_DELETE'), deletePatient);

router.get('/:id/history', logPatientDataAccess, getPatientHistory);
router.get('/:id/appointments', logPatientDataAccess, getPatientAppointments);
router.get('/:id/prescriptions', logPatientDataAccess, getPatientPrescriptions);
router.post('/:id/documents', authorize('admin', 'doctor', 'nurse'), uploadPatientDocument);

module.exports = router;