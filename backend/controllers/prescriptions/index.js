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

  // Refills
  refillPrescription: drugController.refillPrescription,
  getRefillHistory: drugController.getRefillHistory,

  // Pharmacy Status
  updatePharmacyStatus: drugController.updatePharmacyStatus,
  sendToPharmacy: drugController.sendToPharmacy,

  // Drug Safety
  checkDrugInteractions: drugController.checkDrugInteractions,
  runSafetyCheck: drugController.runSafetyCheck,
  getDrugSafetyStatus: drugController.getDrugSafetyStatus,
  getDrugPrescriptions: drugController.getDrugPrescriptions,
  createDrugPrescription: drugController.createDrugPrescription,

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
  transmitEPrescription: ePrescribingController.transmitEPrescription,
  getEPrescriptionStatus: ePrescribingController.getEPrescriptionStatus,
  cancelEPrescription: ePrescribingController.cancelEPrescription,
  respondToRefillRequest: ePrescribingController.respondToRefillRequest,

  // Pharmacy Integration
  searchEPrescribingPharmacies: ePrescribingController.searchEPrescribingPharmacies,
  verifyPharmacy: ePrescribingController.verifyPharmacy,
  getEPrescribingServiceStatus: ePrescribingController.getEPrescribingServiceStatus,

  // Prior Authorization
  requestPriorAuthorization: ePrescribingController.requestPriorAuthorization,
  updatePriorAuthorization: ePrescribingController.updatePriorAuthorization,
  getPriorAuthorizationStatus: ePrescribingController.getPriorAuthorizationStatus,
  getPendingPriorAuthorizations: ePrescribingController.getPendingPriorAuthorizations,

  // =====================================================
  // Backward Compatibility Aliases
  // =====================================================
  // Routes may use different names - map them here
  transmitPrescription: ePrescribingController.transmitEPrescription,
  getTransmissionStatus: ePrescribingController.getEPrescriptionStatus,
  cancelTransmission: ePrescribingController.cancelEPrescription,
  handleRefillResponse: ePrescribingController.respondToRefillRequest,
  searchPharmacies: ePrescribingController.searchEPrescribingPharmacies,
  getEPrescribingStatus: ePrescribingController.getEPrescribingServiceStatus,
  submitPriorAuthorization: ePrescribingController.requestPriorAuthorization,
  updatePriorAuthorizationStatus: ePrescribingController.updatePriorAuthorization,
  getPendingAuthorizations: ePrescribingController.getPendingPriorAuthorizations
};
