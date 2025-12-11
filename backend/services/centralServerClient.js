/**
 * Central Server Client
 * Service for calling the central server APIs to access cross-clinic data
 */

const axios = require('axios');

const config = {
  baseUrl: process.env.CENTRAL_SERVER_URL || 'http://localhost:5002',
  clinicId: process.env.CLINIC_ID || 'clinic-main',
  syncToken: process.env.SYNC_TOKEN || '',
  timeout: 30000
};

/**
 * Create axios instance with auth headers
 */
const createClient = () => {
  return axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeout,
    headers: {
      'Content-Type': 'application/json',
      'X-Clinic-ID': config.clinicId,
      'X-Sync-Token': config.syncToken
    }
  });
};

/**
 * Check if central server is available
 */
async function isAvailable() {
  try {
    const client = createClient();
    const response = await client.get('/health', { timeout: 5000 });
    return response.data?.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Get dashboard summary from central server
 */
async function getDashboard() {
  const client = createClient();
  const response = await client.get('/api/dashboard');
  return response.data;
}

// ============ PATIENT APIs ============

/**
 * Search patients across all clinics
 */
async function searchPatients(params) {
  const client = createClient();
  const response = await client.get('/api/patients/search', { params });
  return response.data;
}

/**
 * Get patient history across all clinics
 */
async function getPatientHistory(patientId) {
  const client = createClient();
  const response = await client.get(`/api/patients/${patientId}/history`);
  return response.data;
}

/**
 * Get full patient details from source clinic
 */
async function getFullPatient(patientId) {
  const client = createClient();
  const response = await client.get(`/api/patients/${patientId}/full`);
  return response.data;
}

/**
 * Get patient records from all clinics
 */
async function getPatientAllClinics(patientId) {
  const client = createClient();
  const response = await client.get(`/api/patients/${patientId}/all-clinics`);
  return response.data;
}

/**
 * Check if patient exists in other clinics
 */
async function checkPatientExists(params) {
  const client = createClient();
  const response = await client.get('/api/patients/check-exists', { params });
  return response.data;
}

// ============ INVENTORY APIs ============

/**
 * Get consolidated inventory across all clinics
 */
async function getConsolidatedInventory(params = {}) {
  const client = createClient();
  const response = await client.get('/api/inventory', { params });
  return response.data;
}

/**
 * Get inventory summary by clinic
 */
async function getInventorySummary() {
  const client = createClient();
  const response = await client.get('/api/inventory/summary');
  return response.data;
}

/**
 * Get stock alerts across all clinics
 */
async function getInventoryAlerts() {
  const client = createClient();
  const response = await client.get('/api/inventory/alerts');
  return response.data;
}

/**
 * Get transfer recommendations
 */
async function getTransferRecommendations() {
  const client = createClient();
  const response = await client.get('/api/inventory/recommendations');
  return response.data;
}

/**
 * Get inventory categories
 */
async function getInventoryCategories() {
  const client = createClient();
  const response = await client.get('/api/inventory/categories');
  return response.data;
}

/**
 * Get expiring items across all clinics
 */
async function getExpiringItems() {
  const client = createClient();
  const response = await client.get('/api/inventory/expiring');
  return response.data;
}

/**
 * Get specific product stock across clinics
 */
async function getProductStock(sku) {
  const client = createClient();
  const response = await client.get(`/api/inventory/product/${sku}`);
  return response.data;
}

// ============ FINANCIAL REPORTS ============

/**
 * Get dashboard summary
 */
async function getFinancialDashboard() {
  const client = createClient();
  const response = await client.get('/api/reports/dashboard');
  return response.data;
}

/**
 * Get consolidated revenue report
 */
async function getConsolidatedRevenue(params = {}) {
  const client = createClient();
  const response = await client.get('/api/reports/revenue', { params });
  return response.data;
}

/**
 * Get clinic comparison report
 */
async function getClinicComparison(params = {}) {
  const client = createClient();
  const response = await client.get('/api/reports/clinic-comparison', { params });
  return response.data;
}

/**
 * Get revenue by category
 */
async function getRevenueByCategory(params = {}) {
  const client = createClient();
  const response = await client.get('/api/reports/revenue-by-category', { params });
  return response.data;
}

/**
 * Get payment method distribution
 */
async function getPaymentMethodDistribution(params = {}) {
  const client = createClient();
  const response = await client.get('/api/reports/payment-methods', { params });
  return response.data;
}

/**
 * Get outstanding payments
 */
async function getOutstanding() {
  const client = createClient();
  const response = await client.get('/api/reports/outstanding');
  return response.data;
}

// ============ CLINIC APIs ============

/**
 * Get all clinics
 */
async function getClinics() {
  const client = createClient();
  const response = await client.get('/api/clinics');
  return response.data;
}

/**
 * Get specific clinic details
 */
async function getClinic(clinicId) {
  const client = createClient();
  const response = await client.get(`/api/clinics/${clinicId}`);
  return response.data;
}

// ============ SYNC STATUS ============

/**
 * Get sync status
 */
async function getSyncStatus() {
  const client = createClient();
  const response = await client.get('/api/sync/status');
  return response.data;
}

module.exports = {
  // Connection
  isAvailable,
  getDashboard,
  config,

  // Patients
  searchPatients,
  getPatientHistory,
  getFullPatient,
  getPatientAllClinics,
  checkPatientExists,

  // Inventory
  getConsolidatedInventory,
  getInventorySummary,
  getInventoryAlerts,
  getTransferRecommendations,
  getInventoryCategories,
  getExpiringItems,
  getProductStock,

  // Financial Reports
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
