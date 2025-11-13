const express = require('express');
const router = express.Router();
const {
  getExams,
  getExam,
  createExam,
  updateExam,
  completeExam,
  generateOpticalPrescription,
  saveRefractionData,
  getPatientExamHistory,
  uploadFundusImage
} = require('../controllers/ophthalmologyController');

const { protect, authorize } = require('../middleware/auth');
const { logAction, logPatientDataAccess } = require('../middleware/auditLogger');

// Protect all routes
router.use(protect);
router.use(authorize('ophthalmologist', 'doctor', 'admin'));

// Routes
router
  .route('/exams')
  .get(getExams)
  .post(logAction('OPHTHALMOLOGY_EXAM_CREATE'), createExam);

router
  .route('/exams/:id')
  .get(logPatientDataAccess, getExam)
  .put(logAction('OPHTHALMOLOGY_EXAM_UPDATE'), updateExam);

router.put('/exams/:id/complete', logAction('OPHTHALMOLOGY_EXAM_COMPLETE'), completeExam);
router.post('/exams/:id/prescription', logAction('OPTICAL_PRESCRIPTION_CREATE'), generateOpticalPrescription);
router.put('/exams/:id/refraction', saveRefractionData);
router.post('/exams/:id/fundus-image', uploadFundusImage);

router.get('/patients/:patientId/history', logPatientDataAccess, getPatientExamHistory);

module.exports = router;