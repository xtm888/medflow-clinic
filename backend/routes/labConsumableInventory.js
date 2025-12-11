const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');
const {
  getConsumables,
  getConsumable,
  createConsumable,
  updateConsumable,
  deleteConsumable,
  addBatch,
  consumeItem,
  adjustStock,
  markDamaged,
  getLowStock,
  getByCategory,
  getCollectionTubes,
  getTubeStats,
  getAlerts,
  resolveAlert,
  getStats,
  getInventoryValue,
  searchConsumables,
  getTransactions,
  getManufacturers,
  getCategories,
  getTubeTypes
} = require('../controllers/inventory').labConsumableInventory;

// All routes require authentication
router.use(protect);

// ============================================
// REPORTS & UTILITY ROUTES (must be before /:id)
// ============================================
router.get('/low-stock', authorize('admin', 'lab_technician', 'manager'), logAction('LAB_CONSUMABLE_LOW_STOCK_VIEW'), getLowStock);
router.get('/alerts', authorize('admin', 'lab_technician', 'manager'), logAction('LAB_CONSUMABLE_ALERTS_VIEW'), getAlerts);
router.get('/stats', authorize('admin', 'lab_technician', 'manager', 'accountant'), logAction('LAB_CONSUMABLE_STATS_VIEW'), getStats);
router.get('/value', authorize('admin', 'manager', 'accountant'), logAction('LAB_CONSUMABLE_VALUE_VIEW'), getInventoryValue);
router.get('/search', authorize('admin', 'lab_technician', 'nurse'), logAction('LAB_CONSUMABLE_SEARCH'), searchConsumables);
router.get('/manufacturers', authorize('admin', 'lab_technician'), logAction('LAB_CONSUMABLE_MANUFACTURERS_VIEW'), getManufacturers);
router.get('/categories', authorize('admin', 'lab_technician', 'nurse'), logAction('LAB_CONSUMABLE_CATEGORY_VIEW'), getCategories);
router.get('/tube-types', authorize('admin', 'lab_technician', 'nurse'), logAction('LAB_CONSUMABLE_TUBES_VIEW'), getTubeTypes);
router.get('/tubes', authorize('admin', 'lab_technician', 'nurse'), logAction('LAB_CONSUMABLE_TUBES_VIEW'), getCollectionTubes);
router.get('/tubes/stats', authorize('admin', 'lab_technician', 'manager'), logAction('LAB_CONSUMABLE_TUBE_STATS_VIEW'), getTubeStats);
router.get('/category/:category', authorize('admin', 'lab_technician'), logAction('LAB_CONSUMABLE_CATEGORY_VIEW'), getByCategory);

// ============================================
// CRUD ROUTES
// ============================================
router.route('/')
  .get(authorize('admin', 'lab_technician', 'manager', 'nurse'), logAction('LAB_CONSUMABLE_LIST_VIEW'), getConsumables)
  .post(authorize('admin', 'lab_technician'), logAction('LAB_CONSUMABLE_CREATE'), createConsumable);

router.route('/:id')
  .get(authorize('admin', 'lab_technician', 'manager', 'nurse'), logAction('LAB_CONSUMABLE_VIEW'), getConsumable)
  .put(authorize('admin', 'lab_technician'), logAction('LAB_CONSUMABLE_UPDATE'), updateConsumable)
  .delete(authorize('admin'), logCriticalOperation('LAB_CONSUMABLE_DELETE'), deleteConsumable);

// ============================================
// STOCK OPERATIONS
// ============================================
router.post('/:id/batches', authorize('admin', 'lab_technician'), logCriticalOperation('LAB_CONSUMABLE_BATCH_ADD'), addBatch);
router.post('/:id/consume', authorize('admin', 'lab_technician', 'nurse'), logCriticalOperation('LAB_CONSUMABLE_CONSUME'), consumeItem);
router.post('/:id/adjust', authorize('admin', 'lab_technician'), logCriticalOperation('LAB_CONSUMABLE_ADJUST'), adjustStock);
router.post('/:id/damage', authorize('admin', 'lab_technician'), logCriticalOperation('LAB_CONSUMABLE_DAMAGE'), markDamaged);

// ============================================
// HISTORY
// ============================================
router.get('/:id/transactions', authorize('admin', 'lab_technician', 'manager'), logAction('LAB_CONSUMABLE_TRANSACTIONS_VIEW'), getTransactions);

// ============================================
// ALERT MANAGEMENT
// ============================================
router.put('/:id/alerts/:alertId/resolve', authorize('admin', 'lab_technician'), logAction('LAB_CONSUMABLE_ALERT_RESOLVE'), resolveAlert);

module.exports = router;
