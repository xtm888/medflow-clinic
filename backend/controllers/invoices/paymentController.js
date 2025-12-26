/**
 * Invoice Payment Controller
 *
 * Handles payment operations for invoices:
 * - addPayment, cancelInvoice, issueRefund
 * - sendReminder, getPatientInvoices
 * - getOverdueInvoices, getInvoiceStats
 */

const {
  Invoice,
  Patient,
  AuditLog,
  mongoose,
  asyncHandler,
  success,
  error,
  notFound,
  badRequest,
  findPatientByIdOrCode,
  websocketService,
  invoiceLogger
} = require('./shared');

// Import surgery helper functions from core controller
const { createSurgeryCasesIfNeeded, createSurgeryCasesForPaidItems } = require('./coreController');

// =====================================================
// CONTROLLER FUNCTIONS
// =====================================================

// @desc    Add payment to invoice
// @route   POST /api/invoices/:id/payments
// @access  Private (Admin, Receptionist)
const addPayment = asyncHandler(async (req, res, next) => {
  const { withTransactionRetry } = require('../../utils/transactions');

  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return notFound(res, 'Invoice');
  }

  const { amount, method, reference, notes, date, currency, exchangeRate, itemAllocations } = req.body;

  // Validate amount
  if (!amount || amount <= 0) {
    return badRequest(res, 'Payment amount must be greater than 0');
  }

  // For multi-currency payments, validate using converted amount
  const paymentCurrency = currency || 'CDF';
  const rate = exchangeRate || 1;
  const amountInCDF = paymentCurrency === 'CDF' ? amount : amount * rate;

  if (amountInCDF > invoice.summary.amountDue) {
    return badRequest(res, `Payment amount (${amountInCDF.toFixed(0)} CDF) exceeds amount due (${invoice.summary.amountDue} CDF)`);
  }

  // CRITICAL: Use transaction to ensure payment + surgery case creation is atomic
  let paymentResult;
  const surgeryCases = [];

  try {
    await withTransactionRetry(async (session) => {
      // Add payment using model method with currency support
      paymentResult = await invoice.addPayment(
        { amount, method, reference, notes, date, currency: paymentCurrency, exchangeRate: rate, itemAllocations },
        req.user.id,
        session // Pass session to model method
      );

      // Create surgery cases for newly paid surgery items (within transaction)
      if (paymentResult.newlyPaidItems && paymentResult.newlyPaidItems.length > 0) {
        const newSurgeryCases = await createSurgeryCasesForPaidItems(
          invoice,
          paymentResult.newlyPaidItems,
          req.user.id,
          session
        );
        surgeryCases.push(...newSurgeryCases);
      }

      // Also check if invoice is now fully paid (legacy behavior for any remaining surgery items)
      if (invoice.status === 'paid') {
        const remainingCases = await createSurgeryCasesIfNeeded(invoice, req.user.id, session);
        surgeryCases.push(...remainingCases);
      }
    });
  } catch (txError) {
    invoiceLogger.error('Payment transaction failed', {
      invoiceId: invoice.invoiceId,
      error: txError.message
    });
    return error(res, {
      statusCode: 500,
      error: 'Failed to process payment - transaction rolled back',
      details: txError.message
    });
  }

  // === SYNC PAYMENT STATUS TO RELATED SERVICES ===
  const paymentSyncResults = {
    glassesOrders: [],
    prescriptions: [],
    labOrders: []
  };

  try {
    // Determine payment status based on invoice status
    const newPaymentStatus = invoice.status === 'paid' ? 'paid' : 'partial';

    // PERFORMANCE: Use bulk operations instead of N+1 queries
    const GlassesOrder = require('../../models/GlassesOrder');
    const Prescription = require('../../models/Prescription');
    const LabOrder = require('../../models/LabOrder');

    // Bulk update linked GlassesOrders
    const linkedGlassesOrders = await GlassesOrder.find({ invoice: invoice._id });
    if (linkedGlassesOrders.length > 0) {
      await GlassesOrder.updateMany(
        { invoice: invoice._id },
        {
          $set: {
            paymentStatus: newPaymentStatus,
            amountPaid: invoice.summary.amountPaid
          }
        }
      );
      linkedGlassesOrders.forEach(order => {
        paymentSyncResults.glassesOrders.push({
          id: order._id,
          orderNumber: order.orderNumber,
          status: newPaymentStatus
        });
      });
    }

    // Extract item references for batch processing
    if (invoice.items && invoice.items.length > 0) {
      const glassesOrderNumbers = [];
      const prescriptionIds = [];
      const labOrderIds = [];
      const itemAmounts = {}; // Track amounts per order

      for (const item of invoice.items) {
        if (item.reference) {
          if (item.reference.startsWith('GlassesOrder:')) {
            const orderNumber = item.reference.split(':')[1];
            glassesOrderNumbers.push(orderNumber);
            itemAmounts[orderNumber] = (itemAmounts[orderNumber] || 0) + (item.amountPaid || 0);
          } else if (item.reference.startsWith('Prescription:')) {
            prescriptionIds.push(item.reference.split(':')[1]);
          } else if (item.reference.startsWith('LabOrder:')) {
            labOrderIds.push(item.reference.split(':')[1]);
          }
        }
      }

      // Bulk update GlassesOrders by reference (excluding already updated ones)
      if (glassesOrderNumbers.length > 0) {
        const existingOrderNumbers = paymentSyncResults.glassesOrders.map(o => o.orderNumber);
        const newOrderNumbers = glassesOrderNumbers.filter(n => !existingOrderNumbers.includes(n));
        if (newOrderNumbers.length > 0) {
          await GlassesOrder.updateMany(
            { orderNumber: { $in: newOrderNumbers } },
            { $set: { paymentStatus: newPaymentStatus } }
          );
          newOrderNumbers.forEach(orderNumber => {
            paymentSyncResults.glassesOrders.push({
              orderNumber,
              status: newPaymentStatus
            });
          });
        }
      }

      // Bulk update Prescriptions
      if (prescriptionIds.length > 0) {
        await Prescription.updateMany(
          { _id: { $in: prescriptionIds } },
          {
            $set: {
              'dispensing.paymentStatus': newPaymentStatus,
              'dispensing.paidAt': new Date()
            }
          }
        );
        prescriptionIds.forEach(id => {
          paymentSyncResults.prescriptions.push({
            id,
            status: newPaymentStatus
          });
        });
      }

      // Bulk update LabOrders
      if (labOrderIds.length > 0) {
        await LabOrder.updateMany(
          { _id: { $in: labOrderIds } },
          {
            $set: {
              'billing.paymentStatus': newPaymentStatus,
              'billing.paidAt': invoice.status === 'paid' ? new Date() : null
            }
          }
        );
        // Get orderId for logging
        const labOrders = await LabOrder.find({ _id: { $in: labOrderIds } }).select('orderId');
        labOrders.forEach(lo => {
          paymentSyncResults.labOrders.push({
            id: lo._id,
            orderId: lo.orderId,
            status: newPaymentStatus
          });
        });
      }
    }

    invoiceLogger.info('Service payment status synced', paymentSyncResults);
  } catch (syncError) {
    invoiceLogger.error('Error syncing payment to services (non-blocking)', { error: syncError.message });
  }

  // CRITICAL FIX: Send WebSocket notification for billing update
  websocketService.emitBillingUpdate({
    event: 'payment_received',
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber || invoice.invoiceId,
    patientId: invoice.patient,
    amount: paymentResult.payment?.amount,
    newStatus: invoice.status,
    amountPaid: invoice.summary?.amountPaid,
    amountDue: invoice.summary?.amountDue
  });

  // AUDIT: Log payment for financial compliance
  try {
    await AuditLog.log({
      user: req.user._id,
      action: 'PAYMENT_ADD',
      resource: 'invoice',
      resourceId: invoice._id,
      details: {
        invoiceNumber: invoice.invoiceNumber || invoice.invoiceId,
        patientId: invoice.patient,
        amount: paymentResult.payment?.amount,
        currency: paymentCurrency,
        method: method,
        newStatus: invoice.status,
        totalPaid: invoice.summary?.amountPaid,
        remainingDue: invoice.summary?.amountDue
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
  } catch (auditErr) {
    invoiceLogger.error('Failed to create audit log for payment', { error: auditErr.message });
    // Non-blocking - payment already processed
  }

  return success(res, {
    statusCode: 200,
    message: 'Payment added successfully',
    data: {
      invoice,
      payment: paymentResult.payment,
      surgeryCases: surgeryCases.length > 0 ? surgeryCases : undefined,
      paymentSync: paymentSyncResults
    }
  });
});

// @desc    Cancel invoice
// @route   PUT /api/invoices/:id/cancel
// @access  Private (Admin)
const cancelInvoice = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return notFound(res, 'Invoice');
  }

  const { reason } = req.body;

  if (!reason) {
    return badRequest(res, 'Cancellation reason is required');
  }

  try {
    const beforeStatus = invoice.status;
    const beforeAmountPaid = invoice.summary?.amountPaid || 0;

    await invoice.cancel(req.user.id, reason);

    // AUDIT: Log cancellation for financial compliance
    try {
      await AuditLog.log({
        user: req.user._id,
        action: 'INVOICE_CANCEL',
        resource: 'invoice',
        resourceId: invoice._id,
        details: {
          invoiceNumber: invoice.invoiceNumber || invoice.invoiceId,
          patientId: invoice.patient,
          reason: reason,
          previousStatus: beforeStatus,
          amountPaid: beforeAmountPaid,
          totalAmount: invoice.summary?.total
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (auditErr) {
      invoiceLogger.error('Failed to create audit log for invoice cancellation', { error: auditErr.message });
    }

    return success(res, {
      statusCode: 200,
      message: 'Invoice cancelled successfully',
      data: invoice
    });
  } catch (err) {
    return badRequest(res, err.message);
  }
});

// @desc    Issue refund
// @route   POST /api/invoices/:id/refund
// @access  Private (Admin)
const issueRefund = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return notFound(res, 'Invoice');
  }

  const { amount, reason, method } = req.body;

  if (!amount || amount <= 0) {
    return badRequest(res, 'Refund amount must be greater than 0');
  }

  if (!reason) {
    return badRequest(res, 'Refund reason is required');
  }

  try {
    await invoice.issueRefund(amount, req.user.id, reason, method);

    // === HANDLE RELATED SERVICE REVERSALS ===
    const serviceUpdates = {
      surgeryCases: [],
      glassesOrders: [],
      prescriptions: []
    };

    // Handle Surgery Cases
    if (invoice.items && invoice.items.length > 0) {
      const SurgeryCase = require('../../models/SurgeryCase');

      for (const item of invoice.items) {
        // Check for surgery cases linked to this invoice
        if (item.surgeryCaseId) {
          try {
            const surgeryCase = await SurgeryCase.findById(item.surgeryCaseId);
            if (surgeryCase) {
              if (surgeryCase.status === 'awaiting_scheduling') {
                // Cancel the surgery case if not yet scheduled
                surgeryCase.status = 'cancelled';
                surgeryCase.cancellationReason = 'other';
                surgeryCase.cancellationNotes = `Payment refunded: ${reason}`;
                surgeryCase.cancelledAt = new Date();
                surgeryCase.cancelledBy = req.user.id;
                surgeryCase.paymentStatus = 'refunded';
                await surgeryCase.save();
                serviceUpdates.surgeryCases.push({
                  id: surgeryCase._id,
                  action: 'cancelled'
                });
              } else if (['scheduled', 'checked_in'].includes(surgeryCase.status)) {
                // Mark as payment issue - requires manual resolution
                surgeryCase.paymentStatus = 'refunded';
                surgeryCase.paymentIssue = true;
                surgeryCase.paymentIssueNotes = `Invoice refunded: ${reason}. Manual review required.`;
                await surgeryCase.save();
                serviceUpdates.surgeryCases.push({
                  id: surgeryCase._id,
                  action: 'flagged',
                  warning: 'Surgery already scheduled - manual review required'
                });
              } else {
                // Surgery completed - just mark payment status
                surgeryCase.paymentStatus = 'refunded';
                surgeryCase.paymentIssueNotes = `Refund issued after surgery completion: ${reason}`;
                await surgeryCase.save();
                serviceUpdates.surgeryCases.push({
                  id: surgeryCase._id,
                  action: 'marked_refunded'
                });
              }
            }
          } catch (surgeryError) {
            invoiceLogger.error('Error updating surgery case', { error: surgeryError.message });
          }
        }

        // Check for glasses orders linked via reference
        if (item.reference && item.reference.startsWith('GlassesOrder:')) {
          try {
            const GlassesOrder = require('../../models/GlassesOrder');
            const orderNumber = item.reference.split(':')[1];
            const glassesOrder = await GlassesOrder.findOne({ orderNumber });

            if (glassesOrder) {
              glassesOrder.paymentStatus = 'refunded';
              glassesOrder.internalNotes = `${glassesOrder.internalNotes || ''}\n[${new Date().toISOString()}] Refund issued: ${reason}`;
              await glassesOrder.save();
              serviceUpdates.glassesOrders.push({
                id: glassesOrder._id,
                orderNumber: glassesOrder.orderNumber,
                action: 'marked_refunded'
              });
            }
          } catch (glassesError) {
            invoiceLogger.error('Error updating glasses order', { error: glassesError.message });
          }
        }

        // Check for prescriptions linked via reference
        if (item.reference && item.reference.startsWith('Prescription:')) {
          try {
            const Prescription = require('../../models/Prescription');
            const prescId = item.reference.split(':')[1];
            const prescription = await Prescription.findById(prescId);

            if (prescription) {
              prescription.dispensing = prescription.dispensing || {};
              prescription.dispensing.refundIssued = true;
              prescription.dispensing.refundDate = new Date();
              prescription.dispensing.refundNotes = reason;
              await prescription.save();
              serviceUpdates.prescriptions.push({
                id: prescription._id,
                action: 'marked_refunded'
              });
            }
          } catch (prescError) {
            invoiceLogger.error('Error updating prescription', { error: prescError.message });
          }
        }
      }
    }

    // Also check for glasses orders linked directly to invoice
    try {
      const GlassesOrder = require('../../models/GlassesOrder');
      const linkedOrders = await GlassesOrder.find({ invoice: invoice._id });
      for (const order of linkedOrders) {
        if (!serviceUpdates.glassesOrders.find(o => o.id.toString() === order._id.toString())) {
          order.paymentStatus = 'refunded';
          await order.save();
          serviceUpdates.glassesOrders.push({
            id: order._id,
            orderNumber: order.orderNumber,
            action: 'marked_refunded'
          });
        }
      }
    } catch (glassesError) {
      invoiceLogger.error('Error finding linked glasses orders', { error: glassesError.message });
    }

    invoiceLogger.info('Service updates applied', serviceUpdates);

    return success(res, {
      statusCode: 200,
      message: 'Refund issued successfully',
      data: invoice,
      meta: { serviceUpdates }
    });
  } catch (err) {
    return badRequest(res, err.message);
  }
});

