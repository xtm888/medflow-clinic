import api from './apiConfig';

const consultationSessionService = {
  // Get recent sessions for logged-in doctor
  async getRecentSessions(limit = 10) {
    try {
      const response = await api.get('/consultation-sessions/recent', { params: { limit } });
      return response.data;
    } catch (error) {
      console.error('Error fetching recent sessions:', error);
      throw error;
    }
  },

  // Get active session for patient
  async getActiveSession(patientId) {
    try {
      const response = await api.get(`/consultation-sessions/active/${patientId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching active session:', error);
      throw error;
    }
  },

  // Get session by ID
  async getSession(id) {
    try {
      const response = await api.get(`/consultation-sessions/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching session:', error);
      throw error;
    }
  },

  // Create new session
  async createSession(sessionData) {
    try {
      const response = await api.post('/consultation-sessions', sessionData);
      return response.data;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  },

  // Update session (auto-save or manual)
  async updateSession(id, sessionData, isAutoSave = false) {
    try {
      const response = await api.put(`/consultation-sessions/${id}`, {
        ...sessionData,
        isAutoSave
      });
      return response.data;
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  },

  // Complete session
  async completeSession(id) {
    try {
      const response = await api.post(`/consultation-sessions/${id}/complete`);
      return response.data;
    } catch (error) {
      console.error('Error completing session:', error);
      throw error;
    }
  },

  // Abandon session
  async abandonSession(id) {
    try {
      const response = await api.post(`/consultation-sessions/${id}/abandon`);
      return response.data;
    } catch (error) {
      console.error('Error abandoning session:', error);
      throw error;
    }
  },

  // Delete session
  async deleteSession(id) {
    try {
      const response = await api.delete(`/consultation-sessions/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }
};

export default consultationSessionService;
