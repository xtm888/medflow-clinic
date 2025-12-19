/**
 * IVT Patient Compliance Tracking Service
 * Monitors patient adherence to intravitreal injection schedules
 */

const IVTInjection = require('../models/IVTInjection');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('IvtCompliance');

/**
 * Treatment protocols by medication and indication
 */
const TREATMENT_PROTOCOLS = {
  'aflibercept_amd': {
    medication: 'Aflibercept',
    indication: 'AMD',
    loadingPhase: {
      injections: 3,
      intervalWeeks: 4,
      description: 'Monthly injections for first 3 months'
    },
    maintenancePhase: {
      intervalWeeks: 8,
      treatAndExtend: true,
      minInterval: 4,
      maxInterval: 12,
      description: 'Every 8 weeks, adjustable based on response'
    }
  },
  'aflibercept_dme': {
    medication: 'Aflibercept',
    indication: 'DME',
    loadingPhase: {
      injections: 5,
      intervalWeeks: 4,
      description: 'Monthly injections for first 5 months'
    },
    maintenancePhase: {
      intervalWeeks: 8,
      treatAndExtend: true,
      minInterval: 4,
      maxInterval: 16,
      description: 'Every 8 weeks after loading phase'
    }
  },
  'ranibizumab_amd': {
    medication: 'Ranibizumab',
    indication: 'AMD',
    loadingPhase: {
      injections: 3,
      intervalWeeks: 4,
      description: 'Monthly injections for first 3 months'
    },
    maintenancePhase: {
      intervalWeeks: 4,
      treatAndExtend: true,
      minInterval: 4,
      maxInterval: 12,
      description: 'Monthly PRN or treat-and-extend'
    }
  },
  'bevacizumab_all': {
    medication: 'Bevacizumab',
    indication: 'Various',
    loadingPhase: {
      injections: 3,
      intervalWeeks: 4,
      description: 'Monthly injections for first 3 months'
    },
    maintenancePhase: {
      intervalWeeks: 4,
      treatAndExtend: true,
      minInterval: 4,
      maxInterval: 12,
      description: 'Monthly PRN or treat-and-extend'
    }
  },
  'faricimab_amd': {
    medication: 'Faricimab',
    indication: 'AMD',
    loadingPhase: {
      injections: 4,
      intervalWeeks: 4,
      description: 'Monthly injections for first 4 months'
    },
    maintenancePhase: {
      intervalWeeks: 16,
      treatAndExtend: true,
      minInterval: 8,
      maxInterval: 16,
      description: 'Extended intervals up to 16 weeks possible'
    }
  }
};

/**
 * Compliance thresholds
 */
const COMPLIANCE_THRESHOLDS = {
  excellent: 90,
  good: 75,
  fair: 60,
  poor: 0
};

/**
 * Get patient's IVT treatment compliance
 * @param {String} patientId - Patient ID
 * @param {String} eye - 'OD' or 'OS' (optional, for both if not specified)
 * @returns {Object} Compliance analysis
 */
async function getPatientCompliance(patientId, eye = null) {
  try {
    const query = { patient: patientId, status: 'completed' };
    if (eye) query.eye = eye;

    // Get all completed injections
    const injections = await IVTInjection.find(query)
      .sort({ injectionDate: 1 })
      .lean();

    if (injections.length === 0) {
      return {
        patientId,
        totalInjections: 0,
        complianceRate: null,
        status: 'NO_TREATMENT_HISTORY'
      };
    }

    // Get scheduled appointments (both completed and missed)
    const scheduledAppointments = await Appointment.find({
      patient: patientId,
      type: 'ivt',
      status: { $in: ['completed', 'no_show', 'cancelled'] }
    }).lean();

    // Calculate metrics
    const completedAppointments = scheduledAppointments.filter(a => a.status === 'completed').length;
    const missedAppointments = scheduledAppointments.filter(a => a.status === 'no_show').length;
    const cancelledAppointments = scheduledAppointments.filter(a => a.status === 'cancelled').length;

    const appointmentComplianceRate = scheduledAppointments.length > 0
      ? ((completedAppointments / (completedAppointments + missedAppointments)) * 100)
      : 100;

    // Analyze injection intervals
    const intervalAnalysis = analyzeInjectionIntervals(injections);

    // Determine treatment phase
    const treatmentPhase = determineTreatmentPhase(injections);

    // Calculate overall compliance score
    const complianceScore = calculateComplianceScore(
      appointmentComplianceRate,
      intervalAnalysis,
      missedAppointments
    );

    return {
      patientId,
      eye: eye || 'both',
      summary: {
        totalInjections: injections.length,
        firstInjection: injections[0].injectionDate,
        lastInjection: injections[injections.length - 1].injectionDate,
        treatmentDurationMonths: calculateMonthsDuration(
          injections[0].injectionDate,
          injections[injections.length - 1].injectionDate
        ),
        currentMedication: injections[injections.length - 1].medication
      },
      appointmentMetrics: {
        totalScheduled: scheduledAppointments.length,
        completed: completedAppointments,
        missed: missedAppointments,
        cancelled: cancelledAppointments,
        appointmentComplianceRate: appointmentComplianceRate.toFixed(1)
      },
      intervalAnalysis,
      treatmentPhase,
      complianceScore: {
        score: complianceScore,
        rating: getComplianceRating(complianceScore),
        interpretation: getComplianceInterpretation(complianceScore)
      },
      recommendations: generateComplianceRecommendations(
        complianceScore,
        missedAppointments,
        intervalAnalysis
      ),
      analysisDate: new Date()
    };
  } catch (error) {
    log.error('Error calculating patient compliance:', { error: error });
    throw new Error(`Compliance calculation failed: ${error.message}`);
  }
}

