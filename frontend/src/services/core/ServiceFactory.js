import api from '../apiConfig';

/**
 * Creates a standard CRUD service for a given endpoint
 * @param {string} endpoint - The API endpoint (e.g., '/patients')
 * @param {object} options - Optional configuration
 * @param {function} options.transformResponse - Transform function for response data
 * @param {function} options.transformRequest - Transform function for request data
 * @returns {object} Service object with CRUD methods
 */
export const createCrudService = (endpoint, options = {}) => {
  const { transformResponse, transformRequest } = options;

  // Helper to transform response if transform function provided
  const processResponse = (data) => {
    return transformResponse ? transformResponse(data) : data;
  };

  // Helper to transform request if transform function provided
  const processRequest = (data) => {
    return transformRequest ? transformRequest(data) : data;
  };

  return {
    /**
     * Get all items with optional query parameters
     * @param {object} params - Query parameters (filters, pagination, etc.)
     * @returns {Promise} Response data
     */
    getAll: async (params = {}) => {
      const response = await api.get(endpoint, { params });
      return processResponse(response.data);
    },

    /**
     * Get a single item by ID
     * @param {string} id - Item ID
     * @returns {Promise} Response data
     */
    getById: async (id) => {
      const response = await api.get(`${endpoint}/${id}`);
      return processResponse(response.data);
    },

    /**
     * Create a new item
     * @param {object} data - Item data
     * @returns {Promise} Response data
     */
    create: async (data) => {
      const processedData = processRequest(data);
      const response = await api.post(endpoint, processedData);
      return processResponse(response.data);
    },

    /**
     * Update an existing item
     * @param {string} id - Item ID
     * @param {object} data - Updated item data
     * @returns {Promise} Response data
     */
    update: async (id, data) => {
      const processedData = processRequest(data);
      const response = await api.put(`${endpoint}/${id}`, processedData);
      return processResponse(response.data);
    },

    /**
     * Delete an item
     * @param {string} id - Item ID
     * @param {string} reason - Optional deletion reason
     * @returns {Promise} Response data
     */
    delete: async (id, reason) => {
      const config = reason ? { data: { reason } } : {};
      const response = await api.delete(`${endpoint}/${id}`, config);
      return processResponse(response.data);
    },

    /**
     * Search for items
     * @param {string} query - Search query string
     * @param {object} options - Search options (filters, pagination, etc.)
     * @returns {Promise} Response data
     */
    search: async (query, options = {}) => {
      const params = { q: query, ...options };
      const response = await api.get(`${endpoint}/search`, { params });
      return processResponse(response.data);
    },
  };
};

/**
 * Creates an inventory service with CRUD and inventory-specific methods
 * @param {string} endpoint - The API endpoint (e.g., '/pharmacy-inventory')
 * @param {object} options - Optional configuration
 * @param {function} options.transformResponse - Transform function for response data
 * @param {function} options.transformRequest - Transform function for request data
 * @returns {object} Service object with CRUD and inventory methods
 */
