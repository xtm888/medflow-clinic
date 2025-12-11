const { asyncHandler } = require('../middleware/errorHandler');
const CentralPatient = require('../models/CentralPatient');
const CentralVisit = require('../models/CentralVisit');

/**
 * @desc    Search patients across all clinics
 * @route   GET /api/patients/search
 * @access  Private (clinic auth)
 */
exports.searchAcrossClinics = asyncHandler(async (req, res) => {
  const { name, patientId, nationalId, phone, dob, excludeClinic, limit = 50 } = req.query;

  const searchParams = {};
  if (name) searchParams.name = name;
  if (patientId) searchParams.patientId = patientId;
  if (nationalId) searchParams.nationalId = nationalId;
  if (phone) searchParams.phone = phone;
  if (dob) searchParams.dob = dob;

  const patients = await CentralPatient.searchAcrossClinics(searchParams, {
    excludeClinic,
    limit: parseInt(limit)
  });

  res.json({
    success: true,
    count: patients.length,
    patients
  });
});

/**
 * @desc    Get full patient details with history
 * @route   GET /api/patients/:id/full
 * @access  Private (clinic auth)
 */
exports.getFullPatient = asyncHandler(async (req, res) => {
  const { sourceClinic } = req.query;
  const patientId = req.params.id;

  // Find the patient
  const query = {
    _deleted: { $ne: true },
    $or: [
      { _originalId: patientId },
      { patientId: patientId }
    ]
  };

  if (sourceClinic) {
    query._sourceClinic = sourceClinic;
  }

  const patient = await CentralPatient.findOne(query).lean();

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  // Get visits from the same source clinic
  const visits = await CentralVisit.find({
    'patient._id': patient._originalId,
    _sourceClinic: patient._sourceClinic,
    _deleted: { $ne: true }
  })
    .sort({ visitDate: -1 })
    .limit(20)
    .lean();

  // Get visits from OTHER clinics (if patient visited elsewhere)
  const otherClinicVisits = await CentralVisit.find({
    'patient.patientId': patient.patientId,
    _sourceClinic: { $ne: patient._sourceClinic },
    _deleted: { $ne: true }
  })
    .sort({ visitDate: -1 })
    .limit(10)
    .lean();

  res.json({
    success: true,
    patient,
    visits,
    otherClinicVisits,
    sourceClinic: patient._sourceClinic
  });
});

/**
 * @desc    Get patient records from all clinics
 * @route   GET /api/patients/:id/all-clinics
 * @access  Private (clinic auth)
 */
exports.getPatientAllClinics = asyncHandler(async (req, res) => {
  const identifier = req.params.id;

  const records = await CentralPatient.getPatientAllClinics(identifier);

  if (records.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found in any clinic'
    });
  }

  // Group visits by clinic
  const clinicData = {};
  for (const record of records) {
    const visits = await CentralVisit.find({
      'patient._id': record._originalId,
      _sourceClinic: record._sourceClinic,
      _deleted: { $ne: true }
    })
      .sort({ visitDate: -1 })
      .limit(10)
      .lean();

    clinicData[record._sourceClinic] = {
      patient: record,
      visits,
      visitCount: visits.length
    };
  }

  res.json({
    success: true,
    identifier,
    clinics: Object.keys(clinicData),
    data: clinicData
  });
});

/**
 * @desc    Get patient visit history across clinics
 * @route   GET /api/patients/:id/history
 * @access  Private (clinic auth)
 */
exports.getPatientHistory = asyncHandler(async (req, res) => {
  const patientId = req.params.id;
  const { limit = 50 } = req.query;

  const visits = await CentralVisit.getPatientHistory(patientId, {
    limit: parseInt(limit)
  });

  res.json({
    success: true,
    patientId,
    count: visits.length,
    visits
  });
});

/**
 * @desc    Check if patient exists in other clinics
 * @route   GET /api/patients/check-exists
 * @access  Private (clinic auth)
 */
exports.checkPatientExists = asyncHandler(async (req, res) => {
  const { firstName, lastName, dob, nationalId, phone, excludeClinic } = req.query;

  const query = {
    _deleted: { $ne: true }
  };

  if (excludeClinic) {
    query._sourceClinic = { $ne: excludeClinic };
  }

  // Build OR conditions for matching
  const orConditions = [];

  if (nationalId) {
    orConditions.push({ nationalId });
  }

  if (firstName && lastName && dob) {
    orConditions.push({
      firstName: new RegExp(`^${firstName}$`, 'i'),
      lastName: new RegExp(`^${lastName}$`, 'i'),
      dateOfBirth: new Date(dob)
    });
  }

  if (phone) {
    orConditions.push({
      'contact.phone': new RegExp(phone.replace(/\D/g, ''))
    });
  }

  if (orConditions.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Please provide nationalId, or firstName+lastName+dob, or phone'
    });
  }

  query.$or = orConditions;

  const matches = await CentralPatient.find(query)
    .select('patientId firstName lastName dateOfBirth _sourceClinic contact.phone nationalId')
    .limit(10)
    .lean();

  res.json({
    success: true,
    exists: matches.length > 0,
    matches: matches.map(m => ({
      patientId: m.patientId,
      name: `${m.firstName} ${m.lastName}`,
      dob: m.dateOfBirth,
      phone: m.contact?.phone,
      nationalId: m.nationalId,
      clinic: m._sourceClinic
    }))
  });
});

/**
 * @desc    Get patient statistics across all clinics
 * @route   GET /api/patients/stats
 * @access  Private (clinic auth)
 */
exports.getPatientStats = asyncHandler(async (req, res) => {
  const stats = await CentralPatient.aggregate([
    { $match: { _deleted: { $ne: true } } },
    {
      $group: {
        _id: '$_sourceClinic',
        totalPatients: { $sum: 1 },
        maleCount: {
          $sum: { $cond: [{ $eq: ['$gender', 'male'] }, 1, 0] }
        },
        femaleCount: {
          $sum: { $cond: [{ $eq: ['$gender', 'female'] }, 1, 0] }
        },
        withInsurance: {
          $sum: { $cond: ['$insurance.hasInsurance', 1, 0] }
        },
        recentlyAdded: {
          $sum: {
            $cond: [
              { $gte: ['$createdAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
              1, 0
            ]
          }
        }
      }
    }
  ]);

  // Get unique patient count (by nationalId where available)
  const uniquePatients = await CentralPatient.aggregate([
    { $match: { _deleted: { $ne: true }, nationalId: { $ne: null } } },
    { $group: { _id: '$nationalId' } },
    { $count: 'count' }
  ]);

  res.json({
    success: true,
    byClinic: stats,
    uniquePatientsWithNationalId: uniquePatients[0]?.count || 0,
    totalRecords: stats.reduce((sum, s) => sum + s.totalPatients, 0)
  });
});
