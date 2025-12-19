/**
 * SpecularMicroscopeAdapter - Adapter for Specular Microscope devices
 *
 * Handles data from specular microscope devices for endothelial cell analysis:
 * - Topcon SP-3000P
 * - NIDEK CEM-530
 * - Konan CellChek
 * - Tomey EM-4000
 *
 * Measurements include:
 * - Endothelial Cell Density (ECD) - cells/mm²
 * - Coefficient of Variation (CV%)
 * - Hexagonality (HEX%)
 * - Average Cell Area
 * - Central Corneal Thickness (CCT)
 * - Cell Size Distribution
 */

const BaseAdapter = require('./BaseAdapter');

const { createContextLogger } = require('../../utils/structuredLogger');
const log = createContextLogger('SpecularMicroscopeAdapter');

class SpecularMicroscopeAdapter extends BaseAdapter {
  constructor(device) {
    super(device);
    this.measurementType = 'specular-microscopy';
  }

  /**
   * Process specular microscopy data from device
   *
   * @param {Object} data - Raw specular microscopy data
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

      // Step 4: Process and store image if present
      let deviceImage = null;
      if (data.imageFile || data.imagePath) {
        deviceImage = await this.processSpecularImage(
          data.imageFile || data.imagePath,
          data,
          patientId,
          examId,
          measurement._id
        );
      }

      // Step 5: Log successful processing
      await this.logEvent('MEASUREMENT_UPLOAD', 'SUCCESS', {
        integrationMethod: data.source || 'folder-sync',
        initiatedBy: 'DEVICE',
        processing: {
          recordsProcessed: 1,
          imagesUploaded: deviceImage ? 1 : 0
        },
        createdRecords: {
          deviceMeasurements: [measurement._id],
          deviceImages: deviceImage ? [deviceImage._id] : [],
          count: deviceImage ? 2 : 1
        }
      });

      return this.createSuccessResponse({
        measurementId: measurement._id,
        imageId: deviceImage?._id,
        message: 'Specular microscopy data processed successfully'
      });

    } catch (error) {
      // Log failure
      await this.logEvent('MEASUREMENT_UPLOAD', 'FAILED', {
        integrationMethod: data.source || 'folder-sync',
        initiatedBy: 'DEVICE',
        errorDetails: {
          code: error.code || 'SPECULAR_PROCESSING_ERROR',
          message: error.message,
          severity: 'HIGH'
        }
      });

      return this.handleError(error, 'Specular microscopy processing');
    }
  }

  /**
   * Validate specular microscopy data
   */
  async validate(data) {
    const requiredFields = ['eye'];
    const commonValidation = this.validateCommonFields(data, requiredFields);

    if (!commonValidation.isValid) {
      return commonValidation;
    }

    const errors = [...commonValidation.errors];

    // Validate ECD (endothelial cell density)
    if (data.ecd !== undefined) {
      const ecdError = this.validateRange(data.ecd, 500, 4000, 'ecd');
      if (ecdError) errors.push(ecdError);
    }

    // Validate CV (coefficient of variation)
    if (data.cv !== undefined) {
      const cvError = this.validateRange(data.cv, 0, 100, 'cv');
      if (cvError) errors.push(cvError);
    }

    // Validate hexagonality
    if (data.hexagonality !== undefined) {
      const hexError = this.validateRange(data.hexagonality, 0, 100, 'hexagonality');
      if (hexError) errors.push(hexError);
    }

    // Validate CCT (central corneal thickness)
    if (data.cct !== undefined) {
      const cctError = this.validateRange(data.cct, 400, 700, 'cct');
      if (cctError) errors.push(cctError);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Transform specular microscopy data to standard format
   */
  async transform(data) {
    const eyeData = {
      endothelialCellDensity: data.ecd || data.cellDensity || data.endothelialCellDensity,
      coefficientOfVariation: data.cv || data.coefficientOfVariation,
      hexagonality: data.hexagonality || data.hex || data.hexPercent,
      averageCellArea: data.avgCellArea || data.averageCellArea || this.calculateAvgCellArea(data.ecd),
      centralCornealThickness: data.cct || data.pachymetry || data.centralCornealThickness,
      // Cell size distribution
      cellSizeDistribution: data.cellSizeDistribution || null,
      // Additional metrics
      standardDeviation: data.sd || data.standardDeviation,
      minCellArea: data.minCellArea,
      maxCellArea: data.maxCellArea,
      cellCount: data.cellCount || data.analyzedCells,
      // Quality indicators
      imageQuality: data.imageQuality || data.quality,
      analyzedArea: data.analyzedArea
    };

    const transformed = {
      measurementType: 'specular-microscopy',
      measurementDate: data.capturedAt || data.measurementDate || new Date(),
      eye: data.eye,
      // Store in specular section
      specularMicroscopy: {
        [data.eye]: eyeData
      },
      quality: {
        overall: this.calculateQualityScore(data),
        factors: this.calculateQualityFactors(data),
        acceptable: this.isQualityAcceptable(data)
      },
      interpretation: {
        automatic: this.generateAutoInterpretation(eyeData),
        findings: this.generateFindings(eyeData)
      },
      source: data.source || 'device',
      rawData: {
        format: data.format || 'json',
        data: data
      }
    };

    return transformed;
  }

  /**
   * Calculate average cell area from ECD
   * @param {Number} ecd - Endothelial cell density
   * @returns {Number} - Average cell area in μm²
   */
  calculateAvgCellArea(ecd) {
    if (!ecd || ecd <= 0) return null;
    // Cell area = 1,000,000 / ECD (converting mm² to μm²)
    return Math.round(1000000 / ecd);
  }

  /**
   * Calculate quality score based on device-specific metrics
   */
  calculateQualityScore(data) {
    let score = 100;

    // Image quality impact
    if (data.imageQuality !== undefined) {
      score = Math.min(score, data.imageQuality);
    }

    // Cell count impact (need at least 50 cells for reliable analysis)
    if (data.cellCount !== undefined) {
      if (data.cellCount < 50) {
        score -= 30;
      } else if (data.cellCount < 75) {
        score -= 15;
      }
    }

    // Focus quality
    if (data.focusQuality !== undefined) {
      score = Math.min(score, data.focusQuality);
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate quality factors
   */
  calculateQualityFactors(data) {
    const factors = [];

    if (data.imageQuality !== undefined) {
      factors.push({
        name: 'Image Quality',
        value: data.imageQuality,
        acceptable: data.imageQuality >= 60,
        threshold: 60
      });
    }

    if (data.cellCount !== undefined) {
      factors.push({
        name: 'Cell Count',
        value: data.cellCount,
        acceptable: data.cellCount >= 50,
        threshold: 50
      });
    }

    if (data.focusQuality !== undefined) {
      factors.push({
        name: 'Focus Quality',
        value: data.focusQuality,
        acceptable: data.focusQuality >= 70,
        threshold: 70
      });
    }

    return factors;
  }

  /**
   * Check if quality is acceptable
   */
  isQualityAcceptable(data) {
    if (data.imageQuality !== undefined && data.imageQuality < 50) return false;
    if (data.cellCount !== undefined && data.cellCount < 30) return false;
    return true;
  }

  /**
   * Generate automatic interpretation based on ECD values
   */
  generateAutoInterpretation(eyeData) {
    const ecd = eyeData.endothelialCellDensity;
    if (!ecd) return 'Insufficient data for interpretation';

    if (ecd >= 2500) {
      return 'Normal endothelial cell density';
    } else if (ecd >= 2000) {
      return 'Mildly reduced endothelial cell density';
    } else if (ecd >= 1500) {
      return 'Moderately reduced endothelial cell density - monitor closely';
    } else if (ecd >= 1000) {
      return 'Significantly reduced endothelial cell density - surgical risk increased';
    } else if (ecd >= 500) {
      return 'Severely reduced endothelial cell density - high surgical risk';
    } else {
      return 'Critically low endothelial cell density - corneal decompensation risk';
    }
  }

  /**
   * Generate clinical findings
   */
  generateFindings(eyeData) {
    const findings = [];
    const ecd = eyeData.endothelialCellDensity;
    const cv = eyeData.coefficientOfVariation;
    const hex = eyeData.hexagonality;

    // ECD findings
    if (ecd) {
      if (ecd < 1500) {
        findings.push('Low endothelial cell count - pre-operative evaluation recommended');
      }
      if (ecd < 1000) {
        findings.push('Very low cell count - consider corneal specialist referral');
      }
    }

    // CV findings (polymegathism)
    if (cv) {
      if (cv > 40) {
        findings.push('High CV indicating polymegathism (variable cell size)');
      } else if (cv > 30) {
        findings.push('Moderate polymegathism present');
      }
    }

    // Hexagonality findings (pleomorphism)
    if (hex) {
      if (hex < 50) {
        findings.push('Low hexagonality indicating pleomorphism (abnormal cell shape)');
      } else if (hex < 60) {
        findings.push('Moderate pleomorphism present');
      }
    }

    return findings;
  }

  /**
   * Process specular microscopy image
   */
  async processSpecularImage(imageData, metadata, patientId, examId, measurementId) {
    try {
      const path = require('path');
      const fs = require('fs').promises;

      // Generate unique filename
      const fileName = `specular_${Date.now()}_${metadata.eye}.jpg`;
      const filePath = path.join(
        process.env.UPLOAD_PATH || '/tmp/uploads',
        'specular',
        fileName
      );

      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // If imageData is a path, copy the file; if buffer, write it
      if (typeof imageData === 'string') {
        await fs.copyFile(imageData, filePath);
      } else {
        await fs.writeFile(filePath, imageData);
      }

      // Create DeviceImage record
      const deviceImage = await this.storeImage({
        imageType: 'specular-microscopy',
        eye: metadata.eye,
        capturedAt: metadata.capturedAt || new Date(),
        file: {
          originalName: metadata.fileName || fileName,
          fileName: fileName,
          path: filePath,
          mimeType: 'image/jpeg',
          format: 'JPEG'
        },
        quality: {
          overall: this.calculateQualityScore(metadata),
          factors: this.calculateQualityFactors(metadata),
          acceptable: this.isQualityAcceptable(metadata)
        },
        processing: {
          status: 'completed',
          uploadedAt: new Date(),
          processedAt: new Date()
        },
        deviceMeasurement: measurementId,
        source: metadata.source || 'folder-sync'
      }, patientId, examId);

      return deviceImage;

    } catch (error) {
      log.error('Specular image processing error:', { error: error });
      throw new Error(`Specular image processing failed: ${error.message}`);
    }
  }

  /**
   * Parse CSV format from specular microscope export
   */
  parseCSV(content) {
    const rows = super.parseCSV(content);

    return rows.map(row => ({
      eye: row.Eye || row.eye || row.EYE,
      capturedAt: new Date(row.Date || row.date || row.ExamDate),
      ecd: parseFloat(row.ECD || row.CD || row['Cell Density'] || row.cellDensity),
      cv: parseFloat(row.CV || row['CV%'] || row.CoeffVar),
      hexagonality: parseFloat(row.HEX || row['HEX%'] || row.Hexagonality || row['6A']),
      cct: parseFloat(row.CCT || row.Pachymetry || row.Thickness),
      avgCellArea: parseFloat(row.AVG || row['Avg Area'] || row.avgCellArea),
      cellCount: parseInt(row.NUM || row['Cell Count'] || row.Count || row.N),
      imageQuality: parseFloat(row.Quality || row.IQ)
    }));
  }

  /**
   * Parse TXT format (some devices export in proprietary text format)
   */
  parseTXT(content) {
    if (Buffer.isBuffer(content)) {
      content = content.toString('utf-8');
    }

    const lines = content.split('\n');
    const data = {};

    // Parse key-value pairs
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Try different delimiters
      let key, value;
      if (trimmed.includes(':')) {
        [key, value] = trimmed.split(':').map(s => s.trim());
      } else if (trimmed.includes('=')) {
        [key, value] = trimmed.split('=').map(s => s.trim());
      } else if (trimmed.includes('\t')) {
        [key, value] = trimmed.split('\t').map(s => s.trim());
      }

      if (key && value) {
        // Map common keys
        const keyMap = {
          'Cell Density': 'ecd',
          'CD': 'ecd',
          'ECD': 'ecd',
          'CV': 'cv',
          'Coefficient of Variation': 'cv',
          'HEX': 'hexagonality',
          'Hexagonality': 'hexagonality',
          'CCT': 'cct',
          'Pachymetry': 'cct',
          'Eye': 'eye',
          'Date': 'capturedAt'
        };

        const mappedKey = keyMap[key] || key.toLowerCase().replace(/\s+/g, '');
        data[mappedKey] = isNaN(value) ? value : parseFloat(value);
      }
    }

    return data;
  }
}

module.exports = SpecularMicroscopeAdapter;
