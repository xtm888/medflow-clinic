import api from './apiConfig';

const opticalShopService = {
  // ============================================================
  // DASHBOARD & PATIENT LOOKUP
  // ============================================================

  /**
   * Get dashboard stats for optical shop
   */
  getDashboardStats: async () => {
    const response = await api.get('/optical-shop/dashboard');
    return response.data;
  },

  /**
   * Search patients
   */
  searchPatients: async (query) => {
    const response = await api.get('/optical-shop/patients/search', { params: { query } });
    return response.data;
  },

  /**
   * Get patient's prescription/refraction
   */
  getPatientPrescription: async (patientId) => {
    const response = await api.get(`/optical-shop/patients/${patientId}/prescription`);
    return response.data;
  },

  /**
   * Get patient's convention info for optical services
   */
  getPatientConventionInfo: async (patientId) => {
    const response = await api.get(`/optical-shop/patients/${patientId}/convention`);
    return response.data;
  },

  // ============================================================
  // SALES WORKFLOW
  // ============================================================

  /**
   * Start a new sale
   */
  startSale: async (data) => {
    const response = await api.post('/optical-shop/sales', data);
    return response.data;
  },

  /**
   * Update sale order
   */
  updateSale: async (id, data) => {
    const response = await api.put(`/optical-shop/sales/${id}`, data);
    return response.data;
  },

  /**
   * Check availability of items
   */
  checkAvailability: async (id) => {
    const response = await api.post(`/optical-shop/sales/${id}/check-availability`);
    return response.data;
  },

  /**
   * Submit for verification
   */
  submitForVerification: async (id) => {
    const response = await api.post(`/optical-shop/sales/${id}/submit`);
    return response.data;
  },

  // ============================================================
  // TECHNICIAN VERIFICATION
  // ============================================================

  /**
   * Get verification queue
   */
  getVerificationQueue: async (params = {}) => {
    const response = await api.get('/optical-shop/verification/queue', { params });
    return response.data;
  },

  /**
   * Get order for verification
   */
  getOrderForVerification: async (id) => {
    const response = await api.get(`/optical-shop/verification/${id}`);
    return response.data;
  },

  /**
   * Approve verification
   */
  approveVerification: async (id, data) => {
    const response = await api.post(`/optical-shop/verification/${id}/approve`, data);
    return response.data;
  },

  /**
   * Reject verification
   */
  rejectVerification: async (id, data) => {
    const response = await api.post(`/optical-shop/verification/${id}/reject`, data);
    return response.data;
  },

  // ============================================================
  // EXTERNAL ORDERS
  // ============================================================

  /**
   * Get external order queue
   */
  getExternalOrderQueue: async (status = 'pending') => {
    const response = await api.get('/optical-shop/external-orders', { params: { status } });
    return response.data;
  },

  /**
   * Update external order
   */
  updateExternalOrder: async (id, data) => {
    const response = await api.put(`/optical-shop/external-orders/${id}`, data);
    return response.data;
  },

  /**
   * Mark items as received
   */
  receiveExternalOrder: async (id, data) => {
    const response = await api.post(`/optical-shop/external-orders/${id}/receive`, data);
    return response.data;
  },

  // ============================================================
  // PERFORMANCE METRICS
  // ============================================================

  /**
   * Get optician performance
   */
  getOpticianPerformance: async (params = {}) => {
    const response = await api.get('/optical-shop/performance', { params });
    return response.data;
  },

  /**
   * Get leaderboard
   */
  getLeaderboard: async () => {
    const response = await api.get('/optical-shop/leaderboard');
    return response.data;
  },

  // ============================================================
  // BILLING & INVOICING
  // ============================================================

  /**
   * Get unbilled orders
   */
  getUnbilledOrders: async (params = {}) => {
    const response = await api.get('/optical-shop/billing/unbilled', { params });
    return response.data;
  },

  /**
   * Generate invoice for order
   */
  generateInvoice: async (orderId) => {
    const response = await api.post(`/optical-shop/orders/${orderId}/invoice`);
    return response.data;
  }
};

export default opticalShopService;
