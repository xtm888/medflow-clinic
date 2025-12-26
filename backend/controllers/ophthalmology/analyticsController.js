/**
 * Ophthalmology Analytics Controller
 *
 * Handles IOL calculation, exam comparison, progression analysis,
 * treatment recommendations, PDF reports, and exam templates.
 */

const {
  OphthalmologyExam,
  asyncHandler,
  success,
  error,
  notFound,
  findPatientByIdOrCode,
  PDFDocument
} = require('./shared');

// =====================================================
// IOL CALCULATION
// =====================================================

// @desc    Calculate IOL power
// @route   POST /api/ophthalmology/exams/:id/iol-calculation
// @access  Private
exports.calculateIOLPower = asyncHandler(async (req, res, next) => {
  const { formula, targetRefraction, eye, aConstant } = req.body;

  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  // Get biometry data
  const biometry = exam.biometry?.[eye] || {};
  const keratometry = exam.keratometry?.[eye] || {};

  if (!biometry.axialLength) {
    return error(res, `Biometry data (axial length) required for ${eye}`);
  }

  if (!keratometry.k1 || !keratometry.k2) {
    return error(res, `Keratometry data (K values) required for ${eye}`);
  }

  const axialLength = biometry.axialLength;
  const k1 = keratometry.k1;
  const k2 = keratometry.k2;
  const avgK = (k1 + k2) / 2;
  const target = targetRefraction || 0;
  const A = aConstant || 118.4; // Default SRK/T A-constant

  let iolPower, calculationDetails;

  // IOL Calculation Formulas
  switch (formula?.toLowerCase()) {
    case 'srkt':
    case 'srt/t':
      // SRK/T Formula
      const Lc = axialLength > 24.2
        ? axialLength + 0.9 * (axialLength - 24.2)
        : axialLength;
      const r = 337.5 / avgK;
      const Cw = -5.41 + 0.58412 * Lc + 0.098 * avgK;
      const H = r - Math.sqrt(r * r - (Cw * Cw) / 4);
      const d = axialLength - A * 0.62467 * (axialLength - 23.4);
      const n = 1.336;

      iolPower = (n / (Lc - d - 0.05)) - (n / ((n / avgK * 1000) + (d + 0.05))) + target;
      iolPower = Math.round(iolPower * 2) / 2; // Round to 0.5

      calculationDetails = {
        formula: 'SRK/T',
        correctedAL: Lc,
        cornealRadius: r,
        estimatedACD: H,
        iolPosition: d
      };
      break;

    case 'hofferq':
    case 'hoffer-q':
      // Hoffer Q Formula
      const pACD = 0.58 * A - 63.896;
      const G = pACD + 0.3 * (axialLength - 23.5);
      const M = Math.tan(avgK * Math.PI / 180);

      iolPower = (1336 / (axialLength - G - 0.05)) - (1.336 / ((1 / avgK) + (G / 1000) + 0.05 / 1000));
      iolPower = iolPower - target;
      iolPower = Math.round(iolPower * 2) / 2;

      calculationDetails = {
        formula: 'Hoffer Q',
        personalizedACD: pACD,
        correctedACD: G
      };
      break;

    case 'holladay1':
    case 'holladay':
      // Holladay 1 Formula
      const sf = 0.5663 * A - 65.6;
      const AG = 12.5 / (axialLength / avgK);
      const ACD = sf + AG;

      iolPower = (1336 / (axialLength - ACD)) - (1336 / ((1336 / avgK) + ACD));
      iolPower = iolPower - target;
      iolPower = Math.round(iolPower * 2) / 2;

      calculationDetails = {
        formula: 'Holladay 1',
        surgeonFactor: sf,
        anteriorSegmentLength: AG,
        estimatedACD: ACD
      };
      break;

    case 'haigis':
      // Haigis Formula (simplified)
      const a0 = aConstant ? (aConstant - 118.4) * 0.4 + 1.19 : 1.19;
      const a1 = 0.4;
      const a2 = 0.1;
      const measuredACD = biometry.acd || 3.5;

      const d_haigis = a0 + a1 * measuredACD + a2 * axialLength;
      iolPower = (1336 / (axialLength - d_haigis)) - (1336 / ((1336 / avgK) + d_haigis));
      iolPower = iolPower - target;
      iolPower = Math.round(iolPower * 2) / 2;

      calculationDetails = {
        formula: 'Haigis',
        opticalACD: d_haigis,
        measuredACD: measuredACD
      };
      break;

    default:
      // Default to SRK II for simplicity
      iolPower = A - 2.5 * axialLength - 0.9 * avgK + target;
      iolPower = Math.round(iolPower * 2) / 2;

      calculationDetails = {
        formula: 'SRK II',
        note: 'Legacy formula, consider using modern formulas'
      };
  }

  // Store calculation in exam
  exam.iolCalculations = exam.iolCalculations || [];
  const calculation = {
    eye,
    formula: calculationDetails.formula,
    targetRefraction: target,
    aConstant: A,
    inputData: {
      axialLength,
      k1,
      k2,
      avgK,
      acd: biometry.acd
    },
    result: {
      iolPower,
      ...calculationDetails
    },
    calculatedAt: new Date(),
    calculatedBy: req.user.id
  };
  exam.iolCalculations.push(calculation);

  await exam.save();

  // Generate power range recommendations
  const powerRange = [];
  for (let p = iolPower - 1.5; p <= iolPower + 1.5; p += 0.5) {
    const expectedRefraction = target - (iolPower - p);
    powerRange.push({
      power: p,
      expectedRefraction: Math.round(expectedRefraction * 100) / 100
    });
  }

  return success(res, {
    recommendedPower: iolPower,
    targetRefraction: target,
    eye,
    calculation,
    powerRange,
    biometryUsed: {
      axialLength,
      k1,
      k2,
      avgK
    }
  }, 'IOL calculation completed');
});

