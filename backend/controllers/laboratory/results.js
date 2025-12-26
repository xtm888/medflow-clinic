const { asyncHandler } = require('../../middleware/errorHandler');
const Visit = require('../../models/Visit');
const LabOrder = require('../../models/LabOrder');
const LabResult = require('../../models/LabResult');
const LaboratoryTemplate = require('../../models/LaboratoryTemplate');
const Notification = require('../../models/Notification');
const AuditLog = require('../../models/AuditLog');
const websocketService = require('../../services/websocketService');

const { createContextLogger } = require('../../utils/structuredLogger');
const log = createContextLogger('Results');

// ============================================
// CONSTANTS & HELPER FUNCTIONS
// ============================================

// Lab test status transition validation
const LAB_STATUS_TRANSITIONS = {
  'ordered': ['collected', 'cancelled'],
  'collected': ['in-progress', 'cancelled'],
  'in-progress': ['completed', 'cancelled', 'failed'],
  'completed': ['verified'], // Can only go to verified after completion
  'verified': [], // Terminal state
  'cancelled': [], // Terminal state
  'failed': ['ordered'] // Can be re-ordered
};

function canTransitionLabStatus(currentStatus, newStatus) {
  const allowed = LAB_STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
}

// Helper function to check critical values
function checkCriticalValues(result, normalRange) {
  if (!result || !normalRange) return false;

  const resultValue = parseFloat(result);
  if (isNaN(resultValue)) return false;

  // Check structured range
  if (normalRange.criticalLow !== undefined && resultValue < normalRange.criticalLow) {
    return true;
  }
  if (normalRange.criticalHigh !== undefined && resultValue > normalRange.criticalHigh) {
    return true;
  }

  // Fallback to percentage-based critical check
  const { min, max } = normalRange;
  if (min !== undefined && max !== undefined) {
    return resultValue < min * 0.7 || resultValue > max * 1.3;
  }

  return false;
}

// Helper function to check if result is abnormal
function checkAbnormal(value, referenceRange, patientAge, patientGender) {
  if (value === null || value === undefined) {
    return { isAbnormal: false, flag: null };
  }

  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return { isAbnormal: false, flag: null };
  }

  let range = referenceRange || {};

  // Check gender-specific ranges
  if (patientGender && range[patientGender.toLowerCase()]) {
    range = { ...range, ...range[patientGender.toLowerCase()] };
  }

  // Check age-specific ranges
  if (patientAge && range.ageSpecific && range.ageSpecific.length > 0) {
    const ageRange = range.ageSpecific.find(ar =>
      patientAge >= ar.ageMin && patientAge <= ar.ageMax
    );
    if (ageRange) {
      range = { ...range, min: ageRange.min, max: ageRange.max };
    }
  }

  // Check critical values first
  if (range.criticalLow !== undefined && numValue < range.criticalLow) {
    return { isAbnormal: true, flag: 'critical_low', severity: 'critical' };
  }
  if (range.criticalHigh !== undefined && numValue > range.criticalHigh) {
    return { isAbnormal: true, flag: 'critical_high', severity: 'critical' };
  }

  // Check normal range
  if (range.min !== undefined && numValue < range.min) {
    return { isAbnormal: true, flag: 'low', severity: 'abnormal' };
  }
  if (range.max !== undefined && numValue > range.max) {
    return { isAbnormal: true, flag: 'high', severity: 'abnormal' };
  }

  return { isAbnormal: false, flag: 'normal', severity: 'normal' };
}

// ============================================
// RESULT ENTRY - VISIT-BASED
// ============================================

