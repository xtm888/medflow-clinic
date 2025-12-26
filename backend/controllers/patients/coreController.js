/**
 * Patient Core Controller
 *
 * Handles CRUD operations for patients.
 */

const {
  Patient,
  asyncHandler,
  escapeRegex,
  paginateOffset,
  getPaginationParams,
  success,
  error,
  notFound,
  findPatientByIdOrCode,
  patientLogger,
  PAGINATION,
  websocketService,
  findPatientById
} = require('./shared');

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
  const Visit = require('../../models/Visit');

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
