const Invoice = require('../../models/Invoice');
const Patient = require('../../models/Patient');
const paymentGateway = require('../../services/paymentGateway');
const currencyService = require('../../services/currencyService');
const { asyncHandler } = require('../../middleware/errorHandler');
const { atomicMultiInvoicePayment, atomicRefund } = require('../../utils/transactions');
const {
  validateAmount,
  roundToDecimals
} = require('../../utils/financialValidation');

// =====================
// PAYMENT ADJUSTMENTS
// =====================

// @desc    Apply discount to invoice
// @route   POST /api/billing/invoices/:id/apply-discount
// @access  Private (Admin, Accountant)
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

  // Apply discount to summary (use correct field names from schema)
  invoice.summary.discountTotal = (invoice.summary.discountTotal || 0) + discountAmount;
  invoice.summary.total = invoice.summary.subtotal - invoice.summary.discountTotal + invoice.summary.taxTotal;
  invoice.summary.amountDue = Math.max(0, invoice.summary.total - invoice.summary.amountPaid);

  // Log the discount in discounts array
  invoice.discounts.push({
    amount: discountAmount,
    percentage: percentage || null,
    reason,
    appliedBy: req.user.id,
    appliedAt: new Date()
  });

  invoice.updatedBy = req.user.id;
  await invoice.save();

  // Audit log for discount
  const AuditLog = require('../../models/AuditLog');
  await AuditLog.create({
    user: req.user.id,
    action: 'DISCOUNT_APPLY',
    resource: `/api/billing/invoices/${invoice._id}/apply-discount`,
    ipAddress: req.ip,
    metadata: {
      invoiceId: invoice.invoiceId,
      discountAmount,
      reason,
      newTotal: invoice.summary.total
    }
  });

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

  // Record write-off in writeOffs array
  invoice.writeOffs.push({
    amount,
    reason,
    writtenOffBy: req.user.id,
    date: new Date()
  });

  // Update amounts (prevent negative)
  invoice.summary.amountDue = Math.max(0, invoice.summary.amountDue - amount);
  if (invoice.summary.amountDue <= 0) {
    invoice.status = 'paid';
  }

  invoice.updatedBy = req.user.id;
  await invoice.save();

  // Audit log for write-off
  const AuditLog = require('../../models/AuditLog');
  await AuditLog.create({
    user: req.user.id,
    action: 'WRITE_OFF',
    resource: `/api/billing/invoices/${invoice._id}/write-off`,
    ipAddress: req.ip,
    metadata: {
      invoiceId: invoice.invoiceId,
      writeOffAmount: amount,
      reason,
      remainingDue: invoice.summary.amountDue
    }
  });

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

// =====================
// PATIENT BILLING
// =====================

