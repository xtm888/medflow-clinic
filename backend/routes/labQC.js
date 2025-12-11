/**
 * Laboratory QC and Auto-Verification API Routes
 * Provides endpoints for Westgard QC rules and lab result auto-verification
 */
const express = require('express');
const router = express.Router();
const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');
const { asyncHandler } = require('../middleware/errorHandler');

// Import QC services
const westgardQCService = require('../services/westgardQCService');
const labAutoVerificationService = require('../services/labAutoVerificationService');

// Protect all routes
router.use(protect);

// ============================================
// WESTGARD QC ROUTES
// ============================================

// Evaluate Westgard rules
router.post('/qc/westgard/evaluate',
  requirePermission('manage_laboratory'),
  logAction('WESTGARD_EVALUATE'),
  asyncHandler(async (req, res) => {
    const { qcValues, mean, sd, previousValues } = req.body;

    if (!qcValues || !mean || !sd) {
      return res.status(400).json({
        success: false,
        error: 'QC values, mean, and standard deviation are required'
      });
    }

    const evaluation = westgardQCService.evaluateWestgardRules(
      qcValues,
      mean,
      sd,
      previousValues || []
    );

    res.json({ success: true, data: evaluation });
  })
);

// Process QC run
router.post('/qc/run',
  requirePermission('manage_laboratory'),
  logCriticalOperation('QC_RUN_PROCESS'),
  asyncHandler(async (req, res) => {
    const { testCode, controlLevel, measuredValue, lotNumber, performedBy, instrumentId } = req.body;

    if (!testCode || !controlLevel || measuredValue === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Test code, control level, and measured value are required'
      });
    }

    const result = await westgardQCService.processQCRun(
      testCode,
      controlLevel,
      measuredValue,
      lotNumber,
      performedBy || req.user._id,
      instrumentId
    );

    res.json({ success: true, data: result });
  })
);

// Get QC chart data
router.get('/qc/chart/:testCode/:controlLevel',
  requirePermission('view_laboratory', 'manage_laboratory'),
  logAction('QC_CHART_VIEW'),
  asyncHandler(async (req, res) => {
    const { testCode, controlLevel } = req.params;
    const { days = 30 } = req.query;

    const chartData = await westgardQCService.getQCChartData(
      testCode,
      controlLevel,
      parseInt(days)
    );

    res.json({ success: true, data: chartData });
  })
);

// Get QC statistics
router.get('/qc/stats/:testCode',
  requirePermission('view_laboratory', 'manage_laboratory'),
  logAction('QC_STATS_VIEW'),
  asyncHandler(async (req, res) => {
    const { testCode } = req.params;
    const { startDate, endDate } = req.query;

    const stats = await westgardQCService.getQCStatistics(
      testCode,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    res.json({ success: true, data: stats });
  })
);

// Get QC failures
router.get('/qc/failures',
  requirePermission('manage_laboratory'),
  logAction('QC_FAILURES_VIEW'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate, testCode, resolved } = req.query;

    const query = {};
    if (testCode) query.testCode = testCode;
    if (resolved !== undefined) query.resolved = resolved === 'true';
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const failures = await westgardQCService.getQCFailures(query);

    res.json({ success: true, data: failures });
  })
);

// ============================================
// AUTO-VERIFICATION ROUTES
// ============================================

// Process auto-verification for lab result
router.post('/auto-verify/process',
  requirePermission('manage_laboratory'),
  logCriticalOperation('AUTO_VERIFY_PROCESS'),
  asyncHandler(async (req, res) => {
    const { labResult, patientContext } = req.body;

    if (!labResult) {
      return res.status(400).json({
        success: false,
        error: 'Lab result data is required'
      });
    }

    const verificationResult = await labAutoVerificationService.processAutoVerification(
      labResult,
      patientContext || {}
    );

    res.json({ success: true, data: verificationResult });
  })
);

// Check critical values
router.post('/auto-verify/critical-check',
  requirePermission('view_laboratory', 'manage_laboratory'),
  logAction('CRITICAL_VALUE_CHECK'),
  asyncHandler(async (req, res) => {
    const { testCode, value, unit } = req.body;

    if (!testCode || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Test code and value are required'
      });
    }

    const isCritical = labAutoVerificationService.checkCriticalValue(testCode, value);

    res.json({
      success: true,
      data: {
        testCode,
        value,
        unit,
        isCritical,
        action: isCritical ? 'IMMEDIATE_NOTIFICATION_REQUIRED' : 'NORMAL'
      }
    });
  })
);

// Calculate delta check
router.post('/auto-verify/delta-check',
  requirePermission('view_laboratory', 'manage_laboratory'),
  logAction('DELTA_CHECK'),
  asyncHandler(async (req, res) => {
    const { testCode, currentValue, previousValue, previousDate } = req.body;

    if (!testCode || currentValue === undefined || previousValue === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Test code, current value, and previous value are required'
      });
    }

    const deltaResult = labAutoVerificationService.calculateDeltaCheck(
      testCode,
      currentValue,
      previousValue,
      previousDate ? new Date(previousDate) : undefined
    );

    res.json({ success: true, data: deltaResult });
  })
);

// Get auto-verification rules
router.get('/auto-verify/rules',
  requirePermission('view_laboratory', 'manage_laboratory'),
  logAction('AUTOVERIFY_RULES_VIEW'),
  asyncHandler(async (req, res) => {
    const rules = labAutoVerificationService.getAutoVerificationRules();

    res.json({ success: true, data: rules });
  })
);

// Get auto-verification statistics
router.get('/auto-verify/stats',
  requirePermission('manage_laboratory'),
  logAction('AUTOVERIFY_STATS_VIEW'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const stats = await labAutoVerificationService.getAutoVerificationStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    res.json({ success: true, data: stats });
  })
);

// Batch auto-verify results
router.post('/auto-verify/batch',
  requirePermission('manage_laboratory'),
  logCriticalOperation('AUTO_VERIFY_BATCH'),
  asyncHandler(async (req, res) => {
    const { labResults, patientContexts } = req.body;

    if (!labResults || !Array.isArray(labResults)) {
      return res.status(400).json({
        success: false,
        error: 'Array of lab results is required'
      });
    }

    const results = await Promise.all(
      labResults.map((result, index) =>
        labAutoVerificationService.processAutoVerification(
          result,
          patientContexts?.[index] || {}
        )
      )
    );

    const summary = {
      total: results.length,
      autoVerified: results.filter(r => r.autoVerified).length,
      pendingReview: results.filter(r => !r.autoVerified).length,
      criticalValues: results.filter(r => r.hasCriticalValue).length,
      deltaFlags: results.filter(r => r.deltaCheckFailed).length
    };

    res.json({
      success: true,
      data: { results, summary }
    });
  })
);

module.exports = router;
