const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getConversions,
  getConversion,
  convertValue,
  batchConvert,
  getAvailableUnits,
  createConversion,
  updateConversion,
  deleteConversion,
  seedConversions,
  getCategories,
  getConversionFactor
} = require('../controllers/unitConversionController');

// Protected routes
router.use(protect);

// Categories route
router.get('/categories', getCategories);

// Seed route (admin only)
router.post('/seed', authorize('admin'), seedConversions);

// Convert routes
router.post('/convert', convertValue);
router.post('/batch-convert', batchConvert);

// CRUD routes
router.route('/')
  .get(getConversions)
  .post(authorize('admin', 'lab_manager'), createConversion);

// Specific test code routes
router.route('/:testCode')
  .get(getConversion)
  .put(authorize('admin', 'lab_manager'), updateConversion)
  .delete(authorize('admin'), deleteConversion);

// Units and factor for specific test
router.get('/:testCode/units', getAvailableUnits);
router.get('/:testCode/factor', getConversionFactor);

module.exports = router;
