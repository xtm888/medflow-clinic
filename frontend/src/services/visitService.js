import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

/**
 * Visit Service - Offline-First
 * Handles all visit API calls with offline support
 * Visits are critical for clinical workflow continuity
 */
const visitService = {
  /**
   * Get all visits with filters - WORKS OFFLINE
   * @param {Object} params - Query parameters (page, limit, etc.)
   * @returns {Promise} Visits list with pagination
   */
  async getVisits(params = {}) {
    return offlineWrapper.get(
      () => api.get('/visits', { params }),
      'visits',
      params,
      {
        transform: (response) => response.data,
        cacheExpiry: 1800 // 30 minutes
      }
    );
  },

  /**
   * Get single visit - WORKS OFFLINE
   * @param {string} id - Visit ID
   * @returns {Promise} Visit data
   */
  async getVisit(id) {
    return offlineWrapper.get(
      () => api.get(`/visits/${id}`),
      'visits',
      id,
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Create new visit - WORKS OFFLINE
   * @param {Object} visitData - Visit data
   * @returns {Promise} Created visit
   */
  async createVisit(visitData) {
    const localData = {
      ...visitData,
      _tempId: `temp_${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: visitData.status || 'scheduled'
    };

    return offlineWrapper.mutate(
      () => api.post('/visits', visitData),
      'CREATE',
      'visits',
      localData
    );
  },

  /**
   * Update visit - WORKS OFFLINE
   * @param {string} id - Visit ID
   * @param {Object} visitData - Updated visit data
   * @returns {Promise} Updated visit
   */
  async updateVisit(id, visitData) {
    const updateData = {
      ...visitData,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/visits/${id}`, visitData),
      'UPDATE',
      'visits',
      updateData,
      id
    );
  },

  /**
   * Start visit - WORKS OFFLINE
   * @param {string} id - Visit ID
   * @returns {Promise} Updated visit
   */
  async startVisit(id) {
    return offlineWrapper.mutate(
      () => api.put(`/visits/${id}/start`),
      'UPDATE',
      'visits',
      { status: 'in_progress', startedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Complete visit - WORKS OFFLINE
   * @param {string} id - Visit ID
   * @returns {Promise} Updated visit
   */
  async completeVisit(id) {
    return offlineWrapper.mutate(
      () => api.put(`/visits/${id}/complete`),
      'UPDATE',
      'visits',
      { status: 'completed', completedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Sign visit (doctor signature) - ONLINE PREFERRED
   * Digital signatures should sync immediately when possible
   * @param {string} id - Visit ID
   * @returns {Promise} Updated visit
   */
  async signVisit(id) {
    return offlineWrapper.mutate(
      () => api.put(`/visits/${id}/sign`),
      'UPDATE',
      'visits',
      { signatureStatus: 'signed', signedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Lock visit (no further edits) - ONLINE ONLY
   * Locking is a critical operation that must be server-validated
   * @param {string} id - Visit ID
   * @returns {Promise} Updated visit
   */
  async lockVisit(id) {
    if (!navigator.onLine) {
      throw new Error('Locking a visit requires internet connection for security reasons.');
    }
    try {
      const response = await api.put(`/visits/${id}/lock`);
      return response.data;
    } catch (error) {
      console.error('Error locking visit:', error);
      throw error;
    }
  },

  /**
   * Get unsigned visits for current user - WORKS OFFLINE
   * @returns {Promise} Unsigned visits list
   */
  async getUnsignedVisits() {
    return offlineWrapper.get(
      () => api.get('/visits', { params: { signatureStatus: 'unsigned' } }),
      'visits',
      { signatureStatus: 'unsigned' },
      {
        transform: (response) => response.data,
        cacheExpiry: 600 // 10 minutes
      }
    );
  },

  /**
   * Cancel visit - WORKS OFFLINE
   * @param {string} id - Visit ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise} Updated visit
   */
  async cancelVisit(id, reason) {
    return offlineWrapper.mutate(
      () => api.put(`/visits/${id}/cancel`, { reason }),
      'UPDATE',
      'visits',
      { status: 'cancelled', cancelReason: reason, cancelledAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Add act to visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} actData - Act data
   * @returns {Promise} Updated visit
   */
  async addAct(visitId, actData) {
    const localData = {
      ...actData,
      visitId,
      _tempId: `temp_act_${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/acts`, actData),
      'UPDATE',
      'visits',
      localData,
      visitId
    );
  },

  /**
   * Add clinical act with automatic fee schedule lookup - WORKS OFFLINE
   * Price lookup happens online; falls back to provided price offline
   * @param {string} visitId - Visit ID
   * @param {Object} actParams - Act parameters
   * @returns {Promise} Updated visit
   */
  async addClinicalAct(visitId, { actCode, actType, actName, providerId, notes, price }) {
    // If online and no price provided, try to get from fee schedule
    let finalPrice = price;
    if (!finalPrice && actCode && navigator.onLine) {
      try {
        const feeResponse = await api.get(`/billing/fee-schedule/effective-price/${actCode}`);
        if (feeResponse.data?.data?.price) {
          finalPrice = feeResponse.data.data.price;
        }
      } catch (feeError) {
        console.warn('Could not fetch fee schedule, using provided price or 0:', feeError);
        finalPrice = 0;
      }
    }

    const actData = {
      actType: actType || 'examination',
      actCode: actCode,
      actName: actName,
      provider: providerId,
      price: finalPrice || 0,
      status: 'completed',
      startTime: new Date(),
      endTime: new Date(),
      notes: notes || '',
      _tempId: `temp_act_${Date.now()}`
    };

    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/acts`, actData),
      'UPDATE',
      'visits',
      actData,
      visitId
    );
  },

  /**
   * Update act - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {string} actId - Act ID
   * @param {Object} actData - Updated act data
   * @returns {Promise} Updated act
   */
  async updateAct(visitId, actId, actData) {
    return offlineWrapper.mutate(
      () => api.put(`/visits/${visitId}/acts/${actId}`, actData),
      'UPDATE',
      'visits',
      { ...actData, updatedAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Remove act - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {string} actId - Act ID
   * @returns {Promise} Updated visit
   */
  async removeAct(visitId, actId) {
    return offlineWrapper.mutate(
      () => api.delete(`/visits/${visitId}/acts/${actId}`),
      'UPDATE',
      'visits',
      { actId, _removed: true },
      visitId
    );
  },

  /**
   * Complete act - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {string} actId - Act ID
   * @returns {Promise} Updated act
   */
  async completeAct(visitId, actId) {
    return offlineWrapper.mutate(
      () => api.put(`/visits/${visitId}/acts/${actId}/complete`),
      'UPDATE',
      'visits',
      { actId, status: 'completed', completedAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit acts - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit acts
   */
  async getVisitActs(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/acts`),
      'visits',
      { type: 'acts', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Get visits by patient - WORKS OFFLINE
   * @param {string} patientId - Patient ID
   * @param {Object} params - Query parameters
   * @returns {Promise} Patient visits
   */
  async getPatientVisits(patientId, params = {}) {
    return offlineWrapper.get(
      () => api.get(`/patients/${patientId}/visits`, { params }),
      'visits',
      { patientId, ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Get visits by provider - WORKS OFFLINE
   * @param {string} providerId - Provider ID
   * @param {Object} params - Query parameters
   * @returns {Promise} Provider visits
   */
  async getProviderVisits(providerId, params = {}) {
    return offlineWrapper.get(
      () => api.get(`/providers/${providerId}/visits`, { params }),
      'visits',
      { providerId, ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Get today's visits - WORKS OFFLINE (critical for queue)
   * @returns {Promise} Today's visits
   */
  async getTodaysVisits() {
    return offlineWrapper.get(
      () => api.get('/visits/today'),
      'visits',
      { type: 'today', date: new Date().toISOString().split('T')[0] },
      {
        transform: (response) => response.data,
        cacheExpiry: 300 // 5 minutes - refresh more frequently
      }
    );
  },

  /**
   * Get active visits - WORKS OFFLINE
   * @returns {Promise} Active visits
   */
  async getActiveVisits() {
    return offlineWrapper.get(
      () => api.get('/visits/active'),
      'visits',
      { status: 'in_progress' },
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  /**
   * Add vital signs to visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} vitalSignsData - Vital signs data
   * @returns {Promise} Updated visit
   */
  async addVitalSigns(visitId, vitalSignsData) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/vital-signs`, vitalSignsData),
      'UPDATE',
      'visits',
      { vitalSigns: vitalSignsData, updatedAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit vital signs - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Vital signs
   */
  async getVitalSigns(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/vital-signs`),
      'visits',
      { type: 'vitalSigns', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Add clinical note - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} noteData - Note data
   * @returns {Promise} Updated visit
   */
  async addClinicalNote(visitId, noteData) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/notes`, noteData),
      'UPDATE',
      'visits',
      { ...noteData, _tempId: `temp_note_${Date.now()}`, createdAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit notes - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit notes
   */
  async getVisitNotes(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/notes`),
      'visits',
      { type: 'notes', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Add diagnosis to visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} diagnosisData - Diagnosis data
   * @returns {Promise} Updated visit
   */
  async addDiagnosis(visitId, diagnosisData) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/diagnoses`, diagnosisData),
      'UPDATE',
      'visits',
      { ...diagnosisData, _tempId: `temp_dx_${Date.now()}`, createdAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit diagnoses - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit diagnoses
   */
  async getVisitDiagnoses(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/diagnoses`),
      'visits',
      { type: 'diagnoses', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Add prescription to visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} prescriptionData - Prescription data
   * @returns {Promise} Updated visit
   */
  async addPrescription(visitId, prescriptionData) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/prescriptions`, prescriptionData),
      'UPDATE',
      'visits',
      { ...prescriptionData, _tempId: `temp_rx_${Date.now()}`, createdAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit prescriptions - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit prescriptions
   */
  async getVisitPrescriptions(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/prescriptions`),
      'visits',
      { type: 'prescriptions', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Add lab order to visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} labOrderData - Lab order data
   * @returns {Promise} Updated visit
   */
  async addLabOrder(visitId, labOrderData) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/lab-orders`, labOrderData),
      'UPDATE',
      'visits',
      { ...labOrderData, _tempId: `temp_lab_${Date.now()}`, createdAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit lab orders - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit lab orders
   */
  async getVisitLabOrders(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/lab-orders`),
      'visits',
      { type: 'labOrders', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Add imaging order to visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} imagingOrderData - Imaging order data
   * @returns {Promise} Updated visit
   */
  async addImagingOrder(visitId, imagingOrderData) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/imaging-orders`, imagingOrderData),
      'UPDATE',
      'visits',
      { ...imagingOrderData, _tempId: `temp_img_${Date.now()}`, createdAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit imaging orders - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit imaging orders
   */
  async getVisitImagingOrders(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/imaging-orders`),
      'visits',
      { type: 'imagingOrders', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Add procedure to visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} procedureData - Procedure data
   * @returns {Promise} Updated visit
   */
  async addProcedure(visitId, procedureData) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/procedures`, procedureData),
      'UPDATE',
      'visits',
      { ...procedureData, _tempId: `temp_proc_${Date.now()}`, createdAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit procedures - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit procedures
   */
  async getVisitProcedures(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/procedures`),
      'visits',
      { type: 'procedures', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Generate visit summary - ONLINE ONLY (requires server-side PDF generation)
   * @param {string} visitId - Visit ID
   * @param {string} format - Export format (pdf, json)
   * @returns {Promise} Visit summary
   */
  async generateVisitSummary(visitId, format = 'pdf') {
    if (!navigator.onLine) {
      throw new Error('Generating visit summary requires internet connection.');
    }
    try {
      const response = await api.get(`/visits/${visitId}/summary`, {
        params: { format },
        responseType: format === 'pdf' ? 'blob' : 'json'
      });
      return response.data;
    } catch (error) {
      console.error('Error generating visit summary:', error);
      throw error;
    }
  },

  /**
   * Clone visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Cloned visit
   */
  async cloneVisit(visitId) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/clone`),
      'CREATE',
      'visits',
      { sourceVisitId: visitId, _tempId: `temp_clone_${Date.now()}`, createdAt: new Date().toISOString() }
    );
  },

  /**
   * Get visit billing - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit billing
   */
  async getVisitBilling(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/billing`),
      'invoices',
      { visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Update visit billing - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} billingData - Billing data
   * @returns {Promise} Updated billing
   */
  async updateVisitBilling(visitId, billingData) {
    return offlineWrapper.mutate(
      () => api.put(`/visits/${visitId}/billing`, billingData),
      'UPDATE',
      'invoices',
      { ...billingData, visitId, updatedAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit documents - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit documents
   */
  async getVisitDocuments(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/documents`),
      'files',
      { visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Add document to visit - ONLINE ONLY (file uploads require connectivity)
   * @param {string} visitId - Visit ID
   * @param {Object} documentData - Document data
   * @returns {Promise} Added document
   */
  async addDocument(visitId, documentData) {
    if (!navigator.onLine) {
      throw new Error('Document upload requires internet connection.');
    }
    try {
      const response = await api.post(`/visits/${visitId}/documents`, documentData);
      return response.data;
    } catch (error) {
      console.error('Error adding document to visit:', error);
      throw error;
    }
  },

  /**
   * Get visit timeline - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit timeline
   */
  async getVisitTimeline(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/timeline`),
      'visits',
      { type: 'timeline', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Link visit to appointment - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {string} appointmentId - Appointment ID
   * @returns {Promise} Updated visit
   */
  async linkToAppointment(visitId, appointmentId) {
    return offlineWrapper.mutate(
      () => api.put(`/visits/${visitId}/link-appointment`, { appointmentId }),
      'UPDATE',
      'visits',
      { appointmentId, updatedAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get follow-up visits - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Follow-up visits
   */
  async getFollowUpVisits(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/follow-ups`),
      'visits',
      { type: 'followUps', parentVisitId: visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Schedule follow-up visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} followUpData - Follow-up data
   * @returns {Promise} Created follow-up visit
   */
  async scheduleFollowUp(visitId, followUpData) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/follow-up`, followUpData),
      'CREATE',
      'visits',
      { ...followUpData, parentVisitId: visitId, _tempId: `temp_fu_${Date.now()}`, createdAt: new Date().toISOString() }
    );
  },

  /**
   * Get visit statistics - ONLINE PREFERRED (aggregations are expensive to cache)
   * @param {Object} params - Query parameters
   * @returns {Promise} Visit statistics
   */
  async getVisitStatistics(params = {}) {
    return offlineWrapper.get(
      () => api.get('/visits/statistics', { params }),
      'visits',
      { type: 'statistics', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600 // Cache for 1 hour since stats don't change often
      }
    );
  },

  /**
   * Apply visit template - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {string} templateId - Template ID
   * @returns {Promise} Updated visit
   */
  async applyTemplate(visitId, templateId) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/apply-template`, { templateId }),
      'UPDATE',
      'visits',
      { templateId, _templateApplied: true, updatedAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get available visit templates - WORKS OFFLINE
   * @param {string} visitType - Visit type
   * @returns {Promise} Available templates
   */
  async getVisitTemplates(visitType) {
    return offlineWrapper.get(
      () => api.get('/visits/templates', { params: { visitType } }),
      'visits',
      { type: 'templates', visitType },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600 // Templates don't change often
      }
    );
  },

  // ==========================================
  // OFFLINE HELPER METHODS
  // ==========================================

  /**
   * Pre-cache today's visits for offline use
   * @returns {Promise} Cache result
   */
  async preCacheTodaysVisits() {
    if (!navigator.onLine) {
      console.warn('[VisitService] Cannot pre-cache while offline');
      return { success: false };
    }

    try {
      console.log('[VisitService] Pre-caching today\'s visits...');
      const response = await api.get('/visits/today');
      const visits = response.data?.data || response.data || [];

      if (visits.length > 0) {
        const timestamp = new Date().toISOString();
        const visitsWithSync = visits.map(visit => ({
          ...visit,
          id: visit._id || visit.id,
          lastSync: timestamp
        }));

        await db.visits.bulkPut(visitsWithSync);
        console.log(`[VisitService] Pre-cached ${visits.length} visits`);
      }

      return { success: true, cached: visits.length };
    } catch (error) {
      console.error('[VisitService] Pre-cache failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get locally cached visits
   * @returns {Promise<Array>} Cached visits
   */
  async getCachedVisits() {
    return db.visits.toArray();
  },

  /**
   * Get cached visit count
   * @returns {Promise<number>} Count of cached visits
   */
  async getCachedVisitCount() {
    return db.visits.count();
  },

  /**
   * Search visits offline
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching visits
   */
  async searchVisitsOffline(query) {
    if (!query) return [];

    const lowerQuery = query.toLowerCase();
    const visits = await db.visits.toArray();

    return visits.filter(visit =>
      visit.chiefComplaint?.toLowerCase().includes(lowerQuery) ||
      visit.diagnosis?.toLowerCase().includes(lowerQuery) ||
      visit.notes?.toLowerCase().includes(lowerQuery) ||
      visit.visitId?.toLowerCase().includes(lowerQuery)
    );
  }
};

export default visitService;
