import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import documentService from '../../services/documentService';

// Initial state with pagination
const initialState = {
  documents: [],
  patientDocuments: [],
  visitDocuments: [],
  archivedDocuments: [],
  currentDocument: null,
  documentCategories: [],
  documentVersions: [],
  searchResults: [],
  totalCount: 0,
  currentPage: 1,
  pageSize: 20,
  uploadProgress: 0,
  isLoading: false,
  isUploading: false,
  isProcessing: false,
  error: null,
  filters: {
    category: 'all',
    type: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
};

// Async thunks
export const fetchDocuments = createAsyncThunk(
  'document/fetchDocuments',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await documentService.getDocuments(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch documents');
    }
  }
);

export const fetchDocument = createAsyncThunk(
  'document/fetchDocument',
  async (id, { rejectWithValue }) => {
    try {
      const response = await documentService.getDocument(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch document');
    }
  }
);

export const uploadDocument = createAsyncThunk(
  'document/uploadDocument',
  async ({ file, metadata = {} }, { dispatch, rejectWithValue }) => {
    try {
      const metadataWithProgress = {
        ...metadata,
        onProgress: (progress) => {
          dispatch(setUploadProgress(progress));
        }
      };
      const response = await documentService.uploadDocument(file, metadataWithProgress);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to upload document');
    }
  }
);

export const uploadMultipleDocuments = createAsyncThunk(
  'document/uploadMultipleDocuments',
  async ({ files, metadata = {} }, { rejectWithValue }) => {
    try {
      const response = await documentService.uploadMultipleDocuments(files, metadata);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to upload documents');
    }
  }
);

export const updateDocument = createAsyncThunk(
  'document/updateDocument',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await documentService.updateDocument(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update document');
    }
  }
);

