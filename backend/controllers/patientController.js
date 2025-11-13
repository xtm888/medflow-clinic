const Patient = require('../models/Patient');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Get all patients
// @route   GET /api/patients
// @access  Private
exports.getPatients = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    search,
    status = 'active',
    sort = '-createdAt'
  } = req.query;

  const query = {};

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Search functionality
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { patientId: { $regex: search, $options: 'i' } },
      { phoneNumber: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const patients = await Patient.find(query)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort(sort)
    .select('-medicalHistory.socialHistory');

  const count = await Patient.countDocuments(query);

  res.status(200).json({
    success: true,
    count: patients.length,
    total: count,
    pages: Math.ceil(count / limit),
    currentPage: parseInt(page),
    data: patients
  });
});

// @desc    Get single patient
// @route   GET /api/patients/:id
// @access  Private
exports.getPatient = asyncHandler(async (req, res, next) => {
  const patient = await Patient.findById(req.params.id)
    .populate('appointments', 'date type status provider')
    .populate('prescriptions', 'dateIssued type status medications')
    .populate('createdBy updatedBy', 'firstName lastName');

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  res.status(200).json({
    success: true,
    data: patient
  });
});

// @desc    Create new patient
// @route   POST /api/patients
// @access  Private (Admin, Receptionist, Nurse)
exports.createPatient = asyncHandler(async (req, res, next) => {
  req.body.createdBy = req.user.id;

  const patient = await Patient.create(req.body);

  res.status(201).json({
    success: true,
    data: patient
  });
});

// @desc    Update patient
// @route   PUT /api/patients/:id
// @access  Private (Admin, Doctor, Nurse)
exports.updatePatient = asyncHandler(async (req, res, next) => {
  req.body.updatedBy = req.user.id;

  // Prevent updating certain fields
  delete req.body.patientId;
  delete req.body.createdAt;
  delete req.body.createdBy;

  const patient = await Patient.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  res.status(200).json({
    success: true,
    data: patient
  });
});

// @desc    Delete patient (soft delete)
// @route   DELETE /api/patients/:id
// @access  Private (Admin only)
exports.deletePatient = asyncHandler(async (req, res, next) => {
  const patient = await Patient.findById(req.params.id);

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  // Soft delete - change status to inactive
  patient.status = 'inactive';
  patient.updatedBy = req.user.id;
  await patient.save();

  res.status(200).json({
    success: true,
    message: 'Patient deactivated successfully'
  });
});

// @desc    Get patient medical history
// @route   GET /api/patients/:id/history
// @access  Private
exports.getPatientHistory = asyncHandler(async (req, res, next) => {
  const patient = await Patient.findById(req.params.id)
    .select('medicalHistory medications vitalSigns ophthalmology')
    .populate('medications.prescribedBy', 'firstName lastName');

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      medicalHistory: patient.medicalHistory,
      currentMedications: patient.medications.filter(med => med.status === 'active'),
      vitalSigns: patient.vitalSigns,
      ophthalmology: patient.ophthalmology
    }
  });
});

// @desc    Get patient appointments
// @route   GET /api/patients/:id/appointments
// @access  Private
exports.getPatientAppointments = asyncHandler(async (req, res, next) => {
  const Appointment = require('../models/Appointment');

  const appointments = await Appointment.find({ patient: req.params.id })
    .populate('provider', 'firstName lastName specialization')
    .sort('-date');

  res.status(200).json({
    success: true,
    count: appointments.length,
    data: appointments
  });
});

// @desc    Get patient prescriptions
// @route   GET /api/patients/:id/prescriptions
// @access  Private
exports.getPatientPrescriptions = asyncHandler(async (req, res, next) => {
  const Prescription = require('../models/Prescription');

  const prescriptions = await Prescription.find({ patient: req.params.id })
    .populate('prescriber', 'firstName lastName')
    .sort('-dateIssued');

  res.status(200).json({
    success: true,
    count: prescriptions.length,
    data: prescriptions
  });
});

// @desc    Upload patient document
// @route   POST /api/patients/:id/documents
// @access  Private (Admin, Doctor, Nurse)
exports.uploadPatientDocument = asyncHandler(async (req, res, next) => {
  const patient = await Patient.findById(req.params.id);

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  // In production, this would handle file upload to cloud storage
  const document = {
    name: req.body.name,
    type: req.body.type,
    url: req.body.url, // This would be generated after upload
    uploadedAt: Date.now(),
    uploadedBy: req.user.id
  };

  patient.documents.push(document);
  await patient.save();

  res.status(200).json({
    success: true,
    data: document
  });
});

// @desc    Search patients
// @route   GET /api/patients/search
// @access  Private
exports.searchPatients = asyncHandler(async (req, res, next) => {
  const { q, field = 'all' } = req.query;

  if (!q) {
    return res.status(400).json({
      success: false,
      error: 'Search query is required'
    });
  }

  let query;

  switch (field) {
    case 'name':
      query = {
        $or: [
          { firstName: { $regex: q, $options: 'i' } },
          { lastName: { $regex: q, $options: 'i' } }
        ]
      };
      break;
    case 'id':
      query = { patientId: { $regex: q, $options: 'i' } };
      break;
    case 'phone':
      query = { phoneNumber: { $regex: q, $options: 'i' } };
      break;
    case 'email':
      query = { email: { $regex: q, $options: 'i' } };
      break;
    default:
      query = {
        $or: [
          { firstName: { $regex: q, $options: 'i' } },
          { lastName: { $regex: q, $options: 'i' } },
          { patientId: { $regex: q, $options: 'i' } },
          { phoneNumber: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } }
        ]
      };
  }

  const patients = await Patient.find(query)
    .limit(20)
    .select('patientId firstName lastName dateOfBirth phoneNumber email status');

  res.status(200).json({
    success: true,
    count: patients.length,
    data: patients
  });
});