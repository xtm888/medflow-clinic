/**
 * Fiscal Year Routes
 */

const express = require('express');
const router = express.Router();
const FiscalYear = require('../models/FiscalYear');
const { protect, authorize } = require('../middleware/auth');
const { logCriticalOperation } = require('../middleware/auditLogger');
const { asyncHandler } = require('../middleware/errorHandler');

// Protect all routes
router.use(protect);

// @desc    Get all fiscal years
// @route   GET /api/fiscal-years
// @access  Private (Admin, Accountant)
router.get('/', authorize('admin', 'accountant'), asyncHandler(async (req, res) => {
  const { status, includeClosed = true } = req.query;

  const query = {};
  if (status) {
    query.status = status;
  } else if (includeClosed === 'false') {
    query.status = { $nin: ['closed', 'archived'] };
  }

  const fiscalYears = await FiscalYear.find(query)
    .sort({ startDate: -1 })
    .populate('createdBy', 'firstName lastName')
    .populate('closingDetails.closedBy', 'firstName lastName');

  res.json({
    success: true,
    count: fiscalYears.length,
    data: fiscalYears
  });
}));

// @desc    Get current fiscal year
// @route   GET /api/fiscal-years/current
// @access  Private
router.get('/current', asyncHandler(async (req, res) => {
  const fiscalYear = await FiscalYear.getCurrentFiscalYear();

  if (!fiscalYear) {
    return res.status(404).json({
      success: false,
      error: 'No current fiscal year configured'
    });
  }

  res.json({
    success: true,
    data: fiscalYear
  });
}));

// @desc    Get fiscal year for a specific date
// @route   GET /api/fiscal-years/for-date
// @access  Private
router.get('/for-date', asyncHandler(async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({
      success: false,
      error: 'Date is required'
    });
  }

  const fiscalYear = await FiscalYear.getFiscalYearForDate(date);

  if (!fiscalYear) {
    return res.status(404).json({
      success: false,
      error: 'No fiscal year found for this date'
    });
  }

  res.json({
    success: true,
    data: fiscalYear
  });
}));

// @desc    Get fiscal year summary
// @route   GET /api/fiscal-years/:id/summary
// @access  Private (Admin, Accountant)
router.get('/:id/summary', authorize('admin', 'accountant'), asyncHandler(async (req, res) => {
  const summary = await FiscalYear.getFiscalYearSummary(req.params.id);

  res.json({
    success: true,
    data: summary
  });
}));

// @desc    Get single fiscal year
// @route   GET /api/fiscal-years/:id
// @access  Private (Admin, Accountant)
router.get('/:id', authorize('admin', 'accountant'), asyncHandler(async (req, res) => {
  const fiscalYear = await FiscalYear.findById(req.params.id)
    .populate('createdBy', 'firstName lastName')
    .populate('closingDetails.closedBy', 'firstName lastName')
    .populate('periods.closedBy', 'firstName lastName');

  if (!fiscalYear) {
    return res.status(404).json({
      success: false,
      error: 'Fiscal year not found'
    });
  }

  res.json({
    success: true,
    data: fiscalYear
  });
}));

// @desc    Create fiscal year
// @route   POST /api/fiscal-years
// @access  Private (Admin)
router.post(
  '/',
  authorize('admin'),
  logCriticalOperation('CREATE_FISCAL_YEAR'),
  asyncHandler(async (req, res) => {
    const { name, startDate, endDate, settings } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        success: false,
        error: 'End date must be after start date'
      });
    }

    const fiscalYear = await FiscalYear.createFiscalYear(
      { name, startDate, endDate, settings },
      req.user._id
    );

    res.status(201).json({
      success: true,
      data: fiscalYear
    });
  })
);

// @desc    Update fiscal year
// @route   PUT /api/fiscal-years/:id
// @access  Private (Admin)
router.put(
  '/:id',
  authorize('admin'),
  logCriticalOperation('UPDATE_FISCAL_YEAR'),
  asyncHandler(async (req, res) => {
    const fiscalYear = await FiscalYear.findById(req.params.id);

    if (!fiscalYear) {
      return res.status(404).json({
        success: false,
        error: 'Fiscal year not found'
      });
    }

    if (fiscalYear.status === 'closed' || fiscalYear.status === 'archived') {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify a closed or archived fiscal year'
      });
    }

    const allowedUpdates = ['name', 'settings', 'budget'];
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        fiscalYear[key] = req.body[key];
      }
    });

    fiscalYear.updatedBy = req.user._id;
    await fiscalYear.save();

    res.json({
      success: true,
      data: fiscalYear
    });
  })
);