export const createInventoryService = (endpoint, options = {}) => {
  // Get base CRUD methods
  const baseService = createCrudService(endpoint, options);

  const { transformResponse, transformRequest } = options;

  // Helper to transform response if transform function provided
  const processResponse = (data) => {
    return transformResponse ? transformResponse(data) : data;
  };

  // Helper to transform request if transform function provided
  const processRequest = (data) => {
    return transformRequest ? transformRequest(data) : data;
  };

  // Extend with inventory-specific methods
  return {
    ...baseService,

    /**
     * Add stock to an inventory item
     * @param {string} id - Inventory item ID
     * @param {object} batchData - Stock batch data (quantity, lotNumber, expiryDate, etc.)
     * @returns {Promise} Response data
     */
    addStock: async (id, batchData) => {
      const processedData = processRequest(batchData);
      const response = await api.post(`${endpoint}/${id}/add-stock`, processedData);
      return processResponse(response.data);
    },

    /**
     * Adjust stock quantity (manual adjustment)
     * @param {string} id - Inventory item ID
     * @param {object} adjustment - Adjustment data (quantity, reason, type)
     * @returns {Promise} Response data
     */
    adjustStock: async (id, adjustment) => {
      const processedData = processRequest(adjustment);
      const response = await api.post(`${endpoint}/${id}/adjust`, processedData);
      return processResponse(response.data);
    },

    /**
     * Reserve inventory for an order
     * @param {string} id - Inventory item ID
     * @param {object} orderData - Order data (quantity, orderId, patientId, etc.)
     * @returns {Promise} Response data
     */
    reserveForOrder: async (id, orderData) => {
      const processedData = processRequest(orderData);
      const response = await api.post(`${endpoint}/${id}/reserve`, processedData);
      return processResponse(response.data);
    },

    /**
     * Release a reservation (cancel order)
     * @param {string} id - Inventory item ID
     * @param {string} reservationId - Reservation ID
     * @returns {Promise} Response data
     */
    releaseReservation: async (id, reservationId) => {
      const response = await api.post(`${endpoint}/${id}/release-reservation/${reservationId}`);
      return processResponse(response.data);
    },

    /**
     * Fulfill a reservation (complete order)
     * @param {string} id - Inventory item ID
     * @param {string} reservationId - Reservation ID
     * @param {object} data - Fulfillment data (actualQuantity, notes, etc.)
     * @returns {Promise} Response data
     */
    fulfillReservation: async (id, reservationId, data = {}) => {
      const processedData = processRequest(data);
      const response = await api.post(`${endpoint}/${id}/fulfill-reservation/${reservationId}`, processedData);
      return processResponse(response.data);
    },

    /**
     * Get inventory statistics
     * @param {object} params - Query parameters (date range, clinic, etc.)
     * @returns {Promise} Response data
     */
    getStats: async (params = {}) => {
      const response = await api.get(`${endpoint}/stats`, { params });
      return processResponse(response.data);
    },

    /**
     * Get low stock items
     * @param {object} params - Query parameters (threshold, clinic, etc.)
     * @returns {Promise} Response data
     */
    getLowStock: async (params = {}) => {
      const response = await api.get(`${endpoint}/low-stock`, { params });
      return processResponse(response.data);
    },

    /**
     * Get inventory alerts
     * @param {object} params - Query parameters (type, status, clinic, etc.)
     * @returns {Promise} Response data
     */
    getAlerts: async (params = {}) => {
      const response = await api.get(`${endpoint}/alerts`, { params });
      return processResponse(response.data);
    },

    /**
     * Resolve an inventory alert
     * @param {string} itemId - Inventory item ID
     * @param {string} alertId - Alert ID
     * @returns {Promise} Response data
     */
    resolveAlert: async (itemId, alertId) => {
      const response = await api.post(`${endpoint}/${itemId}/alerts/${alertId}/resolve`);
      return processResponse(response.data);
    },

    /**
     * Get transaction history for an inventory item
     * @param {string} id - Inventory item ID
     * @param {object} params - Query parameters (date range, type, pagination, etc.)
     * @returns {Promise} Response data
     */
    getTransactions: async (id, params = {}) => {
      const response = await api.get(`${endpoint}/${id}/transactions`, { params });
      return processResponse(response.data);
    },

    /**
     * Get available brands
     * @param {object} params - Query parameters (filters, etc.)
     * @returns {Promise} Response data
     */
    getBrands: async (params = {}) => {
      const response = await api.get(`${endpoint}/brands`, { params });
      return processResponse(response.data);
    },

    /**
     * Get total inventory value
     * @returns {Promise} Response data
     */
    getInventoryValue: async () => {
      const response = await api.get(`${endpoint}/value`);
      return processResponse(response.data);
    },
  };
};