// @desc    Update test results
// @route   PUT /api/laboratory/tests/:visitId/:testId
// @access  Private (Lab Technician, Doctor)
exports.updateTestResults = asyncHandler(async (req, res) => {
  const { visitId, testId } = req.params;
  const { results, status, performedBy, notes, forceTransition } = req.body;

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

  // CRITICAL: Validate status transition
  if (status && status !== test.status) {
    const currentStatus = test.status || 'ordered';
    if (!canTransitionLabStatus(currentStatus, status)) {
      // Allow admin to force transition with audit
      if (forceTransition && req.user.role === 'admin') {
        log.warn(`Admin ${req.user.id} forcing lab status transition: ${currentStatus} -> ${status}`);
        await AuditLog.create({
          user: req.user.id,
          action: 'LAB_STATUS_FORCE_TRANSITION',
          resource: `/api/laboratory/tests/${visitId}/${testId}`,
          ipAddress: req.ip,
          metadata: {
            fromStatus: currentStatus,
            toStatus: status,
            testId,
            visitId,
            reason: 'Admin override'
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          error: `Transition de statut invalide: ${currentStatus} → ${status}. Transitions autorisées: ${LAB_STATUS_TRANSITIONS[currentStatus]?.join(', ') || 'aucune'}`
        });
      }
    }

    // Additional validation: Cannot complete without specimen collection
    if (status === 'completed' && !test.specimen?.barcode && !test.specimen?.collectedAt) {
      return res.status(400).json({
        success: false,
        error: 'Impossible de compléter le test sans prélèvement d\'échantillon'
      });
    }
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

// @desc    Enter test results with component breakdown
// @route   PUT /api/laboratory/tests/:visitId/:testId/results
// @access  Private (Lab Tech, Doctor)
exports.enterResults = asyncHandler(async (req, res) => {
  const { visitId, testId } = req.params;
  const { results, componentResults, notes, performedBy, verifiedBy } = req.body;

  const visit = await Visit.findById(visitId).populate('patient');
  if (!visit) {
    return res.status(404).json({
      success: false,
      error: 'Visit not found'
    });
  }

  const test = visit.laboratoryOrders.id(testId);
  if (!test) {
    return res.status(404).json({
      success: false,
      error: 'Test not found'
    });
  }

  // Get template for reference ranges
  const template = await LaboratoryTemplate.findOne({
    $or: [
      { _id: test.templateId },
      { code: test.testCode },
      { name: test.testName }
    ]
  });

  // Calculate patient age
  const patientAge = visit.patient?.dateOfBirth
    ? Math.floor((Date.now() - new Date(visit.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  const patientGender = visit.patient?.gender;

  // Process results
  const processedResults = [];
  let hasAbnormal = false;
  let hasCritical = false;

  // Handle single result
  if (results !== undefined) {
    const referenceRange = template?.referenceRange || {};
    const abnormalCheck = checkAbnormal(results, referenceRange, patientAge, patientGender);

    test.results = results;
    test.referenceRange = template?.normalRange || referenceRange.text || '';
    test.unit = template?.unit || '';
    test.isAbnormal = abnormalCheck.isAbnormal;
    test.abnormalFlag = abnormalCheck.flag;

    if (abnormalCheck.severity === 'critical') hasCritical = true;
    if (abnormalCheck.isAbnormal) hasAbnormal = true;

    processedResults.push({
      name: test.testName,
      value: results,
      unit: test.unit,
      referenceRange: test.referenceRange,
      isAbnormal: abnormalCheck.isAbnormal,
      flag: abnormalCheck.flag
    });
  }

  // Handle component results for profile tests
  if (componentResults && Array.isArray(componentResults)) {
    test.componentResults = componentResults.map(comp => {
      let compTemplate = null;

      // Find component in template
      if (template?.components) {
        compTemplate = template.components.find(c =>
          c.name === comp.name || c.code === comp.code
        );
      }

      const referenceRange = compTemplate?.referenceRange || {};
      const abnormalCheck = checkAbnormal(comp.value, referenceRange, patientAge, patientGender);

      if (abnormalCheck.severity === 'critical') hasCritical = true;
      if (abnormalCheck.isAbnormal) hasAbnormal = true;

      processedResults.push({
        name: comp.name,
        value: comp.value,
        unit: comp.unit || compTemplate?.unit || '',
        referenceRange: referenceRange.text || `${referenceRange.min || ''}-${referenceRange.max || ''}`,
        isAbnormal: abnormalCheck.isAbnormal,
        flag: abnormalCheck.flag
      });

      return {
        name: comp.name,
        code: comp.code,
        value: comp.value,
        unit: comp.unit || compTemplate?.unit || '',
        referenceRange: referenceRange,
        referenceRangeText: referenceRange.text || `${referenceRange.min || ''}-${referenceRange.max || ''}`,
        isAbnormal: abnormalCheck.isAbnormal,
        abnormalFlag: abnormalCheck.flag,
        notes: comp.notes
      };
    });

    test.isAbnormal = hasAbnormal;
  }

  // Update test metadata
  test.status = 'completed';
  test.completedAt = new Date();
  test.performedBy = performedBy || req.user.id;
  test.isCritical = hasCritical;

  if (notes) test.notes = notes;
  if (verifiedBy) {
    test.verifiedBy = verifiedBy;
    test.verifiedAt = new Date();
  }

  // Add to result history
  if (!test.resultHistory) test.resultHistory = [];
  test.resultHistory.push({
    enteredBy: req.user.id,
    enteredAt: new Date(),
    results: processedResults,
    notes
  });

  await visit.save();

  // Create notification for critical results
  if (hasCritical) {
    await Notification.create({
      recipient: visit.primaryProvider,
      type: 'critical_lab_result',
      title: 'CRITICAL Laboratory Result',
      message: `Critical ${test.testName} result for ${visit.patient?.firstName} ${visit.patient?.lastName}`,
      priority: 'urgent',
      data: {
        visitId,
        testId,
        testName: test.testName,
        results: processedResults.filter(r => r.flag?.includes('critical'))
      }
    });
  }

  // Create notification for completed test
  await Notification.create({
    recipient: visit.primaryProvider,
    type: 'lab_result_ready',
    title: 'Laboratory Results Available',
    message: `${test.testName} results are ready`,
    priority: hasCritical ? 'urgent' : hasAbnormal ? 'high' : 'medium',
    data: {
      visitId,
      testId,
      testName: test.testName,
      hasAbnormal,
      hasCritical
    }
  });

  // Emit WebSocket event for real-time updates
  websocketService.emitLabOrderStatusChange(testId, 'in-progress', 'completed', {
    visitId,
    testName: test.testName,
    patientId: visit.patient?._id || visit.patient,
    patientName: visit.patient?.firstName ? `${visit.patient.firstName} ${visit.patient.lastName}` : null,
    orderedBy: visit.primaryProvider,
    hasAbnormal,
    hasCritical
  });

  res.status(200).json({
    success: true,
    message: 'Results entered successfully',
    data: {
      test,
      processedResults,
      hasAbnormal,
      hasCritical
    }
  });
});

// @desc    Get test results
// @route   GET /api/laboratory/tests/:visitId/:testId/results
// @access  Private
exports.getTestResults = asyncHandler(async (req, res) => {
  const { visitId, testId } = req.params;

  const visit = await Visit.findById(visitId)
    .populate('patient', 'firstName lastName dateOfBirth gender')
    .lean();

  if (!visit) {
    return res.status(404).json({
      success: false,
      error: 'Visit not found'
    });
  }

  const test = visit.laboratoryOrders?.find(t =>
    t._id.toString() === testId
  );

  if (!test) {
    return res.status(404).json({
      success: false,
      error: 'Test not found'
    });
  }

  // Get template for additional info
  const template = await LaboratoryTemplate.findOne({
    $or: [
      { _id: test.templateId },
      { code: test.testCode },
      { name: test.testName }
    ]
  }).lean();

  res.status(200).json({
    success: true,
    data: {
      test,
      template,
      patient: visit.patient
    }
  });
});

// ============================================
// RESULT VALIDATION
// ============================================

// @desc    Validate a single result value
// @route   POST /api/laboratory/validate-result
// @access  Private
exports.validateResult = asyncHandler(async (req, res) => {
  const { templateId, value, patientAge, patientGender } = req.body;

  if (!templateId || value === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Template ID and value are required'
    });
  }

  const template = await LaboratoryTemplate.findById(templateId);
  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }

  const result = checkAbnormal(value, template.referenceRange, patientAge, patientGender);

  res.status(200).json({
    success: true,
    data: {
      value,
      ...result,
      referenceRange: template.referenceRange,
      unit: template.unit
    }
  });
});

// @desc    Check multiple values for abnormalities
// @route   POST /api/laboratory/check-abnormal
// @access  Private
exports.checkAbnormalValues = asyncHandler(async (req, res) => {
  const { results, patientAge, patientGender } = req.body;

  if (!results || !Array.isArray(results)) {
    return res.status(400).json({
      success: false,
      error: 'Results array is required'
    });
  }

  // OPTIMIZATION: Fetch all templates in a single query instead of N+1 individual calls
  const templateIds = [...new Set(results.map(r => r.templateId).filter(Boolean))];
  const templates = await LaboratoryTemplate.find({ _id: { $in: templateIds } }).lean();
  const templateMap = new Map(templates.map(t => [t._id.toString(), t]));

  const checkedResults = results.map((item) => {
    const template = templateMap.get(item.templateId?.toString());
    if (!template) {
      return {
        ...item,
        error: 'Template not found'
      };
    }

    const check = checkAbnormal(item.value, template.referenceRange, patientAge, patientGender);
    return {
      ...item,
      testName: template.name,
      unit: template.unit,
      referenceRange: template.referenceRange,
      ...check
    };
  });

  const abnormalCount = checkedResults.filter(r => r.isAbnormal).length;
  const criticalCount = checkedResults.filter(r => r.severity === 'critical').length;

  res.status(200).json({
    success: true,
    data: {
      results: checkedResults,
      summary: {
        total: results.length,
        abnormal: abnormalCount,
        critical: criticalCount,
        normal: results.length - abnormalCount
      }
    }
  });
});

// ============================================
// LAB RESULT ENDPOINTS - STANDALONE MODEL
// ============================================

// @desc    Get all lab results
// @route   GET /api/lab-results
// @access  Private
exports.getResults = asyncHandler(async (req, res) => {
  const { status, patientId, dateFrom, dateTo, hasCritical, limit = 50, page = 1 } = req.query;
  const query = {};

  if (status) query.status = status;
  if (patientId) query.patient = patientId;
  if (hasCritical === 'true') query['criticalValue.detected'] = true;

  if (dateFrom || dateTo) {
    query.performedAt = {};
    if (dateFrom) query.performedAt.$gte = new Date(dateFrom);
    if (dateTo) query.performedAt.$lte = new Date(dateTo);
  }

  const total = await LabResult.countDocuments(query);
  const results = await LabResult.find(query)
    .populate('patient', 'firstName lastName patientId dateOfBirth')
    .populate('labOrder', 'orderId priority')
    .populate('performedBy', 'firstName lastName')
    .populate('verifiedBy', 'firstName lastName')
    .sort({ performedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  res.status(200).json({
    success: true,
    count: results.length,
    total,
    pages: Math.ceil(total / limit),
    data: results
  });
});

// @desc    Get single lab result
// @route   GET /api/lab-results/:id
// @access  Private
exports.getResult = asyncHandler(async (req, res) => {
  const result = await LabResult.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId dateOfBirth gender')
    .populate('labOrder')
    .populate('test.template')
    .populate('performedBy', 'firstName lastName')
    .populate('reviewedBy', 'firstName lastName')
    .populate('verifiedBy', 'firstName lastName')
    .lean();

  if (!result) {
    return res.status(404).json({
      success: false,
      error: 'Lab result not found'
    });
  }

  res.status(200).json({
    success: true,
    data: result
  });
});

// @desc    Create lab result
// @route   POST /api/lab-results
// @access  Private
exports.createResult = asyncHandler(async (req, res) => {
  const { labOrderId, testName, results } = req.body;

  // Get lab order
  const labOrder = await LabOrder.findById(labOrderId).populate('patient');
  if (!labOrder) {
    return res.status(404).json({
      success: false,
      error: 'Lab order not found'
    });
  }

  // Get template for reference ranges
  let template = null;
  if (req.body.templateId) {
    template = await LaboratoryTemplate.findById(req.body.templateId);
  }

  // Calculate patient age for reference range lookup
  const patientAge = labOrder.patient?.dateOfBirth
    ? Math.floor((Date.now() - new Date(labOrder.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  // Process results and check for abnormal/critical values
  const processedResults = results.map(r => {
    const refRange = template?.components?.find(c => c.name === r.parameter)?.referenceRange || {};
    let flag = 'normal';

    if (r.numericValue !== undefined) {
      if (refRange.criticalLow !== undefined && r.numericValue < refRange.criticalLow) {
        flag = 'critical-low';
      } else if (refRange.criticalHigh !== undefined && r.numericValue > refRange.criticalHigh) {
        flag = 'critical-high';
      } else if (refRange.low !== undefined && r.numericValue < refRange.low) {
        flag = 'low';
      } else if (refRange.high !== undefined && r.numericValue > refRange.high) {
        flag = 'high';
      }
    }

    return {
      ...r,
      flag,
      referenceRange: refRange
    };
  });

  const labResult = await LabResult.create({
    labOrder: labOrderId,
    patient: labOrder.patient._id,
    test: {
      template: req.body.templateId,
      testName: testName || template?.name,
      testCode: req.body.testCode || template?.code,
      category: req.body.category || template?.category,
      method: req.body.method || template?.method
    },
    results: processedResults,
    overallInterpretation: req.body.interpretation,
    performedBy: req.user.id,
    performedAt: new Date(),
    comments: req.body.comments,
    createdBy: req.user.id
  });

  await labResult.populate([
    { path: 'patient', select: 'firstName lastName patientId' },
    { path: 'labOrder', select: 'orderId' }
  ]);

  // Notify if critical values found
  if (labResult.criticalValue?.detected) {
    await Notification.create({
      recipient: labOrder.orderedBy,
      type: 'result_available',
      title: 'CRITICAL Lab Result',
      message: `Critical values detected for ${testName}`,
      priority: 'urgent',
      entityType: 'lab_result',
      entityId: labResult._id,
      link: `/laboratory/results/${labResult._id}`
    });
  }

  res.status(201).json({
    success: true,
    data: labResult
  });
});

// @desc    Verify lab result
// @route   PUT /api/lab-results/:id/verify
// @access  Private
exports.verifyResult = asyncHandler(async (req, res) => {
  const result = await LabResult.findById(req.params.id);

  if (!result) {
    return res.status(404).json({
      success: false,
      error: 'Lab result not found'
    });
  }

  await result.verify(req.user.id);

  // Get lab order for notification
  const labOrder = await LabOrder.findById(result.labOrder);
  if (labOrder) {
    await Notification.create({
      recipient: labOrder.orderedBy,
      type: 'result_available',
      title: 'Lab Results Available',
      message: `${result.test.testName} results are verified and ready`,
      priority: result.criticalValue?.detected ? 'urgent' : 'normal',
      entityType: 'lab_result',
      entityId: result._id,
      link: `/laboratory/results/${result._id}`
    });
  }

  res.status(200).json({
    success: true,
    message: 'Result verified',
    data: result
  });
});

// @desc    Correct lab result
// @route   PUT /api/lab-results/:id/correct
// @access  Private
exports.correctResult = asyncHandler(async (req, res) => {
  const result = await LabResult.findById(req.params.id);

  if (!result) {
    return res.status(404).json({
      success: false,
      error: 'Lab result not found'
    });
  }

  await result.correct(req.user.id, req.body.results, req.body.reason);

  res.status(200).json({
    success: true,
    message: 'Result corrected',
    data: result
  });
});

// @desc    Acknowledge critical value
// @route   PUT /api/lab-results/:id/acknowledge-critical
// @access  Private
exports.acknowledgeCritical = asyncHandler(async (req, res) => {
  const result = await LabResult.findById(req.params.id);

  if (!result) {
    return res.status(404).json({
      success: false,
      error: 'Lab result not found'
    });
  }

  await result.acknowledgeCritical(req.user.id, req.body.notes);

  res.status(200).json({
    success: true,
    message: 'Critical value acknowledged',
    data: result
  });
});

// @desc    Get patient test history
// @route   GET /api/lab-results/patient/:patientId/test/:testCode
// @access  Private
exports.getTestHistory = asyncHandler(async (req, res) => {
  const results = await LabResult.getTestHistory(
    req.params.patientId,
    req.params.testCode,
    req.query
  );

  res.status(200).json({
    success: true,
    count: results.length,
    data: results
  });
});

// @desc    Get unacknowledged critical results
// @route   GET /api/lab-results/critical-unacknowledged
// @access  Private
exports.getUnacknowledgedCritical = asyncHandler(async (req, res) => {
  const results = await LabResult.getUnacknowledgedCritical();

  res.status(200).json({
    success: true,
    count: results.length,
    data: results
  });
});

// @desc    Get patient lab results
// @route   GET /api/lab-results/patient/:patientId
// @access  Private
exports.getPatientResults = asyncHandler(async (req, res) => {
  const { limit = 50, page = 1 } = req.query;

  const query = { patient: req.params.patientId };
  if (req.query.status) query.status = req.query.status;

  const total = await LabResult.countDocuments(query);
  const results = await LabResult.find(query)
    .populate('labOrder', 'orderId')
    .populate('test.template')
    .populate('verifiedBy', 'firstName lastName')
    .sort({ performedAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  res.status(200).json({
    success: true,
    count: results.length,
    total,
    pages: Math.ceil(total / limit),
    data: results
  });
});

// ============================================
// DELTA/TRENDING ANALYSIS
// ============================================

/**
 * @desc    Get patient result trends for a specific test
 * @route   GET /api/laboratory/trends/:patientId/:testCode
 * @access  Private
 */
exports.getPatientTrends = asyncHandler(async (req, res) => {
  const { patientId, testCode } = req.params;
  const { limit = 10, componentName } = req.query;

  // Get historical results for this test
  const results = await LabResult.find({
    patient: patientId,
    'test.testCode': testCode,
    status: { $in: ['final', 'corrected', 'amended'] }
  })
    .select('resultId results performedAt test.testName')
    .sort({ performedAt: -1 })
    .limit(parseInt(limit))
    .lean();

  if (results.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        testCode,
        history: [],
        trends: null,
        message: 'No historical data available'
      }
    });
  }

  // Extract trend data for charting
  const trendData = results.reverse().map(result => {
    let value = null;
    let flag = 'normal';

    // Handle component results or single result
    if (componentName && result.results) {
      const component = result.results.find(r => r.parameter === componentName);
      if (component) {
        value = component.numericValue || parseFloat(component.value);
        flag = component.flag;
      }
    } else if (result.results && result.results.length > 0) {
      const primary = result.results[0];
      value = primary.numericValue || parseFloat(primary.value);
      flag = primary.flag;
    }

    return {
      resultId: result.resultId,
      date: result.performedAt,
      value,
      flag
    };
  }).filter(d => d.value !== null);

  // Calculate delta from most recent to previous
  const deltas = [];
  for (let i = 1; i < trendData.length; i++) {
    const current = trendData[i];
    const previous = trendData[i - 1];
    if (current.value && previous.value) {
      const change = current.value - previous.value;
      const changePercent = ((change / previous.value) * 100).toFixed(1);
      deltas.push({
        from: previous.date,
        to: current.date,
        change,
        changePercent: parseFloat(changePercent),
        trend: change > 0 ? 'increasing' : change < 0 ? 'decreasing' : 'stable'
      });
    }
  }

  // Calculate overall trend
  let overallTrend = 'stable';
  if (trendData.length >= 3) {
    const firstValue = trendData[0].value;
    const lastValue = trendData[trendData.length - 1].value;
    const overallChange = ((lastValue - firstValue) / firstValue) * 100;
    if (overallChange > 10) overallTrend = 'increasing';
    else if (overallChange < -10) overallTrend = 'decreasing';
  }

  res.status(200).json({
    success: true,
    data: {
      testCode,
      testName: results[0]?.test?.testName,
      history: trendData,
      deltas,
      overallTrend,
      latestValue: trendData[trendData.length - 1]?.value,
      previousValue: trendData.length > 1 ? trendData[trendData.length - 2]?.value : null
    }
  });
});

/**
 * @desc    Calculate and attach delta to new result entry
 * @route   POST /api/laboratory/calculate-delta
 * @access  Private (Lab Tech)
 */
exports.calculateDelta = asyncHandler(async (req, res) => {
  const { patientId, testCode, currentValue, componentName } = req.body;

  if (!patientId || !testCode || currentValue === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Missing required: patientId, testCode, currentValue'
    });
  }

  // Get most recent previous result
  const previousResult = await LabResult.findOne({
    patient: patientId,
    'test.testCode': testCode,
    status: { $in: ['final', 'corrected', 'amended'] }
  })
    .sort({ performedAt: -1 })
    .lean();

  if (!previousResult) {
    return res.status(200).json({
      success: true,
      data: {
        hasPrevious: false,
        message: 'No previous result found for comparison'
      }
    });
  }

  // Find previous value
  let previousValue = null;
  if (componentName && previousResult.results) {
    const component = previousResult.results.find(r => r.parameter === componentName);
    previousValue = component?.numericValue || parseFloat(component?.value);
  } else if (previousResult.results && previousResult.results.length > 0) {
    previousValue = previousResult.results[0].numericValue || parseFloat(previousResult.results[0].value);
  }

  if (previousValue === null || isNaN(previousValue)) {
    return res.status(200).json({
      success: true,
      data: {
        hasPrevious: false,
        message: 'Previous result not numeric'
      }
    });
  }

  const numericCurrent = parseFloat(currentValue);
  const change = numericCurrent - previousValue;
  const changePercent = ((change / previousValue) * 100).toFixed(1);

  let trend = 'stable';
  if (change > 0) trend = 'increasing';
  else if (change < 0) trend = 'decreasing';

  // Flag significant changes (>20% change)
  const isSignificant = Math.abs(parseFloat(changePercent)) > 20;

  res.status(200).json({
    success: true,
    data: {
      hasPrevious: true,
      previousValue,
      previousDate: previousResult.performedAt,
      previousResultId: previousResult.resultId,
      currentValue: numericCurrent,
      change: change.toFixed(2),
      changePercent: parseFloat(changePercent),
      trend,
      isSignificant,
      delta: {
        previousValue,
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat(changePercent),
        trend
      }
    }
  });
});

// ============================================
// COMPLETED TESTS (Visit-embedded + Standalone)
// ============================================

// @desc    Get completed laboratory tests
// @route   GET /api/laboratory/completed
// @access  Private
exports.getCompletedTests = asyncHandler(async (req, res) => {
  const { patientId, dateFrom, dateTo, limit = 50, page = 1 } = req.query;

  const visitQuery = { 'laboratoryOrders.status': { $in: ['completed', 'verified'] } };
  const labOrderQuery = { status: { $in: ['completed', 'verified'] } };

  if (patientId) {
    visitQuery.patient = patientId;
    labOrderQuery.patient = patientId;
  }

  if (dateFrom || dateTo) {
    visitQuery['laboratoryOrders.completedAt'] = {};
    labOrderQuery.completedAt = {};
    if (dateFrom) {
      visitQuery['laboratoryOrders.completedAt'].$gte = new Date(dateFrom);
      labOrderQuery.completedAt.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      visitQuery['laboratoryOrders.completedAt'].$lte = new Date(dateTo);
      labOrderQuery.completedAt.$lte = new Date(dateTo);
    }
  }

  // Fetch from both Visit-embedded orders AND standalone LabOrder model
  const [visits, labOrders] = await Promise.all([
    // 1. Visit-embedded laboratory orders
    Visit.find(visitQuery)
      .populate('patient', 'firstName lastName patientId dateOfBirth gender')
      .populate('primaryProvider', 'firstName lastName')
      .select('laboratoryOrders visitDate')
      .sort('-visitDate')
      .lean(),

    // 2. Standalone LabOrder model
    LabOrder.find(labOrderQuery)
      .populate('patient', 'firstName lastName patientId dateOfBirth gender')
      .populate('orderedBy', 'firstName lastName')
      .populate('tests.results')
      .sort('-completedAt')
      .lean()
  ]);

  // Extract completed tests from Visit-embedded orders
  const completedTests = [];
  visits.forEach(visit => {
    if (visit.laboratoryOrders) {
      visit.laboratoryOrders
        .filter(test => ['completed', 'verified'].includes(test.status))
        .forEach(test => {
          completedTests.push({
            ...test,
            _id: test._id,
            patient: visit.patient,
            provider: visit.primaryProvider,
            visitId: visit._id,
            visitDate: visit.visitDate,
            source: 'visit'
          });
        });
    }
  });

  // Add standalone LabOrders
  labOrders.forEach(order => {
    completedTests.push({
      _id: order._id,
      orderId: order.orderId,
      status: order.status,
      tests: order.tests,
      patient: order.patient,
      provider: order.orderedBy,
      completedAt: order.completedAt,
      verifiedAt: order.verifiedAt,
      results: order.tests?.map(t => t.results).filter(Boolean),
      source: 'labOrder'
    });
  });

  // Sort by completion date (newest first)
  completedTests.sort((a, b) => {
    const dateA = new Date(a.completedAt || a.verifiedAt || 0);
    const dateB = new Date(b.completedAt || b.verifiedAt || 0);
    return dateB - dateA;
  });

  // Pagination
  const total = completedTests.length;
  const startIndex = (page - 1) * limit;
  const paginatedTests = completedTests.slice(startIndex, startIndex + parseInt(limit));

  res.status(200).json({
    success: true,
    count: paginatedTests.length,
    total,
    pages: Math.ceil(total / limit),
    data: paginatedTests
  });
});

module.exports = exports;
