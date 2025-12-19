/**
 * RNFL (Retinal Nerve Fiber Layer) Analysis Service
 * Analyzes OCT-derived RNFL thickness data for glaucoma detection and monitoring
 */

const OphthalmologyExam = require('../models/OphthalmologyExam');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('RnflAnalysis');

// Normal RNFL thickness values by age group (micrometers)
const RNFL_NORMATIVE_DATA = {
  '20-29': { global: 107, superior: 131, inferior: 138, nasal: 83, temporal: 76 },
  '30-39': { global: 103, superior: 127, inferior: 134, nasal: 80, temporal: 73 },
  '40-49': { global: 99, superior: 123, inferior: 130, nasal: 77, temporal: 70 },
  '50-59': { global: 95, superior: 119, inferior: 126, nasal: 74, temporal: 67 },
  '60-69': { global: 91, superior: 115, inferior: 122, nasal: 71, temporal: 64 },
  '70+': { global: 87, superior: 111, inferior: 118, nasal: 68, temporal: 61 }
};

// Standard deviations for percentile calculations
const RNFL_STD_DEV = {
  global: 10,
  superior: 14,
  inferior: 15,
  nasal: 11,
  temporal: 9
};

const NORMAL_AGING_RATE = 0.5; // μm/year - normal age-related loss
const PATHOLOGICAL_RATE = 1.0; // μm/year - suggests glaucomatous damage

/**
 * Get age group for normative data lookup
 */
function getAgeGroup(age) {
  if (age < 30) return '20-29';
  if (age < 40) return '30-39';
  if (age < 50) return '40-49';
  if (age < 60) return '50-59';
  if (age < 70) return '60-69';
  return '70+';
}

/**
 * Calculate Z-score
 */
function calculateZScore(value, mean, stdDev) {
  return (value - mean) / stdDev;
}

/**
 * Convert Z-score to percentile using standard normal distribution
 */
function zScoreToPercentile(zScore) {
  const t = 1 / (1 + 0.2316419 * Math.abs(zScore));
  const d = 0.3989423 * Math.exp(-zScore * zScore / 2);
  const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return zScore >= 0 ? (1 - probability) * 100 : probability * 100;
}

/**
 * Classify percentile into categories
 */
function classifyPercentile(percentile) {
  if (percentile >= 5) return 'NORMAL';
  if (percentile >= 1) return 'ABNORMAL';
  return 'SEVERELY_ABNORMAL';
}

/**
 * Analyze RNFL thickness data
 * @param {Object} rnflData - RNFL measurements { global, superior, inferior, nasal, temporal }
 * @param {Number} patientAge - Patient age in years
 * @returns {Object} Analysis results
 */
function analyzeRNFL(rnflData, patientAge) {
  try {
    const ageGroup = getAgeGroup(patientAge);
    const normativeData = RNFL_NORMATIVE_DATA[ageGroup];
    const sectors = ['global', 'superior', 'inferior', 'nasal', 'temporal'];
    const sectorAnalysis = [];
    const abnormalSectors = [];

    for (const sector of sectors) {
      const measuredValue = rnflData[sector];
      if (measuredValue === undefined || measuredValue === null) continue;

      const expectedValue = normativeData[sector];
      const stdDev = RNFL_STD_DEV[sector];
      const zScore = calculateZScore(measuredValue, expectedValue, stdDev);
      const percentile = zScoreToPercentile(zScore);
      const classification = classifyPercentile(percentile);

      const sectorResult = {
        sector,
        measured: measuredValue,
        expected: expectedValue,
        deviation: measuredValue - expectedValue,
        zScore: parseFloat(zScore.toFixed(2)),
        percentile: parseFloat(percentile.toFixed(1)),
        classification
      };

      sectorAnalysis.push(sectorResult);

      if (classification !== 'NORMAL') {
        abnormalSectors.push({
          sector,
          classification,
          percentile: sectorResult.percentile,
          deviation: sectorResult.deviation
        });
      }
    }

    // Determine overall severity
    let severity = 'NORMAL';
    let interpretation = 'RNFL thickness measurements are within normal limits for age.';

    const severelyAbnormalCount = abnormalSectors.filter(s => s.classification === 'SEVERELY_ABNORMAL').length;
    const abnormalCount = abnormalSectors.filter(s => s.classification === 'ABNORMAL').length;

    if (severelyAbnormalCount >= 2) {
      severity = 'SEVERE';
      interpretation = `Significant RNFL thinning detected in ${severelyAbnormalCount} sectors. Highly suspicious for glaucomatous damage. Recommend visual field testing and IOP assessment.`;
    } else if (severelyAbnormalCount === 1) {
      severity = 'MODERATE';
      const affectedSector = abnormalSectors.find(s => s.classification === 'SEVERELY_ABNORMAL');
      interpretation = `Severe RNFL thinning in ${affectedSector.sector} sector (<1st percentile). Suspicious for glaucoma. Correlate with visual field and clinical exam.`;
    } else if (abnormalCount >= 2) {
      severity = 'MODERATE';
      interpretation = `RNFL thinning detected in ${abnormalCount} sectors (<5th percentile). Consider glaucoma evaluation with visual field testing.`;
    } else if (abnormalCount === 1) {
      severity = 'MILD';
      interpretation = `Borderline RNFL thinning in ${abnormalSectors[0].sector} sector. Monitor and correlate with other glaucoma parameters.`;
    }

    return {
      global: sectorAnalysis.find(s => s.sector === 'global'),
      sectors: sectorAnalysis,
      abnormalSectors,
      severity,
      interpretation,
      ageGroup,
      analysisDate: new Date()
    };
  } catch (error) {
    log.error('Error in RNFL analysis:', { error: error });
    throw new Error(`RNFL analysis failed: ${error.message}`);
  }
}

