/**
 * Surgeon Performance Analytics Service
 * Tracks and analyzes surgical outcomes and performance metrics
 */

const SurgeryCase = require('../models/SurgeryCase');
const SurgicalSafetyChecklist = require('../models/SurgicalSafetyChecklist');
const User = require('../models/User');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('SurgeonAnalytics');

/**
 * Performance metrics categories
 */
const METRICS_CATEGORIES = {
  volume: {
    name: 'Case Volume',
    metrics: ['totalCases', 'casesByType', 'casesByMonth', 'casesTrend']
  },
  outcomes: {
    name: 'Clinical Outcomes',
    metrics: ['successRate', 'complicationRate', 'revisionRate', 'visualAcuityOutcomes']
  },
  efficiency: {
    name: 'Efficiency',
    metrics: ['averageDuration', 'onTimeStart', 'turnoverTime', 'casesPerDay']
  },
  safety: {
    name: 'Safety',
    metrics: ['checklistCompliance', 'infectionRate', 'adverseEvents', 'nearMisses']
  },
  patient: {
    name: 'Patient Satisfaction',
    metrics: ['satisfactionScore', 'complications', 'readmissions']
  }
};

/**
 * Get comprehensive surgeon performance report
 * @param {String} surgeonId - Surgeon user ID
 * @param {Date} startDate - Report start date
 * @param {Date} endDate - Report end date
 * @returns {Object} Performance report (empty results on error)
 */
async function getSurgeonPerformanceReport(surgeonId, startDate, endDate) {
  try {
    // Get all cases for this surgeon in the date range
    const cases = await SurgeryCase.find({
      surgeon: surgeonId,
      scheduledDate: { $gte: startDate, $lte: endDate },
      status: { $in: ['completed', 'cancelled'] }
    }).lean();

    const completedCases = cases.filter(c => c.status === 'completed');
    const cancelledCases = cases.filter(c => c.status === 'cancelled');

    // Get checklists for compliance metrics
    const checklists = await SurgicalSafetyChecklist.find({
      surgeon: surgeonId,
      scheduledDate: { $gte: startDate, $lte: endDate }
    }).lean();

    // Calculate metrics
    const volumeMetrics = calculateVolumeMetrics(completedCases, startDate, endDate);
    const outcomeMetrics = calculateOutcomeMetrics(completedCases);
    const efficiencyMetrics = calculateEfficiencyMetrics(completedCases);
    const safetyMetrics = calculateSafetyMetrics(completedCases, checklists);

    // Get benchmarks for comparison
    const benchmarks = await getSurgeonBenchmarks(startDate, endDate);

    // Calculate percentile rankings
    const rankings = calculateRankings(
      { volumeMetrics, outcomeMetrics, efficiencyMetrics, safetyMetrics },
      benchmarks
    );

    return {
      success: true,
      surgeonId,
      reportPeriod: { startDate, endDate },
      summary: {
        totalCases: cases.length,
        completedCases: completedCases.length,
        cancelledCases: cancelledCases.length,
        cancellationRate: cases.length > 0
          ? ((cancelledCases.length / cases.length) * 100).toFixed(1)
          : 0
      },
      volumeMetrics,
      outcomeMetrics,
      efficiencyMetrics,
      safetyMetrics,
      rankings,
      benchmarks,
      generatedAt: new Date()
    };
  } catch (error) {
    log.error('Error generating surgeon performance report:', {
      error: error.message,
      surgeonId: String(surgeonId),
      startDate,
      endDate
    });
    // Return empty report structure on error
    return {
      success: false,
      error: 'Erreur lors de la génération du rapport',
      surgeonId,
      reportPeriod: { startDate, endDate },
      summary: {
        totalCases: 0,
        completedCases: 0,
        cancelledCases: 0,
        cancellationRate: 0
      },
      volumeMetrics: { totalCases: 0, casesByType: {}, casesByMonth: {}, trend: 'unknown', averagePerMonth: 0 },
      outcomeMetrics: { successRate: null, complicationRate: null, revisionRate: null, totalComplications: 0 },
      efficiencyMetrics: { averageDuration: null, onTimeStartRate: null, averageTurnoverTime: null },
      safetyMetrics: { checklistCompletionRate: null, averageChecklistCompliance: null, adverseEventRate: null },
      rankings: null,
      benchmarks: null,
      generatedAt: new Date()
    };
  }
}

