/**
 * Ophthalmology Core Controller
 *
 * Handles CRUD operations, prescription, refraction, and dashboard stats.
 */

const {
  OphthalmologyExam,
  Patient,
  Prescription,
  Appointment,
  PharmacyInventory,
  Device,
  asyncHandler,
  buildClinicQuery,
  sanitizeForAssign,
  success,
  error,
  notFound,
  paginated,
  findPatientByIdOrCode,
  ophthalmologyLogger,
  autoEvaluateAlerts
} = require('./shared');

// @desc    Get all exams
// @route   GET /api/ophthalmology/exams
// @access  Private
// MULTI-CLINIC: Exams filtered by current clinic context
exports.getExams = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    patient,
    examiner,
    examType,
    status,
    dateFrom,
    dateTo,
    sort = '-createdAt',
    allClinics = false // Allow fetching patient history across clinics
  } = req.query;

  // MULTI-CLINIC: Start with clinic-filtered query
  const query = (allClinics === 'true' && patient) ? {} : buildClinicQuery(req, {});

  if (patient) query.patient = patient;
  if (examiner) query.examiner = examiner;
  if (examType) query.examType = examType;
  if (status) query.status = status;

  // Date range filter
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  // Role-based filtering
  if (req.user.role === 'ophthalmologist') {
    query.examiner = req.user.id;
  }

  const exams = await OphthalmologyExam.find(query)
    .populate('clinic', 'clinicId name shortName')
    .populate('patient', 'firstName lastName patientId dateOfBirth')
    .populate('examiner', 'firstName lastName')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort(sort);

  const count = await OphthalmologyExam.countDocuments(query);

  return paginated(res, exams, count, parseInt(page), parseInt(limit));
});

// @desc    Get single exam
// @route   GET /api/ophthalmology/exams/:id
// @access  Private
exports.getExam = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id)
    .populate('patient')
    .populate('examiner', 'firstName lastName licenseNumber')
    .populate('appointment')
    .populate('plan.prescriptions');

  if (!exam) {
    return notFound(res, 'Exam');
  }

  return success(res, { data: exam });
});

// @desc    Create new exam
// @route   POST /api/ophthalmology/exams
// @access  Private (Ophthalmologist, Doctor)
// MULTI-CLINIC: Exam is created for the current clinic context
exports.createExam = asyncHandler(async (req, res, next) => {
  // MULTI-CLINIC: Determine clinic context
  let clinicId = req.clinicId;

  // Validate patient exists first (we need it for clinic fallback)
  const patient = await findPatientByIdOrCode(req.body.patient);
  if (!patient) {
    return notFound(res, 'Patient');
  }

  // If admin in "All Clinics" mode, try to get clinic from patient
  if (!clinicId && req.accessAllClinics) {
    if (patient.homeClinic) {
      clinicId = patient.homeClinic;
    } else if (req.user.primaryClinic) {
      // Fallback to admin's primary clinic
      clinicId = req.user.primaryClinic;
    }
  }

  if (!clinicId) {
    return error(res, 'Please select a specific clinic before creating an exam, or ensure the patient has a home clinic assigned.');
  }

  req.body.clinic = clinicId; // MULTI-CLINIC: Assign clinic
  req.body.examiner = req.user.id;
  req.body.createdBy = req.user.id;

  const exam = await OphthalmologyExam.create(req.body);

  // Update patient's last eye exam date
  patient.ophthalmology.lastEyeExam = Date.now();
  await patient.save();

  // Populate for response
  await exam.populate('clinic', 'clinicId name shortName');
  await exam.populate('patient', 'firstName lastName patientId');
  await exam.populate('examiner', 'firstName lastName');

  return success(res, { data: exam, statusCode: 201 });
});

// @desc    Update exam
// @route   PUT /api/ophthalmology/exams/:id
// @access  Private (Ophthalmologist, Doctor)
exports.updateExam = asyncHandler(async (req, res, next) => {
  req.body.updatedBy = req.user.id;

  // Prevent updating certain fields
  delete req.body.examId;
  delete req.body.examiner;
  delete req.body.createdAt;

  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  // Check if user is the examiner
  if (exam.examiner.toString() !== req.user.id && req.user.role !== 'admin') {
    return error(res, 'You can only update your own examinations', 403);
  }

  Object.assign(exam, sanitizeForAssign(req.body));
  await exam.save();

  return success(res, { data: exam });
});

