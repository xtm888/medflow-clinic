const { asyncHandler } = require('../middleware/errorHandler');
const Visit = require('../models/Visit');
const Patient = require('../models/Patient');
const LaboratoryTemplate = require('../models/LaboratoryTemplate');
const Notification = require('../models/Notification');

// @desc    Get all laboratory tests
// @route   GET /api/laboratory/tests
// @access  Private
exports.getAllTests = asyncHandler(async (req, res) => {
  const { status, patientId, dateFrom, dateTo } = req.query;
  const query = {};

  if (status) query['laboratoryOrders.status'] = status;
  if (patientId) query.patient = patientId;
  if (dateFrom || dateTo) {
    query['laboratoryOrders.orderedAt'] = {};
    if (dateFrom) query['laboratoryOrders.orderedAt'].$gte = new Date(dateFrom);
    if (dateTo) query['laboratoryOrders.orderedAt'].$lte = new Date(dateTo);
  }

  const visits = await Visit.find(query)
    .populate('patient', 'firstName lastName patientId')
    .populate('primaryProvider', 'firstName lastName')
    .select('laboratoryOrders visitDate')
    .sort('-visitDate')
    .lean();

  // Flatten laboratory tests from all visits
  const tests = [];
  visits.forEach(visit => {
    if (visit.laboratoryOrders && visit.laboratoryOrders.length > 0) {
      visit.laboratoryOrders.forEach(test => {
        tests.push({
          ...test,
          patient: visit.patient,
          provider: visit.primaryProvider,
          visitId: visit._id,
          visitDate: visit.visitDate
        });
      });
    }
  });

  res.status(200).json({
    success: true,
    count: tests.length,
    data: tests
  });
});

// @desc    Order laboratory tests
// @route   POST /api/laboratory/tests
// @access  Private (Doctor, Nurse)
exports.orderTests = asyncHandler(async (req, res) => {
  const { visitId, patientId, tests, urgency = 'routine' } = req.body;

  // Find visit or create one if not provided
  let visit;
  if (visitId) {
    visit = await Visit.findById(visitId);
    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }
  } else if (patientId) {
    // Create a new visit for lab tests
    visit = await Visit.create({
      patient: patientId,
      visitType: 'routine',
      visitDate: new Date(),
      primaryProvider: req.user.id,
      status: 'in-progress',
      chiefComplaint: {
        complaint: 'Laboratory tests ordered',
        associatedSymptoms: []
      }
    });
  } else {
    return res.status(400).json({
      success: false,
      error: 'Either visitId or patientId is required'
    });
  }

  // Add tests to visit
  const labTests = tests.map(test => ({
    testName: test.name,
    testCode: test.code,
    category: test.category || 'general',
    urgency,
    status: 'ordered',
    orderedAt: new Date(),
    orderedBy: req.user.id,
    notes: test.notes || ''
  }));

  if (!visit.laboratoryOrders) {
    visit.laboratoryOrders = [];
  }
  visit.laboratoryOrders.push(...labTests);
  await visit.save();

  // Create notification for lab technician
  await Notification.create({
    recipient: 'lab', // This would typically be lab technician IDs
    type: 'lab_order',
    title: 'New Laboratory Test Order',
    message: `${tests.length} tests ordered for patient ${visit.patient}`,
    priority: urgency === 'urgent' ? 'high' : 'medium',
    data: {
      visitId: visit._id,
      patientId: visit.patient,
      testCount: tests.length
    }
  });

  res.status(201).json({
    success: true,
    message: 'Laboratory tests ordered successfully',
    data: {
      visitId: visit._id,
      tests: labTests
    }
  });
});

