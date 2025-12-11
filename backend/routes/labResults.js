const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');
const labOrderController = require('../controllers/laboratory');

// Protect all routes
router.use(protect);

// ============================================
// LAB RESULT ROUTES
// ============================================

// Get unacknowledged critical results (before :id routes)
router.get('/critical-unacknowledged',
  authorize('admin', 'doctor', 'ophthalmologist', 'lab_technician'),
  labOrderController.getUnacknowledgedCritical
);

// Get patient lab results
router.get('/patient/:patientId',
  authorize('admin', 'doctor', 'ophthalmologist', 'nurse'),
  labOrderController.getPatientResults
);

// Get patient test history for specific test
router.get('/patient/:patientId/test/:testCode',
  authorize('admin', 'doctor', 'ophthalmologist', 'lab_technician'),
  labOrderController.getTestHistory
);

// Main result CRUD routes
router.route('/')
  .get(
    authorize('admin', 'doctor', 'ophthalmologist', 'lab_technician', 'nurse'),
    logAction('LAB_RESULT_VIEW'),
    labOrderController.getResults
  )
  .post(
    authorize('admin', 'lab_technician'),
    logAction('LAB_RESULT_ENTER'),
    labOrderController.createResult
  );

router.route('/:id')
  .get(
    authorize('admin', 'doctor', 'ophthalmologist', 'lab_technician', 'nurse'),
    logAction('LAB_RESULT_VIEW'),
    labOrderController.getResult
  );

// Result workflow routes
router.put('/:id/verify',
  authorize('admin', 'lab_technician', 'doctor'),
  logCriticalOperation('LAB_RESULT_VERIFY'),
  labOrderController.verifyResult
);

router.put('/:id/correct',
  authorize('admin', 'lab_technician'),
  logAction('LAB_RESULT_UPDATE'),
  labOrderController.correctResult
);

router.put('/:id/acknowledge-critical',
  authorize('admin', 'doctor', 'ophthalmologist'),
  logCriticalOperation('LAB_CRITICAL_VALUE_ACKNOWLEDGE'),
  labOrderController.acknowledgeCritical
);

module.exports = router;
