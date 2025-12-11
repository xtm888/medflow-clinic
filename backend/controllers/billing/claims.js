const InsuranceClaim = require('../../models/InsuranceClaim');
const Invoice = require('../../models/Invoice');
const Patient = require('../../models/Patient');
const AuditLog = require('../../models/AuditLog');
const { asyncHandler } = require('../../middleware/errorHandler');

// @desc    Get all insurance claims
// @route   GET /api/billing/claims
// @access  Private
exports.getClaims = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, provider, patientId } = req.query;

  let query = {};
  if (status) query.status = status;
  if (provider) {
    // Escape special regex characters to prevent ReDoS/injection attacks
    const escapedProvider = provider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query['provider.name'] = new RegExp(escapedProvider, 'i');
  }
  if (patientId) query.patient = patientId;

  const claims = await InsuranceClaim.find(query)
    .populate('patient', 'firstName lastName patientId')
    .populate('invoice', 'invoiceId summary')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await InsuranceClaim.countDocuments(query);

  res.status(200).json({
    success: true,
    count: claims.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: claims
  });
});

// @desc    Get single insurance claim
// @route   GET /api/billing/claims/:id
// @access  Private
exports.getClaim = asyncHandler(async (req, res) => {
  const claim = await InsuranceClaim.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId dateOfBirth phoneNumber email')
    .populate('invoice')
    .populate('createdBy', 'name')
    .populate('statusHistory.updatedBy', 'name');

  if (!claim) {
    return res.status(404).json({ success: false, error: 'Claim not found' });
  }

  res.status(200).json({
    success: true,
    data: claim
  });
});

// @desc    Create insurance claim
// @route   POST /api/billing/claims
// @access  Private
exports.createClaim = asyncHandler(async (req, res) => {
  req.body.createdBy = req.user.id;

  // Get invoice details if provided
  if (req.body.invoiceId) {
    const invoice = await Invoice.findById(req.body.invoiceId).populate('patient');
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Check if claim already exists for this invoice
    const existingClaim = await InsuranceClaim.findOne({
      invoice: invoice._id,
      status: { $nin: ['denied', 'cancelled'] }
    });
    if (existingClaim) {
      return res.status(400).json({
        success: false,
        error: `Claim already exists for this invoice (Claim #${existingClaim.claimNumber})`,
        existingClaimId: existingClaim._id
      });
    }

    req.body.invoice = invoice._id;
    req.body.patient = invoice.patient._id;

    // Auto-populate services from invoice items
    if (!req.body.services) {
      req.body.services = invoice.items.map(item => ({
        code: item.code,
        description: item.description,
        dateOfService: invoice.dateIssued,
        units: item.quantity,
        chargedAmount: item.unitPrice * item.quantity,
        claimedAmount: item.unitPrice * item.quantity
      }));
    }

    // Set amounts from invoice
    const totalCharged = invoice.summary.total;
    const totalClaimed = req.body.amounts?.totalClaimed || invoice.summary.total;

    // Validate claimed amount doesn't exceed charged amount
    if (totalClaimed > totalCharged) {
      return res.status(400).json({
        success: false,
        error: `Claimed amount (${totalClaimed}) cannot exceed charged amount (${totalCharged})`
      });
    }

    // Validate claimed amount doesn't exceed remaining balance (if partially paid)
    const remainingBalance = invoice.summary.amountDue;
    if (totalClaimed > remainingBalance) {
      return res.status(400).json({
        success: false,
        error: `Claimed amount (${totalClaimed}) cannot exceed remaining balance (${remainingBalance}). Invoice already has ${invoice.summary.amountPaid} paid.`
      });
    }

    // Validate individual service amounts
    if (req.body.services) {
      for (const service of req.body.services) {
        if (service.claimedAmount > service.chargedAmount) {
          return res.status(400).json({
            success: false,
            error: `Service "${service.description}" claimed amount (${service.claimedAmount}) exceeds charged amount (${service.chargedAmount})`
          });
        }
      }
    }

    req.body.amounts = {
      totalCharged,
      totalClaimed
    };
  }

  // Validate total amounts if services are provided
  if (req.body.services && req.body.services.length > 0) {
    const calculatedTotal = req.body.services.reduce((sum, s) => sum + (s.claimedAmount || 0), 0);
    if (req.body.amounts?.totalClaimed && Math.abs(calculatedTotal - req.body.amounts.totalClaimed) > 0.01) {
      return res.status(400).json({
        success: false,
        error: `Total claimed amount (${req.body.amounts.totalClaimed}) doesn't match sum of service amounts (${calculatedTotal})`
      });
    }
  }

  const claim = await InsuranceClaim.create(req.body);

  // Audit log
  await AuditLog.create({
    user: req.user.id,
    action: 'INSURANCE_CLAIM_CREATE',
    resource: '/api/billing/claims',
    ipAddress: req.ip,
    metadata: {
      claimNumber: claim.claimNumber,
      invoiceId: req.body.invoiceId,
      totalClaimed: req.body.amounts?.totalClaimed
    }
  });

  res.status(201).json({
    success: true,
    data: claim
  });
});

// @desc    Submit insurance claim
// @route   POST /api/billing/claims/:id/submit
// @access  Private
exports.submitClaim = asyncHandler(async (req, res) => {
  const claim = await InsuranceClaim.findById(req.params.id);

  if (!claim) {
    return res.status(404).json({ success: false, error: 'Claim not found' });
  }

  const { method = 'electronic' } = req.body;
  await claim.submit(req.user.id, method);

  res.status(200).json({
    success: true,
    message: 'Claim submitted successfully',
    data: claim
  });
});

