const Patient = require('../models/Patient');
const { asyncHandler } = require('../middleware/errorHandler');
const { escapeRegex } = require('../utils/sanitize');
const { paginateOffset, getPaginationParams } = require('../services/paginationService');
const { success, error, notFound, paginated } = require('../utils/apiResponse');
const { findPatientByIdOrCode, findPatientOrFail } = require('../utils/patientLookup');
const { patient: patientLogger } = require('../utils/structuredLogger');
const { PAGINATION } = require('../config/constants');
const websocketService = require('../services/websocketService');

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
    search,
    status = 'active',
    allClinics = 'false' // Allow explicit cross-clinic view for search
  } = req.query;

  // Get pagination params using helper
  const { page, limit, sort } = getPaginationParams(req.query, 'createdAt');

  // Build filter query
  const filter = {};

  // Filter by status
  if (status) {
    filter.status = status;
  }

  // CLINIC FILTERING:
  // - If clinicId is set: filter by that clinic (even for admins)
  // - If clinicId is null AND user has accessAllClinics: show all
  // - If clinicId is null AND user doesn't have accessAllClinics: error (shouldn't happen)
  const isSearching = search && search.trim().length > 0;
  const wantsAllClinics = allClinics === 'true';

  patientLogger.info('Backend clinic filtering', {
    clinicId: req.clinicId,
    accessAllClinics: req.accessAllClinics
  });

  if (req.clinicId) {
    // Clinic is selected: filter by homeClinic
    filter.homeClinic = req.clinicId;
    patientLogger.info('Filtering by clinic', { clinicId: req.clinicId });
  } else if (!req.accessAllClinics && !isSearching && !wantsAllClinics) {
    // No clinic selected and user is not admin: this shouldn't happen
    // but if it does, show no results
    filter.homeClinic = null;
    patientLogger.warn('No clinic and not admin - showing nothing');
  } else {
    patientLogger.info('All Clinics mode - no filter');
  }
  // else: admin with no specific clinic selected (All Clinics) - no filter applied

  // Search functionality (sanitize input to prevent NoSQL injection)
  // Note: When searching, we DON'T filter by clinic to allow cross-clinic patient lookup
  if (search) {
    const sanitizedSearch = escapeRegex(search);
    filter.$or = [
      { firstName: { $regex: sanitizedSearch, $options: 'i' } },
      { lastName: { $regex: sanitizedSearch, $options: 'i' } },
      { patientId: { $regex: sanitizedSearch, $options: 'i' } },
      { phoneNumber: { $regex: sanitizedSearch, $options: 'i' } },
      { email: { $regex: sanitizedSearch, $options: 'i' } }
    ];
  }

  // Use pagination service
  const result = await paginateOffset(Patient, {
    filter,
    page,
    limit,
    sort,
    select: '-medicalHistory.socialHistory',
    lean: true
  });

  res.status(200).json({
    success: true,
    count: result.data.length,
    total: result.pagination.total,
    pages: result.pagination.pages,
    currentPage: result.pagination.page,
    limit: result.pagination.limit,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
    data: result.data
  });
});

// @desc    Get single patient
// @route   GET /api/patients/:id
// @access  Private
exports.getPatient = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const Visit = require('../models/Visit');

  const patient = await findPatientByIdOrCode(id, {
    select: '+biometric.faceEncoding',
    populate: [
      { path: 'appointments', select: 'date type status provider' },
      { path: 'prescriptions', select: 'dateIssued type status medications' },
      { path: 'createdBy updatedBy', select: 'firstName lastName' },
      { path: 'convention.company', select: 'name companyId defaultCoverage contract.status' }
    ]
  });

  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Convert to plain object for modification
  const patientData = patient.toObject();

  // If lastVisit is not set, compute it from visits collection
  if (!patientData.lastVisit) {
    const lastVisit = await Visit.findOne({ patient: patient._id })
      .sort({ visitDate: -1 })
      .select('visitDate status');

    if (lastVisit) {
      patientData.lastVisit = lastVisit.visitDate;
    }
  }

  return success(res, { data: patientData });
});

