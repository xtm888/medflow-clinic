const Invoice = require('../models/Invoice');
const Patient = require('../models/Patient');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Get billing statistics
// @route   GET /api/billing/statistics
// @access  Private (Admin, Accountant)
exports.getBillingStatistics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  const [stats, recentPayments, topPatients] = await Promise.all([
    // Overall statistics
    Invoice.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalRevenue: { $sum: '$summary.total' },
          totalPaid: { $sum: '$summary.amountPaid' },
          totalOutstanding: { $sum: '$summary.amountDue' },
          avgInvoiceAmount: { $avg: '$summary.total' }
        }
      }
    ]),
    // Recent payments
    Invoice.aggregate([
      { $unwind: '$payments' },
      { $sort: { 'payments.date': -1 } },
      { $limit: 10 },
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
          amount: '$payments.amount',
          method: '$payments.method',
          date: '$payments.date',
          patient: { $arrayElemAt: ['$patientInfo', 0] }
        }
      }
    ]),
    // Top patients by revenue
    Invoice.aggregate([
      { $match: { ...dateFilter, status: 'paid' } },
      {
        $group: {
          _id: '$patient',
          totalSpent: { $sum: '$summary.total' },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'patients',
          localField: '_id',
          foreignField: '_id',
          as: 'patient'
        }
      }
    ])
  ]);

  res.status(200).json({
    success: true,
    data: {
      summary: stats[0] || {
        totalInvoices: 0,
        totalRevenue: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        avgInvoiceAmount: 0
      },
      recentPayments,
      topPatients
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

// @desc    Get aging report
// @route   GET /api/billing/reports/aging
// @access  Private (Admin, Accountant)
exports.getAgingReport = asyncHandler(async (req, res) => {
  const today = new Date();

  const aging = await Invoice.aggregate([
    {
      $match: {
        status: { $in: ['issued', 'sent', 'viewed', 'partial'] },
        'summary.amountDue': { $gt: 0 }
      }
    },
    {
      $addFields: {
        daysOverdue: {
          $divide: [
            { $subtract: [today, '$dueDate'] },
            1000 * 60 * 60 * 24
          ]
        }
      }
    },
    {
      $bucket: {
        groupBy: '$daysOverdue',
        boundaries: [0, 30, 60, 90, 120, Infinity],
        default: 'Other',
        output: {
          count: { $sum: 1 },
          totalAmount: { $sum: '$summary.amountDue' },
          invoices: { $push: { id: '$_id', patient: '$patient', amount: '$summary.amountDue' } }
        }
      }
    }
  ]);

  // Format the aging buckets
  const bucketNames = ['Current', '1-30 Days', '31-60 Days', '61-90 Days', '91-120 Days', '120+ Days'];
  const formattedAging = aging.map((bucket, index) => ({
    range: bucketNames[index] || 'Other',
    ...bucket
  }));

  res.status(200).json({
    success: true,
    data: formattedAging
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

// @desc    Get fee schedule
// @route   GET /api/billing/fee-schedule
// @access  Private
exports.getFeeSchedule = asyncHandler(async (req, res) => {
  // This would typically come from a database model
  // For now, return a sample fee schedule
  const feeSchedule = [
    { code: 'CONSULT', name: 'Consultation générale', price: 50.00, category: 'Consultation' },
    { code: 'CONSULT-SPEC', name: 'Consultation spécialisée', price: 75.00, category: 'Consultation' },
    { code: 'REF-EXAM', name: 'Examen de réfraction', price: 40.00, category: 'Ophtalmologie' },
    { code: 'TONO', name: 'Tonométrie', price: 25.00, category: 'Ophtalmologie' },
    { code: 'OCT', name: 'Tomographie par cohérence optique', price: 120.00, category: 'Imagerie' },
    { code: 'FOND-EYE', name: 'Fond d\'oeil', price: 45.00, category: 'Ophtalmologie' },
    { code: 'CHAMP-VIS', name: 'Champ visuel', price: 60.00, category: 'Ophtalmologie' },
    { code: 'IVT', name: 'Injection intravitréenne', price: 250.00, category: 'Procédure' },
    { code: 'LASER', name: 'Traitement laser', price: 300.00, category: 'Procédure' }
  ];

  res.status(200).json({
    success: true,
    data: feeSchedule
  });
});

// @desc    Get billing codes
// @route   GET /api/billing/codes
// @access  Private
exports.getBillingCodes = asyncHandler(async (req, res) => {
  const { type } = req.query;

  // Sample billing codes (ICD-10, CPT equivalents for ophthalmology)
  const codes = {
    diagnosis: [
      { code: 'H52.1', name: 'Myopie', category: 'Réfraction' },
      { code: 'H52.0', name: 'Hypermétropie', category: 'Réfraction' },
      { code: 'H52.2', name: 'Astigmatisme', category: 'Réfraction' },
      { code: 'H40.1', name: 'Glaucome primaire à angle ouvert', category: 'Glaucome' },
      { code: 'H35.3', name: 'DMLA', category: 'Rétine' },
      { code: 'E11.3', name: 'Rétinopathie diabétique', category: 'Rétine' },
      { code: 'H25.0', name: 'Cataracte sénile', category: 'Cristallin' }
    ],
    procedure: [
      { code: '92004', name: 'Examen ophtalmologique complet, nouveau patient', category: 'Consultation' },
      { code: '92012', name: 'Examen ophtalmologique complet, patient établi', category: 'Consultation' },
      { code: '92015', name: 'Détermination de réfraction', category: 'Réfraction' },
      { code: '92134', name: 'OCT', category: 'Imagerie' },
      { code: '67028', name: 'Injection intravitréenne', category: 'Procédure' }
    ]
  };

  const result = type ? { [type]: codes[type] || [] } : codes;

  res.status(200).json({
    success: true,
    data: result
  });
});

// @desc    Search billing codes
// @route   GET /api/billing/codes/search
// @access  Private
exports.searchBillingCodes = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({
      success: false,
      error: 'Search query is required'
    });
  }

  // This would typically search a database
  // For now, return sample results
  const allCodes = [
    { code: 'H52.1', name: 'Myopie', type: 'diagnosis' },
    { code: 'H40.1', name: 'Glaucome primaire à angle ouvert', type: 'diagnosis' },
    { code: '92004', name: 'Examen ophtalmologique complet', type: 'procedure' },
    { code: '67028', name: 'Injection intravitréenne', type: 'procedure' }
  ];

  const results = allCodes.filter(code =>
    code.code.toLowerCase().includes(q.toLowerCase()) ||
    code.name.toLowerCase().includes(q.toLowerCase())
  );

  res.status(200).json({
    success: true,
    data: results
  });
});

// @desc    Apply discount to invoice
// @route   POST /api/billing/invoices/:id/apply-discount
// @access  Private (Admin)
exports.applyDiscount = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return res.status(404).json({
      success: false,
      error: 'Invoice not found'
    });
  }

  const { amount, percentage, reason } = req.body;

  let discountAmount;
  if (percentage) {
    discountAmount = (invoice.summary.subtotal * percentage) / 100;
  } else if (amount) {
    discountAmount = amount;
  } else {
    return res.status(400).json({
      success: false,
      error: 'Discount amount or percentage is required'
    });
  }

  // Apply discount to summary
  invoice.summary.discount = (invoice.summary.discount || 0) + discountAmount;
  invoice.summary.total = invoice.summary.subtotal - invoice.summary.discount + invoice.summary.tax;
  invoice.summary.amountDue = invoice.summary.total - invoice.summary.amountPaid;

  // Log the discount
  if (!invoice.discounts) invoice.discounts = [];
  invoice.discounts.push({
    amount: discountAmount,
    reason,
    appliedBy: req.user.id,
    appliedAt: new Date()
  });

  invoice.updatedBy = req.user.id;
  await invoice.save();

  res.status(200).json({
    success: true,
    message: 'Discount applied successfully',
    data: invoice
  });
});

// @desc    Write off amount
// @route   POST /api/billing/invoices/:id/write-off
// @access  Private (Admin)
exports.writeOff = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return res.status(404).json({
      success: false,
      error: 'Invoice not found'
    });
  }

  const { amount, reason } = req.body;

  if (!amount || !reason) {
    return res.status(400).json({
      success: false,
      error: 'Amount and reason are required'
    });
  }

  if (amount > invoice.summary.amountDue) {
    return res.status(400).json({
      success: false,
      error: 'Write-off amount cannot exceed amount due'
    });
  }

  // Record write-off
  if (!invoice.writeOffs) invoice.writeOffs = [];
  invoice.writeOffs.push({
    amount,
    reason,
    writtenOffBy: req.user.id,
    date: new Date()
  });

  // Update amounts
  invoice.summary.amountDue -= amount;
  if (invoice.summary.amountDue <= 0) {
    invoice.status = 'paid';
  }

  invoice.updatedBy = req.user.id;
  await invoice.save();

  res.status(200).json({
    success: true,
    message: 'Amount written off successfully',
    data: invoice
  });
});

