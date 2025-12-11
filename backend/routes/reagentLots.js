const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getReagentLots,
  getReagentLot,
  createReagentLot,
  updateReagentLot,
  deleteReagentLot,
  addValidationResult,
  completeValidation,
  waiveValidation,
  activateLot,
  deactivateLot,
  recordUsage,
  getReferenceRange,
  getActiveLot,
  getExpiringSoon,
  getPendingValidation,
  getStats
} = require('../controllers/reagentLotController');

// Protected routes
router.use(protect);

// Stats and special queries (before :id to avoid conflict)
router.get('/stats', getStats);
router.get('/expiring-soon', getExpiringSoon);
router.get('/pending-validation', getPendingValidation);
router.get('/active/:analyzerId/:testCode', getActiveLot);

// CRUD routes
router.route('/')
  .get(getReagentLots)
  .post(authorize('admin', 'lab_manager', 'lab_tech'), createReagentLot);

router.route('/:id')
  .get(getReagentLot)
  .put(authorize('admin', 'lab_manager', 'lab_tech'), updateReagentLot)
  .delete(authorize('admin', 'lab_manager'), deleteReagentLot);

// Reference range
router.get('/:id/reference-range', getReferenceRange);

// Validation workflow
router.post('/:id/validation-results', authorize('admin', 'lab_manager', 'lab_tech'), addValidationResult);
router.post('/:id/complete-validation', authorize('admin', 'lab_manager'), completeValidation);
router.post('/:id/waive-validation', authorize('admin', 'lab_manager'), waiveValidation);

// Activation
router.post('/:id/activate', authorize('admin', 'lab_manager', 'lab_tech'), activateLot);
router.post('/:id/deactivate', authorize('admin', 'lab_manager', 'lab_tech'), deactivateLot);

// Usage tracking
router.post('/:id/record-usage', authorize('admin', 'lab_manager', 'lab_tech'), recordUsage);

module.exports = router;