// @desc    Create new patient
// @route   POST /api/patients
// @access  Private (Admin, Receptionist, Nurse)
exports.createPatient = asyncHandler(async (req, res, next) => {
  req.body.createdBy = req.user.id;

  // SECURITY FIX: Backend validation for duplicate detection bypass
  // Only admin can override duplicate detection
  if (req.body.adminDuplicateOverride === true) {
    if (req.user.role !== 'admin') {
      return error(res, {
        statusCode: 403,
        error: 'Seul un administrateur peut créer un patient malgré les doublons détectés',
        code: 'ADMIN_OVERRIDE_REQUIRED'
      });
    }
    patientLogger.info('Admin overriding duplicate detection', { adminId: req.user.id });
  }

  // Handle biometric data - add metadata if face encoding is provided
  if (req.body.biometric && req.body.biometric.faceEncoding) {
    req.body.biometric.encodingCapturedAt = new Date();
    req.body.biometric.encodingCapturedBy = req.user.id;
    patientLogger.info('Saving biometric data', {
      encodingLength: req.body.biometric.faceEncoding.length
    });
  }

  const patient = await Patient.create(req.body);

  // WebSocket broadcast: Notify of new patient registration
  try {
    websocketService.broadcast({
      type: 'patient_created',
      patientId: patient._id,
      patientCode: patient.patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      createdBy: req.user.id,
      timestamp: new Date()
    });

    // Notify reception/admin roles
    websocketService.sendNotificationToRole('receptionist', {
      type: 'patient_registered',
      patientId: patient._id,
      patientCode: patient.patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      message: 'Nouveau patient enregistré',
      timestamp: new Date()
    });

    patientLogger.info('Patient created with WebSocket broadcast', { patientId: patient._id });
  } catch (wsError) {
    patientLogger.warn('WebSocket broadcast failed', { error: wsError.message });
  }

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

  // Check if id is a valid MongoDB ObjectId
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

  // First, find the existing patient to check for legacy data completion
  let existingPatient;
  if (isObjectId) {
    existingPatient = await Patient.findById(id);
  }
  if (!existingPatient) {
    existingPatient = await Patient.findOne({ patientId: id });
  }

  if (!existingPatient) {
    return notFound(res, 'Patient');
  }

  // Auto-update dataStatus when placeholder fields are filled in
  if (existingPatient.dataStatus === 'incomplete' && existingPatient.placeholderFields?.length > 0) {
    const updatedPlaceholderFields = [...existingPatient.placeholderFields];

    // Check each placeholder field to see if it's being updated with real data
    const updates = req.body;

    // dateOfBirth - check if new DOB is not placeholder (not 1900-01-01)
    if (updatedPlaceholderFields.includes('dateOfBirth') && updates.dateOfBirth) {
      const newDob = new Date(updates.dateOfBirth);
      if (newDob.getFullYear() > 1900 && newDob.getFullYear() <= new Date().getFullYear()) {
        const idx = updatedPlaceholderFields.indexOf('dateOfBirth');
        if (idx > -1) updatedPlaceholderFields.splice(idx, 1);
      }
    }

    // gender - check if gender is not 'other'
    if (updatedPlaceholderFields.includes('gender') && updates.gender) {
      if (updates.gender === 'male' || updates.gender === 'female') {
        const idx = updatedPlaceholderFields.indexOf('gender');
        if (idx > -1) updatedPlaceholderFields.splice(idx, 1);
      }
    }

    // phoneNumber - check if phone doesn't start with 999
    if (updatedPlaceholderFields.includes('phoneNumber') && updates.phoneNumber) {
      if (!updates.phoneNumber.startsWith('999') && updates.phoneNumber.length >= 8) {
        const idx = updatedPlaceholderFields.indexOf('phoneNumber');
        if (idx > -1) updatedPlaceholderFields.splice(idx, 1);
      }
    }

    // email - check if email is valid and not placeholder
    if (updatedPlaceholderFields.includes('email') && updates.email) {
      if (!updates.email.includes('@placeholder') && !updates.email.includes('@example') && updates.email.includes('@')) {
        const idx = updatedPlaceholderFields.indexOf('email');
        if (idx > -1) updatedPlaceholderFields.splice(idx, 1);
      }
    }

    // address - check if address has real data
    if (updatedPlaceholderFields.includes('address') && updates.address) {
      const addr = updates.address;
      if ((typeof addr === 'object' && (addr.street || addr.city)) ||
          (typeof addr === 'string' && addr !== 'N/A' && addr !== 'Unknown' && addr.length > 3)) {
        const idx = updatedPlaceholderFields.indexOf('address');
        if (idx > -1) updatedPlaceholderFields.splice(idx, 1);
      }
    }

    // bloodType - check if bloodType is set
    if (updatedPlaceholderFields.includes('bloodType') && (updates.bloodType || updates.bloodGroup)) {
      const idx = updatedPlaceholderFields.indexOf('bloodType');
      if (idx > -1) updatedPlaceholderFields.splice(idx, 1);
    }

    // Update the placeholderFields and dataStatus in the request body
    req.body.placeholderFields = updatedPlaceholderFields;

    // If all placeholder fields are filled, mark as complete
    if (updatedPlaceholderFields.length === 0) {
      req.body.dataStatus = 'complete';
      req.body.dataVerifiedAt = new Date();
      req.body.dataVerifiedBy = req.user.id;
    }
  }

  let patient;

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

  // WebSocket broadcast: Notify interested parties of patient update
  try {
    const changedFields = Object.keys(req.body).filter(k => k !== 'updatedBy');

    // Broadcast to all connected clients (for patient list updates)
    websocketService.broadcast({
      type: 'patient_update',
      patientId: patient._id,
      patientCode: patient.patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      changes: changedFields,
      updatedBy: req.user.id,
      timestamp: new Date()
    });

    // Notify the patient directly if they have a user account
    websocketService.sendNotificationToUser(patient._id.toString(), {
      type: 'patient_info_updated',
      patientId: patient._id,
      changes: changedFields,
      message: 'Vos informations ont été mises à jour',
      timestamp: new Date()
    });

    patientLogger.info('Patient updated with WebSocket broadcast', { patientId: patient._id, changes: changedFields });
  } catch (wsError) {
    patientLogger.warn('WebSocket broadcast failed', { error: wsError.message });
  }

  return success(res, { data: patient });
});

// @desc    Delete patient (soft delete)
// @route   DELETE /api/patients/:id
// @access  Private (Admin only)
exports.deletePatient = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Check if already deleted
  if (patient.isDeleted) {
    return error(res, {
      statusCode: 400,
      error: 'Patient is already deleted'
    });
  }

  // Get deletion reason from request body
  const reason = req.body.reason || null;

  // Use soft delete with cascade to related records
  const result = await patient.softDelete(req.user.id, reason);

  return success(res, {
    message: 'Patient and related records soft-deleted successfully',
    data: {
      patientId: result.patientId,
      deletedAt: result.deletedAt,
      cascadeResults: result.cascadeResults
    }
  });
});

// @desc    Restore a soft-deleted patient
// @route   PUT /api/patients/:id/restore
// @access  Private (Admin only)
exports.restorePatient = asyncHandler(async (req, res, next) => {
  // Need to use includeDeleted to find soft-deleted patients
  const patient = await Patient.findOne({
    $or: [
      { _id: req.params.id },
      { patientId: req.params.id }
    ],
    includeDeleted: true
  });

  if (!patient) {
    return notFound(res, 'Patient');
  }

  if (!patient.isDeleted) {
    return error(res, {
      statusCode: 400,
      error: 'Patient is not deleted'
    });
  }

  const result = await patient.restore(req.user.id);

  return success(res, {
    message: 'Patient restored successfully',
    data: result
  });
});

// @desc    Get all soft-deleted patients (for admin restore functionality)
// @route   GET /api/patients/deleted
// @access  Private (Admin only)
exports.getDeletedPatients = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(
    parseInt(req.query.limit) || PAGINATION.DEFAULT_PAGE_SIZE,
    PAGINATION.MAX_PAGE_SIZE
  );

  const patients = await Patient.findDeleted()
    .select('patientId firstName lastName deletedAt deletedBy deletionReason')
    .populate('deletedBy', 'firstName lastName')
    .limit(limit)
    .skip((page - 1) * limit)
    .sort('-deletedAt');

  const total = await Patient.countDocuments({ isDeleted: true, includeDeleted: true });

  res.status(200).json({
    success: true,
    count: patients.length,
    total,
    pages: Math.ceil(total / limit),
    data: patients
  });
});

// @desc    Get patient medical history
// @route   GET /api/patients/:id/history
// @access  Private
exports.getPatientHistory = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id, {
    select: 'medicalHistory medications vitalSigns ophthalmology',
    populate: { path: 'medications.prescribedBy', select: 'firstName lastName' }
  });

  if (!patient) {
    return notFound(res, 'Patient');
  }

  return success(res, {
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

  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const appointments = await Appointment.find({ patient: patient._id })
    .populate('provider', 'firstName lastName specialization')
    .sort('-date');

  return success(res, {
    data: appointments
  });
});

// @desc    Get patient prescriptions
// @route   GET /api/patients/:id/prescriptions
// @access  Private
exports.getPatientPrescriptions = asyncHandler(async (req, res, next) => {
  const Prescription = require('../models/Prescription');

  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const prescriptions = await Prescription.find({ patient: patient._id })
    .populate('prescriber', 'firstName lastName')
    .sort('-dateIssued');

  return success(res, {
    data: prescriptions
  });
});

