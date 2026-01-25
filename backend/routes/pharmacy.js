const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacyController');
const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');
const { optionalClinic } = require('../middleware/clinicAuth');
const {
  validatePharmacyDispense,
  validatePharmacyStockAdjustment,
  validatePharmacyMedicationCreate,
  validateObjectIdParam
} = require('../middleware/validation');

// Protect all routes and add clinic context
router.use(protect);
router.use(optionalClinic);

// ============================================
// INVENTORY ROUTES
// ============================================
router.get('/inventory', requirePermission('view_pharmacy'), logAction('INVENTORY_VIEW'), pharmacyController.getInventory);
router.get('/stats', authorize('admin', 'pharmacist'), logAction('INVENTORY_STATS_VIEW'), pharmacyController.getStats);
router.get('/alerts', requirePermission('view_pharmacy'), logAction('INVENTORY_ALERTS_VIEW'), pharmacyController.getAlerts);
router.get('/low-stock', requirePermission('view_pharmacy', 'manage_inventory'), logAction('INVENTORY_LOW_STOCK_VIEW'), pharmacyController.getLowStock);
router.get('/expiring', requirePermission('view_pharmacy', 'manage_inventory'), logAction('INVENTORY_EXPIRING_VIEW'), pharmacyController.getExpiring);
router.get('/value', requirePermission('manage_inventory'), logAction('INVENTORY_VALUE_VIEW'), pharmacyController.getInventoryValue);
router.get('/export', requirePermission('manage_inventory'), logAction('INVENTORY_EXPORT'), pharmacyController.exportInventory);
router.get('/profit-margins', requirePermission('view_financial_reports', 'manage_inventory'), logAction('PROFIT_MARGIN_VIEW'), pharmacyController.getProfitMarginReport);
router.get('/profit-margins/:itemId', requirePermission('view_financial_reports', 'manage_inventory'), logAction('PROFIT_MARGIN_ANALYSIS'), pharmacyController.getItemMarginAnalysis);

// Medication search for prescribing
router.get('/search', requirePermission('view_pharmacy'), logAction('MEDICATION_SEARCH'), pharmacyController.searchMedications);

// ============================================
// MEDICATION CRUD ROUTES
// ============================================
router.post('/inventory', requirePermission('manage_inventory'), validatePharmacyMedicationCreate, logAction('INVENTORY_ADD'), pharmacyController.createMedication);
router.get('/inventory/:id', validateObjectIdParam, requirePermission('view_pharmacy'), logAction('MEDICATION_VIEW'), pharmacyController.getMedication);
router.put('/inventory/:id', validateObjectIdParam, requirePermission('manage_inventory'), logAction('INVENTORY_UPDATE'), pharmacyController.updateMedication);
router.delete('/inventory/:id', validateObjectIdParam, requirePermission('manage_inventory'), logCriticalOperation('INVENTORY_DELETE'), pharmacyController.deleteMedication);
router.post('/inventory/:id/adjust', validateObjectIdParam, validatePharmacyStockAdjustment, requirePermission('manage_inventory'), logCriticalOperation('INVENTORY_ADJUST'), pharmacyController.adjustStock);

// ============================================
// BATCH MANAGEMENT ROUTES - CRITICAL
// ============================================
router.get('/inventory/:id/batches', authorize('admin', 'pharmacist'), logAction('BATCH_VIEW'), pharmacyController.getBatches);
router.post('/inventory/:id/batches', requirePermission('manage_inventory'), logCriticalOperation('BATCH_ADD'), pharmacyController.addBatch);
router.put('/inventory/:id/batches/:lotNumber', requirePermission('manage_inventory'), logAction('BATCH_UPDATE'), pharmacyController.updateBatch);
router.post('/inventory/:id/batches/:lotNumber/expire', requirePermission('manage_inventory'), logCriticalOperation('BATCH_EXPIRE'), pharmacyController.markBatchExpired);

// ============================================
// DISPENSING ROUTES - CRITICAL
// ============================================
router.post('/inventory/:id/dispense', validateObjectIdParam, requirePermission('manage_inventory'), logCriticalOperation('MEDICATION_DISPENSE'), pharmacyController.dispenseFromInventory);
router.post('/dispense', validatePharmacyDispense, requirePermission('manage_inventory'), logCriticalOperation('PRESCRIPTION_DISPENSE'), pharmacyController.dispensePrescription);

// ============================================
// RESERVATION ROUTES
// ============================================
router.post('/reserve', requirePermission('create_prescriptions', 'manage_inventory'), logAction('STOCK_RESERVATION'), pharmacyController.reserveForPrescription);
router.post('/inventory/:id/reserve', requirePermission('create_prescriptions', 'manage_inventory'), logAction('STOCK_RESERVATION'), pharmacyController.reserveStock);
router.post('/inventory/:id/release', requirePermission('manage_inventory'), logAction('STOCK_RESERVATION_CANCEL'), pharmacyController.releaseReservation);

// ============================================
// TRANSACTION HISTORY ROUTES
// ============================================
router.get('/inventory/:id/transactions', authorize('admin', 'pharmacist'), logAction('TRANSACTION_HISTORY_VIEW'), pharmacyController.getTransactions);
router.get('/transactions', requirePermission('manage_inventory'), logAction('TRANSACTION_HISTORY_VIEW'), pharmacyController.getAllTransactions);

// ============================================
// SUPPLIER MANAGEMENT ROUTES
// ============================================
router.get('/suppliers', requirePermission('manage_inventory'), logAction('SUPPLIER_VIEW'), pharmacyController.getSuppliers);
router.post('/suppliers', requirePermission('manage_inventory'), logAction('SUPPLIER_CREATE'), pharmacyController.createSupplier);
router.get('/suppliers/:id', requirePermission('manage_inventory'), logAction('SUPPLIER_VIEW'), pharmacyController.getSupplier);
router.put('/suppliers/:id', requirePermission('manage_inventory'), logAction('SUPPLIER_UPDATE'), pharmacyController.updateSupplier);
router.delete('/suppliers/:id', requirePermission('manage_system'), logCriticalOperation('SUPPLIER_DELETE'), pharmacyController.deleteSupplier);

// ============================================
// REORDER MANAGEMENT ROUTES
// ============================================
router.get('/reorder-suggestions', requirePermission('manage_inventory'), logAction('REORDER_SUGGESTIONS_VIEW'), pharmacyController.getReorderSuggestions);
router.post('/reorder', requirePermission('manage_inventory'), logAction('REORDER_CREATE'), pharmacyController.createReorder);
router.post('/inventory/:id/receive-order', requirePermission('manage_inventory'), logAction('ORDER_RECEIVE'), pharmacyController.receiveOrder);

// ============================================
// ALERT MANAGEMENT ROUTES
// ============================================
router.put('/inventory/:id/alerts/:alertId/resolve', requirePermission('manage_inventory'), logAction('ALERT_RESOLVE'), pharmacyController.resolveAlert);

module.exports = router;
