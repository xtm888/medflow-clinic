import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { appointmentService } from '../../services';

// Initial state
const initialState = {
  appointments: [],
  currentAppointment: null,
  todaysAppointments: [],
  upcomingAppointments: [],
  availableSlots: [],
  waitingList: [],
  appointmentTypes: [],
  queueStatus: [],
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
    sortBy: 'dateTime',
    sortOrder: 'asc',
  },
  selectedAppointmentId: null,
  calendarView: 'week',
  selectedDate: new Date().toISOString(),
};

// Async thunks
export const fetchAppointments = createAsyncThunk(
  'appointment/fetchAppointments',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await appointmentService.getAppointments(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch appointments');
    }
  }
);

export const fetchAppointment = createAsyncThunk(
  'appointment/fetchAppointment',
  async (id, { rejectWithValue }) => {
    try {
      const response = await appointmentService.getAppointment(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch appointment');
    }
  }
);

export const createAppointment = createAsyncThunk(
  'appointment/createAppointment',
  async (appointmentData, { rejectWithValue }) => {
    try {
      const response = await appointmentService.createAppointment(appointmentData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create appointment');
    }
  }
);

export const updateAppointment = createAsyncThunk(
  'appointment/updateAppointment',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await appointmentService.updateAppointment(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update appointment');
    }
  }
);

export const cancelAppointment = createAsyncThunk(
  'appointment/cancelAppointment',
  async ({ id, reason }, { rejectWithValue }) => {
    try {
      const response = await appointmentService.cancelAppointment(id, reason);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to cancel appointment');
    }
  }
);

export const checkInAppointment = createAsyncThunk(
  'appointment/checkInAppointment',
  async (id, { rejectWithValue }) => {
    try {
      const response = await appointmentService.checkInAppointment(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to check in');
    }
  }
);

export const completeAppointment = createAsyncThunk(
  'appointment/completeAppointment',
  async ({ id, outcome }, { rejectWithValue }) => {
    try {
      const response = await appointmentService.completeAppointment(id, outcome);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to complete appointment');
    }
  }
);

export const fetchTodaysAppointments = createAsyncThunk(
  'appointment/fetchTodaysAppointments',
  async (_, { rejectWithValue }) => {
    try {
      const response = await appointmentService.getTodaysAppointments();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch today\'s appointments');
    }
  }
);

export const fetchUpcomingAppointments = createAsyncThunk(
  'appointment/fetchUpcomingAppointments',
  async (days = 7, { rejectWithValue }) => {
    try {
      const response = await appointmentService.getUpcomingAppointments(days);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch upcoming appointments');
    }
  }
);

export const fetchAvailableSlots = createAsyncThunk(
  'appointment/fetchAvailableSlots',
  async ({ date, provider, duration }, { rejectWithValue }) => {
    try {
      const response = await appointmentService.getAvailableSlots(date, provider, duration);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch available slots');
    }
  }
);

export const rescheduleAppointment = createAsyncThunk(
  'appointment/rescheduleAppointment',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await appointmentService.rescheduleAppointment(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reschedule appointment');
    }
  }
);

export const fetchQueueStatus = createAsyncThunk(
  'appointment/fetchQueueStatus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await appointmentService.getQueueStatus();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch queue status');
    }
  }
);

export const updateQueuePosition = createAsyncThunk(
  'appointment/updateQueuePosition',
  async ({ id, position }, { rejectWithValue }) => {
    try {
      const response = await appointmentService.updateQueuePosition(id, position);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update queue position');
    }
  }
);

export const fetchWaitingList = createAsyncThunk(
  'appointment/fetchWaitingList',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await appointmentService.getWaitingList(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch waiting list');
    }
  }
);

