const Invoice = require('../../models/Invoice');
const Patient = require('../../models/Patient');
const Company = require('../../models/Company');
const { asyncHandler } = require('../../middleware/errorHandler');

// Processing fee rates configuration
const PROCESSING_FEE_RATES = {
  'cash': { percentage: 0, fixed: 0 },
  'check': { percentage: 0, fixed: 0 },
  'bank-transfer': { percentage: 0, fixed: 0 },
  'card': { percentage: 2.9, fixed: 0.30 },
  'mobile-payment': { percentage: 1.5, fixed: 0 },
  'orange-money': { percentage: 2.0, fixed: 100 },
  'mtn-money': { percentage: 2.0, fixed: 100 },
  'wave': { percentage: 1.0, fixed: 0 },
  'insurance': { percentage: 0, fixed: 0 },
  'other': { percentage: 0, fixed: 0 }
};

// Helper to calculate processing fee
function calculateProcessingFee(amount, method, customRates = null) {
  const rates = customRates || PROCESSING_FEE_RATES[method] || { percentage: 0, fixed: 0 };
  const percentageFee = amount * (rates.percentage / 100);
  const totalFee = percentageFee + rates.fixed;

  return {
    amount: Math.round(totalFee * 100) / 100,
    percentage: rates.percentage,
    fixedFee: rates.fixed,
    netAmount: Math.round((amount - totalFee) * 100) / 100
  };
}

// @desc    Get billing statistics
// @route   GET /api/billing/statistics
// @access  Private (Admin, Accountant)
exports.getBillingStatistics = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get today's revenue (based on payment date, not invoice creation date)
  const todayStats = await Invoice.aggregate([
    { $unwind: { path: '$payments', preserveNullAndEmptyArrays: true } },
    {
      $match: {
        'payments.date': { $gte: todayStart }
      }
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: { $ifNull: ['$payments.amountInBaseCurrency', '$payments.amount'] } },
        transactions: { $sum: 1 }
      }
    }
  ]);

  // Get this month's revenue (from payments made this month, regardless of invoice date)
  const monthRevenue = await Invoice.aggregate([
    { $unwind: { path: '$payments', preserveNullAndEmptyArrays: false } },
    {
      $match: {
        'payments.date': { $gte: monthStart }
      }
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: { $ifNull: ['$payments.amountInBaseCurrency', '$payments.amount'] } }
      }
    }
  ]);

  // Get overall pending amounts (from all active invoices)
  const pendingStats = await Invoice.aggregate([
    {
      $match: {
        status: { $nin: ['cancelled', 'refunded', 'draft'] }
      }
    },
    {
      $group: {
        _id: null,
        totalInvoiced: { $sum: '$summary.total' },
        totalPaid: { $sum: '$summary.amountPaid' },
        pending: { $sum: '$summary.amountDue' }
      }
    }
  ]);

  const monthStats = {
    totalInvoiced: pendingStats[0]?.totalInvoiced || 0,
    revenue: monthRevenue[0]?.revenue || 0,
    pending: pendingStats[0]?.pending || 0
  };

  // Get monthly trends for last 6 months
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const monthlyTrends = await Invoice.aggregate([
    {
      $match: {
        createdAt: { $gte: sixMonthsAgo },
        status: { $in: ['paid', 'partial'] }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        revenue: { $sum: '$summary.amountPaid' }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    },
    {
      $project: {
        _id: 0,
        month: {
          $concat: [
            { $toString: '$_id.year' },
            '-',
            { $cond: [{ $lt: ['$_id.month', 10] }, { $concat: ['0', { $toString: '$_id.month' }] }, { $toString: '$_id.month' }] }
          ]
        },
        revenue: 1
      }
    }
  ]);

  // Get revenue by service category
  const revenueByService = await Invoice.aggregate([
    {
      $match: {
        createdAt: { $gte: monthStart },
        status: { $in: ['paid', 'partial'] }
      }
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.category',
        revenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } },
        count: { $sum: '$items.quantity' }
      }
    },
    {
      $project: {
        _id: 0,
        service: { $ifNull: ['$_id', 'Autre'] },
        amount: '$revenue',
        count: 1
      }
    },
    { $sort: { amount: -1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      today: todayStats[0] || { revenue: 0, transactions: 0 },
      thisMonth: monthStats,
      monthlyTrends,
      revenueByService
    }
  });
});

// @desc    Get revenue report
// @route   GET /api/billing/reports/revenue
// @access  Private (Admin, Accountant)
exports.getRevenueReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, groupBy = 'day' } = req.query;

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  let dateFormat;
  switch (groupBy) {
    case 'month':
      dateFormat = '%Y-%m';
      break;
    case 'week':
      dateFormat = '%Y-W%V';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  const report = await Invoice.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        status: { $in: ['paid', 'partial'] }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
        revenue: { $sum: '$summary.amountPaid' },
        invoiceCount: { $sum: 1 },
        avgTransaction: { $avg: '$summary.amountPaid' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Get totals
  const totals = await Invoice.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        status: { $in: ['paid', 'partial'] }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$summary.amountPaid' },
        totalInvoices: { $sum: 1 }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      report,
      totals: totals[0] || { totalRevenue: 0, totalInvoices: 0 },
      period: { start, end, groupBy }
    }
  });
});

