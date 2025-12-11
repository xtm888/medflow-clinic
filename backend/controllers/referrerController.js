const Referrer = require('../models/Referrer');
const Invoice = require('../models/Invoice');
const Patient = require('../models/Patient');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Get all referrers
// @route   GET /api/referrers
// @access  Private
exports.getReferrers = asyncHandler(async (req, res) => {
  const { type, isActive = 'true', search } = req.query;

  const query = {};

  if (type) query.type = type;
  if (isActive !== 'all') query.isActive = isActive === 'true';

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { clinic: { $regex: search, $options: 'i' } },
      { specialty: { $regex: search, $options: 'i' } }
    ];
  }

  const referrers = await Referrer.find(query)
    .populate('user', 'firstName lastName email')
    .sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: referrers.length,
    data: referrers
  });
});

// @desc    Get single referrer
// @route   GET /api/referrers/:id
// @access  Private
exports.getReferrer = asyncHandler(async (req, res) => {
  const referrer = await Referrer.findById(req.params.id)
    .populate('user', 'firstName lastName email');

  if (!referrer) {
    return res.status(404).json({
      success: false,
      error: 'Référent non trouvé'
    });
  }

  res.status(200).json({
    success: true,
    data: referrer
  });
});

// @desc    Create referrer
// @route   POST /api/referrers
// @access  Private (Admin, Manager)
exports.createReferrer = asyncHandler(async (req, res) => {
  const referrer = await Referrer.create(req.body);

  res.status(201).json({
    success: true,
    data: referrer
  });
});

// @desc    Update referrer
// @route   PUT /api/referrers/:id
// @access  Private (Admin, Manager)
exports.updateReferrer = asyncHandler(async (req, res) => {
  const referrer = await Referrer.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!referrer) {
    return res.status(404).json({
      success: false,
      error: 'Référent non trouvé'
    });
  }

  res.status(200).json({
    success: true,
    data: referrer
  });
});

// @desc    Delete referrer (soft delete)
// @route   DELETE /api/referrers/:id
// @access  Private (Admin)
exports.deleteReferrer = asyncHandler(async (req, res) => {
  const referrer = await Referrer.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!referrer) {
    return res.status(404).json({
      success: false,
      error: 'Référent non trouvé'
    });
  }

  res.status(200).json({
    success: true,
    data: referrer
  });
});

// @desc    Get commission report for a referrer
// @route   GET /api/referrers/:id/commissions
// @access  Private (Admin, Accountant)
exports.getReferrerCommissions = asyncHandler(async (req, res) => {
  const { startDate, endDate, status } = req.query;

  const query = { 'referrerCommission.referrer': req.params.id };

  if (startDate || endDate) {
    query.dateIssued = {};
    if (startDate) query.dateIssued.$gte = new Date(startDate);
    if (endDate) query.dateIssued.$lte = new Date(endDate);
  }

  if (status) {
    query['referrerCommission.status'] = status;
  }

  const invoices = await Invoice.find(query)
    .populate('patient', 'firstName lastName patientId')
    .select('invoiceId dateIssued summary.total referrerCommission patient')
    .sort({ dateIssued: -1 });

  // Calculate totals
  const totals = invoices.reduce((acc, inv) => {
    acc.totalInvoiced += inv.summary?.total || 0;
    acc.totalCommission += inv.referrerCommission?.commissionAmount || 0;
    if (inv.referrerCommission?.status === 'paid') {
      acc.totalPaid += inv.referrerCommission.commissionAmount || 0;
    } else {
      acc.totalPending += inv.referrerCommission?.commissionAmount || 0;
    }
    return acc;
  }, { totalInvoiced: 0, totalCommission: 0, totalPaid: 0, totalPending: 0 });

  res.status(200).json({
    success: true,
    count: invoices.length,
    totals,
    data: invoices
  });
});

