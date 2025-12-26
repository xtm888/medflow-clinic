const express = require('express');
const router = express.Router();
// Import from split controller modules (maintains backward compatibility via index.js)
const {
  // Core exam CRUD
  getExams,
  getExam,
  createExam,
  updateExam,
  deleteExam,
  completeExam,

  // Prescription & Refraction
  generateOpticalPrescription,
  saveRefractionData,
  getRefractionHistory,
  copyFromPreviousRefraction,
  createBlankRefraction,
  generateRefractionSummary,
  generateKeratometrySummary,
  markPrescriptionPrinted,
  markPrescriptionViewed,

  // Patient history
  getPatientExamHistory,
  uploadFundusImage,

  // Device integration
  getAvailableDeviceMeasurements,
  linkDeviceMeasurement,
  applyDeviceMeasurement,
  linkDeviceImage,
  getLinkedDeviceMeasurements,
  getLinkedDeviceImages,
  importDeviceMeasurement,

  // Specialized test data
  saveTonometryData,
  saveVisualAcuityData,
  saveOCTResults,
  saveVisualFieldResults,
  saveKeratometryData,
  saveBiometryData,
  saveSlitLampExam,
  saveFundoscopyResults,
  saveDiagnosis,

  // IOL Calculation
  calculateIOLPower,

  // Analysis & Comparison
  compareExams,
  getProgressionAnalysis,
  getTreatmentRecommendations,

  // Reports
  generateExamReport,

  // Templates
  getExamTemplates,
  applyTemplate,

  // Dashboard
  getDashboardStats
} = require('../controllers/ophthalmology');

const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logAction, logPatientDataAccess } = require('../middleware/auditLogger');
const { optionalClinic } = require('../middleware/clinicAuth');

// Protect all routes
router.use(protect);

// MULTI-CLINIC: Apply optional clinic context to all routes
router.use(optionalClinic);

// All ophthalmology routes require perform_eye_exams permission
// (admin, doctor, ophthalmologist, optometrist have this)
router.use(requirePermission('perform_eye_exams'));

// Dashboard stats
router.get('/dashboard-stats', getDashboardStats);

// Base route - API information
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Ophthalmology API',
    version: '1.0.0',
    endpoints: {
      exams: {
        'GET /api/ophthalmology/exams': 'Get all ophthalmology exams',
        'POST /api/ophthalmology/exams': 'Create new exam',
        'GET /api/ophthalmology/exams/:id': 'Get specific exam',
        'PUT /api/ophthalmology/exams/:id': 'Update exam',
        'POST /api/ophthalmology/exams/:id/complete': 'Complete exam'
      },
      patients: {
        'GET /api/ophthalmology/patients/:patientId/history': 'Get patient exam history',
        'GET /api/ophthalmology/patients/:patientId/refraction-history': 'Get refraction history'
      },
      devices: {
        'GET /api/ophthalmology/exams/:id/available-measurements': 'Get available device measurements',
        'POST /api/ophthalmology/exams/:id/link-measurement': 'Link device measurement',
        'POST /api/ophthalmology/exams/:id/link-image': 'Link device image'
      }
    }
  });
});

// Routes
router
  .route('/exams')
  .get(getExams)
  .post(logAction('OPHTHALMOLOGY_EXAM_CREATE'), createExam);

router
  .route('/exams/:id')
  .get(logPatientDataAccess, getExam)
  .put(logAction('OPHTHALMOLOGY_EXAM_UPDATE'), updateExam)
  .delete(authorize('admin'), logAction('OPHTHALMOLOGY_EXAM_DELETE'), deleteExam);

router.put('/exams/:id/complete', logAction('OPHTHALMOLOGY_EXAM_COMPLETE'), completeExam);
router.post('/exams/:id/prescription', logAction('OPTICAL_PRESCRIPTION_CREATE'), generateOpticalPrescription);
router.put('/exams/:id/refraction', saveRefractionData);
router.post('/exams/:id/fundus-image', uploadFundusImage);

