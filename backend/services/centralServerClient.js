/**
 * Central Server Client
 * Service for calling the central server APIs to access cross-clinic data
 *
 * All functions include:
 * - Proper error handling with try-catch
 * - Structured logging
 * - Timeout configuration
 * - Graceful error messages
 */

const axios = require('axios');
const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('CentralServerClient');

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
 * Handle central server errors consistently
 */
function handleCentralServerError(error, operation) {
  const errorInfo = {
    operation,
    message: error.message,
    code: error.code,
    status: error.response?.status,
    statusText: error.response?.statusText
  };

  log.error(`Central server ${operation} failed:`, errorInfo);

  // Check for specific error types
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    throw new Error('Serveur central indisponible');
  }

  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
    throw new Error('Délai d\'attente dépassé pour le serveur central');
  }

  if (error.response?.status === 401) {
    throw new Error('Non autorisé à accéder au serveur central');
  }

  if (error.response?.status === 403) {
    throw new Error('Accès refusé au serveur central');
  }

  if (error.response?.status === 404) {
    throw new Error('Ressource non trouvée sur le serveur central');
  }

  if (error.response?.status >= 500) {
    throw new Error('Erreur interne du serveur central');
  }

  throw new Error(`Erreur serveur central: ${error.message}`);
}

/**
 * Check if central server is available
 */
async function isAvailable() {
  try {
    const client = createClient();
    const response = await client.get('/health', { timeout: 5000 });
    return response.data?.status === 'ok';
  } catch (error) {
    log.warn('Central server health check failed:', { error: error.message });
    return false;
  }
}

/**
 * Get dashboard summary from central server
 */
async function getDashboard() {
  try {
    const client = createClient();
    const response = await client.get('/api/dashboard');
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getDashboard');
  }
}

// ============ PATIENT APIs ============

/**
 * Search patients across all clinics
 */
async function searchPatients(params) {
  try {
    const client = createClient();
    const response = await client.get('/api/patients/search', { params });
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'searchPatients');
  }
}

/**
 * Get patient history across all clinics
 */
async function getPatientHistory(patientId) {
  try {
    const client = createClient();
    const response = await client.get(`/api/patients/${patientId}/history`);
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getPatientHistory');
  }
}

/**
 * Get full patient details from source clinic
 */
async function getFullPatient(patientId) {
  try {
    const client = createClient();
    const response = await client.get(`/api/patients/${patientId}/full`);
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getFullPatient');
  }
}

/**
 * Get patient records from all clinics
 */
async function getPatientAllClinics(patientId) {
  try {
    const client = createClient();
    const response = await client.get(`/api/patients/${patientId}/all-clinics`);
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getPatientAllClinics');
  }
}

/**
 * Check if patient exists in other clinics
 */
async function checkPatientExists(params) {
  try {
    const client = createClient();
    const response = await client.get('/api/patients/check-exists', { params });
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'checkPatientExists');
  }
}

// ============ INVENTORY APIs ============

/**
 * Get consolidated inventory across all clinics
 */
async function getConsolidatedInventory(params = {}) {
  try {
    const client = createClient();
    const response = await client.get('/api/inventory', { params });
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getConsolidatedInventory');
  }
}

/**
 * Get inventory summary by clinic
 */
async function getInventorySummary() {
  try {
    const client = createClient();
    const response = await client.get('/api/inventory/summary');
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getInventorySummary');
  }
}

/**
 * Get stock alerts across all clinics
 */
async function getInventoryAlerts() {
  try {
    const client = createClient();
    const response = await client.get('/api/inventory/alerts');
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getInventoryAlerts');
  }
}

/**
 * Get transfer recommendations
 */
async function getTransferRecommendations() {
  try {
    const client = createClient();
    const response = await client.get('/api/inventory/recommendations');
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getTransferRecommendations');
  }
}

/**
 * Get inventory categories
 */
async function getInventoryCategories() {
  try {
    const client = createClient();
    const response = await client.get('/api/inventory/categories');
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getInventoryCategories');
  }
}

/**
 * Get expiring items across all clinics
 */
async function getExpiringItems() {
  try {
    const client = createClient();
    const response = await client.get('/api/inventory/expiring');
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getExpiringItems');
  }
}

/**
 * Get specific product stock across clinics
 */
async function getProductStock(sku) {
  try {
    const client = createClient();
    const response = await client.get(`/api/inventory/product/${sku}`);
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getProductStock');
  }
}

// ============ FINANCIAL REPORTS ============

/**
 * Get dashboard summary
 */
async function getFinancialDashboard() {
  try {
    const client = createClient();
    const response = await client.get('/api/reports/dashboard');
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getFinancialDashboard');
  }
}

/**
 * Get consolidated revenue report
 */
async function getConsolidatedRevenue(params = {}) {
  try {
    const client = createClient();
    const response = await client.get('/api/reports/revenue', { params });
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getConsolidatedRevenue');
  }
}

/**
 * Get clinic comparison report
 */
async function getClinicComparison(params = {}) {
  try {
    const client = createClient();
    const response = await client.get('/api/reports/clinic-comparison', { params });
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getClinicComparison');
  }
}

/**
 * Get revenue by category
 */
async function getRevenueByCategory(params = {}) {
  try {
    const client = createClient();
    const response = await client.get('/api/reports/revenue-by-category', { params });
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getRevenueByCategory');
  }
}

/**
 * Get payment method distribution
 */
async function getPaymentMethodDistribution(params = {}) {
  try {
    const client = createClient();
    const response = await client.get('/api/reports/payment-methods', { params });
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getPaymentMethodDistribution');
  }
}

/**
 * Get outstanding payments
 */
async function getOutstanding() {
  try {
    const client = createClient();
    const response = await client.get('/api/reports/outstanding');
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getOutstanding');
  }
}

// ============ CLINIC APIs ============

/**
 * Get all clinics
 */
async function getClinics() {
  try {
    const client = createClient();
    const response = await client.get('/api/clinics');
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getClinics');
  }
}

/**
 * Get specific clinic details
 */
async function getClinic(clinicId) {
  try {
    const client = createClient();
    const response = await client.get(`/api/clinics/${clinicId}`);
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getClinic');
  }
}

// ============ SYNC STATUS ============

/**
 * Get sync status
 */
async function getSyncStatus() {
  try {
    const client = createClient();
    const response = await client.get('/api/sync/status');
    return response.data;
  } catch (error) {
    handleCentralServerError(error, 'getSyncStatus');
  }
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