// @desc    Get all commissions report
// @route   GET /api/referrers/commissions/report
// @access  Private (Admin, Accountant)
exports.getCommissionsReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, status, referrerType } = req.query;

  const matchStage = {
    'referrerCommission.referrer': { $exists: true, $ne: null }
  };

  if (startDate || endDate) {
    matchStage.dateIssued = {};
    if (startDate) matchStage.dateIssued.$gte = new Date(startDate);
    if (endDate) matchStage.dateIssued.$lte = new Date(endDate);
  }

  if (status) {
    matchStage['referrerCommission.status'] = status;
  }

  if (referrerType) {
    matchStage['referrerCommission.referrerType'] = referrerType;
  }

  const report = await Invoice.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$referrerCommission.referrer',
        referrerName: { $first: '$referrerCommission.referrerName' },
        referrerType: { $first: '$referrerCommission.referrerType' },
        invoiceCount: { $sum: 1 },
        totalInvoiced: { $sum: '$summary.total' },
        totalCommission: { $sum: '$referrerCommission.commissionAmount' },
        pendingCommission: {
          $sum: {
            $cond: [
              { $eq: ['$referrerCommission.status', 'pending'] },
              '$referrerCommission.commissionAmount',
              0
            ]
          }
        },
        paidCommission: {
          $sum: {
            $cond: [
              { $eq: ['$referrerCommission.status', 'paid'] },
              '$referrerCommission.commissionAmount',
              0
            ]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'referrers',
        localField: '_id',
        foreignField: '_id',
        as: 'referrerDetails'
      }
    },
    { $unwind: { path: '$referrerDetails', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        referrer: '$referrerDetails',
        referrerName: 1,
        referrerType: 1,
        invoiceCount: 1,
        totalInvoiced: 1,
        totalCommission: 1,
        pendingCommission: 1,
        paidCommission: 1
      }
    },
    { $sort: { totalCommission: -1 } }
  ]);

  // Calculate grand totals
  const grandTotals = report.reduce((acc, r) => {
    acc.totalInvoiced += r.totalInvoiced;
    acc.totalCommission += r.totalCommission;
    acc.pendingCommission += r.pendingCommission;
    acc.paidCommission += r.paidCommission;
    return acc;
  }, { totalInvoiced: 0, totalCommission: 0, pendingCommission: 0, paidCommission: 0 });

  res.status(200).json({
    success: true,
    count: report.length,
    grandTotals,
    data: report
  });
});

// @desc    Mark commission as paid
// @route   PUT /api/referrers/commissions/:invoiceId/pay
// @access  Private (Admin, Accountant)
exports.markCommissionPaid = asyncHandler(async (req, res) => {
  const { paymentReference, notes } = req.body;

  const invoice = await Invoice.findByIdAndUpdate(
    req.params.invoiceId,
    {
      'referrerCommission.status': 'paid',
      'referrerCommission.paidAt': new Date(),
      'referrerCommission.paidBy': req.user.id,
      'referrerCommission.paymentReference': paymentReference,
      'referrerCommission.notes': notes
    },
    { new: true }
  );

  if (!invoice) {
    return res.status(404).json({
      success: false,
      error: 'Facture non trouvée'
    });
  }

  // Update referrer stats
  if (invoice.referrerCommission?.referrer) {
    await Referrer.findByIdAndUpdate(
      invoice.referrerCommission.referrer,
      {
        $inc: { 'stats.totalCommissionEarned': invoice.referrerCommission.commissionAmount }
      }
    );
  }

  res.status(200).json({
    success: true,
    data: invoice
  });
});

// @desc    Calculate and add commission to invoice
// @route   POST /api/referrers/calculate-commission
// @access  Private
exports.calculateCommission = asyncHandler(async (req, res) => {
  const { invoiceId, referrerId, customRate, customType } = req.body;

  const invoice = await Invoice.findById(invoiceId).populate('patient');
  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Facture non trouvée' });
  }

  // Get referrer - use provided or from patient
  const refId = referrerId || invoice.patient?.referrer;
  if (!refId) {
    return res.status(400).json({ success: false, error: 'Aucun référent spécifié' });
  }

  const referrer = await Referrer.findById(refId);
  if (!referrer) {
    return res.status(404).json({ success: false, error: 'Référent non trouvé' });
  }

  // Calculate commission
  const baseAmount = invoice.summary?.total || 0;
  const commissionType = customType || referrer.commissionType;
  const commissionRate = customRate || referrer.defaultCommissionRate || referrer.fixedAmount;

  let commissionAmount;
  if (commissionType === 'fixed') {
    commissionAmount = commissionRate;
  } else {
    commissionAmount = baseAmount * commissionRate / 100;
  }

  // Update invoice with commission
  invoice.referrerCommission = {
    referrer: referrer._id,
    referrerName: referrer.name,
    referrerType: referrer.type,
    commissionType,
    commissionRate,
    commissionAmount: Math.round(commissionAmount),
    baseAmount,
    status: 'pending'
  };

  await invoice.save();

  // Update referrer stats
  await Referrer.findByIdAndUpdate(refId, {
    $inc: { 'stats.totalReferrals': 1 },
    'stats.lastReferralDate': new Date()
  });

  res.status(200).json({
    success: true,
    data: {
      invoice,
      commission: {
        referrer: referrer.name,
        baseAmount,
        commissionRate,
        commissionType,
        commissionAmount: Math.round(commissionAmount)
      }
    }
  });
});
