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
exports.getPatientHistory = asyncHandler(async (req, res, _next) => {
  const Visit = require('../../models/Visit');

  const patient = await findPatientByIdOrCode(req.params.id, {
    select: 'medicalHistory medications vitalSigns ophthalmology',
    populate: { path: 'medications.prescribedBy', select: 'firstName lastName' }
  });

  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Get visit statistics including refraction counts
  const [visitCount, visitsWithRefractions, lastVisitWithRefraction] = await Promise.all([
    Visit.countDocuments({ patient: patient._id }),
    Visit.countDocuments({
      patient: patient._id,
      'clinicalData.refractions.0': { $exists: true }
    }),
    Visit.findOne({
      patient: patient._id,
      'clinicalData.refractions.0': { $exists: true }
    })
      .sort({ visitDate: -1, date: -1 })
      .select('visitDate date clinicalData.refractions')
      .lean()
  ]);

  // Extract latest refraction data
  let lastRefraction = null;
  let lastRefractionDate = null;
  if (lastVisitWithRefraction?.clinicalData?.refractions?.length > 0) {
    const latestRef = lastVisitWithRefraction.clinicalData.refractions[0];
    lastRefraction = {
      od: latestRef.od ? {
        sphere: latestRef.od.sphere,
        cylinder: latestRef.od.cylinder,
        axis: latestRef.od.axis,
        addition: latestRef.od.addition,
        visualAcuity: latestRef.od.visualAcuity
      } : null,
      os: latestRef.os ? {
        sphere: latestRef.os.sphere,
        cylinder: latestRef.os.cylinder,
        axis: latestRef.os.axis,
        addition: latestRef.os.addition,
        visualAcuity: latestRef.os.visualAcuity
      } : null,
      type: latestRef.type,
      pd: latestRef.pd
    };
    lastRefractionDate = lastVisitWithRefraction.visitDate || lastVisitWithRefraction.date;
  }

  return success(res, {
    data: {
      medicalHistory: patient.medicalHistory,
      currentMedications: patient.medications ? patient.medications.filter(med => med.status === 'active') : [],
      vitalSigns: patient.vitalSigns,
      ophthalmology: patient.ophthalmology,
      // Include visit/refraction statistics
      visitCount,
      refractionCount: visitsWithRefractions,
      lastRefraction,
      lastRefractionDate
    }
  });
});

