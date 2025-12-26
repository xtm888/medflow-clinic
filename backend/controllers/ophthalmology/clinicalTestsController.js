/**
 * Ophthalmology Clinical Tests Controller
 *
 * Handles specialized clinical test data entry and device integration.
 */

const {
  OphthalmologyExam,
  asyncHandler,
  success,
  error,
  notFound,
  findPatientByIdOrCode,
  ophthalmologyLogger,
  autoEvaluateAlerts
} = require('./shared');

// =====================================================
// SPECIALIZED TEST DATA
// =====================================================

// @desc    Save tonometry/IOP data
// @route   PUT /api/ophthalmology/exams/:id/tonometry
// @access  Private
exports.saveTonometryData = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  // Update IOP data
  exam.iop = {
    ...exam.iop,
    ...req.body
  };
  exam.updatedBy = req.user.id;
  await exam.save();

  // Update patient's IOP history for glaucoma monitoring
  const patient = await findPatientByIdOrCode(exam.patient);
  if (patient) {
    if (!patient.ophthalmology.iopHistory) {
      patient.ophthalmology.iopHistory = [];
    }
    patient.ophthalmology.iopHistory.push({
      date: new Date(),
      OD: req.body.OD?.value,
      OS: req.body.OS?.value,
      method: req.body.OD?.method || req.body.OS?.method,
      pachymetryOD: req.body.pachymetry?.OD,
      pachymetryOS: req.body.pachymetry?.OS,
      examId: exam._id
    });
    await patient.save();
  }

  // CRITICAL: Auto-evaluate clinical alerts for IOP values
  // High IOP can indicate acute angle closure glaucoma - an emergency
  const alertResult = await autoEvaluateAlerts(exam, req.user.id);

  return success(res, { data: { iop: exam.iop, alerts: alertResult }, message: 'Tonometry data saved successfully' });
});

// @desc    Save visual acuity data
// @route   PUT /api/ophthalmology/exams/:id/visual-acuity
// @access  Private
exports.saveVisualAcuityData = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  exam.visualAcuity = {
    ...exam.visualAcuity,
    ...req.body
  };
  exam.updatedBy = req.user.id;
  await exam.save();

  return success(res, { data: exam.visualAcuity, message: 'Visual acuity data saved successfully' });
});

// @desc    Save OCT results
// @route   PUT /api/ophthalmology/exams/:id/oct
// @access  Private
exports.saveOCTResults = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  // Update OCT in additional tests
  exam.additionalTests = exam.additionalTests || {};
  exam.additionalTests.oct = {
    ...exam.additionalTests.oct,
    ...req.body,
    performedAt: new Date()
  };
  exam.updatedBy = req.user.id;
  await exam.save();

  return success(res, { data: exam.additionalTests.oct, message: 'OCT results saved successfully' });
});

// @desc    Save visual field results
// @route   PUT /api/ophthalmology/exams/:id/visual-field
// @access  Private
exports.saveVisualFieldResults = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  // Update visual fields
  exam.visualFields = {
    ...exam.visualFields,
    ...req.body
  };

  // Also update additional tests visual field section
  exam.additionalTests = exam.additionalTests || {};
  exam.additionalTests.visualField = {
    performed: true,
    testType: req.body.method || 'humphrey',
    findings: req.body.findings,
    performedAt: new Date()
  };

  exam.updatedBy = req.user.id;
  await exam.save();

  // Update patient's visual field history for glaucoma monitoring
  const patient = await findPatientByIdOrCode(exam.patient);
  if (patient) {
    if (!patient.ophthalmology.visualFieldHistory) {
      patient.ophthalmology.visualFieldHistory = [];
    }
    patient.ophthalmology.visualFieldHistory.push({
      date: new Date(),
      OD: {
        md: req.body.OD?.meanDeviation,
        psd: req.body.OD?.patternStandardDeviation,
        vfi: req.body.OD?.visualFieldIndex,
        defects: req.body.OD?.defects
      },
      OS: {
        md: req.body.OS?.meanDeviation,
        psd: req.body.OS?.patternStandardDeviation,
        vfi: req.body.OS?.visualFieldIndex,
        defects: req.body.OS?.defects
      },
      examId: exam._id
    });
    await patient.save();
  }

  return success(res, { data: exam.visualFields, message: 'Visual field results saved successfully' });
});

// @desc    Save keratometry data
// @route   PUT /api/ophthalmology/exams/:id/keratometry
// @access  Private
exports.saveKeratometryData = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  exam.keratometry = {
    ...exam.keratometry,
    ...req.body
  };
  exam.updatedBy = req.user.id;
  await exam.save();

  return success(res, { data: exam.keratometry, message: 'Keratometry data saved successfully' });
});