/**
 * Calculate volume metrics
 */
function calculateVolumeMetrics(cases, startDate, endDate) {
  // Cases by procedure type
  const casesByType = {};
  for (const c of cases) {
    const type = c.procedureType || 'Other';
    casesByType[type] = (casesByType[type] || 0) + 1;
  }

  // Cases by month
  const casesByMonth = {};
  for (const c of cases) {
    const month = new Date(c.scheduledDate).toISOString().substring(0, 7);
    casesByMonth[month] = (casesByMonth[month] || 0) + 1;
  }

  // Calculate trend
  const months = Object.keys(casesByMonth).sort((a, b) => a.localeCompare(b));
  let trend = 'stable';
  if (months.length >= 3) {
    const recentAvg = (casesByMonth[months[months.length - 1]] + casesByMonth[months[months.length - 2]]) / 2;
    const earlierAvg = (casesByMonth[months[0]] + casesByMonth[months[1]]) / 2;
    if (recentAvg > earlierAvg * 1.1) trend = 'increasing';
    else if (recentAvg < earlierAvg * 0.9) trend = 'decreasing';
  }

  return {
    totalCases: cases.length,
    casesByType,
    casesByMonth,
    trend,
    averagePerMonth: months.length > 0
      ? (cases.length / months.length).toFixed(1)
      : 0
  };
}

/**
 * Calculate outcome metrics
 */
function calculateOutcomeMetrics(cases) {
  if (cases.length === 0) {
    return {
      successRate: null,
      complicationRate: null,
      revisionRate: null,
      totalComplications: 0
    };
  }

  // Success rate (no complications)
  const successfulCases = cases.filter(c =>
    !c.complications || c.complications.length === 0
  ).length;

  // Complications
  const casesWithComplications = cases.filter(c =>
    c.complications && c.complications.length > 0
  );

  // Revision surgeries
  const revisionCases = cases.filter(c =>
    c.isRevision || c.procedureType?.toLowerCase().includes('revision')
  ).length;

  // Complication breakdown
  const complicationTypes = {};
  for (const c of casesWithComplications) {
    for (const comp of c.complications) {
      const type = comp.type || 'Other';
      complicationTypes[type] = (complicationTypes[type] || 0) + 1;
    }
  }

  // Visual acuity outcomes (for ophthalmic surgeries)
  const vaOutcomes = calculateVAOutcomes(cases);

  return {
    successRate: ((successfulCases / cases.length) * 100).toFixed(1),
    complicationRate: ((casesWithComplications.length / cases.length) * 100).toFixed(1),
    revisionRate: ((revisionCases / cases.length) * 100).toFixed(1),
    totalComplications: casesWithComplications.length,
    complicationTypes,
    visualAcuityOutcomes: vaOutcomes
  };
}

/**
 * Calculate visual acuity outcomes
 */
function calculateVAOutcomes(cases) {
  const vaData = cases.filter(c =>
    c.preOpVisualAcuity && c.postOpVisualAcuity
  );

  if (vaData.length === 0) return null;

  // Convert VA to LogMAR for calculations
  const convertToLogMAR = (va) => {
    const vaMap = {
      '20/20': 0, '20/25': 0.1, '20/32': 0.2, '20/40': 0.3,
      '20/50': 0.4, '20/63': 0.5, '20/80': 0.6, '20/100': 0.7,
      '20/125': 0.8, '20/160': 0.9, '20/200': 1.0, '20/400': 1.3,
      'CF': 1.7, 'HM': 2.0, 'LP': 2.5, 'NLP': 3.0
    };
    return vaMap[va] || 1.0;
  };

  let improved = 0;
  let unchanged = 0;
  let worsened = 0;

  for (const c of vaData) {
    const preOp = convertToLogMAR(c.preOpVisualAcuity);
    const postOp = convertToLogMAR(c.postOpVisualAcuity);
    const change = preOp - postOp; // Positive = improvement

    if (change >= 0.2) improved++;
    else if (change <= -0.2) worsened++;
    else unchanged++;
  }

  return {
    casesWithVAData: vaData.length,
    improved: { count: improved, percent: ((improved / vaData.length) * 100).toFixed(1) },
    unchanged: { count: unchanged, percent: ((unchanged / vaData.length) * 100).toFixed(1) },
    worsened: { count: worsened, percent: ((worsened / vaData.length) * 100).toFixed(1) }
  };
}

