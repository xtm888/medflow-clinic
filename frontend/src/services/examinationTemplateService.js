import api from './apiConfig';

// Examination Template service for accessing exam templates
const examinationTemplateService = {
  // Get all examination templates
  async getAll(params = {}) {
    try {
      const response = await api.get('/template-catalog/examinations', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching examination templates:', error);
      throw error;
    }
  },

  // Get templates by category
  async getByCategory(category) {
    try {
      const response = await api.get('/template-catalog/examinations', {
        params: { category }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching examinations by category:', error);
      throw error;
    }
  },

  // Get examination categories
  async getCategories() {
    try {
      const response = await api.get('/template-catalog/examinations/categories');
      return response.data;
    } catch (error) {
      console.error('Error fetching examination categories:', error);
      throw error;
    }
  },

  // Search examination templates
  async search(query, options = {}) {
    try {
      const response = await api.get('/template-catalog/examinations', {
        params: { search: query, ...options }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching examination templates:', error);
      throw error;
    }
  },

  // Get template by ID
  async getById(id) {
    try {
      const response = await api.get(`/template-catalog/examinations/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching examination template:', error);
      throw error;
    }
  },

  // Get popular examination templates
  async getPopular(limit = 20) {
    try {
      const response = await api.get('/template-catalog/examinations', {
        params: { sort: '-usageCount', limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching popular examinations:', error);
      throw error;
    }
  },

  // Get ophthalmology examination templates
  async getOphthalmologyExams() {
    try {
      const response = await api.get('/template-catalog/examinations', {
        params: { specialty: 'ophthalmology' }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching ophthalmology examinations:', error);
      throw error;
    }
  },

  // Get exam template fields/structure
  async getTemplateFields(id) {
    try {
      const response = await api.get(`/template-catalog/examinations/${id}/fields`);
      return response.data;
    } catch (error) {
      console.error('Error fetching examination fields:', error);
      throw error;
    }
  },

  // Record template usage
  async recordUsage(templateId) {
    try {
      const response = await api.post(`/template-catalog/examinations/${templateId}/use`);
      return response.data;
    } catch (error) {
      console.error('Error recording template usage:', error);
      throw error;
    }
  },

  // Get templates for anamnesis
  async getAnamnesisTemplates() {
    try {
      const response = await api.get('/template-catalog/examinations', {
        params: { category: 'anamnesis' }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching anamnesis templates:', error);
      throw error;
    }
  },

  // Get templates for specific exam type
  async getByExamType(examType) {
    try {
      const response = await api.get('/template-catalog/examinations', {
        params: { examType }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching templates by exam type:', error);
      throw error;
    }
  }
};

export default examinationTemplateService;
