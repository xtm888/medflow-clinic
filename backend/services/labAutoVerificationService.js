/**
 * Laboratory Auto-Verification Rules Engine
 * Automatically verifies lab results that meet predefined criteria
 */

const LabResult = require('../models/LabResult');
const Patient = require('../models/Patient');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('LabAutoVerification');

/**
 * Auto-verification rules by test category
 */
const AUTO_VERIFY_RULES = {
  // Chemistry Panel
  glucose: {
    name: 'Glucose',
    unit: 'mg/dL',
    normalRange: { min: 70, max: 100 },
    autoVerifyRange: { min: 40, max: 400 },
    criticalLow: 40,
    criticalHigh: 500,
    deltaCheck: { percent: 50, absoluteChange: 100 }
  },
  creatinine: {
    name: 'Creatinine',
    unit: 'mg/dL',
    normalRange: { min: 0.6, max: 1.2 },
    autoVerifyRange: { min: 0.3, max: 5.0 },
    criticalLow: null,
    criticalHigh: 10.0,
    deltaCheck: { percent: 50, absoluteChange: 2.0 }
  },
  bun: {
    name: 'BUN',
    unit: 'mg/dL',
    normalRange: { min: 7, max: 20 },
    autoVerifyRange: { min: 3, max: 80 },
    criticalLow: null,
    criticalHigh: 100,
    deltaCheck: { percent: 100, absoluteChange: 30 }
  },
  sodium: {
    name: 'Sodium',
    unit: 'mEq/L',
    normalRange: { min: 136, max: 145 },
    autoVerifyRange: { min: 125, max: 155 },
    criticalLow: 120,
    criticalHigh: 160,
    deltaCheck: { percent: 10, absoluteChange: 10 }
  },
  potassium: {
    name: 'Potassium',
    unit: 'mEq/L',
    normalRange: { min: 3.5, max: 5.0 },
    autoVerifyRange: { min: 3.0, max: 6.0 },
    criticalLow: 2.5,
    criticalHigh: 6.5,
    deltaCheck: { percent: 20, absoluteChange: 1.0 }
  },
  chloride: {
    name: 'Chloride',
    unit: 'mEq/L',
    normalRange: { min: 98, max: 106 },
    autoVerifyRange: { min: 85, max: 120 },
    criticalLow: 80,
    criticalHigh: 120,
    deltaCheck: { percent: 15, absoluteChange: 10 }
  },
  co2: {
    name: 'CO2',
    unit: 'mEq/L',
    normalRange: { min: 22, max: 29 },
    autoVerifyRange: { min: 15, max: 40 },
    criticalLow: 10,
    criticalHigh: 40,
    deltaCheck: { percent: 30, absoluteChange: 8 }
  },
  calcium: {
    name: 'Calcium',
    unit: 'mg/dL',
    normalRange: { min: 8.5, max: 10.5 },
    autoVerifyRange: { min: 7.0, max: 13.0 },
    criticalLow: 6.0,
    criticalHigh: 14.0,
    deltaCheck: { percent: 15, absoluteChange: 2.0 }
  },

  // Liver Function
  ast: {
    name: 'AST',
    unit: 'U/L',
    normalRange: { min: 10, max: 40 },
    autoVerifyRange: { min: 5, max: 500 },
    criticalLow: null,
    criticalHigh: 1000,
    deltaCheck: { percent: 100, absoluteChange: 200 }
  },
  alt: {
    name: 'ALT',
    unit: 'U/L',
    normalRange: { min: 7, max: 56 },
    autoVerifyRange: { min: 5, max: 500 },
    criticalLow: null,
    criticalHigh: 1000,
    deltaCheck: { percent: 100, absoluteChange: 200 }
  },
  alkalinePhosphatase: {
    name: 'Alkaline Phosphatase',
    unit: 'U/L',
    normalRange: { min: 44, max: 147 },
    autoVerifyRange: { min: 20, max: 500 },
    criticalLow: null,
    criticalHigh: null,
    deltaCheck: { percent: 50, absoluteChange: 100 }
  },
  totalBilirubin: {
    name: 'Total Bilirubin',
    unit: 'mg/dL',
    normalRange: { min: 0.1, max: 1.2 },
    autoVerifyRange: { min: 0.1, max: 10.0 },
    criticalLow: null,
    criticalHigh: 15.0,
    deltaCheck: { percent: 100, absoluteChange: 5.0 }
  },

  // Hematology
  wbc: {
    name: 'WBC',
    unit: 'K/uL',
    normalRange: { min: 4.5, max: 11.0 },
    autoVerifyRange: { min: 2.0, max: 30.0 },
    criticalLow: 1.0,
    criticalHigh: 50.0,
    deltaCheck: { percent: 50, absoluteChange: 5.0 }
  },
  hemoglobin: {
    name: 'Hemoglobin',
    unit: 'g/dL',
    normalRange: { min: 12.0, max: 17.5 },
    autoVerifyRange: { min: 7.0, max: 20.0 },
    criticalLow: 7.0,
    criticalHigh: 20.0,
    deltaCheck: { percent: 20, absoluteChange: 2.0 }
  },
  hematocrit: {
    name: 'Hematocrit',
    unit: '%',
    normalRange: { min: 36, max: 50 },
    autoVerifyRange: { min: 20, max: 60 },
    criticalLow: 20,
    criticalHigh: 60,
    deltaCheck: { percent: 20, absoluteChange: 6 }
  },
  platelets: {
    name: 'Platelets',
    unit: 'K/uL',
    normalRange: { min: 150, max: 400 },
    autoVerifyRange: { min: 50, max: 600 },
    criticalLow: 20,
    criticalHigh: 1000,
    deltaCheck: { percent: 50, absoluteChange: 100 }
  },

  // Coagulation
  pt: {
    name: 'PT',
    unit: 'seconds',
    normalRange: { min: 11, max: 13.5 },
    autoVerifyRange: { min: 9, max: 20 },
    criticalLow: null,
    criticalHigh: 30,
    deltaCheck: { percent: 30, absoluteChange: 5 }
  },
  inr: {
    name: 'INR',
    unit: 'ratio',
    normalRange: { min: 0.8, max: 1.2 },
    autoVerifyRange: { min: 0.8, max: 4.5 }, // Higher for warfarin patients
    criticalLow: null,
    criticalHigh: 5.0,
    deltaCheck: { percent: 30, absoluteChange: 1.0 }
  },
  ptt: {
    name: 'PTT',
    unit: 'seconds',
    normalRange: { min: 25, max: 35 },
    autoVerifyRange: { min: 20, max: 60 },
    criticalLow: null,
    criticalHigh: 100,
    deltaCheck: { percent: 50, absoluteChange: 20 }
  },

  // Thyroid
  tsh: {
    name: 'TSH',
    unit: 'mIU/L',
    normalRange: { min: 0.4, max: 4.0 },
    autoVerifyRange: { min: 0.05, max: 20 },
    criticalLow: 0.01,
    criticalHigh: 50,
    deltaCheck: { percent: 100, absoluteChange: 5 }
  },

  // Cardiac
  troponin: {
    name: 'Troponin',
    unit: 'ng/mL',
    normalRange: { min: 0, max: 0.04 },
    autoVerifyRange: null, // Never auto-verify troponin
    criticalLow: null,
    criticalHigh: 0.1,
    deltaCheck: null
  },
  bnp: {
    name: 'BNP',
    unit: 'pg/mL',
    normalRange: { min: 0, max: 100 },
    autoVerifyRange: { min: 0, max: 1000 },
    criticalLow: null,
    criticalHigh: 5000,
    deltaCheck: { percent: 50, absoluteChange: 500 }
  },

  // HbA1c
  hba1c: {
    name: 'HbA1c',
    unit: '%',
    normalRange: { min: 4.0, max: 5.6 },
    autoVerifyRange: { min: 4.0, max: 14.0 },
    criticalLow: null,
    criticalHigh: 15.0,
    deltaCheck: { percent: 20, absoluteChange: 2.0 }
  }
};

