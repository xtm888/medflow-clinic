/**
 * Glasses Order Core Controller
 *
 * Handles core order operations:
 * - CRUD operations
 * - Order status management
 * - Invoice generation
 * - Statistics
 */

const {
  GlassesOrder,
  OphthalmologyExam,
  Patient,
  Invoice,
  AuditLog,
  FrameInventory,
  ContactLensInventory,
  OpticalLensInventory,
  mongoose,
  asyncHandler,
  notificationFacade,
  log
} = require('./shared');

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
    .populate('patient', 'firstName lastName phoneNumber email')
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
    .populate('patient', 'firstName lastName dateOfBirth phoneNumber email address')
    .populate('exam')
    .populate('orderedBy', 'firstName lastName')
    .populate('invoice');

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  // CRITICAL: Check if prescription has changed since order was created
  let prescriptionChanged = false;
  let currentPrescription = null;

  if (order.exam && order.prescriptionSource?.prescriptionHash) {
    const currentHash = JSON.stringify(order.exam.finalPrescription);
    if (currentHash !== order.prescriptionSource.prescriptionHash) {
      prescriptionChanged = true;
      currentPrescription = order.exam.finalPrescription;
    }
  }

  // Convert to object to add computed properties
  const orderData = order.toObject();
  orderData.prescriptionChanged = prescriptionChanged;
  if (prescriptionChanged) {
    orderData.currentPrescription = currentPrescription;
    orderData.prescriptionWarning = 'ATTENTION: La prescription a été modifiée depuis la création de cette commande. Veuillez vérifier les valeurs.';
  }

  res.status(200).json({
    success: true,
    data: orderData
  });
});

