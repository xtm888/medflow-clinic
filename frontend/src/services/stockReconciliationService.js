import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

const stockReconciliationService = {
  // ============================================
  // READ OPERATIONS - WORKS OFFLINE
  // ============================================

  // Get all reconciliations - WORKS OFFLINE (30 min cache)
  getAll: async (params = {}) => {
    const cacheKey = `stock_recon_all_${JSON.stringify(params)}`;
    return offlineWrapper.get(
      () => api.get('/stock-reconciliations', { params }),
      'stockReconciliations',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  // Get single reconciliation - WORKS OFFLINE (10 min cache)
  getById: async (id) => {
    return offlineWrapper.get(
      () => api.get(`/stock-reconciliations/${id}`),
      'stockReconciliations',
      id,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Get variance report - WORKS OFFLINE (10 min cache)
  getVarianceReport: async (id) => {
    return offlineWrapper.get(
      () => api.get(`/stock-reconciliations/${id}/variance-report`),
      'stockReconciliations',
      `variance_${id}`,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Get statistics - WORKS OFFLINE (1 hour cache)
  getStats: async () => {
    return offlineWrapper.get(
      () => api.get('/stock-reconciliations/stats'),
      'stockReconciliations',
      'stats',
      { transform: (response) => response.data, cacheExpiry: 3600 }
    );
  },

  // ============================================
  // RECONCILIATION LIFECYCLE - ONLINE ONLY (audit)
  // ============================================

  // Create new reconciliation - ONLINE ONLY
  create: async (data) => {
    if (!navigator.onLine) throw new Error('Creating reconciliations requires internet connection.');
    const response = await api.post('/stock-reconciliations', data);
    return response.data;
  },

  // Start reconciliation - ONLINE ONLY
  start: async (id) => {
    if (!navigator.onLine) throw new Error('Starting reconciliation requires internet connection.');
    const response = await api.post(`/stock-reconciliations/${id}/start`);
    return response.data;
  },

  // Submit for review - ONLINE ONLY
  submitForReview: async (id) => {
    if (!navigator.onLine) throw new Error('Submitting for review requires internet connection.');
    const response = await api.post(`/stock-reconciliations/${id}/submit`);
    return response.data;
  },

  // Apply adjustments - ONLINE ONLY (financial impact)
  applyAdjustments: async (id, adjustmentNotes) => {
    if (!navigator.onLine) throw new Error('Applying adjustments requires internet connection for audit trail.');
    const response = await api.post(`/stock-reconciliations/${id}/apply`, { adjustmentNotes });
    return response.data;
  },

  // Complete reconciliation - ONLINE ONLY
  complete: async (id) => {
    if (!navigator.onLine) throw new Error('Completing reconciliation requires internet connection.');
    const response = await api.post(`/stock-reconciliations/${id}/complete`);
    return response.data;
  },

  // Cancel reconciliation - ONLINE ONLY
  cancel: async (id, reason) => {
    if (!navigator.onLine) throw new Error('Cancelling reconciliation requires internet connection.');
    const response = await api.post(`/stock-reconciliations/${id}/cancel`, { reason });
    return response.data;
  },

  // ============================================
  // COUNT OPERATIONS - WORKS OFFLINE (queued)
  // ============================================

  // Add count for item - WORKS OFFLINE (queued)
  addCount: async (id, countData) => {
    const localData = {
      ...countData,
      reconciliationId: id,
      _tempId: `temp_count_${Date.now()}`,
      countedAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.post(`/stock-reconciliations/${id}/count`, countData),
      'CREATE',
      'stockReconciliations',
      localData
    );
  },

  // Bulk add counts - WORKS OFFLINE (queued)
  bulkAddCounts: async (id, counts) => {
    const localData = {
      reconciliationId: id,
      counts,
      _tempId: `temp_bulk_count_${Date.now()}`,
      countedAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.post(`/stock-reconciliations/${id}/bulk-count`, { counts }),
      'CREATE',
      'stockReconciliations',
      localData
    );
  },

  // ============================================
  // OFFLINE HELPERS
  // ============================================

  // Pre-cache active reconciliations
  preCacheActiveReconciliations: async () => {
    const results = { cached: 0, errors: [] };
    try {
      await stockReconciliationService.getAll({ status: 'in_progress' });
      results.cached++;
    } catch { results.errors.push('active'); }
    try { await stockReconciliationService.getStats(); results.cached++; } catch { results.errors.push('stats'); }
    return results;
  },

  // Get cached reconciliation
  getCachedById: async (id) => {
    try { return await db.stockReconciliations.get(id); } catch { return null; }
  },

  // Get pending counts (offline)
  getPendingCounts: async () => {
    try {
      const all = await db.stockReconciliations.toArray();
      return all.filter(item => item._tempId && item.countedAt);
    } catch { return []; }
  }
};

export default stockReconciliationService;
