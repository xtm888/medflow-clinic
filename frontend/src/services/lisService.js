import api from './apiConfig';

/**
 * LIS Integration Service
 * Frontend service for managing Laboratory Information System integrations
 */
const lisService = {
  // ============ Integration Management ============

  /**
   * Get all LIS integrations
   */
  getIntegrations: async () => {
    const response = await api.get('/lis/integrations');
    return response.data;
  },

  /**
   * Get single integration by ID
   */
  getIntegration: async (id) => {
    const response = await api.get(`/lis/integrations/${id}`);
    return response.data;
  },

  /**
   * Create new integration
   */
  createIntegration: async (data) => {
    const response = await api.post('/lis/integrations', data);
    return response.data;
  },

  /**
   * Update integration
   */
  updateIntegration: async (id, data) => {
    const response = await api.put(`/lis/integrations/${id}`, data);
    return response.data;
  },

  /**
   * Delete integration
   */
  deleteIntegration: async (id) => {
    const response = await api.delete(`/lis/integrations/${id}`);
    return response.data;
  },

  /**
   * Test integration connection
   */
  testConnection: async (id) => {
    const response = await api.post(`/lis/integrations/${id}/test`);
    return response.data;
  },

  /**
   * Activate integration
   */
  activateIntegration: async (id) => {
    const response = await api.post(`/lis/integrations/${id}/activate`);
    return response.data;
  },

  /**
   * Deactivate integration
   */
  deactivateIntegration: async (id) => {
    const response = await api.post(`/lis/integrations/${id}/deactivate`);
    return response.data;
  },

  /**
   * Get integration statistics
   */
  getStatistics: async (id) => {
    const response = await api.get(`/lis/integrations/${id}/statistics`);
    return response.data;
  },

  // ============ Message Logs ============

  /**
   * Get message logs for integration
   */
  getMessages: async (integrationId, options = {}) => {
    const params = new URLSearchParams();
    if (options.direction) params.append('direction', options.direction);
    if (options.status) params.append('status', options.status);
    if (options.messageType) params.append('messageType', options.messageType);
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);
    if (options.limit) params.append('limit', options.limit);
    if (options.skip) params.append('skip', options.skip);

    const response = await api.get(`/lis/integrations/${integrationId}/messages?${params}`);
    return response.data;
  },

  /**
   * Get single message details
   */
  getMessage: async (messageId) => {
    const response = await api.get(`/lis/messages/${messageId}`);
    return response.data;
  },

  /**
   * Reprocess a failed message
   */
  reprocessMessage: async (messageId) => {
    const response = await api.post(`/lis/messages/${messageId}/reprocess`);
    return response.data;
  },

  // ============ Test Mappings ============

  /**
   * Get test code mappings
   */
  getMappings: async (integrationId) => {
    const response = await api.get(`/lis/integrations/${integrationId}/mappings`);
    return response.data;
  },

  /**
   * Create or update test mapping
   */
  saveMapping: async (integrationId, mapping) => {
    const response = await api.post(`/lis/integrations/${integrationId}/mappings`, mapping);
    return response.data;
  },

  /**
   * Delete test mapping
   */
  deleteMapping: async (mappingId) => {
    const response = await api.delete(`/lis/mappings/${mappingId}`);
    return response.data;
  },

  // ============ Manual Operations ============

  /**
   * Send lab order to LIS
   */
  sendOrder: async (integrationId, orderId) => {
    const response = await api.post(`/lis/integrations/${integrationId}/send-order`, { orderId });
    return response.data;
  },

  /**
   * Parse HL7 message (utility)
   */
  parseHL7: async (message) => {
    const response = await api.post('/lis/parse/hl7', { message });
    return response.data;
  },

  /**
   * Generate HL7 message (utility)
   */
  generateHL7: async (data) => {
    const response = await api.post('/lis/generate/hl7', data, {
      responseType: 'text'
    });
    return response.data;
  }
};

export default lisService;
