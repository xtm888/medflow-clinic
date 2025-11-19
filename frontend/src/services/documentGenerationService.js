import api from './apiConfig';

// Get all document templates
export const getTemplates = async (filters = {}) => {
  try {
    const response = await api.get('/document-generation/templates', { params: filters });
    return response.data;
  } catch (error) {
    console.error('Error fetching templates:', error);
    throw error.response?.data || error;
  }
};

// Get single template by ID
export const getTemplateById = async (templateId) => {
  try {
    const response = await api.get(`/document-generation/templates/${templateId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching template:', error);
    throw error.response?.data || error;
  }
};

// Get template by code (e.g., TPL0001)
export const getTemplateByCode = async (templateCode) => {
  try {
    const response = await api.get(`/document-generation/templates/code/${templateCode}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching template by code:', error);
    throw error.response?.data || error;
  }
};

// Get template categories
export const getCategories = async () => {
  try {
    const response = await api.get('/document-generation/categories');
    return response.data;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error.response?.data || error;
  }
};

// Preview template with auto-filled data
export const previewTemplate = async (templateId, data) => {
  try {
    const response = await api.post(`/document-generation/templates/${templateId}/preview`, data);
    return response.data;
  } catch (error) {
    console.error('Error previewing template:', error);
    throw error.response?.data || error;
  }
};

// Generate document from template
export const generateDocument = async (data) => {
  try {
    const response = await api.post('/document-generation/generate', data);
    return response.data;
  } catch (error) {
    console.error('Error generating document:', error);
    throw error.response?.data || error;
  }
};

// Get all generated documents for a visit
export const getVisitDocuments = async (visitId) => {
  try {
    const response = await api.get(`/document-generation/visit/${visitId}/documents`);
    return response.data;
  } catch (error) {
    console.error('Error fetching visit documents:', error);
    throw error.response?.data || error;
  }
};

// Get all generated documents for a patient
export const getPatientDocuments = async (patientId) => {
  try {
    const response = await api.get(`/document-generation/patient/${patientId}/documents`);
    return response.data;
  } catch (error) {
    console.error('Error fetching patient documents:', error);
    throw error.response?.data || error;
  }
};

// Bulk generate multiple documents for a visit
export const bulkGenerateDocuments = async (visitId, data) => {
  try {
    const response = await api.post(`/document-generation/visit/${visitId}/bulk-generate`, data);
    return response.data;
  } catch (error) {
    console.error('Error bulk generating documents:', error);
    throw error.response?.data || error;
  }
};

export default {
  getTemplates,
  getTemplateById,
  getTemplateByCode,
  getCategories,
  previewTemplate,
  generateDocument,
  getVisitDocuments,
  getPatientDocuments,
  bulkGenerateDocuments
};
