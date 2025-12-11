const { asyncHandler } = require('../../middleware/errorHandler');
const Visit = require('../../models/Visit');
const { generateUniqueBarcode } = require('./utils/barcodeGenerator');

// ============================================
// REPORT GENERATION
// ============================================

// @desc    Print laboratory report
// @route   GET /api/laboratory/report/:visitId
// @access  Private
exports.generateReport = asyncHandler(async (req, res) => {
  const visit = await Visit.findById(req.params.visitId)
    .populate('patient', 'firstName lastName patientId dateOfBirth gender address phoneNumber')
    .populate('primaryProvider', 'firstName lastName specialization')
    .populate('laboratoryOrders.performedBy', 'firstName lastName')
    .lean();

  if (!visit || !visit.laboratoryOrders || visit.laboratoryOrders.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'No laboratory tests found for this visit'
    });
  }

  // Filter completed tests only
  const completedTests = visit.laboratoryOrders.filter(test => test.status === 'completed');

  if (completedTests.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No completed laboratory tests found'
    });
  }

  const report = {
    patient: visit.patient,
    provider: visit.primaryProvider,
    visitDate: visit.visitDate,
    reportDate: new Date(),
    tests: completedTests,
    summary: {
      totalTests: completedTests.length,
      criticalResults: completedTests.filter(t => t.isCritical).length
    }
  };

  res.status(200).json({
    success: true,
    data: report
  });
});

// ============================================
// PDF GENERATION - CRITICAL
// ============================================

