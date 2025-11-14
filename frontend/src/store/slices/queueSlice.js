import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import queueService from '../../services/queueService';

// Async thunks
export const fetchQueue = createAsyncThunk(
  'queue/fetchQueue',
  async (filters, { rejectWithValue }) => {
    try {
      const response = await queueService.getCurrentQueue(filters);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch queue');
    }
  }
);

export const checkInPatient = createAsyncThunk(
  'queue/checkIn',
  async (data, { rejectWithValue }) => {
    try {
      const response = await queueService.checkIn(data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to check in patient');
    }
  }
);

export const updateQueueStatus = createAsyncThunk(
  'queue/updateStatus',
  async ({ id, status, roomNumber }, { rejectWithValue }) => {
    try {
      const response = await queueService.updateStatus(id, status, roomNumber);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update status');
    }
  }
);

export const removeFromQueue = createAsyncThunk(
  'queue/remove',
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const response = await queueService.removeFromQueue(id, reason);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to remove from queue');
    }
  }
);

export const callNextPatient = createAsyncThunk(
  'queue/callNext',
  async ({ department, doctorId }, { rejectWithValue }) => {
    try {
      const response = await queueService.callNext(department, doctorId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to call next patient');
    }
  }
);

export const fetchQueueStats = createAsyncThunk(
  'queue/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await queueService.getStats();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch stats');
    }
  }
);

// Initial state
const initialState = {
  queues: {}, // { general: [], cardiology: [], ... }
  stats: {
    totalWaiting: 0,
    inProgress: 0,
    averageWaitTime: 0,
    completedToday: 0,
    peakHours: []
  },
  loading: false,
  error: null,
  lastUpdated: null
};

// Slice
const queueSlice = createSlice({
  name: 'queue',
  initialState,
  reducers: {
    clearQueueError: (state) => {
      state.error = null;
    },
    // Real-time update from WebSocket
    updateQueueRealtime: (state, action) => {
      state.queues = action.payload.data || {};
      state.stats = action.payload.stats || state.stats;
      state.lastUpdated = new Date().toISOString();
    },
    // Clear queue data
    clearQueue: (state) => {
      state.queues = {};
      state.stats = initialState.stats;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch queue
      .addCase(fetchQueue.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchQueue.fulfilled, (state, action) => {
        state.loading = false;
        state.queues = action.payload.data || {};
        state.stats = action.payload.stats || state.stats;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchQueue.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Check-in
      .addCase(checkInPatient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checkInPatient.fulfilled, (state) => {
        state.loading = false;
        // Queue will be refreshed by fetchQueue call
      })
      .addCase(checkInPatient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update status
      .addCase(updateQueueStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateQueueStatus.fulfilled, (state) => {
        state.loading = false;
        // Queue will be refreshed
      })
      .addCase(updateQueueStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Remove from queue
      .addCase(removeFromQueue.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeFromQueue.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(removeFromQueue.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Call next
      .addCase(callNextPatient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(callNextPatient.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(callNextPatient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch stats
      .addCase(fetchQueueStats.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchQueueStats.fulfilled, (state, action) => {
        state.stats = action.payload.data || state.stats;
      })
      .addCase(fetchQueueStats.rejected, (state, action) => {
        state.error = action.payload;
      });
  }
});

export const { clearQueueError, updateQueueRealtime, clearQueue } = queueSlice.actions;
export default queueSlice.reducer;
