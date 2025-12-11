/**
 * Central Data Controller
 * Proxies requests to the central server for cross-clinic data access
 */

const centralClient = require('../services/centralServerClient');

/**
 * Check if central server is available
 */
exports.checkConnection = async (req, res) => {
  try {
    const isAvailable = await centralClient.isAvailable();
    res.json({
      success: true,
      available: isAvailable,
      config: {
        baseUrl: centralClient.config.baseUrl,
        clinicId: centralClient.config.clinicId
      }
    });
  } catch (error) {
    res.json({
      success: false,
      available: false,
      error: error.message
    });
  }
};

/**
 * Get central dashboard
 */
exports.getDashboard = async (req, res) => {
  try {
    const result = await centralClient.getDashboard();
    res.json(result);
  } catch (error) {
    console.error('Central dashboard error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch dashboard from central server'
    });
  }
};

// ============ PATIENT APIs ============

/**
 * Search patients across all clinics
 */
exports.searchPatients = async (req, res) => {
  try {
    const result = await centralClient.searchPatients(req.query);
    res.json(result);
  } catch (error) {
    console.error('Central patient search error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to search patients across clinics'
    });
  }
};

/**
 * Get patient history across all clinics
 */
exports.getPatientHistory = async (req, res) => {
  try {
    const result = await centralClient.getPatientHistory(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Central patient history error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch patient history'
    });
  }
};

/**
 * Get full patient details
 */
exports.getFullPatient = async (req, res) => {
  try {
    const result = await centralClient.getFullPatient(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Central full patient error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch full patient details'
    });
  }
};

/**
 * Get patient records from all clinics
 */
exports.getPatientAllClinics = async (req, res) => {
  try {
    const result = await centralClient.getPatientAllClinics(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Central patient all clinics error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch patient records from all clinics'
    });
  }
};

/**
 * Check if patient exists in other clinics
 */
exports.checkPatientExists = async (req, res) => {
  try {
    const result = await centralClient.checkPatientExists(req.query);
    res.json(result);
  } catch (error) {
    console.error('Central patient exists check error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to check patient existence'
    });
  }
};

// ============ INVENTORY APIs ============

/**
 * Get consolidated inventory
 */
exports.getConsolidatedInventory = async (req, res) => {
  try {
    const result = await centralClient.getConsolidatedInventory(req.query);
    res.json(result);
  } catch (error) {
    console.error('Central inventory error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch consolidated inventory'
    });
  }
};

/**
 * Get inventory summary by clinic
 */
exports.getInventorySummary = async (req, res) => {
  try {
    const result = await centralClient.getInventorySummary();
    res.json(result);
  } catch (error) {
    console.error('Central inventory summary error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch inventory summary'
    });
  }
};

/**
 * Get stock alerts across all clinics
 */
exports.getInventoryAlerts = async (req, res) => {
  try {
    const result = await centralClient.getInventoryAlerts();
    res.json(result);
  } catch (error) {
    console.error('Central inventory alerts error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch inventory alerts'
    });
  }
};

/**
 * Get transfer recommendations
 */
exports.getTransferRecommendations = async (req, res) => {
  try {
    const result = await centralClient.getTransferRecommendations();
    res.json(result);
  } catch (error) {
    console.error('Central transfer recommendations error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch transfer recommendations'
    });
  }
};

/**
 * Get inventory categories
 */
exports.getInventoryCategories = async (req, res) => {
  try {
    const result = await centralClient.getInventoryCategories();
    res.json(result);
  } catch (error) {
    console.error('Central inventory categories error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch inventory categories'
    });
  }
};

/**
 * Get expiring items
 */
exports.getExpiringItems = async (req, res) => {
  try {
    const result = await centralClient.getExpiringItems();
    res.json(result);
  } catch (error) {
    console.error('Central expiring items error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch expiring items'
    });
  }
};

/**
 * Get product stock across clinics
 */
exports.getProductStock = async (req, res) => {
  try {
    const result = await centralClient.getProductStock(req.params.sku);
    res.json(result);
  } catch (error) {
    console.error('Central product stock error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch product stock'
    });
  }
};

// ============ FINANCIAL REPORTS ============

/**
 * Get financial dashboard
 */
exports.getFinancialDashboard = async (req, res) => {
  try {
    const result = await centralClient.getFinancialDashboard();
    res.json(result);
  } catch (error) {
    console.error('Central financial dashboard error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch financial dashboard'
    });
  }
};

/**
 * Get consolidated revenue
 */
exports.getConsolidatedRevenue = async (req, res) => {
  try {
    const result = await centralClient.getConsolidatedRevenue(req.query);
    res.json(result);
  } catch (error) {
    console.error('Central revenue error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch consolidated revenue'
    });
  }
};

/**
 * Get clinic comparison
 */
exports.getClinicComparison = async (req, res) => {
  try {
    const result = await centralClient.getClinicComparison(req.query);
    res.json(result);
  } catch (error) {
    console.error('Central clinic comparison error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch clinic comparison'
    });
  }
};

/**
 * Get revenue by category
 */
exports.getRevenueByCategory = async (req, res) => {
  try {
    const result = await centralClient.getRevenueByCategory(req.query);
    res.json(result);
  } catch (error) {
    console.error('Central revenue by category error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch revenue by category'
    });
  }
};

/**
 * Get payment method distribution
 */
exports.getPaymentMethodDistribution = async (req, res) => {
  try {
    const result = await centralClient.getPaymentMethodDistribution(req.query);
    res.json(result);
  } catch (error) {
    console.error('Central payment methods error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch payment method distribution'
    });
  }
};

/**
 * Get outstanding payments
 */
exports.getOutstanding = async (req, res) => {
  try {
    const result = await centralClient.getOutstanding();
    res.json(result);
  } catch (error) {
    console.error('Central outstanding error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch outstanding payments'
    });
  }
};

// ============ CLINIC APIs ============

/**
 * Get all clinics
 */
exports.getClinics = async (req, res) => {
  try {
    const result = await centralClient.getClinics();
    res.json(result);
  } catch (error) {
    console.error('Central clinics error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch clinics'
    });
  }
};

/**
 * Get specific clinic
 */
exports.getClinic = async (req, res) => {
  try {
    const result = await centralClient.getClinic(req.params.clinicId);
    res.json(result);
  } catch (error) {
    console.error('Central clinic error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch clinic'
    });
  }
};

// ============ SYNC STATUS ============

/**
 * Get sync status
 */
exports.getSyncStatus = async (req, res) => {
  try {
    const result = await centralClient.getSyncStatus();
    res.json(result);
  } catch (error) {
    console.error('Central sync status error:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch sync status'
    });
  }
};
