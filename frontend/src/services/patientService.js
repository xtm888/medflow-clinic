import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

/**
 * Patient Service - Offline-First
 * Handles all patient API calls with offline support
 * Patient data is cached for offline access and syncs when connection is restored
 */

const patientService = {
  /**
   * Get all patients with pagination - WORKS OFFLINE
   * @param {Object} params - Query parameters (page, limit, etc.)
   * @returns {Promise} Patients list with pagination
   */
  async getPatients(params = {}) {
    return offlineWrapper.get(
      () => api.get('/patients', { params }),
      'patients',
      params,
      {
        transform: (response) => response.data,
        cacheExpiry: 3600 // 1 hour cache for patient list
      }
    );
  },

  /**
   * Get single patient - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @returns {Promise} Patient data
   */
  async getPatient(id) {
    const response = await offlineWrapper.get(
      () => api.get(`/patients/${id}`),
      'patients',
      id,
      {
        transform: (response) => response.data,
        cacheExpiry: 1800 // 30 minutes for individual patient
      }
    );

    // Normalize response structure
    // Backend returns: { success: true, data: patient }
    // Axios wraps it: { data: { success: true, data: patient } }
    const result = response.data || response;
    const patient = result.data || result;

    return { data: patient, _fromCache: response._fromCache };
  },

  /**
   * Create new patient - WORKS OFFLINE
   * @param {Object} patientData - Patient data
   * @returns {Promise} Created patient
   */
  async createPatient(patientData) {
    // Generate temporary ID for offline creation
    const localData = {
      ...patientData,
      _tempId: `temp_${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    return offlineWrapper.mutate(
      () => api.post('/patients', patientData),
      'CREATE',
      'patients',
      localData
    );
  },

  /**
   * Update patient - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @param {Object} patientData - Updated patient data
   * @returns {Promise} Updated patient
   */
  async updatePatient(id, patientData) {
    const updateData = {
      ...patientData,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/patients/${id}`, patientData),
      'UPDATE',
      'patients',
      updateData,
      id
    );
  },

  /**
   * Delete patient (soft delete) - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @returns {Promise} Confirmation
   */
  async deletePatient(id) {
    return offlineWrapper.mutate(
      () => api.delete(`/patients/${id}`),
      'DELETE',
      'patients',
      { deletedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Get patient medical history - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @returns {Promise} Medical history
   */
  async getPatientHistory(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/history`),
      'patients',
      { type: 'history', patientId: id },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Get patient appointments - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @returns {Promise} Patient appointments
   */
  async getPatientAppointments(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/appointments`),
      'appointments',
      { patientId: id },
      {
        transform: (response) => response.data,
        cacheExpiry: 300 // 5 minutes for appointments
      }
    );
  },

  /**
   * Get patient prescriptions - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @returns {Promise} Patient prescriptions
   */
  async getPatientPrescriptions(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/prescriptions`),
      'prescriptions',
      { patientId: id },
      {
        transform: (response) => response.data,
        cacheExpiry: 600 // 10 minutes
      }
    );
  },

  /**
   * Search patients - WORKS OFFLINE (local search)
   * @param {string} query - Search query
   * @param {string} field - Field to search (default: 'all')
   * @returns {Promise} Matching patients
   */
  async searchPatients(query, field = 'all') {
    // If offline, search local cache
    if (!navigator.onLine) {
      try {
        const lowerQuery = query.toLowerCase();
        const patients = await db.patients.toArray();

        const filtered = patients.filter(patient => {
          if (field === 'all') {
            return (
              patient.firstName?.toLowerCase().includes(lowerQuery) ||
              patient.lastName?.toLowerCase().includes(lowerQuery) ||
              patient.patientId?.toLowerCase().includes(lowerQuery) ||
              patient.email?.toLowerCase().includes(lowerQuery) ||
              patient.phoneNumber?.includes(query) ||
              patient.nationalId?.includes(query)
            );
          }
          return patient[field]?.toString().toLowerCase().includes(lowerQuery);
        });

        return {
          success: true,
          data: filtered.slice(0, 50), // Limit results
          _fromCache: true
        };
      } catch (error) {
        console.error('[PatientService] Offline search failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/patients/search', { params: { q: query, field } }),
      'patients',
      { type: 'search', query, field },
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  /**
   * Search by legacy ID or folder ID - WORKS OFFLINE (limited)
   * @param {string} legacyId - Legacy ID or folder ID
   * @returns {Promise} Matching patients
   */
  async searchByLegacyId(legacyId) {
    // If offline, search local cache
    if (!navigator.onLine) {
      try {
        const patients = await db.patients.toArray();
        const filtered = patients.filter(patient =>
          patient.legacyId?.toLowerCase().includes(legacyId.toLowerCase()) ||
          patient.legacyPatientNumber?.toLowerCase().includes(legacyId.toLowerCase()) ||
          patient.folderIds?.some(f => f.folderId?.toLowerCase().includes(legacyId.toLowerCase()))
        );

        return {
          success: true,
          data: filtered,
          _fromCache: true
        };
      } catch (error) {
        console.error('[PatientService] Offline legacy search failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get(`/patients/search/legacy/${encodeURIComponent(legacyId)}`),
      'patients',
      { type: 'legacySearch', legacyId },
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  /**
   * Get patients with legacy data linked - ONLINE ONLY
   * @param {Object} params - Query params
   * @returns {Promise} Patients with legacy data
   */
  async getPatientsWithLegacyData(params = {}) {
    return offlineWrapper.get(
      () => api.get('/patients/with-legacy-data', { params }),
      'patients',
      { type: 'withLegacyData', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Link folder to patient - ONLINE ONLY
   * @param {string} patientId - Patient ID
   * @param {Object} folderData - Folder data
   * @returns {Promise} Updated patient
   */
  async linkFolderToPatient(patientId, folderData) {
    if (!navigator.onLine) {
      throw new Error('Linking folder requires internet connection.');
    }

    try {
      const response = await api.post(`/patients/${patientId}/link-folder`, folderData);
      return response.data;
    } catch (error) {
      console.error('Error linking folder:', error);
      throw error;
    }
  },

  /**
   * Unlink folder from patient - ONLINE ONLY
   * @param {string} patientId - Patient ID
   * @param {string} folderId - Folder ID to unlink
   * @returns {Promise} Updated patient
   */
  async unlinkFolderFromPatient(patientId, folderId) {
    if (!navigator.onLine) {
      throw new Error('Unlinking folder requires internet connection.');
    }

    try {
      const response = await api.delete(`/patients/${patientId}/unlink-folder/${folderId}`);
      return response.data;
    } catch (error) {
      console.error('Error unlinking folder:', error);
      throw error;
    }
  },

  /**
   * Upload patient document - ONLINE ONLY
   * @param {string} patientId - Patient ID
   * @param {Object} document - Document data
   * @returns {Promise} Upload result
   */
  async uploadDocument(patientId, document) {
    if (!navigator.onLine) {
      throw new Error('Document upload requires internet connection. Please try again when online.');
    }

    try {
      const response = await api.post(`/patients/${patientId}/documents`, document);
      return response.data;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  },

  /**
   * Get patient visits - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @returns {Promise} Patient visits
   */
  async getPatientVisits(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/visits`),
      'visits',
      { patientId: id },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Get patient allergies - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @returns {Promise} Patient allergies
   */
  async getPatientAllergies(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/allergies`),
      'patients',
      { type: 'allergies', patientId: id },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Add patient allergy - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @param {Object} allergyData - Allergy data
   * @returns {Promise} Added allergy
   */
  async addPatientAllergy(id, allergyData) {
    const localData = {
      ...allergyData,
      patientId: id,
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/patients/${id}/allergies`, allergyData),
      'CREATE',
      'patients',
      localData,
      id
    );
  },

  /**
   * Update patient allergy - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @param {string} allergyId - Allergy ID
   * @param {Object} allergyData - Updated allergy data
   * @returns {Promise} Updated allergy
   */
  async updatePatientAllergy(id, allergyId, allergyData) {
    return offlineWrapper.mutate(
      () => api.put(`/patients/${id}/allergies/${allergyId}`, allergyData),
      'UPDATE',
      'patients',
      { ...allergyData, updatedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Delete patient allergy - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @param {string} allergyId - Allergy ID
   * @returns {Promise} Confirmation
   */
  async deletePatientAllergy(id, allergyId) {
    return offlineWrapper.mutate(
      () => api.delete(`/patients/${id}/allergies/${allergyId}`),
      'DELETE',
      'patients',
      { allergyId, deletedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Get patient medications - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @returns {Promise} Patient medications
   */
  async getPatientMedications(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/medications`),
      'patients',
      { type: 'medications', patientId: id },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Add patient medication - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @param {Object} medicationData - Medication data
   * @returns {Promise} Added medication
   */
  async addPatientMedication(id, medicationData) {
    const localData = {
      ...medicationData,
      patientId: id,
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/patients/${id}/medications`, medicationData),
      'CREATE',
      'patients',
      localData,
      id
    );
  },

  /**
   * Update patient medication - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @param {string} medicationId - Medication ID
   * @param {Object} medicationData - Updated medication data
   * @returns {Promise} Updated medication
   */
  async updatePatientMedication(id, medicationId, medicationData) {
    return offlineWrapper.mutate(
      () => api.put(`/patients/${id}/medications/${medicationId}`, medicationData),
      'UPDATE',
      'patients',
      { ...medicationData, updatedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Delete patient medication - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @param {string} medicationId - Medication ID
   * @returns {Promise} Confirmation
   */
  async deletePatientMedication(id, medicationId) {
    return offlineWrapper.mutate(
      () => api.delete(`/patients/${id}/medications/${medicationId}`),
      'DELETE',
      'patients',
      { medicationId, deletedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Get patient insurance - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @returns {Promise} Patient insurance
   */
  async getPatientInsurance(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/insurance`),
      'patients',
      { type: 'insurance', patientId: id },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600
      }
    );
  },

  /**
   * Update patient insurance - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @param {Object} insuranceData - Insurance data
   * @returns {Promise} Updated insurance
   */
  async updatePatientInsurance(id, insuranceData) {
    return offlineWrapper.mutate(
      () => api.put(`/patients/${id}/insurance`, insuranceData),
      'UPDATE',
      'patients',
      { ...insuranceData, updatedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Get patient lab results - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @returns {Promise} Lab results
   */
  async getPatientLabResults(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/lab-results`),
      'patients',
      { type: 'labResults', patientId: id },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Get patient correspondence - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @returns {Promise} Correspondence
   */
  async getPatientCorrespondence(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/correspondence`),
      'patients',
      { type: 'correspondence', patientId: id },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Get patient billing information - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @returns {Promise} Billing info
   */
  async getPatientBilling(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/billing`),
      'patients',
      { type: 'billing', patientId: id },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Get patient timeline - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @param {Object} params - Query params
   * @returns {Promise} Timeline data
   */
  async getPatientTimeline(id, params = {}) {
    return offlineWrapper.get(
      () => api.get(`/visits/timeline/${id}`, { params }),
      'visits',
      { type: 'timeline', patientId: id, ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Get complete patient profile - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @returns {Promise} Complete profile
   */
  async getCompleteProfile(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/complete-profile`),
      'patients',
      { type: 'completeProfile', patientId: id },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Get patient medical issues - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @param {Object} params - Query params
   * @returns {Promise} Medical issues
   */
  async getMedicalIssues(id, params = {}) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/medical-issues`, { params }),
      'patients',
      { type: 'medicalIssues', patientId: id, ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Update medical issue status - WORKS OFFLINE
   * @param {string} patientId - Patient ID
   * @param {string} issueId - Issue ID
   * @param {Object} data - Update data
   * @returns {Promise} Updated issue
   */
  async updateMedicalIssue(patientId, issueId, data) {
    return offlineWrapper.mutate(
      () => api.put(`/patients/${patientId}/medical-issues/${issueId}`, data),
      'UPDATE',
      'patients',
      { ...data, updatedAt: new Date().toISOString() },
      patientId
    );
  },

  /**
   * Get all providers who treated patient - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @returns {Promise} Providers list
   */
  async getPatientProviders(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/providers`),
      'patients',
      { type: 'providers', patientId: id },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600
      }
    );
  },

  /**
   * Get patient audit trail - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @param {Object} params - Query params
   * @returns {Promise} Audit trail
   */
  async getPatientAudit(id, params = {}) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/audit`, { params }),
      'patients',
      { type: 'audit', patientId: id, ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Get patient statistics - WORKS OFFLINE
   * @param {string} id - Patient ID
   * @returns {Promise} Statistics
   */
  async getPatientStatistics(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/statistics`),
      'patients',
      { type: 'statistics', patientId: id },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Upload patient photo - ONLINE ONLY
   * @param {string} id - Patient ID
   * @param {File} file - Photo file
   * @returns {Promise} Upload result
   */
  async uploadPatientPhoto(id, file) {
    if (!navigator.onLine) {
      throw new Error('Photo upload requires internet connection. Please try again when online.');
    }

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

  /**
   * Get patient by MRN - WORKS OFFLINE
   * @param {string} mrn - Medical Record Number
   * @returns {Promise} Patient data
   */
  async getPatientByMRN(mrn) {
    // If offline, search local cache
    if (!navigator.onLine) {
      try {
        const patient = await db.patients
          .where('patientId')
          .equals(mrn)
          .first();

        if (patient) {
          return { success: true, data: patient, _fromCache: true };
        }
        return { success: false, data: null, _fromCache: true };
      } catch (error) {
        console.error('[PatientService] Offline MRN search failed:', error);
        throw error;
      }
    }

    return offlineWrapper.get(
      () => api.get(`/patients/mrn/${mrn}`),
      'patients',
      { type: 'mrn', mrn },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Get recent patients - WORKS OFFLINE
   * @param {number} limit - Number of patients to return
   * @returns {Promise} Recent patients
   */
  async getRecentPatients(limit = 10) {
    // If offline, get from local cache sorted by last visit
    if (!navigator.onLine) {
      try {
        const patients = await db.patients
          .orderBy('lastSync')
          .reverse()
          .limit(limit)
          .toArray();

        return { success: true, data: patients, _fromCache: true };
      } catch (error) {
        console.error('[PatientService] Offline recent patients failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/patients/recent', { params: { limit } }),
      'patients',
      { type: 'recent', limit },
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  /**
   * Advanced search with filters - WORKS OFFLINE (limited)
   * @param {Object} params - Search parameters
   * @returns {Promise} Matching patients
   */
  async advancedSearch(params = {}) {
    // If offline, perform limited local search
    if (!navigator.onLine) {
      try {
        let patients = await db.patients.toArray();

        // Apply filters
        if (params.firstName) {
          patients = patients.filter(p =>
            p.firstName?.toLowerCase().includes(params.firstName.toLowerCase())
          );
        }
        if (params.lastName) {
          patients = patients.filter(p =>
            p.lastName?.toLowerCase().includes(params.lastName.toLowerCase())
          );
        }
        if (params.dateOfBirth) {
          patients = patients.filter(p => p.dateOfBirth === params.dateOfBirth);
        }
        if (params.phoneNumber) {
          patients = patients.filter(p =>
            p.phoneNumber?.includes(params.phoneNumber)
          );
        }

        return {
          success: true,
          data: patients.slice(0, 50),
          _fromCache: true,
          _limitedSearch: true
        };
      } catch (error) {
        console.error('[PatientService] Offline advanced search failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/patients/advanced-search', { params }),
      'patients',
      { type: 'advancedSearch', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  /**
   * Check for duplicate patients - ONLINE ONLY
   * @param {Object} patientData - Patient data to check
   * @returns {Promise} Duplicate check result
   */
  async checkDuplicates(patientData = {}) {
    if (!navigator.onLine) {
      // Perform basic offline duplicate check
      try {
        const patients = await db.patients.toArray();
        const duplicates = patients.filter(p =>
          (patientData.firstName && patientData.lastName &&
           p.firstName?.toLowerCase() === patientData.firstName.toLowerCase() &&
           p.lastName?.toLowerCase() === patientData.lastName.toLowerCase()) ||
          (patientData.nationalId && p.nationalId === patientData.nationalId) ||
          (patientData.phoneNumber && p.phoneNumber === patientData.phoneNumber)
        );

        return {
          success: true,
          data: { duplicates, count: duplicates.length },
          _fromCache: true,
          _limitedCheck: true
        };
      } catch (error) {
        console.error('[PatientService] Offline duplicate check failed:', error);
        return { success: false, data: { duplicates: [], count: 0 }, _fromCache: true };
      }
    }

    try {
      const response = await api.post('/patients/check-duplicates', patientData);
      return response.data;
    } catch (error) {
      console.error('Error checking duplicates:', error);
      throw error;
    }
  },

  /**
   * Merge duplicate patients - ONLINE ONLY
   * @param {string} primaryId - Primary patient ID
   * @param {string} secondaryId - Secondary patient ID to merge
   * @returns {Promise} Merge result
   */
  async mergePatients(primaryId, secondaryId) {
    if (!navigator.onLine) {
      throw new Error('Merging patients requires internet connection. This is a critical operation that must be performed online.');
    }

    try {
      const response = await api.post('/patients/merge', { primaryId, secondaryId });
      return response.data;
    } catch (error) {
      console.error('Error merging patients:', error);
      throw error;
    }
  },

  /**
   * Export patients - ONLINE ONLY
   * @param {string} format - Export format (csv, json)
   * @param {Object} filters - Export filters
   * @returns {Promise} Export data
   */
  async exportPatients(format = 'csv', filters = {}) {
    if (!navigator.onLine) {
      throw new Error('Exporting patients requires internet connection.');
    }

    try {
      const response = await api.get('/patients/export', {
        params: { format, ...filters },
        responseType: format === 'csv' ? 'blob' : 'json'
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting patients:', error);
      throw error;
    }
  },

  // ==========================================
  // OFFLINE HELPER METHODS
  // ==========================================

  /**
   * Pre-cache patients for offline use
   * Should be called on app startup when online
   * @param {Object} params - Cache parameters
   * @returns {Promise} Cache result
   */
  async preCachePatients(params = { limit: 100 }) {
    if (!navigator.onLine) {
      console.warn('[PatientService] Cannot pre-cache while offline');
      return { success: false };
    }

    try {
      console.log('[PatientService] Pre-caching patients...');

      // Get recent/frequently accessed patients
      const response = await api.get('/patients', { params });
      const patients = response.data?.data || response.data?.patients || [];

      if (patients.length > 0) {
        const timestamp = new Date().toISOString();
        const patientsWithSync = patients.map(patient => ({
          ...patient,
          id: patient._id || patient.id,
          lastSync: timestamp
        }));

        await db.patients.bulkPut(patientsWithSync);
        console.log(`[PatientService] Pre-cached ${patients.length} patients`);
      }

      return { success: true, cached: patients.length };
    } catch (error) {
      console.error('[PatientService] Pre-cache failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get locally cached patients
   * @returns {Promise<Array>} Cached patients
   */
  async getCachedPatients() {
    return db.patients.toArray();
  },

  /**
   * Get cached patient count
   * @returns {Promise<number>} Count of cached patients
   */
  async getCachedPatientCount() {
    return db.patients.count();
  },

  /**
   * Clear patient cache
   * @returns {Promise} Clear result
   */
  async clearPatientCache() {
    return db.patients.clear();
  }
};

export default patientService;