// @desc    Complete exam
// @route   PUT /api/ophthalmology/exams/:id/complete
// @access  Private (Ophthalmologist, Doctor)
exports.completeExam = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  exam.status = 'completed';
  exam.completedAt = Date.now();
  exam.updatedBy = req.user.id;

  await exam.save();

  // CRITICAL: Final alert evaluation on exam completion
  // Ensures all clinical alerts are generated before patient leaves
  const alertResult = await autoEvaluateAlerts(exam, req.user.id);

  return success(res, { data: { exam, alerts: alertResult }, message: 'Exam completed successfully' });
});

// @desc    Delete exam
// @route   DELETE /api/ophthalmology/exams/:id
// @access  Private (Admin only)
exports.deleteExam = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Examen');
  }

  // Only allow deletion of draft or cancelled exams
  if (exam.status === 'completed') {
    return error(res, 'Impossible de supprimer un examen terminé. Annulez-le d\'abord.');
  }

  // Check if exam has associated prescriptions
  const prescriptionCount = await Prescription.countDocuments({ ophthalmologyExam: exam._id });
  if (prescriptionCount > 0) {
    return error(res, `Cet examen a ${prescriptionCount} ordonnance(s) associée(s). Supprimez-les d'abord.`);
  }

  await exam.deleteOne();

  return success(res, {}, 'Examen supprimé avec succès');
});

// @desc    Generate optical prescription from exam
// @route   POST /api/ophthalmology/exams/:id/prescription
// @access  Private (Ophthalmologist, Doctor)
exports.generateOpticalPrescription = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  if (!exam.refraction.finalPrescription) {
    return error(res, 'Final prescription not available in exam');
  }

  // Generate prescription from exam
  const prescription = await exam.generatePrescription();

  return success(res, { data: prescription, message: 'Optical prescription generated successfully', statusCode: 201 });
});

// @desc    Save refraction data
// @route   PUT /api/ophthalmology/exams/:id/refraction
// @access  Private (Ophthalmologist, Doctor)
exports.saveRefractionData = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  // Update refraction data
  exam.refraction = {
    ...exam.refraction,
    ...req.body
  };

  exam.updatedBy = req.user.id;
  await exam.save();

  // Update patient's current correction if final prescription is provided
  if (req.body.finalPrescription) {
    const patient = await findPatientByIdOrCode(exam.patient);
    patient.ophthalmology.visualAcuity = {
      OD: {
        distance: req.body.finalPrescription.OD.va,
        near: patient.ophthalmology.visualAcuity?.OD?.near
      },
      OS: {
        distance: req.body.finalPrescription.OS.va,
        near: patient.ophthalmology.visualAcuity?.OS?.near
      }
    };
    await patient.save();
  }

  return success(res, { data: exam.refraction, message: 'Refraction data saved successfully' });
});

// @desc    Get patient exam history
// @route   GET /api/ophthalmology/patients/:patientId/history
// @access  Private
exports.getPatientExamHistory = asyncHandler(async (req, res, next) => {
  const exams = await OphthalmologyExam.find({ patient: req.params.patientId })
    .populate('examiner', 'firstName lastName')
    .sort('-createdAt');

  const patient = await findPatientByIdOrCode(req.params.patientId);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  return success(res, {
    data: {
      exams,
      currentPrescription: patient.ophthalmology.currentPrescription,
      lastEyeExam: patient.ophthalmology.lastEyeExam,
      eyeConditions: patient.ophthalmology.eyeConditions,
      surgicalHistory: patient.ophthalmology.surgicalHistory
    }
  });
});

// @desc    Upload fundus image
// @route   POST /api/ophthalmology/exams/:id/fundus-image
// @access  Private (Ophthalmologist, Doctor)
exports.uploadFundusImage = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  // In production, this would handle actual image upload to cloud storage
  const image = {
    type: req.body.type || 'fundus',
    eye: req.body.eye, // OD, OS, or OU
    url: req.body.url, // This would be generated after upload
    caption: req.body.caption,
    takenAt: Date.now()
  };

  exam.images.push(image);
  await exam.save();

  return success(res, { data: image, message: 'Fundus image uploaded successfully' });
});