// =====================================================
// EXAM COMPARISON & PROGRESSION ANALYSIS
// =====================================================

// @desc    Compare two exams
// @route   GET /api/ophthalmology/exams/compare
// @access  Private
exports.compareExams = asyncHandler(async (req, res, next) => {
  const { exam1, exam2 } = req.query;

  if (!exam1 || !exam2) {
    return error(res, 'Two exam IDs required for comparison');
  }

  const [examOne, examTwo] = await Promise.all([
    OphthalmologyExam.findById(exam1).populate('patient', 'firstName lastName patientId'),
    OphthalmologyExam.findById(exam2).populate('patient', 'firstName lastName patientId')
  ]);

  if (!examOne || !examTwo) {
    return notFound(res, 'One or both exams');
  }

  // Build comparison
  const comparison = {
    metadata: {
      exam1: {
        id: examOne._id,
        date: examOne.createdAt,
        examId: examOne.examId
      },
      exam2: {
        id: examTwo._id,
        date: examTwo.createdAt,
        examId: examTwo.examId
      },
      daysBetween: Math.round((examTwo.createdAt - examOne.createdAt) / (1000 * 60 * 60 * 24))
    },
    visualAcuity: {
      OD: {
        exam1: examOne.visualAcuity?.distance?.OD?.corrected,
        exam2: examTwo.visualAcuity?.distance?.OD?.corrected,
        change: null
      },
      OS: {
        exam1: examOne.visualAcuity?.distance?.OS?.corrected,
        exam2: examTwo.visualAcuity?.distance?.OS?.corrected,
        change: null
      }
    },
    iop: {
      OD: {
        exam1: examOne.iop?.OD?.value,
        exam2: examTwo.iop?.OD?.value,
        change: examTwo.iop?.OD?.value && examOne.iop?.OD?.value
          ? examTwo.iop.OD.value - examOne.iop.OD.value
          : null
      },
      OS: {
        exam1: examOne.iop?.OS?.value,
        exam2: examTwo.iop?.OS?.value,
        change: examTwo.iop?.OS?.value && examOne.iop?.OS?.value
          ? examTwo.iop.OS.value - examOne.iop.OS.value
          : null
      }
    },
    refraction: {
      OD: {
        exam1: examOne.refraction?.finalPrescription?.OD,
        exam2: examTwo.refraction?.finalPrescription?.OD
      },
      OS: {
        exam1: examOne.refraction?.finalPrescription?.OS,
        exam2: examTwo.refraction?.finalPrescription?.OS
      }
    },
    diagnoses: {
      exam1: examOne.assessment?.diagnoses || [],
      exam2: examTwo.assessment?.diagnoses || [],
      newDiagnoses: [],
      resolvedDiagnoses: []
    }
  };

  // Find new and resolved diagnoses
  const diag1Set = new Set((examOne.assessment?.diagnoses || []).map(d => d.diagnosis));
  const diag2Set = new Set((examTwo.assessment?.diagnoses || []).map(d => d.diagnosis));

  comparison.diagnoses.newDiagnoses = [...diag2Set].filter(d => !diag1Set.has(d));
  comparison.diagnoses.resolvedDiagnoses = [...diag1Set].filter(d => !diag2Set.has(d));

  return success(res, { data: comparison });
});

