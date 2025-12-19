import { createInventoryService } from '../core/ServiceFactory';
import api from '../apiConfig';
import offlineWrapper from '../offlineWrapper';
import db from '../database';
import clinicSyncService from '../clinicSyncService';

// Helper to get active clinic filter
const getActiveClinicFilter = () => {
  const clinicId = clinicSyncService.getActiveClinic();
  return clinicId ? { clinicId } : {};
};

// ==========================================
// FRAME INVENTORY SERVICE
// ==========================================

const frameInventoryServiceBase = createInventoryService('/frame-inventory');

export const frameInventoryService = {
  // ==========================================
  // READ OPERATIONS - WITH OFFLINE SUPPORT
  // ==========================================

  /**
   * Get all frames
   * WORKS OFFLINE - 30-min cache
   * @param {object} params - Query parameters
   * @returns {Promise} Frames data
   */
  getAll: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      () => frameInventoryServiceBase.getAll({ ...params, ...clinicFilter }),
      'frameInventory',
      JSON.stringify(params),
      { cacheExpiry: 1800 } // 30 minutes
    );
  },

  /**
   * Get frame by ID
   * WORKS OFFLINE - 30-min cache
   * @param {string} id - Frame ID
   * @returns {Promise} Frame data
   */
  getById: async (id) => {
    return await offlineWrapper.get(
      () => frameInventoryServiceBase.getById(id),
      'frameInventory',
      id,
      { cacheExpiry: 1800 } // 30 minutes
    );
  },

  /**
   * Search frames
   * WORKS OFFLINE - 10-min cache
   * @param {string} query - Search query
   * @param {object} options - Search options
   * @returns {Promise} Search results
   */
  search: async (query, options = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      () => frameInventoryServiceBase.search(query, { ...options, ...clinicFilter }),
      'frameInventory',
      `search:${query}:${JSON.stringify(options)}`,
      { cacheExpiry: 600 } // 10 minutes
    );
  },

  /**
   * Check frame availability
   * WORKS OFFLINE - 5-min cache
   * @param {string} frameId - Frame ID
   * @param {number} quantity - Quantity to check
   * @returns {Promise} Availability data
   */
  checkAvailability: async (frameId, quantity) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      async () => {
        const response = await api.get('/frame-inventory/check-availability', {
          params: { frameId, quantity, ...clinicFilter }
        });
        return response.data;
      },
      'frameInventory',
      `availability:${frameId}:${quantity}`,
      { cacheExpiry: 300 } // 5 minutes
    );
  },

  /**
   * Get frames by category
   * WORKS OFFLINE - 30-min cache
   * @param {string} category - Frame category
   * @returns {Promise} Frames in category
   */
  getByCategory: async (category) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      async () => {
        const response = await api.get(`/frame-inventory/category/${category}`, {
          params: clinicFilter
        });
        return response.data;
      },
      'frameInventory',
      `category:${category}`,
      { cacheExpiry: 1800 } // 30 minutes
    );
  },

  /**
   * Get inventory statistics
   * WORKS OFFLINE - 1-hour cache
   * @param {object} params - Query parameters
   * @returns {Promise} Stats data
   */
  getStats: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      () => frameInventoryServiceBase.getStats({ ...params, ...clinicFilter }),
      'frameInventory',
      `stats:${JSON.stringify(params)}`,
      { cacheExpiry: 3600 } // 1 hour
    );
  },

  /**
   * Get low stock frames
   * WORKS OFFLINE - 5-min cache
   * @param {object} params - Query parameters
   * @returns {Promise} Low stock items
   */
  getLowStock: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      () => frameInventoryServiceBase.getLowStock({ ...params, ...clinicFilter }),
      'frameInventory',
      `lowStock:${JSON.stringify(params)}`,
      { cacheExpiry: 300 } // 5 minutes
    );
  },

  /**
   * Get inventory alerts
   * WORKS OFFLINE - 5-min cache
   * @param {object} params - Query parameters
   * @returns {Promise} Alerts data
   */
  getAlerts: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      () => frameInventoryServiceBase.getAlerts({ ...params, ...clinicFilter }),
      'frameInventory',
      `alerts:${JSON.stringify(params)}`,
      { cacheExpiry: 300 } // 5 minutes
    );
  },

  /**
   * Get available brands
   * WORKS OFFLINE - 1-hour cache (static data)
   * @param {object} params - Query parameters
   * @returns {Promise} Brands list
   */
  getBrands: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      () => frameInventoryServiceBase.getBrands({ ...params, ...clinicFilter }),
      'frameInventory',
      `brands:${JSON.stringify(params)}`,
      { cacheExpiry: 3600 } // 1 hour
    );
  },

  // ==========================================
  // WRITE OPERATIONS - ONLINE ONLY
  // ==========================================

  /**
   * Create new frame
   * ONLINE ONLY - Stock entry requires verification
   * @param {object} data - Frame data
   * @returns {Promise} Response data
   */
  create: async (data) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await frameInventoryServiceBase.create(data);
  },

  /**
   * Update frame
   * ONLINE ONLY - Stock changes need audit
   * @param {string} id - Frame ID
   * @param {object} data - Updated data
   * @returns {Promise} Response data
   */
  update: async (id, data) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await frameInventoryServiceBase.update(id, data);
  },

  /**
   * Delete frame
   * ONLINE ONLY - Requires audit trail
   * @param {string} id - Frame ID
   * @param {string} reason - Deletion reason
   * @returns {Promise} Response data
   */
  delete: async (id, reason) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await frameInventoryServiceBase.delete(id, reason);
  },

  /**
   * Add stock to frame inventory
   * ONLINE ONLY - Financial impact
   * @param {string} id - Frame ID
   * @param {object} batchData - Stock batch data
   * @returns {Promise} Response data
   */
  addStock: async (id, batchData) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await frameInventoryServiceBase.addStock(id, batchData);
  },

  /**
   * Adjust stock quantity
   * ONLINE ONLY - Inventory adjustment needs audit
   * @param {string} id - Frame ID
   * @param {object} adjustment - Adjustment data
   * @returns {Promise} Response data
   */
  adjustStock: async (id, adjustment) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await frameInventoryServiceBase.adjustStock(id, adjustment);
  },

  /**
   * Reserve frame for order
   * ONLINE ONLY - Prevents overselling
   * @param {string} id - Frame ID
   * @param {object} orderData - Order data
   * @returns {Promise} Response data
   */
  reserveForOrder: async (id, orderData) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await frameInventoryServiceBase.reserveForOrder(id, orderData);
  },

  /**
   * Release reservation
   * ONLINE ONLY - Stock release needs sync
   * @param {string} id - Frame ID
   * @param {string} reservationId - Reservation ID
   * @returns {Promise} Response data
   */
  releaseReservation: async (id, reservationId) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await frameInventoryServiceBase.releaseReservation(id, reservationId);
  },

  /**
   * Fulfill reservation
   * ONLINE ONLY - Order completion
   * @param {string} id - Frame ID
   * @param {string} reservationId - Reservation ID
   * @param {object} data - Fulfillment data
   * @returns {Promise} Response data
   */
  fulfillReservation: async (id, reservationId, data = {}) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await frameInventoryServiceBase.fulfillReservation(id, reservationId, data);
  },

  /**
   * Resolve inventory alert
   * ONLINE ONLY - Alert management
   * @param {string} itemId - Frame ID
   * @param {string} alertId - Alert ID
   * @returns {Promise} Response data
   */
  resolveAlert: async (itemId, alertId) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await frameInventoryServiceBase.resolveAlert(itemId, alertId);
  },

  // ==========================================
  // BACKWARD COMPATIBILITY ALIASES
  // ==========================================

  getFrames: async (params) => frameInventoryService.getAll(params),
  getFrame: async (id) => frameInventoryService.getById(id),
  createFrame: async (data) => frameInventoryService.create(data),
  updateFrame: async (id, data) => frameInventoryService.update(id, data),
  deleteFrame: async (id, reason) => frameInventoryService.delete(id, reason),
  searchFrames: async (query, options) => frameInventoryService.search(query, options),

  // ==========================================
  // OFFLINE HELPER METHODS
  // ==========================================

  /**
   * Pre-cache frames for optical shop shift
   * WORKS OFFLINE - populates cache for offline access
   * @param {string} clinicId - Clinic ID
   * @returns {Promise} Cache statistics
   */
  preCacheForShift: async (clinicId) => {
    if (!navigator.onLine) return { cached: 0 };
    try {
      const [frames, lowStock, alerts] = await Promise.all([
        frameInventoryService.getAll({ clinic: clinicId, limit: 500 }),
        frameInventoryService.getLowStock({ clinic: clinicId }),
        frameInventoryService.getAlerts({ clinic: clinicId })
      ]);
      return {
        cached: (frames?.length || 0) + (lowStock?.length || 0) + (alerts?.length || 0),
        frames: frames?.length || 0,
        lowStock: lowStock?.length || 0,
        alerts: alerts?.length || 0
      };
    } catch (error) {
      console.error('Frame pre-cache failed:', error);
      return { cached: 0, error: error.message };
    }
  },

  /**
   * Search frames offline
   * WORKS OFFLINE - searches IndexedDB cache
   * @param {string} query - Search query
   * @param {object} filters - Search filters
   * @returns {Promise} Search results
   */
  searchFramesOffline: async (query, filters = {}) => {
    const allFrames = await db.frameInventory.toArray();
    const searchLower = query.toLowerCase();
    return allFrames.filter(frame => {
      const matchesQuery = !query ||
        frame.brand?.toLowerCase().includes(searchLower) ||
        frame.model?.toLowerCase().includes(searchLower) ||
        frame.sku?.toLowerCase().includes(searchLower);
      const matchesCategory = !filters.category || frame.category === filters.category;
      const matchesClinic = !filters.clinicId || frame.clinicId === filters.clinicId;
      return matchesQuery && matchesCategory && matchesClinic;
    });
  },

  /**
   * Get cached frame count
   * WORKS OFFLINE - returns count from IndexedDB
   * @returns {Promise<number>} Cached frame count
   */
  getCachedCount: async () => {
    return await db.frameInventory.count();
  }
};

