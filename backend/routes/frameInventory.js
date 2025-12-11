const express = require('express');
const router = express.Router();
const { frameInventory: frameInventoryController } = require('../controllers/inventory');
const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');

// Protect all routes
router.use(protect);

// ============================================
// STATISTICS & REPORTS (before :id routes)
// ============================================
router.get('/stats', authorize('admin', 'doctor', 'optometrist', 'receptionist', 'optician', 'ophthalmologist'), logAction('FRAME_STATS_VIEW'), frameInventoryController.getStats);
router.get('/low-stock', authorize('admin', 'optometrist', 'receptionist', 'optician'), logAction('FRAME_LOW_STOCK_VIEW'), frameInventoryController.getLowStock);
router.get('/value', authorize('admin'), logAction('FRAME_VALUE_VIEW'), frameInventoryController.getInventoryValue);
router.get('/alerts', authorize('admin', 'optometrist', 'receptionist', 'optician'), logAction('FRAME_ALERTS_VIEW'), frameInventoryController.getAlerts);
router.get('/brands', authorize('admin', 'doctor', 'optometrist', 'receptionist', 'optician', 'ophthalmologist'), frameInventoryController.getBrands);
router.get('/search', authorize('admin', 'doctor', 'optometrist', 'receptionist', 'optician', 'ophthalmologist'), logAction('FRAME_SEARCH'), frameInventoryController.searchFrames);
router.get('/check-availability', authorize('admin', 'doctor', 'optometrist', 'receptionist', 'optician', 'ophthalmologist'), frameInventoryController.checkAvailability);
router.get('/category/:category', authorize('admin', 'doctor', 'optometrist', 'receptionist', 'optician', 'ophthalmologist'), frameInventoryController.getByCategory);

// ============================================
// FRAME CRUD ROUTES
// ============================================
router.get('/', authorize('admin', 'doctor', 'optometrist', 'receptionist', 'optician', 'ophthalmologist'), logAction('FRAME_LIST_VIEW'), frameInventoryController.getFrames);
router.post('/', authorize('admin', 'optometrist', 'optician'), logAction('FRAME_CREATE'), frameInventoryController.createFrame);
router.get('/:id', authorize('admin', 'doctor', 'optometrist', 'receptionist', 'optician', 'ophthalmologist'), logAction('FRAME_VIEW'), frameInventoryController.getFrame);
router.put('/:id', authorize('admin', 'optometrist', 'optician'), logAction('FRAME_UPDATE'), frameInventoryController.updateFrame);
router.delete('/:id', authorize('admin'), logCriticalOperation('FRAME_DISCONTINUE'), frameInventoryController.deleteFrame);

// ============================================
// STOCK MANAGEMENT ROUTES
// ============================================
router.post('/:id/add-stock', authorize('admin', 'optometrist', 'optician'), logCriticalOperation('FRAME_STOCK_ADD'), frameInventoryController.addStock);
router.post('/:id/adjust', authorize('admin', 'optometrist', 'optician'), logCriticalOperation('FRAME_STOCK_ADJUST'), frameInventoryController.adjustStock);

// ============================================
// RESERVATION ROUTES
// ============================================
router.post('/:id/reserve', authorize('admin', 'doctor', 'optometrist', 'receptionist', 'optician', 'ophthalmologist'), logAction('FRAME_RESERVE'), frameInventoryController.reserveForOrder);
router.post('/:id/release-reservation/:reservationId', authorize('admin', 'doctor', 'optometrist', 'receptionist', 'optician', 'ophthalmologist'), logAction('FRAME_RELEASE_RESERVATION'), frameInventoryController.releaseReservation);
router.post('/:id/fulfill-reservation/:reservationId', authorize('admin', 'optometrist', 'receptionist', 'optician'), logCriticalOperation('FRAME_FULFILL_RESERVATION'), frameInventoryController.fulfillReservation);

// ============================================
// TRANSACTION & ALERT MANAGEMENT
// ============================================
router.get('/:id/transactions', authorize('admin', 'optometrist'), logAction('FRAME_TRANSACTIONS_VIEW'), frameInventoryController.getTransactions);
router.post('/:id/alerts/:alertId/resolve', authorize('admin', 'optometrist'), logAction('FRAME_ALERT_RESOLVE'), frameInventoryController.resolveAlert);

module.exports = router;