// @desc    Get aging report (Accounts Receivable Aging)
// @route   GET /api/billing/reports/aging
// @access  Private (Admin, Accountant)
exports.getAgingReport = asyncHandler(async (req, res) => {
  const { asOfDate, includePatientDetails = false } = req.query;
  const today = asOfDate ? new Date(asOfDate) : new Date();

  // Define aging buckets
  const agingBuckets = [
    { name: 'Current', min: -Infinity, max: 0 },
    { name: '1-30 Days', min: 0, max: 30 },
    { name: '31-60 Days', min: 30, max: 60 },
    { name: '61-90 Days', min: 60, max: 90 },
    { name: '91-120 Days', min: 90, max: 120 },
    { name: '120+ Days', min: 120, max: Infinity }
  ];

  // Get all unpaid invoices with patient info
  const unpaidInvoices = await Invoice.aggregate([
    {
      $match: {
        status: { $in: ['issued', 'sent', 'viewed', 'partial', 'overdue'] },
        'summary.amountDue': { $gt: 0 }
      }
    },
    {
      $addFields: {
        daysOverdue: {
          $max: [
            0,
            {
              $divide: [
                { $subtract: [today, '$dueDate'] },
                1000 * 60 * 60 * 24
              ]
            }
          ]
        },
        daysSinceIssued: {
          $divide: [
            { $subtract: [today, '$dateIssued'] },
            1000 * 60 * 60 * 24
          ]
        }
      }
    },
    {
      $lookup: {
        from: 'patients',
        localField: 'patient',
        foreignField: '_id',
        as: 'patientInfo'
      }
    },
    {
      $unwind: {
        path: '$patientInfo',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        invoiceId: 1,
        dateIssued: 1,
        dueDate: 1,
        daysOverdue: 1,
        daysSinceIssued: 1,
        amountDue: '$summary.amountDue',
        total: '$summary.total',
        amountPaid: '$summary.amountPaid',
        status: 1,
        patient: {
          _id: '$patientInfo._id',
          patientId: '$patientInfo.patientId',
          firstName: '$patientInfo.firstName',
          lastName: '$patientInfo.lastName',
          phoneNumber: '$patientInfo.phoneNumber'
        }
      }
    },
    { $sort: { daysOverdue: -1 } }
  ]);

  // Categorize invoices into aging buckets
  const bucketedData = agingBuckets.map(bucket => ({
    range: bucket.name,
    count: 0,
    totalAmount: 0,
    invoices: []
  }));

  let grandTotal = 0;
  let totalInvoices = 0;

  for (const invoice of unpaidInvoices) {
    const days = Math.floor(invoice.daysOverdue);
    grandTotal += invoice.amountDue;
    totalInvoices++;

    // Find the appropriate bucket
    for (let i = 0; i < agingBuckets.length; i++) {
      const bucket = agingBuckets[i];
      if (days >= bucket.min && days < bucket.max) {
        bucketedData[i].count++;
        bucketedData[i].totalAmount += invoice.amountDue;
        if (includePatientDetails === 'true') {
          bucketedData[i].invoices.push({
            invoiceId: invoice.invoiceId,
            patient: invoice.patient,
            amountDue: invoice.amountDue,
            daysOverdue: days,
            dateIssued: invoice.dateIssued,
            dueDate: invoice.dueDate
          });
        }
        break;
      }
    }
  }

  // Calculate percentages
  const formattedBuckets = bucketedData.map(bucket => ({
    ...bucket,
    totalAmount: Math.round(bucket.totalAmount * 100) / 100,
    percentage: grandTotal > 0 ? Math.round((bucket.totalAmount / grandTotal) * 10000) / 100 : 0
  }));

  // Remove empty invoices array if not requested
  if (includePatientDetails !== 'true') {
    formattedBuckets.forEach(bucket => delete bucket.invoices);
  }

  res.status(200).json({
    success: true,
    data: {
      asOfDate: today,
      summary: {
        totalOutstanding: Math.round(grandTotal * 100) / 100,
        totalInvoices,
        averageInvoiceAge: totalInvoices > 0
          ? Math.round(unpaidInvoices.reduce((sum, inv) => sum + inv.daysOverdue, 0) / totalInvoices)
          : 0
      },
      buckets: formattedBuckets
    }
  });
});

