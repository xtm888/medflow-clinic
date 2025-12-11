import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

/**
 * Ophthalmology Service - Offline-First
 * Handles eye exams, refraction, tonometry, OCT, visual fields with offline support
 */

const ophthalmologyService = {
  // ============================================
  // EXAM CRUD OPERATIONS - ALL WORK OFFLINE
  // ============================================

  /**
   * Get all exams with filters - WORKS OFFLINE
   * @param {Object} params - Query parameters
   * @returns {Promise} Exams list
   */
  async getExams(params = {}) {
    return offlineWrapper.get(
      () => api.get('/ophthalmology/exams', { params }),
      'ophthalmologyExams',
      params,
      {
        transform: (response) => response.data,
        cacheExpiry: 600 // 10 minutes
      }
    );
  },

  /**
   * Get single exam - WORKS OFFLINE
   * @param {string} id - Exam ID
   * @returns {Promise} Exam data
   */
  async getExam(id) {
    return offlineWrapper.get(
      () => api.get(`/ophthalmology/exams/${id}`),
      'ophthalmologyExams',
      id,
      {
        transform: (response) => response.data,
        cacheExpiry: 1800 // 30 minutes
      }
    );
  },

  /**
   * Create new exam - WORKS OFFLINE
   * @param {Object} examData - Exam data
   * @returns {Promise} Created exam
   */
  async createExam(examData) {
    const localData = {
      ...examData,
      _tempId: `temp_${Date.now()}`,
      status: 'in_progress',
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post('/ophthalmology/exams', examData),
      'CREATE',
      'ophthalmologyExams',
      localData
    );
  },

  /**
   * Update exam - WORKS OFFLINE
   * @param {string} id - Exam ID
   * @param {Object} examData - Updated data
   * @returns {Promise} Updated exam
   */
  async updateExam(id, examData) {
    const updateData = {
      ...examData,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/ophthalmology/exams/${id}`, examData),
      'UPDATE',
      'ophthalmologyExams',
      updateData,
      id
    );
  },

  /**
   * Complete exam - WORKS OFFLINE
   * @param {string} id - Exam ID
   * @returns {Promise} Completed exam
   */
  async completeExam(id) {
    const updateData = {
      status: 'completed',
      completedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/ophthalmology/exams/${id}/complete`),
      'UPDATE',
      'ophthalmologyExams',
      updateData,
      id
    );
  },

  /**
   * Delete exam - WORKS OFFLINE
   * @param {string} id - Exam ID
   * @returns {Promise} Confirmation
   */
  async deleteExam(id) {
    return offlineWrapper.mutate(
      () => api.delete(`/ophthalmology/exams/${id}`),
      'DELETE',
      'ophthalmologyExams',
      { deletedAt: new Date().toISOString() },
      id
    );
  },

  // ============================================
  // PATIENT HISTORY - WORKS OFFLINE
  // ============================================

  /**
   * Get patient exam history - WORKS OFFLINE
   * @param {string} patientId - Patient ID
   * @returns {Promise} Patient exam history
   */
  async getPatientExamHistory(patientId) {
    // If offline, filter from local cache
    if (!navigator.onLine) {
      try {
        const exams = await db.ophthalmologyExams
          .where('patientId')
          .equals(patientId)
          .reverse()
          .sortBy('createdAt');

        return {
          success: true,
          data: exams,
          _fromCache: true
        };
      } catch (error) {
        console.error('[OphthalmologyService] Offline history fetch failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get(`/ophthalmology/patients/${patientId}/history`),
      'ophthalmologyExams',
      { type: 'patientHistory', patientId },
      {
        transform: (response) => response.data,
        cacheExpiry: 900 // 15 minutes
      }
    );
  },

  /**
   * Get patient's refraction history - WORKS OFFLINE
   * @param {string} patientId - Patient ID
   * @param {number} limit - Limit results
   * @returns {Promise} Refraction history
   */
  async getRefractionHistory(patientId, limit = 20) {
    if (!navigator.onLine) {
      try {
        const exams = await db.ophthalmologyExams
          .where('patientId')
          .equals(patientId)
          .filter(e => e.refraction)
          .limit(limit)
          .reverse()
          .toArray();

        return {
          success: true,
          data: exams.map(e => e.refraction),
          _fromCache: true
        };
      } catch (error) {
        console.error('[OphthalmologyService] Offline refraction history failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get(`/ophthalmology/patients/${patientId}/refraction-history`, {
        params: { limit }
      }),
      'ophthalmologyExams',
      { type: 'refractionHistory', patientId, limit },
      {
        transform: (response) => response.data,
        cacheExpiry: 900
      }
    );
  },

  /**
   * Get progression analysis - WORKS OFFLINE (limited)
   * @param {string} patientId - Patient ID
   * @param {string} testType - Type of test
   * @returns {Promise} Progression analysis
   */
  async getProgressionAnalysis(patientId, testType) {
    if (!navigator.onLine) {
      // Basic offline progression - just return historical data
      try {
        const exams = await db.ophthalmologyExams
          .where('patientId')
          .equals(patientId)
          .toArray();

        return {
          success: true,
          data: {
            exams,
            analysis: null,
            _offlineNote: 'Full progression analysis requires online connectivity'
          },
          _fromCache: true
        };
      } catch (error) {
        console.error('[OphthalmologyService] Offline progression failed:', error);
        return { success: false, data: {}, _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get(`/ophthalmology/patients/${patientId}/progression`, {
        params: { testType }
      }),
      'ophthalmologyExams',
      { type: 'progression', patientId, testType },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  // ============================================
  // EXAM DATA SECTIONS - ALL WORK OFFLINE
  // ============================================

  /**
   * Save refraction data - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @param {Object} refractionData - Refraction data
   * @returns {Promise} Updated exam
   */
  async saveRefractionData(examId, refractionData) {
    const updateData = {
      refraction: refractionData,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/ophthalmology/exams/${examId}/refraction`, refractionData),
      'UPDATE',
      'ophthalmologyExams',
      updateData,
      examId
    );
  },

  /**
   * Save tonometry data - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @param {Object} tonometryData - Tonometry data
   * @returns {Promise} Updated exam
   */
  async saveTonometryData(examId, tonometryData) {
    const updateData = {
      tonometry: tonometryData,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/ophthalmology/exams/${examId}/tonometry`, tonometryData),
      'UPDATE',
      'ophthalmologyExams',
      updateData,
      examId
    );
  },

  /**
   * Save visual acuity data - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @param {Object} visualAcuityData - Visual acuity data
   * @returns {Promise} Updated exam
   */
  async saveVisualAcuityData(examId, visualAcuityData) {
    const updateData = {
      visualAcuity: visualAcuityData,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/ophthalmology/exams/${examId}/visual-acuity`, visualAcuityData),
      'UPDATE',
      'ophthalmologyExams',
      updateData,
      examId
    );
  },

  /**
   * Save OCT results - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @param {Object} octData - OCT data
   * @returns {Promise} Updated exam
   */
  async saveOCTResults(examId, octData) {
    const updateData = {
      oct: octData,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/ophthalmology/exams/${examId}/oct`, octData),
      'UPDATE',
      'ophthalmologyExams',
      updateData,
      examId
    );
  },

  /**
   * Save visual field test results - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @param {Object} visualFieldData - Visual field data
   * @returns {Promise} Updated exam
   */
  async saveVisualFieldResults(examId, visualFieldData) {
    const updateData = {
      visualField: visualFieldData,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/ophthalmology/exams/${examId}/visual-field`, visualFieldData),
      'UPDATE',
      'ophthalmologyExams',
      updateData,
      examId
    );
  },

  /**
   * Save keratometry data - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @param {Object} keratometryData - Keratometry data
   * @returns {Promise} Updated exam
   */
  async saveKeratometryData(examId, keratometryData) {
    const updateData = {
      keratometry: keratometryData,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/ophthalmology/exams/${examId}/keratometry`, keratometryData),
      'UPDATE',
      'ophthalmologyExams',
      updateData,
      examId
    );
  },

  /**
   * Save biometry data - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @param {Object} biometryData - Biometry data
   * @returns {Promise} Updated exam
   */
  async saveBiometryData(examId, biometryData) {
    const updateData = {
      biometry: biometryData,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/ophthalmology/exams/${examId}/biometry`, biometryData),
      'UPDATE',
      'ophthalmologyExams',
      updateData,
      examId
    );
  },

  /**
   * Save slit lamp examination - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @param {Object} slitLampData - Slit lamp data
   * @returns {Promise} Updated exam
   */
  async saveSlitLampExam(examId, slitLampData) {
    const updateData = {
      slitLamp: slitLampData,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/ophthalmology/exams/${examId}/slit-lamp`, slitLampData),
      'UPDATE',
      'ophthalmologyExams',
      updateData,
      examId
    );
  },

  /**
   * Save fundoscopy results - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @param {Object} fundoscopyData - Fundoscopy data
   * @returns {Promise} Updated exam
   */
  async saveFundoscopyResults(examId, fundoscopyData) {
    const updateData = {
      fundoscopy: fundoscopyData,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/ophthalmology/exams/${examId}/fundoscopy`, fundoscopyData),
      'UPDATE',
      'ophthalmologyExams',
      updateData,
      examId
    );
  },

  /**
   * Save diagnosis - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @param {Object} diagnosisData - Diagnosis data
   * @returns {Promise} Updated exam
   */
  async saveDiagnosis(examId, diagnosisData) {
    const updateData = {
      diagnosis: diagnosisData,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/ophthalmology/exams/${examId}/diagnosis`, diagnosisData),
      'UPDATE',
      'ophthalmologyExams',
      updateData,
      examId
    );
  },

  // ============================================
  // IMAGES AND FILES - PARTIAL OFFLINE
  // ============================================

  /**
   * Upload fundus image - QUEUES OFFLINE
   * Images are queued for upload when online
   * @param {string} examId - Exam ID
   * @param {Object} imageData - Image data
   * @returns {Promise} Upload result
   */
  async uploadFundusImage(examId, imageData) {
    if (!navigator.onLine) {
      // Store image locally for later upload
      try {
        const localImage = {
          id: `temp_img_${Date.now()}`,
          examId,
          type: 'fundus',
          data: imageData,
          uploadStatus: 'pending',
          createdAt: new Date().toISOString()
        };

        await db.files.put(localImage);

        return {
          success: true,
          data: localImage,
          _offline: true,
          _queued: true,
          message: 'Image saved locally. Will upload when online.'
        };
      } catch (error) {
        console.error('[OphthalmologyService] Offline image save failed:', error);
        throw new Error('Failed to save image offline');
      }
    }

    try {
      const response = await api.post(`/ophthalmology/exams/${examId}/fundus-image`, imageData);
      return response.data;
    } catch (error) {
      console.error('[OphthalmologyService] Fundus image upload failed:', error);
      throw error;
    }
  },

  /**
   * Get device measurements - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @returns {Promise} Device measurements
   */
  async getDeviceMeasurements(examId) {
    return offlineWrapper.get(
      () => api.get(`/ophthalmology/exams/${examId}/device-measurements`),
      'ophthalmologyExams',
      { type: 'deviceMeasurements', examId },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600
      }
    );
  },

  /**
   * Import device measurement - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @param {string} deviceType - Type of device
   * @param {Object} measurementData - Measurement data
   * @returns {Promise} Import result
   */
  async importDeviceMeasurement(examId, deviceType, measurementData) {
    const updateData = {
      deviceMeasurements: {
        [deviceType]: measurementData,
        importedAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/ophthalmology/exams/${examId}/import-measurement`, {
        deviceType,
        measurementData
      }),
      'UPDATE',
      'ophthalmologyExams',
      updateData,
      examId
    );
  },

  // ============================================
  // PRESCRIPTIONS - WORKS OFFLINE
  // ============================================

  /**
   * Generate optical prescription from exam - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @returns {Promise} Generated prescription
   */
  async generatePrescription(examId) {
    const localData = {
      examId,
      type: 'optical',
      _tempId: `temp_rx_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      status: 'draft'
    };

    return offlineWrapper.mutate(
      () => api.post(`/ophthalmology/exams/${examId}/prescription`),
      'CREATE',
      'prescriptions',
      localData
    );
  },

  /**
   * Mark prescription as printed - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @returns {Promise} Updated exam
   */
  async markPrescriptionPrinted(examId) {
    const updateData = {
      prescriptionPrinted: true,
      prescriptionPrintedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/ophthalmology/exams/${examId}/mark-printed`),
      'UPDATE',
      'ophthalmologyExams',
      updateData,
      examId
    );
  },

  /**
   * Mark prescription as viewed - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @returns {Promise} Updated exam
   */
  async markPrescriptionViewed(examId) {
    const updateData = {
      prescriptionViewed: true,
      prescriptionViewedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/ophthalmology/exams/${examId}/mark-viewed`),
      'UPDATE',
      'ophthalmologyExams',
      updateData,
      examId
    );
  },

  // ============================================
  // TEMPLATES - WORKS OFFLINE
  // ============================================

  /**
   * Get exam templates - WORKS OFFLINE
   * @param {string} examType - Type of exam
   * @returns {Promise} Templates
   */
  async getExamTemplates(examType) {
    return offlineWrapper.get(
      () => api.get('/ophthalmology/templates', { params: { examType } }),
      'ophthalmologyExams',
      { type: 'templates', examType },
      {
        transform: (response) => response.data,
        cacheExpiry: 86400 // 24 hours for templates
      }
    );
  },

  /**
   * Apply exam template - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @param {string} templateId - Template ID
   * @returns {Promise} Updated exam
   */
  async applyTemplate(examId, templateId) {
    const updateData = {
      templateId,
      templateAppliedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/ophthalmology/exams/${examId}/apply-template`, { templateId }),
      'UPDATE',
      'ophthalmologyExams',
      updateData,
      examId
    );
  },

  // ============================================
  // CALCULATIONS - ONLINE PREFERRED
  // ============================================

  /**
   * Calculate IOL power - ONLINE PREFERRED
   * Complex calculation that benefits from server-side processing
   * @param {string} examId - Exam ID
   * @param {string} formula - IOL formula
   * @param {number} targetRefraction - Target refraction
   * @returns {Promise} IOL calculation result
   */
  async calculateIOLPower(examId, formula, targetRefraction) {
    if (!navigator.onLine) {
      return {
        success: false,
        offline: true,
        message: 'IOL calculation requires online connectivity for accurate results',
        _mustVerifyOnline: true
      };
    }

    try {
      const response = await api.post(`/ophthalmology/exams/${examId}/iol-calculation`, {
        formula,
        targetRefraction
      });
      return response.data;
    } catch (error) {
      console.error('[OphthalmologyService] IOL calculation failed:', error);
      throw error;
    }
  },

  /**
   * Get treatment recommendations - ONLINE PREFERRED
   * @param {string} examId - Exam ID
   * @returns {Promise} Recommendations
   */
  async getTreatmentRecommendations(examId) {
    if (!navigator.onLine) {
      return {
        success: false,
        offline: true,
        message: 'Treatment recommendations require online connectivity',
        _mustVerifyOnline: true
      };
    }

    return offlineWrapper.get(
      () => api.get(`/ophthalmology/exams/${examId}/recommendations`),
      'ophthalmologyExams',
      { type: 'recommendations', examId },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600
      }
    );
  },

  // ============================================
  // REPORTS AND COMPARISONS - ONLINE ONLY
  // ============================================

  /**
   * Generate exam report - ONLINE ONLY
   * @param {string} examId - Exam ID
   * @param {string} format - Report format
   * @returns {Promise<Blob>} Report blob
   */
  async generateExamReport(examId, format = 'pdf') {
    if (!navigator.onLine) {
      throw new Error('Report generation requires online connectivity');
    }

    try {
      const response = await api.get(`/ophthalmology/exams/${examId}/report`, {
        params: { format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('[OphthalmologyService] Report generation failed:', error);
      throw error;
    }
  },

  /**
   * Compare exams - ONLINE ONLY
   * @param {string} examId1 - First exam ID
   * @param {string} examId2 - Second exam ID
   * @returns {Promise} Comparison result
   */
  async compareExams(examId1, examId2) {
    if (!navigator.onLine) {
      throw new Error('Exam comparison requires online connectivity');
    }

    try {
      const response = await api.get('/ophthalmology/exams/compare', {
        params: { exam1: examId1, exam2: examId2 }
      });
      return response.data;
    } catch (error) {
      console.error('[OphthalmologyService] Exam comparison failed:', error);
      throw error;
    }
  },

  // ============================================
  // QUICK CREATE METHODS - WORK OFFLINE
  // ============================================

  /**
   * Copy from previous refraction exam - WORKS OFFLINE
   * @param {string} patientId - Patient ID
   * @returns {Promise} New exam with previous data
   */
  async copyFromPreviousRefraction(patientId) {
    if (!navigator.onLine) {
      try {
        // Get most recent exam with refraction data
        const exams = await db.ophthalmologyExams
          .where('patientId')
          .equals(patientId)
          .filter(e => e.refraction)
          .reverse()
          .first();

        if (exams) {
          const newExam = {
            _tempId: `temp_${Date.now()}`,
            patientId,
            refraction: exams.refraction,
            status: 'in_progress',
            copiedFrom: exams.id,
            createdAt: new Date().toISOString(),
            _offline: true
          };

          await db.ophthalmologyExams.put({
            ...newExam,
            id: newExam._tempId
          });

          return { success: true, data: newExam, _fromCache: true };
        }

        return { success: false, message: 'No previous refraction found' };
      } catch (error) {
        console.error('[OphthalmologyService] Offline copy failed:', error);
        throw error;
      }
    }

    try {
      const response = await api.post(`/ophthalmology/patients/${patientId}/copy-previous-refraction`);
      return response.data;
    } catch (error) {
      console.error('[OphthalmologyService] Copy previous refraction failed:', error);
      throw error;
    }
  },

  /**
   * Create blank refraction exam - WORKS OFFLINE
   * @param {string} patientId - Patient ID
   * @returns {Promise} New blank exam
   */
  async createBlankRefraction(patientId) {
    const localData = {
      patientId,
      _tempId: `temp_${Date.now()}`,
      examType: 'refraction',
      status: 'in_progress',
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/ophthalmology/patients/${patientId}/blank-refraction`),
      'CREATE',
      'ophthalmologyExams',
      localData
    );
  },

  /**
   * Generate refraction summary - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @returns {Promise} Summary
   */
  async generateRefractionSummary(examId) {
    return offlineWrapper.mutate(
      () => api.post(`/ophthalmology/exams/${examId}/generate-refraction-summary`),
      'UPDATE',
      'ophthalmologyExams',
      { summaryGeneratedAt: new Date().toISOString() },
      examId
    );
  },

  /**
   * Generate keratometry summary - WORKS OFFLINE
   * @param {string} examId - Exam ID
   * @returns {Promise} Summary
   */
  async generateKeratometrySummary(examId) {
    return offlineWrapper.mutate(
      () => api.post(`/ophthalmology/exams/${examId}/generate-keratometry-summary`),
      'UPDATE',
      'ophthalmologyExams',
      { keratometrySummaryGeneratedAt: new Date().toISOString() },
      examId
    );
  },

  // ============================================
  // DASHBOARD AND STATISTICS - WORKS OFFLINE
  // ============================================

  /**
   * Get dashboard statistics - WORKS OFFLINE
   * @returns {Promise} Dashboard stats
   */
  async getDashboardStats() {
    if (!navigator.onLine) {
      try {
        const exams = await db.ophthalmologyExams.toArray();
        const today = new Date().toISOString().split('T')[0];

        const stats = {
          total: exams.length,
          todayCount: exams.filter(e => e.createdAt?.startsWith(today)).length,
          inProgress: exams.filter(e => e.status === 'in_progress').length,
          completed: exams.filter(e => e.status === 'completed').length,
          _computed: true,
          _offlineNote: 'Stats computed from cached data'
        };

        return { success: true, data: stats, _fromCache: true };
      } catch (error) {
        console.error('[OphthalmologyService] Offline stats failed:', error);
        return { success: false, data: {}, _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/ophthalmology/dashboard-stats'),
      'ophthalmologyExams',
      { type: 'dashboardStats' },
      {
        transform: (response) => response.data,
        cacheExpiry: 300 // 5 minutes
      }
    );
  },

  // ============================================
  // OFFLINE HELPER METHODS
  // ============================================

  /**
   * Pre-cache exams for offline use
   * @param {Object} params - Cache params
   * @returns {Promise} Cache result
   */
  async preCacheExams(params = { limit: 50 }) {
    if (!navigator.onLine) {
      console.warn('[OphthalmologyService] Cannot pre-cache while offline');
      return { success: false };
    }

    try {
      console.log('[OphthalmologyService] Pre-caching exams...');

      const response = await api.get('/ophthalmology/exams', { params });
      const exams = response.data?.data || [];

      if (exams.length > 0) {
        const timestamp = new Date().toISOString();
        const examsWithSync = exams.map(e => ({
          ...e,
          id: e._id || e.id,
          lastSync: timestamp
        }));

        await db.ophthalmologyExams.bulkPut(examsWithSync);
        console.log(`[OphthalmologyService] Pre-cached ${exams.length} exams`);
      }

      return { success: true, cached: exams.length };
    } catch (error) {
      console.error('[OphthalmologyService] Pre-cache failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get cached exam count
   * @returns {Promise<number>} Count
   */
  async getCachedExamCount() {
    return db.ophthalmologyExams.count();
  },

  /**
   * Clear cached exams
   * @returns {Promise} Clear result
   */
  async clearCache() {
    await db.ophthalmologyExams.clear();
    return { success: true };
  },

  /**
   * Get exams by patient from cache
   * @param {string} patientId - Patient ID
   * @returns {Promise} Cached exams
   */
  async getCachedPatientExams(patientId) {
    return db.ophthalmologyExams
      .where('patientId')
      .equals(patientId)
      .toArray();
  }
};

export default ophthalmologyService;
