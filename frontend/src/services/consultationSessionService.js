import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

/**
 * Consultation Session Service - Offline-First
 * Handles multi-step consultation workflow with offline support
 * Session state is preserved locally to survive network interruptions
 */
const consultationSessionService = {
  /**
   * Get recent sessions for logged-in doctor - WORKS OFFLINE
   * @param {number} limit - Number of sessions to return
   * @returns {Promise} Recent sessions list
   */
  async getRecentSessions(limit = 10) {
    return offlineWrapper.get(
      () => api.get('/consultation-sessions/recent', { params: { limit } }),
      'consultationSessions',
      { type: 'recent', limit },
      {
        transform: (response) => response.data,
        cacheExpiry: 600 // 10 minutes
      }
    );
  },

  /**
   * Get active session for patient - WORKS OFFLINE
   * Critical for resuming interrupted consultations
   * @param {string} patientId - Patient ID
   * @returns {Promise} Active session or null
   */
  async getActiveSession(patientId) {
    // First check local cache for active session (faster, works offline)
    if (!navigator.onLine) {
      try {
        const localSession = await db.consultationSessions
          .where('patientId')
          .equals(patientId)
          .and(session => session.status === 'active' || session.status === 'in_progress')
          .first();

        if (localSession) {
          return { data: localSession, _fromCache: true };
        }
      } catch (error) {
        console.warn('[ConsultationSession] Local lookup failed:', error);
      }
    }

    return offlineWrapper.get(
      () => api.get(`/consultation-sessions/active/${patientId}`),
      'consultationSessions',
      { type: 'active', patientId },
      {
        transform: (response) => response.data,
        cacheExpiry: 300 // 5 minutes
      }
    );
  },

  /**
   * Get session by ID - WORKS OFFLINE
   * @param {string} id - Session ID
   * @returns {Promise} Session data
   */
  async getSession(id) {
    return offlineWrapper.get(
      () => api.get(`/consultation-sessions/${id}`),
      'consultationSessions',
      id,
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Create new session - WORKS OFFLINE
   * @param {Object} sessionData - Session data
   * @returns {Promise} Created session
   */
  async createSession(sessionData) {
    const localData = {
      ...sessionData,
      _tempId: `temp_session_${Date.now()}`,
      status: 'active',
      step: 0,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post('/consultation-sessions', sessionData),
      'CREATE',
      'consultationSessions',
      localData
    );
  },

  /**
   * Update session (auto-save or manual) - WORKS OFFLINE
   * Session state is always saved locally first for reliability
   * @param {string} id - Session ID
   * @param {Object} sessionData - Session data to update
   * @param {boolean} isAutoSave - Whether this is an auto-save
   * @returns {Promise} Updated session
   */
  async updateSession(id, sessionData, isAutoSave = false) {
    const updateData = {
      ...sessionData,
      isAutoSave,
      lastModified: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/consultation-sessions/${id}`, { ...sessionData, isAutoSave }),
      'UPDATE',
      'consultationSessions',
      updateData,
      id
    );
  },

  /**
   * Complete session - WORKS OFFLINE
   * Completion is queued if offline and synced when online
   * @param {string} id - Session ID
   * @param {Object} sessionData - Final session data
   * @returns {Promise} Completed session
   */
  async completeSession(id, sessionData = {}) {
    const completeData = {
      ...sessionData,
      status: 'completed',
      completedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/consultation-sessions/${id}/complete`, sessionData),
      'UPDATE',
      'consultationSessions',
      completeData,
      id
    );
  },

  /**
   * Abandon session - WORKS OFFLINE
   * @param {string} id - Session ID
   * @returns {Promise} Abandoned session
   */
  async abandonSession(id) {
    return offlineWrapper.mutate(
      () => api.post(`/consultation-sessions/${id}/abandon`),
      'UPDATE',
      'consultationSessions',
      { status: 'abandoned', abandonedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Delete session - WORKS OFFLINE
   * @param {string} id - Session ID
   * @returns {Promise} Deletion result
   */
  async deleteSession(id) {
    return offlineWrapper.mutate(
      () => api.delete(`/consultation-sessions/${id}`),
      'DELETE',
      'consultationSessions',
      { deletedAt: new Date().toISOString() },
      id
    );
  },

  // ==========================================
  // OFFLINE HELPER METHODS
  // ==========================================

  /**
   * Save session state locally (for auto-save during typing)
   * This is synchronous-ish to handle rapid updates
   * @param {string} id - Session ID
   * @param {Object} sessionData - Session state
   * @returns {Promise}
   */
  async saveLocalState(id, sessionData) {
    try {
      const existingSession = await db.consultationSessions.get(id);
      const updatedSession = {
        ...existingSession,
        ...sessionData,
        id,
        lastModified: new Date().toISOString(),
        _localOnly: !navigator.onLine
      };
      await db.consultationSessions.put(updatedSession);
      return updatedSession;
    } catch (error) {
      console.error('[ConsultationSession] Local save failed:', error);
      throw error;
    }
  },

  /**
   * Get local session state (for recovery after page reload)
   * @param {string} id - Session ID
   * @returns {Promise} Local session state
   */
  async getLocalState(id) {
    try {
      return await db.consultationSessions.get(id);
    } catch (error) {
      console.error('[ConsultationSession] Local get failed:', error);
      return null;
    }
  },

  /**
   * Get all local sessions that need syncing
   * @returns {Promise<Array>} Sessions with pending changes
   */
  async getPendingSyncSessions() {
    try {
      return await db.consultationSessions
        .filter(session => session._pendingSync || session._localOnly)
        .toArray();
    } catch (error) {
      console.error('[ConsultationSession] Get pending failed:', error);
      return [];
    }
  },

  /**
   * Check if there's an active session for a patient (local check)
   * @param {string} patientId - Patient ID
   * @returns {Promise<boolean>}
   */
  async hasActiveLocalSession(patientId) {
    try {
      const session = await db.consultationSessions
        .where('patientId')
        .equals(patientId)
        .and(s => s.status === 'active' || s.status === 'in_progress')
        .first();
      return !!session;
    } catch (error) {
      return false;
    }
  }
};

export default consultationSessionService;
