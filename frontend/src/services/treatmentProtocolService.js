import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import db from './database';

const treatmentProtocolService = {
  // ============================================
  // READ OPERATIONS (OFFLINE-CAPABLE)
  // ============================================

  /**
   * Get user's treatment protocols (personal + system-wide)
   * WORKS OFFLINE - cached for 30 minutes
   */
  async getTreatmentProtocols(params = {}) {
    const cacheKey = `protocols_${JSON.stringify(params)}`;
    return offlineWrapper.get(
      () => api.get('/treatment-protocols', { params }),
      'treatmentProtocols',
      cacheKey,
      { transform: r => r.data, cacheExpiry: 1800 }
    );
  },

  /**
   * Get popular treatment protocols
   * WORKS OFFLINE - cached for 1 hour (stable list)
   */
  async getPopularProtocols(limit = 10) {
    return offlineWrapper.get(
      () => api.get('/treatment-protocols/popular', { params: { limit } }),
      'treatmentProtocols',
      `popular_${limit}`,
      { transform: r => r.data, cacheExpiry: 3600 }
    );
  },

  /**
   * Get user's favorite protocols
   * WORKS OFFLINE - cached for 30 minutes
   */
  async getFavoriteProtocols() {
    return offlineWrapper.get(
      () => api.get('/treatment-protocols/favorites'),
      'treatmentProtocols',
      'favorites',
      { transform: r => r.data, cacheExpiry: 1800 }
    );
  },

  /**
   * Get single treatment protocol
   * WORKS OFFLINE - cached for 30 minutes
   */
  async getTreatmentProtocol(id) {
    return offlineWrapper.get(
      () => api.get(`/treatment-protocols/${id}`),
      'treatmentProtocols',
      id,
      { transform: r => r.data, cacheExpiry: 1800 }
    );
  },

  // ============================================
  // WRITE OPERATIONS (ONLINE-ONLY)
  // ============================================

  /**
   * Create new treatment protocol
   * ONLINE-ONLY - Requires medical review and approval
   */
  async createTreatmentProtocol(protocolData) {
    if (!navigator.onLine) {
      throw new Error('La création de protocoles nécessite une connexion internet pour la validation médicale.');
    }
    const response = await api.post('/treatment-protocols', protocolData);
    return response.data;
  },

  /**
   * Update treatment protocol
   * ONLINE-ONLY - Requires approval workflow
   */
  async updateTreatmentProtocol(id, protocolData) {
    if (!navigator.onLine) {
      throw new Error('La modification de protocoles nécessite une connexion internet pour la validation médicale.');
    }
    const response = await api.put(`/treatment-protocols/${id}`, protocolData);
    return response.data;
  },

  /**
   * Delete treatment protocol
   * ONLINE-ONLY - Requires audit trail
   */
  async deleteTreatmentProtocol(id) {
    if (!navigator.onLine) {
      throw new Error('La suppression de protocoles nécessite une connexion internet pour la traçabilité.');
    }
    const response = await api.delete(`/treatment-protocols/${id}`);
    return response.data;
  },

  // ============================================
  // USAGE TRACKING (QUEUED OFFLINE)
  // ============================================

  /**
   * Increment usage count
   * WORKS OFFLINE - queued for sync (not critical)
   */
  async incrementUsage(id) {
    const localData = { protocolId: id, usedAt: new Date().toISOString() };
    return offlineWrapper.mutate(
      () => api.post(`/treatment-protocols/${id}/use`),
      'UPDATE',
      'treatmentProtocols',
      localData
    );
  },

  /**
   * Toggle favorite status
   * WORKS OFFLINE - queued for sync (user preference)
   */
  async toggleFavorite(id) {
    const localData = { protocolId: id, toggledAt: new Date().toISOString() };
    return offlineWrapper.mutate(
      () => api.post(`/treatment-protocols/${id}/favorite`),
      'UPDATE',
      'treatmentProtocols',
      localData
    );
  },

  // ============================================
  // OFFLINE HELPERS
  // ============================================

  /**
   * Pre-cache protocols for clinical shift
   * WORKS OFFLINE - populates cache for consultation access
   */
  async preCacheForShift() {
    if (!navigator.onLine) return { cached: 0 };
    try {
      const [protocols, popular, favorites] = await Promise.all([
        this.getTreatmentProtocols({ limit: 200 }),
        this.getPopularProtocols(50),
        this.getFavoriteProtocols()
      ]);
      return {
        cached: (protocols?.length || 0) + (popular?.length || 0) + (favorites?.length || 0),
        protocols: protocols?.length || 0,
        popular: popular?.length || 0,
        favorites: favorites?.length || 0
      };
    } catch (error) {
      console.error('Treatment protocol pre-cache failed:', error);
      return { cached: 0, error: error.message };
    }
  },

  /**
   * Search protocols offline
   * WORKS OFFLINE - searches IndexedDB cache
   */
  async searchProtocolsOffline(query) {
    try {
      if (!db.treatmentProtocols) return [];
      const allProtocols = await db.treatmentProtocols.toArray();
      const searchLower = query.toLowerCase();
      return allProtocols.filter(protocol =>
        protocol.name?.toLowerCase().includes(searchLower) ||
        protocol.diagnosis?.toLowerCase().includes(searchLower) ||
        protocol.category?.toLowerCase().includes(searchLower)
      );
    } catch (error) {
      console.error('Offline protocol search failed:', error);
      return [];
    }
  },

  /**
   * Get cached protocol count
   * WORKS OFFLINE - returns count from IndexedDB
   */
  async getCachedCount() {
    try {
      if (!db.treatmentProtocols) return 0;
      return await db.treatmentProtocols.count();
    } catch {
      return 0;
    }
  },

  // ============================================
  // STUDIOVISION PARITY - ENHANCED METHODS
  // ============================================

  /**
   * Get all protocol categories with counts
   * WORKS OFFLINE - cached for 1 hour
   */
  async getCategories() {
    return offlineWrapper.get(
      () => api.get('/treatment-protocols/categories'),
      'treatmentProtocols',
      'categories',
      { transform: r => r.data, cacheExpiry: 3600 }
    );
  },

  /**
   * Get protocols by category
   * WORKS OFFLINE - cached for 30 minutes
   */
  async getProtocolsByCategory(category, includePersonal = true) {
    const cacheKey = `category_${category}_${includePersonal}`;
    return offlineWrapper.get(
      () => api.get(`/treatment-protocols/category/${category}`, {
        params: { includePersonal }
      }),
      'treatmentProtocols',
      cacheKey,
      { transform: r => r.data, cacheExpiry: 1800 }
    );
  },

  /**
   * Get protocols for a specific diagnosis (ICD code)
   * WORKS OFFLINE - cached for 30 minutes
   */
  async getProtocolsForDiagnosis(icdCode) {
    const cacheKey = `diagnosis_${icdCode}`;
    return offlineWrapper.get(
      () => api.get(`/treatment-protocols/diagnosis/${encodeURIComponent(icdCode)}`),
      'treatmentProtocols',
      cacheKey,
      { transform: r => r.data, cacheExpiry: 1800 }
    );
  },

  /**
   * Apply protocol - Get prescription-ready medications
   * WORKS OFFLINE - uses cached protocol if available
   * StudioVision "2-Click" prescription workflow
   */
  async applyProtocol(protocolId, options = {}) {
    const { eye, patientId } = options;

    // Try online first
    if (navigator.onLine) {
      try {
        const response = await api.post(`/treatment-protocols/${protocolId}/apply`, {
          eye,
          patientId
        });
        return response.data;
      } catch (error) {
        console.warn('Online applyProtocol failed, trying offline fallback:', error);
      }
    }

    // Offline fallback - get cached protocol and format locally
    try {
      const protocol = await this.getTreatmentProtocol(protocolId);
      if (!protocol?.data) {
        throw new Error('Protocol not found in cache');
      }

      // Format medications for prescription
      const medications = (protocol.data.medications || []).map((med, index) => ({
        drugId: med.medicationTemplate || med.drugId,
        name: med.drugName || 'Unknown',
        genericName: med.genericName,
        dosage: med.dosage?.frequency || med.posologie?.text || 'As directed',
        frequency: med.dosage?.frequencyCode || med.dosage?.frequency,
        eye: eye || med.dosage?.eye || 'OU',
        duration: med.dosage?.duration
          ? `${med.dosage.duration.value} ${med.dosage.duration.unit}`
          : med.duration?.text || 'Until follow-up',
        instructions: med.instructions || '',
        quantity: med.quantity || 1,
        refills: med.refills || 0,
        orderIndex: med.order || index,
        waitTimeAfter: med.waitTimeAfter || 5,
        isFromProtocol: true,
        protocolId: protocol.data._id,
        protocolName: protocol.data.name,
        taper: med.taper?.enabled ? med.taper : null
      }));

      return {
        success: true,
        message: `Protocol "${protocol.data.name}" applied (offline)`,
        data: {
          protocol: {
            id: protocol.data._id,
            name: protocol.data.name,
            nameFr: protocol.data.nameFr,
            category: protocol.data.category,
            description: protocol.data.description
          },
          medications,
          expectedDuration: protocol.data.expectedDuration,
          contraindications: protocol.data.contraindications || [],
          offlineApplied: true
        }
      };
    } catch (cacheError) {
      throw new Error('Protocol non disponible hors ligne. Veuillez vous connecter.');
    }
  },

  /**
   * Duplicate a protocol for personalization
   * ONLINE-ONLY - creates new record
   */
  async duplicateProtocol(protocolId, customName = null) {
    if (!navigator.onLine) {
      throw new Error('La duplication de protocoles nécessite une connexion internet.');
    }
    const response = await api.post(`/treatment-protocols/${protocolId}/duplicate`, {
      name: customName
    });
    return response.data;
  },

  /**
   * Get suggested protocols based on diagnosis/reason for visit
   * Intelligent protocol matching for "2-click" workflow
   */
  async getSuggestedProtocols(context = {}) {
    const { diagnoses = [], chiefComplaint, appointmentType } = context;

    // Collect protocols from multiple sources
    const suggestions = [];

    // 1. Get protocols for each diagnosis
    for (const diagnosis of diagnoses.slice(0, 3)) { // Limit to first 3
      const icdCode = diagnosis.icdCode || diagnosis.code;
      if (icdCode) {
        try {
          const result = await this.getProtocolsForDiagnosis(icdCode);
          if (result?.data) {
            suggestions.push(...result.data.map(p => ({
              ...p,
              matchReason: `Matches diagnosis: ${diagnosis.description || icdCode}`
            })));
          }
        } catch (e) {
          console.warn(`Failed to get protocols for ${icdCode}:`, e);
        }
      }
    }

    // 2. Get popular protocols as fallback
    if (suggestions.length < 5) {
      try {
        const popular = await this.getPopularProtocols(10 - suggestions.length);
        if (popular?.data) {
          suggestions.push(...popular.data.map(p => ({
            ...p,
            matchReason: 'Frequently used'
          })));
        }
      } catch (e) {
        console.warn('Failed to get popular protocols:', e);
      }
    }

    // Remove duplicates
    const uniqueProtocols = suggestions.reduce((acc, protocol) => {
      if (!acc.find(p => p._id === protocol._id)) {
        acc.push(protocol);
      }
      return acc;
    }, []);

    return {
      success: true,
      data: uniqueProtocols.slice(0, 10)
    };
  }
};

export default treatmentProtocolService;
