import api from './apiConfig';

const patientService = {
  // Get all patients with pagination
  async getPatients(params = {}) {
    try {
      const response = await api.get('/patients', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching patients:', error);
      throw error;
    }
  },

  // Get single patient
  async getPatient(id) {
    try {
      const response = await api.get(`/patients/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching patient:', error);
      throw error;
    }
  },

  // Create new patient
  async createPatient(patientData) {
    try {
      const response = await api.post('/patients', patientData);
      return response.data;
    } catch (error) {
      console.error('Error creating patient:', error);
      throw error;
    }
  },

  // Update patient
  async updatePatient(id, patientData) {
    try {
      const response = await api.put(`/patients/${id}`, patientData);
      return response.data;
    } catch (error) {
      console.error('Error updating patient:', error);
      throw error;
    }
  },

  // Delete patient (soft delete)
  async deletePatient(id) {
    try {
      const response = await api.delete(`/patients/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting patient:', error);
      throw error;
    }
  },

  // Get patient medical history
  async getPatientHistory(id) {
    try {
      const response = await api.get(`/patients/${id}/history`);
      return response.data;
    } catch (error) {
      console.error('Error fetching patient history:', error);
      throw error;
    }
  },

  // Get patient appointments
  async getPatientAppointments(id) {
    try {
      const response = await api.get(`/patients/${id}/appointments`);
      return response.data;
    } catch (error) {
      console.error('Error fetching patient appointments:', error);
      throw error;
    }
  },

  // Get patient prescriptions
  async getPatientPrescriptions(id) {
    try {
      const response = await api.get(`/patients/${id}/prescriptions`);
      return response.data;
    } catch (error) {
      console.error('Error fetching patient prescriptions:', error);
      throw error;
    }
  },

  // Search patients
  async searchPatients(query, field = 'all') {
    try {
      const response = await api.get('/patients/search', {
        params: { q: query, field }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching patients:', error);
      throw error;
    }
  },

  // Upload patient document
  async uploadDocument(patientId, document) {
    try {
      const response = await api.post(`/patients/${patientId}/documents`, document);
      return response.data;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  },

  // Additional comprehensive patient methods

  // Get patient visits
  async getPatientVisits(id) {
    try {
      const response = await api.get(`/patients/${id}/visits`);
      return response.data;
    } catch (error) {
      console.error('Error fetching patient visits:', error);
      throw error;
    }
  },

  // Get patient allergies
  async getPatientAllergies(id) {
    try {
      const response = await api.get(`/patients/${id}/allergies`);
      return response.data;
    } catch (error) {
      console.error('Error fetching patient allergies:', error);
      throw error;
    }
  },

  // Add patient allergy
  async addPatientAllergy(id, allergyData) {
    try {
      const response = await api.post(`/patients/${id}/allergies`, allergyData);
      return response.data;
    } catch (error) {
      console.error('Error adding patient allergy:', error);
      throw error;
    }
  },

  // Get patient medications
  async getPatientMedications(id) {
    try {
      const response = await api.get(`/patients/${id}/medications`);
      return response.data;
    } catch (error) {
      console.error('Error fetching patient medications:', error);
      throw error;
    }
  },

  // Add patient medication
  async addPatientMedication(id, medicationData) {
    try {
      const response = await api.post(`/patients/${id}/medications`, medicationData);
      return response.data;
    } catch (error) {
      console.error('Error adding patient medication:', error);
      throw error;
    }
  },

  // Get patient insurance
  async getPatientInsurance(id) {
    try {
      const response = await api.get(`/patients/${id}/insurance`);
      return response.data;
    } catch (error) {
      console.error('Error fetching patient insurance:', error);
      throw error;
    }
  },

  // Update patient insurance
  async updatePatientInsurance(id, insuranceData) {
    try {
      const response = await api.put(`/patients/${id}/insurance`, insuranceData);
      return response.data;
    } catch (error) {
      console.error('Error updating patient insurance:', error);
      throw error;
    }
  },

  // Get patient lab results
  async getPatientLabResults(id) {
    try {
      const response = await api.get(`/patients/${id}/lab-results`);
      return response.data;
    } catch (error) {
      console.error('Error fetching patient lab results:', error);
      throw error;
    }
  },

  // Get patient correspondence
  async getPatientCorrespondence(id) {
    try {
      const response = await api.get(`/patients/${id}/correspondence`);
      return response.data;
    } catch (error) {
      console.error('Error fetching patient correspondence:', error);
      throw error;
    }
  },

  // Get patient billing information
  async getPatientBilling(id) {
    try {
      const response = await api.get(`/patients/${id}/billing`);
      return response.data;
    } catch (error) {
      console.error('Error fetching patient billing:', error);
      throw error;
    }
  },

  // Get patient timeline
  async getPatientTimeline(id, params = {}) {
    try {
      const response = await api.get(`/visits/timeline/${id}`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching patient timeline:', error);
      throw error;
    }
  },

  // Get complete patient profile (unified patient hub)
  async getCompleteProfile(id) {
    try {
      const response = await api.get(`/patients/${id}/complete-profile`);
      return response.data;
    } catch (error) {
      console.error('Error fetching complete patient profile:', error);
      throw error;
    }
  },

  // Get patient medical issues
  async getMedicalIssues(id, params = {}) {
    try {
      const response = await api.get(`/patients/${id}/medical-issues`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching patient medical issues:', error);
      throw error;
    }
  },

  // Update medical issue status
  async updateMedicalIssue(patientId, issueId, data) {
    try {
      const response = await api.put(`/patients/${patientId}/medical-issues/${issueId}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating medical issue:', error);
      throw error;
    }
  },

  // Get all providers who treated patient
  async getPatientProviders(id) {
    try {
      const response = await api.get(`/patients/${id}/providers`);
      return response.data;
    } catch (error) {
      console.error('Error fetching patient providers:', error);
      throw error;
    }
  },

  // Get patient audit trail
  async getPatientAudit(id, params = {}) {
    try {
      const response = await api.get(`/patients/${id}/audit`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching patient audit trail:', error);
      throw error;
    }
  },

  // Get patient statistics
  async getPatientStatistics(id) {
    try {
      const response = await api.get(`/patients/${id}/statistics`);
      return response.data;
    } catch (error) {
      console.error('Error fetching patient statistics:', error);
      throw error;
    }
  },

  // Upload patient photo
  async uploadPatientPhoto(id, file) {
    try {
      const formData = new FormData();
      formData.append('photo', file);

      const response = await api.post(`/patients/${id}/photo`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading patient photo:', error);
      throw error;
    }
  },

  // Get patient by MRN
  async getPatientByMRN(mrn) {
    try {
      const response = await api.get(`/patients/mrn/${mrn}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching patient by MRN:', error);
      throw error;
    }
  },

  // Get recent patients
  async getRecentPatients(limit = 10) {
    try {
      const response = await api.get('/patients/recent', { params: { limit } });
      return response.data;
    } catch (error) {
      console.error('Error fetching recent patients:', error);
      throw error;
    }
  }
};

export default patientService;