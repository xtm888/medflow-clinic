import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import prescriptionService from '../../services/prescriptionService';

// Initial state with pagination
const initialState = {
  prescriptions: [],
  currentPrescription: null,
  opticalPrescriptions: [],
  drugPrescriptions: [],
  patientPrescriptions: [],
  refillHistory: [],
  totalCount: 0,
  currentPage: 1,
  pageSize: 20,
  isLoading: false,
  isDispensing: false,
  error: null,
  filters: {
    type: 'all',
    status: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
};

// Async thunks
export const fetchPrescriptions = createAsyncThunk(
  'prescription/fetchPrescriptions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await prescriptionService.getPrescriptions(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch prescriptions');
    }
  }
);

export const fetchPrescription = createAsyncThunk(
  'prescription/fetchPrescription',
  async (id, { rejectWithValue }) => {
    try {
      const response = await prescriptionService.getPrescription(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch prescription');
    }
  }
);

export const createPrescription = createAsyncThunk(
  'prescription/createPrescription',
  async (prescriptionData, { rejectWithValue }) => {
    try {
      const response = await prescriptionService.createPrescription(prescriptionData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create prescription');
    }
  }
);

export const updatePrescription = createAsyncThunk(
  'prescription/updatePrescription',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await prescriptionService.updatePrescription(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update prescription');
    }
  }
);

export const deletePrescription = createAsyncThunk(
  'prescription/deletePrescription',
  async (id, { rejectWithValue }) => {
    try {
      await prescriptionService.deletePrescription(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete prescription');
    }
  }
);

export const fetchPatientPrescriptions = createAsyncThunk(
  'prescription/fetchPatientPrescriptions',
  async ({ patientId, params = {} }, { rejectWithValue }) => {
    try {
      const response = await prescriptionService.getPatientPrescriptions(patientId, params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch patient prescriptions');
    }
  }
);

export const fetchOpticalPrescriptions = createAsyncThunk(
  'prescription/fetchOpticalPrescriptions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await prescriptionService.getOpticalPrescriptions(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch optical prescriptions');
    }
  }
);

export const fetchDrugPrescriptions = createAsyncThunk(
  'prescription/fetchDrugPrescriptions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await prescriptionService.getDrugPrescriptions(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch drug prescriptions');
    }
  }
);