/**
 * Calculate efficiency metrics
 */
function calculateEfficiencyMetrics(cases) {
  if (cases.length === 0) {
    return {
      averageDuration: null,
      onTimeStartRate: null,
      averageTurnoverTime: null
    };
  }

  // Duration metrics
  const durations = cases
    .filter(c => c.actualDuration)
    .map(c => c.actualDuration);

  const avgDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : null;

  // On-time starts
  const onTimeStarts = cases.filter(c => {
    if (!c.scheduledStartTime || !c.actualStartTime) return false;
    const scheduled = new Date(c.scheduledStartTime);
    const actual = new Date(c.actualStartTime);
    return actual <= new Date(scheduled.getTime() + 15 * 60000); // 15 min grace
  }).length;

  // Turnover time (time between cases)
  const turnoverTimes = [];
  const sortedCases = cases
    .filter(c => c.actualEndTime)
    .sort((a, b) => new Date(a.actualEndTime) - new Date(b.actualEndTime));

  for (let i = 1; i < sortedCases.length; i++) {
    const prevEnd = new Date(sortedCases[i - 1].actualEndTime);
    const nextStart = new Date(sortedCases[i].actualStartTime);
    if (nextStart > prevEnd) {
      const turnover = (nextStart - prevEnd) / 60000; // minutes
      if (turnover < 180) { // Exclude > 3 hours (different session)
        turnoverTimes.push(turnover);
      }
    }
  }

  const avgTurnover = turnoverTimes.length > 0
    ? turnoverTimes.reduce((a, b) => a + b, 0) / turnoverTimes.length
    : null;

  // Duration by procedure type
  const durationByType = {};
  for (const c of cases) {
    if (c.actualDuration && c.procedureType) {
      if (!durationByType[c.procedureType]) {
        durationByType[c.procedureType] = [];
      }
      durationByType[c.procedureType].push(c.actualDuration);
    }
  }

  for (const type in durationByType) {
    const durations = durationByType[type];
    durationByType[type] = {
      count: durations.length,
      average: (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0),
      min: Math.min(...durations),
      max: Math.max(...durations)
    };
  }

  return {
    averageDuration: avgDuration ? avgDuration.toFixed(0) : null,
    durationUnit: 'minutes',
    onTimeStartRate: ((onTimeStarts / cases.length) * 100).toFixed(1),
    averageTurnoverTime: avgTurnover ? avgTurnover.toFixed(0) : null,
    durationByProcedure: durationByType
  };
}

/**
 * Calculate safety metrics
 */
function calculateSafetyMetrics(cases, checklists) {
  // Checklist compliance
  const completedChecklists = checklists.filter(c => c.status === 'completed');
  const complianceRate = checklists.length > 0
    ? ((completedChecklists.length / checklists.length) * 100).toFixed(1)
    : null;

  // Average compliance score
  const avgCompliance = completedChecklists.length > 0
    ? (completedChecklists.reduce((sum, c) => sum + (c.compliance?.overallCompliance || 0), 0) / completedChecklists.length).toFixed(1)
    : null;

  // Adverse events
  const adverseEvents = cases.filter(c =>
    c.adverseEvents && c.adverseEvents.length > 0
  ).length;

  // Surgical site infections
  const infections = cases.filter(c =>
    c.complications?.some(comp =>
      comp.type?.toLowerCase().includes('infection')
    )
  ).length;

  // Near misses
  const nearMisses = checklists.filter(c =>
    c.deviations && c.deviations.length > 0
  ).length;

  return {
    checklistCompletionRate: complianceRate,
    averageChecklistCompliance: avgCompliance,
    adverseEventRate: cases.length > 0
      ? ((adverseEvents / cases.length) * 100).toFixed(2)
      : null,
    surgicalSiteInfectionRate: cases.length > 0
      ? ((infections / cases.length) * 100).toFixed(2)
      : null,
    nearMissesReported: nearMisses,
    totalAdverseEvents: adverseEvents
  };
}

/**
 * Get benchmark data from all surgeons
 * Returns null on error (graceful degradation)
 */