// ==========================================
// CONTACT LENS INVENTORY SERVICE
// ==========================================

const contactLensInventoryServiceBase = createInventoryService('/contact-lens-inventory');

export const contactLensInventoryService = {
  // ==========================================
  // READ OPERATIONS - WITH OFFLINE SUPPORT
  // ==========================================

  /**
   * Get all contact lenses
   * WORKS OFFLINE - 30-min cache
   * @param {object} params - Query parameters
   * @returns {Promise} Response data
   */
  getAll: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      () => contactLensInventoryServiceBase.getAll({ ...params, ...clinicFilter }),
      'contactLensInventory',
      JSON.stringify(params),
      { cacheExpiry: 1800 } // 30 minutes
    );
  },

  /**
   * Get contact lens by ID
   * WORKS OFFLINE - 30-min cache
   * @param {string} id - Lens ID
   * @returns {Promise} Response data
   */
  getById: async (id) => {
    return await offlineWrapper.get(
      () => contactLensInventoryServiceBase.getById(id),
      'contactLensInventory',
      id,
      { cacheExpiry: 1800 } // 30 minutes
    );
  },

  /**
   * Search contact lenses
   * WORKS OFFLINE - 10-min cache
   * @param {string} query - Search query
   * @param {object} options - Search options
   * @returns {Promise} Response data
   */
  search: async (query, options = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      () => contactLensInventoryServiceBase.search(query, { ...options, ...clinicFilter }),
      'contactLensInventory',
      `search:${query}:${JSON.stringify(options)}`,
      { cacheExpiry: 600 } // 10 minutes
    );
  },

  /**
   * Get expiring contact lenses
   * WORKS OFFLINE - 10-min cache
   * @param {number} days - Days until expiration (default 90)
   * @returns {Promise} Expiring items
   */
  getExpiring: async (days = 90) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      async () => {
        const response = await api.get('/contact-lens-inventory/expiring', {
          params: { days, ...clinicFilter }
        });
        return response.data;
      },
      'contactLensInventory',
      `expiring:${days}`,
      { cacheExpiry: 600 } // 10 minutes
    );
  },

  /**
   * Find matching lens by parameters
   * WORKS OFFLINE - 10-min cache
   * @param {object} params - Lens parameters (brand, baseCurve, diameter, power, etc.)
   * @returns {Promise} Matching lenses
   */
  findMatchingLens: async (params) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      async () => {
        const response = await api.get('/contact-lens-inventory/match', {
          params: { ...params, ...clinicFilter }
        });
        return response.data;
      },
      'contactLensInventory',
      `match:${JSON.stringify(params)}`,
      { cacheExpiry: 600 } // 10 minutes
    );
  },

  /**
   * Get product lines for a brand
   * WORKS OFFLINE - 1-hour cache (static data)
   * @param {string} brand - Brand name
   * @returns {Promise} Product lines
   */
  getProductLines: async (brand) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      async () => {
        const response = await api.get('/contact-lens-inventory/product-lines', {
          params: { brand, ...clinicFilter }
        });
        return response.data;
      },
      'contactLensInventory',
      `productLines:${brand}`,
      { cacheExpiry: 3600 } // 1 hour
    );
  },

  /**
   * Get inventory statistics
   * WORKS OFFLINE - 1-hour cache
   * @param {object} params - Query parameters
   * @returns {Promise} Response data
   */
  getStats: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      () => contactLensInventoryServiceBase.getStats({ ...params, ...clinicFilter }),
      'contactLensInventory',
      `stats:${JSON.stringify(params)}`,
      { cacheExpiry: 3600 } // 1 hour
    );
  },

  /**
   * Get low stock items
   * WORKS OFFLINE - 5-min cache
   * @param {object} params - Query parameters
   * @returns {Promise} Response data
   */
  getLowStock: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      () => contactLensInventoryServiceBase.getLowStock({ ...params, ...clinicFilter }),
      'contactLensInventory',
      `lowStock:${JSON.stringify(params)}`,
      { cacheExpiry: 300 } // 5 minutes
    );
  },

  /**
   * Get inventory alerts
   * WORKS OFFLINE - 5-min cache
   * @param {object} params - Query parameters
   * @returns {Promise} Response data
   */
  getAlerts: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      () => contactLensInventoryServiceBase.getAlerts({ ...params, ...clinicFilter }),
      'contactLensInventory',
      `alerts:${JSON.stringify(params)}`,
      { cacheExpiry: 300 } // 5 minutes
    );
  },

  /**
   * Get available brands
   * WORKS OFFLINE - 1-hour cache
   * @param {object} params - Query parameters
   * @returns {Promise} Response data
   */
  getBrands: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      () => contactLensInventoryServiceBase.getBrands({ ...params, ...clinicFilter }),
      'contactLensInventory',
      `brands:${JSON.stringify(params)}`,
      { cacheExpiry: 3600 } // 1 hour
    );
  },

  // ==========================================
  // WRITE OPERATIONS - ONLINE ONLY
  // ==========================================

  /**
   * Create contact lens
   * ONLINE ONLY - Stock entry requires verification
   * @param {object} data - Lens data
   * @returns {Promise} Response data
   */
  create: async (data) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await contactLensInventoryServiceBase.create(data);
  },

  /**
   * Update contact lens
   * ONLINE ONLY - Stock changes need audit
   * @param {string} id - Lens ID
   * @param {object} data - Updated lens data
   * @returns {Promise} Response data
   */
  update: async (id, data) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await contactLensInventoryServiceBase.update(id, data);
  },

  /**
   * Delete contact lens
   * ONLINE ONLY - Requires audit trail
   * @param {string} id - Lens ID
   * @param {string} reason - Deletion reason
   * @returns {Promise} Response data
   */
  delete: async (id, reason) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await contactLensInventoryServiceBase.delete(id, reason);
  },

  /**
   * Mark a batch as expired
   * ONLINE ONLY - Expiry tracking needs sync
   * @param {string} id - Inventory item ID
   * @param {string} lotNumber - Lot number to expire
   * @returns {Promise} Response data
   */
  markBatchExpired: async (id, lotNumber) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    const response = await api.post(`/contact-lens-inventory/${id}/expire-batch`, {
      lotNumber
    });
    return response.data;
  },

  /**
   * Add stock to contact lens inventory
   * ONLINE ONLY - Financial impact
   * @param {string} id - Lens ID
   * @param {object} batchData - Stock batch data
   * @returns {Promise} Response data
   */
  addStock: async (id, batchData) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await contactLensInventoryServiceBase.addStock(id, batchData);
  },

  /**
   * Adjust stock quantity
   * ONLINE ONLY - Inventory adjustment needs audit
   * @param {string} id - Lens ID
   * @param {object} adjustment - Adjustment data
   * @returns {Promise} Response data
   */
  adjustStock: async (id, adjustment) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await contactLensInventoryServiceBase.adjustStock(id, adjustment);
  },

  /**
   * Reserve for order
   * ONLINE ONLY - Prevents overselling
   * @param {string} id - Lens ID
   * @param {object} orderData - Order data
   * @returns {Promise} Response data
   */
  reserveForOrder: async (id, orderData) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await contactLensInventoryServiceBase.reserveForOrder(id, orderData);
  },

  /**
   * Release reservation
   * ONLINE ONLY - Stock release needs sync
   * @param {string} id - Lens ID
   * @param {string} reservationId - Reservation ID
   * @returns {Promise} Response data
   */
  releaseReservation: async (id, reservationId) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await contactLensInventoryServiceBase.releaseReservation(id, reservationId);
  },

  /**
   * Fulfill reservation
   * ONLINE ONLY - Order completion
   * @param {string} id - Lens ID
   * @param {string} reservationId - Reservation ID
   * @param {object} data - Fulfillment data
   * @returns {Promise} Response data
   */
  fulfillReservation: async (id, reservationId, data = {}) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await contactLensInventoryServiceBase.fulfillReservation(id, reservationId, data);
  },

  /**
   * Resolve inventory alert
   * ONLINE ONLY - Alert management
   * @param {string} itemId - Lens ID
   * @param {string} alertId - Alert ID
   * @returns {Promise} Response data
   */
  resolveAlert: async (itemId, alertId) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet pour garantir la précision du stock.');
    }
    return await contactLensInventoryServiceBase.resolveAlert(itemId, alertId);
  },

  // ==========================================
  // BACKWARD COMPATIBILITY ALIASES
  // ==========================================

  getLenses: async (params) => contactLensInventoryService.getAll(params),
  getLens: async (id) => contactLensInventoryService.getById(id),
  createLens: async (data) => contactLensInventoryService.create(data),
  updateLens: async (id, data) => contactLensInventoryService.update(id, data),
  deleteLens: async (id, reason) => contactLensInventoryService.delete(id, reason),
  searchLenses: async (query, options) => contactLensInventoryService.search(query, options),

  // ==========================================
  // OFFLINE HELPER METHODS
  // ==========================================

  /**
   * Pre-cache contact lenses for optical shop shift
   * WORKS OFFLINE - populates cache for offline access
   * @param {string} clinicId - Clinic ID
   * @returns {Promise} Cache statistics
   */
  preCacheForShift: async (clinicId) => {
    if (!navigator.onLine) return { cached: 0 };
    try {
      const [lenses, expiring, lowStock] = await Promise.all([
        contactLensInventoryService.getAll({ clinic: clinicId, limit: 500 }),
        contactLensInventoryService.getExpiring(90),
        contactLensInventoryService.getLowStock({ clinic: clinicId })
      ]);
      return {
        cached: (lenses?.length || 0) + (expiring?.length || 0) + (lowStock?.length || 0),
        lenses: lenses?.length || 0,
        expiring: expiring?.length || 0,
        lowStock: lowStock?.length || 0
      };
    } catch (error) {
      console.error('Contact lens pre-cache failed:', error);
      return { cached: 0, error: error.message };
    }
  },

  /**
   * Find matching lens offline
   * WORKS OFFLINE - searches IndexedDB cache by parameters
   * @param {object} params - Lens parameters
   * @returns {Promise<Array>} Matching lenses
   */
  findMatchingLensOffline: async (params) => {
    const allLenses = await db.contactLensInventory.toArray();
    return allLenses.filter(lens => {
      const matchesBrand = !params.brand || lens.brand === params.brand;
      const matchesPower = !params.power || lens.power === params.power;
      const matchesBaseCurve = !params.baseCurve || lens.baseCurve === params.baseCurve;
      const matchesDiameter = !params.diameter || lens.diameter === params.diameter;
      const matchesClinic = !params.clinicId || lens.clinicId === params.clinicId;
      const inStock = lens.stockLevel > 0;
      return matchesBrand && matchesPower && matchesBaseCurve && matchesDiameter && matchesClinic && inStock;
    });
  },

  /**
   * Get cached lens count
   * WORKS OFFLINE - returns count from IndexedDB
   * @returns {Promise<number>} Cached lens count
   */
  getCachedCount: async () => {
    return await db.contactLensInventory.count();
  }
};

