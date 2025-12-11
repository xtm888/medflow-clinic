const express = require('express');
const router = express.Router();
const {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientHistory,
  getPatientAppointments,
  getPatientPrescriptions,
  uploadPatientDocument,
  searchPatients,
  getRecentPatients,
  getPatientVisits,
  getPatientAllergies,
  addPatientAllergy,
  updatePatientAllergy,
  deletePatientAllergy,
  getPatientMedications,
  addPatientMedication,
  updatePatientMedication,
  deletePatientMedication,
  updatePatientInsurance,
  getPatientInsurance,
  getPatientDocuments,
  getCompleteProfile,
  getMedicalIssues,
  updateMedicalIssue,
  getPatientProviders,
  getPatientAudit,
  getPatientStatistics,
  uploadPatientPhoto,
  getPatientByMRN,
  getPatientLabResults,
  getPatientCorrespondence,
  checkDuplicates,
  mergePatients,
  exportPatients,
  advancedSearch,
  restorePatient,
  getDeletedPatients,
  // Legacy integration
  searchByLegacyId,
  linkFolderToPatient,
  unlinkFolderFromPatient,
  getPatientsWithLegacyData
} = require('../controllers/patientController');

const { getPatientBilling } = require('../controllers/billing');
const pdfGenerator = require('../services/pdfGenerator');
const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logPatientDataAccess, logAction } = require('../middleware/auditLogger');
const { validatePatientCreate, validatePatientUpdate, validatePagination, validateObjectIdParam } = require('../middleware/validation');
const { optionalClinic } = require('../middleware/clinicAuth');

// Protect all routes
router.use(protect);
// Add clinic context (optional - allows cross-clinic patient lookup when needed)
router.use(optionalClinic);

// Routes
router
  .route('/')
  .get(requirePermission('view_patients'), validatePagination, getPatients)
  .post(requirePermission('register_patients'), validatePatientCreate, logAction('PATIENT_CREATE'), createPatient);

// Static routes must come before parameterized routes
router.get('/search', requirePermission('view_patients'), searchPatients);
router.get('/recent', requirePermission('view_patients'), getRecentPatients);

// Legacy integration routes
router.get('/search/legacy/:legacyId', requirePermission('view_patients'), searchByLegacyId);
router.get('/with-legacy-data', requirePermission('view_patients'), getPatientsWithLegacyData);

// Batch fetch patients by IDs - for API request batching
router.post('/batch', requirePermission('view_patients'), async (req, res) => {
  try {
    const { ids, allClinics } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'IDs array required' });
    }

    // Limit batch size for performance
    const limitedIds = ids.slice(0, 50);

    const Patient = require('../models/Patient');

    // Build query with optional clinic filtering
    // By default, batch fetches don't filter by clinic (IDs are specific)
    // But we can add filtering if needed for security
    const query = { _id: { $in: limitedIds } };

    // If user wants to restrict to their clinic's patients only
    if (!allClinics && req.clinicId && !req.accessAllClinics) {
      query.homeClinic = req.clinicId;
    }

    const patients = await Patient.find(query)
      .select('firstName lastName dateOfBirth gender patientId phoneNumber email bloodGroup medicalHistory insurance photo homeClinic');

    res.json(patients);
  } catch (error) {
    console.error('Batch fetch patients error:', error);
    res.status(500).json({ message: 'Error fetching patients' });
  }
});
router.get('/export', requirePermission('export_data'), exportPatients);
router.get('/advanced-search', requirePermission('view_patients'), advancedSearch);
router.post('/check-duplicates', requirePermission('register_patients'), checkDuplicates);
router.post('/merge', requirePermission('manage_patients'), logAction('PATIENT_MERGE'), mergePatients);
router.get('/mrn/:mrn', logPatientDataAccess, getPatientByMRN);

// Soft-delete management routes (Admin only)
router.get('/deleted', requirePermission('view_all_data'), getDeletedPatients);
router.put('/:id/restore', requirePermission('manage_patients'), logAction('PATIENT_RESTORE'), restorePatient);

