/**
 * Shared dependencies for prescription controller modules
 *
 * This file contains common imports and utilities used across
 * the prescription controller modules.
 */

const Prescription = require('../../models/Prescription');
const Patient = require('../../models/Patient');
const Visit = require('../../models/Visit');
const PharmacyInventory = require('../../models/PharmacyInventory');
const Invoice = require('../../models/Invoice');
const AuditLog = require('../../models/AuditLog');
const mongoose = require('mongoose');
const { asyncHandler } = require('../../middleware/errorHandler');
const { sanitizeForAssign } = require('../../utils/sanitize');
const drugSafetyService = require('../../services/drugSafetyService');
const ePrescribingService = require('../../services/ePrescribingService');
const { success, error, notFound, paginated } = require('../../utils/apiResponse');
const { findPatientByIdOrCode } = require('../../utils/patientLookup');
const { prescription: prescriptionLogger } = require('../../utils/structuredLogger');
const { PRESCRIPTION, PAGINATION } = require('../../config/constants');
const websocketService = require('../../services/websocketService');

module.exports = {
  // Models
  Prescription,
  Patient,
  Visit,
  PharmacyInventory,
  Invoice,
  AuditLog,

  // Libraries
  mongoose,

  // Middleware & Utils
  asyncHandler,
  sanitizeForAssign,
  success,
  error,
  notFound,
  paginated,
  findPatientByIdOrCode,

  // Services
  drugSafetyService,
  ePrescribingService,
  websocketService,

  // Logging & Constants
  prescriptionLogger,
  PRESCRIPTION,
  PAGINATION
};
