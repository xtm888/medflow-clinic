/**
 * Universal File Processor
 *
 * Orchestrates file processing across multiple strategies:
 * 1. DICOM metadata extraction (most reliable)
 * 2. Device-specific adapters
 * 3. Filename pattern parsing
 * 4. OCR service fallback (Python microservice)
 *
 * Provides unified patient info extraction regardless of file type or device.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdapterFactory = require('./adapters/AdapterFactory');

// OCR Service configuration
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8002';
const OCR_SERVICE_TIMEOUT = 30000; // 30 seconds

/**
 * Supported file extensions by category
 */
const FILE_CATEGORIES = {
  dicom: ['.dcm', '.dicom', '.dcm30'],
  image: ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.gif'],
  pdf: ['.pdf'],
  data: ['.xml', '.json', '.csv', '.txt', '.hl7'],
  video: ['.mp4', '.avi', '.mov']
};

/**
 * Device detection patterns
 */
const DEVICE_PATTERNS = {
  // Folder path patterns
  folderPatterns: {
    zeiss: ['zeiss', 'clarus', 'cirrus', 'humphrey'],
    solix: ['solix', 'optovue', 'avanti'],
    tomey: ['tomey', 'casia'],
    nidek: ['nidek', 'nt-', 'ark-', 'opd-', 'al-scan'],
    topcon: ['topcon', 'triton', 'maestro'],
    heidelberg: ['heidelberg', 'spectralis', 'hrt'],
    quantel: ['quantel', 'aviso'],
    canon: ['canon', 'cr-2']
  },
  // Filename patterns (regex)
  filenamePatterns: {
    zeiss: /^[A-Z]+_[A-Z]+_\d+_\d{8}_/i, // LASTNAME_FIRSTNAME_ID_DOB_...
    nidek: /^NIDEK|^ARK|^OPD|^NT\d/i,
    topcon: /^TOP_|TOPCON/i,
    heidelberg: /^HRA|^OCT_HEI/i
  }
};

/**
 * Filename parsing patterns by device type
 */
const FILENAME_PARSERS = {
  zeiss: {
    // Format: LastName_FirstName_PatientID_DOB_Gender_Type_Mode_DateTime_Eye_...
    pattern: /^([^_]+)_([^_]+)_([^_]+)_(\d{8})_([^_]*)_/,
    extract: (match) => ({
      lastName: match[1],
      firstName: match[2],
      patientId: match[3],
      dateOfBirth: parseDate(match[4], 'YYYYMMDD'),
      gender: match[5]?.toLowerCase() === 'male' ? 'male' : match[5]?.toLowerCase() === 'female' ? 'female' : null
    })
  },
  solix: {
    // Format varies, often: PatientName_ExamType_Date or folder-based
    pattern: /^([A-Z][a-z]+)[\s_]([A-Z][a-z]+)/,
    extract: (match) => ({
      lastName: match[1],
      firstName: match[2]
    })
  },
  tomey: {
    // Format: PatientID_Name_Date or Name_Date
    pattern: /^(\d+)?_?([^_]+)_([^_]+)?/,
    extract: (match) => ({
      patientId: match[1] || null,
      lastName: match[2],
      firstName: match[3] || null
    })
  },
  nidek: {
    // Format: Various, often includes patient ID
    pattern: /^(\d+[A-Z]\d+)|([A-Z]+_[A-Z]+)/,
    extract: (match) => ({
      patientId: match[1] || null,
      lastName: match[2]?.split('_')[0] || null,
      firstName: match[2]?.split('_')[1] || null
    })
  },
  generic: {
    // Generic: Try to extract names from common patterns
    pattern: /^([A-Z][A-Za-z]+)[\s_-]([A-Z][A-Za-z]+)/,
    extract: (match) => ({
      lastName: match[1],
      firstName: match[2]
    })
  }
};

/**
 * Parse date string in various formats
 */
function parseDate(dateStr, format = 'auto') {
  if (!dateStr) return null;

  try {
    // YYYYMMDD format
    if (/^\d{8}$/.test(dateStr)) {
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      return new Date(year, month, day);
    }

    // DD/MM/YYYY format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/').map(Number);
      return new Date(year, month - 1, day);
    }

    // YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(dateStr);
    }

    // Try native parsing
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Extract laterality (eye) from filename or text
 */
