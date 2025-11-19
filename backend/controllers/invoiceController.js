const Invoice = require('../models/Invoice');
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private (Admin, Accountant, Receptionist)
exports.getInvoices = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 20,
    status,
    patient,
    dateFrom,
    dateTo,
    search,
    sort = '-createdAt',
    overdue
  } = req.query;

  // Build query
  const query = {};

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by patient
  if (patient) {
    query.patient = patient;
  }

  // Filter by date range
  if (dateFrom || dateTo) {
    query.dateIssued = {};
    if (dateFrom) query.dateIssued.$gte = new Date(dateFrom);
    if (dateTo) query.dateIssued.$lte = new Date(dateTo);
  }

  // Filter overdue invoices
  if (overdue === 'true') {
    query.status = { $in: ['issued', 'sent', 'viewed', 'partial'] };
    query.dueDate = { $lt: new Date() };
    query['summary.amountDue'] = { $gt: 0 };
  }

  // Search by invoice ID or patient name
  if (search) {
    query.$or = [
      { invoiceId: new RegExp(search, 'i') }
    ];
  }

  // Execute query with pagination
  const skip = (page - 1) * limit;
  const invoices = await Invoice.find(query)
    .populate('patient', 'firstName lastName patientId phoneNumber email')
    .populate('visit', 'visitId visitDate')
    .populate('createdBy', 'firstName lastName')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count for pagination
  const total = await Invoice.countDocuments(query);

  res.status(200).json({
    success: true,
    count: invoices.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: invoices
  });
});

// @desc    Get single invoice
// @route   GET /api/invoices/:id
// @access  Private
exports.getInvoice = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId phoneNumber email address')
    .populate('visit', 'visitId visitDate diagnosis')
    .populate('createdBy', 'firstName lastName')
    .populate('updatedBy', 'firstName lastName')
    .populate('payments.receivedBy', 'firstName lastName');

  if (!invoice) {
    return res.status(404).json({
      success: false,
      error: 'Invoice not found'
    });
  }

  res.status(200).json({
    success: true,
    data: invoice
  });
});

// @desc    Create new invoice
// @route   POST /api/invoices
// @access  Private (Admin, Receptionist)
exports.createInvoice = asyncHandler(async (req, res, next) => {
  const { patient, visit, items, billing, insurance, notes, dueDate } = req.body;

  // Validate patient exists
  const patientDoc = await Patient.findById(patient);
  if (!patientDoc) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  // If visit provided, validate it exists
  if (visit) {
    const visitDoc = await Visit.findById(visit);
    if (!visitDoc) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }
  }

  // Calculate item totals
  const processedItems = items.map(item => {
    const subtotal = item.quantity * item.unitPrice;
    const discount = item.discount || 0;
    const subtotalAfterDiscount = subtotal - discount;
    const tax = item.tax || 0;
    const total = subtotalAfterDiscount + tax;

    return {
      ...item,
      subtotal,
      total
    };
  });

  // Create invoice
  const invoice = await Invoice.create({
    patient,
    visit,
    items: processedItems,
    billing: billing || {
      billTo: {
        name: `${patientDoc.firstName} ${patientDoc.lastName}`,
        phone: patientDoc.phoneNumber,
        email: patientDoc.email
      }
    },
    insurance,
    notes,
    dueDate,
    createdBy: req.user.id,
    status: 'draft'
  });

  res.status(201).json({
    success: true,
    message: 'Invoice created successfully',
    data: invoice
  });
});

// @desc    Update invoice
// @route   PUT /api/invoices/:id
// @access  Private (Admin, Receptionist)
exports.updateInvoice = asyncHandler(async (req, res, next) => {
  let invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return res.status(404).json({
      success: false,
      error: 'Invoice not found'
    });
  }

  // Don't allow updating paid or cancelled invoices
  if (['paid', 'cancelled', 'refunded'].includes(invoice.status)) {
    return res.status(400).json({
      success: false,
      error: `Cannot update invoice with status: ${invoice.status}`
    });
  }

  const { items, billing, insurance, notes, status, dueDate } = req.body;

  // Update items if provided
  if (items) {
    const processedItems = items.map(item => {
      const subtotal = item.quantity * item.unitPrice;
      const discount = item.discount || 0;
      const subtotalAfterDiscount = subtotal - discount;
      const tax = item.tax || 0;
      const total = subtotalAfterDiscount + tax;

      return {
        ...item,
        subtotal,
        total
      };
    });
    invoice.items = processedItems;
  }

  // Update other fields
  if (billing) invoice.billing = billing;
  if (insurance) invoice.insurance = insurance;
  if (notes) invoice.notes = notes;
  if (status) invoice.status = status;
  if (dueDate) invoice.dueDate = dueDate;

  invoice.updatedBy = req.user.id;

  await invoice.save();

  res.status(200).json({
    success: true,
    message: 'Invoice updated successfully',
    data: invoice
  });
});

