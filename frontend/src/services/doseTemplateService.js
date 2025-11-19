import api from './apiConfig';

const doseTemplateService = {
  // Get all dose templates
  async getDoseTemplates(params = {}) {
    try {
      const response = await api.get('/dose-templates', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching dose templates:', error);
      throw error;
    }
  },

  // Get dose template by medication form
  async getByForm(form) {
    try {
      const response = await api.get(`/dose-templates/by-form/${form}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching dose template by form:', error);
      throw error;
    }
  },

  // Get single dose template
  async getDoseTemplate(id) {
    try {
      const response = await api.get(`/dose-templates/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching dose template:', error);
      throw error;
    }
  },

  // Create new dose template (admin only)
  async createDoseTemplate(templateData) {
    try {
      const response = await api.post('/dose-templates', templateData);
      return response.data;
    } catch (error) {
      console.error('Error creating dose template:', error);
      throw error;
    }
  },

  // Update dose template (admin only)
  async updateDoseTemplate(id, templateData) {
    try {
      const response = await api.put(`/dose-templates/${id}`, templateData);
      return response.data;
    } catch (error) {
      console.error('Error updating dose template:', error);
      throw error;
    }
  },

  // Delete dose template (admin only)
  async deleteDoseTemplate(id) {
    try {
      const response = await api.delete(`/dose-templates/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting dose template:', error);
      throw error;
    }
  }
};

export default doseTemplateService;
