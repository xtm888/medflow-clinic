const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getTransfers,
  getTransfer,
  createTransfer,
  submitTransfer,
  approveTransfer,
  rejectTransfer,
  shipTransfer,
  receiveTransfer,
  cancelTransfer,
  getStats,
  getRecommendations
} = require('../controllers/inventoryTransferController');
const {
  validateInventoryTransferCreate,
  validateInventoryTransferUpdate,
  validateObjectIdParam
} = require('../middleware/validation');

// All routes require authentication
router.use(protect);

// Stats and recommendations
router.get('/stats', getStats);
router.get('/recommendations', authorize('admin', 'manager', 'depot_manager'), getRecommendations);

// CRUD operations
router.route('/')
  .get(getTransfers)
  .post(validateInventoryTransferCreate, createTransfer);

router.route('/:id')
  .get(validateObjectIdParam, getTransfer);

// Workflow actions
router.post('/:id/submit', validateObjectIdParam, submitTransfer);
router.post('/:id/approve', validateObjectIdParam, authorize('admin', 'manager', 'depot_manager', 'pharmacist'), approveTransfer);
router.post('/:id/reject', validateObjectIdParam, authorize('admin', 'manager', 'depot_manager'), rejectTransfer);
router.post('/:id/ship', validateObjectIdParam, shipTransfer);
router.post('/:id/receive', validateInventoryTransferUpdate, receiveTransfer);
router.post('/:id/cancel', validateObjectIdParam, cancelTransfer);

module.exports = router;
