const { asyncHandler } = require('../middleware/errorHandler');
const CentralInvoice = require('../models/CentralInvoice');
const CentralVisit = require('../models/CentralVisit');
const ClinicRegistry = require('../models/ClinicRegistry');

/**
 * @desc    Get consolidated revenue report
 * @route   GET /api/reports/revenue
 * @access  Private (clinic auth)
 */
exports.getConsolidatedRevenue = asyncHandler(async (req, res) => {
  const { startDate, endDate, groupBy = 'clinic', status = 'paid' } = req.query;

  const result = await CentralInvoice.getConsolidatedRevenue({
    startDate,
    endDate,
    groupBy,
    status
  });

  // Get clinic names if grouped by clinic
  if (groupBy === 'clinic') {
    const clinics = await ClinicRegistry.getActiveClinics();
    const clinicMap = clinics.reduce((acc, c) => {
      acc[c.clinicId] = { name: c.name, shortName: c.shortName };
      return acc;
    }, {});

    result.data = result.data.map(item => ({
      ...item,
      clinicName: clinicMap[item._id]?.name || item._id,
      clinicShortName: clinicMap[item._id]?.shortName || item._id
    }));
  }

  res.json({
    success: true,
    ...result
  });
});

/**
 * @desc    Get clinic comparison report
 * @route   GET /api/reports/clinic-comparison
 * @access  Private (clinic auth)
 */
exports.getClinicComparison = asyncHandler(async (req, res) => {
  const { period = 'month' } = req.query;

  const result = await CentralInvoice.getClinicComparison({ period });

  // Get clinic names
  const clinics = await ClinicRegistry.getActiveClinics();
  const clinicMap = clinics.reduce((acc, c) => {
    acc[c.clinicId] = { name: c.name, shortName: c.shortName };
    return acc;
  }, {});

  result.comparison = result.comparison.map(item => ({
    ...item,
    clinicName: clinicMap[item.clinic]?.name || item.clinic,
    clinicShortName: clinicMap[item.clinic]?.shortName || item.clinic
  }));

  res.json({
    success: true,
    ...result
  });
});

/**
 * @desc    Get revenue by category
 * @route   GET /api/reports/revenue-by-category
 * @access  Private (clinic auth)
 */
exports.getRevenueByCategory = asyncHandler(async (req, res) => {
  const { startDate, endDate, clinicId } = req.query;

  const result = await CentralInvoice.getRevenueByCategory({
    startDate,
    endDate,
    clinicId
  });

  // Get clinic names
  const clinics = await ClinicRegistry.getActiveClinics();
  const clinicMap = clinics.reduce((acc, c) => {
    acc[c.clinicId] = { name: c.name, shortName: c.shortName };
    return acc;
  }, {});

  const enrichedResult = result.map(item => ({
    clinic: {
      clinicId: item._id,
      name: clinicMap[item._id]?.name || item._id,
      shortName: clinicMap[item._id]?.shortName || item._id
    },
    categories: item.categories,
    totalRevenue: item.totalRevenue
  }));

  res.json({
    success: true,
    data: enrichedResult
  });
});

/**
 * @desc    Get payment method distribution
 * @route   GET /api/reports/payment-methods
 * @access  Private (clinic auth)
 */
exports.getPaymentMethodDistribution = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const result = await CentralInvoice.getPaymentMethodDistribution({
    startDate,
    endDate
  });

  // Get clinic names
  const clinics = await ClinicRegistry.getActiveClinics();
  const clinicMap = clinics.reduce((acc, c) => {
    acc[c.clinicId] = { name: c.name, shortName: c.shortName };
    return acc;
  }, {});

  const enrichedResult = result.map(item => ({
    clinic: {
      clinicId: item._id,
      name: clinicMap[item._id]?.name || item._id,
      shortName: clinicMap[item._id]?.shortName || item._id
    },
    methods: item.methods,
    totalAmount: item.totalAmount
  }));

  res.json({
    success: true,
    data: enrichedResult
  });
});

/**
 * @desc    Get dashboard summary
 * @route   GET /api/reports/dashboard
 * @access  Private (clinic auth)
 */