/**
 * Analyze injection intervals
 */
function analyzeInjectionIntervals(injections) {
  if (injections.length < 2) {
    return {
      averageInterval: null,
      intervalVariability: null,
      delayedInjections: 0
    };
  }

  const intervals = [];
  let delayedCount = 0;

  for (let i = 1; i < injections.length; i++) {
    const prev = new Date(injections[i - 1].injectionDate);
    const current = new Date(injections[i].injectionDate);
    const intervalDays = Math.round((current - prev) / (1000 * 60 * 60 * 24));
    intervals.push(intervalDays);

    // Consider injection delayed if > 35 days (allowing 1 week buffer from monthly)
    if (intervalDays > 35) {
      delayedCount++;
    }
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);

  return {
    averageIntervalDays: Math.round(avgInterval),
    minIntervalDays: Math.min(...intervals),
    maxIntervalDays: Math.max(...intervals),
    intervalVariability: stdDev.toFixed(1),
    delayedInjections: delayedCount,
    intervalConsistency: stdDev < 7 ? 'CONSISTENT' : stdDev < 14 ? 'VARIABLE' : 'INCONSISTENT'
  };
}

/**
 * Determine treatment phase
 */
function determineTreatmentPhase(injections) {
  const injectionCount = injections.length;
  const medication = injections[injections.length - 1]?.medication?.toLowerCase() || '';
  const indication = injections[injections.length - 1]?.indication?.toLowerCase() || '';

  // Find matching protocol
  let protocol = null;
  for (const [key, p] of Object.entries(TREATMENT_PROTOCOLS)) {
    if (medication.includes(p.medication.toLowerCase())) {
      protocol = p;
      break;
    }
  }

  if (!protocol) {
    protocol = TREATMENT_PROTOCOLS.bevacizumab_all; // Default
  }

  const loadingComplete = injectionCount >= protocol.loadingPhase.injections;

  return {
    phase: loadingComplete ? 'MAINTENANCE' : 'LOADING',
    injectionCount,
    loadingPhaseInjections: protocol.loadingPhase.injections,
    loadingPhaseComplete: loadingComplete,
    currentInterval: loadingComplete
      ? protocol.maintenancePhase.intervalWeeks
      : protocol.loadingPhase.intervalWeeks,
    protocolDescription: loadingComplete
      ? protocol.maintenancePhase.description
      : protocol.loadingPhase.description
  };
}

/**
 * Calculate overall compliance score
 */
