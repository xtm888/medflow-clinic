const express = require('express');
const router = express.Router();
const {
  // Statistics & Reports
  getBillingStatistics,
  getRevenueReport,
  getAgingReport,
  getAgingReportByPatient,
  getAgingTrendReport,
  getOutstandingBalances,
  getDailyReconciliation,
  getProcessingFeesReport,
  getOpticalRevenue,
  getOpticalShopRevenue,
  getOpticalTopSellers,
  getOpticalInventoryValue,
  // Fee Schedule & Tax
  getFeeSchedule,
  createFeeItem,
  updateFeeItem,
  deleteFeeItem,
  copyFeeScheduleToClinic,
  getClinicPricingStatus,
  getFeeScheduleTemplates,
  getBillingCodes,
  searchBillingCodes,
  getTaxRates,
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
  calculateTax,
  // Insurance Claims
  getClaims,
  getClaim,
  createClaim,
  submitClaim,
  approveClaim,
  denyClaim,
  markClaimPaid,
  getClaimsReport,
  batchSubmitClaims,
  // Payment Plans
  getPaymentPlans,
  getPaymentPlan,
  createPaymentPlan,
  activatePaymentPlan,
  recordPlanPayment,
  getOverdueInstallments,
  cancelPaymentPlan,
  // Documents (PDF generation)
  generateInvoicePDF,
  generateReceiptPDF,
  generateStatementPDF,
  generateClaimPDF,
  generateCompanyStatement,
  // Payments (core, gateway, currency, credits)
  getPaymentMethods,
  getPatientBilling,
  getPayments,
  applyDiscount,
  writeOff,
  allocatePaymentToInvoices,
  getSuggestedPaymentAllocation,
  getGatewayMethods,
  processGatewayPayment,
  createPaymentIntent,
  processRefund,
  handlePaymentWebhook,
  getExchangeRates,
  getSupportedCurrencies,
  convertCurrency,
  calculateMultiCurrencyTotal,
  processMultiCurrencyPayment,
  getAmountDueInCurrencies,
  parsePaymentString,
  bulkGenerateInvoices,
  getPatientCredit,
  addPatientCredit,
  applyPatientCredit,
  getPatientsWithCredit,
  getProcessingFeeRates,
  calculateProcessingFeeAmount,
  // Cash Drawer
  getCashDrawerStatus,
  closeCashDrawer,
  // Convention/Company Billing
  applyConventionBilling,
  markItemRealized,
  markAllRealized,
  updateCompanyInvoiceStatus,
  recordConventionPayment,
  getConventionInvoices,
  getCompanyBillingSummary,
  getUnrealizedItems,
  checkApprovalRequirement,
  getConventionPrice
} = require('../controllers/billing');

const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logCriticalOperation } = require('../middleware/auditLogger');

// Webhook routes (no auth - verified by signature)
router.post('/webhook/:provider', express.raw({ type: 'application/json' }), handlePaymentWebhook);

// Protect all other routes and add clinic context
const { optionalClinic } = require('../middleware/clinicAuth');
router.use(protect);
router.use(optionalClinic);

// Statistics and reports
router.get('/statistics', requirePermission('manage_billing'), getBillingStatistics);
router.get('/reports/revenue', requirePermission('manage_billing'), getRevenueReport);
router.get('/reports/aging', requirePermission('manage_billing'), getAgingReport);
router.get('/reports/aging/by-patient', requirePermission('manage_billing'), getAgingReportByPatient);
router.get('/reports/aging/trend', requirePermission('manage_billing'), getAgingTrendReport);
router.get('/reports/daily-reconciliation', requirePermission('manage_billing'), getDailyReconciliation);
router.get('/reports/processing-fees', requirePermission('manage_billing'), getProcessingFeesReport);

