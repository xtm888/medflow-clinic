const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approvalController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Check approval (before :id routes)
router.get('/check', approvalController.checkApproval);

// Check approval requirements for multiple acts (for consultation warnings)
router.post('/check-requirements', approvalController.checkApprovalRequirements);

// Expiring approvals
router.get('/expiring', approvalController.getExpiringApprovals);

// Patient approvals
router.get('/patient/:patientId', approvalController.getPatientApprovals);

// Company pending approvals
router.get('/company/:companyId/pending', approvalController.getPendingForCompany);

// Main CRUD routes
router.route('/')
  .get(approvalController.getApprovals)
  .post(approvalController.createApproval);

router.route('/:id')
  .get(approvalController.getApproval);

// Approval actions
router.put('/:id/approve', authorize('admin', 'billing', 'manager'), approvalController.approveRequest);
router.put('/:id/reject', authorize('admin', 'billing', 'manager'), approvalController.rejectRequest);
router.put('/:id/use', approvalController.useApproval);
router.put('/:id/cancel', approvalController.cancelApproval);

// Documents
router.post('/:id/documents', approvalController.attachDocument);

module.exports = router;
