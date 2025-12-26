/**
 * VisualFieldAdapter - Adapter for Visual Field / Perimetry devices
 *
 * Handles data from visual field analyzers:
 * - Zeiss Humphrey Field Analyzer (HFA) 3 / HFA II-i
 * - Octopus 600/900 series
 * - Haag-Streit Octopus
 * - Kowa AP-7000
 *
 * Measurements include:
 * - Mean Deviation (MD)
 * - Pattern Standard Deviation (PSD)
 * - Visual Field Index (VFI)
 * - Foveal Sensitivity
 * - Total Deviation (TD) values
 * - Pattern Deviation (PD) values
 * - Reliability Indices (fixation losses, false positives, false negatives)
 * - Point-by-point sensitivity values (dB)
 *
 * Common test patterns:
 * - 24-2: 54 test points, central 24 degrees
 * - 30-2: 76 test points, central 30 degrees
 * - 10-2: 68 test points, central 10 degrees
 * - Macula: 16 points for macular testing
 */

const BaseAdapter = require('./BaseAdapter');

class VisualFieldAdapter extends BaseAdapter {
  constructor(device) {
    super(device);
    this.measurementType = 'visual_field';

    // Standard test patterns with expected point counts
    this.TEST_PATTERNS = {
      '24-2': { points: 54, description: 'Central 24 degrees, 6 degree spacing' },
      '30-2': { points: 76, description: 'Central 30 degrees, 6 degree spacing' },
      '10-2': { points: 68, description: 'Central 10 degrees, 2 degree spacing' },
      'MACULA': { points: 16, description: 'Macular threshold test' },
      '60-4': { points: 60, description: 'Peripheral screening' },
      'FULL_FIELD': { points: 120, description: 'Full field threshold' }
    };

    // Glaucoma staging thresholds (based on Hodapp-Parrish-Anderson)
    this.GLAUCOMA_STAGING = {
      EARLY: { mdMin: -6, mdMax: 0, description: 'Early glaucoma' },
      MODERATE: { mdMin: -12, mdMax: -6, description: 'Moderate glaucoma' },
      SEVERE: { mdMin: -20, mdMax: -12, description: 'Severe glaucoma' },
      ADVANCED: { mdMin: -99, mdMax: -20, description: 'Advanced/end-stage' }
    };
  }