// Optical inventory reports
router.get('/reports/optical-revenue', authorize('admin', 'accountant', 'manager'), getOpticalRevenue);
router.get('/reports/optical-top-sellers', authorize('admin', 'accountant', 'manager'), getOpticalTopSellers);
router.get('/reports/optical-inventory-value', authorize('admin', 'accountant', 'manager'), getOpticalInventoryValue);
// Optical shop revenue (glasses orders with optician performance)
router.get('/reports/optical-shop', authorize('admin', 'accountant', 'manager', 'optician'), getOpticalShopRevenue);
router.get('/outstanding-balances', requirePermission('manage_billing'), getOutstandingBalances);

// Processing fees
router.get('/processing-fees/rates', requirePermission('manage_billing'), getProcessingFeeRates);
router.post('/processing-fees/calculate', requirePermission('manage_invoices', 'create_invoices'), calculateProcessingFeeAmount);

// Cash drawer management
router.get('/cash-drawer', requirePermission('manage_invoices', 'create_invoices'), getCashDrawerStatus);
router.post('/cash-drawer/close', requirePermission('manage_billing'), logCriticalOperation('CASH_DRAWER_CLOSE'), closeCashDrawer);

// Fee schedule CRUD
router.route('/fee-schedule')
  .get(requirePermission('view_financial', 'manage_billing'), getFeeSchedule)
  .post(requirePermission('manage_system'), logCriticalOperation('CREATE_FEE_ITEM'), createFeeItem);

// Multi-clinic fee schedule endpoints (MUST be before :id route)
router.get('/fee-schedule/templates', requirePermission('view_financial', 'manage_billing'), getFeeScheduleTemplates);
router.get('/fee-schedule/clinic-status', requirePermission('manage_system'), getClinicPricingStatus);
router.post('/fee-schedule/copy-to-clinic', requirePermission('manage_system'), logCriticalOperation('COPY_FEE_SCHEDULE'), copyFeeScheduleToClinic);

router.route('/fee-schedule/:id')
  .put(requirePermission('manage_system'), logCriticalOperation('UPDATE_FEE_ITEM'), updateFeeItem)
  .delete(requirePermission('manage_system'), logCriticalOperation('DELETE_FEE_ITEM'), deleteFeeItem);

// ============================================
// FEE SCHEDULE DATE RANGE MANAGEMENT
// ============================================

const FeeSchedule = require('../models/FeeSchedule');

