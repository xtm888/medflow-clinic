import api from './apiConfig';

const inventoryTransferService = {
  // ============================================
  // CRUD OPERATIONS
  // ============================================

  // Get all transfers with filters and pagination
  async getTransfers(params = {}) {
    const response = await api.get('/inventory-transfers', { params });
    return response.data;
  },

  // Get single transfer by ID
  async getTransfer(id) {
    const response = await api.get(`/inventory-transfers/${id}`);
    return response.data;
  },

  // Create new transfer request
  async createTransfer(transferData) {
    const response = await api.post('/inventory-transfers', transferData);
    return response.data;
  },

  // ============================================
  // WORKFLOW ACTIONS
  // ============================================

  // Submit transfer for approval
  async submitTransfer(id) {
    const response = await api.post(`/inventory-transfers/${id}/submit`);
    return response.data;
  },

  // Approve transfer
  async approveTransfer(id, approvalData = {}) {
    const response = await api.post(`/inventory-transfers/${id}/approve`, approvalData);
    return response.data;
  },

  // Reject transfer
  async rejectTransfer(id, reason) {
    const response = await api.post(`/inventory-transfers/${id}/reject`, { reason });
    return response.data;
  },

  // Mark transfer as shipped
  async shipTransfer(id, shipmentData = {}) {
    const response = await api.post(`/inventory-transfers/${id}/ship`, shipmentData);
    return response.data;
  },

  // Mark transfer as received
  async receiveTransfer(id, receiveData = {}) {
    const response = await api.post(`/inventory-transfers/${id}/receive`, receiveData);
    return response.data;
  },

  // Cancel transfer
  async cancelTransfer(id, reason) {
    const response = await api.post(`/inventory-transfers/${id}/cancel`, { reason });
    return response.data;
  },

  // ============================================
  // STATISTICS & REPORTS
  // ============================================

  // Get transfer statistics
  async getStats() {
    const response = await api.get('/inventory-transfers/stats');
    return response.data;
  },

  // Get smart transfer recommendations
  async getRecommendations(params = {}) {
    const response = await api.get('/inventory-transfers/recommendations', { params });
    return response.data;
  }
};

export default inventoryTransferService;
