import api from './apiConfig';

const crossClinicInventoryService = {
  // ============================================
  // DASHBOARD & SUMMARY
  // ============================================

  // Get summary across all clinics
  async getSummary() {
    const response = await api.get('/cross-clinic-inventory/summary');
    return response.data;
  },

  // ============================================
  // INVENTORY VIEWS
  // ============================================

  // Get consolidated inventory view across all clinics
  async getConsolidatedInventory(params = {}) {
    const response = await api.get('/cross-clinic-inventory', { params });
    return response.data;
  },

  // ============================================
  // ALERTS
  // ============================================

  // Get stock alerts (out-of-stock, low-stock with available sources)
  async getAlerts(params = {}) {
    const response = await api.get('/cross-clinic-inventory/alerts', { params });
    return response.data;
  },

  // ============================================
  // QUICK ACTIONS
  // ============================================

  // Create quick transfer from alert/recommendation
  async createQuickTransfer(transferData) {
    const response = await api.post('/cross-clinic-inventory/quick-transfer', transferData);
    return response.data;
  }
};

export default crossClinicInventoryService;
