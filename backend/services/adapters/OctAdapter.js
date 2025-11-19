/**
 * OctAdapter - Adapter for OCT (Optical Coherence Tomography) devices
 *
 * Handles data from OCT devices like:
 * - Zeiss CIRRUS
 * - Heidelberg SPECTRALIS
 * - Topcon 3D OCT
 * - OptoVue iVue
 * - NIDEK RS-3000
 *
 * Processing includes:
 * - DICOM image parsing
 * - Retinal thickness measurements
 * - RNFL (Retinal Nerve Fiber Layer) analysis
 * - Macular measurements
 * - Optic disc analysis
 */

const BaseAdapter = require('./BaseAdapter');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

class OctAdapter extends BaseAdapter {
  constructor(device) {
    super(device);
    this.measurementType = 'OCT';
  }

  /**
   * Process OCT data from device
   *
   * @param {Object} data - Raw OCT data
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

      // Step 4: Process and store DICOM image if present
      let deviceImage = null;
      if (data.dicomFile || data.imageFile) {
        deviceImage = await this.processDICOMImage(
          data.dicomFile || data.imageFile,
          data,
          patientId,
          examId,
          measurement._id
        );
      }

      // Step 5: Log successful processing
      await this.logEvent('IMAGE_UPLOAD', 'SUCCESS', {
        integrationMethod: data.source || 'webhook',
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
        message: 'OCT data processed successfully'
      });

    } catch (error) {
      // Log failure
      await this.logEvent('IMAGE_UPLOAD', 'FAILED', {
        integrationMethod: data.source || 'webhook',
        initiatedBy: 'DEVICE',
        errorDetails: {
          code: error.code || 'OCT_PROCESSING_ERROR',
          message: error.message,
          severity: 'HIGH'
        }
      });

      return this.handleError(error, 'OCT processing');
    }
  }

  /**
   * Validate OCT data
   */
  async validate(data) {
    const requiredFields = ['eye'];
    const commonValidation = this.validateCommonFields(data, requiredFields);

    if (!commonValidation.isValid) {
      return commonValidation;
    }

    const errors = [...commonValidation.errors];

    // Validate OCT-specific fields
    if (data.retinalThickness !== undefined) {
      const thicknessError = this.validateRange(
        data.retinalThickness,
        100,
        800,
        'retinalThickness'
      );
      if (thicknessError) errors.push(thicknessError);
    }

    if (data.signalStrength !== undefined) {
      const signalError = this.validateRange(
        data.signalStrength,
        0,
        100,
        'signalStrength'
      );
      if (signalError) errors.push(signalError);
    }

    if (data.qualityScore !== undefined) {
      const qualityError = this.validateRange(
        data.qualityScore,
        0,
        100,
        'qualityScore'
      );
      if (qualityError) errors.push(qualityError);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Transform OCT data to standard format
   */
  async transform(data) {
    const transformed = {
      measurementType: 'OCT',
      measurementDate: data.capturedAt || new Date(),
      eye: data.eye,
      oct: {
        [data.eye]: {
          rnfl: this.extractRNFLData(data),
          macula: this.extractMacularData(data),
          opticDisc: this.extractOpticDiscData(data),
          quality: data.qualityScore,
          signalStrength: data.signalStrength
        }
      },
      quality: {
        overall: data.qualityScore || this.calculateQualityScore(data),
        factors: this.calculateQualityFactors(data),
        acceptable: (data.qualityScore || 0) >= 60
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
   * Extract RNFL (Retinal Nerve Fiber Layer) data
   */
  extractRNFLData(data) {
    if (!data.rnfl) return {};

    return {
      average: data.rnfl.average,
      superior: data.rnfl.superior,
      inferior: data.rnfl.inferior,
      nasal: data.rnfl.nasal,
      temporal: data.rnfl.temporal,
      classification: this.classifyRNFL(data.rnfl.average)
    };
  }

  /**
   * Classify RNFL thickness
   */
  classifyRNFL(average) {
    if (!average) return 'unknown';
    if (average >= 80) return 'normal';
    if (average >= 70) return 'borderline';
    return 'abnormal';
  }

  /**
   * Extract macular data
   */
  extractMacularData(data) {
    if (!data.macula) return {};

    return {
      centralThickness: data.macula.centralThickness || data.retinalThickness,
      volume: data.macula.volume,
      gccThickness: data.macula.gccThickness,
      grid: data.macula.grid
    };
  }

  /**
   * Extract optic disc data
   */
  extractOpticDiscData(data) {
    if (!data.opticDisc) return {};

    return {
      cupToDiscRatio: data.opticDisc.cupToDiscRatio,
      cupVolume: data.opticDisc.cupVolume,
      rimArea: data.opticDisc.rimArea,
      discArea: data.opticDisc.discArea
    };
  }

  /**
   * Calculate quality factors
   */
  calculateQualityFactors(data) {
    const factors = [];

    if (data.signalStrength !== undefined) {
      factors.push({
        name: 'Signal Strength',
        value: data.signalStrength,
        acceptable: data.signalStrength >= 6,
        threshold: 6
      });
    }

    if (data.qualityScore !== undefined) {
      factors.push({
        name: 'Overall Quality',
        value: data.qualityScore,
        acceptable: data.qualityScore >= 60,
        threshold: 60
      });
    }

    if (data.motionArtifacts !== undefined) {
      factors.push({
        name: 'Motion Artifacts',
        value: data.motionArtifacts ? 0 : 100,
        acceptable: !data.motionArtifacts,
        threshold: 1
      });
    }

    return factors;
  }

  /**
   * Calculate overall quality score
   */
  calculateQualityScore(data) {
    let score = 100;

    // Signal strength impact (0-40 points)
    if (data.signalStrength !== undefined) {
      score = Math.min(score, data.signalStrength * 10);
    }

    // Motion artifacts (-20 points)
    if (data.motionArtifacts) {
      score -= 20;
    }

    // Blink artifacts (-10 points)
    if (data.blinkArtifacts) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Process DICOM image
   */
  async processDICOMImage(fileBuffer, metadata, patientId, examId, measurementId) {
    try {
      // Generate unique filename
      const fileName = `oct_${Date.now()}_${metadata.eye}.dcm`;
      const filePath = path.join(
        process.env.UPLOAD_PATH || '/tmp/uploads',
        'oct',
        fileName
      );

      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Save file
      await fs.writeFile(filePath, fileBuffer);

      // Calculate checksum
      const checksum = this.generateChecksum(fileBuffer);

      // Extract DICOM metadata (simplified - would use dicom-parser in production)
      const dicomMetadata = this.extractDICOMMetadata(metadata);

      // Create DeviceImage record
      const deviceImage = await this.storeImage({
        imageType: 'OCT',
        eye: metadata.eye,
        capturedAt: metadata.capturedAt || new Date(),
        file: {
          originalName: metadata.fileName || fileName,
          fileName: fileName,
          path: filePath,
          size: fileBuffer.length,
          mimeType: 'application/dicom',
          checksum: checksum,
          format: 'DICOM'
        },
        dicom: dicomMetadata,
        quality: {
          overall: metadata.qualityScore || this.calculateQualityScore(metadata),
          signalStrength: metadata.signalStrength,
          factors: this.calculateQualityFactors(metadata),
          acceptable: (metadata.qualityScore || 0) >= 60
        },
        processing: {
          status: 'completed',
          uploadedAt: new Date(),
          processedAt: new Date(),
          dicomParsed: true,
          metadataExtracted: true
        },
        deviceMeasurement: measurementId,
        source: metadata.source || 'webhook'
      }, patientId, examId);

      return deviceImage;

    } catch (error) {
      console.error('DICOM processing error:', error);
      throw new Error(`DICOM processing failed: ${error.message}`);
    }
  }

  /**
   * Extract DICOM metadata
   * (Simplified version - in production would use dicom-parser library)
   */
  extractDICOMMetadata(data) {
    return {
      studyInstanceUID: data.studyInstanceUID || this.generateUID(),
      seriesInstanceUID: data.seriesInstanceUID || this.generateUID(),
      sopInstanceUID: data.sopInstanceUID || this.generateUID(),
      studyDate: data.capturedAt || new Date(),
      modality: 'OPT', // Ophthalmic Tomography
      manufacturer: this.device.manufacturer || 'Unknown',
      manufacturerModel: this.device.model || 'Unknown',
      stationName: this.device.name || 'Unknown',
      studyDescription: 'OCT Scan',
      seriesDescription: `OCT ${data.eye}`,
      customTags: data.dicomTags || {}
    };
  }

  /**
   * Generate DICOM UID
   */
  generateUID() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `1.2.840.10008.${timestamp}.${random}`;
  }

  /**
   * Parse CSV format (for some OCT devices that export to CSV)
   */
  parseCSV(content) {
    const rows = super.parseCSV(content);

    // Transform CSV rows to OCT data format
    return rows.map(row => ({
      eye: row.Eye || row.eye,
      capturedAt: new Date(row.Date || row.date),
      retinalThickness: parseFloat(row['Central Thickness'] || row.centralThickness),
      signalStrength: parseFloat(row['Signal Strength'] || row.signalStrength),
      qualityScore: parseFloat(row['Quality'] || row.quality || 100),
      rnfl: {
        average: parseFloat(row['RNFL Average'] || row.rnflAverage),
        superior: parseFloat(row['RNFL Superior'] || row.rnflSuperior),
        inferior: parseFloat(row['RNFL Inferior'] || row.rnflInferior),
        nasal: parseFloat(row['RNFL Nasal'] || row.rnflNasal),
        temporal: parseFloat(row['RNFL Temporal'] || row.rnflTemporal)
      },
      macula: {
        centralThickness: parseFloat(row['Central Thickness'] || row.centralThickness),
        volume: parseFloat(row['Macular Volume'] || row.macularVolume)
      }
    }));
  }
}

module.exports = OctAdapter;
