import api from './apiConfig';

const repairService = {
  // Get all repairs
  getAll: async (params = {}) => {
    const response = await api.get('/repairs', { params });
    return response.data;
  },

  // Get single repair
  getById: async (id) => {
    const response = await api.get(`/repairs/${id}`);
    return response.data;
  },

  // Create repair order
  create: async (data) => {
    const response = await api.post('/repairs', data);
    return response.data;
  },

  // Update repair
  update: async (id, data) => {
    const response = await api.put(`/repairs/${id}`, data);
    return response.data;
  },

  // Update status
  updateStatus: async (id, status, notes) => {
    const response = await api.post(`/repairs/${id}/status`, { status, notes });
    return response.data;
  },

  // Add part
  addPart: async (id, partData) => {
    const response = await api.post(`/repairs/${id}/parts`, partData);
    return response.data;
  },

  // Add labor
  addLabor: async (id, laborData) => {
    const response = await api.post(`/repairs/${id}/labor`, laborData);
    return response.data;
  },

  // Record customer approval
  recordCustomerApproval: async (id, approved, signature, notes) => {
    const response = await api.post(`/repairs/${id}/customer-approval`, { approved, signature, notes });
    return response.data;
  },

  // Perform quality check
  performQualityCheck: async (id, passed, notes, failureReasons) => {
    const response = await api.post(`/repairs/${id}/quality-check`, { passed, notes, failureReasons });
    return response.data;
  },

  // Complete pickup
  completePickup: async (id, pickupData) => {
    const response = await api.post(`/repairs/${id}/pickup`, pickupData);
    return response.data;
  },

  // Cancel repair
  cancel: async (id, reason) => {
    const response = await api.post(`/repairs/${id}/cancel`, { reason });
    return response.data;
  },

  // Get customer repairs
  getCustomerRepairs: async (customerId) => {
    const response = await api.get(`/repairs/customer/${customerId}`);
    return response.data;
  },

  // Get repairs ready for pickup
  getReadyForPickup: async () => {
    const response = await api.get('/repairs/ready-for-pickup');
    return response.data;
  },

  // Get statistics
  getStats: async () => {
    const response = await api.get('/repairs/stats');
    return response.data;
  }
};

export default repairService;