/**
 * Detect RNFL progression over time
 * @param {String} patientId - Patient ID
 * @param {String} eye - 'OD' or 'OS'
 * @returns {Object} Progression analysis
 */
async function detectRNFLProgression(patientId, eye) {
  try {
    // Get all OCT scans with RNFL data for this patient/eye
    const exams = await OphthalmologyExam.find({
      patient: patientId,
      [`rnfl.${eye}.global`]: { $exists: true, $ne: null }
    })
      .sort({ examDate: 1 })
      .select(`examDate rnfl.${eye}`)
      .lean();

    if (exams.length < 2) {
      return {
        progressionRate: null,
        isProgressing: false,
        confidence: 'INSUFFICIENT_DATA',
        recommendation: 'At least 2 OCT scans required to assess progression. Schedule follow-up OCT.',
        examsAnalyzed: exams.length
      };
    }

    // Build data points
    const dataPoints = exams.map(exam => ({
      date: new Date(exam.examDate),
      global: exam.rnfl[eye].global,
      timeFromBaseline: 0
    }));

    // Calculate time from baseline in years
    const baselineDate = dataPoints[0].date;
    dataPoints.forEach(point => {
      point.timeFromBaseline = (point.date - baselineDate) / (1000 * 60 * 60 * 24 * 365.25);
    });

    // Linear regression for slope
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, p) => sum + p.timeFromBaseline, 0);
    const sumY = dataPoints.reduce((sum, p) => sum + p.global, 0);
    const sumXY = dataPoints.reduce((sum, p) => sum + p.timeFromBaseline * p.global, 0);
    const sumX2 = dataPoints.reduce((sum, p) => sum + p.timeFromBaseline * p.timeFromBaseline, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const meanY = sumY / n;
    const ssTotal = dataPoints.reduce((sum, p) => sum + Math.pow(p.global - meanY, 2), 0);
    const ssResidual = dataPoints.reduce((sum, p) => {
      const predicted = intercept + slope * p.timeFromBaseline;
      return sum + Math.pow(p.global - predicted, 2);
    }, 0);
    const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

    // Interpret results
    const progressionRate = Math.abs(slope);
    let isProgressing = false;
    let confidence = 'LOW';
    let recommendation = '';

    if (progressionRate < NORMAL_AGING_RATE) {
      confidence = 'HIGH';
      recommendation = 'Rate of RNFL change consistent with normal aging (~0.5 μm/year). Continue routine annual monitoring.';
    } else if (progressionRate < PATHOLOGICAL_RATE) {
      isProgressing = slope < 0; // Only progressing if thinning
      confidence = rSquared > 0.7 ? 'MODERATE' : 'LOW';
      recommendation = 'Mild RNFL thinning beyond normal aging. Consider more frequent monitoring (6 months) and optimize IOP control.';
    } else {
      isProgressing = slope < 0;
      confidence = rSquared > 0.7 ? 'HIGH' : 'MODERATE';
      recommendation = 'Significant RNFL progression detected (>1 μm/year). Urgent review of glaucoma management. Consider treatment intensification.';
    }

    // Calculate time to critical threshold (50 μm)
    const currentRNFL = dataPoints[n - 1].global;
    const yearsToThreshold = slope < 0 ? (currentRNFL - 50) / Math.abs(slope) : null;

    return {
      progressionRate: parseFloat(progressionRate.toFixed(2)),
      slope: parseFloat(slope.toFixed(2)),
      isProgressing,
      confidence,
      rSquared: parseFloat(rSquared.toFixed(3)),
      recommendation,
      examsAnalyzed: n,
      timespan: parseFloat(dataPoints[n - 1].timeFromBaseline.toFixed(1)),
      baselineRNFL: dataPoints[0].global,
      currentRNFL,
      totalChange: parseFloat((currentRNFL - dataPoints[0].global).toFixed(1)),
      yearsToThreshold: yearsToThreshold ? parseFloat(yearsToThreshold.toFixed(1)) : null,
      dataPoints: dataPoints.map(p => ({
        date: p.date,
        global: p.global,
        yearsFromBaseline: parseFloat(p.timeFromBaseline.toFixed(2))
      }))
    };
  } catch (error) {
    log.error('Error detecting RNFL progression:', { error: error });
    throw new Error(`RNFL progression detection failed: ${error.message}`);
  }
}

