/**
 * Company Controllers Index
 *
 * Re-exports all company controller functions for backward compatibility.
 * The original companyController.js (2,037 lines) has been split into:
 *
 * - coreController.js: CRUD operations, employees, search, hierarchy
 * - billingController.js: Invoices, payments, statements, fee schedules, reports
 */

const coreController = require('./coreController');
const billingController = require('./billingController');

// Re-export all functions maintaining backward compatibility
module.exports = {
  // =====================================================
  // Core Controller Functions (CRUD, Employees, Search)
  // =====================================================
  getCompanies: coreController.getCompanies,
  getCompany: coreController.getCompany,
  createCompany: coreController.createCompany,
  updateCompany: coreController.updateCompany,
  deleteCompany: coreController.deleteCompany,
  getCompanyEmployees: coreController.getCompanyEmployees,
  searchCompanies: coreController.searchCompanies,
  getExpiringContracts: coreController.getExpiringContracts,
  getCompaniesWithOutstanding: coreController.getCompaniesWithOutstanding,
  getCompaniesHierarchy: coreController.getCompaniesHierarchy,

  // =====================================================
  // Billing Controller Functions (Invoices, Payments, Reports)
  // =====================================================
  // Invoices & Statements
  getCompanyInvoices: billingController.getCompanyInvoices,
  getCompanyStatement: billingController.getCompanyStatement,
  downloadCompanyStatementPDF: billingController.downloadCompanyStatementPDF,

  // Payments
  recordCompanyPayment: billingController.recordCompanyPayment,
  getCompanyPaymentHistory: billingController.getCompanyPaymentHistory,

  // Fee Schedules
  getCompanyFeeSchedule: billingController.getCompanyFeeSchedule,
  updateCompanyFeeSchedule: billingController.updateCompanyFeeSchedule,

  // Approvals & Stats
  getCompanyApprovals: billingController.getCompanyApprovals,
  getCompanyStats: billingController.getCompanyStats,

  // Batch Processing & Coverage
  getUnrealizedItems: billingController.getUnrealizedItems,
  generateBatchInvoice: billingController.generateBatchInvoice,
  downloadBatchInvoicePDF: billingController.downloadBatchInvoicePDF,
  previewCoverage: billingController.previewCoverage,
  getPatientRemainingCoverage: billingController.getPatientRemainingCoverage,

  // Conventions Financial Reports
  getConventionsFinancialDashboard: billingController.getConventionsFinancialDashboard,
  getConventionsAgingReport: billingController.getConventionsAgingReport,
  downloadAgingReportPDF: billingController.downloadAgingReportPDF
};
