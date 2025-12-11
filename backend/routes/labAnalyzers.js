const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAnalyzers,
  getAnalyzer,
  createAnalyzer,
  updateAnalyzer,
  deleteAnalyzer,
  addSupportedTest,
  removeSupportedTest,
  updateStatus,
  getAnalyzersForTest,
  getStats,
  setActiveReagentLot
} = require('../controllers/laboratory');

// Public routes (none)

// Protected routes
router.use(protect);

// Stats route (before :id to avoid conflict)
router.get('/stats', getStats);

// Get analyzers for specific test
router.get('/for-test/:testCode', getAnalyzersForTest);

// CRUD routes
router.route('/')
  .get(getAnalyzers)
  .post(authorize('admin', 'lab_manager'), createAnalyzer);

router.route('/:id')
  .get(getAnalyzer)
  .put(authorize('admin', 'lab_manager'), updateAnalyzer)
  .delete(authorize('admin'), deleteAnalyzer);

// Test management
router.route('/:id/tests')
  .post(authorize('admin', 'lab_manager'), addSupportedTest);

router.delete('/:id/tests/:testCode', authorize('admin', 'lab_manager'), removeSupportedTest);

// Status update
router.put('/:id/status', authorize('admin', 'lab_manager', 'lab_tech'), updateStatus);

// Active reagent lot
router.post('/:id/active-lot', authorize('admin', 'lab_manager', 'lab_tech'), setActiveReagentLot);

module.exports = router;
