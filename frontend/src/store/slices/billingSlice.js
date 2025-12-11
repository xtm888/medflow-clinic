import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import billingService from '../../services/billingService';

// Initial state with pagination
const initialState = {
  invoices: [],
  payments: [],
  claims: [],
  paymentPlans: [],
  currentInvoice: null,
  currentClaim: null,
  billingStatistics: null,
  feeSchedule: [],
  taxRates: [],
  exchangeRates: null,
  totalCount: 0,
  currentPage: 1,
  pageSize: 20,
  isLoading: false,
  isProcessing: false,
  error: null,
  filters: {
    status: 'all',
    dateRange: {
      start: null,
      end: null,
    },
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
};

// Async thunks
export const fetchInvoices = createAsyncThunk(
  'billing/fetchInvoices',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await billingService.getInvoices(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch invoices');
    }
  }
);

export const fetchInvoice = createAsyncThunk(
  'billing/fetchInvoice',
  async (id, { rejectWithValue }) => {
    try {
      const response = await billingService.getInvoice(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch invoice');
    }
  }
);

export const createInvoice = createAsyncThunk(
  'billing/createInvoice',
  async (invoiceData, { rejectWithValue }) => {
    try {
      const response = await billingService.createInvoice(invoiceData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create invoice');
    }
  }
);

export const updateInvoice = createAsyncThunk(
  'billing/updateInvoice',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await billingService.updateInvoice(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update invoice');
    }
  }
);

export const deleteInvoice = createAsyncThunk(
  'billing/deleteInvoice',
  async (id, { rejectWithValue }) => {
    try {
      await billingService.deleteInvoice(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete invoice');
    }
  }
);

export const fetchPatientBilling = createAsyncThunk(
  'billing/fetchPatientBilling',
  async ({ patientId, params = {} }, { rejectWithValue }) => {
    try {
      const response = await billingService.getPatientBilling(patientId, params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch patient billing');
    }
  }
);

export const processPayment = createAsyncThunk(
  'billing/processPayment',
  async (paymentData, { rejectWithValue }) => {
    try {
      const response = await billingService.processPayment(paymentData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to process payment');
    }
  }
);

export const fetchPayments = createAsyncThunk(
  'billing/fetchPayments',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await billingService.getPayments(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch payments');
    }
  }
);

export const refundPayment = createAsyncThunk(
  'billing/refundPayment',
  async ({ paymentId, refundData }, { rejectWithValue }) => {
    try {
      const response = await billingService.refundPayment(paymentId, refundData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to refund payment');
    }
  }
);

export const submitInsuranceClaim = createAsyncThunk(
  'billing/submitInsuranceClaim',
  async (claimData, { rejectWithValue }) => {
    try {
      const response = await billingService.submitInsuranceClaim(claimData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to submit insurance claim');
    }
  }
);

export const fetchInsuranceClaims = createAsyncThunk(
  'billing/fetchInsuranceClaims',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await billingService.getInsuranceClaims(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch insurance claims');
    }
  }
);

export const fetchClaim = createAsyncThunk(
  'billing/fetchClaim',
  async (id, { rejectWithValue }) => {
    try {
      const response = await billingService.getClaim(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch claim');
    }
  }
);

export const updateClaimStatus = createAsyncThunk(
  'billing/updateClaimStatus',
  async ({ claimId, status, notes }, { rejectWithValue }) => {
    try {
      const response = await billingService.updateClaimStatus(claimId, status, notes);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update claim status');
    }
  }
);

export const fetchFeeSchedule = createAsyncThunk(
  'billing/fetchFeeSchedule',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await billingService.getFeeSchedule(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch fee schedule');
    }
  }
);

export const updateFeeSchedule = createAsyncThunk(
  'billing/updateFeeSchedule',
  async (feeScheduleData, { rejectWithValue }) => {
    try {
      const response = await billingService.updateFeeSchedule(feeScheduleData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update fee schedule');
    }
  }
);

export const fetchBillingStatistics = createAsyncThunk(
  'billing/fetchBillingStatistics',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await billingService.getBillingStatistics(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch billing statistics');
    }
  }
);

export const applyDiscount = createAsyncThunk(
  'billing/applyDiscount',
  async ({ invoiceId, discountData }, { rejectWithValue }) => {
    try {
      const response = await billingService.applyDiscount(invoiceId, discountData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to apply discount');
    }
  }
);

export const fetchPaymentPlans = createAsyncThunk(
  'billing/fetchPaymentPlans',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await billingService.getAllPaymentPlans(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch payment plans');
    }
  }
);

export const createPaymentPlan = createAsyncThunk(
  'billing/createPaymentPlan',
  async (paymentPlanData, { rejectWithValue }) => {
    try {
      const response = await billingService.createPaymentPlan(paymentPlanData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create payment plan');
    }
  }
);

export const fetchTaxRates = createAsyncThunk(
  'billing/fetchTaxRates',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await billingService.getTaxRates(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch tax rates');
    }
  }
);

export const fetchExchangeRates = createAsyncThunk(
  'billing/fetchExchangeRates',
  async (_, { rejectWithValue }) => {
    try {
      const response = await billingService.getExchangeRates();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch exchange rates');
    }
  }
);

export const processMultiCurrencyPayment = createAsyncThunk(
  'billing/processMultiCurrencyPayment',
  async ({ invoiceId, payments, method }, { rejectWithValue }) => {
    try {
      const response = await billingService.processMultiCurrencyPayment(invoiceId, payments, method);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to process multi-currency payment');
    }
  }
);

export const sendInvoiceToPatient = createAsyncThunk(
  'billing/sendInvoiceToPatient',
  async ({ invoiceId, method = 'email' }, { rejectWithValue }) => {
    try {
      const response = await billingService.sendInvoiceToPatient(invoiceId, method);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to send invoice');
    }
  }
);

export const writeOffAmount = createAsyncThunk(
  'billing/writeOffAmount',
  async ({ invoiceId, writeOffData }, { rejectWithValue }) => {
    try {
      const response = await billingService.writeOffAmount(invoiceId, writeOffData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to write off amount');
    }
  }
);

// Billing slice
const billingSlice = createSlice({
  name: 'billing',
  initialState,
  reducers: {
    setCurrentInvoice: (state, action) => {
      state.currentInvoice = action.payload;
    },
    clearCurrentInvoice: (state) => {
      state.currentInvoice = null;
    },
    setCurrentClaim: (state, action) => {
      state.currentClaim = action.payload;
    },
    clearCurrentClaim: (state) => {
      state.currentClaim = null;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setPage: (state, action) => {
      state.currentPage = action.payload;
    },
    setPageSize: (state, action) => {
      state.pageSize = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateInvoiceInList: (state, action) => {
      const index = state.invoices.findIndex(i => i._id === action.payload._id || i.id === action.payload.id);
      if (index !== -1) {
        state.invoices[index] = action.payload;
      }
      if (state.currentInvoice?._id === action.payload._id || state.currentInvoice?.id === action.payload.id) {
        state.currentInvoice = action.payload;
      }
    },
    removeInvoiceFromList: (state, action) => {
      state.invoices = state.invoices.filter(i => i._id !== action.payload && i.id !== action.payload);
      if (state.currentInvoice?._id === action.payload || state.currentInvoice?.id === action.payload) {
        state.currentInvoice = null;
      }
    },
    // CRITICAL: Reset billing state on clinic switch to prevent data leakage
    resetBillingState: (state) => {
      state.invoices = [];
      state.payments = [];
      state.claims = [];
      state.paymentPlans = [];
      state.currentInvoice = null;
      state.currentClaim = null;
      state.billingStatistics = null;
      state.totalCount = 0;
      state.currentPage = 1;
      state.isLoading = false;
      state.isProcessing = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch invoices
      .addCase(fetchInvoices.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchInvoices.fulfilled, (state, action) => {
        state.isLoading = false;
        state.invoices = action.payload.invoices || action.payload.data || action.payload;
        state.totalCount = action.payload.totalCount || action.payload.total || state.invoices.length;
      })
      .addCase(fetchInvoices.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch single invoice
      .addCase(fetchInvoice.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchInvoice.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentInvoice = action.payload;
      })
      .addCase(fetchInvoice.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create invoice
      .addCase(createInvoice.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createInvoice.fulfilled, (state, action) => {
        state.isLoading = false;
        state.invoices.unshift(action.payload);
        state.totalCount += 1;
        state.currentInvoice = action.payload;
      })
      .addCase(createInvoice.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update invoice
      .addCase(updateInvoice.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateInvoice.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.invoices.findIndex(i => i._id === action.payload._id || i.id === action.payload.id);
        if (index !== -1) {
          state.invoices[index] = action.payload;
        }
        if (state.currentInvoice?._id === action.payload._id || state.currentInvoice?.id === action.payload.id) {
          state.currentInvoice = action.payload;
        }
      })
      .addCase(updateInvoice.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Delete invoice
      .addCase(deleteInvoice.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteInvoice.fulfilled, (state, action) => {
        state.isLoading = false;
        state.invoices = state.invoices.filter(i => i._id !== action.payload && i.id !== action.payload);
        state.totalCount -= 1;
        if (state.currentInvoice?._id === action.payload || state.currentInvoice?.id === action.payload) {
          state.currentInvoice = null;
        }
      })
      .addCase(deleteInvoice.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch patient billing
      .addCase(fetchPatientBilling.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPatientBilling.fulfilled, (state, action) => {
        state.isLoading = false;
        state.invoices = action.payload.invoices || action.payload.data || action.payload;
      })
      .addCase(fetchPatientBilling.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Process payment
      .addCase(processPayment.pending, (state) => {
        state.isProcessing = true;
        state.error = null;
      })
      .addCase(processPayment.fulfilled, (state, action) => {
        state.isProcessing = false;
        state.payments.unshift(action.payload.payment || action.payload);
        // Update the invoice if it was returned
        if (action.payload.invoice) {
          const index = state.invoices.findIndex(i => i._id === action.payload.invoice._id || i.id === action.payload.invoice.id);
          if (index !== -1) {
            state.invoices[index] = action.payload.invoice;
          }
          if (state.currentInvoice?._id === action.payload.invoice._id || state.currentInvoice?.id === action.payload.invoice.id) {
            state.currentInvoice = action.payload.invoice;
          }
        }
      })
      .addCase(processPayment.rejected, (state, action) => {
        state.isProcessing = false;
        state.error = action.payload;
      })
      // Fetch payments
      .addCase(fetchPayments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPayments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.payments = action.payload.payments || action.payload.data || action.payload;
      })
      .addCase(fetchPayments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Refund payment
      .addCase(refundPayment.pending, (state) => {
        state.isProcessing = true;
        state.error = null;
      })
      .addCase(refundPayment.fulfilled, (state, action) => {
        state.isProcessing = false;
        // Update the invoice if returned
        if (action.payload.invoice) {
          const index = state.invoices.findIndex(i => i._id === action.payload.invoice._id || i.id === action.payload.invoice.id);
          if (index !== -1) {
            state.invoices[index] = action.payload.invoice;
          }
          if (state.currentInvoice?._id === action.payload.invoice._id || state.currentInvoice?.id === action.payload.invoice.id) {
            state.currentInvoice = action.payload.invoice;
          }
        }
      })
      .addCase(refundPayment.rejected, (state, action) => {
        state.isProcessing = false;
        state.error = action.payload;
      })
      // Submit insurance claim
      .addCase(submitInsuranceClaim.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(submitInsuranceClaim.fulfilled, (state, action) => {
        state.isLoading = false;
        state.claims.unshift(action.payload);
      })
      .addCase(submitInsuranceClaim.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch insurance claims
      .addCase(fetchInsuranceClaims.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchInsuranceClaims.fulfilled, (state, action) => {
        state.isLoading = false;
        state.claims = action.payload.claims || action.payload.data || action.payload;
      })
      .addCase(fetchInsuranceClaims.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch single claim
      .addCase(fetchClaim.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchClaim.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentClaim = action.payload;
      })
      .addCase(fetchClaim.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update claim status
      .addCase(updateClaimStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateClaimStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.claims.findIndex(c => c._id === action.payload._id || c.id === action.payload.id);
        if (index !== -1) {
          state.claims[index] = action.payload;
        }
        if (state.currentClaim?._id === action.payload._id || state.currentClaim?.id === action.payload.id) {
          state.currentClaim = action.payload;
        }
      })
      .addCase(updateClaimStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch fee schedule
      .addCase(fetchFeeSchedule.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchFeeSchedule.fulfilled, (state, action) => {
        state.isLoading = false;
        state.feeSchedule = action.payload.feeSchedule || action.payload.data || action.payload;
      })
      .addCase(fetchFeeSchedule.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update fee schedule
      .addCase(updateFeeSchedule.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateFeeSchedule.fulfilled, (state, action) => {
        state.isLoading = false;
        state.feeSchedule = action.payload.feeSchedule || action.payload.data || action.payload;
      })
      .addCase(updateFeeSchedule.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch billing statistics
      .addCase(fetchBillingStatistics.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchBillingStatistics.fulfilled, (state, action) => {
        state.isLoading = false;
        state.billingStatistics = action.payload;
      })
      .addCase(fetchBillingStatistics.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Apply discount
      .addCase(applyDiscount.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(applyDiscount.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.invoices.findIndex(i => i._id === action.payload._id || i.id === action.payload.id);
        if (index !== -1) {
          state.invoices[index] = action.payload;
        }
        if (state.currentInvoice?._id === action.payload._id || state.currentInvoice?.id === action.payload.id) {
          state.currentInvoice = action.payload;
        }
      })
      .addCase(applyDiscount.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch payment plans
      .addCase(fetchPaymentPlans.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPaymentPlans.fulfilled, (state, action) => {
        state.isLoading = false;
        state.paymentPlans = action.payload.paymentPlans || action.payload.data || action.payload;
      })
      .addCase(fetchPaymentPlans.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create payment plan
      .addCase(createPaymentPlan.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createPaymentPlan.fulfilled, (state, action) => {
        state.isLoading = false;
        state.paymentPlans.unshift(action.payload);
      })
      .addCase(createPaymentPlan.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch tax rates
      .addCase(fetchTaxRates.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTaxRates.fulfilled, (state, action) => {
        state.isLoading = false;
        state.taxRates = action.payload.taxRates || action.payload.data || action.payload;
      })
      .addCase(fetchTaxRates.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch exchange rates
      .addCase(fetchExchangeRates.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchExchangeRates.fulfilled, (state, action) => {
        state.isLoading = false;
        state.exchangeRates = action.payload;
      })
      .addCase(fetchExchangeRates.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Process multi-currency payment
      .addCase(processMultiCurrencyPayment.pending, (state) => {
        state.isProcessing = true;
        state.error = null;
      })
      .addCase(processMultiCurrencyPayment.fulfilled, (state, action) => {
        state.isProcessing = false;
        if (action.payload.invoice) {
          const index = state.invoices.findIndex(i => i._id === action.payload.invoice._id || i.id === action.payload.invoice.id);
          if (index !== -1) {
            state.invoices[index] = action.payload.invoice;
          }
          if (state.currentInvoice?._id === action.payload.invoice._id || state.currentInvoice?.id === action.payload.invoice.id) {
            state.currentInvoice = action.payload.invoice;
          }
        }
      })
      .addCase(processMultiCurrencyPayment.rejected, (state, action) => {
        state.isProcessing = false;
        state.error = action.payload;
      })
      // Send invoice to patient
      .addCase(sendInvoiceToPatient.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(sendInvoiceToPatient.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.invoices.findIndex(i => i._id === action.payload._id || i.id === action.payload.id);
        if (index !== -1) {
          state.invoices[index] = action.payload;
        }
        if (state.currentInvoice?._id === action.payload._id || state.currentInvoice?.id === action.payload.id) {
          state.currentInvoice = action.payload;
        }
      })
      .addCase(sendInvoiceToPatient.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Write off amount
      .addCase(writeOffAmount.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(writeOffAmount.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.invoices.findIndex(i => i._id === action.payload._id || i.id === action.payload.id);
        if (index !== -1) {
          state.invoices[index] = action.payload;
        }
        if (state.currentInvoice?._id === action.payload._id || state.currentInvoice?.id === action.payload.id) {
          state.currentInvoice = action.payload;
        }
      })
      .addCase(writeOffAmount.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

// Export actions
export const {
  setCurrentInvoice,
  clearCurrentInvoice,
  setCurrentClaim,
  clearCurrentClaim,
  setFilters,
  setPage,
  setPageSize,
  clearError,
  updateInvoiceInList,
  removeInvoiceFromList,
  resetBillingState,
} = billingSlice.actions;

// Selectors
export const selectAllInvoices = (state) => state.billing.invoices;
export const selectCurrentInvoice = (state) => state.billing.currentInvoice;
export const selectAllPayments = (state) => state.billing.payments;
export const selectAllClaims = (state) => state.billing.claims;
export const selectCurrentClaim = (state) => state.billing.currentClaim;
export const selectPaymentPlans = (state) => state.billing.paymentPlans;
export const selectBillingStatistics = (state) => state.billing.billingStatistics;
export const selectFeeSchedule = (state) => state.billing.feeSchedule;
export const selectTaxRates = (state) => state.billing.taxRates;
export const selectExchangeRates = (state) => state.billing.exchangeRates;
export const selectBillingLoading = (state) => state.billing.isLoading;
export const selectBillingProcessing = (state) => state.billing.isProcessing;
export const selectBillingError = (state) => state.billing.error;
export const selectBillingFilters = (state) => state.billing.filters;
export const selectBillingPagination = (state) => ({
  currentPage: state.billing.currentPage,
  pageSize: state.billing.pageSize,
  totalCount: state.billing.totalCount,
});

export default billingSlice.reducer;