// @desc    Get patient's refraction history
// @route   GET /api/ophthalmology/patients/:patientId/refraction-history
// @access  Private
exports.getRefractionHistory = asyncHandler(async (req, res, next) => {
  const { limit = 20 } = req.query;

  const exams = await OphthalmologyExam.getRefractionHistory(
    req.params.patientId,
    parseInt(limit)
  );

  if (exams.length === 0) {
    return success(res, { data: [], message: 'No refraction history found for this patient' });
  }

  return success(res, { data: exams });
});

// @desc    Copy from previous refraction exam
// @route   POST /api/ophthalmology/patients/:patientId/copy-previous-refraction
// @access  Private (Ophthalmologist, Doctor)
exports.copyFromPreviousRefraction = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.patientId);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const newExam = await OphthalmologyExam.copyFromPrevious(
    req.params.patientId,
    req.user.id
  );

  if (!newExam) {
    return notFound(res, 'Previous refraction exam');
  }

  await newExam.save();

  // Populate for response
  await newExam.populate('patient', 'firstName lastName patientId');
  await newExam.populate('examiner', 'firstName lastName');
  await newExam.populate('copiedFrom', 'examId createdAt');

  return success(res, { data: newExam, message: 'Refraction exam copied from previous successfully', statusCode: 201 });
});

// @desc    Create blank refraction exam
// @route   POST /api/ophthalmology/patients/:patientId/blank-refraction
// @access  Private (Ophthalmologist, Doctor)
exports.createBlankRefraction = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.patientId);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const exam = await OphthalmologyExam.create({
    patient: req.params.patientId,
    examiner: req.user.id,
    createdBy: req.user.id,
    examType: 'refraction',
    status: 'in-progress', // Use hyphen for consistency
    // Initialize empty refraction structure
    refraction: {
      objective: {
        autorefractor: { OD: {}, OS: {} },
        retinoscopy: { OD: {}, OS: {} }
      },
      subjective: { OD: {}, OS: {} },
      finalPrescription: {
        OD: {},
        OS: {},
        prescriptionStatus: {
          status: 'pending'
        }
      }
    },
    visualAcuity: {
      distance: { OD: {}, OS: {} },
      near: { OD: {}, OS: {} }
    },
    currentCorrection: {
      glasses: { OD: {}, OS: {} },
      contactLenses: { OD: {}, OS: {} }
    },
    keratometry: { OD: {}, OS: {} },
    iop: { OD: {}, OS: {} }
  });

  // Populate for response
  await exam.populate('patient', 'firstName lastName patientId');
  await exam.populate('examiner', 'firstName lastName');

  // Update patient's last eye exam date
  patient.ophthalmology.lastEyeExam = Date.now();
  await patient.save();

  return success(res, { data: exam, message: 'Blank refraction exam created successfully', statusCode: 201 });
});

// @desc    Generate refraction summary
// @route   POST /api/ophthalmology/exams/:id/generate-refraction-summary
// @access  Private (Ophthalmologist, Doctor)
exports.generateRefractionSummary = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  const summary = exam.generateRefractionSummary();

  if (!summary) {
    return error(res, 'Cannot generate summary - refraction data is incomplete');
  }

  exam.summaries.refraction.generatedBy = req.user.id;
  await exam.save();

  return success(res, {
    data: {
      summary,
      generatedAt: exam.summaries.refraction.generatedAt
    },
    message: 'Refraction summary generated successfully'
  });
});

// @desc    Generate keratometry summary
// @route   POST /api/ophthalmology/exams/:id/generate-keratometry-summary
// @access  Private (Ophthalmologist, Doctor)
exports.generateKeratometrySummary = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  const summary = exam.generateKeratometrySummary();

  if (!summary) {
    return error(res, 'Cannot generate summary - keratometry data is incomplete');
  }

  exam.summaries.keratometry.generatedBy = req.user.id;
  await exam.save();

  return success(res, {
    summary,
    generatedAt: exam.summaries.keratometry.generatedAt
  }, 'Keratometry summary generated successfully');
});

// @desc    Mark prescription as printed
// @route   PUT /api/ophthalmology/exams/:id/mark-printed
// @access  Private (Ophthalmologist, Doctor)
exports.markPrescriptionPrinted = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  exam.markPrescriptionPrinted();
  await exam.save();

  return success(res, {
    printedAt: exam.refraction.finalPrescription.prescriptionStatus.printedAt
  }, 'Prescription marked as printed');
});

