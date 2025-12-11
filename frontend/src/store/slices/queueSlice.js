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
  async ({ id, status, roomNumber, priority }, { rejectWithValue }) => {
    try {
      // Ensure priority is lowercase if provided
      const response = await queueService.updateStatus(id, status, roomNumber, priority);
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
      console.log('🔴 WebSocket Queue Update:', action.payload);

      // Clean priority values to lowercase
      const cleanedQueues = {};
      const rawQueues = action.payload.data || {};
      console.log('🔴 WebSocket Raw Queues:', rawQueues);

      Object.keys(rawQueues).forEach(key => {
        if (Array.isArray(rawQueues[key])) {
          cleanedQueues[key] = rawQueues[key].map(patient => ({
            ...patient,
            priority: patient.priority ? patient.priority.toLowerCase() : 'normal'
          }));
        } else {
          cleanedQueues[key] = rawQueues[key];
        }
      });
      console.log('🔴 WebSocket Cleaned Queues:', cleanedQueues);

      // CRITICAL: Only update if we have data, don't replace with empty
      if (Object.keys(cleanedQueues).length > 0) {
        state.queues = cleanedQueues;
        state.stats = action.payload.stats || state.stats;
      } else {
        console.warn('🔴 WebSocket sent empty queue data - IGNORING to prevent data loss');
      }
      state.lastUpdated = new Date().toISOString();
    },
    // Add single item to queue (for check-in)
    addQueueItem: (state, action) => {
      const item = action.payload;
      if (!item) return;
      const department = item.department || 'general';
      if (!state.queues[department]) {
        state.queues[department] = [];
      }
      // Check if already exists
      const exists = state.queues[department].some(q => q._id === item._id);
      if (!exists) {
        state.queues[department].push({
          ...item,
          priority: item.priority?.toLowerCase() || 'normal'
        });
      }
      state.lastUpdated = new Date().toISOString();
    },
    // Update single queue item (for status changes)
    updateQueueItem: (state, action) => {
      const { id, updates } = action.payload;
      Object.keys(state.queues).forEach(dept => {
        const index = state.queues[dept].findIndex(q => q._id === id);
        if (index !== -1) {
          state.queues[dept][index] = {
            ...state.queues[dept][index],
            ...updates,
            priority: updates.priority?.toLowerCase() || state.queues[dept][index].priority
          };
        }
      });
      state.lastUpdated = new Date().toISOString();
    },
    // Remove single item from queue
    removeQueueItem: (state, action) => {
      const id = action.payload;
      Object.keys(state.queues).forEach(dept => {
        state.queues[dept] = state.queues[dept].filter(q => q._id !== id);
      });
      state.lastUpdated = new Date().toISOString();
    },
    // Clear queue data
    clearQueue: (state) => {
      state.queues = {};
      state.stats = initialState.stats;
    },
    // CRITICAL: Reset queue state on clinic switch to prevent data leakage
    resetQueueState: (state) => {
      state.queues = {};
      state.stats = initialState.stats;
      state.loading = false;
      state.error = null;
      state.lastUpdated = null;
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
        console.log('📊 Queue Response:', action.payload);
        console.log('📊 action.payload.data:', action.payload?.data);

        // Clean priority values to lowercase
        const cleanedQueues = {};
        // Response structure from offlineWrapper: { data: { success, data: {general: [], ...}, stats: {...} } }
        // Handle both nested (from offlineWrapper) and direct (from WebSocket) structures
        const responseData = action.payload?.data || action.payload;
        console.log('📊 responseData:', responseData);
        const rawQueues = responseData?.data || responseData || {};
        console.log('📋 Raw Queues:', rawQueues);
        console.log('📋 Raw Queues keys:', Object.keys(rawQueues));

        Object.keys(rawQueues).forEach(key => {
          // Only process arrays (department queues), skip non-array properties like 'total', 'stats', etc.
          if (Array.isArray(rawQueues[key])) {
            cleanedQueues[key] = rawQueues[key].map(patient => ({
              ...patient,
              priority: patient.priority ? patient.priority.toLowerCase() : 'normal'
            }));
          }
        });
        console.log('✅ Cleaned Queues:', cleanedQueues);

        state.queues = cleanedQueues;
        state.stats = responseData.stats || action.payload.stats || state.stats;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchQueue.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Check-in - add to queue locally
      .addCase(checkInPatient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checkInPatient.fulfilled, (state, action) => {
        state.loading = false;
        // Add the new queue entry locally
        const queueEntry = action.payload?.queueEntry || action.payload?.data;
        if (queueEntry) {
          const department = queueEntry.department || 'general';
          if (!state.queues[department]) {
            state.queues[department] = [];
          }
          const exists = state.queues[department].some(q => q._id === queueEntry._id);
          if (!exists) {
            state.queues[department].push({
              ...queueEntry,
              priority: queueEntry.priority?.toLowerCase() || 'normal'
            });
          }
          state.lastUpdated = new Date().toISOString();
        }
      })
      .addCase(checkInPatient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update status - update locally
      .addCase(updateQueueStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateQueueStatus.fulfilled, (state, action) => {
        state.loading = false;
        // Update the queue entry locally
        const updatedEntry = action.payload?.data || action.payload;
        if (updatedEntry?._id) {
          Object.keys(state.queues).forEach(dept => {
            const index = state.queues[dept].findIndex(q => q._id === updatedEntry._id);
            if (index !== -1) {
              state.queues[dept][index] = {
                ...state.queues[dept][index],
                ...updatedEntry,
                priority: updatedEntry.priority?.toLowerCase() || state.queues[dept][index].priority
              };
            }
          });
          state.lastUpdated = new Date().toISOString();
        }
      })
      .addCase(updateQueueStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Remove from queue - remove locally
      .addCase(removeFromQueue.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(removeFromQueue.fulfilled, (state, action) => {
        state.loading = false;
        // Remove from queue locally
        const removedId = action.meta?.arg?.id;
        if (removedId) {
          Object.keys(state.queues).forEach(dept => {
            state.queues[dept] = state.queues[dept].filter(q => q._id !== removedId);
          });
          state.lastUpdated = new Date().toISOString();
        }
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

export const { clearQueueError, updateQueueRealtime, addQueueItem, updateQueueItem, removeQueueItem, clearQueue, resetQueueState } = queueSlice.actions;
export default queueSlice.reducer;
