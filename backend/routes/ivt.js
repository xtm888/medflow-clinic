const express = require('express');
const router = express.Router();
const {
  createIVTInjection,
  getIVTInjections,
  getIVTInjection,
  updateIVTInjection,
  completeIVTInjection,
  cancelIVTInjection,
  recordFollowUp,
  planNextInjection,
  getPatientIVTHistory,
  getTreatmentHistory,
  getUpcomingInjections,
  getPatientsDue,
  getIVTStats,
  deleteIVTInjection
} = require('../controllers/ivtController');

const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Statistics and reporting routes
router.get('/stats', getIVTStats);
router.get('/upcoming', getUpcomingInjections);
router.get('/due', getPatientsDue);

// Patient-specific routes
router.get(
  '/patient/:patientId/history',
  authorize('admin', 'doctor', 'ophthalmologist'),
  getPatientIVTHistory
);

router.get(
  '/patient/:patientId/treatment-history',
  authorize('admin', 'doctor', 'ophthalmologist'),
  getTreatmentHistory
);

// Injection-specific routes (must come after patient routes)
router.put(
  '/:id/complete',
  authorize('admin', 'ophthalmologist'),
  completeIVTInjection
);

router.put(
  '/:id/cancel',
  authorize('admin', 'ophthalmologist'),
  cancelIVTInjection
);

router.put(
  '/:id/followup',
  authorize('admin', 'doctor', 'ophthalmologist'),
  recordFollowUp
);

router.put(
  '/:id/plan-next',
  authorize('admin', 'ophthalmologist'),
  planNextInjection
);

// Main CRUD routes
router.route('/')
  .get(getIVTInjections)
  .post(
    authorize('admin', 'ophthalmologist'),
    createIVTInjection
  );

router.route('/:id')
  .get(getIVTInjection)
  .put(
    authorize('admin', 'ophthalmologist'),
    updateIVTInjection
  )
  .delete(
    authorize('admin'),
    deleteIVTInjection
  );

module.exports = router;
