import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import db from './database';

// Online check helper
const isOnline = () => navigator.onLine;

const requireOnline = (operation) => {
  if (!isOnline()) {
    throw new Error(`${operation} nécessite une connexion internet pour la sécurité du patient.`);
  }
};

const ivtVialService = {
  // ============================================
  // READ OPERATIONS - Offline-enabled
  // ============================================

  // Get all vials
  getAll: async (params = {}) => {
    return offlineWrapper.get(
      () => api.get('/ivt-vials', { params }),
      'ivtVials',
      `list_${JSON.stringify(params)}`,
      { cacheTime: 15 * 60 * 1000 } // 15 minutes
    );
  },

  // Get single vial
  getById: async (id) => {
    return offlineWrapper.get(
      () => api.get(`/ivt-vials/${id}`),
      'ivtVials',
      id,
      { cacheTime: 15 * 60 * 1000 } // 15 minutes
    );
  },

  // Get usable vials for a medication
  getUsableVials: async (medication) => {
    return offlineWrapper.get(
      () => api.get(`/ivt-vials/usable/${medication}`),
      'ivtVials',
      `usable_${medication}`,
      { cacheTime: 10 * 60 * 1000 } // 10 minutes (shorter cache for active vials)
    );
  },

  // Get expiring vials
  getExpiringVials: async (hoursAhead = 4) => {
    return offlineWrapper.get(
      () => api.get('/ivt-vials/expiring', { params: { hoursAhead } }),
      'ivtVials',
      `expiring_${hoursAhead}`,
      { cacheTime: 5 * 60 * 1000 } // 5 minutes (critical info)
    );
  },

  // Get temperature excursions
  getTemperatureExcursions: async (params = {}) => {
    return offlineWrapper.get(
      () => api.get('/ivt-vials/temperature-excursions', { params }),
      'ivtVials',
      `temp_excursions_${JSON.stringify(params)}`,
      { cacheTime: 30 * 60 * 1000 } // 30 minutes
    );
  },

  // Get statistics
  getStats: async () => {
    return offlineWrapper.get(
      () => api.get('/ivt-vials/stats'),
      'ivtVials',
      'stats',
      { cacheTime: 15 * 60 * 1000 } // 15 minutes
    );
  },

  // ============================================
  // WRITE OPERATIONS - ONLINE ONLY (Patient Safety)
  // ============================================

  // Create new vial (receive from inventory) - ONLINE ONLY
  create: async (data) => {
    requireOnline('Créer un flacon IVT');
    const response = await api.post('/ivt-vials', data);
    return response.data;
  },

  // Open vial - ONLINE ONLY (starts expiry timer)
  openVial: async (id) => {
    requireOnline('Ouvrir un flacon IVT');
    const response = await api.post(`/ivt-vials/${id}/open`);
    return response.data;
  },

  // Record dose - ONLINE ONLY (critical for patient safety)
  recordDose: async (id, doseData) => {
    requireOnline('Enregistrer une dose IVT');
    const response = await api.post(`/ivt-vials/${id}/dose`, doseData);
    return response.data;
  },

  // Record temperature - ONLINE ONLY (audit trail)
  recordTemperature: async (id, temperatureData) => {
    requireOnline('Enregistrer la température du flacon');
    const response = await api.post(`/ivt-vials/${id}/temperature`, temperatureData);
    return response.data;
  },

  // Dispose vial - ONLINE ONLY (audit trail)
  dispose: async (id, disposalData) => {
    requireOnline('Éliminer un flacon IVT');
    const response = await api.post(`/ivt-vials/${id}/dispose`, disposalData);
    return response.data;
  },

  // ============================================
  // OFFLINE HELPERS
  // ============================================

  /**
   * Pre-cache active vials for the day/shift
   * Call this when IVT nurse/doctor logs in
   */
  preCacheForShift: async () => {
    if (!isOnline()) {
      return { cached: 0 };
    }

    try {
      // Cache all active/usable vials and critical info
      const results = await Promise.allSettled([
        api.get('/ivt-vials', { params: { status: 'active' } }),
        api.get('/ivt-vials/expiring', { params: { hoursAhead: 4 } }),
        api.get('/ivt-vials/stats')
      ]);

      let cachedCount = 0;

      // Cache active vials
      if (results[0].status === 'fulfilled' && results[0].value?.data?.data) {
        const vials = results[0].value.data.data;
        if (vials.length > 0) {
          await db.ivtVials.bulkPut(vials);
          cachedCount += vials.length;
        }
      }

      // Cache expiring vials
      if (results[1].status === 'fulfilled' && results[1].value?.data?.data) {
        const expiringVials = results[1].value.data.data;
        if (expiringVials.length > 0) {
          await db.ivtVials.bulkPut(expiringVials);
        }
      }

      return { cached: cachedCount };
    } catch (error) {
      console.error('[IVTVialService] Pre-cache failed:', error);
      return { cached: 0, error: error.message };
    }
  },

  /**
   * Check vial availability offline (READ-ONLY reference)
   * WARNING: This is cached data - always verify online before actual use
   */
  checkVialOffline: async (id) => {
    const vial = await db.ivtVials.get(id);
    if (!vial) return null;

    // Add warning that this is cached data
    return {
      ...vial,
      _cachedData: true,
      _warning: 'Données en cache - vérifiez en ligne avant utilisation'
    };
  },

  /**
   * Get cached vial count (offline-safe)
   */
  getCachedCount: async () => {
    try {
      return await db.ivtVials.count();
    } catch (error) {
      console.error('[IVTVialService] Error getting cached count:', error);
      return 0;
    }
  },

  /**
   * Search vials in local cache (offline-safe reference)
   * WARNING: Always verify online before using vials
   */
  searchOffline: async (medication) => {
    try {
      const items = await db.ivtVials.toArray();

      if (medication) {
        return items.filter(vial =>
          vial.medication?.toLowerCase().includes(medication.toLowerCase()) &&
          vial.status === 'active'
        );
      }

      return items.filter(vial => vial.status === 'active');
    } catch (error) {
      console.error('[IVTVialService] Error searching offline:', error);
      return [];
    }
  }
};

export default ivtVialService;