// @desc    Get detailed aging report by patient
// @route   GET /api/billing/reports/aging/by-patient
// @access  Private (Admin, Accountant)
exports.getAgingReportByPatient = asyncHandler(async (req, res) => {
  const { asOfDate, minBalance = 0 } = req.query;
  const today = asOfDate ? new Date(asOfDate) : new Date();

  const patientAging = await Invoice.aggregate([
    {
      $match: {
        status: { $in: ['issued', 'sent', 'viewed', 'partial', 'overdue'] },
        'summary.amountDue': { $gt: parseFloat(minBalance) }
      }
    },
    {
      $addFields: {
        daysOverdue: {
          $max: [
            0,
            {
              $divide: [
                { $subtract: [today, '$dueDate'] },
                1000 * 60 * 60 * 24
              ]
            }
          ]
        }
      }
    },
    {
      $group: {
        _id: '$patient',
        totalDue: { $sum: '$summary.amountDue' },
        invoiceCount: { $sum: 1 },
        oldestInvoiceDate: { $min: '$dateIssued' },
        maxDaysOverdue: { $max: '$daysOverdue' },
        current: {
          $sum: {
            $cond: [{ $lt: ['$daysOverdue', 1] }, '$summary.amountDue', 0]
          }
        },
        days1to30: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ['$daysOverdue', 1] }, { $lt: ['$daysOverdue', 31] }] },
              '$summary.amountDue',
              0
            ]
          }
        },
        days31to60: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ['$daysOverdue', 31] }, { $lt: ['$daysOverdue', 61] }] },
              '$summary.amountDue',
              0
            ]
          }
        },
        days61to90: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ['$daysOverdue', 61] }, { $lt: ['$daysOverdue', 91] }] },
              '$summary.amountDue',
              0
            ]
          }
        },
        days91to120: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ['$daysOverdue', 91] }, { $lt: ['$daysOverdue', 121] }] },
              '$summary.amountDue',
              0
            ]
          }
        },
        days120plus: {
          $sum: {
            $cond: [{ $gte: ['$daysOverdue', 121] }, '$summary.amountDue', 0]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'patients',
        localField: '_id',
        foreignField: '_id',
        as: 'patientInfo'
      }
    },
    { $unwind: '$patientInfo' },
    {
      $project: {
        patient: {
          _id: '$patientInfo._id',
          patientId: '$patientInfo.patientId',
          firstName: '$patientInfo.firstName',
          lastName: '$patientInfo.lastName',
          phoneNumber: '$patientInfo.phoneNumber',
          email: '$patientInfo.email'
        },
        totalDue: { $round: ['$totalDue', 2] },
        invoiceCount: 1,
        oldestInvoiceDate: 1,
        maxDaysOverdue: { $round: ['$maxDaysOverdue', 0] },
        aging: {
          current: { $round: ['$current', 2] },
          '1-30': { $round: ['$days1to30', 2] },
          '31-60': { $round: ['$days31to60', 2] },
          '61-90': { $round: ['$days61to90', 2] },
          '91-120': { $round: ['$days91to120', 2] },
          '120+': { $round: ['$days120plus', 2] }
        }
      }
    },
    { $sort: { totalDue: -1 } }
  ]);

  // Calculate totals
  const totals = patientAging.reduce((acc, p) => ({
    totalDue: acc.totalDue + p.totalDue,
    current: acc.current + p.aging.current,
    '1-30': acc['1-30'] + p.aging['1-30'],
    '31-60': acc['31-60'] + p.aging['31-60'],
    '61-90': acc['61-90'] + p.aging['61-90'],
    '91-120': acc['91-120'] + p.aging['91-120'],
    '120+': acc['120+'] + p.aging['120+']
  }), {
    totalDue: 0,
    current: 0,
    '1-30': 0,
    '31-60': 0,
    '61-90': 0,
    '91-120': 0,
    '120+': 0
  });

  res.status(200).json({
    success: true,
    data: {
      asOfDate: today,
      patientCount: patientAging.length,
      totals: {
        totalDue: Math.round(totals.totalDue * 100) / 100,
        aging: {
          current: Math.round(totals.current * 100) / 100,
          '1-30': Math.round(totals['1-30'] * 100) / 100,
          '31-60': Math.round(totals['31-60'] * 100) / 100,
          '61-90': Math.round(totals['61-90'] * 100) / 100,
          '91-120': Math.round(totals['91-120'] * 100) / 100,
          '120+': Math.round(totals['120+'] * 100) / 100
        }
      },
      patients: patientAging
    }
  });
});

// @desc    Get aging trend report (compare aging over time)
// @route   GET /api/billing/reports/aging/trend
// @access  Private (Admin, Accountant)
exports.getAgingTrendReport = asyncHandler(async (req, res) => {
  const { months = 6 } = req.query;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - parseInt(months));

  // Get monthly snapshots (simplified - in production would use historical snapshots)
  const monthlyData = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    // Get invoices that were outstanding at month end
    const monthlySnapshot = await Invoice.aggregate([
      {
        $match: {
          dateIssued: { $lte: monthEnd },
          $or: [
            { status: { $in: ['issued', 'sent', 'viewed', 'partial', 'overdue'] } },
            {
              status: 'paid',
              'payments.date': { $gt: monthEnd }
            }
          ]
        }
      },
      {
        $addFields: {
          // Calculate amount due as of month end
          paymentsBeforeMonthEnd: {
            $filter: {
              input: '$payments',
              as: 'payment',
              cond: { $lte: ['$$payment.date', monthEnd] }
            }
          }
        }
      },
      {
        $addFields: {
          paidByMonthEnd: {
            $reduce: {
              input: '$paymentsBeforeMonthEnd',
              initialValue: 0,
              in: { $add: ['$$value', '$$this.amount'] }
            }
          }
        }
      },
      {
        $addFields: {
          amountDueAtMonthEnd: {
            $max: [0, { $subtract: ['$summary.total', '$paidByMonthEnd'] }]
          }
        }
      },
      {
        $match: {
          amountDueAtMonthEnd: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: '$amountDueAtMonthEnd' },
          invoiceCount: { $sum: 1 }
        }
      }
    ]);

    monthlyData.push({
      month: currentDate.toISOString().slice(0, 7),
      totalOutstanding: monthlySnapshot[0]?.totalOutstanding || 0,
      invoiceCount: monthlySnapshot[0]?.invoiceCount || 0
    });

    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  // Calculate trend
  const firstMonth = monthlyData[0]?.totalOutstanding || 0;
  const lastMonth = monthlyData[monthlyData.length - 1]?.totalOutstanding || 0;
  const trend = firstMonth > 0
    ? Math.round(((lastMonth - firstMonth) / firstMonth) * 10000) / 100
    : 0;

  res.status(200).json({
    success: true,
    data: {
      period: { start: startDate, end: endDate, months: parseInt(months) },
      trend: {
        direction: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
        percentageChange: trend
      },
      monthlyData
    }
  });
});