// Refraction-specific routes
router.post('/exams/:id/generate-refraction-summary', generateRefractionSummary);
router.post('/exams/:id/generate-keratometry-summary', generateKeratometrySummary);
router.put('/exams/:id/mark-printed', logAction('PRESCRIPTION_PRINTED'), markPrescriptionPrinted);
router.put('/exams/:id/mark-viewed', markPrescriptionViewed);

// Patient-specific routes
router.get('/patients/:patientId/history', logPatientDataAccess, getPatientExamHistory);
router.get('/patients/:patientId/refraction-history', logPatientDataAccess, getRefractionHistory);
router.post('/patients/:patientId/copy-previous-refraction', logAction('REFRACTION_COPY_FROM_PREVIOUS'), copyFromPreviousRefraction);
router.post('/patients/:patientId/blank-refraction', logAction('REFRACTION_CREATE_BLANK'), createBlankRefraction);

// Device integration routes
router.get('/exams/:id/available-measurements', getAvailableDeviceMeasurements);
router.post('/exams/:id/link-measurement', logAction('DEVICE_MEASUREMENT_LINKED'), linkDeviceMeasurement);
router.post('/exams/:id/apply-measurement', logAction('DEVICE_MEASUREMENT_APPLIED'), applyDeviceMeasurement);
router.post('/exams/:id/link-image', logAction('DEVICE_IMAGE_LINKED'), linkDeviceImage);
router.get('/exams/:id/device-measurements', getLinkedDeviceMeasurements);
router.get('/exams/:id/device-images', getLinkedDeviceImages);
router.post('/exams/:id/import-device', logAction('DEVICE_MEASUREMENT_IMPORTED'), importDeviceMeasurement);

// Specialized test data routes
router.put('/exams/:id/tonometry', logAction('TONOMETRY_DATA_SAVED'), saveTonometryData);
router.put('/exams/:id/visual-acuity', logAction('VISUAL_ACUITY_SAVED'), saveVisualAcuityData);
router.put('/exams/:id/oct', logAction('OCT_RESULTS_SAVED'), saveOCTResults);
router.put('/exams/:id/visual-field', logAction('VISUAL_FIELD_SAVED'), saveVisualFieldResults);
router.put('/exams/:id/keratometry', logAction('KERATOMETRY_SAVED'), saveKeratometryData);
router.put('/exams/:id/biometry', logAction('BIOMETRY_SAVED'), saveBiometryData);
router.put('/exams/:id/slit-lamp', logAction('SLIT_LAMP_SAVED'), saveSlitLampExam);
router.put('/exams/:id/fundoscopy', logAction('FUNDOSCOPY_SAVED'), saveFundoscopyResults);
router.put('/exams/:id/diagnosis', logAction('DIAGNOSIS_SAVED'), saveDiagnosis);

// IOL Calculation routes
router.post('/exams/:id/iol-calculation', logAction('IOL_CALCULATION'), calculateIOLPower);
router.post('/patients/:patientId/iol-calculation', logAction('IOL_CALCULATION'), calculateIOLPower);

// Analysis & Comparison routes
router.post('/exams/compare', logAction('EXAM_COMPARISON'), compareExams);
router.get('/patients/:patientId/progression', logPatientDataAccess, getProgressionAnalysis);
router.get('/patients/:patientId/treatment-recommendations', logPatientDataAccess, getTreatmentRecommendations);

// Report generation
router.get('/exams/:id/report', logAction('EXAM_REPORT_GENERATED'), generateExamReport);
router.get('/exams/:id/pdf', logAction('EXAM_PDF_GENERATED'), generateExamReport);

// Template routes
router.get('/templates', getExamTemplates);
router.post('/exams/:id/apply-template', logAction('TEMPLATE_APPLIED'), applyTemplate);

module.exports = router;