// @desc    Get progression analysis for patient
// @route   GET /api/ophthalmology/patients/:patientId/progression
// @access  Private
exports.getProgressionAnalysis = asyncHandler(async (req, res, next) => {
  const { patientId } = req.params;
  const { testType, limit = 10 } = req.query;

  const patient = await findPatientByIdOrCode(patientId);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Get all exams for patient
  const exams = await OphthalmologyExam.find({ patient: patientId })
    .select('createdAt examId iop visualFields refraction visualAcuity additionalTests')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  const progression = {
    patientId,
    patientName: `${patient.firstName} ${patient.lastName}`,
    totalExams: exams.length,
    dateRange: exams.length > 0 ? {
      earliest: exams[exams.length - 1].createdAt,
      latest: exams[0].createdAt
    } : null
  };

  // Build progression data based on test type
  if (!testType || testType === 'iop') {
    progression.iop = {
      OD: exams.map(e => ({
        date: e.createdAt,
        value: e.iop?.OD?.value,
        method: e.iop?.OD?.method
      })).filter(d => d.value),
      OS: exams.map(e => ({
        date: e.createdAt,
        value: e.iop?.OS?.value,
        method: e.iop?.OS?.method
      })).filter(d => d.value)
    };

    // Calculate IOP statistics
    const odValues = progression.iop.OD.map(d => d.value);
    const osValues = progression.iop.OS.map(d => d.value);

    progression.iopStatistics = {
      OD: odValues.length > 0 ? {
        min: Math.min(...odValues),
        max: Math.max(...odValues),
        avg: Math.round(odValues.reduce((a, b) => a + b, 0) / odValues.length * 10) / 10,
        trend: odValues.length > 1 ? (odValues[0] > odValues[odValues.length - 1] ? 'decreasing' : 'increasing') : 'stable'
      } : null,
      OS: osValues.length > 0 ? {
        min: Math.min(...osValues),
        max: Math.max(...osValues),
        avg: Math.round(osValues.reduce((a, b) => a + b, 0) / osValues.length * 10) / 10,
        trend: osValues.length > 1 ? (osValues[0] > osValues[osValues.length - 1] ? 'decreasing' : 'increasing') : 'stable'
      } : null
    };
  }

  if (!testType || testType === 'visualField') {
    progression.visualField = {
      OD: patient.ophthalmology?.visualFieldHistory?.filter(h => h.OD?.md)
        .map(h => ({
          date: h.date,
          md: h.OD.md,
          psd: h.OD.psd,
          vfi: h.OD.vfi
        })) || [],
      OS: patient.ophthalmology?.visualFieldHistory?.filter(h => h.OS?.md)
        .map(h => ({
          date: h.date,
          md: h.OS.md,
          psd: h.OS.psd,
          vfi: h.OS.vfi
        })) || []
    };
  }

  if (!testType || testType === 'refraction') {
    progression.refraction = exams.map(e => ({
      date: e.createdAt,
      OD: e.refraction?.finalPrescription?.OD,
      OS: e.refraction?.finalPrescription?.OS
    })).filter(r => r.OD || r.OS);
  }

  return success(res, { data: progression });
});

