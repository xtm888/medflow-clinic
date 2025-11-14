import api from './apiConfig';

/**
 * Queue Service
 * Handles all queue management API calls
 */

export const queueService = {
  /**
   * Get current queue with stats
   * @param {Object} filters - Optional filters (department, status, etc.)
   * @returns {Promise} Queue data with stats
   */
  getCurrentQueue: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await api.get(`/queue?${params}`);
    return response.data;
  },

  /**
   * Check-in patient (add to queue)
   * @param {Object} data - Check-in data
   * @param {string} data.appointmentId - Appointment ID
   * @param {string} data.priority - Priority level (NORMAL, VIP, PREGNANT, ELDERLY, URGENT)
   * @returns {Promise} Queue entry with queue number
   */
  checkIn: async (data) => {
    const response = await api.post('/queue', {
      appointmentId: data.appointmentId,
      priority: data.priority || 'NORMAL'
    });
    return response.data;
  },

  /**
   * Update queue status
   * @param {string} id - Appointment/Queue ID
   * @param {string} status - New status (checked-in, in-progress, completed)
   * @param {string} roomNumber - Optional room number
   * @returns {Promise} Updated queue entry
   */
  updateStatus: async (id, status, roomNumber = null) => {
    const response = await api.put(`/queue/${id}`, {
      status,
      roomNumber
    });
    return response.data;
  },

  /**
   * Remove from queue
   * @param {string} id - Appointment/Queue ID
   * @param {string} reason - Reason for removal
   * @returns {Promise} Confirmation
   */
  removeFromQueue: async (id, reason = '') => {
    const response = await api.delete(`/queue/${id}`, {
      data: { reason }
    });
    return response.data;
  },

  /**
   * Call next patient
   * @param {string} department - Department (optional)
   * @param {string} doctorId - Doctor ID (optional)
   * @returns {Promise} Next patient in queue
   */
  callNext: async (department = null, doctorId = null) => {
    const response = await api.post('/queue/next', {
      department,
      doctorId
    });
    return response.data;
  },

  /**
   * Get queue statistics
   * @returns {Promise} Queue stats (waiting, in-progress, avg wait time, etc.)
   */
  getStats: async () => {
    const response = await api.get('/queue/stats');
    return response.data;
  }
};

export default queueService;
