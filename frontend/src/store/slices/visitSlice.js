import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { visitService } from '../../services';

// Initial state
const initialState = {
  visits: [],
  currentVisit: null,
  activeVisits: [],
  todaysVisits: [],
  visitActs: [],
  visitNotes: [],
  visitDiagnoses: [],
  visitPrescriptions: [],
  vitalSigns: [],
  totalCount: 0,
  currentPage: 1,
  pageSize: 20,
  isLoading: false,
  error: null,
  filters: {
    status: 'all',
    provider: null,
    dateRange: {
      start: null,
      end: null,
    },
    sortBy: 'visitDate',
    sortOrder: 'desc',
  },
  selectedVisitId: null,
  visitTemplates: [],
};

// Async thunks
export const fetchVisits = createAsyncThunk(
  'visit/fetchVisits',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await visitService.getVisits(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch visits');
    }
  }
);

export const fetchVisit = createAsyncThunk(
  'visit/fetchVisit',
  async (id, { rejectWithValue }) => {
    try {
      const response = await visitService.getVisit(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch visit');
    }
  }
);

export const createVisit = createAsyncThunk(
  'visit/createVisit',
  async (visitData, { rejectWithValue }) => {
    try {
      const response = await visitService.createVisit(visitData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create visit');
    }
  }
);

export const updateVisit = createAsyncThunk(
  'visit/updateVisit',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await visitService.updateVisit(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update visit');
    }
  }
);

export const startVisit = createAsyncThunk(
  'visit/startVisit',
  async (id, { rejectWithValue }) => {
    try {
      const response = await visitService.startVisit(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to start visit');
    }
  }
);

export const completeVisit = createAsyncThunk(
  'visit/completeVisit',
  async (id, { rejectWithValue }) => {
    try {
      const response = await visitService.completeVisit(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to complete visit');
    }
  }
);

export const cancelVisit = createAsyncThunk(
  'visit/cancelVisit',
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const response = await visitService.cancelVisit(id, reason);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to cancel visit');
    }
  }
);

export const addAct = createAsyncThunk(
  'visit/addAct',
  async ({ visitId, actData }, { rejectWithValue }) => {
    try {
      const response = await visitService.addAct(visitId, actData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add act');
    }
  }
);

export const updateAct = createAsyncThunk(
  'visit/updateAct',
  async ({ visitId, actId, actData }, { rejectWithValue }) => {
    try {
      const response = await visitService.updateAct(visitId, actId, actData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update act');
    }
  }
);

export const removeAct = createAsyncThunk(
  'visit/removeAct',
  async ({ visitId, actId }, { rejectWithValue }) => {
    try {
      await visitService.removeAct(visitId, actId);
      return actId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to remove act');
    }
  }
);

export const completeAct = createAsyncThunk(
  'visit/completeAct',
  async ({ visitId, actId }, { rejectWithValue }) => {
    try {
      const response = await visitService.completeAct(visitId, actId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to complete act');
    }
  }
);

export const fetchVisitActs = createAsyncThunk(
  'visit/fetchVisitActs',
  async (visitId, { rejectWithValue }) => {
    try {
      const response = await visitService.getVisitActs(visitId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch visit acts');
    }
  }
);

export const addVitalSigns = createAsyncThunk(
  'visit/addVitalSigns',
  async ({ visitId, vitalSignsData }, { rejectWithValue }) => {
    try {
      const response = await visitService.addVitalSigns(visitId, vitalSignsData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add vital signs');
    }
  }
);

export const fetchVitalSigns = createAsyncThunk(
  'visit/fetchVitalSigns',
  async (visitId, { rejectWithValue }) => {
    try {
      const response = await visitService.getVitalSigns(visitId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch vital signs');
    }
  }
);

export const addClinicalNote = createAsyncThunk(
  'visit/addClinicalNote',
  async ({ visitId, noteData }, { rejectWithValue }) => {
    try {
      const response = await visitService.addClinicalNote(visitId, noteData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add clinical note');
    }
  }
);

export const fetchVisitNotes = createAsyncThunk(
  'visit/fetchVisitNotes',
  async (visitId, { rejectWithValue }) => {
    try {
      const response = await visitService.getVisitNotes(visitId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch visit notes');
    }
  }
);

export const addDiagnosis = createAsyncThunk(
  'visit/addDiagnosis',
  async ({ visitId, diagnosisData }, { rejectWithValue }) => {
    try {
      const response = await visitService.addDiagnosis(visitId, diagnosisData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add diagnosis');
    }
  }
);

export const fetchVisitDiagnoses = createAsyncThunk(
  'visit/fetchVisitDiagnoses',
  async (visitId, { rejectWithValue }) => {
    try {
      const response = await visitService.getVisitDiagnoses(visitId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch visit diagnoses');
    }
  }
);

export const fetchTodaysVisits = createAsyncThunk(
  'visit/fetchTodaysVisits',
  async (_, { rejectWithValue }) => {
    try {
      const response = await visitService.getTodaysVisits();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch today\'s visits');
    }
  }
);

export const fetchActiveVisits = createAsyncThunk(
  'visit/fetchActiveVisits',
  async (_, { rejectWithValue }) => {
    try {
      const response = await visitService.getActiveVisits();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch active visits');
    }
  }
);

export const generateVisitSummary = createAsyncThunk(
  'visit/generateVisitSummary',
  async ({ visitId, format }, { rejectWithValue }) => {
    try {
      const response = await visitService.generateVisitSummary(visitId, format);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to generate visit summary');
    }
  }
);

export const cloneVisit = createAsyncThunk(
  'visit/cloneVisit',
  async (visitId, { rejectWithValue }) => {
    try {
      const response = await visitService.cloneVisit(visitId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to clone visit');
    }
  }
);

export const applyVisitTemplate = createAsyncThunk(
  'visit/applyTemplate',
  async ({ visitId, templateId }, { rejectWithValue }) => {
    try {
      const response = await visitService.applyTemplate(visitId, templateId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to apply template');
    }
  }
);

export const fetchVisitTemplates = createAsyncThunk(
  'visit/fetchTemplates',
  async (visitType, { rejectWithValue }) => {
    try {
      const response = await visitService.getVisitTemplates(visitType);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch visit templates');
    }
  }
);

// Visit slice
const visitSlice = createSlice({
  name: 'visit',
  initialState,
  reducers: {
    setCurrentVisit: (state, action) => {
      state.currentVisit = action.payload;
      state.selectedVisitId = action.payload?.id;
    },
    clearCurrentVisit: (state) => {
      state.currentVisit = null;
      state.selectedVisitId = null;
      state.visitActs = [];
      state.visitNotes = [];
      state.visitDiagnoses = [];
      state.visitPrescriptions = [];
      state.vitalSigns = [];
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
    updateVisitInList: (state, action) => {
      const index = state.visits.findIndex(v => v.id === action.payload.id);
      if (index !== -1) {
        state.visits[index] = action.payload;
      }
      if (state.currentVisit?.id === action.payload.id) {
        state.currentVisit = action.payload;
      }
    },
    removeVisitFromList: (state, action) => {
      state.visits = state.visits.filter(v => v.id !== action.payload);
      if (state.currentVisit?.id === action.payload) {
        state.currentVisit = null;
        state.selectedVisitId = null;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch visits
      .addCase(fetchVisits.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchVisits.fulfilled, (state, action) => {
        state.isLoading = false;
        state.visits = action.payload.visits || action.payload.data || action.payload;
        state.totalCount = action.payload.totalCount || action.payload.total || state.visits.length;
      })
      .addCase(fetchVisits.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch single visit
      .addCase(fetchVisit.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchVisit.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentVisit = action.payload;
        state.selectedVisitId = action.payload.id;
      })
      .addCase(fetchVisit.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create visit
      .addCase(createVisit.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createVisit.fulfilled, (state, action) => {
        state.isLoading = false;
        state.visits.unshift(action.payload);
        state.totalCount += 1;
        state.currentVisit = action.payload;
        state.selectedVisitId = action.payload.id;
      })
      .addCase(createVisit.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update visit
      .addCase(updateVisit.fulfilled, (state, action) => {
        const index = state.visits.findIndex(v => v.id === action.payload.id);
        if (index !== -1) {
          state.visits[index] = action.payload;
        }
        if (state.currentVisit?.id === action.payload.id) {
          state.currentVisit = action.payload;
        }
      })
      // Start visit
      .addCase(startVisit.fulfilled, (state, action) => {
        const index = state.visits.findIndex(v => v.id === action.payload.id);
        if (index !== -1) {
          state.visits[index] = action.payload;
        }
        if (state.currentVisit?.id === action.payload.id) {
          state.currentVisit = action.payload;
        }
      })
      // Complete visit
      .addCase(completeVisit.fulfilled, (state, action) => {
        const index = state.visits.findIndex(v => v.id === action.payload.id);
        if (index !== -1) {
          state.visits[index] = action.payload;
        }
        if (state.currentVisit?.id === action.payload.id) {
          state.currentVisit = action.payload;
        }
      })
      // Cancel visit
      .addCase(cancelVisit.fulfilled, (state, action) => {
        const index = state.visits.findIndex(v => v.id === action.payload.id);
        if (index !== -1) {
          state.visits[index] = action.payload;
        }
        if (state.currentVisit?.id === action.payload.id) {
          state.currentVisit = action.payload;
        }
      })
      // Add act
      .addCase(addAct.fulfilled, (state, action) => {
        state.visitActs.push(action.payload);
        if (state.currentVisit) {
          state.currentVisit.acts = state.currentVisit.acts || [];
          state.currentVisit.acts.push(action.payload);
        }
      })
      // Update act
      .addCase(updateAct.fulfilled, (state, action) => {
        const index = state.visitActs.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.visitActs[index] = action.payload;
        }
      })
      // Remove act
      .addCase(removeAct.fulfilled, (state, action) => {
        state.visitActs = state.visitActs.filter(a => a.id !== action.payload);
        if (state.currentVisit) {
          state.currentVisit.acts = state.currentVisit.acts?.filter(a => a.id !== action.payload) || [];
        }
      })
      // Complete act
      .addCase(completeAct.fulfilled, (state, action) => {
        const index = state.visitActs.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.visitActs[index] = action.payload;
        }
      })
      // Visit acts
      .addCase(fetchVisitActs.fulfilled, (state, action) => {
        state.visitActs = action.payload;
      })
      // Vital signs
      .addCase(addVitalSigns.fulfilled, (state, action) => {
        state.vitalSigns.push(action.payload);
      })
      .addCase(fetchVitalSigns.fulfilled, (state, action) => {
        state.vitalSigns = action.payload;
      })
      // Clinical notes
      .addCase(addClinicalNote.fulfilled, (state, action) => {
        state.visitNotes.push(action.payload);
      })
      .addCase(fetchVisitNotes.fulfilled, (state, action) => {
        state.visitNotes = action.payload;
      })
      // Diagnoses
      .addCase(addDiagnosis.fulfilled, (state, action) => {
        state.visitDiagnoses.push(action.payload);
      })
      .addCase(fetchVisitDiagnoses.fulfilled, (state, action) => {
        state.visitDiagnoses = action.payload;
      })
      // Today's visits
      .addCase(fetchTodaysVisits.fulfilled, (state, action) => {
        state.todaysVisits = action.payload;
      })
      // Active visits
      .addCase(fetchActiveVisits.fulfilled, (state, action) => {
        state.activeVisits = action.payload;
      })
      // Clone visit
      .addCase(cloneVisit.fulfilled, (state, action) => {
        state.visits.unshift(action.payload);
        state.totalCount += 1;
      })
      // Visit templates
      .addCase(fetchVisitTemplates.fulfilled, (state, action) => {
        state.visitTemplates = action.payload;
      });
  },
});

// Export actions
export const {
  setCurrentVisit,
  clearCurrentVisit,
  setFilters,
  setPage,
  setPageSize,
  clearError,
  updateVisitInList,
  removeVisitFromList,
} = visitSlice.actions;

// Selectors
export const selectAllVisits = (state) => state.visit.visits;
export const selectCurrentVisit = (state) => state.visit.currentVisit;
export const selectActiveVisits = (state) => state.visit.activeVisits;
export const selectTodaysVisits = (state) => state.visit.todaysVisits;
export const selectVisitActs = (state) => state.visit.visitActs;
export const selectVisitNotes = (state) => state.visit.visitNotes;
export const selectVisitDiagnoses = (state) => state.visit.visitDiagnoses;
export const selectVitalSigns = (state) => state.visit.vitalSigns;
export const selectVisitTemplates = (state) => state.visit.visitTemplates;
export const selectVisitLoading = (state) => state.visit.isLoading;
export const selectVisitError = (state) => state.visit.error;
export const selectVisitFilters = (state) => state.visit.filters;
export const selectVisitPagination = (state) => ({
  currentPage: state.visit.currentPage,
  pageSize: state.visit.pageSize,
  totalCount: state.visit.totalCount,
});

export default visitSlice.reducer;