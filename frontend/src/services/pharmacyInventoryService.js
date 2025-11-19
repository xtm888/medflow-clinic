import api from './apiConfig';

// Pharmacy Inventory service for managing medication stock
const pharmacyInventoryService = {
  // Get all inventory items
  async getAll(params = {}) {
    try {
      const response = await api.get('/pharmacy', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching pharmacy inventory:', error);
      throw error;
    }
  },

  // Get single inventory item
  async getById(id) {
    try {
      const response = await api.get(`/pharmacy/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching inventory item:', error);
      throw error;
    }
  },

  // Search medications
  async search(query, options = {}) {
    try {
      const response = await api.get('/pharmacy/search', {
        params: { q: query, ...options }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching pharmacy:', error);
      throw error;
    }
  },

  // Get low stock items
  async getLowStock() {
    try {
      const response = await api.get('/pharmacy/low-stock');
      return response.data;
    } catch (error) {
      console.error('Error fetching low stock items:', error);
      throw error;
    }
  },

  // Get expiring items
  async getExpiring(days = 30) {
    try {
      const response = await api.get('/pharmacy/expiring', {
        params: { days }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching expiring items:', error);
      throw error;
    }
  },

  // Get pharmacy statistics
  async getStats() {
    try {
      const response = await api.get('/pharmacy/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching pharmacy stats:', error);
      throw error;
    }
  },

  // Create new inventory item
  async create(data) {
    try {
      const response = await api.post('/pharmacy', data);
      return response.data;
    } catch (error) {
      console.error('Error creating inventory item:', error);
      throw error;
    }
  },

  // Update inventory item
  async update(id, data) {
    try {
      const response = await api.put(`/pharmacy/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating inventory item:', error);
      throw error;
    }
  },

  // Delete inventory item
  async delete(id) {
    try {
      const response = await api.delete(`/pharmacy/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      throw error;
    }
  },

  // Add batch to inventory
  async addBatch(id, batchData) {
    try {
      const response = await api.post(`/pharmacy/${id}/batches`, batchData);
      return response.data;
    } catch (error) {
      console.error('Error adding batch:', error);
      throw error;
    }
  },

  // Reserve stock for prescription/procedure
  async reserveStock(id, reservationData) {
    try {
      const response = await api.post(`/pharmacy/${id}/reserve`, reservationData);
      return response.data;
    } catch (error) {
      console.error('Error reserving stock:', error);
      throw error;
    }
  },

  // Release reservation
  async releaseReservation(id, reservationId) {
    try {
      const response = await api.post(`/pharmacy/${id}/release`, { reservationId });
      return response.data;
    } catch (error) {
      console.error('Error releasing reservation:', error);
      throw error;
    }
  },

  // Dispense medication
  async dispense(id, dispenseData) {
    try {
      const response = await api.post(`/pharmacy/${id}/dispense`, dispenseData);
      return response.data;
    } catch (error) {
      console.error('Error dispensing medication:', error);
      throw error;
    }
  },

  // Update stock (adjustment)
  async updateStock(id, stockData) {
    try {
      const response = await api.post(`/pharmacy/${id}/adjust-stock`, stockData);
      return response.data;
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  },

  // Get transaction history for an item
  async getTransactions(id, params = {}) {
    try {
      const response = await api.get(`/pharmacy/${id}/transactions`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  },

  // Get inventory value
  async getInventoryValue() {
    try {
      const response = await api.get('/pharmacy/value');
      return response.data;
    } catch (error) {
      console.error('Error fetching inventory value:', error);
      throw error;
    }
  },

  // Mark batch as expired
  async markBatchExpired(id, lotNumber) {
    try {
      const response = await api.post(`/pharmacy/${id}/batches/${lotNumber}/expire`);
      return response.data;
    } catch (error) {
      console.error('Error marking batch expired:', error);
      throw error;
    }
  },

  // Get alerts (low stock, expiring, etc.)
  async getAlerts() {
    try {
      const response = await api.get('/pharmacy/alerts');
      return response.data;
    } catch (error) {
      console.error('Error fetching pharmacy alerts:', error);
      throw error;
    }
  },

  // Resolve alert
  async resolveAlert(id, alertId) {
    try {
      const response = await api.put(`/pharmacy/${id}/alerts/${alertId}/resolve`);
      return response.data;
    } catch (error) {
      console.error('Error resolving alert:', error);
      throw error;
    }
  },

  // Get by category
  async getByCategory(category) {
    try {
      const response = await api.get('/pharmacy', {
        params: { category }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching by category:', error);
      throw error;
    }
  },

  // Export inventory report
  async exportReport(format = 'csv') {
    try {
      const response = await api.get('/pharmacy/export', {
        params: { format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting inventory:', error);
      throw error;
    }
  }
};

export default pharmacyInventoryService;
