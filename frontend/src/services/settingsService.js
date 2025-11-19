import api from './apiConfig';

/**
 * Settings Service
 * Handles clinic settings, user profile, and preferences
 */

export const settingsService = {
  /**
   * Get clinic settings
   * @returns {Promise} Clinic settings
   */
  getSettings: async () => {
    const response = await api.get('/settings');
    return response.data;
  },

  /**
   * Update clinic settings
   * @param {Object} settings - Settings to update
   * @returns {Promise} Updated settings
   */
  updateSettings: async (settings) => {
    const response = await api.put('/settings', settings);
    return response.data;
  },

  /**
   * Update Twilio configuration
   * @param {Object} twilioConfig - Twilio settings
   * @returns {Promise} Result
   */
  updateTwilioSettings: async (twilioConfig) => {
    const response = await api.put('/settings/twilio', twilioConfig);
    return response.data;
  },

  /**
   * Test Twilio connection
   * @returns {Promise} Test result
   */
  testTwilioConnection: async () => {
    const response = await api.post('/settings/twilio/test');
    return response.data;
  },

  /**
   * Get current user profile
   * @returns {Promise} User profile
   */
  getProfile: async () => {
    const response = await api.get('/settings/profile');
    return response.data;
  },

  /**
   * Update current user profile
   * @param {Object} profileData - Profile data to update
   * @returns {Promise} Updated profile
   */
  updateProfile: async (profileData) => {
    const response = await api.put('/settings/profile', profileData);
    return response.data;
  },

  /**
   * Change password
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise} Result
   */
  changePassword: async (currentPassword, newPassword) => {
    const response = await api.put('/settings/password', {
      currentPassword,
      newPassword
    });
    return response.data;
  },

  /**
   * Get notification preferences
   * @returns {Promise} Notification preferences
   */
  getNotificationPreferences: async () => {
    const response = await api.get('/settings/notifications');
    return response.data;
  },

  /**
   * Update notification preferences
   * @param {Object} preferences - Notification preferences
   * @returns {Promise} Updated preferences
   */
  updateNotificationPreferences: async (preferences) => {
    const response = await api.put('/settings/notifications', preferences);
    return response.data;
  }
};

export default settingsService;