// @desc    Save biometry data (for IOL calculation)
// @route   PUT /api/ophthalmology/exams/:id/biometry
// @access  Private
exports.saveBiometryData = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  // Store biometry data
  exam.biometry = {
    ...exam.biometry,
    ...req.body,
    measuredAt: new Date(),
    measuredBy: req.user.id
  };
  exam.updatedBy = req.user.id;
  await exam.save();

  return success(res, { data: exam.biometry, message: 'Biometry data saved successfully' });
});

// @desc    Save slit lamp examination
// @route   PUT /api/ophthalmology/exams/:id/slit-lamp
// @access  Private
exports.saveSlitLampExam = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  exam.slitLamp = {
    ...exam.slitLamp,
    ...req.body
  };
  exam.updatedBy = req.user.id;
  await exam.save();

  return success(res, { data: exam.slitLamp, message: 'Slit lamp examination saved successfully' });
});

// @desc    Save fundoscopy results
// @route   PUT /api/ophthalmology/exams/:id/fundoscopy
// @access  Private
exports.saveFundoscopyResults = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  exam.fundus = {
    ...exam.fundus,
    ...req.body
  };
  exam.updatedBy = req.user.id;
  await exam.save();

  return success(res, { data: exam.fundus, message: 'Fundoscopy results saved successfully' });
});

// @desc    Save diagnosis
// @route   PUT /api/ophthalmology/exams/:id/diagnosis
// @access  Private
exports.saveDiagnosis = asyncHandler(async (req, res, next) => {
  const Visit = require('../../models/Visit');
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  exam.assessment = {
    ...exam.assessment,
    diagnoses: req.body.diagnoses || exam.assessment?.diagnoses,
    summary: req.body.summary || exam.assessment?.summary
  };
  exam.updatedBy = req.user.id;
  await exam.save();

  // CRITICAL: Persist diagnoses to Visit.diagnoses for complete medical record
  let visitUpdated = false;
  if (exam.visit && req.body.diagnoses) {
    try {
      const visit = await Visit.findById(exam.visit);
      if (visit) {
        // Convert exam diagnoses format to Visit diagnoses format
        const visitDiagnoses = req.body.diagnoses.map(d => ({
          code: d.icdCode || d.code || 'OPHTH',
          description: d.diagnosis || d.description,
          type: d.type || 'primary',
          laterality: d.eye || d.laterality || 'NA',
          dateOfDiagnosis: new Date(),
          severity: d.severity || d.status,
          notes: d.notes,
          diagnosedBy: req.user.id
        }));

        // Replace existing ophthalmology diagnoses with new ones
        // Keep non-ophthalmology diagnoses if any
        visit.diagnoses = [
          ...visit.diagnoses.filter(d => d.code && !d.code.startsWith('H')), // Non-eye diagnoses
          ...visitDiagnoses
        ];

        await visit.save();
        visitUpdated = true;
      }
    } catch (visitErr) {
      ophthalmologyLogger.error('Error updating Visit diagnoses', { error: visitErr.message, stack: visitErr.stack });
      // Continue - don't fail if visit update fails
    }
  }

  // CRITICAL: Auto-evaluate clinical alerts for diagnoses
  // Some diagnoses may trigger urgent/emergency alerts
  const alertResult = await autoEvaluateAlerts(exam, req.user.id);

  return success(res, {
    assessment: exam.assessment,
    alerts: alertResult,
    visitUpdated
  }, 'Diagnosis saved successfully');
});

// =====================================================
// DEVICE INTEGRATION
// =====================================================

// @desc    Get available device measurements for exam
// @route   GET /api/ophthalmology/exams/:id/available-measurements
// @access  Private
exports.getAvailableDeviceMeasurements = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  const measurements = await OphthalmologyExam.getAvailableDeviceMeasurements(
    exam.patient,
    exam.createdAt
  );

  return success(res, { data: measurements });
});

// @desc    Link device measurement to exam
// @route   POST /api/ophthalmology/exams/:id/link-measurement
// @access  Private
exports.linkDeviceMeasurement = asyncHandler(async (req, res, next) => {
  const { measurementId, deviceId } = req.body;

  if (!measurementId || !deviceId) {
    return error(res, 'Measurement ID and Device ID are required');
  }

  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  await exam.linkDeviceMeasurement(measurementId, deviceId, req.user.id);

  return success(res, { data: exam, message: 'Device measurement linked successfully' });
});

// @desc    Apply device measurement to exam fields
// @route   POST /api/ophthalmology/exams/:id/apply-measurement
// @access  Private
exports.applyDeviceMeasurement = asyncHandler(async (req, res, next) => {
  const { measurementId } = req.body;

  if (!measurementId) {
    return error(res, 'Measurement ID is required');
  }

  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  await exam.applyDeviceMeasurement(measurementId, req.user.id);

  return success(res, { data: exam, message: 'Device measurement applied successfully' });
});