// @desc    Activate fiscal year
// @route   POST /api/fiscal-years/:id/activate
// @access  Private (Admin)
router.post(
  '/:id/activate',
  authorize('admin'),
  logCriticalOperation('ACTIVATE_FISCAL_YEAR'),
  asyncHandler(async (req, res) => {
    const fiscalYear = await FiscalYear.findById(req.params.id);

    if (!fiscalYear) {
      return res.status(404).json({
        success: false,
        error: 'Fiscal year not found'
      });
    }

    await fiscalYear.activate(req.user._id);

    res.json({
      success: true,
      data: fiscalYear,
      message: `Fiscal year ${fiscalYear.name} is now active`
    });
  })
);

// @desc    Close a period
// @route   POST /api/fiscal-years/:id/periods/:periodNumber/close
// @access  Private (Admin, Accountant)
router.post(
  '/:id/periods/:periodNumber/close',
  authorize('admin', 'accountant'),
  logCriticalOperation('CLOSE_PERIOD'),
  asyncHandler(async (req, res) => {
    const fiscalYear = await FiscalYear.findById(req.params.id);

    if (!fiscalYear) {
      return res.status(404).json({
        success: false,
        error: 'Fiscal year not found'
      });
    }

    const { notes, softClose } = req.body;

    if (softClose) {
      await fiscalYear.softClosePeriod(parseInt(req.params.periodNumber), req.user._id);
    } else {
      await fiscalYear.closePeriod(parseInt(req.params.periodNumber), req.user._id, notes);
    }

    res.json({
      success: true,
      data: fiscalYear.periods.find(p => p.periodNumber === parseInt(req.params.periodNumber)),
      message: `Period ${req.params.periodNumber} has been ${softClose ? 'soft-' : ''}closed`
    });
  })
);

// @desc    Reopen a period
// @route   POST /api/fiscal-years/:id/periods/:periodNumber/reopen
// @access  Private (Admin)
router.post(
  '/:id/periods/:periodNumber/reopen',
  authorize('admin'),
  logCriticalOperation('REOPEN_PERIOD'),
  asyncHandler(async (req, res) => {
    const fiscalYear = await FiscalYear.findById(req.params.id);

    if (!fiscalYear) {
      return res.status(404).json({
        success: false,
        error: 'Fiscal year not found'
      });
    }

    await fiscalYear.reopenPeriod(parseInt(req.params.periodNumber), req.user._id, req.body.reason);

    res.json({
      success: true,
      data: fiscalYear.periods.find(p => p.periodNumber === parseInt(req.params.periodNumber)),
      message: `Period ${req.params.periodNumber} has been reopened`
    });
  })
);

// @desc    Close fiscal year
// @route   POST /api/fiscal-years/:id/close
// @access  Private (Admin)
router.post(
  '/:id/close',
  authorize('admin'),
  logCriticalOperation('CLOSE_FISCAL_YEAR'),
  asyncHandler(async (req, res) => {
    const fiscalYear = await FiscalYear.findById(req.params.id);

    if (!fiscalYear) {
      return res.status(404).json({
        success: false,
        error: 'Fiscal year not found'
      });
    }

    await fiscalYear.closeFiscalYear(req.user._id, req.body.notes);

    res.json({
      success: true,
      data: fiscalYear,
      message: `Fiscal year ${fiscalYear.name} has been closed`
    });
  })
);

// @desc    Check if can post to date
// @route   GET /api/fiscal-years/can-post
// @access  Private
router.get('/can-post', asyncHandler(async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({
      success: false,
      error: 'Date is required'
    });
  }

  const fiscalYear = await FiscalYear.getFiscalYearForDate(date);

  if (!fiscalYear) {
    return res.json({
      success: true,
      data: {
        allowed: false,
        reason: 'No fiscal year configured for this date'
      }
    });
  }

  const result = fiscalYear.canPostToDate(date);

  res.json({
    success: true,
    data: {
      ...result,
      fiscalYear: fiscalYear.fiscalYearId
    }
  });
}));

module.exports = router;