// @desc    Update test results
// @route   PUT /api/laboratory/tests/:visitId/:testId
// @access  Private (Lab Technician, Doctor)
exports.updateTestResults = asyncHandler(async (req, res) => {
  const { visitId, testId } = req.params;
  const { results, status, performedBy, notes } = req.body;

  const visit = await Visit.findById(visitId);
  if (!visit) {
    return res.status(404).json({
      success: false,
      error: 'Visit not found'
    });
  }

  // Find the specific test
  const test = visit.laboratoryOrders.id(testId);
  if (!test) {
    return res.status(404).json({
      success: false,
      error: 'Test not found'
    });
  }

  // Update test results
  if (results) test.results = results;
  if (status) test.status = status;
  if (performedBy) test.performedBy = performedBy;
  if (notes) test.notes = notes;

  // Add result entry timestamp
  if (!test.resultEntries) {
    test.resultEntries = [];
  }
  test.resultEntries.push({
    enteredBy: req.user.id,
    enteredAt: new Date(),
    results,
    notes
  });

  // Set completion time if status is completed
  if (status === 'completed') {
    test.completedAt = new Date();
    test.performedBy = performedBy || req.user.id;

    // Check for critical values
    if (test.results && test.normalRange) {
      const isCritical = checkCriticalValues(test.results, test.normalRange);
      if (isCritical) {
        test.isCritical = true;
        // Create urgent notification
        await Notification.create({
          recipient: visit.primaryProvider,
          type: 'critical_lab_result',
          title: 'Critical Laboratory Result',
          message: `Critical ${test.testName} result for patient`,
          priority: 'urgent',
          data: {
            visitId,
            testId,
            testName: test.testName,
            result: test.results
          }
        });
      }
    }
  }

  await visit.save();

  // Notify provider if test is completed
  if (status === 'completed') {
    await Notification.create({
      recipient: visit.primaryProvider,
      type: 'lab_result_ready',
      title: 'Laboratory Results Available',
      message: `${test.testName} results are ready`,
      priority: test.isCritical ? 'high' : 'medium',
      data: {
        visitId,
        testId,
        testName: test.testName
      }
    });
  }

  res.status(200).json({
    success: true,
    message: 'Test results updated successfully',
    data: test
  });
});

// @desc    Get pending laboratory tests
// @route   GET /api/laboratory/pending
// @access  Private
exports.getPendingTests = asyncHandler(async (req, res) => {
  const visits = await Visit.find({
    'laboratoryOrders.status': { $in: ['ordered', 'in-progress'] }
  })
    .populate('patient', 'firstName lastName patientId dateOfBirth gender')
    .populate('primaryProvider', 'firstName lastName')
    .select('laboratoryOrders visitDate')
    .sort('-visitDate')
    .lean();

  // Extract pending tests
  const pendingTests = [];
  visits.forEach(visit => {
    if (visit.laboratoryOrders) {
      visit.laboratoryOrders
        .filter(test => ['ordered', 'in-progress'].includes(test.status))
        .forEach(test => {
          pendingTests.push({
            ...test,
            patient: visit.patient,
            provider: visit.primaryProvider,
            visitId: visit._id,
            visitDate: visit.visitDate
          });
        });
    }
  });

  res.status(200).json({
    success: true,
    count: pendingTests.length,
    data: pendingTests
  });
});

// @desc    Get laboratory templates
// @route   GET /api/laboratory/templates
// @access  Private
exports.getTemplates = asyncHandler(async (req, res) => {
  const templates = await LaboratoryTemplate.find({ isActive: true })
    .sort('category testName')
    .lean();

  res.status(200).json({
    success: true,
    count: templates.length,
    data: templates
  });
});

// @desc    Create laboratory template
// @route   POST /api/laboratory/templates
// @access  Private (Admin)
exports.createTemplate = asyncHandler(async (req, res) => {
  const template = await LaboratoryTemplate.create({
    ...req.body,
    createdBy: req.user.id
  });

  res.status(201).json({
    success: true,
    data: template
  });
});

// @desc    Get test statistics
// @route   GET /api/laboratory/stats
// @access  Private
exports.getStatistics = asyncHandler(async (req, res) => {
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

// @desc    Print laboratory report
// @route   GET /api/laboratory/report/:visitId
// @access  Private
exports.generateReport = asyncHandler(async (req, res) => {
  const visit = await Visit.findById(req.params.visitId)
    .populate('patient', 'firstName lastName patientId dateOfBirth gender address phoneNumber')
    .populate('primaryProvider', 'firstName lastName title')
    .populate('laboratoryOrders.performedBy', 'firstName lastName')
    .lean();

  if (!visit || !visit.laboratoryOrders || visit.laboratoryOrders.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'No laboratory tests found for this visit'
    });
  }

  // Filter completed tests only
  const completedTests = visit.laboratoryOrders.filter(test => test.status === 'completed');

  if (completedTests.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No completed laboratory tests found'
    });
  }

  const report = {
    patient: visit.patient,
    provider: visit.primaryProvider,
    visitDate: visit.visitDate,
    reportDate: new Date(),
    tests: completedTests,
    summary: {
      totalTests: completedTests.length,
      criticalResults: completedTests.filter(t => t.isCritical).length
    }
  };

  res.status(200).json({
    success: true,
    data: report
  });
});

// Helper function to check critical values
function checkCriticalValues(result, normalRange) {
  // This is a simplified check - implement based on your needs
  if (!result || !normalRange) return false;

  const resultValue = parseFloat(result);
  if (isNaN(resultValue)) return false;

  const { min, max } = normalRange;
  return resultValue < min * 0.7 || resultValue > max * 1.3;
}

module.exports = exports;