// @desc    Get treatment recommendations
// @route   GET /api/ophthalmology/exams/:id/recommendations
// @access  Private
exports.getTreatmentRecommendations = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id)
    .populate('patient');

  if (!exam) {
    return notFound(res, 'Exam');
  }

  const recommendations = [];
  const patient = exam.patient;
  const age = patient?.dateOfBirth
    ? Math.floor((Date.now() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  // IOP-based recommendations
  const iopOD = exam.iop?.OD?.value;
  const iopOS = exam.iop?.OS?.value;

  if (iopOD > 21 || iopOS > 21) {
    recommendations.push({
      category: 'Glaucoma',
      priority: 'high',
      finding: `Elevated IOP: OD ${iopOD || 'N/A'} mmHg, OS ${iopOS || 'N/A'} mmHg`,
      recommendation: 'Consider visual field testing and OCT of optic nerve',
      followUp: '1-2 weeks'
    });
  }

  // Visual acuity recommendations
  const vaOD = exam.visualAcuity?.distance?.OD?.corrected;
  const vaOS = exam.visualAcuity?.distance?.OS?.corrected;

  if (vaOD !== vaOS && (vaOD || vaOS)) {
    recommendations.push({
      category: 'Anisometropia',
      priority: 'medium',
      finding: `Unequal visual acuity: OD ${vaOD || 'N/A'}, OS ${vaOS || 'N/A'}`,
      recommendation: 'Evaluate for amblyopia or pathology',
      followUp: '1 month'
    });
  }

  // Refraction recommendations
  const rxOD = exam.refraction?.finalPrescription?.OD;
  const rxOS = exam.refraction?.finalPrescription?.OS;

  if (rxOD?.sphere && Math.abs(rxOD.sphere) > 6) {
    recommendations.push({
      category: 'High Myopia/Hyperopia',
      priority: 'medium',
      finding: `High refractive error OD: ${rxOD.sphere}D`,
      recommendation: 'Annual dilated fundus examination, discuss refractive surgery options',
      followUp: '12 months'
    });
  }

  // Age-based recommendations
  if (age && age >= 40 && !rxOD?.add) {
    recommendations.push({
      category: 'Presbyopia',
      priority: 'low',
      finding: 'Patient age 40+ without reading add',
      recommendation: 'Evaluate near vision and consider reading correction',
      followUp: 'Next visit'
    });
  }

  // Cataract recommendations
  const lens = exam.slitLamp;
  if (lens?.OD?.lens?.includes('cataract') || lens?.OS?.lens?.includes('cataract')) {
    recommendations.push({
      category: 'Cataract',
      priority: 'medium',
      finding: 'Cataract noted on examination',
      recommendation: 'Monitor progression, discuss surgical options if visually significant',
      followUp: '6 months'
    });
  }

  // Diabetic screening
  if (patient?.medicalHistory?.diabetes) {
    recommendations.push({
      category: 'Diabetic Eye Disease',
      priority: 'high',
      finding: 'Patient has diabetes',
      recommendation: 'Annual dilated fundus examination with retinal photography',
      followUp: '12 months'
    });
  }

  return success(res, {
    examId: exam.examId,
    patientAge: age,
    recommendations: recommendations.sort((a, b) => {
      const priority = { high: 1, medium: 2, low: 3 };
      return priority[a.priority] - priority[b.priority];
    })
  });
});

// =====================================================
// PDF REPORT GENERATION
// =====================================================

