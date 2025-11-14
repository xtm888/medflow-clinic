import api from './apiConfig';

// Visit service for managing clinical visits and acts
const visitService = {
  // Get all visits with filters
  async getVisits(params = {}) {
    try {
      const response = await api.get('/visits', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching visits:', error);
      throw error;
    }
  },

  // Get single visit
  async getVisit(id) {
    try {
      const response = await api.get(`/visits/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching visit:', error);
      throw error;
    }
  },

  // Create new visit
  async createVisit(visitData) {
    try {
      const response = await api.post('/visits', visitData);
      return response.data;
    } catch (error) {
      console.error('Error creating visit:', error);
      throw error;
    }
  },

  // Update visit
  async updateVisit(id, visitData) {
    try {
      const response = await api.put(`/visits/${id}`, visitData);
      return response.data;
    } catch (error) {
      console.error('Error updating visit:', error);
      throw error;
    }
  },

  // Start visit
  async startVisit(id) {
    try {
      const response = await api.put(`/visits/${id}/start`);
      return response.data;
    } catch (error) {
      console.error('Error starting visit:', error);
      throw error;
    }
  },

  // Complete visit
  async completeVisit(id) {
    try {
      const response = await api.put(`/visits/${id}/complete`);
      return response.data;
    } catch (error) {
      console.error('Error completing visit:', error);
      throw error;
    }
  },

  // Cancel visit
  async cancelVisit(id, reason) {
    try {
      const response = await api.put(`/visits/${id}/cancel`, { reason });
      return response.data;
    } catch (error) {
      console.error('Error cancelling visit:', error);
      throw error;
    }
  },

  // Add act to visit
  async addAct(visitId, actData) {
    try {
      const response = await api.post(`/visits/${visitId}/acts`, actData);
      return response.data;
    } catch (error) {
      console.error('Error adding act to visit:', error);
      throw error;
    }
  },

  // Update act
  async updateAct(visitId, actId, actData) {
    try {
      const response = await api.put(`/visits/${visitId}/acts/${actId}`, actData);
      return response.data;
    } catch (error) {
      console.error('Error updating act:', error);
      throw error;
    }
  },

  // Remove act
  async removeAct(visitId, actId) {
    try {
      const response = await api.delete(`/visits/${visitId}/acts/${actId}`);
      return response.data;
    } catch (error) {
      console.error('Error removing act:', error);
      throw error;
    }
  },

  // Complete act
  async completeAct(visitId, actId) {
    try {
      const response = await api.put(`/visits/${visitId}/acts/${actId}/complete`);
      return response.data;
    } catch (error) {
      console.error('Error completing act:', error);
      throw error;
    }
  },

  // Get visit acts
  async getVisitActs(visitId) {
    try {
      const response = await api.get(`/visits/${visitId}/acts`);
      return response.data;
    } catch (error) {
      console.error('Error fetching visit acts:', error);
      throw error;
    }
  },

  // Get visits by patient
  async getPatientVisits(patientId, params = {}) {
    try {
      const response = await api.get(`/patients/${patientId}/visits`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching patient visits:', error);
      throw error;
    }
  },

  // Get visits by provider
  async getProviderVisits(providerId, params = {}) {
    try {
      const response = await api.get(`/providers/${providerId}/visits`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching provider visits:', error);
      throw error;
    }
  },

  // Get today's visits
  async getTodaysVisits() {
    try {
      const response = await api.get('/visits/today');
      return response.data;
    } catch (error) {
      console.error('Error fetching today\'s visits:', error);
      throw error;
    }
  },

  // Get active visits
  async getActiveVisits() {
    try {
      const response = await api.get('/visits/active');
      return response.data;
    } catch (error) {
      console.error('Error fetching active visits:', error);
      throw error;
    }
  },

  // Add vital signs to visit
  async addVitalSigns(visitId, vitalSignsData) {
    try {
      const response = await api.post(`/visits/${visitId}/vital-signs`, vitalSignsData);
      return response.data;
    } catch (error) {
      console.error('Error adding vital signs:', error);
      throw error;
    }
  },

  // Get visit vital signs
  async getVitalSigns(visitId) {
    try {
      const response = await api.get(`/visits/${visitId}/vital-signs`);
      return response.data;
    } catch (error) {
      console.error('Error fetching vital signs:', error);
      throw error;
    }
  },

  // Add clinical note
  async addClinicalNote(visitId, noteData) {
    try {
      const response = await api.post(`/visits/${visitId}/notes`, noteData);
      return response.data;
    } catch (error) {
      console.error('Error adding clinical note:', error);
      throw error;
    }
  },

  // Get visit notes
  async getVisitNotes(visitId) {
    try {
      const response = await api.get(`/visits/${visitId}/notes`);
      return response.data;
    } catch (error) {
      console.error('Error fetching visit notes:', error);
      throw error;
    }
  },

  // Add diagnosis to visit
  async addDiagnosis(visitId, diagnosisData) {
    try {
      const response = await api.post(`/visits/${visitId}/diagnoses`, diagnosisData);
      return response.data;
    } catch (error) {
      console.error('Error adding diagnosis:', error);
      throw error;
    }
  },

  // Get visit diagnoses
  async getVisitDiagnoses(visitId) {
    try {
      const response = await api.get(`/visits/${visitId}/diagnoses`);
      return response.data;
    } catch (error) {
      console.error('Error fetching visit diagnoses:', error);
      throw error;
    }
  },

  // Add prescription to visit
  async addPrescription(visitId, prescriptionData) {
    try {
      const response = await api.post(`/visits/${visitId}/prescriptions`, prescriptionData);
      return response.data;
    } catch (error) {
      console.error('Error adding prescription:', error);
      throw error;
    }
  },

  // Get visit prescriptions
  async getVisitPrescriptions(visitId) {
    try {
      const response = await api.get(`/visits/${visitId}/prescriptions`);
      return response.data;
    } catch (error) {
      console.error('Error fetching visit prescriptions:', error);
      throw error;
    }
  },

  // Add lab order to visit
  async addLabOrder(visitId, labOrderData) {
    try {
      const response = await api.post(`/visits/${visitId}/lab-orders`, labOrderData);
      return response.data;
    } catch (error) {
      console.error('Error adding lab order:', error);
      throw error;
    }
  },

  // Get visit lab orders
  async getVisitLabOrders(visitId) {
    try {
      const response = await api.get(`/visits/${visitId}/lab-orders`);
      return response.data;
    } catch (error) {
      console.error('Error fetching visit lab orders:', error);
      throw error;
    }
  },

  // Add imaging order to visit
  async addImagingOrder(visitId, imagingOrderData) {
    try {
      const response = await api.post(`/visits/${visitId}/imaging-orders`, imagingOrderData);
      return response.data;
    } catch (error) {
      console.error('Error adding imaging order:', error);
      throw error;
    }
  },

  // Get visit imaging orders
  async getVisitImagingOrders(visitId) {
    try {
      const response = await api.get(`/visits/${visitId}/imaging-orders`);
      return response.data;
    } catch (error) {
      console.error('Error fetching visit imaging orders:', error);
      throw error;
    }
  },

  // Add procedure to visit
  async addProcedure(visitId, procedureData) {
    try {
      const response = await api.post(`/visits/${visitId}/procedures`, procedureData);
      return response.data;
    } catch (error) {
      console.error('Error adding procedure:', error);
      throw error;
    }
  },

  // Get visit procedures
  async getVisitProcedures(visitId) {
    try {
      const response = await api.get(`/visits/${visitId}/procedures`);
      return response.data;
    } catch (error) {
      console.error('Error fetching visit procedures:', error);
      throw error;
    }
  },

  // Generate visit summary
  async generateVisitSummary(visitId, format = 'pdf') {
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

  // Clone visit
  async cloneVisit(visitId) {
    try {
      const response = await api.post(`/visits/${visitId}/clone`);
      return response.data;
    } catch (error) {
      console.error('Error cloning visit:', error);
      throw error;
    }
  },

  // Get visit billing
  async getVisitBilling(visitId) {
    try {
      const response = await api.get(`/visits/${visitId}/billing`);
      return response.data;
    } catch (error) {
      console.error('Error fetching visit billing:', error);
      throw error;
    }
  },

  // Update visit billing
  async updateVisitBilling(visitId, billingData) {
    try {
      const response = await api.put(`/visits/${visitId}/billing`, billingData);
      return response.data;
    } catch (error) {
      console.error('Error updating visit billing:', error);
      throw error;
    }
  },

  // Get visit documents
  async getVisitDocuments(visitId) {
    try {
      const response = await api.get(`/visits/${visitId}/documents`);
      return response.data;
    } catch (error) {
      console.error('Error fetching visit documents:', error);
      throw error;
    }
  },

  // Add document to visit
  async addDocument(visitId, documentData) {
    try {
      const response = await api.post(`/visits/${visitId}/documents`, documentData);
      return response.data;
    } catch (error) {
      console.error('Error adding document to visit:', error);
      throw error;
    }
  },

  // Get visit timeline
  async getVisitTimeline(visitId) {
    try {
      const response = await api.get(`/visits/${visitId}/timeline`);
      return response.data;
    } catch (error) {
      console.error('Error fetching visit timeline:', error);
      throw error;
    }
  },

  // Link visit to appointment
  async linkToAppointment(visitId, appointmentId) {
    try {
      const response = await api.put(`/visits/${visitId}/link-appointment`, { appointmentId });
      return response.data;
    } catch (error) {
      console.error('Error linking visit to appointment:', error);
      throw error;
    }
  },

  // Get follow-up visits
  async getFollowUpVisits(visitId) {
    try {
      const response = await api.get(`/visits/${visitId}/follow-ups`);
      return response.data;
    } catch (error) {
      console.error('Error fetching follow-up visits:', error);
      throw error;
    }
  },

  // Schedule follow-up visit
  async scheduleFollowUp(visitId, followUpData) {
    try {
      const response = await api.post(`/visits/${visitId}/follow-up`, followUpData);
      return response.data;
    } catch (error) {
      console.error('Error scheduling follow-up visit:', error);
      throw error;
    }
  },

  // Get visit statistics
  async getVisitStatistics(params = {}) {
    try {
      const response = await api.get('/visits/statistics', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching visit statistics:', error);
      throw error;
    }
  },

  // Apply visit template
  async applyTemplate(visitId, templateId) {
    try {
      const response = await api.post(`/visits/${visitId}/apply-template`, { templateId });
      return response.data;
    } catch (error) {
      console.error('Error applying visit template:', error);
      throw error;
    }
  },

  // Get available visit templates
  async getVisitTemplates(visitType) {
    try {
      const response = await api.get('/visits/templates', {
        params: { visitType }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching visit templates:', error);
      throw error;
    }
  }
};

export default visitService;