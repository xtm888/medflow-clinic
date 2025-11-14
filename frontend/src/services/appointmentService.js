import api from './apiConfig';

const appointmentService = {
  // Get all appointments with filters
  async getAppointments(params = {}) {
    try {
      const response = await api.get('/appointments', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching appointments:', error);
      throw error;
    }
  },

  // Get single appointment
  async getAppointment(id) {
    try {
      const response = await api.get(`/appointments/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching appointment:', error);
      throw error;
    }
  },

  // Create new appointment
  async createAppointment(appointmentData) {
    try {
      const response = await api.post('/appointments', appointmentData);
      return response.data;
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  },

  // Update appointment
  async updateAppointment(id, appointmentData) {
    try {
      const response = await api.put(`/appointments/${id}`, appointmentData);
      return response.data;
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  },

  // Cancel appointment
  async cancelAppointment(id, reason) {
    try {
      const response = await api.put(`/appointments/${id}/cancel`, { reason });
      return response.data;
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      throw error;
    }
  },

  // Check in appointment
  async checkInAppointment(id) {
    try {
      const response = await api.put(`/appointments/${id}/checkin`);
      return response.data;
    } catch (error) {
      console.error('Error checking in appointment:', error);
      throw error;
    }
  },

  // Complete appointment
  async completeAppointment(id, outcome) {
    try {
      const response = await api.put(`/appointments/${id}/complete`, { outcome });
      return response.data;
    } catch (error) {
      console.error('Error completing appointment:', error);
      throw error;
    }
  },

  // Get today's appointments
  async getTodaysAppointments() {
    try {
      const response = await api.get('/appointments/today');
      return response.data;
    } catch (error) {
      console.error('Error fetching today\'s appointments:', error);
      throw error;
    }
  },

  // Get available time slots
  async getAvailableSlots(date, provider, duration = 30) {
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

  // Reschedule appointment
  async rescheduleAppointment(id, data) {
    try {
      const response = await api.put(`/appointments/${id}/reschedule`, data);
      return response.data;
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      throw error;
    }
  },

  // Additional comprehensive appointment methods

  // Get appointments by provider
  async getAppointmentsByProvider(providerId, params = {}) {
    try {
      const response = await api.get(`/appointments/provider/${providerId}`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching provider appointments:', error);
      throw error;
    }
  },

  // Get appointments by patient
  async getAppointmentsByPatient(patientId, params = {}) {
    try {
      const response = await api.get(`/appointments/patient/${patientId}`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching patient appointments:', error);
      throw error;
    }
  },

  // Get upcoming appointments
  async getUpcomingAppointments(days = 7) {
    try {
      const response = await api.get('/appointments/upcoming', {
        params: { days }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching upcoming appointments:', error);
      throw error;
    }
  },

  // Get appointment statistics
  async getAppointmentStatistics(params = {}) {
    try {
      const response = await api.get('/appointments/statistics', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching appointment statistics:', error);
      throw error;
    }
  },

  // Send appointment reminder
  async sendReminder(id, method = 'email') {
    try {
      const response = await api.post(`/appointments/${id}/reminder`, { method });
      return response.data;
    } catch (error) {
      console.error('Error sending appointment reminder:', error);
      throw error;
    }
  },

  // Add note to appointment
  async addNote(id, noteData) {
    try {
      const response = await api.post(`/appointments/${id}/notes`, noteData);
      return response.data;
    } catch (error) {
      console.error('Error adding note to appointment:', error);
      throw error;
    }
  },

  // Get appointment notes
  async getNotes(id) {
    try {
      const response = await api.get(`/appointments/${id}/notes`);
      return response.data;
    } catch (error) {
      console.error('Error fetching appointment notes:', error);
      throw error;
    }
  },

  // Mark appointment as no-show
  async markNoShow(id) {
    try {
      const response = await api.put(`/appointments/${id}/no-show`);
      return response.data;
    } catch (error) {
      console.error('Error marking appointment as no-show:', error);
      throw error;
    }
  },

  // Get waiting list
  async getWaitingList(params = {}) {
    try {
      const response = await api.get('/appointments/waiting-list', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching waiting list:', error);
      throw error;
    }
  },

  // Add to waiting list
  async addToWaitingList(data) {
    try {
      const response = await api.post('/appointments/waiting-list', data);
      return response.data;
    } catch (error) {
      console.error('Error adding to waiting list:', error);
      throw error;
    }
  },

  // Get appointment types
  async getAppointmentTypes() {
    try {
      const response = await api.get('/appointments/types');
      return response.data;
    } catch (error) {
      console.error('Error fetching appointment types:', error);
      throw error;
    }
  },

  // Check for conflicts
  async checkConflicts(data) {
    try {
      const response = await api.post('/appointments/check-conflicts', data);
      return response.data;
    } catch (error) {
      console.error('Error checking appointment conflicts:', error);
      throw error;
    }
  },

  // Bulk update appointments
  async bulkUpdate(ids, updateData) {
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

  // Get calendar view
  async getCalendarView(start, end, providerId = null) {
    try {
      const response = await api.get('/appointments/calendar', {
        params: { start, end, providerId }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching calendar view:', error);
      throw error;
    }
  },

  // Get queue status
  async getQueueStatus() {
    try {
      const response = await api.get('/appointments/queue');
      return response.data;
    } catch (error) {
      console.error('Error fetching queue status:', error);
      throw error;
    }
  },

  // Update queue position
  async updateQueuePosition(id, position) {
    try {
      const response = await api.put(`/appointments/${id}/queue-position`, { position });
      return response.data;
    } catch (error) {
      console.error('Error updating queue position:', error);
      throw error;
    }
  },

  // Get recurring appointment series
  async getRecurringSeries(seriesId) {
    try {
      const response = await api.get(`/appointments/series/${seriesId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching recurring series:', error);
      throw error;
    }
  },

  // Create recurring appointments
  async createRecurring(appointmentData, recurrencePattern) {
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
  }
};

export default appointmentService;