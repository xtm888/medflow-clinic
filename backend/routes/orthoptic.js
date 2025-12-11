const express = require('express');
const router = express.Router();
const {
  createOrthopticExam,
  getOrthopticExams,
  getOrthopticExam,
  updateOrthopticExam,
  completeOrthopticExam,
  signOrthopticExam,
  getPatientOrthopticHistory,
  getTreatmentProgress,
  compareWithPrevious,
  generateReport,
  deleteOrthopticExam,
  addAttachment,
  getOrthopticStats
} = require('../controllers/orthopticController');

const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Statistics route
router.get('/stats', authorize('admin', 'doctor', 'ophthalmologist', 'orthoptist', 'nurse', 'manager'), getOrthopticStats);

// Patient-specific routes
router.get(
  '/patient/:patientId/history',
  authorize('admin', 'doctor', 'ophthalmologist', 'orthoptist', 'nurse'),
  getPatientOrthopticHistory
);

router.get(
  '/patient/:patientId/progress',
  authorize('admin', 'doctor', 'ophthalmologist', 'orthoptist', 'nurse'),
  getTreatmentProgress
);

// Exam-specific routes (must come after patient routes)
router.get('/:id/compare', authorize('admin', 'doctor', 'ophthalmologist', 'orthoptist'), compareWithPrevious);
router.get('/:id/report', authorize('admin', 'doctor', 'ophthalmologist', 'orthoptist'), generateReport);
router.put(
  '/:id/complete',
  authorize('admin', 'doctor', 'ophthalmologist', 'orthoptist', 'nurse'),
  completeOrthopticExam
);
router.put(
  '/:id/sign',
  authorize('admin', 'doctor', 'ophthalmologist', 'orthoptist'),
  signOrthopticExam
);
router.post(
  '/:id/attachments',
  authorize('admin', 'doctor', 'ophthalmologist', 'orthoptist', 'nurse'),
  addAttachment
);

// Main CRUD routes
router.route('/')
  .get(authorize('admin', 'doctor', 'ophthalmologist', 'orthoptist', 'nurse'), getOrthopticExams)
  .post(
    authorize('admin', 'doctor', 'ophthalmologist', 'orthoptist'),
    createOrthopticExam
  );

router.route('/:id')
  .get(authorize('admin', 'doctor', 'ophthalmologist', 'orthoptist', 'nurse'), getOrthopticExam)
  .put(
    authorize('admin', 'doctor', 'ophthalmologist', 'orthoptist'),
    updateOrthopticExam
  )
  .delete(
    authorize('admin'),
    deleteOrthopticExam
  );

module.exports = router;
