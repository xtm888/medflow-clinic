import api from './apiConfig';

const referrerService = {
  // Get all referrers
  async getReferrers(params = {}) {
    const response = await api.get('/referrers', { params });
    return response.data;
  },

  // Get single referrer
  async getReferrer(id) {
    const response = await api.get(`/referrers/${id}`);
    return response.data;
  },

  // Create new referrer
  async createReferrer(data) {
    const response = await api.post('/referrers', data);
    return response.data;
  },

  // Update referrer
  async updateReferrer(id, data) {
    const response = await api.put(`/referrers/${id}`, data);
    return response.data;
  },

  // Delete referrer (soft delete)
  async deleteReferrer(id) {
    const response = await api.delete(`/referrers/${id}`);
    return response.data;
  },

  // Get commissions for a specific referrer
  async getReferrerCommissions(id, params = {}) {
    const response = await api.get(`/referrers/${id}/commissions`, { params });
    return response.data;
  },

  // Get overall commissions report
  async getCommissionsReport(params = {}) {
    const response = await api.get('/referrers/commissions/report', { params });
    return response.data;
  },

  // Mark commission as paid
  async markCommissionPaid(invoiceId, data) {
    const response = await api.put(`/referrers/commissions/${invoiceId}/pay`, data);
    return response.data;
  },

  // Calculate commission for an invoice
  async calculateCommission(data) {
    const response = await api.post('/referrers/calculate-commission', data);
    return response.data;
  }
};

export default referrerService;