// @desc    Get patient appointments
// @route   GET /api/patients/:id/appointments
// @access  Private
exports.getPatientAppointments = asyncHandler(async (req, res, _next) => {
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
exports.getPatientPrescriptions = asyncHandler(async (req, res, _next) => {
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
exports.uploadPatientDocument = asyncHandler(async (req, res, _next) => {
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
exports.searchPatients = asyncHandler(async (req, res, _next) => {
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
exports.getRecentPatients = asyncHandler(async (req, res, _next) => {
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
exports.getPatientVisits = asyncHandler(async (req, res, _next) => {
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

  // Fetch visits and ophthalmology exams in parallel
  // OphthalmologyExam is now the single source of truth for clinical data
  // Apply limits to prevent unbounded queries for patients with long history
  const [visits, ophthalmologyExams] = await Promise.all([
    Visit.find({ patient: patient._id })
      .populate('primaryProvider', 'firstName lastName')
      .populate('ophthalmologyExam', 'iop refraction keratometry visualAcuity')
      .sort({ visitDate: -1, date: -1 })
      .limit(limit)
      .skip(skip)
      .select('visitId visitDate date visitType status chiefComplaint diagnoses primaryProvider signatureStatus signedBy signedAt createdAt ophthalmologyExam clinicalData notes'),
    OphthalmologyExam.find({ patient: patient._id })
      .populate('examiner', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('examId examType status iop refraction keratometry currentCorrection visualAcuity assessment examiner createdAt updatedAt')
  ]);

  // Merge ophthalmology exam data with visits or return as combined array
  // The frontend expects records with iop, refraction, keratometry, currentCorrection fields
  const combinedData = [
    // Process visits - enrich with ophthalmologyExam data if available, or use clinicalData from CareVision import
    ...visits.map(v => {
      const visitObj = v.toObject();
      // OphthalmologyExam is now the source of truth for clinical data
      const examData = visitObj.ophthalmologyExam;

      // Check for CareVision imported refraction data in clinicalData.refractions
      if (visitObj.clinicalData?.refractions && visitObj.clinicalData.refractions.length > 0) {
        // Map CareVision refraction data to frontend format
        const latestRefraction = visitObj.clinicalData.refractions[0]; // Most recent first
        visitObj.refraction = {
          subjective: {
            OD: latestRefraction.od ? {
              sphere: latestRefraction.od.sphere,
              cylinder: latestRefraction.od.cylinder,
              axis: latestRefraction.od.axis,
              add: latestRefraction.od.addition
            } : null,
            OS: latestRefraction.os ? {
              sphere: latestRefraction.os.sphere,
              cylinder: latestRefraction.os.cylinder,
              axis: latestRefraction.os.axis,
              add: latestRefraction.os.addition
            } : null
          }
        };
        // Map visual acuity from CareVision data
        // CareVision stores: AVDL (distance/far VA), AVDP (near VA)
        // Frontend expects: uncorrected (AV sc = sans correction), corrected (AV ac = avec correction)
        // The refraction record's VA is the corrected VA achieved with that Rx
        if (latestRefraction.od?.visualAcuity || latestRefraction.os?.visualAcuity) {
          visitObj.visualAcuity = {
            OD: {
              // CareVision distance VA (AVDL) = corrected far vision with Rx
              corrected: latestRefraction.od?.visualAcuity?.distance,
              // CareVision near VA (AVDP) = near vision with Rx (for Add)
              near: latestRefraction.od?.visualAcuity?.near,
              // Keep original fields for compatibility
              distance: latestRefraction.od?.visualAcuity?.distance
            },
            OS: {
              corrected: latestRefraction.os?.visualAcuity?.distance,
              near: latestRefraction.os?.visualAcuity?.near,
              distance: latestRefraction.os?.visualAcuity?.distance
            },
            binocular: latestRefraction.binocular?.visualAcuity
          };
        }
        // Store all refractions for full history access
        visitObj.refractions = visitObj.clinicalData.refractions;
        // Mark as having ophthalmology data
        visitObj.type = 'ophthalmology';
        visitObj.hasLegacyRefraction = true;
      }

      // Map CareVision IOP data from clinicalData.iop
      // CareVision stores: clinicalData.iop.od / clinicalData.iop.os (just the value)
      // Frontend expects: iop.OD.value / iop.OS.value (nested with .value)
      if (visitObj.clinicalData?.iop && (visitObj.clinicalData.iop.od || visitObj.clinicalData.iop.os)) {
        visitObj.iop = {
          OD: visitObj.clinicalData.iop.od ? {
            value: visitObj.clinicalData.iop.od,
            method: visitObj.clinicalData.iop.method || 'unknown'
          } : null,
          OS: visitObj.clinicalData.iop.os ? {
            value: visitObj.clinicalData.iop.os,
            method: visitObj.clinicalData.iop.method || 'unknown'
          } : null
        };
        visitObj.hasLegacyIOP = true;
      }

      // If visit has linked ophthalmologyExam, extract clinical measurements
      // OphthalmologyExam is now the single source of truth for ophthalmology data
      if (examData) {
        // Map ophthalmologyExam data directly (fields are already in expected format)
        if (examData.iop) {
          visitObj.iop = examData.iop;
        }
        if (examData.refraction) {
          visitObj.refraction = examData.refraction;
        }
        if (examData.keratometry) {
          visitObj.keratometry = examData.keratometry;
        }
        if (examData.visualAcuity) {
          visitObj.visualAcuity = examData.visualAcuity;
        }
        // Mark as having ophthalmology data
        visitObj.type = 'ophthalmology';
      }
      // Normalize date field - use visitDate if available, otherwise use date (legacy CareVision data)
      if (!visitObj.visitDate && visitObj.date) {
        visitObj.visitDate = visitObj.date;
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

  // Sort combined data by date descending (check visitDate, date, then createdAt)
  combinedData.sort((a, b) => new Date(b.visitDate || b.date || b.createdAt) - new Date(a.visitDate || a.date || a.createdAt));

  return success(res, { data: combinedData });
});

// @desc    Get patient allergies
// @route   GET /api/patients/:id/allergies
// @access  Private
exports.getPatientAllergies = asyncHandler(async (req, res, _next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  return success(res, { data: patient.allergies || [] });
});

// @desc    Add patient allergy
// @route   POST /api/patients/:id/allergies
// @access  Private
exports.addPatientAllergy = asyncHandler(async (req, res, _next) => {
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
exports.updatePatientAllergy = asyncHandler(async (req, res, _next) => {
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
exports.deletePatientAllergy = asyncHandler(async (req, res, _next) => {
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
exports.getPatientMedications = asyncHandler(async (req, res, _next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  return success(res, { data: patient.medications || [] });
});

// @desc    Add patient medication
// @route   POST /api/patients/:id/medications
// @access  Private
exports.addPatientMedication = asyncHandler(async (req, res, _next) => {
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
exports.updatePatientMedication = asyncHandler(async (req, res, _next) => {
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
exports.deletePatientMedication = asyncHandler(async (req, res, _next) => {
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
exports.updatePatientInsurance = asyncHandler(async (req, res, _next) => {
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
exports.getPatientDocuments = asyncHandler(async (req, res, _next) => {
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
exports.getCompleteProfile = asyncHandler(async (req, res, _next) => {
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
exports.getMedicalIssues = asyncHandler(async (req, res, _next) => {
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
exports.updateMedicalIssue = asyncHandler(async (req, res, _next) => {
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
exports.getPatientProviders = asyncHandler(async (req, res, _next) => {
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
    } },
    { $group: { _id: '$primaryProvider', count: { $sum: 1 } } }
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
exports.getPatientAudit = asyncHandler(async (req, res, _next) => {
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
exports.getPatientStatistics = asyncHandler(async (req, res, _next) => {
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
exports.uploadPatientPhoto = asyncHandler(async (req, res, _next) => {
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
exports.getPatientByMRN = asyncHandler(async (req, res, _next) => {
  const patient = await Patient.findOne({ patientId: req.params.mrn });

  if (!patient) {
    return notFound(res, 'Patient');
  }

  return success(res, { data: patient });
});

// @desc    Get patient insurance
// @route   GET /api/patients/:id/insurance
// @access  Private
exports.getPatientInsurance = asyncHandler(async (req, res, _next) => {
  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  return success(res, { data: patient.insurance || {} });
});

// @desc    Get patient lab results
// @route   GET /api/patients/:id/lab-results
// @access  Private
exports.getPatientLabResults = asyncHandler(async (req, res, _next) => {
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
exports.getPatientCorrespondence = asyncHandler(async (req, res, _next) => {
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

// @desc    Record patient vital signs
// @route   POST /api/patients/:id/vitals
// @access  Private (Nurse, Doctor)
// @note    Finds or creates a visit for today and attaches vitals
exports.recordVitals = asyncHandler(async (req, res, _next) => {
  const Visit = require('../../models/Visit');
  const Appointment = require('../../models/Appointment');

  const patient = await findPatientByIdOrCode(req.params.id);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  const {
    bloodPressure,
    heartRate,
    temperature,
    weight,
    height,
    oxygenSaturation,
    respiratoryRate,
    notes
  } = req.body;

  // Validate at least one vital sign is provided
  if (!bloodPressure && !heartRate && !temperature && !weight && !height && !oxygenSaturation && !respiratoryRate) {
    return error(res, 'Au moins un signe vital est requis', 400);
  }

  const clinicId = req.clinicId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Look for an existing visit today for this patient
  let visit = await Visit.findOne({
    patient: patient._id,
    clinic: clinicId,
    visitDate: { $gte: today, $lt: tomorrow },
    status: { $in: ['checked-in', 'in-progress', 'with-nurse', 'pending'] }
  }).sort({ visitDate: -1 });

  let visitCreated = false;
  let appointmentUsed = null;

  // If no visit exists, check for today's appointment and create a quick visit
  if (!visit) {
    // Look for today's appointment
    const appointment = await Appointment.findOne({
      patient: patient._id,
      clinic: clinicId,
      date: { $gte: today, $lt: tomorrow },
      status: { $in: ['scheduled', 'confirmed', 'checked-in'] }
    }).sort({ startTime: 1 });

    if (appointment) {
      appointmentUsed = appointment;
    }

    // Create a new visit for vitals recording
    visit = new Visit({
      patient: patient._id,
      clinic: clinicId,
      visitDate: new Date(),
      status: 'with-nurse',
      visitType: appointment ? 'scheduled' : 'walk-in',
      appointment: appointment?._id,
      chiefComplaint: 'Enregistrement des signes vitaux',
      createdBy: req.user._id || req.user.id,
      physicalExamination: {
        vitalSigns: {}
      }
    });
    visitCreated = true;
  }

  // Ensure physicalExamination and vitalSigns exist
  if (!visit.physicalExamination) {
    visit.physicalExamination = {};
  }
  if (!visit.physicalExamination.vitalSigns) {
    visit.physicalExamination.vitalSigns = {};
  }

  // Update vital signs
  const vs = visit.physicalExamination.vitalSigns;
  if (bloodPressure) vs.bloodPressure = bloodPressure;
  if (heartRate) vs.heartRate = heartRate;
  if (temperature) vs.temperature = temperature;
  if (weight) vs.weight = weight;
  if (height) vs.height = height;
  if (oxygenSaturation) vs.oxygenSaturation = oxygenSaturation;
  if (respiratoryRate) vs.respiratoryRate = respiratoryRate;
  if (notes) vs.notes = notes;

  // Calculate BMI if height and weight are available
  if (vs.height && vs.weight) {
    const heightInMeters = vs.height / 100;
    vs.bmi = parseFloat((vs.weight / (heightInMeters * heightInMeters)).toFixed(1));
  }

  // Record who took the vitals
  vs.recordedBy = req.user._id || req.user.id;
  vs.recordedAt = new Date();

  await visit.save();

  // If we used an appointment, update its status
  if (appointmentUsed && appointmentUsed.status === 'scheduled') {
    appointmentUsed.status = 'checked-in';
    await appointmentUsed.save();
  }

  // Build response message
  let message = 'Signes vitaux enregistrés avec succès';
  if (visitCreated) {
    message += appointmentUsed
      ? ` (visite créée pour le rendez-vous de ${appointmentUsed.startTime || 'aujourd\'hui'})`
      : ' (nouvelle visite créée)';
  }

  patientLogger.info('Vitals recorded', {
    patientId: patient._id,
    visitId: visit._id,
    visitCreated,
    vitalSigns: vs,
    recordedBy: req.user._id
  });

  return success(res, {
    message,
    data: {
      visit: {
        _id: visit._id,
        status: visit.status,
        visitDate: visit.visitDate,
        visitType: visit.visitType
      },
      vitalSigns: vs,
      visitCreated
    }
  }, 201);
});