// @desc    Link device image to exam
// @route   POST /api/ophthalmology/exams/:id/link-image
// @access  Private
exports.linkDeviceImage = asyncHandler(async (req, res, next) => {
  const { imageId, deviceId } = req.body;

  if (!imageId || !deviceId) {
    return error(res, 'Image ID and Device ID are required');
  }

  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  await exam.linkDeviceImage(imageId, deviceId, req.user.id);

  return success(res, { data: exam, message: 'Device image linked successfully' });
});

// @desc    Get linked device measurements for exam
// @route   GET /api/ophthalmology/exams/:id/device-measurements
// @access  Private
exports.getLinkedDeviceMeasurements = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  const measurements = await exam.getDeviceMeasurements();

  return success(res, { data: measurements });
});

// @desc    Get linked device images for exam
// @route   GET /api/ophthalmology/exams/:id/device-images
// @access  Private
exports.getLinkedDeviceImages = asyncHandler(async (req, res, next) => {
  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  const images = await exam.getDeviceImages();

  return success(res, { data: images });
});

// @desc    Import device measurement directly
// @route   POST /api/ophthalmology/exams/:id/import-measurement
// @access  Private
exports.importDeviceMeasurement = asyncHandler(async (req, res, next) => {
  const { deviceType, measurementData } = req.body;

  const exam = await OphthalmologyExam.findById(req.params.id);

  if (!exam) {
    return notFound(res, 'Exam');
  }

  // Map device type to exam field
  const fieldMapping = {
    'autorefractor': 'refraction.objective.autorefractor',
    'keratometer': 'keratometry',
    'tonometer': 'iop',
    'lensmeter': 'currentCorrection.glasses',
    'biometer': 'biometry',
    'oct': 'additionalTests.oct',
    'perimeter': 'visualFields'
  };

  const targetField = fieldMapping[deviceType];

  if (!targetField) {
    return error(res, `Unknown device type: ${deviceType}`);
  }

  // Set the value at the nested path
  const setNestedValue = (obj, path, value) => {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    Object.assign(current[keys[keys.length - 1]] || {}, value);
    current[keys[keys.length - 1]] = { ...current[keys[keys.length - 1]], ...value };
  };

  setNestedValue(exam, targetField, measurementData);

  // Record import
  exam.deviceMeasurements = exam.deviceMeasurements || [];
  exam.deviceMeasurements.push({
    deviceType,
    importedAt: new Date(),
    importedBy: req.user.id,
    data: measurementData
  });

  exam.updatedBy = req.user.id;
  await exam.save();

  // CRITICAL: Check if visit is already completed - notify provider of late device data
  let lateDataNotification = null;
  if (exam.visit) {
    try {
      const Visit = require('../../models/Visit');
      const Alert = require('../../models/Alert');
      const visit = await Visit.findById(exam.visit)
        .populate('primaryProvider', 'firstName lastName')
        .populate('patient', 'firstName lastName patientId');

      if (visit && visit.status === 'completed') {
        // Visit is already completed - create notification for late device data
        const patientName = visit.patient
          ? `${visit.patient.firstName} ${visit.patient.lastName}`
          : 'Patient inconnu';

        const alert = await Alert.create({
          category: 'clinical',
          priority: 'medium',
          title: 'Donnees dispositif arrivees apres visite',
          message: `Nouvelles donnees ${deviceType.toUpperCase()} pour ${patientName} (Visite ${visit.visitId}) - La visite est deja terminee. Veuillez revoir les resultats.`,
          targetUsers: visit.primaryProvider ? [visit.primaryProvider._id] : [],
          targetRoles: ['ophthalmologist', 'optometrist'],
          metadata: {
            visitId: visit._id.toString(),
            visitNumber: visit.visitId,
            patientId: visit.patient?._id?.toString(),
            patientName,
            deviceType,
            examId: exam._id.toString(),
            type: 'late_device_data'
          },
          requiresAcknowledgment: true
        });

        lateDataNotification = {
          sent: true,
          alertId: alert._id,
          message: `Notification envoyee: donnees ${deviceType} arrivees apres la fin de la visite`
        };

        ophthalmologyLogger.info('Late data notification created for visit', { visitId: visit.visitId, deviceType });
      }
    } catch (notifyError) {
      ophthalmologyLogger.error('Error creating late data notification', { error: notifyError.message });
    }
  }

  return success(res, { exam, lateDataNotification }, `${deviceType} measurement imported successfully`);
});
