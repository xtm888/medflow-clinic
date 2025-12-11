/**
 * Clinical Alerts Routes
 *
 * API endpoints for clinical alert management in ophthalmology workflows.
 * Supports EMERGENCY (blocking), URGENT/WARNING (banner), and INFO (inline) alerts.
 */

const express = require('express');
const router = express.Router();
const clinicalAlertController = require('../controllers/clinicalAlertController');
const { protect, authorize } = require('../middleware/auth');
const { logAction, logPatientDataAccess } = require('../middleware/auditLogger');

// Protect all routes
router.use(protect);

// ============ Patient Alert Routes ============

// GET /api/clinical-alerts/patient/:patientId - Get active alerts for patient
router.get('/patient/:patientId',
  authorize('doctor', 'ophthalmologist', 'nurse', 'admin'),
  logPatientDataAccess,
  clinicalAlertController.getPatientAlerts
);

// GET /api/clinical-alerts/patient/:patientId/counts - Get alert counts by severity
router.get('/patient/:patientId/counts',
  authorize('doctor', 'ophthalmologist', 'nurse', 'admin'),
  clinicalAlertController.getAlertCounts
);

// GET /api/clinical-alerts/patient/:patientId/emergency - Get emergency alerts only (for blocking modal)
router.get('/patient/:patientId/emergency',
  authorize('doctor', 'ophthalmologist', 'nurse', 'admin'),
  clinicalAlertController.getEmergencyAlerts
);

// ============ Exam Alert Routes ============

// GET /api/clinical-alerts/exam/:examId - Get alerts for specific exam
router.get('/exam/:examId',
  authorize('doctor', 'ophthalmologist', 'nurse', 'admin'),
  clinicalAlertController.getExamAlerts
);

// POST /api/clinical-alerts/exam/:examId/evaluate - Evaluate alerts for exam data
router.post('/exam/:examId/evaluate',
  authorize('doctor', 'ophthalmologist', 'admin'),
  logAction('CLINICAL_ALERT_EVALUATE'),
  clinicalAlertController.evaluateExamAlerts
);

// POST /api/clinical-alerts/exam/:examId/re-evaluate - Re-evaluate after data changes
router.post('/exam/:examId/re-evaluate',
  authorize('doctor', 'ophthalmologist', 'admin'),
  logAction('CLINICAL_ALERT_REEVALUATE'),
  clinicalAlertController.reEvaluateExamAlerts
);

// ============ Individual Alert Actions ============

// GET /api/clinical-alerts/:id - Get single alert details
router.get('/:id',
  authorize('doctor', 'ophthalmologist', 'nurse', 'admin'),
  clinicalAlertController.getAlertById
);

// POST /api/clinical-alerts/:id/acknowledge - Acknowledge alert
router.post('/:id/acknowledge',
  authorize('doctor', 'ophthalmologist', 'nurse', 'admin'),
  logAction('CLINICAL_ALERT_ACKNOWLEDGE'),
  clinicalAlertController.acknowledgeAlert
);

// POST /api/clinical-alerts/:id/acknowledge-emergency - Acknowledge EMERGENCY alert with documentation
// Requires: reason, clinicalJustification - these are mandatory for patient safety
router.post('/:id/acknowledge-emergency',
  authorize('doctor', 'ophthalmologist', 'admin'), // Nurses cannot acknowledge emergencies alone
  logAction('CLINICAL_ALERT_EMERGENCY_ACKNOWLEDGE'),
  clinicalAlertController.acknowledgeEmergencyAlert
);

// POST /api/clinical-alerts/:id/resolve - Resolve alert
router.post('/:id/resolve',
  authorize('doctor', 'ophthalmologist', 'admin'),
  logAction('CLINICAL_ALERT_RESOLVE'),
  clinicalAlertController.resolveAlert
);

// POST /api/clinical-alerts/:id/escalate - Escalate alert to another user
router.post('/:id/escalate',
  authorize('doctor', 'ophthalmologist', 'nurse', 'admin'),
  logAction('CLINICAL_ALERT_ESCALATE'),
  clinicalAlertController.escalateAlert
);

// POST /api/clinical-alerts/:id/dismiss - Dismiss alert
router.post('/:id/dismiss',
  authorize('doctor', 'ophthalmologist', 'admin'),
  logAction('CLINICAL_ALERT_DISMISS'),
  clinicalAlertController.dismissAlert
);

// POST /api/clinical-alerts/:id/complete-action - Mark recommended action as complete
router.post('/:id/complete-action',
  authorize('doctor', 'ophthalmologist', 'nurse', 'admin'),
  logAction('CLINICAL_ALERT_ACTION_COMPLETE'),
  clinicalAlertController.completeRecommendedAction
);

// ============ Bulk Operations ============

// POST /api/clinical-alerts/bulk-acknowledge - Acknowledge multiple alerts
router.post('/bulk-acknowledge',
  authorize('doctor', 'ophthalmologist', 'nurse', 'admin'),
  logAction('CLINICAL_ALERT_BULK_ACKNOWLEDGE'),
  clinicalAlertController.bulkAcknowledge
);

// ============ Manual Alert Creation ============

// POST /api/clinical-alerts - Create manual alert
router.post('/',
  authorize('doctor', 'ophthalmologist', 'admin'),
  logAction('CLINICAL_ALERT_CREATE'),
  clinicalAlertController.createManualAlert
);

// ============ Configuration Routes ============

// GET /api/clinical-alerts/rules - Get available alert rules (for configuration)
router.get('/config/rules',
  authorize('doctor', 'ophthalmologist', 'admin'),
  clinicalAlertController.getAlertRules
);

module.exports = router;
