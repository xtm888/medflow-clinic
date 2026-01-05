import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

/**
 * Billing Service - Offline-First
 * Handles invoices, payments, claims, fee schedules with offline support
 *
 * FINANCIAL SAFETY: Payment gateway operations require online connectivity
 * to ensure transaction integrity
 */

const billingService = {
  // ============================================
  // INVOICE CRUD - ALL WORK OFFLINE
  // ============================================

  /**
   * Get all invoices with filters - WORKS OFFLINE
   * @param {Object} params - Query parameters
   * @returns {Promise} Invoices list
   */
  async getInvoices(params = {}) {
    return offlineWrapper.get(
      () => api.get('/invoices', { params }),
      'invoices',
      params,
      {
        transform: (response) => response.data,
        cacheExpiry: 300 // 5 minutes
      }
    );
  },

  /**
   * Get single invoice - WORKS OFFLINE
   * @param {string} id - Invoice ID
   * @returns {Promise} Invoice data
   */
  async getInvoice(id) {
    return offlineWrapper.get(
      () => api.get(`/invoices/${id}`),
      'invoices',
      id,
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Create new invoice - WORKS OFFLINE
   * @param {Object} invoiceData - Invoice data
   * @returns {Promise} Created invoice
   */
  async createInvoice(invoiceData) {
    const localData = {
      ...invoiceData,
      _tempId: `temp_inv_${Date.now()}`,
      invoiceNumber: `TEMP-${Date.now()}`,
      status: 'draft',
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post('/invoices', invoiceData),
      'CREATE',
      'invoices',
      localData
    );
  },

  /**
   * Update invoice - WORKS OFFLINE
   * @param {string} id - Invoice ID
   * @param {Object} invoiceData - Updated data
   * @returns {Promise} Updated invoice
   */
  async updateInvoice(id, invoiceData) {
    const updateData = {
      ...invoiceData,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/invoices/${id}`, invoiceData),
      'UPDATE',
      'invoices',
      updateData,
      id
    );
  },

  /**
   * Delete invoice - WORKS OFFLINE
   * @param {string} id - Invoice ID
   * @returns {Promise} Confirmation
   */
  async deleteInvoice(id) {
    return offlineWrapper.mutate(
      () => api.delete(`/invoices/${id}`),
      'DELETE',
      'invoices',
      { deletedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Get patient billing (invoices) - WORKS OFFLINE
   * @param {string} patientId - Patient ID
   * @param {Object} params - Query params
   * @returns {Promise} Patient invoices
   */
  async getPatientBilling(patientId, params = {}) {
    if (!navigator.onLine) {
      try {
        const invoices = await db.invoices
          .where('patientId')
          .equals(patientId)
          .toArray();

        return {
          success: true,
          data: invoices,
          _fromCache: true
        };
      } catch (error) {
        console.error('[BillingService] Offline patient billing failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get(`/invoices/patient/${patientId}`, { params }),
      'invoices',
      { type: 'patientBilling', patientId, ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Get visit billing - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit billing
   */
  async getVisitBilling(visitId) {
    if (!navigator.onLine) {
      try {
        const invoices = await db.invoices
          .where('visitId')
          .equals(visitId)
          .toArray();

        return {
          success: true,
          data: invoices,
          _fromCache: true
        };
      } catch (error) {
        console.error('[BillingService] Offline visit billing failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/billing`),
      'invoices',
      { type: 'visitBilling', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  // ============================================
  // PAYMENTS - WORK OFFLINE
  // ============================================

  /**
   * Process payment - WORKS OFFLINE (CASH ONLY)
   * Card/electronic payments require online
   * @param {Object} paymentData - Payment data
   * @returns {Promise} Payment result
   */
  async processPayment(paymentData) {
    if (!paymentData.invoiceId) {
      throw new Error('Invoice ID is required for payment');
    }

    // Card payments require online for transaction integrity
    if (!navigator.onLine && paymentData.method !== 'cash') {
      return {
        success: false,
        offline: true,
        message: 'Les paiements par carte nécessitent une connexion internet',
        _mustVerifyOnline: true
      };
    }

    const localData = {
      ...paymentData,
      _tempId: `temp_pay_${Date.now()}`,
      paymentDate: new Date().toISOString(),
      status: 'pending_sync'
    };

    return offlineWrapper.mutate(
      () => api.post(`/invoices/${paymentData.invoiceId}/payments`, paymentData),
      'CREATE',
      'payments',
      localData
    );
  },

  /**
   * Get payments - WORKS OFFLINE
   * @param {Object} params - Query params
   * @returns {Promise} Payments list
   */
  async getPayments(params = {}) {
    if (!navigator.onLine) {
      try {
        const payments = await db.payments.toArray();
        return {
          success: true,
          data: payments,
          _fromCache: true
        };
      } catch (error) {
        console.error('[BillingService] Offline payments failed:', error);
        return { success: false, data: [], _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/invoices/payments', { params }),
      'payments',
      params,
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  /**
   * Get payment details - WORKS OFFLINE
   * @param {string} id - Payment ID
   * @returns {Promise} Payment data
   */
  async getPayment(id) {
    return offlineWrapper.get(
      () => api.get(`/invoices/payments/${id}`),
      'payments',
      id,
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Refund payment - ONLINE ONLY
   * @param {string} paymentId - Payment ID
   * @param {Object} refundData - Refund data
   * @returns {Promise} Refund result
   */
  async refundPayment(paymentId, refundData) {
    if (!navigator.onLine) {
      return {
        success: false,
        offline: true,
        message: 'Les remboursements nécessitent une connexion internet',
        _mustVerifyOnline: true
      };
    }

    try {
      const response = await api.post(`/invoices/${paymentId}/refund`, refundData);
      return response.data;
    } catch (error) {
      console.error('[BillingService] Refund failed:', error);
      throw error;
    }
  },

  // ============================================
  // INSURANCE CLAIMS - PARTIAL OFFLINE
  // ============================================

  /**
   * Submit insurance claim - WORKS OFFLINE
   * @param {Object} claimData - Claim data
   * @returns {Promise} Submitted claim
   */
  async submitInsuranceClaim(claimData) {
    const localData = {
      ...claimData,
      _tempId: `temp_claim_${Date.now()}`,
      status: 'draft',
      submittedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post('/billing/claims', claimData),
      'CREATE',
      'invoices',
      localData
    );
  },

  /**
   * Get insurance claims - WORKS OFFLINE
   * @param {Object} params - Query params
   * @returns {Promise} Claims list
   */
  async getInsuranceClaims(params = {}) {
    return offlineWrapper.get(
      () => api.get('/billing/claims', { params }),
      'invoices',
      { type: 'claims', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Get claim details - WORKS OFFLINE
   * @param {string} id - Claim ID
   * @returns {Promise} Claim data
   */
  async getClaim(id) {
    return offlineWrapper.get(
      () => api.get(`/billing/claims/${id}`),
      'invoices',
      { type: 'claim', id },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Update claim status - WORKS OFFLINE
   * @param {string} claimId - Claim ID
   * @param {string} status - Status
   * @param {string} notes - Notes
   * @returns {Promise} Updated claim
   */
  async updateClaimStatus(claimId, status, notes) {
    const updateData = {
      status,
      notes,
      statusUpdatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/billing/claims/${claimId}/status`, { status, notes }),
      'UPDATE',
      'invoices',
      updateData,
      claimId
    );
  },

  /**
   * Check insurance eligibility - ONLINE ONLY
   * @param {Object} insuranceData - Insurance data
   * @returns {Promise} Eligibility result
   */
  async checkInsuranceEligibility(insuranceData) {
    if (!navigator.onLine) {
      return {
        success: false,
        offline: true,
        message: 'La vérification d\'éligibilité nécessite une connexion internet',
        _mustVerifyOnline: true
      };
    }

    try {
      const response = await api.post('/billing/check-eligibility', insuranceData);
      return response.data;
    } catch (error) {
      console.error('[BillingService] Eligibility check failed:', error);
      throw error;
    }
  },

  /**
   * Verify insurance coverage - ONLINE ONLY
   * @param {string} patientId - Patient ID
   * @param {Array} procedureCodes - Procedure codes
   * @returns {Promise} Coverage result
   */
  async verifyInsuranceCoverage(patientId, procedureCodes) {
    if (!navigator.onLine) {
      return {
        success: false,
        offline: true,
        message: 'La vérification de couverture nécessite une connexion internet',
        _mustVerifyOnline: true
      };
    }

    try {
      const response = await api.post('/billing/verify-coverage', {
        patientId,
        procedureCodes
      });
      return response.data;
    } catch (error) {
      console.error('[BillingService] Coverage verification failed:', error);
      throw error;
    }
  },

  // ============================================
  // FEE SCHEDULE - WORKS OFFLINE (LONG CACHE)
  // ============================================

  /**
   * Get fee schedule - WORKS OFFLINE
   * @param {Object} params - Query params
   * @returns {Promise} Fee schedule
   */
  async getFeeSchedule(params = {}) {
    return offlineWrapper.get(
      () => api.get('/billing/fee-schedule', { params }),
      'invoices',
      { type: 'feeSchedule', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 86400 // 24 hours
      }
    );
  },

  /**
   * Update fee schedule - ONLINE ONLY (admin)
   * @param {Object} feeScheduleData - Fee schedule data
   * @returns {Promise} Updated schedule
   */
  async updateFeeSchedule(feeScheduleData) {
    if (!navigator.onLine) {
      throw new Error('Fee schedule updates require online connectivity');
    }

    try {
      const response = await api.put('/billing/fee-schedule', feeScheduleData);
      return response.data;
    } catch (error) {
      console.error('[BillingService] Fee schedule update failed:', error);
      throw error;
    }
  },

  /**
   * Create fee item - ONLINE ONLY (admin)
   * @param {Object} feeData - Fee data
   * @returns {Promise} Created fee
   */
  async createFeeItem(feeData) {
    if (!navigator.onLine) {
      throw new Error('Fee item creation requires online connectivity');
    }

    try {
      const response = await api.post('/billing/fee-schedule', feeData);
      return response.data;
    } catch (error) {
      console.error('[BillingService] Fee item creation failed:', error);
      throw error;
    }
  },

  /**
   * Update fee item - ONLINE ONLY (admin)
   * @param {string} id - Fee ID
   * @param {Object} feeData - Fee data
   * @returns {Promise} Updated fee
   */
  async updateFeeItem(id, feeData) {
    if (!navigator.onLine) {
      throw new Error('Fee item updates require online connectivity');
    }

    try {
      const response = await api.put(`/billing/fee-schedule/${id}`, feeData);
      return response.data;
    } catch (error) {
      console.error('[BillingService] Fee item update failed:', error);
      throw error;
    }
  },

  /**
   * Delete fee item - ONLINE ONLY (admin)
   * @param {string} id - Fee ID
   * @returns {Promise} Delete result
   */
  async deleteFeeItem(id) {
    if (!navigator.onLine) {
      throw new Error('Fee item deletion requires online connectivity');
    }

    try {
      const response = await api.delete(`/billing/fee-schedule/${id}`);
      return response.data;
    } catch (error) {
      console.error('[BillingService] Fee item deletion failed:', error);
      throw error;
    }
  },

  // ============================================
  // INVOICE ACTIONS - WORK OFFLINE
  // ============================================

  /**
   * Generate invoice PDF - WORKS OFFLINE (cached data)
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise} Invoice data for PDF
   */
  async generateInvoicePDF(invoiceId) {
    return offlineWrapper.get(
      () => api.get(`/invoices/${invoiceId}`),
      'invoices',
      invoiceId,
      {
        transform: (response) => response.data,
        cacheExpiry: 3600
      }
    );
  },

  /**
   * Send invoice to patient - WORKS OFFLINE
   * @param {string} invoiceId - Invoice ID
   * @param {string} method - Send method
   * @returns {Promise} Send result
   */
  async sendInvoiceToPatient(invoiceId, method = 'email') {
    const updateData = {
      sent: true,
      sentAt: new Date().toISOString(),
      sentMethod: method
    };

    return offlineWrapper.mutate(
      () => api.put(`/invoices/${invoiceId}/send`, { method }),
      'UPDATE',
      'invoices',
      updateData,
      invoiceId
    );
  },

  /**
   * Apply discount - WORKS OFFLINE
   * @param {string} invoiceId - Invoice ID
   * @param {Object} discountData - Discount data
   * @returns {Promise} Updated invoice
   */
  async applyDiscount(invoiceId, discountData) {
    const updateData = {
      discount: discountData,
      discountAppliedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/billing/invoices/${invoiceId}/apply-discount`, discountData),
      'UPDATE',
      'invoices',
      updateData,
      invoiceId
    );
  },

  /**
   * Write off amount - WORKS OFFLINE
   * @param {string} invoiceId - Invoice ID
   * @param {Object} writeOffData - Write off data
   * @returns {Promise} Updated invoice
   */
  async writeOffAmount(invoiceId, writeOffData) {
    const updateData = {
      writeOff: writeOffData,
      writeOffAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/billing/invoices/${invoiceId}/write-off`, writeOffData),
      'UPDATE',
      'invoices',
      updateData,
      invoiceId
    );
  },

  // ============================================
  // PAYMENT PLANS - WORK OFFLINE
  // ============================================

  /**
   * Get payment plans - WORKS OFFLINE
   * @param {string} patientId - Patient ID
   * @returns {Promise} Payment plans
   */
  async getPaymentPlans(patientId) {
    return offlineWrapper.get(
      () => api.get(`/patients/${patientId}/payment-plans`),
      'invoices',
      { type: 'paymentPlans', patientId },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Get all payment plans - WORKS OFFLINE
   * @param {Object} params - Query params
   * @returns {Promise} Payment plans
   */
  async getAllPaymentPlans(params = {}) {
    return offlineWrapper.get(
      () => api.get('/billing/payment-plans', { params }),
      'invoices',
      { type: 'allPaymentPlans', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 900
      }
    );
  },

  /**
   * Get payment plan by ID - WORKS OFFLINE
   * @param {string} planId - Plan ID
   * @returns {Promise} Payment plan
   */
  async getPaymentPlan(planId) {
    return offlineWrapper.get(
      () => api.get(`/billing/payment-plans/${planId}`),
      'invoices',
      { type: 'paymentPlan', planId },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Create payment plan - WORKS OFFLINE
   * @param {Object} paymentPlanData - Plan data
   * @returns {Promise} Created plan
   */
  async createPaymentPlan(paymentPlanData) {
    const localData = {
      ...paymentPlanData,
      _tempId: `temp_plan_${Date.now()}`,
      status: 'draft',
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post('/billing/payment-plans', paymentPlanData),
      'CREATE',
      'invoices',
      localData
    );
  },

  /**
   * Update payment plan - WORKS OFFLINE
   * @param {string} planId - Plan ID
   * @param {Object} planData - Plan data
   * @returns {Promise} Updated plan
   */
  async updatePaymentPlan(planId, planData) {
    return offlineWrapper.mutate(
      () => api.put(`/billing/payment-plans/${planId}`, planData),
      'UPDATE',
      'invoices',
      { ...planData, updatedAt: new Date().toISOString() },
      planId
    );
  },

  /**
   * Activate payment plan - WORKS OFFLINE
   * @param {string} planId - Plan ID
   * @returns {Promise} Activated plan
   */
  async activatePaymentPlan(planId) {
    return offlineWrapper.mutate(
      () => api.post(`/billing/payment-plans/${planId}/activate`),
      'UPDATE',
      'invoices',
      { status: 'active', activatedAt: new Date().toISOString() },
      planId
    );
  },

  /**
   * Record plan payment - WORKS OFFLINE
   * @param {string} planId - Plan ID
   * @param {Object} paymentData - Payment data
   * @returns {Promise} Payment result
   */
  async recordPlanPayment(planId, paymentData) {
    const localData = {
      ...paymentData,
      planId,
      _tempId: `temp_plan_pay_${Date.now()}`,
      paymentDate: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/billing/payment-plans/${planId}/pay`, paymentData),
      'CREATE',
      'payments',
      localData
    );
  },

  /**
   * Get overdue installments - WORKS OFFLINE
   * @returns {Promise} Overdue list
   */
  async getOverdueInstallments() {
    return offlineWrapper.get(
      () => api.get('/billing/payment-plans/overdue'),
      'invoices',
      { type: 'overdueInstallments' },
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  /**
   * Cancel payment plan - WORKS OFFLINE
   * @param {string} planId - Plan ID
   * @returns {Promise} Cancelled plan
   */
  async cancelPaymentPlan(planId) {
    return offlineWrapper.mutate(
      () => api.post(`/billing/payment-plans/${planId}/cancel`),
      'UPDATE',
      'invoices',
      { status: 'cancelled', cancelledAt: new Date().toISOString() },
      planId
    );
  },

  // ============================================
  // STATISTICS AND REPORTS - PARTIAL OFFLINE
  // ============================================

  /**
   * Get outstanding balances - WORKS OFFLINE
   * @param {Object} params - Query params
   * @returns {Promise} Balances
   */
  async getOutstandingBalances(params = {}) {
    if (!navigator.onLine) {
      try {
        const invoices = await db.invoices
          .where('status')
          .anyOf(['pending', 'partial', 'overdue'])
          .toArray();

        const total = invoices.reduce((sum, inv) => sum + (inv.amountDue || 0), 0);

        return {
          success: true,
          data: {
            invoices,
            total,
            _computed: true
          },
          _fromCache: true
        };
      } catch (error) {
        console.error('[BillingService] Offline balances failed:', error);
        return { success: false, data: {}, _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/billing/outstanding-balances', { params }),
      'invoices',
      { type: 'outstandingBalances', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  /**
   * Get billing statistics - WORKS OFFLINE
   * @param {Object} params - Query params
   * @returns {Promise} Statistics
   */
  async getBillingStatistics(params = {}) {
    if (!navigator.onLine) {
      try {
        const invoices = await db.invoices.toArray();
        const payments = await db.payments.toArray();
        const today = new Date().toISOString().split('T')[0];

        const stats = {
          totalInvoices: invoices.length,
          totalPayments: payments.length,
          paidInvoices: invoices.filter(i => i.status === 'paid').length,
          pendingInvoices: invoices.filter(i => i.status === 'pending').length,
          todayInvoices: invoices.filter(i => i.createdAt?.startsWith(today)).length,
          _computed: true,
          _offlineNote: 'Stats computed from cached data'
        };

        return { success: true, data: stats, _fromCache: true };
      } catch (error) {
        console.error('[BillingService] Offline stats failed:', error);
        return { success: false, data: {}, _fromCache: true };
      }
    }

    return offlineWrapper.get(
      () => api.get('/billing/statistics', { params }),
      'invoices',
      { type: 'statistics', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  /**
   * Get revenue report - WORKS OFFLINE (cached)
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {Promise} Report data
   */
  async getRevenueReport(startDate, endDate) {
    return offlineWrapper.get(
      () => api.get('/billing/reports/revenue', { params: { startDate, endDate } }),
      'invoices',
      { type: 'revenueReport', startDate, endDate },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600
      }
    );
  },

  /**
   * Get aging report - WORKS OFFLINE (cached)
   * @returns {Promise} Aging report
   */
  async getAgingReport() {
    return offlineWrapper.get(
      () => api.get('/billing/reports/aging'),
      'invoices',
      { type: 'agingReport' },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Get optical shop revenue - WORKS OFFLINE (cached)
   * @param {Object} params - Query params
   * @returns {Promise} Revenue data
   */
  async getOpticalShopRevenue(params = {}) {
    return offlineWrapper.get(
      () => api.get('/billing/reports/optical-shop', { params }),
      'invoices',
      { type: 'opticalShopRevenue', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  // ============================================
  // BILLING CODES - WORKS OFFLINE (LONG CACHE)
  // ============================================

  /**
   * Get billing codes - WORKS OFFLINE
   * @param {string} type - Code type
   * @returns {Promise} Codes
   */
  async getBillingCodes(type) {
    return offlineWrapper.get(
      () => api.get('/billing/codes', { params: { type } }),
      'invoices',
      { type: 'billingCodes', codeType: type },
      {
        transform: (response) => response.data,
        cacheExpiry: 86400
      }
    );
  },

  /**
   * Search billing codes - WORKS OFFLINE
   * @param {string} query - Search query
   * @returns {Promise} Matching codes
   */
  async searchBillingCodes(query) {
    return offlineWrapper.get(
      () => api.get('/billing/codes/search', { params: { q: query } }),
      'invoices',
      { type: 'billingCodeSearch', query },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600
      }
    );
  },

  // ============================================
  // TAX CONFIGURATION - PARTIAL OFFLINE
  // ============================================

  /**
   * Get tax rates - WORKS OFFLINE
   * @param {Object} params - Query params
   * @returns {Promise} Tax rates
   */
  async getTaxRates(params = {}) {
    return offlineWrapper.get(
      () => api.get('/billing/taxes', { params }),
      'invoices',
      { type: 'taxRates', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 86400
      }
    );
  },

  /**
   * Create tax rate - ONLINE ONLY (admin)
   * @param {Object} taxData - Tax data
   * @returns {Promise} Created rate
   */
  async createTaxRate(taxData) {
    if (!navigator.onLine) {
      throw new Error('Tax rate creation requires online connectivity');
    }

    try {
      const response = await api.post('/billing/taxes', taxData);
      return response.data;
    } catch (error) {
      console.error('[BillingService] Tax rate creation failed:', error);
      throw error;
    }
  },

  /**
   * Update tax rate - ONLINE ONLY (admin)
   * @param {string} id - Tax ID
   * @param {Object} taxData - Tax data
   * @returns {Promise} Updated rate
   */
  async updateTaxRate(id, taxData) {
    if (!navigator.onLine) {
      throw new Error('Tax rate updates require online connectivity');
    }

    try {
      const response = await api.put(`/billing/taxes/${id}`, taxData);
      return response.data;
    } catch (error) {
      console.error('[BillingService] Tax rate update failed:', error);
      throw error;
    }
  },

  /**
   * Delete tax rate - ONLINE ONLY (admin)
   * @param {string} id - Tax ID
   * @returns {Promise} Delete result
   */
  async deleteTaxRate(id) {
    if (!navigator.onLine) {
      throw new Error('Tax rate deletion requires online connectivity');
    }

    try {
      const response = await api.delete(`/billing/taxes/${id}`);
      return response.data;
    } catch (error) {
      console.error('[BillingService] Tax rate deletion failed:', error);
      throw error;
    }
  },

  /**
   * Calculate tax - WORKS OFFLINE (if rates cached)
   * @param {number} amount - Amount
   * @param {string} category - Category
   * @returns {Promise} Tax calculation
   */
  async calculateTax(amount, category) {
    if (!navigator.onLine) {
      // Use cached tax rates for calculation
      try {
        const rates = await this.getTaxRates();
        const rate = rates.data?.find(r => r.category === category) || { rate: 0 };
        const taxAmount = amount * (rate.rate / 100);

        return {
          success: true,
          data: {
            amount,
            taxRate: rate.rate,
            taxAmount,
            total: amount + taxAmount
          },
          _computed: true
        };
      } catch (error) {
        console.error('[BillingService] Offline tax calc failed:', error);
        return {
          success: false,
          offline: true,
          message: 'Tax calculation unavailable offline',
          _mustVerifyOnline: true
        };
      }
    }

    try {
      const response = await api.post('/billing/taxes/calculate', { amount, category });
      return response.data;
    } catch (error) {
      console.error('[BillingService] Tax calculation failed:', error);
      throw error;
    }
  },

  // ============================================
  // PAYMENT GATEWAY - ONLINE ONLY
  // ============================================

  /**
   * Get gateway methods - ONLINE ONLY
   * @returns {Promise} Gateway methods
   */
  async getGatewayMethods() {
    if (!navigator.onLine) {
      return {
        success: false,
        offline: true,
        message: 'Payment gateway requires online connectivity'
      };
    }

    try {
      const response = await api.get('/billing/gateway/methods');
      return response.data;
    } catch (error) {
      console.error('[BillingService] Gateway methods failed:', error);
      throw error;
    }
  },

  /**
   * Process gateway payment - ONLINE ONLY
   * @param {Object} paymentData - Payment data
   * @returns {Promise} Payment result
   */
  async processGatewayPayment(paymentData) {
    if (!navigator.onLine) {
      return {
        success: false,
        offline: true,
        message: 'Les paiements en ligne nécessitent une connexion internet'
      };
    }

    try {
      const response = await api.post('/billing/gateway/process', paymentData);
      return response.data;
    } catch (error) {
      console.error('[BillingService] Gateway payment failed:', error);
      throw error;
    }
  },

  /**
   * Create payment intent - ONLINE ONLY
   * @param {string} invoiceId - Invoice ID
   * @param {number} amount - Amount
   * @returns {Promise} Payment intent
   */
  async createPaymentIntent(invoiceId, amount) {
    if (!navigator.onLine) {
      return {
        success: false,
        offline: true,
        message: 'Stripe requires online connectivity'
      };
    }

    try {
      const response = await api.post('/billing/gateway/create-intent', { invoiceId, amount });
      return response.data;
    } catch (error) {
      console.error('[BillingService] Payment intent failed:', error);
      throw error;
    }
  },

  /**
   * Process gateway refund - ONLINE ONLY
   * @param {Object} refundData - Refund data
   * @returns {Promise} Refund result
   */
  async processGatewayRefund(refundData) {
    if (!navigator.onLine) {
      return {
        success: false,
        offline: true,
        message: 'Les remboursements en ligne nécessitent une connexion internet'
      };
    }

    try {
      const response = await api.post('/billing/gateway/refund', refundData);
      return response.data;
    } catch (error) {
      console.error('[BillingService] Gateway refund failed:', error);
      throw error;
    }
  },

  // ============================================
  // MULTI-CURRENCY - PARTIAL OFFLINE
  // ============================================

  /**
   * Get exchange rates - ONLINE PREFERRED
   * @returns {Promise} Exchange rates
   */
  async getExchangeRates() {
    return offlineWrapper.get(
      () => api.get('/billing/currency/rates'),
      'invoices',
      { type: 'exchangeRates' },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600 // 1 hour for rates
      }
    );
  },

  /**
   * Get supported currencies - WORKS OFFLINE
   * @returns {Promise} Currencies
   */
  async getSupportedCurrencies() {
    return offlineWrapper.get(
      () => api.get('/billing/currency/supported'),
      'invoices',
      { type: 'supportedCurrencies' },
      {
        transform: (response) => response.data,
        cacheExpiry: 86400
      }
    );
  },

  /**
   * Convert currency - ONLINE PREFERRED
   * @param {number} amount - Amount
   * @param {string} fromCurrency - From currency
   * @param {string} toCurrency - To currency
   * @returns {Promise} Converted amount
   */
  async convertCurrency(amount, fromCurrency, toCurrency) {
    if (!navigator.onLine) {
      // Use cached rates if available
      try {
        const rates = await this.getExchangeRates();
        if (rates.data && rates.data[fromCurrency] && rates.data[toCurrency]) {
          const baseAmount = amount / rates.data[fromCurrency];
          const converted = baseAmount * rates.data[toCurrency];
          return {
            success: true,
            data: {
              amount,
              fromCurrency,
              toCurrency,
              converted,
              rate: rates.data[toCurrency] / rates.data[fromCurrency]
            },
            _computed: true,
            _offlineNote: 'Rate may be outdated'
          };
        }
      } catch (error) {
        console.error('[BillingService] Offline conversion failed:', error);
      }
      return {
        success: false,
        offline: true,
        message: 'Conversion requires online connectivity'
      };
    }

    try {
      const response = await api.post('/billing/currency/convert', {
        amount,
        from: fromCurrency,
        to: toCurrency
      });
      return response.data;
    } catch (error) {
      console.error('[BillingService] Currency conversion failed:', error);
      throw error;
    }
  },

  /**
   * Process multi-currency payment - WORKS OFFLINE (cash)
   * @param {string} invoiceId - Invoice ID
   * @param {Array} payments - Payments array
   * @param {string} method - Payment method
   * @returns {Promise} Payment result
   */
  async processMultiCurrencyPayment(invoiceId, payments, method = 'cash') {
    if (!navigator.onLine && method !== 'cash') {
      return {
        success: false,
        offline: true,
        message: 'Multi-currency card payments require online connectivity'
      };
    }

    const localData = {
      invoiceId,
      payments,
      method,
      _tempId: `temp_mcpay_${Date.now()}`,
      paymentDate: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/billing/invoices/${invoiceId}/multi-currency-payment`, { payments, method }),
      'CREATE',
      'payments',
      localData
    );
  },

  // ============================================
  // PDF DOWNLOADS - ONLINE ONLY
  // ============================================

  /**
   * Download invoice PDF - ONLINE ONLY
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Blob>} PDF blob
   */
  async downloadInvoicePDF(invoiceId) {
    if (!navigator.onLine) {
      throw new Error('PDF download requires online connectivity');
    }

    try {
      const response = await api.get(`/billing/invoices/${invoiceId}/pdf`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('[BillingService] Invoice PDF download failed:', error);
      throw error;
    }
  },

  /**
   * Download receipt PDF - ONLINE ONLY
   * @param {string} invoiceId - Invoice ID
   * @param {number} paymentIndex - Payment index
   * @returns {Promise<Blob>} PDF blob
   */
  async downloadReceiptPDF(invoiceId, paymentIndex) {
    if (!navigator.onLine) {
      throw new Error('Receipt PDF download requires online connectivity');
    }

    try {
      const response = await api.get(`/billing/invoices/${invoiceId}/receipt/${paymentIndex}`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('[BillingService] Receipt PDF download failed:', error);
      throw error;
    }
  },

  /**
   * Download statement PDF - ONLINE ONLY
   * @param {string} patientId - Patient ID
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {Promise<Blob>} PDF blob
   */
  async downloadStatementPDF(patientId, startDate, endDate) {
    if (!navigator.onLine) {
      throw new Error('Statement PDF download requires online connectivity');
    }

    try {
      const response = await api.get(`/billing/patients/${patientId}/statement`, {
        params: { startDate, endDate },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('[BillingService] Statement PDF download failed:', error);
      throw error;
    }
  },

  // ============================================
  // ADDITIONAL METHODS (PRESERVED FROM ORIGINAL)
  // ============================================

  async bulkGenerateInvoices(criteria) {
    if (!navigator.onLine) {
      throw new Error('Bulk invoice generation requires online connectivity');
    }
    try {
      const response = await api.post('/billing/invoices/bulk-generate', criteria);
      return response.data;
    } catch (error) {
      console.error('[BillingService] Bulk generation failed:', error);
      throw error;
    }
  },

  async submitBatchClaims(claimsData) {
    if (!navigator.onLine) {
      throw new Error('Batch claim submission requires online connectivity');
    }
    try {
      const response = await api.post('/billing/claims/batch', claimsData);
      return response.data;
    } catch (error) {
      console.error('[BillingService] Batch claims failed:', error);
      throw error;
    }
  },

  async getERA(params = {}) {
    return offlineWrapper.get(
      () => api.get('/billing/era', { params }),
      'invoices',
      { type: 'era', ...params },
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  async processERA(eraId) {
    if (!navigator.onLine) {
      throw new Error('ERA processing requires online connectivity');
    }
    try {
      const response = await api.post(`/billing/era/${eraId}/process`);
      return response.data;
    } catch (error) {
      console.error('[BillingService] ERA processing failed:', error);
      throw error;
    }
  },

  async getStatement(patientId, dateRange) {
    return offlineWrapper.get(
      () => api.get(`/patients/${patientId}/statement`, { params: dateRange }),
      'invoices',
      { type: 'statement', patientId, ...dateRange },
      { transform: (response) => response.data, cacheExpiry: 3600 }
    );
  },

  async calculateCopay(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/calculate-copay`),
      'invoices',
      { type: 'copay', visitId },
      { transform: (response) => response.data, cacheExpiry: 3600 }
    );
  },

  async getPaymentMethods() {
    return offlineWrapper.get(
      () => api.get('/billing/payment-methods'),
      'invoices',
      { type: 'paymentMethods' },
      { transform: (response) => response.data, cacheExpiry: 86400 }
    );
  },

  async addPaymentMethod(paymentMethodData) {
    if (!navigator.onLine) {
      throw new Error('Adding payment methods requires online connectivity');
    }
    try {
      const response = await api.post('/billing/payment-methods', paymentMethodData);
      return response.data;
    } catch (error) {
      console.error('[BillingService] Add payment method failed:', error);
      throw error;
    }
  },

  async removePaymentMethod(methodId) {
    if (!navigator.onLine) {
      throw new Error('Removing payment methods requires online connectivity');
    }
    try {
      const response = await api.delete(`/billing/payment-methods/${methodId}`);
      return response.data;
    } catch (error) {
      console.error('[BillingService] Remove payment method failed:', error);
      throw error;
    }
  },

  // ============================================
  // OFFLINE HELPER METHODS
  // ============================================

  /**
   * Pre-cache invoices for offline use
   * @param {Object} params - Cache params
   * @returns {Promise} Cache result
   */
  async preCacheInvoices(params = { limit: 100 }) {
    if (!navigator.onLine) {
      console.warn('[BillingService] Cannot pre-cache while offline');
      return { success: false };
    }

    try {
      console.log('[BillingService] Pre-caching invoices...');

      const response = await api.get('/invoices', { params });
      // Safely extract array from various API response formats
      const rawInvoices = response?.data?.data ?? response?.data ?? [];
      const invoices = Array.isArray(rawInvoices) ? rawInvoices : [];

      if (invoices.length > 0) {
        const timestamp = new Date().toISOString();
        const invoicesWithSync = invoices.map(inv => ({
          ...inv,
          id: inv._id || inv.id,
          lastSync: timestamp
        }));

        await db.invoices.bulkPut(invoicesWithSync);
        console.log(`[BillingService] Pre-cached ${invoices.length} invoices`);
      }

      return { success: true, cached: invoices.length };
    } catch (error) {
      console.error('[BillingService] Pre-cache failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Pre-cache fee schedule for offline use
   * @returns {Promise} Cache result
   */
  async preCacheFeeSchedule() {
    if (!navigator.onLine) {
      console.warn('[BillingService] Cannot pre-cache while offline');
      return { success: false };
    }

    try {
      console.log('[BillingService] Pre-caching fee schedule...');
      await this.getFeeSchedule();
      await this.getTaxRates();
      await this.getBillingCodes();
      console.log('[BillingService] Fee schedule pre-cached');
      return { success: true };
    } catch (error) {
      console.error('[BillingService] Fee schedule pre-cache failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get cached invoice count
   * @returns {Promise<number>} Count
   */
  async getCachedInvoiceCount() {
    return db.invoices.count();
  },

  /**
   * Clear cached data
   * @returns {Promise} Clear result
   */
  async clearCache() {
    await Promise.all([
      db.invoices.clear(),
      db.payments.clear()
    ]);
    return { success: true };
  }
};

export default billingService;
