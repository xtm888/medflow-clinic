const OphthalmologyExam = require('../models/OphthalmologyExam');
const Patient = require('../models/Patient');
const Prescription = require('../models/Prescription');
const Appointment = require('../models/Appointment');
const { Inventory, PharmacyInventory, ContactLensInventory } = require('../models/Inventory');
const Device = require('../models/Device');
const DeviceMeasurement = require('../models/DeviceMeasurement');
const { asyncHandler } = require('../middleware/errorHandler');
const { buildClinicQuery } = require('../middleware/clinicAuth');
const { sanitizeForAssign } = require('../utils/sanitize');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');
const { success, error, notFound, paginated } = require('../utils/apiResponse');
const { findPatientByIdOrCode } = require('../utils/patientLookup');
const { createContextLogger } = require('../utils/structuredLogger');
const ophthalmologyLogger = createContextLogger('Ophthalmology');
const { PAGINATION } = require('../config/constants');

// Clinical alert service for auto-evaluation
let clinicalAlertService;
try {
  clinicalAlertService = require('../services/clinicalAlertService');
} catch (e) {
  ophthalmologyLogger.warn('Clinical alert service not available', { error: e.message });
}

/**
 * CRITICAL: Auto-evaluate clinical alerts after exam data changes
 * This ensures emergency conditions are immediately flagged
 */
async function autoEvaluateAlerts(exam, userId) {
  if (!clinicalAlertService) return { alerts: [], error: 'Service not available' };

  try {
    const patient = await findPatientByIdOrCode(exam.patient);
    if (!patient) return { alerts: [], error: 'Patient not found' };

    // Get previous exam for comparison
    const previousExam = await OphthalmologyExam.findOne({
      patient: exam.patient,
      _id: { $ne: exam._id },
      status: 'completed'
    })
      .sort({ createdAt: -1 })
      .lean();

    // Evaluate and create alerts
    const alerts = await clinicalAlertService.evaluateAndCreateAlerts(
      exam.toObject ? exam.toObject() : exam,
      exam.patient,
      exam._id,
      exam.visit,
      previousExam,
      patient,
      userId
    );

    return {
      alerts,
      hasEmergency: alerts.some(a => a.severity === 'EMERGENCY'),
      hasUrgent: alerts.some(a => a.severity === 'URGENT'),
      count: alerts.length
    };
  } catch (err) {
    ophthalmologyLogger.error('Error auto-evaluating clinical alerts', { error: err.message, stack: err.stack });
    return { alerts: [], error: err.message };
  }
}

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

// ==================== Device Integration Endpoints ====================

// @desc    Get available device measurements for exam
// @route   GET /api/ophthalmology/exams/:id/available-measurements
// @access  Private
exports.getAvailableDeviceMeasurements = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  const measurements = await OphthalmologyExam.getAvailableDeviceMeasurements(
    exam.patient,
    exam.createdAt
  );

  return success(res, { data: measurements });
});

// @desc    Link device measurement to exam
// @route   POST /api/ophthalmology/exams/:id/link-measurement
// @access  Private
exports.linkDeviceMeasurement = asyncHandler(async (req, res, next) => {
  const { measurementId, deviceId } = req.body;

  if (!measurementId || !deviceId) {
    return error(res, 'Measurement ID and Device ID are required');
  }

  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  await exam.linkDeviceMeasurement(measurementId, deviceId, req.user.id);

  return success(res, { data: exam, message: 'Device measurement linked successfully' });
});

// @desc    Apply device measurement to exam fields
// @route   POST /api/ophthalmology/exams/:id/apply-measurement
// @access  Private
exports.applyDeviceMeasurement = asyncHandler(async (req, res, next) => {
  const { measurementId } = req.body;

  if (!measurementId) {
    return error(res, 'Measurement ID is required');
  }

  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  await exam.applyDeviceMeasurement(measurementId, req.user.id);

  return success(res, { data: exam, message: 'Device measurement applied successfully' });
});

