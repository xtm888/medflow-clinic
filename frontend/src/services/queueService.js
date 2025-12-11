import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

/**
 * Queue Service - Offline-First
 * Handles all queue management API calls with offline support
 * Queue operations work offline and sync when connection is restored
 */

export const queueService = {
  /**
   * Get next queue number for offline queue creation
   * @returns {Promise<number>} Next queue number
   */
  getNextQueueNumber: async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todaysQueue = await db.queue
        .where('checkInTime')
        .startsWith(today)
        .toArray();

      if (todaysQueue.length === 0) return 1;
      return Math.max(...todaysQueue.map(q => q.queueNumber || 0)) + 1;
    } catch (error) {
      console.warn('[QueueService] Error getting next queue number:', error);
      return Date.now() % 1000; // Fallback: use timestamp-based number
    }
  },

  /**
   * Get current queue with stats
   * @param {Object} filters - Optional filters (department, status, etc.)
   * @returns {Promise} Queue data with stats
   */
  getCurrentQueue: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    return offlineWrapper.get(
      () => api.get(`/queue?${params}`),
      'queue',
      filters,
      {
        transform: (response) => response.data,
        cacheExpiry: 60 // 1 minute cache for queue (real-time data)
      }
    );
  },

  /**
   * Check-in patient (add to queue) - WORKS OFFLINE
   * @param {Object} data - Check-in data
   * @returns {Promise} Queue entry with queue number
   */
  checkIn: async (data) => {
    // Generate local queue data for offline support
    const localData = {
      appointmentId: data.appointmentId,
      walkIn: data.walkIn,
      patientInfo: data.patientInfo,
      patient: data.patient || data.patientId,
      reason: data.reason,
      priority: data.priority || 'normal',
      queueNumber: data.queueNumber || await queueService.getNextQueueNumber(),
      status: 'checked-in',
      checkInTime: new Date().toISOString(),
    };

    return offlineWrapper.mutate(
      () => api.post('/queue', {
        appointmentId: data.appointmentId,
        walkIn: data.walkIn,
        patientInfo: data.patientInfo,
        reason: data.reason,
        priority: data.priority || 'normal'
      }),
      'CREATE',
      'queue',
      localData
    );
  },

  /**
   * Update queue status - WORKS OFFLINE
   * @param {string} id - Appointment/Queue ID
   * @param {string} status - New status
   * @param {string} roomNumber - Optional room number
   * @param {string} priority - Optional priority update
   * @returns {Promise} Updated queue entry
   */
  updateStatus: async (id, status, roomNumber = null, priority = null) => {
    const updateData = { status };
    if (roomNumber) updateData.roomNumber = roomNumber;
    if (priority) updateData.priority = priority.toLowerCase();

    // Add timestamps based on status
    if (status === 'called') {
      updateData.calledAt = new Date().toISOString();
    } else if (status === 'in-progress') {
      updateData.startedAt = new Date().toISOString();
    } else if (status === 'completed') {
      updateData.completedAt = new Date().toISOString();
    }

    return offlineWrapper.mutate(
      () => api.put(`/queue/${id}`, updateData),
      'UPDATE',
      'queue',
      updateData,
      id
    );
  },

  /**
   * Remove from queue - WORKS OFFLINE
   * @param {string} id - Appointment/Queue ID
   * @param {string} reason - Reason for removal
   * @returns {Promise} Confirmation
   */
  removeFromQueue: async (id, reason = '') => {
    return offlineWrapper.mutate(
      () => api.delete(`/queue/${id}`, { data: { reason } }),
      'DELETE',
      'queue',
      { reason },
      id
    );
  },

  /**
   * Call next patient - WORKS OFFLINE (uses local queue)
   * @param {string} department - Department (optional)
   * @param {string} doctorId - Doctor ID (optional)
   * @returns {Promise} Next patient in queue
   */
  callNext: async (department = null, doctorId = null) => {
    // If offline, find next from local cache
    if (!navigator.onLine) {
      try {
        const queue = await db.queue
          .where('status')
          .equals('checked-in')
          .toArray();

        const sorted = queue.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0));

        if (sorted.length === 0) {
          return { success: false, message: 'No patients waiting', _offline: true };
        }

        const next = sorted[0];
        // Update local status
        await queueService.updateStatus(next.id || next._id, 'called');

        return {
          success: true,
          data: { ...next, status: 'called', calledAt: new Date().toISOString() },
          _offline: true
        };
      } catch (error) {
        console.error('[QueueService] Offline callNext failed:', error);
        throw error;
      }
    }

    // Online: call API
    try {
      const response = await api.post('/queue/next', { department, doctorId });
      // Cache the result
      if (response.data?.data) {
        await offlineWrapper.cacheData('queue', response.data.data, response.data.data._id);
      }
      return response.data;
    } catch (error) {
      console.error('Error calling next patient:', error);
      throw error;
    }
  },

  /**
   * Get queue statistics - WORKS OFFLINE (computed from cache)
   * @returns {Promise} Queue stats
   */
  getStats: async () => {
    if (!navigator.onLine) {
      // Compute stats from local cache
      try {
        const today = new Date().toISOString().split('T')[0];
        const queue = await db.queue.toArray();
        const todaysQueue = queue.filter(q => q.checkInTime?.startsWith(today));

        return {
          success: true,
          data: {
            total: todaysQueue.length,
            waiting: todaysQueue.filter(q => q.status === 'checked-in' || q.status === 'waiting').length,
            inProgress: todaysQueue.filter(q => q.status === 'in-progress').length,
            completed: todaysQueue.filter(q => q.status === 'completed').length,
            noShow: todaysQueue.filter(q => q.status === 'no-show').length,
          },
          _fromCache: true
        };
      } catch (error) {
        console.error('[QueueService] Offline stats failed:', error);
        return { success: false, data: {}, _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/queue/stats'),
      'queue',
      'stats',
      {
        transform: (response) => response.data,
        cacheExpiry: 120 // 2 minutes
      }
    );
  },

  /**
   * Get queue analytics (admin/manager only)
   * @param {Object} params - Date range and other filters
   * @returns {Promise} Detailed analytics data
   */
  getAnalytics: async (params = {}) => {
    return offlineWrapper.get(
      () => api.get('/queue/analytics', { params }),
      'queue',
      { type: 'analytics', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 300 // 5 minutes for analytics
      }
    );
  },

  /**
   * Call specific patient by ID - WORKS OFFLINE
   * @param {string} id - Queue entry ID
   * @param {string} roomNumber - Room to direct patient to
   * @returns {Promise} Called patient data
   */
  callPatient: async (id, roomNumber = null) => {
    const updateData = {
      status: 'called',
      calledAt: new Date().toISOString(),
      roomNumber
    };

    return offlineWrapper.mutate(
      () => api.post(`/queue/${id}/call`, { roomNumber }),
      'UPDATE',
      'queue',
      updateData,
      id
    );
  },

  /**
   * Get display board data (public, rate-limited)
   * @returns {Promise} Privacy-safe queue display data
   */
  getDisplayBoardData: async () => {
    return offlineWrapper.get(
      () => api.get('/queue/display-board'),
      'queue',
      'display',
      {
        transform: (response) => response.data,
        cacheExpiry: 30 // 30 seconds for display board
      }
    );
  },

  /**
   * Pre-cache today's queue for offline use
   * Should be called on app startup when online
   */
  preCacheTodaysQueue: async () => {
    if (!navigator.onLine) {
      console.warn('[QueueService] Cannot pre-cache while offline');
      return { success: false };
    }

    try {
      const response = await api.get('/queue');
      const queue = response.data?.data || [];

      if (queue.length > 0) {
        const timestamp = new Date().toISOString();
        const queueWithSync = queue.map(item => ({
          ...item,
          id: item._id || item.id,
          lastSync: timestamp
        }));
        await db.queue.bulkPut(queueWithSync);
        console.log(`[QueueService] Pre-cached ${queue.length} queue items`);
      }

      return { success: true, cached: queue.length };
    } catch (error) {
      console.error('[QueueService] Pre-cache failed:', error);
      return { success: false, error: error.message };
    }
  }
};

export default queueService;
