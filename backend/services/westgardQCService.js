/**
 * Westgard Quality Control Rules Engine
 * Implements Westgard multi-rules for laboratory QC evaluation
 */

const mongoose = require('mongoose');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('WestgardQC');

/**
 * QC Control Schema (if not exists in models)
 */
const QCResultSchema = new mongoose.Schema({
  analyzer: { type: String, required: true },
  testCode: { type: String, required: true },
  controlLevel: { type: String, enum: ['Level1', 'Level2', 'Level3'], required: true },
  measuredValue: { type: Number, required: true },
  targetMean: { type: Number, required: true },
  targetSD: { type: Number, required: true },
  runDate: { type: Date, default: Date.now },
  operator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lotNumber: { type: String },
  expirationDate: { type: Date },
  westgardEvaluation: {
    passed: Boolean,
    violations: [String],
    zScore: Number
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'warning'],
    default: 'pending'
  }
}, { timestamps: true });

// Check if model already exists before creating
const QCResult = mongoose.models.QCResult || mongoose.model('QCResult', QCResultSchema);

/**
 * Westgard Rules Definition
 * Standard multi-rule QC system
 */
const WESTGARD_RULES = {
  '1_2s': {
    name: '1:2s Warning',
    description: 'Single control exceeds mean ± 2SD',
    type: 'WARNING',
    evaluation: (zScores) => Math.abs(zScores[0]) > 2,
    action: 'Warning - inspect for random error, check other rules'
  },
  '1_3s': {
    name: '1:3s Rejection',
    description: 'Single control exceeds mean ± 3SD',
    type: 'REJECTION',
    evaluation: (zScores) => Math.abs(zScores[0]) > 3,
    action: 'Reject run - likely random error. Troubleshoot and repeat.'
  },
  '2_2s': {
    name: '2:2s Rejection',
    description: 'Two consecutive controls exceed mean + 2SD or mean - 2SD',
    type: 'REJECTION',
    evaluation: (zScores) => {
      if (zScores.length < 2) return false;
      return (zScores[0] > 2 && zScores[1] > 2) || (zScores[0] < -2 && zScores[1] < -2);
    },
    action: 'Reject run - systematic error detected. Check calibration.'
  },
  'R_4s': {
    name: 'R:4s Rejection',
    description: 'Range between two controls exceeds 4SD (one >+2SD, one <-2SD)',
    type: 'REJECTION',
    evaluation: (zScores) => {
      if (zScores.length < 2) return false;
      return (zScores[0] > 2 && zScores[1] < -2) || (zScores[0] < -2 && zScores[1] > 2);
    },
    action: 'Reject run - random error detected. Check for sample/reagent issues.'
  },
  '4_1s': {
    name: '4:1s Rejection',
    description: 'Four consecutive controls exceed mean + 1SD or mean - 1SD',
    type: 'REJECTION',
    evaluation: (zScores) => {
      if (zScores.length < 4) return false;
      const allPositive = zScores.slice(0, 4).every(z => z > 1);
      const allNegative = zScores.slice(0, 4).every(z => z < -1);
      return allPositive || allNegative;
    },
    action: 'Reject run - systematic shift. Check reagent lot, calibration.'
  },
  '10x': {
    name: '10x Trend',
    description: 'Ten consecutive controls on same side of mean',
    type: 'REJECTION',
    evaluation: (zScores) => {
      if (zScores.length < 10) return false;
      const allPositive = zScores.slice(0, 10).every(z => z > 0);
      const allNegative = zScores.slice(0, 10).every(z => z < 0);
      return allPositive || allNegative;
    },
    action: 'Reject run - systematic drift. Recalibrate instrument.'
  },
  '8x': {
    name: '8x Trend',
    description: 'Eight consecutive controls on same side of mean',
    type: 'WARNING',
    evaluation: (zScores) => {
      if (zScores.length < 8) return false;
      const allPositive = zScores.slice(0, 8).every(z => z > 0);
      const allNegative = zScores.slice(0, 8).every(z => z < 0);
      return allPositive || allNegative;
    },
    action: 'Warning - trend developing. Monitor closely, consider recalibration.'
  },
  '7T': {
    name: '7T Trend',
    description: 'Seven consecutive controls trending in one direction',
    type: 'WARNING',
    evaluation: (zScores) => {
      if (zScores.length < 7) return false;
      let increasing = true;
      let decreasing = true;
      for (let i = 1; i < 7; i++) {
        if (zScores[i] >= zScores[i - 1]) decreasing = false;
        if (zScores[i] <= zScores[i - 1]) increasing = false;
      }
      return increasing || decreasing;
    },
    action: 'Warning - consistent trend detected. Check for drift.'
  }
};

/**
 * Calculate Z-score
 * @param {Number} value - Measured value
 * @param {Number} mean - Target mean
 * @param {Number} sd - Target SD
 * @returns {Number} Z-score
 */