router
  .route('/:id')
  .get(validateObjectIdParam, logPatientDataAccess, getPatient)
  .put(validatePatientUpdate, requirePermission('manage_patients'), logAction('PATIENT_UPDATE'), updatePatient)
  .delete(validateObjectIdParam, requirePermission('delete_patients'), logAction('PATIENT_DELETE'), deletePatient);

router.get('/:id/history', logPatientDataAccess, getPatientHistory);
router.get('/:id/appointments', logPatientDataAccess, getPatientAppointments);
router.get('/:id/prescriptions', logPatientDataAccess, getPatientPrescriptions);
router.get('/:id/visits', logPatientDataAccess, getPatientVisits);
router.get('/:id/billing', logPatientDataAccess, getPatientBilling);
router.get('/:id/complete-profile', logPatientDataAccess, getCompleteProfile);
router.get('/:id/statistics', logPatientDataAccess, getPatientStatistics);
router.get('/:id/providers', logPatientDataAccess, getPatientProviders);
router.get('/:id/audit', requirePermission('view_audit'), getPatientAudit);
router.get('/:id/lab-results', logPatientDataAccess, getPatientLabResults);
router.get('/:id/correspondence', logPatientDataAccess, getPatientCorrespondence);

// Patient Record PDF Export
router.get('/:id/record/pdf', requirePermission('export_data'), logAction('PATIENT_RECORD_EXPORT'), async (req, res) => {
  try {
    const Patient = require('../models/Patient');
    const Visit = require('../models/Visit');

    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Get options from query params
    const options = {
      includeVisits: req.query.includeVisits === 'true'
    };

    // If includeVisits, fetch recent visits
    if (options.includeVisits) {
      const visits = await Visit.find({ patient: patient._id })
        .sort({ visitDate: -1 })
        .limit(20)
        .select('visitDate chiefComplaint diagnoses status');
      patient.recentVisits = visits;
    }

    const pdfBuffer = await pdfGenerator.generatePatientRecordPDF(patient, options);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=patient-record-${patient.patientId}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating patient record PDF:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Photo upload
router.post('/:id/photo', requirePermission('manage_patients'), uploadPatientPhoto);

// Legacy folder linking
router.post('/:id/link-folder', requirePermission('manage_patients'), logAction('PATIENT_FOLDER_LINK'), linkFolderToPatient);
router.delete('/:id/unlink-folder/:folderId', requirePermission('manage_patients'), logAction('PATIENT_FOLDER_UNLINK'), unlinkFolderFromPatient);

// Documents
router
  .route('/:id/documents')
  .get(logPatientDataAccess, getPatientDocuments)
  .post(requirePermission('manage_medical_records'), uploadPatientDocument);

// Allergies
router
  .route('/:id/allergies')
  .get(logPatientDataAccess, getPatientAllergies)
  .post(requirePermission('manage_medical_records'), logAction('ALLERGY_ADD'), addPatientAllergy);

router
  .route('/:id/allergies/:allergyId')
  .put(requirePermission('manage_medical_records'), logAction('ALLERGY_UPDATE'), updatePatientAllergy)
  .delete(requirePermission('manage_medical_records'), logAction('ALLERGY_DELETE'), deletePatientAllergy);

// Medications
router
  .route('/:id/medications')
  .get(logPatientDataAccess, getPatientMedications)
  .post(requirePermission('create_prescriptions'), logAction('MEDICATION_ADD'), addPatientMedication);

router
  .route('/:id/medications/:medicationId')
  .put(requirePermission('create_prescriptions'), logAction('MEDICATION_UPDATE'), updatePatientMedication)
  .delete(requirePermission('create_prescriptions'), logAction('MEDICATION_DELETE'), deletePatientMedication);

// Insurance
router
  .route('/:id/insurance')
  .get(logPatientDataAccess, getPatientInsurance)
  .put(requirePermission('update_contact_info'), logAction('INSURANCE_UPDATE'), updatePatientInsurance);

// Medical issues
router.get('/:id/medical-issues', logPatientDataAccess, getMedicalIssues);
router.put('/:id/medical-issues/:issueId', requirePermission('manage_medical_records'), logAction('MEDICAL_ISSUE_UPDATE'), updateMedicalIssue);

module.exports = router;
