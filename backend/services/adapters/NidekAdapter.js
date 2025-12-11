/**
 * NidekAdapter - Adapter for NIDEK ophthalmic devices
 *
 * Handles data from NIDEK devices:
 * - NIDEK ARK series (Auto Ref/Keratometer)
 * - NIDEK OPD-Scan III (Wavefront)
 * - NIDEK AL-Scan (Biometer)
 * - NIDEK RS-3000 (OCT)
 * - NIDEK CEM-530 (Specular Microscope)
 * - NIDEK NT-530 (Tonometer)
 *
 * Supports:
 * - NIDEK XML export format
 * - CSV export format
 * - Proprietary text format
 */

const BaseAdapter = require('./BaseAdapter');
const xml2js = require('xml2js');

class NidekAdapter extends BaseAdapter {
  constructor(device) {
    super(device);
    this.measurementType = this.detectMeasurementType(device);
  }

  /**
   * Detect measurement type based on device model
   */
  detectMeasurementType(device) {
    const model = (device.model || '').toLowerCase();

    if (model.includes('ark') || model.includes('ref')) {
      return 'auto-refraction';
    } else if (model.includes('opd') || model.includes('wavefront')) {
      return 'wavefront';
    } else if (model.includes('al-scan') || model.includes('biometer')) {
      return 'biometry';
    } else if (model.includes('rs-') || model.includes('oct')) {
      return 'OCT';
    } else if (model.includes('cem') || model.includes('specular')) {
      return 'specular-microscopy';
    } else if (model.includes('nt-') || model.includes('tonometer')) {
      return 'tonometry';
    }

    return 'auto-refraction'; // Default for NIDEK
  }

