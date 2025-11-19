import api from './apiConfig';

/**
 * Notification Service
 * Handles in-app notifications
 */

const notificationService = {
  /**
   * Get notifications
   * @param {Object} params - page, limit, unreadOnly, type
   * @returns {Promise} Notifications list
   */
  getNotifications: async (params = {}) => {
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  /**
   * Get unread count
   * @returns {Promise} Unread count
   */
  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @returns {Promise} Result
   */
  markAsRead: async (notificationId) => {
    const response = await api.put(`/notifications/${notificationId}/read`);
    return response.data;
  },

  /**
   * Mark all notifications as read
   * @returns {Promise} Result
   */
  markAllAsRead: async () => {
    const response = await api.put('/notifications/read-all');
    return response.data;
  },

  /**
   * Delete notification
   * @param {string} notificationId - Notification ID
   * @returns {Promise} Result
   */
  deleteNotification: async (notificationId) => {
    const response = await api.delete(`/notifications/${notificationId}`);
    return response.data;
  },

  /**
   * Clear all notifications
   * @returns {Promise} Result
   */
  clearAll: async () => {
    const response = await api.delete('/notifications/clear-all');
    return response.data;
  },

  /**
   * Get notification preferences
   * @returns {Promise} Preferences
   */
  getPreferences: async () => {
    const response = await api.get('/notifications/preferences');
    return response.data;
  },

  /**
   * Update notification preferences
   * @param {Object} preferences - Updated preferences
   * @returns {Promise} Result
   */
  updatePreferences: async (preferences) => {
    const response = await api.put('/notifications/preferences', preferences);
    return response.data;
  },

  /**
   * Create notification (admin)
   * @param {Object} notificationData - Notification details
   * @returns {Promise} Created notification
   */
  createNotification: async (notificationData) => {
    const response = await api.post('/notifications', notificationData);
    return response.data;
  },

  /**
   * Broadcast notification (admin)
   * @param {Object} broadcastData - Broadcast details
   * @returns {Promise} Result
   */
  broadcast: async (broadcastData) => {
    const response = await api.post('/notifications/broadcast', broadcastData);
    return response.data;
  }
};

export default notificationService;