async function getSurgeonBenchmarks(startDate, endDate) {
  try {
    const allCases = await SurgeryCase.find({
      scheduledDate: { $gte: startDate, $lte: endDate },
      status: 'completed'
    }).lean();

    if (allCases.length === 0) {
      return null;
    }

    // Calculate aggregate metrics
    const casesWithComplications = allCases.filter(c =>
      c.complications && c.complications.length > 0
    ).length;

    const durations = allCases.filter(c => c.actualDuration).map(c => c.actualDuration);
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null;

    return {
      totalCases: allCases.length,
      averageComplicationRate: ((casesWithComplications / allCases.length) * 100).toFixed(1),
      averageDuration: avgDuration ? avgDuration.toFixed(0) : null,
      percentile25Duration: durations.length > 0
        ? getPercentile(durations, 25).toFixed(0)
        : null,
      percentile75Duration: durations.length > 0
        ? getPercentile(durations, 75).toFixed(0)
        : null
    };
  } catch (error) {
    log.error('Error getting benchmarks:', {
      error: error.message,
      startDate,
      endDate
    });
    // Return null on error - reports will be generated without benchmarks
    return null;
  }
}

/**
 * Get percentile value from array
 */
function getPercentile(arr, percentile) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/**
 * Calculate rankings compared to benchmarks
 */
function calculateRankings(metrics, benchmarks) {
  if (!benchmarks) return null;

  const rankings = {};

  // Volume ranking
  if (metrics.volumeMetrics.totalCases && benchmarks.totalCases) {
    rankings.volumeRank = metrics.volumeMetrics.totalCases > benchmarks.totalCases / 10
      ? 'Above Average' : 'Below Average';
  }

  // Complication rate ranking (lower is better)
  if (metrics.outcomeMetrics.complicationRate && benchmarks.averageComplicationRate) {
    const rate = parseFloat(metrics.outcomeMetrics.complicationRate);
    const benchmark = parseFloat(benchmarks.averageComplicationRate);
    rankings.complicationRank = rate < benchmark ? 'Better than Average' : 'Needs Improvement';
  }

  // Duration ranking (lower is better)
  if (metrics.efficiencyMetrics.averageDuration && benchmarks.averageDuration) {
    const duration = parseFloat(metrics.efficiencyMetrics.averageDuration);
    const benchmark = parseFloat(benchmarks.averageDuration);
    rankings.efficiencyRank = duration < benchmark ? 'More Efficient' : 'Standard';
  }

  return rankings;
}

/**
 * Get surgeon comparison report
 * Returns empty reports array on complete failure
 */
async function getSurgeonComparisonReport(surgeonIds, startDate, endDate) {
  try {
    const reports = [];
    const errors = [];

    for (const surgeonId of surgeonIds) {
      try {
        const report = await getSurgeonPerformanceReport(surgeonId, startDate, endDate);
        const surgeon = await User.findById(surgeonId).select('name specialty').lean();
        reports.push({
          surgeon,
          ...report
        });
      } catch (surgeonError) {
        log.error('Failed to get report for surgeon:', {
          error: surgeonError.message,
          surgeonId: String(surgeonId)
        });
        errors.push({ surgeonId: String(surgeonId), error: surgeonError.message });
      }
    }

    return {
      success: true,
      comparisonPeriod: { startDate, endDate },
      surgeonCount: reports.length,
      reports,
      errors: errors.length > 0 ? errors : undefined,
      generatedAt: new Date()
    };
  } catch (error) {
    log.error('Error generating comparison report:', {
      error: error.message,
      surgeonCount: surgeonIds?.length,
      startDate,
      endDate
    });
    // Return empty report on error
    return {
      success: false,
      error: 'Erreur lors de la génération du rapport comparatif',
      comparisonPeriod: { startDate, endDate },
      surgeonCount: 0,
      reports: [],
      generatedAt: new Date()
    };
  }
}

module.exports = {
  getSurgeonPerformanceReport,
  getSurgeonBenchmarks,
  getSurgeonComparisonReport,
  calculateVolumeMetrics,
  calculateOutcomeMetrics,
  calculateEfficiencyMetrics,
  calculateSafetyMetrics,
  METRICS_CATEGORIES
};
