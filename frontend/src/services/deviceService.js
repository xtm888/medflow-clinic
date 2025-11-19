import api, { apiHelpers } from './apiConfig';

/**
 * Device Service
 *
 * Handles all device integration API calls including:
 * - Device management (CRUD)
 * - Webhook integration
 * - Folder synchronization
 * - Manual data import
 * - Device statistics and monitoring
 * - Integration logs
 */

const deviceService = {
  // ==================== Device Management ====================

  /**
   * Get all devices with optional filtering and pagination
   * @param {Object} params - Query parameters (page, limit, type, status, manufacturer)
   * @returns {Promise<Object>} - { success, data, pagination }
   */
  async getDevices(params = {}) {
    try {
      const response = await api.get('/devices', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching devices:', error);
      throw error;
    }
  },

  /**
   * Get single device by ID
   * @param {String} id - Device ID
   * @returns {Promise<Object>} - { success, data }
   */
  async getDevice(id) {
    try {
      const response = await api.get(`/devices/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching device:', error);
      throw error;
    }
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
   * Get device statistics
   * @param {String} id - Device ID
   * @param {Object} params - Query params (startDate, endDate, groupBy)
   * @returns {Promise<Object>} - Device statistics
   */
  async getDeviceStats(id, params = {}) {
    try {
      const response = await api.get(`/devices/${id}/stats`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching device stats:', error);
      throw error;
    }
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
   * Get device health status
   * @param {String} id - Device ID
   * @returns {Promise<Object>} - Health status
   */
  async getDeviceHealth(id) {
    try {
      const response = await api.get(`/devices/${id}/health`);
      return response.data;
    } catch (error) {
      console.error('Error fetching device health:', error);
      throw error;
    }
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
