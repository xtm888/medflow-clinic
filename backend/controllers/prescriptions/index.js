/**
 * Prescription Controller Module
 *
 * This module re-exports all prescription-related controller functions.
 *
 * REFACTORING PLAN (4,724 lines -> ~6 files of ~800 lines each):
 * ================================================================
 * The original prescriptionController.js is a "god object" that should be
 * split into focused modules. Current plan:
 *
 * 1. core.js (~800 lines)
 *    - getPrescriptions, getPrescription, createPrescription
 *    - updatePrescription, deletePrescription, cancelPrescription
 *    - signPrescription, verifyPrescription, printPrescription
 *    - renewPrescription, clonePrescription
 *    - getActivePrescriptions, getProviderPrescriptions
 *    - getExpiredPrescriptions, getPrescriptionHistory
 *
 * 2. dispensing.js (~600 lines)
 *    - dispensePrescription, createInvoiceForPrescription
 *    - updatePharmacyStatus, sendToPharmacy
 *    - refillPrescription, getRefillHistory
 *
 * 3. ePrescribing.js (~500 lines)
 *    - transmitEPrescription, getEPrescriptionStatus
 *    - cancelEPrescription, respondToRefillRequest
 *    - searchEPrescribingPharmacies, verifyPharmacy
 *    - getEPrescribingServiceStatus
 *
 * 4. priorAuth.js (~400 lines)
 *    - requestPriorAuthorization, updatePriorAuthorization
 *    - getPriorAuthorizationStatus, getPendingPriorAuthorizations
 *
 * 5. safety.js (~400 lines)
 *    - checkDrugInteractions, runSafetyCheck
 *    - getDrugSafetyStatus, validatePrescription
 *    - createPrescriptionWithSafetyOverride
 *
 * 6. templates.js (~400 lines)
 *    - getTemplates, createTemplate, getTemplate
 *    - updateTemplate, deleteTemplate
 *
 * 7. specialized.js (~600 lines)
 *    - getOpticalPrescriptions, createOpticalPrescription
 *    - updateOpticalPrescription
 *    - getDrugPrescriptions, createDrugPrescription
 *    - bulkCreatePrescriptions
 *    - generatePDF, getStatistics
 *
 * For backward compatibility, this file re-exports all functions from
 * the original controller. Migration to modular structure is in progress.
 */

// Re-export everything from original controller for backward compatibility
module.exports = require('../prescriptionController');
