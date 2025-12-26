/**
 * Shared dependencies for Patient Controllers
 *
 * Centralizes all imports used across patient controller modules.
 */

// Models
const Patient = require('../../models/Patient');

// Middleware
const { asyncHandler } = require('../../middleware/errorHandler');

// Utilities
const { escapeRegex } = require('../../utils/sanitize');
const { paginateOffset, getPaginationParams } = require('../../services/paginationService');
const { success, error, notFound, paginated } = require('../../utils/apiResponse');
const { findPatientByIdOrCode, findPatientOrFail } = require('../../utils/patientLookup');
const { patient: patientLogger } = require('../../utils/structuredLogger');
const { PAGINATION } = require('../../config/constants');
const websocketService = require('../../services/websocketService');

// Helper function to find patient by either MongoDB ObjectId or patientId
const findPatientById = async (id) => {
  // Check if id is a valid MongoDB ObjectId (24-character hex string)
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

  let patient = null;

  if (isObjectId) {
    patient = await Patient.findById(id);
  }

  // If not found by _id or not a valid ObjectId, try finding by patientId
  if (!patient) {
    patient = await Patient.findOne({ patientId: id });
  }

  return patient;
};

module.exports = {
  // Models
  Patient,

  // Middleware
  asyncHandler,

  // Utilities
  escapeRegex,
  paginateOffset,
  getPaginationParams,
  success,
  error,
  notFound,
  paginated,
  findPatientByIdOrCode,
  findPatientOrFail,
  patientLogger,
  PAGINATION,
  websocketService,

  // Helpers
  findPatientById
};
