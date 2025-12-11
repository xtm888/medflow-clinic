const express = require('express');
const router = express.Router();
const {
  validateIVTInjection,
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
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');

// All routes require authentication
router.use(protect);

// Validation route - check injection constraints before creating
router.post('/validate', authorize('admin', 'doctor', 'ophthalmologist'), validateIVTInjection);

// Statistics and reporting routes
router.get('/stats', authorize('admin', 'doctor', 'ophthalmologist', 'manager'), logAction('IVT_STATS_VIEW'), getIVTStats);
router.get('/upcoming', authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), logAction('IVT_HISTORY_VIEW'), getUpcomingInjections);
router.get('/due', authorize('admin', 'doctor', 'ophthalmologist', 'nurse'), logAction('IVT_HISTORY_VIEW'), getPatientsDue);

// Patient-specific routes
router.get(
  '/patient/:patientId/history',
  authorize('admin', 'doctor', 'ophthalmologist'),
  logAction('IVT_HISTORY_VIEW'),
  getPatientIVTHistory
);

router.get(
  '/patient/:patientId/treatment-history',
  authorize('admin', 'doctor', 'ophthalmologist'),
  logAction('IVT_HISTORY_VIEW'),
  getTreatmentHistory
);

// Injection-specific routes (must come after patient routes)
router.put(
  '/:id/complete',
  authorize('admin', 'ophthalmologist'),
  logAction('IVT_INJECTION_COMPLETE'),
  completeIVTInjection
);

router.put(
  '/:id/cancel',
  authorize('admin', 'ophthalmologist'),
  logAction('IVT_INJECTION_CANCEL'),
  cancelIVTInjection
);

router.put(
  '/:id/followup',
  authorize('admin', 'doctor', 'ophthalmologist'),
  logAction('IVT_FOLLOWUP_RECORD'),
  recordFollowUp
);

router.put(
  '/:id/plan-next',
  authorize('admin', 'ophthalmologist'),
  logAction('IVT_PLAN_NEXT'),
  planNextInjection
);

// Main CRUD routes
router.route('/')
  .get(
    logAction('IVT_HISTORY_VIEW'),
    getIVTInjections
  )
  .post(
    authorize('admin', 'ophthalmologist'),
    logAction('IVT_INJECTION_CREATE'),
    createIVTInjection
  );

router.route('/:id')
  .get(
    logAction('IVT_INJECTION_VIEW'),
    getIVTInjection
  )
  .put(
    authorize('admin', 'ophthalmologist'),
    logAction('IVT_INJECTION_UPDATE'),
    updateIVTInjection
  )
  .delete(
    authorize('admin'),
    logCriticalOperation('IVT_INJECTION_DELETE'),
    deleteIVTInjection
  );

module.exports = router;