/**
 * Generate RNFL clinical alert if warranted
 * @param {String} patientId - Patient ID
 * @param {Object} rnflData - Current RNFL data
 * @param {Number} patientAge - Patient age
 * @param {String} eye - 'OD' or 'OS'
 * @returns {Object|null} Alert object or null
 */
async function generateRNFLAlert(patientId, rnflData, patientAge, eye) {
  try {
    const analysis = analyzeRNFL(rnflData, patientAge);
    const progression = await detectRNFLProgression(patientId, eye);

    let alertNeeded = false;
    let severity = 'INFO';
    let code = 'GLAUCOMA_SUSPECT';
    let title = '';
    let message = '';
    const recommendedActions = [];

    // Check for severe thinning
    if (analysis.severity === 'SEVERE') {
      alertNeeded = true;
      severity = 'URGENT';
      code = 'RNFL_SEVERE_THINNING';
      title = `Severe RNFL Thinning Detected - ${eye}`;
      message = `${analysis.interpretation} ${analysis.abnormalSectors.length} sectors affected.`;
      recommendedActions.push(
        { action: 'Immediate clinical correlation required', priority: 1 },
        { action: 'Review IOP and visual field data', priority: 2 },
        { action: 'Consider glaucoma specialist referral', priority: 3 }
      );
    } else if (analysis.severity === 'MODERATE') {
      alertNeeded = true;
      severity = 'WARNING';
      code = 'RNFL_MODERATE_THINNING';
      title = `Moderate RNFL Thinning Detected - ${eye}`;
      message = analysis.interpretation;
      recommendedActions.push(
        { action: 'Clinical correlation recommended', priority: 1 },
        { action: 'Review other glaucoma parameters', priority: 2 }
      );
    }

    // Check for progression
    if (progression.isProgressing && progression.confidence !== 'LOW') {
      alertNeeded = true;
      if (progression.progressionRate >= PATHOLOGICAL_RATE) {
        severity = severity === 'URGENT' ? 'URGENT' : 'WARNING';
        code = 'RNFL_PROGRESSION';
        title = title || `Significant RNFL Progression - ${eye}`;
        message += ` Progression rate: ${progression.progressionRate} μm/year (pathological >1.0).`;
        recommendedActions.push(
          { action: 'Review and optimize IOP control', priority: 1 },
          { action: 'Consider treatment adjustment', priority: 2 }
        );

        if (progression.yearsToThreshold && progression.yearsToThreshold < 5) {
          recommendedActions.push(
            { action: `Critical threshold (50μm) may be reached in ~${progression.yearsToThreshold} years`, priority: 3 }
          );
        }
      }
    }

    if (!alertNeeded) return null;

    return {
      patient: patientId,
      severity,
      category: 'clinical',
      code,
      title,
      message,
      eye,
      triggerField: `rnfl.${eye}.global`,
      triggerValue: `${analysis.global?.measured} μm`,
      recommendedActions,
      analysis,
      progression
    };
  } catch (error) {
    log.error('Error generating RNFL alert:', { error: error });
    throw new Error(`Failed to generate RNFL alert: ${error.message}`);
  }
}

/**
 * Complete RNFL assessment
 */
async function performRNFLAssessment(patientId, rnflData, patientAge, eye, examId) {
  try {
    const analysis = analyzeRNFL(rnflData, patientAge);
    const progression = await detectRNFLProgression(patientId, eye);
    const alert = await generateRNFLAlert(patientId, rnflData, patientAge, eye);

    return {
      analysis,
      progression,
      alert,
      assessmentDate: new Date()
    };
  } catch (error) {
    log.error('Error in RNFL assessment:', { error: error });
    throw new Error(`RNFL assessment failed: ${error.message}`);
  }
}

module.exports = {
  analyzeRNFL,
  detectRNFLProgression,
  generateRNFLAlert,
  performRNFLAssessment,
  RNFL_NORMATIVE_DATA,
  NORMAL_AGING_RATE,
  PATHOLOGICAL_RATE
};
