const express = require('express');
const router = express.Router();
const warrantyController = require('../controllers/warrantyController');
const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');
const { optionalClinic } = require('../middleware/clinicAuth');

// Protect all routes
router.use(protect);
router.use(optionalClinic);

// Statistics and monitoring
router.get('/stats', requirePermission('view_optical', 'manage_optical'), logAction('WARRANTY_STATS_VIEW'), warrantyController.getStats);
router.get('/expiring', requirePermission('view_optical', 'manage_optical'), logAction('WARRANTY_EXPIRING_VIEW'), warrantyController.getExpiringWarranties);

// Customer warranties
router.get('/customer/:customerId', requirePermission('view_optical', 'view_patients'), logAction('WARRANTY_CUSTOMER_VIEW'), warrantyController.getCustomerWarranties);

// CRUD operations
router.get('/', requirePermission('view_optical', 'manage_optical'), logAction('WARRANTY_LIST_VIEW'), warrantyController.getWarranties);
router.post('/', requirePermission('manage_optical'), logAction('WARRANTY_CREATE'), warrantyController.createWarranty);
router.get('/:id', requirePermission('view_optical', 'manage_optical'), logAction('WARRANTY_VIEW'), warrantyController.getWarranty);
router.put('/:id', requirePermission('manage_optical'), logAction('WARRANTY_UPDATE'), warrantyController.updateWarranty);

// Claim operations
router.post('/:id/claims', requirePermission('manage_optical'), logAction('WARRANTY_CLAIM_FILE'), warrantyController.fileClaim);
router.post('/:id/claims/:claimId/approve', requirePermission('manage_optical'), logCriticalOperation('WARRANTY_CLAIM_APPROVE'), warrantyController.approveClaim);
router.post('/:id/claims/:claimId/reject', requirePermission('manage_optical'), logCriticalOperation('WARRANTY_CLAIM_REJECT'), warrantyController.rejectClaim);

// Transfer
router.post('/:id/transfer', requirePermission('manage_optical'), logCriticalOperation('WARRANTY_TRANSFER'), warrantyController.transferWarranty);

module.exports = router;