// @desc    Get patient billing summary
// @route   GET /api/patients/:patientId/billing
// @access  Private
exports.getPatientBilling = asyncHandler(async (req, res) => {
  // Route is /:id/billing so use req.params.id
  const patientId = req.params.id || req.params.patientId;

  // Handle both MongoDB ObjectId and patientId string (e.g., "PAT-000005")
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(patientId);
  const patient = isObjectId
    ? await Patient.findById(patientId)
    : await Patient.findOne({ patientId: patientId });
  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  const [invoices, stats] = await Promise.all([
    Invoice.find({ patient: patient._id })
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
// @route   GET /api/billing/payments
// @access  Private
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

// =====================
// PAYMENT ALLOCATION
// =====================

// @desc    Allocate a single payment across multiple invoices
// @route   POST /api/billing/allocate-payment
// @access  Private (Admin, Accountant, Receptionist)
exports.allocatePaymentToInvoices = asyncHandler(async (req, res) => {
  const {
    patientId,
    totalAmount,
    currency = 'CDF',
    method,
    reference,
    notes,
    allocations, // Array of { invoiceId, amount } or null for automatic allocation
    allocationStrategy = 'oldest_first' // 'oldest_first', 'smallest_first', 'largest_first', 'proportional'
  } = req.body;

  if (!patientId || !totalAmount || !method) {
    return res.status(400).json({
      success: false,
      error: 'Patient ID, total amount, and payment method are required'
    });
  }

  if (totalAmount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Payment amount must be greater than zero'
    });
  }

  // Get patient's outstanding invoices
  const outstandingInvoices = await Invoice.find({
    patient: patientId,
    status: { $in: ['issued', 'sent', 'viewed', 'partial', 'overdue'] },
    'summary.amountDue': { $gt: 0 }
  }).sort(
    allocationStrategy === 'oldest_first' ? { dateIssued: 1 } :
    allocationStrategy === 'smallest_first' ? { 'summary.amountDue': 1 } :
    allocationStrategy === 'largest_first' ? { 'summary.amountDue': -1 } :
    { dateIssued: 1 } // Default to oldest first
  );

  if (outstandingInvoices.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No outstanding invoices found for this patient'
    });
  }

  const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + inv.summary.amountDue, 0);

  // Generate a batch payment ID
  const crypto = require('crypto');
  const batchPaymentId = `BATCH${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  let remainingAmount = totalAmount;
  const paymentResults = [];
  let invoicesToAllocate;

  // If manual allocations provided, validate and use them
  if (allocations && allocations.length > 0) {
    // Validate allocation amounts
    const allocatedTotal = allocations.reduce((sum, a) => sum + a.amount, 0);
    if (Math.abs(allocatedTotal - totalAmount) > 0.01) {
      return res.status(400).json({
        success: false,
        error: `Allocation amounts (${allocatedTotal}) don't match total payment (${totalAmount})`
      });
    }

    invoicesToAllocate = [];
    for (const allocation of allocations) {
      const invoice = outstandingInvoices.find(inv => inv._id.toString() === allocation.invoiceId);
      if (!invoice) {
        return res.status(400).json({
          success: false,
          error: `Invoice ${allocation.invoiceId} not found or not outstanding`
        });
      }
      if (allocation.amount > invoice.summary.amountDue + 0.01) {
        return res.status(400).json({
          success: false,
          error: `Cannot allocate ${allocation.amount} to invoice ${invoice.invoiceId} - only ${invoice.summary.amountDue} is due`
        });
      }
      invoicesToAllocate.push({ invoice, amount: allocation.amount });
    }
  } else {
    // Automatic allocation based on strategy
    invoicesToAllocate = [];
    let amountToAllocate = totalAmount;

    if (allocationStrategy === 'proportional') {
      // Distribute proportionally across all invoices
      for (const invoice of outstandingInvoices) {
        const proportion = invoice.summary.amountDue / totalOutstanding;
        const allocatedAmount = Math.min(
          Math.round(totalAmount * proportion * 100) / 100,
          invoice.summary.amountDue
        );
        invoicesToAllocate.push({ invoice, amount: allocatedAmount });
        amountToAllocate -= allocatedAmount;
      }
      // Add any rounding remainder to the last invoice
      if (amountToAllocate > 0 && invoicesToAllocate.length > 0) {
        const lastAllocation = invoicesToAllocate[invoicesToAllocate.length - 1];
        const maxAdd = lastAllocation.invoice.summary.amountDue - lastAllocation.amount;
        lastAllocation.amount += Math.min(amountToAllocate, maxAdd);
      }
    } else {
      // Sequential allocation (oldest_first, smallest_first, largest_first)
      for (const invoice of outstandingInvoices) {
        if (amountToAllocate <= 0) break;

        const allocatedAmount = Math.min(amountToAllocate, invoice.summary.amountDue);
        invoicesToAllocate.push({ invoice, amount: allocatedAmount });
        amountToAllocate -= allocatedAmount;
      }
    }
  }

  // Apply payments to invoices using atomic transaction
  // This ensures all payments succeed or all fail - no partial state
  try {
    const transactionResult = await atomicMultiInvoicePayment({
      invoiceAllocations: invoicesToAllocate,
      paymentDetails: {
        method,
        reference: reference || `Batch payment: ${batchPaymentId}`,
        notes: notes || `Allocated from batch payment ${batchPaymentId}`,
        currency,
        exchangeRate: 1
      },
      userId: req.user._id,
      batchPaymentId
    });

    // Map transaction results to expected format
    for (const result of transactionResult.results) {
      paymentResults.push({
        invoiceId: result.invoiceId,
        paymentId: result.paymentId,
        allocatedAmount: result.allocatedAmount,
        previousAmountDue: result.previousAmountDue,
        newAmountDue: result.newAmountDue,
        status: result.newStatus
      });
      remainingAmount -= result.allocatedAmount;
    }
  } catch (transactionError) {
    // Transaction failed - no payments were applied
    console.error('Multi-invoice payment transaction failed:', transactionError.message);
    return res.status(400).json({
      success: false,
      error: `Payment allocation failed: ${transactionError.message}`,
      message: 'No payments were applied due to the error. Please try again.'
    });
  }

  // If there's excess payment, add it as credit to patient account
  let creditAdded = 0;
  if (remainingAmount > 0.01) {
    try {
      await Patient.addCredit(
        patientId,
        remainingAmount,
        `Overpayment from batch payment ${batchPaymentId}`,
        req.user._id
      );
      creditAdded = remainingAmount;
    } catch (err) {
      console.error('Failed to add overpayment as credit:', err.message);
    }
  }

  // Log the batch payment
  try {
    const AuditLog = require('../../models/AuditLog');
    await AuditLog.create({
      user: req.user._id,
      action: 'BATCH_PAYMENT',
      resource: `/api/billing/allocate-payment`,
      metadata: {
        batchPaymentId,
        patientId,
        totalAmount,
        method,
        invoicesCount: paymentResults.length,
        allocations: paymentResults.map(r => ({
          invoiceId: r.invoiceId,
          amount: r.allocatedAmount
        })),
        creditAdded
      }
    });
  } catch (err) {
    console.error('Failed to log batch payment:', err.message);
  }

  res.status(200).json({
    success: true,
    data: {
      batchPaymentId,
      totalAmount,
      allocatedAmount: totalAmount - remainingAmount,
      creditAdded,
      allocations: paymentResults,
      summary: {
        invoicesUpdated: paymentResults.length,
        totalOutstandingBefore: totalOutstanding,
        totalOutstandingAfter: totalOutstanding - (totalAmount - creditAdded)
      }
    }
  });
});