function extractLaterality(text) {
  if (!text) return null;

  const match = text.match(/[_\-\s\.](OD|OS|OU|O\.D\.|O\.S\.|O\.U\.)[_\-\s\.]/i);
  if (match) {
    return match[1].replace(/\./g, '').toUpperCase();
  }

  // Also check for Right/Left
  if (/right|droit|od\b/i.test(text)) return 'OD';
  if (/left|gauche|os\b/i.test(text)) return 'OS';
  if (/both|bilateral|ou\b/i.test(text)) return 'OU';

  return null;
}

class UniversalFileProcessor {
  constructor() {
    this.stats = {
      totalProcessed: 0,
      dicomSuccess: 0,
      adapterSuccess: 0,
      filenameSuccess: 0,
      ocrSuccess: 0,
      failed: 0
    };
  }

  /**
   * Process a single file and extract patient information
   *
   * @param {string} filePath - Full path to the file
   * @param {string} deviceType - Optional device type hint
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Extracted patient info with confidence
   */
  async processFile(filePath, deviceType = null, options = {}) {
    const startTime = Date.now();
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const folderPath = path.dirname(filePath);

    // Initialize result
    let result = {
      success: false,
      filePath,
      fileName,
      fileType: this.getFileType(ext),
      deviceType: deviceType || this.detectDeviceType(folderPath, fileName),
      patientInfo: null,
      confidence: 0,
      method: null,
      rawData: null,
      processingTimeMs: 0,
      error: null
    };

    try {
      // Verify file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Strategy 1: DICOM (most reliable)
      if (this.isDICOM(ext)) {
        const dicomResult = await this.processDICOM(filePath);
        if (dicomResult.success) {
          this.stats.dicomSuccess++;
          result = { ...result, ...dicomResult, method: 'dicom' };
          result.processingTimeMs = Date.now() - startTime;
          this.stats.totalProcessed++;
          return result;
        }
      }

      // Strategy 2: Device Adapter (if type known)
      if (result.deviceType && result.deviceType !== 'generic') {
        const adapterResult = await this.processWithAdapter(filePath, result.deviceType);
        if (adapterResult.success && adapterResult.confidence >= 0.7) {
          this.stats.adapterSuccess++;
          result = { ...result, ...adapterResult, method: 'adapter' };
          result.processingTimeMs = Date.now() - startTime;
          this.stats.totalProcessed++;
          return result;
        }
      }

      // Strategy 3: Filename parsing
      const filenameResult = this.parseFilename(fileName, result.deviceType);
      if (filenameResult.success && filenameResult.confidence >= 0.6) {
        this.stats.filenameSuccess++;
        result = { ...result, ...filenameResult, method: 'filename' };
        result.processingTimeMs = Date.now() - startTime;
        this.stats.totalProcessed++;
        return result;
      }

      // Strategy 4: OCR Service (fallback for images/PDFs)
      if (this.isOCRSupported(ext) && options.useOCR !== false) {
        const ocrResult = await this.processWithOCR(filePath, result.deviceType);
        if (ocrResult.success) {
          this.stats.ocrSuccess++;

          // Merge with filename result if available
          if (filenameResult.patientInfo) {
            ocrResult.patientInfo = this.mergePatientInfo(ocrResult.patientInfo, filenameResult.patientInfo);
            ocrResult.confidence = Math.max(ocrResult.confidence, filenameResult.confidence);
          }

          result = { ...result, ...ocrResult, method: 'ocr' };
          result.processingTimeMs = Date.now() - startTime;
          this.stats.totalProcessed++;
          return result;
        }
      }

      // If we have partial filename info, use it even with lower confidence
      if (filenameResult.patientInfo) {
        result = { ...result, ...filenameResult, method: 'filename_partial' };
        result.processingTimeMs = Date.now() - startTime;
        this.stats.totalProcessed++;
        return result;
      }

      // No extraction method succeeded
      this.stats.failed++;
      this.stats.totalProcessed++;
      result.error = 'Unable to extract patient information';
      result.processingTimeMs = Date.now() - startTime;
      return result;

    } catch (error) {
      this.stats.failed++;
      this.stats.totalProcessed++;
      result.error = error.message;
      result.processingTimeMs = Date.now() - startTime;
      console.error(`[UniversalProcessor] Error processing ${fileName}:`, error.message);
      return result;
    }
  }