// @desc    Generate exam report (PDF)
// @route   GET /api/ophthalmology/exams/:id/report
// @access  Private
exports.generateExamReport = asyncHandler(async (req, res, next) => {
  const { format = 'pdf' } = req.query;

  const exam = await OphthalmologyExam.findById(req.params.id)
    .populate('patient', 'firstName lastName patientId dateOfBirth phoneNumber')
    .populate('examiner', 'firstName lastName licenseNumber specialization');

  if (!exam) {
    return notFound(res, 'Exam');
  }

  if (format === 'json') {
    return success(res, { data: exam });
  }

  // Generate PDF
  const doc = new PDFDocument({ margin: 50 });

  // Set response headers for PDF
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=exam-report-${exam.examId}.pdf`);

  // Pipe the PDF to the response
  doc.pipe(res);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('RAPPORT D\'EXAMEN OPHTALMOLOGIQUE', { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).font('Helvetica').text(`Date: ${new Date(exam.createdAt).toLocaleDateString('fr-FR')}`, { align: 'right' });
  doc.text(`N° Examen: ${exam.examId}`, { align: 'right' });
  doc.moveDown();

  // Patient Information
  doc.fontSize(14).font('Helvetica-Bold').text('INFORMATIONS PATIENT');
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');

  const patient = exam.patient || {};
  doc.text(`Nom: ${patient.firstName || ''} ${patient.lastName || ''}`);
  doc.text(`ID Patient: ${patient.patientId || 'N/A'}`);
  doc.text(`Date de naissance: ${patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString('fr-FR') : 'N/A'}`);
  doc.text(`Téléphone: ${patient.phoneNumber || 'N/A'}`);
  doc.moveDown();

  // Chief Complaint
  if (exam.chiefComplaint?.complaint) {
    doc.fontSize(14).font('Helvetica-Bold').text('MOTIF DE CONSULTATION');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(exam.chiefComplaint.complaint);
    doc.moveDown();
  }

  // Visual Acuity
  doc.fontSize(14).font('Helvetica-Bold').text('ACUITÉ VISUELLE');
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');

  const va = exam.visualAcuity;
  doc.text(`OD: SC ${va?.distance?.OD?.uncorrected || '-'} | AV ${va?.distance?.OD?.corrected || '-'} | PH ${va?.distance?.OD?.pinhole || '-'}`);
  doc.text(`OS: SC ${va?.distance?.OS?.uncorrected || '-'} | AV ${va?.distance?.OS?.corrected || '-'} | PH ${va?.distance?.OS?.pinhole || '-'}`);
  doc.moveDown();

  // Refraction
  if (exam.refraction?.finalPrescription) {
    doc.fontSize(14).font('Helvetica-Bold').text('RÉFRACTION');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');

    const rx = exam.refraction.finalPrescription;
    const formatRx = (eye) => {
      if (!eye) return '-';
      const sph = eye.sphere ? `${eye.sphere > 0 ? '+' : ''}${eye.sphere}` : 'pl';
      const cyl = eye.cylinder ? `${eye.cylinder > 0 ? '+' : ''}${eye.cylinder}x${eye.axis || 0}` : '';
      const add = eye.add ? `Add +${eye.add}` : '';
      return `${sph} ${cyl} ${add}`.trim();
    };

    doc.text(`OD: ${formatRx(rx.OD)}`);
    doc.text(`OS: ${formatRx(rx.OS)}`);
    doc.moveDown();
  }

  // IOP
  if (exam.iop?.OD?.value || exam.iop?.OS?.value) {
    doc.fontSize(14).font('Helvetica-Bold').text('TONOMÉTRIE');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`OD: ${exam.iop.OD?.value || '-'} mmHg (${exam.iop.OD?.method || 'N/A'})`);
    doc.text(`OS: ${exam.iop.OS?.value || '-'} mmHg (${exam.iop.OS?.method || 'N/A'})`);
    if (exam.iop.pachymetry?.OD || exam.iop.pachymetry?.OS) {
      doc.text(`Pachymétrie: OD ${exam.iop.pachymetry?.OD || '-'}μm | OS ${exam.iop.pachymetry?.OS || '-'}μm`);
    }
    doc.moveDown();
  }

  // Slit Lamp
  if (exam.slitLamp) {
    doc.fontSize(14).font('Helvetica-Bold').text('EXAMEN À LA LAMPE À FENTE');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');

    ['OD', 'OS'].forEach(eye => {
      const sl = exam.slitLamp[eye];
      if (sl) {
        doc.font('Helvetica-Bold').text(`${eye}:`);
        doc.font('Helvetica');
        if (sl.lids) doc.text(`  Paupières: ${sl.lids}`);
        if (sl.conjunctiva) doc.text(`  Conjonctive: ${sl.conjunctiva}`);
        if (sl.cornea) doc.text(`  Cornée: ${sl.cornea}`);
        if (sl.anteriorChamber) doc.text(`  Chambre antérieure: ${sl.anteriorChamber}`);
        if (sl.iris) doc.text(`  Iris: ${sl.iris}`);
        if (sl.lens) doc.text(`  Cristallin: ${sl.lens}`);
      }
    });
    doc.moveDown();
  }

  // Fundus
  if (exam.fundus) {
    doc.fontSize(14).font('Helvetica-Bold').text('FOND D\'ŒIL');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Dilaté: ${exam.fundus.dilated ? 'Oui' : 'Non'}`);

    ['OD', 'OS'].forEach(eye => {
      const fd = exam.fundus[eye];
      if (fd) {
        doc.font('Helvetica-Bold').text(`${eye}:`);
        doc.font('Helvetica');
        if (fd.disc) doc.text(`  Papille: ${fd.disc}`);
        if (fd.cupToDisc) doc.text(`  C/D: ${fd.cupToDisc}`);
        if (fd.vessels) doc.text(`  Vaisseaux: ${fd.vessels}`);
        if (fd.macula) doc.text(`  Macula: ${fd.macula}`);
        if (fd.periphery) doc.text(`  Périphérie: ${fd.periphery}`);
      }
    });
    doc.moveDown();
  }

  // Assessment
  if (exam.assessment?.diagnoses?.length > 0) {
    doc.fontSize(14).font('Helvetica-Bold').text('DIAGNOSTIC');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    exam.assessment.diagnoses.forEach((d, i) => {
      doc.text(`${i + 1}. ${d.diagnosis} (${d.eye || 'OU'}) - ${d.status || 'N/A'}`);
    });
    if (exam.assessment.summary) {
      doc.moveDown(0.5);
      doc.text(`Résumé: ${exam.assessment.summary}`);
    }
    doc.moveDown();
  }

  // Plan
  if (exam.plan) {
    doc.fontSize(14).font('Helvetica-Bold').text('PLAN DE TRAITEMENT');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');

    if (exam.plan.medications?.length > 0) {
      doc.font('Helvetica-Bold').text('Médicaments:');
      doc.font('Helvetica');
      exam.plan.medications.forEach(med => {
        doc.text(`  • ${med.name} - ${med.dosage} - ${med.frequency}`);
      });
    }

    if (exam.plan.followUp) {
      doc.moveDown(0.5);
      doc.text(`Suivi: ${exam.plan.followUp.timing || exam.plan.followUp}`);
    }
    doc.moveDown();
  }

  // Footer
  doc.moveDown(2);
  doc.fontSize(10).font('Helvetica');
  const examiner = exam.examiner || {};
  doc.text(`Examinateur: Dr. ${examiner.firstName || ''} ${examiner.lastName || ''}`, { align: 'right' });
  doc.text(`N° Licence: ${examiner.licenseNumber || 'N/A'}`, { align: 'right' });
  doc.text(`Date de génération: ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}`, { align: 'right' });

  // Finalize PDF
  doc.end();
});

