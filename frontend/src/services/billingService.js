import api from './apiConfig';

// Billing service for managing financial operations
const billingService = {
  // Get all invoices with filters
  async getInvoices(params = {}) {
    try {
      const response = await api.get('/invoices', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching invoices:', error);
      throw error;
    }
  },

  // Get single invoice
  async getInvoice(id) {
    try {
      const response = await api.get(`/invoices/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching invoice:', error);
      throw error;
    }
  },

  // Create new invoice
  async createInvoice(invoiceData) {
    try {
      const response = await api.post('/invoices', invoiceData);
      return response.data;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  },

  // Update invoice
  async updateInvoice(id, invoiceData) {
    try {
      const response = await api.put(`/invoices/${id}`, invoiceData);
      return response.data;
    } catch (error) {
      console.error('Error updating invoice:', error);
      throw error;
    }
  },

  // Delete invoice
  async deleteInvoice(id) {
    try {
      const response = await api.delete(`/invoices/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting invoice:', error);
      throw error;
    }
  },

  // Get patient billing (invoices)
  async getPatientBilling(patientId, params = {}) {
    try {
      const response = await api.get(`/invoices/patient/${patientId}`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching patient billing:', error);
      throw error;
    }
  },

  // Get visit billing
  async getVisitBilling(visitId) {
    try {
      const response = await api.get(`/visits/${visitId}/billing`);
      return response.data;
    } catch (error) {
      console.error('Error fetching visit billing:', error);
      throw error;
    }
  },

  // Process payment
  async processPayment(paymentData) {
    try {
      // Payment must be linked to an invoice
      if (!paymentData.invoiceId) {
        throw new Error('Invoice ID is required for payment');
      }
      const response = await api.post(`/invoices/${paymentData.invoiceId}/payments`, paymentData);
      return response.data;
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  },

  // Get payments
  async getPayments(params = {}) {
    try {
      const response = await api.get('/invoices/payments', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  },

  // Get payment details
  async getPayment(id) {
    try {
      const response = await api.get(`/invoices/payments/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching payment:', error);
      throw error;
    }
  },

  // Refund payment
  async refundPayment(paymentId, refundData) {
    try {
      const response = await api.post(`/invoices/${paymentId}/refund`, refundData);
      return response.data;
    } catch (error) {
      console.error('Error refunding payment:', error);
      throw error;
    }
  },

  // Submit insurance claim
  async submitInsuranceClaim(claimData) {
    try {
      const response = await api.post('/billing/claims', claimData);
      return response.data;
    } catch (error) {
      console.error('Error submitting insurance claim:', error);
      throw error;
    }
  },

  // Get insurance claims
  async getInsuranceClaims(params = {}) {
    try {
      const response = await api.get('/billing/claims', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching insurance claims:', error);
      throw error;
    }
  },

  // Get claim details
  async getClaim(id) {
    try {
      const response = await api.get(`/billing/claims/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching claim:', error);
      throw error;
    }
  },

  // Update claim status
  async updateClaimStatus(claimId, status, notes) {
    try {
      const response = await api.put(`/billing/claims/${claimId}/status`, { status, notes });
      return response.data;
    } catch (error) {
      console.error('Error updating claim status:', error);
      throw error;
    }
  },

  // Check insurance eligibility
  async checkInsuranceEligibility(insuranceData) {
    try {
      const response = await api.post('/billing/check-eligibility', insuranceData);
      return response.data;
    } catch (error) {
      console.error('Error checking insurance eligibility:', error);
      throw error;
    }
  },

  // Verify insurance coverage
  async verifyInsuranceCoverage(patientId, procedureCodes) {
    try {
      const response = await api.post('/billing/verify-coverage', {
        patientId,
        procedureCodes
      });
      return response.data;
    } catch (error) {
      console.error('Error verifying insurance coverage:', error);
      throw error;
    }
  },

  // Get fee schedule
  async getFeeSchedule(params = {}) {
    try {
      const response = await api.get('/billing/fee-schedule', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching fee schedule:', error);
      throw error;
    }
  },

  // Update fee schedule
  async updateFeeSchedule(feeScheduleData) {
    try {
      const response = await api.put('/billing/fee-schedule', feeScheduleData);
      return response.data;
    } catch (error) {
      console.error('Error updating fee schedule:', error);
      throw error;
    }
  },

  // Generate invoice PDF - Note: Returns invoice data for client-side PDF generation
  async generateInvoicePDF(invoiceId) {
    try {
      // Get full invoice data for PDF generation
      const response = await api.get(`/invoices/${invoiceId}`);
      return response.data;
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      throw error;
    }
  },

  // Send invoice to patient (mark as sent)
  async sendInvoiceToPatient(invoiceId, method = 'email') {
    try {
      const response = await api.put(`/invoices/${invoiceId}/send`, { method });
      return response.data;
    } catch (error) {
      console.error('Error sending invoice:', error);
      throw error;
    }
  },

  // Apply discount
  async applyDiscount(invoiceId, discountData) {
    try {
      const response = await api.post(`/billing/invoices/${invoiceId}/apply-discount`, discountData);
      return response.data;
    } catch (error) {
      console.error('Error applying discount:', error);
      throw error;
    }
  },

  // Get payment plans
  async getPaymentPlans(patientId) {
    try {
      const response = await api.get(`/patients/${patientId}/payment-plans`);
      return response.data;
    } catch (error) {
      console.error('Error fetching payment plans:', error);
      throw error;
    }
  },

  // Create payment plan
  async createPaymentPlan(paymentPlanData) {
    try {
      const response = await api.post('/billing/payment-plans', paymentPlanData);
      return response.data;
    } catch (error) {
      console.error('Error creating payment plan:', error);
      throw error;
    }
  },

  // Update payment plan
  async updatePaymentPlan(planId, planData) {
    try {
      const response = await api.put(`/billing/payment-plans/${planId}`, planData);
      return response.data;
    } catch (error) {
      console.error('Error updating payment plan:', error);
      throw error;
    }
  },

  // Get outstanding balances
  async getOutstandingBalances(params = {}) {
    try {
      const response = await api.get('/billing/outstanding-balances', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching outstanding balances:', error);
      throw error;
    }
  },

  // Get billing statistics
  async getBillingStatistics(params = {}) {
    try {
      const response = await api.get('/billing/statistics', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching billing statistics:', error);
      throw error;
    }
  },

  // Get revenue report
  async getRevenueReport(startDate, endDate) {
    try {
      const response = await api.get('/billing/reports/revenue', {
        params: { startDate, endDate }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching revenue report:', error);
      throw error;
    }
  },

  // Get aging report
  async getAgingReport() {
    try {
      const response = await api.get('/billing/reports/aging');
      return response.data;
    } catch (error) {
      console.error('Error fetching aging report:', error);
      throw error;
    }
  },

  // Bulk invoice generation
  async bulkGenerateInvoices(criteria) {
    try {
      const response = await api.post('/billing/invoices/bulk-generate', criteria);
      return response.data;
    } catch (error) {
      console.error('Error bulk generating invoices:', error);
      throw error;
    }
  },

  // Write off amount
  async writeOffAmount(invoiceId, writeOffData) {
    try {
      const response = await api.post(`/billing/invoices/${invoiceId}/write-off`, writeOffData);
      return response.data;
    } catch (error) {
      console.error('Error writing off amount:', error);
      throw error;
    }
  },

  // Get tax rates
  async getTaxRates() {
    try {
      const response = await api.get('/billing/tax-rates');
      return response.data;
    } catch (error) {
      console.error('Error fetching tax rates:', error);
      throw error;
    }
  },

  // Update tax rates
  async updateTaxRates(taxRatesData) {
    try {
      const response = await api.put('/billing/tax-rates', taxRatesData);
      return response.data;
    } catch (error) {
      console.error('Error updating tax rates:', error);
      throw error;
    }
  },

  // Get billing codes
  async getBillingCodes(type) {
    try {
      const response = await api.get('/billing/codes', {
        params: { type }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching billing codes:', error);
      throw error;
    }
  },

  // Search billing codes
  async searchBillingCodes(query) {
    try {
      const response = await api.get('/billing/codes/search', {
        params: { q: query }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching billing codes:', error);
      throw error;
    }
  },

  // Submit batch claims
  async submitBatchClaims(claimsData) {
    try {
      const response = await api.post('/billing/claims/batch', claimsData);
      return response.data;
    } catch (error) {
      console.error('Error submitting batch claims:', error);
      throw error;
    }
  },

  // Get ERA (Electronic Remittance Advice)
  async getERA(params = {}) {
    try {
      const response = await api.get('/billing/era', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching ERA:', error);
      throw error;
    }
  },

  // Process ERA
  async processERA(eraId) {
    try {
      const response = await api.post(`/billing/era/${eraId}/process`);
      return response.data;
    } catch (error) {
      console.error('Error processing ERA:', error);
      throw error;
    }
  },

  // Get statement
  async getStatement(patientId, dateRange) {
    try {
      const response = await api.get(`/patients/${patientId}/statement`, {
        params: dateRange
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching statement:', error);
      throw error;
    }
  },

  // Generate statement PDF
  async generateStatementPDF(patientId, dateRange) {
    try {
      const response = await api.get(`/patients/${patientId}/statement/pdf`, {
        params: dateRange,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error generating statement PDF:', error);
      throw error;
    }
  },

  // Calculate copay
  async calculateCopay(visitId) {
    try {
      const response = await api.get(`/visits/${visitId}/calculate-copay`);
      return response.data;
    } catch (error) {
      console.error('Error calculating copay:', error);
      throw error;
    }
  },

  // Get payment methods
  async getPaymentMethods() {
    try {
      const response = await api.get('/billing/payment-methods');
      return response.data;
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      throw error;
    }
  },

  // Add payment method
  async addPaymentMethod(paymentMethodData) {
    try {
      const response = await api.post('/billing/payment-methods', paymentMethodData);
      return response.data;
    } catch (error) {
      console.error('Error adding payment method:', error);
      throw error;
    }
  },

  // Remove payment method
  async removePaymentMethod(methodId) {
    try {
      const response = await api.delete(`/billing/payment-methods/${methodId}`);
      return response.data;
    } catch (error) {
      console.error('Error removing payment method:', error);
      throw error;
    }
  }
};

export default billingService;