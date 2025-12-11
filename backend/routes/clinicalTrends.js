/**
 * Clinical Trends Routes
 *
 * API endpoints for retrieving clinical trend data for ophthalmology patients.
 * Supports IOP, Visual Acuity, Cup/Disc ratio, and Refraction trend analysis.
 */

const express = require('express');
const router = express.Router();
const clinicalTrendController = require('../controllers/clinicalTrendController');
const { protect, authorize } = require('../middleware/auth');
const { logPatientDataAccess } = require('../middleware/auditLogger');

// Protect all routes
router.use(protect);
router.use(authorize('doctor', 'ophthalmologist', 'nurse', 'admin'));

// ============ IOP Trends ============

// GET /api/clinical-trends/patient/:patientId/iop - Get IOP trend data
router.get('/patient/:patientId/iop',
  logPatientDataAccess,
  clinicalTrendController.getIOPTrends
);

// ============ Visual Acuity Trends ============

// GET /api/clinical-trends/patient/:patientId/visual-acuity - Get VA trend data
router.get('/patient/:patientId/visual-acuity',
  logPatientDataAccess,
  clinicalTrendController.getVisualAcuityTrends
);

// ============ Cup/Disc Ratio Trends ============

// GET /api/clinical-trends/patient/:patientId/cup-disc - Get C/D ratio trend data
router.get('/patient/:patientId/cup-disc',
  logPatientDataAccess,
  clinicalTrendController.getCupDiscTrends
);

// ============ Refraction Trends ============

// GET /api/clinical-trends/patient/:patientId/refraction - Get refraction trend data
router.get('/patient/:patientId/refraction',
  logPatientDataAccess,
  clinicalTrendController.getRefractionTrends
);

// ============ Pachymetry Trends ============

// GET /api/clinical-trends/patient/:patientId/pachymetry - Get corneal thickness trends
router.get('/patient/:patientId/pachymetry',
  logPatientDataAccess,
  clinicalTrendController.getPachymetryTrends
);

// ============ Combined Trends ============

// GET /api/clinical-trends/patient/:patientId/all - Get all trend data combined
router.get('/patient/:patientId/all',
  logPatientDataAccess,
  clinicalTrendController.getAllTrends
);

// GET /api/clinical-trends/patient/:patientId/summary - Get trend summary with alerts
router.get('/patient/:patientId/summary',
  logPatientDataAccess,
  clinicalTrendController.getTrendSummary
);

// ============ Comparison ============

// POST /api/clinical-trends/compare - Compare two exams
router.post('/compare',
  clinicalTrendController.compareExams
);

module.exports = router;
