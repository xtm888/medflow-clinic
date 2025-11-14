import api from './apiConfig';

const ophthalmologyService = {
  // Get all exams
  async getExams(params = {}) {
    try {
      const response = await api.get('/ophthalmology/exams', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching exams:', error);
      throw error;
    }
  },

  // Get single exam
  async getExam(id) {
    try {
      const response = await api.get(`/ophthalmology/exams/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching exam:', error);
      throw error;
    }
  },

  // Create new exam
  async createExam(examData) {
    try {
      const response = await api.post('/ophthalmology/exams', examData);
      return response.data;
    } catch (error) {
      console.error('Error creating exam:', error);
      throw error;
    }
  },

  // Update exam
  async updateExam(id, examData) {
    try {
      const response = await api.put(`/ophthalmology/exams/${id}`, examData);
      return response.data;
    } catch (error) {
      console.error('Error updating exam:', error);
      throw error;
    }
  },

  // Complete exam
  async completeExam(id) {
    try {
      const response = await api.put(`/ophthalmology/exams/${id}/complete`);
      return response.data;
    } catch (error) {
      console.error('Error completing exam:', error);
      throw error;
    }
  },

  // Generate optical prescription from exam
  async generatePrescription(examId) {
    try {
      const response = await api.post(`/ophthalmology/exams/${examId}/prescription`);
      return response.data;
    } catch (error) {
      console.error('Error generating prescription:', error);
      throw error;
    }
  },

  // Save refraction data
  async saveRefractionData(examId, refractionData) {
    try {
      const response = await api.put(`/ophthalmology/exams/${examId}/refraction`, refractionData);
      return response.data;
    } catch (error) {
      console.error('Error saving refraction data:', error);
      throw error;
    }
  },

  // Get patient exam history
  async getPatientExamHistory(patientId) {
    try {
      const response = await api.get(`/ophthalmology/patients/${patientId}/history`);
      return response.data;
    } catch (error) {
      console.error('Error fetching patient exam history:', error);
      throw error;
    }
  },

  // Upload fundus image
  async uploadFundusImage(examId, imageData) {
    try {
      const response = await api.post(`/ophthalmology/exams/${examId}/fundus-image`, imageData);
      return response.data;
    } catch (error) {
      console.error('Error uploading fundus image:', error);
      throw error;
    }
  },

  // Additional comprehensive ophthalmology methods

  // Save tonometry data
  async saveTonometryData(examId, tonometryData) {
    try {
      const response = await api.put(`/ophthalmology/exams/${examId}/tonometry`, tonometryData);
      return response.data;
    } catch (error) {
      console.error('Error saving tonometry data:', error);
      throw error;
    }
  },

  // Save visual acuity data
  async saveVisualAcuityData(examId, visualAcuityData) {
    try {
      const response = await api.put(`/ophthalmology/exams/${examId}/visual-acuity`, visualAcuityData);
      return response.data;
    } catch (error) {
      console.error('Error saving visual acuity data:', error);
      throw error;
    }
  },

  // Save OCT results
  async saveOCTResults(examId, octData) {
    try {
      const response = await api.put(`/ophthalmology/exams/${examId}/oct`, octData);
      return response.data;
    } catch (error) {
      console.error('Error saving OCT results:', error);
      throw error;
    }
  },

  // Save visual field test results
  async saveVisualFieldResults(examId, visualFieldData) {
    try {
      const response = await api.put(`/ophthalmology/exams/${examId}/visual-field`, visualFieldData);
      return response.data;
    } catch (error) {
      console.error('Error saving visual field results:', error);
      throw error;
    }
  },

  // Save keratometry data
  async saveKeratometryData(examId, keratometryData) {
    try {
      const response = await api.put(`/ophthalmology/exams/${examId}/keratometry`, keratometryData);
      return response.data;
    } catch (error) {
      console.error('Error saving keratometry data:', error);
      throw error;
    }
  },

  // Save biometry data
  async saveBiometryData(examId, biometryData) {
    try {
      const response = await api.put(`/ophthalmology/exams/${examId}/biometry`, biometryData);
      return response.data;
    } catch (error) {
      console.error('Error saving biometry data:', error);
      throw error;
    }
  },

  // Save slit lamp examination
  async saveSlitLampExam(examId, slitLampData) {
    try {
      const response = await api.put(`/ophthalmology/exams/${examId}/slit-lamp`, slitLampData);
      return response.data;
    } catch (error) {
      console.error('Error saving slit lamp exam:', error);
      throw error;
    }
  },

  // Save fundoscopy results
  async saveFundoscopyResults(examId, fundoscopyData) {
    try {
      const response = await api.put(`/ophthalmology/exams/${examId}/fundoscopy`, fundoscopyData);
      return response.data;
    } catch (error) {
      console.error('Error saving fundoscopy results:', error);
      throw error;
    }
  },

  // Get device measurements
  async getDeviceMeasurements(examId) {
    try {
      const response = await api.get(`/ophthalmology/exams/${examId}/device-measurements`);
      return response.data;
    } catch (error) {
      console.error('Error fetching device measurements:', error);
      throw error;
    }
  },

  // Import device measurement
  async importDeviceMeasurement(examId, deviceType, measurementData) {
    try {
      const response = await api.post(`/ophthalmology/exams/${examId}/import-measurement`, {
        deviceType,
        measurementData
      });
      return response.data;
    } catch (error) {
      console.error('Error importing device measurement:', error);
      throw error;
    }
  },

  // Calculate IOL power
  async calculateIOLPower(examId, formula, targetRefraction) {
    try {
      const response = await api.post(`/ophthalmology/exams/${examId}/iol-calculation`, {
        formula,
        targetRefraction
      });
      return response.data;
    } catch (error) {
      console.error('Error calculating IOL power:', error);
      throw error;
    }
  },

  // Generate exam report
  async generateExamReport(examId, format = 'pdf') {
    try {
      const response = await api.get(`/ophthalmology/exams/${examId}/report`, {
        params: { format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error generating exam report:', error);
      throw error;
    }
  },

  // Compare exams
  async compareExams(examId1, examId2) {
    try {
      const response = await api.get('/ophthalmology/exams/compare', {
        params: { exam1: examId1, exam2: examId2 }
      });
      return response.data;
    } catch (error) {
      console.error('Error comparing exams:', error);
      throw error;
    }
  },

  // Get progression analysis
  async getProgressionAnalysis(patientId, testType) {
    try {
      const response = await api.get(`/ophthalmology/patients/${patientId}/progression`, {
        params: { testType }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching progression analysis:', error);
      throw error;
    }
  },

  // Get treatment recommendations
  async getTreatmentRecommendations(examId) {
    try {
      const response = await api.get(`/ophthalmology/exams/${examId}/recommendations`);
      return response.data;
    } catch (error) {
      console.error('Error fetching treatment recommendations:', error);
      throw error;
    }
  },

  // Save diagnosis
  async saveDiagnosis(examId, diagnosisData) {
    try {
      const response = await api.put(`/ophthalmology/exams/${examId}/diagnosis`, diagnosisData);
      return response.data;
    } catch (error) {
      console.error('Error saving diagnosis:', error);
      throw error;
    }
  },

  // Get exam templates
  async getExamTemplates(examType) {
    try {
      const response = await api.get('/ophthalmology/templates', {
        params: { examType }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching exam templates:', error);
      throw error;
    }
  },

  // Apply exam template
  async applyTemplate(examId, templateId) {
    try {
      const response = await api.post(`/ophthalmology/exams/${examId}/apply-template`, {
        templateId
      });
      return response.data;
    } catch (error) {
      console.error('Error applying template:', error);
      throw error;
    }
  }
};

export default ophthalmologyService;