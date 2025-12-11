const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getConsolidatedInventory,
  getAlerts,
  getSummary,
  createQuickTransfer
} = require('../controllers/crossClinicInventoryController');

// All routes require authentication
router.use(protect);

// Only admin, manager, depot_manager can access these routes
router.use(authorize('admin', 'manager', 'depot_manager'));

// Dashboard summary
router.get('/summary', getSummary);

// Alerts (stock-out, low-stock across clinics)
router.get('/alerts', getAlerts);

// Consolidated inventory view
router.get('/', getConsolidatedInventory);

// Quick transfer from recommendations
router.post('/quick-transfer', createQuickTransfer);

module.exports = router;
