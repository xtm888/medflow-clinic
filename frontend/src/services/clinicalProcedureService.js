import api from './apiConfig';

// Clinical Procedure service for accessing clinical procedure templates
const clinicalProcedureService = {
  // Get all clinical procedures
  async getAll(params = {}) {
    try {
      const response = await api.get('/template-catalog/clinical', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching clinical procedures:', error);
      throw error;
    }
  },

  // Get procedures by category
  async getByCategory(category) {
    try {
      const response = await api.get('/template-catalog/clinical', {
        params: { category }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching procedures by category:', error);
      throw error;
    }
  },

  // Get clinical procedure categories
  async getCategories() {
    try {
      const response = await api.get('/template-catalog/clinical/categories');
      return response.data;
    } catch (error) {
      console.error('Error fetching clinical categories:', error);
      throw error;
    }
  },

  // Search clinical procedures
  async search(query, options = {}) {
    try {
      const response = await api.get('/template-catalog/clinical', {
        params: { search: query, ...options }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching clinical procedures:', error);
      throw error;
    }
  },

  // Get procedure by ID
  async getById(id) {
    try {
      const response = await api.get(`/template-catalog/clinical/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching clinical procedure:', error);
      throw error;
    }
  },

  // Get popular/common procedures
  async getPopular(limit = 20) {
    try {
      const response = await api.get('/template-catalog/clinical', {
        params: { sort: '-usageCount', limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching popular procedures:', error);
      throw error;
    }
  },

  // Get ophthalmology-specific procedures
  async getOphthalmologyProcedures() {
    try {
      const response = await api.get('/template-catalog/clinical', {
        params: { specialty: 'ophthalmology' }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching ophthalmology procedures:', error);
      throw error;
    }
  },

  // Get procedures for billing
  async getBillableProcedures() {
    try {
      const response = await api.get('/template-catalog/clinical', {
        params: { billable: true }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching billable procedures:', error);
      throw error;
    }
  },

  // Get procedure pricing info
  async getProcedurePricing(procedureId) {
    try {
      const response = await api.get(`/template-catalog/clinical/${procedureId}/pricing`);
      return response.data;
    } catch (error) {
      console.error('Error fetching procedure pricing:', error);
      throw error;
    }
  },

  // Record procedure usage (for tracking popular procedures)
  async recordUsage(procedureId) {
    try {
      const response = await api.post(`/template-catalog/clinical/${procedureId}/use`);
      return response.data;
    } catch (error) {
      console.error('Error recording procedure usage:', error);
      throw error;
    }
  }
};

export default clinicalProcedureService;
