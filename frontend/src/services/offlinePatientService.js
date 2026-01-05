/**
 * Offline-Enabled Patient Service
 * Wraps patientService with offline-first capability
 */

import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import databaseService, { db } from './database';

const offlinePatientService = {
  /**
   * Get all patients with offline fallback
   */
  async getPatients(params = {}) {
    return offlineWrapper.get(
      () => api.get('/patients', { params }),
      'patients',
      params,
      {
        transform: (response) => response.data?.data || response.data || [],
      }
    );
  },

  /**
   * Get single patient with offline fallback
   */
  async getPatient(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}`),
      'patients',
      id,
      {
        transform: (response) => response.data?.data || response.data,
      }
    );
  },

  /**
   * Create patient with offline queue
   */
  async createPatient(patientData) {
    return offlineWrapper.mutate(
      () => api.post('/patients', patientData),
      'CREATE',
      'patients',
      patientData
    );
  },

  /**
   * Update patient with offline queue
   */
  async updatePatient(id, patientData) {
    return offlineWrapper.mutate(
      () => api.put(`/patients/${id}`, patientData),
      'UPDATE',
      'patients',
      patientData,
      id
    );
  },

  /**
   * Search patients with offline fallback
   */
  async searchPatients(query, field = 'all') {
    if (!navigator.onLine) {
      // Offline search in local database
      const results = await offlineWrapper.searchCached('patients', query);
      return {
        success: true,
        data: results,
        _fromCache: true
      };
    }

    try {
      const response = await api.get('/patients/search', {
        params: { q: query, field }
      });

      // Cache results
      if (response.data?.data) {
        await offlineWrapper.cacheData('patients', response.data.data, `search:${query}`);
      }

      return {
        ...response.data,
        _fromCache: false
      };
    } catch (error) {
      // Fallback to cache
      const results = await offlineWrapper.searchCached('patients', query);
      return {
        success: true,
        data: results,
        _fromCache: true
      };
    }
  },

  /**
   * Get patient appointments with offline fallback
   */
  async getPatientAppointments(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/appointments`),
      'appointments',
      { patientId: id },
      {
        transform: (response) => response.data?.data || response.data || [],
      }
    );
  },

  /**
   * Get patient prescriptions with offline fallback
   */
  async getPatientPrescriptions(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/prescriptions`),
      'prescriptions',
      { patientId: id },
      {
        transform: (response) => response.data?.data || response.data || [],
      }
    );
  },

  /**
   * Get patient visits with offline fallback
   */
  async getPatientVisits(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/visits`),
      'visits',
      { patientId: id },
      {
        transform: (response) => response.data?.data || response.data || [],
      }
    );
  },

  /**
   * Get recent patients (frequently accessed) - useful for offline quick access
   */
  async getRecentPatients(limit = 20) {
    if (!navigator.onLine) {
      // Return most recently synced patients from cache
      const patients = await db.patients
        .orderBy('lastSync')
        .reverse()
        .limit(limit)
        .toArray();

      return {
        success: true,
        data: patients,
        _fromCache: true
      };
    }

    return offlineWrapper.get(
      () => api.get('/patients/recent', { params: { limit } }),
      'patients',
      'recent',
      {
        transform: (response) => response.data?.data || response.data || [],
      }
    );
  },

  /**
   * Get complete patient profile with offline fallback
   */
  async getCompleteProfile(id) {
    return offlineWrapper.get(
      () => api.get(`/patients/${id}/complete-profile`),
      'patients',
      `complete:${id}`,
      {
        transform: (response) => response.data?.data || response.data,
        cacheExpiry: 1800, // 30 minutes for complete profiles
      }
    );
  },

  /**
   * Pre-cache patients for offline use
   * Call this on app startup or when going into "offline mode"
   */
  async preCachePatients(options = {}) {
    const {
      limit = 100, // Number of patients to cache
      recentDays = 30, // Patients seen in last N days
    } = options;

    if (!navigator.onLine) {
      console.warn('[OfflinePatientService] Cannot pre-cache while offline');
      return { success: false, message: 'Offline' };
    }

    try {
      console.log('[OfflinePatientService] Pre-caching patients...');

      // Get recent patients
      const response = await api.get('/patients', {
        params: {
          limit,
          sort: '-lastVisit',
        }
      });

      // Safely extract array from various API response formats
      const rawPatients = response?.data?.data ?? response?.data ?? [];
      const patients = Array.isArray(rawPatients) ? rawPatients : [];

      // Cache them
      if (patients.length > 0) {
        await databaseService.bulkSave('patients', patients);
        console.log(`[OfflinePatientService] Cached ${patients.length} patients`);
      }

      return {
        success: true,
        cached: patients.length
      };
    } catch (error) {
      console.error('[OfflinePatientService] Pre-cache failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all locally cached patients
   */
  async getCachedPatients() {
    return db.patients.toArray();
  },

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    const patientCount = await db.patients.count();
    const appointmentCount = await db.appointments.count();
    const prescriptionCount = await db.prescriptions.count();

    return {
      patients: patientCount,
      appointments: appointmentCount,
      prescriptions: prescriptionCount,
    };
  },

  /**
   * Clear patient cache
   */
  async clearCache() {
    await db.patients.clear();
    console.log('[OfflinePatientService] Cache cleared');
  },

  // ============ Pass-through methods for online-only operations ============

  async deletePatient(id) {
    return offlineWrapper.mutate(
      () => api.delete(`/patients/${id}`),
      'DELETE',
      'patients',
      {},
      id
    );
  },

  async uploadPatientPhoto(id, file) {
    // File uploads require online
    if (!navigator.onLine) {
      throw new Error('Photo upload requires internet connection');
    }

    const formData = new FormData();
    formData.append('photo', file);

    const response = await api.post(`/patients/${id}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  async addPatientAllergy(id, allergyData) {
    return offlineWrapper.mutate(
      () => api.post(`/patients/${id}/allergies`, allergyData),
      'UPDATE',
      'patients',
      { allergies: allergyData },
      id
    );
  },

  async addPatientMedication(id, medicationData) {
    return offlineWrapper.mutate(
      () => api.post(`/patients/${id}/medications`, medicationData),
      'UPDATE',
      'patients',
      { medications: medicationData },
      id
    );
  },
};

export default offlinePatientService;
