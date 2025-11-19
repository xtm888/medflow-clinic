import api from './apiConfig';

const templateCatalogService = {
  // ===== MEDICATION TEMPLATES =====

  // Get all medication templates
  async getMedicationTemplates(params = {}) {
    try {
      const response = await api.get('/template-catalog/medications', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching medication templates:', error);
      throw error;
    }
  },

  // Get medication categories
  async getMedicationCategories() {
    try {
      const response = await api.get('/template-catalog/medications/categories');
      return response.data;
    } catch (error) {
      console.error('Error fetching medication categories:', error);
      throw error;
    }
  },

  // Search medications
  async searchMedications(query, params = {}) {
    try {
      const response = await api.get('/template-catalog/medications/search', {
        params: { q: query, ...params }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching medications:', error);
      throw error;
    }
  },

  // ===== EXAMINATION TEMPLATES =====

  async getExaminationTemplates(params = {}) {
    try {
      const response = await api.get('/template-catalog/examinations', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching examination templates:', error);
      throw error;
    }
  },

  async getExaminationCategories() {
    try {
      const response = await api.get('/template-catalog/examinations/categories');
      return response.data;
    } catch (error) {
      console.error('Error fetching examination categories:', error);
      throw error;
    }
  },

  // ===== PATHOLOGY TEMPLATES =====

  async getPathologyTemplates(params = {}) {
    try {
      const response = await api.get('/template-catalog/pathologies', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching pathology templates:', error);
      throw error;
    }
  },

  async getPathologyCategories() {
    try {
      const response = await api.get('/template-catalog/pathologies/categories');
      return response.data;
    } catch (error) {
      console.error('Error fetching pathology categories:', error);
      throw error;
    }
  },

  async getPathologySubcategories(params = {}) {
    try {
      const response = await api.get('/template-catalog/pathologies/subcategories', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching pathology subcategories:', error);
      throw error;
    }
  },

  // ===== LABORATORY TEMPLATES =====

  async getLaboratoryTemplates(params = {}) {
    try {
      const response = await api.get('/template-catalog/laboratories', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching laboratory templates:', error);
      throw error;
    }
  },

  async getLaboratoryCategories() {
    try {
      const response = await api.get('/template-catalog/laboratories/categories');
      return response.data;
    } catch (error) {
      console.error('Error fetching laboratory categories:', error);
      throw error;
    }
  },

  async getLaboratoryProfiles() {
    try {
      const response = await api.get('/template-catalog/laboratories/profiles');
      return response.data;
    } catch (error) {
      console.error('Error fetching laboratory profiles:', error);
      throw error;
    }
  },

  // ===== CLINICAL TEMPLATES =====

  async getClinicalTemplates(params = {}) {
    try {
      const response = await api.get('/template-catalog/clinical', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching clinical templates:', error);
      throw error;
    }
  },

  async getClinicalCategories() {
    try {
      const response = await api.get('/template-catalog/clinical/categories');
      return response.data;
    } catch (error) {
      console.error('Error fetching clinical categories:', error);
      throw error;
    }
  },

  // ===== STATS =====

  async getTemplateCatalogStats() {
    try {
      const response = await api.get('/template-catalog/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching template catalog stats:', error);
      throw error;
    }
  }
};

export default templateCatalogService;