export const addToWaitingList = createAsyncThunk(
  'appointment/addToWaitingList',
  async (data, { rejectWithValue }) => {
    try {
      const response = await appointmentService.addToWaitingList(data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add to waiting list');
    }
  }
);

export const fetchAppointmentTypes = createAsyncThunk(
  'appointment/fetchAppointmentTypes',
  async (_, { rejectWithValue }) => {
    try {
      const response = await appointmentService.getAppointmentTypes();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch appointment types');
    }
  }
);

export const markNoShow = createAsyncThunk(
  'appointment/markNoShow',
  async (id, { rejectWithValue }) => {
    try {
      const response = await appointmentService.markNoShow(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark as no-show');
    }
  }
);

export const sendReminder = createAsyncThunk(
  'appointment/sendReminder',
  async ({ id, method }, { rejectWithValue }) => {
    try {
      const response = await appointmentService.sendReminder(id, method);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to send reminder');
    }
  }
);

export const createRecurringAppointments = createAsyncThunk(
  'appointment/createRecurring',
  async ({ appointmentData, recurrencePattern }, { rejectWithValue }) => {
    try {
      const response = await appointmentService.createRecurring(appointmentData, recurrencePattern);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create recurring appointments');
    }
  }
);

// Appointment slice
const appointmentSlice = createSlice({
  name: 'appointment',
  initialState,
  reducers: {
    setCurrentAppointment: (state, action) => {
      state.currentAppointment = action.payload;
      state.selectedAppointmentId = action.payload?.id;
    },
    clearCurrentAppointment: (state) => {
      state.currentAppointment = null;
      state.selectedAppointmentId = null;
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
    setCalendarView: (state, action) => {
      state.calendarView = action.payload;
    },
    setSelectedDate: (state, action) => {
      state.selectedDate = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateAppointmentInList: (state, action) => {
      const index = state.appointments.findIndex(a => a.id === action.payload.id);
      if (index !== -1) {
        state.appointments[index] = action.payload;
      }
      if (state.currentAppointment?.id === action.payload.id) {
        state.currentAppointment = action.payload;
      }
    },
    removeAppointmentFromList: (state, action) => {
      state.appointments = state.appointments.filter(a => a.id !== action.payload);
      if (state.currentAppointment?.id === action.payload) {
        state.currentAppointment = null;
        state.selectedAppointmentId = null;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch appointments
      .addCase(fetchAppointments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAppointments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.appointments = action.payload.appointments || action.payload.data || action.payload;
        state.totalCount = action.payload.totalCount || action.payload.total || state.appointments.length;
      })
      .addCase(fetchAppointments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch single appointment
      .addCase(fetchAppointment.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAppointment.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentAppointment = action.payload;
        state.selectedAppointmentId = action.payload.id;
      })
      .addCase(fetchAppointment.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create appointment
      .addCase(createAppointment.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createAppointment.fulfilled, (state, action) => {
        state.isLoading = false;
        state.appointments.unshift(action.payload);
        state.totalCount += 1;
      })
      .addCase(createAppointment.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update appointment
      .addCase(updateAppointment.fulfilled, (state, action) => {
        const index = state.appointments.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.appointments[index] = action.payload;
        }
        if (state.currentAppointment?.id === action.payload.id) {
          state.currentAppointment = action.payload;
        }
      })
      // Cancel appointment
      .addCase(cancelAppointment.fulfilled, (state, action) => {
        const index = state.appointments.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.appointments[index] = action.payload;
        }
        if (state.currentAppointment?.id === action.payload.id) {
          state.currentAppointment = action.payload;
        }
      })
      // Check in appointment
      .addCase(checkInAppointment.fulfilled, (state, action) => {
        const index = state.appointments.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.appointments[index] = action.payload;
        }
        if (state.currentAppointment?.id === action.payload.id) {
          state.currentAppointment = action.payload;
        }
      })
      // Complete appointment
      .addCase(completeAppointment.fulfilled, (state, action) => {
        const index = state.appointments.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.appointments[index] = action.payload;
        }
        if (state.currentAppointment?.id === action.payload.id) {
          state.currentAppointment = action.payload;
        }
      })
      // Today's appointments
      .addCase(fetchTodaysAppointments.fulfilled, (state, action) => {
        state.todaysAppointments = action.payload;
      })
      // Upcoming appointments
      .addCase(fetchUpcomingAppointments.fulfilled, (state, action) => {
        state.upcomingAppointments = action.payload;
      })
      // Available slots
      .addCase(fetchAvailableSlots.fulfilled, (state, action) => {
        state.availableSlots = action.payload;
      })
      // Queue status
      .addCase(fetchQueueStatus.fulfilled, (state, action) => {
        state.queueStatus = action.payload;
      })
      // Waiting list
      .addCase(fetchWaitingList.fulfilled, (state, action) => {
        state.waitingList = action.payload;
      })
      // Add to waiting list
      .addCase(addToWaitingList.fulfilled, (state, action) => {
        state.waitingList.push(action.payload);
      })
      // Appointment types
      .addCase(fetchAppointmentTypes.fulfilled, (state, action) => {
        state.appointmentTypes = action.payload;
      })
      // Mark no-show
      .addCase(markNoShow.fulfilled, (state, action) => {
        const index = state.appointments.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.appointments[index] = action.payload;
        }
        if (state.currentAppointment?.id === action.payload.id) {
          state.currentAppointment = action.payload;
        }
      })
      // Reschedule appointment
      .addCase(rescheduleAppointment.fulfilled, (state, action) => {
        const index = state.appointments.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.appointments[index] = action.payload;
        }
        if (state.currentAppointment?.id === action.payload.id) {
          state.currentAppointment = action.payload;
        }
      })
      // Create recurring appointments
      .addCase(createRecurringAppointments.fulfilled, (state, action) => {
        state.appointments = [...state.appointments, ...action.payload];
        state.totalCount += action.payload.length;
      });
  },
});

// Export actions
export const {
  setCurrentAppointment,
  clearCurrentAppointment,
  setFilters,
  setPage,
  setPageSize,
  setCalendarView,
  setSelectedDate,
  clearError,
  updateAppointmentInList,
  removeAppointmentFromList,
} = appointmentSlice.actions;

// Selectors
export const selectAllAppointments = (state) => state.appointment.appointments;
export const selectCurrentAppointment = (state) => state.appointment.currentAppointment;
export const selectTodaysAppointments = (state) => state.appointment.todaysAppointments;
export const selectUpcomingAppointments = (state) => state.appointment.upcomingAppointments;
export const selectAvailableSlots = (state) => state.appointment.availableSlots;
export const selectWaitingList = (state) => state.appointment.waitingList;
export const selectAppointmentTypes = (state) => state.appointment.appointmentTypes;
export const selectQueueStatus = (state) => state.appointment.queueStatus;
export const selectAppointmentLoading = (state) => state.appointment.isLoading;
export const selectAppointmentError = (state) => state.appointment.error;
export const selectAppointmentFilters = (state) => state.appointment.filters;
export const selectAppointmentPagination = (state) => ({
  currentPage: state.appointment.currentPage,
  pageSize: state.appointment.pageSize,
  totalCount: state.appointment.totalCount,
});
export const selectCalendarView = (state) => state.appointment.calendarView;
export const selectSelectedDate = (state) => state.appointment.selectedDate;

export default appointmentSlice.reducer;