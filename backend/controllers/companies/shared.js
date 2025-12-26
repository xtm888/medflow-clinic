/**
 * Shared dependencies for Company Controllers
 *
 * Centralizes all imports used across company controller modules.
 */

// Models
const Company = require('../../models/Company');
const ConventionFeeSchedule = require('../../models/ConventionFeeSchedule');
const Patient = require('../../models/Patient');
const Invoice = require('../../models/Invoice');
const Approval = require('../../models/Approval');

// Middleware
const { asyncHandler } = require('../../middleware/errorHandler');

// Utilities
const { success, error, notFound, paginated } = require('../../utils/apiResponse');
const { createContextLogger } = require('../../utils/structuredLogger');
const { PAGINATION } = require('../../config/constants');

// Logger
const companyLogger = createContextLogger('Company');

module.exports = {
  // Models
  Company,
  ConventionFeeSchedule,
  Patient,
  Invoice,
  Approval,

  // Middleware
  asyncHandler,

  // Utilities
  success,
  error,
  notFound,
  paginated,
  companyLogger,
  PAGINATION
};