// Get effective price for a specific date
router.get('/fee-schedule/effective-price/:code', requirePermission('view_financial', 'manage_billing'), async (req, res) => {
  try {
    const { code } = req.params;
    const { date } = req.query;

    const serviceDate = date ? new Date(date) : new Date();
    const result = await FeeSchedule.getEffectivePriceForDate(code, serviceDate);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Validate price against fee schedule for a specific date
router.post('/fee-schedule/validate-price', requirePermission('manage_invoices', 'create_invoices'), async (req, res) => {
  try {
    const { code, price, serviceDate, options } = req.body;

    if (!code || price === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Code and price are required'
      });
    }

    const result = await FeeSchedule.validatePriceForDate(
      code,
      price,
      serviceDate || new Date(),
      options || {}
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all effective fees for a specific date
router.get('/fee-schedule/effective-for-date', requirePermission('view_financial', 'manage_billing'), async (req, res) => {
  try {
    const { date, category } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    const fees = await FeeSchedule.getAllEffectiveForDate(targetDate, category);

    res.json({
      success: true,
      count: fees.length,
      data: fees
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get expired fee items
router.get('/fee-schedule/expired', requirePermission('manage_billing'), async (req, res) => {
  try {
    const expiredItems = await FeeSchedule.getExpiredItems();

    res.json({
      success: true,
      count: expiredItems.length,
      data: expiredItems
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get upcoming fee changes
router.get('/fee-schedule/upcoming-changes', requirePermission('manage_billing'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const upcomingChanges = await FeeSchedule.getUpcomingChanges(parseInt(days));

    res.json({
      success: true,
      count: upcomingChanges.length,
      data: upcomingChanges
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get price history for a code
router.get('/fee-schedule/:code/history', requirePermission('manage_billing'), async (req, res) => {
  try {
    const history = await FeeSchedule.getPriceHistory(req.params.code);

    res.json({
      success: true,
      code: req.params.code,
      data: history
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Billing codes
router.get('/codes', requirePermission('view_financial', 'manage_billing'), getBillingCodes);
router.get('/codes/search', requirePermission('view_financial', 'manage_billing'), searchBillingCodes);

// Payment methods
router.get('/payment-methods', requirePermission('manage_invoices', 'create_invoices'), getPaymentMethods);

// Tax configuration
router.route('/taxes')
  .get(requirePermission('manage_billing'), getTaxRates)
  .post(requirePermission('manage_system'), logCriticalOperation('CREATE_TAX_RATE'), createTaxRate);

router.route('/taxes/:id')
  .put(requirePermission('manage_system'), logCriticalOperation('UPDATE_TAX_RATE'), updateTaxRate)
  .delete(requirePermission('manage_system'), logCriticalOperation('DELETE_TAX_RATE'), deleteTaxRate);

router.post('/taxes/calculate', requirePermission('view_financial', 'manage_billing'), calculateTax);

// Insurance claims
router.get('/claims/report', requirePermission('manage_billing'), getClaimsReport);
router.get('/claims/overdue', requirePermission('manage_billing'), getOverdueInstallments);

router.route('/claims')
  .get(requirePermission('manage_billing'), getClaims)
  .post(requirePermission('manage_invoices', 'create_invoices'), createClaim);

router.route('/claims/:id')
  .get(requirePermission('manage_invoices', 'create_invoices'), getClaim);

router.get('/claims/:id/pdf', requirePermission('manage_billing'), generateClaimPDF);
router.post('/claims/:id/submit', requirePermission('manage_billing'), submitClaim);
router.post('/claims/:id/approve', requirePermission('manage_billing'), logCriticalOperation('APPROVE_CLAIM'), approveClaim);
router.post('/claims/:id/deny', requirePermission('manage_billing'), logCriticalOperation('DENY_CLAIM'), denyClaim);
router.post('/claims/:id/mark-paid', requirePermission('manage_billing'), logCriticalOperation('MARK_CLAIM_PAID'), markClaimPaid);

// Manual sync insurance claim to invoice
router.post('/claims/:id/sync-to-invoice', requirePermission('manage_billing'), async (req, res) => {
  try {
    const InsuranceClaim = require('../models/InsuranceClaim');
    const claim = await InsuranceClaim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    const adjustment = await claim.syncToInvoice(req.user._id);

    res.json({
      success: true,
      data: {
        claimNumber: claim.claimNumber,
        adjustment
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sync all pending claims to invoices
router.post('/claims/sync-all', requirePermission('manage_system'), async (req, res) => {
  try {
    const InsuranceClaim = require('../models/InsuranceClaim');
    const results = await InsuranceClaim.syncAllPendingToInvoices(req.user._id);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get invoice insurance adjustment history
router.get('/invoices/:id/insurance-history', requirePermission('manage_billing'), async (req, res) => {
  try {
    const Invoice = require('../models/Invoice');
    const invoice = await Invoice.findById(req.params.id)
      .select('invoiceId insuranceSummary insuranceAdjustments')
      .populate('insuranceAdjustments.processedBy', 'firstName lastName')
      .populate('insuranceAdjustments.claimId', 'claimNumber status');

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    res.json({
      success: true,
      data: {
        invoiceId: invoice.invoiceId,
        insuranceSummary: invoice.insuranceSummary,
        adjustmentHistory: invoice.insuranceAdjustments || []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Payment plans
router.get('/payment-plans/overdue', requirePermission('manage_billing'), getOverdueInstallments);

router.route('/payment-plans')
  .get(requirePermission('manage_invoices', 'create_invoices'), getPaymentPlans)
  .post(requirePermission('manage_billing'), createPaymentPlan);

router.route('/payment-plans/:id')
  .get(requirePermission('manage_invoices', 'create_invoices'), getPaymentPlan);

router.post('/payment-plans/:id/activate', requirePermission('manage_billing'), activatePaymentPlan);
router.post('/payment-plans/:id/pay', requirePermission('manage_invoices', 'create_invoices'), recordPlanPayment);
router.post('/payment-plans/:id/cancel', requirePermission('manage_system'), logCriticalOperation('CANCEL_PAYMENT_PLAN'), cancelPaymentPlan);

// Invoice actions
router.post('/invoices/:id/apply-discount', requirePermission('manage_billing'), logCriticalOperation('APPLY_DISCOUNT'), applyDiscount);
router.post('/invoices/:id/write-off', requirePermission('manage_system'), logCriticalOperation('WRITE_OFF'), writeOff);
router.get('/invoices/:id/pdf', requirePermission('view_financial', 'manage_billing'), generateInvoicePDF);
router.get('/invoices/:id/receipt/:paymentIndex', requirePermission('manage_invoices', 'create_invoices'), generateReceiptPDF);

// Bulk operations
router.post('/invoices/bulk-generate', requirePermission('manage_billing'), logCriticalOperation('BULK_GENERATE_INVOICES'), bulkGenerateInvoices);
router.post('/claims/batch', requirePermission('manage_billing'), logCriticalOperation('BATCH_SUBMIT_CLAIMS'), batchSubmitClaims);

// Patient statements
router.get('/patients/:patientId/statement', requirePermission('manage_invoices', 'create_invoices'), generateStatementPDF);

// Payment gateway
router.get('/gateway/methods', requirePermission('manage_invoices', 'create_invoices'), getGatewayMethods);
router.post('/gateway/process', requirePermission('manage_invoices', 'create_invoices'), logCriticalOperation('PROCESS_PAYMENT'), processGatewayPayment);
router.post('/gateway/create-intent', requirePermission('manage_invoices', 'create_invoices'), createPaymentIntent);
router.post('/gateway/refund', requirePermission('manage_billing'), logCriticalOperation('PROCESS_REFUND'), processRefund);

// ============================================
// MULTI-CURRENCY SUPPORT
// ============================================

// Get live exchange rates (CDF, USD, EUR)
router.get('/currency/rates', requirePermission('view_financial', 'manage_billing'), getExchangeRates);

// Get supported currencies
router.get('/currency/supported', requirePermission('view_financial', 'manage_billing'), getSupportedCurrencies);

// Convert currency
router.post('/currency/convert', requirePermission('manage_invoices', 'create_invoices'), convertCurrency);

// Calculate total from multi-currency payments
router.post('/currency/calculate-total', requirePermission('manage_invoices', 'create_invoices'), calculateMultiCurrencyTotal);

// Parse payment string (e.g., "5000 CDF + 10 USD")
router.post('/currency/parse-payment', requirePermission('manage_invoices', 'create_invoices'), parsePaymentString);

// Get amount due in multiple currencies
router.get('/invoices/:invoiceId/amount-due-currencies', requirePermission('manage_invoices', 'create_invoices'), getAmountDueInCurrencies);

// Process multi-currency payment (split payment)
router.post(
  '/invoices/:invoiceId/multi-currency-payment',
  requirePermission('manage_invoices', 'create_invoices'),
  logCriticalOperation('MULTI_CURRENCY_PAYMENT'),
  processMultiCurrencyPayment
);

// ============================================
// MULTI-INVOICE PAYMENT ALLOCATION
// ============================================

// Get suggested payment allocation for a patient
router.get(
  '/patients/:patientId/payment-allocation',
  requirePermission('manage_invoices', 'create_invoices'),
  getSuggestedPaymentAllocation
);

// Allocate payment across multiple invoices
router.post(
  '/allocate-payment',
  requirePermission('manage_invoices', 'create_invoices'),
  logCriticalOperation('ALLOCATE_PAYMENT'),
  allocatePaymentToInvoices
);

// ============================================
// PATIENT CREDIT MANAGEMENT
// ============================================

// Get all patients with credit balance
router.get('/credits', requirePermission('manage_billing'), getPatientsWithCredit);

// Get patient credit balance
router.get('/patients/:patientId/credit', requirePermission('manage_invoices', 'create_invoices'), getPatientCredit);

// Add credit to patient account
router.post(
  '/patients/:patientId/credit',
  requirePermission('manage_billing'),
  logCriticalOperation('ADD_PATIENT_CREDIT'),
  addPatientCredit
);

// Apply patient credit to invoice
router.post(
  '/patients/:patientId/credit/apply',
  requirePermission('manage_invoices', 'create_invoices'),
  logCriticalOperation('APPLY_PATIENT_CREDIT'),
  applyPatientCredit
);

// ============================================
// STORED PAYMENT METHODS
// ============================================

const Patient = require('../models/Patient');

// Get patient's stored payment methods
router.get('/patients/:patientId/payment-methods', requirePermission('manage_invoices', 'create_invoices'), async (req, res) => {
  try {
    const result = await Patient.getPaymentMethods(req.params.patientId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.message === 'Patient not found' ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

// Add a stored payment method
router.post('/patients/:patientId/payment-methods', requirePermission('manage_billing'), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.patientId);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    const paymentMethod = await patient.addPaymentMethod(req.body, req.user._id);
    res.status(201).json({ success: true, data: paymentMethod });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Remove a stored payment method
router.delete('/patients/:patientId/payment-methods/:methodId', requirePermission('manage_billing'), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.patientId);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    const result = await patient.removePaymentMethod(req.params.methodId, req.user._id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(error.message === 'Payment method not found' ? 404 : 400).json({
      success: false,
      error: error.message
    });
  }
});

// Set default payment method
router.put('/patients/:patientId/payment-methods/:methodId/default', requirePermission('manage_billing'), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.patientId);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    const paymentMethod = await patient.setDefaultPaymentMethod(req.params.methodId, req.user._id);
    res.json({ success: true, data: paymentMethod });
  } catch (error) {
    res.status(error.message === 'Payment method not found' ? 404 : 400).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// PAYMENT PLAN AUTO-CHARGE
// ============================================

const PaymentPlan = require('../models/PaymentPlan');
const paymentPlanAutoChargeService = require('../services/paymentPlanAutoChargeService');

// Enable/disable auto-charge for a payment plan
router.put('/payment-plans/:id/auto-charge', requirePermission('manage_billing'), async (req, res) => {
  try {
    const plan = await PaymentPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Payment plan not found' });
    }

    const { enabled, paymentMethodId, notifyBeforeDays } = req.body;

    if (enabled && !paymentMethodId) {
      return res.status(400).json({
        success: false,
        error: 'Payment method ID is required to enable auto-charge'
      });
    }

    // If enabling, verify the payment method exists
    if (enabled) {
      const patient = await Patient.findById(plan.patient);
      const pm = patient?.storedPaymentMethods?.find(
        p => (p.id === paymentMethodId || p._id?.toString() === paymentMethodId) && p.isActive
      );

      if (!pm) {
        return res.status(400).json({
          success: false,
          error: 'Payment method not found or inactive'
        });
      }
    }

    plan.autoPayment.enabled = enabled;
    if (paymentMethodId) plan.autoPayment.paymentMethodId = paymentMethodId;
    if (notifyBeforeDays) plan.autoPayment.notifyBeforeDays = notifyBeforeDays;

    // Clear disabled status when re-enabling
    if (enabled) {
      plan.autoPayment.disabledReason = null;
      plan.autoPayment.disabledAt = null;
      plan.autoPayment.disabledBy = null;
    } else {
      plan.autoPayment.disabledAt = new Date();
      plan.autoPayment.disabledBy = req.user._id;
      plan.autoPayment.disabledReason = req.body.reason || 'Manually disabled';
    }

    plan.updatedBy = req.user._id;
    await plan.save();

    res.json({
      success: true,
      data: {
        planId: plan.planId,
        autoPayment: plan.autoPayment
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get auto-charge status for a payment plan
router.get('/payment-plans/:id/auto-charge', requirePermission('manage_invoices', 'create_invoices'), async (req, res) => {
  try {
    const status = await paymentPlanAutoChargeService.getAutoChargeStatus(req.params.id);
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(error.message === 'Payment plan not found' ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

// Manually trigger auto-charge for a payment plan
router.post(
  '/payment-plans/:id/auto-charge/trigger',
  requirePermission('manage_billing'),
  logCriticalOperation('TRIGGER_AUTO_CHARGE'),
  async (req, res) => {
    try {
      const results = await paymentPlanAutoChargeService.manualTrigger(req.params.id);
      res.json({ success: true, data: results });
    } catch (error) {
      res.status(error.message.includes('not found') ? 404 : 400).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get auto-charge processing status (for admin dashboard)
router.get('/auto-charge/status', requirePermission('manage_system'), async (req, res) => {
  try {
    const activePlans = await PaymentPlan.countDocuments({
      status: 'active',
      'autoPayment.enabled': true
    });

    const disabledDueToFailure = await PaymentPlan.countDocuments({
      status: 'active',
      'autoPayment.enabled': false,
      'autoPayment.disabledReason': { $regex: /failure/i }
    });

    const pendingCharges = await PaymentPlan.aggregate([
      { $match: { status: 'active', 'autoPayment.enabled': true } },
      { $unwind: '$installments' },
      {
        $match: {
          'installments.status': { $in: ['pending', 'overdue'] },
          'installments.dueDate': { $lte: new Date() }
        }
      },
      { $count: 'count' }
    ]);

    res.json({
      success: true,
      data: {
        activePlansWithAutoCharge: activePlans,
        plansDisabledDueToFailure: disabledDueToFailure,
        pendingCharges: pendingCharges[0]?.count || 0,
        schedulerRunning: !!paymentPlanAutoChargeService.schedulerInterval
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CONVENTION/COMPANY BILLING
// ============================================

// Convention billing - apply to invoice
router.post(
  '/convention/apply/:invoiceId',
  requirePermission('manage_billing'),
  logCriticalOperation('APPLY_CONVENTION_BILLING'),
  applyConventionBilling
);

// Convention invoices list and reports
router.get('/convention/invoices', requirePermission('manage_billing'), getConventionInvoices);
router.get('/convention/summary/:companyId', requirePermission('manage_billing'), getCompanyBillingSummary);
router.get('/convention/statement/:companyId', requirePermission('manage_billing'), generateCompanyStatement);
router.get('/convention/unrealized', requirePermission('manage_billing'), getUnrealizedItems);

// Convention pricing and approvals
router.get('/convention/price', requirePermission('view_financial', 'manage_billing'), getConventionPrice);
router.get('/convention/check-approval', requirePermission('manage_invoices', 'create_invoices'), checkApprovalRequirement);

// Company invoice status and payment
router.put(
  '/convention/:invoiceId/status',
  requirePermission('manage_billing'),
  logCriticalOperation('UPDATE_COMPANY_INVOICE_STATUS'),
  updateCompanyInvoiceStatus
);

router.post(
  '/convention/:invoiceId/payment',
  requirePermission('manage_billing'),
  logCriticalOperation('RECORD_COMPANY_PAYMENT'),
  recordConventionPayment
);

// Realization tracking
router.post(
  '/realize/:invoiceId/item/:itemIndex',
  requirePermission('manage_invoices', 'create_invoices'),
  markItemRealized
);

router.post(
  '/realize/:invoiceId/all',
  requirePermission('manage_invoices', 'create_invoices'),
  markAllRealized
);

module.exports = router;
