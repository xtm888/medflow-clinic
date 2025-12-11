const express = require('express');
const router = express.Router();
const { opticalLensInventory: opticalLensInventoryController } = require('../controllers/inventory');
const { protect, authorize } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');

// Protect all routes
router.use(protect);

// ============================================
// STATISTICS & REPORTS (before :id routes)
// ============================================
router.get('/stats', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('OPTICAL_LENS_STATS_VIEW'), opticalLensInventoryController.getStats);
router.get('/low-stock', authorize('admin', 'optometrist', 'receptionist'), logAction('OPTICAL_LENS_LOW_STOCK_VIEW'), opticalLensInventoryController.getLowStock);
router.get('/alerts', authorize('admin', 'optometrist', 'receptionist'), logAction('OPTICAL_LENS_ALERTS_VIEW'), opticalLensInventoryController.getAlerts);
router.get('/brands', authorize('admin', 'doctor', 'optometrist', 'receptionist'), opticalLensInventoryController.getBrands);
router.get('/search', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('OPTICAL_LENS_SEARCH'), opticalLensInventoryController.searchLenses);
router.get('/find-by-specs', authorize('admin', 'doctor', 'optometrist', 'receptionist'), opticalLensInventoryController.findBySpecs);
router.get('/check-availability', authorize('admin', 'doctor', 'optometrist', 'receptionist'), opticalLensInventoryController.checkAvailability);
router.get('/material/:material', authorize('admin', 'doctor', 'optometrist', 'receptionist'), opticalLensInventoryController.getByMaterial);

// ============================================
// OPTICAL LENS CRUD ROUTES
// ============================================
router.get('/', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('OPTICAL_LENS_LIST_VIEW'), opticalLensInventoryController.getLenses);
router.post('/', authorize('admin', 'optometrist'), logAction('OPTICAL_LENS_CREATE'), opticalLensInventoryController.createLens);
router.get('/:id', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('OPTICAL_LENS_VIEW'), opticalLensInventoryController.getLens);
router.put('/:id', authorize('admin', 'optometrist'), logAction('OPTICAL_LENS_UPDATE'), opticalLensInventoryController.updateLens);
router.delete('/:id', authorize('admin'), logCriticalOperation('OPTICAL_LENS_DISCONTINUE'), opticalLensInventoryController.deleteLens);

// ============================================
// STOCK MANAGEMENT ROUTES
// ============================================
router.post('/:id/add-stock', authorize('admin', 'optometrist'), logCriticalOperation('OPTICAL_LENS_STOCK_ADD'), opticalLensInventoryController.addStock);
router.post('/:id/adjust', authorize('admin', 'optometrist'), logCriticalOperation('OPTICAL_LENS_STOCK_ADJUST'), opticalLensInventoryController.adjustStock);

// ============================================
// RESERVATION ROUTES
// ============================================
router.post('/:id/reserve', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('OPTICAL_LENS_RESERVE'), opticalLensInventoryController.reserveForOrder);
router.post('/:id/release-reservation', authorize('admin', 'doctor', 'optometrist', 'receptionist'), logAction('OPTICAL_LENS_RELEASE_RESERVATION'), opticalLensInventoryController.releaseReservation);
router.post('/:id/fulfill-reservation', authorize('admin', 'optometrist', 'receptionist'), logCriticalOperation('OPTICAL_LENS_FULFILL_RESERVATION'), opticalLensInventoryController.fulfillReservation);

// ============================================
// ALERT MANAGEMENT
// ============================================
router.post('/:id/alerts/:alertId/acknowledge', authorize('admin', 'optometrist'), logAction('OPTICAL_LENS_ALERT_ACKNOWLEDGE'), opticalLensInventoryController.acknowledgeAlert);

module.exports = router;
