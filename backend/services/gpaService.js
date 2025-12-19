/**
 * Glaucoma Progression Analysis (GPA) Service
 * Analyzes visual field data for glaucoma progression using GPA algorithm
 */

const OphthalmologyExam = require('../models/OphthalmologyExam');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('Gpa');

// GPA Analysis Constants
const MIN_EXAMS_FOR_GPA = 3;
const MIN_EXAMS_FOR_TREND = 5;
const SIGNIFICANCE_THRESHOLD = 0.05; // p < 0.05
const PROGRESSION_THRESHOLD = -1.0; // dB/year for MD
const PATTERN_DEVIATION_CUTOFF = -5; // dB

// Visual Field Zones (24-2 pattern)
const VF_ZONES = {
  central: [3, 4, 9, 10, 15, 16, 21, 22, 27, 28, 33, 34, 39, 40, 45, 46],
  superior: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  inferior: [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52],
  nasal: [5, 6, 11, 12, 17, 18, 23, 24, 29, 30, 35, 36, 41, 42, 47, 48],
  temporal: [1, 2, 7, 8, 13, 14, 19, 20, 25, 26, 31, 32, 37, 38, 43, 44]
};

// Hodapp-Parrish-Anderson staging criteria
const HPA_STAGING = {
  early: {
    mdRange: [-6, 0],
    pdPoints: { p5: 18, p1: 10 },
    centralPoints: 0
  },
  moderate: {
    mdRange: [-12, -6],
    pdPoints: { p5: 37, p1: 20 },
    centralPoints: 1
  },
  severe: {
    mdRange: [-Infinity, -12],
    pdPoints: { p5: 37, p1: 20 },
    centralPoints: 2
  }
};

/**
 * Perform GPA analysis on visual field data
 * @param {String} patientId - Patient ID
 * @param {String} eye - 'OD' or 'OS'
 * @returns {Object} GPA analysis results
 */
async function performGPAAnalysis(patientId, eye) {
  try {
    // Get all visual field exams for this patient/eye
    const exams = await OphthalmologyExam.find({
      patient: patientId,
      [`visualField.${eye}.md`]: { $exists: true, $ne: null }
    })
      .sort({ examDate: 1 })
      .select(`examDate visualField.${eye}`)
      .lean();

    if (exams.length < MIN_EXAMS_FOR_GPA) {
      return {
        status: 'INSUFFICIENT_DATA',
        examsAvailable: exams.length,
        examsRequired: MIN_EXAMS_FOR_GPA,
        recommendation: `At least ${MIN_EXAMS_FOR_GPA} visual field exams required for GPA analysis. Schedule follow-up VF testing.`
      };
    }

    // Extract data points
    const dataPoints = exams.map(exam => ({
      date: new Date(exam.examDate),
      md: exam.visualField[eye].md,
      psd: exam.visualField[eye].psd,
      vfi: exam.visualField[eye].vfi,
      totalDeviation: exam.visualField[eye].totalDeviation || [],
      patternDeviation: exam.visualField[eye].patternDeviation || [],
      reliability: {
        fixationLosses: exam.visualField[eye].fixationLosses,
        falsePositives: exam.visualField[eye].falsePositives,
        falseNegatives: exam.visualField[eye].falseNegatives
      }
    }));

    // Filter reliable exams (FL < 20%, FP < 15%, FN < 33%)
    const reliableExams = dataPoints.filter(exam => {
      const fl = exam.reliability.fixationLosses || 0;
      const fp = exam.reliability.falsePositives || 0;
      const fn = exam.reliability.falseNegatives || 0;
      return fl < 20 && fp < 15 && fn < 33;
    });

    if (reliableExams.length < MIN_EXAMS_FOR_GPA) {
      return {
        status: 'INSUFFICIENT_RELIABLE_DATA',
        totalExams: exams.length,
        reliableExams: reliableExams.length,
        recommendation: 'Insufficient reliable visual field data. Repeat testing with better patient attention/fixation.'
      };
    }

    // Establish baseline (first 2 reliable exams)
    const baseline = {
      md: (reliableExams[0].md + reliableExams[1].md) / 2,
      psd: (reliableExams[0].psd + reliableExams[1].psd) / 2,
      vfi: reliableExams[0].vfi && reliableExams[1].vfi
        ? (reliableExams[0].vfi + reliableExams[1].vfi) / 2
        : null,
      date: reliableExams[0].date
    };

    // Calculate progression metrics
    const mdProgression = analyzeProgression(reliableExams.map(e => ({
      date: e.date,
      value: e.md
    })));

    const vfiProgression = reliableExams[0].vfi ? analyzeProgression(reliableExams.map(e => ({
      date: e.date,
      value: e.vfi
    }))) : null;

    // Pointwise analysis for pattern deviation
    const pointwiseAnalysis = analyzePointwise(reliableExams);

    // Determine HPA staging
    const latestExam = reliableExams[reliableExams.length - 1];
    const staging = determineHPAStage(latestExam.md, pointwiseAnalysis);

    // Determine overall progression status
    const progressionStatus = determineProgressionStatus(mdProgression, vfiProgression, pointwiseAnalysis);

    // Generate clinical interpretation
    const interpretation = generateInterpretation(progressionStatus, staging, mdProgression);

    return {
      status: 'COMPLETE',
      eye,
      baseline,
      currentMD: latestExam.md,
      currentPSD: latestExam.psd,
      currentVFI: latestExam.vfi,
      mdProgression: {
        slope: parseFloat(mdProgression.slope.toFixed(3)),
        slopeUnit: 'dB/year',
        rSquared: parseFloat(mdProgression.rSquared.toFixed(3)),
        pValue: mdProgression.pValue,
        isSignificant: mdProgression.pValue < SIGNIFICANCE_THRESHOLD,
        totalChange: parseFloat((latestExam.md - baseline.md).toFixed(2))
      },
      vfiProgression: vfiProgression ? {
        slope: parseFloat(vfiProgression.slope.toFixed(2)),
        slopeUnit: '%/year',
        rSquared: parseFloat(vfiProgression.rSquared.toFixed(3)),
        totalChange: parseFloat((latestExam.vfi - baseline.vfi).toFixed(1))
      } : null,
      pointwiseAnalysis: {
        progressingPoints: pointwiseAnalysis.progressingPoints,
        stablePoints: pointwiseAnalysis.stablePoints,
        improvingPoints: pointwiseAnalysis.improvingPoints,
        significantClusters: pointwiseAnalysis.clusters
      },
      staging,
      progressionStatus,
      interpretation,
      examsAnalyzed: reliableExams.length,
      timespan: calculateTimespan(reliableExams[0].date, latestExam.date),
      dataPoints: reliableExams.map(e => ({
        date: e.date,
        md: e.md,
        psd: e.psd,
        vfi: e.vfi
      })),
      analysisDate: new Date()
    };
  } catch (error) {
    log.error('Error in GPA analysis:', { error: error });
    throw new Error(`GPA analysis failed: ${error.message}`);
  }
}