// @desc    Get suggested payment allocation for a patient
// @route   GET /api/billing/patients/:patientId/payment-allocation
// @access  Private (Admin, Accountant, Receptionist)
exports.getSuggestedPaymentAllocation = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { amount, strategy = 'oldest_first' } = req.query;

  const paymentAmount = parseFloat(amount);
  if (!paymentAmount || paymentAmount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Valid payment amount is required'
    });
  }

  // Get patient's outstanding invoices
  const outstandingInvoices = await Invoice.find({
    patient: patientId,
    status: { $in: ['issued', 'sent', 'viewed', 'partial', 'overdue'] },
    'summary.amountDue': { $gt: 0 }
  }).sort(
    strategy === 'oldest_first' ? { dateIssued: 1 } :
    strategy === 'smallest_first' ? { 'summary.amountDue': 1 } :
    strategy === 'largest_first' ? { 'summary.amountDue': -1 } :
    { dateIssued: 1 }
  ).select('invoiceId invoiceNumber dateIssued dueDate summary.amountDue summary.total status');

  if (outstandingInvoices.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        totalOutstanding: 0,
        suggestedAllocations: [],
        excessAmount: paymentAmount,
        message: 'No outstanding invoices. Excess will be added as credit.'
      }
    });
  }

  const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + inv.summary.amountDue, 0);
  const suggestedAllocations = [];
  let remainingAmount = paymentAmount;

  if (strategy === 'proportional') {
    for (const invoice of outstandingInvoices) {
      const proportion = invoice.summary.amountDue / totalOutstanding;
      const allocatedAmount = Math.min(
        Math.round(paymentAmount * proportion * 100) / 100,
        invoice.summary.amountDue
      );
      suggestedAllocations.push({
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber || invoice.invoiceId,
        dateIssued: invoice.dateIssued,
        dueDate: invoice.dueDate,
        amountDue: invoice.summary.amountDue,
        suggestedAllocation: allocatedAmount,
        isOverdue: invoice.dueDate && new Date(invoice.dueDate) < new Date()
      });
      remainingAmount -= allocatedAmount;
    }
  } else {
    for (const invoice of outstandingInvoices) {
      const allocatedAmount = Math.min(remainingAmount, invoice.summary.amountDue);
      suggestedAllocations.push({
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber || invoice.invoiceId,
        dateIssued: invoice.dateIssued,
        dueDate: invoice.dueDate,
        amountDue: invoice.summary.amountDue,
        suggestedAllocation: allocatedAmount,
        willBePaidInFull: allocatedAmount >= invoice.summary.amountDue,
        isOverdue: invoice.dueDate && new Date(invoice.dueDate) < new Date()
      });
      remainingAmount -= allocatedAmount;
      if (remainingAmount <= 0) remainingAmount = 0;
    }
  }

  res.status(200).json({
    success: true,
    data: {
      paymentAmount,
      totalOutstanding,
      totalAllocated: paymentAmount - Math.max(0, remainingAmount),
      excessAmount: Math.max(0, remainingAmount),
      willClearAllDebt: paymentAmount >= totalOutstanding,
      suggestedAllocations,
      strategies: ['oldest_first', 'smallest_first', 'largest_first', 'proportional']
    }
  });
});

// =====================
// PAYMENT GATEWAY
// =====================

// @desc    Get available gateway methods
// @route   GET /api/billing/gateway/methods
// @access  Private
exports.getGatewayMethods = asyncHandler(async (req, res) => {
  const methods = paymentGateway.getAvailableMethods();

  res.status(200).json({
    success: true,
    data: methods
  });
});