// @desc    Get outstanding balances
// @route   GET /api/billing/outstanding-balances
// @access  Private (Admin, Accountant)
exports.getOutstandingBalances = asyncHandler(async (req, res) => {
  const balances = await Invoice.aggregate([
    {
      $match: {
        status: { $in: ['issued', 'sent', 'viewed', 'partial'] },
        'summary.amountDue': { $gt: 0 }
      }
    },
    {
      $group: {
        _id: '$patient',
        totalDue: { $sum: '$summary.amountDue' },
        invoiceCount: { $sum: 1 },
        oldestInvoice: { $min: '$dateIssued' }
      }
    },
    { $sort: { totalDue: -1 } },
    {
      $lookup: {
        from: 'patients',
        localField: '_id',
        foreignField: '_id',
        as: 'patient'
      }
    },
    { $unwind: '$patient' }
  ]);

  const total = balances.reduce((sum, b) => sum + b.totalDue, 0);

  res.status(200).json({
    success: true,
    data: {
      balances,
      summary: {
        totalOutstanding: total,
        patientCount: balances.length
      }
    }
  });
});

// @desc    Get daily reconciliation report
// @route   GET /api/billing/reports/daily-reconciliation
// @access  Private (Admin, Accountant)
exports.getDailyReconciliation = asyncHandler(async (req, res) => {
  const { date } = req.query;

  // Use provided date or today
  const reportDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(reportDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(reportDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Get all payments for the day
  const paymentsData = await Invoice.aggregate([
    { $unwind: '$payments' },
    {
      $match: {
        'payments.date': { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $lookup: {
        from: 'patients',
        localField: 'patient',
        foreignField: '_id',
        as: 'patientInfo'
      }
    },
    {
      $project: {
        invoiceId: 1,
        payment: '$payments',
        patient: { $arrayElemAt: ['$patientInfo', 0] }
      }
    },
    { $sort: { 'payment.date': 1 } }
  ]);

  // Group payments by method
  const byMethod = {};
  const byCurrency = {};
  let totalBaseCurrency = 0;

  for (const item of paymentsData) {
    const method = item.payment.method || 'other';
    const currency = item.payment.currency || 'CDF';
    const amount = item.payment.amount || 0;
    const amountInBase = item.payment.amountInBaseCurrency || amount;

    // By payment method
    if (!byMethod[method]) {
      byMethod[method] = { count: 0, amount: 0, transactions: [] };
    }
    byMethod[method].count++;
    byMethod[method].amount += amountInBase;
    byMethod[method].transactions.push({
      invoiceId: item.invoiceId,
      paymentId: item.payment.paymentId,
      patient: item.patient ? `${item.patient.firstName} ${item.patient.lastName}` : 'Unknown',
      amount,
      currency,
      amountInBaseCurrency: amountInBase,
      time: item.payment.date,
      reference: item.payment.reference
    });

    // By currency
    if (!byCurrency[currency]) {
      byCurrency[currency] = { count: 0, amount: 0 };
    }
    byCurrency[currency].count++;
    byCurrency[currency].amount += amount;

    totalBaseCurrency += amountInBase;
  }

  // Get refunds for the day
  const refundsData = await Invoice.aggregate([
    { $unwind: '$payments' },
    {
      $match: {
        'payments.date': { $gte: startOfDay, $lte: endOfDay },
        'payments.amount': { $lt: 0 }
      }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        totalRefunded: { $sum: { $abs: '$payments.amount' } }
      }
    }
  ]);

  const refunds = refundsData[0] || { count: 0, totalRefunded: 0 };

  // Get invoices issued today
  const invoicesIssued = await Invoice.aggregate([
    {
      $match: {
        dateIssued: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        totalAmount: { $sum: '$summary.total' }
      }
    }
  ]);

  const issued = invoicesIssued[0] || { count: 0, totalAmount: 0 };

  // Calculate cash drawer summary (cash payments only)
  const cashPayments = byMethod['cash'] || { count: 0, amount: 0 };
  const cashRefunds = paymentsData.filter(p =>
    p.payment.method === 'cash' && p.payment.amount < 0
  ).reduce((sum, p) => sum + Math.abs(p.payment.amount), 0);

  res.status(200).json({
    success: true,
    data: {
      date: reportDate.toISOString().split('T')[0],
      summary: {
        totalCollected: Math.round(totalBaseCurrency * 100) / 100,
        totalRefunded: refunds.totalRefunded,
        netCollected: Math.round((totalBaseCurrency - refunds.totalRefunded) * 100) / 100,
        transactionCount: paymentsData.length,
        baseCurrency: process.env.BASE_CURRENCY || 'CDF'
      },
      invoicesIssued: {
        count: issued.count,
        totalAmount: issued.totalAmount
      },
      cashDrawer: {
        openingBalance: 0,
        cashReceived: cashPayments.amount,
        cashRefunded: cashRefunds,
        expectedBalance: cashPayments.amount - cashRefunds,
        transactionCount: cashPayments.count
      },
      byPaymentMethod: Object.entries(byMethod).map(([method, data]) => ({
        method,
        count: data.count,
        amount: Math.round(data.amount * 100) / 100
      })),
      byCurrency: Object.entries(byCurrency).map(([currency, data]) => ({
        currency,
        count: data.count,
        amount: Math.round(data.amount * 100) / 100
      })),
      transactions: paymentsData.map(item => ({
        time: item.payment.date,
        invoiceId: item.invoiceId,
        paymentId: item.payment.paymentId,
        patient: item.patient ? `${item.patient.firstName} ${item.patient.lastName}` : 'Unknown',
        method: item.payment.method,
        amount: item.payment.amount,
        currency: item.payment.currency || 'CDF',
        reference: item.payment.reference
      }))
    }
  });
});

// @desc    Get processing fees report
// @route   GET /api/billing/reports/processing-fees
// @access  Private (Admin, Accountant)
exports.getProcessingFeesReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, groupBy = 'method' } = req.query;

  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  // Aggregate processing fees from payments
  const feesData = await Invoice.aggregate([
    { $unwind: '$payments' },
    {
      $match: {
        'payments.date': { $gte: start, $lte: end },
        'payments.amount': { $gt: 0 }
      }
    },
    {
      $project: {
        method: '$payments.method',
        amount: '$payments.amountInBaseCurrency',
        processingFee: '$payments.processingFee',
        date: '$payments.date',
        month: { $dateToString: { format: '%Y-%m', date: '$payments.date' } }
      }
    },
    {
      $group: {
        _id: groupBy === 'month' ? '$month' : '$method',
        totalAmount: { $sum: '$amount' },
        totalFees: { $sum: { $ifNull: ['$processingFee.amount', 0] } },
        transactionCount: { $sum: 1 },
        avgFeePercent: { $avg: { $ifNull: ['$processingFee.percentage', 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Calculate estimated fees for payments without recorded fees
  const estimatedFeesData = await Invoice.aggregate([
    { $unwind: '$payments' },
    {
      $match: {
        'payments.date': { $gte: start, $lte: end },
        'payments.amount': { $gt: 0 },
        $or: [
          { 'payments.processingFee': { $exists: false } },
          { 'payments.processingFee.amount': { $exists: false } },
          { 'payments.processingFee.amount': 0 }
        ]
      }
    },
    {
      $group: {
        _id: '$payments.method',
        totalAmount: { $sum: '$payments.amountInBaseCurrency' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Calculate estimated fees
  let totalEstimatedFees = 0;
  const estimatedByMethod = {};

  for (const item of estimatedFeesData) {
    const fee = calculateProcessingFee(item.totalAmount, item._id);
    estimatedByMethod[item._id] = {
      amount: item.totalAmount,
      estimatedFee: fee.amount,
      transactions: item.count
    };
    totalEstimatedFees += fee.amount;
  }

  // Calculate totals
  const totals = feesData.reduce((acc, item) => ({
    totalAmount: acc.totalAmount + item.totalAmount,
    totalRecordedFees: acc.totalRecordedFees + item.totalFees,
    transactionCount: acc.transactionCount + item.transactionCount
  }), { totalAmount: 0, totalRecordedFees: 0, transactionCount: 0 });

  res.status(200).json({
    success: true,
    data: {
      period: { start, end },
      summary: {
        totalGrossAmount: Math.round(totals.totalAmount * 100) / 100,
        totalRecordedFees: Math.round(totals.totalRecordedFees * 100) / 100,
        totalEstimatedFees: Math.round(totalEstimatedFees * 100) / 100,
        totalFees: Math.round((totals.totalRecordedFees + totalEstimatedFees) * 100) / 100,
        netRevenue: Math.round((totals.totalAmount - totals.totalRecordedFees - totalEstimatedFees) * 100) / 100,
        effectiveFeeRate: totals.totalAmount > 0
          ? Math.round(((totals.totalRecordedFees + totalEstimatedFees) / totals.totalAmount) * 10000) / 100
          : 0,
        transactionCount: totals.transactionCount
      },
      byGrouping: feesData.map(item => ({
        [groupBy]: item._id,
        grossAmount: Math.round(item.totalAmount * 100) / 100,
        recordedFees: Math.round(item.totalFees * 100) / 100,
        transactionCount: item.transactionCount,
        avgFeePercent: Math.round(item.avgFeePercent * 100) / 100
      })),
      estimatedFees: estimatedByMethod,
      feeRates: PROCESSING_FEE_RATES
    }
  });
});

// @desc    Get optical revenue report
// @route   GET /api/billing/reports/optical-revenue
// @access  Private (Admin, Accountant, Manager)
exports.getOpticalRevenue = asyncHandler(async (req, res) => {
  const { startDate, endDate, period = 'month' } = req.query;

  // Set date range defaults
  let start = startDate ? new Date(startDate) : new Date();
  let end = endDate ? new Date(endDate) : new Date();

  if (!startDate) {
    if (period === 'day') {
      start.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      start.setDate(start.getDate() - 7);
    } else if (period === 'month') {
      start.setMonth(start.getMonth() - 1);
    } else if (period === 'year') {
      start.setFullYear(start.getFullYear() - 1);
    }
  }

  const GlassesOrder = require('../../models/GlassesOrder');
  const FrameInventory = require('../../models/FrameInventory');
  const ContactLensInventory = require('../../models/ContactLensInventory');

  // Get completed glasses orders in date range
  const completedOrders = await GlassesOrder.find({
    status: 'delivered',
    'timeline.deliveredAt': { $gte: start, $lte: end }
  }).populate('patient', 'firstName lastName');

  // Calculate frame revenue
  const frameRevenue = completedOrders.reduce((sum, order) => {
    if (order.glasses?.frame?.sellingPrice) {
      return sum + order.glasses.frame.sellingPrice;
    }
    return sum;
  }, 0);

  // Calculate frame costs
  const frameCost = completedOrders.reduce((sum, order) => {
    if (order.glasses?.frame?.costPrice) {
      return sum + order.glasses.frame.costPrice;
    }
    return sum;
  }, 0);

  // Calculate contact lens revenue
  const contactLensRevenue = completedOrders.reduce((sum, order) => {
    let total = 0;
    if (order.contactLenses?.od?.sellingPrice) {
      total += order.contactLenses.od.sellingPrice * (order.contactLenses.od.quantity || 1);
    }
    if (order.contactLenses?.os?.sellingPrice) {
      total += order.contactLenses.os.sellingPrice * (order.contactLenses.os.quantity || 1);
    }
    return sum + total;
  }, 0);

  // Calculate contact lens costs
  const contactLensCost = completedOrders.reduce((sum, order) => {
    let total = 0;
    if (order.contactLenses?.od?.costPrice) {
      total += order.contactLenses.od.costPrice * (order.contactLenses.od.quantity || 1);
    }
    if (order.contactLenses?.os?.costPrice) {
      total += order.contactLenses.os.costPrice * (order.contactLenses.os.quantity || 1);
    }
    return sum + total;
  }, 0);

  // Get total optical items from invoices
  const opticalInvoices = await Invoice.aggregate([
    {
      $match: {
        dateIssued: { $gte: start, $lte: end },
        'items.category': { $in: ['frame', 'contact-lens', 'optical', 'device'] }
      }
    },
    { $unwind: '$items' },
    {
      $match: {
        $or: [
          { 'items.category': { $in: ['frame', 'contact-lens', 'optical'] } },
          { 'items.description': { $regex: /monture|lentille|frame|lens|lunettes/i } }
        ]
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$items.total' },
        count: { $sum: 1 }
      }
    }
  ]);

  const totalOpticalRevenue = frameRevenue + contactLensRevenue;
  const totalOpticalCost = frameCost + contactLensCost;
  const grossProfit = totalOpticalRevenue - totalOpticalCost;
  const marginPercent = totalOpticalRevenue > 0 ? (grossProfit / totalOpticalRevenue * 100) : 0;

  res.status(200).json({
    success: true,
    data: {
      period: { start, end },
      frames: {
        revenue: frameRevenue,
        cost: frameCost,
        profit: frameRevenue - frameCost,
        orderCount: completedOrders.filter(o => o.glasses?.frame?.inventoryItem).length
      },
      contactLenses: {
        revenue: contactLensRevenue,
        cost: contactLensCost,
        profit: contactLensRevenue - contactLensCost,
        orderCount: completedOrders.filter(o => o.contactLenses?.od?.inventoryItem || o.contactLenses?.os?.inventoryItem).length
      },
      total: {
        revenue: totalOpticalRevenue,
        cost: totalOpticalCost,
        grossProfit,
        marginPercent: Math.round(marginPercent * 100) / 100,
        orderCount: completedOrders.length
      },
      invoicedOptical: opticalInvoices[0] || { totalRevenue: 0, count: 0 }
    }
  });
});

// @desc    Get optical shop revenue with optician performance
// @route   GET /api/billing/reports/optical-shop
// @access  Private (Admin, Accountant, Manager)
exports.getOpticalShopRevenue = asyncHandler(async (req, res) => {
  const { startDate, endDate, period = 'month' } = req.query;

  // Set date range defaults
  let start = startDate ? new Date(startDate) : new Date();
  let end = endDate ? new Date(endDate) : new Date();

  if (!startDate) {
    start = new Date(start.getFullYear(), start.getMonth(), 1);
  }
  end.setHours(23, 59, 59, 999);

  const GlassesOrder = require('../../models/GlassesOrder');

  // Get all optical shop orders in date range with new pricing structure
  const orders = await GlassesOrder.find({
    createdAt: { $gte: start, $lte: end },
    'pricing.finalTotal': { $exists: true, $gt: 0 }
  })
    .populate('patient', 'firstName lastName fileNumber')
    .populate('opticalShop.optician', 'firstName lastName')
    .populate('invoice', 'invoiceId status summary.amountPaid');

  // Calculate total revenue
  const totalRevenue = orders.reduce((sum, o) => sum + (o.pricing?.finalTotal || 0), 0);
  const invoicedRevenue = orders.filter(o => o.invoice).reduce((sum, o) => sum + (o.pricing?.finalTotal || 0), 0);
  const uninvoicedRevenue = totalRevenue - invoicedRevenue;

  // Calculate convention vs cash split
  const conventionOrders = orders.filter(o => o.conventionBilling?.hasConvention && o.conventionBilling?.opticalCovered !== false);
  const cashOrders = orders.filter(o => !o.conventionBilling?.hasConvention || o.conventionBilling?.opticalCovered === false);

  const conventionRevenue = conventionOrders.reduce((sum, o) => sum + (o.pricing?.finalTotal || 0), 0);
  const conventionCompanyPortion = conventionOrders.reduce((sum, o) => sum + (o.pricing?.companyPortion || o.conventionBilling?.companyPortion || 0), 0);
  const conventionPatientPortion = conventionOrders.reduce((sum, o) => sum + (o.pricing?.patientPortion || o.conventionBilling?.patientPortion || 0), 0);
  const cashRevenue = cashOrders.reduce((sum, o) => sum + (o.pricing?.finalTotal || 0), 0);

  // Revenue breakdown by category
  const frameRevenue = orders.reduce((sum, o) => sum + (o.pricing?.framePrice || 0), 0);
  const lensRevenue = orders.reduce((sum, o) => sum + (o.pricing?.lensPrice || 0), 0);
  const optionsRevenue = orders.reduce((sum, o) => sum + (o.pricing?.optionsPrice || 0), 0);

  // Optician performance
  const opticianPerformance = await GlassesOrder.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        'pricing.finalTotal': { $exists: true, $gt: 0 },
        'opticalShop.optician': { $exists: true }
      }
    },
    {
      $group: {
        _id: '$opticalShop.optician',
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.finalTotal' },
        avgOrderValue: { $avg: '$pricing.finalTotal' },
        frameRevenue: { $sum: '$pricing.framePrice' },
        lensRevenue: { $sum: '$pricing.lensPrice' },
        conventionOrders: {
          $sum: { $cond: [{ $eq: ['$conventionBilling.hasConvention', true] }, 1, 0] }
        },
        conventionRevenue: {
          $sum: {
            $cond: [
              { $eq: ['$conventionBilling.hasConvention', true] },
              '$pricing.finalTotal',
              0
            ]
          }
        },
        deliveredOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'optician'
      }
    },
    { $unwind: { path: '$optician', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        opticianId: '$_id',
        opticianName: {
          $concat: [
            { $ifNull: ['$optician.firstName', 'Inconnu'] },
            ' ',
            { $ifNull: ['$optician.lastName', ''] }
          ]
        },
        totalOrders: 1,
        totalRevenue: 1,
        avgOrderValue: { $round: ['$avgOrderValue', 0] },
        frameRevenue: 1,
        lensRevenue: 1,
        conventionOrders: 1,
        conventionRevenue: 1,
        deliveredOrders: 1,
        cancelledOrders: 1,
        conversionRate: {
          $round: [
            { $multiply: [{ $divide: ['$deliveredOrders', { $max: ['$totalOrders', 1] }] }, 100] },
            1
          ]
        }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);

  // Status distribution
  const statusCounts = await GlassesOrder.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        'pricing.finalTotal': { $exists: true, $gt: 0 }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        revenue: { $sum: '$pricing.finalTotal' }
      }
    }
  ]);

  // Daily trend
  const dailyTrend = await GlassesOrder.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        'pricing.finalTotal': { $exists: true, $gt: 0 }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        orders: { $sum: 1 },
        revenue: { $sum: '$pricing.finalTotal' }
      }
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: '$_id',
        orders: 1,
        revenue: 1
      }
    }
  ]);

  // Convention breakdown by company
  const conventionBreakdown = await GlassesOrder.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        'conventionBilling.hasConvention': true,
        'conventionBilling.company.name': { $exists: true }
      }
    },
    {
      $group: {
        _id: '$conventionBilling.company.name',
        orders: { $sum: 1 },
        totalBilled: { $sum: '$pricing.finalTotal' },
        companyPortion: { $sum: '$conventionBilling.companyPortion' },
        patientPortion: { $sum: '$conventionBilling.patientPortion' }
      }
    },
    { $sort: { totalBilled: -1 } },
    { $limit: 10 }
  ]);

  res.status(200).json({
    success: true,
    data: {
      period: { start, end },
      summary: {
        totalOrders: orders.length,
        totalRevenue,
        invoicedRevenue,
        uninvoicedRevenue,
        avgOrderValue: orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0
      },
      breakdown: {
        frames: { revenue: frameRevenue, percent: totalRevenue > 0 ? Math.round(frameRevenue / totalRevenue * 100) : 0 },
        lenses: { revenue: lensRevenue, percent: totalRevenue > 0 ? Math.round(lensRevenue / totalRevenue * 100) : 0 },
        options: { revenue: optionsRevenue, percent: totalRevenue > 0 ? Math.round(optionsRevenue / totalRevenue * 100) : 0 }
      },
      paymentType: {
        convention: {
          orders: conventionOrders.length,
          totalRevenue: conventionRevenue,
          companyPortion: conventionCompanyPortion,
          patientPortion: conventionPatientPortion
        },
        cash: {
          orders: cashOrders.length,
          totalRevenue: cashRevenue
        }
      },
      conventionBreakdown,
      opticianPerformance,
      statusDistribution: statusCounts.map(s => ({
        status: s._id,
        count: s.count,
        revenue: s.revenue
      })),
      dailyTrend
    }
  });
});

