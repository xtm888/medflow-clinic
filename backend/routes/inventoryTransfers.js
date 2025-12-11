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

// All routes require authentication
router.use(protect);

// Stats and recommendations
router.get('/stats', getStats);
router.get('/recommendations', authorize('admin', 'manager', 'depot_manager'), getRecommendations);

// CRUD operations
router.route('/')
  .get(getTransfers)
  .post(createTransfer);

router.route('/:id')
  .get(getTransfer);

// Workflow actions
router.post('/:id/submit', submitTransfer);
router.post('/:id/approve', authorize('admin', 'manager', 'depot_manager', 'pharmacist'), approveTransfer);
router.post('/:id/reject', authorize('admin', 'manager', 'depot_manager'), rejectTransfer);
router.post('/:id/ship', shipTransfer);
router.post('/:id/receive', receiveTransfer);
router.post('/:id/cancel', cancelTransfer);

module.exports = router;