  /**
   * Process NIDEK device data
   *
   * @param {Object} data - Raw NIDEK data
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
      await this.logEvent('MEASUREMENT_UPLOAD', 'SUCCESS', {
        integrationMethod: data.source || 'folder-sync',
        initiatedBy: 'DEVICE',
        processing: {
          recordsProcessed: 1,
          deviceType: 'NIDEK',
          measurementType: this.measurementType
        },
        createdRecords: {
          deviceMeasurements: [measurement._id],
          count: 1
        }
      });

      return this.createSuccessResponse({
        measurementId: measurement._id,
        measurementType: this.measurementType,
        message: 'NIDEK data processed successfully'
      });

    } catch (error) {
      await this.logEvent('MEASUREMENT_UPLOAD', 'FAILED', {
        integrationMethod: data.source || 'folder-sync',
        initiatedBy: 'DEVICE',
        errorDetails: {
          code: error.code || 'NIDEK_PROCESSING_ERROR',
          message: error.message,
          severity: 'HIGH'
        }
      });

      return this.handleError(error, 'NIDEK processing');
    }
  }

  /**
   * Validate NIDEK data
   */
  async validate(data) {
    const requiredFields = ['eye'];
    const commonValidation = this.validateCommonFields(data, requiredFields);

    if (!commonValidation.isValid) {
      return commonValidation;
    }

    const errors = [...commonValidation.errors];

    // Validate based on measurement type
    switch (this.measurementType) {
      case 'auto-refraction':
        if (data.sphere !== undefined) {
          const sphereError = this.validateRange(data.sphere, -30, 30, 'sphere');
          if (sphereError) errors.push(sphereError);
        }
        if (data.cylinder !== undefined) {
          const cylError = this.validateRange(data.cylinder, -15, 15, 'cylinder');
          if (cylError) errors.push(cylError);
        }
        break;

      case 'biometry':
        if (data.axialLength !== undefined) {
          const alError = this.validateRange(data.axialLength, 18, 38, 'axialLength');
          if (alError) errors.push(alError);
        }
        break;

      case 'tonometry':
        if (data.iop !== undefined) {
          const iopError = this.validateRange(data.iop, 5, 70, 'iop');
          if (iopError) errors.push(iopError);
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Transform NIDEK data to standard format
   */
  async transform(data) {
    const transformed = {
      measurementType: this.measurementType,
      measurementDate: data.capturedAt || data.examDate || new Date(),
      eye: data.eye,
      quality: {
        overall: this.calculateQualityScore(data),
        factors: this.calculateQualityFactors(data),
        acceptable: this.isQualityAcceptable(data)
      },
      source: data.source || 'device',
      rawData: {
        format: data.format || 'nidek-xml',
        data: data
      }
    };

    // Transform based on measurement type
    switch (this.measurementType) {
      case 'auto-refraction':
        transformed.autoRefraction = {
          [data.eye]: {
            sphere: data.sphere,
            cylinder: data.cylinder,
            axis: data.axis,
            va: data.va,
            confidence: data.confidence,
            pupilSize: data.pupilSize,
            vertexDistance: data.vertexDistance || 12
          }
        };
        // Also store keratometry if present
        if (data.k1 || data.k2) {
          transformed.keratometry = {
            [data.eye]: {
              k1: { power: data.k1, axis: data.k1Axis },
              k2: { power: data.k2, axis: data.k2Axis },
              average: data.k1 && data.k2 ? (data.k1 + data.k2) / 2 : null,
              cylinder: data.k1 && data.k2 ? Math.abs(data.k1 - data.k2) : null
            }
          };
        }
        break;

      case 'biometry':
        transformed.biometry = {
          [data.eye]: {
            axialLength: data.axialLength,
            kReadings: {
              k1: data.k1,
              k2: data.k2,
              average: data.k1 && data.k2 ? (data.k1 + data.k2) / 2 : null
            },
            acd: data.acd,
            lensThickness: data.lensThickness,
            whiteToWhite: data.wtw,
            pupilSize: data.pupilSize,
            iolCalculations: data.iolCalculations || []
          }
        };
        break;

      case 'tonometry':
        transformed.tonometry = {
          [data.eye]: {
            iop: data.iop,
            method: data.method || 'non-contact',
            time: data.time,
            readings: data.readings || [data.iop],
            pachymetry: data.pachymetry
          }
        };
        break;

      case 'specular-microscopy':
        transformed.specularMicroscopy = {
          [data.eye]: {
            endothelialCellDensity: data.ecd || data.cellDensity,
            coefficientOfVariation: data.cv,
            hexagonality: data.hexagonality,
            centralCornealThickness: data.cct,
            cellCount: data.cellCount
          }
        };
        break;

      case 'OCT':
        transformed.oct = {
          [data.eye]: {
            rnfl: data.rnfl,
            macula: data.macula,
            opticDisc: data.opticDisc,
            quality: data.signalStrength,
            signalStrength: data.signalStrength
          }
        };
        break;
    }

    return transformed;
  }

  /**
   * Parse NIDEK XML format
   */
  async parseXML(content) {
    if (Buffer.isBuffer(content)) {
      content = content.toString('utf-8');
    }

    try {
      // Use xml2js for proper XML parsing
      const parser = new xml2js.Parser({
        explicitArray: false,
        ignoreAttrs: false,
        mergeAttrs: true
      });

      const result = await parser.parseStringPromise(content);

      // Handle different NIDEK XML structures
      return this.normalizeNidekXML(result);
    } catch (error) {
      // Fallback to regex-based parsing
      return this.parseXMLFallback(content);
    }
  }

  /**
   * Normalize NIDEK XML structure to standard format
   */
  normalizeNidekXML(xmlData) {
    const data = {};

    // Try to find common NIDEK XML structures
    const root = xmlData.NIDEK || xmlData.Export || xmlData.Data || xmlData;

    // Patient info
    if (root.Patient) {
      data.patientName = root.Patient.Name || root.Patient.PatientName;
      data.patientId = root.Patient.ID || root.Patient.PatientID;
      data.dateOfBirth = root.Patient.DOB || root.Patient.BirthDate;
    }

    // Exam info
    const exam = root.Exam || root.Measurement || root.Result || root;

    // Eye
    data.eye = exam.Eye || exam.Laterality || this.extractEye(exam);

    // Date
    data.capturedAt = exam.Date || exam.ExamDate || exam.DateTime;
    if (data.capturedAt) {
      data.capturedAt = new Date(data.capturedAt);
    }

    // Measurement data based on type
    if (this.measurementType === 'auto-refraction') {
      // Refraction data
      const ref = exam.Refraction || exam.AR || exam;
      data.sphere = parseFloat(ref.Sphere || ref.SPH || ref.S);
      data.cylinder = parseFloat(ref.Cylinder || ref.CYL || ref.C);
      data.axis = parseFloat(ref.Axis || ref.AX || ref.A);
      data.va = ref.VA || ref.VisualAcuity;
      data.pupilSize = parseFloat(ref.PupilSize || ref.Pupil || ref.PD);

      // Keratometry data
      const kerat = exam.Keratometry || exam.K || exam;
      data.k1 = parseFloat(kerat.K1 || kerat.FlatK);
      data.k2 = parseFloat(kerat.K2 || kerat.SteepK);
      data.k1Axis = parseFloat(kerat.K1Axis || kerat.FlatAxis);
      data.k2Axis = parseFloat(kerat.K2Axis || kerat.SteepAxis);
    }

    if (this.measurementType === 'biometry') {
      const bio = exam.Biometry || exam.ALScan || exam;
      data.axialLength = parseFloat(bio.AxialLength || bio.AL);
      data.k1 = parseFloat(bio.K1 || bio.FlatK);
      data.k2 = parseFloat(bio.K2 || bio.SteepK);
      data.acd = parseFloat(bio.ACD || bio.AnteriorChamber);
      data.lensThickness = parseFloat(bio.LT || bio.LensThickness);
      data.wtw = parseFloat(bio.WTW || bio.WhiteToWhite);
    }

    if (this.measurementType === 'tonometry') {
      const ton = exam.Tonometry || exam.IOP || exam;
      data.iop = parseFloat(ton.IOP || ton.Pressure);
      data.readings = [];
      if (ton.Reading1) data.readings.push(parseFloat(ton.Reading1));
      if (ton.Reading2) data.readings.push(parseFloat(ton.Reading2));
      if (ton.Reading3) data.readings.push(parseFloat(ton.Reading3));
    }

    return data;
  }

  /**
   * Fallback XML parsing using regex
   */
  parseXMLFallback(content) {
    const data = {};

    const extractValue = (tag) => {
      const regex = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i');
      const match = content.match(regex);
      return match ? match[1].trim() : null;
    };

    // Extract common fields
    data.eye = extractValue('Eye') || extractValue('Laterality');
    data.capturedAt = extractValue('Date') || extractValue('ExamDate');

    // Refraction
    data.sphere = parseFloat(extractValue('Sphere') || extractValue('SPH'));
    data.cylinder = parseFloat(extractValue('Cylinder') || extractValue('CYL'));
    data.axis = parseFloat(extractValue('Axis') || extractValue('AX'));

    // Keratometry
    data.k1 = parseFloat(extractValue('K1') || extractValue('FlatK'));
    data.k2 = parseFloat(extractValue('K2') || extractValue('SteepK'));

    // Biometry
    data.axialLength = parseFloat(extractValue('AxialLength') || extractValue('AL'));
    data.acd = parseFloat(extractValue('ACD'));

    // Tonometry
    data.iop = parseFloat(extractValue('IOP') || extractValue('Pressure'));

    return data;
  }

  /**
   * Extract eye from various field names
   */
  extractEye(data) {
    // Check for OD/OS specific data
    if (data.OD || data.od || data.Right || data.right) return 'OD';
    if (data.OS || data.os || data.Left || data.left) return 'OS';
    if (data.OU || data.ou || data.Both || data.both) return 'OU';
    return 'OD'; // Default
  }

  /**
   * Parse CSV format
   */
  parseCSV(content) {
    const rows = super.parseCSV(content);

    return rows.map(row => {
      const data = {
        eye: row.Eye || row.eye || row.EYE,
        capturedAt: new Date(row.Date || row.date || row.ExamDate)
      };

      // Map based on measurement type
      switch (this.measurementType) {
        case 'auto-refraction':
          data.sphere = parseFloat(row.SPH || row.Sphere || row.S);
          data.cylinder = parseFloat(row.CYL || row.Cylinder || row.C);
          data.axis = parseFloat(row.AX || row.Axis || row.A);
          data.k1 = parseFloat(row.K1 || row.FlatK);
          data.k2 = parseFloat(row.K2 || row.SteepK);
          break;

        case 'biometry':
          data.axialLength = parseFloat(row.AL || row.AxialLength);
          data.k1 = parseFloat(row.K1);
          data.k2 = parseFloat(row.K2);
          data.acd = parseFloat(row.ACD);
          data.lensThickness = parseFloat(row.LT);
          data.wtw = parseFloat(row.WTW);
          break;

        case 'tonometry':
          data.iop = parseFloat(row.IOP || row.Pressure);
          break;

        case 'specular-microscopy':
          data.ecd = parseFloat(row.ECD || row.CD);
          data.cv = parseFloat(row.CV);
          data.hexagonality = parseFloat(row.HEX);
          data.cct = parseFloat(row.CCT);
          break;
      }

      return data;
    });
  }

  /**
   * Parse proprietary TXT format
   */
  parseTXT(content) {
    if (Buffer.isBuffer(content)) {
      content = content.toString('utf-8');
    }

    const lines = content.split('\n');
    const data = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;

      // Handle various NIDEK text formats
      let key, value;

      if (trimmed.includes(':')) {
        [key, value] = trimmed.split(':').map(s => s.trim());
      } else if (trimmed.includes('=')) {
        [key, value] = trimmed.split('=').map(s => s.trim());
      } else if (trimmed.includes('\t')) {
        [key, value] = trimmed.split('\t').map(s => s.trim());
      }

      if (key && value) {
        const normalizedKey = this.normalizeFieldName(key);
        data[normalizedKey] = isNaN(value) ? value : parseFloat(value);
      }
    }

    return data;
  }

  /**
   * Normalize field name to standard format
   */
  normalizeFieldName(name) {
    const fieldMap = {
      'Sphere': 'sphere', 'SPH': 'sphere', 'S': 'sphere',
      'Cylinder': 'cylinder', 'CYL': 'cylinder', 'C': 'cylinder',
      'Axis': 'axis', 'AX': 'axis', 'A': 'axis',
      'K1': 'k1', 'Flat K': 'k1', 'FlatK': 'k1',
      'K2': 'k2', 'Steep K': 'k2', 'SteepK': 'k2',
      'Axial Length': 'axialLength', 'AL': 'axialLength',
      'ACD': 'acd', 'Anterior Chamber': 'acd',
      'IOP': 'iop', 'Pressure': 'iop',
      'ECD': 'ecd', 'Cell Density': 'ecd',
      'Eye': 'eye', 'Laterality': 'eye',
      'Date': 'capturedAt', 'Exam Date': 'capturedAt'
    };

    return fieldMap[name] || name.toLowerCase().replace(/\s+/g, '');
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(data) {
    let score = 100;

    // Confidence indicator (if available)
    if (data.confidence !== undefined) {
      score = Math.min(score, data.confidence);
    }

    // Reliability indicator
    if (data.reliability !== undefined) {
      score = Math.min(score, data.reliability);
    }

    // Multiple readings consistency
    if (data.readings && data.readings.length >= 3) {
      const std = this.calculateStdDev(data.readings);
      const mean = data.readings.reduce((a, b) => a + b, 0) / data.readings.length;
      const cvPercent = (std / mean) * 100;
      if (cvPercent > 10) score -= 20;
      else if (cvPercent > 5) score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate standard deviation
   */
  calculateStdDev(values) {
    if (!values || values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  /**
   * Calculate quality factors
   */
  calculateQualityFactors(data) {
    const factors = [];

    if (data.confidence !== undefined) {
      factors.push({
        name: 'Measurement Confidence',
        value: data.confidence,
        acceptable: data.confidence >= 70,
        threshold: 70
      });
    }

    if (data.signalStrength !== undefined) {
      factors.push({
        name: 'Signal Strength',
        value: data.signalStrength,
        acceptable: data.signalStrength >= 6,
        threshold: 6
      });
    }

    return factors;
  }

  /**
   * Check if quality is acceptable
   */
  isQualityAcceptable(data) {
    if (data.confidence !== undefined && data.confidence < 50) return false;
    if (data.signalStrength !== undefined && data.signalStrength < 4) return false;
    return true;
  }
}

module.exports = NidekAdapter;