// @desc    Add payment to invoice
// @route   POST /api/invoices/:id/payments
// @access  Private (Admin, Receptionist)
exports.addPayment = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return res.status(404).json({
      success: false,
      error: 'Invoice not found'
    });
  }

  const { amount, method, reference, notes, date } = req.body;

  // Validate amount
  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Payment amount must be greater than 0'
    });
  }

  if (amount > invoice.summary.amountDue) {
    return res.status(400).json({
      success: false,
      error: `Payment amount (${amount}) exceeds amount due (${invoice.summary.amountDue})`
    });
  }

  // Add payment using model method
  const payment = await invoice.addPayment(
    { amount, method, reference, notes, date },
    req.user.id
  );

  res.status(200).json({
    success: true,
    message: 'Payment added successfully',
    data: {
      invoice,
      payment
    }
  });
});

// @desc    Cancel invoice
// @route   PUT /api/invoices/:id/cancel
// @access  Private (Admin)
exports.cancelInvoice = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return res.status(404).json({
      success: false,
      error: 'Invoice not found'
    });
  }

  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({
      success: false,
      error: 'Cancellation reason is required'
    });
  }

  try {
    await invoice.cancel(req.user.id, reason);

    res.status(200).json({
      success: true,
      message: 'Invoice cancelled successfully',
      data: invoice
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Issue refund
// @route   POST /api/invoices/:id/refund
// @access  Private (Admin)
exports.issueRefund = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return res.status(404).json({
      success: false,
      error: 'Invoice not found'
    });
  }

  const { amount, reason, method } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Refund amount must be greater than 0'
    });
  }

  if (!reason) {
    return res.status(400).json({
      success: false,
      error: 'Refund reason is required'
    });
  }

  try {
    await invoice.issueRefund(amount, req.user.id, reason, method);

    res.status(200).json({
      success: true,
      message: 'Refund issued successfully',
      data: invoice
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Send invoice reminder
// @route   POST /api/invoices/:id/reminder
// @access  Private (Admin, Receptionist)
exports.sendReminder = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return res.status(404).json({
      success: false,
      error: 'Invoice not found'
    });
  }

  const { method } = req.body; // email, sms, phone, mail

  if (!method || !['email', 'sms', 'phone', 'mail'].includes(method)) {
    return res.status(400).json({
      success: false,
      error: 'Valid reminder method required (email, sms, phone, mail)'
    });
  }

  await invoice.sendReminder(method, req.user.id);

  res.status(200).json({
    success: true,
    message: `Reminder sent via ${method}`,
    data: invoice
  });
});

// @desc    Get patient invoices
// @route   GET /api/invoices/patient/:patientId
// @access  Private
exports.getPatientInvoices = asyncHandler(async (req, res, next) => {
  const { patientId } = req.params;
  const { includeBalance } = req.query;

  // Validate patient exists
  const patient = await Patient.findById(patientId);
  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  // Get all invoices for patient
  const invoices = await Invoice.find({ patient: patientId })
    .populate('visit', 'visitId visitDate')
    .sort('-dateIssued');

  let response = {
    success: true,
    count: invoices.length,
    data: invoices
  };

  // Include balance if requested
  if (includeBalance === 'true') {
    const balance = await Invoice.getPatientBalance(patientId);
    response.balance = balance;
  }

  res.status(200).json(response);
});

// @desc    Get overdue invoices
// @route   GET /api/invoices/overdue
// @access  Private (Admin, Accountant)
exports.getOverdueInvoices = asyncHandler(async (req, res, next) => {
  const invoices = await Invoice.getOverdueInvoices();

  res.status(200).json({
    success: true,
    count: invoices.length,
    data: invoices
  });
});

// @desc    Get invoice statistics
// @route   GET /api/invoices/stats
// @access  Private (Admin, Accountant)
exports.getInvoiceStats = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  const dateFilter = {};
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

  res.status(200).json({
    success: true,
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

// @desc    Mark invoice as sent
// @route   PUT /api/invoices/:id/send
// @access  Private (Admin, Receptionist)
exports.markAsSent = asyncHandler(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    return res.status(404).json({
      success: false,
      error: 'Invoice not found'
    });
  }

  if (invoice.status === 'draft') {
    invoice.status = 'sent';
    invoice.sentDate = new Date();
    invoice.updatedBy = req.user.id;
    await invoice.save();
  }

  res.status(200).json({
    success: true,
    message: 'Invoice marked as sent',
    data: invoice
  });
});
