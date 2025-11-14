import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  prescriptions: [],
  currentPrescription: null,
  isLoading: false,
  error: null,
};

const prescriptionSlice = createSlice({
  name: 'prescription',
  initialState,
  reducers: {
    setPrescriptions: (state, action) => {
      state.prescriptions = action.payload;
    },
    setCurrentPrescription: (state, action) => {
      state.currentPrescription = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const { setPrescriptions, setCurrentPrescription, clearError } = prescriptionSlice.actions;
export default prescriptionSlice.reducer;
