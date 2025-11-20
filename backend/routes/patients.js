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
  searchPatients,
  getRecentPatients,
  // getPatientVisits, // DEPRECATED - removed, now redirects to /api/visits/patient/:id
  getPatientAllergies,
  addPatientAllergy,
  getPatientMedications,
  addPatientMedication,
  updatePatientInsurance,
  getPatientDocuments
} = require('../controllers/patientController');

const { getPatientBilling } = require('../controllers/billingController');
const { protect, authorize } = require('../middleware/auth');
const { logPatientDataAccess, logAction } = require('../middleware/auditLogger');

// Protect all routes
router.use(protect);

// Routes
router
  .route('/')
  .get(authorize('admin', 'doctor', 'nurse', 'receptionist', 'ophthalmologist'), getPatients)
  .post(authorize('admin', 'receptionist', 'nurse'), logAction('PATIENT_CREATE'), createPatient);

// Static routes must come before parameterized routes
router.get('/search', authorize('admin', 'doctor', 'nurse', 'receptionist', 'ophthalmologist'), searchPatients);
router.get('/recent', authorize('admin', 'doctor', 'nurse', 'receptionist', 'ophthalmologist'), getRecentPatients);

router
  .route('/:id')
  .get(logPatientDataAccess, getPatient)
  .put(authorize('admin', 'doctor', 'nurse'), logAction('PATIENT_UPDATE'), updatePatient)
  .delete(authorize('admin'), logAction('PATIENT_DELETE'), deletePatient);

router.get('/:id/history', logPatientDataAccess, getPatientHistory);
router.get('/:id/appointments', logPatientDataAccess, getPatientAppointments);
router.get('/:id/prescriptions', logPatientDataAccess, getPatientPrescriptions);
router.get('/:id/billing', logPatientDataAccess, getPatientBilling);

// Documents
router
  .route('/:id/documents')
  .get(logPatientDataAccess, getPatientDocuments)
  .post(authorize('admin', 'doctor', 'nurse'), uploadPatientDocument);

// Allergies
router
  .route('/:id/allergies')
  .get(logPatientDataAccess, getPatientAllergies)
  .post(authorize('admin', 'doctor', 'nurse'), logAction('ALLERGY_ADD'), addPatientAllergy);

// Medications
router
  .route('/:id/medications')
  .get(logPatientDataAccess, getPatientMedications)
  .post(authorize('admin', 'doctor', 'ophthalmologist'), logAction('MEDICATION_ADD'), addPatientMedication);

// Insurance
router.put('/:id/insurance', authorize('admin', 'receptionist'), logAction('INSURANCE_UPDATE'), updatePatientInsurance);

module.exports = router;