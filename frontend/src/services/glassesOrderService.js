import api from './apiConfig';

const glassesOrderService = {
  // Get all orders with filters
  async getOrders(params = {}) {
    const response = await api.get('/glasses-orders', { params });
    return response.data;
  },

  // Get single order
  async getOrder(id) {
    const response = await api.get(`/glasses-orders/${id}`);
    return response.data;
  },

  // Create new order
  async createOrder(orderData) {
    const response = await api.post('/glasses-orders', orderData);
    return response.data;
  },

  // Update order
  async updateOrder(id, updateData) {
    const response = await api.put(`/glasses-orders/${id}`, updateData);
    return response.data;
  },

  // Update order status
  async updateStatus(id, status, notes) {
    const response = await api.put(`/glasses-orders/${id}/status`, { status, notes });
    return response.data;
  },

  // Delete/cancel order
  async deleteOrder(id) {
    const response = await api.delete(`/glasses-orders/${id}`);
    return response.data;
  },

  // Get orders for a patient
  async getPatientOrders(patientId) {
    const response = await api.get(`/glasses-orders/patient/${patientId}`);
    return response.data;
  },

  // Get orders for an exam
  async getExamOrders(examId) {
    const response = await api.get(`/glasses-orders/exam/${examId}`);
    return response.data;
  },

  // Get order statistics
  async getStats() {
    const response = await api.get('/glasses-orders/stats');
    return response.data;
  }
};

export default glassesOrderService;
