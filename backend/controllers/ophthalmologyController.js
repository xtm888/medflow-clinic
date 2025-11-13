const OphthalmologyExam = require('../models/OphthalmologyExam');
const Patient = require('../models/Patient');
const Prescription = require('../models/Prescription');
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