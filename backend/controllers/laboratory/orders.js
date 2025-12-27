const { asyncHandler } = require('../../middleware/errorHandler');
const LabOrder = require('../../models/LabOrder');
const Patient = require('../../models/Patient');
const LaboratoryTemplate = require('../../models/LaboratoryTemplate');
const Notification = require('../../models/Notification');
const Visit = require('../../models/Visit');
const Invoice = require('../../models/Invoice');
const FeeSchedule = require('../../models/FeeSchedule');
const { generateUniqueBarcode } = require('./utils/barcodeGenerator');

// ============================================
// LAB ORDER ENDPOINTS
// ============================================

// @desc    Get all lab orders
// @route   GET /api/lab-orders
// @access  Private
exports.getOrders = asyncHandler(async (req, res) => {
  const { status, priority, patientId, orderedBy, dateFrom, dateTo, limit = 50, page = 1 } = req.query;
  const query = {};

  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (patientId) query.patient = patientId;
  if (orderedBy) query.orderedBy = orderedBy;

  if (dateFrom || dateTo) {
    query.orderDate = {};
    if (dateFrom) query.orderDate.$gte = new Date(dateFrom);
    if (dateTo) query.orderDate.$lte = new Date(dateTo);
  }

  const total = await LabOrder.countDocuments(query);
  const orders = await LabOrder.find(query)
    .populate('patient', 'firstName lastName patientId dateOfBirth gender')
    .populate('orderedBy', 'firstName lastName')
    .populate('tests.results')
    .sort({ orderDate: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    pages: Math.ceil(total / limit),
    data: orders
  });
});

