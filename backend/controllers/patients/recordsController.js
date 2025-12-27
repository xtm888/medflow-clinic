/**
 * Patient Records Controller
 *
 * Handles medical records, history, medications, allergies, documents, and related data.
 */

const {
  Patient,
  asyncHandler,
  escapeRegex,
  success,
  error,
  notFound,
  findPatientByIdOrCode,
  patientLogger,
  PAGINATION
} = require('./shared');

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
  const Appointment = require('../../models/Appointment');

  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Limit results to prevent DoS - use pagination for more
  const limit = Math.min(parseInt(req.query.limit) || 100, 100);
  const appointments = await Appointment.find({ patient: patient._id })
    .populate('provider', 'firstName lastName specialization')
    .sort('-date')
    .limit(limit);

  return success(res, {
    data: appointments,
    meta: { limited: appointments.length === limit }
  });
});

// @desc    Get patient prescriptions
// @route   GET /api/patients/:id/prescriptions
// @access  Private
exports.getPatientPrescriptions = asyncHandler(async (req, res, next) => {
  const Prescription = require('../../models/Prescription');

  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Limit results to prevent DoS - use pagination for more
  const limit = Math.min(parseInt(req.query.limit) || 100, 100);
  const prescriptions = await Prescription.find({ patient: patient._id })
    .populate('prescriber', 'firstName lastName')
    .sort('-dateIssued')
    .limit(limit);

  return success(res, {
    data: prescriptions,
    meta: { limited: prescriptions.length === limit }
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

  // Parse pagination params with safety limits
  const limit = Math.min(parseInt(req.query.limit) || 100, PAGINATION.MAX_PAGE_SIZE);
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;

  const Visit = require('../../models/Visit');
  const OphthalmologyExam = require('../../models/OphthalmologyExam');
  const ConsultationSession = require('../../models/ConsultationSession');

  // Fetch visits, ophthalmology exams, and consultation sessions in parallel
  // Apply limits to prevent unbounded queries for patients with long history
  const [visits, ophthalmologyExams, sessions] = await Promise.all([
    Visit.find({ patient: patient._id })
      .populate('primaryProvider', 'firstName lastName')
      .sort({ visitDate: -1 })
      .limit(limit)
      .skip(skip)
      .select('visitId visitDate visitType status chiefComplaint diagnoses primaryProvider signatureStatus signedBy signedAt createdAt consultationSession'),
    OphthalmologyExam.find({ patient: patient._id })
      .populate('examiner', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('examId examType status iop refraction keratometry currentCorrection visualAcuity assessment examiner createdAt updatedAt'),
    ConsultationSession.find({ patient: patient._id, status: 'completed' })
      .populate('doctor', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit)
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

  const Document = require('../../models/Document');
  // Limit results to prevent DoS - use pagination for more
  const limit = Math.min(parseInt(req.query.limit) || 100, 100);
  const documents = await Document.find({ patient: patient._id, deleted: false })
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('title type category createdAt file.originalName file.size');

  return success(res, {
    data: documents,
    meta: { limited: documents.length === limit }
  });
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
  const Visit = require('../../models/Visit');
  const Appointment = require('../../models/Appointment');
  const Prescription = require('../../models/Prescription');

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

  const Visit = require('../../models/Visit');
  const Appointment = require('../../models/Appointment');

  // Get unique providers from visits and appointments
  const [visitProviders, appointmentProviders] = await Promise.all([
    Visit.find({ patient: patient._id })
      .distinct('primaryProvider'),
    Appointment.find({ patient: patient._id })
      .distinct('provider')
  ]);

  const allProviderIds = [...new Set([...visitProviders, ...appointmentProviders])];

  const User = require('../../models/User');
  const providers = await User.find({ _id: { $in: allProviderIds } })
    .select('firstName lastName role specialization email');

  // OPTIMIZATION: Use aggregation to get all provider visit counts in a single query
  // instead of N+1 individual countDocuments calls
  const providerVisitCounts = await Visit.aggregate([
    { $match: {
      patient: patient._id,
      primaryProvider: { $in: providers.map(p => p._id) }
    }},
    { $group: { _id: '$primaryProvider', count: { $sum: 1 } }}
  ]);

  const countMap = new Map(
    providerVisitCounts.map(p => [p._id.toString(), p.count])
  );

  const providersWithStats = providers.map(provider => ({
    ...provider.toObject(),
    visitCount: countMap.get(provider._id.toString()) || 0
  }));

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
    const AuditLog = require('../../models/AuditLog');
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

  const Visit = require('../../models/Visit');
  const Appointment = require('../../models/Appointment');
  const Prescription = require('../../models/Prescription');

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
    const LabResult = require('../../models/LabResult');
    const labResults = await LabResult.find({ patient: patient._id })
      .populate('labOrder', 'orderId priority')
      .populate('performedBy', 'firstName lastName')
      .populate('verifiedBy', 'firstName lastName')
      .sort({ performedAt: -1 });

    if (labResults.length > 0) {
      return success(res, { data: labResults });
    }

    // Fall back to Visit-embedded laboratory orders
    const Visit = require('../../models/Visit');
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
    const Correspondence = require('../../models/Correspondence');
    // Limit results to prevent DoS - use pagination for more
    const limit = Math.min(parseInt(req.query.limit) || 100, 100);
    const correspondence = await Correspondence.find({ patient: patient._id })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit);

    return success(res, {
      data: correspondence,
      meta: { limited: correspondence.length === limit }
    });
  } catch (err) {
    return success(res, { data: [] });
  }
});
