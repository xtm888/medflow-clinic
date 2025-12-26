const express = require('express');
const router = express.Router();
// Import from split controller modules (maintains backward compatibility via index.js)
const companyController = require('../controllers/companies');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Search route (before :id to avoid conflicts)
router.get('/search', companyController.searchCompanies);

// Hierarchy view (parent conventions with sub-companies)
router.get('/hierarchy', companyController.getCompaniesHierarchy);

// Financial dashboard for all parent conventions
router.get('/financial-dashboard', authorize('admin', 'billing', 'manager'), companyController.getConventionsFinancialDashboard);

// Aging report (all conventions)
router.get('/aging-report', authorize('admin', 'billing', 'manager'), companyController.getConventionsAgingReport);
router.get('/aging-report/pdf', authorize('admin', 'billing', 'manager'), companyController.downloadAgingReportPDF);

// Special list routes
router.get('/expiring-contracts', authorize('admin', 'billing', 'manager'), companyController.getExpiringContracts);
router.get('/with-outstanding', authorize('admin', 'billing', 'manager'), companyController.getCompaniesWithOutstanding);

// Main CRUD routes
router.route('/')
  .get(companyController.getCompanies)
  .post(authorize('admin', 'billing', 'manager'), companyController.createCompany);

router.route('/:id')
  .get(companyController.getCompany)
  .put(authorize('admin', 'billing', 'manager'), companyController.updateCompany)
  .delete(authorize('admin'), companyController.deleteCompany);

// Employee management
router.get('/:id/employees', companyController.getCompanyEmployees);

// Invoice and billing
router.get('/:id/invoices', authorize('admin', 'billing', 'manager'), companyController.getCompanyInvoices);
router.get('/:id/statement', authorize('admin', 'billing', 'manager'), companyController.getCompanyStatement);
router.post('/:id/payments', authorize('admin', 'billing'), companyController.recordCompanyPayment);
router.get('/:id/payment-history', authorize('admin', 'billing', 'manager'), companyController.getCompanyPaymentHistory);

// Fee schedule management
router.get('/:id/fee-schedule', companyController.getCompanyFeeSchedule);
router.put('/:id/fee-schedule', authorize('admin', 'billing', 'manager'), companyController.updateCompanyFeeSchedule);

// Approvals
router.get('/:id/approvals', companyController.getCompanyApprovals);

// Statistics
router.get('/:id/stats', authorize('admin', 'billing', 'manager'), companyController.getCompanyStats);

// Unrealized items report
router.get('/:id/unrealized-items', authorize('admin', 'billing', 'manager'), companyController.getUnrealizedItems);

// Batch invoice generation (bordereau)
router.post('/:id/generate-batch-invoice', authorize('admin', 'billing'), companyController.generateBatchInvoice);

// Coverage preview (before invoice creation)
router.post('/:id/preview-coverage', companyController.previewCoverage);

// Patient remaining coverage
router.get('/:id/patient/:patientId/remaining-coverage', companyController.getPatientRemainingCoverage);

// PDF Downloads
router.get('/:id/statement/pdf', authorize('admin', 'billing', 'manager'), companyController.downloadCompanyStatementPDF);
router.post('/:id/generate-batch-invoice/pdf', authorize('admin', 'billing'), companyController.downloadBatchInvoicePDF);

module.exports = router;