exports.getDashboardSummary = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  // Get clinic info
  const clinics = await ClinicRegistry.getActiveClinics();
  const clinicMap = clinics.reduce((acc, c) => {
    acc[c.clinicId] = { name: c.name, shortName: c.shortName };
    return acc;
  }, {});

  // Today's revenue
  const todayRevenue = await CentralInvoice.aggregate([
    {
      $match: {
        invoiceDate: { $gte: today },
        status: 'paid',
        _deleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: '$_sourceClinic',
        revenue: { $sum: '$total' },
        count: { $sum: 1 }
      }
    }
  ]);

  // This month revenue
  const thisMonthRevenue = await CentralInvoice.aggregate([
    {
      $match: {
        invoiceDate: { $gte: thisMonth },
        status: 'paid',
        _deleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: '$_sourceClinic',
        revenue: { $sum: '$total' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Last month revenue (for comparison)
  const lastMonthRevenue = await CentralInvoice.aggregate([
    {
      $match: {
        invoiceDate: { $gte: lastMonth, $lte: lastMonthEnd },
        status: 'paid',
        _deleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: '$total' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Today's visits
  const todayVisits = await CentralVisit.aggregate([
    {
      $match: {
        visitDate: { $gte: today },
        status: { $in: ['completed', 'checked-in', 'in-progress'] },
        _deleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: '$_sourceClinic',
        count: { $sum: 1 }
      }
    }
  ]);

  // Outstanding payments
  const outstanding = await CentralInvoice.aggregate([
    {
      $match: {
        status: { $in: ['pending', 'partial', 'overdue'] },
        _deleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: '$_sourceClinic',
        amount: { $sum: '$balance' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Format results with clinic names
  const formatWithClinicNames = (data) => {
    return data.map(item => ({
      clinic: clinicMap[item._id]?.name || item._id,
      clinicId: item._id,
      ...item
    }));
  };

  res.json({
    success: true,
    today: {
      date: today.toISOString().split('T')[0],
      revenue: formatWithClinicNames(todayRevenue),
      totalRevenue: todayRevenue.reduce((sum, r) => sum + r.revenue, 0),
      visits: formatWithClinicNames(todayVisits),
      totalVisits: todayVisits.reduce((sum, v) => sum + v.count, 0)
    },
    thisMonth: {
      month: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
      revenue: formatWithClinicNames(thisMonthRevenue),
      totalRevenue: thisMonthRevenue.reduce((sum, r) => sum + r.revenue, 0),
      invoiceCount: thisMonthRevenue.reduce((sum, r) => sum + r.count, 0)
    },
    comparison: {
      lastMonthRevenue: lastMonthRevenue[0]?.revenue || 0,
      currentMonthRevenue: thisMonthRevenue.reduce((sum, r) => sum + r.revenue, 0),
      growth: lastMonthRevenue[0]?.revenue > 0
        ? (((thisMonthRevenue.reduce((sum, r) => sum + r.revenue, 0) - lastMonthRevenue[0].revenue)
            / lastMonthRevenue[0].revenue) * 100).toFixed(1)
        : 100
    },
    outstanding: {
      byClinic: formatWithClinicNames(outstanding),
      totalAmount: outstanding.reduce((sum, o) => sum + o.amount, 0),
      totalInvoices: outstanding.reduce((sum, o) => sum + o.count, 0)
    },
    clinicsOnline: clinics.filter(c =>
      c.connection?.lastSeenAt &&
      (new Date() - new Date(c.connection.lastSeenAt)) < 5 * 60 * 1000
    ).length,
    totalClinics: clinics.length
  });
});

/**
 * @desc    Get outstanding payments by clinic
 * @route   GET /api/reports/outstanding
 * @access  Private (clinic auth)
 */
exports.getOutstanding = asyncHandler(async (req, res) => {
  const { clinicId, minAmount, daysOverdue } = req.query;

  const matchStage = {
    status: { $in: ['pending', 'partial', 'overdue'] },
    _deleted: { $ne: true }
  };

  if (clinicId) {
    matchStage._sourceClinic = clinicId;
  }

  if (minAmount) {
    matchStage.balance = { $gte: parseFloat(minAmount) };
  }

  if (daysOverdue) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(daysOverdue));
    matchStage.dueDate = { $lt: cutoff };
  }

  const outstanding = await CentralInvoice.find(matchStage)
    .sort({ balance: -1 })
    .limit(100)
    .lean();

  // Get clinic names
  const clinics = await ClinicRegistry.getActiveClinics();
  const clinicMap = clinics.reduce((acc, c) => {
    acc[c.clinicId] = { name: c.name, shortName: c.shortName };
    return acc;
  }, {});

  const enrichedOutstanding = outstanding.map(inv => ({
    _id: inv._id,
    invoiceNumber: inv.invoiceNumber,
    clinic: {
      clinicId: inv._sourceClinic,
      name: clinicMap[inv._sourceClinic]?.name || inv._sourceClinic
    },
    patient: inv.patient,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    total: inv.total,
    paidAmount: inv.paidAmount,
    balance: inv.balance,
    status: inv.status,
    daysOverdue: inv.dueDate
      ? Math.max(0, Math.ceil((new Date() - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24)))
      : 0
  }));

  res.json({
    success: true,
    count: enrichedOutstanding.length,
    invoices: enrichedOutstanding,
    summary: {
      totalOutstanding: enrichedOutstanding.reduce((sum, inv) => sum + inv.balance, 0),
      overdueCount: enrichedOutstanding.filter(inv => inv.daysOverdue > 0).length,
      overdueAmount: enrichedOutstanding
        .filter(inv => inv.daysOverdue > 0)
        .reduce((sum, inv) => sum + inv.balance, 0)
    }
  });
});
