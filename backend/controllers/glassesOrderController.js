const GlassesOrder = require('../models/GlassesOrder');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const Patient = require('../models/Patient');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Get all glasses orders
// @route   GET /api/glasses-orders
// @access  Private
exports.getOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    patient,
    orderType,
    priority,
    dateFrom,
    dateTo,
    sort = '-createdAt'
  } = req.query;

  const query = {};

  if (status) query.status = status;
  if (patient) query.patient = patient;
  if (orderType) query.orderType = orderType;
  if (priority) query.priority = priority;

  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  const orders = await GlassesOrder.find(query)
    .populate('patient', 'firstName lastName phone email')
    .populate('exam', 'examNumber examDate')
    .populate('orderedBy', 'firstName lastName')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await GlassesOrder.countDocuments(query);

  res.status(200).json({
    success: true,
    data: orders,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get single glasses order
// @route   GET /api/glasses-orders/:id
// @access  Private
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await GlassesOrder.findById(req.params.id)
    .populate('patient', 'firstName lastName dateOfBirth phone email address')
    .populate('exam')
    .populate('orderedBy', 'firstName lastName')
    .populate('invoice');

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Create glasses order from exam
// @route   POST /api/glasses-orders
// @access  Private
exports.createOrder = asyncHandler(async (req, res) => {
  const { examId, orderType, glasses, contactLenses, items, notes, priority, deliveryInfo } = req.body;

  // Get exam data
  const exam = await OphthalmologyExam.findById(examId)
    .populate('patient', 'firstName lastName');

  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }

  // Extract prescription data from exam
  const prescriptionData = {
    od: {
      sphere: exam.finalPrescription?.od?.sphere,
      cylinder: exam.finalPrescription?.od?.cylinder,
      axis: exam.finalPrescription?.od?.axis,
      add: exam.finalPrescription?.od?.add,
      visualAcuity: exam.finalPrescription?.od?.visualAcuity
    },
    os: {
      sphere: exam.finalPrescription?.os?.sphere,
      cylinder: exam.finalPrescription?.os?.cylinder,
      axis: exam.finalPrescription?.os?.axis,
      add: exam.finalPrescription?.os?.add,
      visualAcuity: exam.finalPrescription?.os?.visualAcuity
    },
    pd: {
      binocular: exam.finalPrescription?.pd?.binocular,
      monocularOd: exam.finalPrescription?.pd?.monocularOd,
      monocularOs: exam.finalPrescription?.pd?.monocularOs
    }
  };

  // Calculate item totals
  const processedItems = items?.map(item => ({
    ...item,
    total: (item.quantity || 1) * (item.unitPrice || 0) - (item.discount || 0)
  })) || [];

  const order = await GlassesOrder.create({
    exam: examId,
    patient: exam.patient._id || exam.patient,
    orderedBy: req.user._id || req.user.id,
    orderType,
    prescriptionData,
    glasses,
    contactLenses,
    items: processedItems,
    notes,
    priority: priority || 'normal',
    deliveryInfo,
    status: 'draft'
  });

  // Populate for response
  await order.populate('patient', 'firstName lastName phone');
  await order.populate('orderedBy', 'firstName lastName');

  res.status(201).json({
    success: true,
    data: order,
    message: 'Order created successfully'
  });
});

// @desc    Update glasses order
// @route   PUT /api/glasses-orders/:id
// @access  Private
exports.updateOrder = asyncHandler(async (req, res) => {
  let order = await GlassesOrder.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  // Don't allow updates to delivered or cancelled orders
  if (['delivered', 'cancelled'].includes(order.status)) {
    return res.status(400).json({
      success: false,
      error: `Cannot update ${order.status} order`
    });
  }

  // Recalculate item totals if items are updated
  if (req.body.items) {
    req.body.items = req.body.items.map(item => ({
      ...item,
      total: (item.quantity || 1) * (item.unitPrice || 0) - (item.discount || 0)
    }));
  }

  order = await GlassesOrder.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('patient', 'firstName lastName phone')
   .populate('orderedBy', 'firstName lastName');

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Update order status
// @route   PUT /api/glasses-orders/:id/status
// @access  Private
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;

  const order = await GlassesOrder.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  // Validate status transition
  const validTransitions = {
    'draft': ['confirmed', 'cancelled'],
    'confirmed': ['sent-to-lab', 'cancelled'],
    'sent-to-lab': ['in-production', 'cancelled'],
    'in-production': ['ready', 'cancelled'],
    'ready': ['delivered', 'cancelled'],
    'delivered': [],
    'cancelled': []
  };

  if (!validTransitions[order.status]?.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Cannot transition from ${order.status} to ${status}`
    });
  }

  order.status = status;

  if (notes) {
    order.notes.internal = (order.notes.internal || '') + `\n[${new Date().toISOString()}] ${notes}`;
  }

  await order.save();

  await order.populate('patient', 'firstName lastName phone');

  res.status(200).json({
    success: true,
    data: order,
    message: `Order status updated to ${status}`
  });
});

// @desc    Delete/cancel glasses order
// @route   DELETE /api/glasses-orders/:id
// @access  Private (Admin)
exports.deleteOrder = asyncHandler(async (req, res) => {
  const order = await GlassesOrder.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  // Only allow deletion of draft orders; otherwise cancel
  if (order.status === 'draft') {
    await order.deleteOne();
    return res.status(200).json({
      success: true,
      message: 'Order deleted successfully'
    });
  }

  // Cancel instead of delete
  order.status = 'cancelled';
  await order.save();

  res.status(200).json({
    success: true,
    message: 'Order cancelled successfully',
    data: order
  });
});

// @desc    Get orders for a patient
// @route   GET /api/glasses-orders/patient/:patientId
// @access  Private
exports.getPatientOrders = asyncHandler(async (req, res) => {
  const orders = await GlassesOrder.find({ patient: req.params.patientId })
    .populate('exam', 'examNumber examDate')
    .populate('orderedBy', 'firstName lastName')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    data: orders
  });
});

// @desc    Get orders for an exam
// @route   GET /api/glasses-orders/exam/:examId
// @access  Private
exports.getExamOrders = asyncHandler(async (req, res) => {
  const orders = await GlassesOrder.find({ exam: req.params.examId })
    .populate('patient', 'firstName lastName')
    .populate('orderedBy', 'firstName lastName')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    data: orders
  });
});

// @desc    Get order statistics
// @route   GET /api/glasses-orders/stats
// @access  Private
exports.getOrderStats = asyncHandler(async (req, res) => {
  const stats = await GlassesOrder.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalValue: { $sum: '$total' }
      }
    }
  ]);

  const pending = await GlassesOrder.countDocuments({
    status: { $in: ['draft', 'confirmed', 'sent-to-lab', 'in-production'] }
  });

  const ready = await GlassesOrder.countDocuments({ status: 'ready' });

  const todayDeliveries = await GlassesOrder.countDocuments({
    status: 'delivered',
    'timeline.deliveredAt': {
      $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      $lt: new Date(new Date().setHours(23, 59, 59, 999))
    }
  });

  res.status(200).json({
    success: true,
    data: {
      byStatus: stats,
      pending,
      ready,
      todayDeliveries
    }
  });
});
