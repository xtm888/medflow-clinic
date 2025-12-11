import api from './apiConfig';

const purchaseOrderService = {
  // Get all purchase orders with filtering
  getAll: async (params = {}) => {
    const response = await api.get('/purchase-orders', { params });
    return response.data;
  },

  // Get single purchase order
  getById: async (id) => {
    const response = await api.get(`/purchase-orders/${id}`);
    return response.data;
  },

  // Create new purchase order
  create: async (data) => {
    const response = await api.post('/purchase-orders', data);
    return response.data;
  },

  // Update purchase order
  update: async (id, data) => {
    const response = await api.put(`/purchase-orders/${id}`, data);
    return response.data;
  },

  // Submit for approval
  submitForApproval: async (id) => {
    const response = await api.post(`/purchase-orders/${id}/submit`);
    return response.data;
  },

  // Approve purchase order
  approve: async (id, notes) => {
    const response = await api.post(`/purchase-orders/${id}/approve`, { notes });
    return response.data;
  },

  // Reject purchase order
  reject: async (id, reason) => {
    const response = await api.post(`/purchase-orders/${id}/reject`, { reason });
    return response.data;
  },

  // Mark as sent
  markAsSent: async (id) => {
    const response = await api.post(`/purchase-orders/${id}/send`);
    return response.data;
  },

  // Receive items
  receiveItems: async (id, receivedItems) => {
    const response = await api.post(`/purchase-orders/${id}/receive`, { receivedItems });
    return response.data;
  },

  // Close purchase order
  close: async (id) => {
    const response = await api.post(`/purchase-orders/${id}/close`);
    return response.data;
  },

  // Cancel purchase order
  cancel: async (id, reason) => {
    const response = await api.post(`/purchase-orders/${id}/cancel`, { reason });
    return response.data;
  },

  // Get pending approvals
  getPendingApprovals: async () => {
    const response = await api.get('/purchase-orders/pending-approvals');
    return response.data;
  },

  // Get statistics
  getStats: async () => {
    const response = await api.get('/purchase-orders/stats');
    return response.data;
  }
};

export default purchaseOrderService;