// @desc    Link device image to exam
// @route   POST /api/ophthalmology/exams/:id/link-image
// @access  Private
exports.linkDeviceImage = asyncHandler(async (req, res, next) => {
  const { imageId, deviceId } = req.body;

  if (!imageId || !deviceId) {
    return error(res, 'Image ID and Device ID are required');
  }

  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  await exam.linkDeviceImage(imageId, deviceId, req.user.id);

  return success(res, { data: exam, message: 'Device image linked successfully' });
});

// @desc    Get linked device measurements for exam
// @route   GET /api/ophthalmology/exams/:id/device-measurements
// @access  Private
exports.getLinkedDeviceMeasurements = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  const measurements = await exam.getDeviceMeasurements();

  return success(res, { data: measurements });
});

// @desc    Get linked device images for exam
// @route   GET /api/ophthalmology/exams/:id/device-images
// @access  Private
exports.getLinkedDeviceImages = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  const images = await exam.getDeviceImages();

  return success(res, { data: images });
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

// =====================================================
// NEW ENDPOINTS - SPECIALIZED TEST DATA
// =====================================================

// @desc    Save tonometry/IOP data
// @route   PUT /api/ophthalmology/exams/:id/tonometry
// @access  Private
exports.saveTonometryData = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  // Update IOP data
  exam.iop = {
    ...exam.iop,
    ...req.body
  };
  exam.updatedBy = req.user.id;
  await exam.save();

  // Update patient's IOP history for glaucoma monitoring
  const patient = await findPatientByIdOrCode(exam.patient);
  if (patient) {
    if (!patient.ophthalmology.iopHistory) {
      patient.ophthalmology.iopHistory = [];
    }
    patient.ophthalmology.iopHistory.push({
      date: new Date(),
      OD: req.body.OD?.value,
      OS: req.body.OS?.value,
      method: req.body.OD?.method || req.body.OS?.method,
      pachymetryOD: req.body.pachymetry?.OD,
      pachymetryOS: req.body.pachymetry?.OS,
      examId: exam._id
    });
    await patient.save();
  }

  // CRITICAL: Auto-evaluate clinical alerts for IOP values
  // High IOP can indicate acute angle closure glaucoma - an emergency
  const alertResult = await autoEvaluateAlerts(exam, req.user.id);

  return success(res, { data: { iop: exam.iop, alerts: alertResult }, message: 'Tonometry data saved successfully' });
});

// @desc    Save visual acuity data
// @route   PUT /api/ophthalmology/exams/:id/visual-acuity
// @access  Private
exports.saveVisualAcuityData = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  exam.visualAcuity = {
    ...exam.visualAcuity,
    ...req.body
  };
  exam.updatedBy = req.user.id;
  await exam.save();

  return success(res, { data: exam.visualAcuity, message: 'Visual acuity data saved successfully' });
});

// @desc    Save OCT results
// @route   PUT /api/ophthalmology/exams/:id/oct
// @access  Private
exports.saveOCTResults = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  // Update OCT in additional tests
  exam.additionalTests = exam.additionalTests || {};
  exam.additionalTests.oct = {
    ...exam.additionalTests.oct,
    ...req.body,
    performedAt: new Date()
  };
  exam.updatedBy = req.user.id;
  await exam.save();

  return success(res, { data: exam.additionalTests.oct, message: 'OCT results saved successfully' });
});

