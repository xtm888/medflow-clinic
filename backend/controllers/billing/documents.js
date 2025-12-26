const Invoice = require('../../models/Invoice');
const Patient = require('../../models/Patient');
const InsuranceClaim = require('../../models/InsuranceClaim');
const Company = require('../../models/Company');
const pdfGenerator = require('../../services/pdfGenerator');
const { asyncHandler } = require('../../middleware/errorHandler');

// =====================
// PDF GENERATION
// =====================

// @desc    Generate invoice PDF
// @route   GET /api/billing/invoices/:id/pdf
// @access  Private
exports.generateInvoicePDF = asyncHandler(async (req, res) => {
  const Document = require('../../models/Document');

const { createContextLogger } = require('../../utils/structuredLogger');
const log = createContextLogger('Documents');

  const invoice = await Invoice.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId dateOfBirth phoneNumber email address')
    .populate('createdBy', 'name');

  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found' });
  }

  const pdfBuffer = await pdfGenerator.generateInvoicePDF(invoice);
  const filename = `invoice-${invoice.invoiceId}.pdf`;

  // Track generated PDF as Document record
  Document.trackGeneratedPDF({
    type: 'invoice',
    title: `Facture ${invoice.invoiceNumber || invoice.invoiceId}`,
    patientId: invoice.patient?._id,
    visitId: invoice.visit,
    userId: req.user._id,
    metadata: {
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.summary?.total
    },
    filename,
    fileSize: pdfBuffer.length
  }).catch(err => log.error('Document tracking error:', err.message));

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.send(pdfBuffer);
});

// @desc    Generate receipt PDF
// @route   GET /api/billing/invoices/:id/receipt/:paymentIndex
// @access  Private
exports.generateReceiptPDF = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId');

  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found' });
  }

  const paymentIndex = parseInt(req.params.paymentIndex);
  const payment = invoice.payments[paymentIndex];

  if (!payment) {
    return res.status(404).json({ success: false, error: 'Payment not found' });
  }

  const pdfBuffer = await pdfGenerator.generateReceiptPDF(payment, invoice, invoice.patient);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=receipt-${payment.receiptNumber || Date.now()}.pdf`);
  res.send(pdfBuffer);
});

// @desc    Generate patient statement PDF
// @route   GET /api/billing/patients/:patientId/statement
// @access  Private
exports.generateStatementPDF = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.patientId);

  if (!patient) {
    return res.status(404).json({ success: false, error: 'Patient not found' });
  }

  const { startDate, endDate } = req.query;
  const dateRange = {
    start: startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    end: endDate ? new Date(endDate) : new Date()
  };

  const invoices = await Invoice.find({
    patient: patient._id,
    createdAt: { $gte: dateRange.start, $lte: dateRange.end }
  }).sort('dateIssued');

  const pdfBuffer = await pdfGenerator.generateStatementPDF(patient, invoices, dateRange);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=statement-${patient.patientId}.pdf`);
  res.send(pdfBuffer);
});

// @desc    Generate claim form PDF
// @route   GET /api/billing/claims/:id/pdf
// @access  Private
exports.generateClaimPDF = asyncHandler(async (req, res) => {
  const claim = await InsuranceClaim.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId dateOfBirth phoneNumber email address')
    .populate('invoice');

  if (!claim) {
    return res.status(404).json({ success: false, error: 'Claim not found' });
  }

  const pdfBuffer = await pdfGenerator.generateClaimFormPDF(claim);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=claim-${claim.claimNumber}.pdf`);
  res.send(pdfBuffer);
});

// @desc    Generate company statement/relevé
// @route   GET /api/billing/convention/statement/:companyId
// @access  Private (Admin, Billing, Manager)
exports.generateCompanyStatement = asyncHandler(async (req, res) => {
  const { companyId } = req.params;
  const { startDate, endDate, format = 'json' } = req.query;

  const company = await Company.findById(companyId);
  if (!company) {
    return res.status(404).json({
      success: false,
      message: 'Entreprise non trouvée'
    });
  }

  const query = {
    'companyBilling.company': companyId,
    isConventionInvoice: true,
    status: { $nin: ['cancelled', 'refunded'] }
  };

  if (startDate || endDate) {
    query.dateIssued = {};
    if (startDate) query.dateIssued.$gte = new Date(startDate);
    if (endDate) query.dateIssued.$lte = new Date(endDate);
  }

  const invoices = await Invoice.find(query)
    .populate('patient', 'firstName lastName patientId convention')
    .sort({ dateIssued: 1 });

  // Build statement data
  const statement = {
    company: {
      companyId: company.companyId,
      name: company.name,
      contact: company.contact,
      contactPerson: company.contactPerson
    },
    period: {
      startDate: startDate || 'Début',
      endDate: endDate || new Date().toISOString().split('T')[0]
    },
    generatedAt: new Date(),
    previousBalance: company.balance.outstanding,
    transactions: invoices.map(inv => ({
      date: inv.dateIssued,
      invoiceId: inv.invoiceId,
      patient: {
        name: `${inv.patient.firstName} ${inv.patient.lastName}`,
        patientId: inv.patient.patientId,
        employeeId: inv.companyBilling?.employeeId
      },
      total: inv.summary.total,
      companyShare: inv.companyBilling?.companyShare || 0,
      patientShare: inv.companyBilling?.patientShare || 0,
      status: inv.companyBilling?.companyInvoiceStatus,
      paid: inv.companyBilling?.companyPayment?.amount || 0
    })),
    summary: {
      totalInvoices: invoices.length,
      totalBilled: invoices.reduce((sum, inv) => sum + (inv.companyBilling?.companyShare || 0), 0),
      totalPaid: invoices.reduce((sum, inv) => sum + (inv.companyBilling?.companyPayment?.amount || 0), 0),
      outstanding: 0
    }
  };
  statement.summary.outstanding = statement.summary.totalBilled - statement.summary.totalPaid;

  if (format === 'pdf') {
    // Generate PDF (would need to implement PDF generation)
    // For now, return JSON with flag
    return res.status(200).json({
      success: true,
      message: 'PDF generation not yet implemented',
      data: statement
    });
  }

  res.status(200).json({
    success: true,
    data: statement
  });
});
