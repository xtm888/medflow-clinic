import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

const orthopticService = {
  // Get all orthoptic exams with optional filters - WORKS OFFLINE (30 min cache)
  getExams: async (params = {}) => {
    const cacheKey = `orthoptic_all_${JSON.stringify(params)}`;
    return offlineWrapper.get(
      () => api.get('/orthoptic', { params }),
      'orthopticExams',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  // Get single orthoptic exam by ID - WORKS OFFLINE (30 min cache)
  getExam: async (id) => {
    return offlineWrapper.get(
      () => api.get(`/orthoptic/${id}`),
      'orthopticExams',
      id,
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  // Create new orthoptic exam - WORKS OFFLINE (queued)
  createExam: async (examData) => {
    const localData = {
      ...examData,
      _tempId: `temp_orthoptic_${Date.now()}`,
      status: 'draft',
      examDate: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.post('/orthoptic', examData),
      'CREATE',
      'orthopticExams',
      localData
    );
  },

  // Update existing orthoptic exam - WORKS OFFLINE (queued)
  updateExam: async (id, examData) => {
    const localData = { ...examData, id, lastModified: new Date().toISOString() };
    return offlineWrapper.mutate(
      () => api.put(`/orthoptic/${id}`, examData),
      'UPDATE',
      'orthopticExams',
      localData,
      id
    );
  },

  // Complete exam - WORKS OFFLINE (queued)
  completeExam: async (id) => {
    const localData = { id, status: 'completed', completedAt: new Date().toISOString() };
    return offlineWrapper.mutate(
      () => api.put(`/orthoptic/${id}/complete`),
      'UPDATE',
      'orthopticExams',
      localData,
      id
    );
  },

  // Sign exam - ONLINE ONLY (legal requirement)
  signExam: async (id) => {
    if (!navigator.onLine) {
      throw new Error('Signing exams requires internet connection for verification.');
    }
    const response = await api.put(`/orthoptic/${id}/sign`);
    return response.data;
  },

  // Delete exam (admin only) - WORKS OFFLINE (queued)
  deleteExam: async (id) => {
    return offlineWrapper.mutate(
      () => api.delete(`/orthoptic/${id}`),
      'DELETE',
      'orthopticExams',
      { id, deletedAt: new Date().toISOString() },
      id
    );
  },

  // Get patient's orthoptic history - WORKS OFFLINE (10 min cache)
  getPatientHistory: async (patientId) => {
    return offlineWrapper.get(
      () => api.get(`/orthoptic/patient/${patientId}/history`),
      'orthopticExams',
      `patient_history_${patientId}`,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Get latest orthoptic exam for a patient - WORKS OFFLINE (10 min cache)
  getLatestExam: async (patientId) => {
    const cacheKey = `orthoptic_latest_${patientId}`;
    return offlineWrapper.get(
      async () => {
        const response = await api.get('/orthoptic', {
          params: {
            patientId,
            limit: 1,
            sort: '-examDate' // Most recent first
          }
        });
        // Return the first exam if exists
        return {
          success: true,
          data: response.data?.data?.[0] || null
        };
      },
      'orthopticExams',
      cacheKey,
      { transform: (response) => response, cacheExpiry: 600 }
    );
  },

  // Get patient's treatment progress - WORKS OFFLINE (30 min cache)
  getTreatmentProgress: async (patientId) => {
    return offlineWrapper.get(
      () => api.get(`/orthoptic/patient/${patientId}/progress`),
      'orthopticExams',
      `treatment_progress_${patientId}`,
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  // Compare exam with previous - WORKS OFFLINE (30 min cache)
  compareWithPrevious: async (id) => {
    return offlineWrapper.get(
      () => api.get(`/orthoptic/${id}/compare`),
      'orthopticExams',
      `compare_${id}`,
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  // Generate report - ONLINE ONLY (PDF generation)
  generateReport: async (id) => {
    if (!navigator.onLine) {
      throw new Error('Report generation requires internet connection.');
    }
    const response = await api.get(`/orthoptic/${id}/report`);
    return response.data;
  },

  // Add attachment - ONLINE ONLY (file upload)
  addAttachment: async (id, attachmentData) => {
    if (!navigator.onLine) {
      throw new Error('Attachments require internet connection for upload.');
    }
    const response = await api.post(`/orthoptic/${id}/attachments`, attachmentData);
    return response.data;
  },

  // Get statistics - WORKS OFFLINE (1 hour cache)
  getStats: async () => {
    return offlineWrapper.get(
      () => api.get('/orthoptic/stats'),
      'orthopticExams',
      'stats',
      { transform: (response) => response.data, cacheExpiry: 3600 }
    );
  },

  // Helper: Pre-cache patient data
  preCachePatientData: async (patientId) => {
    const results = { cached: 0, errors: [] };
    try { await orthopticService.getPatientHistory(patientId); results.cached++; } catch { results.errors.push('history'); }
    try { await orthopticService.getLatestExam(patientId); results.cached++; } catch { results.errors.push('latest'); }
    try { await orthopticService.getTreatmentProgress(patientId); results.cached++; } catch { results.errors.push('progress'); }
    return results;
  },

  // Helper: Get cached count
  getCachedCount: async () => {
    try { return (await db.orthopticExams.toArray()).length; } catch { return 0; }
  }
};

export default orthopticService;
