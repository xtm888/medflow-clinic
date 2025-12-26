/**
 * Ophthalmology Controllers Index
 *
 * Re-exports all ophthalmology controller functions for backward compatibility.
 * The original ophthalmologyController.js (2,021 lines) has been split into:
 *
 * - coreController.js: CRUD, prescription, refraction, dashboard
 * - clinicalTestsController.js: Specialized test data entry, device integration
 * - analyticsController.js: IOL calculation, comparison, progression, PDF reports, templates
 */

const coreController = require('./coreController');
const clinicalTestsController = require('./clinicalTestsController');
const analyticsController = require('./analyticsController');

// Re-export all functions maintaining backward compatibility
module.exports = {
  // =====================================================
  // Core Controller Functions (CRUD, Prescription, Refraction)
  // =====================================================
  // Basic CRUD
  getExams: coreController.getExams,
  getExam: coreController.getExam,
  createExam: coreController.createExam,
  updateExam: coreController.updateExam,
  deleteExam: coreController.deleteExam,
  completeExam: coreController.completeExam,

  // Prescription & Refraction
  generateOpticalPrescription: coreController.generateOpticalPrescription,
  saveRefractionData: coreController.saveRefractionData,
  getRefractionHistory: coreController.getRefractionHistory,
  copyFromPreviousRefraction: coreController.copyFromPreviousRefraction,
  createBlankRefraction: coreController.createBlankRefraction,
  generateRefractionSummary: coreController.generateRefractionSummary,
  generateKeratometrySummary: coreController.generateKeratometrySummary,
  markPrescriptionPrinted: coreController.markPrescriptionPrinted,
  markPrescriptionViewed: coreController.markPrescriptionViewed,

  // Patient history
  getPatientExamHistory: coreController.getPatientExamHistory,
  uploadFundusImage: coreController.uploadFundusImage,

  // Dashboard
  getDashboardStats: coreController.getDashboardStats,

  // =====================================================
  // Clinical Tests Controller Functions
  // =====================================================
  // Specialized test data
  saveTonometryData: clinicalTestsController.saveTonometryData,
  saveVisualAcuityData: clinicalTestsController.saveVisualAcuityData,
  saveOCTResults: clinicalTestsController.saveOCTResults,
  saveVisualFieldResults: clinicalTestsController.saveVisualFieldResults,
  saveKeratometryData: clinicalTestsController.saveKeratometryData,
  saveBiometryData: clinicalTestsController.saveBiometryData,
  saveSlitLampExam: clinicalTestsController.saveSlitLampExam,
  saveFundoscopyResults: clinicalTestsController.saveFundoscopyResults,
  saveDiagnosis: clinicalTestsController.saveDiagnosis,

  // Device integration
  getAvailableDeviceMeasurements: clinicalTestsController.getAvailableDeviceMeasurements,
  linkDeviceMeasurement: clinicalTestsController.linkDeviceMeasurement,
  applyDeviceMeasurement: clinicalTestsController.applyDeviceMeasurement,
  linkDeviceImage: clinicalTestsController.linkDeviceImage,
  getLinkedDeviceMeasurements: clinicalTestsController.getLinkedDeviceMeasurements,
  getLinkedDeviceImages: clinicalTestsController.getLinkedDeviceImages,
  importDeviceMeasurement: clinicalTestsController.importDeviceMeasurement,

  // =====================================================
  // Analytics Controller Functions
  // =====================================================
  // IOL Calculation
  calculateIOLPower: analyticsController.calculateIOLPower,

  // Analysis & Comparison
  compareExams: analyticsController.compareExams,
  getProgressionAnalysis: analyticsController.getProgressionAnalysis,
  getTreatmentRecommendations: analyticsController.getTreatmentRecommendations,

  // Reports
  generateExamReport: analyticsController.generateExamReport,

  // Templates
  getExamTemplates: analyticsController.getExamTemplates,
  applyTemplate: analyticsController.applyTemplate
};
