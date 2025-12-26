/**
 * Shared dependencies for glasses order controller modules
 */

const GlassesOrder = require('../../models/GlassesOrder');
const OphthalmologyExam = require('../../models/OphthalmologyExam');
const Patient = require('../../models/Patient');
const Invoice = require('../../models/Invoice');
const AuditLog = require('../../models/AuditLog');
const { Inventory, FrameInventory, ContactLensInventory, OpticalLensInventory } = require('../../models/Inventory');
const mongoose = require('mongoose');
const { asyncHandler } = require('../../middleware/errorHandler');
const notificationFacade = require('../../services/notificationFacade');
const { success, error, notFound, paginated } = require('../../utils/apiResponse');
const { findPatientByIdOrCode } = require('../../utils/patientLookup');
const { createContextLogger } = require('../../utils/structuredLogger');
const { PAGINATION } = require('../../config/constants');

const log = createContextLogger('GlassesOrder');

module.exports = {
  // Models
  GlassesOrder,
  OphthalmologyExam,
  Patient,
  Invoice,
  AuditLog,
  Inventory,
  FrameInventory,
  ContactLensInventory,
  OpticalLensInventory,

  // Libraries
  mongoose,

  // Middleware & Utils
  asyncHandler,
  success,
  error,
  notFound,
  paginated,
  findPatientByIdOrCode,

  // Services
  notificationFacade,

  // Logging & Constants
  log,
  PAGINATION
};