// @desc    Process payment through gateway
// @route   POST /api/billing/gateway/process
// @access  Private
exports.processGatewayPayment = asyncHandler(async (req, res) => {
  const { invoiceId, method, amount, ...paymentDetails } = req.body;

  // Get invoice
  const invoice = await Invoice.findById(invoiceId).populate('patient');
  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found' });
  }

  // Process through gateway
  const result = await paymentGateway.processPayment({
    method,
    amount,
    currency: 'CDF',
    patientId: invoice.patient._id,
    invoiceId: invoice._id,
    patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
    ...paymentDetails
  });

  if (result.success) {
    // Record payment on invoice
    invoice.payments.push({
      amount: result.amount,
      method: result.paymentMethod,
      reference: result.reference,
      transactionId: result.transactionId,
      date: new Date(),
      receivedBy: req.user.id,
      gatewayResponse: result
    });

    invoice.summary.amountPaid += result.amount;
    invoice.summary.amountDue = Math.max(0, invoice.summary.amountDue - result.amount);

    if (invoice.summary.amountDue <= 0) {
      invoice.status = 'paid';
    } else if (invoice.summary.amountPaid > 0) {
      invoice.status = 'partial';
    }

    invoice.updatedBy = req.user.id;
    await invoice.save();
  }

  res.status(result.success ? 200 : 400).json({
    success: result.success,
    data: result
  });
});

// @desc    Create Stripe payment intent
// @route   POST /api/billing/gateway/create-intent
// @access  Private
exports.createPaymentIntent = asyncHandler(async (req, res) => {
  const { invoiceId, amount } = req.body;

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found' });
  }

  const intent = await paymentGateway.createPaymentIntent({
    amount: amount || invoice.summary.amountDue,
    patientId: invoice.patient,
    invoiceId: invoice._id
  });

  res.status(200).json({
    success: true,
    data: intent
  });
});

// @desc    Process refund
// @route   POST /api/billing/gateway/refund
// @access  Private (Admin, Accountant)
exports.processRefund = asyncHandler(async (req, res) => {
  const { invoiceId, paymentIndex, paymentId, amount, reason, method, currency, exchangeRate } = req.body;

  // Validate required reason
  if (!reason || reason.trim().length < 10) {
    return res.status(400).json({
      success: false,
      error: 'Une raison détaillée est requise pour le remboursement (minimum 10 caractères)'
    });
  }

  // Validate amount using financial validation
  const amountValidation = validateAmount(amount, {
    allowNegative: false,
    allowZero: false,
    currency: currency || 'CDF',
    fieldName: 'Refund amount'
  });

  if (amount !== undefined && !amountValidation.valid) {
    return res.status(400).json({
      success: false,
      error: amountValidation.error
    });
  }

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found' });
  }

  // Find the payment - by index or by paymentId
  let payment;
  let originalPaymentId;
  if (paymentId) {
    payment = invoice.payments.find(p => p.paymentId === paymentId);
    originalPaymentId = paymentId;
    if (!payment) {
      return res.status(404).json({ success: false, error: `Payment ${paymentId} not found` });
    }
  } else if (paymentIndex !== undefined) {
    payment = invoice.payments[paymentIndex];
    originalPaymentId = payment?.paymentId;
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found at specified index' });
    }
  } else {
    return res.status(400).json({
      success: false,
      error: 'Either paymentId or paymentIndex is required'
    });
  }

  const refundAmount = amountValidation.sanitized || payment.amount;
  const refundCurrency = currency || payment.currency || 'CDF';

  // CRITICAL: Validate refund amount doesn't exceed payment amount
  if (refundAmount > payment.amount) {
    return res.status(400).json({
      success: false,
      error: `Le montant du remboursement (${refundAmount}) dépasse le montant du paiement (${payment.amount})`,
      paymentAmount: payment.amount,
      requestedRefund: refundAmount
    });
  }

  // CRITICAL: Check for existing refunds against this payment
  const existingRefunds = invoice.payments
    .filter(p => p.amount < 0 && p.reference?.includes(originalPaymentId))
    .reduce((sum, p) => sum + Math.abs(p.amount), 0);

  const maxRefundable = payment.amount - existingRefunds;
  if (refundAmount > maxRefundable + 0.01) {
    return res.status(400).json({
      success: false,
      error: `Montant de remboursement maximum dépassé. Déjà remboursé: ${existingRefunds}, Restant remboursable: ${roundToDecimals(maxRefundable, 2)}`,
      alreadyRefunded: existingRefunds,
      maxRefundable: roundToDecimals(maxRefundable, 2),
      requestedRefund: refundAmount
    });
  }

  // Process refund through gateway if applicable
  let gatewayRefundResult = null;
  if (payment.transactionId && payment.processingFee?.provider) {
    try {
      gatewayRefundResult = await paymentGateway.processRefund({
        originalTransactionId: payment.transactionId,
        amount: refundAmount,
        reason,
        provider: payment.processingFee.provider
      });

      if (!gatewayRefundResult.success) {
        return res.status(400).json({
          success: false,
          error: `Gateway refund failed: ${gatewayRefundResult.error || 'Unknown error'}`,
          gatewayResponse: gatewayRefundResult
        });
      }
    } catch (gatewayError) {
      console.error('Payment gateway refund error:', gatewayError.message);
      return res.status(500).json({
        success: false,
        error: `Payment gateway error: ${gatewayError.message}`
      });
    }
  }

  // Process refund using atomic transaction
  try {
    const refundResult = await atomicRefund({
      invoice,
      amount: refundAmount,
      reason,
      method: method || payment.method,
      userId: req.user._id,
      options: {
        currency: refundCurrency,
        exchangeRate: exchangeRate || payment.exchangeRate || 1,
        expectedVersion: invoice.version,
        originalPaymentId
      }
    });

    // Log the refund
    try {
      const AuditLog = require('../../models/AuditLog');
      await AuditLog.create({
        user: req.user._id,
        action: 'PROCESS_REFUND',
        resource: `/api/billing/gateway/refund`,
        resourceId: invoiceId,
        metadata: {
          invoiceId: invoice.invoiceId,
          refundId: refundResult.refundId,
          amount: refundAmount,
          currency: refundCurrency,
          reason,
          originalPaymentId,
          gatewayRefundId: gatewayRefundResult?.refundId
        }
      });
    } catch (auditError) {
      console.error('Failed to log refund audit:', auditError.message);
    }

    res.status(200).json({
      success: true,
      data: {
        refundId: refundResult.refundId,
        amount: refundResult.amount,
        currency: refundResult.currency,
        amountInBaseCurrency: refundResult.amountInBaseCurrency,
        newAmountDue: refundResult.newAmountDue,
        newStatus: refundResult.newStatus,
        gatewayRefund: gatewayRefundResult
      }
    });
  } catch (refundError) {
    console.error('Refund transaction failed:', refundError.message);

    // If gateway refund succeeded but our DB update failed, log critical error
    if (gatewayRefundResult?.success) {
      console.error('CRITICAL: Gateway refund succeeded but database update failed!', {
        gatewayRefundId: gatewayRefundResult.refundId,
        invoiceId: invoice.invoiceId,
        amount: refundAmount,
        error: refundError.message
      });
    }

    return res.status(400).json({
      success: false,
      error: `Refund failed: ${refundError.message}`,
      gatewayRefundCompleted: gatewayRefundResult?.success || false
    });
  }
});

