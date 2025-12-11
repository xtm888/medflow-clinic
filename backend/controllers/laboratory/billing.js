const { asyncHandler } = require('../../middleware/errorHandler');
const Visit = require('../../models/Visit');
const Invoice = require('../../models/Invoice');
const FeeSchedule = require('../../models/FeeSchedule');
const LaboratoryTemplate = require('../../models/LaboratoryTemplate');
const AuditLog = require('../../models/AuditLog');
const mongoose = require('mongoose');

// ============================================
// BILLING INTEGRATION
// ============================================

// @desc    Generate invoice for laboratory tests
// @route   POST /api/laboratory/invoice/:visitId
// @access  Private (Admin, Billing)
exports.generateLabInvoice = asyncHandler(async (req, res) => {
  const { visitId } = req.params;
  const { testIds } = req.body; // Optional: specific tests to bill

  // CRITICAL FIX: Use atomic operation to prevent double-invoicing
  // First, atomically mark tests as "invoicing in progress" to prevent race conditions
  const testFilter = testIds && testIds.length > 0
    ? { 'laboratoryOrders._id': { $in: testIds.map(id => new mongoose.Types.ObjectId(id)) } }
    : {};

  // Atomic update: mark unbilled tests as being invoiced (lock them)
  const lockResult = await Visit.findOneAndUpdate(
    {
      _id: visitId,
      'laboratoryOrders': {
        $elemMatch: {
          invoiced: { $ne: true },
          invoicingInProgress: { $ne: true },
          ...(testIds && testIds.length > 0 ? { _id: { $in: testIds.map(id => new mongoose.Types.ObjectId(id)) } } : {})
        }
      }
    },
    {
      $set: {
        'laboratoryOrders.$[elem].invoicingInProgress': true,
        'laboratoryOrders.$[elem].invoicingStartedAt': new Date(),
        'laboratoryOrders.$[elem].invoicingBy': req.user.id
      }
    },
    {
      arrayFilters: [
        {
          'elem.invoiced': { $ne: true },
          'elem.invoicingInProgress': { $ne: true },
          ...(testIds && testIds.length > 0 ? { 'elem._id': { $in: testIds.map(id => new mongoose.Types.ObjectId(id)) } } : {})
        }
      ],
      new: true
    }
  );

  if (!lockResult) {
    // Either visit not found or all tests are already invoiced/being invoiced
    const visit = await Visit.findById(visitId);
    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }
    return res.status(409).json({
      success: false,
      error: 'Tests are already invoiced or being invoiced by another user. Please refresh and try again.'
    });
  }

  const visit = await Visit.findById(visitId)
    .populate('patient', 'firstName lastName patientId')
    .populate('laboratoryOrders.orderedBy', 'firstName lastName');

  if (!visit.laboratoryOrders || visit.laboratoryOrders.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No laboratory tests found for this visit'
    });
  }

  // Filter tests that we locked for billing
  let testsToBill = visit.laboratoryOrders.filter(t =>
    t.invoicingInProgress === true &&
    t.invoicingBy?.toString() === req.user.id.toString() &&
    !t.invoiced
  );

  if (testIds && testIds.length > 0) {
    testsToBill = testsToBill.filter(t => testIds.includes(t._id.toString()));
  }

  if (testsToBill.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No unbilled tests found'
    });
  }

  // Get pricing from FeeSchedule for each test
  const invoiceItems = [];
  for (const test of testsToBill) {
    // Try to find fee schedule by test code
    let price = 0;
    if (test.testCode) {
      const feeSchedule = await FeeSchedule.findOne({
        code: test.testCode,
        active: true,
        $or: [
          { effectiveTo: null },
          { effectiveTo: { $gte: new Date() } }
        ]
      }).sort({ effectiveFrom: -1 });

      if (feeSchedule) {
        price = feeSchedule.price;
      }
    }

    // If no fee schedule found by code, try by name
    if (price === 0 && test.testName) {
      const feeSchedule = await FeeSchedule.findOne({
        name: new RegExp(`^${test.testName}$`, 'i'),
        category: 'laboratory',
        active: true,
        $or: [
          { effectiveTo: null },
          { effectiveTo: { $gte: new Date() } }
        ]
      }).sort({ effectiveFrom: -1 });

      if (feeSchedule) {
        price = feeSchedule.price;
      }
    }

    // Fallback to LaboratoryTemplate if FeeSchedule not found (for backwards compatibility)
    if (price === 0) {
      if (test.testCode) {
        const template = await LaboratoryTemplate.findOne({ code: test.testCode });
        if (template && template.price) {
          price = template.price;
        }
      }
      if (price === 0 && test.testName) {
        const template = await LaboratoryTemplate.findOne({ name: test.testName });
        if (template && template.price) {
          price = template.price;
        }
      }
    }

    invoiceItems.push({
      description: test.testName,
      category: 'laboratory',
      code: test.testCode || '',
      quantity: 1,
      unitPrice: price,
      discount: 0,
      subtotal: price,
      tax: 0,
      total: price,
      reference: test._id.toString()
    });
  }

  // Calculate totals
  const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);

  // Create invoice
  const invoiceData = {
    patient: visit.patient._id,
    visit: visit._id,
    dateIssued: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    items: invoiceItems,
    summary: {
      subtotal,
      discountTotal: 0,
      taxTotal: 0,
      total: subtotal,
      amountPaid: 0,
      amountDue: subtotal
    },
    status: 'issued',
    billing: {
      currency: process.env.BASE_CURRENCY || 'CDF'
    },
    notes: {
      internal: `Laboratory tests invoice for visit ${visit._id}`,
      billing: `${testsToBill.length} laboratory test(s)`
    },
    createdBy: req.user.id
  };

  let invoice;
  try {
    invoice = await Invoice.create(invoiceData);

    // Mark tests as invoiced and clear the lock atomically
    await Visit.findByIdAndUpdate(
      visitId,
      {
        $set: {
          'laboratoryOrders.$[elem].invoiced': true,
          'laboratoryOrders.$[elem].invoiceId': invoice._id,
          'laboratoryOrders.$[elem].invoicedAt': new Date(),
          'laboratoryOrders.$[elem].invoicedBy': req.user.id
        },
        $unset: {
          'laboratoryOrders.$[elem].invoicingInProgress': '',
          'laboratoryOrders.$[elem].invoicingStartedAt': '',
          'laboratoryOrders.$[elem].invoicingBy': ''
        }
      },
      {
        arrayFilters: [
          {
            'elem._id': { $in: testsToBill.map(t => t._id) },
            'elem.invoicingBy': req.user.id
          }
        ]
      }
    );
  } catch (error) {
    // If invoice creation fails, release the lock
    await Visit.findByIdAndUpdate(
      visitId,
      {
        $unset: {
          'laboratoryOrders.$[elem].invoicingInProgress': '',
          'laboratoryOrders.$[elem].invoicingStartedAt': '',
          'laboratoryOrders.$[elem].invoicingBy': ''
        }
      },
      {
        arrayFilters: [
          { 'elem.invoicingBy': req.user.id }
        ]
      }
    );
    throw error; // Re-throw to be handled by asyncHandler
  }

  // Audit log
  await AuditLog.create({
    user: req.user.id,
    action: 'INVOICE_CREATE',
    resource: `/api/laboratory/invoice/${visitId}`,
    ipAddress: req.ip,
    metadata: {
      invoiceId: invoice.invoiceId,
      visitId,
      testCount: testsToBill.length,
      total: subtotal
    }
  });

  res.status(201).json({
    success: true,
    message: 'Laboratory invoice created successfully',
    data: {
      invoice,
      testsInvoiced: testsToBill.length
    }
  });
});

