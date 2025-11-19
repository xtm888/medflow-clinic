/**
 * AutorefractorAdapter - Adapter for Autorefractor/Keratometer devices
 *
 * Handles data from autorefractor devices like:
 * - Nidek AR-1/AR-F
 * - Topcon KR-800/KR-1
 * - Huvitz HRK-8000A
 * - Tomey RC-5000
 * - Marco ARK-1
 *
 * Processing includes:
 * - Objective refraction (sphere, cylinder, axis)
 * - Keratometry measurements
 * - Pupil diameter
 * - Vertex distance
 * - Confidence/reliability scores
 */

const BaseAdapter = require('./BaseAdapter');

class AutorefractorAdapter extends BaseAdapter {
  constructor(device) {
    super(device);
    this.measurementType = 'AUTO_REFRACTION';
  }

  /**
   * Process autorefractor data from device
   *
   * @param {Object} data - Raw autorefractor data
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
        message: 'Autorefraction data processed successfully'
      });

    } catch (error) {
      // Log failure
      await this.logEvent('MEASUREMENT_IMPORT', 'FAILED', {
        integrationMethod: data.source || 'folder-sync',
        initiatedBy: 'DEVICE',
        errorDetails: {
          code: error.code || 'AUTOREFRACTOR_PROCESSING_ERROR',
          message: error.message,
          severity: 'MEDIUM'
        }
      });

      return this.handleError(error, 'Autorefractor processing');
    }
  }

  /**
   * Validate autorefractor data
   */
  async validate(data) {
    const requiredFields = [];
    const commonValidation = this.validateCommonFields(data, requiredFields);

    if (!commonValidation.isValid) {
      return commonValidation;
    }

    const errors = [...commonValidation.errors];

    // Validate refraction values for both eyes
    ['OD', 'OS'].forEach(eye => {
      if (data[eye]) {
        // Sphere validation (-20 to +20 D)
        if (data[eye].sphere !== undefined) {
          const sphereError = this.validateRange(data[eye].sphere, -20, 20, `${eye}.sphere`);
          if (sphereError) errors.push(sphereError);
        }

        // Cylinder validation (-10 to +10 D)
        if (data[eye].cylinder !== undefined) {
          const cylError = this.validateRange(data[eye].cylinder, -10, 10, `${eye}.cylinder`);
          if (cylError) errors.push(cylError);
        }

        // Axis validation (0 to 180 degrees)
        if (data[eye].axis !== undefined) {
          const axisError = this.validateRange(data[eye].axis, 0, 180, `${eye}.axis`);
          if (axisError) errors.push(axisError);
        }

        // Pupil size validation (2 to 9 mm)
        if (data[eye].pupilSize !== undefined) {
          const pupilError = this.validateRange(data[eye].pupilSize, 2, 9, `${eye}.pupilSize`);
          if (pupilError) errors.push(pupilError);
        }

        // Confidence validation (0 to 100%)
        if (data[eye].confidence !== undefined) {
          const confError = this.validateRange(data[eye].confidence, 0, 100, `${eye}.confidence`);
          if (confError) errors.push(confError);
        }

        // Keratometry validation (30 to 60 D)
        if (data[eye].k1 !== undefined) {
          const k1Error = this.validateRange(data[eye].k1, 30, 60, `${eye}.k1`);
          if (k1Error) errors.push(k1Error);
        }

        if (data[eye].k2 !== undefined) {
          const k2Error = this.validateRange(data[eye].k2, 30, 60, `${eye}.k2`);
          if (k2Error) errors.push(k2Error);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Transform autorefractor data to standard format
   */
  async transform(data) {
    const transformed = {
      measurementType: 'AUTO_REFRACTION',
      measurementDate: data.measurementDate || data.capturedAt || new Date(),
      eye: this.determineEye(data),
      autoRefraction: {
        OD: this.transformRefractionData(data.OD),
        OS: this.transformRefractionData(data.OS)
      },
      keratometry: {
        OD: this.transformKeratometryData(data.OD),
        OS: this.transformKeratometryData(data.OS)
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
   * Transform refraction data for one eye
   */
  transformRefractionData(eyeData) {
    if (!eyeData) return {};

    return {
      sphere: this.roundToNearestStep(eyeData.sphere, 0.25),
      cylinder: this.roundToNearestStep(eyeData.cylinder, 0.25),
      axis: eyeData.axis !== undefined ? Math.round(eyeData.axis) : undefined,
      va: eyeData.va || eyeData.visualAcuity,
      confidence: eyeData.confidence,
      pupilSize: eyeData.pupilSize,
      vertexDistance: eyeData.vertexDistance || 12 // Default 12mm
    };
  }

  /**
   * Transform keratometry data for one eye
   */
  transformKeratometryData(eyeData) {
    if (!eyeData || (!eyeData.k1 && !eyeData.k2)) return {};

    const k1 = eyeData.k1 || eyeData.kFlat;
    const k2 = eyeData.k2 || eyeData.kSteep;
    const k1Axis = eyeData.k1Axis || eyeData.flatAxis;
    const k2Axis = eyeData.k2Axis || eyeData.steepAxis;

    return {
      k1: {
        power: k1,
        axis: k1Axis,
        radius: k1 ? this.diopterToRadius(k1) : undefined
      },
      k2: {
        power: k2,
        axis: k2Axis,
        radius: k2 ? this.diopterToRadius(k2) : undefined
      },
      average: (k1 && k2) ? (k1 + k2) / 2 : undefined,
      cylinder: (k1 && k2) ? Math.abs(k2 - k1) : undefined,
      axisOfCylinder: k1Axis
    };
  }

  /**
   * Convert diopters to radius (mm)
   * Formula: r = 337.5 / D
   */
  diopterToRadius(diopter) {
    if (!diopter) return undefined;
    return Math.round((337.5 / diopter) * 100) / 100;
  }

  /**
   * Round to nearest step (e.g., 0.25 D)
   */
  roundToNearestStep(value, step = 0.25) {
    if (value === undefined || value === null) return undefined;
    return Math.round(value / step) * step;
  }

  /**
   * Determine which eye(s) were measured
   */
  determineEye(data) {
    const hasOD = data.OD && (data.OD.sphere !== undefined || data.OD.k1 !== undefined);
    const hasOS = data.OS && (data.OS.sphere !== undefined || data.OS.k1 !== undefined);

    if (hasOD && hasOS) return 'OU';
    if (hasOD) return 'OD';
    if (hasOS) return 'OS';
    return 'OU';
  }

  /**
   * Calculate quality factors
   */
  calculateQualityFactors(data) {
    const factors = [];

    // Check confidence scores
    ['OD', 'OS'].forEach(eye => {
      if (data[eye]?.confidence !== undefined) {
        factors.push({
          name: `${eye} Measurement Confidence`,
          value: data[eye].confidence,
          acceptable: data[eye].confidence >= 70,
          threshold: 70
        });
      }

      // Check pupil size (adequate dilation improves accuracy)
      if (data[eye]?.pupilSize !== undefined) {
        const isAdequate = data[eye].pupilSize >= 3.5;
        factors.push({
          name: `${eye} Pupil Size`,
          value: data[eye].pupilSize,
          acceptable: isAdequate,
          threshold: 3.5
        });
      }
    });

    // Check if cylinder and axis are consistent
    ['OD', 'OS'].forEach(eye => {
      if (data[eye]?.cylinder !== undefined && Math.abs(data[eye].cylinder) > 0.25) {
        const hasAxis = data[eye].axis !== undefined;
        factors.push({
          name: `${eye} Axis Recorded`,
          value: hasAxis ? 100 : 0,
          acceptable: hasAxis,
          threshold: 1
        });
      }
    });

    return factors;
  }

  /**
   * Calculate overall quality score
   */
  calculateQualityScore(data) {
    let score = 100;

    ['OD', 'OS'].forEach(eye => {
      if (data[eye]) {
        // Confidence score impact
        if (data[eye].confidence !== undefined) {
          if (data[eye].confidence < 70) score -= 15;
          else if (data[eye].confidence < 85) score -= 5;
        }

        // Pupil size impact
        if (data[eye].pupilSize !== undefined) {
          if (data[eye].pupilSize < 3.0) score -= 10;
          else if (data[eye].pupilSize < 3.5) score -= 5;
        }

        // Cylinder without axis is problematic
        if (data[eye].cylinder !== undefined &&
            Math.abs(data[eye].cylinder) > 0.25 &&
            data[eye].axis === undefined) {
          score -= 20;
        }
      }
    });

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Parse CSV format (common for autorefractor exports)
   */
  parseCSV(content) {
    const rows = super.parseCSV(content);

    // Transform CSV rows to autorefractor data format
    return rows.map(row => {
      const data = {
        measurementDate: new Date(row.Date || row.date || row.Timestamp),
        source: 'folder-sync'
      };

      // Parse OD data
      if (row['OD SPH'] !== undefined || row.OD_SPH !== undefined) {
        data.OD = {
          sphere: parseFloat(row['OD SPH'] || row.OD_SPH || row.SPH_OD),
          cylinder: parseFloat(row['OD CYL'] || row.OD_CYL || row.CYL_OD || 0),
          axis: parseInt(row['OD AXIS'] || row.OD_AXIS || row.AXIS_OD || 0),
          pupilSize: parseFloat(row['OD PD'] || row.OD_PD || row.PD_OD),
          confidence: parseFloat(row['OD CONF'] || row.OD_Confidence || 100),
          k1: parseFloat(row['OD K1'] || row.OD_K1),
          k2: parseFloat(row['OD K2'] || row.OD_K2),
          k1Axis: parseInt(row['OD K1 AXIS'] || row.OD_K1_Axis),
          k2Axis: parseInt(row['OD K2 AXIS'] || row.OD_K2_Axis)
        };
      }

      // Parse OS data
      if (row['OS SPH'] !== undefined || row.OS_SPH !== undefined) {
        data.OS = {
          sphere: parseFloat(row['OS SPH'] || row.OS_SPH || row.SPH_OS),
          cylinder: parseFloat(row['OS CYL'] || row.OS_CYL || row.CYL_OS || 0),
          axis: parseInt(row['OS AXIS'] || row.OS_AXIS || row.AXIS_OS || 0),
          pupilSize: parseFloat(row['OS PD'] || row.OS_PD || row.PD_OS),
          confidence: parseFloat(row['OS CONF'] || row.OS_Confidence || 100),
          k1: parseFloat(row['OS K1'] || row.OS_K1),
          k2: parseFloat(row['OS K2'] || row.OS_K2),
          k1Axis: parseInt(row['OS K1 AXIS'] || row.OS_K1_Axis),
          k2Axis: parseInt(row['OS K2 AXIS'] || row.OS_K2_Axis)
        };
      }

      return data;
    });
  }

  /**
   * Parse TXT format (some autorefractors export to text)
   */
  parseTXT(content) {
    if (Buffer.isBuffer(content)) {
      content = content.toString('utf-8');
    }

    const lines = content.split('\n').filter(line => line.trim());
    const data = {
      source: 'folder-sync',
      OD: {},
      OS: {}
    };

    let currentEye = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect which eye
      if (trimmed.includes('OD') || trimmed.includes('Right')) {
        currentEye = 'OD';
      } else if (trimmed.includes('OS') || trimmed.includes('Left')) {
        currentEye = 'OS';
      }

      // Parse refraction values
      const sphMatch = trimmed.match(/SPH[:\s]+(-?\d+\.?\d*)/i);
      const cylMatch = trimmed.match(/CYL[:\s]+(-?\d+\.?\d*)/i);
      const axisMatch = trimmed.match(/AXIS[:\s]+(\d+)/i);
      const k1Match = trimmed.match(/K1[:\s]+(\d+\.?\d*)/i);
      const k2Match = trimmed.match(/K2[:\s]+(\d+\.?\d*)/i);

      if (currentEye && sphMatch) {
        data[currentEye].sphere = parseFloat(sphMatch[1]);
      }
      if (currentEye && cylMatch) {
        data[currentEye].cylinder = parseFloat(cylMatch[1]);
      }
      if (currentEye && axisMatch) {
        data[currentEye].axis = parseInt(axisMatch[1]);
      }
      if (currentEye && k1Match) {
        data[currentEye].k1 = parseFloat(k1Match[1]);
      }
      if (currentEye && k2Match) {
        data[currentEye].k2 = parseFloat(k2Match[1]);
      }

      // Parse date
      const dateMatch = trimmed.match(/Date[:\s]+(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);
      if (dateMatch) {
        data.measurementDate = new Date(dateMatch[1]);
      }
    }

    return [data];
  }
}

module.exports = AutorefractorAdapter;