// @desc    Save visual field results
// @route   PUT /api/ophthalmology/exams/:id/visual-field
// @access  Private
exports.saveVisualFieldResults = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  // Update visual fields
  exam.visualFields = {
    ...exam.visualFields,
    ...req.body
  };

  // Also update additional tests visual field section
  exam.additionalTests = exam.additionalTests || {};
  exam.additionalTests.visualField = {
    performed: true,
    testType: req.body.method || 'humphrey',
    findings: req.body.findings,
    performedAt: new Date()
  };

  exam.updatedBy = req.user.id;
  await exam.save();

  // Update patient's visual field history for glaucoma monitoring
  const patient = await findPatientByIdOrCode(exam.patient);
  if (patient) {
    if (!patient.ophthalmology.visualFieldHistory) {
      patient.ophthalmology.visualFieldHistory = [];
    }
    patient.ophthalmology.visualFieldHistory.push({
      date: new Date(),
      OD: {
        md: req.body.OD?.meanDeviation,
        psd: req.body.OD?.patternStandardDeviation,
        vfi: req.body.OD?.visualFieldIndex,
        defects: req.body.OD?.defects
      },
      OS: {
        md: req.body.OS?.meanDeviation,
        psd: req.body.OS?.patternStandardDeviation,
        vfi: req.body.OS?.visualFieldIndex,
        defects: req.body.OS?.defects
      },
      examId: exam._id
    });
    await patient.save();
  }

  return success(res, { data: exam.visualFields, message: 'Visual field results saved successfully' });
});

// @desc    Save keratometry data
// @route   PUT /api/ophthalmology/exams/:id/keratometry
// @access  Private
exports.saveKeratometryData = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  exam.keratometry = {
    ...exam.keratometry,
    ...req.body
  };
  exam.updatedBy = req.user.id;
  await exam.save();

  return success(res, { data: exam.keratometry, message: 'Keratometry data saved successfully' });
});

// @desc    Save biometry data (for IOL calculation)
// @route   PUT /api/ophthalmology/exams/:id/biometry
// @access  Private
exports.saveBiometryData = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  // Store biometry data
  exam.biometry = {
    ...exam.biometry,
    ...req.body,
    measuredAt: new Date(),
    measuredBy: req.user.id
  };
  exam.updatedBy = req.user.id;
  await exam.save();

  return success(res, { data: exam.biometry, message: 'Biometry data saved successfully' });
});

// @desc    Save slit lamp examination
// @route   PUT /api/ophthalmology/exams/:id/slit-lamp
// @access  Private
exports.saveSlitLampExam = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  exam.slitLamp = {
    ...exam.slitLamp,
    ...req.body
  };
  exam.updatedBy = req.user.id;
  await exam.save();

  return success(res, { data: exam.slitLamp, message: 'Slit lamp examination saved successfully' });
});

// @desc    Save fundoscopy results
// @route   PUT /api/ophthalmology/exams/:id/fundoscopy
// @access  Private
exports.saveFundoscopyResults = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  exam.fundus = {
    ...exam.fundus,
    ...req.body
  };
  exam.updatedBy = req.user.id;
  await exam.save();

  return success(res, { data: exam.fundus, message: 'Fundoscopy results saved successfully' });
});

// @desc    Save diagnosis
// @route   PUT /api/ophthalmology/exams/:id/diagnosis
// @access  Private
exports.saveDiagnosis = asyncHandler(async (req, res, next) => {
  const Visit = require('../models/Visit');
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  exam.assessment = {
    ...exam.assessment,
    diagnoses: req.body.diagnoses || exam.assessment?.diagnoses,
    summary: req.body.summary || exam.assessment?.summary
  };
  exam.updatedBy = req.user.id;
  await exam.save();

  // CRITICAL: Persist diagnoses to Visit.diagnoses for complete medical record
  let visitUpdated = false;
  if (exam.visit && req.body.diagnoses) {
    try {
      const visit = await Visit.findById(exam.visit);
      if (visit) {
        // Convert exam diagnoses format to Visit diagnoses format
        const visitDiagnoses = req.body.diagnoses.map(d => ({
          code: d.icdCode || d.code || 'OPHTH',
          description: d.diagnosis || d.description,
          type: d.type || 'primary',
          laterality: d.eye || d.laterality || 'NA',
          dateOfDiagnosis: new Date(),
          severity: d.severity || d.status,
          notes: d.notes,
          diagnosedBy: req.user.id
        }));

        // Replace existing ophthalmology diagnoses with new ones
        // Keep non-ophthalmology diagnoses if any
        visit.diagnoses = [
          ...visit.diagnoses.filter(d => d.code && !d.code.startsWith('H')), // Non-eye diagnoses
          ...visitDiagnoses
        ];

        await visit.save();
        visitUpdated = true;
      }
    } catch (visitErr) {
      ophthalmologyLogger.error('Error updating Visit diagnoses', { error: visitErr.message, stack: visitErr.stack });
      // Continue - don't fail if visit update fails
    }
  }

  // CRITICAL: Auto-evaluate clinical alerts for diagnoses
  // Some diagnoses may trigger urgent/emergency alerts
  const alertResult = await autoEvaluateAlerts(exam, req.user.id);

  return success(res, {
    assessment: exam.assessment,
    alerts: alertResult,
    visitUpdated
  }, 'Diagnosis saved successfully');
});

