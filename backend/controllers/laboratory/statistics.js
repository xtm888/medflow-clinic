const { asyncHandler } = require('../../middleware/errorHandler');
const Visit = require('../../models/Visit');
const LabOrder = require('../../models/LabOrder');
const LabResult = require('../../models/LabResult');
const Notification = require('../../models/Notification');
const AuditLog = require('../../models/AuditLog');
const websocketService = require('../../services/websocketService');

// ============================================
// TEST STATISTICS (from laboratoryController)
// ============================================

// @desc    Get test statistics
// @route   GET /api/laboratory/stats
// @access  Private
exports.getTestStatistics = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get today's statistics
  const todayVisits = await Visit.find({
    'laboratoryOrders.orderedAt': { $gte: today, $lt: tomorrow }
  }).select('laboratoryOrders');

  let todayOrdered = 0;
  let todayCompleted = 0;
  let todayPending = 0;

  todayVisits.forEach(visit => {
    if (visit.laboratoryOrders) {
      visit.laboratoryOrders.forEach(test => {
        if (test.orderedAt >= today) {
          todayOrdered++;
          if (test.status === 'completed') todayCompleted++;
          else if (test.status === 'ordered' || test.status === 'in-progress') todayPending++;
        }
      });
    }
  });

  // Get all pending tests count
  const allPendingVisits = await Visit.find({
    'laboratoryOrders.status': { $in: ['ordered', 'in-progress'] }
  }).select('laboratoryOrders');

  let totalPending = 0;
  allPendingVisits.forEach(visit => {
    if (visit.laboratoryOrders) {
      totalPending += visit.laboratoryOrders.filter(t =>
        t.status === 'ordered' || t.status === 'in-progress'
      ).length;
    }
  });

  // Get test categories distribution
  const categories = {};
  const allVisits = await Visit.find({
    laboratoryOrders: { $exists: true, $ne: [] }
  }).select('laboratoryOrders');

  allVisits.forEach(visit => {
    if (visit.laboratoryOrders) {
      visit.laboratoryOrders.forEach(test => {
        const category = test.category || 'general';
        categories[category] = (categories[category] || 0) + 1;
      });
    }
  });

  res.status(200).json({
    success: true,
    data: {
      today: {
        ordered: todayOrdered,
        completed: todayCompleted,
        pending: todayPending
      },
      overall: {
        totalPending,
        categories
      }
    }
  });
});

// @desc    Get turnaround time statistics
// @route   GET /api/laboratory/stats/turnaround
// @access  Private
exports.getTurnaroundStats = asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const visits = await Visit.find({
    'laboratoryOrders.completedAt': { $gte: thirtyDaysAgo }
  }).select('laboratoryOrders').lean();

  const stats = {
    total: 0,
    totalTurnaround: 0,
    byCategory: {},
    byUrgency: { routine: { total: 0, avgTime: 0 }, urgent: { total: 0, avgTime: 0 } }
  };

  visits.forEach(visit => {
    visit.laboratoryOrders
      ?.filter(t => t.status === 'completed' && t.orderedAt && t.completedAt)
      .forEach(test => {
        const turnaround = (new Date(test.completedAt) - new Date(test.orderedAt)) / (1000 * 60 * 60); // hours

        stats.total++;
        stats.totalTurnaround += turnaround;

        // By category
        const cat = test.category || 'general';
        if (!stats.byCategory[cat]) {
          stats.byCategory[cat] = { total: 0, totalTime: 0 };
        }
        stats.byCategory[cat].total++;
        stats.byCategory[cat].totalTime += turnaround;

        // By urgency
        const urg = test.urgency || 'routine';
        stats.byUrgency[urg].total++;
        stats.byUrgency[urg].avgTime += turnaround;
      });
  });

  // Calculate averages
  stats.averageTurnaround = stats.total > 0 ? (stats.totalTurnaround / stats.total).toFixed(1) : 0;

  Object.keys(stats.byCategory).forEach(cat => {
    const catStats = stats.byCategory[cat];
    catStats.avgTime = catStats.total > 0 ? (catStats.totalTime / catStats.total).toFixed(1) : 0;
    delete catStats.totalTime;
  });

  Object.keys(stats.byUrgency).forEach(urg => {
    const urgStats = stats.byUrgency[urg];
    urgStats.avgTime = urgStats.total > 0 ? (urgStats.avgTime / urgStats.total).toFixed(1) : 0;
  });

  res.status(200).json({
    success: true,
    data: stats
  });
});

// ============================================
// QC DATA MANAGEMENT
// ============================================

