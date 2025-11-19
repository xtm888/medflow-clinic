/**
 * BaseAdapter - Abstract base class for all device adapters
 *
 * Each device type (OCT, tonometer, autorefractor, etc.) will have its own adapter
 * that extends this base class and implements device-specific processing logic.
 *
 * Key Responsibilities:
 * - Define common interface for all adapters
 * - Provide shared validation and transformation utilities
 * - Handle common error scenarios
 * - Standardize data format for storage
 */

const DeviceMeasurement = require('../../models/DeviceMeasurement');
const DeviceImage = require('../../models/DeviceImage');
const DeviceIntegrationLog = require('../../models/DeviceIntegrationLog');
const OphthalmologyExam = require('../../models/OphthalmologyExam');

class BaseAdapter {
  /**
   * Constructor
   * @param {Object} device - Device model instance
   */
  constructor(device) {
    if (this.constructor === BaseAdapter) {
      throw new Error('BaseAdapter is an abstract class and cannot be instantiated directly');
    }

    this.device = device;
    this.deviceType = device.type;
    this.deviceId = device._id;
  }

  /**
   * Process incoming data from device
   * MUST be implemented by subclasses
   *
   * @param {Object} data - Raw data from device
   * @param {String} patientId - Patient ID
   * @param {String} examId - Ophthalmology exam ID (optional)
   * @returns {Promise<Object>} - Processing result
   */
  async process(data, patientId, examId = null) {
    throw new Error('process() must be implemented by subclass');
  }

  /**
   * Validate incoming data
   * MUST be implemented by subclasses
   *
   * @param {Object} data - Data to validate
   * @returns {Promise<Object>} - Validation result { isValid: Boolean, errors: Array }
   */
  async validate(data) {
    throw new Error('validate() must be implemented by subclass');
  }

  /**
   * Transform device data to standard format
   * MUST be implemented by subclasses
   *
   * @param {Object} data - Raw device data
   * @returns {Promise<Object>} - Transformed data
   */
  async transform(data) {
    throw new Error('transform() must be implemented by subclass');
  }

  /**
   * Save processed data to database
   * Can be overridden by subclasses for device-specific logic
   *
   * @param {Object} transformedData - Transformed data
   * @param {String} patientId - Patient ID
   * @param {String} examId - Exam ID (optional)
   * @returns {Promise<Object>} - Saved record
   */
  async save(transformedData, patientId, examId = null) {
    // Default implementation - can be overridden
    const measurement = new DeviceMeasurement({
      device: this.deviceId,
      deviceType: this.deviceType,
      patient: patientId,
      measurementType: transformedData.measurementType,
      ...transformedData
    });

    if (examId) {
      // Link to ophthalmology exam if provided
      const exam = await OphthalmologyExam.findById(examId);
      if (exam) {
        measurement.visit = exam.visit;
        measurement.ophthalmologyExam = examId;
      }
    }

    return await measurement.save();
  }

  /**
   * Parse file content based on file format
   *
   * @param {String|Buffer} content - File content
   * @param {String} format - File format (csv, json, xml, txt, dicom)
   * @returns {Promise<Object>} - Parsed data
   */
  async parseFile(content, format) {
    switch (format.toLowerCase()) {
      case 'json':
        return this.parseJSON(content);
      case 'csv':
        return this.parseCSV(content);
      case 'xml':
        return this.parseXML(content);
      case 'txt':
        return this.parseTXT(content);
      case 'dicom':
        return this.parseDICOM(content);
      default:
        throw new Error(`Unsupported file format: ${format}`);
    }
  }

