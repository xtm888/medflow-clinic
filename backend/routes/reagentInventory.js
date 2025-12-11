const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');
const {
  getReagents,
  getReagent,
  createReagent,
  updateReagent,
  deleteReagent,
  addBatch,
  consumeReagent,
  consumeForQC,
  adjustStock,
  expireBatch,
  disposeReagent,
  getLowStock,
  getExpiring,
  getBySection,
  getAlerts,
  resolveAlert,
  getStats,
  getInventoryValue,
  searchReagents,
  getTransactions,
  getQCHistory,
  linkTemplate,
  getManufacturers
} = require('../controllers/inventory').reagentInventory;

// All routes require authentication
router.use(protect);

// ============================================
// REPORTS & UTILITY ROUTES (must be before /:id)
// ============================================
router.get('/low-stock', authorize('admin', 'lab_technician', 'manager'), logAction('REAGENT_LOW_STOCK_VIEW'), getLowStock);
router.get('/expiring', authorize('admin', 'lab_technician', 'manager'), logAction('REAGENT_EXPIRING_VIEW'), getExpiring);
router.get('/alerts', authorize('admin', 'lab_technician', 'manager'), logAction('REAGENT_ALERT_VIEW'), getAlerts);
router.get('/stats', authorize('admin', 'lab_technician', 'manager', 'accountant'), logAction('REAGENT_STATS_VIEW'), getStats);
router.get('/value', authorize('admin', 'manager', 'accountant'), logAction('REAGENT_VALUE_VIEW'), getInventoryValue);
router.get('/search', authorize('admin', 'lab_technician', 'doctor', 'ophthalmologist'), logAction('REAGENT_SEARCH'), searchReagents);
router.get('/manufacturers', authorize('admin', 'lab_technician'), logAction('REAGENT_MANUFACTURERS_VIEW'), getManufacturers);
router.get('/section/:section', authorize('admin', 'lab_technician'), logAction('REAGENT_SECTION_VIEW'), getBySection);

// ============================================
// CRUD ROUTES
// ============================================
router.route('/')
  .get(authorize('admin', 'lab_technician', 'manager'), logAction('REAGENT_LIST_VIEW'), getReagents)
  .post(authorize('admin', 'lab_technician'), logAction('REAGENT_CREATE'), createReagent);

router.route('/:id')
  .get(authorize('admin', 'lab_technician', 'manager'), logAction('REAGENT_VIEW'), getReagent)
  .put(authorize('admin', 'lab_technician'), logAction('REAGENT_UPDATE'), updateReagent)
  .delete(authorize('admin'), logCriticalOperation('REAGENT_DELETE'), deleteReagent);

// ============================================
// STOCK OPERATIONS
// ============================================
router.post('/:id/batches', authorize('admin', 'lab_technician'), logCriticalOperation('REAGENT_BATCH_ADD'), addBatch);
router.post('/:id/consume', authorize('admin', 'lab_technician'), logCriticalOperation('REAGENT_CONSUME'), consumeReagent);
router.post('/:id/consume-qc', authorize('admin', 'lab_technician'), logAction('REAGENT_CONSUME_QC'), consumeForQC);
router.post('/:id/adjust', authorize('admin', 'lab_technician'), logCriticalOperation('REAGENT_ADJUST'), adjustStock);
router.post('/:id/expire-batch', authorize('admin', 'lab_technician'), logCriticalOperation('REAGENT_BATCH_EXPIRE'), expireBatch);
router.post('/:id/dispose', authorize('admin', 'lab_technician'), logCriticalOperation('REAGENT_DISPOSE'), disposeReagent);

// ============================================
// HISTORY & LINKING
// ============================================
router.get('/:id/transactions', authorize('admin', 'lab_technician', 'manager'), logAction('REAGENT_TRANSACTIONS_VIEW'), getTransactions);
router.get('/:id/qc-history', authorize('admin', 'lab_technician'), logAction('REAGENT_QC_HISTORY_VIEW'), getQCHistory);
router.post('/:id/link-template', authorize('admin', 'lab_technician'), logAction('REAGENT_LINK_TEMPLATE'), linkTemplate);

// ============================================
// ALERT MANAGEMENT
// ============================================
router.put('/:id/alerts/:alertId/resolve', authorize('admin', 'lab_technician'), logAction('REAGENT_ALERT_RESOLVE'), resolveAlert);

module.exports = router;
