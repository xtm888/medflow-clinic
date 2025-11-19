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
router.get('/stats', getOrthopticStats);

// Patient-specific routes
router.get(
  '/patient/:patientId/history',
  authorize('admin', 'doctor', 'ophthalmologist', 'nurse'),
  getPatientOrthopticHistory
);

router.get(
  '/patient/:patientId/progress',
  authorize('admin', 'doctor', 'ophthalmologist', 'nurse'),
  getTreatmentProgress
);

// Exam-specific routes (must come after patient routes)
router.get('/:id/compare', compareWithPrevious);
router.get('/:id/report', generateReport);
router.put(
  '/:id/complete',
  authorize('admin', 'doctor', 'ophthalmologist', 'nurse'),
  completeOrthopticExam
);
router.put(
  '/:id/sign',
  authorize('admin', 'doctor', 'ophthalmologist'),
  signOrthopticExam
);
router.post(
  '/:id/attachments',
  authorize('admin', 'doctor', 'ophthalmologist', 'nurse'),
  addAttachment
);

// Main CRUD routes
router.route('/')
  .get(getOrthopticExams)
  .post(
    authorize('admin', 'doctor', 'ophthalmologist', 'nurse'),
    createOrthopticExam
  );

router.route('/:id')
  .get(getOrthopticExam)
  .put(
    authorize('admin', 'doctor', 'ophthalmologist', 'nurse'),
    updateOrthopticExam
  )
  .delete(
    authorize('admin'),
    deleteOrthopticExam
  );

module.exports = router;