// @desc    Create glasses order from exam
// @route   POST /api/glasses-orders
// @access  Private
exports.createOrder = asyncHandler(async (req, res) => {
  const { examId, orderType, glasses, contactLenses, items, notes, priority, deliveryInfo } = req.body;

  // Get exam data with full patient info including convention
  const exam = await OphthalmologyExam.findById(examId)
    .populate({
      path: 'patient',
      select: 'firstName lastName convention employeeId',
      populate: {
        path: 'convention.company',
        model: 'Company',
        select: 'name code coveredCategories defaultCoverage approvalRules'
      }
    });

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

  // Track prescription source for change detection
  const prescriptionSource = {
    examId: exam._id,
    examUpdatedAt: exam.updatedAt,
    prescriptionHash: JSON.stringify(exam.finalPrescription),
    snapshotAt: new Date()
  };

  // Calculate item totals
  const processedItems = items?.map(item => ({
    ...item,
    total: (item.quantity || 1) * (item.unitPrice || 0) - (item.discount || 0)
  })) || [];

  const orderTotal = processedItems.reduce((sum, item) => sum + (item.total || 0), 0);

  // Auto-calculate convention billing
  let conventionBilling = null;
  const patient = exam.patient;
  const company = patient?.convention?.company;

  if (company && patient?.convention?.isActive !== false) {
    const opticalConfig = company.coveredCategories?.find(c => c.category === 'optical');

    let coveragePercentage = 0;
    let opticalNotCovered = false;
    let requiresApproval = false;

    if (opticalConfig) {
      if (opticalConfig.notCovered) {
        opticalNotCovered = true;
        coveragePercentage = 0;
      } else {
        coveragePercentage = opticalConfig.coveragePercentage ?? company.defaultCoverage?.percentage ?? 100;
        requiresApproval = opticalConfig.requiresApproval || false;
      }
    } else {
      coveragePercentage = company.defaultCoverage?.percentage ?? 100;
    }

    let autoApproved = false;
    if (requiresApproval && company.approvalRules?.autoApproveUnderAmount) {
      const threshold = company.approvalRules.autoApproveUnderAmount;
      const orderInUsd = orderTotal / 2800;
      if (orderInUsd < threshold) {
        autoApproved = true;
      }
    }

    const companyPortion = Math.round(orderTotal * coveragePercentage / 100);
    const patientPortion = orderTotal - companyPortion;

    conventionBilling = {
      hasConvention: true,
      opticalNotCovered,
      company: {
        id: company._id,
        name: company.name,
        conventionCode: company.code
      },
      employeeId: patient.employeeId || patient.convention?.employeeId,
      coveragePercentage,
      companyPortion,
      patientPortion,
      requiresApproval,
      autoApproved,
      approvalStatus: requiresApproval && !autoApproved ? 'pending' : 'not_required'
    };
  }

  const order = await GlassesOrder.create({
    exam: examId,
    patient: exam.patient._id || exam.patient,
    orderedBy: req.user._id || req.user.id,
    orderType,
    prescriptionData,
    prescriptionSource,
    glasses,
    contactLenses,
    items: processedItems,
    notes,
    priority: priority || 'normal',
    deliveryInfo,
    status: 'draft',
    conventionBilling
  });

  order.prescriptionChanged = false;

  await order.populate('patient', 'firstName lastName phoneNumber');
  await order.populate('orderedBy', 'firstName lastName');

  let message = 'Order created successfully';
  if (conventionBilling?.hasConvention) {
    if (conventionBilling.opticalNotCovered) {
      message = `Commande créée - Convention ${conventionBilling.company.name}: Optique non couvert, patient paie 100%`;
    } else {
      message = `Commande créée - Convention ${conventionBilling.company.name}: ${conventionBilling.coveragePercentage}% couvert (${conventionBilling.companyPortion.toLocaleString()} CDF entreprise, ${conventionBilling.patientPortion.toLocaleString()} CDF patient)`;
    }
  }

  res.status(201).json({
    success: true,
    data: order,
    message,
    conventionApplied: conventionBilling?.hasConvention || false
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

  if (['delivered', 'cancelled'].includes(order.status)) {
    return res.status(400).json({
      success: false,
      error: `Cannot update ${order.status} order`
    });
  }

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
  ).populate('patient', 'firstName lastName phoneNumber')
    .populate('orderedBy', 'firstName lastName');

  res.status(200).json({
    success: true,
    data: order
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

  if (order.status === 'draft') {
    await order.deleteOne();
    return res.status(200).json({
      success: true,
      message: 'Order deleted successfully'
    });
  }

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

// @desc    Generate invoice for glasses order
// @route   POST /api/glasses-orders/:id/invoice
// @access  Private (Admin, Billing, Receptionist)
exports.generateInvoice = asyncHandler(async (req, res) => {
  const order = await GlassesOrder.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId convention')
    .populate('exam', 'examNumber')
    .populate('conventionBilling.company.id', 'name companyId conventionCode');

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Glasses order not found'
    });
  }

  if (order.invoice) {
    const existingInvoice = await Invoice.findById(order.invoice);
    if (existingInvoice) {
      return res.status(400).json({
        success: false,
        error: 'Invoice already exists for this order',
        data: { invoiceId: existingInvoice.invoiceId }
      });
    }
  }

  const invoiceItems = [];
  const orderRef = `GlassesOrder:${order.orderNumber}`;

  const isOpticalShopOrder = order.pricing?.framePrice !== undefined ||
                              order.pricing?.lensPrice !== undefined;

  if (isOpticalShopOrder) {
    if (order.pricing?.framePrice > 0 && order.frame) {
      invoiceItems.push({
        description: `Monture: ${order.frame.brand || ''} ${order.frame.model || ''}`.trim() || 'Monture optique',
        category: 'optical',
        code: 'FRAME-OPT',
        quantity: 1,
        unitPrice: order.pricing.framePrice,
        discount: 0,
        subtotal: order.pricing.framePrice,
        tax: 0,
        total: order.pricing.framePrice,
        reference: orderRef
      });
    }

    if (order.pricing?.lensPrice > 0) {
      const lensDesc = `Verres ${order.lensType?.design || 'simple vision'} - ${order.lensType?.material || 'CR39'}`;
      invoiceItems.push({
        description: lensDesc,
        category: 'optical',
        code: `LENS-${(order.lensType?.design || 'SV').toUpperCase()}`,
        quantity: 2,
        unitPrice: order.pricing.lensPrice / 2,
        discount: 0,
        subtotal: order.pricing.lensPrice,
        tax: 0,
        total: order.pricing.lensPrice,
        reference: orderRef
      });
    }

    // Add lens options
    if (order.pricing?.optionsPrice > 0 && order.lensOptions) {
      const options = [
        { key: 'antiReflective', code: 'LENS-AR', label: 'Traitement anti-reflet' },
        { key: 'photochromic', code: 'LENS-PHOTO', label: 'Verres photochromiques' },
        { key: 'blueLight', code: 'LENS-BLUE', label: 'Filtre lumiere bleue' },
        { key: 'tint', code: 'LENS-TINT', label: 'Teinte' },
        { key: 'polarized', code: 'LENS-POL', label: 'Verres polarises' }
      ];

      for (const opt of options) {
        if (order.lensOptions[opt.key]?.selected) {
          const price = order.lensOptions[opt.key].price || 0;
          if (price > 0) {
            invoiceItems.push({
              description: opt.label,
              category: 'optical',
              code: opt.code,
              quantity: 1,
              unitPrice: price,
              discount: 0,
              subtotal: price,
              tax: 0,
              total: price,
              reference: orderRef
            });
          }
        }
      }
    }
  } else if (order.items && order.items.length > 0) {
    for (const item of order.items) {
      invoiceItems.push({
        description: item.description,
        category: 'optical',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        discount: item.discount || 0,
        subtotal: (item.unitPrice || 0) * (item.quantity || 1),
        tax: 0,
        total: item.total || ((item.unitPrice || 0) * (item.quantity || 1) - (item.discount || 0)),
        reference: orderRef
      });
    }
  } else {
    invoiceItems.push({
      description: `Commande optique ${order.orderNumber}`,
      category: 'optical',
      quantity: 1,
      unitPrice: order.pricing?.finalTotal || order.total || 0,
      discount: 0,
      subtotal: order.pricing?.subtotal || order.subtotal || order.total || 0,
      tax: 0,
      total: order.pricing?.finalTotal || order.total || 0,
      reference: orderRef
    });
  }

  const subtotal = order.pricing?.subtotal || invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
  const discountTotal = order.pricing?.discount || order.discount || 0;
  const taxTotal = order.pricing?.taxAmount || order.tax || 0;
  const total = order.pricing?.finalTotal || order.total || (subtotal - discountTotal + taxTotal);

  const invoiceData = {
    patient: order.patient._id,
    dateIssued: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    items: invoiceItems,
    summary: {
      subtotal,
      discountTotal,
      taxTotal,
      total,
      amountPaid: order.amountPaid || 0,
      amountDue: total - (order.amountPaid || 0)
    },
    status: (order.amountPaid || 0) >= total ? 'paid' :
      (order.amountPaid || 0) > 0 ? 'partial' : 'issued',
    billing: {
      currency: process.env.BASE_CURRENCY || 'CDF'
    },
    notes: {
      internal: `Glasses order ${order.orderNumber}`,
      billing: `Type: ${order.orderType || 'glasses'}, Urgence: ${order.urgency || 'normal'}`
    },
    createdBy: req.user.id
  };

  if (order.conventionBilling?.hasConvention && !order.conventionBilling?.opticalNotCovered) {
    const companyInfo = order.conventionBilling.company;
    invoiceData.companyBilling = {
      company: companyInfo.id,
      companyName: companyInfo.name,
      companyId: companyInfo.conventionCode,
      employeeId: order.conventionBilling.employeeId,
      coveragePercentage: order.conventionBilling.coveragePercentage,
      companyShare: order.conventionBilling?.companyPortion ?? order.pricing?.companyPortion ?? 0,
      patientShare: order.conventionBilling?.patientPortion ?? order.pricing?.patientPortion ?? total,
      billingNotes: order.conventionBilling.notes,
      companyInvoiceStatus: 'pending'
    };

    invoiceData.isConventionInvoice = true;
    invoiceData.summary.amountDue = invoiceData.companyBilling.patientShare - (order.amountPaid || 0);

    if (order.conventionBilling.requiresApproval && !order.conventionBilling.autoApproved) {
      invoiceData.companyBilling.approvalRequired = true;
      invoiceData.companyBilling.approvalStatus = order.conventionBilling.approvalStatus || 'pending';
    }
  }

  const invoice = await Invoice.create(invoiceData);

  order.invoice = invoice._id;
  await order.save();

  await AuditLog.create({
    user: req.user.id,
    action: 'INVOICE_CREATE',
    resource: `/api/glasses-orders/${order._id}/invoice`,
    ipAddress: req.ip,
    metadata: {
      invoiceId: invoice.invoiceId,
      orderId: order._id,
      orderNumber: order.orderNumber,
      total,
      isConventionInvoice: !!invoiceData.isConventionInvoice,
      companyName: invoiceData.companyBilling?.companyName,
      companyShare: invoiceData.companyBilling?.companyShare,
      patientShare: invoiceData.companyBilling?.patientShare
    }
  });

  res.status(201).json({
    success: true,
    message: invoiceData.isConventionInvoice
      ? `Facture creee - Convention ${invoiceData.companyBilling.companyName}: Part entreprise ${invoiceData.companyBilling.companyShare} CDF, Part patient ${invoiceData.companyBilling.patientShare} CDF`
      : 'Facture creee avec succes',
    data: invoice
  });
});

// @desc    Get unbilled glasses orders
// @route   GET /api/glasses-orders/unbilled
// @access  Private (Admin, Billing)
exports.getUnbilledOrders = asyncHandler(async (req, res) => {
  const { patientId } = req.query;

  const query = { invoice: { $exists: false } };
  if (patientId) {
    query.patient = patientId;
  }

  const orders = await GlassesOrder.find(query)
    .populate('patient', 'firstName lastName patientId')
    .populate('exam', 'examNumber')
    .select('orderNumber orderType status total amountPaid createdAt')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});