/**
 * Analyze progression using linear regression
 */
function analyzeProgression(dataPoints) {
  if (dataPoints.length < 2) {
    return { slope: 0, rSquared: 0, pValue: 1, isProgressing: false };
  }

  // Convert dates to years from baseline
  const baselineDate = dataPoints[0].date;
  const points = dataPoints.map(p => ({
    x: (p.date - baselineDate) / (1000 * 60 * 60 * 24 * 365.25),
    y: p.value
  }));

  // Linear regression
  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);
  const sumY2 = points.reduce((sum, p) => sum + p.y * p.y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const meanY = sumY / n;
  const ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
  const ssResidual = points.reduce((sum, p) => {
    const predicted = intercept + slope * p.x;
    return sum + Math.pow(p.y - predicted, 2);
  }, 0);
  const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

  // Calculate p-value using t-distribution approximation
  const se = Math.sqrt(ssResidual / (n - 2));
  const slopeError = se / Math.sqrt(sumX2 - (sumX * sumX) / n);
  const tStatistic = Math.abs(slope / slopeError);
  const pValue = calculatePValue(tStatistic, n - 2);

  return {
    slope,
    intercept,
    rSquared,
    pValue,
    isProgressing: slope < PROGRESSION_THRESHOLD && pValue < SIGNIFICANCE_THRESHOLD
  };
}

/**
 * Approximate p-value from t-statistic
 */
function calculatePValue(t, df) {
  // Using approximation for two-tailed p-value
  const x = df / (df + t * t);
  const a = df / 2;
  const b = 0.5;

  // Simplified beta function approximation
  if (t < 0.001) return 1;
  if (t > 10) return 0.0001;

  // Rough approximation based on common t-values
  if (t >= 3.5) return 0.001;
  if (t >= 2.5) return 0.02;
  if (t >= 2.0) return 0.05;
  if (t >= 1.7) return 0.1;
  if (t >= 1.3) return 0.2;
  return 0.3;
}

/**
 * Pointwise analysis of pattern deviation
 */
