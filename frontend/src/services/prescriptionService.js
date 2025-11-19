import api from './apiConfig';

// Prescription service for managing optical and medical prescriptions
const prescriptionService = {
  // Get all prescriptions with filters
  async getPrescriptions(params = {}) {
    try {
      const response = await api.get('/prescriptions', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
      throw error;
    }
  },

  // Get single prescription
  async getPrescription(id) {
    try {
      const response = await api.get(`/prescriptions/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching prescription:', error);
      throw error;
    }
  },

  // Create new prescription
  async createPrescription(prescriptionData) {
    try {
      const response = await api.post('/prescriptions', prescriptionData);
      return response.data;
    } catch (error) {
      console.error('Error creating prescription:', error);
      throw error;
    }
  },

  // Update prescription
  async updatePrescription(id, prescriptionData) {
    try {
      const response = await api.put(`/prescriptions/${id}`, prescriptionData);
      return response.data;
    } catch (error) {
      console.error('Error updating prescription:', error);
      throw error;
    }
  },

  // Delete prescription
  async deletePrescription(id) {
    try {
      const response = await api.delete(`/prescriptions/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting prescription:', error);
      throw error;
    }
  },

  // Get prescriptions by patient
  async getPatientPrescriptions(patientId, params = {}) {
    try {
      const response = await api.get(`/patients/${patientId}/prescriptions`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching patient prescriptions:', error);
      throw error;
    }
  },

  // Get prescriptions by provider
  async getProviderPrescriptions(providerId, params = {}) {
    try {
      const response = await api.get(`/providers/${providerId}/prescriptions`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching provider prescriptions:', error);
      throw error;
    }
  },

  // Create optical prescription
  async createOpticalPrescription(prescriptionData) {
    try {
      const response = await api.post('/prescriptions/optical', prescriptionData);
      return response.data;
    } catch (error) {
      console.error('Error creating optical prescription:', error);
      throw error;
    }
  },

  // Update optical prescription
  async updateOpticalPrescription(id, prescriptionData) {
    try {
      const response = await api.put(`/prescriptions/optical/${id}`, prescriptionData);
      return response.data;
    } catch (error) {
      console.error('Error updating optical prescription:', error);
      throw error;
    }
  },

  // Get optical prescriptions
  async getOpticalPrescriptions(params = {}) {
    try {
      const response = await api.get('/prescriptions/optical', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching optical prescriptions:', error);
      throw error;
    }
  },

  // Create drug prescription
  async createDrugPrescription(prescriptionData) {
    try {
      const response = await api.post('/prescriptions/drug', prescriptionData);
      return response.data;
    } catch (error) {
      console.error('Error creating drug prescription:', error);
      throw error;
    }
  },

  // Update drug prescription
  async updateDrugPrescription(id, prescriptionData) {
    try {
      const response = await api.put(`/prescriptions/drug/${id}`, prescriptionData);
      return response.data;
    } catch (error) {
      console.error('Error updating drug prescription:', error);
      throw error;
    }
  },

  // Get drug prescriptions
  async getDrugPrescriptions(params = {}) {
    try {
      const response = await api.get('/prescriptions/drug', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching drug prescriptions:', error);
      throw error;
    }
  },

  // Verify prescription
  async verifyPrescription(id, verificationData) {
    try {
      const response = await api.post(`/prescriptions/${id}/verify`, verificationData);
      return response.data;
    } catch (error) {
      console.error('Error verifying prescription:', error);
      throw error;
    }
  },

  // Dispense prescription
  async dispensePrescription(id, dispensingData) {
    try {
      const response = await api.put(`/prescriptions/${id}/dispense`, dispensingData);
      return response.data;
    } catch (error) {
      console.error('Error dispensing prescription:', error);
      throw error;
    }
  },

  // Refill prescription
  async refillPrescription(id) {
    try {
      const response = await api.post(`/prescriptions/${id}/refill`);
      return response.data;
    } catch (error) {
      console.error('Error refilling prescription:', error);
      throw error;
    }
  },

  // Cancel prescription
  async cancelPrescription(id, reason) {
    try {
      const response = await api.put(`/prescriptions/${id}/cancel`, { reason });
      return response.data;
    } catch (error) {
      console.error('Error cancelling prescription:', error);
      throw error;
    }
  },

  // Check drug interactions
  async checkDrugInteractions(drugIds) {
    try {
      const response = await api.post('/prescriptions/check-interactions', { drugIds });
      return response.data;
    } catch (error) {
      console.error('Error checking drug interactions:', error);
      throw error;
    }
  },

  // Check insurance coverage
  async checkInsuranceCoverage(prescriptionId) {
    try {
      const response = await api.get(`/prescriptions/${prescriptionId}/check-coverage`);
      return response.data;
    } catch (error) {
      console.error('Error checking insurance coverage:', error);
      throw error;
    }
  },

  // Search drugs (uses pharmacy inventory)
  async searchDrugs(query) {
    try {
      const response = await api.get('/pharmacy/search', {
        params: { q: query }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching drugs:', error);
      throw error;
    }
  },

  // Get drug details (uses pharmacy inventory)
  async getDrugDetails(drugId) {
    try {
      const response = await api.get(`/pharmacy/inventory/${drugId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching drug details:', error);
      throw error;
    }
  },

  // Get prescription templates
  async getPrescriptionTemplates(type) {
    try {
      const response = await api.get('/prescriptions/templates', {
        params: { type }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching prescription templates:', error);
      throw error;
    }
  },

  // Apply prescription template
  async applyTemplate(prescriptionId, templateId) {
    try {
      const response = await api.post(`/prescriptions/${prescriptionId}/apply-template`, {
        templateId
      });
      return response.data;
    } catch (error) {
      console.error('Error applying prescription template:', error);
      throw error;
    }
  },

  // Send prescription to pharmacy
  async sendToPharmacy(prescriptionId, pharmacyData) {
    try {
      const response = await api.post(`/prescriptions/${prescriptionId}/send-to-pharmacy`, pharmacyData);
      return response.data;
    } catch (error) {
      console.error('Error sending prescription to pharmacy:', error);
      throw error;
    }
  },

  // Send prescription to patient
  async sendToPatient(prescriptionId, method = 'email') {
    try {
      const response = await api.post(`/prescriptions/${prescriptionId}/send-to-patient`, { method });
      return response.data;
    } catch (error) {
      console.error('Error sending prescription to patient:', error);
      throw error;
    }
  },

  // Print prescription
  async printPrescription(prescriptionId, format = 'pdf') {
    try {
      const response = await api.get(`/prescriptions/${prescriptionId}/print`, {
        params: { format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error printing prescription:', error);
      throw error;
    }
  },

  // Get prescription history
  async getPrescriptionHistory(prescriptionId) {
    try {
      const response = await api.get(`/prescriptions/${prescriptionId}/history`);
      return response.data;
    } catch (error) {
      console.error('Error fetching prescription history:', error);
      throw error;
    }
  },

  // Clone prescription
  async clonePrescription(prescriptionId) {
    try {
      const response = await api.post(`/prescriptions/${prescriptionId}/clone`);
      return response.data;
    } catch (error) {
      console.error('Error cloning prescription:', error);
      throw error;
    }
  },

  // Get prescription statistics
  async getPrescriptionStatistics(params = {}) {
    try {
      const response = await api.get('/prescriptions/statistics', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching prescription statistics:', error);
      throw error;
    }
  },

  // Validate prescription
  async validatePrescription(prescriptionData) {
    try {
      const response = await api.post('/prescriptions/validate', prescriptionData);
      return response.data;
    } catch (error) {
      console.error('Error validating prescription:', error);
      throw error;
    }
  },

  // Get lens options
  async getLensOptions(prescriptionId) {
    try {
      const response = await api.get(`/prescriptions/optical/${prescriptionId}/lens-options`);
      return response.data;
    } catch (error) {
      console.error('Error fetching lens options:', error);
      throw error;
    }
  },

  // Calculate lens power
  async calculateLensPower(prescriptionData) {
    try {
      const response = await api.post('/prescriptions/optical/calculate-power', prescriptionData);
      return response.data;
    } catch (error) {
      console.error('Error calculating lens power:', error);
      throw error;
    }
  },

  // Get frame recommendations
  async getFrameRecommendations(prescriptionId) {
    try {
      const response = await api.get(`/prescriptions/optical/${prescriptionId}/frame-recommendations`);
      return response.data;
    } catch (error) {
      console.error('Error fetching frame recommendations:', error);
      throw error;
    }
  },

  // Bulk create prescriptions
  async bulkCreatePrescriptions(prescriptionsData) {
    try {
      const response = await api.post('/prescriptions/bulk', prescriptionsData);
      return response.data;
    } catch (error) {
      console.error('Error bulk creating prescriptions:', error);
      throw error;
    }
  },

  // Get expired prescriptions
  async getExpiredPrescriptions(params = {}) {
    try {
      const response = await api.get('/prescriptions/expired', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching expired prescriptions:', error);
      throw error;
    }
  },

  // Get active prescriptions
  async getActivePrescriptions(patientId) {
    try {
      const response = await api.get(`/patients/${patientId}/prescriptions/active`);
      return response.data;
    } catch (error) {
      console.error('Error fetching active prescriptions:', error);
      throw error;
    }
  },

  // Check prescription eligibility
  async checkEligibility(prescriptionId) {
    try {
      const response = await api.get(`/prescriptions/${prescriptionId}/check-eligibility`);
      return response.data;
    } catch (error) {
      console.error('Error checking prescription eligibility:', error);
      throw error;
    }
  },

  // Get prescription QR code
  async getQRCode(prescriptionId) {
    try {
      const response = await api.get(`/prescriptions/${prescriptionId}/qr-code`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching prescription QR code:', error);
      throw error;
    }
  }
};

export default prescriptionService;