// @desc    Generate PDF report
// @route   GET /api/laboratory/report/:visitId/pdf
// @access  Private
exports.generatePDF = asyncHandler(async (req, res) => {
  const visit = await Visit.findById(req.params.visitId)
    .populate('patient', 'firstName lastName patientId dateOfBirth gender address phoneNumber')
    .populate('primaryProvider', 'firstName lastName specialization licenseNumber')
    .populate('laboratoryOrders.performedBy', 'firstName lastName')
    .populate('laboratoryOrders.resultedBy', 'firstName lastName')
    .lean();

  if (!visit || !visit.laboratoryOrders || visit.laboratoryOrders.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'No laboratory tests found for this visit'
    });
  }

  const completedTests = visit.laboratoryOrders.filter(test => test.status === 'completed');

  if (completedTests.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No completed laboratory tests found'
    });
  }

  // Generate PDF
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=lab-report-${visit._id}.pdf`);

  doc.pipe(res);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('RAPPORT DE LABORATOIRE', { align: 'center' });
  doc.moveDown();

  // Clinic Info
  doc.fontSize(10).font('Helvetica')
    .text('Centre Ophtalmologique', { align: 'center' })
    .text('Laboratoire d\'Analyses Medicales', { align: 'center' });
  doc.moveDown();

  // Line
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  // Patient Info
  doc.fontSize(12).font('Helvetica-Bold').text('PATIENT:');
  doc.fontSize(10).font('Helvetica')
    .text(`Nom: ${visit.patient?.firstName || ''} ${visit.patient?.lastName || ''}`)
    .text(`ID: ${visit.patient?.patientId || 'N/A'}`)
    .text(`Date de naissance: ${visit.patient?.dateOfBirth ? new Date(visit.patient.dateOfBirth).toLocaleDateString('fr-FR') : 'N/A'}`)
    .text(`Sexe: ${visit.patient?.gender === 'male' ? 'Masculin' : visit.patient?.gender === 'female' ? 'Feminin' : 'N/A'}`);
  doc.moveDown();

  // Report Info
  doc.text(`Date du rapport: ${new Date().toLocaleDateString('fr-FR')}`);
  doc.text(`Medecin prescripteur: Dr. ${visit.primaryProvider?.firstName || ''} ${visit.primaryProvider?.lastName || ''}`);
  doc.moveDown();

  // Line
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  // Results Header
  doc.fontSize(12).font('Helvetica-Bold').text('RESULTATS DES ANALYSES:');
  doc.moveDown();

  // Results Table Header
  const tableTop = doc.y;
  doc.fontSize(9).font('Helvetica-Bold');
  doc.text('Test', 50, tableTop, { width: 150 });
  doc.text('Resultat', 200, tableTop, { width: 80 });
  doc.text('Unite', 280, tableTop, { width: 60 });
  doc.text('Ref.', 340, tableTop, { width: 100 });
  doc.text('Flag', 440, tableTop, { width: 50 });

  doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
  doc.moveDown();

  // Results
  doc.fontSize(9).font('Helvetica');
  completedTests.forEach(test => {
    const y = doc.y;

    // Check if we need a new page
    if (y > 700) {
      doc.addPage();
    }

    // Main test result
    doc.font('Helvetica-Bold').text(test.testName || 'Test', 50, doc.y, { width: 150 });
    doc.font('Helvetica');

    const resultY = doc.y - 12;

    if (test.results !== undefined && test.results !== null) {
      doc.text(String(test.results), 200, resultY, { width: 80 });
      doc.text(test.unit || '', 280, resultY, { width: 60 });
      doc.text(test.referenceRange || '', 340, resultY, { width: 100 });

      // Flag with color
      if (test.isAbnormal) {
        doc.fillColor(test.abnormalFlag?.includes('critical') ? 'red' : 'orange');
        doc.text(test.abnormalFlag === 'high' ? 'H' : test.abnormalFlag === 'low' ? 'L' : test.abnormalFlag?.toUpperCase() || '', 440, resultY, { width: 50 });
        doc.fillColor('black');
      } else {
        doc.text('N', 440, resultY, { width: 50 });
      }
    }

    // Component results if any
    if (test.componentResults && test.componentResults.length > 0) {
      test.componentResults.forEach(comp => {
        doc.moveDown(0.3);
        const compY = doc.y;

        doc.text(`  ${comp.name}`, 50, compY, { width: 150 });
        doc.text(String(comp.value || ''), 200, compY, { width: 80 });
        doc.text(comp.unit || '', 280, compY, { width: 60 });
        doc.text(comp.referenceRangeText || '', 340, compY, { width: 100 });

        if (comp.isAbnormal) {
          doc.fillColor(comp.abnormalFlag?.includes('critical') ? 'red' : 'orange');
          doc.text(comp.abnormalFlag === 'high' ? 'H' : comp.abnormalFlag === 'low' ? 'L' : 'A', 440, compY, { width: 50 });
          doc.fillColor('black');
        } else {
          doc.text('N', 440, compY, { width: 50 });
        }
      });
    }

    doc.moveDown(0.5);
  });

  // Footer
  doc.moveDown(2);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown();

  doc.fontSize(8).font('Helvetica')
    .text('H = Eleve, L = Bas, N = Normal, C = Critique', { align: 'center' })
    .moveDown()
    .text('Ce rapport est genere electroniquement et ne necessite pas de signature.', { align: 'center' });

  doc.end();
});

// @desc    Get printable report (HTML format)
// @route   GET /api/laboratory/report/:visitId/print
// @access  Private
exports.getPrintableReport = asyncHandler(async (req, res) => {
  const visit = await Visit.findById(req.params.visitId)
    .populate('patient', 'firstName lastName patientId dateOfBirth gender')
    .populate('primaryProvider', 'firstName lastName specialization')
    .populate('laboratoryOrders.performedBy', 'firstName lastName')
    .lean();

  if (!visit || !visit.laboratoryOrders) {
    return res.status(404).json({
      success: false,
      error: 'No laboratory tests found'
    });
  }

  const completedTests = visit.laboratoryOrders.filter(t => t.status === 'completed');

  res.status(200).json({
    success: true,
    data: {
      patient: visit.patient,
      provider: visit.primaryProvider,
      visitDate: visit.visitDate,
      reportDate: new Date(),
      tests: completedTests.map(test => ({
        name: test.testName,
        code: test.testCode,
        result: test.results,
        unit: test.unit,
        referenceRange: test.referenceRange,
        isAbnormal: test.isAbnormal,
        abnormalFlag: test.abnormalFlag,
        isCritical: test.isCritical,
        componentResults: test.componentResults,
        completedAt: test.completedAt,
        performedBy: test.performedBy
      })),
      summary: {
        total: completedTests.length,
        abnormal: completedTests.filter(t => t.isAbnormal).length,
        critical: completedTests.filter(t => t.isCritical).length
      }
    }
  });
});

// ============================================
// WORKLIST & WORKFLOW
// ============================================

// @desc    Get lab worklist
// @route   GET /api/laboratory/worklist
// @access  Private
exports.getWorklist = asyncHandler(async (req, res) => {
  const { status = 'ordered,collected,in-progress', priority } = req.query;
  const statusArray = status.split(',');

  const visits = await Visit.find({
    'laboratoryOrders.status': { $in: statusArray }
  })
    .populate('patient', 'firstName lastName patientId dateOfBirth gender')
    .select('laboratoryOrders patient visitDate specimens')
    .sort('laboratoryOrders.orderedAt')
    .lean();

  const worklist = [];
  visits.forEach(visit => {
    visit.laboratoryOrders
      ?.filter(test => statusArray.includes(test.status))
      .filter(test => !priority || test.urgency === priority)
      .forEach(test => {
        const specimen = visit.specimens?.find(s => s.barcode === test.specimenBarcode);
        worklist.push({
          ...test,
          patient: visit.patient,
          visitId: visit._id,
          visitDate: visit.visitDate,
          specimen
        });
      });
  });

  // Sort by urgency (urgent first) then by ordered time
  worklist.sort((a, b) => {
    if (a.urgency === 'urgent' && b.urgency !== 'urgent') return -1;
    if (b.urgency === 'urgent' && a.urgency !== 'urgent') return 1;
    return new Date(a.orderedAt) - new Date(b.orderedAt);
  });

  res.status(200).json({
    success: true,
    count: worklist.length,
    data: worklist
  });
});

// @desc    Mark specimen as collected
// @route   PUT /api/laboratory/worklist/:testId/collect
// @access  Private (Lab Tech, Nurse)
exports.markCollected = asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const { specimenType, notes } = req.body;

  const visit = await Visit.findOne({ 'laboratoryOrders._id': testId });
  if (!visit) {
    return res.status(404).json({
      success: false,
      error: 'Test not found'
    });
  }

  const test = visit.laboratoryOrders.id(testId);

  // Generate unique barcode with collision detection
  const barcode = await generateUniqueBarcode();

  if (!visit.specimens) visit.specimens = [];
  visit.specimens.push({
    barcode,
    specimenType: specimenType || 'Sang',
    collectedBy: req.user.id,
    collectionTime: new Date(),
    status: 'collected',
    notes,
    testIds: [testId],
    statusHistory: [{
      status: 'collected',
      timestamp: new Date(),
      updatedBy: req.user.id
    }]
  });

  test.status = 'collected';
  test.specimenBarcode = barcode;
  test.specimenCollectedAt = new Date();
  test.specimenCollectedBy = req.user.id;

  await visit.save();

  res.status(200).json({
    success: true,
    message: 'Specimen collected',
    data: {
      barcode,
      test
    }
  });
});

// @desc    Start processing test
// @route   PUT /api/laboratory/worklist/:testId/start
// @access  Private (Lab Tech)
exports.startProcessing = asyncHandler(async (req, res) => {
  const { testId } = req.params;

  const visit = await Visit.findOne({ 'laboratoryOrders._id': testId });
  if (!visit) {
    return res.status(404).json({
      success: false,
      error: 'Test not found'
    });
  }

  const test = visit.laboratoryOrders.id(testId);
  test.status = 'in-progress';
  test.startedAt = new Date();
  test.startedBy = req.user.id;

  await visit.save();

  res.status(200).json({
    success: true,
    message: 'Test processing started',
    data: test
  });
});

module.exports = exports;