// @desc    Get single lab order
// @route   GET /api/lab-orders/:id
// @access  Private
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await LabOrder.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId dateOfBirth gender phoneNumber')
    .populate('orderedBy', 'firstName lastName specialization')
    .populate('specimen.collectedBy', 'firstName lastName')
    .populate('specimen.receivedBy', 'firstName lastName')
    .populate('tests.template')
    .populate('tests.results')
    .lean();

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Lab order not found'
    });
  }

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Create lab order
// @route   POST /api/lab-orders
// @access  Private (Doctor, Nurse)
exports.createOrder = asyncHandler(async (req, res) => {
  const { patientId, tests, priority, clinicalNotes, diagnosis, fasting, specialInstructions, autoGenerateInvoice = true } = req.body;

  // Get patient for convention info
  const patient = await Patient.findById(patientId).populate('convention');

  // Batch fetch all templates at once (avoiding N+1 query problem)
  const uniqueTemplateIds = [...new Set(
    tests.map(t => t.templateId).filter(Boolean)
  )];

  const templates = uniqueTemplateIds.length > 0
    ? await LaboratoryTemplate.find({ _id: { $in: uniqueTemplateIds } }).lean()
    : [];

  const templateMap = new Map(templates.map(t => [t._id.toString(), t]));

  // Build tests array with template info (synchronous - no N+1)
  const processedTests = tests.map((test) => {
    const template = test.templateId ? templateMap.get(test.templateId.toString()) : null;

    return {
      template: test.templateId,
      testName: test.testName || template?.name,
      testCode: test.testCode || template?.code,
      category: test.category || template?.category,
      specimen: test.specimen || template?.specimenType,
      notes: test.notes,
      price: test.price || template?.price || 0
    };
  });

  const order = await LabOrder.create({
    patient: patientId,
    visit: req.body.visitId,
    appointment: req.body.appointmentId,
    orderedBy: req.user.id,
    priority: priority || 'routine',
    tests: processedTests,
    clinicalNotes,
    diagnosis,
    icdCode: req.body.icdCode,
    fasting: fasting || { required: false },
    specialInstructions,
    billing: {
      billable: req.body.billable !== false
    },
    createdBy: req.user.id
  });

  // AUTO-GENERATE INVOICE if billable
  let invoice = null;
  if (autoGenerateInvoice && order.billing?.billable !== false) {
    try {
      // Build invoice items from tests
      const invoiceItems = [];
      let totalAmount = 0;

      for (const test of processedTests) {
        // Try to find fee schedule for the test
        let price = test.price || 0;
        let serviceId = null;

        if (test.testCode) {
          const feeSchedule = await FeeSchedule.findOne({
            $or: [
              { code: test.testCode },
              { aliases: test.testCode },
              { name: { $regex: new RegExp(test.testName, 'i') } }
            ],
            isActive: true
          });

          if (feeSchedule) {
            price = feeSchedule.price || 0;
            serviceId = feeSchedule._id;
          }
        }

        invoiceItems.push({
          service: serviceId,
          description: test.testName,
          category: 'laboratory',
          quantity: 1,
          unitPrice: price,
          subtotal: price,  // Required by Invoice model
          total: price,     // Required by Invoice model
          code: test.testCode
        });

        totalAmount += price;
      }

      // Use transaction to ensure invoice creation and order update are atomic
      const { withTransactionRetry } = require('../../utils/transactions');

      invoice = await withTransactionRetry(async (session) => {
        // Create invoice within transaction (array syntax for session support)
        // Note: dueDate is auto-set by Invoice pre-save hook (30 days from now)
        const [createdInvoice] = await Invoice.create([{
          patient: patientId,
          visit: req.body.visitId,
          labOrder: order._id,
          items: invoiceItems,
          summary: {
            subtotal: totalAmount,
            total: totalAmount,
            amountDue: totalAmount,
            amountPaid: 0
          },
          status: 'draft',  // Valid enum value (not 'pending')
          type: 'laboratory',
          notes: `Analyses de laboratoire - ${processedTests.length} test(s)`,
          createdBy: req.user.id
        }], { session });

        // CRITICAL FIX: Apply proper convention billing using Invoice model method
        // This respects company rules, coverage limits, waiting periods, approval workflows
        if (patient?.convention?.company) {
          try {
            await createdInvoice.applyCompanyBilling(patient.convention.company, req.user.id, session, { bypassWaitingPeriod: false });
            log.info(`Applied convention billing for invoice ${createdInvoice.invoiceNumber}`);
          } catch (conventionError) {
            log.warn(`[LabOrder] Convention billing failed: ${conventionError.message}, invoice remains as patient-pay`);
          }
        }

        // Update lab order with invoice reference within same transaction
        order.billing.invoice = createdInvoice._id;
        order.billing.estimatedCost = totalAmount;
        await order.save({ session });

        return createdInvoice;
      });

      log.info(`Auto-created invoice ${invoice.invoiceNumber} for lab order ${order.orderId}`);
    } catch (invoiceError) {
      log.error('[LabOrder] Error auto-generating invoice:', { error: invoiceError });
      // Continue without failing - invoice can be created manually
    }
  }

  await order.populate([
    { path: 'patient', select: 'firstName lastName patientId' },
    { path: 'orderedBy', select: 'firstName lastName' },
    { path: 'billing.invoice', select: 'invoiceNumber total status' }
  ]);

  // Create notification for lab technicians (find actual users with lab roles)
  try {
    const User = require('../../models/User');

const { createContextLogger } = require('../../utils/structuredLogger');
const log = createContextLogger('Orders');
    const labStaff = await User.find({
      role: { $in: ['lab_technician', 'laboratory', 'lab', 'admin'] },
      isActive: { $ne: false }
    }).select('_id').limit(10).lean();

    if (labStaff.length > 0) {
      const notifications = labStaff.map(user => ({
        recipient: user._id,
        type: 'task_assigned',
        title: 'New Lab Order',
        message: `${processedTests.length} tests ordered`,
        priority: priority === 'stat' ? 'urgent' : priority === 'urgent' ? 'high' : 'normal',
        entityType: 'lab_order',
        entityId: order._id,
        link: `/laboratory/orders/${order._id}`
      }));
      await Notification.insertMany(notifications, { ordered: false });
    }
  } catch (notificationError) {
    // Don't fail lab order creation if notifications fail
    log.warn('[LabOrder] Could not create notifications:', notificationError.message);
  }

  res.status(201).json({
    success: true,
    data: order,
    invoice: invoice ? {
      _id: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      status: invoice.status
    } : null
  });
});

// @desc    Update lab order
// @route   PUT /api/lab-orders/:id
// @access  Private
exports.updateOrder = asyncHandler(async (req, res) => {
  let order = await LabOrder.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Lab order not found'
    });
  }

  if (['completed', 'cancelled'].includes(order.status)) {
    return res.status(400).json({
      success: false,
      error: 'Cannot update completed or cancelled orders'
    });
  }

  order = await LabOrder.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedBy: req.user.id },
    { new: true, runValidators: true }
  ).populate('patient', 'firstName lastName patientId');

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Cancel lab order
// @route   PUT /api/lab-orders/:id/cancel
// @access  Private
exports.cancelOrder = asyncHandler(async (req, res) => {
  const order = await LabOrder.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Lab order not found'
    });
  }

  if (order.status === 'completed') {
    return res.status(400).json({
      success: false,
      error: 'Cannot cancel completed orders'
    });
  }

  await order.cancel(req.user.id, req.body.reason);

  res.status(200).json({
    success: true,
    message: 'Lab order cancelled',
    data: order
  });
});

