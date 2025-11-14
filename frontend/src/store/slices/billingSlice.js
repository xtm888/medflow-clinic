import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  invoices: [],
  payments: [],
  claims: [],
  currentInvoice: null,
  isLoading: false,
  error: null,
};

const billingSlice = createSlice({
  name: 'billing',
  initialState,
  reducers: {
    setInvoices: (state, action) => {
      state.invoices = action.payload;
    },
    setPayments: (state, action) => {
      state.payments = action.payload;
    },
    setClaims: (state, action) => {
      state.claims = action.payload;
    },
    setCurrentInvoice: (state, action) => {
      state.currentInvoice = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const { setInvoices, setPayments, setClaims, setCurrentInvoice, clearError } = billingSlice.actions;
export default billingSlice.reducer;
