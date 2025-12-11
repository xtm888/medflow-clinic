/**
 * Central Server Service
 * Frontend service for accessing cross-clinic data via the backend proxy
 */

import api from './apiConfig';

/**
 * Check if central server is available
 */
export const checkConnection = async () => {
  const response = await api.get('/central/status');
  return response.data;
};

/**
 * Get central dashboard summary
 */
export const getDashboard = async () => {
  const response = await api.get('/central/dashboard');
  return response.data;
};

// ============ PATIENT APIs ============

/**
 * Search patients across all clinics
 * @param {Object} params - Search parameters
 * @param {string} params.search - Search query (name, phone, nationalId)
 * @param {string} params.clinicId - Filter by clinic (optional)
 * @param {number} params.page - Page number
 * @param {number} params.limit - Results per page
 */
export const searchPatients = async (params = {}) => {
  const response = await api.get('/central/patients/search', { params });
  return response.data;
};

/**
 * Check if patient exists in other clinics
 * @param {Object} params - Check parameters
 * @param {string} params.nationalId - National ID to check
 * @param {string} params.phone - Phone number to check
 */
export const checkPatientExists = async (params = {}) => {
  const response = await api.get('/central/patients/check-exists', { params });
  return response.data;
};

/**
 * Get patient history across all clinics
 * @param {string} patientId - Patient ID
 */
export const getPatientHistory = async (patientId) => {
  const response = await api.get(`/central/patients/${patientId}/history`);
  return response.data;
};

/**
 * Get full patient details from source clinic
 * @param {string} patientId - Patient ID
 */
export const getFullPatient = async (patientId) => {
  const response = await api.get(`/central/patients/${patientId}/full`);
  return response.data;
};

/**
 * Get patient records from all clinics
 * @param {string} patientId - Patient ID
 */
export const getPatientAllClinics = async (patientId) => {
  const response = await api.get(`/central/patients/${patientId}/all-clinics`);
  return response.data;
};

// ============ INVENTORY APIs ============

/**
 * Get consolidated inventory across all clinics
 * @param {Object} params - Query parameters
 * @param {string} params.type - Filter by type (pharmacy, frames, contacts, reagents)
 * @param {string} params.status - Filter by status
 * @param {string} params.search - Search query
 */
export const getConsolidatedInventory = async (params = {}) => {
  const response = await api.get('/central/inventory', { params });
  return response.data;
};

/**
 * Get inventory summary by clinic
 */
export const getInventorySummary = async () => {
  const response = await api.get('/central/inventory/summary');
  return response.data;
};

/**
 * Get stock alerts across all clinics
 */
export const getInventoryAlerts = async () => {
  const response = await api.get('/central/inventory/alerts');
  return response.data;
};

/**
 * Get transfer recommendations
 */
export const getTransferRecommendations = async () => {
  const response = await api.get('/central/inventory/recommendations');
  return response.data;
};

/**
 * Get inventory categories
 */
export const getInventoryCategories = async () => {
  const response = await api.get('/central/inventory/categories');
  return response.data;
};

/**
 * Get expiring items across all clinics
 */
export const getExpiringItems = async () => {
  const response = await api.get('/central/inventory/expiring');
  return response.data;
};

/**
 * Get specific product stock across clinics
 * @param {string} sku - Product SKU
 */
export const getProductStock = async (sku) => {
  const response = await api.get(`/central/inventory/product/${sku}`);
  return response.data;
};

// ============ FINANCIAL REPORTS ============

/**
 * Get financial dashboard summary
 */
export const getFinancialDashboard = async () => {
  const response = await api.get('/central/reports/dashboard');
  return response.data;
};

/**
 * Get consolidated revenue report
 * @param {Object} params - Query parameters
 * @param {string} params.startDate - Start date
 * @param {string} params.endDate - End date
 * @param {string} params.clinicId - Filter by clinic
 */
export const getConsolidatedRevenue = async (params = {}) => {
  const response = await api.get('/central/reports/revenue', { params });
  return response.data;
};

/**
 * Get clinic comparison report
 * @param {Object} params - Query parameters
 * @param {string} params.period - Period (month, quarter, year)
 */
export const getClinicComparison = async (params = {}) => {
  const response = await api.get('/central/reports/clinic-comparison', { params });
  return response.data;
};

/**
 * Get revenue by category
 * @param {Object} params - Query parameters
 */
export const getRevenueByCategory = async (params = {}) => {
  const response = await api.get('/central/reports/revenue-by-category', { params });
  return response.data;
};

/**
 * Get payment method distribution
 * @param {Object} params - Query parameters
 */
export const getPaymentMethodDistribution = async (params = {}) => {
  const response = await api.get('/central/reports/payment-methods', { params });
  return response.data;
};

/**
 * Get outstanding payments
 */
export const getOutstanding = async () => {
  const response = await api.get('/central/reports/outstanding');
  return response.data;
};

// ============ CLINIC APIs ============

/**
 * Get all registered clinics
 */
export const getClinics = async () => {
  const response = await api.get('/central/clinics');
  return response.data;
};

/**
 * Get specific clinic details
 * @param {string} clinicId - Clinic ID
 */
export const getClinic = async (clinicId) => {
  const response = await api.get(`/central/clinics/${clinicId}`);
  return response.data;
};

// ============ SYNC STATUS ============

/**
 * Get sync status
 */
export const getSyncStatus = async () => {
  const response = await api.get('/central/sync/status');
  return response.data;
};

export default {
  // Connection
  checkConnection,
  getDashboard,

  // Patients
  searchPatients,
  checkPatientExists,
  getPatientHistory,
  getFullPatient,
  getPatientAllClinics,

  // Inventory
  getConsolidatedInventory,
  getInventorySummary,
  getInventoryAlerts,
  getTransferRecommendations,
  getInventoryCategories,
  getExpiringItems,
  getProductStock,

  // Financial
  getFinancialDashboard,
  getConsolidatedRevenue,
  getClinicComparison,
  getRevenueByCategory,
  getPaymentMethodDistribution,
  getOutstanding,

  // Clinics
  getClinics,
  getClinic,

  // Sync
  getSyncStatus
};