export const deleteDocument = createAsyncThunk(
  'document/deleteDocument',
  async (id, { rejectWithValue }) => {
    try {
      await documentService.deleteDocument(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete document');
    }
  }
);

export const fetchPatientDocuments = createAsyncThunk(
  'document/fetchPatientDocuments',
  async ({ patientId, params = {} }, { rejectWithValue }) => {
    try {
      const response = await documentService.getPatientDocuments(patientId, params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch patient documents');
    }
  }
);

export const fetchVisitDocuments = createAsyncThunk(
  'document/fetchVisitDocuments',
  async ({ visitId, params = {} }, { rejectWithValue }) => {
    try {
      const response = await documentService.getVisitDocuments(visitId, params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch visit documents');
    }
  }
);

export const searchDocuments = createAsyncThunk(
  'document/searchDocuments',
  async ({ query, filters = {} }, { rejectWithValue }) => {
    try {
      const response = await documentService.searchDocuments(query, filters);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to search documents');
    }
  }
);

export const fetchDocumentCategories = createAsyncThunk(
  'document/fetchDocumentCategories',
  async (_, { rejectWithValue }) => {
    try {
      const response = await documentService.getDocumentCategories();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch document categories');
    }
  }
);

export const moveToCategory = createAsyncThunk(
  'document/moveToCategory',
  async ({ documentId, categoryId }, { rejectWithValue }) => {
    try {
      const response = await documentService.moveToCategory(documentId, categoryId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to move document to category');
    }
  }
);

export const fetchDocumentVersions = createAsyncThunk(
  'document/fetchDocumentVersions',
  async (documentId, { rejectWithValue }) => {
    try {
      const response = await documentService.getDocumentVersions(documentId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch document versions');
    }
  }
);

export const restoreDocumentVersion = createAsyncThunk(
  'document/restoreDocumentVersion',
  async ({ documentId, versionId }, { rejectWithValue }) => {
    try {
      const response = await documentService.restoreVersion(documentId, versionId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to restore document version');
    }
  }
);

export const archiveDocument = createAsyncThunk(
  'document/archiveDocument',
  async (documentId, { rejectWithValue }) => {
    try {
      const response = await documentService.archiveDocument(documentId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to archive document');
    }
  }
);

export const unarchiveDocument = createAsyncThunk(
  'document/unarchiveDocument',
  async (documentId, { rejectWithValue }) => {
    try {
      const response = await documentService.unarchiveDocument(documentId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to unarchive document');
    }
  }
);

export const fetchArchivedDocuments = createAsyncThunk(
  'document/fetchArchivedDocuments',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await documentService.getArchivedDocuments(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch archived documents');
    }
  }
);

export const shareDocument = createAsyncThunk(
  'document/shareDocument',
  async ({ documentId, shareData }, { rejectWithValue }) => {
    try {
      const response = await documentService.shareDocument(documentId, shareData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to share document');
    }
  }
);

export const tagDocument = createAsyncThunk(
  'document/tagDocument',
  async ({ documentId, tags }, { rejectWithValue }) => {
    try {
      const response = await documentService.tagDocument(documentId, tags);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to tag document');
    }
  }
);

export const uploadAudioRecording = createAsyncThunk(
  'document/uploadAudioRecording',
  async ({ audioBlob, metadata = {} }, { dispatch, rejectWithValue }) => {
    try {
      const response = await documentService.uploadAudioRecording(audioBlob, metadata);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to upload audio recording');
    }
  }
);

export const transcribeAudio = createAsyncThunk(
  'document/transcribeAudio',
  async ({ documentId, engine = 'whisper' }, { rejectWithValue }) => {
    try {
      const response = await documentService.transcribeAudio(documentId, engine);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to transcribe audio');
    }
  }
);

export const ocrScanDocument = createAsyncThunk(
  'document/ocrScanDocument',
  async (documentId, { rejectWithValue }) => {
    try {
      const response = await documentService.ocrScanDocument(documentId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to perform OCR scan');
    }
  }
);

export const signDocument = createAsyncThunk(
  'document/signDocument',
  async ({ documentId, signatureData }, { rejectWithValue }) => {
    try {
      const response = await documentService.signDocument(documentId, signatureData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to sign document');
    }
  }
);

export const lockDocument = createAsyncThunk(
  'document/lockDocument',
  async (documentId, { rejectWithValue }) => {
    try {
      const response = await documentService.lockDocument(documentId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to lock document');
    }
  }
);

export const unlockDocument = createAsyncThunk(
  'document/unlockDocument',
  async (documentId, { rejectWithValue }) => {
    try {
      const response = await documentService.unlockDocument(documentId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to unlock document');
    }
  }
);

export const bulkDeleteDocuments = createAsyncThunk(
  'document/bulkDeleteDocuments',
  async (documentIds, { rejectWithValue }) => {
    try {
      await documentService.bulkDeleteDocuments(documentIds);
      return documentIds;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete documents');
    }
  }
);

// Document slice
const documentSlice = createSlice({
  name: 'document',
  initialState,
  reducers: {
    setCurrentDocument: (state, action) => {
      state.currentDocument = action.payload;
    },
    clearCurrentDocument: (state) => {
      state.currentDocument = null;
      state.documentVersions = [];
    },
    setUploadProgress: (state, action) => {
      state.uploadProgress = action.payload;
    },
    resetUploadProgress: (state) => {
      state.uploadProgress = 0;
      state.isUploading = false;
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
    updateDocumentInList: (state, action) => {
      const index = state.documents.findIndex(d => d._id === action.payload._id || d.id === action.payload.id);
      if (index !== -1) {
        state.documents[index] = action.payload;
      }
      if (state.currentDocument?._id === action.payload._id || state.currentDocument?.id === action.payload.id) {
        state.currentDocument = action.payload;
      }
    },
    removeDocumentFromList: (state, action) => {
      state.documents = state.documents.filter(d => d._id !== action.payload && d.id !== action.payload);
      if (state.currentDocument?._id === action.payload || state.currentDocument?.id === action.payload) {
        state.currentDocument = null;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch documents
      .addCase(fetchDocuments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.documents = action.payload.documents || action.payload.data || action.payload;
        state.totalCount = action.payload.totalCount || action.payload.total || state.documents.length;
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch single document
      .addCase(fetchDocument.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDocument.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentDocument = action.payload;
      })
      .addCase(fetchDocument.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Upload document
      .addCase(uploadDocument.pending, (state) => {
        state.isUploading = true;
        state.uploadProgress = 0;
        state.error = null;
      })
      .addCase(uploadDocument.fulfilled, (state, action) => {
        state.isUploading = false;
        state.uploadProgress = 100;
        state.documents.unshift(action.payload);
        state.totalCount += 1;
        state.currentDocument = action.payload;
      })
      .addCase(uploadDocument.rejected, (state, action) => {
        state.isUploading = false;
        state.uploadProgress = 0;
        state.error = action.payload;
      })
      // Upload multiple documents
      .addCase(uploadMultipleDocuments.pending, (state) => {
        state.isUploading = true;
        state.error = null;
      })
      .addCase(uploadMultipleDocuments.fulfilled, (state, action) => {
        state.isUploading = false;
        const newDocs = action.payload.documents || action.payload.data || action.payload;
        state.documents = [...newDocs, ...state.documents];
        state.totalCount += newDocs.length;
      })
      .addCase(uploadMultipleDocuments.rejected, (state, action) => {
        state.isUploading = false;
        state.error = action.payload;
      })
      // Update document
      .addCase(updateDocument.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateDocument.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.documents.findIndex(d => d._id === action.payload._id || d.id === action.payload.id);
        if (index !== -1) {
          state.documents[index] = action.payload;
        }
        if (state.currentDocument?._id === action.payload._id || state.currentDocument?.id === action.payload.id) {
          state.currentDocument = action.payload;
        }
      })
      .addCase(updateDocument.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Delete document
      .addCase(deleteDocument.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteDocument.fulfilled, (state, action) => {
        state.isLoading = false;
        state.documents = state.documents.filter(d => d._id !== action.payload && d.id !== action.payload);
        state.totalCount -= 1;
        if (state.currentDocument?._id === action.payload || state.currentDocument?.id === action.payload) {
          state.currentDocument = null;
        }
      })
      .addCase(deleteDocument.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch patient documents
      .addCase(fetchPatientDocuments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPatientDocuments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.patientDocuments = action.payload.documents || action.payload.data || action.payload;
      })
      .addCase(fetchPatientDocuments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch visit documents
      .addCase(fetchVisitDocuments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchVisitDocuments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.visitDocuments = action.payload.documents || action.payload.data || action.payload;
      })
      .addCase(fetchVisitDocuments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Search documents
      .addCase(searchDocuments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchDocuments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.searchResults = action.payload.documents || action.payload.data || action.payload;
      })
      .addCase(searchDocuments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch document categories
      .addCase(fetchDocumentCategories.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDocumentCategories.fulfilled, (state, action) => {
        state.isLoading = false;
        state.documentCategories = action.payload.categories || action.payload.data || action.payload;
      })
      .addCase(fetchDocumentCategories.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Move to category
      .addCase(moveToCategory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(moveToCategory.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.documents.findIndex(d => d._id === action.payload._id || d.id === action.payload.id);
        if (index !== -1) {
          state.documents[index] = action.payload;
        }
        if (state.currentDocument?._id === action.payload._id || state.currentDocument?.id === action.payload.id) {
          state.currentDocument = action.payload;
        }
      })
      .addCase(moveToCategory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch document versions
      .addCase(fetchDocumentVersions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDocumentVersions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.documentVersions = action.payload.versions || action.payload.data || action.payload;
      })
      .addCase(fetchDocumentVersions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Restore document version
      .addCase(restoreDocumentVersion.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(restoreDocumentVersion.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentDocument = action.payload;
        const index = state.documents.findIndex(d => d._id === action.payload._id || d.id === action.payload.id);
        if (index !== -1) {
          state.documents[index] = action.payload;
        }
      })
      .addCase(restoreDocumentVersion.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Archive document
      .addCase(archiveDocument.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(archiveDocument.fulfilled, (state, action) => {
        state.isLoading = false;
        state.documents = state.documents.filter(d => d._id !== action.payload._id && d.id !== action.payload.id);
        state.archivedDocuments.unshift(action.payload);
        if (state.currentDocument?._id === action.payload._id || state.currentDocument?.id === action.payload.id) {
          state.currentDocument = action.payload;
        }
      })
      .addCase(archiveDocument.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Unarchive document
      .addCase(unarchiveDocument.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(unarchiveDocument.fulfilled, (state, action) => {
        state.isLoading = false;
        state.archivedDocuments = state.archivedDocuments.filter(d => d._id !== action.payload._id && d.id !== action.payload.id);
        state.documents.unshift(action.payload);
        if (state.currentDocument?._id === action.payload._id || state.currentDocument?.id === action.payload.id) {
          state.currentDocument = action.payload;
        }
      })
      .addCase(unarchiveDocument.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Fetch archived documents
      .addCase(fetchArchivedDocuments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchArchivedDocuments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.archivedDocuments = action.payload.documents || action.payload.data || action.payload;
      })
      .addCase(fetchArchivedDocuments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Share document
      .addCase(shareDocument.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(shareDocument.fulfilled, (state, action) => {
        state.isLoading = false;
        if (state.currentDocument?._id === action.payload._id || state.currentDocument?.id === action.payload.id) {
          state.currentDocument = action.payload;
        }
      })
      .addCase(shareDocument.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Tag document
      .addCase(tagDocument.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(tagDocument.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.documents.findIndex(d => d._id === action.payload._id || d.id === action.payload.id);
        if (index !== -1) {
          state.documents[index] = action.payload;
        }
        if (state.currentDocument?._id === action.payload._id || state.currentDocument?.id === action.payload.id) {
          state.currentDocument = action.payload;
        }
      })
      .addCase(tagDocument.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Upload audio recording
      .addCase(uploadAudioRecording.pending, (state) => {
        state.isUploading = true;
        state.error = null;
      })
      .addCase(uploadAudioRecording.fulfilled, (state, action) => {
        state.isUploading = false;
        state.documents.unshift(action.payload);
        state.totalCount += 1;
        state.currentDocument = action.payload;
      })
      .addCase(uploadAudioRecording.rejected, (state, action) => {
        state.isUploading = false;
        state.error = action.payload;
      })
      // Transcribe audio
      .addCase(transcribeAudio.pending, (state) => {
        state.isProcessing = true;
        state.error = null;
      })
      .addCase(transcribeAudio.fulfilled, (state, action) => {
        state.isProcessing = false;
        if (state.currentDocument?._id === action.payload._id || state.currentDocument?.id === action.payload.id) {
          state.currentDocument = action.payload;
        }
      })
      .addCase(transcribeAudio.rejected, (state, action) => {
        state.isProcessing = false;
        state.error = action.payload;
      })
      // OCR scan document
      .addCase(ocrScanDocument.pending, (state) => {
        state.isProcessing = true;
        state.error = null;
      })
      .addCase(ocrScanDocument.fulfilled, (state, action) => {
        state.isProcessing = false;
        if (state.currentDocument?._id === action.payload._id || state.currentDocument?.id === action.payload.id) {
          state.currentDocument = action.payload;
        }
      })
      .addCase(ocrScanDocument.rejected, (state, action) => {
        state.isProcessing = false;
        state.error = action.payload;
      })
      // Sign document
      .addCase(signDocument.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signDocument.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.documents.findIndex(d => d._id === action.payload._id || d.id === action.payload.id);
        if (index !== -1) {
          state.documents[index] = action.payload;
        }
        if (state.currentDocument?._id === action.payload._id || state.currentDocument?.id === action.payload.id) {
          state.currentDocument = action.payload;
        }
      })
      .addCase(signDocument.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Lock document
      .addCase(lockDocument.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(lockDocument.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.documents.findIndex(d => d._id === action.payload._id || d.id === action.payload.id);
        if (index !== -1) {
          state.documents[index] = action.payload;
        }
        if (state.currentDocument?._id === action.payload._id || state.currentDocument?.id === action.payload.id) {
          state.currentDocument = action.payload;
        }
      })
      .addCase(lockDocument.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Unlock document
      .addCase(unlockDocument.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(unlockDocument.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.documents.findIndex(d => d._id === action.payload._id || d.id === action.payload.id);
        if (index !== -1) {
          state.documents[index] = action.payload;
        }
        if (state.currentDocument?._id === action.payload._id || state.currentDocument?.id === action.payload.id) {
          state.currentDocument = action.payload;
        }
      })
      .addCase(unlockDocument.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Bulk delete documents
      .addCase(bulkDeleteDocuments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(bulkDeleteDocuments.fulfilled, (state, action) => {
        state.isLoading = false;
        const deletedIds = action.payload;
        state.documents = state.documents.filter(d => !deletedIds.includes(d._id) && !deletedIds.includes(d.id));
        state.totalCount -= deletedIds.length;
        if (deletedIds.includes(state.currentDocument?._id) || deletedIds.includes(state.currentDocument?.id)) {
          state.currentDocument = null;
        }
      })
      .addCase(bulkDeleteDocuments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

// Export actions
export const {
  setCurrentDocument,
  clearCurrentDocument,
  setUploadProgress,
  resetUploadProgress,
  setFilters,
  setPage,
  setPageSize,
  clearError,
  clearSearchResults,
  updateDocumentInList,
  removeDocumentFromList,
} = documentSlice.actions;

// Selectors
export const selectAllDocuments = (state) => state.document.documents;
export const selectCurrentDocument = (state) => state.document.currentDocument;
export const selectPatientDocuments = (state) => state.document.patientDocuments;
export const selectVisitDocuments = (state) => state.document.visitDocuments;
export const selectArchivedDocuments = (state) => state.document.archivedDocuments;
export const selectDocumentCategories = (state) => state.document.documentCategories;
export const selectDocumentVersions = (state) => state.document.documentVersions;
export const selectDocumentSearchResults = (state) => state.document.searchResults;
export const selectUploadProgress = (state) => state.document.uploadProgress;
export const selectDocumentLoading = (state) => state.document.isLoading;
export const selectDocumentUploading = (state) => state.document.isUploading;
export const selectDocumentProcessing = (state) => state.document.isProcessing;
export const selectDocumentError = (state) => state.document.error;
export const selectDocumentFilters = (state) => state.document.filters;
export const selectDocumentPagination = (state) => ({
  currentPage: state.document.currentPage,
  pageSize: state.document.pageSize,
  totalCount: state.document.totalCount,
});

export default documentSlice.reducer;
