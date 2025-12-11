import api from './apiConfig';

const warrantyService = {
  // Get all warranties
  getAll: async (params = {}) => {
    const response = await api.get('/warranties', { params });
    return response.data;
  },

  // Get single warranty
  getById: async (id) => {
    const response = await api.get(`/warranties/${id}`);
    return response.data;
  },

  // Create warranty
  create: async (data) => {
    const response = await api.post('/warranties', data);
    return response.data;
  },

  // Update warranty
  update: async (id, data) => {
    const response = await api.put(`/warranties/${id}`, data);
    return response.data;
  },

  // File a claim
  fileClaim: async (id, claimData) => {
    const response = await api.post(`/warranties/${id}/claims`, claimData);
    return response.data;
  },

  // Approve claim
  approveClaim: async (warrantyId, claimId, approvalData) => {
    const response = await api.post(`/warranties/${warrantyId}/claims/${claimId}/approve`, approvalData);
    return response.data;
  },

  // Reject claim
  rejectClaim: async (warrantyId, claimId, reason) => {
    const response = await api.post(`/warranties/${warrantyId}/claims/${claimId}/reject`, { reason });
    return response.data;
  },

  // Transfer warranty
  transfer: async (id, newCustomerId, reason) => {
    const response = await api.post(`/warranties/${id}/transfer`, { newCustomerId, reason });
    return response.data;
  },

  // Get customer warranties
  getCustomerWarranties: async (customerId) => {
    const response = await api.get(`/warranties/customer/${customerId}`);
    return response.data;
  },

  // Get expiring warranties
  getExpiring: async (days = 30) => {
    const response = await api.get('/warranties/expiring', { params: { days } });
    return response.data;
  },

  // Get statistics
  getStats: async () => {
    const response = await api.get('/warranties/stats');
    return response.data;
  }
};

export default warrantyService;