// @desc    Get pending lab orders
// @route   GET /api/lab-orders/pending
// @access  Private
exports.getPendingOrders = asyncHandler(async (req, res) => {
  const orders = await LabOrder.getPending(req.query);

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});

// @desc    Get patient lab order history
// @route   GET /api/lab-orders/patient/:patientId
// @access  Private
exports.getPatientOrders = asyncHandler(async (req, res) => {
  const orders = await LabOrder.getPatientHistory(req.params.patientId, req.query);

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});

// @desc    Get order by barcode
// @route   GET /api/lab-orders/barcode/:barcode
// @access  Private
exports.getOrderByBarcode = asyncHandler(async (req, res) => {
  const order = await LabOrder.findOne({ 'specimen.barcode': req.params.barcode })
    .populate('patient', 'firstName lastName patientId dateOfBirth gender')
    .populate('orderedBy', 'firstName lastName')
    .populate('tests.template')
    .lean();

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found for this barcode'
    });
  }

  res.status(200).json({
    success: true,
    data: order
  });
});

// ============================================
// CHECK-IN & REJECTION ENDPOINTS
// ============================================

// @desc    Get orders scheduled for today (for check-in page)
// @route   GET /api/lab-orders/scheduled-today
// @access  Private
exports.getScheduledToday = asyncHandler(async (req, res) => {
  const orders = await LabOrder.getScheduledForToday(req.query);

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});

// @desc    Get checked-in patients awaiting collection
// @route   GET /api/lab-orders/checked-in
// @access  Private
exports.getCheckedIn = asyncHandler(async (req, res) => {
  const orders = await LabOrder.getCheckedIn();

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});

// @desc    Check-in patient for specimen collection
// @route   PUT /api/lab-orders/:id/check-in
// @access  Private
exports.checkInPatient = asyncHandler(async (req, res) => {
  const order = await LabOrder.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId');

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Lab order not found'
    });
  }

  // Check if fasting was required and verify
  if (order.fasting?.required) {
    const { fastingVerified, fastingHours } = req.body;
    if (!fastingVerified) {
      return res.status(400).json({
        success: false,
        error: 'Fasting verification required for this test',
        fastingRequired: true,
        requiredHours: order.fasting.hours || 8
      });
    }
  }

  await order.checkInPatient(req.user.id, req.body);

  res.status(200).json({
    success: true,
    message: 'Patient checked in successfully',
    data: order
  });
});

// @desc    Reject lab order with automatic 25% penalty
// @route   PUT /api/lab-orders/:id/reject-reschedule
// @access  Private (Lab Tech, Nurse)
exports.rejectAndReschedule = asyncHandler(async (req, res) => {
  const { reason, reasonDetails } = req.body;

  if (!reason) {
    return res.status(400).json({
      success: false,
      error: 'Rejection reason is required'
    });
  }

  const order = await LabOrder.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId phone phoneNumber');

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Lab order not found'
    });
  }

  // Count previous rejections for this patient
  const previousRejections = await LabOrder.countDocuments({
    patient: order.patient._id,
    'rejection.rejected': true
  });

  // ENHANCED: Model method now auto-calculates 25% penalty and creates invoice
  const result = await order.rejectAndReschedule(req.user.id, {
    reason,
    reasonDetails
  });

  // Create notification for ordering doctor
  await Notification.create({
    recipient: order.orderedBy,
    type: 'task_assigned',
    title: 'Examen Laboratoire Rejeté',
    message: `${order.patient.firstName} ${order.patient.lastName} - ${reason}. Pénalité: ${result.penaltyAmount} CDF`,
    priority: 'high',
    entityType: 'lab_order',
    entityId: order._id,
    link: `/laboratory/orders/${order._id}`
  });

  res.status(200).json({
    success: true,
    message: 'Patient rejeté - envoyé à la réception pour paiement et reprogrammation',
    data: {
      order: result.labOrder,
      penaltyInvoice: result.penaltyInvoice ? {
        _id: result.penaltyInvoice._id,
        invoiceId: result.penaltyInvoice.invoiceId,
        total: result.penaltyAmount,
        status: result.penaltyInvoice.status
      } : null,
      penaltyAmount: result.penaltyAmount,
      previousRejections,
      nextStep: 'Patient doit se rendre à la réception pour payer la pénalité et reprogrammer'
    }
  });
});