// @desc    Mark prescription as viewed
// @route   PUT /api/ophthalmology/exams/:id/mark-viewed
// @access  Private (Ophthalmologist, Doctor)
exports.markPrescriptionViewed = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  exam.markPrescriptionViewed();
  await exam.save();

  return success(res, {
    data: { viewedAt: exam.refraction.finalPrescription.prescriptionStatus.viewedAt },
    message: 'Prescription marked as viewed'
  });
});

// @desc    Get ophthalmology dashboard stats
// @route   GET /api/ophthalmology/dashboard-stats
// @access  Private
exports.getDashboardStats = asyncHandler(async (req, res, next) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  // Get exam counts
  const [todayExams, weeklyExams, pendingExams] = await Promise.all([
    OphthalmologyExam.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    }),
    OphthalmologyExam.countDocuments({
      createdAt: { $gte: weekStart }
    }),
    OphthalmologyExam.countDocuments({
      status: { $in: ['in-progress', 'pending'] }
    })
  ]);

  // Get recent exams for today with patient details
  const recentExams = await OphthalmologyExam.find({
    createdAt: { $gte: today }
  })
    .populate('patient', 'firstName lastName patientId')
    .populate('examiner', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const formattedRecentExams = recentExams.map(exam => ({
    id: exam._id,
    patient: exam.patient ? `${exam.patient.firstName} ${exam.patient.lastName}` : 'Patient inconnu',
    patientId: exam.patient?.patientId,
    time: new Date(exam.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    type: exam.examType || 'Réfraction',
    status: exam.status,
    doctor: exam.examiner ? `Dr. ${exam.examiner.lastName}` : 'N/A'
  }));

  // Get today's appointments for ophthalmology
  const todayAppointments = await Appointment.find({
    date: { $gte: today, $lt: tomorrow },
    department: { $in: ['ophthalmology', 'ophtalmologie', 'Ophtalmologie'] }
  })
    .populate('patient', 'firstName lastName')
    .populate('provider', 'firstName lastName')
    .sort({ time: 1 })
    .lean();

  const formattedAppointments = todayAppointments.map(apt => ({
    id: apt._id,
    time: apt.time || '00:00',
    patient: apt.patient ? `${apt.patient.firstName} ${apt.patient.lastName}` : 'Patient inconnu',
    type: apt.type || apt.reason || 'Consultation',
    status: apt.status
  }));

  // Get diagnosis distribution from recent exams (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const diagnosisAgg = await OphthalmologyExam.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { $unwind: { path: '$assessment.diagnoses', preserveNullAndEmptyArrays: false } },
    { $group: { _id: '$assessment.diagnoses.diagnosis', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 6 }
  ]);

  const diagnosisColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#6b7280'];
  const diagnoses = diagnosisAgg.map((d, i) => ({
    name: d._id || 'Autre',
    count: d.count,
    color: diagnosisColors[i] || '#6b7280'
  }));

  // If no diagnoses found, provide default categories
  if (diagnoses.length === 0) {
    diagnoses.push(
      { name: 'Myopie', count: 0, color: '#3b82f6' },
      { name: 'Hypermétropie', count: 0, color: '#10b981' },
      { name: 'Astigmatisme', count: 0, color: '#f59e0b' },
      { name: 'Presbytie', count: 0, color: '#8b5cf6' }
    );
  }

  // Get low stock ophthalmic medications
  const lowStockMeds = await PharmacyInventory.countDocuments({
    'inventory.currentStock': { $lte: 10 },
    'medication.category': { $in: ['Collyres', 'COLLYRES', 'ophtalmologie', 'eye drops', 'ANTI GLAUCOMATEUX', 'MYDRIATIQUES', 'LARMES ARTIFICIELLES'] }
  });

  // Get equipment status
  const equipment = await Device.find({
    category: { $in: ['ophthalmology', 'ophtalmologie', 'diagnostic'] }
  })
    .select('name status lastMaintenance')
    .limit(5)
    .lean();

  const equipmentStatus = equipment.map(eq => ({
    name: eq.name,
    status: eq.status || 'operational',
    lastService: eq.lastMaintenance || null
  }));

  // Default equipment if none found
  if (equipmentStatus.length === 0) {
    equipmentStatus.push(
      { name: 'Autorefractor', status: 'operational', lastService: null },
      { name: 'Lampe à Fente', status: 'operational', lastService: null },
      { name: 'Tonomètre', status: 'operational', lastService: null }
    );
  }

  // Get queue count - patients waiting/checked-in for ophthalmology today
  const queueCount = await Appointment.countDocuments({
    date: { $gte: today, $lt: tomorrow },
    status: { $in: ['checked-in', 'waiting', 'in-progress'] },
    department: { $in: ['ophthalmology', 'ophtalmologie', 'Ophtalmologie'] }
  });

  return success(res, {
    todayExams,
    weeklyExams,
    pendingReports: pendingExams,
    lowStockMeds,
    recentExams: formattedRecentExams,
    upcomingAppointments: formattedAppointments,
    diagnoses,
    equipmentStatus,
    queueCount
  });
});

