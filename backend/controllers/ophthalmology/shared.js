/**
 * Shared dependencies for Ophthalmology Controllers
 *
 * Centralizes all imports used across ophthalmology controller modules.
 */

// Models
const OphthalmologyExam = require('../../models/OphthalmologyExam');
const Patient = require('../../models/Patient');
const Prescription = require('../../models/Prescription');
const Appointment = require('../../models/Appointment');
const { Inventory, PharmacyInventory, ContactLensInventory } = require('../../models/Inventory');
const Device = require('../../models/Device');
const DeviceMeasurement = require('../../models/DeviceMeasurement');

// Middleware
const { asyncHandler } = require('../../middleware/errorHandler');
const { buildClinicQuery } = require('../../middleware/clinicAuth');

// Utilities
const { sanitizeForAssign } = require('../../utils/sanitize');
const { success, error, notFound, paginated } = require('../../utils/apiResponse');
const { findPatientByIdOrCode } = require('../../utils/patientLookup');
const { createContextLogger } = require('../../utils/structuredLogger');
const { PAGINATION } = require('../../config/constants');

// External
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');

// Logger
const ophthalmologyLogger = createContextLogger('Ophthalmology');

// Clinical alert service for auto-evaluation
let clinicalAlertService;
try {
  clinicalAlertService = require('../../services/clinicalAlertService');
} catch (e) {
  ophthalmologyLogger.warn('Clinical alert service not available', { error: e.message });
}

/**
 * CRITICAL: Auto-evaluate clinical alerts after exam data changes
 * This ensures emergency conditions are immediately flagged
 */
async function autoEvaluateAlerts(exam, userId) {
  if (!clinicalAlertService) return { alerts: [], error: 'Service not available' };

  try {
    const patient = await findPatientByIdOrCode(exam.patient);
    if (!patient) return { alerts: [], error: 'Patient not found' };

    // Get previous exam for comparison
    const previousExam = await OphthalmologyExam.findOne({
      patient: exam.patient,
      _id: { $ne: exam._id },
      status: 'completed'
    })
      .sort({ createdAt: -1 })
      .lean();

    // Evaluate and create alerts
    const alerts = await clinicalAlertService.evaluateAndCreateAlerts(
      exam.toObject ? exam.toObject() : exam,
      exam.patient,
      exam._id,
      exam.visit,
      previousExam,
      patient,
      userId
    );

    return {
      alerts,
      hasEmergency: alerts.some(a => a.severity === 'EMERGENCY'),
      hasUrgent: alerts.some(a => a.severity === 'URGENT'),
      count: alerts.length
    };
  } catch (err) {
    ophthalmologyLogger.error('Error auto-evaluating clinical alerts', { error: err.message, stack: err.stack });
    return { alerts: [], error: err.message };
  }
}

module.exports = {
  // Models
  OphthalmologyExam,
  Patient,
  Prescription,
  Appointment,
  Inventory,
  PharmacyInventory,
  ContactLensInventory,
  Device,
  DeviceMeasurement,

  // Middleware
  asyncHandler,
  buildClinicQuery,

  // Utilities
  sanitizeForAssign,
  success,
  error,
  notFound,
  paginated,
  findPatientByIdOrCode,
  ophthalmologyLogger,
  PAGINATION,

  // External
  PDFDocument,
  mongoose,

  // Helpers
  autoEvaluateAlerts
};
