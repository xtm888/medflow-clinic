/**
 * BiometerAdapter - Adapter for Biometry devices
 *
 * Handles data from biometry devices for IOL calculations:
 * - Zeiss IOL Master 500/700
 * - Haag-Streit Lenstar LS900
 * - NIDEK AL-Scan
 * - Tomey OA-2000
 *
 * Measurements include:
 * - Axial Length (AL)
 * - Keratometry (K1, K2, Average K)
 * - Anterior Chamber Depth (ACD)
 * - Lens Thickness (LT)
 * - White-to-White (WTW)
 * - Pupil Size
 * - IOL Power Calculations
 */

const BaseAdapter = require('./BaseAdapter');

class BiometerAdapter extends BaseAdapter {
  constructor(device) {
    super(device);
    this.measurementType = 'biometry';
  }

  /**
   * Process biometry data from device
   *
   * @param {Object} data - Raw biometry data
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
          recordsProcessed: 1
        },
        createdRecords: {
          deviceMeasurements: [measurement._id],
          count: 1
        }
      });

      return this.createSuccessResponse({
        measurementId: measurement._id,
        message: 'Biometry data processed successfully'
      });

    } catch (error) {
      // Log failure
      await this.logEvent('MEASUREMENT_UPLOAD', 'FAILED', {
        integrationMethod: data.source || 'folder-sync',
        initiatedBy: 'DEVICE',
        errorDetails: {
          code: error.code || 'BIOMETRY_PROCESSING_ERROR',
          message: error.message,
          severity: 'HIGH'
        }
      });

      return this.handleError(error, 'Biometry processing');
    }
  }

  /**
   * Validate biometry data
   */
  async validate(data) {
    const requiredFields = ['eye'];
    const commonValidation = this.validateCommonFields(data, requiredFields);

    if (!commonValidation.isValid) {
      return commonValidation;
    }

    const errors = [...commonValidation.errors];

    // Validate axial length (typical range 20-35mm)
    if (data.axialLength !== undefined) {
      const alError = this.validateRange(data.axialLength, 18, 38, 'axialLength');
      if (alError) errors.push(alError);
    }

    // Validate K values (typical range 35-52 D)
    if (data.k1 !== undefined) {
      const k1Error = this.validateRange(data.k1, 30, 55, 'k1');
      if (k1Error) errors.push(k1Error);
    }

    if (data.k2 !== undefined) {
      const k2Error = this.validateRange(data.k2, 30, 55, 'k2');
      if (k2Error) errors.push(k2Error);
    }

    // Validate ACD (typical range 2-5mm)
    if (data.acd !== undefined) {
      const acdError = this.validateRange(data.acd, 1.5, 6, 'acd');
      if (acdError) errors.push(acdError);
    }

    // Validate lens thickness (typical range 3-6mm)
    if (data.lensThickness !== undefined) {
      const ltError = this.validateRange(data.lensThickness, 2, 8, 'lensThickness');
      if (ltError) errors.push(ltError);
    }

    // Validate WTW (typical range 10-14mm)
    if (data.wtw !== undefined) {
      const wtwError = this.validateRange(data.wtw, 9, 15, 'wtw');
      if (wtwError) errors.push(wtwError);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Transform biometry data to standard format
   */
  async transform(data) {
    const avgK = this.calculateAverageK(data.k1, data.k2);

    const eyeData = {
      axialLength: data.axialLength || data.al || data.AL,
      kReadings: {
        k1: data.k1 || data.K1,
        k2: data.k2 || data.K2,
        average: avgK,
        axis1: data.axis1 || data.k1Axis,
        axis2: data.axis2 || data.k2Axis,
        astigmatism: data.astigmatism || this.calculateAstigmatism(data.k1, data.k2)
      },
      acd: data.acd || data.ACD || data.anteriorChamberDepth,
      lensThickness: data.lensThickness || data.lt || data.LT,
      whiteToWhite: data.wtw || data.WTW || data.whiteToWhite,
      pupilSize: data.pupilSize || data.pupil,
      // IOL calculations if present
      iolCalculations: data.iolCalculations || this.extractIOLCalculations(data)
    };

    const transformed = {
      measurementType: 'biometry',
      measurementDate: data.capturedAt || data.measurementDate || new Date(),
      eye: data.eye,
      // Store in biometry section (matches DeviceMeasurement schema)
      biometry: {
        [data.eye]: eyeData
      },
      // Also store keratometry separately for compatibility
      keratometry: {
        [data.eye]: {
          k1: {
            power: data.k1,
            axis: data.axis1 || data.k1Axis,
            radius: data.k1 ? this.dioptersToRadius(data.k1) : null
          },
          k2: {
            power: data.k2,
            axis: data.axis2 || data.k2Axis,
            radius: data.k2 ? this.dioptersToRadius(data.k2) : null
          },
          average: avgK,
          cylinder: this.calculateAstigmatism(data.k1, data.k2),
          axisOfCylinder: data.axis2 || data.k2Axis
        }
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
   * Calculate average keratometry
   */
  calculateAverageK(k1, k2) {
    if (!k1 || !k2) return null;
    return Math.round(((k1 + k2) / 2) * 100) / 100;
  }

  /**
   * Calculate corneal astigmatism
   */
  calculateAstigmatism(k1, k2) {
    if (!k1 || !k2) return null;
    return Math.round(Math.abs(k1 - k2) * 100) / 100;
  }

  /**
   * Convert diopters to radius (mm)
   * Formula: r = 337.5 / D
   */
  dioptersToRadius(diopters) {
    if (!diopters || diopters <= 0) return null;
    return Math.round((337.5 / diopters) * 100) / 100;
  }

  /**
   * Extract IOL calculations from data if present
   */
  extractIOLCalculations(data) {
    const calculations = [];

    // Check for pre-calculated IOL values
    const formulas = ['SRK_T', 'HOFFER_Q', 'HOLLADAY_1', 'HAIGIS', 'BARRETT'];

    for (const formula of formulas) {
      const key = formula.toLowerCase().replace('_', '');
      if (data[`iol_${key}`] || data[formula]) {
        calculations.push({
          formula: formula,
          iolPower: data[`iol_${key}`] || data[formula],
          targetRefraction: data.targetRefraction || 0,
          aConstant: data.aConstant || data.a_constant
        });
      }
    }

    // Check for generic IOL calculation
    if (data.iolPower && calculations.length === 0) {
      calculations.push({
        formula: data.formula || 'Unknown',
        iolPower: data.iolPower,
        targetRefraction: data.targetRefraction || 0,
        aConstant: data.aConstant
      });
    }

    return calculations;
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(data) {
    let score = 100;

    // SNR (Signal-to-Noise Ratio) impact
    if (data.snr !== undefined) {
      if (data.snr < 2) score -= 40;
      else if (data.snr < 5) score -= 20;
      else if (data.snr < 10) score -= 10;
    }

    // Measurement consistency (SD of AL measurements)
    if (data.alStdDev !== undefined) {
      if (data.alStdDev > 0.05) score -= 20;
      else if (data.alStdDev > 0.03) score -= 10;
    }

    // K reading consistency
    if (data.kStdDev !== undefined) {
      if (data.kStdDev > 0.3) score -= 15;
      else if (data.kStdDev > 0.2) score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate quality factors
   */
  calculateQualityFactors(data) {
    const factors = [];

    if (data.snr !== undefined) {
      factors.push({
        name: 'Signal-to-Noise Ratio',
        value: data.snr,
        acceptable: data.snr >= 2,
        threshold: 2
      });
    }

    if (data.alStdDev !== undefined) {
      factors.push({
        name: 'AL Standard Deviation',
        value: data.alStdDev,
        acceptable: data.alStdDev <= 0.05,
        threshold: 0.05,
        unit: 'mm'
      });
    }

    if (data.measurementCount !== undefined) {
      factors.push({
        name: 'Measurement Count',
        value: data.measurementCount,
        acceptable: data.measurementCount >= 3,
        threshold: 3
      });
    }

    return factors;
  }

  /**
   * Check if quality is acceptable
   */
  isQualityAcceptable(data) {
    if (data.snr !== undefined && data.snr < 1.5) return false;
    if (data.alStdDev !== undefined && data.alStdDev > 0.1) return false;
    return true;
  }

  /**
   * Generate automatic interpretation
   */
  generateAutoInterpretation(eyeData) {
    const al = eyeData.axialLength;
    if (!al) return 'Insufficient data for interpretation';

    let interpretation = '';

    // Axial length classification
    if (al < 22) {
      interpretation = 'Short eye (hyperopic). ';
    } else if (al >= 22 && al < 24) {
      interpretation = 'Normal axial length. ';
    } else if (al >= 24 && al < 26) {
      interpretation = 'Mildly elongated eye. ';
    } else if (al >= 26) {
      interpretation = 'High myopia - consider myopic IOL formula. ';
    }

    // K readings interpretation
    const avgK = eyeData.kReadings?.average;
    if (avgK) {
      if (avgK < 41) {
        interpretation += 'Flat cornea. ';
      } else if (avgK > 47) {
        interpretation += 'Steep cornea. ';
      }
    }

    // Astigmatism
    const astig = eyeData.kReadings?.astigmatism;
    if (astig && astig > 1.0) {
      interpretation += `Corneal astigmatism ${astig.toFixed(2)}D - consider toric IOL. `;
    }

    return interpretation.trim() || 'Normal biometry parameters';
  }

  /**
   * Generate clinical findings
   */
  generateFindings(eyeData) {
    const findings = [];
    const al = eyeData.axialLength;
    const avgK = eyeData.kReadings?.average;
    const astig = eyeData.kReadings?.astigmatism;
    const acd = eyeData.acd;

    // Axial length findings
    if (al < 21) {
      findings.push('Extremely short eye - nanophthalmos risk, consider IOL formula for short eyes');
    } else if (al < 22) {
      findings.push('Short eye - Hoffer Q formula may be more accurate');
    } else if (al > 26) {
      findings.push('High myopia - Barrett or optimized formula recommended');
    } else if (al > 28) {
      findings.push('Very high myopia - increased risk of retinal complications');
    }

    // Keratometry findings
    if (avgK && avgK < 40) {
      findings.push('Very flat cornea - verify keratometry readings');
    } else if (avgK && avgK > 48) {
      findings.push('Very steep cornea - rule out keratoconus');
    }

    // Astigmatism findings
    if (astig && astig > 1.0) {
      findings.push('Significant corneal astigmatism - toric IOL candidate');
    }
    if (astig && astig > 2.5) {
      findings.push('High astigmatism - consider corneal topography');
    }

    // ACD findings
    if (acd && acd < 2.5) {
      findings.push('Shallow anterior chamber - careful IOL sizing required');
    }

    return findings;
  }

  /**
   * Parse CSV format from biometry device export
   */
  parseCSV(content) {
    const rows = super.parseCSV(content);

    return rows.map(row => ({
      eye: row.Eye || row.eye || row.EYE || (row.OD ? 'OD' : 'OS'),
      capturedAt: new Date(row.Date || row.date || row.ExamDate),
      axialLength: parseFloat(row.AL || row.AxialLength || row['Axial Length']),
      k1: parseFloat(row.K1 || row['K1(D)'] || row.FlatK),
      k2: parseFloat(row.K2 || row['K2(D)'] || row.SteepK),
      axis1: parseFloat(row.Axis1 || row.K1Axis),
      axis2: parseFloat(row.Axis2 || row.K2Axis),
      acd: parseFloat(row.ACD || row['ACD(mm)'] || row.AnteriorChamber),
      lensThickness: parseFloat(row.LT || row.LensThickness || row['Lens(mm)']),
      wtw: parseFloat(row.WTW || row.WhiteToWhite || row['WTW(mm)']),
      pupilSize: parseFloat(row.Pupil || row.PupilSize),
      snr: parseFloat(row.SNR || row.SignalRatio),
      iolPower: parseFloat(row.IOL || row.IOLPower)
    }));
  }

  /**
   * Parse XML format (common for IOL Master export)
   */
  parseXML(content) {
    // Basic XML parsing - in production would use xml2js or similar
    if (Buffer.isBuffer(content)) {
      content = content.toString('utf-8');
    }

    const data = {};

    // Extract common XML tags
    const extractValue = (tag) => {
      const regex = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i');
      const match = content.match(regex);
      return match ? match[1].trim() : null;
    };

    data.eye = extractValue('Eye') || extractValue('Laterality');
    data.axialLength = parseFloat(extractValue('AxialLength') || extractValue('AL'));
    data.k1 = parseFloat(extractValue('K1') || extractValue('FlatK'));
    data.k2 = parseFloat(extractValue('K2') || extractValue('SteepK'));
    data.acd = parseFloat(extractValue('ACD') || extractValue('AnteriorChamberDepth'));
    data.lensThickness = parseFloat(extractValue('LensThickness') || extractValue('LT'));
    data.wtw = parseFloat(extractValue('WTW') || extractValue('WhiteToWhite'));
    data.capturedAt = extractValue('ExamDate') || extractValue('Date');

    return data;
  }
}

module.exports = BiometerAdapter;
