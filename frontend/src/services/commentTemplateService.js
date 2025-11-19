import api from './apiConfig';

const commentTemplateService = {
  // Get all comment templates
  async getCommentTemplates(category = null) {
    try {
      const params = category ? { category } : {};
      const response = await api.get('/comment-templates', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching comment templates:', error);
      throw error;
    }
  },

  // Get templates by category
  async getTemplatesByCategory(category) {
    try {
      const response = await api.get(`/comment-templates/category/${category}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching templates by category:', error);
      throw error;
    }
  },

  // Get most used templates
  async getMostUsedTemplates(limit = 10) {
    try {
      const response = await api.get('/comment-templates/most-used', {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching most used templates:', error);
      throw error;
    }
  },

  // Increment template usage
  async incrementUsage(templateId) {
    try {
      const response = await api.put(`/comment-templates/${templateId}/use`);
      return response.data;
    } catch (error) {
      console.error('Error incrementing template usage:', error);
      throw error;
    }
  },

  // Create new template
  async createTemplate(templateData) {
    try {
      const response = await api.post('/comment-templates', templateData);
      return response.data;
    } catch (error) {
      console.error('Error creating comment template:', error);
      throw error;
    }
  },

  // Update template
  async updateTemplate(templateId, templateData) {
    try {
      const response = await api.put(`/comment-templates/${templateId}`, templateData);
      return response.data;
    } catch (error) {
      console.error('Error updating comment template:', error);
      throw error;
    }
  },

  // Delete template
  async deleteTemplate(templateId) {
    try {
      const response = await api.delete(`/comment-templates/${templateId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting comment template:', error);
      throw error;
    }
  }
};

export default commentTemplateService;
