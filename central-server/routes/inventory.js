const express = require('express');
const router = express.Router();
const { clinicAuth } = require('../middleware/clinicAuth');
const inventoryController = require('../controllers/inventoryController');

/**
 * Inventory Routes
 * Cross-clinic inventory visibility and management
 */

// Get consolidated inventory across all clinics
router.get('/', clinicAuth, inventoryController.getConsolidatedInventory);

// Get inventory summary by clinic
router.get('/summary', clinicAuth, inventoryController.getSummary);

// Get stock alerts across all clinics
router.get('/alerts', clinicAuth, inventoryController.getAlerts);

// Get transfer recommendations
router.get('/recommendations', clinicAuth, inventoryController.getRecommendations);

// Get inventory categories
router.get('/categories', clinicAuth, inventoryController.getCategories);

// Get expiring items
router.get('/expiring', clinicAuth, inventoryController.getExpiringItems);

// Get specific product stock across clinics
router.get('/product/:sku', clinicAuth, inventoryController.getProductStock);

module.exports = router;