// @desc    Get rejected lab orders awaiting rescheduling (for reception)
// @route   GET /api/lab-orders/rejected-awaiting-reschedule
// @access  Private (Reception, Admin)
exports.getRejectedAwaitingReschedule = asyncHandler(async (req, res) => {
  const orders = await LabOrder.getRejectedAwaitingReschedule();

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});

// @desc    Reschedule rejected lab order (after penalty payment)
// @route   PUT /api/lab-orders/:id/reschedule
// @access  Private (Reception, Admin)
exports.rescheduleAfterRejection = asyncHandler(async (req, res) => {
  const { scheduledDate, notes } = req.body;

  if (!scheduledDate) {
    return res.status(400).json({
      success: false,
      error: 'New scheduled date is required'
    });
  }

  const order = await LabOrder.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId')
    .populate('rejection.penaltyInvoice', 'status summary.amountPaid');

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Lab order not found'
    });
  }

  if (!order.rejection?.rejected) {
    return res.status(400).json({
      success: false,
      error: 'This lab order was not rejected'
    });
  }

  // Check if penalty invoice is paid (optional - can be enforced or just warned)
  const penaltyInvoice = order.rejection.penaltyInvoice;
  const penaltyPaid = !penaltyInvoice || penaltyInvoice.status === 'paid';

  if (!penaltyPaid && penaltyInvoice) {
    // Warning but allow rescheduling - reception is responsible for collecting payment
    log.warn(`[LAB RESCHEDULE] Rescheduling ${order.orderId} with unpaid penalty invoice`);
  }

  await order.rescheduleAfterRejection(req.user.id, new Date(scheduledDate), notes);

  // Create notification
  await Notification.create({
    recipient: order.orderedBy,
    type: 'info',
    title: 'Examen Reprogrammé',
    message: `${order.patient.firstName} ${order.patient.lastName} reprogrammé pour ${new Date(scheduledDate).toLocaleDateString('fr-FR')}`,
    priority: 'normal',
    entityType: 'lab_order',
    entityId: order._id
  });

  res.status(200).json({
    success: true,
    message: `Examen reprogrammé pour le ${new Date(scheduledDate).toLocaleDateString('fr-FR')}`,
    data: order,
    penaltyStatus: penaltyPaid ? 'paid' : 'pending'
  });
});

// @desc    Get rejection statistics
// @route   GET /api/lab-orders/rejection-stats
// @access  Private
exports.getRejectionStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();

  const stats = await LabOrder.getRejectionStats(start, end);

  // Get total rejections count
  const totalRejections = await LabOrder.countDocuments({
    'rejection.rejected': true,
    'rejection.rejectedAt': { $gte: start, $lte: end }
  });

  // Get total penalties collected
  const penaltyTotal = await LabOrder.aggregate([
    {
      $match: {
        'rejection.rejected': true,
        'rejection.rejectedAt': { $gte: start, $lte: end },
        'rejection.penaltyApplied': true
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$rejection.penaltyAmount' }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      byReason: stats,
      totalRejections,
      totalPenalties: penaltyTotal[0]?.total || 0,
      period: { start, end }
    }
  });
});

// ============================================
// VISIT-BASED LAB TEST ORDERS (from laboratoryController)
// ============================================

// @desc    Get all laboratory tests (Visit-embedded)
// @route   GET /api/laboratory/tests
// @access  Private
exports.getAllTests = asyncHandler(async (req, res) => {
  const { status, patientId, dateFrom, dateTo } = req.query;
  const query = {};

  if (status) query['laboratoryOrders.status'] = status;
  if (patientId) query.patient = patientId;
  if (dateFrom || dateTo) {
    query['laboratoryOrders.orderedAt'] = {};
    if (dateFrom) query['laboratoryOrders.orderedAt'].$gte = new Date(dateFrom);
    if (dateTo) query['laboratoryOrders.orderedAt'].$lte = new Date(dateTo);
  }

  const visits = await Visit.find(query)
    .populate('patient', 'firstName lastName patientId')
    .populate('primaryProvider', 'firstName lastName')
    .select('laboratoryOrders visitDate')
    .sort('-visitDate')
    .lean();

  // Flatten laboratory tests from all visits
  const tests = [];
  visits.forEach(visit => {
    if (visit.laboratoryOrders && visit.laboratoryOrders.length > 0) {
      visit.laboratoryOrders.forEach(test => {
        tests.push({
          ...test,
          patient: visit.patient,
          provider: visit.primaryProvider,
          visitId: visit._id,
          visitDate: visit.visitDate
        });
      });
    }
  });

  res.status(200).json({
    success: true,
    count: tests.length,
    data: tests
  });
});

