import api from './apiConfig';

// Laboratory service for lab test ordering and results
const laboratoryService = {
  // Get all laboratory tests
  async getAllTests(params = {}) {
    try {
      const response = await api.get('/laboratory/tests', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching lab tests:', error);
      throw error;
    }
  },

  // Order new laboratory tests
  async orderTests(testData) {
    try {
      const response = await api.post('/laboratory/tests', testData);
      return response.data;
    } catch (error) {
      console.error('Error ordering lab tests:', error);
      throw error;
    }
  },

  // Update test results
  async updateTestResults(visitId, testId, resultData) {
    try {
      const response = await api.put(`/laboratory/tests/${visitId}/${testId}`, resultData);
      return response.data;
    } catch (error) {
      console.error('Error updating test results:', error);
      throw error;
    }
  },

  // Get pending laboratory tests
  async getPendingTests() {
    try {
      const response = await api.get('/laboratory/pending');
      return response.data;
    } catch (error) {
      console.error('Error fetching pending tests:', error);
      throw error;
    }
  },

  // Get laboratory templates
  async getTemplates(params = {}) {
    try {
      const response = await api.get('/laboratory/templates', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching lab templates:', error);
      throw error;
    }
  },

  // Create new laboratory template
  async createTemplate(templateData) {
    try {
      const response = await api.post('/laboratory/templates', templateData);
      return response.data;
    } catch (error) {
      console.error('Error creating lab template:', error);
      throw error;
    }
  },

  // Get laboratory statistics
  async getStatistics() {
    try {
      const response = await api.get('/laboratory/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching lab statistics:', error);
      throw error;
    }
  },

  // Generate laboratory report
  async generateReport(visitId) {
    try {
      const response = await api.get(`/laboratory/report/${visitId}`);
      return response.data;
    } catch (error) {
      console.error('Error generating lab report:', error);
      throw error;
    }
  },

  // Get templates by category
  async getTemplatesByCategory(category) {
    try {
      const response = await api.get('/laboratory/templates', {
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
      const response = await api.get('/laboratory/templates', {
        params: { search: query }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching lab templates:', error);
      throw error;
    }
  },

  // Create lab order for patient (wrapper for orderTests)
  async createOrder(orderData) {
    try {
      const response = await api.post('/laboratory/tests', orderData);
      return response.data;
    } catch (error) {
      console.error('Error creating lab order:', error);
      throw error;
    }
  },

  // Get patient lab orders
  async getPatientOrders(patientId, params = {}) {
    try {
      const response = await api.get('/laboratory/tests', {
        params: { patientId, ...params }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching patient lab orders:', error);
      throw error;
    }
  },

  // Get lab order details (using generate report)
  async getOrder(visitId) {
    try {
      const response = await api.get(`/laboratory/report/${visitId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching lab order:', error);
      throw error;
    }
  },

  // Update lab order status
  async updateOrderStatus(visitId, testId, status, notes = '') {
    try {
      const response = await api.put(`/laboratory/tests/${visitId}/${testId}`, {
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
  async addResults(visitId, testId, results) {
    try {
      const response = await api.put(`/laboratory/tests/${visitId}/${testId}`, {
        results,
        status: 'completed'
      });
      return response.data;
    } catch (error) {
      console.error('Error adding lab results:', error);
      throw error;
    }
  },

  // Get pending lab orders (alias)
  async getPending() {
    return this.getPendingTests();
  },

  // Get completed lab orders
  async getCompleted(params = {}) {
    try {
      const response = await api.get('/laboratory/tests', {
        params: { status: 'completed', ...params }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching completed lab orders:', error);
      throw error;
    }
  },

  // Cancel lab order
  async cancelOrder(visitId, testId, reason) {
    try {
      const response = await api.put(`/laboratory/tests/${visitId}/${testId}`, {
        status: 'cancelled',
        notes: reason
      });
      return response.data;
    } catch (error) {
      console.error('Error cancelling lab order:', error);
      throw error;
    }
  },

  // Get lab categories
  async getCategories() {
    try {
      const templates = await this.getTemplates();
      const categories = [...new Set(templates.data?.map(t => t.category) || [])];
      return {
        success: true,
        data: categories
      };
    } catch (error) {
      console.error('Error fetching lab categories:', error);
      throw error;
    }
  },

  // Get common lab panels (quick order)
  async getCommonPanels() {
    try {
      const response = await api.get('/laboratory/templates', {
        params: { isPanel: true }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching lab panels:', error);
      throw error;
    }
  },

  // Print lab order
  async printOrder(visitId) {
    try {
      const response = await api.get(`/laboratory/report/${visitId}`, {
        responseType: 'blob'
      });

      // Create a blob URL and trigger download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lab-report-${visitId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);

      return response.data;
    } catch (error) {
      console.error('Error printing lab order:', error);
      throw error;
    }
  }
};

export default laboratoryService;