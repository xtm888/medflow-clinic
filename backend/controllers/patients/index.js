/**
 * Patient Controllers Index
 *
 * Re-exports all patient controller functions for backward compatibility.
 * The original patientController.js (2,212 lines) has been split into:
 *
 * - coreController.js: CRUD operations (get, create, update, delete, restore)
 * - recordsController.js: Medical history, medications, allergies, documents, visits
 * - advancedController.js: Search, merge, export, legacy data, alerts
 */

const coreController = require('./coreController');
const recordsController = require('./recordsController');
const advancedController = require('./advancedController');

// Re-export all functions maintaining backward compatibility
module.exports = {
  // =====================================================
  // Core Controller Functions (CRUD)
  // =====================================================
  getPatients: coreController.getPatients,
  getPatient: coreController.getPatient,
  createPatient: coreController.createPatient,
  updatePatient: coreController.updatePatient,
  deletePatient: coreController.deletePatient,
  restorePatient: coreController.restorePatient,
  getDeletedPatients: coreController.getDeletedPatients,

  // =====================================================
  // Records Controller Functions
  // =====================================================
  // History & Visits
  getPatientHistory: recordsController.getPatientHistory,
  getPatientAppointments: recordsController.getPatientAppointments,
  getPatientPrescriptions: recordsController.getPatientPrescriptions,
  getPatientVisits: recordsController.getPatientVisits,

  // Allergies
  getPatientAllergies: recordsController.getPatientAllergies,
  addPatientAllergy: recordsController.addPatientAllergy,
  updatePatientAllergy: recordsController.updatePatientAllergy,
  deletePatientAllergy: recordsController.deletePatientAllergy,

  // Medications
  getPatientMedications: recordsController.getPatientMedications,
  addPatientMedication: recordsController.addPatientMedication,
  updatePatientMedication: recordsController.updatePatientMedication,
  deletePatientMedication: recordsController.deletePatientMedication,

  // Insurance
  updatePatientInsurance: recordsController.updatePatientInsurance,
  getPatientInsurance: recordsController.getPatientInsurance,

  // Documents
  uploadPatientDocument: recordsController.uploadPatientDocument,
  getPatientDocuments: recordsController.getPatientDocuments,

  // Search & Lists
  searchPatients: recordsController.searchPatients,
  getRecentPatients: recordsController.getRecentPatients,

  // Profile & Issues
  getCompleteProfile: recordsController.getCompleteProfile,
  getMedicalIssues: recordsController.getMedicalIssues,
  updateMedicalIssue: recordsController.updateMedicalIssue,

  // Providers & Audit
  getPatientProviders: recordsController.getPatientProviders,
  getPatientAudit: recordsController.getPatientAudit,
  getPatientStatistics: recordsController.getPatientStatistics,

  // Photo & Lab Results
  uploadPatientPhoto: recordsController.uploadPatientPhoto,
  getPatientByMRN: recordsController.getPatientByMRN,
  getPatientLabResults: recordsController.getPatientLabResults,
  getPatientCorrespondence: recordsController.getPatientCorrespondence,

  // =====================================================
  // Advanced Controller Functions
  // =====================================================
  // Duplicates & Merge
  checkDuplicates: advancedController.checkDuplicates,
  mergePatients: advancedController.mergePatients,

  // Export & Search
  exportPatients: advancedController.exportPatients,
  advancedSearch: advancedController.advancedSearch,

  // Legacy Data
  searchByLegacyId: advancedController.searchByLegacyId,
  linkFolderToPatient: advancedController.linkFolderToPatient,
  unlinkFolderFromPatient: advancedController.unlinkFolderFromPatient,
  getPatientsWithLegacyData: advancedController.getPatientsWithLegacyData,

  // Patient Alerts
  getPatientAlerts: advancedController.getPatientAlerts,
  addPatientAlert: advancedController.addPatientAlert,
  dismissPatientAlert: advancedController.dismissPatientAlert,
  acknowledgePatientAlert: advancedController.acknowledgePatientAlert,
  syncAllergyAlerts: advancedController.syncAllergyAlerts,
  generateFollowupAlerts: advancedController.generateFollowupAlerts
};