// @desc    Get top selling optical products
// @route   GET /api/billing/reports/optical-top-sellers
// @access  Private (Admin, Accountant, Manager)
exports.getOpticalTopSellers = asyncHandler(async (req, res) => {
  const { startDate, endDate, type = 'all', limit = 10 } = req.query;

  let start = startDate ? new Date(startDate) : new Date();
  let end = endDate ? new Date(endDate) : new Date();

  if (!startDate) {
    start.setMonth(start.getMonth() - 3);
  }

  const FrameInventory = require('../../models/FrameInventory');
  const ContactLensInventory = require('../../models/ContactLensInventory');

  const results = {
    frames: [],
    contactLenses: []
  };

  // Top selling frames
  if (type === 'all' || type === 'frames') {
    results.frames = await FrameInventory.aggregate([
      {
        $match: {
          'usage.salesHistory': {
            $elemMatch: {
              date: { $gte: start, $lte: end }
            }
          }
        }
      },
      {
        $project: {
          brand: 1,
          model: 1,
          color: 1,
          sku: 1,
          category: 1,
          pricing: 1,
          salesInPeriod: {
            $size: {
              $filter: {
                input: '$usage.salesHistory',
                as: 'sale',
                cond: {
                  $and: [
                    { $gte: ['$$sale.date', start] },
                    { $lte: ['$$sale.date', end] }
                  ]
                }
              }
            }
          },
          revenueInPeriod: {
            $reduce: {
              input: {
                $filter: {
                  input: '$usage.salesHistory',
                  as: 'sale',
                  cond: {
                    $and: [
                      { $gte: ['$$sale.date', start] },
                      { $lte: ['$$sale.date', end] }
                    ]
                  }
                }
              },
              initialValue: 0,
              in: { $add: ['$$value', { $ifNull: ['$$this.quantity', 1] }] }
            }
          }
        }
      },
      { $sort: { salesInPeriod: -1 } },
      { $limit: parseInt(limit) }
    ]);
  }

  // Top selling contact lenses
  if (type === 'all' || type === 'contactLenses') {
    results.contactLenses = await ContactLensInventory.aggregate([
      {
        $match: {
          'usage.salesHistory': {
            $elemMatch: {
              date: { $gte: start, $lte: end }
            }
          }
        }
      },
      {
        $project: {
          brand: 1,
          productLine: 1,
          sku: 1,
          lensType: 1,
          wearSchedule: 1,
          pricing: 1,
          salesInPeriod: {
            $size: {
              $filter: {
                input: '$usage.salesHistory',
                as: 'sale',
                cond: {
                  $and: [
                    { $gte: ['$$sale.date', start] },
                    { $lte: ['$$sale.date', end] }
                  ]
                }
              }
            }
          }
        }
      },
      { $sort: { salesInPeriod: -1 } },
      { $limit: parseInt(limit) }
    ]);
  }

  res.status(200).json({
    success: true,
    data: {
      period: { start, end },
      ...results
    }
  });
});