// @desc    Upload patient document
// @route   POST /api/patients/:id/documents
// @access  Private (Admin, Doctor, Nurse)
exports.uploadPatientDocument = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
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

  return success(res, { data: document });
});

// @desc    Search patients
// @route   GET /api/patients/search
// @access  Private
exports.searchPatients = asyncHandler(async (req, res, next) => {
  const { q, field = 'all' } = req.query;

  if (!q) {
    return error(res, {
      statusCode: 400,
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
    case 'legacyId':
      // Search across all legacy ID fields
      query = {
        $or: [
          { legacyId: { $regex: sanitizedQ, $options: 'i' } },
          { legacyPatientNumber: { $regex: sanitizedQ, $options: 'i' } },
          { 'folderIds.folderId': { $regex: sanitizedQ, $options: 'i' } }
        ]
      };
      break;
    default:
      query = {
        $or: [
          { firstName: { $regex: sanitizedQ, $options: 'i' } },
          { lastName: { $regex: sanitizedQ, $options: 'i' } },
          { patientId: { $regex: sanitizedQ, $options: 'i' } },
          { phoneNumber: { $regex: sanitizedQ, $options: 'i' } },
          { email: { $regex: sanitizedQ, $options: 'i' } },
          // Include legacy IDs in general search
          { legacyId: { $regex: sanitizedQ, $options: 'i' } },
          { legacyPatientNumber: { $regex: sanitizedQ, $options: 'i' } },
          { 'folderIds.folderId': { $regex: sanitizedQ, $options: 'i' } }
        ]
      };
  }

  const patients = await Patient.find(query)
    .limit(20)
    .select('patientId firstName lastName dateOfBirth phoneNumber email status legacyId legacyPatientNumber folderIds')
    .lean(); // Performance: return plain JS objects for search results

  return success(res, { data: patients });
});

// @desc    Get recent patients
// @route   GET /api/patients/recent
// @access  Private
exports.getRecentPatients = asyncHandler(async (req, res, next) => {
  const limit = Math.min(
    parseInt(req.query.limit) || 10,
    PAGINATION.MAX_PAGE_SIZE
  );

  const patients = await Patient.find({ status: 'active' })
    .sort({ updatedAt: -1 })
    .lean() // Performance: return plain JS objects
    .limit(limit)
    .select('patientId firstName lastName dateOfBirth phoneNumber lastVisit');

  return success(res, { data: patients });
});

// @desc    Get patient visits
// @route   GET /api/patients/:id/visits
// @access  Private
exports.getPatientVisits = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const Visit = require('../models/Visit');
  const OphthalmologyExam = require('../models/OphthalmologyExam');
  const ConsultationSession = require('../models/ConsultationSession');

  // Fetch visits, ophthalmology exams, and consultation sessions in parallel
  const [visits, ophthalmologyExams, sessions] = await Promise.all([
    Visit.find({ patient: patient._id })
      .populate('primaryProvider', 'firstName lastName')
      .sort({ visitDate: -1 })
      .select('visitId visitDate visitType status chiefComplaint diagnoses primaryProvider signatureStatus signedBy signedAt createdAt consultationSession'),
    OphthalmologyExam.find({ patient: patient._id })
      .populate('examiner', 'firstName lastName')
      .sort({ createdAt: -1 })
      .select('examId examType status iop refraction keratometry currentCorrection visualAcuity assessment examiner createdAt updatedAt'),
    ConsultationSession.find({ patient: patient._id, status: 'completed' })
      .populate('doctor', 'firstName lastName')
      .sort({ createdAt: -1 })
      .select('sessionId sessionType status stepData doctor createdAt updatedAt completedAt')
  ]);

  // Create a map of session IDs to their stepData for quick lookup
  const sessionDataMap = new Map();
  sessions.forEach(s => {
    sessionDataMap.set(s._id.toString(), s.stepData || {});
  });

  // Merge ophthalmology exam data with visits or return as combined array
  // The frontend expects records with iop, refraction, keratometry, currentCorrection fields
  const combinedData = [
    // Process visits - enrich with session stepData if available
    ...visits.map(v => {
      const visitObj = v.toObject();
      const sessionId = visitObj.consultationSession?.toString();
      const stepData = sessionId ? sessionDataMap.get(sessionId) : null;

      // If visit has linked session with stepData, extract ophthalmology measurements
      // Also fix status if session is completed but visit is still in-progress
      if (stepData) {
        // If session is completed but visit is in-progress, show as completed
        if (visitObj.status === 'in-progress') {
          visitObj.status = 'completed';
        }
        // Map stepData structure to what frontend expects
        // stepData.examination.iop -> iop
        if (stepData.examination?.iop) {
          visitObj.iop = {
            OD: stepData.examination.iop.OD,
            OS: stepData.examination.iop.OS
          };
        }
        // stepData.refraction.subjective or finalPrescription -> refraction
        if (stepData.refraction?.subjective || stepData.refraction?.finalPrescription) {
          visitObj.refraction = {
            finalPrescription: stepData.refraction.finalPrescription,
            subjective: stepData.refraction.subjective,
            objective: stepData.refraction.objective
          };
        }
        // stepData.refraction.keratometry -> keratometry (restructure to match model)
        if (stepData.refraction?.keratometry) {
          visitObj.keratometry = {
            OD: {
              k1: { power: parseFloat(stepData.refraction.keratometry.OD?.k1) || null, axis: parseFloat(stepData.refraction.keratometry.OD?.k1Axis) || null },
              k2: { power: parseFloat(stepData.refraction.keratometry.OD?.k2) || null, axis: parseFloat(stepData.refraction.keratometry.OD?.k2Axis) || null }
            },
            OS: {
              k1: { power: parseFloat(stepData.refraction.keratometry.OS?.k1) || null, axis: parseFloat(stepData.refraction.keratometry.OS?.k1Axis) || null },
              k2: { power: parseFloat(stepData.refraction.keratometry.OS?.k2) || null, axis: parseFloat(stepData.refraction.keratometry.OS?.k2Axis) || null }
            }
          };
        }
        // stepData.refraction.visualAcuity -> visualAcuity
        if (stepData.refraction?.visualAcuity) {
          visitObj.visualAcuity = stepData.refraction.visualAcuity;
        }
        // Mark as having ophthalmology data
        visitObj.type = 'ophthalmology';
      }
      return visitObj;
    }),
    // Include ophthalmology exams
    ...ophthalmologyExams.map(exam => ({
      ...exam.toObject(),
      // Map ophthalmology exam fields to what frontend expects
      type: exam.examType || 'ophthalmology',
      date: exam.createdAt,
      visitDate: exam.createdAt
      // These fields are already present: iop, refraction, keratometry, currentCorrection, visualAcuity
    }))
  ];

  // Sort combined data by date descending
  combinedData.sort((a, b) => new Date(b.visitDate || b.createdAt) - new Date(a.visitDate || a.createdAt));

  return success(res, { data: combinedData });
});

