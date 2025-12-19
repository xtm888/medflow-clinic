const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescriptionController');
const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logPrescriptionActivity } = require('../middleware/auditLogger');
const { optionalClinic } = require('../middleware/clinicAuth');

// Protect all routes and add clinic context
router.use(protect);
router.use(optionalClinic);

// ============================================
// SAFETY CHECK ROUTES - Must be before /:id routes
// ============================================
router.post(
  '/check-interactions',
  prescriptionController.checkDrugInteractions
);

router.post(
  '/safety-check',
  prescriptionController.runSafetyCheck
);

router.post(
  '/validate',
  requirePermission('view_prescriptions', 'create_prescriptions'),
  prescriptionController.validatePrescription
);

// Safety override - Create prescription with overridden safety warnings
// CRITICAL: Only doctors can override, and all overrides are audit logged
router.post(
  '/create-with-override',
  authorize('doctor', 'ophthalmologist'),
  logPrescriptionActivity,
  prescriptionController.createPrescriptionWithSafetyOverride
);

// Get drug safety service status (external APIs, local database stats)
router.get(
  '/drug-safety/status',
  prescriptionController.getDrugSafetyStatus
);

// ============================================
// TEMPLATE ROUTES
// ============================================
router.get(
  '/templates',
  prescriptionController.getTemplates
);

router.post(
  '/templates',
  requirePermission('create_prescriptions'),
  prescriptionController.createTemplate
);

router.get(
  '/templates/:templateId',
  prescriptionController.getTemplate
);

router.put(
  '/templates/:templateId',
  requirePermission('create_prescriptions'),
  prescriptionController.updateTemplate
);

router.delete(
  '/templates/:templateId',
  requirePermission('manage_system'),
  prescriptionController.deleteTemplate
);

// ============================================
// STATISTICS & REPORTING
// ============================================
router.get(
  '/statistics',
  requirePermission('view_prescriptions', 'create_prescriptions'),
  prescriptionController.getStatistics
);

router.get(
  '/expired',
  prescriptionController.getExpiredPrescriptions
);

// ============================================
// TYPE-SPECIFIC ROUTES (must be before /:id)
// ============================================
router.get(
  '/optical',
  prescriptionController.getOpticalPrescriptions
);

router.post(
  '/optical',
  requirePermission('create_prescriptions'),
  logPrescriptionActivity,
  prescriptionController.createOpticalPrescription
);

router.get(
  '/drug',
  prescriptionController.getDrugPrescriptions
);

router.post(
  '/drug',
  requirePermission('create_prescriptions'),
  logPrescriptionActivity,
  prescriptionController.createDrugPrescription
);

router.post(
  '/bulk',
  requirePermission('create_prescriptions'),
  logPrescriptionActivity,
  prescriptionController.bulkCreatePrescriptions
);

// ============================================
// PATIENT-SPECIFIC PRESCRIPTION ROUTES
// ============================================
router.get(
  '/patient/:patientId/active',
  prescriptionController.getActivePrescriptions
);

// ============================================
// PROVIDER-SPECIFIC PRESCRIPTION ROUTES
// ============================================
router.get(
  '/provider/:providerId',
  prescriptionController.getProviderPrescriptions
);

// ============================================
// MAIN CRUD ROUTES
// ============================================
router
  .route('/')
  .get(prescriptionController.getPrescriptions)
  .post(
    requirePermission('create_prescriptions'),
    logPrescriptionActivity,
    prescriptionController.createPrescription
  );

router
  .route('/:id')
  .get(logPrescriptionActivity, prescriptionController.getPrescription)
  .put(
    requirePermission('create_prescriptions'),
    logPrescriptionActivity,
    prescriptionController.updatePrescription
  )
  .delete(
    requirePermission('create_prescriptions'),
    logPrescriptionActivity,
    prescriptionController.deletePrescription
  );

// ============================================
// PRESCRIPTION ACTIONS
// ============================================
router.put(
  '/:id/cancel',
  requirePermission('create_prescriptions'),
  logPrescriptionActivity,
  prescriptionController.cancelPrescription
);

router.put(
  '/:id/dispense',
  requirePermission('dispense_medications'),
  logPrescriptionActivity,
  prescriptionController.dispensePrescription
);

// Sign prescription (doctor signature)
router.put(
  '/:id/sign',
  authorize('doctor', 'ophthalmologist', 'admin'),
  logPrescriptionActivity,
  prescriptionController.signPrescription
);

// Create invoice for prescription (before dispensing) - enables "pay first, dispense on payment" workflow
router.post(
  '/:id/invoice',
  requirePermission('create_prescriptions', 'dispense_medications'),
  logPrescriptionActivity,
  prescriptionController.createInvoiceForPrescription
);