/**
 * @desc    Record QC data for a test run
 * @route   POST /api/laboratory/qc
 * @access  Private (Lab Tech)
 */
exports.recordQCData = asyncHandler(async (req, res) => {
  const { testCode, instrumentId, reagentLot, controlLevel, expectedValue, actualValue, notes } = req.body;

  if (!testCode || !instrumentId || !controlLevel || expectedValue === undefined || actualValue === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: testCode, instrumentId, controlLevel, expectedValue, actualValue'
    });
  }

  // Calculate if within acceptable limits (typically ±2 SD)
  const deviation = Math.abs(actualValue - expectedValue);
  const percentDeviation = (deviation / expectedValue) * 100;
  const withinLimits = percentDeviation <= 5; // 5% tolerance by default

  // Store QC record
  const qcRecord = {
    testCode,
    instrumentId,
    reagentLot,
    calibrationDate: new Date(),
    controlResults: [{
      level: controlLevel,
      expected: expectedValue,
      actual: actualValue,
      withinLimits,
      percentDeviation: percentDeviation.toFixed(2),
      recordedAt: new Date(),
      recordedBy: req.user.id
    }],
    notes
  };

  // Log QC data
  await AuditLog.create({
    user: req.user.id,
    action: 'LAB_QC_RECORD',
    resource: '/api/laboratory/qc',
    ipAddress: req.ip,
    metadata: qcRecord
  });

  // Alert if QC fails
  if (!withinLimits) {
    await Notification.create({
      recipient: 'lab_technician',
      type: 'qc_failure',
      title: 'QC Failure Alert',
      message: `QC failed for ${testCode} on instrument ${instrumentId}. Deviation: ${percentDeviation.toFixed(2)}%`,
      priority: 'urgent',
      data: qcRecord
    });

    // Emit WebSocket event for real-time QC failure alert
    websocketService.emitQCFailure({
      testCode,
      instrumentId,
      reagentLot,
      percentDeviation: parseFloat(percentDeviation.toFixed(2)),
      expectedValue,
      actualValue,
      controlLevel
    });
  }

  res.status(201).json({
    success: true,
    data: {
      ...qcRecord,
      status: withinLimits ? 'passed' : 'failed'
    },
    message: withinLimits ? 'QC passed' : 'QC FAILED - Review required'
  });
});

/**
 * @desc    Get QC history for a test/instrument
 * @route   GET /api/laboratory/qc/history
 * @access  Private (Lab Tech)
 */
exports.getQCHistory = asyncHandler(async (req, res) => {
  const { testCode, instrumentId, dateFrom, dateTo, limit = 50 } = req.query;

  const query = { 'qc.instrumentId': { $exists: true } };
  if (testCode) query['test.testCode'] = testCode;
  if (instrumentId) query['qc.instrumentId'] = instrumentId;

  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  const results = await LabResult.find(query)
    .select('test.testCode test.testName qc createdAt')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .lean();

  // Calculate summary stats
  const summary = {
    total: results.length,
    passed: results.filter(r => r.qc?.controlResults?.every(c => c.withinLimits)).length,
    failed: results.filter(r => r.qc?.controlResults?.some(c => !c.withinLimits)).length
  };

  res.status(200).json({
    success: true,
    data: results,
    summary
  });
});

// ============================================
// ORDER STATISTICS (from labOrderController)
// ============================================

// @desc    Get lab order/result statistics
// @route   GET /api/lab-orders/stats
// @access  Private
exports.getOrderStatistics = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayOrders, todayCompleted, pendingOrders, criticalPending] = await Promise.all([
    LabOrder.countDocuments({ orderDate: { $gte: today, $lt: tomorrow } }),
    LabOrder.countDocuments({ status: 'completed', updatedAt: { $gte: today, $lt: tomorrow } }),
    LabOrder.countDocuments({ status: { $in: ['ordered', 'collected', 'received', 'in-progress'] } }),
    LabResult.countDocuments({
      'criticalValue.detected': true,
      'criticalValue.acknowledgedAt': { $exists: false }
    })
  ]);

  // Orders by priority
  const byPriority = await LabOrder.aggregate([
    { $match: { status: { $nin: ['completed', 'cancelled'] } } },
    { $group: { _id: '$priority', count: { $sum: 1 } } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      today: {
        ordered: todayOrders,
        completed: todayCompleted
      },
      pending: pendingOrders,
      criticalPending,
      byPriority: byPriority.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    }
  });
});

// Aliases for backward compatibility
exports.getStatistics = exports.getTestStatistics;

module.exports = exports;