// @desc    Get payment methods
// @route   GET /api/billing/payment-methods
// @access  Private
exports.getPaymentMethods = asyncHandler(async (req, res) => {
  // Return available payment methods
  const methods = [
    { id: 'cash', name: 'Espèces', enabled: true, icon: 'banknote' },
    { id: 'card', name: 'Carte bancaire', enabled: true, icon: 'credit-card' },
    { id: 'mobile', name: 'Mobile Money', enabled: true, icon: 'smartphone' },
    { id: 'check', name: 'Chèque', enabled: true, icon: 'receipt' },
    { id: 'transfer', name: 'Virement bancaire', enabled: true, icon: 'building-2' },
    { id: 'insurance', name: 'Assurance', enabled: true, icon: 'shield-check' }
  ];

  res.status(200).json({
    success: true,
    data: methods
  });
});

// @desc    Get patient billing summary
// @route   GET /api/patients/:patientId/billing
// @access  Private
exports.getPatientBilling = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  const patient = await Patient.findById(patientId);
  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  const [invoices, stats] = await Promise.all([
    Invoice.find({ patient: patientId })
      .sort('-dateIssued')
      .limit(20),
    Invoice.aggregate([
      { $match: { patient: patient._id } },
      {
        $group: {
          _id: null,
          totalBilled: { $sum: '$summary.total' },
          totalPaid: { $sum: '$summary.amountPaid' },
          totalDue: { $sum: '$summary.amountDue' },
          invoiceCount: { $sum: 1 }
        }
      }
    ])
  ]);

  res.status(200).json({
    success: true,
    data: {
      invoices,
      summary: stats[0] || {
        totalBilled: 0,
        totalPaid: 0,
        totalDue: 0,
        invoiceCount: 0
      }
    }
  });
});

// @desc    Get payments list
// @route   GET /api/invoices/payments
// @access  Private (Admin, Accountant)
exports.getPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, startDate, endDate, method } = req.query;

  const match = {};
  if (startDate || endDate) {
    match['payments.date'] = {};
    if (startDate) match['payments.date'].$gte = new Date(startDate);
    if (endDate) match['payments.date'].$lte = new Date(endDate);
  }
  if (method) {
    match['payments.method'] = method;
  }

  const payments = await Invoice.aggregate([
    { $unwind: '$payments' },
    { $match: match },
    { $sort: { 'payments.date': -1 } },
    { $skip: (page - 1) * limit },
    { $limit: parseInt(limit) },
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
        invoiceId: '$invoiceId',
        payment: '$payments',
        patient: { $arrayElemAt: ['$patientInfo', 0] }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    count: payments.length,
    data: payments
  });
});