// @desc    Get unbilled laboratory tests for a patient
// @route   GET /api/laboratory/unbilled/:patientId
// @access  Private (Billing)
exports.getUnbilledTests = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  const visits = await Visit.find({
    patient: patientId,
    'laboratoryOrders.invoiced': { $ne: true }
  })
    .populate('patient', 'firstName lastName patientId')
    .select('laboratoryOrders visitDate')
    .lean();

  const unbilledTests = [];
  for (const visit of visits) {
    if (visit.laboratoryOrders) {
      const tests = visit.laboratoryOrders.filter(t => !t.invoiced);
      for (const test of tests) {
        // Get price from FeeSchedule
        let price = 0;
        if (test.testCode) {
          const feeSchedule = await FeeSchedule.findOne({
            code: test.testCode,
            active: true,
            $or: [
              { effectiveTo: null },
              { effectiveTo: { $gte: new Date() } }
            ]
          }).sort({ effectiveFrom: -1 });

          if (feeSchedule) {
            price = feeSchedule.price;
          }
        }

        if (price === 0 && test.testName) {
          const feeSchedule = await FeeSchedule.findOne({
            name: new RegExp(`^${test.testName}$`, 'i'),
            category: 'laboratory',
            active: true,
            $or: [
              { effectiveTo: null },
              { effectiveTo: { $gte: new Date() } }
            ]
          }).sort({ effectiveFrom: -1 });

          if (feeSchedule) {
            price = feeSchedule.price;
          }
        }

        // Fallback to LaboratoryTemplate if FeeSchedule not found
        if (price === 0) {
          if (test.testCode) {
            const template = await LaboratoryTemplate.findOne({ code: test.testCode });
            if (template) price = template.price || 0;
          }
          if (price === 0 && test.testName) {
            const template = await LaboratoryTemplate.findOne({ name: test.testName });
            if (template) price = template.price || 0;
          }
        }

        unbilledTests.push({
          ...test,
          visitId: visit._id,
          visitDate: visit.visitDate,
          price
        });
      }
    }
  }

  res.status(200).json({
    success: true,
    count: unbilledTests.length,
    data: unbilledTests
  });
});

module.exports = exports;
