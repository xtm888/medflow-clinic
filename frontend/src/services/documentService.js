import api from './apiConfig';

// Document service for managing medical documents and files
const documentService = {
  // Get all documents with filters
  async getDocuments(params = {}) {
    try {
      const response = await api.get('/documents', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching documents:', error);
      throw error;
    }
  },

  // Get single document
  async getDocument(id) {
    try {
      const response = await api.get(`/documents/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching document:', error);
      throw error;
    }
  },

  // Upload document
  async uploadDocument(file, metadata = {}) {
    try {
      const formData = new FormData();
      formData.append('document', file); // Backend expects 'document' field name
      Object.keys(metadata).forEach(key => {
        formData.append(key, metadata[key]);
      });

      const response = await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (metadata.onProgress) {
            metadata.onProgress(percentCompleted);
          }
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  },

  // Upload multiple documents
  async uploadMultipleDocuments(files, metadata = {}) {
    try {
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append(`files[${index}]`, file);
      });
      Object.keys(metadata).forEach(key => {
        formData.append(key, metadata[key]);
      });

      const response = await api.post('/documents/upload-multiple', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading multiple documents:', error);
      throw error;
    }
  },

  // Update document metadata
  async updateDocument(id, documentData) {
    try {
      const response = await api.put(`/documents/${id}`, documentData);
      return response.data;
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  },

  // Delete document
  async deleteDocument(id) {
    try {
      const response = await api.delete(`/documents/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  },

  // Download document
  async downloadDocument(id) {
    try {
      const response = await api.get(`/documents/${id}/download`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error downloading document:', error);
      throw error;
    }
  },

  // Get document preview
  async getDocumentPreview(id) {
    try {
      const response = await api.get(`/documents/${id}/preview`);
      return response.data;
    } catch (error) {
      console.error('Error fetching document preview:', error);
      throw error;
    }
  },

  // Get documents by patient
  async getPatientDocuments(patientId, params = {}) {
    try {
      const response = await api.get(`/patients/${patientId}/documents`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching patient documents:', error);
      throw error;
    }
  },

  // Get documents by visit
  async getVisitDocuments(visitId, params = {}) {
    try {
      const response = await api.get(`/visits/${visitId}/documents`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching visit documents:', error);
      throw error;
    }
  },

  // Upload audio recording
  async uploadAudioRecording(audioBlob, metadata = {}) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      Object.keys(metadata).forEach(key => {
        formData.append(key, metadata[key]);
      });

      const response = await api.post('/documents/upload-audio', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading audio recording:', error);
      throw error;
    }
  },

  // Transcribe audio document
  async transcribeAudio(documentId, engine = 'whisper') {
    try {
      const response = await api.post(`/documents/${documentId}/transcribe`, { engine });
      return response.data;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  },

  // Get transcription status
  async getTranscriptionStatus(documentId) {
    try {
      const response = await api.get(`/documents/${documentId}/transcription-status`);
      return response.data;
    } catch (error) {
      console.error('Error fetching transcription status:', error);
      throw error;
    }
  },

  // OCR scan document
  async ocrScanDocument(documentId) {
    try {
      const response = await api.post(`/documents/${documentId}/ocr`);
      return response.data;
    } catch (error) {
      console.error('Error performing OCR:', error);
      throw error;
    }
  },

  // Get OCR status
  async getOCRStatus(documentId) {
    try {
      const response = await api.get(`/documents/${documentId}/ocr-status`);
      return response.data;
    } catch (error) {
      console.error('Error fetching OCR status:', error);
      throw error;
    }
  },

  // Share document
  async shareDocument(documentId, shareData) {
    try {
      const response = await api.post(`/documents/${documentId}/share`, shareData);
      return response.data;
    } catch (error) {
      console.error('Error sharing document:', error);
      throw error;
    }
  },

  // Revoke document share
  async revokeShare(documentId, shareId) {
    try {
      const response = await api.delete(`/documents/${documentId}/shares/${shareId}`);
      return response.data;
    } catch (error) {
      console.error('Error revoking document share:', error);
      throw error;
    }
  },

  // Get document shares
  async getDocumentShares(documentId) {
    try {
      const response = await api.get(`/documents/${documentId}/shares`);
      return response.data;
    } catch (error) {
      console.error('Error fetching document shares:', error);
      throw error;
    }
  },

  // Tag document
  async tagDocument(documentId, tags) {
    try {
      const response = await api.post(`/documents/${documentId}/tags`, { tags });
      return response.data;
    } catch (error) {
      console.error('Error tagging document:', error);
      throw error;
    }
  },

  // Search documents
  async searchDocuments(query, filters = {}) {
    try {
      const response = await api.get('/documents/search', {
        params: { q: query, ...filters }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
  },

  // Get document categories
  async getDocumentCategories() {
    try {
      const response = await api.get('/documents/categories');
      return response.data;
    } catch (error) {
      console.error('Error fetching document categories:', error);
      throw error;
    }
  },

  // Move document to category
  async moveToCategory(documentId, categoryId) {
    try {
      const response = await api.put(`/documents/${documentId}/category`, { categoryId });
      return response.data;
    } catch (error) {
      console.error('Error moving document to category:', error);
      throw error;
    }
  },

  // Get document versions
  async getDocumentVersions(documentId) {
    try {
      const response = await api.get(`/documents/${documentId}/versions`);
      return response.data;
    } catch (error) {
      console.error('Error fetching document versions:', error);
      throw error;
    }
  },

  // Restore document version
  async restoreVersion(documentId, versionId) {
    try {
      const response = await api.post(`/documents/${documentId}/restore-version`, { versionId });
      return response.data;
    } catch (error) {
      console.error('Error restoring document version:', error);
      throw error;
    }
  },

  // Archive document
  async archiveDocument(documentId) {
    try {
      const response = await api.put(`/documents/${documentId}/archive`);
      return response.data;
    } catch (error) {
      console.error('Error archiving document:', error);
      throw error;
    }
  },

  // Unarchive document
  async unarchiveDocument(documentId) {
    try {
      const response = await api.put(`/documents/${documentId}/unarchive`);
      return response.data;
    } catch (error) {
      console.error('Error unarchiving document:', error);
      throw error;
    }
  },

  // Get archived documents
  async getArchivedDocuments(params = {}) {
    try {
      const response = await api.get('/documents/archived', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching archived documents:', error);
      throw error;
    }
  },

  // Bulk delete documents
  async bulkDeleteDocuments(documentIds) {
    try {
      const response = await api.delete('/documents/bulk', {
        data: { documentIds }
      });
      return response.data;
    } catch (error) {
      console.error('Error bulk deleting documents:', error);
      throw error;
    }
  },

  // Get document statistics
  async getDocumentStatistics(params = {}) {
    try {
      const response = await api.get('/documents/statistics', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching document statistics:', error);
      throw error;
    }
  },

  // Generate document thumbnail
  async generateThumbnail(documentId) {
    try {
      const response = await api.post(`/documents/${documentId}/generate-thumbnail`);
      return response.data;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      throw error;
    }
  },

  // Sign document electronically
  async signDocument(documentId, signatureData) {
    try {
      const response = await api.post(`/documents/${documentId}/sign`, signatureData);
      return response.data;
    } catch (error) {
      console.error('Error signing document:', error);
      throw error;
    }
  },

  // Verify document signature
  async verifySignature(documentId) {
    try {
      const response = await api.get(`/documents/${documentId}/verify-signature`);
      return response.data;
    } catch (error) {
      console.error('Error verifying document signature:', error);
      throw error;
    }
  },

  // Export documents
  async exportDocuments(documentIds, format = 'zip') {
    try {
      const response = await api.post('/documents/export',
        { documentIds, format },
        { responseType: 'blob' }
      );
      return response.data;
    } catch (error) {
      console.error('Error exporting documents:', error);
      throw error;
    }
  },

  // Get document audit log
  async getDocumentAuditLog(documentId) {
    try {
      const response = await api.get(`/documents/${documentId}/audit-log`);
      return response.data;
    } catch (error) {
      console.error('Error fetching document audit log:', error);
      throw error;
    }
  },

  // Lock document
  async lockDocument(documentId) {
    try {
      const response = await api.put(`/documents/${documentId}/lock`);
      return response.data;
    } catch (error) {
      console.error('Error locking document:', error);
      throw error;
    }
  },

  // Unlock document
  async unlockDocument(documentId) {
    try {
      const response = await api.put(`/documents/${documentId}/unlock`);
      return response.data;
    } catch (error) {
      console.error('Error unlocking document:', error);
      throw error;
    }
  },

  // Merge documents
  async mergeDocuments(documentIds, outputName) {
    try {
      const response = await api.post('/documents/merge', {
        documentIds,
        outputName
      });
      return response.data;
    } catch (error) {
      console.error('Error merging documents:', error);
      throw error;
    }
  },

  // Split document
  async splitDocument(documentId, pages) {
    try {
      const response = await api.post(`/documents/${documentId}/split`, { pages });
      return response.data;
    } catch (error) {
      console.error('Error splitting document:', error);
      throw error;
    }
  }
};

export default documentService;