/**
 * Tests that should NEVER be auto-verified
 */
const NEVER_AUTO_VERIFY = [
  'troponin',
  'bloodCulture',
  'csf',
  'bodyFluid',
  'synovialFluid',
  'bonemarrow'
];

/**
 * Patient conditions that disable auto-verification
 */
const AUTO_VERIFY_EXCLUSIONS = [
  'dialysis',
  'transplant',
  'chemotherapy',
  'pregnancy',
  'newborn',
  'icu'
];

/**
 * Evaluate if a result can be auto-verified
 * @param {String} testCode - Test code
 * @param {Number} value - Result value
 * @param {Object} previousResult - Previous result for delta check
 * @param {Object} patientContext - Patient context (conditions, age, etc.)
 * @returns {Object} Auto-verification evaluation
 */
function evaluateAutoVerification(testCode, value, previousResult = null, patientContext = {}) {
  const result = {
    canAutoVerify: true,
    reasons: [],
    flags: [],
    requiresManualReview: false,
    criticalValue: false
  };

  // Check if test is in never auto-verify list
  if (NEVER_AUTO_VERIFY.includes(testCode.toLowerCase())) {
    result.canAutoVerify = false;
    result.requiresManualReview = true;
    result.reasons.push(`${testCode} requires manual verification`);
    return result;
  }

  // Get rule for this test
  const rule = AUTO_VERIFY_RULES[testCode.toLowerCase()];
  if (!rule) {
    result.canAutoVerify = false;
    result.reasons.push('No auto-verification rule defined for this test');
    return result;
  }

  // Check patient exclusions
  if (patientContext.conditions) {
    const hasExclusion = AUTO_VERIFY_EXCLUSIONS.some(exc =>
      patientContext.conditions.some(c =>
        c.toLowerCase().includes(exc)
      )
    );
    if (hasExclusion) {
      result.canAutoVerify = false;
      result.reasons.push('Patient condition requires manual review');
      return result;
    }
  }

  // Check critical values
  if (rule.criticalLow !== null && value <= rule.criticalLow) {
    result.canAutoVerify = false;
    result.criticalValue = true;
    result.requiresManualReview = true;
    result.flags.push('CRITICAL_LOW');
    result.reasons.push(`Critical low value: ${value} <= ${rule.criticalLow} ${rule.unit}`);
  }

  if (rule.criticalHigh !== null && value >= rule.criticalHigh) {
    result.canAutoVerify = false;
    result.criticalValue = true;
    result.requiresManualReview = true;
    result.flags.push('CRITICAL_HIGH');
    result.reasons.push(`Critical high value: ${value} >= ${rule.criticalHigh} ${rule.unit}`);
  }

  // Check auto-verify range
  if (rule.autoVerifyRange) {
    if (value < rule.autoVerifyRange.min || value > rule.autoVerifyRange.max) {
      result.canAutoVerify = false;
      result.flags.push('OUTSIDE_AUTO_VERIFY_RANGE');
      result.reasons.push(`Value ${value} outside auto-verify range (${rule.autoVerifyRange.min}-${rule.autoVerifyRange.max})`);
    }
  } else {
    // No auto-verify range means never auto-verify
    result.canAutoVerify = false;
    result.reasons.push('Test not eligible for auto-verification');
  }

  // Delta check
  if (previousResult && rule.deltaCheck) {
    const previousValue = previousResult.value;
    const absoluteChange = Math.abs(value - previousValue);
    const percentChange = previousValue !== 0
      ? (absoluteChange / previousValue) * 100
      : absoluteChange > 0 ? 100 : 0;

    if (absoluteChange > rule.deltaCheck.absoluteChange ||
        percentChange > rule.deltaCheck.percent) {
      result.canAutoVerify = false;
      result.flags.push('DELTA_CHECK_FAILED');
      result.reasons.push(
        `Delta check failed: ${percentChange.toFixed(1)}% change (limit: ${rule.deltaCheck.percent}%), ` +
        `absolute change: ${absoluteChange.toFixed(2)} (limit: ${rule.deltaCheck.absoluteChange})`
      );
    }
  }

  // Flag abnormal values even if auto-verified
  if (value < rule.normalRange.min) {
    result.flags.push('BELOW_NORMAL');
  } else if (value > rule.normalRange.max) {
    result.flags.push('ABOVE_NORMAL');
  }

  return result;
}