// @desc    Get patient allergies
// @route   GET /api/patients/:id/allergies
// @access  Private
exports.getPatientAllergies = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  return success(res, { data: patient.allergies || [] });
});

// @desc    Add patient allergy
// @route   POST /api/patients/:id/allergies
// @access  Private
exports.addPatientAllergy = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const allergyData = {
    allergen: req.body.allergen,
    reaction: req.body.reaction,
    severity: req.body.severity || 'mild',
    onsetDate: req.body.onsetDate,
    notes: req.body.notes,
    status: req.body.status || 'active'
  };

  patient.medicalHistory = patient.medicalHistory || {};
  patient.medicalHistory.allergies = patient.medicalHistory.allergies || [];
  patient.medicalHistory.allergies.push(allergyData);
  await patient.save();

  res.status(201).json({
    success: true,
    data: allergyData
  });
});

// @desc    Update patient allergy
// @route   PUT /api/patients/:id/allergies/:allergyId
// @access  Private
exports.updatePatientAllergy = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const allergyIndex = patient.medicalHistory?.allergies?.findIndex(
    (a, idx) => idx.toString() === req.params.allergyId || a._id?.toString() === req.params.allergyId
  );

  if (allergyIndex === -1 || allergyIndex === undefined) {
    return notFound(res, 'Allergy');
  }

  const updatedAllergy = {
    ...patient.medicalHistory.allergies[allergyIndex],
    ...req.body,
    updatedAt: new Date()
  };

  patient.medicalHistory.allergies[allergyIndex] = updatedAllergy;
  await patient.save();

  return success(res, { data: updatedAllergy });
});

// @desc    Delete patient allergy
// @route   DELETE /api/patients/:id/allergies/:allergyId
// @access  Private
exports.deletePatientAllergy = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const allergyIndex = patient.medicalHistory?.allergies?.findIndex(
    (a, idx) => idx.toString() === req.params.allergyId || a._id?.toString() === req.params.allergyId
  );

  if (allergyIndex === -1 || allergyIndex === undefined) {
    return notFound(res, 'Allergy');
  }

  patient.medicalHistory.allergies.splice(allergyIndex, 1);
  await patient.save();

  return success(res, {
    message: 'Allergy removed successfully'
  });
});

// @desc    Get patient medications
// @route   GET /api/patients/:id/medications
// @access  Private
exports.getPatientMedications = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  return success(res, { data: patient.medications || [] });
});

// @desc    Add patient medication
// @route   POST /api/patients/:id/medications
// @access  Private
exports.addPatientMedication = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
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

// @desc    Update patient medication
// @route   PUT /api/patients/:id/medications/:medicationId
// @access  Private
exports.updatePatientMedication = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const medIndex = patient.medications?.findIndex(
    (m, idx) => idx.toString() === req.params.medicationId || m._id?.toString() === req.params.medicationId
  );

  if (medIndex === -1 || medIndex === undefined) {
    return notFound(res, 'Medication');
  }

  const updatedMedication = {
    ...patient.medications[medIndex],
    ...req.body,
    updatedAt: new Date()
  };

  patient.medications[medIndex] = updatedMedication;
  await patient.save();

  return success(res, { data: updatedMedication });
});

// @desc    Delete patient medication
// @route   DELETE /api/patients/:id/medications/:medicationId
// @access  Private
exports.deletePatientMedication = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const medIndex = patient.medications?.findIndex(
    (m, idx) => idx.toString() === req.params.medicationId || m._id?.toString() === req.params.medicationId
  );

  if (medIndex === -1 || medIndex === undefined) {
    return notFound(res, 'Medication');
  }

  patient.medications.splice(medIndex, 1);
  await patient.save();

  return success(res, {
    message: 'Medication removed successfully'
  });
});

// @desc    Update patient insurance
// @route   PUT /api/patients/:id/insurance
// @access  Private
exports.updatePatientInsurance = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  patient.insurance = {
    ...patient.insurance,
    ...req.body,
    updatedAt: new Date()
  };

  await patient.save();

  return success(res, { data: patient.insurance });
});

// @desc    Get patient documents
// @route   GET /api/patients/:id/documents
// @access  Private
exports.getPatientDocuments = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const Document = require('../models/Document');
  const documents = await Document.find({ patient: patient._id, deleted: false })
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .select('title type category createdAt file.originalName file.size');

  return success(res, { data: documents });
});

// @desc    Get complete patient profile
// @route   GET /api/patients/:id/complete-profile
// @access  Private
exports.getCompleteProfile = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Get related data
  const Visit = require('../models/Visit');
  const Appointment = require('../models/Appointment');
  const Prescription = require('../models/Prescription');

  const [visits, appointments, prescriptions] = await Promise.all([
    Visit.find({ patient: patient._id })
      .populate('primaryProvider', 'firstName lastName')
      .sort({ visitDate: -1 })
      .limit(10),
    Appointment.find({ patient: patient._id })
      .populate('provider', 'firstName lastName')
      .sort({ date: -1 })
      .limit(10),
    Prescription.find({ patient: patient._id })
      .populate('prescriber', 'firstName lastName')
      .sort({ dateIssued: -1 })
      .limit(10)
  ]);

  return success(res, {
    data: {
      patient,
      recentVisits: visits,
      recentAppointments: appointments,
      recentPrescriptions: prescriptions,
      statistics: {
        totalVisits: await Visit.countDocuments({ patient: patient._id }),
        totalAppointments: await Appointment.countDocuments({ patient: patient._id }),
        totalPrescriptions: await Prescription.countDocuments({ patient: patient._id })
      }
    }
  });
});

// @desc    Get patient medical issues
// @route   GET /api/patients/:id/medical-issues
// @access  Private
exports.getMedicalIssues = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const { status = 'all' } = req.query;

  let conditions = patient.medicalHistory?.chronicConditions || [];

  if (status !== 'all') {
    conditions = conditions.filter(c => c.status === status);
  }

  return success(res, {
    data: {
      chronicConditions: conditions,
      allergies: patient.medicalHistory?.allergies || [],
      surgeries: patient.medicalHistory?.surgeries || [],
      eyeConditions: patient.ophthalmology?.eyeConditions || []
    }
  });
});

// @desc    Update medical issue
// @route   PUT /api/patients/:id/medical-issues/:issueId
// @access  Private
exports.updateMedicalIssue = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const issueIndex = patient.medicalHistory?.chronicConditions?.findIndex(
    (c, idx) => idx.toString() === req.params.issueId || c._id?.toString() === req.params.issueId
  );

  if (issueIndex === -1 || issueIndex === undefined) {
    return notFound(res, 'Medical issue');
  }

  patient.medicalHistory.chronicConditions[issueIndex] = {
    ...patient.medicalHistory.chronicConditions[issueIndex],
    ...req.body
  };

  await patient.save();

  return success(res, {
    data: patient.medicalHistory.chronicConditions[issueIndex]
  });
});