// ==========================================
// OPTICAL LENS INVENTORY SERVICE
// ==========================================

const opticalLensInventoryServiceBase = createInventoryService('/optical-lens-inventory');

export const opticalLensInventoryService = {
  ...opticalLensInventoryServiceBase,

  // Backward compatibility aliases for type-specific method names
  getLenses: opticalLensInventoryServiceBase.getAll,
  getLens: opticalLensInventoryServiceBase.getById,
  createLens: opticalLensInventoryServiceBase.create,
  updateLens: opticalLensInventoryServiceBase.update,
  deleteLens: opticalLensInventoryServiceBase.delete,
  searchLenses: opticalLensInventoryServiceBase.search,

  /**
   * Find lenses by specifications
   * @param {string} clinic - Clinic ID
   * @param {object} specs - Lens specifications (sphere, cylinder, axis, etc.)
   * @returns {Promise} Matching lenses
   */
  findBySpecs: async (clinic, specs) => {
    const response = await api.get('/optical-lens-inventory/by-specs', {
      params: { clinic, ...specs }
    });
    return response.data;
  },

  /**
   * Get lenses by material
   * @param {string} material - Lens material
   * @param {string} clinic - Clinic ID
   * @returns {Promise} Lenses of specified material
   */
  getByMaterial: async (material, clinic) => {
    const response = await api.get('/optical-lens-inventory/by-material', {
      params: { material, clinic }
    });
    return response.data;
  }
};