/**
 * Get patient's previous result for delta check
 * @param {String} patientId - Patient ID
 * @param {String} testCode - Test code
 * @param {Number} daysBack - Days to look back (default 7)
 * @returns {Object|null} Previous result
 */
async function getPreviousResult(patientId, testCode, daysBack = 7) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const previousResult = await LabResult.findOne({
      patient: patientId,
      testCode: testCode,
      collectionDate: { $gte: cutoffDate },
      status: { $in: ['verified', 'auto_verified'] }
    })
      .sort({ collectionDate: -1 })
      .lean();

    return previousResult;
  } catch (error) {
    log.error('Error getting previous result:', { error: error });
    return null;
  }
}

/**
 * Process lab result for auto-verification
 * @param {Object} labResult - Lab result object
 * @param {Object} patientContext - Patient context
 * @returns {Object} Processing result
 */
async function processAutoVerification(labResult, patientContext = {}) {
  try {
    const results = [];

    // Process each test in the result
    for (const test of labResult.tests || [labResult]) {
      const testCode = test.testCode || test.code;
      const value = parseFloat(test.value);

      if (isNaN(value)) {
        results.push({
          testCode,
          canAutoVerify: false,
          reason: 'Non-numeric result requires manual review'
        });
        continue;
      }

      // Get previous result for delta check
      const previousResult = await getPreviousResult(
        labResult.patient,
        testCode,
        7
      );

      // Evaluate auto-verification
      const evaluation = evaluateAutoVerification(
        testCode,
        value,
        previousResult,
        patientContext
      );

      results.push({
        testCode,
        value,
        ...evaluation,
        previousValue: previousResult?.value,
        rule: AUTO_VERIFY_RULES[testCode.toLowerCase()]
      });
    }

    // Overall verification decision
    const canAutoVerifyAll = results.every(r => r.canAutoVerify);
    const hasCritical = results.some(r => r.criticalValue);
    const requiresManual = results.some(r => r.requiresManualReview);

    return {
      labResultId: labResult._id,
      patientId: labResult.patient,
      canAutoVerify: canAutoVerifyAll,
      hasCriticalValues: hasCritical,
      requiresManualReview: requiresManual,
      testResults: results,
      verificationStatus: canAutoVerifyAll ? 'AUTO_VERIFIED' :
        hasCritical ? 'CRITICAL_PENDING' : 'PENDING_REVIEW',
      processedAt: new Date()
    };
  } catch (error) {
    log.error('Error in auto-verification processing:', { error: error });
    throw new Error(`Auto-verification failed: ${error.message}`);
  }
}

