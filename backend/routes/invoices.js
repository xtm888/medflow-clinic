const express = require('express');
const router = express.Router();
// Import from split controller modules (maintains backward compatibility via index.js)
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
} = require('../controllers/invoices');

const { getPayments, applyDiscount, writeOff, generateInvoicePDF, generateReceiptPDF } = require('../controllers/billing');

const { protect, authorize } = require('../middleware/auth');
const { logCriticalOperation } = require('../middleware/auditLogger');
const { optionalClinic } = require('../middleware/clinicAuth');
const { validateObjectIdParam, validatePayment, validateInvoiceCreate, isValidObjectId, handleValidationErrors } = require('../middleware/validation');
const { param } = require('express-validator');

// Reusable validators for invoice routes
const validateInvoiceIdParam = [
  param('id').custom(isValidObjectId).withMessage('ID facture invalide'),
  handleValidationErrors
];

const validatePatientIdParam = [
  param('patientId').custom(isValidObjectId).withMessage('ID patient invalide'),
  handleValidationErrors
];

const validateVisitIdParam = [
  param('visitId').custom(isValidObjectId).withMessage('ID visite invalide'),
  handleValidationErrors
];

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
router.get('/patient/:patientId', validatePatientIdParam, authorize('admin', 'receptionist', 'accountant', 'doctor', 'ophthalmologist', 'nurse'), getPatientInvoices);

// ====================================
// PHARMACY DRAFT INVOICE WORKFLOW
// ====================================

