import api, { apiHelpers } from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

/**
 * Device Service - Offline-First
 *
 * Handles all device integration API calls including:
 * - Device management (CRUD)
 * - Webhook integration
 * - Folder synchronization
 * - Manual data import
 * - Device statistics and monitoring
 * - Integration logs
 *
 * Read operations (getDevices, getDevice, getDeviceHealth) work offline with cached data
 * Write operations and device operations (sync, mount, etc.) require online connection
 */

const deviceService = {
  // ==================== Device Management ====================

  /**
   * Get all devices with optional filtering and pagination - WORKS OFFLINE
   * @param {Object} params - Query parameters (page, limit, type, status, manufacturer)
   * @returns {Promise<Object>} - { success, data, pagination }
   */
  async getDevices(params = {}) {
    return offlineWrapper.get(
      () => api.get('/devices', { params }),
      'devices',
      params,
      {
        transform: (response) => response.data,
        cacheExpiry: 1800 // 30 minutes - devices don't change frequently
      }
    );
  },

  /**
   * Get single device by ID - WORKS OFFLINE
   * @param {String} id - Device ID
   * @returns {Promise<Object>} - { success, data }
   */
  async getDevice(id) {
    return offlineWrapper.get(
      () => api.get(`/devices/${id}`),
      'devices',
      id,
      {
        transform: (response) => response.data,
        cacheExpiry: 1800 // 30 minutes
      }
    );
  },

  /**
   * Create new device (admin only)
   * @param {Object} deviceData - Device configuration
   * @returns {Promise<Object>} - { success, data }
   */
  async createDevice(deviceData) {
    try {
      const response = await api.post('/devices', deviceData);
      return response.data;
    } catch (error) {
      console.error('Error creating device:', error);
      throw error;
    }
  },

  /**
   * Update device (admin only)
   * @param {String} id - Device ID
   * @param {Object} deviceData - Updated device data
   * @returns {Promise<Object>} - { success, data }
   */
  async updateDevice(id, deviceData) {
    try {
      const response = await api.put(`/devices/${id}`, deviceData);
      return response.data;
    } catch (error) {
      console.error('Error updating device:', error);
      throw error;
    }
  },

  /**
   * Delete device (admin only)
   * @param {String} id - Device ID
   * @returns {Promise<Object>} - { success, message }
   */
  async deleteDevice(id) {
    try {
      const response = await api.delete(`/devices/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting device:', error);
      throw error;
    }
  },

  // ==================== Folder Synchronization ====================

  /**
   * Manually trigger folder sync for a device
   * @param {String} id - Device ID
   * @returns {Promise<Object>} - { success, recordsProcessed, recordsFailed }
   */
  async syncDeviceFolder(id) {
    try {
      const response = await api.post(`/devices/${id}/sync-folder`);
      return response.data;
    } catch (error) {
      console.error('Error syncing device folder:', error);
      throw error;
    }
  },

  // ==================== Manual Import ====================

  /**
   * Manually import measurements from file
   * @param {String} id - Device ID
   * @param {File} file - File to upload (CSV, JSON, DICOM, etc.)
   * @param {Object} metadata - Additional metadata (patientId, examId, etc.)
   * @param {Function} onProgress - Upload progress callback
   * @returns {Promise<Object>} - { success, recordsProcessed, measurements }
   */
  async importMeasurements(id, file, metadata = {}, onProgress = null) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Add metadata fields
      if (metadata.patientId) formData.append('patientId', metadata.patientId);
      if (metadata.examId) formData.append('examId', metadata.examId);
      if (metadata.fileFormat) formData.append('fileFormat', metadata.fileFormat);
      if (metadata.eye) formData.append('eye', metadata.eye);

      const response = await apiHelpers.upload(
        `/devices/${id}/import-measurements`,
        formData,
        onProgress
      );

      return response.data;
    } catch (error) {
      console.error('Error importing measurements:', error);
      throw error;
    }
  },

  /**
   * Import DICOM image
   * @param {String} id - Device ID
   * @param {File} file - DICOM file
   * @param {Object} metadata - Patient/exam metadata
   * @param {Function} onProgress - Upload progress callback
   * @returns {Promise<Object>} - { success, imageId }
   */
  async importDicomImage(id, file, metadata = {}, onProgress = null) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('imageType', metadata.imageType || 'OCT');

      if (metadata.patientId) formData.append('patientId', metadata.patientId);
      if (metadata.examId) formData.append('examId', metadata.examId);
      if (metadata.eye) formData.append('eye', metadata.eye);

      const response = await apiHelpers.upload(
        `/devices/${id}/import-dicom`,
        formData,
        onProgress
      );

      return response.data;
    } catch (error) {
      console.error('Error importing DICOM image:', error);
      throw error;
    }
  },

  // ==================== Device Statistics ====================

  /**
   * Get device statistics - WORKS OFFLINE
   * @param {String} id - Device ID
   * @param {Object} params - Query params (startDate, endDate, groupBy)
   * @returns {Promise<Object>} - Device statistics
   */
  async getDeviceStats(id, params = {}) {
    return offlineWrapper.get(
      () => api.get(`/devices/${id}/stats`, { params }),
      'devices',
      { type: 'stats', deviceId: id, ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600 // 1 hour - stats don't change frequently
      }
    );
  },

  /**
   * Get device usage metrics
   * @param {String} id - Device ID
   * @param {String} period - Time period (day, week, month, year)
   * @returns {Promise<Object>} - Usage metrics
   */
  async getDeviceUsage(id, period = 'month') {
    try {
      const response = await api.get(`/devices/${id}/usage`, {
        params: { period }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching device usage:', error);
      throw error;
    }
  },

  // ==================== Integration Logs ====================

  /**
   * Get device integration logs
   * @param {String} id - Device ID
   * @param {Object} params - Query params (page, limit, eventType, status, startDate, endDate)
   * @returns {Promise<Object>} - { success, data, pagination }
   */
  async getDeviceLogs(id, params = {}) {
    try {
      const response = await api.get(`/devices/${id}/logs`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching device logs:', error);
      throw error;
    }
  },

  /**
   * Get single integration log details
   * @param {String} deviceId - Device ID
   * @param {String} logId - Log ID
   * @returns {Promise<Object>} - Log details
   */
  async getDeviceLog(deviceId, logId) {
    try {
      const response = await api.get(`/devices/${deviceId}/logs/${logId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching device log:', error);
      throw error;
    }
  },

  // ==================== Device Images ====================

  /**
   * Get device images for a patient
   * @param {String} deviceId - Device ID
   * @param {String} patientId - Patient ID
   * @param {Object} params - Query params (imageType, startDate, endDate)
   * @returns {Promise<Object>} - Device images
   */
  async getDeviceImages(deviceId, patientId, params = {}) {
    try {
      const response = await api.get(`/devices/${deviceId}/images`, {
        params: { ...params, patientId }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching device images:', error);
      throw error;
    }
  },

  /**
   * Get single device image
   * @param {String} imageId - Image ID
   * @returns {Promise<Object>} - Image data with metadata
   */
  async getDeviceImage(imageId) {
    try {
      const response = await api.get(`/devices/images/${imageId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching device image:', error);
      throw error;
    }
  },

  /**
   * Get device image URL for display
   * @param {String} imageId - Image ID
   * @returns {String} - Image URL
   */
  getDeviceImageUrl(imageId) {
    const baseURL = api.defaults.baseURL;
    const token = localStorage.getItem('token');
    return `${baseURL}/devices/images/${imageId}/view?token=${token}`;
  },

  /**
   * Download device image
   * @param {String} imageId - Image ID
   * @param {String} format - Export format (dicom, jpeg, png)
   * @returns {Promise<Blob>} - Image blob
   */
  async downloadDeviceImage(imageId, format = 'dicom') {
    try {
      const response = await api.get(`/devices/images/${imageId}/download`, {
        params: { format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error downloading device image:', error);
      throw error;
    }
  },

  // ==================== Device Measurements ====================

  /**
   * Get device measurements for a patient
   * @param {String} deviceId - Device ID
   * @param {String} patientId - Patient ID
   * @param {Object} params - Query params (startDate, endDate, measurementType)
   * @returns {Promise<Object>} - Device measurements
   */
  async getDeviceMeasurements(deviceId, patientId, params = {}) {
    try {
      const response = await api.get(`/devices/${deviceId}/measurements`, {
        params: { ...params, patientId }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching device measurements:', error);
      throw error;
    }
  },

  /**
   * Get single measurement details
   * @param {String} measurementId - Measurement ID
   * @returns {Promise<Object>} - Measurement data
   */
  async getMeasurement(measurementId) {
    try {
      const response = await api.get(`/devices/measurements/${measurementId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching measurement:', error);
      throw error;
    }
  },

  // ==================== Webhook Configuration ====================

  /**
   * Generate webhook credentials for a device
   * @param {String} id - Device ID
   * @returns {Promise<Object>} - { apiKey, secret, webhookUrl }
   */
  async generateWebhookCredentials(id) {
    try {
      const response = await api.post(`/devices/${id}/webhook/generate`);
      return response.data;
    } catch (error) {
      console.error('Error generating webhook credentials:', error);
      throw error;
    }
  },

  /**
   * Test webhook connection
   * @param {String} id - Device ID
   * @param {Object} testData - Test payload
   * @returns {Promise<Object>} - Test result
   */
  async testWebhook(id, testData = {}) {
    try {
      const response = await api.post(`/devices/${id}/webhook/test`, testData);
      return response.data;
    } catch (error) {
      console.error('Error testing webhook:', error);
      throw error;
    }
  },

  // ==================== Device Health & Status ====================

  /**
   * Get device health status - WORKS OFFLINE
   * @param {String} id - Device ID
   * @returns {Promise<Object>} - Health status
   */
  async getDeviceHealth(id) {
    return offlineWrapper.get(
      () => api.get(`/devices/${id}/health`),
      'devices',
      { type: 'health', deviceId: id },
      {
        transform: (response) => response.data,
        cacheExpiry: 300 // 5 minutes - health status should be fresher
      }
    );
  },

  /**
   * Ping device to check connectivity
   * @param {String} id - Device ID
   * @returns {Promise<Object>} - Ping result
   */
  async pingDevice(id) {
    try {
      const response = await api.post(`/devices/${id}/ping`);
      return response.data;
    } catch (error) {
      console.error('Error pinging device:', error);
      throw error;
    }
  },

  /**
   * Get all devices health summary
   * @returns {Promise<Object>} - All devices health status
   */
  async getAllDevicesHealth() {
    try {
      const response = await api.get('/devices/health/summary');
      return response.data;
    } catch (error) {
      console.error('Error fetching all devices health:', error);
      throw error;
    }
  },

  // ==================== Device Types & Configuration ====================

  /**
   * Get supported device types
   * @returns {Promise<Array>} - List of supported device types
   */
  async getSupportedDeviceTypes() {
    try {
      const response = await api.get('/devices/types');
      return response.data;
    } catch (error) {
      console.error('Error fetching device types:', error);
      throw error;
    }
  },

  /**
   * Get device configuration template
   * @param {String} deviceType - Device type
   * @returns {Promise<Object>} - Configuration template
   */
  async getDeviceConfigTemplate(deviceType) {
    try {
      const response = await api.get(`/devices/types/${deviceType}/template`);
      return response.data;
    } catch (error) {
      console.error('Error fetching device config template:', error);
      throw error;
    }
  },

  // ==================== Utility Functions ====================

  /**
   * Validate device configuration before saving
   * @param {Object} deviceData - Device configuration
   * @returns {Promise<Object>} - Validation result
   */
  async validateDeviceConfig(deviceData) {
    try {
      const response = await api.post('/devices/validate', deviceData);
      return response.data;
    } catch (error) {
      console.error('Error validating device config:', error);
      throw error;
    }
  },

  /**
   * Get device adapter information
   * @param {String} deviceType - Device type
   * @returns {Promise<Object>} - Adapter info (supported formats, fields, etc.)
   */
  async getAdapterInfo(deviceType) {
    try {
      const response = await api.get(`/devices/adapters/${deviceType}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching adapter info:', error);
      throw error;
    }
  },

  // ==================== Batch Operations ====================

  /**
   * Import multiple files at once
   * @param {String} deviceId - Device ID
   * @param {Array<File>} files - Array of files
   * @param {Object} metadata - Shared metadata
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} - Batch import results
   */
  async batchImportFiles(deviceId, files, metadata = {}, onProgress = null) {
    try {
      const formData = new FormData();

      files.forEach((file, index) => {
        formData.append(`files`, file);
      });

      if (metadata.patientId) formData.append('patientId', metadata.patientId);
      if (metadata.examId) formData.append('examId', metadata.examId);

      const response = await apiHelpers.upload(
        `/devices/${deviceId}/batch-import`,
        formData,
        onProgress
      );

      return response.data;
    } catch (error) {
      console.error('Error batch importing files:', error);
      throw error;
    }
  },

  // ==================== SMB Share Mounting ====================

  /**
   * Mount SMB share for a device
   * @param {String} deviceId - Device ID
   * @returns {Promise<Object>} - Mount result
   */
  async mountShare(deviceId) {
    try {
      const response = await api.post(`/devices/${deviceId}/mount`);
      return response.data;
    } catch (error) {
      console.error('Error mounting share:', error);
      throw error;
    }
  },

  /**
   * Unmount SMB share for a device
   * @param {String} deviceId - Device ID
   * @returns {Promise<Object>} - Unmount result
   */
  async unmountShare(deviceId) {
    try {
      const response = await api.post(`/devices/${deviceId}/unmount`);
      return response.data;
    } catch (error) {
      console.error('Error unmounting share:', error);
      throw error;
    }
  },

  /**
   * Get mount status for a device
   * @param {String} deviceId - Device ID
   * @returns {Promise<Object>} - Mount status
   */
  async getMountStatus(deviceId) {
    try {
      const response = await api.get(`/devices/${deviceId}/mount-status`);
      return response.data;
    } catch (error) {
      console.error('Error getting mount status:', error);
      throw error;
    }
  },

  /**
   * Mount all configured device shares
   * @returns {Promise<Object>} - Results for all mounts
   */
  async mountAllShares() {
    try {
      const response = await api.post('/devices/mount-all');
      return response.data;
    } catch (error) {
      console.error('Error mounting all shares:', error);
      throw error;
    }
  },

  // ==================== File Browsing ====================

  /**
   * Browse files in a device share
   * @param {String} deviceId - Device ID
   * @param {String} subpath - Subdirectory path
   * @param {Number} limit - Max entries to return
   * @returns {Promise<Object>} - Directory contents
   */
  async browseDeviceFiles(deviceId, subpath = '', limit = 100) {
    try {
      const response = await api.get(`/devices/${deviceId}/browse`, {
        params: { subpath, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error browsing device files:', error);
      throw error;
    }
  },

  /**
   * Get URL to serve a file from device share
   * @param {String} deviceId - Device ID
   * @param {String} filePath - File path within share
   * @returns {String} - File URL
   */
  getDeviceFileUrl(deviceId, filePath) {
    const baseURL = api.defaults.baseURL;
    return `${baseURL}/devices/${deviceId}/files/${encodeURIComponent(filePath)}`;
  },

  /**
   * Scan archive folder for auto-mapping
   * @param {String} deviceId - Device ID
   * @param {String} folderId - Folder ID to scan
   * @returns {Promise<Object>} - Scan results
   */
  async scanArchiveFolder(deviceId, folderId) {
    try {
      const response = await api.post(`/devices/${deviceId}/scan-archive`, { folderId });
      return response.data;
    } catch (error) {
      console.error('Error scanning archive folder:', error);
      throw error;
    }
  },

  // ==================== Legacy Patient Mapping ====================

  /**
   * Find patient by legacy DMI ID
   * @param {String} dmiId - Legacy DMI ID (e.g., 10001A01)
   * @returns {Promise<Object>} - Patient data or not found
   */
  async findPatientByLegacyId(dmiId) {
    try {
      const response = await api.get(`/devices/legacy/patients/${dmiId}`);
      return response.data;
    } catch (error) {
      console.error('Error finding patient by legacy ID:', error);
      throw error;
    }
  },

  /**
   * Get patient's archive files from legacy system
   * @param {String} dmiId - Legacy DMI ID
   * @returns {Promise<Object>} - Patient files
   */
  async getPatientArchiveFiles(dmiId) {
    try {
      const response = await api.get(`/devices/legacy/patients/${dmiId}/files`);
      return response.data;
    } catch (error) {
      console.error('Error getting patient archive files:', error);
      throw error;
    }
  },

  /**
   * Create legacy ID mapping for a patient
   * @param {String} patientId - MedFlow patient ID
   * @param {Object} mappingData - { dmiId?, deviceType?, folderId?, folderPath? }
   * @returns {Promise<Object>} - Mapping result
   */
  async createLegacyMapping(patientId, mappingData) {
    try {
      const response = await api.post(`/devices/legacy/patients/${patientId}/map`, mappingData);
      return response.data;
    } catch (error) {
      console.error('Error creating legacy mapping:', error);
      throw error;
    }
  },

  /**
   * Bulk import legacy patient mappings
   * @param {Array} mappings - Array of { dmiId, firstName, lastName, dateOfBirth, phone }
   * @returns {Promise<Object>} - Import statistics
   */
  async bulkImportLegacyMappings(mappings) {
    try {
      const response = await api.post('/devices/legacy/patients/bulk-import', { mappings });
      return response.data;
    } catch (error) {
      console.error('Error bulk importing legacy mappings:', error);
      throw error;
    }
  },

  // ==================== Folder Sync Service ====================

  /**
   * Get folder sync service statistics
   * @returns {Promise<Object>} - Sync service stats
   */
  async getFolderSyncStats() {
    try {
      const response = await api.get('/devices/folder-sync/stats');
      return response.data;
    } catch (error) {
      console.error('Error getting folder sync stats:', error);
      throw error;
    }
  },

  /**
   * Start folder watcher for a device
   * @param {String} deviceId - Device ID
   * @returns {Promise<Object>} - Start result
   */
  async startFolderWatcher(deviceId) {
    try {
      const response = await api.post(`/devices/${deviceId}/watcher/start`);
      return response.data;
    } catch (error) {
      console.error('Error starting folder watcher:', error);
      throw error;
    }
  },

  /**
   * Stop folder watcher for a device
   * @param {String} deviceId - Device ID
   * @returns {Promise<Object>} - Stop result
   */
  async stopFolderWatcher(deviceId) {
    try {
      const response = await api.post(`/devices/${deviceId}/watcher/stop`);
      return response.data;
    } catch (error) {
      console.error('Error stopping folder watcher:', error);
      throw error;
    }
  },

  /**
   * Trigger full sync for a device
   * @param {String} deviceId - Device ID
   * @returns {Promise<Object>} - Sync result
   */
  async triggerFullSync(deviceId) {
    try {
      const response = await api.post(`/devices/${deviceId}/watcher/sync`);
      return response.data;
    } catch (error) {
      console.error('Error triggering full sync:', error);
      throw error;
    }
  },

  // ==================== Real-time Updates (WebSocket) ====================

  /**
   * Subscribe to device data updates (used with WebSocket service)
   * @param {String} deviceId - Device ID
   * @param {Function} callback - Callback for new data
   */
  subscribeToDeviceUpdates(deviceId, callback) {
    // This would integrate with websocketService
    // Implementation depends on WebSocket setup
    console.log(`Subscribing to device updates for: ${deviceId}`);
    // websocketService.subscribe(`device-${deviceId}`, callback);
  },

  /**
   * Unsubscribe from device updates
   * @param {String} deviceId - Device ID
   */
  unsubscribeFromDeviceUpdates(deviceId) {
    console.log(`Unsubscribing from device updates for: ${deviceId}`);
    // websocketService.unsubscribe(`device-${deviceId}`);
  }
};

export default deviceService;
