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
  }
};

export default treatmentProtocolService;
