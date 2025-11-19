import api from './apiConfig';

const treatmentProtocolService = {
  // Get user's treatment protocols (personal + system-wide)
  async getTreatmentProtocols(params = {}) {
    try {
      const response = await api.get('/treatment-protocols', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching treatment protocols:', error);
      throw error;
    }
  },

  // Get popular treatment protocols
  async getPopularProtocols(limit = 10) {
    try {
      const response = await api.get('/treatment-protocols/popular', { params: { limit } });
      return response.data;
    } catch (error) {
      console.error('Error fetching popular protocols:', error);
      throw error;
    }
  },

  // Get user's favorite protocols
  async getFavoriteProtocols() {
    try {
      const response = await api.get('/treatment-protocols/favorites');
      return response.data;
    } catch (error) {
      console.error('Error fetching favorite protocols:', error);
      throw error;
    }
  },

  // Get single treatment protocol
  async getTreatmentProtocol(id) {
    try {
      const response = await api.get(`/treatment-protocols/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching treatment protocol:', error);
      throw error;
    }
  },

  // Create new treatment protocol
  async createTreatmentProtocol(protocolData) {
    try {
      const response = await api.post('/treatment-protocols', protocolData);
      return response.data;
    } catch (error) {
      console.error('Error creating treatment protocol:', error);
      throw error;
    }
  },

  // Update treatment protocol
  async updateTreatmentProtocol(id, protocolData) {
    try {
      const response = await api.put(`/treatment-protocols/${id}`, protocolData);
      return response.data;
    } catch (error) {
      console.error('Error updating treatment protocol:', error);
      throw error;
    }
  },

  // Delete treatment protocol
  async deleteTreatmentProtocol(id) {
    try {
      const response = await api.delete(`/treatment-protocols/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting treatment protocol:', error);
      throw error;
    }
  },

  // Increment usage count
  async incrementUsage(id) {
    try {
      const response = await api.post(`/treatment-protocols/${id}/use`);
      return response.data;
    } catch (error) {
      console.error('Error incrementing usage:', error);
      throw error;
    }
  },

  // Toggle favorite status
  async toggleFavorite(id) {
    try {
      const response = await api.post(`/treatment-protocols/${id}/favorite`);
      return response.data;
    } catch (error) {
      console.error('Error toggling favorite:', error);
      throw error;
    }
  }
};

export default treatmentProtocolService;