// =====================================================
// EXAM TEMPLATES
// =====================================================

// @desc    Get exam templates
// @route   GET /api/ophthalmology/templates
// @access  Private
exports.getExamTemplates = asyncHandler(async (req, res, next) => {
  const { examType } = req.query;

  // Predefined templates
  const templates = [
    {
      id: 'routine-eye-exam',
      name: 'Examen de routine',
      nameFr: 'Examen de routine',
      examType: 'comprehensive',
      description: 'Standard comprehensive eye examination',
      sections: ['visualAcuity', 'refraction', 'iop', 'slitLamp', 'fundus'],
      defaultValues: {
        slitLamp: {
          OD: { lids: 'Normal', conjunctiva: 'White and quiet', cornea: 'Clear', anteriorChamber: 'Deep and quiet', iris: 'Normal', lens: 'Clear' },
          OS: { lids: 'Normal', conjunctiva: 'White and quiet', cornea: 'Clear', anteriorChamber: 'Deep and quiet', iris: 'Normal', lens: 'Clear' }
        },
        fundus: {
          dilated: true,
          OD: { disc: 'Pink, sharp margins', cupToDisc: '0.3', vessels: 'Normal caliber', macula: 'Flat, good reflex', periphery: 'Flat, attached' },
          OS: { disc: 'Pink, sharp margins', cupToDisc: '0.3', vessels: 'Normal caliber', macula: 'Flat, good reflex', periphery: 'Flat, attached' }
        }
      }
    },
    {
      id: 'glaucoma-followup',
      name: 'Glaucoma Follow-up',
      nameFr: 'Suivi glaucome',
      examType: 'glaucoma',
      description: 'Glaucoma monitoring examination',
      sections: ['visualAcuity', 'iop', 'visualFields', 'oct', 'gonioscopy', 'fundus'],
      defaultValues: {}
    },
    {
      id: 'cataract-eval',
      name: 'Cataract Evaluation',
      nameFr: 'Évaluation cataracte',
      examType: 'cataract',
      description: 'Pre-operative cataract evaluation',
      sections: ['visualAcuity', 'refraction', 'keratometry', 'biometry', 'slitLamp', 'fundus'],
      defaultValues: {}
    },
    {
      id: 'refraction-only',
      name: 'Refraction Only',
      nameFr: 'Réfraction simple',
      examType: 'refraction',
      description: 'Simple refraction for glasses prescription',
      sections: ['visualAcuity', 'refraction', 'keratometry'],
      defaultValues: {}
    },
    {
      id: 'diabetic-screening',
      name: 'Diabetic Eye Screening',
      nameFr: 'Dépistage rétinopathie diabétique',
      examType: 'screening',
      description: 'Diabetic retinopathy screening',
      sections: ['visualAcuity', 'iop', 'fundus', 'oct'],
      defaultValues: {
        fundus: { dilated: true }
      }
    },
    {
      id: 'pediatric',
      name: 'Pediatric Eye Exam',
      nameFr: 'Examen pédiatrique',
      examType: 'pediatric',
      description: 'Comprehensive pediatric eye examination',
      sections: ['visualAcuity', 'refraction', 'motility', 'slitLamp', 'fundus'],
      defaultValues: {}
    }
  ];

  let filteredTemplates = templates;
  if (examType) {
    filteredTemplates = templates.filter(t => t.examType === examType);
  }

  return success(res, { data: filteredTemplates });
});