// @desc    Handle payment webhook
// @route   POST /api/billing/webhook/:provider
// @access  Public (verified by signature)
exports.handlePaymentWebhook = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const signature = req.headers['stripe-signature'] || req.headers['x-webhook-signature'];

  try {
    const event = await paymentGateway.handleWebhook(provider, req.body, signature);

    if (event.type === 'payment_success') {
      // Update invoice if we have metadata
      if (event.metadata?.invoiceId) {
        const invoice = await Invoice.findById(event.metadata.invoiceId);
        if (invoice) {
          const existingPayment = invoice.payments.find(p => p.transactionId === event.transactionId);
          if (!existingPayment) {
            const crypto = require('crypto');
            const paymentId = `WH${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
            invoice.payments.push({
              paymentId,
              amount: event.amount,
              currency: 'CDF',
              amountInBaseCurrency: event.amount,
              exchangeRate: 1,
              method: 'card',
              transactionId: event.transactionId,
              date: new Date(),
              notes: 'Payment received via payment gateway webhook',
              isSystemGenerated: true
            });
            invoice.summary.amountPaid += event.amount;
            invoice.summary.amountDue = Math.max(0, invoice.summary.amountDue - event.amount);
            if (invoice.summary.amountDue <= 0) {
              invoice.status = 'paid';
            }
            await invoice.save();
          }
        }
      }
    }

    res.status(200).json({ received: true, event: event.type });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

// =====================
// MULTI-CURRENCY SUPPORT
// =====================

// @desc    Get live exchange rates
// @route   GET /api/billing/currency/rates
// @access  Private
exports.getExchangeRates = asyncHandler(async (req, res) => {
  const rates = await currencyService.getAllRates();

  res.status(200).json({
    success: true,
    data: rates
  });
});

// @desc    Get supported currencies
// @route   GET /api/billing/currency/supported
// @access  Private
exports.getSupportedCurrencies = asyncHandler(async (req, res) => {
  const currencies = currencyService.getSupportedCurrencies();

  res.status(200).json({
    success: true,
    data: currencies
  });
});

// @desc    Convert currency
// @route   POST /api/billing/currency/convert
// @access  Private
exports.convertCurrency = asyncHandler(async (req, res) => {
  const { amount, from, to } = req.body;

  if (!amount || !from || !to) {
    return res.status(400).json({
      success: false,
      error: 'Amount, from currency, and to currency are required'
    });
  }

  if (!currencyService.isValidCurrency(from) || !currencyService.isValidCurrency(to)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid currency code. Supported: CDF, USD, EUR'
    });
  }

  const conversion = await currencyService.convert(amount, from.toUpperCase(), to.toUpperCase());

  res.status(200).json({
    success: true,
    data: conversion
  });
});

// @desc    Calculate multi-currency total
// @route   POST /api/billing/currency/calculate-total
// @access  Private
exports.calculateMultiCurrencyTotal = asyncHandler(async (req, res) => {
  const { payments } = req.body;

  if (!payments || !Array.isArray(payments) || payments.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Payments array is required'
    });
  }

  // Validate each payment
  for (const payment of payments) {
    if (!payment.amount || !payment.currency) {
      return res.status(400).json({
        success: false,
        error: 'Each payment must have amount and currency'
      });
    }
    if (!currencyService.isValidCurrency(payment.currency)) {
      return res.status(400).json({
        success: false,
        error: `Invalid currency: ${payment.currency}. Supported: CDF, USD, EUR`
      });
    }
  }

  const result = await currencyService.calculateMultiCurrencyTotal(payments);

  res.status(200).json({
    success: true,
    data: result
  });
});

// @desc    Process multi-currency payment
// @route   POST /api/billing/invoices/:invoiceId/multi-currency-payment
// @access  Private
exports.processMultiCurrencyPayment = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;
  const { payments, method = 'cash' } = req.body;

  if (!payments || !Array.isArray(payments) || payments.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Payments array is required'
    });
  }

  const invoice = await Invoice.findOne({
    $or: [{ _id: invoiceId }, { invoiceId: invoiceId }]
  });

  if (!invoice) {
    return res.status(404).json({
      success: false,
      error: 'Invoice not found'
    });
  }

  if (['paid', 'cancelled', 'refunded'].includes(invoice.status)) {
    return res.status(400).json({
      success: false,
      error: `Cannot add payment to ${invoice.status} invoice`
    });
  }

  // Get current exchange rates
  const rates = await currencyService.fetchLiveRates();

  // Prepare payments with converted amounts
  const paymentsWithConversion = [];
  let totalInCDF = 0;

  for (const payment of payments) {
    const currency = payment.currency?.toUpperCase() || 'CDF';
    const amount = parseFloat(payment.amount);

    if (!currencyService.isValidCurrency(currency)) {
      return res.status(400).json({
        success: false,
        error: `Invalid currency: ${currency}`
      });
    }

    // Convert to base currency (CDF)
    const exchangeRate = rates[currency] || 1;
    const amountInBaseCurrency = currency === 'CDF'
      ? amount
      : amount / exchangeRate;

    totalInCDF += amountInBaseCurrency;

    paymentsWithConversion.push({
      amount,
      currency,
      amountInBaseCurrency: Math.round(amountInBaseCurrency * 100) / 100,
      exchangeRate: currency === 'CDF' ? 1 : 1 / exchangeRate,
      method: payment.method || method,
      reference: payment.reference,
      date: new Date()
    });
  }

  // Check if payment doesn't exceed amount due
  if (totalInCDF > invoice.summary.amountDue * 1.01) { // Allow 1% tolerance for rounding
    return res.status(400).json({
      success: false,
      error: 'Payment amount exceeds amount due',
      amountDue: invoice.summary.amountDue,
      paymentTotal: totalInCDF
    });
  }

  // Add multi-currency payments to invoice
  const addedPayments = await invoice.addMultiCurrencyPayment(paymentsWithConversion, req.user.id);

  // Calculate change if overpaid
  const change = await currencyService.calculateChange(
    invoice.summary.total,
    invoice.payments.map(p => ({ amount: p.amountInBaseCurrency || p.amount, currency: 'CDF' }))
  );

  res.status(200).json({
    success: true,
    data: {
      payments: addedPayments,
      invoice: {
        invoiceId: invoice.invoiceId,
        total: invoice.summary.total,
        amountPaid: invoice.summary.amountPaid,
        amountDue: invoice.summary.amountDue,
        status: invoice.status,
        currencyBreakdown: invoice.currencyBreakdown
      },
      change,
      exchangeRatesUsed: rates
    }
  });
});

// @desc    Get amount due in multiple currencies
// @route   GET /api/billing/invoices/:invoiceId/amount-due-currencies
// @access  Private
exports.getAmountDueInCurrencies = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;

  const invoice = await Invoice.findOne({
    $or: [{ _id: invoiceId }, { invoiceId: invoiceId }]
  });

  if (!invoice) {
    return res.status(404).json({
      success: false,
      error: 'Invoice not found'
    });
  }

  const amountDueCDF = invoice.summary.amountDue;
  const equivalents = await currencyService.splitAmountAcrossCurrencies(amountDueCDF);

  res.status(200).json({
    success: true,
    data: {
      invoiceId: invoice.invoiceId,
      amountDue: amountDueCDF,
      baseCurrency: 'CDF',
      equivalents,
      currencyBreakdown: invoice.currencyBreakdown
    }
  });
});

// @desc    Parse payment string (e.g., "5000 CDF + 10 USD")
// @route   POST /api/billing/currency/parse-payment
// @access  Private
exports.parsePaymentString = asyncHandler(async (req, res) => {
  const { paymentString } = req.body;

  if (!paymentString) {
    return res.status(400).json({
      success: false,
      error: 'Payment string is required'
    });
  }

  const payments = currencyService.parsePaymentString(paymentString);

  if (payments.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Could not parse payment string. Format: "5000 CDF + 10 USD" or "$50 + €30"'
    });
  }

  const result = await currencyService.calculateMultiCurrencyTotal(payments);

  res.status(200).json({
    success: true,
    data: {
      parsed: payments,
      total: result
    }
  });
});

// =====================
// BULK OPERATIONS
// =====================

// @desc    Bulk generate invoices from visits/appointments
// @route   POST /api/billing/invoices/bulk-generate
// @access  Private (Admin, Accountant)
exports.bulkGenerateInvoices = asyncHandler(async (req, res) => {
  const { visitIds, appointmentIds, options = {} } = req.body;

  if ((!visitIds || visitIds.length === 0) && (!appointmentIds || appointmentIds.length === 0)) {
    return res.status(400).json({
      success: false,
      error: 'At least one visit or appointment ID is required'
    });
  }

  const results = {
    success: [],
    failed: [],
    skipped: []
  };

  // Process visits
  if (visitIds && visitIds.length > 0) {
    const Visit = require('../../models/Visit');

    for (const visitId of visitIds) {
      try {
        const visit = await Visit.findById(visitId).populate('patient');

        if (!visit) {
          results.failed.push({ id: visitId, type: 'visit', error: 'Visit not found' });
          continue;
        }

        // Check if invoice already exists for this visit
        const existingInvoice = await Invoice.findOne({ visit: visitId });
        if (existingInvoice && !options.allowDuplicates) {
          results.skipped.push({
            id: visitId,
            type: 'visit',
            reason: 'Invoice already exists',
            invoiceId: existingInvoice.invoiceId
          });
          continue;
        }

        // Generate invoice from visit
        const invoiceData = {
          patient: visit.patient._id,
          visit: visit._id,
          items: visit.services?.map(service => ({
            code: service.code || 'SERVICE',
            description: service.name || service.description,
            quantity: service.quantity || 1,
            unitPrice: service.price || 0,
            total: (service.quantity || 1) * (service.price || 0)
          })) || [],
          createdBy: req.user.id,
          dateIssued: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: options.status || 'draft'
        };

        // Calculate summary
        const subtotal = invoiceData.items.reduce((sum, item) => sum + item.total, 0);
        invoiceData.summary = {
          subtotal,
          discount: 0,
          tax: 0,
          total: subtotal,
          amountPaid: 0,
          amountDue: subtotal
        };

        const invoice = await Invoice.create(invoiceData);
        results.success.push({
          id: visitId,
          type: 'visit',
          invoiceId: invoice.invoiceId,
          invoice: invoice._id
        });

      } catch (error) {
        results.failed.push({ id: visitId, type: 'visit', error: error.message });
      }
    }
  }

  // Process appointments
  if (appointmentIds && appointmentIds.length > 0) {
    const Appointment = require('../../models/Appointment');

    for (const appointmentId of appointmentIds) {
      try {
        const appointment = await Appointment.findById(appointmentId).populate('patient');

        if (!appointment) {
          results.failed.push({ id: appointmentId, type: 'appointment', error: 'Appointment not found' });
          continue;
        }

        // Check if invoice already exists for this appointment
        const existingInvoice = await Invoice.findOne({ appointment: appointmentId });
        if (existingInvoice && !options.allowDuplicates) {
          results.skipped.push({
            id: appointmentId,
            type: 'appointment',
            reason: 'Invoice already exists',
            invoiceId: existingInvoice.invoiceId
          });
          continue;
        }

        // Generate invoice from appointment
        const invoiceData = {
          patient: appointment.patient._id,
          appointment: appointment._id,
          items: [{
            code: 'CONSULT',
            description: appointment.type || 'Consultation',
            quantity: 1,
            unitPrice: appointment.fee || 0,
            total: appointment.fee || 0
          }],
          createdBy: req.user.id,
          dateIssued: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: options.status || 'draft'
        };

        const subtotal = invoiceData.items.reduce((sum, item) => sum + item.total, 0);
        invoiceData.summary = {
          subtotal,
          discount: 0,
          tax: 0,
          total: subtotal,
          amountPaid: 0,
          amountDue: subtotal
        };

        const invoice = await Invoice.create(invoiceData);
        results.success.push({
          id: appointmentId,
          type: 'appointment',
          invoiceId: invoice.invoiceId,
          invoice: invoice._id
        });

      } catch (error) {
        results.failed.push({ id: appointmentId, type: 'appointment', error: error.message });
      }
    }
  }

  res.status(200).json({
    success: true,
    data: {
      generated: results.success.length,
      failed: results.failed.length,
      skipped: results.skipped.length,
      results
    }
  });
});

// =====================
// PATIENT CREDIT MANAGEMENT
// =====================

// @desc    Get patient credit balance
// @route   GET /api/billing/patients/:patientId/credit
// @access  Private
exports.getPatientCredit = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  const creditInfo = await Patient.getCreditBalance(patientId);

  res.status(200).json({
    success: true,
    data: creditInfo
  });
});

// @desc    Add credit to patient account
// @route   POST /api/billing/patients/:patientId/credit
// @access  Private (Admin, Accountant)
exports.addPatientCredit = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { amount, reason } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Credit amount must be greater than 0'
    });
  }

  if (!reason) {
    return res.status(400).json({
      success: false,
      error: 'Reason is required for adding credit'
    });
  }

  const accountBalance = await Patient.addCredit(patientId, amount, reason, req.user.id);

  res.status(200).json({
    success: true,
    message: `Credit of ${amount} added successfully`,
    data: accountBalance
  });
});

// @desc    Apply patient credit to invoice
// @route   POST /api/billing/patients/:patientId/credit/apply
// @access  Private (Admin, Accountant, Receptionist)
exports.applyPatientCredit = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { invoiceId, amount } = req.body;

  if (!invoiceId) {
    return res.status(400).json({
      success: false,
      error: 'Invoice ID is required'
    });
  }

  try {
    const result = await Patient.applyCreditToInvoice(patientId, invoiceId, amount, req.user.id);

    res.status(200).json({
      success: true,
      message: `Credit of ${result.amountApplied} applied to invoice`,
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get patients with credit balance
// @route   GET /api/billing/credits
// @access  Private (Admin, Accountant)
exports.getPatientsWithCredit = asyncHandler(async (req, res) => {
  const patients = await Patient.find({
    'accountBalance.credit': { $gt: 0 }
  })
    .select('patientId firstName lastName phoneNumber email accountBalance.credit accountBalance.lastUpdated')
    .sort('-accountBalance.credit');

  const totalCredit = patients.reduce((sum, p) => sum + (p.accountBalance?.credit || 0), 0);

  res.status(200).json({
    success: true,
    count: patients.length,
    totalCredit,
    data: patients
  });
});

// =====================
// PROCESSING FEES
// =====================

const PROCESSING_FEE_RATES = {
  'cash': { percentage: 0, fixed: 0 },
  'check': { percentage: 0, fixed: 0 },
  'bank-transfer': { percentage: 0, fixed: 0 },
  'card': { percentage: 2.9, fixed: 0.30 }, // Typical card processing
  'mobile-payment': { percentage: 1.5, fixed: 0 },
  'orange-money': { percentage: 2.0, fixed: 100 }, // Example for Congo
  'mtn-money': { percentage: 2.0, fixed: 100 },
  'wave': { percentage: 1.0, fixed: 0 },
  'insurance': { percentage: 0, fixed: 0 },
  'other': { percentage: 0, fixed: 0 }
};

// Export the constant
exports.PROCESSING_FEE_RATES = PROCESSING_FEE_RATES;

// @desc    Get processing fee rates
// @route   GET /api/billing/processing-fees/rates
// @access  Private (Admin, Accountant)
exports.getProcessingFeeRates = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: PROCESSING_FEE_RATES
  });
});

// @desc    Calculate processing fee for an amount
// @route   POST /api/billing/processing-fees/calculate
// @access  Private
exports.calculateProcessingFeeAmount = asyncHandler(async (req, res) => {
  const { amount, method } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Amount is required and must be positive'
    });
  }

  if (!method) {
    return res.status(400).json({
      success: false,
      error: 'Payment method is required'
    });
  }

  const rates = PROCESSING_FEE_RATES[method] || { percentage: 0, fixed: 0 };
  const percentageFee = amount * (rates.percentage / 100);
  const totalFee = percentageFee + rates.fixed;

  const fee = {
    amount: Math.round(totalFee * 100) / 100,
    percentage: rates.percentage,
    fixedFee: rates.fixed,
    netAmount: Math.round((amount - totalFee) * 100) / 100
  };

  res.status(200).json({
    success: true,
    data: {
      grossAmount: amount,
      ...fee,
      method
    }
  });
});
