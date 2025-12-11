/**
 * OCR Import Service
 * Frontend service for medical imaging import with OCR
 */

import api from './apiConfig';

const ocrImportService = {
  /**
   * Get available network shares
   */
  async getNetworkShares() {
    const response = await api.get('/ocr/shares');
    return response.data;
  },

  /**
   * Scan a folder for files
   */
  async scanFolder(folderPath, maxFiles = 1000, recursive = true) {
    const response = await api.get('/ocr/scan', {
      params: { folder_path: folderPath, max_files: maxFiles, recursive }
    });
    return response.data;
  },

  /**
   * Preview patients that would be imported
   */
  async previewPatients(folderPath, deviceType, maxPatients = 20) {
    const response = await api.get('/ocr/preview', {
      params: { folder_path: folderPath, device_type: deviceType, max_patients: maxPatients }
    });
    return response.data;
  },

  /**
   * Start batch import
   */
  async startImport(folderPath, deviceType, options = {}) {
    const response = await api.post('/ocr/import', {
      folder_path: folderPath,
      device_type: deviceType,
      max_files: options.maxFiles || 100,
      max_patients: options.maxPatients || 20,
      device_id: options.deviceId
    });
    return response.data;
  },

  /**
   * Get import task status
   */
  async getImportStatus(taskId) {
    const response = await api.get(`/ocr/import/${taskId}/status`);
    return response.data;
  },

  /**
   * Cancel import task
   */
  async cancelImport(taskId) {
    const response = await api.post(`/ocr/import/${taskId}/cancel`);
    return response.data;
  },

  /**
   * Get review queue (documents pending manual linking)
   */
  async getReviewQueue(page = 1, limit = 20) {
    const response = await api.get('/ocr/review-queue', {
      params: { page, limit }
    });
    return response.data;
  },

  /**
   * Link document to patient
   */
  async linkToPatient(documentId, patientId) {
    const response = await api.post(`/ocr/review/${documentId}/link`, {
      patient_id: patientId
    });
    return response.data;
  },

  /**
   * Skip/reject document from review
   */
  async skipDocument(documentId, reason = '') {
    const response = await api.post(`/ocr/review/${documentId}/skip`, { reason });
    return response.data;
  },

  /**
   * Search patients for manual linking
   */
  async searchPatients(query, limit = 10) {
    const response = await api.get('/ocr/patients/search', {
      params: { q: query, limit }
    });
    return response.data;
  }
};

export default ocrImportService;
