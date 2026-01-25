/**
 * Patient Advanced Controller
 *
 * Handles search, merge, export, legacy data handling, and patient alerts.
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

// @desc    Check for duplicate patients
// @route   POST /api/patients/check-duplicates
// @access  Private
exports.checkDuplicates = asyncHandler(async (req, res, _next) => {
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
exports.mergePatients = asyncHandler(async (req, res, _next) => {
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
  const Visit = require('../../models/Visit');
  const Appointment = require('../../models/Appointment');
  const Prescription = require('../../models/Prescription');
  const Invoice = require('../../models/Invoice');
  const Document = require('../../models/Document');
  const OphthalmologyExam = require('../../models/OphthalmologyExam');
  const AuditLog = require('../../models/AuditLog');

  // Optional models that may not exist in all installations
  let GlassesOrder, LabOrder, ImagingOrder;
  try { GlassesOrder = require('../../models/GlassesOrder'); } catch (e) { /* Optional */ }
  try { LabOrder = require('../../models/LabOrder'); } catch (e) { /* Optional */ }
  try { ImagingOrder = require('../../models/ImagingOrder'); } catch (e) { /* Optional */ }

  // Track all updates for audit log
  const updateResults = {
    visits: 0,
    appointments: 0,
    prescriptions: 0,
    invoices: 0,
    documents: 0,
    exams: 0,
    glassesOrders: 0,
    labOrders: 0,
    imagingOrders: 0
  };

  // CRITICAL: Use transaction to ensure atomic merge - all updates succeed or all fail
  const { withTransactionRetry } = require('../../utils/transactions');

  try {
    await withTransactionRetry(async (session) => {
      // Perform all updates within transaction
      const visitResult = await Visit.updateMany(
        { patient: secondaryPatient._id },
        { patient: primaryPatient._id },
        { session }
      );
      updateResults.visits = visitResult.modifiedCount;

      const appointmentResult = await Appointment.updateMany(
        { patient: secondaryPatient._id },
        { patient: primaryPatient._id },
        { session }
      );
      updateResults.appointments = appointmentResult.modifiedCount;

      const prescriptionResult = await Prescription.updateMany(
        { patient: secondaryPatient._id },
        { patient: primaryPatient._id },
        { session }
      );
      updateResults.prescriptions = prescriptionResult.modifiedCount;

      const invoiceResult = await Invoice.updateMany(
        { patient: secondaryPatient._id },
        { patient: primaryPatient._id },
        { session }
      );
      updateResults.invoices = invoiceResult.modifiedCount;

      const documentResult = await Document.updateMany(
        { patient: secondaryPatient._id },
        { patient: primaryPatient._id },
        { session }
      );
      updateResults.documents = documentResult.modifiedCount;

      const examResult = await OphthalmologyExam.updateMany(
        { patient: secondaryPatient._id },
        { patient: primaryPatient._id },
        { session }
      );
      updateResults.exams = examResult.modifiedCount;

      // Optional model updates within same transaction
      if (GlassesOrder) {
        const goResult = await GlassesOrder.updateMany(
          { patient: secondaryPatient._id },
          { patient: primaryPatient._id },
          { session }
        );
        updateResults.glassesOrders = goResult.modifiedCount;
      }

      if (LabOrder) {
        const loResult = await LabOrder.updateMany(
          { patient: secondaryPatient._id },
          { patient: primaryPatient._id },
          { session }
        );
        updateResults.labOrders = loResult.modifiedCount;
      }

      if (ImagingOrder) {
        const ioResult = await ImagingOrder.updateMany(
          { patient: secondaryPatient._id },
          { patient: primaryPatient._id },
          { session }
        );
        updateResults.imagingOrders = ioResult.modifiedCount;
      }

      // Create audit log within transaction
      await AuditLog.create([{
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
      }], { session });

      // Save primary and soft-delete secondary within transaction
      await primaryPatient.save({ session });
      secondaryPatient.status = 'inactive';
      secondaryPatient.notes = secondaryPatient.notes || [];
      secondaryPatient.notes.push({
        content: `Merged into patient ${primaryPatient.patientId}`,
        category: 'system',
        createdAt: new Date(),
        createdBy: req.user._id || req.user.id
      });
      await secondaryPatient.save({ session });
    });
  } catch (txError) {
    patientLogger.error('Patient merge transaction failed', {
      primaryPatient: primaryPatient.patientId,
      secondaryPatient: secondaryPatient.patientId,
      error: txError.message
    });
    return error(res, {
      statusCode: 500,
      error: 'Failed to merge patients - transaction rolled back',
      details: txError.message
    });
  }

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
exports.exportPatients = asyncHandler(async (req, res, _next) => {
  const { format = 'csv', status = 'active' } = req.query;
  const pdfGenerator = require('../../services/pdfGenerator');

  // Safety limit for exports - 10,000 max to prevent memory issues
  const EXPORT_LIMIT = 10000;

  const patients = await Patient.find({ status })
    .select('patientId firstName lastName dateOfBirth gender phoneNumber email bloodType insurance.provider createdAt')
    .sort({ lastName: 1, firstName: 1 })
    .limit(EXPORT_LIMIT)
    .lean();

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
exports.advancedSearch = asyncHandler(async (req, res, _next) => {
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
exports.searchByLegacyId = asyncHandler(async (req, res, _next) => {
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
exports.linkFolderToPatient = asyncHandler(async (req, res, _next) => {
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
exports.unlinkFolderFromPatient = asyncHandler(async (req, res, _next) => {
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
exports.getPatientsWithLegacyData = asyncHandler(async (req, res, _next) => {
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
exports.getPatientAlerts = asyncHandler(async (req, res, _next) => {
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
exports.addPatientAlert = asyncHandler(async (req, res, _next) => {
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
exports.dismissPatientAlert = asyncHandler(async (req, res, _next) => {
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
exports.acknowledgePatientAlert = asyncHandler(async (req, res, _next) => {
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
exports.syncAllergyAlerts = asyncHandler(async (req, res, _next) => {
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
exports.generateFollowupAlerts = asyncHandler(async (req, res, _next) => {
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