// @desc    Send invoice reminder
// @route   POST /api/invoices/:id/reminder
// @access  Private (Admin, Receptionist)
const sendReminder = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return notFound(res, 'Invoice');
  }

  const { method } = req.body; // email, sms, phone, mail

  if (!method || !['email', 'sms', 'phone', 'mail'].includes(method)) {
    return badRequest(res, 'Valid reminder method required (email, sms, phone, mail)');
  }

  await invoice.sendReminder(method, req.user.id);

  return success(res, {
    statusCode: 200,
    message: `Reminder sent via ${method}`,
    data: invoice
  });
});

// @desc    Get patient invoices
// @route   GET /api/invoices/patient/:patientId
// @access  Private
const getPatientInvoices = asyncHandler(async (req, res, next) => {
  const { patientId } = req.params;
  const { includeBalance } = req.query;

  // Validate patient exists
  const patient = await findPatientByIdOrCode(patientId);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Get all invoices for patient
  const invoices = await Invoice.find({ patient: patient._id })
    .populate('visit', 'visitId visitDate')
    .sort('-dateIssued');

  const responseData = {
    count: invoices.length,
    data: invoices
  };

  // Include balance if requested
  if (includeBalance === 'true') {
    const balance = await Invoice.getPatientBalance(patient._id);
    responseData.balance = balance;
  }

  return success(res, { data: responseData });
});

