const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const centralDataController = require('../controllers/centralDataController');

/**
 * Central Server Data Routes
 * Proxies requests to the central server for cross-clinic data access
 * All routes require authentication
 */

// Connection status
router.get('/status', protect, centralDataController.checkConnection);
router.get('/dashboard', protect, centralDataController.getDashboard);

// Patient routes
router.get('/patients/search', protect, centralDataController.searchPatients);
router.get('/patients/check-exists', protect, centralDataController.checkPatientExists);
router.get('/patients/:id/history', protect, centralDataController.getPatientHistory);
router.get('/patients/:id/full', protect, centralDataController.getFullPatient);
router.get('/patients/:id/all-clinics', protect, centralDataController.getPatientAllClinics);

// Inventory routes
router.get('/inventory', protect, centralDataController.getConsolidatedInventory);
router.get('/inventory/summary', protect, centralDataController.getInventorySummary);
router.get('/inventory/alerts', protect, centralDataController.getInventoryAlerts);
router.get('/inventory/recommendations', protect, centralDataController.getTransferRecommendations);
router.get('/inventory/categories', protect, centralDataController.getInventoryCategories);
router.get('/inventory/expiring', protect, centralDataController.getExpiringItems);
router.get('/inventory/product/:sku', protect, centralDataController.getProductStock);

// Financial reports
router.get('/reports/dashboard', protect, centralDataController.getFinancialDashboard);
router.get('/reports/revenue', protect, centralDataController.getConsolidatedRevenue);
router.get('/reports/clinic-comparison', protect, centralDataController.getClinicComparison);
router.get('/reports/revenue-by-category', protect, centralDataController.getRevenueByCategory);
router.get('/reports/payment-methods', protect, centralDataController.getPaymentMethodDistribution);
router.get('/reports/outstanding', protect, centralDataController.getOutstanding);

// Clinic routes
router.get('/clinics', protect, centralDataController.getClinics);
router.get('/clinics/:clinicId', protect, centralDataController.getClinic);

// Sync status
router.get('/sync/status', protect, centralDataController.getSyncStatus);

module.exports = router;
