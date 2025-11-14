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
      const [
        todayAppointments,
        queueStats,
        prescriptions
      ] = await Promise.all([
        api.get('/appointments/today').catch(() => ({ data: { data: [], stats: {} } })),
        api.get('/queue/stats').catch(() => ({ data: { data: {} } })),
        api.get('/prescriptions?status=pending&limit=100').catch(() => ({ data: { data: [] } }))
      ]);

      return {
        todayPatients: todayAppointments.data?.stats?.total || todayAppointments.data?.data?.length || 0,
        waitingNow: queueStats.data?.data?.totalWaiting || 0,
        revenue: 0, // Will be populated when invoicing is implemented
        pendingPrescriptions: Array.isArray(prescriptions.data?.data) ? prescriptions.data.data.length : 0
      };
    } catch (error) {
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
   * Get financial trends (placeholder for when invoicing is implemented)
   * @param {string} period - Time period
   * @returns {Promise} Financial trends
   */
  getFinancialTrends: async (period = '30days') => {
    try {
      const response = await api.get(`/invoices/trends?period=${period}`);
      return response.data;
    } catch (error) {
      // Return mock data if endpoint doesn't exist yet
      return {
        data: [],
        success: false
      };
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