// ==========================================
// REAGENT INVENTORY SERVICE
// ==========================================

const reagentInventoryServiceBase = createInventoryService('/reagent-inventory');

export const reagentInventoryService = {
  ...reagentInventoryServiceBase,

  // Backward compatibility aliases for type-specific method names
  getReagents: reagentInventoryServiceBase.getAll,
  getReagent: reagentInventoryServiceBase.getById,
  createReagent: reagentInventoryServiceBase.create,
  updateReagent: reagentInventoryServiceBase.update,
  deleteReagent: reagentInventoryServiceBase.delete,
  searchReagents: reagentInventoryServiceBase.search,

  /**
   * Add a batch to reagent inventory
   * @param {string} id - Reagent ID
   * @param {object} batchData - Batch data (lotNumber, quantity, expiryDate, etc.)
   * @returns {Promise} Response data
   */
  addBatch: async (id, batchData) => {
    const response = await api.post(`/reagent-inventory/${id}/batches`, batchData);
    return response.data;
  },

  /**
   * Consume reagent
   * @param {string} id - Reagent ID
   * @param {object} consumeData - Consumption data (quantity, testId, etc.)
   * @returns {Promise} Response data
   */
  consumeReagent: async (id, consumeData) => {
    const response = await api.post(`/reagent-inventory/${id}/consume`, consumeData);
    return response.data;
  },

  /**
   * Consume reagent for QC
   * @param {string} id - Reagent ID
   * @param {object} qcData - QC consumption data
   * @returns {Promise} Response data
   */
  consumeForQC: async (id, qcData) => {
    const response = await api.post(`/reagent-inventory/${id}/consume-qc`, qcData);
    return response.data;
  },

  /**
   * Expire a batch
   * @param {string} id - Reagent ID
   * @param {string} lotNumber - Lot number to expire
   * @returns {Promise} Response data
   */
  expireBatch: async (id, lotNumber) => {
    const response = await api.post(`/reagent-inventory/${id}/expire-batch`, {
      lotNumber
    });
    return response.data;
  },

  /**
   * Dispose of reagent
   * @param {string} id - Reagent ID
   * @param {object} disposeData - Disposal data (quantity, reason, etc.)
   * @returns {Promise} Response data
   */
  disposeReagent: async (id, disposeData) => {
    const response = await api.post(`/reagent-inventory/${id}/dispose`, disposeData);
    return response.data;
  },

  /**
   * Get expiring reagents
   * @param {number} days - Days until expiration (default 30)
   * @returns {Promise} Expiring reagents
   */
  getExpiring: async (days = 30) => {
    const response = await api.get('/reagent-inventory/expiring', {
      params: { days }
    });
    return response.data;
  },

  /**
   * Get reagents by lab section
   * @param {string} section - Lab section
   * @returns {Promise} Reagents in section
   */
  getBySection: async (section) => {
    const response = await api.get('/reagent-inventory/by-section', {
      params: { section }
    });
    return response.data;
  },

  /**
   * Get QC history for a reagent
   * @param {string} id - Reagent ID
   * @returns {Promise} QC history data
   */
  getQCHistory: async (id) => {
    const response = await api.get(`/reagent-inventory/${id}/qc-history`);
    return response.data;
  },

  /**
   * Link reagent to a template
   * @param {string} id - Reagent ID
   * @param {string} templateId - Template ID
   * @returns {Promise} Response data
   */
  linkTemplate: async (id, templateId) => {
    const response = await api.post(`/reagent-inventory/${id}/link-template`, {
      templateId
    });
    return response.data;
  },

  /**
   * Get available manufacturers
   * @returns {Promise} List of manufacturers
   */
  getManufacturers: async () => {
    const response = await api.get('/reagent-inventory/manufacturers');
    return response.data;
  },

  /**
   * Get reagent categories (static)
   * @returns {Array} Categories array
   */
  getCategories: () => {
    return [
      { value: 'stain', label: 'Colorants' },
      { value: 'solution', label: 'Solutions' },
      { value: 'culture-media', label: 'Milieux de culture' },
      { value: 'reagent-kit', label: 'Kits de réactifs' },
      { value: 'calibrator', label: 'Calibrateurs' },
      { value: 'control-material', label: 'Matériels de contrôle QC' },
      { value: 'antibody', label: 'Anticorps' },
      { value: 'enzyme', label: 'Enzymes' },
      { value: 'substrate', label: 'Substrats' },
      { value: 'diluent', label: 'Diluants' },
      { value: 'wash-buffer', label: 'Tampons de lavage' },
      { value: 'preservative', label: 'Conservateurs' },
      { value: 'fixative', label: 'Fixateurs' },
      { value: 'mounting-medium', label: 'Milieux de montage' },
      { value: 'other', label: 'Autre' }
    ];
  },

  /**
   * Get lab sections (static)
   * @returns {Array} Lab sections array
   */
  getLabSections: () => {
    return [
      { value: 'hematology', label: 'Hématologie' },
      { value: 'biochemistry', label: 'Biochimie' },
      { value: 'microbiology', label: 'Microbiologie' },
      { value: 'immunology', label: 'Immunologie/Sérologie' },
      { value: 'urinalysis', label: 'Analyse d\'urine' },
      { value: 'coagulation', label: 'Coagulation' },
      { value: 'parasitology', label: 'Parasitologie' },
      { value: 'histopathology', label: 'Histopathologie' },
      { value: 'cytology', label: 'Cytologie' },
      { value: 'molecular', label: 'Biologie moléculaire' },
      { value: 'blood-bank', label: 'Banque de sang' },
      { value: 'general', label: 'Général' }
    ];
  },

  /**
   * Get storage temperatures (static)
   * @returns {Array} Storage temperatures array
   */
  getStorageTemperatures: () => {
    return [
      { value: 'room-temp', label: 'Température ambiante' },
      { value: 'refrigerated', label: 'Réfrigéré (2-8°C)' },
      { value: 'frozen', label: 'Congelé (-20°C)' },
      { value: 'deep-frozen', label: 'Ultra-congelé (-80°C)' },
      { value: 'ambient', label: 'Ambiant' }
    ];
  }
};