// @desc    Complete consultation with all integrations (lab orders, prescriptions, invoice)
// @route   POST /api/ophthalmology/consultations/:visitId/complete
// @access  Private (doctor, ophthalmologist)
// MULTI-CLINIC: Uses current clinic context
exports.completeConsultation = asyncHandler(async (req, res, next) => {
  const { visitId } = req.params;
  const {
    examId,
    examData,
    options = {}
  } = req.body;

  // Validate required fields
  if (!examData) {
    return error(res, 'Les données de consultation sont requises', 400);
  }

  // Get visit to extract patient and clinic
  const Visit = require('../../models/Visit');
  const Patient = require('../../models/Patient');
  const visit = await Visit.findById(visitId);
  if (!visit) {
    return notFound(res, 'Visite non trouvée');
  }

  // MULTI-CLINIC: Resolve clinic ID with fallback chain
  let clinicId = req.clinicId || visit.clinic?.toString();
  if (!clinicId) {
    // Fallback to patient's homeClinic if visit doesn't have clinic
    const patient = await Patient.findById(visit.patient).select('homeClinic clinic');
    clinicId = patient?.homeClinic?.toString() || patient?.clinic?.toString();
  }

  if (!clinicId) {
    return error(res, 'Impossible de déterminer la clinique pour cette consultation', 400);
  }

  // Use consultation completion service
  const consultationCompletionService = require('../../services/consultationCompletionService');

  const result = await consultationCompletionService.completeConsultation({
    examId: examId || visit.ophthalmologyExam,
    patientId: visit.patient.toString(),
    visitId: visitId,
    clinicId,
    userId: req.user._id.toString(),
    examData,
    options
  });

  if (!result.success) {
    return error(res, result.error || 'Échec de la complétion de la consultation', 500);
  }

  // Log the action
  ophthalmologyLogger.info('Consultation completed with full integration', {
    visitId,
    examId: result.data.exam?._id,
    labOrderCount: result.data.labOrders?.length || 0,
    prescriptionCount: result.data.prescriptions?.length || 0,
    invoiceId: result.data.invoice?._id,
    userId: req.user._id
  });

  return success(res, { data: result.data, message: 'Consultation complétée avec succès' });
});

// @desc    Save exam data (create or update)
// @route   POST /api/ophthalmology/exams/save
// @access  Private
// MULTI-CLINIC: Uses current clinic context
exports.saveExam = asyncHandler(async (req, res, next) => {
  const { patientId, visitId, examId, data } = req.body;

  if (!patientId) {
    return error(res, 'Patient ID requis', 400);
  }

  const examPayload = {
    patient: patientId,
    visit: visitId,
    clinic: req.clinicId,
    examiner: req.user._id,
    ...sanitizeForAssign(data),
    updatedAt: new Date()
  };

  let exam;
  if (examId) {
    // Update existing exam
    exam = await OphthalmologyExam.findByIdAndUpdate(
      examId,
      { $set: examPayload },
      { new: true, runValidators: true }
    );
    if (!exam) {
      return notFound(res, 'Examen non trouvé');
    }
  } else {
    // Create new exam
    exam = await OphthalmologyExam.create(examPayload);
  }

  // Auto-evaluate clinical alerts if diagnoses present
  if (data.diagnostic?.diagnoses?.length > 0) {
    autoEvaluateAlerts(exam, data.diagnostic.diagnoses).catch(err => {
      ophthalmologyLogger.warn('Alert evaluation failed', { error: err.message });
    });
  }

  return success(res, exam, examId ? 'Examen mis à jour' : 'Examen créé');
});
