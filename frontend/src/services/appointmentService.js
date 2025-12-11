import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

/**
 * Appointment Service - Offline-First
 * Handles all appointment API calls with offline support
 * Critical operations like check-in work offline
 */

const appointmentService = {
  /**
   * Get all appointments with filters - WORKS OFFLINE
   * @param {Object} params - Query parameters
   * @returns {Promise} Appointments list
   */
  async getAppointments(params = {}) {
    return offlineWrapper.get(
      () => api.get('/appointments', { params }),
      'appointments',
      params,
      {
        transform: (response) => response.data,
        cacheExpiry: 300 // 5 minutes for appointment list
      }
    );
  },

  /**
   * Get single appointment - WORKS OFFLINE
   * @param {string} id - Appointment ID
   * @returns {Promise} Appointment data
   */
  async getAppointment(id) {
    return offlineWrapper.get(
      () => api.get(`/appointments/${id}`),
      'appointments',
      id,
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Create new appointment - WORKS OFFLINE
   * @param {Object} appointmentData - Appointment data
   * @returns {Promise} Created appointment
   */
  async createAppointment(appointmentData) {
    const localData = {
      ...appointmentData,
      _tempId: `temp_${Date.now()}`,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post('/appointments', appointmentData),
      'CREATE',
      'appointments',
      localData
    );
  },

  /**
   * Update appointment - WORKS OFFLINE
   * @param {string} id - Appointment ID
   * @param {Object} appointmentData - Updated data
   * @returns {Promise} Updated appointment
   */
  async updateAppointment(id, appointmentData) {
    const updateData = {
      ...appointmentData,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/appointments/${id}`, appointmentData),
      'UPDATE',
      'appointments',
      updateData,
      id
    );
  },

  /**
   * Cancel appointment - WORKS OFFLINE
   * @param {string} id - Appointment ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise} Updated appointment
   */
  async cancelAppointment(id, reason) {
    const updateData = {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/appointments/${id}/cancel`, { reason }),
      'UPDATE',
      'appointments',
      updateData,
      id
    );
  },

  /**
   * Check in appointment - WORKS OFFLINE (CRITICAL)
   * This must work offline for clinic operations
   * @param {string} id - Appointment ID
   * @returns {Promise} Updated appointment
   */
  async checkInAppointment(id) {
    const updateData = {
      status: 'checked-in',
      checkInTime: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/appointments/${id}/checkin`),
      'UPDATE',
      'appointments',
      updateData,
      id
    );
  },

  /**
   * Complete appointment - WORKS OFFLINE
   * @param {string} id - Appointment ID
   * @param {Object} outcome - Completion outcome
   * @returns {Promise} Updated appointment
   */
  async completeAppointment(id, outcome) {
    const updateData = {
      status: 'completed',
      outcome,
      completedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/appointments/${id}/complete`, { outcome }),
      'UPDATE',
      'appointments',
      updateData,
      id
    );
  },

  /**
   * Get today's appointments - WORKS OFFLINE
   * @returns {Promise} Today's appointments
   */
  async getTodaysAppointments() {
    const today = new Date().toISOString().split('T')[0];

    // If offline, filter from local cache
    if (!navigator.onLine) {
      try {
        const appointments = await db.appointments
          .where('date')
          .startsWith(today)
          .toArray();

        return {
          success: true,
          data: appointments.sort((a, b) => new Date(a.time) - new Date(b.time)),
          _fromCache: true
        };
      } catch (error) {
        console.error('[AppointmentService] Offline today fetch failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/appointments/today'),
      'appointments',
      { type: 'today', date: today },
      {
        transform: (response) => response.data,
        cacheExpiry: 60 // 1 minute for today's appointments
      }
    );
  },

  /**
   * Get available time slots - ONLINE ONLY
   * Requires real-time availability check
   * @param {string} date - Date for slots
   * @param {string} provider - Provider ID
   * @param {number} duration - Duration in minutes
   * @returns {Promise} Available slots
   */
  async getAvailableSlots(date, provider, duration = 30) {
    if (!navigator.onLine) {
      throw new Error('Checking availability requires internet connection. Please try again when online.');
    }

    try {
      const response = await api.get('/appointments/available-slots', {
        params: { date, provider, duration }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching available slots:', error);
      throw error;
    }
  },

  /**
   * Reschedule appointment - WORKS OFFLINE
   * @param {string} id - Appointment ID
   * @param {Object} data - New schedule data
   * @returns {Promise} Updated appointment
   */
  async rescheduleAppointment(id, data) {
    const updateData = {
      ...data,
      status: 'rescheduled',
      rescheduledAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/appointments/${id}/reschedule`, data),
      'UPDATE',
      'appointments',
      updateData,
      id
    );
  },

  /**
   * Get appointments by provider - WORKS OFFLINE
   * @param {string} providerId - Provider ID
   * @param {Object} params - Query params
   * @returns {Promise} Provider's appointments
   */
  async getAppointmentsByProvider(providerId, params = {}) {
    // If offline, filter from local cache
    if (!navigator.onLine) {
      try {
        const appointments = await db.appointments
          .where('providerId')
          .equals(providerId)
          .toArray();

        return {
          success: true,
          data: appointments,
          _fromCache: true
        };
      } catch (error) {
        console.error('[AppointmentService] Offline provider fetch failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get(`/appointments/provider/${providerId}`, { params }),
      'appointments',
      { type: 'provider', providerId, ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  /**
   * Get appointments by patient - WORKS OFFLINE
   * @param {string} patientId - Patient ID
   * @param {Object} params - Query params
   * @returns {Promise} Patient's appointments
   */
  async getAppointmentsByPatient(patientId, params = {}) {
    // If offline, filter from local cache
    if (!navigator.onLine) {
      try {
        const appointments = await db.appointments
          .where('patientId')
          .equals(patientId)
          .toArray();

        return {
          success: true,
          data: appointments,
          _fromCache: true
        };
      } catch (error) {
        console.error('[AppointmentService] Offline patient fetch failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get(`/appointments/patient/${patientId}`, { params }),
      'appointments',
      { type: 'patient', patientId, ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  /**
   * Get upcoming appointments - WORKS OFFLINE
   * @param {number} days - Number of days ahead
   * @returns {Promise} Upcoming appointments
   */
  async getUpcomingAppointments(days = 7) {
    // If offline, calculate from local cache
    if (!navigator.onLine) {
      try {
        const now = new Date();
        const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        const appointments = await db.appointments.toArray();

        const upcoming = appointments.filter(apt => {
          const aptDate = new Date(apt.date);
          return aptDate >= now && aptDate <= endDate && apt.status !== 'cancelled';
        });

        return {
          success: true,
          data: upcoming.sort((a, b) => new Date(a.date) - new Date(b.date)),
          _fromCache: true
        };
      } catch (error) {
        console.error('[AppointmentService] Offline upcoming fetch failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/appointments/upcoming', { params: { days } }),
      'appointments',
      { type: 'upcoming', days },
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  /**
   * Get appointment statistics - WORKS OFFLINE (computed from cache)
   * @param {Object} params - Query params
   * @returns {Promise} Statistics
   */
  async getAppointmentStatistics(params = {}) {
    if (!navigator.onLine) {
      try {
        const appointments = await db.appointments.toArray();
        const stats = {
          total: appointments.length,
          scheduled: appointments.filter(a => a.status === 'scheduled').length,
          completed: appointments.filter(a => a.status === 'completed').length,
          cancelled: appointments.filter(a => a.status === 'cancelled').length,
          noShow: appointments.filter(a => a.status === 'no-show').length,
          _computed: true
        };

        return { success: true, data: stats, _fromCache: true };
      } catch (error) {
        console.error('[AppointmentService] Offline stats failed:', error);
        return { success: false, data: {}, _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/appointments/statistics', { params }),
      'appointments',
      { type: 'statistics', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Send appointment reminder - ONLINE ONLY
   * @param {string} id - Appointment ID
   * @param {string} method - Reminder method (email/sms)
   * @returns {Promise} Send result
   */
  async sendReminder(id, method = 'email') {
    if (!navigator.onLine) {
      throw new Error('Sending reminders requires internet connection.');
    }

    try {
      const response = await api.post(`/appointments/${id}/reminder`, { method });
      return response.data;
    } catch (error) {
      console.error('Error sending appointment reminder:', error);
      throw error;
    }
  },

  /**
   * Add note to appointment - WORKS OFFLINE
   * @param {string} id - Appointment ID
   * @param {Object} noteData - Note data
   * @returns {Promise} Added note
   */
  async addNote(id, noteData) {
    const localData = {
      ...noteData,
      appointmentId: id,
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/appointments/${id}/notes`, noteData),
      'CREATE',
      'appointments',
      localData,
      id
    );
  },

  /**
   * Get appointment notes - WORKS OFFLINE
   * @param {string} id - Appointment ID
   * @returns {Promise} Notes
   */
  async getNotes(id) {
    return offlineWrapper.get(
      () => api.get(`/appointments/${id}/notes`),
      'appointments',
      { type: 'notes', appointmentId: id },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Mark appointment as no-show - WORKS OFFLINE
   * @param {string} id - Appointment ID
   * @returns {Promise} Updated appointment
   */
  async markNoShow(id) {
    const updateData = {
      status: 'no-show',
      noShowAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/appointments/${id}/no-show`),
      'UPDATE',
      'appointments',
      updateData,
      id
    );
  },

  /**
   * Get waiting list - WORKS OFFLINE
   * @param {Object} params - Query params
   * @returns {Promise} Waiting list
   */
  async getWaitingList(params = {}) {
    return offlineWrapper.get(
      () => api.get('/appointments/waiting-list', { params }),
      'appointments',
      { type: 'waitingList', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  /**
   * Add to waiting list - WORKS OFFLINE
   * @param {Object} data - Waiting list entry data
   * @returns {Promise} Added entry
   */
  async addToWaitingList(data) {
    const localData = {
      ...data,
      _tempId: `temp_${Date.now()}`,
      addedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post('/appointments/waiting-list', data),
      'CREATE',
      'appointments',
      localData
    );
  },

  /**
   * Get appointment types - WORKS OFFLINE
   * @returns {Promise} Appointment types
   */
  async getAppointmentTypes() {
    return offlineWrapper.get(
      () => api.get('/appointments/types'),
      'appointments',
      'types',
      {
        transform: (response) => response.data,
        cacheExpiry: 86400 // 24 hours for reference data
      }
    );
  },

  /**
   * Check for conflicts - ONLINE ONLY
   * @param {Object} data - Appointment data to check
   * @returns {Promise} Conflict check result
   */
  async checkConflicts(data) {
    if (!navigator.onLine) {
      // Basic offline conflict check
      try {
        const appointments = await db.appointments.toArray();
        const conflicts = appointments.filter(apt =>
          apt.providerId === data.providerId &&
          apt.date === data.date &&
          apt.status !== 'cancelled' &&
          apt._id !== data._id
        );

        return {
          success: true,
          data: { hasConflicts: conflicts.length > 0, conflicts },
          _fromCache: true,
          _limitedCheck: true
        };
      } catch (error) {
        console.error('[AppointmentService] Offline conflict check failed:', error);
        return { success: false, data: { hasConflicts: false, conflicts: [] }, _fromCache: true };
      }
    }

    try {
      const response = await api.post('/appointments/check-conflicts', data);
      return response.data;
    } catch (error) {
      console.error('Error checking appointment conflicts:', error);
      throw error;
    }
  },

  /**
   * Bulk update appointments - ONLINE ONLY
   * @param {Array} ids - Appointment IDs
   * @param {Object} updateData - Update data
   * @returns {Promise} Update result
   */
  async bulkUpdate(ids, updateData) {
    if (!navigator.onLine) {
      throw new Error('Bulk update requires internet connection.');
    }

    try {
      const response = await api.put('/appointments/bulk-update', {
        ids,
        ...updateData
      });
      return response.data;
    } catch (error) {
      console.error('Error bulk updating appointments:', error);
      throw error;
    }
  },

  /**
   * Get calendar view - WORKS OFFLINE
   * @param {string} start - Start date
   * @param {string} end - End date
   * @param {string} providerId - Optional provider filter
   * @returns {Promise} Calendar data
   */
  async getCalendarView(start, end, providerId = null) {
    // If offline, filter from local cache
    if (!navigator.onLine) {
      try {
        let appointments = await db.appointments.toArray();

        appointments = appointments.filter(apt => {
          const aptDate = new Date(apt.date);
          return aptDate >= new Date(start) && aptDate <= new Date(end);
        });

        if (providerId) {
          appointments = appointments.filter(apt => apt.providerId === providerId);
        }

        return {
          success: true,
          data: appointments,
          _fromCache: true
        };
      } catch (error) {
        console.error('[AppointmentService] Offline calendar fetch failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/appointments/calendar', { params: { start, end, providerId } }),
      'appointments',
      { type: 'calendar', start, end, providerId },
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  /**
   * Get queue status - WORKS OFFLINE
   * @returns {Promise} Queue status
   */
  async getQueueStatus() {
    return offlineWrapper.get(
      () => api.get('/appointments/queue'),
      'queue',
      'status',
      {
        transform: (response) => response.data,
        cacheExpiry: 60
      }
    );
  },

  /**
   * Update queue position - WORKS OFFLINE
   * @param {string} id - Appointment ID
   * @param {number} position - New position
   * @returns {Promise} Updated appointment
   */
  async updateQueuePosition(id, position) {
    const updateData = {
      queuePosition: position,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/appointments/${id}/queue-position`, { position }),
      'UPDATE',
      'appointments',
      updateData,
      id
    );
  },

  /**
   * Get recurring appointment series - WORKS OFFLINE
   * @param {string} seriesId - Series ID
   * @returns {Promise} Series data
   */
  async getRecurringSeries(seriesId) {
    return offlineWrapper.get(
      () => api.get(`/appointments/series/${seriesId}`),
      'appointments',
      { type: 'series', seriesId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Create recurring appointments - ONLINE ONLY
   * Complex operation requiring server-side generation
   * @param {Object} appointmentData - Appointment data
   * @param {Object} recurrencePattern - Recurrence pattern
   * @returns {Promise} Created appointments
   */
  async createRecurring(appointmentData, recurrencePattern) {
    if (!navigator.onLine) {
      throw new Error('Creating recurring appointments requires internet connection.');
    }

    try {
      const response = await api.post('/appointments/recurring', {
        ...appointmentData,
        recurrence: recurrencePattern
      });
      return response.data;
    } catch (error) {
      console.error('Error creating recurring appointments:', error);
      throw error;
    }
  },

  // ==========================================
  // OFFLINE HELPER METHODS
  // ==========================================

  /**
   * Pre-cache appointments for offline use
   * @param {Object} params - Cache params (days ahead, etc.)
   * @returns {Promise} Cache result
   */
  async preCacheAppointments(params = { days: 7 }) {
    if (!navigator.onLine) {
      console.warn('[AppointmentService] Cannot pre-cache while offline');
      return { success: false };
    }

    try {
      console.log('[AppointmentService] Pre-caching appointments...');

      // Get upcoming appointments
      const response = await api.get('/appointments/upcoming', { params });
      const appointments = response.data?.data || [];

      if (appointments.length > 0) {
        const timestamp = new Date().toISOString();
        const appointmentsWithSync = appointments.map(apt => ({
          ...apt,
          id: apt._id || apt.id,
          lastSync: timestamp
        }));

        await db.appointments.bulkPut(appointmentsWithSync);
        console.log(`[AppointmentService] Pre-cached ${appointments.length} appointments`);
      }

      return { success: true, cached: appointments.length };
    } catch (error) {
      console.error('[AppointmentService] Pre-cache failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get cached appointment count
   * @returns {Promise<number>} Count
   */
  async getCachedAppointmentCount() {
    return db.appointments.count();
  },

  /**
   * Clear appointment cache
   * @returns {Promise} Result
   */
  async clearAppointmentCache() {
    return db.appointments.clear();
  },

  /**
   * Get list of providers (doctors/ophthalmologists)
   * Accessible to all staff roles
   * @returns {Promise} List of providers
   */
  async getProviders() {
    try {
      const response = await api.get('/appointments/providers');
      return response.data;
    } catch (error) {
      console.error('Error fetching providers:', error);
      throw error;
    }
  }
};

export default appointmentService;
