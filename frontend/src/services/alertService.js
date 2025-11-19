import api from './api';

const alertService = {
  /**
   * Get unread alerts for current user
   */
  getUnreadAlerts: async (limit = 50) => {
    try {
      const response = await api.get(`/alerts/unread?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching unread alerts:', error);
      throw error;
    }
  },

  /**
   * Get unread count
   */
  getUnreadCount: async () => {
    try {
      const response = await api.get('/alerts/count');
      return response.data;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      throw error;
    }
  },

  /**
   * Get all alerts with optional filters
   */
  getAllAlerts: async (params = {}) => {
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await api.get(`/alerts?${queryString}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching all alerts:', error);
      throw error;
    }
  },

  /**
   * Get alerts by category
   */
  getAlertsByCategory: async (category, limit = 20) => {
    try {
      const response = await api.get(`/alerts/category/${category}?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching alerts by category:', error);
      throw error;
    }
  },

  /**
   * Get single alert by ID
   */
  getAlertById: async (alertId) => {
    try {
      const response = await api.get(`/alerts/${alertId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching alert:', error);
      throw error;
    }
  },

  /**
   * Create new alert
   */
  createAlert: async (alertData) => {
    try {
      const response = await api.post('/alerts', alertData);
      return response.data;
    } catch (error) {
      console.error('Error creating alert:', error);
      throw error;
    }
  },

  /**
   * Mark alert as read
   */
  markAsRead: async (alertId) => {
    try {
      const response = await api.post(`/alerts/${alertId}/read`);
      return response.data;
    } catch (error) {
      console.error('Error marking alert as read:', error);
      throw error;
    }
  },

  /**
   * Mark multiple alerts as read
   */
  markMultipleAsRead: async (alertIds) => {
    try {
      const response = await api.post('/alerts/read-multiple', { alertIds });
      return response.data;
    } catch (error) {
      console.error('Error marking multiple alerts as read:', error);
      throw error;
    }
  },

  /**
   * Dismiss alert
   */
  dismissAlert: async (alertId) => {
    try {
      const response = await api.post(`/alerts/${alertId}/dismiss`);
      return response.data;
    } catch (error) {
      console.error('Error dismissing alert:', error);
      throw error;
    }
  },

  /**
   * Complete alert action
   */
  completeAction: async (alertId) => {
    try {
      const response = await api.post(`/alerts/${alertId}/complete-action`);
      return response.data;
    } catch (error) {
      console.error('Error completing action:', error);
      throw error;
    }
  },

  /**
   * Delete alert
   */
  deleteAlert: async (alertId) => {
    try {
      const response = await api.delete(`/alerts/${alertId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting alert:', error);
      throw error;
    }
  }
};

export default alertService;