function calculateComplianceScore(appointmentRate, intervalAnalysis, missedCount) {
  let score = appointmentRate;

  // Deduct points for delayed injections
  if (intervalAnalysis.delayedInjections > 0) {
    score -= intervalAnalysis.delayedInjections * 5;
  }

  // Deduct points for missed appointments
  score -= missedCount * 10;

  // Bonus for consistency
  if (intervalAnalysis.intervalConsistency === 'CONSISTENT') {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Get compliance rating
 */
function getComplianceRating(score) {
  if (score >= COMPLIANCE_THRESHOLDS.excellent) return 'EXCELLENT';
  if (score >= COMPLIANCE_THRESHOLDS.good) return 'GOOD';
  if (score >= COMPLIANCE_THRESHOLDS.fair) return 'FAIR';
  return 'POOR';
}

/**
 * Get compliance interpretation
 */
function getComplianceInterpretation(score) {
  if (score >= COMPLIANCE_THRESHOLDS.excellent) {
    return 'Excellent treatment adherence. Patient is following the recommended injection schedule closely.';
  }
  if (score >= COMPLIANCE_THRESHOLDS.good) {
    return 'Good treatment adherence with minor deviations. Continue to encourage consistent follow-up.';
  }
  if (score >= COMPLIANCE_THRESHOLDS.fair) {
    return 'Fair treatment adherence. Some appointments missed or delayed. Discuss barriers to compliance.';
  }
  return 'Poor treatment adherence. Significant risk of suboptimal outcomes. Intervention needed.';
}

/**
 * Generate compliance recommendations
 */
function generateComplianceRecommendations(score, missedCount, intervalAnalysis) {
  const recommendations = [];

  if (score < COMPLIANCE_THRESHOLDS.good) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Schedule patient education session about importance of regular injections'
    });
  }

  if (missedCount > 2) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Assess barriers to appointment attendance (transportation, cost, scheduling)'
    });
    recommendations.push({
      priority: 'MEDIUM',
      action: 'Consider reminder calls 48 hours before appointments'
    });
  }

  if (intervalAnalysis.delayedInjections > 2) {
    recommendations.push({
      priority: 'MEDIUM',
      action: 'Review if current injection interval is appropriate for patient'
    });
  }

  if (intervalAnalysis.intervalConsistency === 'INCONSISTENT') {
    recommendations.push({
      priority: 'MEDIUM',
      action: 'Establish consistent appointment scheduling pattern'
    });
  }

  if (score >= COMPLIANCE_THRESHOLDS.excellent) {
    recommendations.push({
      priority: 'LOW',
      action: 'Maintain current follow-up schedule. Consider treat-and-extend protocol if stable.'
    });
  }

  return recommendations;
}

/**
 * Calculate months between two dates
 */
function calculateMonthsDuration(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.round((end - start) / (1000 * 60 * 60 * 24 * 30.44));
}

/**
 * Get patients with compliance issues
 * @param {String} clinicId - Clinic ID
 * @param {Number} threshold - Compliance threshold (default 75)
 * @returns {Array} Patients with compliance issues
 */
async function getPatientsWithComplianceIssues(clinicId, threshold = 75) {
  try {
    // Get patients with IVT treatment
    const ivtPatients = await IVTInjection.distinct('patient', { clinic: clinicId });

    const patientsWithIssues = [];

    for (const patientId of ivtPatients) {
      const compliance = await getPatientCompliance(patientId);

      if (compliance.complianceScore && compliance.complianceScore.score < threshold) {
        const patient = await Patient.findById(patientId)
          .select('firstName lastName medicalRecordNumber phone')
          .lean();

        patientsWithIssues.push({
          patient,
          complianceScore: compliance.complianceScore.score,
          rating: compliance.complianceScore.rating,
          missedAppointments: compliance.appointmentMetrics?.missed || 0,
          lastInjection: compliance.summary?.lastInjection,
          recommendations: compliance.recommendations
        });
      }
    }

    // Sort by compliance score (lowest first)
    patientsWithIssues.sort((a, b) => a.complianceScore - b.complianceScore);

    return {
      patientsWithIssues,
      totalPatients: ivtPatients.length,
      patientsWithIssuesCount: patientsWithIssues.length,
      threshold,
      generatedAt: new Date()
    };
  } catch (error) {
    log.error('Error getting patients with compliance issues:', { error: error });
    throw new Error(`Failed to get compliance issues: ${error.message}`);
  }
}

/**
 * Generate compliance alert for a patient
 */
function generateComplianceAlert(patientId, complianceData) {
  if (complianceData.complianceScore.score >= COMPLIANCE_THRESHOLDS.good) {
    return null;
  }

  const severity = complianceData.complianceScore.score < COMPLIANCE_THRESHOLDS.fair
    ? 'WARNING' : 'INFO';

  return {
    patient: patientId,
    severity,
    category: 'compliance',
    code: 'IVT_COMPLIANCE_ISSUE',
    title: `IVT Treatment Compliance Issue - ${complianceData.complianceScore.rating}`,
    message: complianceData.complianceScore.interpretation,
    triggerField: 'complianceScore',
    triggerValue: `${complianceData.complianceScore.score}%`,
    recommendedActions: complianceData.recommendations.map((rec, idx) => ({
      action: rec.action,
      priority: idx + 1
    })),
    complianceData
  };
}

module.exports = {
  getPatientCompliance,
  getPatientsWithComplianceIssues,
  generateComplianceAlert,
  analyzeInjectionIntervals,
  determineTreatmentPhase,
  TREATMENT_PROTOCOLS,
  COMPLIANCE_THRESHOLDS
};