export const createOpticalPrescription = createAsyncThunk(
  'prescription/createOpticalPrescription',
  async (prescriptionData, { rejectWithValue }) => {
    try {
      const response = await prescriptionService.createOpticalPrescription(prescriptionData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create optical prescription');
    }
  }
);

export const createDrugPrescription = createAsyncThunk(
  'prescription/createDrugPrescription',
  async (prescriptionData, { rejectWithValue }) => {
    try {
      const response = await prescriptionService.createDrugPrescription(prescriptionData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create drug prescription');
    }
  }
);

export const verifyPrescription = createAsyncThunk(
  'prescription/verifyPrescription',
  async ({ id, verificationData }, { rejectWithValue }) => {
    try {
      const response = await prescriptionService.verifyPrescription(id, verificationData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to verify prescription');
    }
  }
);

export const dispensePrescription = createAsyncThunk(
  'prescription/dispensePrescription',
  async ({ id, dispensingData }, { rejectWithValue }) => {
    try {
      const response = await prescriptionService.dispensePrescription(id, dispensingData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to dispense prescription');
    }
  }
);

export const refillPrescription = createAsyncThunk(
  'prescription/refillPrescription',
  async ({ id, refillData = {} }, { rejectWithValue }) => {
    try {
      const response = await prescriptionService.refillPrescription(id, refillData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to refill prescription');
    }
  }
);

export const renewPrescription = createAsyncThunk(
  'prescription/renewPrescription',
  async ({ id, renewData = {} }, { rejectWithValue }) => {
    try {
      const response = await prescriptionService.renewPrescription(id, renewData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to renew prescription');
    }
  }
);

export const fetchRefillHistory = createAsyncThunk(
  'prescription/fetchRefillHistory',
  async (id, { rejectWithValue }) => {
    try {
      const response = await prescriptionService.getRefillHistory(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch refill history');
    }
  }
);

export const cancelPrescription = createAsyncThunk(
  'prescription/cancelPrescription',
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const response = await prescriptionService.cancelPrescription(id, reason);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to cancel prescription');
    }
  }
);

export const checkDrugInteractions = createAsyncThunk(
  'prescription/checkDrugInteractions',
  async ({ drugs, patientId, currentMedications = [] }, { rejectWithValue }) => {
    try {
      const response = await prescriptionService.checkDrugInteractions(drugs, patientId, currentMedications);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to check drug interactions');
    }
  }
);

export const updatePharmacyStatus = createAsyncThunk(
  'prescription/updatePharmacyStatus',
  async ({ id, status, notes = '', reason = '' }, { rejectWithValue }) => {
    try {
      const response = await prescriptionService.updatePharmacyStatus(id, status, notes, reason);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update pharmacy status');
    }
  }
);

// Prescription slice
const prescriptionSlice = createSlice({
  name: 'prescription',
  initialState,
  reducers: {
    setCurrentPrescription: (state, action) => {
      state.currentPrescription = action.payload;
    },
    clearCurrentPrescription: (state) => {
      state.currentPrescription = null;
      state.refillHistory = [];
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
    updatePrescriptionInList: (state, action) => {
      const index = state.prescriptions.findIndex(p => p._id === action.payload._id || p.id === action.payload.id);
      if (index !== -1) {
        state.prescriptions[index] = action.payload;
      }
      if (state.currentPrescription?._id === action.payload._id || state.currentPrescription?.id === action.payload.id) {
        state.currentPrescription = action.payload;
      }
    },
    removePrescriptionFromList: (state, action) => {
      state.prescriptions = state.prescriptions.filter(p => p._id !== action.payload && p.id !== action.payload);
      if (state.currentPrescription?._id === action.payload || state.currentPrescription?.id === action.payload) {
        state.currentPrescription = null;
      }
    },
    // CRITICAL: Reset prescription state on clinic switch to prevent data leakage
    resetPrescriptionState: (state) => {
      state.prescriptions = [];
      state.currentPrescription = null;
      state.opticalPrescriptions = [];
      state.drugPrescriptions = [];
      state.patientPrescriptions = [];
      state.refillHistory = [];
      state.totalCount = 0;
      state.currentPage = 1;
      state.isLoading = false;
      state.isDispensing = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch prescriptions
      .addCase(fetchPrescriptions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPrescriptions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.prescriptions = action.payload.prescriptions || action.payload.data || action.payload;
        state.totalCount = action.payload.totalCount || action.payload.total || state.prescriptions.length;
      })
      .addCase(fetchPrescriptions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch single prescription
      .addCase(fetchPrescription.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPrescription.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentPrescription = action.payload;
      })
      .addCase(fetchPrescription.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create prescription
      .addCase(createPrescription.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createPrescription.fulfilled, (state, action) => {
        state.isLoading = false;
        state.prescriptions.unshift(action.payload);
        state.totalCount += 1;
        state.currentPrescription = action.payload;
      })
      .addCase(createPrescription.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update prescription
      .addCase(updatePrescription.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updatePrescription.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.prescriptions.findIndex(p => p._id === action.payload._id || p.id === action.payload.id);
        if (index !== -1) {
          state.prescriptions[index] = action.payload;
        }
        if (state.currentPrescription?._id === action.payload._id || state.currentPrescription?.id === action.payload.id) {
          state.currentPrescription = action.payload;
        }
      })
      .addCase(updatePrescription.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Delete prescription
      .addCase(deletePrescription.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deletePrescription.fulfilled, (state, action) => {
        state.isLoading = false;
        state.prescriptions = state.prescriptions.filter(p => p._id !== action.payload && p.id !== action.payload);
        state.totalCount -= 1;
        if (state.currentPrescription?._id === action.payload || state.currentPrescription?.id === action.payload) {
          state.currentPrescription = null;
        }
      })
      .addCase(deletePrescription.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch patient prescriptions
      .addCase(fetchPatientPrescriptions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPatientPrescriptions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.patientPrescriptions = action.payload.prescriptions || action.payload.data || action.payload;
      })
      .addCase(fetchPatientPrescriptions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch optical prescriptions
      .addCase(fetchOpticalPrescriptions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchOpticalPrescriptions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.opticalPrescriptions = action.payload.prescriptions || action.payload.data || action.payload;
      })
      .addCase(fetchOpticalPrescriptions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch drug prescriptions
      .addCase(fetchDrugPrescriptions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDrugPrescriptions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.drugPrescriptions = action.payload.prescriptions || action.payload.data || action.payload;
      })
      .addCase(fetchDrugPrescriptions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create optical prescription
      .addCase(createOpticalPrescription.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createOpticalPrescription.fulfilled, (state, action) => {
        state.isLoading = false;
        state.opticalPrescriptions.unshift(action.payload);
        state.prescriptions.unshift(action.payload);
        state.totalCount += 1;
        state.currentPrescription = action.payload;
      })
      .addCase(createOpticalPrescription.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create drug prescription
      .addCase(createDrugPrescription.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createDrugPrescription.fulfilled, (state, action) => {
        state.isLoading = false;
        state.drugPrescriptions.unshift(action.payload);
        state.prescriptions.unshift(action.payload);
        state.totalCount += 1;
        state.currentPrescription = action.payload;
      })
      .addCase(createDrugPrescription.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Verify prescription
      .addCase(verifyPrescription.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(verifyPrescription.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.prescriptions.findIndex(p => p._id === action.payload._id || p.id === action.payload.id);
        if (index !== -1) {
          state.prescriptions[index] = action.payload;
        }
        if (state.currentPrescription?._id === action.payload._id || state.currentPrescription?.id === action.payload.id) {
          state.currentPrescription = action.payload;
        }
      })
      .addCase(verifyPrescription.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Dispense prescription
      .addCase(dispensePrescription.pending, (state) => {
        state.isDispensing = true;
        state.error = null;
      })
      .addCase(dispensePrescription.fulfilled, (state, action) => {
        state.isDispensing = false;
        const index = state.prescriptions.findIndex(p => p._id === action.payload._id || p.id === action.payload.id);
        if (index !== -1) {
          state.prescriptions[index] = action.payload;
        }
        if (state.currentPrescription?._id === action.payload._id || state.currentPrescription?.id === action.payload.id) {
          state.currentPrescription = action.payload;
        }
      })
      .addCase(dispensePrescription.rejected, (state, action) => {
        state.isDispensing = false;
        state.error = action.payload;
      })
      // Refill prescription
      .addCase(refillPrescription.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(refillPrescription.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.prescriptions.findIndex(p => p._id === action.payload._id || p.id === action.payload.id);
        if (index !== -1) {
          state.prescriptions[index] = action.payload;
        }
        if (state.currentPrescription?._id === action.payload._id || state.currentPrescription?.id === action.payload.id) {
          state.currentPrescription = action.payload;
        }
      })
      .addCase(refillPrescription.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Renew prescription
      .addCase(renewPrescription.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(renewPrescription.fulfilled, (state, action) => {
        state.isLoading = false;
        state.prescriptions.unshift(action.payload);
        state.totalCount += 1;
        state.currentPrescription = action.payload;
      })
      .addCase(renewPrescription.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch refill history
      .addCase(fetchRefillHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchRefillHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.refillHistory = action.payload;
      })
      .addCase(fetchRefillHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Cancel prescription
      .addCase(cancelPrescription.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(cancelPrescription.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.prescriptions.findIndex(p => p._id === action.payload._id || p.id === action.payload.id);
        if (index !== -1) {
          state.prescriptions[index] = action.payload;
        }
        if (state.currentPrescription?._id === action.payload._id || state.currentPrescription?.id === action.payload.id) {
          state.currentPrescription = action.payload;
        }
      })
      .addCase(cancelPrescription.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Check drug interactions
      .addCase(checkDrugInteractions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(checkDrugInteractions.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(checkDrugInteractions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update pharmacy status
      .addCase(updatePharmacyStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updatePharmacyStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.prescriptions.findIndex(p => p._id === action.payload._id || p.id === action.payload.id);
        if (index !== -1) {
          state.prescriptions[index] = action.payload;
        }
        if (state.currentPrescription?._id === action.payload._id || state.currentPrescription?.id === action.payload.id) {
          state.currentPrescription = action.payload;
        }
      })
      .addCase(updatePharmacyStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

// Export actions
export const {
  setCurrentPrescription,
  clearCurrentPrescription,
  setFilters,
  setPage,
  setPageSize,
  clearError,
  updatePrescriptionInList,
  removePrescriptionFromList,
  resetPrescriptionState,
} = prescriptionSlice.actions;

// Selectors
export const selectAllPrescriptions = (state) => state.prescription.prescriptions;
export const selectCurrentPrescription = (state) => state.prescription.currentPrescription;
export const selectOpticalPrescriptions = (state) => state.prescription.opticalPrescriptions;
export const selectDrugPrescriptions = (state) => state.prescription.drugPrescriptions;
export const selectPatientPrescriptions = (state) => state.prescription.patientPrescriptions;
export const selectRefillHistory = (state) => state.prescription.refillHistory;
export const selectPrescriptionLoading = (state) => state.prescription.isLoading;
export const selectPrescriptionDispensing = (state) => state.prescription.isDispensing;
export const selectPrescriptionError = (state) => state.prescription.error;
export const selectPrescriptionFilters = (state) => state.prescription.filters;
export const selectPrescriptionPagination = (state) => ({
  currentPage: state.prescription.currentPage,
  pageSize: state.prescription.pageSize,
  totalCount: state.prescription.totalCount,
});

export default prescriptionSlice.reducer;
