/**
 * TonometryAdapter - Adapter for Tonometer devices
 *
 * Handles data from tonometer devices like:
 * - Goldmann Applanation Tonometer
 * - Non-contact (air-puff) tonometers
 * - Rebound tonometers (iCare, Tono-Pen)
 * - NIDEK NT-530P
 * - Reichert 7CR
 *
 * Processing includes:
 * - IOP (Intraocular Pressure) measurements
 * - Pachymetry-corrected IOP
 * - Multiple reading averaging
 * - Quality assessment
 */

const BaseAdapter = require('./BaseAdapter');

class TonometryAdapter extends BaseAdapter {
  constructor(device) {
    super(device);
    this.measurementType = 'IOP';
  }

  /**
   * Process tonometry data from device
   *
   * @param {Object} data - Raw tonometry data
   * @param {String} patientId - Patient ID
   * @param {String} examId - Exam ID (optional)
   * @returns {Promise<Object>} - Processing result
   */
  async process(data, patientId, examId = null) {
    try {
      // Step 1: Validate data
      const validation = await this.validate(data);
      if (!validation.isValid) {
        return this.handleError(
          new Error(`Validation failed: ${JSON.stringify(validation.errors)}`),
          'validation'
        );
      }

      // Step 2: Transform data to standard format
      const transformed = await this.transform(data);

      // Step 3: Save measurement data
      const measurement = await this.save(transformed, patientId, examId);

      // Step 4: Log successful processing
      await this.logEvent('MEASUREMENT_IMPORT', 'SUCCESS', {
        integrationMethod: data.source || 'folder-sync',
        initiatedBy: 'DEVICE',
        processing: {
          recordsProcessed: 1,
          measurementsCreated: 1
        },
        createdRecords: {
          deviceMeasurements: [measurement._id],
          count: 1
        }
      });

      return this.createSuccessResponse({
        measurementId: measurement._id,
        message: 'Tonometry data processed successfully'
      });

    } catch (error) {
      // Log failure
      await this.logEvent('MEASUREMENT_IMPORT', 'FAILED', {
        integrationMethod: data.source || 'folder-sync',
        initiatedBy: 'DEVICE',
        errorDetails: {
          code: error.code || 'TONOMETRY_PROCESSING_ERROR',
          message: error.message,
          severity: 'MEDIUM'
        }
      });

      return this.handleError(error, 'Tonometry processing');
    }
  }