  /**
   * Parse JSON content
   */
  parseJSON(content) {
    try {
      if (Buffer.isBuffer(content)) {
        content = content.toString('utf-8');
      }
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`JSON parse error: ${error.message}`);
    }
  }

  /**
   * Parse CSV content
   * Can be overridden by subclasses for device-specific CSV format
   */
  parseCSV(content) {
    try {
      if (Buffer.isBuffer(content)) {
        content = content.toString('utf-8');
      }

      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        throw new Error('Empty CSV file');
      }

      // Parse header
      const headers = lines[0].split(',').map(h => h.trim());

      // Parse data rows
      const data = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        data.push(row);
      }

      return data;
    } catch (error) {
      throw new Error(`CSV parse error: ${error.message}`);
    }
  }

  /**
   * Parse XML content
   * Should be overridden by subclasses if XML support is needed
   */
  parseXML(content) {
    throw new Error('XML parsing must be implemented by subclass');
  }

  /**
   * Parse TXT content
   * Should be overridden by subclasses for device-specific text format
   */
  parseTXT(content) {
    throw new Error('TXT parsing must be implemented by subclass');
  }

  /**
   * Parse DICOM content
   * Should be overridden by subclasses for DICOM support
   */
  parseDICOM(content) {
    throw new Error('DICOM parsing must be implemented by subclass');
  }

  /**
   * Store device image
   *
   * @param {Object} imageData - Image data and metadata
   * @param {String} patientId - Patient ID
   * @param {String} examId - Exam ID (optional)
   * @returns {Promise<Object>} - Saved DeviceImage record
   */
  async storeImage(imageData, patientId, examId = null) {
    const deviceImage = new DeviceImage({
      device: this.deviceId,
      deviceType: this.deviceType,
      patient: patientId,
      imageType: imageData.imageType,
      eye: imageData.eye,
      capturedAt: imageData.capturedAt || new Date(),
      file: imageData.file,
      source: imageData.source || 'device',
      ...imageData
    });

    if (examId) {
      const exam = await OphthalmologyExam.findById(examId);
      if (exam) {
        deviceImage.visit = exam.visit;
        deviceImage.ophthalmologyExam = examId;
      }
    }

    return await deviceImage.save();
  }

  /**
   * Log integration event
   *
   * @param {String} eventType - Type of event
   * @param {String} status - Event status
   * @param {Object} details - Additional details
   * @returns {Promise<Object>} - Created log entry
   */
  async logEvent(eventType, status, details = {}) {
    const log = new DeviceIntegrationLog({
      device: this.deviceId,
      deviceType: this.deviceType,
      eventType,
      status,
      integrationMethod: details.integrationMethod || 'api',
      initiatedBy: details.initiatedBy || 'DEVICE',
      ...details
    });

    return await log.save();
  }

  /**
   * Validate common fields across all device types
   *
   * @param {Object} data - Data to validate
   * @param {Array} requiredFields - Required field names
   * @returns {Object} - Validation result { isValid: Boolean, errors: Array }
   */
  validateCommonFields(data, requiredFields = []) {
    const errors = [];

    // Check required fields
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        errors.push({
          field,
          message: `${field} is required`,
          code: 'REQUIRED_FIELD_MISSING'
        });
      }
    }

    // Validate eye if present
    if (data.eye && !['OD', 'OS', 'OU', 'NA'].includes(data.eye)) {
      errors.push({
        field: 'eye',
        message: 'Eye must be OD, OS, OU, or NA',
        code: 'INVALID_EYE_VALUE',
        value: data.eye
      });
    }

    // Validate date if present
    if (data.capturedAt || data.measurementDate) {
      const dateField = data.capturedAt ? 'capturedAt' : 'measurementDate';
      const dateValue = data[dateField];

      if (isNaN(new Date(dateValue).getTime())) {
        errors.push({
          field: dateField,
          message: 'Invalid date format',
          code: 'INVALID_DATE',
          value: dateValue
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate numeric value within range
   *
   * @param {Number} value - Value to check
   * @param {Number} min - Minimum allowed value
   * @param {Number} max - Maximum allowed value
   * @param {String} fieldName - Field name for error message
   * @returns {Object|null} - Error object or null if valid
   */
  validateRange(value, min, max, fieldName) {
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        field: fieldName,
        message: `${fieldName} must be a number`,
        code: 'INVALID_NUMBER',
        value
      };
    }

    if (value < min || value > max) {
      return {
        field: fieldName,
        message: `${fieldName} must be between ${min} and ${max}`,
        code: 'OUT_OF_RANGE',
        value,
        range: { min, max }
      };
    }

    return null;
  }

  /**
   * Standardize eye data format (OD/OS structure)
   *
   * @param {Object} data - Raw data
   * @returns {Object} - Standardized data with OD/OS structure
   */
  standardizeEyeData(data) {
    // Helper to ensure OD/OS structure exists
    const ensureEyeStructure = (obj) => {
      if (!obj.OD) obj.OD = {};
      if (!obj.OS) obj.OS = {};
      return obj;
    };

    return ensureEyeStructure(data);
  }

  /**
   * Extract patient demographics from data (if present)
   *
   * @param {Object} data - Raw data
   * @returns {Object|null} - Patient demographics or null
   */
  extractPatientDemographics(data) {
    const demographics = {};

    if (data.patientName) demographics.name = data.patientName;
    if (data.patientId) demographics.patientId = data.patientId;
    if (data.patientDOB) demographics.dateOfBirth = data.patientDOB;
    if (data.patientGender) demographics.gender = data.patientGender;

    return Object.keys(demographics).length > 0 ? demographics : null;
  }

  /**
   * Calculate quality score based on device-specific metrics
   * Can be overridden by subclasses
   *
   * @param {Object} data - Measurement data
   * @returns {Number} - Quality score (0-100)
   */
  calculateQualityScore(data) {
    // Default implementation - should be overridden
    return 100;
  }

  /**
   * Generate checksum for data integrity
   *
   * @param {String|Buffer} content - Content to checksum
   * @returns {String} - SHA256 checksum
   */
  generateChecksum(content) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Handle errors and create detailed error response
   *
   * @param {Error} error - Error object
   * @param {String} context - Error context
   * @returns {Object} - Error response
   */
  handleError(error, context = 'processing') {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        context,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    };
  }

  /**
   * Create success response
   *
   * @param {Object} data - Response data
   * @param {String} message - Success message
   * @returns {Object} - Success response
   */
  createSuccessResponse(data, message = 'Processing completed successfully') {
    return {
      success: true,
      message,
      data
    };
  }
}

module.exports = BaseAdapter;