// ==========================================
// LAB CONSUMABLE INVENTORY SERVICE
// ==========================================

const labConsumableInventoryServiceBase = createInventoryService('/lab-consumable-inventory');

export const labConsumableInventoryService = {
  ...labConsumableInventoryServiceBase,

  // Backward compatibility aliases for type-specific method names
  getConsumables: labConsumableInventoryServiceBase.getAll,
  getConsumable: labConsumableInventoryServiceBase.getById,
  createConsumable: labConsumableInventoryServiceBase.create,
  updateConsumable: labConsumableInventoryServiceBase.update,
  deleteConsumable: labConsumableInventoryServiceBase.delete,
  searchConsumables: labConsumableInventoryServiceBase.search,

  /**
   * Add a batch to lab consumable inventory
   * @param {string} id - Consumable ID
   * @param {object} batchData - Batch data (lotNumber, quantity, expiryDate, etc.)
   * @returns {Promise} Response data
   */
  addBatch: async (id, batchData) => {
    const response = await api.post(`/lab-consumable-inventory/${id}/batches`, batchData);
    return response.data;
  },

  /**
   * Consume an item
   * @param {string} id - Consumable ID
   * @param {object} consumeData - Consumption data (quantity, reason, etc.)
   * @returns {Promise} Response data
   */
  consumeItem: async (id, consumeData) => {
    const response = await api.post(`/lab-consumable-inventory/${id}/consume`, consumeData);
    return response.data;
  },

  /**
   * Mark item as damaged
   * @param {string} id - Consumable ID
   * @param {object} damageData - Damage data (quantity, reason, etc.)
   * @returns {Promise} Response data
   */
  markDamaged: async (id, damageData) => {
    const response = await api.post(`/lab-consumable-inventory/${id}/damage`, damageData);
    return response.data;
  },

  /**
   * Get consumables by category
   * @param {string} category - Category name
   * @returns {Promise} Consumables in category
   */
  getByCategory: async (category) => {
    const response = await api.get('/lab-consumable-inventory', {
      params: { category }
    });
    return response.data;
  },

  /**
   * Get collection tubes
   * @returns {Promise} Collection tubes data
   */
  getCollectionTubes: async () => {
    const response = await api.get('/lab-consumable-inventory/collection-tubes');
    return response.data;
  },

  /**
   * Get tube statistics
   * @returns {Promise} Tube stats
   */
  getTubeStats: async () => {
    const response = await api.get('/lab-consumable-inventory/tube-stats');
    return response.data;
  },

  /**
   * Get tube types from API
   * @returns {Promise} Tube types
   */
  getTubeTypesFromAPI: async () => {
    const response = await api.get('/lab-consumable-inventory/tube-types');
    return response.data;
  },

  /**
   * Get categories from API
   * @returns {Promise} Categories
   */
  getCategoriesFromAPI: async () => {
    const response = await api.get('/lab-consumable-inventory/categories');
    return response.data;
  },

  /**
   * Get consumable categories (static)
   * @returns {Array} Categories array
   */
  getCategories: () => {
    return [
      { value: 'collection-tube', label: 'Tubes de prélèvement' },
      { value: 'needle', label: 'Aiguilles' },
      { value: 'syringe', label: 'Seringues' },
      { value: 'lancet', label: 'Lancettes' },
      { value: 'slide', label: 'Lames' },
      { value: 'coverslip', label: 'Lamelles' },
      { value: 'container', label: 'Conteneurs' },
      { value: 'swab', label: 'Écouvillons' },
      { value: 'pipette-tip', label: 'Embouts de pipette' },
      { value: 'cuvette', label: 'Cuvettes' },
      { value: 'filter', label: 'Filtres' },
      { value: 'glove', label: 'Gants' },
      { value: 'mask', label: 'Masques' },
      { value: 'protective-wear', label: 'Équipement de protection' },
      { value: 'cleaning-supply', label: 'Produits de nettoyage' },
      { value: 'label', label: 'Étiquettes' },
      { value: 'transport-media', label: 'Milieux de transport' },
      { value: 'other', label: 'Autre' }
    ];
  },

  /**
   * Get tube types (static)
   * @returns {Array} Tube types array
   */
  getTubeTypes: () => {
    return [
      { value: 'edta-purple', label: 'EDTA (Violet)', color: '#8B5CF6', usage: 'Hématologie' },
      { value: 'heparin-green', label: 'Héparine (Vert)', color: '#10B981', usage: 'Chimie plasma' },
      { value: 'sst-gold', label: 'SST (Or/Jaune)', color: '#F59E0B', usage: 'Sérum avec gel' },
      { value: 'citrate-blue', label: 'Citrate (Bleu)', color: '#3B82F6', usage: 'Coagulation' },
      { value: 'fluoride-gray', label: 'Fluorure (Gris)', color: '#6B7280', usage: 'Glucose' },
      { value: 'plain-red', label: 'Sec (Rouge)', color: '#EF4444', usage: 'Sérum' },
      { value: 'edta-pink', label: 'EDTA (Rose)', color: '#EC4899', usage: 'Banque de sang' },
      { value: 'acd-yellow', label: 'ACD (Jaune)', color: '#FCD34D', usage: 'Banque de sang' },
      { value: 'trace-royal-blue', label: 'Trace Elements (Bleu Royal)', color: '#1E40AF', usage: 'Éléments traces' },
      { value: 'other', label: 'Autre', color: '#9CA3AF', usage: 'Divers' }
    ];
  }
};

