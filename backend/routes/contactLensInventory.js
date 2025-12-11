const express = require('express');
const router = express.Router();
const { contactLensInventory: contactLensInventoryController } = require('../controllers/inventory');
const { protect, authorize } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');

// Protect all routes
router.use(protect);

// ============================================
// STATISTICS & REPORTS (before :id routes)
// ============================================
router.get('/stats', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('CONTACT_LENS_STATS_VIEW'), contactLensInventoryController.getStats);
router.get('/low-stock', authorize('admin', 'optometrist', 'receptionist'), logAction('CONTACT_LENS_LOW_STOCK_VIEW'), contactLensInventoryController.getLowStock);
router.get('/expiring', authorize('admin', 'optometrist', 'receptionist'), logAction('CONTACT_LENS_EXPIRING_VIEW'), contactLensInventoryController.getExpiring);
router.get('/value', authorize('admin'), logAction('CONTACT_LENS_VALUE_VIEW'), contactLensInventoryController.getInventoryValue);
router.get('/alerts', authorize('admin', 'optometrist', 'receptionist'), logAction('CONTACT_LENS_ALERTS_VIEW'), contactLensInventoryController.getAlerts);
router.get('/brands', authorize('admin', 'doctor', 'optometrist', 'receptionist'), contactLensInventoryController.getBrands);
router.get('/product-lines', authorize('admin', 'doctor', 'optometrist', 'receptionist'), contactLensInventoryController.getProductLines);
router.get('/search', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('CONTACT_LENS_SEARCH'), contactLensInventoryController.searchLenses);
router.get('/find-match', authorize('admin', 'doctor', 'optometrist', 'receptionist'), contactLensInventoryController.findMatchingLens);
router.get('/check-availability', authorize('admin', 'doctor', 'optometrist', 'receptionist'), contactLensInventoryController.checkAvailability);

// ============================================
// CONTACT LENS CRUD ROUTES
// ============================================
router.get('/', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('CONTACT_LENS_LIST_VIEW'), contactLensInventoryController.getLenses);
router.post('/', authorize('admin', 'optometrist'), logAction('CONTACT_LENS_CREATE'), contactLensInventoryController.createLens);
router.get('/:id', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('CONTACT_LENS_VIEW'), contactLensInventoryController.getLens);
router.put('/:id', authorize('admin', 'optometrist'), logAction('CONTACT_LENS_UPDATE'), contactLensInventoryController.updateLens);
router.delete('/:id', authorize('admin'), logCriticalOperation('CONTACT_LENS_DISCONTINUE'), contactLensInventoryController.deleteLens);

// ============================================
// STOCK MANAGEMENT ROUTES
// ============================================
router.post('/:id/add-stock', authorize('admin', 'optometrist'), logCriticalOperation('CONTACT_LENS_STOCK_ADD'), contactLensInventoryController.addStock);
router.post('/:id/adjust', authorize('admin', 'optometrist'), logCriticalOperation('CONTACT_LENS_STOCK_ADJUST'), contactLensInventoryController.adjustStock);

// ============================================
// RESERVATION ROUTES
// ============================================
router.post('/:id/reserve', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('CONTACT_LENS_RESERVE'), contactLensInventoryController.reserveForOrder);
router.post('/:id/release-reservation/:reservationId', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('CONTACT_LENS_RELEASE_RESERVATION'), contactLensInventoryController.releaseReservation);
router.post('/:id/fulfill-reservation/:reservationId', authorize('admin', 'optometrist', 'receptionist'), logCriticalOperation('CONTACT_LENS_FULFILL_RESERVATION'), contactLensInventoryController.fulfillReservation);

// ============================================
// BATCH MANAGEMENT
// ============================================
router.post('/:id/batches/:lotNumber/expire', authorize('admin', 'optometrist'), logCriticalOperation('CONTACT_LENS_BATCH_EXPIRE'), contactLensInventoryController.markBatchExpired);

// ============================================
// TRANSACTION & ALERT MANAGEMENT
// ============================================
router.get('/:id/transactions', authorize('admin', 'optometrist'), logAction('CONTACT_LENS_TRANSACTIONS_VIEW'), contactLensInventoryController.getTransactions);
router.post('/:id/alerts/:alertId/resolve', authorize('admin', 'optometrist'), logAction('CONTACT_LENS_ALERT_RESOLVE'), contactLensInventoryController.resolveAlert);

module.exports = router;
