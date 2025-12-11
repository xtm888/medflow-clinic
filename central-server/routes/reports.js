const express = require('express');
const router = express.Router();
const { clinicAuth } = require('../middleware/clinicAuth');
const financialController = require('../controllers/financialController');

/**
 * Financial Reports Routes
 * Consolidated financial reports across clinics
 */

// Get dashboard summary
router.get('/dashboard', clinicAuth, financialController.getDashboardSummary);

// Get consolidated revenue report
router.get('/revenue', clinicAuth, financialController.getConsolidatedRevenue);

// Get clinic comparison report
router.get('/clinic-comparison', clinicAuth, financialController.getClinicComparison);

// Get revenue by category
router.get('/revenue-by-category', clinicAuth, financialController.getRevenueByCategory);

// Get payment method distribution
router.get('/payment-methods', clinicAuth, financialController.getPaymentMethodDistribution);

// Get outstanding payments
router.get('/outstanding', clinicAuth, financialController.getOutstanding);

module.exports = router;