// ==========================================
// SURGICAL SUPPLY INVENTORY SERVICE
// ==========================================

const surgicalSupplyInventoryServiceBase = createInventoryService('/surgical-supply-inventory');

export const surgicalSupplyInventoryService = {
  ...surgicalSupplyInventoryServiceBase,

  // Backward compatibility aliases
  getSupplies: surgicalSupplyInventoryServiceBase.getAll,
  getSupply: surgicalSupplyInventoryServiceBase.getById,
  createSupply: surgicalSupplyInventoryServiceBase.create,
  updateSupply: surgicalSupplyInventoryServiceBase.update,
  deleteSupply: surgicalSupplyInventoryServiceBase.delete,
  searchSupplies: surgicalSupplyInventoryServiceBase.search,

  /**
   * Get IOL inventory
   * @param {object} params - Query parameters
   * @returns {Promise} IOL inventory data
   */
  getIOLInventory: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    const response = await api.get('/surgical-supply-inventory', {
      params: { ...params, ...clinicFilter, supplyType: 'iol' }
    });
    return response.data;
  },

  /**
   * Get available IOL powers
   * @param {string} manufacturer - IOL manufacturer
   * @param {string} model - IOL model
   * @returns {Promise} Available powers
   */
  getAvailableIOLPowers: async (manufacturer, model) => {
    const clinicFilter = getActiveClinicFilter();
    const response = await api.get('/surgical-supply-inventory/iol-powers', {
      params: { manufacturer, model, ...clinicFilter }
    });
    return response.data;
  },

  /**
   * Get supply types (static)
   * @returns {Array} Supply types array
   */
  getSupplyTypes: () => {
    return [
      { value: 'iol', label: 'Lentilles intraoculaires (IOL)' },
      { value: 'viscoelastic', label: 'Viscoélastiques' },
      { value: 'suture', label: 'Sutures' },
      { value: 'blade', label: 'Lames' },
      { value: 'cannula', label: 'Canules' },
      { value: 'implant', label: 'Implants' },
      { value: 'instrument', label: 'Instruments' },
      { value: 'drape', label: 'Champs opératoires' },
      { value: 'other', label: 'Autre' }
    ];
  }
};