function analyzePointwise(exams) {
  const progressingPoints = [];
  const stablePoints = [];
  const improvingPoints = [];
  const clusters = [];

  // For each point, check if it shows consistent deterioration
  if (exams[0].patternDeviation && exams[0].patternDeviation.length > 0) {
    const numPoints = exams[0].patternDeviation.length;

    for (let pointIndex = 0; pointIndex < numPoints; pointIndex++) {
      const pointValues = exams.map(e => e.patternDeviation[pointIndex] || 0);

      // Check if point shows significant deterioration
      const firstValue = pointValues[0];
      const lastValue = pointValues[pointValues.length - 1];
      const change = lastValue - firstValue;

      if (change <= PATTERN_DEVIATION_CUTOFF) {
        progressingPoints.push({
          index: pointIndex,
          change,
          zone: getPointZone(pointIndex)
        });
      } else if (change >= 3) {
        improvingPoints.push({ index: pointIndex, change });
      } else {
        stablePoints.push(pointIndex);
      }
    }

    // Identify clusters of progressing points
    const zoneProgression = {};
    for (const point of progressingPoints) {
      if (!zoneProgression[point.zone]) {
        zoneProgression[point.zone] = [];
      }
      zoneProgression[point.zone].push(point);
    }

    for (const [zone, points] of Object.entries(zoneProgression)) {
      if (points.length >= 3) {
        clusters.push({
          zone,
          pointCount: points.length,
          averageChange: points.reduce((sum, p) => sum + p.change, 0) / points.length
        });
      }
    }
  }

  return {
    progressingPoints: progressingPoints.length,
    stablePoints: stablePoints.length,
    improvingPoints: improvingPoints.length,
    clusters,
    hasSignificantProgression: progressingPoints.length >= 3 || clusters.length > 0
  };
}

/**
 * Get zone for a visual field point
 */
function getPointZone(pointIndex) {
  if (VF_ZONES.central.includes(pointIndex)) return 'central';
  if (VF_ZONES.superior.includes(pointIndex) && !VF_ZONES.central.includes(pointIndex)) return 'superior';
  if (VF_ZONES.inferior.includes(pointIndex) && !VF_ZONES.central.includes(pointIndex)) return 'inferior';
  return 'peripheral';
}

/**
 * Determine Hodapp-Parrish-Anderson stage
 */
function determineHPAStage(md, pointwiseAnalysis) {
  let stage = 'EARLY';
  let description = 'Early glaucomatous damage';

  if (md <= -12) {
    stage = 'SEVERE';
    description = 'Severe glaucomatous damage';
  } else if (md <= -6) {
    stage = 'MODERATE';
    description = 'Moderate glaucomatous damage';
  } else if (md > -6 && pointwiseAnalysis.progressingPoints < 10) {
    stage = 'EARLY';
    description = 'Early glaucomatous damage or suspect';
  }

  // Check for central involvement
  const centralProgression = pointwiseAnalysis.clusters?.find(c => c.zone === 'central');
  const hasCentralInvolvement = centralProgression && centralProgression.pointCount >= 2;

  return {
    stage,
    description,
    md,
    hasCentralInvolvement,
    centralThreat: hasCentralInvolvement ? 'ELEVATED' : 'LOW'
  };
}

/**
 * Determine overall progression status
 */
function determineProgressionStatus(mdProgression, vfiProgression, pointwiseAnalysis) {
  let status = 'STABLE';
  let confidence = 'HIGH';
  let urgency = 'ROUTINE';

  // Check MD progression
  const mdProgressing = mdProgression.isProgressing;
  const mdRapid = mdProgression.slope < -1.5;

  // Check VFI progression
  const vfiProgressing = vfiProgression?.slope < -2;

  // Check pointwise
  const pointwiseProgressing = pointwiseAnalysis.hasSignificantProgression;

  if (mdRapid || (mdProgressing && vfiProgressing && pointwiseProgressing)) {
    status = 'RAPID_PROGRESSION';
    confidence = mdProgression.rSquared > 0.7 ? 'HIGH' : 'MODERATE';
    urgency = 'URGENT';
  } else if (mdProgressing && (vfiProgressing || pointwiseProgressing)) {
    status = 'LIKELY_PROGRESSION';
    confidence = 'MODERATE';
    urgency = 'SOON';
  } else if (mdProgressing || pointwiseProgressing) {
    status = 'POSSIBLE_PROGRESSION';
    confidence = 'LOW';
    urgency = 'MONITOR';
  } else if (pointwiseAnalysis.improvingPoints > pointwiseAnalysis.progressingPoints) {
    status = 'IMPROVING';
    confidence = 'MODERATE';
    urgency = 'ROUTINE';
  }

  return { status, confidence, urgency };
}

/**
 * Generate clinical interpretation
 */