// @desc    Order laboratory tests (Visit-embedded)
// @route   POST /api/laboratory/tests
// @access  Private (Doctor, Nurse)
exports.orderTests = asyncHandler(async (req, res) => {
  const { visitId, patientId, tests, urgency = 'routine' } = req.body;

  // Find visit or create one if not provided
  let visit;
  if (visitId) {
    visit = await Visit.findById(visitId);
    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }
  } else if (patientId) {
    // Create a new visit for lab tests
    visit = await Visit.create({
      patient: patientId,
      visitType: 'routine',
      visitDate: new Date(),
      primaryProvider: req.user.id,
      status: 'in-progress',
      chiefComplaint: {
        complaint: 'Laboratory tests ordered',
        associatedSymptoms: []
      }
    });
  } else {
    return res.status(400).json({
      success: false,
      error: 'Either visitId or patientId is required'
    });
  }

  // Add tests to visit
  const labTests = tests.map(test => ({
    testName: test.name,
    testCode: test.code,
    category: test.category || 'general',
    urgency,
    status: 'ordered',
    orderedAt: new Date(),
    orderedBy: req.user.id,
    notes: test.notes || ''
  }));

  if (!visit.laboratoryOrders) {
    visit.laboratoryOrders = [];
  }
  visit.laboratoryOrders.push(...labTests);
  await visit.save();

  // Create notification for lab technician
  await Notification.create({
    recipient: 'lab', // This would typically be lab technician IDs
    type: 'lab_order',
    title: 'New Laboratory Test Order',
    message: `${tests.length} tests ordered for patient ${visit.patient}`,
    priority: urgency === 'urgent' ? 'high' : 'medium',
    data: {
      visitId: visit._id,
      patientId: visit.patient,
      testCount: tests.length
    }
  });

  res.status(201).json({
    success: true,
    message: 'Laboratory tests ordered successfully',
    data: {
      visitId: visit._id,
      tests: labTests
    }
  });
});

// @desc    Get pending laboratory tests (Visit-embedded + Standalone)
// @route   GET /api/laboratory/pending
// @access  Private
exports.getPendingTests = asyncHandler(async (req, res) => {
  // Fetch from both Visit-embedded orders AND standalone LabOrder model
  const [visits, labOrders] = await Promise.all([
    // 1. Visit-embedded laboratory orders
    Visit.find({
      'laboratoryOrders.status': { $in: ['ordered', 'in-progress', 'collected', 'received'] }
    })
      .populate('patient', 'firstName lastName patientId dateOfBirth gender')
      .populate('primaryProvider', 'firstName lastName')
      .select('laboratoryOrders visitDate')
      .sort('-visitDate')
      .lean(),

    // 2. Standalone LabOrder model
    LabOrder.find({
      status: { $in: ['ordered', 'collected', 'received', 'in-progress'] }
    })
      .populate('patient', 'firstName lastName patientId dateOfBirth gender')
      .populate('orderedBy', 'firstName lastName')
      .sort('-createdAt')
      .lean()
  ]);

  // Extract pending tests from Visit-embedded orders
  const pendingTests = [];
  visits.forEach(visit => {
    if (visit.laboratoryOrders) {
      visit.laboratoryOrders
        .filter(test => ['ordered', 'in-progress', 'collected', 'received'].includes(test.status))
        .forEach(test => {
          pendingTests.push({
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

  // Add standalone LabOrders (transformed to match expected format)
  labOrders.forEach(order => {
    pendingTests.push({
      _id: order._id,
      orderId: order.orderId,
      status: order.status,
      priority: order.priority,
      tests: order.tests,
      patient: order.patient,
      provider: order.orderedBy,
      orderDate: order.createdAt,
      specimen: order.specimen,
      clinicalIndication: order.clinicalNotes,
      fasting: order.fasting,
      source: 'labOrder'
    });
  });

  // Sort by date (newest first)
  pendingTests.sort((a, b) => {
    const dateA = new Date(a.orderDate || a.visitDate || a.createdAt);
    const dateB = new Date(b.orderDate || b.visitDate || b.createdAt);
    return dateB - dateA;
  });

  res.status(200).json({
    success: true,
    count: pendingTests.length,
    data: pendingTests
  });
});

module.exports = exports;
