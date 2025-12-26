/**
 * Prescription Controllers Index
 *
 * Re-exports all prescription-related controller functions for backward compatibility.
 * The original prescriptionController.js (4,725 lines) has been split into:
 *
 * - coreController.js: Core CRUD, signing, verification, PDF, templates, statistics
 * - drugController.js: Dispensing, refills, pharmacy status, drug safety checks
 * - opticalController.js: Optical Rx CRUD, lens calculations, frame recommendations
 * - ePrescribingController.js: NCPDP transmission, prior authorization workflows
 */

const coreController = require('./coreController');
const drugController = require('./drugController');
const opticalController = require('./opticalController');
const ePrescribingController = require('./ePrescribingController');

// Re-export all functions maintaining backward compatibility
module.exports = {
  // =====================================================
  // Core Controller Functions
  // =====================================================
  // CRUD Operations
  getPrescriptions: coreController.getPrescriptions,
  getPrescription: coreController.getPrescription,
  createPrescription: coreController.createPrescription,
  createPrescriptionWithSafetyOverride: coreController.createPrescriptionWithSafetyOverride,
  updatePrescription: coreController.updatePrescription,
  cancelPrescription: coreController.cancelPrescription,
  deletePrescription: coreController.deletePrescription,

  // Signature & Verification
  signPrescription: coreController.signPrescription,
  verifyPrescription: coreController.verifyPrescription,

  // Invoice
  createInvoiceForPrescription: coreController.createInvoiceForPrescription,

  // Printing & PDF
  printPrescription: coreController.printPrescription,
  generatePDF: coreController.generatePDF,

  // Renewal & Validation
  renewPrescription: coreController.renewPrescription,
  validatePrescription: coreController.validatePrescription,

  // Templates
  getTemplates: coreController.getTemplates,
  createTemplate: coreController.createTemplate,
  getTemplate: coreController.getTemplate,
  updateTemplate: coreController.updateTemplate,
  deleteTemplate: coreController.deleteTemplate,

  // Statistics & History
  getStatistics: coreController.getStatistics,
  getExpiredPrescriptions: coreController.getExpiredPrescriptions,
  getPrescriptionHistory: coreController.getPrescriptionHistory,

  // Clone & Bulk
  clonePrescription: coreController.clonePrescription,
  bulkCreatePrescriptions: coreController.bulkCreatePrescriptions,

  // Patient/Provider Queries
  getActivePrescriptions: coreController.getActivePrescriptions,
  getProviderPrescriptions: coreController.getProviderPrescriptions,

  // Utilities
  generateQRCode: coreController.generateQRCode,
  sendToPatient: coreController.sendToPatient,
  checkInsuranceCoverage: coreController.checkInsuranceCoverage,

  // =====================================================
  // Drug Controller Functions
  // =====================================================
  // Dispensing
  dispensePrescription: drugController.dispensePrescription,
  getDispensingHistory: drugController.getDispensingHistory,

  // Refills
  requestRefill: drugController.requestRefill,
  processRefillRequest: drugController.processRefillRequest,
  getRefillHistory: drugController.getRefillHistory,

  // Pharmacy Status
  updatePharmacyStatus: drugController.updatePharmacyStatus,
  getPharmacyQueue: drugController.getPharmacyQueue,

  // Drug Safety
  checkDrugInteractions: drugController.checkDrugInteractions,
  runSafetyCheck: drugController.runSafetyCheck,
  getPatientMedications: drugController.getPatientMedications,

  // =====================================================
  // Optical Controller Functions
  // =====================================================
  getOpticalPrescriptions: opticalController.getOpticalPrescriptions,
  createOpticalPrescription: opticalController.createOpticalPrescription,
  updateOpticalPrescription: opticalController.updateOpticalPrescription,
  getLensOptions: opticalController.getLensOptions,
  calculateLensPower: opticalController.calculateLensPower,
  getFrameRecommendations: opticalController.getFrameRecommendations,

  // =====================================================
  // E-Prescribing Controller Functions
  // =====================================================
  // NCPDP Transmission
  transmitPrescription: ePrescribingController.transmitPrescription,
  getTransmissionStatus: ePrescribingController.getTransmissionStatus,
  cancelTransmission: ePrescribingController.cancelTransmission,
  handleRefillResponse: ePrescribingController.handleRefillResponse,

  // Pharmacy Integration
  searchPharmacies: ePrescribingController.searchPharmacies,
  verifyPharmacy: ePrescribingController.verifyPharmacy,
  getEPrescribingStatus: ePrescribingController.getEPrescribingStatus,

  // Prior Authorization
  submitPriorAuthorization: ePrescribingController.submitPriorAuthorization,
  updatePriorAuthorizationStatus: ePrescribingController.updatePriorAuthorizationStatus,
  getPriorAuthorizationStatus: ePrescribingController.getPriorAuthorizationStatus,
  getPendingAuthorizations: ePrescribingController.getPendingAuthorizations,

  // =====================================================
  // Backward Compatibility Aliases
  // =====================================================
  // E-Prescribing aliases (old names -> new functions)
  transmitEPrescription: ePrescribingController.transmitPrescription,
  getEPrescriptionStatus: ePrescribingController.getTransmissionStatus,
  cancelEPrescription: ePrescribingController.cancelTransmission,
  respondToRefillRequest: ePrescribingController.handleRefillResponse,
  searchEPrescribingPharmacies: ePrescribingController.searchPharmacies,
  getEPrescribingServiceStatus: ePrescribingController.getEPrescribingStatus,

  // Prior Authorization aliases
  requestPriorAuthorization: ePrescribingController.submitPriorAuthorization,
  updatePriorAuthorization: ePrescribingController.updatePriorAuthorizationStatus,
  getPendingPriorAuthorizations: ePrescribingController.getPendingAuthorizations,

  // Drug controller aliases
  refillPrescription: drugController.processRefillRequest,

  // =====================================================
  // Drug Prescription Functions (migrated from prescriptionController)
  // =====================================================
  // These map to appropriate functions in the modular controllers
  getDrugSafetyStatus: drugController.runSafetyCheck,
  getDrugPrescriptions: coreController.getPrescriptions, // Filter by type='medication' in route
  createDrugPrescription: coreController.createPrescription, // Type specified in request body
  sendToPharmacy: drugController.updatePharmacyStatus
};
