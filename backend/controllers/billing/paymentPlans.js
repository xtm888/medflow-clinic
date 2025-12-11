const PaymentPlan = require('../../models/PaymentPlan');
const Invoice = require('../../models/Invoice');
const Patient = require('../../models/Patient');
const { asyncHandler } = require('../../middleware/errorHandler');

// =====================
// PAYMENT PLANS
// =====================

// @desc    Get payment plans
// @route   GET /api/billing/payment-plans
// @access  Private
exports.getPaymentPlans = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, patientId } = req.query;

  let query = {};
  if (status) query.status = status;
  if (patientId) query.patient = patientId;

  const plans = await PaymentPlan.find(query)
    .populate('patient', 'firstName lastName patientId')
    .populate('invoices', 'invoiceId summary')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await PaymentPlan.countDocuments(query);

  res.status(200).json({
    success: true,
    count: plans.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: plans
  });
});

// @desc    Get single payment plan
// @route   GET /api/billing/payment-plans/:id
// @access  Private
exports.getPaymentPlan = asyncHandler(async (req, res) => {
  const plan = await PaymentPlan.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId phoneNumber email')
    .populate('invoices')
    .populate('createdBy', 'name');

  if (!plan) {
    return res.status(404).json({ success: false, error: 'Payment plan not found' });
  }

  res.status(200).json({
    success: true,
    data: plan
  });
});

// @desc    Create payment plan
// @route   POST /api/billing/payment-plans
// @access  Private
exports.createPaymentPlan = asyncHandler(async (req, res) => {
  req.body.createdBy = req.user.id;

  // Validate required fields
  const { patient, totalAmount, numberOfInstallments, startDate } = req.body;
  if (!patient || !totalAmount || !numberOfInstallments || !startDate) {
    return res.status(400).json({
      success: false,
      error: 'Patient, total amount, number of installments, and start date are required'
    });
  }

  const plan = new PaymentPlan(req.body);

  // Generate installments
  plan.generateInstallments();

  await plan.save();

  res.status(201).json({
    success: true,
    data: plan
  });
});

// @desc    Activate payment plan
// @route   POST /api/billing/payment-plans/:id/activate
// @access  Private
exports.activatePaymentPlan = asyncHandler(async (req, res) => {
  const plan = await PaymentPlan.findById(req.params.id);

  if (!plan) {
    return res.status(404).json({ success: false, error: 'Payment plan not found' });
  }

  await plan.activate(req.user.id);

  res.status(200).json({
    success: true,
    message: 'Payment plan activated',
    data: plan
  });
});

// @desc    Record payment against plan installment
// @route   POST /api/billing/payment-plans/:id/pay
// @access  Private
exports.recordPlanPayment = asyncHandler(async (req, res) => {
  const plan = await PaymentPlan.findById(req.params.id);

  if (!plan) {
    return res.status(404).json({ success: false, error: 'Payment plan not found' });
  }

  const { installmentNumber, amount, paymentId } = req.body;

  if (!installmentNumber || !amount) {
    return res.status(400).json({
      success: false,
      error: 'Installment number and amount are required'
    });
  }

  const installment = await plan.recordPayment(installmentNumber, amount, paymentId, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Payment recorded',
    data: installment
  });
});

// @desc    Get overdue installments
// @route   GET /api/billing/payment-plans/overdue
// @access  Private (Admin, Accountant)
exports.getOverdueInstallments = asyncHandler(async (req, res) => {
  const overdue = await PaymentPlan.getOverdueInstallments();

  res.status(200).json({
    success: true,
    count: overdue.length,
    data: overdue
  });
});

// @desc    Cancel payment plan
// @route   POST /api/billing/payment-plans/:id/cancel
// @access  Private (Admin)
exports.cancelPaymentPlan = asyncHandler(async (req, res) => {
  const plan = await PaymentPlan.findById(req.params.id);

  if (!plan) {
    return res.status(404).json({ success: false, error: 'Payment plan not found' });
  }

  plan.status = 'cancelled';
  plan.updatedBy = req.user.id;
  await plan.save();

  res.status(200).json({
    success: true,
    message: 'Payment plan cancelled',
    data: plan
  });
});
