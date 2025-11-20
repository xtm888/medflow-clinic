const express = require('express');
const router = express.Router();
const {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  addPayment,
  cancelInvoice,
  issueRefund,
  sendReminder,
  getPatientInvoices,
  getOverdueInvoices,
  getInvoiceStats,
  markAsSent
} = require('../controllers/invoiceController');

const { getPayments, getPatientBilling, applyDiscount, writeOff } = require('../controllers/billingController');

const { protect, authorize } = require('../middleware/auth');
const { logCriticalOperation } = require('../middleware/auditLogger');

// Protect all routes
router.use(protect);

// Statistics and reports routes (must be before :id routes)
router.get('/stats', authorize('admin', 'accountant'), getInvoiceStats);
router.get('/overdue', authorize('admin', 'accountant', 'receptionist'), getOverdueInvoices);
router.get('/payments', authorize('admin', 'accountant', 'receptionist'), getPayments);

// Patient-specific invoices
router.get('/patient/:patientId', getPatientInvoices);

// Main CRUD routes
router
  .route('/')
  .get(getInvoices)
  .post(authorize('admin', 'receptionist', 'accountant'), createInvoice);

router
  .route('/:id')
  .get(getInvoice)
  .put(authorize('admin', 'receptionist', 'accountant'), updateInvoice);

// Invoice actions (with audit logging for financial compliance)
router.post('/:id/payments', authorize('admin', 'receptionist', 'accountant'), logCriticalOperation('PAYMENT_ADD'), addPayment);
router.put('/:id/cancel', authorize('admin'), logCriticalOperation('INVOICE_CANCEL'), cancelInvoice);
router.post('/:id/refund', authorize('admin'), logCriticalOperation('INVOICE_REFUND'), issueRefund);
router.post('/:id/reminder', authorize('admin', 'receptionist'), sendReminder);
router.put('/:id/send', authorize('admin', 'receptionist'), markAsSent);
router.post('/:id/apply-discount', authorize('admin'), logCriticalOperation('DISCOUNT_APPLY'), applyDiscount);
router.post('/:id/write-off', authorize('admin'), logCriticalOperation('WRITE_OFF'), writeOff);

module.exports = router;