function calculateZScore(value, mean, sd) {
  if (sd === 0) return 0;
  return (value - mean) / sd;
}

/**
 * Evaluate QC result against Westgard rules
 * @param {Number} currentValue - Current QC value
 * @param {Number} targetMean - Target mean
 * @param {Number} targetSD - Target SD
 * @param {Array} previousValues - Previous QC values (most recent first)
 * @returns {Object} Evaluation result
 */
function evaluateWestgardRules(currentValue, targetMean, targetSD, previousValues = []) {
  // Calculate Z-scores
  const currentZScore = calculateZScore(currentValue, targetMean, targetSD);
  const previousZScores = previousValues.map(v => calculateZScore(v, targetMean, targetSD));

  // All Z-scores with current first
  const allZScores = [currentZScore, ...previousZScores];

  const violations = [];
  const warnings = [];
  let passed = true;

  // Evaluate each rule
  for (const [ruleCode, rule] of Object.entries(WESTGARD_RULES)) {
    if (rule.evaluation(allZScores)) {
      if (rule.type === 'REJECTION') {
        violations.push({
          rule: ruleCode,
          name: rule.name,
          description: rule.description,
          action: rule.action
        });
        passed = false;
      } else if (rule.type === 'WARNING') {
        warnings.push({
          rule: ruleCode,
          name: rule.name,
          description: rule.description,
          action: rule.action
        });
      }
    }
  }

  // Determine status
  let status = 'accepted';
  if (violations.length > 0) {
    status = 'rejected';
  } else if (warnings.length > 0) {
    status = 'warning';
  }

  return {
    passed,
    status,
    currentValue,
    targetMean,
    targetSD,
    zScore: parseFloat(currentZScore.toFixed(2)),
    violations,
    warnings,
    interpretation: generateInterpretation(currentZScore, violations, warnings),
    leveyJenningsPosition: getLJPosition(currentZScore),
    evaluatedAt: new Date()
  };
}

/**
 * Get Levey-Jennings chart position
 */
function getLJPosition(zScore) {
  if (zScore > 3) return { zone: '+3SD', color: 'red', position: 'extreme_high' };
  if (zScore > 2) return { zone: '+2SD to +3SD', color: 'orange', position: 'high' };
  if (zScore > 1) return { zone: '+1SD to +2SD', color: 'yellow', position: 'upper' };
  if (zScore >= -1) return { zone: '±1SD', color: 'green', position: 'normal' };
  if (zScore >= -2) return { zone: '-1SD to -2SD', color: 'yellow', position: 'lower' };
  if (zScore >= -3) return { zone: '-2SD to -3SD', color: 'orange', position: 'low' };
  return { zone: '-3SD', color: 'red', position: 'extreme_low' };
}

/**
 * Generate human-readable interpretation
 */
function generateInterpretation(zScore, violations, warnings) {
  if (violations.length > 0) {
    return `QC FAILURE: ${violations.map(v => v.name).join(', ')}. ` +
           'Patient results should NOT be released until issue is resolved. ' +
           `Z-score: ${zScore.toFixed(2)}`;
  }

  if (warnings.length > 0) {
    return `QC WARNING: ${warnings.map(w => w.name).join(', ')}. ` +
           'Monitor closely and review before releasing results. ' +
           `Z-score: ${zScore.toFixed(2)}`;
  }

  if (Math.abs(zScore) <= 1) {
    return `QC ACCEPTABLE: Value within ±1SD (Z-score: ${zScore.toFixed(2)}). Excellent precision.`;
  }

  if (Math.abs(zScore) <= 2) {
    return `QC ACCEPTABLE: Value within ±2SD (Z-score: ${zScore.toFixed(2)}). Acceptable performance.`;
  }

  return `QC ACCEPTABLE but borderline: Z-score ${zScore.toFixed(2)}. Monitor subsequent runs.`;
}

/**
 * Process QC run and save result
 * @param {Object} qcData - QC measurement data
 * @returns {Object} Processed QC result
 */