  /**
   * Process multiple files in batch
   */
  async processBatch(files, options = {}) {
    const results = [];
    const concurrency = options.concurrency || 3;

    // Process in batches for better performance
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(file => this.processFile(
          typeof file === 'string' ? file : file.path,
          typeof file === 'object' ? file.deviceType : null,
          options
        ))
      );
      results.push(...batchResults);
    }

    return {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Detect device type from folder path and filename
   */
  detectDeviceType(folderPath, fileName) {
    const pathLower = (folderPath + '/' + fileName).toLowerCase();

    // Check folder patterns
    for (const [device, patterns] of Object.entries(DEVICE_PATTERNS.folderPatterns)) {
      for (const pattern of patterns) {
        if (pathLower.includes(pattern)) {
          return device;
        }
      }
    }

    // Check filename patterns
    for (const [device, regex] of Object.entries(DEVICE_PATTERNS.filenamePatterns)) {
      if (regex.test(fileName)) {
        return device;
      }
    }

    return 'generic';
  }

  /**
   * Get file type category
   */
  getFileType(ext) {
    for (const [type, extensions] of Object.entries(FILE_CATEGORIES)) {
      if (extensions.includes(ext)) {
        return type;
      }
    }
    return 'unknown';
  }

  /**
   * Check if file is DICOM
   */
  isDICOM(ext) {
    return FILE_CATEGORIES.dicom.includes(ext);
  }

  /**
   * Check if file supports OCR
   */
  isOCRSupported(ext) {
    return [...FILE_CATEGORIES.image, ...FILE_CATEGORIES.pdf].includes(ext);
  }

  /**
   * Process DICOM file using pydicom via OCR service
   */
  async processDICOM(filePath) {
    try {
      // Call OCR service which has pydicom
      const response = await axios.post(
        `${OCR_SERVICE_URL}/api/ocr/process`,
        { file_path: filePath, device_type: 'dicom' },
        { timeout: OCR_SERVICE_TIMEOUT }
      );

      const data = response.data;

      if (data.extracted_info) {
        return {
          success: true,
          patientInfo: {
            firstName: data.extracted_info.first_name,
            lastName: data.extracted_info.last_name,
            patientId: data.extracted_info.patient_id,
            dateOfBirth: data.extracted_info.date_of_birth ? new Date(data.extracted_info.date_of_birth) : null,
            gender: data.extracted_info.gender,
            laterality: data.extracted_info.laterality
          },
          confidence: 0.95, // DICOM metadata is very reliable
          rawData: data
        };
      }

      return { success: false, confidence: 0 };
    } catch (error) {
      console.error('[UniversalProcessor] DICOM processing error:', error.message);
      return { success: false, confidence: 0, error: error.message };
    }
  }

  /**
   * Process file using device-specific adapter
   */
  async processWithAdapter(filePath, deviceType) {
    try {
      // Check if adapter exists for device type
      if (!AdapterFactory.hasAdapter(deviceType)) {
        return { success: false, confidence: 0 };
      }

      const adapter = AdapterFactory.getAdapterByType(deviceType);

      // Read file content
      const content = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase().slice(1);

      // Try to parse file
      let parsedData;
      try {
        parsedData = await adapter.parseFile(content, ext);
      } catch {
        // Adapter can't parse this file type
        return { success: false, confidence: 0 };
      }

      // Extract patient demographics if available
      const demographics = adapter.extractPatientDemographics(parsedData);

      if (demographics) {
        return {
          success: true,
          patientInfo: {
            firstName: demographics.firstName,
            lastName: demographics.lastName || demographics.name?.split(' ')[0],
            patientId: demographics.patientId,
            dateOfBirth: demographics.dateOfBirth ? new Date(demographics.dateOfBirth) : null
          },
          confidence: 0.85,
          rawData: parsedData
        };
      }

      return { success: false, confidence: 0 };
    } catch (error) {
      console.error('[UniversalProcessor] Adapter processing error:', error.message);
      return { success: false, confidence: 0, error: error.message };
    }
  }

  /**
   * Parse filename for patient information
   */
  parseFilename(fileName, deviceType = 'generic') {
    const baseName = path.basename(fileName, path.extname(fileName));
    const parser = FILENAME_PARSERS[deviceType] || FILENAME_PARSERS.generic;

    // Try device-specific parser first
    const match = baseName.match(parser.pattern);
    if (match) {
      const extracted = parser.extract(match);
      const laterality = extractLaterality(baseName);

      // Calculate confidence based on what we found
      let confidence = 0;
      if (extracted.lastName) confidence += 0.3;
      if (extracted.firstName) confidence += 0.2;
      if (extracted.patientId) confidence += 0.25;
      if (extracted.dateOfBirth) confidence += 0.25;

      return {
        success: confidence >= 0.3,
        patientInfo: {
          ...extracted,
          laterality
        },
        confidence
      };
    }

    // Try generic patterns
    const genericPatterns = [
      // LASTNAME_FIRSTNAME pattern
      { regex: /^([A-Z][A-Z]+)[_\s]([A-Z][a-z]+)/, groups: { lastName: 1, firstName: 2 } },
      // Firstname Lastname pattern
      { regex: /^([A-Z][a-z]+)[_\s]([A-Z][A-Z]+)/, groups: { firstName: 1, lastName: 2 } },
      // Just a name
      { regex: /^([A-Z][a-z]+)/, groups: { lastName: 1 } }
    ];

    for (const p of genericPatterns) {
      const m = baseName.match(p.regex);
      if (m) {
        const info = {};
        for (const [key, idx] of Object.entries(p.groups)) {
          info[key] = m[idx];
        }
        info.laterality = extractLaterality(baseName);

        return {
          success: true,
          patientInfo: info,
          confidence: info.firstName ? 0.5 : 0.3
        };
      }
    }

    // Extract from folder name as last resort
    const folderMatch = baseName.match(/([A-Za-z]+)/);
    if (folderMatch) {
      return {
        success: true,
        patientInfo: {
          fullName: folderMatch[1],
          laterality: extractLaterality(baseName)
        },
        confidence: 0.2
      };
    }

    return { success: false, patientInfo: null, confidence: 0 };
  }

  /**
   * Process file using OCR service
   */
  async processWithOCR(filePath, deviceType = 'generic') {
    try {
      const response = await axios.post(
        `${OCR_SERVICE_URL}/api/ocr/process`,
        {
          file_path: filePath,
          device_type: deviceType,
          extract_thumbnail: false
        },
        { timeout: OCR_SERVICE_TIMEOUT }
      );

      const data = response.data;

      if (data.error) {
        return { success: false, confidence: 0, error: data.error };
      }

      if (data.extracted_info) {
        return {
          success: true,
          patientInfo: {
            firstName: data.extracted_info.first_name,
            lastName: data.extracted_info.last_name,
            patientId: data.extracted_info.patient_id,
            dateOfBirth: data.extracted_info.date_of_birth ? new Date(data.extracted_info.date_of_birth) : null,
            gender: data.extracted_info.gender,
            laterality: data.extracted_info.laterality
          },
          confidence: data.ocr_confidence || 0.6,
          ocrText: data.ocr_text,
          rawData: data
        };
      }

      return { success: false, confidence: 0 };
    } catch (error) {
      // OCR service might not be running - this is OK
      if (error.code === 'ECONNREFUSED') {
        console.log('[UniversalProcessor] OCR service not available');
      } else {
        console.error('[UniversalProcessor] OCR processing error:', error.message);
      }
      return { success: false, confidence: 0, error: error.message };
    }
  }

  /**
   * Merge patient info from multiple sources
   */
  mergePatientInfo(primary, secondary) {
    if (!primary && !secondary) return null;
    if (!primary) return secondary;
    if (!secondary) return primary;

    return {
      firstName: primary.firstName || secondary.firstName,
      lastName: primary.lastName || secondary.lastName,
      patientId: primary.patientId || secondary.patientId,
      dateOfBirth: primary.dateOfBirth || secondary.dateOfBirth,
      gender: primary.gender || secondary.gender,
      laterality: primary.laterality || secondary.laterality,
      fullName: primary.fullName || secondary.fullName
    };
  }

  /**
   * Check if OCR service is available
   */
  async checkOCRService() {
    try {
      const response = await axios.get(`${OCR_SERVICE_URL}/health`, { timeout: 5000 });
      return {
        available: true,
        status: response.data.status,
        version: response.data.version
      };
    } catch {
      return { available: false };
    }
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalProcessed: 0,
      dicomSuccess: 0,
      adapterSuccess: 0,
      filenameSuccess: 0,
      ocrSuccess: 0,
      failed: 0
    };
  }
}

// Singleton instance
const universalFileProcessor = new UniversalFileProcessor();

module.exports = {
  universalFileProcessor,
  UniversalFileProcessor,
  FILE_CATEGORIES,
  DEVICE_PATTERNS,
  parseDate,
  extractLaterality
};
