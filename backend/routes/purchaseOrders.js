const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');
const { optionalClinic } = require('../middleware/clinicAuth');

// Protect all routes
router.use(protect);
router.use(optionalClinic);

// Statistics and reports
router.get('/stats', requirePermission('manage_inventory'), logAction('PO_STATS_VIEW'), purchaseOrderController.getStats);
router.get('/pending-approvals', requirePermission('approve_purchase_orders'), logAction('PO_PENDING_VIEW'), purchaseOrderController.getPendingApprovals);

// CRUD operations
router.get('/', requirePermission('view_inventory', 'manage_inventory'), logAction('PO_LIST_VIEW'), purchaseOrderController.getPurchaseOrders);
router.post('/', requirePermission('manage_inventory'), logAction('PO_CREATE'), purchaseOrderController.createPurchaseOrder);
router.get('/:id', requirePermission('view_inventory', 'manage_inventory'), logAction('PO_VIEW'), purchaseOrderController.getPurchaseOrder);
router.put('/:id', requirePermission('manage_inventory'), logAction('PO_UPDATE'), purchaseOrderController.updatePurchaseOrder);

// Workflow actions
router.post('/:id/submit', requirePermission('manage_inventory'), logAction('PO_SUBMIT'), purchaseOrderController.submitForApproval);
router.post('/:id/approve', requirePermission('approve_purchase_orders'), logCriticalOperation('PO_APPROVE'), purchaseOrderController.approvePurchaseOrder);
router.post('/:id/reject', requirePermission('approve_purchase_orders'), logCriticalOperation('PO_REJECT'), purchaseOrderController.rejectPurchaseOrder);
router.post('/:id/send', requirePermission('manage_inventory'), logAction('PO_SEND'), purchaseOrderController.markAsSent);
router.post('/:id/receive', requirePermission('manage_inventory'), logCriticalOperation('PO_RECEIVE'), purchaseOrderController.receiveItems);
router.post('/:id/close', requirePermission('manage_inventory'), logAction('PO_CLOSE'), purchaseOrderController.closePurchaseOrder);
router.post('/:id/cancel', requirePermission('manage_inventory'), logCriticalOperation('PO_CANCEL'), purchaseOrderController.cancelPurchaseOrder);

module.exports = router;
