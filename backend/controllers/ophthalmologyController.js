const OphthalmologyExam = require('../models/OphthalmologyExam');
const Patient = require('../models/Patient');
const Prescription = require('../models/Prescription');
const Appointment = require('../models/Appointment');
const PharmacyInventory = require('../models/PharmacyInventory');
const Device = require('../models/Device');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Get all exams
// @route   GET /api/ophthalmology/exams
// @access  Private
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
    sort = '-createdAt'
  } = req.query;

  const query = {};

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
    .populate('patient', 'firstName lastName patientId dateOfBirth')
    .populate('examiner', 'firstName lastName')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort(sort);

  const count = await OphthalmologyExam.countDocuments(query);

  res.status(200).json({
    success: true,
    count: exams.length,
    total: count,
    pages: Math.ceil(count / limit),
    currentPage: parseInt(page),
    data: exams
  });
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
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }

  res.status(200).json({
    success: true,
    data: exam
  });
});

// @desc    Create new exam
// @route   POST /api/ophthalmology/exams
// @access  Private (Ophthalmologist, Doctor)
exports.createExam = asyncHandler(async (req, res, next) => {
  req.body.examiner = req.user.id;
  req.body.createdBy = req.user.id;

  // Validate patient exists
  const patient = await Patient.findById(req.body.patient);
  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  const exam = await OphthalmologyExam.create(req.body);

  // Update patient's last eye exam date
  patient.ophthalmology.lastEyeExam = Date.now();
  await patient.save();

  // Populate for response
  await exam.populate('patient', 'firstName lastName patientId');
  await exam.populate('examiner', 'firstName lastName');

  res.status(201).json({
    success: true,
    data: exam
  });
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
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }

  // Check if user is the examiner
  if (exam.examiner.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'You can only update your own examinations'
    });
  }

  Object.assign(exam, req.body);
  await exam.save();

  res.status(200).json({
    success: true,
    data: exam
  });
});

// @desc    Complete exam
// @route   PUT /api/ophthalmology/exams/:id/complete
// @access  Private (Ophthalmologist, Doctor)
exports.completeExam = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }

  exam.status = 'completed';
  exam.completedAt = Date.now();
  exam.updatedBy = req.user.id;

  await exam.save();

  res.status(200).json({
    success: true,
    message: 'Exam completed successfully',
    data: exam
  });
});

// @desc    Generate optical prescription from exam
// @route   POST /api/ophthalmology/exams/:id/prescription
// @access  Private (Ophthalmologist, Doctor)
exports.generateOpticalPrescription = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }

  if (!exam.refraction.finalPrescription) {
    return res.status(400).json({
      success: false,
      error: 'Final prescription not available in exam'
    });
  }

  // Generate prescription from exam
  const prescription = await exam.generatePrescription();

  res.status(201).json({
    success: true,
    message: 'Optical prescription generated successfully',
    data: prescription
  });
});

// @desc    Save refraction data
// @route   PUT /api/ophthalmology/exams/:id/refraction
// @access  Private (Ophthalmologist, Doctor)
exports.saveRefractionData = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
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
    const patient = await Patient.findById(exam.patient);
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

  res.status(200).json({
    success: true,
    message: 'Refraction data saved successfully',
    data: exam.refraction
  });
});

// @desc    Get patient exam history
// @route   GET /api/ophthalmology/patients/:patientId/history
// @access  Private
exports.getPatientExamHistory = asyncHandler(async (req, res, next) => {
  const exams = await OphthalmologyExam.find({ patient: req.params.patientId })
    .populate('examiner', 'firstName lastName')
    .sort('-createdAt');

  const patient = await Patient.findById(req.params.patientId)
    .select('ophthalmology');

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  res.status(200).json({
    success: true,
    count: exams.length,
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
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
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

  res.status(200).json({
    success: true,
    message: 'Fundus image uploaded successfully',
    data: image
  });
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
    return res.status(200).json({
      success: true,
      count: 0,
      data: [],
      message: 'No refraction history found for this patient'
    });
  }

  res.status(200).json({
    success: true,
    count: exams.length,
    data: exams
  });
});

// @desc    Copy from previous refraction exam
// @route   POST /api/ophthalmology/patients/:patientId/copy-previous-refraction
// @access  Private (Ophthalmologist, Doctor)
exports.copyFromPreviousRefraction = asyncHandler(async (req, res, next) => {
  const patient = await Patient.findById(req.params.patientId);

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  const newExam = await OphthalmologyExam.copyFromPrevious(
    req.params.patientId,
    req.user.id
  );

  if (!newExam) {
    return res.status(404).json({
      success: false,
      error: 'No previous refraction exam found to copy from'
    });
  }

  await newExam.save();

  // Populate for response
  await newExam.populate('patient', 'firstName lastName patientId');
  await newExam.populate('examiner', 'firstName lastName');
  await newExam.populate('copiedFrom', 'examId createdAt');

  res.status(201).json({
    success: true,
    message: 'Refraction exam copied from previous successfully',
    data: newExam
  });
});

// @desc    Create blank refraction exam
// @route   POST /api/ophthalmology/patients/:patientId/blank-refraction
// @access  Private (Ophthalmologist, Doctor)
exports.createBlankRefraction = asyncHandler(async (req, res, next) => {
  const patient = await Patient.findById(req.params.patientId);

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
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

  res.status(201).json({
    success: true,
    message: 'Blank refraction exam created successfully',
    data: exam
  });
});

// @desc    Generate refraction summary
// @route   POST /api/ophthalmology/exams/:id/generate-refraction-summary
// @access  Private (Ophthalmologist, Doctor)
exports.generateRefractionSummary = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }

  const summary = exam.generateRefractionSummary();

  if (!summary) {
    return res.status(400).json({
      success: false,
      error: 'Cannot generate summary - refraction data is incomplete'
    });
  }

  exam.summaries.refraction.generatedBy = req.user.id;
  await exam.save();

  res.status(200).json({
    success: true,
    message: 'Refraction summary generated successfully',
    data: {
      summary,
      generatedAt: exam.summaries.refraction.generatedAt
    }
  });
});