// @desc    Get patient providers (all doctors who treated patient)
// @route   GET /api/patients/:id/providers
// @access  Private
exports.getPatientProviders = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const Visit = require('../models/Visit');
  const Appointment = require('../models/Appointment');

  // Get unique providers from visits and appointments
  const [visitProviders, appointmentProviders] = await Promise.all([
    Visit.find({ patient: patient._id })
      .distinct('primaryProvider'),
    Appointment.find({ patient: patient._id })
      .distinct('provider')
  ]);

  const allProviderIds = [...new Set([...visitProviders, ...appointmentProviders])];

  const User = require('../models/User');
  const providers = await User.find({ _id: { $in: allProviderIds } })
    .select('firstName lastName role specialization email');

  // Add visit count for each provider
  const providersWithStats = await Promise.all(
    providers.map(async (provider) => {
      const visitCount = await Visit.countDocuments({
        patient: patient._id,
        primaryProvider: provider._id
      });
      return {
        ...provider.toObject(),
        visitCount
      };
    })
  );

  return success(res, { data: providersWithStats });
});

// @desc    Get patient audit trail
// @route   GET /api/patients/:id/audit
// @access  Private (Admin only)
exports.getPatientAudit = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(
    parseInt(req.query.limit) || 50,
    PAGINATION.MAX_PAGE_SIZE
  );

  // Try to get audit logs if the model exists
  try {
    const AuditLog = require('../models/AuditLog');
    const logs = await AuditLog.find({
      $or: [
        { 'metadata.patientId': patient._id.toString() },
        { 'metadata.patientId': patient.patientId },
        { resourceId: patient._id.toString() }
      ]
    })
      .populate('user', 'firstName lastName role')
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await AuditLog.countDocuments({
      $or: [
        { 'metadata.patientId': patient._id.toString() },
        { 'metadata.patientId': patient.patientId }
      ]
    });

    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      pages: Math.ceil(total / limit),
      data: logs
    });
  } catch (err) {
    // If AuditLog model doesn't exist, return empty
    res.status(200).json({
      success: true,
      count: 0,
      data: [],
      message: 'Audit logging not configured'
    });
  }
});

// @desc    Get patient statistics
// @route   GET /api/patients/:id/statistics
// @access  Private
exports.getPatientStatistics = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const Visit = require('../models/Visit');
  const Appointment = require('../models/Appointment');
  const Prescription = require('../models/Prescription');

  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  const [
    totalVisits,
    visitsThisYear,
    totalAppointments,
    upcomingAppointments,
    totalPrescriptions,
    activePrescriptions
  ] = await Promise.all([
    Visit.countDocuments({ patient: patient._id }),
    Visit.countDocuments({ patient: patient._id, visitDate: { $gte: oneYearAgo } }),
    Appointment.countDocuments({ patient: patient._id }),
    Appointment.countDocuments({ patient: patient._id, date: { $gte: now }, status: { $in: ['scheduled', 'confirmed'] } }),
    Prescription.countDocuments({ patient: patient._id }),
    Prescription.countDocuments({ patient: patient._id, status: 'pending' })
  ]);

  // Get last visit
  const lastVisit = await Visit.findOne({ patient: patient._id })
    .sort({ visitDate: -1 })
    .select('visitDate visitType');

  return success(res, {
    data: {
      visits: {
        total: totalVisits,
        thisYear: visitsThisYear,
        lastVisit: lastVisit?.visitDate
      },
      appointments: {
        total: totalAppointments,
        upcoming: upcomingAppointments
      },
      prescriptions: {
        total: totalPrescriptions,
        active: activePrescriptions
      },
      allergiesCount: patient.medicalHistory?.allergies?.length || 0,
      medicationsCount: patient.medications?.filter(m => m.status === 'active')?.length || 0,
      memberSince: patient.createdAt
    }
  });
});

// @desc    Upload patient photo
// @route   POST /api/patients/:id/photo
// @access  Private
exports.uploadPatientPhoto = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  if (!req.files || !req.files.photo) {
    return error(res, {
      statusCode: 400,
      error: 'Please upload a photo'
    });
  }

  const file = req.files.photo;
  const path = require('path');
  const crypto = require('crypto');

  // SECURITY FIX: Validate file type using both mimetype AND extension whitelist
  const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  if (!file.mimetype.startsWith('image') || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return error(res, {
      statusCode: 400,
      error: 'Please upload a valid image file (JPG, PNG, GIF, or WebP)'
    });
  }

  // SECURITY FIX: Validate extension from original filename
  const originalExt = path.extname(file.name || '').toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(originalExt)) {
    return error(res, {
      statusCode: 400,
      error: 'Invalid file extension. Allowed: JPG, PNG, GIF, WebP'
    });
  }

  // SECURITY FIX: Check for path traversal attempts in filename
  if (file.name && (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\'))) {
    return error(res, {
      statusCode: 400,
      error: 'Invalid filename'
    });
  }

  // Check file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return error(res, {
      statusCode: 400,
      error: 'Photo must be less than 5MB'
    });
  }

  // SECURITY FIX: Generate random filename to prevent path traversal and overwrites
  // Use crypto random instead of user-controlled input
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  const safeExt = originalExt; // Already validated above
  const filename = `patient_${patient._id}_${randomSuffix}${safeExt}`;

  // Ensure upload directory exists and is within allowed path
  const baseUploadPath = path.resolve(process.env.FILE_UPLOAD_PATH || './uploads');
  const patientUploadDir = path.join(baseUploadPath, 'patients');
  const uploadPath = path.join(patientUploadDir, filename);

  // SECURITY FIX: Verify final path is within allowed directory (prevent traversal)
  if (!uploadPath.startsWith(patientUploadDir)) {
    return error(res, {
      statusCode: 400,
      error: 'Invalid upload path'
    });
  }

  // Ensure directory exists
  const fs = require('fs');
  if (!fs.existsSync(patientUploadDir)) {
    fs.mkdirSync(patientUploadDir, { recursive: true });
  }

  // Move file
  await file.mv(uploadPath);

  // Update patient
  patient.photoPath = uploadPath;
  patient.photoUrl = `/uploads/patients/${filename}`;
  await patient.save();

  return success(res, {
    data: {
      photoUrl: patient.photoUrl
    }
  });
});

// @desc    Get patient by MRN
// @route   GET /api/patients/mrn/:mrn
// @access  Private
exports.getPatientByMRN = asyncHandler(async (req, res, next) => {
  const patient = await Patient.findOne({ patientId: req.params.mrn });

  if (!patient) {
    return notFound(res, 'Patient');
  }

  return success(res, { data: patient });
});

// @desc    Get patient insurance
// @route   GET /api/patients/:id/insurance
// @access  Private
exports.getPatientInsurance = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  return success(res, { data: patient.insurance || {} });
});