async function processQCRun(qcData) {
  try {
    const {
      analyzer,
      testCode,
      controlLevel,
      measuredValue,
      targetMean,
      targetSD,
      operator,
      lotNumber,
      expirationDate
    } = qcData;

    // Get previous QC values for trend analysis
    const previousResults = await QCResult.find({
      analyzer,
      testCode,
      controlLevel,
      status: { $in: ['accepted', 'warning'] }
    })
      .sort({ runDate: -1 })
      .limit(10)
      .lean();

    const previousValues = previousResults.map(r => r.measuredValue);

    // Evaluate against Westgard rules
    const evaluation = evaluateWestgardRules(
      measuredValue,
      targetMean,
      targetSD,
      previousValues
    );

    // Create QC result record
    const qcResult = new QCResult({
      analyzer,
      testCode,
      controlLevel,
      measuredValue,
      targetMean,
      targetSD,
      operator,
      lotNumber,
      expirationDate,
      westgardEvaluation: {
        passed: evaluation.passed,
        violations: evaluation.violations.map(v => v.rule),
        zScore: evaluation.zScore
      },
      status: evaluation.status
    });

    await qcResult.save();

    return {
      qcResultId: qcResult._id,
      ...evaluation,
      previousResultsCount: previousResults.length,
      savedAt: qcResult.createdAt
    };
  } catch (error) {
    log.error('Error processing QC run:', { error: error });
    throw new Error(`QC processing failed: ${error.message}`);
  }
}

/**
 * Get QC history for Levey-Jennings chart
 * @param {String} analyzer - Analyzer ID
 * @param {String} testCode - Test code
 * @param {String} controlLevel - Control level
 * @param {Number} days - Days of history (default 30)
 * @returns {Object} Chart data
 */
async function getQCChartData(analyzer, testCode, controlLevel, days = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await QCResult.find({
      analyzer,
      testCode,
      controlLevel,
      runDate: { $gte: startDate }
    })
      .sort({ runDate: 1 })
      .lean();

    if (results.length === 0) {
      return { data: [], stats: null };
    }

    // Calculate statistics
    const values = results.map(r => r.measuredValue);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const sd = Math.sqrt(variance);
    const cv = mean !== 0 ? (sd / mean) * 100 : 0;

    // Get target values from most recent
    const targetMean = results[results.length - 1].targetMean;
    const targetSD = results[results.length - 1].targetSD;

    // Build chart data
    const chartData = results.map(r => ({
      date: r.runDate,
      value: r.measuredValue,
      zScore: r.westgardEvaluation?.zScore || calculateZScore(r.measuredValue, targetMean, targetSD),
      status: r.status,
      violations: r.westgardEvaluation?.violations || []
    }));

    return {
      data: chartData,
      stats: {
        count: results.length,
        calculatedMean: parseFloat(mean.toFixed(2)),
        calculatedSD: parseFloat(sd.toFixed(3)),
        cv: parseFloat(cv.toFixed(2)),
        targetMean,
        targetSD,
        acceptedCount: results.filter(r => r.status === 'accepted').length,
        rejectedCount: results.filter(r => r.status === 'rejected').length,
        warningCount: results.filter(r => r.status === 'warning').length
      },
      chartLimits: {
        mean: targetMean,
        plus1SD: targetMean + targetSD,
        plus2SD: targetMean + 2 * targetSD,
        plus3SD: targetMean + 3 * targetSD,
        minus1SD: targetMean - targetSD,
        minus2SD: targetMean - 2 * targetSD,
        minus3SD: targetMean - 3 * targetSD
      }
    };
  } catch (error) {
    log.error('Error getting QC chart data:', { error: error });
    throw new Error(`Failed to get QC chart data: ${error.message}`);
  }
}

/**
 * Generate QC alert when rules violated
 * @param {Object} qcEvaluation - QC evaluation result
 * @returns {Object|null} Alert object
 */
function generateQCAlert(qcEvaluation) {
  if (qcEvaluation.passed && qcEvaluation.warnings.length === 0) {
    return null;
  }

  const isRejection = !qcEvaluation.passed;

  return {
    severity: isRejection ? 'URGENT' : 'WARNING',
    category: 'laboratory_qc',
    code: isRejection ? 'QC_REJECTION' : 'QC_WARNING',
    title: isRejection
      ? `QC Failure: ${qcEvaluation.violations.map(v => v.name).join(', ')}`
      : `QC Warning: ${qcEvaluation.warnings.map(w => w.name).join(', ')}`,
    message: qcEvaluation.interpretation,
    triggerField: 'qc.zScore',
    triggerValue: qcEvaluation.zScore,
    recommendedActions: isRejection ? [
      { action: 'Do NOT release patient results', priority: 1 },
      { action: 'Troubleshoot instrument/reagents', priority: 2 },
      { action: 'Repeat QC after corrective action', priority: 3 },
      { action: 'Document corrective actions taken', priority: 4 }
    ] : [
      { action: 'Review QC trend', priority: 1 },
      { action: 'Monitor next QC run closely', priority: 2 },
      { action: 'Consider preventive maintenance', priority: 3 }
    ],
    qcDetails: qcEvaluation
  };
}

/**
 * Get all Westgard rule definitions
 */
function getWestgardRules() {
  return WESTGARD_RULES;
}

module.exports = {
  calculateZScore,
  evaluateWestgardRules,
  processQCRun,
  getQCChartData,
  generateQCAlert,
  getWestgardRules,
  WESTGARD_RULES,
  QCResult
};
