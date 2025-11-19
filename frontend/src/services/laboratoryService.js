import api from './apiConfig';

// Laboratory service for lab test ordering and results
const laboratoryService = {
  // Get all laboratory templates
  async getTemplates(params = {}) {
    try {
      const response = await api.get('/template-catalog/laboratories', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching lab templates:', error);
      throw error;
    }
  },

  // Get templates by category
  async getTemplatesByCategory(category) {
    try {
      const response = await api.get('/template-catalog/laboratories', {
        params: { category }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching lab templates by category:', error);
      throw error;
    }
  },

  // Search templates
  async searchTemplates(query) {
    try {
      const response = await api.get('/template-catalog/laboratories', {
        params: { search: query }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching lab templates:', error);
      throw error;
    }
  },

  // Create lab order for patient
  async createOrder(orderData) {
    try {
      const response = await api.post('/visits/lab-orders', orderData);
      return response.data;
    } catch (error) {
      console.error('Error creating lab order:', error);
      throw error;
    }
  },

  // Get patient lab orders
  async getPatientOrders(patientId, params = {}) {
    try {
      const response = await api.get(`/patients/${patientId}/lab-orders`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching patient lab orders:', error);
      throw error;
    }
  },

  // Get lab order details
  async getOrder(orderId) {
    try {
      const response = await api.get(`/visits/lab-orders/${orderId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching lab order:', error);
      throw error;
    }
  },

  // Update lab order status
  async updateOrderStatus(orderId, status, notes = '') {
    try {
      const response = await api.put(`/visits/lab-orders/${orderId}/status`, {
        status,
        notes
      });
      return response.data;
    } catch (error) {
      console.error('Error updating lab order status:', error);
      throw error;
    }
  },

  // Add results to lab order
  async addResults(orderId, results) {
    try {
      const response = await api.post(`/visits/lab-orders/${orderId}/results`, { results });
      return response.data;
    } catch (error) {
      console.error('Error adding lab results:', error);
      throw error;
    }
  },

  // Get pending lab orders
  async getPending() {
    try {
      const response = await api.get('/visits/lab-orders', {
        params: { status: 'pending' }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching pending lab orders:', error);
      throw error;
    }
  },

  // Get completed lab orders
  async getCompleted(params = {}) {
    try {
      const response = await api.get('/visits/lab-orders', {
        params: { status: 'completed', ...params }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching completed lab orders:', error);
      throw error;
    }
  },

  // Cancel lab order
  async cancelOrder(orderId, reason) {
    try {
      const response = await api.put(`/visits/lab-orders/${orderId}/cancel`, { reason });
      return response.data;
    } catch (error) {
      console.error('Error cancelling lab order:', error);
      throw error;
    }
  },

  // Get lab categories
  async getCategories() {
    try {
      const response = await api.get('/template-catalog/laboratories/categories');
      return response.data;
    } catch (error) {
      console.error('Error fetching lab categories:', error);
      throw error;
    }
  },

  // Get common lab panels (quick order)
  async getCommonPanels() {
    try {
      const response = await api.get('/template-catalog/laboratories', {
        params: { isPanel: true }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching lab panels:', error);
      throw error;
    }
  },

  // Print lab order
  async printOrder(orderId) {
    try {
      const response = await api.get(`/visits/lab-orders/${orderId}/print`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error printing lab order:', error);
      throw error;
    }
  }
};

export default laboratoryService;
