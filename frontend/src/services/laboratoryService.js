import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

/**
 * Laboratory Service - Offline-First
 * Handles lab orders, results, specimens, QC with offline support
 *
 * SAFETY NOTE: Result validation and abnormal value checks show warnings when offline
 * to ensure patient safety is not compromised
 */

const laboratoryService = {
  // ============================================
  // LAB ORDER CRUD - WORKS OFFLINE
  // ============================================

  /**
   * Get all laboratory tests/orders - WORKS OFFLINE
   * @param {Object} params - Query parameters
   * @returns {Promise} Lab orders list
   */
  async getAllTests(params = {}) {
    return offlineWrapper.get(
      () => api.get('/laboratory/tests', { params }),
      'labOrders',
      params,
      {
        transform: (response) => response.data,
        cacheExpiry: 300 // 5 minutes for active orders
      }
    );
  },

  /**
   * Order new laboratory tests - WORKS OFFLINE
   * @param {Object} testData - Test order data
   * @returns {Promise} Created order
   */
  async orderTests(testData) {
    const localData = {
      ...testData,
      _tempId: `temp_lab_${Date.now()}`,
      status: 'pending',
      orderedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post('/laboratory/tests', testData),
      'CREATE',
      'labOrders',
      localData
    );
  },

  /**
   * Create lab order (alias for orderTests) - WORKS OFFLINE
   * @param {Object} orderData - Order data
   * @returns {Promise} Created order
   */
  async createOrder(orderData) {
    return this.orderTests(orderData);
  },

  /**
   * Get lab order details - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Order details
   */
  async getOrder(visitId) {
    return offlineWrapper.get(
      () => api.get(`/laboratory/report/${visitId}`),
      'labOrders',
      visitId,
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Get patient lab orders - WORKS OFFLINE
   * @param {string} patientId - Patient ID
   * @param {Object} params - Query params
   * @returns {Promise} Patient orders
   */
  async getPatientOrders(patientId, params = {}) {
    if (!navigator.onLine) {
      try {
        const orders = await db.labOrders
          .where('patientId')
          .equals(patientId)
          .toArray();

        return {
          success: true,
          data: orders,
          _fromCache: true
        };
      } catch (error) {
        console.error('[LaboratoryService] Offline patient orders failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/laboratory/tests', { params: { patientId, ...params } }),
      'labOrders',
      { type: 'patientOrders', patientId, ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Get pending lab tests - WORKS OFFLINE
   * @returns {Promise} Pending tests
   */
  async getPendingTests() {
    if (!navigator.onLine) {
      try {
        const orders = await db.labOrders
          .where('status')
          .anyOf(['pending', 'collected', 'in_progress'])
          .toArray();

        return {
          success: true,
          data: orders,
          _fromCache: true
        };
      } catch (error) {
        console.error('[LaboratoryService] Offline pending tests failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/laboratory/pending'),
      'labOrders',
      { type: 'pending' },
      {
        transform: (response) => response.data,
        cacheExpiry: 60 // 1 minute for pending queue
      }
    );
  },

  /**
   * Get pending (alias) - WORKS OFFLINE
   * @returns {Promise} Pending tests
   */
  async getPending() {
    return this.getPendingTests();
  },

  /**
   * Get completed lab orders - WORKS OFFLINE
   * @param {Object} params - Query params
   * @returns {Promise} Completed orders
   */
  async getCompleted(params = {}) {
    if (!navigator.onLine) {
      try {
        const orders = await db.labOrders
          .where('status')
          .equals('completed')
          .toArray();

        return {
          success: true,
          data: orders,
          _fromCache: true
        };
      } catch (error) {
        console.error('[LaboratoryService] Offline completed orders failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/laboratory/tests', { params: { status: 'completed', ...params } }),
      'labOrders',
      { type: 'completed', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 900
      }
    );
  },

  // ============================================
  // STATUS UPDATES - WORK OFFLINE
  // ============================================

  /**
   * Update test results - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {string} testId - Test ID
   * @param {Object} resultData - Result data
   * @returns {Promise} Updated order
   */
  async updateTestResults(visitId, testId, resultData) {
    const updateData = {
      ...resultData,
      resultedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/laboratory/tests/${visitId}/${testId}`, resultData),
      'UPDATE',
      'labOrders',
      updateData,
      `${visitId}_${testId}`
    );
  },

  /**
   * Update order status - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {string} testId - Test ID
   * @param {string} status - New status
   * @param {string} notes - Notes
   * @returns {Promise} Updated order
   */
  async updateOrderStatus(visitId, testId, status, notes = '') {
    const updateData = {
      status,
      notes,
      statusUpdatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/laboratory/tests/${visitId}/${testId}`, { status, notes }),
      'UPDATE',
      'labOrders',
      updateData,
      `${visitId}_${testId}`
    );
  },

  /**
   * Add results to lab order - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {string} testId - Test ID
   * @param {Object} results - Results
   * @returns {Promise} Updated order
   */
  async addResults(visitId, testId, results) {
    const updateData = {
      results,
      status: 'completed',
      completedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/laboratory/tests/${visitId}/${testId}`, { results, status: 'completed' }),
      'UPDATE',
      'labOrders',
      updateData,
      `${visitId}_${testId}`
    );
  },

  /**
   * Cancel lab order - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {string} testId - Test ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise} Cancelled order
   */
  async cancelOrder(visitId, testId, reason) {
    const updateData = {
      status: 'cancelled',
      notes: reason,
      cancelledAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/laboratory/tests/${visitId}/${testId}`, { status: 'cancelled', notes: reason }),
      'UPDATE',
      'labOrders',
      updateData,
      `${visitId}_${testId}`
    );
  },

  /**
   * Generic status update - WORKS OFFLINE
   * @param {string} orderId - Order ID
   * @param {string} status - Status
   * @param {string} source - Source type
   * @param {Object} extraData - Extra data
   * @returns {Promise} Updated order
   */
  async updateStatus(orderId, status, source = 'labOrder', extraData = {}) {
    const updateData = {
      status,
      ...extraData,
      statusUpdatedAt: new Date().toISOString()
    };

    if (source === 'visit') {
      return offlineWrapper.mutate(
        () => api.put(`/laboratory/tests/${orderId}`, { status, ...extraData }),
        'UPDATE',
        'labOrders',
        updateData,
        orderId
      );
    }

    // For standalone LabOrder
    let apiCall;
    switch (status) {
      case 'collected':
        apiCall = () => api.put(`/lab-orders/${orderId}/collect`);
        break;
      case 'received':
        apiCall = () => api.put(`/lab-orders/${orderId}/receive`);
        break;
      case 'cancelled':
        apiCall = () => api.put(`/lab-orders/${orderId}/cancel`, extraData);
        break;
      default:
        apiCall = () => api.put(`/lab-orders/${orderId}`, { status, ...extraData });
    }

    return offlineWrapper.mutate(
      apiCall,
      'UPDATE',
      'labOrders',
      updateData,
      orderId
    );
  },

  /**
   * Update LabOrder generic - WORKS OFFLINE
   * @param {string} orderId - Order ID
   * @param {Object} updateData - Update data
   * @returns {Promise} Updated order
   */
  async updateLabOrder(orderId, updateData) {
    return offlineWrapper.mutate(
      () => api.put(`/lab-orders/${orderId}`, updateData),
      'UPDATE',
      'labOrders',
      { ...updateData, updatedAt: new Date().toISOString() },
      orderId
    );
  },

  // ============================================
  // TEMPLATES - WORK OFFLINE (LONG CACHE)
  // ============================================

  /**
   * Get laboratory templates - WORKS OFFLINE
   * @param {Object} params - Query params
   * @returns {Promise} Templates
   */
  async getTemplates(params = {}) {
    return offlineWrapper.get(
      () => api.get('/laboratory/templates', { params }),
      'labOrders',
      { type: 'templates', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 86400 // 24 hours for templates
      }
    );
  },

  /**
   * Get templates by category - WORKS OFFLINE
   * @param {string} category - Category
   * @returns {Promise} Templates
   */
  async getTemplatesByCategory(category) {
    return offlineWrapper.get(
      () => api.get('/laboratory/templates', { params: { category } }),
      'labOrders',
      { type: 'templates', category },
      {
        transform: (response) => response.data,
        cacheExpiry: 86400
      }
    );
  },

  /**
   * Search templates - WORKS OFFLINE
   * @param {string} query - Search query
   * @returns {Promise} Templates
   */
  async searchTemplates(query) {
    return offlineWrapper.get(
      () => api.get('/laboratory/templates', { params: { search: query } }),
      'labOrders',
      { type: 'templateSearch', query },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600
      }
    );
  },

  /**
   * Create new laboratory template - ONLINE ONLY (admin)
   * @param {Object} templateData - Template data
   * @returns {Promise} Created template
   */
  async createTemplate(templateData) {
    if (!navigator.onLine) {
      throw new Error('Creating templates requires online connectivity');
    }

    try {
      const response = await api.post('/laboratory/templates', templateData);
      return response.data;
    } catch (error) {
      console.error('[LaboratoryService] Template creation failed:', error);
      throw error;
    }
  },

  /**
   * Get lab categories - WORKS OFFLINE
   * @returns {Promise} Categories
   */
  async getCategories() {
    try {
      const templates = await this.getTemplates();
      const categories = [...new Set(templates.data?.map(t => t.category) || [])];
      return {
        success: true,
        data: categories
      };
    } catch (error) {
      console.error('[LaboratoryService] Categories fetch failed:', error);
      throw error;
    }
  },

  /**
   * Get common lab panels - WORKS OFFLINE
   * @returns {Promise} Panels
   */
  async getCommonPanels() {
    return offlineWrapper.get(
      () => api.get('/laboratory/templates', { params: { isPanel: true } }),
      'labOrders',
      { type: 'panels' },
      {
        transform: (response) => response.data,
        cacheExpiry: 86400
      }
    );
  },

  // ============================================
  // RESULTS AND VALIDATION - PARTIAL OFFLINE
  // ============================================

  /**
   * Enter test results with component breakdown - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {string} testId - Test ID
   * @param {Object} resultData - Result data
   * @returns {Promise} Updated order
   */
  async enterResults(visitId, testId, resultData) {
    const updateData = {
      results: resultData,
      resultedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/laboratory/tests/${visitId}/${testId}/results`, resultData),
      'UPDATE',
      'labResults',
      updateData,
      `${visitId}_${testId}`
    );
  },

  /**
   * Get test results - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {string} testId - Test ID
   * @returns {Promise} Results
   */
  async getTestResults(visitId, testId) {
    return offlineWrapper.get(
      () => api.get(`/laboratory/tests/${visitId}/${testId}/results`),
      'labResults',
      `${visitId}_${testId}`,
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Validate result value - ONLINE PREFERRED (SAFETY)
   * @param {string} templateId - Template ID
   * @param {*} value - Result value
   * @param {number} patientAge - Patient age
   * @param {string} patientGender - Patient gender
   * @returns {Promise} Validation result
   */
  async validateResult(templateId, value, patientAge, patientGender) {
    if (!navigator.onLine) {
      return {
        success: false,
        offline: true,
        warnings: [
          'AVERTISSEMENT: Validation des résultats non disponible hors ligne',
          'Veuillez vérifier manuellement les valeurs de référence'
        ],
        _mustVerifyOnline: true
      };
    }

    try {
      const response = await api.post('/laboratory/validate-result', {
        templateId,
        value,
        patientAge,
        patientGender
      });
      return response.data;
    } catch (error) {
      console.error('[LaboratoryService] Validation failed:', error);
      throw error;
    }
  },

  /**
   * Check abnormal values - ONLINE PREFERRED (SAFETY)
   * @param {Object} results - Results to check
   * @param {number} patientAge - Patient age
   * @param {string} patientGender - Patient gender
   * @returns {Promise} Abnormal check result
   */
  async checkAbnormalValues(results, patientAge, patientGender) {
    if (!navigator.onLine) {
      return {
        success: false,
        offline: true,
        warnings: [
          'AVERTISSEMENT: Contrôle des valeurs anormales non disponible hors ligne',
          'Veuillez vérifier manuellement les résultats'
        ],
        _mustVerifyOnline: true
      };
    }

    try {
      const response = await api.post('/laboratory/check-abnormal', {
        results,
        patientAge,
        patientGender
      });
      return response.data;
    } catch (error) {
      console.error('[LaboratoryService] Abnormal check failed:', error);
      throw error;
    }
  },

  // ============================================
  // SPECIMENS - WORK OFFLINE
  // ============================================

  /**
   * Register specimen - WORKS OFFLINE
   * @param {Object} specimenData - Specimen data
   * @returns {Promise} Registered specimen
   */
  async registerSpecimen(specimenData) {
    const localData = {
      ...specimenData,
      _tempId: `temp_spec_${Date.now()}`,
      registeredAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post('/laboratory/specimens', specimenData),
      'CREATE',
      'labOrders',
      localData
    );
  },

  /**
   * Get specimen by barcode - WORKS OFFLINE
   * @param {string} barcode - Barcode
   * @returns {Promise} Specimen data
   */
  async getSpecimenByBarcode(barcode) {
    return offlineWrapper.get(
      () => api.get(`/laboratory/specimens/barcode/${barcode}`),
      'labOrders',
      { type: 'specimen', barcode },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600
      }
    );
  },

  /**
   * Mark specimen collected - WORKS OFFLINE
   * @param {string} testId - Test ID
   * @param {string} specimenType - Specimen type
   * @param {string} notes - Notes
   * @returns {Promise} Updated record
   */
  async markCollected(testId, specimenType, notes) {
    const updateData = {
      status: 'collected',
      specimenType,
      notes,
      collectedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/laboratory/worklist/${testId}/collect`, { specimenType, notes }),
      'UPDATE',
      'labOrders',
      updateData,
      testId
    );
  },

  /**
   * Collect LabOrder specimen - WORKS OFFLINE
   * @param {string} orderId - Order ID
   * @returns {Promise} Updated order
   */
  async collectLabOrderSpecimen(orderId) {
    const updateData = {
      status: 'collected',
      collectedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/lab-orders/${orderId}/collect`),
      'UPDATE',
      'labOrders',
      updateData,
      orderId
    );
  },

  /**
   * Receive LabOrder specimen - WORKS OFFLINE
   * @param {string} orderId - Order ID
   * @returns {Promise} Updated order
   */
  async receiveLabOrderSpecimen(orderId) {
    const updateData = {
      status: 'received',
      receivedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/lab-orders/${orderId}/receive`),
      'UPDATE',
      'labOrders',
      updateData,
      orderId
    );
  },

  /**
   * Start processing - WORKS OFFLINE
   * @param {string} testId - Test ID
   * @returns {Promise} Updated record
   */
  async startProcessing(testId) {
    const updateData = {
      status: 'in_progress',
      processingStartedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/laboratory/worklist/${testId}/start`),
      'UPDATE',
      'labOrders',
      updateData,
      testId
    );
  },

  // ============================================
  // WORKLIST - WORKS OFFLINE
  // ============================================

  /**
   * Get worklist - WORKS OFFLINE
   * @param {Object} params - Query params
   * @returns {Promise} Worklist
   */
  async getWorklist(params = {}) {
    if (!navigator.onLine) {
      try {
        const orders = await db.labOrders
          .where('status')
          .anyOf(['pending', 'collected', 'received', 'in_progress'])
          .toArray();

        return {
          success: true,
          data: orders,
          _fromCache: true
        };
      } catch (error) {
        console.error('[LaboratoryService] Offline worklist failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/laboratory/worklist', { params }),
      'labOrders',
      { type: 'worklist', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 60 // 1 minute for worklist
      }
    );
  },

  // ============================================
  // STATISTICS AND REPORTS - PARTIAL OFFLINE
  // ============================================

  /**
   * Get laboratory statistics - WORKS OFFLINE
   * @returns {Promise} Statistics
   */
  async getStatistics() {
    if (!navigator.onLine) {
      try {
        const orders = await db.labOrders.toArray();
        const today = new Date().toISOString().split('T')[0];

        const stats = {
          total: orders.length,
          pending: orders.filter(o => o.status === 'pending').length,
          inProgress: orders.filter(o => o.status === 'in_progress').length,
          completed: orders.filter(o => o.status === 'completed').length,
          todayCount: orders.filter(o => o.orderedAt?.startsWith(today)).length,
          _computed: true,
          _offlineNote: 'Stats computed from cached data'
        };

        return { success: true, data: stats, _fromCache: true };
      } catch (error) {
        console.error('[LaboratoryService] Offline stats failed:', error);
        return { success: false, data: {}, _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/laboratory/stats'),
      'labOrders',
      { type: 'statistics' },
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  /**
   * Generate laboratory report - WORKS OFFLINE (cached)
   * @param {string} visitId - Visit ID
   * @returns {Promise} Report data
   */
  async generateReport(visitId) {
    return offlineWrapper.get(
      () => api.get(`/laboratory/report/${visitId}`),
      'labOrders',
      { type: 'report', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600
      }
    );
  },

  /**
   * Get printable data - WORKS OFFLINE (cached)
   * @param {string} visitId - Visit ID
   * @returns {Promise} Print data
   */
  async printOrder(visitId) {
    return offlineWrapper.get(
      () => api.get(`/laboratory/report/${visitId}/print`),
      'labOrders',
      { type: 'print', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600
      }
    );
  },

  /**
   * Generate PDF report - ONLINE ONLY
   * @param {string} visitId - Visit ID
   * @returns {Promise<Blob>} PDF blob
   */
  async generatePDF(visitId) {
    if (!navigator.onLine) {
      throw new Error('PDF generation requires online connectivity');
    }

    try {
      const response = await api.get(`/laboratory/report/${visitId}/pdf`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('[LaboratoryService] PDF generation failed:', error);
      throw error;
    }
  },

  /**
   * Download PDF - ONLINE ONLY
   * @param {string} visitId - Visit ID
   * @returns {Promise<boolean>} Success
   */
  async downloadPDF(visitId) {
    if (!navigator.onLine) {
      throw new Error('PDF download requires online connectivity');
    }

    try {
      const blob = await this.generatePDF(visitId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lab-report-${visitId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error('[LaboratoryService] PDF download failed:', error);
      throw error;
    }
  },

  // ============================================
  // QC (Quality Control) - PARTIAL OFFLINE
  // ============================================

  /**
   * Record QC data - WORKS OFFLINE
   * @param {Object} qcData - QC data
   * @returns {Promise} Recorded QC
   */
  async recordQCData(qcData) {
    const localData = {
      ...qcData,
      _tempId: `temp_qc_${Date.now()}`,
      recordedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post('/laboratory/qc', qcData),
      'CREATE',
      'labOrders',
      localData
    );
  },

  /**
   * Get QC history - WORKS OFFLINE
   * @param {Object} params - Query params
   * @returns {Promise} QC history
   */
  async getQCHistory(params = {}) {
    return offlineWrapper.get(
      () => api.get('/laboratory/qc/history', { params }),
      'labOrders',
      { type: 'qcHistory', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  // ============================================
  // TRENDS AND DELTA - WORKS OFFLINE (LIMITED)
  // ============================================

  /**
   * Get patient result trends - WORKS OFFLINE
   * @param {string} patientId - Patient ID
   * @param {string} testCode - Test code
   * @param {Object} params - Query params
   * @returns {Promise} Trends data
   */
  async getPatientTrends(patientId, testCode, params = {}) {
    if (!navigator.onLine) {
      try {
        const results = await db.labResults
          .where('patientId')
          .equals(patientId)
          .filter(r => r.testCode === testCode)
          .toArray();

        return {
          success: true,
          data: results,
          _fromCache: true,
          _offlineNote: 'Trends computed from cached results'
        };
      } catch (error) {
        console.error('[LaboratoryService] Offline trends failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get(`/laboratory/trends/${patientId}/${testCode}`, { params }),
      'labResults',
      { type: 'trends', patientId, testCode, ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Calculate delta for new result - ONLINE PREFERRED
   * @param {string} patientId - Patient ID
   * @param {string} testCode - Test code
   * @param {*} currentValue - Current value
   * @param {string} componentName - Component name
   * @returns {Promise} Delta calculation
   */
  async calculateDelta(patientId, testCode, currentValue, componentName = null) {
    if (!navigator.onLine) {
      return {
        success: false,
        offline: true,
        message: 'Delta calculation limited offline',
        _mustVerifyOnline: true
      };
    }

    try {
      const response = await api.post('/laboratory/calculate-delta', {
        patientId,
        testCode,
        currentValue,
        componentName
      });
      return response.data;
    } catch (error) {
      console.error('[LaboratoryService] Delta calculation failed:', error);
      throw error;
    }
  },

  // ============================================
  // TUBE MANAGEMENT - PARTIAL OFFLINE
  // ============================================

  /**
   * Consume tube for specimen collection - WORKS OFFLINE
   * @param {string} specimenId - Specimen ID
   * @param {string} tubeType - Tube type
   * @param {number} quantity - Quantity
   * @returns {Promise} Consumption result
   */
  async consumeTube(specimenId, tubeType, quantity = 1) {
    const localData = {
      specimenId,
      tubeType,
      quantity,
      consumedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post('/laboratory/specimens/consume-tube', { specimenId, tubeType, quantity }),
      'CREATE',
      'labOrders',
      localData
    );
  },

  /**
   * Get available tubes - WORKS OFFLINE
   * @returns {Promise} Available tubes
   */
  async getAvailableTubes() {
    return offlineWrapper.get(
      () => api.get('/laboratory/tubes/available'),
      'labOrders',
      { type: 'availableTubes' },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600
      }
    );
  },

  /**
   * Get tube suggestion for test - WORKS OFFLINE
   * @param {string} templateId - Template ID
   * @returns {Promise} Tube suggestion
   */
  async suggestTubeForTest(templateId) {
    return offlineWrapper.get(
      () => api.get(`/laboratory/tubes/suggest/${templateId}`),
      'labOrders',
      { type: 'tubeSuggestion', templateId },
      {
        transform: (response) => response.data,
        cacheExpiry: 86400
      }
    );
  },

  // ============================================
  // OFFLINE HELPER METHODS
  // ============================================

  /**
   * Pre-cache lab orders for offline use
   * @param {Object} params - Cache params
   * @returns {Promise} Cache result
   */
  async preCacheOrders(params = { limit: 100 }) {
    if (!navigator.onLine) {
      console.warn('[LaboratoryService] Cannot pre-cache while offline');
      return { success: false };
    }

    try {
      console.log('[LaboratoryService] Pre-caching lab orders...');

      const response = await api.get('/laboratory/tests', { params });
      // Safely extract array from various API response formats
      const rawOrders = response?.data?.data ?? response?.data ?? [];
      const orders = Array.isArray(rawOrders) ? rawOrders : [];

      if (orders.length > 0) {
        const timestamp = new Date().toISOString();
        const ordersWithSync = orders.map(o => ({
          ...o,
          id: o._id || o.id,
          lastSync: timestamp
        }));

        await db.labOrders.bulkPut(ordersWithSync);
        console.log(`[LaboratoryService] Pre-cached ${orders.length} lab orders`);
      }

      return { success: true, cached: orders.length };
    } catch (error) {
      console.error('[LaboratoryService] Pre-cache failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Pre-cache templates for offline use
   * @returns {Promise} Cache result
   */
  async preCacheTemplates() {
    if (!navigator.onLine) {
      console.warn('[LaboratoryService] Cannot pre-cache while offline');
      return { success: false };
    }

    try {
      console.log('[LaboratoryService] Pre-caching lab templates...');
      await this.getTemplates();
      await this.getCommonPanels();
      console.log('[LaboratoryService] Lab templates pre-cached');
      return { success: true };
    } catch (error) {
      console.error('[LaboratoryService] Template pre-cache failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get cached order count
   * @returns {Promise<number>} Count
   */
  async getCachedOrderCount() {
    return db.labOrders.count();
  },

  /**
   * Clear cached data
   * @returns {Promise} Clear result
   */
  async clearCache() {
    await Promise.all([
      db.labOrders.clear(),
      db.labResults.clear()
    ]);
    return { success: true };
  }
};

export default laboratoryService;
