const express = require('express');
const router = express.Router();
const {
  getBillingStatistics,
  getRevenueReport,
  getAgingReport,
  getOutstandingBalances,
  getFeeSchedule,
  getBillingCodes,
  searchBillingCodes,
  applyDiscount,
  writeOff,
  getPaymentMethods,
  getPatientBilling,
  getPayments
} = require('../controllers/billingController');

const { protect, authorize } = require('../middleware/auth');
const { logCriticalOperation } = require('../middleware/auditLogger');

// Protect all routes
router.use(protect);

// Statistics and reports
router.get('/statistics', authorize('admin', 'accountant'), getBillingStatistics);
router.get('/reports/revenue', authorize('admin', 'accountant'), getRevenueReport);
router.get('/reports/aging', authorize('admin', 'accountant'), getAgingReport);
router.get('/outstanding-balances', authorize('admin', 'accountant'), getOutstandingBalances);

// Fee schedule and codes (restricted to admin/finance staff)
router.get('/fee-schedule', authorize('admin', 'accountant', 'receptionist'), getFeeSchedule);
router.get('/codes', authorize('admin', 'accountant', 'receptionist'), getBillingCodes);
router.get('/codes/search', authorize('admin', 'accountant', 'receptionist'), searchBillingCodes);

// Payment methods
router.get('/payment-methods', authorize('admin', 'accountant', 'receptionist'), getPaymentMethods);

// Invoice-specific billing actions
router.post('/invoices/:id/apply-discount', authorize('admin'), logCriticalOperation('DISCOUNT_APPLY'), applyDiscount);
router.post('/invoices/:id/write-off', authorize('admin'), logCriticalOperation('WRITE_OFF'), writeOff);

module.exports = router;