// @desc    Approve insurance claim
// @route   POST /api/billing/claims/:id/approve
// @access  Private (Admin, Accountant)
exports.approveClaim = asyncHandler(async (req, res) => {
  const claim = await InsuranceClaim.findById(req.params.id);

  if (!claim) {
    return res.status(404).json({ success: false, error: 'Claim not found' });
  }

  const { approvedAmount, patientResponsibility = 0, notes } = req.body;

  if (!approvedAmount && approvedAmount !== 0) {
    return res.status(400).json({ success: false, error: 'Approved amount is required' });
  }

  await claim.approve(req.user.id, approvedAmount, patientResponsibility, notes);

  res.status(200).json({
    success: true,
    message: 'Claim approved',
    data: claim
  });
});

// @desc    Deny insurance claim
// @route   POST /api/billing/claims/:id/deny
// @access  Private (Admin, Accountant)
exports.denyClaim = asyncHandler(async (req, res) => {
  const claim = await InsuranceClaim.findById(req.params.id);

  if (!claim) {
    return res.status(404).json({ success: false, error: 'Claim not found' });
  }

  const { reason, code, appealDeadline } = req.body;

  if (!reason) {
    return res.status(400).json({ success: false, error: 'Denial reason is required' });
  }

  await claim.deny(req.user.id, reason, code, appealDeadline);

  res.status(200).json({
    success: true,
    message: 'Claim denied',
    data: claim
  });
});

// @desc    Mark claim as paid
// @route   POST /api/billing/claims/:id/mark-paid
// @access  Private (Admin, Accountant)
exports.markClaimPaid = asyncHandler(async (req, res) => {
  const claim = await InsuranceClaim.findById(req.params.id);

  if (!claim) {
    return res.status(404).json({ success: false, error: 'Claim not found' });
  }

  const { paidAmount, checkNumber, eraNumber } = req.body;

  if (!paidAmount) {
    return res.status(400).json({ success: false, error: 'Paid amount is required' });
  }

  await claim.markPaid(req.user.id, paidAmount, checkNumber, eraNumber);

  // Update the associated invoice with insurance payment
  if (claim.invoice) {
    const invoice = await Invoice.findById(claim.invoice);
    if (invoice) {
      // Generate unique payment ID for audit trail
      const crypto = require('crypto');
      const paymentId = `INS${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      // Validate payment amount doesn't exceed what's owed
      const effectivePayment = Math.min(paidAmount, invoice.summary.amountDue);

      if (effectivePayment > 0) {
        invoice.payments.push({
          paymentId,
          amount: effectivePayment,
          method: 'insurance',
          reference: claim.claimNumber,
          notes: `Insurance payment - ERA: ${eraNumber || 'N/A'}, Check: ${checkNumber || 'N/A'}`,
          date: new Date(),
          receivedBy: req.user.id
        });

        invoice.summary.amountPaid += effectivePayment;
        invoice.summary.amountDue = Math.max(0, invoice.summary.amountDue - effectivePayment);

        // Update status based on remaining balance
        if (invoice.summary.amountDue <= 0) {
          invoice.status = 'paid';
        } else if (invoice.summary.amountPaid > 0) {
          invoice.status = 'partial';
        }

        invoice.updatedBy = req.user.id;
        await invoice.save();

        // Warn if insurance paid more than was due
        if (paidAmount > effectivePayment) {
          console.warn(`Insurance payment ${claim.claimNumber} was ${paidAmount} but only ${effectivePayment} was applied (remaining was ${paidAmount - effectivePayment})`);
        }
      }
    }
  }

  res.status(200).json({
    success: true,
    message: 'Claim marked as paid',
    data: claim
  });
});

// @desc    Get claims report
// @route   GET /api/billing/claims/report
// @access  Private (Admin, Accountant)
exports.getClaimsReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const report = await InsuranceClaim.getClaimsReport(start, end);

  res.status(200).json({
    success: true,
    data: report,
    period: { start, end }
  });
});

// @desc    Batch submit insurance claims
// @route   POST /api/billing/claims/batch-submit
// @access  Private
exports.batchSubmitClaims = asyncHandler(async (req, res) => {
  const { claimIds, method = 'electronic' } = req.body;

  if (!claimIds || claimIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one claim ID is required'
    });
  }

  const results = {
    success: [],
    failed: [],
    skipped: []
  };

  for (const claimId of claimIds) {
    try {
      const claim = await InsuranceClaim.findById(claimId);

      if (!claim) {
        results.failed.push({ id: claimId, error: 'Claim not found' });
        continue;
      }

      // Skip if already submitted
      if (['submitted', 'under_review', 'approved', 'paid'].includes(claim.status)) {
        results.skipped.push({
          id: claimId,
          claimNumber: claim.claimNumber,
          reason: `Claim already ${claim.status}`
        });
        continue;
      }

      // Validate claim is ready for submission
      if (!claim.provider || !claim.provider.name) {
        results.failed.push({ id: claimId, claimNumber: claim.claimNumber, error: 'Missing insurance provider' });
        continue;
      }

      if (!claim.services || claim.services.length === 0) {
        results.failed.push({ id: claimId, claimNumber: claim.claimNumber, error: 'No services on claim' });
        continue;
      }

      // Submit the claim
      await claim.submit(req.user.id, method);

      results.success.push({
        id: claimId,
        claimNumber: claim.claimNumber,
        status: claim.status,
        submittedAt: claim.submittedDate
      });

    } catch (error) {
      results.failed.push({ id: claimId, error: error.message });
    }
  }

  res.status(200).json({
    success: true,
    data: {
      submitted: results.success.length,
      failed: results.failed.length,
      skipped: results.skipped.length,
      results
    }
  });
});