// @desc    Get patient lab results
// @route   GET /api/patients/:id/lab-results
// @access  Private
exports.getPatientLabResults = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Try to get lab results from LabResult model first, then fall back to Visit-embedded results
  try {
    const LabResult = require('../models/LabResult');
    const labResults = await LabResult.find({ patient: patient._id })
      .populate('labOrder', 'orderId priority')
      .populate('performedBy', 'firstName lastName')
      .populate('verifiedBy', 'firstName lastName')
      .sort({ performedAt: -1 });

    if (labResults.length > 0) {
      return success(res, { data: labResults });
    }

    // Fall back to Visit-embedded laboratory orders
    const Visit = require('../models/Visit');
    const visits = await Visit.find({
      patient: patient._id,
      'laboratoryOrders.0': { $exists: true }
    })
      .select('laboratoryOrders visitDate')
      .populate('laboratoryOrders.performedBy', 'firstName lastName')
      .sort({ visitDate: -1 });

    const embeddedResults = [];
    visits.forEach(visit => {
      visit.laboratoryOrders?.filter(t => t.status === 'completed').forEach(test => {
        embeddedResults.push({
          ...test.toObject(),
          visitId: visit._id,
          visitDate: visit.visitDate
        });
      });
    });

    return success(res, { data: embeddedResults });
  } catch (err) {
    // Return from patient's labResults array as last resort
    return success(res, { data: patient.labResults || [] });
  }
});

// @desc    Get patient correspondence
// @route   GET /api/patients/:id/correspondence
// @access  Private
exports.getPatientCorrespondence = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  try {
    const Correspondence = require('../models/Correspondence');
    const correspondence = await Correspondence.find({ patient: patient._id })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    return success(res, { data: correspondence });
  } catch (err) {
    return success(res, { data: [] });
  }
});

// @desc    Check for duplicate patients
// @route   POST /api/patients/check-duplicates
// @access  Private
exports.checkDuplicates = asyncHandler(async (req, res, next) => {
  const duplicates = await Patient.checkForDuplicates(req.body);

  return success(res, {
    data: {
      hasDuplicates: duplicates.length > 0,
      count: duplicates.length,
      duplicates
    }
  });
});

// @desc    Merge duplicate patients
// @route   POST /api/patients/merge
// @access  Private (Admin only)
exports.mergePatients = asyncHandler(async (req, res, next) => {
  const { primaryId, secondaryId } = req.body;

  if (!primaryId || !secondaryId) {
    return error(res, {
      statusCode: 400,
      error: 'Primary and secondary patient IDs are required'
    });
  }

  const [primaryPatient, secondaryPatient] = await Promise.all([
    findPatientByIdOrCode(primaryId),
    findPatientByIdOrCode(secondaryId)
  ]);

  if (!primaryPatient || !secondaryPatient) {
    return notFound(res, 'One or both patients');
  }

  // Merge data - keep primary's data, add secondary's where primary is empty
  const fieldsToMerge = ['alternativePhone', 'email', 'nationalId', 'occupation', 'maritalStatus'];

  fieldsToMerge.forEach(field => {
    if (!primaryPatient[field] && secondaryPatient[field]) {
      primaryPatient[field] = secondaryPatient[field];
    }
  });

  // Merge arrays
  if (secondaryPatient.medicalHistory?.allergies?.length) {
    primaryPatient.medicalHistory = primaryPatient.medicalHistory || {};
    primaryPatient.medicalHistory.allergies = [
      ...(primaryPatient.medicalHistory.allergies || []),
      ...secondaryPatient.medicalHistory.allergies
    ];
  }

  if (secondaryPatient.medications?.length) {
    primaryPatient.medications = [
      ...(primaryPatient.medications || []),
      ...secondaryPatient.medications
    ];
  }

  // CRITICAL FIX: Update references in ALL patient-related collections
  // Missing updates could cause orphaned records and data inconsistency
  const Visit = require('../models/Visit');
  const Appointment = require('../models/Appointment');
  const Prescription = require('../models/Prescription');
  const Invoice = require('../models/Invoice');
  const Document = require('../models/Document');
  const OphthalmologyExam = require('../models/OphthalmologyExam');
  const ConsultationSession = require('../models/ConsultationSession');
  const AuditLog = require('../models/AuditLog');

  // Optional models that may not exist in all installations
  let GlassesOrder, LabOrder, ImagingOrder;
  try { GlassesOrder = require('../models/GlassesOrder'); } catch (e) { /* Optional */ }
  try { LabOrder = require('../models/LabOrder'); } catch (e) { /* Optional */ }
  try { ImagingOrder = require('../models/ImagingOrder'); } catch (e) { /* Optional */ }

  // Track all updates for audit log
  const updateResults = {
    visits: 0,
    appointments: 0,
    prescriptions: 0,
    invoices: 0,
    documents: 0,
    exams: 0,
    sessions: 0,
    glassesOrders: 0,
    labOrders: 0,
    imagingOrders: 0
  };

  // Perform all updates (use try-catch to handle optional collections)
  const updatePromises = [
    Visit.updateMany({ patient: secondaryPatient._id }, { patient: primaryPatient._id })
      .then(r => { updateResults.visits = r.modifiedCount; }),
    Appointment.updateMany({ patient: secondaryPatient._id }, { patient: primaryPatient._id })
      .then(r => { updateResults.appointments = r.modifiedCount; }),
    Prescription.updateMany({ patient: secondaryPatient._id }, { patient: primaryPatient._id })
      .then(r => { updateResults.prescriptions = r.modifiedCount; }),
    Invoice.updateMany({ patient: secondaryPatient._id }, { patient: primaryPatient._id })
      .then(r => { updateResults.invoices = r.modifiedCount; }),
    Document.updateMany({ patient: secondaryPatient._id }, { patient: primaryPatient._id })
      .then(r => { updateResults.documents = r.modifiedCount; }),
    OphthalmologyExam.updateMany({ patient: secondaryPatient._id }, { patient: primaryPatient._id })
      .then(r => { updateResults.exams = r.modifiedCount; }),
    ConsultationSession.updateMany({ patient: secondaryPatient._id }, { patient: primaryPatient._id })
      .then(r => { updateResults.sessions = r.modifiedCount; })
  ];

  // Add optional model updates
  if (GlassesOrder) {
    updatePromises.push(
      GlassesOrder.updateMany({ patient: secondaryPatient._id }, { patient: primaryPatient._id })
        .then(r => { updateResults.glassesOrders = r.modifiedCount; })
    );
  }
  if (LabOrder) {
    updatePromises.push(
      LabOrder.updateMany({ patient: secondaryPatient._id }, { patient: primaryPatient._id })
        .then(r => { updateResults.labOrders = r.modifiedCount; })
    );
  }
  if (ImagingOrder) {
    updatePromises.push(
      ImagingOrder.updateMany({ patient: secondaryPatient._id }, { patient: primaryPatient._id })
        .then(r => { updateResults.imagingOrders = r.modifiedCount; })
    );
  }

  await Promise.all(updatePromises);

  // Create audit log for the merge operation
  await AuditLog.create({
    user: req.user._id || req.user.id,
    action: 'PATIENT_MERGE',
    resource: '/api/patients/merge',
    resourceId: primaryPatient._id,
    ipAddress: req.ip,
    metadata: {
      primaryPatientId: primaryPatient.patientId,
      secondaryPatientId: secondaryPatient.patientId,
      recordsUpdated: updateResults
    }
  });

  // Save primary and soft-delete secondary
  await primaryPatient.save();
  secondaryPatient.status = 'inactive';
  secondaryPatient.notes = secondaryPatient.notes || [];
  secondaryPatient.notes.push({
    content: `Merged into patient ${primaryPatient.patientId}`,
    category: 'system',
    createdAt: new Date(),
    createdBy: req.user._id || req.user.id
  });
  await secondaryPatient.save();

  patientLogger.info('Patients merged successfully', {
    primaryPatient: primaryPatient.patientId,
    secondaryPatient: secondaryPatient.patientId,
    recordsUpdated: updateResults
  });

  return success(res, {
    message: 'Patients merged successfully',
    data: {
      primaryPatient: primaryPatient.patientId,
      mergedFrom: secondaryPatient.patientId,
      recordsUpdated: updateResults,
      totalRecordsMoved: Object.values(updateResults).reduce((a, b) => a + b, 0)
    }
  });
});

