const express = require('express');
const router = express.Router();
const {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  addPayment,
  cancelInvoice,
  issueRefund,
  sendReminder,
  getPatientInvoices,
  getOverdueInvoices,
  getInvoiceStats,
  markAsSent,
  validateInvoicePrices,
  getInvoiceHistory,
  previewCompanyBilling,
  applyCompanyBilling,
  consumeApprovals,
  // Category-filtered invoice endpoints
  getPharmacyInvoiceView,
  getOpticalInvoiceView,
  getClinicInvoiceView,
  markItemCompleted,
  markItemExternal,
  collectItemPayment,
  getInvoiceItems
} = require('../controllers/invoiceController');

const { getPayments, applyDiscount, writeOff, generateInvoicePDF, generateReceiptPDF } = require('../controllers/billing');

const { protect, authorize } = require('../middleware/auth');
const { logCriticalOperation } = require('../middleware/auditLogger');
const { optionalClinic } = require('../middleware/clinicAuth');

// Protect all routes and add clinic context
router.use(protect);
router.use(optionalClinic);

// Statistics and reports routes (must be before :id routes)
router.get('/stats', authorize('admin', 'accountant'), getInvoiceStats);
router.get('/overdue', authorize('admin', 'accountant', 'receptionist'), getOverdueInvoices);
router.get('/payments', authorize('admin', 'accountant', 'receptionist'), getPayments);

// Price validation route
router.post('/validate-prices', authorize('admin', 'accountant', 'receptionist'), validateInvoicePrices);

// Individual payment lookup
router.get('/payments/:paymentId', authorize('admin', 'accountant', 'receptionist'), async (req, res) => {
  try {
    const Invoice = require('../models/Invoice');

    // Find invoice containing this payment
    const invoice = await Invoice.findOne({ 'payments._id': req.params.paymentId })
      .populate('patient', 'firstName lastName patientId')
      .populate('payments.processedBy', 'firstName lastName');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    // Find the specific payment
    const payment = invoice.payments.id(req.params.paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      data: {
        payment,
        invoice: {
          _id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          patient: invoice.patient,
          totalAmount: invoice.totalAmount,
          status: invoice.status
        }
      }
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Patient-specific invoices
router.get('/patient/:patientId', authorize('admin', 'receptionist', 'accountant', 'doctor', 'ophthalmologist', 'nurse'), getPatientInvoices);

// ====================================
// CATEGORY-FILTERED INVOICE VIEWS
// ====================================

// Pharmacy view - medication items only (for pharmacist/pharmacy_receptionist)
router.get('/pharmacy/:visitId', authorize('admin', 'pharmacist', 'pharmacy_receptionist'), getPharmacyInvoiceView);

// Optical view - optical items only (for optician/optical_receptionist/optometrist)
router.get('/optical/:visitId', authorize('admin', 'optician', 'optical_receptionist', 'optometrist'), getOpticalInvoiceView);

// Clinic view - all categories based on permissions (for receptionist/cashier/admin)
router.get('/clinic/:visitId', authorize('admin', 'receptionist', 'accountant', 'cashier'), getClinicInvoiceView);

// Main CRUD routes
router
  .route('/')
  .get(authorize('admin', 'receptionist', 'accountant', 'doctor', 'ophthalmologist', 'nurse'), getInvoices)
  .post(authorize('admin', 'receptionist', 'accountant'), createInvoice);

router
  .route('/:id')
  .get(authorize('admin', 'receptionist', 'accountant', 'doctor', 'ophthalmologist', 'nurse'), getInvoice)
  .put(authorize('admin', 'receptionist', 'accountant'), updateInvoice)
  .delete(authorize('admin'), logCriticalOperation('INVOICE_DELETE'), deleteInvoice);

// Invoice actions (with audit logging for financial compliance)
router.post('/:id/payments', authorize('admin', 'receptionist', 'accountant'), logCriticalOperation('PAYMENT_ADD'), addPayment);
router.put('/:id/cancel', authorize('admin'), logCriticalOperation('INVOICE_CANCEL'), cancelInvoice);
router.post('/:id/refund', authorize('admin'), logCriticalOperation('INVOICE_REFUND'), issueRefund);
router.post('/:id/reminder', authorize('admin', 'receptionist'), sendReminder);
router.put('/:id/send', authorize('admin', 'receptionist'), markAsSent);
router.post('/:id/apply-discount', authorize('admin'), logCriticalOperation('DISCOUNT_APPLY'), applyDiscount);
router.post('/:id/write-off', authorize('admin'), logCriticalOperation('WRITE_OFF'), writeOff);

// Invoice history (audit trail)
router.get('/:id/history', authorize('admin', 'accountant'), getInvoiceHistory);

// PDF generation routes (alias for /api/billing/invoices/:id/pdf for frontend compatibility)
router.get('/:id/pdf', authorize('admin', 'receptionist', 'accountant', 'doctor', 'ophthalmologist'), generateInvoicePDF);
router.get('/:id/receipt/:paymentIndex', authorize('admin', 'receptionist', 'accountant'), generateReceiptPDF);

// Company billing / Convention routes (with approval validation)
router.post('/:id/preview-company-billing', authorize('admin', 'receptionist', 'accountant'), previewCompanyBilling);
router.post('/:id/apply-company-billing', authorize('admin', 'receptionist', 'accountant'), logCriticalOperation('COMPANY_BILLING_APPLY'), applyCompanyBilling);
router.post('/:id/consume-approvals', authorize('admin', 'accountant'), logCriticalOperation('APPROVALS_CONSUME'), consumeApprovals);

// ====================================
// ITEM-LEVEL OPERATIONS (Category-Based Payment System)
// ====================================

// Get invoice items filtered by user's category permissions
router.get('/:id/items', authorize('admin', 'receptionist', 'accountant', 'doctor', 'ophthalmologist', 'nurse', 'pharmacist', 'pharmacy_receptionist', 'optician', 'optical_receptionist', 'optometrist'), getInvoiceItems);

// Mark item as completed/dispensed (permission checked per-category in controller)
router.patch('/:id/items/:itemId/status', logCriticalOperation('ITEM_STATUS_CHANGE'), markItemCompleted);

// Mark item as external (patient getting service elsewhere)
router.patch('/:id/items/:itemId/external', logCriticalOperation('ITEM_MARK_EXTERNAL'), markItemExternal);

// Collect payment for specific item (per-category permission check in controller)
router.post('/:id/items/:itemId/payment', logCriticalOperation('ITEM_PAYMENT'), collectItemPayment);

module.exports = router;
