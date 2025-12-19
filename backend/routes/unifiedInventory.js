/**
 * Unified Inventory Routes
 *
 * Single API for all inventory types using the unified Inventory model.
 * Routes support inventoryType query parameter for type-specific filtering.
 *
 * @module routes/unifiedInventory
 */

const express = require('express');
const router = express.Router();
const UnifiedInventoryController = require('../controllers/inventory/UnifiedInventoryController');
const { protect, authorize } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');

// Protect all routes
router.use(protect);

// Role groups for authorization
const INVENTORY_VIEWERS = ['admin', 'doctor', 'optometrist', 'receptionist', 'optician', 'ophthalmologist', 'nurse', 'pharmacist', 'lab_technician'];
const INVENTORY_MANAGERS = ['admin', 'optometrist', 'optician', 'pharmacist', 'lab_technician'];
const INVENTORY_ADMINS = ['admin'];

// ============================================================================
// METADATA & ENUMS
// ============================================================================

// GET inventory types enum
router.get('/types',
  authorize(...INVENTORY_VIEWERS),
  UnifiedInventoryController.getTypes
);

// ============================================================================
// STATISTICS & REPORTS (before :id routes)
// ============================================================================

// GET inventory statistics
router.get('/stats',
  authorize(...INVENTORY_VIEWERS),
  logAction('INVENTORY_STATS_VIEW'),
  UnifiedInventoryController.getStats
);

// GET low stock items
router.get('/low-stock',
  authorize(...INVENTORY_MANAGERS),
  logAction('INVENTORY_LOW_STOCK_VIEW'),
  UnifiedInventoryController.getLowStock
);

// GET expiring items
router.get('/expiring',
  authorize(...INVENTORY_MANAGERS),
  logAction('INVENTORY_EXPIRING_VIEW'),
  UnifiedInventoryController.getExpiring
);

// GET inventory value
router.get('/value',
  authorize(...INVENTORY_ADMINS),
  logAction('INVENTORY_VALUE_VIEW'),
  UnifiedInventoryController.getInventoryValue
);

// GET alerts across all inventory
router.get('/alerts',
  authorize(...INVENTORY_MANAGERS),
  logAction('INVENTORY_ALERTS_VIEW'),
  UnifiedInventoryController.getAlerts
);

// GET all brands
router.get('/brands',
  authorize(...INVENTORY_VIEWERS),
  UnifiedInventoryController.getBrands
);

// GET all categories
router.get('/categories',
  authorize(...INVENTORY_VIEWERS),
  UnifiedInventoryController.getCategories
);

// SEARCH inventory
router.get('/search',
  authorize(...INVENTORY_VIEWERS),
  logAction('INVENTORY_SEARCH'),
  UnifiedInventoryController.search
);

// CHECK availability
router.get('/check-availability',
  authorize(...INVENTORY_VIEWERS),
  UnifiedInventoryController.checkAvailability
);

// CHECK expirations (batch operation)
router.post('/check-expirations',
  authorize(...INVENTORY_MANAGERS),
  logAction('INVENTORY_EXPIRATION_CHECK'),
  UnifiedInventoryController.checkExpirations
);

// ============================================================================
// CRUD ROUTES
// ============================================================================

// GET all inventory items (supports ?inventoryType=pharmacy|frame|etc)
router.get('/',
  authorize(...INVENTORY_VIEWERS),
  logAction('INVENTORY_LIST_VIEW'),
  UnifiedInventoryController.getAll
);

// CREATE new inventory item
router.post('/',
  authorize(...INVENTORY_MANAGERS),
  logAction('INVENTORY_CREATE'),
  UnifiedInventoryController.create
);

// GET single inventory item
router.get('/:id',
  authorize(...INVENTORY_VIEWERS),
  logAction('INVENTORY_VIEW'),
  UnifiedInventoryController.getOne
);

// UPDATE inventory item
router.put('/:id',
  authorize(...INVENTORY_MANAGERS),
  logAction('INVENTORY_UPDATE'),
  UnifiedInventoryController.update
);

// DELETE (soft delete) inventory item
router.delete('/:id',
  authorize(...INVENTORY_ADMINS),
  logCriticalOperation('INVENTORY_DISCONTINUE'),
  UnifiedInventoryController.delete
);

// ============================================================================
// STOCK MANAGEMENT ROUTES
// ============================================================================

// ADD stock (receive new batch)
router.post('/:id/add-stock',
  authorize(...INVENTORY_MANAGERS),
  logCriticalOperation('INVENTORY_STOCK_ADD'),
  UnifiedInventoryController.addStock
);

// ADJUST stock (manual adjustment)
router.post('/:id/adjust',
  authorize(...INVENTORY_MANAGERS),
  logCriticalOperation('INVENTORY_STOCK_ADJUST'),
  UnifiedInventoryController.adjustStock
);

// RESERVE stock
router.post('/:id/reserve',
  authorize(...INVENTORY_VIEWERS),
  logAction('INVENTORY_RESERVE'),
  UnifiedInventoryController.reserveStock
);

// RELEASE reservation
router.post('/:id/release-reservation',
  authorize(...INVENTORY_VIEWERS),
  logAction('INVENTORY_RELEASE_RESERVATION'),
  UnifiedInventoryController.releaseReservation
);

// TRANSFER between clinics
router.post('/:id/transfer',
  authorize(...INVENTORY_ADMINS),
  logCriticalOperation('INVENTORY_TRANSFER'),
  UnifiedInventoryController.transfer
);

// ============================================================================
// TRANSACTION & ALERT MANAGEMENT
// ============================================================================

// GET transaction history for an item
router.get('/:id/transactions',
  authorize(...INVENTORY_MANAGERS),
  logAction('INVENTORY_TRANSACTIONS_VIEW'),
  UnifiedInventoryController.getTransactions
);

// RESOLVE alert
router.post('/:id/alerts/:alertId/resolve',
  authorize(...INVENTORY_MANAGERS),
  logAction('INVENTORY_ALERT_RESOLVE'),
  UnifiedInventoryController.resolveAlert
);

module.exports = router;