// @desc    Get optical inventory value
// @route   GET /api/billing/reports/optical-inventory-value
// @access  Private (Admin, Accountant, Manager)
exports.getOpticalInventoryValue = asyncHandler(async (req, res) => {
  const FrameInventory = require('../../models/FrameInventory');
  const ContactLensInventory = require('../../models/ContactLensInventory');

  // Frame inventory value
  const frameStats = await FrameInventory.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$category',
        totalItems: { $sum: 1 },
        totalStock: { $sum: '$inventory.currentStock' },
        totalReserved: { $sum: '$inventory.reserved' },
        costValue: {
          $sum: {
            $multiply: ['$inventory.currentStock', { $ifNull: ['$pricing.costPrice', 0] }]
          }
        },
        retailValue: {
          $sum: {
            $multiply: ['$inventory.currentStock', { $ifNull: ['$pricing.sellingPrice', 0] }]
          }
        }
      }
    }
  ]);

  // Contact lens inventory value
  const contactLensStats = await ContactLensInventory.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$lensType',
        totalItems: { $sum: 1 },
        totalStock: { $sum: '$inventory.currentStock' },
        totalReserved: { $sum: '$inventory.reserved' },
        costValue: {
          $sum: {
            $multiply: ['$inventory.currentStock', { $ifNull: ['$pricing.costPrice', 0] }]
          }
        },
        retailValue: {
          $sum: {
            $multiply: ['$inventory.currentStock', { $ifNull: ['$pricing.sellingPrice', 0] }]
          }
        }
      }
    }
  ]);

  // Low stock items
  const lowStockFrames = await FrameInventory.countDocuments({
    isActive: true,
    'inventory.status': 'low-stock'
  });

  const outOfStockFrames = await FrameInventory.countDocuments({
    isActive: true,
    'inventory.status': 'out-of-stock'
  });

  const lowStockLenses = await ContactLensInventory.countDocuments({
    isActive: true,
    'inventory.status': 'low-stock'
  });

  const outOfStockLenses = await ContactLensInventory.countDocuments({
    isActive: true,
    'inventory.status': 'out-of-stock'
  });

  // Expiring contact lenses (within 90 days)
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

  const expiringLenses = await ContactLensInventory.countDocuments({
    isActive: true,
    'batches.expirationDate': { $lte: ninetyDaysFromNow, $gte: new Date() },
    'batches.status': 'active'
  });

  // Calculate totals
  const frameTotals = frameStats.reduce((acc, cat) => ({
    totalItems: acc.totalItems + cat.totalItems,
    totalStock: acc.totalStock + cat.totalStock,
    totalReserved: acc.totalReserved + cat.totalReserved,
    costValue: acc.costValue + cat.costValue,
    retailValue: acc.retailValue + cat.retailValue
  }), { totalItems: 0, totalStock: 0, totalReserved: 0, costValue: 0, retailValue: 0 });

  const lensTotals = contactLensStats.reduce((acc, cat) => ({
    totalItems: acc.totalItems + cat.totalItems,
    totalStock: acc.totalStock + cat.totalStock,
    totalReserved: acc.totalReserved + cat.totalReserved,
    costValue: acc.costValue + cat.costValue,
    retailValue: acc.retailValue + cat.retailValue
  }), { totalItems: 0, totalStock: 0, totalReserved: 0, costValue: 0, retailValue: 0 });

  res.status(200).json({
    success: true,
    data: {
      frames: {
        byCategory: frameStats,
        totals: frameTotals,
        alerts: {
          lowStock: lowStockFrames,
          outOfStock: outOfStockFrames
        }
      },
      contactLenses: {
        byType: contactLensStats,
        totals: lensTotals,
        alerts: {
          lowStock: lowStockLenses,
          outOfStock: outOfStockLenses,
          expiringSoon: expiringLenses
        }
      },
      grandTotal: {
        costValue: frameTotals.costValue + lensTotals.costValue,
        retailValue: frameTotals.retailValue + lensTotals.retailValue,
        potentialProfit: (frameTotals.retailValue + lensTotals.retailValue) - (frameTotals.costValue + lensTotals.costValue)
      }
    }
  });
});
