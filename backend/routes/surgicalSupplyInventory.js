const express = require('express');
const router = express.Router();
const { surgicalSupplyInventory: surgicalSupplyInventoryController } = require('../controllers/inventory');
const { protect, authorize } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');

// Protect all routes
router.use(protect);

// ============================================
// REFERENCE DATA (before :id routes)
// ============================================
router.get('/categories', authorize('admin', 'doctor', 'nurse', 'surgeon'), surgicalSupplyInventoryController.getCategories);
router.get('/brands', authorize('admin', 'doctor', 'nurse', 'surgeon'), surgicalSupplyInventoryController.getBrands);
router.get('/iol-types', authorize('admin', 'doctor', 'surgeon'), surgicalSupplyInventoryController.getIOLTypes);

// ============================================
// STATISTICS & REPORTS (before :id routes)
// ============================================
router.get('/stats', authorize('admin', 'doctor', 'surgeon', 'nurse'), logAction('SURGICAL_SUPPLY_STATS_VIEW'), surgicalSupplyInventoryController.getStats);
router.get('/low-stock', authorize('admin', 'surgeon', 'nurse'), logAction('SURGICAL_SUPPLY_LOW_STOCK_VIEW'), surgicalSupplyInventoryController.getLowStock);
router.get('/expiring-soon', authorize('admin', 'surgeon', 'nurse'), logAction('SURGICAL_SUPPLY_EXPIRING_VIEW'), surgicalSupplyInventoryController.getExpiringSoon);
router.get('/alerts', authorize('admin', 'surgeon', 'nurse'), logAction('SURGICAL_SUPPLY_ALERTS_VIEW'), surgicalSupplyInventoryController.getAlerts);
router.get('/search', authorize('admin', 'doctor', 'surgeon', 'nurse'), logAction('SURGICAL_SUPPLY_SEARCH'), surgicalSupplyInventoryController.searchSupplies);

// ============================================
// IOL SPECIFIC ROUTES
// ============================================
router.get('/iol/find-by-power', authorize('admin', 'doctor', 'surgeon'), logAction('IOL_POWER_SEARCH'), surgicalSupplyInventoryController.findIOLByPower);

// ============================================
// CRUD ROUTES
// ============================================
router.get('/', authorize('admin', 'doctor', 'surgeon', 'nurse'), logAction('SURGICAL_SUPPLY_LIST_VIEW'), surgicalSupplyInventoryController.getSupplies);
router.post('/', authorize('admin', 'surgeon'), logAction('SURGICAL_SUPPLY_CREATE'), surgicalSupplyInventoryController.createSupply);
router.get('/:id', authorize('admin', 'doctor', 'surgeon', 'nurse'), logAction('SURGICAL_SUPPLY_VIEW'), surgicalSupplyInventoryController.getSupply);
router.put('/:id', authorize('admin', 'surgeon'), logAction('SURGICAL_SUPPLY_UPDATE'), surgicalSupplyInventoryController.updateSupply);
router.delete('/:id', authorize('admin'), logCriticalOperation('SURGICAL_SUPPLY_DISCONTINUE'), surgicalSupplyInventoryController.deleteSupply);

// ============================================
// STOCK MANAGEMENT ROUTES
// ============================================
router.post('/:id/add-stock', authorize('admin', 'surgeon', 'nurse'), logCriticalOperation('SURGICAL_SUPPLY_STOCK_ADD'), surgicalSupplyInventoryController.addStock);
router.post('/:id/adjust', authorize('admin', 'surgeon'), logCriticalOperation('SURGICAL_SUPPLY_STOCK_ADJUST'), surgicalSupplyInventoryController.adjustStock);

// ============================================
// SURGERY RESERVATION ROUTES
// ============================================
router.post('/:id/reserve', authorize('admin', 'doctor', 'surgeon', 'nurse'), logAction('SURGICAL_SUPPLY_RESERVE'), surgicalSupplyInventoryController.reserveForSurgery);
router.post('/:id/consume', authorize('admin', 'surgeon', 'nurse'), logCriticalOperation('SURGICAL_SUPPLY_CONSUME'), surgicalSupplyInventoryController.consumeForSurgery);
router.post('/:id/release-reservation', authorize('admin', 'surgeon', 'nurse'), logAction('SURGICAL_SUPPLY_RELEASE_RESERVATION'), surgicalSupplyInventoryController.releaseReservation);

// ============================================
// BATCH MANAGEMENT
// ============================================
router.get('/:id/batches', authorize('admin', 'surgeon', 'nurse'), logAction('SURGICAL_SUPPLY_BATCHES_VIEW'), surgicalSupplyInventoryController.getBatches);
router.put('/batches/:batchId', authorize('admin', 'surgeon'), logAction('SURGICAL_SUPPLY_BATCH_UPDATE'), surgicalSupplyInventoryController.updateBatch);
router.post('/batches/:batchId/recall', authorize('admin'), logCriticalOperation('SURGICAL_SUPPLY_BATCH_RECALL'), surgicalSupplyInventoryController.recallBatch);

// ============================================
// ALERT MANAGEMENT
// ============================================
router.post('/alerts/:alertId/acknowledge', authorize('admin', 'surgeon', 'nurse'), logAction('SURGICAL_SUPPLY_ALERT_ACKNOWLEDGE'), surgicalSupplyInventoryController.acknowledgeAlert);

module.exports = router;