router.post(
  '/:id/verify',
  requirePermission('dispense_medications', 'create_prescriptions'),
  logPrescriptionActivity,
  prescriptionController.verifyPrescription
);

// ============================================
// PRINT & PDF ROUTES
// ============================================
router.get(
  '/:id/print',
  requirePermission('view_prescriptions', 'create_prescriptions'),
  logPrescriptionActivity,
  prescriptionController.printPrescription
);

router.get(
  '/:id/pdf',
  requirePermission('view_prescriptions', 'create_prescriptions'),
  logPrescriptionActivity,
  prescriptionController.generatePDF
);

// ============================================
// REFILL & RENEWAL ROUTES
// ============================================
router.post(
  '/:id/renew',
  requirePermission('create_prescriptions'),
  logPrescriptionActivity,
  prescriptionController.renewPrescription
);

router.post(
  '/:id/refill',
  requirePermission('dispense_medications'),
  logPrescriptionActivity,
  prescriptionController.refillPrescription
);

router.get(
  '/:id/refill-history',
  prescriptionController.getRefillHistory
);

// ============================================
// PHARMACY STATUS WORKFLOW
// ============================================
router.put(
  '/:id/pharmacy-status',
  requirePermission('dispense_medications'),
  prescriptionController.updatePharmacyStatus
);

router.post(
  '/:id/send-to-pharmacy',
  requirePermission('create_prescriptions'),
  prescriptionController.sendToPharmacy
);

// ============================================
// HISTORY & AUDIT
// ============================================
router.get(
  '/:id/history',
  prescriptionController.getPrescriptionHistory
);

// ============================================
// OPTICAL PRESCRIPTION SPECIFIC ROUTES
// ============================================
router.put(
  '/optical/:id',
  requirePermission('create_prescriptions'),
  logPrescriptionActivity,
  prescriptionController.updateOpticalPrescription
);

router.get(
  '/optical/:id/lens-options',
  prescriptionController.getLensOptions
);

router.post(
  '/optical/calculate-power',
  authorize('doctor', 'ophthalmologist', 'optometrist'),
  prescriptionController.calculateLensPower
);

router.get(
  '/optical/:id/frame-recommendations',
  prescriptionController.getFrameRecommendations
);

// ============================================
// QR CODE & SEND TO PATIENT
// ============================================
router.get(
  '/:id/qr-code',
  prescriptionController.generateQRCode
);

router.post(
  '/:id/send-to-patient',
  requirePermission('view_prescriptions', 'create_prescriptions'),
  prescriptionController.sendToPatient
);

// ============================================
// INSURANCE COVERAGE
// ============================================
router.get(
  '/:id/check-coverage',
  prescriptionController.checkInsuranceCoverage
);

// ============================================
// CLONE/COPY
// ============================================
router.post(
  '/:id/clone',
  requirePermission('create_prescriptions'),
  prescriptionController.clonePrescription
);

// ============================================
// E-PRESCRIBING (NCPDP) ROUTES
// ============================================
router.post(
  '/:id/e-prescribe',
  requirePermission('create_prescriptions'),
  logPrescriptionActivity,
  prescriptionController.transmitEPrescription
);

router.get(
  '/:id/e-prescribe/status',
  prescriptionController.getEPrescriptionStatus
);

router.post(
  '/:id/e-prescribe/cancel',
  requirePermission('create_prescriptions'),
  logPrescriptionActivity,
  prescriptionController.cancelEPrescription
);

router.post(
  '/:id/e-prescribe/refill-response',
  requirePermission('create_prescriptions'),
  logPrescriptionActivity,
  prescriptionController.respondToRefillRequest
);

router.get(
  '/e-prescribing/pharmacies',
  prescriptionController.searchEPrescribingPharmacies
);

router.get(
  '/e-prescribing/pharmacy/:ncpdpId/verify',
  prescriptionController.verifyPharmacy
);

router.get(
  '/e-prescribing/status',
  prescriptionController.getEPrescribingServiceStatus
);

// ============================================
// PRIOR AUTHORIZATION ROUTES
// ============================================
router.post(
  '/:id/prior-auth/request',
  authorize('doctor', 'ophthalmologist', 'admin', 'nurse'),
  logPrescriptionActivity,
  prescriptionController.requestPriorAuthorization
);

router.put(
  '/:id/prior-auth/update',
  authorize('admin', 'pharmacist'),
  logPrescriptionActivity,
  prescriptionController.updatePriorAuthorization
);

router.get(
  '/:id/prior-auth/status',
  prescriptionController.getPriorAuthorizationStatus
);

router.get(
  '/prior-auth/pending',
  authorize('admin', 'pharmacist', 'doctor', 'ophthalmologist'),
  prescriptionController.getPendingPriorAuthorizations
);

module.exports = router;
