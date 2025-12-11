import api from './apiConfig';

/**
 * Company/Convention Service
 * Handles all company (employer/insurance) related API calls
 */

// ============================================
// COMPANY CRUD
// ============================================

/**
 * Get all companies with optional filters
 */
export const getCompanies = async (params = {}) => {
  const response = await api.get('/companies', { params });
  return response.data;
};

/**
 * Search companies by name
 */
export const searchCompanies = async (query) => {
  const response = await api.get('/companies/search', { params: { q: query } });
  return response.data;
};

/**
 * Get single company by ID
 */
export const getCompany = async (id) => {
  const response = await api.get(`/companies/${id}`);
  return response.data;
};

/**
 * Create new company
 */
export const createCompany = async (companyData) => {
  const response = await api.post('/companies', companyData);
  return response.data;
};

/**
 * Update company
 */
export const updateCompany = async (id, companyData) => {
  const response = await api.put(`/companies/${id}`, companyData);
  return response.data;
};

/**
 * Delete company
 */
export const deleteCompany = async (id) => {
  const response = await api.delete(`/companies/${id}`);
  return response.data;
};

// ============================================
// COMPANY EMPLOYEES
// ============================================

/**
 * Get employees for a company
 */
export const getCompanyEmployees = async (companyId, params = {}) => {
  const response = await api.get(`/companies/${companyId}/employees`, { params });
  return response.data;
};

// ============================================
// COMPANY INVOICES & BILLING
// ============================================

/**
 * Get invoices for a company
 */
export const getCompanyInvoices = async (companyId, params = {}) => {
  const response = await api.get(`/companies/${companyId}/invoices`, { params });
  return response.data;
};

/**
 * Get company statement
 */
export const getCompanyStatement = async (companyId, params = {}) => {
  const response = await api.get(`/companies/${companyId}/statement`, { params });
  return response.data;
};

/**
 * Record payment from company
 */
export const recordCompanyPayment = async (companyId, paymentData) => {
  const response = await api.post(`/companies/${companyId}/payments`, paymentData);
  return response.data;
};

// ============================================
// FEE SCHEDULE
// ============================================

/**
 * Get company fee schedule
 */
export const getCompanyFeeSchedule = async (companyId) => {
  const response = await api.get(`/companies/${companyId}/fee-schedule`);
  return response.data;
};

/**
 * Update company fee schedule
 */
export const updateCompanyFeeSchedule = async (companyId, feeScheduleData) => {
  const response = await api.put(`/companies/${companyId}/fee-schedule`, feeScheduleData);
  return response.data;
};

// ============================================
// APPROVALS
// ============================================

/**
 * Get company approvals
 */
export const getCompanyApprovals = async (companyId, params = {}) => {
  const response = await api.get(`/companies/${companyId}/approvals`, { params });
  return response.data;
};

// ============================================
// STATISTICS & REPORTS
// ============================================

/**
 * Get company statistics
 */
export const getCompanyStats = async (companyId, params = {}) => {
  const response = await api.get(`/companies/${companyId}/stats`, { params });
  return response.data;
};

/**
 * Get companies with outstanding balance
 */
export const getCompaniesWithOutstanding = async (minAmount = 0) => {
  const response = await api.get('/companies/with-outstanding', { params: { minAmount } });
  return response.data;
};

/**
 * Get expiring contracts
 */
export const getExpiringContracts = async (daysAhead = 30) => {
  const response = await api.get('/companies/expiring-contracts', { params: { daysAhead } });
  return response.data;
};

/**
 * Get companies in hierarchical view (parent conventions with sub-companies)
 */
export const getCompaniesHierarchy = async (params = {}) => {
  const response = await api.get('/companies/hierarchy', { params });
  return response.data;
};

// ============================================
// CONVENTION BILLING (via billing routes)
// ============================================

/**
 * Apply convention billing to an invoice
 */
export const applyConventionBilling = async (invoiceId, companyId, exchangeRateUSD = null) => {
  const response = await api.post(`/billing/convention/apply/${invoiceId}`, {
    companyId,
    exchangeRateUSD
  });
  return response.data;
};

/**
 * Get all convention invoices
 */
export const getConventionInvoices = async (params = {}) => {
  const response = await api.get('/billing/convention/invoices', { params });
  return response.data;
};

/**
 * Get company billing summary
 */
export const getCompanyBillingSummary = async (companyId, startDate = null, endDate = null) => {
  const response = await api.get(`/billing/convention/summary/${companyId}`, {
    params: { startDate, endDate }
  });
  return response.data;
};

/**
 * Generate company statement
 */
export const generateCompanyStatement = async (companyId, params = {}) => {
  const response = await api.get(`/billing/convention/statement/${companyId}`, { params });
  return response.data;
};

/**
 * Get unrealized items
 */
export const getUnrealizedItems = async (params = {}) => {
  const response = await api.get('/billing/convention/unrealized', { params });
  return response.data;
};

/**
 * Get convention price for a service
 */
export const getConventionPrice = async (companyId, code) => {
  const response = await api.get('/billing/convention/price', {
    params: { companyId, code }
  });
  return response.data;
};

/**
 * Check approval requirement
 */
export const checkApprovalRequirement = async (patientId, companyId, actCode) => {
  const response = await api.get('/billing/convention/check-approval', {
    params: { patientId, companyId, actCode }
  });
  return response.data;
};

/**
 * Update company invoice status
 */
export const updateCompanyInvoiceStatus = async (invoiceId, status, reference = null, notes = null) => {
  const response = await api.put(`/billing/convention/${invoiceId}/status`, {
    status,
    reference,
    notes
  });
  return response.data;
};

/**
 * Record convention payment on invoice
 */
export const recordConventionPayment = async (invoiceId, amount, reference = '', notes = '') => {
  const response = await api.post(`/billing/convention/${invoiceId}/payment`, {
    amount,
    reference,
    notes
  });
  return response.data;
};

// ============================================
// REALIZATION TRACKING
// ============================================

/**
 * Mark invoice item as realized
 */
export const markItemRealized = async (invoiceId, itemIndex, notes = '') => {
  const response = await api.post(`/billing/realize/${invoiceId}/item/${itemIndex}`, { notes });
  return response.data;
};

/**
 * Mark all invoice items as realized
 */
export const markAllRealized = async (invoiceId, notes = '') => {
  const response = await api.post(`/billing/realize/${invoiceId}/all`, { notes });
  return response.data;
};

export default {
  // Company CRUD
  getCompanies,
  searchCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  // Employees
  getCompanyEmployees,
  // Invoices & Billing
  getCompanyInvoices,
  getCompanyStatement,
  recordCompanyPayment,
  // Fee Schedule
  getCompanyFeeSchedule,
  updateCompanyFeeSchedule,
  // Approvals
  getCompanyApprovals,
  // Statistics
  getCompanyStats,
  getCompaniesWithOutstanding,
  getExpiringContracts,
  // Hierarchy
  getCompaniesHierarchy,
  // Convention Billing
  applyConventionBilling,
  getConventionInvoices,
  getCompanyBillingSummary,
  generateCompanyStatement,
  getUnrealizedItems,
  getConventionPrice,
  checkApprovalRequirement,
  updateCompanyInvoiceStatus,
  recordConventionPayment,
  // Realization
  markItemRealized,
  markAllRealized
};
