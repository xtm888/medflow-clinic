const express = require('express');
const router = express.Router();
const stockReconciliationController = require('../controllers/stockReconciliationController');
const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');
const { optionalClinic } = require('../middleware/clinicAuth');

// Protect all routes
router.use(protect);
router.use(optionalClinic);

// Statistics
router.get('/stats', requirePermission('manage_inventory'), logAction('RECON_STATS_VIEW'), stockReconciliationController.getStats);

// CRUD operations
router.get('/', requirePermission('view_inventory', 'manage_inventory'), logAction('RECON_LIST_VIEW'), stockReconciliationController.getReconciliations);
router.post('/', requirePermission('manage_inventory'), logAction('RECON_CREATE'), stockReconciliationController.createReconciliation);
router.get('/:id', requirePermission('view_inventory', 'manage_inventory'), logAction('RECON_VIEW'), stockReconciliationController.getReconciliation);

// Workflow actions
router.post('/:id/start', requirePermission('manage_inventory'), logAction('RECON_START'), stockReconciliationController.startReconciliation);
router.post('/:id/count', requirePermission('manage_inventory'), logAction('RECON_COUNT'), stockReconciliationController.addCount);
router.post('/:id/bulk-count', requirePermission('manage_inventory'), logAction('RECON_BULK_COUNT'), stockReconciliationController.bulkAddCounts);
router.post('/:id/submit', requirePermission('manage_inventory'), logAction('RECON_SUBMIT'), stockReconciliationController.submitForReview);
router.post('/:id/apply', requirePermission('manage_inventory'), logCriticalOperation('RECON_APPLY'), stockReconciliationController.applyAdjustments);
router.post('/:id/complete', requirePermission('manage_inventory'), logCriticalOperation('RECON_COMPLETE'), stockReconciliationController.completeReconciliation);
router.post('/:id/cancel', requirePermission('manage_inventory'), logAction('RECON_CANCEL'), stockReconciliationController.cancelReconciliation);

// Reports
router.get('/:id/variance-report', requirePermission('view_inventory', 'manage_inventory'), logAction('RECON_VARIANCE_VIEW'), stockReconciliationController.getVarianceReport);

module.exports = router;