  /**
   * Process visual field data from device
   *
   * @param {Object} data - Raw visual field data
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
          testPattern: data.testPattern || '24-2'
        },
        createdRecords: {
          deviceMeasurements: [measurement._id],
          count: 1
        }
      });

      return this.createSuccessResponse({
        measurementId: measurement._id,
        message: 'Visual field data processed successfully',
        testPattern: transformed.visualField?.testPattern,
        reliability: transformed.quality
      });

    } catch (error) {
      // Log failure
      await this.logEvent('MEASUREMENT_UPLOAD', 'FAILED', {
        integrationMethod: data.source || 'folder-sync',
        initiatedBy: 'DEVICE',
        errorDetails: {
          code: error.code || 'VF_PROCESSING_ERROR',
          message: error.message,
          severity: 'HIGH'
        }
      });

      return this.handleError(error, 'Visual field processing');
    }
  }

  /**
   * Validate visual field data
   */
  async validate(data) {
    const requiredFields = ['eye'];
    const commonValidation = this.validateCommonFields(data, requiredFields);

    if (!commonValidation.isValid) {
      return commonValidation;
    }

    const errors = [...commonValidation.errors];

    // Validate Mean Deviation (-35 to +5 dB typical range)
    if (data.meanDeviation !== undefined && data.meanDeviation !== null) {
      const mdError = this.validateRange(data.meanDeviation, -40, 10, 'meanDeviation');
      if (mdError) errors.push(mdError);
    }

    // Validate Pattern Standard Deviation (0 to 20 dB typical)
    if (data.patternStandardDeviation !== undefined) {
      const psdError = this.validateRange(data.patternStandardDeviation, 0, 25, 'patternStandardDeviation');
      if (psdError) errors.push(psdError);
    }

    // Validate Visual Field Index (0-100%)
    if (data.vfi !== undefined) {
      const vfiError = this.validateRange(data.vfi, 0, 100, 'vfi');
      if (vfiError) errors.push(vfiError);
    }

    // Validate foveal threshold (0-45 dB typical)
    if (data.fovealThreshold !== undefined) {
      const ftError = this.validateRange(data.fovealThreshold, 0, 50, 'fovealThreshold');
      if (ftError) errors.push(ftError);
    }

    // Validate reliability indices (percentages 0-100)
    if (data.fixationLosses !== undefined) {
      if (typeof data.fixationLosses === 'number') {
        const flError = this.validateRange(data.fixationLosses, 0, 100, 'fixationLosses');
        if (flError) errors.push(flError);
      }
    }

    if (data.falsePositives !== undefined) {
      const fpError = this.validateRange(data.falsePositives, 0, 100, 'falsePositives');
      if (fpError) errors.push(fpError);
    }

    if (data.falseNegatives !== undefined) {
      const fnError = this.validateRange(data.falseNegatives, 0, 100, 'falseNegatives');
      if (fnError) errors.push(fnError);
    }

    // Validate test pattern if provided
    if (data.testPattern && !this.TEST_PATTERNS[data.testPattern.toUpperCase().replace('-', '_').replace(' ', '_')]) {
      errors.push({
        field: 'testPattern',
        message: `Unknown test pattern: ${data.testPattern}`,
        code: 'UNKNOWN_TEST_PATTERN',
        value: data.testPattern
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Transform visual field data to standard format
   */
  async transform(data) {
    const testPattern = this.normalizeTestPattern(data.testPattern);
    const reliability = this.calculateReliability(data);
    const glaucomaStage = this.determineGlaucomaStage(data.meanDeviation);

    // Parse sensitivity values if provided as arrays
    const sensitivities = this.parseSensitivities(data);
    const deviations = this.parseDeviations(data);

    const eyeData = {
      testPattern,
      testDuration: data.testDuration || data.duration,
      strategy: data.strategy || data.testStrategy || 'SITA-Standard',
      stimulus: data.stimulus || 'III/White',
      background: data.background || '31.5 asb',
      // Global indices
      globalIndices: {
        meanDeviation: this.parseNumber(data.meanDeviation || data.md || data.MD),
        patternStandardDeviation: this.parseNumber(data.patternStandardDeviation || data.psd || data.PSD),
        visualFieldIndex: this.parseNumber(data.vfi || data.VFI),
        meanSensitivity: this.parseNumber(data.meanSensitivity || data.ms),
        shortTermFluctuation: this.parseNumber(data.shortTermFluctuation || data.sf),
        correctedPSD: this.parseNumber(data.correctedPSD || data.cpsd),
        ghtResult: data.ghtResult || data.ght || null, // Glaucoma Hemifield Test
        mdProbability: data.mdProbability || data.mdP,
        psdProbability: data.psdProbability || data.psdP
      },
      foveal: {
        threshold: this.parseNumber(data.fovealThreshold || data.foveal),
        tested: data.fovealTested !== false
      },
      // Reliability indices
      reliability: {
        fixationLosses: this.parseReliabilityIndex(data.fixationLosses, data.fixationLossesTotal),
        falsePositives: this.parseNumber(data.falsePositives || data.falsePos || data.FP),
        falseNegatives: this.parseNumber(data.falseNegatives || data.falseNeg || data.FN),
        testReliability: reliability.reliability,
        reliabilityStatus: reliability.status
      },
      // Point-by-point data
      sensitivities: sensitivities.values,
      totalDeviation: deviations.totalDeviation,
      patternDeviation: deviations.patternDeviation,
      // Probability maps (p-values at each point)
      totalDeviationProbability: deviations.tdProbability,
      patternDeviationProbability: deviations.pdProbability,
      // Raw/grayscale for visualization
      grayscale: data.grayscale || this.generateGrayscale(sensitivities.values),
      // Clinical staging
      staging: glaucomaStage
    };

    const transformed = {
      measurementType: 'visual_field',
      measurementDate: data.capturedAt || data.measurementDate || data.examDate || new Date(),
      eye: data.eye,
      // Store in visualField section (matches DeviceMeasurement schema)
      visualField: {
        [data.eye]: eyeData
      },
      quality: {
        overall: reliability.score,
        factors: reliability.factors,
        acceptable: reliability.acceptable
      },
      interpretation: {
        automatic: this.generateAutoInterpretation(eyeData, glaucomaStage),
        findings: this.generateFindings(eyeData, glaucomaStage),
        ghtInterpretation: this.interpretGHT(data.ghtResult),
        progression: data.progression || null
      },
      source: data.source || 'device',
      rawData: {
        format: data.format || 'xml',
        data: data
      }
    };

    return transformed;
  }

  /**
   * Parse number safely
   */
  parseNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  /**
   * Normalize test pattern name
   */
  normalizeTestPattern(pattern) {
    if (!pattern) return '24-2';
    const normalized = pattern.toString().toUpperCase().replace(/[_\s]/g, '-');
    // Handle common variations
    if (normalized.includes('24')) return '24-2';
    if (normalized.includes('30')) return '30-2';
    if (normalized.includes('10')) return '10-2';
    if (normalized.includes('MAC')) return 'MACULA';
    return normalized;
  }

  /**
   * Parse reliability index (handles "x/y" format or percentage)
   */
  parseReliabilityIndex(value, total) {
    if (value === undefined || value === null) return null;

    // Handle string format like "2/10" or "2 of 10"
    if (typeof value === 'string') {
      const match = value.match(/(\d+)\s*[\/of]+\s*(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        const denom = parseInt(match[2], 10);
        return denom > 0 ? Math.round((num / denom) * 100) : null;
      }
      return parseFloat(value) || null;
    }

    // If separate numerator and total provided
    if (typeof value === 'number' && typeof total === 'number' && total > 0) {
      return Math.round((value / total) * 100);
    }

    return typeof value === 'number' ? value : null;
  }

  /**
   * Parse sensitivity values from various formats
   */
  parseSensitivities(data) {
    let values = null;
    let pointCount = 0;

    if (data.sensitivities) {
      if (Array.isArray(data.sensitivities)) {
        values = data.sensitivities.map(v => this.parseNumber(v));
        pointCount = values.length;
      } else if (typeof data.sensitivities === 'string') {
        values = data.sensitivities.split(/[,\s]+/).map(v => this.parseNumber(v.trim()));
        pointCount = values.length;
      }
    } else if (data.thresholds) {
      values = Array.isArray(data.thresholds)
        ? data.thresholds.map(v => this.parseNumber(v))
        : null;
      pointCount = values ? values.length : 0;
    }

    return { values, pointCount };
  }

  /**
   * Parse deviation values (TD, PD)
   */
  parseDeviations(data) {
    const parseArray = (arr) => {
      if (!arr) return null;
      if (Array.isArray(arr)) return arr.map(v => this.parseNumber(v));
      if (typeof arr === 'string') {
        return arr.split(/[,\s]+/).map(v => this.parseNumber(v.trim()));
      }
      return null;
    };

    return {
      totalDeviation: parseArray(data.totalDeviation || data.td || data.TD),
      patternDeviation: parseArray(data.patternDeviation || data.pd || data.PD),
      tdProbability: parseArray(data.tdProbability || data.totalDeviationProbability),
      pdProbability: parseArray(data.pdProbability || data.patternDeviationProbability)
    };
  }

  /**
   * Generate grayscale visualization data
   */
  generateGrayscale(sensitivities) {
    if (!sensitivities || !Array.isArray(sensitivities)) return null;

    // Convert dB values to grayscale (0-255)
    return sensitivities.map(dB => {
      if (dB === null || dB === undefined) return 128;
      // Normal vision ~30dB = white, 0dB = black
      const normalized = Math.max(0, Math.min(1, dB / 35));
      return Math.round(normalized * 255);
    });
  }

  /**
   * Calculate reliability indices and overall score
   */
  calculateReliability(data) {
    const factors = [];
    let score = 100;
    const issues = [];

    // Fixation losses (>20% is concerning, >33% is unreliable)
    const fl = this.parseReliabilityIndex(data.fixationLosses, data.fixationLossesTotal);
    if (fl !== null) {
      factors.push({
        name: 'Fixation Losses',
        value: fl,
        acceptable: fl <= 20,
        threshold: 20,
        unit: '%'
      });
      if (fl > 33) {
        score -= 40;
        issues.push('High fixation losses');
      } else if (fl > 20) {
        score -= 20;
        issues.push('Elevated fixation losses');
      }
    }

    // False positives (>15% is concerning, >33% is unreliable)
    const fp = this.parseNumber(data.falsePositives || data.falsePos);
    if (fp !== null) {
      factors.push({
        name: 'False Positives',
        value: fp,
        acceptable: fp <= 15,
        threshold: 15,
        unit: '%'
      });
      if (fp > 33) {
        score -= 40;
        issues.push('High false positives (trigger-happy)');
      } else if (fp > 15) {
        score -= 20;
        issues.push('Elevated false positives');
      }
    }

    // False negatives (>33% is concerning for reliable patients)
    const fn = this.parseNumber(data.falseNegatives || data.falseNeg);
    if (fn !== null) {
      factors.push({
        name: 'False Negatives',
        value: fn,
        acceptable: fn <= 33,
        threshold: 33,
        unit: '%'
      });
      // Note: High FN can be real field loss, so penalty is lower
      if (fn > 50) {
        score -= 15;
        issues.push('Very high false negatives');
      } else if (fn > 33) {
        score -= 10;
        issues.push('Elevated false negatives');
      }
    }

    // Test duration (too fast or too slow may indicate issues)
    const duration = data.testDuration || data.duration;
    if (duration) {
      const minutes = typeof duration === 'number' ? duration : parseFloat(duration);
      if (minutes < 3) {
        score -= 10;
        issues.push('Test completed very quickly');
      } else if (minutes > 15) {
        issues.push('Extended test duration (fatigue possible)');
      }
    }

    const reliability = Math.max(0, Math.min(100, score));
    let status = 'reliable';
    if (reliability < 50) status = 'unreliable';
    else if (reliability < 75) status = 'low_reliability';
    else if (reliability < 90) status = 'acceptable';

    return {
      score,
      reliability,
      status,
      acceptable: reliability >= 50,
      factors,
      issues
    };
  }

  /**
   * Determine glaucoma stage based on Hodapp-Parrish-Anderson criteria
   */
  determineGlaucomaStage(md) {
    if (md === null || md === undefined) return null;

    const mdValue = this.parseNumber(md);
    if (mdValue === null) return null;

    if (mdValue >= -6) {
      return {
        stage: 'EARLY',
        severity: 1,
        description: 'Early/mild glaucoma (MD > -6 dB)',
        mdRange: '-6 to 0 dB'
      };
    } else if (mdValue >= -12) {
      return {
        stage: 'MODERATE',
        severity: 2,
        description: 'Moderate glaucoma (-12 < MD ≤ -6 dB)',
        mdRange: '-12 to -6 dB'
      };
    } else if (mdValue >= -20) {
      return {
        stage: 'SEVERE',
        severity: 3,
        description: 'Severe glaucoma (-20 < MD ≤ -12 dB)',
        mdRange: '-20 to -12 dB'
      };
    } else {
      return {
        stage: 'ADVANCED',
        severity: 4,
        description: 'Advanced/end-stage glaucoma (MD ≤ -20 dB)',
        mdRange: '< -20 dB'
      };
    }
  }

  /**
   * Interpret Glaucoma Hemifield Test result
   */
  interpretGHT(ghtResult) {
    if (!ghtResult) return null;

    const normalized = ghtResult.toString().toUpperCase().replace(/\s+/g, '_');
    const interpretations = {
      'WITHIN_NORMAL_LIMITS': 'Normal - no significant asymmetry between hemifields',
      'BORDERLINE': 'Borderline - minor asymmetry, monitor closely',
      'OUTSIDE_NORMAL_LIMITS': 'Abnormal - significant hemifield asymmetry consistent with glaucoma',
      'GENERAL_REDUCTION': 'Generalized reduction in sensitivity (cataract, small pupil, etc.)',
      'ABNORMALLY_HIGH': 'Abnormally high sensitivity (unreliable test)',
      'BORDERLINE_REDUCED': 'Borderline reduced sensitivity'
    };

    return {
      result: ghtResult,
      interpretation: interpretations[normalized] || `GHT result: ${ghtResult}`
    };
  }

  /**
   * Generate automatic interpretation
   */
  generateAutoInterpretation(eyeData, glaucomaStage) {
    const md = eyeData.globalIndices?.meanDeviation;
    const psd = eyeData.globalIndices?.patternStandardDeviation;
    const vfi = eyeData.globalIndices?.visualFieldIndex;
    const reliability = eyeData.reliability;

    let interpretation = [];

    // Reliability statement
    if (reliability?.reliabilityStatus === 'unreliable') {
      interpretation.push('ATTENTION: Fiabilité insuffisante - interpréter avec prudence.');
    } else if (reliability?.reliabilityStatus === 'low_reliability') {
      interpretation.push('Fiabilité limite - résultats à confirmer.');
    }

    // MD interpretation
    if (md !== null) {
      if (md >= 0) {
        interpretation.push(`Déviation moyenne (DM) ${md.toFixed(2)} dB : dans les limites normales.`);
      } else if (md > -6) {
        interpretation.push(`Déviation moyenne (DM) ${md.toFixed(2)} dB : déficit léger.`);
      } else if (md > -12) {
        interpretation.push(`Déviation moyenne (DM) ${md.toFixed(2)} dB : déficit modéré.`);
      } else {
        interpretation.push(`Déviation moyenne (DM) ${md.toFixed(2)} dB : déficit sévère.`);
      }
    }

    // PSD interpretation
    if (psd !== null && psd > 2) {
      interpretation.push(`Déviation standard du motif (DSM) ${psd.toFixed(2)} dB : déficit localisé significatif.`);
    }

    // VFI interpretation
    if (vfi !== null) {
      if (vfi >= 95) {
        interpretation.push(`Indice du champ visuel (VFI) ${vfi}% : champ visuel préservé.`);
      } else if (vfi >= 80) {
        interpretation.push(`Indice du champ visuel (VFI) ${vfi}% : perte légère à modérée.`);
      } else if (vfi >= 50) {
        interpretation.push(`Indice du champ visuel (VFI) ${vfi}% : perte modérée à sévère.`);
      } else {
        interpretation.push(`Indice du champ visuel (VFI) ${vfi}% : perte sévère.`);
      }
    }

    // Glaucoma staging
    if (glaucomaStage) {
      interpretation.push(`Classification glaucomateux: ${glaucomaStage.description}`);
    }

    return interpretation.join(' ') || 'Données insuffisantes pour interprétation automatique.';
  }

  /**
   * Generate clinical findings
   */
  generateFindings(eyeData, glaucomaStage) {
    const findings = [];
    const md = eyeData.globalIndices?.meanDeviation;
    const psd = eyeData.globalIndices?.patternStandardDeviation;
    const vfi = eyeData.globalIndices?.visualFieldIndex;
    const foveal = eyeData.foveal?.threshold;
    const reliability = eyeData.reliability;

    // Reliability findings
    if (reliability?.issues?.length > 0) {
      reliability.issues.forEach(issue => findings.push(issue));
    }

    // Global indices findings
    if (md !== null && md < -6) {
      findings.push('Déviation moyenne anormale - surveillance étroite recommandée');
    }

    if (psd !== null && psd > 3) {
      findings.push('DSM élevée suggérant un déficit localisé (scotome)');
    }

    if (vfi !== null && vfi < 80) {
      findings.push('VFI réduit - risque de progression');
    }

    // Foveal threshold
    if (foveal !== null) {
      if (foveal < 25) {
        findings.push('Sensibilité fovéale réduite - atteinte centrale possible');
      } else if (foveal < 30) {
        findings.push('Sensibilité fovéale limite');
      }
    }

    // Pattern-based findings (would need TD/PD analysis)
    const ghtResult = eyeData.globalIndices?.ghtResult;
    if (ghtResult) {
      const normalized = ghtResult.toString().toUpperCase();
      if (normalized.includes('OUTSIDE') || normalized.includes('ABNORMAL')) {
        findings.push('GHT anormal - asymétrie hémichamp typique du glaucome');
      }
    }

    // Staging recommendations
    if (glaucomaStage?.severity >= 3) {
      findings.push('Atteinte avancée - considérer intensification du traitement');
    }

    return findings;
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(data) {
    const reliability = this.calculateReliability(data);
    return reliability.score;
  }

  /**
   * Parse CSV format from Humphrey HFA export
   */
  parseCSV(content) {
    const rows = super.parseCSV(content);

    return rows.map(row => ({
      eye: row.Eye || row.eye || row.Laterality || (row.OD ? 'OD' : 'OS'),
      capturedAt: new Date(row.Date || row.ExamDate || row['Exam Date']),
      testPattern: row.Pattern || row.TestPattern || row['Test Pattern'] || '24-2',
      strategy: row.Strategy || row.TestStrategy || 'SITA-Standard',
      meanDeviation: parseFloat(row.MD || row.MeanDeviation || row['Mean Deviation']),
      patternStandardDeviation: parseFloat(row.PSD || row.PatternSD || row['Pattern Standard Deviation']),
      vfi: parseFloat(row.VFI || row.VisualFieldIndex),
      fovealThreshold: parseFloat(row.Fovea || row.Foveal || row['Foveal Threshold']),
      fixationLosses: row.FL || row.FixationLosses || row['Fixation Losses'],
      falsePositives: parseFloat(row.FP || row.FalsePos || row['False Positives']),
      falseNegatives: parseFloat(row.FN || row.FalseNeg || row['False Negatives']),
      ghtResult: row.GHT || row.GlaucomaHemifield,
      testDuration: parseFloat(row.Duration || row.TestDuration || row['Test Duration (min)']),
      sensitivities: row.Sensitivities || row.Thresholds,
      totalDeviation: row.TD || row.TotalDeviation,
      patternDeviation: row.PD || row.PatternDeviation
    }));
  }

  /**
   * Parse XML format (Humphrey HFA XML export)
   */
  parseXML(content) {
    if (Buffer.isBuffer(content)) {
      content = content.toString('utf-8');
    }

    const data = {};

    // Helper to extract XML values
    const extractValue = (tag, defaultValue = null) => {
      const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'gi');
      const match = content.match(regex);
      if (match && match.length > 0) {
        const innerMatch = match[0].match(/>([^<]*)</);
        return innerMatch ? innerMatch[1].trim() : defaultValue;
      }
      return defaultValue;
    };

    // Extract array values (for sensitivity data)
    const extractArray = (tag) => {
      const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        return matches.map(m => {
          const inner = m.match(/>([^<]*)</);
          return inner ? parseFloat(inner[1]) : null;
        }).filter(v => v !== null);
      }
      return null;
    };

    // Patient/exam info
    data.eye = extractValue('Laterality') || extractValue('Eye') || extractValue('EyeTested');
    data.capturedAt = extractValue('ExamDate') || extractValue('Date') || extractValue('TestDate');
    data.testPattern = extractValue('TestPattern') || extractValue('Pattern') || '24-2';
    data.strategy = extractValue('Strategy') || extractValue('TestStrategy') || 'SITA-Standard';

    // Global indices
    data.meanDeviation = parseFloat(extractValue('MD') || extractValue('MeanDeviation'));
    data.patternStandardDeviation = parseFloat(extractValue('PSD') || extractValue('PatternStandardDeviation'));
    data.vfi = parseFloat(extractValue('VFI') || extractValue('VisualFieldIndex'));
    data.fovealThreshold = parseFloat(extractValue('FovealThreshold') || extractValue('Fovea'));

    // Reliability
    data.fixationLosses = extractValue('FixationLosses') || extractValue('FL');
    data.falsePositives = parseFloat(extractValue('FalsePositives') || extractValue('FP'));
    data.falseNegatives = parseFloat(extractValue('FalseNegatives') || extractValue('FN'));

    // GHT
    data.ghtResult = extractValue('GHT') || extractValue('GlaucomaHemifieldTest');

    // Test info
    data.testDuration = parseFloat(extractValue('TestDuration') || extractValue('Duration'));

    // Sensitivity data (may be in various formats)
    data.sensitivities = extractArray('Threshold') || extractArray('Sensitivity');
    data.totalDeviation = extractArray('TotalDeviation') || extractArray('TD');
    data.patternDeviation = extractArray('PatternDeviation') || extractArray('PD');

    return data;
  }

  /**
   * Parse TXT format (simple text export)
   */
  parseTXT(content) {
    if (Buffer.isBuffer(content)) {
      content = content.toString('utf-8');
    }

    const data = {};
    const lines = content.split('\n');

    // Look for key-value pairs
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Try common patterns
      const colonMatch = trimmed.match(/^([^:]+):\s*(.+)$/);
      if (colonMatch) {
        const key = colonMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
        const value = colonMatch[2].trim();

        switch (key) {
          case 'eye':
          case 'laterality':
            data.eye = value.includes('R') || value.includes('OD') ? 'OD' : 'OS';
            break;
          case 'md':
          case 'mean_deviation':
            data.meanDeviation = parseFloat(value);
            break;
          case 'psd':
          case 'pattern_standard_deviation':
            data.patternStandardDeviation = parseFloat(value);
            break;
          case 'vfi':
          case 'visual_field_index':
            data.vfi = parseFloat(value);
            break;
          case 'fovea':
          case 'foveal':
            data.fovealThreshold = parseFloat(value);
            break;
          case 'fl':
          case 'fixation_losses':
            data.fixationLosses = value;
            break;
          case 'fp':
          case 'false_positives':
            data.falsePositives = parseFloat(value);
            break;
          case 'fn':
          case 'false_negatives':
            data.falseNegatives = parseFloat(value);
            break;
          case 'ght':
          case 'glaucoma_hemifield_test':
            data.ghtResult = value;
            break;
          case 'pattern':
          case 'test_pattern':
            data.testPattern = value;
            break;
        }
      }
    }

    return data;
  }
}

module.exports = VisualFieldAdapter;
