const express = require('express');
const router = express.Router();
const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logCriticalOperation } = require('../middleware/auditLogger');
const laboratoryController = require('../controllers/laboratory');
const { optionalClinic } = require('../middleware/clinicAuth');

// Protect all routes and add clinic context
router.use(protect);
router.use(optionalClinic);

// ============================================
// TEMPLATE ROUTES
// ============================================
router.get('/templates', requirePermission('view_lab_orders'), laboratoryController.getTemplates);
router.get('/templates/:id', requirePermission('view_lab_orders'), laboratoryController.getTemplate);
router.post('/templates', requirePermission('enter_results'), laboratoryController.createTemplate);
router.put('/templates/:id', requirePermission('enter_results'), laboratoryController.updateTemplate);
router.delete('/templates/:id', requirePermission('manage_system'), laboratoryController.deleteTemplate);

// ============================================
// TEST ORDER ROUTES
// ============================================
router.get('/tests', requirePermission('view_lab_orders'), laboratoryController.getAllTests);
router.get('/pending', requirePermission('view_lab_orders'), laboratoryController.getPendingTests);
router.get('/completed', requirePermission('view_lab_orders'), laboratoryController.getCompletedTests);
router.post('/tests', requirePermission('view_lab_orders', 'order_imaging'), laboratoryController.orderTests);

// ============================================
// RESULT ENTRY ROUTES - CRITICAL
// ============================================
router.put('/tests/:visitId/:testId', requirePermission('view_lab_orders', 'enter_results'), logCriticalOperation('LAB_RESULT_UPDATE'), laboratoryController.updateTestResults);
router.put('/tests/:visitId/:testId/results', requirePermission('view_lab_orders', 'enter_results'), logCriticalOperation('LAB_RESULT_ENTRY'), laboratoryController.enterResults);
router.get('/tests/:visitId/:testId/results', requirePermission('view_lab_orders'), laboratoryController.getTestResults);

// ============================================
// RESULT VALIDATION ROUTES
// ============================================
router.post('/validate-result', requirePermission('view_lab_orders'), laboratoryController.validateResult);
router.post('/check-abnormal', requirePermission('view_lab_orders'), laboratoryController.checkAbnormalValues);

// ============================================
// SPECIMEN TRACKING ROUTES
// ============================================
router.post('/specimens', requirePermission('collect_specimens'), laboratoryController.registerSpecimen);
// IMPORTANT: Specific routes must come BEFORE parameterized routes
router.get('/specimens/barcode/:barcode', requirePermission('enter_results'), laboratoryController.getSpecimenByBarcode);
router.get('/specimens', requirePermission('view_lab_orders'), laboratoryController.getAllSpecimens);
router.put('/specimens/:specimenId', requirePermission('enter_results'), laboratoryController.updateSpecimenStatus);
router.get('/specimens/:specimenId', requirePermission('view_lab_orders'), laboratoryController.getSpecimenDetails);

// ============================================
// REPORT & PRINT ROUTES - CRITICAL
// ============================================
router.get('/report/:visitId', requirePermission('view_lab_orders'), laboratoryController.generateReport);
router.get('/report/:visitId/pdf', requirePermission('view_lab_orders'), laboratoryController.generatePDF);
router.get('/report/:visitId/print', requirePermission('view_lab_orders'), laboratoryController.getPrintableReport);

// ============================================
// STATISTICS
// ============================================
router.get('/stats', requirePermission('enter_results'), laboratoryController.getStatistics);
router.get('/stats/turnaround', requirePermission('enter_results'), laboratoryController.getTurnaroundStats);

// ============================================
// WORKLIST ROUTES
// ============================================
router.get('/worklist', requirePermission('collect_specimens'), laboratoryController.getWorklist);
router.put('/worklist/:testId/collect', requirePermission('collect_specimens'), laboratoryController.markCollected);
router.put('/worklist/:testId/start', requirePermission('enter_results'), laboratoryController.startProcessing);

// Alias routes for frontend compatibility
router.put('/tests/:testId/in-progress', requirePermission('view_lab_orders', 'enter_results'), laboratoryController.startProcessing);

// ============================================
// BILLING ROUTES
// ============================================
router.post('/invoice/:visitId', requirePermission('manage_billing'), laboratoryController.generateLabInvoice);
router.get('/unbilled/:patientId', requirePermission('manage_billing'), laboratoryController.getUnbilledTests);

// ============================================
// QC (QUALITY CONTROL) ROUTES
// ============================================
router.post('/qc', requirePermission('enter_results'), laboratoryController.recordQCData);
router.get('/qc/history', requirePermission('enter_results'), laboratoryController.getQCHistory);

// ============================================
// DELTA/TRENDING ROUTES
// ============================================
router.get('/trends/:patientId/:testCode', requirePermission('view_lab_orders'), laboratoryController.getPatientTrends);
router.post('/calculate-delta', requirePermission('enter_results'), laboratoryController.calculateDelta);

// ============================================
// TUBE CONSUMPTION ROUTES
// ============================================
router.post('/specimens/consume-tube', requirePermission('collect_specimens'), laboratoryController.consumeTubeForSpecimen);
router.get('/tubes/available', requirePermission('collect_specimens'), laboratoryController.getAvailableTubes);
router.get('/tubes/suggest/:templateId', requirePermission('view_lab_orders'), laboratoryController.suggestTubesForTest);

module.exports = router;