// @desc    Generate keratometry summary
// @route   POST /api/ophthalmology/exams/:id/generate-keratometry-summary
// @access  Private (Ophthalmologist, Doctor)
exports.generateKeratometrySummary = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }

  const summary = exam.generateKeratometrySummary();

  if (!summary) {
    return res.status(400).json({
      success: false,
      error: 'Cannot generate summary - keratometry data is incomplete'
    });
  }

  exam.summaries.keratometry.generatedBy = req.user.id;
  await exam.save();

  res.status(200).json({
    success: true,
    message: 'Keratometry summary generated successfully',
    data: {
      summary,
      generatedAt: exam.summaries.keratometry.generatedAt
    }
  });
});

// @desc    Mark prescription as printed
// @route   PUT /api/ophthalmology/exams/:id/mark-printed
// @access  Private (Ophthalmologist, Doctor)
exports.markPrescriptionPrinted = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }

  exam.markPrescriptionPrinted();
  await exam.save();

  res.status(200).json({
    success: true,
    message: 'Prescription marked as printed',
    data: {
      printedAt: exam.refraction.finalPrescription.prescriptionStatus.printedAt
    }
  });
});

// @desc    Mark prescription as viewed
// @route   PUT /api/ophthalmology/exams/:id/mark-viewed
// @access  Private (Ophthalmologist, Doctor)
exports.markPrescriptionViewed = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }

  exam.markPrescriptionViewed();
  await exam.save();

  res.status(200).json({
    success: true,
    message: 'Prescription marked as viewed',
    data: {
      viewedAt: exam.refraction.finalPrescription.prescriptionStatus.viewedAt
    }
  });
});

// ==================== Device Integration Endpoints ====================

// @desc    Get available device measurements for exam
// @route   GET /api/ophthalmology/exams/:id/available-measurements
// @access  Private
exports.getAvailableDeviceMeasurements = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }

  const measurements = await OphthalmologyExam.getAvailableDeviceMeasurements(
    exam.patient,
    exam.createdAt
  );

  res.status(200).json({
    success: true,
    count: measurements.length,
    data: measurements
  });
});

// @desc    Link device measurement to exam
// @route   POST /api/ophthalmology/exams/:id/link-measurement
// @access  Private
exports.linkDeviceMeasurement = asyncHandler(async (req, res, next) => {
  const { measurementId, deviceId } = req.body;

  if (!measurementId || !deviceId) {
    return res.status(400).json({
      success: false,
      error: 'Measurement ID and Device ID are required'
    });
  }

  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }

  await exam.linkDeviceMeasurement(measurementId, deviceId, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Device measurement linked successfully',
    data: exam
  });
});

// @desc    Apply device measurement to exam fields
// @route   POST /api/ophthalmology/exams/:id/apply-measurement
// @access  Private
exports.applyDeviceMeasurement = asyncHandler(async (req, res, next) => {
  const { measurementId } = req.body;

  if (!measurementId) {
    return res.status(400).json({
      success: false,
      error: 'Measurement ID is required'
    });
  }

  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }

  await exam.applyDeviceMeasurement(measurementId, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Device measurement applied successfully',
    data: exam
  });
});

// @desc    Link device image to exam
// @route   POST /api/ophthalmology/exams/:id/link-image
// @access  Private
exports.linkDeviceImage = asyncHandler(async (req, res, next) => {
  const { imageId, deviceId } = req.body;

  if (!imageId || !deviceId) {
    return res.status(400).json({
      success: false,
      error: 'Image ID and Device ID are required'
    });
  }

  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }

  await exam.linkDeviceImage(imageId, deviceId, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Device image linked successfully',
    data: exam
  });
});

// @desc    Get linked device measurements for exam
// @route   GET /api/ophthalmology/exams/:id/device-measurements
// @access  Private
exports.getLinkedDeviceMeasurements = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }

  const measurements = await exam.getDeviceMeasurements();

  res.status(200).json({
    success: true,
    count: measurements.length,
    data: measurements
  });
});

// @desc    Get linked device images for exam
// @route   GET /api/ophthalmology/exams/:id/device-images
// @access  Private
exports.getLinkedDeviceImages = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return res.status(404).json({
      success: false,
      error: 'Exam not found'
    });
  }

  const images = await exam.getDeviceImages();

  res.status(200).json({
    success: true,
    count: images.length,
    data: images
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

  res.status(200).json({
    success: true,
    data: {
      todayExams,
      weeklyExams,
      pendingReports: pendingExams,
      lowStockMeds,
      recentExams: formattedRecentExams,
      upcomingAppointments: formattedAppointments,
      diagnoses,
      equipmentStatus,
      queueCount
    }
  });
});