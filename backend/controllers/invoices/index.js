/**
 * Invoice Controllers Index
 *
 * Re-exports all invoice controller functions for backward compatibility.
 * The original invoiceController.js (2,525 lines) has been split into:
 *
 * - coreController.js: Core CRUD, validation, history, helpers
 * - paymentController.js: Payments, refunds, cancellations, statistics
 * - billingController.js: Convention billing, category views, item operations
 */

const coreController = require('./coreController');
const paymentController = require('./paymentController');
const billingController = require('./billingController');

// Re-export all functions maintaining backward compatibility
module.exports = {
  // =====================================================
  // Core Controller Functions
  // =====================================================
  // CRUD Operations
  getInvoices: coreController.getInvoices,
  getInvoice: coreController.getInvoice,
  createInvoice: coreController.createInvoice,
  updateInvoice: coreController.updateInvoice,
  deleteInvoice: coreController.deleteInvoice,

  // Validation & History
  validateInvoicePrices: coreController.validateInvoicePrices,
  getInvoiceHistory: coreController.getInvoiceHistory,
  markAsSent: coreController.markAsSent,

  // Helper functions (also exposed for use by other modules)
  createSurgeryCasesIfNeeded: coreController.createSurgeryCasesIfNeeded,
  createSurgeryCasesForPaidItems: coreController.createSurgeryCasesForPaidItems,
  validateItemsAgainstFeeSchedule: coreController.validateItemsAgainstFeeSchedule,
  applyPackageDeals: coreController.applyPackageDeals,

  // =====================================================
  // Payment Controller Functions
  // =====================================================
  // Payment Operations
  addPayment: paymentController.addPayment,
  cancelInvoice: paymentController.cancelInvoice,
  issueRefund: paymentController.issueRefund,
  sendReminder: paymentController.sendReminder,

  // Patient & Reporting
  getPatientInvoices: paymentController.getPatientInvoices,
  getOverdueInvoices: paymentController.getOverdueInvoices,
  getInvoiceStats: paymentController.getInvoiceStats,

  // =====================================================
  // Billing Controller Functions
  // =====================================================
  // Convention Billing
  previewCompanyBilling: billingController.previewCompanyBilling,
  applyCompanyBilling: billingController.applyCompanyBilling,
  consumeApprovals: billingController.consumeApprovals,

  // Category-Filtered Views
  getPharmacyInvoiceView: billingController.getPharmacyInvoiceView,
  getOpticalInvoiceView: billingController.getOpticalInvoiceView,
  getClinicInvoiceView: billingController.getClinicInvoiceView,

  // Item-Level Operations
  markItemCompleted: billingController.markItemCompleted,
  markItemExternal: billingController.markItemExternal,
  collectItemPayment: billingController.collectItemPayment,
  getInvoiceItems: billingController.getInvoiceItems
};
