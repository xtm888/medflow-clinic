import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { patientService } from '../../services';

// Initial state
const initialState = {
  patients: [],
  currentPatient: null,
  searchResults: [],
  recentPatients: [],
  totalCount: 0,
  currentPage: 1,
  pageSize: 20,
  isLoading: false,
  isSearching: false,
  error: null,
  filters: {
    status: 'all',
    sortBy: 'lastName',
    sortOrder: 'asc',
  },
  selectedPatientId: null,
  patientHistory: [],
  patientDocuments: [],
  patientAppointments: [],
  patientPrescriptions: [],
  patientVisits: [],
  patientBilling: null,
};

// Async thunks
export const fetchPatients = createAsyncThunk(
  'patient/fetchPatients',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await patientService.getPatients(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch patients');
    }
  }
);

export const fetchPatient = createAsyncThunk(
  'patient/fetchPatient',
  async (id, { rejectWithValue }) => {
    try {
      const response = await patientService.getPatient(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch patient');
    }
  }
);

export const createPatient = createAsyncThunk(
  'patient/createPatient',
  async (patientData, { rejectWithValue }) => {
    try {
      const response = await patientService.createPatient(patientData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create patient');
    }
  }
);

export const updatePatient = createAsyncThunk(
  'patient/updatePatient',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await patientService.updatePatient(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update patient');
    }
  }
);

export const deletePatient = createAsyncThunk(
  'patient/deletePatient',
  async (id, { rejectWithValue }) => {
    try {
      await patientService.deletePatient(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete patient');
    }
  }
);

export const searchPatients = createAsyncThunk(
  'patient/searchPatients',
  async (query, { rejectWithValue }) => {
    try {
      const response = await patientService.searchPatients(query);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Search failed');
    }
  }
);

export const fetchPatientHistory = createAsyncThunk(
  'patient/fetchHistory',
  async (patientId, { rejectWithValue }) => {
    try {
      const response = await patientService.getPatientHistory(patientId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch history');
    }
  }
);

export const fetchPatientDocuments = createAsyncThunk(
  'patient/fetchDocuments',
  async (patientId, { rejectWithValue }) => {
    try {
      const response = await patientService.getDocuments(patientId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch documents');
    }
  }
);

export const fetchPatientAppointments = createAsyncThunk(
  'patient/fetchAppointments',
  async (patientId, { rejectWithValue }) => {
    try {
      const response = await patientService.getPatientAppointments(patientId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch appointments');
    }
  }
);

export const fetchPatientPrescriptions = createAsyncThunk(
  'patient/fetchPrescriptions',
  async (patientId, { rejectWithValue }) => {
    try {
      const response = await patientService.getPatientPrescriptions(patientId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch prescriptions');
    }
  }
);

export const fetchPatientVisits = createAsyncThunk(
  'patient/fetchVisits',
  async (patientId, { rejectWithValue }) => {
    try {
      const response = await patientService.getPatientVisits(patientId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch visits');
    }
  }
);

export const fetchPatientBilling = createAsyncThunk(
  'patient/fetchBilling',
  async (patientId, { rejectWithValue }) => {
    try {
      const response = await patientService.getPatientBilling(patientId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch billing');
    }
  }
);

export const fetchRecentPatients = createAsyncThunk(
  'patient/fetchRecentPatients',
  async (limit = 10, { rejectWithValue }) => {
    try {
      const response = await patientService.getRecentPatients(limit);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch recent patients');
    }
  }
);

export const addPatientAllergy = createAsyncThunk(
  'patient/addAllergy',
  async ({ patientId, allergyData }, { rejectWithValue }) => {
    try {
      const response = await patientService.addPatientAllergy(patientId, allergyData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add allergy');
    }
  }
);

export const addPatientMedication = createAsyncThunk(
  'patient/addMedication',
  async ({ patientId, medicationData }, { rejectWithValue }) => {
    try {
      const response = await patientService.addPatientMedication(patientId, medicationData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add medication');
    }
  }
);

export const updatePatientInsurance = createAsyncThunk(
  'patient/updateInsurance',
  async ({ patientId, insuranceData }, { rejectWithValue }) => {
    try {
      const response = await patientService.updatePatientInsurance(patientId, insuranceData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update insurance');
    }
  }
);

// Patient slice
const patientSlice = createSlice({
  name: 'patient',
  initialState,
  reducers: {
    setCurrentPatient: (state, action) => {
      state.currentPatient = action.payload;
      state.selectedPatientId = action.payload?.id;
    },
    clearCurrentPatient: (state) => {
      state.currentPatient = null;
      state.selectedPatientId = null;
      state.patientHistory = [];
      state.patientDocuments = [];
      state.patientAppointments = [];
      state.patientPrescriptions = [];
      state.patientVisits = [];
      state.patientBilling = null;
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
    clearSearchResults: (state) => {
      state.searchResults = [];
    },
    updatePatientInList: (state, action) => {
      const index = state.patients.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.patients[index] = action.payload;
      }
      if (state.currentPatient?.id === action.payload.id) {
        state.currentPatient = action.payload;
      }
    },
    removePatientFromList: (state, action) => {
      state.patients = state.patients.filter(p => p.id !== action.payload);
      if (state.currentPatient?.id === action.payload) {
        state.currentPatient = null;
        state.selectedPatientId = null;
      }
    },
    // CRITICAL: Reset patient state on clinic switch to prevent data leakage
    resetPatientState: (state) => {
      state.patients = [];
      state.currentPatient = null;
      state.searchResults = [];
      state.recentPatients = [];
      state.totalCount = 0;
      state.currentPage = 1;
      state.isLoading = false;
      state.isSearching = false;
      state.error = null;
      state.selectedPatientId = null;
      state.patientHistory = [];
      state.patientDocuments = [];
      state.patientAppointments = [];
      state.patientPrescriptions = [];
      state.patientVisits = [];
      state.patientBilling = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch patients
      .addCase(fetchPatients.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPatients.fulfilled, (state, action) => {
        state.isLoading = false;
        state.patients = action.payload.patients || action.payload.data || action.payload;
        state.totalCount = action.payload.totalCount || action.payload.total || state.patients.length;
      })
      .addCase(fetchPatients.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch single patient
      .addCase(fetchPatient.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPatient.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentPatient = action.payload;
        state.selectedPatientId = action.payload.id;
      })
      .addCase(fetchPatient.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create patient
      .addCase(createPatient.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createPatient.fulfilled, (state, action) => {
        state.isLoading = false;
        state.patients.unshift(action.payload);
        state.totalCount += 1;
        state.currentPatient = action.payload;
        state.selectedPatientId = action.payload.id;
      })
      .addCase(createPatient.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update patient
      .addCase(updatePatient.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updatePatient.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.patients.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.patients[index] = action.payload;
        }
        if (state.currentPatient?.id === action.payload.id) {
          state.currentPatient = action.payload;
        }
      })
      .addCase(updatePatient.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Delete patient
      .addCase(deletePatient.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deletePatient.fulfilled, (state, action) => {
        state.isLoading = false;
        state.patients = state.patients.filter(p => p.id !== action.payload);
        state.totalCount -= 1;
        if (state.currentPatient?.id === action.payload) {
          state.currentPatient = null;
          state.selectedPatientId = null;
        }
      })
      .addCase(deletePatient.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Search patients
      .addCase(searchPatients.pending, (state) => {
        state.isSearching = true;
        state.error = null;
      })
      .addCase(searchPatients.fulfilled, (state, action) => {
        state.isSearching = false;
        state.searchResults = action.payload;
      })
      .addCase(searchPatients.rejected, (state, action) => {
        state.isSearching = false;
        state.error = action.payload;
      })
      // Fetch patient history
      .addCase(fetchPatientHistory.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchPatientHistory.fulfilled, (state, action) => {
        state.patientHistory = action.payload;
      })
      .addCase(fetchPatientHistory.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Fetch patient documents
      .addCase(fetchPatientDocuments.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchPatientDocuments.fulfilled, (state, action) => {
        state.patientDocuments = action.payload;
      })
      .addCase(fetchPatientDocuments.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Fetch patient appointments
      .addCase(fetchPatientAppointments.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchPatientAppointments.fulfilled, (state, action) => {
        state.patientAppointments = action.payload;
      })
      .addCase(fetchPatientAppointments.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Fetch patient prescriptions
      .addCase(fetchPatientPrescriptions.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchPatientPrescriptions.fulfilled, (state, action) => {
        state.patientPrescriptions = action.payload;
      })
      .addCase(fetchPatientPrescriptions.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Fetch patient visits
      .addCase(fetchPatientVisits.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchPatientVisits.fulfilled, (state, action) => {
        state.patientVisits = action.payload;
      })
      .addCase(fetchPatientVisits.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Fetch patient billing
      .addCase(fetchPatientBilling.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchPatientBilling.fulfilled, (state, action) => {
        state.patientBilling = action.payload;
      })
      .addCase(fetchPatientBilling.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Fetch recent patients
      .addCase(fetchRecentPatients.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchRecentPatients.fulfilled, (state, action) => {
        state.recentPatients = action.payload;
      })
      .addCase(fetchRecentPatients.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Add allergy
      .addCase(addPatientAllergy.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(addPatientAllergy.fulfilled, (state, action) => {
        state.isLoading = false;
        if (state.currentPatient) {
          state.currentPatient.allergies = state.currentPatient.allergies || [];
          state.currentPatient.allergies.push(action.payload);
        }
      })
      .addCase(addPatientAllergy.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Add medication
      .addCase(addPatientMedication.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(addPatientMedication.fulfilled, (state, action) => {
        state.isLoading = false;
        if (state.currentPatient) {
          state.currentPatient.medications = state.currentPatient.medications || [];
          state.currentPatient.medications.push(action.payload);
        }
      })
      .addCase(addPatientMedication.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update insurance
      .addCase(updatePatientInsurance.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updatePatientInsurance.fulfilled, (state, action) => {
        state.isLoading = false;
        if (state.currentPatient) {
          state.currentPatient.insurance = action.payload;
        }
      })
      .addCase(updatePatientInsurance.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

// Export actions
export const {
  setCurrentPatient,
  clearCurrentPatient,
  setFilters,
  setPage,
  setPageSize,
  clearError,
  clearSearchResults,
  updatePatientInList,
  removePatientFromList,
  resetPatientState,
} = patientSlice.actions;

// Selectors
export const selectAllPatients = (state) => state.patient.patients;
export const selectCurrentPatient = (state) => state.patient.currentPatient;
export const selectPatientSearchResults = (state) => state.patient.searchResults;
export const selectRecentPatients = (state) => state.patient.recentPatients;
export const selectPatientLoading = (state) => state.patient.isLoading;
export const selectPatientError = (state) => state.patient.error;
export const selectPatientFilters = (state) => state.patient.filters;
export const selectPatientPagination = (state) => ({
  currentPage: state.patient.currentPage,
  pageSize: state.patient.pageSize,
  totalCount: state.patient.totalCount,
});
export const selectPatientHistory = (state) => state.patient.patientHistory;
export const selectPatientDocuments = (state) => state.patient.patientDocuments;
export const selectPatientAppointments = (state) => state.patient.patientAppointments;
export const selectPatientPrescriptions = (state) => state.patient.patientPrescriptions;
export const selectPatientVisits = (state) => state.patient.patientVisits;
export const selectPatientBilling = (state) => state.patient.patientBilling;

export default patientSlice.reducer;