// @desc    Export patients to CSV
// @route   GET /api/patients/export
// @access  Private
exports.exportPatients = asyncHandler(async (req, res, next) => {
  const { format = 'csv', status = 'active' } = req.query;
  const pdfGenerator = require('../services/pdfGenerator');

  const patients = await Patient.find({ status })
    .select('patientId firstName lastName dateOfBirth gender phoneNumber email bloodType insurance.provider createdAt')
    .sort({ lastName: 1, firstName: 1 });

  if (format === 'pdf') {
    try {
      const pdfBuffer = await pdfGenerator.generatePatientListPDF(patients);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=patients.pdf');
      return res.send(pdfBuffer);
    } catch (pdfError) {
      patientLogger.error('PDF generation error', { error: pdfError.message });
      return error(res, {
        statusCode: 500,
        error: 'Error generating PDF'
      });
    }
  }

  if (format === 'csv') {
    const fields = [
      'patientId',
      'firstName',
      'lastName',
      'dateOfBirth',
      'gender',
      'phoneNumber',
      'email',
      'bloodType',
      'insurance',
      'createdAt'
    ];

    // SECURITY FIX: Sanitize CSV values to prevent formula injection attacks
    // Values starting with =, +, @, - can execute as formulas in Excel/Sheets
    const sanitizeCSVValue = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      // Escape quotes by doubling them
      let escaped = str.replace(/"/g, '""');
      // Prefix formula characters with apostrophe to prevent execution
      if (/^[=+@\-]/.test(escaped)) {
        escaped = `'${escaped}`;
      }
      return escaped;
    };

    let csv = `${fields.join(',')}\n`;

    patients.forEach(p => {
      const row = [
        sanitizeCSVValue(p.patientId),
        sanitizeCSVValue(p.firstName),
        sanitizeCSVValue(p.lastName),
        p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split('T')[0] : '',
        sanitizeCSVValue(p.gender),
        sanitizeCSVValue(p.phoneNumber),
        sanitizeCSVValue(p.email),
        sanitizeCSVValue(p.bloodType),
        sanitizeCSVValue(p.insurance?.provider),
        p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : ''
      ];
      csv += `${row.map(v => `"${v}"`).join(',')}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=patients.csv');
    return res.send(csv);
  }

  return success(res, { data: patients });
});

// @desc    Advanced patient search with filters
// @route   GET /api/patients/advanced-search
// @access  Private
exports.advancedSearch = asyncHandler(async (req, res, next) => {
  const {
    search,
    ageMin,
    ageMax,
    gender,
    bloodType,
    insurance,
    lastVisitFrom,
    lastVisitTo,
    hasAllergies,
    status = 'active',
    sort = '-createdAt'
  } = req.query;

  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(
    parseInt(req.query.limit) || PAGINATION.DEFAULT_PAGE_SIZE,
    PAGINATION.MAX_PAGE_SIZE
  );

  const query = { status };

  // Text search
  if (search) {
    const sanitizedSearch = escapeRegex(search);
    query.$or = [
      { firstName: { $regex: sanitizedSearch, $options: 'i' } },
      { lastName: { $regex: sanitizedSearch, $options: 'i' } },
      { patientId: { $regex: sanitizedSearch, $options: 'i' } },
      { phoneNumber: { $regex: sanitizedSearch, $options: 'i' } }
    ];
  }

  // Age filter
  if (ageMin || ageMax) {
    const now = new Date();
    if (ageMax) {
      const minBirthDate = new Date(now.getFullYear() - parseInt(ageMax) - 1, now.getMonth(), now.getDate());
      query.dateOfBirth = query.dateOfBirth || {};
      query.dateOfBirth.$gte = minBirthDate;
    }
    if (ageMin) {
      const maxBirthDate = new Date(now.getFullYear() - parseInt(ageMin), now.getMonth(), now.getDate());
      query.dateOfBirth = query.dateOfBirth || {};
      query.dateOfBirth.$lte = maxBirthDate;
    }
  }

  // Gender filter
  if (gender) {
    query.gender = gender;
  }

  // Blood type filter
  if (bloodType) {
    query.bloodType = bloodType;
  }

  // Insurance filter
  if (insurance) {
    query['insurance.provider'] = { $regex: escapeRegex(insurance), $options: 'i' };
  }

  // Last visit date filter
  if (lastVisitFrom || lastVisitTo) {
    query.lastVisit = {};
    if (lastVisitFrom) query.lastVisit.$gte = new Date(lastVisitFrom);
    if (lastVisitTo) query.lastVisit.$lte = new Date(lastVisitTo);
  }

  // Has allergies filter
  if (hasAllergies === 'true') {
    query['medicalHistory.allergies.0'] = { $exists: true };
  } else if (hasAllergies === 'false') {
    query['medicalHistory.allergies.0'] = { $exists: false };
  }

  const patients = await Patient.find(query)
    .limit(limit)
    .skip((page - 1) * limit)
    .sort(sort)
    .select('patientId firstName lastName dateOfBirth gender phoneNumber email bloodType insurance lastVisit status');

  const total = await Patient.countDocuments(query);

  res.status(200).json({
    success: true,
    count: patients.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: patients
  });
});

// @desc    Search patient by legacy ID
// @route   GET /api/patients/search/legacy/:legacyId
// @access  Private
exports.searchByLegacyId = asyncHandler(async (req, res, next) => {
  const { legacyId } = req.params;

  if (!legacyId) {
    return error(res, {
      statusCode: 400,
      error: 'Legacy ID is required'
    });
  }

  // Search across all legacy ID fields
  const patient = await Patient.findOne({
    $or: [
      { legacyId: legacyId },
      { legacyPatientNumber: legacyId },
      { 'folderIds.folderId': legacyId }
    ]
  }).select('patientId firstName lastName dateOfBirth phoneNumber email status legacyId legacyPatientNumber folderIds');

  if (!patient) {
    return notFound(res, 'Patient with this legacy ID');
  }

  return success(res, { data: patient });
});

// @desc    Link folder ID to patient
// @route   POST /api/patients/:id/link-folder
// @access  Private
exports.linkFolderToPatient = asyncHandler(async (req, res, next) => {
  const { deviceType, folderId, path } = req.body;

  if (!deviceType || !folderId) {
    return error(res, {
      statusCode: 400,
      error: 'Device type and folder ID are required'
    });
  }

  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Check if this folder is already linked
  const existingLink = patient.folderIds?.find(
    f => f.deviceType === deviceType && f.folderId === folderId
  );

  if (existingLink) {
    return error(res, {
      statusCode: 400,
      error: 'This folder is already linked to this patient'
    });
  }

  // Check if this folder is linked to another patient
  const otherPatient = await Patient.findOne({
    _id: { $ne: patient._id },
    'folderIds.deviceType': deviceType,
    'folderIds.folderId': folderId
  });

  if (otherPatient) {
    return error(res, {
      statusCode: 400,
      error: `This folder is already linked to patient ${otherPatient.patientId} (${otherPatient.firstName} ${otherPatient.lastName})`
    });
  }

  // Add the folder link
  if (!patient.folderIds) {
    patient.folderIds = [];
  }

  patient.folderIds.push({
    deviceType,
    folderId,
    path: path || null,
    linkedAt: new Date(),
    linkedBy: req.user.id
  });

  await patient.save();

  return success(res, {
    message: 'Folder linked successfully',
    data: patient.folderIds
  });
});

// @desc    Unlink folder ID from patient
// @route   DELETE /api/patients/:id/unlink-folder/:folderId
// @access  Private
exports.unlinkFolderFromPatient = asyncHandler(async (req, res, next) => {
  const { folderId } = req.params;

  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  if (!patient.folderIds || patient.folderIds.length === 0) {
    return error(res, {
      statusCode: 400,
      error: 'No folders linked to this patient'
    });
  }

  const folderIndex = patient.folderIds.findIndex(f => f.folderId === folderId);

  if (folderIndex === -1) {
    return notFound(res, 'Folder link');
  }

  patient.folderIds.splice(folderIndex, 1);
  await patient.save();

  return success(res, {
    message: 'Folder unlinked successfully',
    data: patient.folderIds
  });
});

// @desc    Get patients with legacy data
// @route   GET /api/patients/with-legacy-data
// @access  Private
exports.getPatientsWithLegacyData = asyncHandler(async (req, res, next) => {
  const { deviceType } = req.query;

  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(
    parseInt(req.query.limit) || 50,
    PAGINATION.MAX_PAGE_SIZE
  );

  const query = {
    $or: [
      { legacyId: { $exists: true, $ne: null } },
      { legacyPatientNumber: { $exists: true, $ne: null } },
      { 'folderIds.0': { $exists: true } }
    ]
  };

  if (deviceType) {
    query['folderIds.deviceType'] = deviceType;
  }

  const patients = await Patient.find(query)
    .select('patientId firstName lastName dateOfBirth legacyId legacyPatientNumber folderIds')
    .limit(limit)
    .skip((page - 1) * limit)
    .sort({ lastName: 1, firstName: 1 });

  const total = await Patient.countDocuments(query);

  res.status(200).json({
    success: true,
    count: patients.length,
    total,
    pages: Math.ceil(total / limit),
    data: patients
  });
});

// ========================================
// Patient Alerts Management
// ========================================

// @desc    Get patient alerts
// @route   GET /api/patients/:id/alerts
// @access  Private
exports.getPatientAlerts = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Get active alerts (not dismissed, not expired)
  const activeAlerts = await patient.getActiveAlerts();

  return success(res, {
    count: activeAlerts.length,
    data: activeAlerts
  });
});

// @desc    Add alert to patient
// @route   POST /api/patients/:id/alerts
// @access  Private
exports.addPatientAlert = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const {
    type,
    message,
    messageFr,
    sourceType,
    priority,
    expiresAt
  } = req.body;

  if (!type || !message) {
    return error(res, {
      statusCode: 400,
      error: 'Type and message are required'
    });
  }

  try {
    await patient.addAlert({
      type,
      message,
      messageFr,
      sourceType,
      priority,
      expiresAt,
      autoGenerated: false
    });

    return success(res, {
      message: 'Alert added successfully',
      data: patient.patientAlerts
    }, 201);
  } catch (err) {
    return error(res, {
      statusCode: 400,
      error: err.message
    });
  }
});

// @desc    Dismiss patient alert
// @route   PUT /api/patients/:id/alerts/:alertId/dismiss
// @access  Private
exports.dismissPatientAlert = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  try {
    await patient.dismissAlert(req.params.alertId);

    return success(res, {
      message: 'Alert dismissed successfully'
    });
  } catch (err) {
    return error(res, {
      statusCode: 400,
      error: err.message
    });
  }
});

// @desc    Acknowledge patient alert
// @route   PUT /api/patients/:id/alerts/:alertId/acknowledge
// @access  Private
exports.acknowledgePatientAlert = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  try {
    await patient.acknowledgeAlert(req.params.alertId);

    return success(res, {
      message: 'Alert acknowledged successfully'
    });
  } catch (err) {
    return error(res, {
      statusCode: 400,
      error: err.message
    });
  }
});

// @desc    Sync allergy-based alerts
// @route   POST /api/patients/:id/alerts/sync-allergies
// @access  Private
exports.syncAllergyAlerts = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  try {
    await patient.syncAllergyAlerts();

    return success(res, {
      message: 'Allergy alerts synced successfully',
      data: patient.patientAlerts.filter(a => a.sourceType === 'allergy')
    });
  } catch (err) {
    return error(res, {
      statusCode: 400,
      error: err.message
    });
  }
});

// @desc    Generate overdue follow-up alerts
// @route   POST /api/patients/:id/alerts/generate-followup
// @access  Private
exports.generateFollowupAlerts = asyncHandler(async (req, res, next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  try {
    const alerts = await patient.generateOverdueFollowupAlerts();

    return success(res, {
      message: 'Follow-up alerts generated',
      count: alerts.length,
      data: alerts
    });
  } catch (err) {
    return error(res, {
      statusCode: 400,
      error: err.message
    });
  }
});
