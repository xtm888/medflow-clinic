import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

const glassesOrderService = {
  // Get all orders with filters - WORKS OFFLINE (10 min cache)
  async getOrders(params = {}) {
    const cacheKey = `glasses_orders_${JSON.stringify(params)}`;
    return offlineWrapper.get(
      () => api.get('/glasses-orders', { params }),
      'glassesOrders',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Get single order - WORKS OFFLINE (10 min cache)
  async getOrder(id) {
    return offlineWrapper.get(
      () => api.get(`/glasses-orders/${id}`),
      'glassesOrders',
      id,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Create new order - WORKS OFFLINE (queued)
  async createOrder(orderData) {
    const localData = {
      ...orderData,
      _tempId: `temp_glasses_${Date.now()}`,
      status: 'pending',
      orderDate: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.post('/glasses-orders', orderData),
      'CREATE',
      'glassesOrders',
      localData
    );
  },

  // Update order - WORKS OFFLINE (queued)
  async updateOrder(id, updateData) {
    const localData = {
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.put(`/glasses-orders/${id}`, updateData),
      'UPDATE',
      'glassesOrders',
      localData,
      id
    );
  },

  // Update order status - WORKS OFFLINE (queued)
  async updateStatus(id, status, notes) {
    const localData = {
      status,
      notes,
      statusUpdatedAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.put(`/glasses-orders/${id}/status`, { status, notes }),
      'UPDATE',
      'glassesOrders',
      localData,
      id
    );
  },

  // Delete/cancel order - WORKS OFFLINE (queued)
  async deleteOrder(id) {
    const localData = {
      status: 'cancelled',
      cancelledAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.delete(`/glasses-orders/${id}`),
      'DELETE',
      'glassesOrders',
      localData,
      id
    );
  },

  // Get orders for a patient - WORKS OFFLINE (10 min cache)
  async getPatientOrders(patientId) {
    const cacheKey = `patient_orders_${patientId}`;
    return offlineWrapper.get(
      () => api.get(`/glasses-orders/patient/${patientId}`),
      'glassesOrders',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Get orders for an exam - WORKS OFFLINE (10 min cache)
  async getExamOrders(examId) {
    const cacheKey = `exam_orders_${examId}`;
    return offlineWrapper.get(
      () => api.get(`/glasses-orders/exam/${examId}`),
      'glassesOrders',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Get order statistics - WORKS OFFLINE (5 min cache)
  async getStats() {
    return offlineWrapper.get(
      () => api.get('/glasses-orders/stats'),
      'glassesOrders',
      'stats',
      { transform: (response) => response.data, cacheExpiry: 300 }
    );
  },

  // ============================================
  // INVENTORY INTEGRATION
  // ============================================

  // Search frames for order - WORKS OFFLINE (30 min cache)
  async searchFrames(query, category, status = 'in-stock') {
    const cacheKey = `frames_${query}_${category}_${status}`;
    return offlineWrapper.get(
      () => api.get('/glasses-orders/search-frames', {
        params: { query, category, status }
      }),
      'frameInventory',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  // Search contact lenses for order - WORKS OFFLINE (30 min cache)
  async searchContactLenses(params) {
    const cacheKey = `contact_lenses_${JSON.stringify(params)}`;
    return offlineWrapper.get(
      () => api.get('/glasses-orders/search-contact-lenses', { params }),
      'contactLensInventory',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  // Check inventory availability - WORKS OFFLINE (queued check)
  async checkInventoryAvailability(items) {
    const localData = {
      items,
      checkedAt: new Date().toISOString(),
      _requiresOnlineVerification: true
    };
    return offlineWrapper.mutate(
      () => api.post('/glasses-orders/check-inventory', items),
      'CREATE',
      'glassesOrders',
      localData
    );
  },

  // Get order with full inventory details - WORKS OFFLINE (10 min cache)
  async getOrderWithInventory(id) {
    const cacheKey = `order_inventory_${id}`;
    return offlineWrapper.get(
      () => api.get(`/glasses-orders/${id}/with-inventory`),
      'glassesOrders',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Reserve inventory for order - WORKS OFFLINE (queued)
  async reserveInventory(orderId) {
    const localData = {
      orderId,
      action: 'reserve',
      reservedAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.post(`/glasses-orders/${orderId}/reserve-inventory`),
      'UPDATE',
      'glassesOrders',
      localData,
      orderId
    );
  },

  // Release inventory reservations - WORKS OFFLINE (queued)
  async releaseInventory(orderId) {
    const localData = {
      orderId,
      action: 'release',
      releasedAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.post(`/glasses-orders/${orderId}/release-inventory`),
      'UPDATE',
      'glassesOrders',
      localData,
      orderId
    );
  },

  // Fulfill inventory (on delivery) - WORKS OFFLINE (queued)
  async fulfillInventory(orderId) {
    const localData = {
      orderId,
      action: 'fulfill',
      fulfilledAt: new Date().toISOString(),
      status: 'delivered'
    };
    return offlineWrapper.mutate(
      () => api.post(`/glasses-orders/${orderId}/fulfill-inventory`),
      'UPDATE',
      'glassesOrders',
      localData,
      orderId
    );
  },

  // Generate invoice for order - ONLINE ONLY (financial transaction)
  async generateInvoice(orderId) {
    if (!navigator.onLine) {
      throw new Error('Invoice generation requires internet connection.');
    }
    const response = await api.post(`/glasses-orders/${orderId}/invoice`);
    return response.data;
  },

  // Get unbilled orders - WORKS OFFLINE (10 min cache)
  async getUnbilledOrders(patientId) {
    const cacheKey = `unbilled_${patientId || 'all'}`;
    return offlineWrapper.get(
      () => api.get('/glasses-orders/unbilled', {
        params: patientId ? { patientId } : {}
      }),
      'glassesOrders',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // ============================================
  // QC WORKFLOW
  // ============================================

  // Get orders pending QC inspection - WORKS OFFLINE (5 min cache)
  async getPendingQC() {
    return offlineWrapper.get(
      () => api.get('/glasses-orders/pending-qc'),
      'glassesOrders',
      'pending_qc',
      { transform: (response) => response.data, cacheExpiry: 300 }
    );
  },

  // Get orders ready for pickup - WORKS OFFLINE (5 min cache)
  async getReadyForPickup() {
    return offlineWrapper.get(
      () => api.get('/glasses-orders/ready-for-pickup'),
      'glassesOrders',
      'ready_pickup',
      { transform: (response) => response.data, cacheExpiry: 300 }
    );
  },

  // Mark order as received from lab - WORKS OFFLINE (queued)
  async receiveFromLab(orderId, data = {}) {
    const localData = {
      ...data,
      status: 'received',
      receivedAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.put(`/glasses-orders/${orderId}/receive`, data),
      'UPDATE',
      'glassesOrders',
      localData,
      orderId
    );
  },

  // Perform QC inspection - WORKS OFFLINE (queued)
  async performQC(orderId, qcData) {
    const localData = {
      ...qcData,
      qcPerformedAt: new Date().toISOString(),
      status: qcData.passed ? 'qc-passed' : 'qc-failed'
    };
    return offlineWrapper.mutate(
      () => api.put(`/glasses-orders/${orderId}/qc`, qcData),
      'UPDATE',
      'glassesOrders',
      localData,
      orderId
    );
  },

  // Override failed QC (admin only) - ONLINE ONLY (requires authorization)
  async qcOverride(orderId, reason) {
    if (!navigator.onLine) {
      throw new Error('QC override requires internet connection for verification.');
    }
    const response = await api.put(`/glasses-orders/${orderId}/qc-override`, { reason });
    return response.data;
  },

  // Record delivery with proof - WORKS OFFLINE (queued)
  async recordDelivery(orderId, deliveryData) {
    const localData = {
      ...deliveryData,
      status: 'delivered',
      deliveredAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.put(`/glasses-orders/${orderId}/deliver`, deliveryData),
      'UPDATE',
      'glassesOrders',
      localData,
      orderId
    );
  },

  // Send pickup reminder - ONLINE ONLY (requires email/SMS service)
  async sendPickupReminder(orderId) {
    if (!navigator.onLine) {
      throw new Error('Sending reminders requires internet connection.');
    }
    const response = await api.post(`/glasses-orders/${orderId}/send-reminder`);
    return response.data;
  },

  // ============================================
  // OFFLINE HELPERS
  // ============================================

  // Pre-cache critical data for shift
  async preCacheForShift() {
    const results = { cached: 0, errors: [] };

    try {
      await this.getPendingQC();
      results.cached++;
    } catch (error) {
      results.errors.push('pendingQC');
    }

    try {
      await this.getReadyForPickup();
      results.cached++;
    } catch (error) {
      results.errors.push('readyPickup');
    }

    try {
      await this.getStats();
      results.cached++;
    } catch (error) {
      results.errors.push('stats');
    }

    return results;
  },

  // Get count of cached orders
  async getCachedCount() {
    try {
      const orders = await db.glassesOrders.toArray();
      return orders.length;
    } catch (error) {
      console.error('[glassesOrderService] Error getting cached count:', error);
      return 0;
    }
  },

  // Search frames offline from local cache
  async searchFramesOffline(query) {
    try {
      const frames = await db.frameInventory.toArray();
      const lowerQuery = query.toLowerCase();
      return frames.filter(frame =>
        frame.brand?.toLowerCase().includes(lowerQuery) ||
        frame.model?.toLowerCase().includes(lowerQuery) ||
        frame.sku?.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      console.error('[glassesOrderService] Error searching frames offline:', error);
      return [];
    }
  },

  // Search contact lenses offline from local cache
  async searchContactLensesOffline(query) {
    try {
      const lenses = await db.contactLensInventory.toArray();
      const lowerQuery = query.toLowerCase();
      return lenses.filter(lens =>
        lens.brand?.toLowerCase().includes(lowerQuery) ||
        lens.type?.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      console.error('[glassesOrderService] Error searching contact lenses offline:', error);
      return [];
    }
  }
};

export default glassesOrderService;
