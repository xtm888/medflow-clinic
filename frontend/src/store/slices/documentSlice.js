import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  documents: [],
  currentDocument: null,
  uploadProgress: 0,
  isLoading: false,
  isUploading: false,
  error: null,
};

const documentSlice = createSlice({
  name: 'document',
  initialState,
  reducers: {
    setDocuments: (state, action) => {
      state.documents = action.payload;
    },
    setCurrentDocument: (state, action) => {
      state.currentDocument = action.payload;
    },
    setUploadProgress: (state, action) => {
      state.uploadProgress = action.payload;
    },
    setUploading: (state, action) => {
      state.isUploading = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const { setDocuments, setCurrentDocument, setUploadProgress, setUploading, clearError } = documentSlice.actions;
export default documentSlice.reducer;