  /**
   * Validate tonometry data
   */
  async validate(data) {
    const requiredFields = [];
    const commonValidation = this.validateCommonFields(data, requiredFields);

    if (!commonValidation.isValid) {
      return commonValidation;
    }

    const errors = [...commonValidation.errors];

    // Validate IOP values for both eyes
    if (data.OD && data.OD.iop !== undefined) {
      const odError = this.validateRange(data.OD.iop, 5, 60, 'OD.iop');
      if (odError) errors.push(odError);
    }

    if (data.OS && data.OS.iop !== undefined) {
      const osError = this.validateRange(data.OS.iop, 5, 60, 'OS.iop');
      if (osError) errors.push(osError);
    }

    // Validate pachymetry values if present
    if (data.OD && data.OD.pachymetry !== undefined) {
      const pachError = this.validateRange(data.OD.pachymetry, 400, 700, 'OD.pachymetry');
      if (pachError) errors.push(pachError);
    }

    if (data.OS && data.OS.pachymetry !== undefined) {
      const pachError = this.validateRange(data.OS.pachymetry, 400, 700, 'OS.pachymetry');
      if (pachError) errors.push(pachError);
    }

    // Validate method
    if (data.method) {
      const validMethods = ['applanation', 'non-contact', 'rebound', 'dynamic-contour', 'other'];
      if (!validMethods.includes(data.method.toLowerCase())) {
        errors.push({
          field: 'method',
          message: `Method must be one of: ${validMethods.join(', ')}`,
          code: 'INVALID_METHOD',
          value: data.method
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Transform tonometry data to standard format
   */
  async transform(data) {
    const transformed = {
      measurementType: 'IOP',
      measurementDate: data.measurementDate || data.capturedAt || new Date(),
      eye: this.determineEye(data),
      tonometry: {
        OD: this.transformEyeData(data.OD, data),
        OS: this.transformEyeData(data.OS, data)
      },
      quality: {
        overall: this.calculateQualityScore(data),
        factors: this.calculateQualityFactors(data)
      },
      source: data.source || 'device',
      rawData: {
        format: 'json',
        data: data
      }
    };

    return transformed;
  }

  /**
   * Transform data for one eye
   */
  transformEyeData(eyeData, globalData) {
    if (!eyeData) return {};

    const result = {
      iop: eyeData.iop,
      method: eyeData.method || globalData.method || 'unknown',
      time: eyeData.time || globalData.time || new Date().toISOString(),
      readings: eyeData.readings || (eyeData.iop ? [eyeData.iop] : [])
    };

    // Add pachymetry if available
    if (eyeData.pachymetry) {
      result.pachymetry = eyeData.pachymetry;
      result.correctedIOP = this.calculateCorrectedIOP(eyeData.iop, eyeData.pachymetry);
      result.correctionFactor = this.calculateCorrectionFactor(eyeData.pachymetry);
    }

    return result;
  }

  /**
   * Determine which eye(s) were measured
   */
  determineEye(data) {
    const hasOD = data.OD && data.OD.iop !== undefined;
    const hasOS = data.OS && data.OS.iop !== undefined;

    if (hasOD && hasOS) return 'OU';
    if (hasOD) return 'OD';
    if (hasOS) return 'OS';
    return 'OU';
  }

  /**
   * Calculate pachymetry-corrected IOP
   * Using simplified correction formula
   */
  calculateCorrectedIOP(iop, pachymetry) {
    if (!iop || !pachymetry) return iop;

    // Simplified correction: For every 50 μm above/below 540 μm,
    // adjust IOP by ~2.5 mmHg
    const referenceThickness = 540;
    const thicknessDiff = pachymetry - referenceThickness;
    const correction = (thicknessDiff / 50) * 2.5;

    return Math.round((iop - correction) * 10) / 10; // Round to 1 decimal
  }

  /**
   * Calculate correction factor
   */
  calculateCorrectionFactor(pachymetry) {
    if (!pachymetry) return 1.0;

    const referenceThickness = 540;
    const thicknessDiff = pachymetry - referenceThickness;

    // Correction factor: ~5% per 50 μm
    return 1.0 - (thicknessDiff / 50) * 0.05;
  }

  /**
   * Calculate quality factors
   */
  calculateQualityFactors(data) {
    const factors = [];

    // Check if multiple readings were taken
    const odReadings = data.OD?.readings || [];
    const osReadings = data.OS?.readings || [];

    if (odReadings.length > 1) {
      const variance = this.calculateVariance(odReadings);
      factors.push({
        name: 'OD Reading Consistency',
        value: variance < 2 ? 100 : variance < 3 ? 80 : 60,
        acceptable: variance < 3,
        threshold: 3
      });
    }

    if (osReadings.length > 1) {
      const variance = this.calculateVariance(osReadings);
      factors.push({
        name: 'OS Reading Consistency',
        value: variance < 2 ? 100 : variance < 3 ? 80 : 60,
        acceptable: variance < 3,
        threshold: 3
      });
    }

    // Check measurement method reliability
    const method = data.method || data.OD?.method || data.OS?.method;
    if (method) {
      const reliability = this.getMethodReliability(method);
      factors.push({
        name: 'Measurement Method',
        value: reliability,
        acceptable: reliability >= 70,
        threshold: 70
      });
    }

    return factors;
  }

  /**
   * Calculate variance of multiple readings
   */
  calculateVariance(readings) {
    if (readings.length < 2) return 0;

    const mean = readings.reduce((sum, val) => sum + val, 0) / readings.length;
    const squaredDiffs = readings.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / readings.length;

    return Math.sqrt(variance); // Return standard deviation
  }

  /**
   * Get reliability score for measurement method
   */
  getMethodReliability(method) {
    const reliabilityScores = {
      'applanation': 95,
      'dynamic-contour': 90,
      'rebound': 85,
      'non-contact': 75,
      'other': 50
    };

    return reliabilityScores[method.toLowerCase()] || 50;
  }

  /**
   * Calculate overall quality score
   */
  calculateQualityScore(data) {
    let score = 100;

    // Check for multiple readings (good practice)
    const odReadings = data.OD?.readings || [];
    const osReadings = data.OS?.readings || [];

    if (odReadings.length === 1 && osReadings.length === 1) {
      score -= 10; // Prefer multiple readings
    }

    // Check reading consistency
    if (odReadings.length > 1) {
      const variance = this.calculateVariance(odReadings);
      if (variance > 3) score -= 15;
      else if (variance > 2) score -= 5;
    }

    if (osReadings.length > 1) {
      const variance = this.calculateVariance(osReadings);
      if (variance > 3) score -= 15;
      else if (variance > 2) score -= 5;
    }

    // Check if pachymetry correction was applied
    if (!data.OD?.pachymetry && !data.OS?.pachymetry) {
      score -= 10; // Prefer pachymetry-corrected readings
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Parse CSV format (common for tonometer exports)
   */
  parseCSV(content) {
    const rows = super.parseCSV(content);

    // Transform CSV rows to tonometry data format
    return rows.map(row => {
      const data = {
        measurementDate: new Date(row.Date || row.date || row.Time || row.time),
        method: (row.Method || row.method || 'unknown').toLowerCase(),
        source: 'folder-sync'
      };

      // Parse OD data
      if (row['OD IOP'] || row.OD_IOP || row.IOP_OD) {
        data.OD = {
          iop: parseFloat(row['OD IOP'] || row.OD_IOP || row.IOP_OD),
          method: data.method,
          time: row.Time || row.time || new Date().toISOString()
        };

        if (row['OD Pachymetry'] || row.OD_Pachymetry) {
          data.OD.pachymetry = parseFloat(row['OD Pachymetry'] || row.OD_Pachymetry);
        }

        // Parse multiple readings if available
        const readings = [];
        for (let i = 1; i <= 3; i++) {
          const reading = row[`OD Reading ${i}`] || row[`OD_R${i}`];
          if (reading) readings.push(parseFloat(reading));
        }
        if (readings.length > 0) {
          data.OD.readings = readings;
        }
      }

      // Parse OS data
      if (row['OS IOP'] || row.OS_IOP || row.IOP_OS) {
        data.OS = {
          iop: parseFloat(row['OS IOP'] || row.OS_IOP || row.IOP_OS),
          method: data.method,
          time: row.Time || row.time || new Date().toISOString()
        };

        if (row['OS Pachymetry'] || row.OS_Pachymetry) {
          data.OS.pachymetry = parseFloat(row['OS Pachymetry'] || row.OS_Pachymetry);
        }

        // Parse multiple readings if available
        const readings = [];
        for (let i = 1; i <= 3; i++) {
          const reading = row[`OS Reading ${i}`] || row[`OS_R${i}`];
          if (reading) readings.push(parseFloat(reading));
        }
        if (readings.length > 0) {
          data.OS.readings = readings;
        }
      }

      return data;
    });
  }

  /**
   * Parse TXT format (some tonometers export to text files)
   */
  parseTXT(content) {
    if (Buffer.isBuffer(content)) {
      content = content.toString('utf-8');
    }

    const lines = content.split('\n').filter(line => line.trim());
    const data = {
      source: 'folder-sync'
    };

    // Simple parser for key-value pairs
    for (const line of lines) {
      const [key, value] = line.split(':').map(s => s.trim());

      if (key.includes('Date') || key.includes('Time')) {
        data.measurementDate = new Date(value);
      } else if (key.includes('Method')) {
        data.method = value.toLowerCase();
      } else if (key.includes('OD IOP') || key.includes('Right IOP')) {
        data.OD = { iop: parseFloat(value), method: data.method };
      } else if (key.includes('OS IOP') || key.includes('Left IOP')) {
        data.OS = { iop: parseFloat(value), method: data.method };
      } else if (key.includes('OD Pachy') || key.includes('Right CCT')) {
        if (!data.OD) data.OD = {};
        data.OD.pachymetry = parseFloat(value);
      } else if (key.includes('OS Pachy') || key.includes('Left CCT')) {
        if (!data.OS) data.OS = {};
        data.OS.pachymetry = parseFloat(value);
      }
    }

    return [data]; // Return array for consistency with CSV parser
  }
}

module.exports = TonometryAdapter;