// Get pending pharmacy draft invoices (requires validation before patient can pay)
router.get('/pharmacy/pending-review', authorize('admin', 'pharmacist', 'pharmacy_receptionist', 'accountant'), async (req, res) => {
  try {
    const Invoice = require('../models/Invoice');
    const { buildClinicQuery } = require('../middleware/clinicAuth');

    const query = {
      ...buildClinicQuery(req, {}),
      source: 'pharmacy',
      status: 'draft',
      requiresReview: true
    };

    const invoices = await Invoice.find(query)
      .populate('patient', 'firstName lastName patientId phoneNumber')
      .populate('prescription', 'prescriptionId')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: invoices,
      count: invoices.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Finalize pharmacy draft invoice (transitions draft → issued)
router.post('/pharmacy/:id/finalize', validateInvoiceIdParam, authorize('admin', 'pharmacist', 'pharmacy_receptionist'), logCriticalOperation('PHARMACY_INVOICE_FINALIZE'), async (req, res) => {
  try {
    const Invoice = require('../models/Invoice');

    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    if (invoice.source !== 'pharmacy') {
      return res.status(400).json({ success: false, error: 'Cette facture ne provient pas de la pharmacie' });
    }

    if (invoice.status !== 'draft') {
      return res.status(400).json({ success: false, error: `Impossible de finaliser une facture avec le statut: ${invoice.status}` });
    }

    // Transition to issued status
    invoice.status = 'issued';
    invoice.requiresReview = false;
    invoice.reviewedBy = req.user.id;
    invoice.reviewedAt = new Date();

    // Update notes
    const timestamp = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa' });
    if (invoice.notes?.internal) {
      invoice.notes.internal = invoice.notes.internal.replace(
        '- En attente de validation pharmacie',
        `- Validée par ${req.user.firstName} ${req.user.lastName} le ${timestamp}`
      );
    }

    await invoice.save();

    res.json({
      success: true,
      data: invoice,
      message: 'Facture pharmacie finalisée avec succès'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ====================================
// CATEGORY-FILTERED INVOICE VIEWS
// ====================================

// Pharmacy view - medication items only (for pharmacist/pharmacy_receptionist)
router.get('/pharmacy/:visitId', validateVisitIdParam, authorize('admin', 'pharmacist', 'pharmacy_receptionist'), getPharmacyInvoiceView);

// Optical view - optical items only (for optician/optical_receptionist/optometrist)
router.get('/optical/:visitId', validateVisitIdParam, authorize('admin', 'optician', 'optical_receptionist', 'optometrist'), getOpticalInvoiceView);

// Clinic view - all categories based on permissions (for receptionist/cashier/admin)
router.get('/clinic/:visitId', validateVisitIdParam, authorize('admin', 'receptionist', 'accountant', 'cashier'), getClinicInvoiceView);

// Main CRUD routes
router
  .route('/')
  .get(authorize('admin', 'receptionist', 'accountant', 'doctor', 'ophthalmologist', 'nurse'), getInvoices)
  .post(authorize('admin', 'receptionist', 'accountant'), createInvoice);

router
  .route('/:id')
  .get(validateInvoiceIdParam, authorize('admin', 'receptionist', 'accountant', 'doctor', 'ophthalmologist', 'nurse'), getInvoice)
  .put(validateInvoiceIdParam, authorize('admin', 'receptionist', 'accountant'), updateInvoice)
  .delete(validateInvoiceIdParam, authorize('admin'), logCriticalOperation('INVOICE_DELETE'), deleteInvoice);

// Invoice actions (with audit logging for financial compliance)
router.post('/:id/payments', validateInvoiceIdParam, validatePayment, authorize('admin', 'receptionist', 'accountant'), logCriticalOperation('PAYMENT_ADD'), addPayment);
router.put('/:id/cancel', validateInvoiceIdParam, authorize('admin'), logCriticalOperation('INVOICE_CANCEL'), cancelInvoice);
router.post('/:id/refund', validateInvoiceIdParam, authorize('admin'), logCriticalOperation('INVOICE_REFUND'), issueRefund);
router.post('/:id/reminder', validateInvoiceIdParam, authorize('admin', 'receptionist'), sendReminder);
router.put('/:id/send', validateInvoiceIdParam, authorize('admin', 'receptionist'), markAsSent);
router.post('/:id/apply-discount', validateInvoiceIdParam, authorize('admin'), logCriticalOperation('DISCOUNT_APPLY'), applyDiscount);
router.post('/:id/write-off', validateInvoiceIdParam, authorize('admin'), logCriticalOperation('WRITE_OFF'), writeOff);

// Invoice history (audit trail)
router.get('/:id/history', validateInvoiceIdParam, authorize('admin', 'accountant'), getInvoiceHistory);

// PDF generation routes (alias for /api/billing/invoices/:id/pdf for frontend compatibility)
router.get('/:id/pdf', validateInvoiceIdParam, authorize('admin', 'receptionist', 'accountant', 'doctor', 'ophthalmologist'), generateInvoicePDF);
router.get('/:id/receipt/:paymentIndex', validateInvoiceIdParam, authorize('admin', 'receptionist', 'accountant'), generateReceiptPDF);

// Company billing / Convention routes (with approval validation)
router.post('/:id/preview-company-billing', validateInvoiceIdParam, authorize('admin', 'receptionist', 'accountant'), previewCompanyBilling);
router.post('/:id/apply-company-billing', validateInvoiceIdParam, authorize('admin', 'receptionist', 'accountant'), logCriticalOperation('COMPANY_BILLING_APPLY'), applyCompanyBilling);
router.post('/:id/consume-approvals', validateInvoiceIdParam, authorize('admin', 'accountant'), logCriticalOperation('APPROVALS_CONSUME'), consumeApprovals);

// ====================================
// ITEM-LEVEL OPERATIONS (Category-Based Payment System)
// ====================================

// Get invoice items filtered by user's category permissions
router.get('/:id/items', validateInvoiceIdParam, authorize('admin', 'receptionist', 'accountant', 'doctor', 'ophthalmologist', 'nurse', 'pharmacist', 'pharmacy_receptionist', 'optician', 'optical_receptionist', 'optometrist'), getInvoiceItems);

// Mark item as completed/dispensed (permission checked per-category in controller)
router.patch('/:id/items/:itemId/status', validateInvoiceIdParam, logCriticalOperation('ITEM_STATUS_CHANGE'), markItemCompleted);

// Mark item as external (patient getting service elsewhere)
router.patch('/:id/items/:itemId/external', validateInvoiceIdParam, logCriticalOperation('ITEM_MARK_EXTERNAL'), markItemExternal);

// Collect payment for specific item (per-category permission check in controller)
router.post('/:id/items/:itemId/payment', validateInvoiceIdParam, logCriticalOperation('ITEM_PAYMENT'), collectItemPayment);

module.exports = router;
