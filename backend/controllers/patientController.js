const Patient = require('../models/Patient');
const { asyncHandler } = require('../middleware/errorHandler');
const { escapeRegex } = require('../utils/sanitize');

// Helper function to find patient by either MongoDB ObjectId or patientId
const findPatientById = async (id) => {
  // Check if id is a valid MongoDB ObjectId (24-character hex string)
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

  let patient = null;

  if (isObjectId) {
    patient = await Patient.findById(id);
  }

  // If not found by _id or not a valid ObjectId, try finding by patientId
  if (!patient) {
    patient = await Patient.findOne({ patientId: id });
  }

  return patient;
};

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

  // Search functionality (sanitize input to prevent NoSQL injection)
  if (search) {
    const sanitizedSearch = escapeRegex(search);
    query.$or = [
      { firstName: { $regex: sanitizedSearch, $options: 'i' } },
      { lastName: { $regex: sanitizedSearch, $options: 'i' } },
      { patientId: { $regex: sanitizedSearch, $options: 'i' } },
      { phoneNumber: { $regex: sanitizedSearch, $options: 'i' } },
      { email: { $regex: sanitizedSearch, $options: 'i' } }
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
  const { id } = req.params;
  let patient;

  // Check if id is a valid MongoDB ObjectId (24-character hex string)
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

  if (isObjectId) {
    // Try finding by MongoDB _id first
    patient = await Patient.findById(id)
      .populate('appointments', 'date type status provider')
      .populate('prescriptions', 'dateIssued type status medications')
      .populate('createdBy updatedBy', 'firstName lastName');
  }

  // If not found by _id or not a valid ObjectId, try finding by patientId
  if (!patient) {
    patient = await Patient.findOne({ patientId: id })
      .populate('appointments', 'date type status provider')
      .populate('prescriptions', 'dateIssued type status medications')
      .populate('createdBy updatedBy', 'firstName lastName');
  }

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
  const { id } = req.params;
  req.body.updatedBy = req.user.id;

  // Prevent updating certain fields
  delete req.body.patientId;
  delete req.body.createdAt;
  delete req.body.createdBy;

  let patient;

  // Check if id is a valid MongoDB ObjectId
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

  if (isObjectId) {
    patient = await Patient.findByIdAndUpdate(
      id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );
  }

  // If not found by _id or not a valid ObjectId, try finding by patientId
  if (!patient) {
    patient = await Patient.findOneAndUpdate(
      { patientId: id },
      req.body,
      {
        new: true,
        runValidators: true
      }
    );
  }

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
  const patient = await findPatientById(req.params.id);

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
  // First find the patient to get the MongoDB _id
  const patientRef = await findPatientById(req.params.id);

  if (!patientRef) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  // Now get the full patient with populated fields
  const patient = await Patient.findById(patientRef._id)
    .select('medicalHistory medications vitalSigns ophthalmology')
    .populate('medications.prescribedBy', 'firstName lastName');

  res.status(200).json({
    success: true,
    data: {
      medicalHistory: patient.medicalHistory,
      currentMedications: patient.medications ? patient.medications.filter(med => med.status === 'active') : [],
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

  // First resolve the patient ID to get the MongoDB _id
  const patient = await findPatientById(req.params.id);

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  const appointments = await Appointment.find({ patient: patient._id })
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

  // First resolve the patient ID to get the MongoDB _id
  const patient = await findPatientById(req.params.id);

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  const prescriptions = await Prescription.find({ patient: patient._id })
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

  // Sanitize input to prevent NoSQL injection
  const sanitizedQ = escapeRegex(q);
  let query;

  switch (field) {
    case 'name':
      query = {
        $or: [
          { firstName: { $regex: sanitizedQ, $options: 'i' } },
          { lastName: { $regex: sanitizedQ, $options: 'i' } }
        ]
      };
      break;
    case 'id':
      query = { patientId: { $regex: sanitizedQ, $options: 'i' } };
      break;
    case 'phone':
      query = { phoneNumber: { $regex: sanitizedQ, $options: 'i' } };
      break;
    case 'email':
      query = { email: { $regex: sanitizedQ, $options: 'i' } };
      break;
    default:
      query = {
        $or: [
          { firstName: { $regex: sanitizedQ, $options: 'i' } },
          { lastName: { $regex: sanitizedQ, $options: 'i' } },
          { patientId: { $regex: sanitizedQ, $options: 'i' } },
          { phoneNumber: { $regex: sanitizedQ, $options: 'i' } },
          { email: { $regex: sanitizedQ, $options: 'i' } }
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

// @desc    Get recent patients
// @route   GET /api/patients/recent
// @access  Private
exports.getRecentPatients = asyncHandler(async (req, res, next) => {
  const limit = parseInt(req.query.limit) || 10;

  const patients = await Patient.find({ status: 'active' })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('patientId firstName lastName dateOfBirth phoneNumber lastVisit');

  res.status(200).json({
    success: true,
    count: patients.length,
    data: patients
  });
});

// @desc    Get patient visits
// @route   GET /api/patients/:id/visits
// @access  Private
exports.getPatientVisits = asyncHandler(async (req, res, next) => {
  const patient = await findPatientById(req.params.id);

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  const Visit = require('../models/Visit');
  const visits = await Visit.find({ patient: patient._id })
    .populate('primaryProvider', 'firstName lastName')
    .sort({ visitDate: -1 })
    .select('visitId visitDate visitType status chiefComplaint diagnoses primaryProvider');

  res.status(200).json({
    success: true,
    count: visits.length,
    data: visits
  });
});

// @desc    Get patient allergies
// @route   GET /api/patients/:id/allergies
// @access  Private
exports.getPatientAllergies = asyncHandler(async (req, res, next) => {
  const patient = await findPatientById(req.params.id);

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  res.status(200).json({
    success: true,
    data: patient.allergies || []
  });
});

// @desc    Add patient allergy
// @route   POST /api/patients/:id/allergies
// @access  Private
exports.addPatientAllergy = asyncHandler(async (req, res, next) => {
  const patient = await findPatientById(req.params.id);

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  const allergyData = {
    allergen: req.body.allergen,
    reaction: req.body.reaction,
    severity: req.body.severity || 'mild',
    onsetDate: req.body.onsetDate,
    notes: req.body.notes,
    status: req.body.status || 'active'
  };

  patient.allergies = patient.allergies || [];
  patient.allergies.push(allergyData);
  await patient.save();

  res.status(201).json({
    success: true,
    data: allergyData
  });
});

// @desc    Get patient medications
// @route   GET /api/patients/:id/medications
// @access  Private
exports.getPatientMedications = asyncHandler(async (req, res, next) => {
  const patient = await findPatientById(req.params.id);

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  res.status(200).json({
    success: true,
    data: patient.medications || []
  });
});

// @desc    Add patient medication
// @route   POST /api/patients/:id/medications
// @access  Private
exports.addPatientMedication = asyncHandler(async (req, res, next) => {
  const patient = await findPatientById(req.params.id);

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  const medicationData = {
    name: req.body.name,
    dosage: req.body.dosage,
    frequency: req.body.frequency,
    route: req.body.route,
    startDate: req.body.startDate || new Date(),
    endDate: req.body.endDate,
    prescribedBy: req.user._id || req.user.id,
    reason: req.body.reason,
    status: req.body.status || 'active'
  };

  patient.medications = patient.medications || [];
  patient.medications.push(medicationData);
  await patient.save();

  res.status(201).json({
    success: true,
    data: medicationData
  });
});

// @desc    Update patient insurance
// @route   PUT /api/patients/:id/insurance
// @access  Private
exports.updatePatientInsurance = asyncHandler(async (req, res, next) => {
  const patient = await findPatientById(req.params.id);

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  patient.insurance = {
    ...patient.insurance,
    ...req.body,
    updatedAt: new Date()
  };

  await patient.save();

  res.status(200).json({
    success: true,
    data: patient.insurance
  });
});

// @desc    Get patient documents
// @route   GET /api/patients/:id/documents
// @access  Private
exports.getPatientDocuments = asyncHandler(async (req, res, next) => {
  const patient = await findPatientById(req.params.id);

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  const Document = require('../models/Document');
  const documents = await Document.find({ patient: patient._id, deleted: false })
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .select('title type category createdAt file.originalName file.size');

  res.status(200).json({
    success: true,
    count: documents.length,
    data: documents
  });
});