/**
 * Generate critical value alert
 * @param {String} patientId - Patient ID
 * @param {Object} criticalResult - Critical result data
 * @returns {Object} Alert object
 */
async function generateCriticalAlert(patientId, criticalResult) {
  try {
    const patient = await Patient.findById(patientId)
      .select('firstName lastName medicalRecordNumber')
      .lean();

    return {
      patient: patientId,
      severity: 'EMERGENCY',
      category: 'laboratory',
      code: 'CRITICAL_LAB_VALUE',
      title: `CRITICAL: ${criticalResult.testCode} - ${criticalResult.value}`,
      message: `Critical lab value detected for ${patient?.firstName} ${patient?.lastName}. ` +
               `${criticalResult.reasons.join('. ')}. Immediate clinical correlation required.`,
      triggerField: `lab.${criticalResult.testCode}`,
      triggerValue: `${criticalResult.value} ${criticalResult.rule?.unit || ''}`,
      recommendedActions: [
        { action: 'Verify result and notify ordering physician immediately', priority: 1 },
        { action: 'Document read-back acknowledgment', priority: 2 },
        { action: 'Clinical correlation and intervention as needed', priority: 3 }
      ],
      criticalResult
    };
  } catch (error) {
    log.error('Error generating critical alert:', { error: error });
    throw new Error(`Failed to generate critical alert: ${error.message}`);
  }
}

/**
 * Get auto-verification statistics
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} Statistics
 */
async function getAutoVerificationStats(startDate, endDate) {
  try {
    const stats = await LabResult.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$verificationStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = stats.reduce((sum, s) => sum + s.count, 0);
    const autoVerified = stats.find(s => s._id === 'auto_verified')?.count || 0;

    return {
      totalResults: total,
      autoVerified,
      manuallyVerified: stats.find(s => s._id === 'verified')?.count || 0,
      pendingReview: stats.find(s => s._id === 'pending')?.count || 0,
      criticalPending: stats.find(s => s._id === 'critical_pending')?.count || 0,
      autoVerificationRate: total > 0 ? ((autoVerified / total) * 100).toFixed(1) : 0,
      period: { startDate, endDate }
    };
  } catch (error) {
    log.error('Error getting auto-verification stats:', { error: error });
    throw new Error(`Failed to get statistics: ${error.message}`);
  }
}

/**
 * Get all auto-verification rules
 */
function getAllRules() {
  return AUTO_VERIFY_RULES;
}

/**
 * Get rule for specific test
 */
function getRule(testCode) {
  return AUTO_VERIFY_RULES[testCode.toLowerCase()] || null;
}

module.exports = {
  evaluateAutoVerification,
  getPreviousResult,
  processAutoVerification,
  generateCriticalAlert,
  getAutoVerificationStats,
  getAllRules,
  getRule,
  AUTO_VERIFY_RULES,
  NEVER_AUTO_VERIFY,
  AUTO_VERIFY_EXCLUSIONS
};
