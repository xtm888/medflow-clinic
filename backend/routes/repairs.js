const express = require('express');
const router = express.Router();
const repairController = require('../controllers/repairController');
const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');
const { optionalClinic } = require('../middleware/clinicAuth');

// Protect all routes
router.use(protect);
router.use(optionalClinic);

// Statistics and monitoring
router.get('/stats', requirePermission('view_optical', 'manage_optical'), logAction('REPAIR_STATS_VIEW'), repairController.getStats);
router.get('/ready-for-pickup', requirePermission('view_optical', 'manage_optical'), logAction('REPAIR_READY_VIEW'), repairController.getReadyForPickup);

// Customer repairs
router.get('/customer/:customerId', requirePermission('view_optical', 'view_patients'), logAction('REPAIR_CUSTOMER_VIEW'), repairController.getCustomerRepairs);

// CRUD operations
router.get('/', requirePermission('view_optical', 'manage_optical'), logAction('REPAIR_LIST_VIEW'), repairController.getRepairs);
router.post('/', requirePermission('manage_optical'), logAction('REPAIR_CREATE'), repairController.createRepair);
router.get('/:id', requirePermission('view_optical', 'manage_optical'), logAction('REPAIR_VIEW'), repairController.getRepair);
router.put('/:id', requirePermission('manage_optical'), logAction('REPAIR_UPDATE'), repairController.updateRepair);

// Workflow operations
router.post('/:id/status', requirePermission('manage_optical'), logAction('REPAIR_STATUS_UPDATE'), repairController.updateStatus);
router.post('/:id/parts', requirePermission('manage_optical'), logAction('REPAIR_PART_ADD'), repairController.addPart);
router.post('/:id/labor', requirePermission('manage_optical'), logAction('REPAIR_LABOR_ADD'), repairController.addLabor);
router.post('/:id/customer-approval', requirePermission('manage_optical'), logAction('REPAIR_APPROVAL'), repairController.recordCustomerApproval);
router.post('/:id/quality-check', requirePermission('manage_optical'), logAction('REPAIR_QC'), repairController.performQualityCheck);
router.post('/:id/pickup', requirePermission('manage_optical'), logCriticalOperation('REPAIR_PICKUP'), repairController.completePickup);
router.post('/:id/cancel', requirePermission('manage_optical'), logCriticalOperation('REPAIR_CANCEL'), repairController.cancelRepair);

module.exports = router;
