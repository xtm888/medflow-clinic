import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';
import clinicSyncService from './clinicSyncService';

// Helper to get active clinic filter
const getActiveClinicFilter = () => {
  const clinicId = clinicSyncService.getActiveClinic();
  return clinicId ? { clinicId } : {};
};

// Pharmacy Inventory service for managing medication stock
const pharmacyInventoryService = {
  // ============================================
  // INVENTORY CRUD
  // ============================================

  // Get all inventory items
  async getAll(params = {}) {
    const clinicFilter = getActiveClinicFilter();
    return offlineWrapper.get(
      async () => {
        const response = await api.get('/pharmacy/inventory', { params: { ...params, ...clinicFilter } });
        return response;
      },
      'pharmacyInventory',
      params.category ? `category_${params.category}` : 'all',
      { cacheExpiry: 1800 } // 30 minutes
    );
  },

  // Get single inventory item
  async getById(id) {
    return offlineWrapper.get(
      async () => {
        const response = await api.get(`/pharmacy/inventory/${id}`);
        return response;
      },
      'pharmacyInventory',
      id,
      { cacheExpiry: 600 }
    );
  },

  // Search medications
  async search(query, options = {}) {
    const clinicFilter = getActiveClinicFilter();
    return offlineWrapper.get(
      async () => {
        const response = await api.get('/pharmacy/search', {
          params: { q: query, ...options, ...clinicFilter }
        });
        return response;
      },
      'pharmacyInventory',
      `search_${query}`,
      { cacheExpiry: 300 } // 5 minutes
    );
  },

  // Get low stock items
  async getLowStock() {
    const clinicFilter = getActiveClinicFilter();
    return offlineWrapper.get(
      async () => {
        const response = await api.get('/pharmacy/low-stock', { params: clinicFilter });
        return response;
      },
      'pharmacyInventory',
      'lowStock',
      { cacheExpiry: 300 }
    );
  },

  // Get expiring items
  async getExpiring(days = 30) {
    const clinicFilter = getActiveClinicFilter();
    return offlineWrapper.get(
      async () => {
        const response = await api.get('/pharmacy/expiring', {
          params: { days, ...clinicFilter }
        });
        return response;
      },
      'pharmacyInventory',
      `expiring_${days}`,
      { cacheExpiry: 600 }
    );
  },

  // Get pharmacy statistics
  async getStats() {
    const clinicFilter = getActiveClinicFilter();
    return offlineWrapper.get(
      async () => {
        const response = await api.get('/pharmacy/stats', { params: clinicFilter });
        return response;
      },
      'pharmacyInventory',
      'stats',
      { cacheExpiry: 3600 } // 1 hour
    );
  },

  // Create new inventory item
  async create(data) {
    const localData = {
      ...data,
      _tempId: `temp_pharmacy_${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      async () => {
        const response = await api.post('/pharmacy/inventory', data);
        return response;
      },
      'CREATE',
      'pharmacyInventory',
      localData
    );
  },

  // Update inventory item
  async update(id, data) {
    const localData = {
      ...data,
      id,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      async () => {
        const response = await api.put(`/pharmacy/inventory/${id}`, data);
        return response;
      },
      'UPDATE',
      'pharmacyInventory',
      localData,
      id
    );
  },

  // Delete inventory item
  async delete(id) {
    return offlineWrapper.mutate(
      async () => {
        const response = await api.delete(`/pharmacy/inventory/${id}`);
        return response;
      },
      'DELETE',
      'pharmacyInventory',
      { id },
      id
    );
  },

  // ============================================
  // BATCH MANAGEMENT
  // ============================================

  // Get batches for a medication
  async getBatches(id) {
    return offlineWrapper.get(
      async () => {
        const response = await api.get(`/pharmacy/inventory/${id}/batches`);
        return response;
      },
      'pharmacyInventory',
      `batches_${id}`,
      { cacheExpiry: 600 }
    );
  },

  // Add batch to inventory
  async addBatch(id, batchData) {
    const localData = {
      ...batchData,
      medicationId: id,
      _tempId: `temp_batch_${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      async () => {
        const response = await api.post(`/pharmacy/inventory/${id}/batches`, batchData);
        return response;
      },
      'CREATE',
      'pharmacyInventory',
      localData
    );
  },

  // Update batch
  async updateBatch(id, lotNumber, updateData) {
    const localData = {
      ...updateData,
      medicationId: id,
      lotNumber,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      async () => {
        const response = await api.put(`/pharmacy/inventory/${id}/batches/${encodeURIComponent(lotNumber)}`, updateData);
        return response;
      },
      'UPDATE',
      'pharmacyInventory',
      localData,
      `${id}_${lotNumber}`
    );
  },

  // Mark batch as expired
  async markBatchExpired(id, lotNumber) {
    const localData = {
      medicationId: id,
      lotNumber,
      status: 'expired',
      markedExpiredAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      async () => {
        const response = await api.post(`/pharmacy/inventory/${id}/batches/${encodeURIComponent(lotNumber)}/expire`);
        return response;
      },
      'UPDATE',
      'pharmacyInventory',
      localData,
      `${id}_${lotNumber}`
    );
  },

  // ============================================
  // DISPENSING - ONLINE ONLY (Safety Critical)
  // ============================================

  // Dispense from inventory directly (not prescription-linked)
  async dispense(id, dispenseData) {
    // CRITICAL: Dispensing must ALWAYS be online for medication safety
    if (!navigator.onLine) {
      throw new Error('Dispensing requires internet connection for medication safety tracking');
    }

    try {
      const response = await api.post(`/pharmacy/inventory/${id}/dispense`, dispenseData);
      return response.data;
    } catch (error) {
      console.error('Error dispensing medication:', error);
      throw error;
    }
  },

  // Dispense prescription medications
  async dispensePrescription(prescriptionId, medicationIndex = null, pharmacyNotes = '') {
    // CRITICAL: Dispensing must ALWAYS be online for medication safety
    if (!navigator.onLine) {
      throw new Error('Dispensing requires internet connection for medication safety tracking');
    }

    try {
      const response = await api.post('/pharmacy/dispense', {
        prescriptionId,
        medicationIndex,
        pharmacyNotes
      });
      return response.data;
    } catch (error) {
      console.error('Error dispensing prescription:', error);
      throw error;
    }
  },

  // ============================================
  // RESERVATIONS
  // ============================================

  // Reserve stock for prescription/procedure
  async reserveStock(id, reservationData) {
    const localData = {
      ...reservationData,
      medicationId: id,
      _tempId: `temp_reservation_${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      async () => {
        const response = await api.post(`/pharmacy/inventory/${id}/reserve`, reservationData);
        return response;
      },
      'CREATE',
      'pharmacyInventory',
      localData
    );
  },

  // Reserve for prescription (uses prescription ID)
  async reserveForPrescription(prescriptionId) {
    const localData = {
      prescriptionId,
      _tempId: `temp_prescription_reservation_${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      async () => {
        const response = await api.post('/pharmacy/reserve', { prescriptionId });
        return response;
      },
      'CREATE',
      'pharmacyInventory',
      localData
    );
  },

  // Release reservation
  async releaseReservation(id, reservationId) {
    const localData = {
      medicationId: id,
      reservationId,
      status: 'released',
      releasedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      async () => {
        const response = await api.post(`/pharmacy/inventory/${id}/release`, { reservationId });
        return response;
      },
      'UPDATE',
      'pharmacyInventory',
      localData,
      reservationId
    );
  },

  // ============================================
  // STOCK ADJUSTMENTS
  // ============================================

  // Update stock (adjustment)
  async updateStock(id, stockData) {
    const localData = {
      ...stockData,
      medicationId: id,
      _tempId: `temp_adjustment_${Date.now()}`,
      adjustedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      async () => {
        const response = await api.post(`/pharmacy/inventory/${id}/adjust`, stockData);
        return response;
      },
      'UPDATE',
      'pharmacyInventory',
      localData,
      id
    );
  },

  // ============================================
  // TRANSACTIONS
  // ============================================

  // Get transaction history for an item
  async getTransactions(id, params = {}) {
    return offlineWrapper.get(
      async () => {
        const response = await api.get(`/pharmacy/inventory/${id}/transactions`, { params });
        return response;
      },
      'pharmacyInventory',
      `transactions_${id}`,
      { cacheExpiry: 300 }
    );
  },

  // Get all transactions across inventory
  async getAllTransactions(params = {}) {
    return offlineWrapper.get(
      async () => {
        const response = await api.get('/pharmacy/transactions', { params });
        return response;
      },
      'pharmacyInventory',
      'allTransactions',
      { cacheExpiry: 300 }
    );
  },

  // ============================================
  // INVENTORY VALUE & REPORTING
  // ============================================

  // Get inventory value
  async getInventoryValue() {
    return offlineWrapper.get(
      async () => {
        const response = await api.get('/pharmacy/value');
        return response;
      },
      'pharmacyInventory',
      'inventoryValue',
      { cacheExpiry: 3600 } // 1 hour
    );
  },

  // Export inventory report - ONLINE ONLY (file generation)
  async exportReport(format = 'csv') {
    if (!navigator.onLine) {
      throw new Error('Report export requires internet connection for file generation');
    }

    try {
      const response = await api.get('/pharmacy/export', {
        params: { format },
        responseType: format === 'csv' ? 'blob' : 'json'
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting inventory:', error);
      throw error;
    }
  },

  // ============================================
  // ALERTS
  // ============================================

  // Get alerts (low stock, expiring, etc.)
  async getAlerts() {
    return offlineWrapper.get(
      async () => {
        const response = await api.get('/pharmacy/alerts');
        return response;
      },
      'pharmacyInventory',
      'alerts',
      { cacheExpiry: 300 }
    );
  },

  // Resolve alert
  async resolveAlert(id, alertId) {
    const localData = {
      medicationId: id,
      alertId,
      status: 'resolved',
      resolvedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      async () => {
        const response = await api.put(`/pharmacy/inventory/${id}/alerts/${alertId}/resolve`);
        return response;
      },
      'UPDATE',
      'pharmacyInventory',
      localData,
      alertId
    );
  },

  // ============================================
  // SUPPLIERS
  // ============================================

  // Get all suppliers
  async getSuppliers() {
    return offlineWrapper.get(
      async () => {
        const response = await api.get('/pharmacy/suppliers');
        return response;
      },
      'pharmacyInventory',
      'suppliers',
      { cacheExpiry: 3600 }
    );
  },

  // Get supplier details
  async getSupplier(id) {
    return offlineWrapper.get(
      async () => {
        const response = await api.get(`/pharmacy/suppliers/${id}`);
        return response;
      },
      'pharmacyInventory',
      `supplier_${id}`,
      { cacheExpiry: 3600 }
    );
  },

  // Add supplier to medication
  async addSupplier(medicationId, supplierData) {
    const localData = {
      ...supplierData,
      medicationId,
      _tempId: `temp_supplier_${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      async () => {
        const response = await api.post('/pharmacy/suppliers', {
          medicationId,
          ...supplierData
        });
        return response;
      },
      'CREATE',
      'pharmacyInventory',
      localData
    );
  },

  // Update supplier
  async updateSupplier(id, updateData) {
    const localData = {
      ...updateData,
      id,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      async () => {
        const response = await api.put(`/pharmacy/suppliers/${id}`, updateData);
        return response;
      },
      'UPDATE',
      'pharmacyInventory',
      localData,
      id
    );
  },

  // Delete supplier
  async deleteSupplier(id) {
    return offlineWrapper.mutate(
      async () => {
        const response = await api.delete(`/pharmacy/suppliers/${id}`);
        return response;
      },
      'DELETE',
      'pharmacyInventory',
      { id },
      id
    );
  },

  // ============================================
  // REORDER MANAGEMENT
  // ============================================

  // Get reorder suggestions
  async getReorderSuggestions() {
    return offlineWrapper.get(
      async () => {
        const response = await api.get('/pharmacy/reorder-suggestions');
        return response;
      },
      'pharmacyInventory',
      'reorderSuggestions',
      { cacheExpiry: 3600 }
    );
  },

  // Create reorder
  async createReorder(reorderData) {
    const localData = {
      ...reorderData,
      _tempId: `temp_reorder_${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      async () => {
        const response = await api.post('/pharmacy/reorder', reorderData);
        return response;
      },
      'CREATE',
      'pharmacyInventory',
      localData
    );
  },

  // Receive order (add stock from order)
  async receiveOrder(id, orderData) {
    const localData = {
      ...orderData,
      medicationId: id,
      _tempId: `temp_receive_${Date.now()}`,
      receivedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      async () => {
        const response = await api.post(`/pharmacy/inventory/${id}/receive-order`, orderData);
        return response;
      },
      'UPDATE',
      'pharmacyInventory',
      localData,
      id
    );
  },

  // ============================================
  // UTILITY METHODS
  // ============================================

  // Get by category
  async getByCategory(category) {
    return offlineWrapper.get(
      async () => {
        const response = await api.get('/pharmacy/inventory', {
          params: { category }
        });
        return response;
      },
      'pharmacyInventory',
      `category_${category}`,
      { cacheExpiry: 600 }
    );
  },

  // ============================================
  // OFFLINE HELPERS
  // ============================================

  /**
   * Pre-cache critical pharmacy data for shift start
   * Call this when pharmacist logs in at shift start
   */
  async preCacheForShift() {
    try {
      await Promise.all([
        this.getAll(),
        this.getLowStock(),
        this.getExpiring(30),
        this.getAlerts(),
        this.getStats()
      ]);
      console.log('Pharmacy data pre-cached successfully');
    } catch (error) {
      console.warn('Failed to pre-cache some pharmacy data:', error);
    }
  },

  /**
   * Get cached medication count (offline-safe)
   */
  async getCachedCount() {
    try {
      const items = await db.pharmacyInventory.toArray();
      return items.length;
    } catch (error) {
      console.error('Error getting cached count:', error);
      return 0;
    }
  },

  /**
   * Search medications in local cache (offline-safe)
   */
  async searchOffline(query) {
    try {
      const clinicId = clinicSyncService.getActiveClinic();
      const items = await db.pharmacyInventory.toArray();

      // Filter by clinic first
      let filtered = clinicId
        ? items.filter(item => item.clinicId === clinicId)
        : items;

      // Then apply search query
      if (query) {
        const lowerQuery = query.toLowerCase();
        filtered = filtered.filter(item =>
          item.name?.toLowerCase().includes(lowerQuery) ||
          item.genericName?.toLowerCase().includes(lowerQuery) ||
          item.category?.toLowerCase().includes(lowerQuery)
        );
      }

      return filtered;
    } catch (error) {
      console.error('Error searching offline:', error);
      return [];
    }
  }
};

export default pharmacyInventoryService;
