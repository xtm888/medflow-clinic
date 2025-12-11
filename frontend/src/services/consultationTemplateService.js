import api from './apiConfig';

/**
 * Service for managing consultation templates
 */
const consultationTemplateService = {
  /**
   * Get all available templates (system + clinic-specific)
   */
  getTemplates: async () => {
    const response = await api.get('/consultation-templates');
    return response.data;
  },

  /**
   * Get a single template by ID
   */
  getTemplate: async (id) => {
    const response = await api.get(`/consultation-templates/${id}`);
    return response.data;
  },

  /**
   * Get templates by type
   */
  getTemplatesByType: async (type) => {
    const response = await api.get(`/consultation-templates/by-type/${type}`);
    return response.data;
  },

  /**
   * Create a new custom template (admin only)
   */
  createTemplate: async (templateData) => {
    const response = await api.post('/consultation-templates', templateData);
    return response.data;
  },

  /**
   * Update an existing template (admin only)
   */
  updateTemplate: async (id, templateData) => {
    const response = await api.put(`/consultation-templates/${id}`, templateData);
    return response.data;
  },

  /**
   * Delete a template (admin only)
   */
  deleteTemplate: async (id) => {
    const response = await api.delete(`/consultation-templates/${id}`);
    return response.data;
  },

  /**
   * Record template usage (for statistics)
   */
  recordUsage: async (id) => {
    const response = await api.post(`/consultation-templates/${id}/use`);
    return response.data;
  },

  /**
   * Apply template prefill data to consultation form
   * Returns structured data ready to merge with form state
   */
  applyTemplate: (template) => {
    if (!template?.prefillData) return null;

    const { prefillData } = template;

    return {
      // Chief complaint section
      complaint: {
        motif: prefillData.complaint?.motif || '',
        duration: prefillData.complaint?.duration || '',
        durationUnit: prefillData.complaint?.durationUnit || 'days',
        severity: prefillData.complaint?.severity || '',
        notes: prefillData.complaint?.notes || ''
      },

      // Pre-selected diagnoses
      diagnoses: prefillData.diagnoses || [],

      // Pre-selected procedures
      procedures: (prefillData.procedures || []).map(proc => ({
        ...proc,
        addedAt: new Date().toISOString()
      })),

      // Pre-selected medications
      medications: prefillData.medications || [],

      // Examination focus hints
      examinationFocus: {
        focusSections: prefillData.examination?.focusSections || [],
        requiredFields: prefillData.examination?.requiredFields || [],
        notes: prefillData.examination?.notes || ''
      },

      // Follow-up suggestion
      followUp: prefillData.followUp || null,

      // Template metadata
      _templateId: template._id,
      _templateName: template.name,
      _appliedAt: new Date().toISOString()
    };
  },

  /**
   * Get icon component name for template
   */
  getTemplateIcon: (iconName) => {
    const iconMap = {
      'glasses': 'Glasses',
      'eye': 'Eye',
      'check-circle': 'CheckCircle',
      'search': 'Search',
      'alert-circle': 'AlertCircle',
      'book-open': 'BookOpen',
      'file-text': 'FileText'
    };
    return iconMap[iconName] || 'FileText';
  },

  /**
   * Get color classes for template
   */
  getTemplateColor: (color) => {
    const colorMap = {
      'blue': { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-300' },
      'green': { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-300' },
      'purple': { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-300' },
      'orange': { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-300' },
      'red': { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-300' },
      'indigo': { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-300' }
    };
    return colorMap[color] || colorMap['blue'];
  }
};

export default consultationTemplateService;
