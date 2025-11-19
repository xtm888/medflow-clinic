import api from './apiConfig';

/**
 * Portal Service
 * Handles patient portal operations - accessing own data
 */

const portalService = {
  /**
   * Get patient dashboard data
   * @returns {Promise} Dashboard summary
   */
  getDashboard: async () => {
    const response = await api.get('/portal/dashboard');
    return response.data;
  },

  /**
   * Get patient's appointments
   * @returns {Promise} Appointments (upcoming and past)
   */
  getMyAppointments: async () => {
    const response = await api.get('/portal/appointments');
    return response.data;
  },

  /**
   * Request a new appointment
   * @param {Object} appointmentData - Appointment details
   * @returns {Promise} Created appointment
   */
  requestAppointment: async (appointmentData) => {
    const response = await api.post('/portal/appointments', appointmentData);
    return response.data;
  },

  /**
   * Cancel an appointment
   * @param {string} appointmentId - Appointment ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise} Result
   */
  cancelAppointment: async (appointmentId, reason) => {
    const response = await api.put(`/portal/appointments/${appointmentId}/cancel`, { reason });
    return response.data;
  },

  /**
   * Get available appointment slots
   * @param {Object} params - date, providerId, type
   * @returns {Promise} Available slots
   */
  getAvailableSlots: async (params) => {
    const response = await api.get('/portal/available-slots', { params });
    return response.data;
  },

  /**
   * Get patient's prescriptions
   * @returns {Promise} Prescriptions list
   */
  getMyPrescriptions: async () => {
    const response = await api.get('/portal/prescriptions');
    return response.data;
  },

  /**
   * Get patient's bills/invoices
   * @returns {Promise} Bills and summary
   */
  getMyBills: async () => {
    const response = await api.get('/portal/bills');
    return response.data;
  },

  /**
   * Get patient's profile
   * @returns {Promise} Profile data
   */
  getMyProfile: async () => {
    const response = await api.get('/portal/profile');
    return response.data;
  },

  /**
   * Update patient's profile
   * @param {Object} profileData - Updated profile data
   * @returns {Promise} Updated profile
   */
  updateMyProfile: async (profileData) => {
    const response = await api.put('/portal/profile', profileData);
    return response.data;
  },

  /**
   * Get patient's medical results
   * @returns {Promise} Results list
   */
  getMyResults: async () => {
    const response = await api.get('/portal/results');
    return response.data;
  }
};

export default portalService;
