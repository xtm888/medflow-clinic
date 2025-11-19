import api from './apiConfig';

/**
 * Dashboard Service
 * Handles dashboard statistics and overview data
 */

export const dashboardService = {
  /**
   * Get dashboard statistics
   * @returns {Promise} Dashboard stats
   */
  getStats: async () => {
    try {
      const response = await api.get('/dashboard/stats');
      return response.data?.data || {
        todayPatients: 0,
        waitingNow: 0,
        revenue: 0,
        pendingPrescriptions: 0
      };
    } catch (error) {
      console.error('Dashboard stats error:', error);
      // Return default values if any errors
      return {
        todayPatients: 0,
        waitingNow: 0,
        revenue: 0,
        pendingPrescriptions: 0
      };
    }
  },

  /**
   * Get today's tasks for current user
   * @returns {Promise} Today's tasks
   */
  getTodayTasks: async () => {
    try {
      const response = await api.get('/dashboard/today-tasks');
      return response.data?.data || [];
    } catch (error) {
      console.error('Today tasks error:', error);
      return [];
    }
  },

  /**
   * Get recent patients for current user
   * @returns {Promise} Recent patients
   */
  getRecentPatients: async () => {
    try {
      const response = await api.get('/dashboard/recent-patients');
      return response.data?.data || [];
    } catch (error) {
      console.error('Recent patients error:', error);
      return [];
    }
  },

  /**
   * Get pending actions for current user
   * @returns {Promise} Pending actions
   */
  getPendingActions: async () => {
    try {
      const response = await api.get('/dashboard/pending-actions');
      return response.data?.data || [];
    } catch (error) {
      console.error('Pending actions error:', error);
      return [];
    }
  },

  /**
   * Get revenue trends
   * @param {string} period - Time period (7days, 30days, 90days)
   * @returns {Promise} Revenue trends
   */
  getRevenueTrends: async (period = '30days') => {
    try {
      const response = await api.get(`/dashboard/revenue-trends?period=${period}`);
      return response.data?.data || [];
    } catch (error) {
      console.error('Revenue trends error:', error);
      return [];
    }
  },

  /**
   * Get appointment trends
   * @param {string} period - Time period
   * @returns {Promise} Appointment trends
   */
  getAppointmentTrends: async (period = '7days') => {
    try {
      const response = await api.get(`/appointments/stats?period=${period}`);
      return response.data;
    } catch (error) {
      // Return empty data if endpoint doesn't exist yet
      return {
        data: [],
        success: false
      };
    }
  }
};

export default dashboardService;