// @desc    Apply exam template
// @route   POST /api/ophthalmology/exams/:id/apply-template
// @access  Private
exports.applyTemplate = asyncHandler(async (req, res, next) => {
  const { templateId } = req.body;

  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  // Get template (in production, this would fetch from database)
  const templates = {
    'routine-eye-exam': {
      slitLamp: {
        OD: { lids: 'Normal', conjunctiva: 'White and quiet', cornea: 'Clear', anteriorChamber: 'Deep and quiet', iris: 'Normal', lens: 'Clear' },
        OS: { lids: 'Normal', conjunctiva: 'White and quiet', cornea: 'Clear', anteriorChamber: 'Deep and quiet', iris: 'Normal', lens: 'Clear' }
      },
      fundus: {
        dilated: true,
        OD: { disc: 'Pink, sharp margins', cupToDisc: '0.3', vessels: 'Normal caliber', macula: 'Flat, good reflex', periphery: 'Flat, attached' },
        OS: { disc: 'Pink, sharp margins', cupToDisc: '0.3', vessels: 'Normal caliber', macula: 'Flat, good reflex', periphery: 'Flat, attached' }
      }
    },
    'diabetic-screening': {
      fundus: { dilated: true }
    }
  };

  const template = templates[templateId];

  if (!template) {
    return notFound(res, 'Template');
  }

  // Apply template values
  Object.keys(template).forEach(key => {
    exam[key] = { ...exam[key], ...template[key] };
  });

  exam.templateApplied = templateId;
  exam.updatedBy = req.user.id;
  await exam.save();

  return success(res, { data: exam, message: 'Template applied successfully' });
});