// @desc    Get overdue invoices
// @route   GET /api/invoices/overdue
// @access  Private (Admin, Accountant)
const getOverdueInvoices = asyncHandler(async (req, res, next) => {
  // Build clinic filter
  const clinicFilter = (req.clinicId && !req.accessAllClinics) ? { clinic: req.clinicId } : {};

  // Get overdue invoices with optional clinic filter
  const invoices = await Invoice.getOverdueInvoices(clinicFilter);

  return success(res, {
    data: {
      count: invoices.length,
      invoices
    }
  });
});

// @desc    Get invoice statistics
// @route   GET /api/invoices/stats
// @access  Private (Admin, Accountant)
const getInvoiceStats = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  const dateFilter = {};

  // Multi-clinic: Filter by clinic unless admin with accessAllClinics
  if (req.clinicId && !req.accessAllClinics) {
    dateFilter.clinic = req.clinicId;
  }

  if (startDate || endDate) {
    dateFilter.dateIssued = {};
    if (startDate) dateFilter.dateIssued.$gte = new Date(startDate);
    if (endDate) dateFilter.dateIssued.$lte = new Date(endDate);
  }

  // Get stats using aggregation
  const stats = await Invoice.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$summary.total' },
        amountPaid: { $sum: '$summary.amountPaid' },
        amountDue: { $sum: '$summary.amountDue' }
      }
    }
  ]);

  // Calculate overall totals
  const overall = await Invoice.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        totalRevenue: { $sum: '$summary.total' },
        totalPaid: { $sum: '$summary.amountPaid' },
        totalDue: { $sum: '$summary.amountDue' }
      }
    }
  ]);

  return success(res, {
    data: {
      byStatus: stats,
      overall: overall[0] || {
        totalInvoices: 0,
        totalRevenue: 0,
        totalPaid: 0,
        totalDue: 0
      }
    }
  });
});

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  addPayment,
  cancelInvoice,
  issueRefund,
  sendReminder,
  getPatientInvoices,
  getOverdueInvoices,
  getInvoiceStats
};