function generateInterpretation(progressionStatus, staging, mdProgression) {
  let interpretation = '';
  const recommendations = [];

  switch (progressionStatus.status) {
    case 'RAPID_PROGRESSION':
      interpretation = `ALERT: Rapid visual field progression detected (${Math.abs(mdProgression.slope).toFixed(2)} dB/year). `;
      interpretation += `Current staging: ${staging.stage}. `;
      recommendations.push('Urgent IOP assessment and medication review');
      recommendations.push('Consider surgical intervention if medical therapy maximized');
      recommendations.push('Repeat visual field in 3-4 months');
      break;

    case 'LIKELY_PROGRESSION':
      interpretation = `Visual field progression likely (${Math.abs(mdProgression.slope).toFixed(2)} dB/year). `;
      interpretation += `${staging.stage} glaucoma with consistent deterioration pattern. `;
      recommendations.push('Review and optimize IOP control');
      recommendations.push('Consider adding/changing glaucoma medications');
      recommendations.push('Repeat visual field in 4-6 months');
      break;

    case 'POSSIBLE_PROGRESSION':
      interpretation = 'Possible visual field progression noted. Continue monitoring. ';
      interpretation += `Current staging: ${staging.stage}. `;
      recommendations.push('Maintain current treatment');
      recommendations.push('Repeat visual field in 6 months');
      recommendations.push('Correlate with OCT RNFL data');
      break;

    case 'IMPROVING':
      interpretation = 'Visual field appears stable or improving. ';
      recommendations.push('Continue current management');
      recommendations.push('Routine follow-up');
      break;

    default:
      interpretation = `Visual field stable. ${staging.stage} glaucoma. `;
      recommendations.push('Continue current treatment');
      recommendations.push('Annual visual field monitoring');
  }

  if (staging.hasCentralInvolvement) {
    interpretation += 'CAUTION: Central visual field involvement detected. ';
    recommendations.unshift('Priority: Protect central vision - consider aggressive IOP lowering');
  }

  return { summary: interpretation, recommendations };
}

/**
 * Calculate timespan in years
 */
function calculateTimespan(startDate, endDate) {
  const msPerYear = 1000 * 60 * 60 * 24 * 365.25;
  return parseFloat(((endDate - startDate) / msPerYear).toFixed(1));
}

/**
 * Generate GPA alert if progression detected
 */
async function generateGPAAlert(patientId, eye, gpaResult) {
  if (!gpaResult || gpaResult.status !== 'COMPLETE') return null;

  const { progressionStatus, staging, mdProgression } = gpaResult;

  if (progressionStatus.status === 'STABLE' || progressionStatus.status === 'IMPROVING') {
    return null;
  }

  let severity = 'INFO';
  let code = 'VF_POSSIBLE_PROGRESSION';
  let title = `Visual Field Changes - ${eye}`;

  if (progressionStatus.status === 'RAPID_PROGRESSION') {
    severity = 'URGENT';
    code = 'VF_RAPID_PROGRESSION';
    title = `URGENT: Rapid VF Progression - ${eye}`;
  } else if (progressionStatus.status === 'LIKELY_PROGRESSION') {
    severity = 'WARNING';
    code = 'VF_LIKELY_PROGRESSION';
    title = `Visual Field Progression Detected - ${eye}`;
  }

  const recommendedActions = gpaResult.interpretation.recommendations.map((rec, idx) => ({
    action: rec,
    priority: idx + 1
  }));

  return {
    patient: patientId,
    severity,
    category: 'clinical',
    code,
    title,
    message: gpaResult.interpretation.summary,
    eye,
    triggerField: `visualField.${eye}.md`,
    triggerValue: `MD: ${gpaResult.currentMD} dB, Slope: ${mdProgression.slope.toFixed(2)} dB/year`,
    recommendedActions,
    gpaResult
  };
}

/**
 * Complete GPA assessment with alert generation
 */
async function performCompleteGPAAssessment(patientId, eye) {
  try {
    const gpaResult = await performGPAAnalysis(patientId, eye);
    const alert = await generateGPAAlert(patientId, eye, gpaResult);

    return {
      gpaResult,
      alert,
      assessmentDate: new Date()
    };
  } catch (error) {
    log.error('Error in complete GPA assessment:', { error: error });
    throw new Error(`Complete GPA assessment failed: ${error.message}`);
  }
}

module.exports = {
  performGPAAnalysis,
  generateGPAAlert,
  performCompleteGPAAssessment,
  HPA_STAGING,
  VF_ZONES,
  MIN_EXAMS_FOR_GPA,
  PROGRESSION_THRESHOLD
};
