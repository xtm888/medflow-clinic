/**
 * Shared dependencies for invoice controller modules
 */

const Invoice = require('../../models/Invoice');
const Patient = require('../../models/Patient');
const Visit = require('../../models/Visit');
const FeeSchedule = require('../../models/FeeSchedule');
const Company = require('../../models/Company');
const Approval = require('../../models/Approval');
const SurgeryCase = require('../../models/SurgeryCase');
const ClinicalAct = require('../../models/ClinicalAct');
const AuditLog = require('../../models/AuditLog');
const mongoose = require('mongoose');
const { asyncHandler } = require('../../middleware/errorHandler');
const currencyService = require('../../services/currencyService');
const websocketService = require('../../services/websocketService');
const { success, error, notFound, paginated, badRequest } = require('../../utils/apiResponse');
const { findPatientByIdOrCode } = require('../../utils/patientLookup');
const { invoice: invoiceLogger } = require('../../utils/structuredLogger');
const { INVOICE, PAGINATION, CANCELLATION } = require('../../config/constants');

// Domain services for orchestration
const { BillingService, SurgeryService } = require('../../services/domain');

module.exports = {
  // Models
  Invoice,
  Patient,
  Visit,
  FeeSchedule,
  Company,
  Approval,
  SurgeryCase,
  ClinicalAct,
  AuditLog,

  // Libraries
  mongoose,

  // Middleware & Utils
  asyncHandler,
  success,
  error,
  notFound,
  paginated,
  badRequest,
  findPatientByIdOrCode,

  // Services
  currencyService,
  websocketService,
  BillingService,
  SurgeryService,

  // Logging & Constants
  invoiceLogger,
  INVOICE,
  PAGINATION,
  CANCELLATION
};