// @desc    Import device measurement directly
// @route   POST /api/ophthalmology/exams/:id/import-measurement
// @access  Private
exports.importDeviceMeasurement = asyncHandler(async (req, res, next) => {
  const { deviceType, measurementData } = req.body;

  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  // Map device type to exam field
  const fieldMapping = {
    'autorefractor': 'refraction.objective.autorefractor',
    'keratometer': 'keratometry',
    'tonometer': 'iop',
    'lensmeter': 'currentCorrection.glasses',
    'biometer': 'biometry',
    'oct': 'additionalTests.oct',
    'perimeter': 'visualFields'
  };

  const targetField = fieldMapping[deviceType];

  if (!targetField) {
    return error(res, `Unknown device type: ${deviceType}`);
  }

  // Set the value at the nested path
  const setNestedValue = (obj, path, value) => {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    Object.assign(current[keys[keys.length - 1]] || {}, value);
    current[keys[keys.length - 1]] = { ...current[keys[keys.length - 1]], ...value };
  };

  setNestedValue(exam, targetField, measurementData);

  // Record import
  exam.deviceMeasurements = exam.deviceMeasurements || [];
  exam.deviceMeasurements.push({
    deviceType,
    importedAt: new Date(),
    importedBy: req.user.id,
    data: measurementData
  });

  exam.updatedBy = req.user.id;
  await exam.save();

  // CRITICAL: Check if visit is already completed - notify provider of late device data
  let lateDataNotification = null;
  if (exam.visit) {
    try {
      const Visit = require('../models/Visit');
      const Alert = require('../models/Alert');
      const visit = await Visit.findById(exam.visit)
        .populate('primaryProvider', 'firstName lastName')
        .populate('patient', 'firstName lastName patientId');

      if (visit && visit.status === 'completed') {
        // Visit is already completed - create notification for late device data
        const patientName = visit.patient
          ? `${visit.patient.firstName} ${visit.patient.lastName}`
          : 'Patient inconnu';

        const alert = await Alert.create({
          category: 'clinical',
          priority: 'medium',
          title: 'Donnees dispositif arrivees apres visite',
          message: `Nouvelles donnees ${deviceType.toUpperCase()} pour ${patientName} (Visite ${visit.visitId}) - La visite est deja terminee. Veuillez revoir les resultats.`,
          targetUsers: visit.primaryProvider ? [visit.primaryProvider._id] : [],
          targetRoles: ['ophthalmologist', 'optometrist'],
          metadata: {
            visitId: visit._id.toString(),
            visitNumber: visit.visitId,
            patientId: visit.patient?._id?.toString(),
            patientName,
            deviceType,
            examId: exam._id.toString(),
            type: 'late_device_data'
          },
          requiresAcknowledgment: true
        });

        lateDataNotification = {
          sent: true,
          alertId: alert._id,
          message: `Notification envoyee: donnees ${deviceType} arrivees apres la fin de la visite`
        };

        ophthalmologyLogger.info('Late data notification created for visit', { visitId: visit.visitId, deviceType });
      }
    } catch (notifyError) {
      ophthalmologyLogger.error('Error creating late data notification', { error: notifyError.message });
    }
  }

  return success(res, { exam, lateDataNotification }, `${deviceType} measurement imported successfully`);
});

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