// ==========================================
// UNIFIED INVENTORY SERVICE
// ==========================================
// New unified API for all inventory types using discriminator-based model

/**
 * Unified Inventory Service
 *
 * Single service for all inventory operations across all types.
 * Uses the /api/unified-inventory endpoint with inventoryType filtering.
 *
 * @example
 * // Get all pharmacy inventory
 * const meds = await unifiedInventoryService.getAll({ inventoryType: 'pharmacy' });
 *
 * // Search across all types
 * const results = await unifiedInventoryService.search('aspirin');
 *
 * // Get low stock across all types
 * const lowStock = await unifiedInventoryService.getLowStock();
 */
export const unifiedInventoryService = {
  // ==========================================
  // READ OPERATIONS
  // ==========================================

  /**
   * Get inventory types enum
   * @returns {Promise} Inventory types
   */
  getTypes: async () => {
    return await offlineWrapper.get(
      async () => {
        const response = await api.get('/unified-inventory/types');
        return response.data?.data || response.data;
      },
      'unifiedInventory',
      'types',
      { cacheExpiry: 86400 } // 24 hours - static data
    );
  },

  /**
   * Get all inventory items
   * @param {object} params - Query parameters (inventoryType, clinic, status, search, etc.)
   * @returns {Promise} Inventory data with pagination
   */
  getAll: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      async () => {
        const response = await api.get('/unified-inventory', {
          params: { ...params, ...clinicFilter }
        });
        return response.data;
      },
      'unifiedInventory',
      `list:${JSON.stringify(params)}`,
      { cacheExpiry: 1800 } // 30 minutes
    );
  },

  /**
   * Get inventory item by ID
   * @param {string} id - Item ID
   * @returns {Promise} Item data
   */
  getById: async (id) => {
    return await offlineWrapper.get(
      async () => {
        const response = await api.get(`/unified-inventory/${id}`);
        return response.data;
      },
      'unifiedInventory',
      id,
      { cacheExpiry: 1800 } // 30 minutes
    );
  },

  /**
   * Search inventory across all types
   * @param {string} query - Search query
   * @param {object} options - Search options (inventoryType, inStockOnly, limit)
   * @returns {Promise} Search results
   */
  search: async (query, options = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      async () => {
        const response = await api.get('/unified-inventory/search', {
          params: { q: query, ...options, ...clinicFilter }
        });
        return response.data;
      },
      'unifiedInventory',
      `search:${query}:${JSON.stringify(options)}`,
      { cacheExpiry: 600 } // 10 minutes
    );
  },

  /**
   * Get inventory statistics
   * @param {object} params - Query parameters (clinic, inventoryType)
   * @returns {Promise} Stats data
   */
  getStats: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      async () => {
        const response = await api.get('/unified-inventory/stats', {
          params: { ...params, ...clinicFilter }
        });
        return response.data;
      },
      'unifiedInventory',
      `stats:${JSON.stringify(params)}`,
      { cacheExpiry: 3600 } // 1 hour
    );
  },

  /**
   * Get low stock items across all types
   * @param {object} params - Query parameters (inventoryType)
   * @returns {Promise} Low stock items
   */
  getLowStock: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      async () => {
        const response = await api.get('/unified-inventory/low-stock', {
          params: { ...params, ...clinicFilter }
        });
        return response.data;
      },
      'unifiedInventory',
      `lowStock:${JSON.stringify(params)}`,
      { cacheExpiry: 300 } // 5 minutes
    );
  },

  /**
   * Get expiring items across all types
   * @param {number} days - Days until expiration (default 30)
   * @param {object} params - Additional parameters
   * @returns {Promise} Expiring items
   */
  getExpiring: async (days = 30, params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      async () => {
        const response = await api.get('/unified-inventory/expiring', {
          params: { days, ...params, ...clinicFilter }
        });
        return response.data;
      },
      'unifiedInventory',
      `expiring:${days}:${JSON.stringify(params)}`,
      { cacheExpiry: 600 } // 10 minutes
    );
  },

  /**
   * Get inventory value
   * @param {object} params - Query parameters (clinic, inventoryType)
   * @returns {Promise} Value data
   */
  getInventoryValue: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      async () => {
        const response = await api.get('/unified-inventory/value', {
          params: { ...params, ...clinicFilter }
        });
        return response.data;
      },
      'unifiedInventory',
      `value:${JSON.stringify(params)}`,
      { cacheExpiry: 3600 } // 1 hour
    );
  },

  /**
   * Get alerts across all inventory types
   * @param {object} params - Query parameters (inventoryType, resolved)
   * @returns {Promise} Alerts data
   */
  getAlerts: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      async () => {
        const response = await api.get('/unified-inventory/alerts', {
          params: { ...params, ...clinicFilter }
        });
        return response.data;
      },
      'unifiedInventory',
      `alerts:${JSON.stringify(params)}`,
      { cacheExpiry: 300 } // 5 minutes
    );
  },

  /**
   * Get all brands
   * @param {object} params - Query parameters (inventoryType)
   * @returns {Promise} Brands list
   */
  getBrands: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      async () => {
        const response = await api.get('/unified-inventory/brands', {
          params: { ...params, ...clinicFilter }
        });
        return response.data;
      },
      'unifiedInventory',
      `brands:${JSON.stringify(params)}`,
      { cacheExpiry: 3600 } // 1 hour
    );
  },

  /**
   * Get all categories
   * @param {object} params - Query parameters (inventoryType)
   * @returns {Promise} Categories list
   */
  getCategories: async (params = {}) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      async () => {
        const response = await api.get('/unified-inventory/categories', {
          params: { ...params, ...clinicFilter }
        });
        return response.data;
      },
      'unifiedInventory',
      `categories:${JSON.stringify(params)}`,
      { cacheExpiry: 3600 } // 1 hour
    );
  },

  /**
   * Check item availability
   * @param {string} itemId - Item ID
   * @param {number} quantity - Requested quantity
   * @returns {Promise} Availability data
   */
  checkAvailability: async (itemId, quantity = 1) => {
    const clinicFilter = getActiveClinicFilter();
    return await offlineWrapper.get(
      async () => {
        const response = await api.get('/unified-inventory/check-availability', {
          params: { itemId, quantity, ...clinicFilter }
        });
        return response.data;
      },
      'unifiedInventory',
      `availability:${itemId}:${quantity}`,
      { cacheExpiry: 300 } // 5 minutes
    );
  },

  /**
   * Get transaction history
   * @param {string} id - Item ID
   * @param {object} params - Pagination params (page, limit)
   * @returns {Promise} Transaction history
   */
  getTransactions: async (id, params = {}) => {
    const response = await api.get(`/unified-inventory/${id}/transactions`, { params });
    return response.data;
  },

  // ==========================================
  // WRITE OPERATIONS - ONLINE ONLY
  // ==========================================

  /**
   * Create new inventory item
   * @param {object} data - Item data (must include inventoryType)
   * @returns {Promise} Created item
   */
  create: async (data) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet.');
    }
    const response = await api.post('/unified-inventory', data);
    return response.data;
  },

  /**
   * Update inventory item
   * @param {string} id - Item ID
   * @param {object} data - Updated data
   * @returns {Promise} Updated item
   */
  update: async (id, data) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet.');
    }
    const response = await api.put(`/unified-inventory/${id}`, data);
    return response.data;
  },

  /**
   * Delete (discontinue) inventory item
   * @param {string} id - Item ID
   * @param {string} reason - Reason for discontinuation
   * @returns {Promise} Response
   */
  delete: async (id, reason) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet.');
    }
    const response = await api.delete(`/unified-inventory/${id}`, {
      data: { reason }
    });
    return response.data;
  },

  /**
   * Add stock (receive batch)
   * @param {string} id - Item ID
   * @param {object} batchData - Batch data (lotNumber, quantity, expirationDate, etc.)
   * @returns {Promise} Updated stock info
   */
  addStock: async (id, batchData) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet.');
    }
    const response = await api.post(`/unified-inventory/${id}/add-stock`, batchData);
    return response.data;
  },

  /**
   * Adjust stock
   * @param {string} id - Item ID
   * @param {object} adjustment - Adjustment data (quantity, type, reason)
   * @returns {Promise} Updated stock info
   */
  adjustStock: async (id, adjustment) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet.');
    }
    const response = await api.post(`/unified-inventory/${id}/adjust`, adjustment);
    return response.data;
  },

  /**
   * Reserve stock
   * @param {string} id - Item ID
   * @param {object} reserveData - Reserve data (quantity, reference)
   * @returns {Promise} Reservation info
   */
  reserveStock: async (id, reserveData) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet.');
    }
    const response = await api.post(`/unified-inventory/${id}/reserve`, reserveData);
    return response.data;
  },

  /**
   * Release reservation
   * @param {string} id - Item ID
   * @param {object} releaseData - Release data (quantity, reference)
   * @returns {Promise} Updated stock info
   */
  releaseReservation: async (id, releaseData) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet.');
    }
    const response = await api.post(`/unified-inventory/${id}/release-reservation`, releaseData);
    return response.data;
  },

  /**
   * Transfer stock between clinics
   * @param {string} id - Source item ID
   * @param {object} transferData - Transfer data (targetClinicId, quantity, reason)
   * @returns {Promise} Transfer result
   */
  transfer: async (id, transferData) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet.');
    }
    const response = await api.post(`/unified-inventory/${id}/transfer`, transferData);
    return response.data;
  },

  /**
   * Resolve alert
   * @param {string} itemId - Item ID
   * @param {string} alertId - Alert ID
   * @returns {Promise} Response
   */
  resolveAlert: async (itemId, alertId) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet.');
    }
    const response = await api.post(`/unified-inventory/${itemId}/alerts/${alertId}/resolve`);
    return response.data;
  },

  /**
   * Check expirations and generate alerts
   * @param {object} params - Parameters (inventoryType, days)
   * @returns {Promise} Check result
   */
  checkExpirations: async (params = {}) => {
    if (!navigator.onLine) {
      throw new Error('Cette opération nécessite une connexion internet.');
    }
    const clinicFilter = getActiveClinicFilter();
    const response = await api.post('/unified-inventory/check-expirations', null, {
      params: { ...params, ...clinicFilter }
    });
    return response.data;
  },

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Get inventory type label
   * @param {string} type - Inventory type value
   * @returns {string} Human-readable label
   */
  getTypeLabel: (type) => {
    const labels = {
      pharmacy: 'Pharmacie',
      frame: 'Montures',
      contact_lens: 'Lentilles de contact',
      optical_lens: 'Verres optiques',
      reagent: 'Réactifs',
      lab_consumable: 'Consommables laboratoire',
      surgical_supply: 'Fournitures chirurgicales'
    };
    return labels[type] || type;
  },

  /**
   * Get status label
   * @param {string} status - Status value
   * @returns {string} Human-readable label
   */
  getStatusLabel: (status) => {
    const labels = {
      in_stock: 'En stock',
      low_stock: 'Stock faible',
      out_of_stock: 'Rupture de stock',
      overstocked: 'Surstock',
      discontinued: 'Discontinué'
    };
    return labels[status] || status;
  },

  /**
   * Get status color
   * @param {string} status - Status value
   * @returns {string} Color class
   */
  getStatusColor: (status) => {
    const colors = {
      in_stock: 'success',
      low_stock: 'warning',
      out_of_stock: 'error',
      overstocked: 'info',
      discontinued: 'default'
    };
    return colors[status] || 'default';
  }
};
