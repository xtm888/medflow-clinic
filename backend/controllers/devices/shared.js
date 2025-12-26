/**
 * Shared dependencies for Device Controllers
 *
 * Centralizes all imports used across device controller modules.
 */

// Models
const Device = require('../../models/Device');
const DeviceMeasurement = require('../../models/DeviceMeasurement');
const DeviceImage = require('../../models/DeviceImage');
const DeviceIntegrationLog = require('../../models/DeviceIntegrationLog');
const OphthalmologyExam = require('../../models/OphthalmologyExam');
const Patient = require('../../models/Patient');
const Alert = require('../../models/Alert');
const AuditLog = require('../../models/AuditLog');

// Middleware
const { asyncHandler } = require('../../middleware/errorHandler');

// Services
const AdapterFactory = require('../../services/adapters/AdapterFactory');

// Utilities
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { success, error, notFound, paginated } = require('../../utils/apiResponse');
const { device: deviceLogger } = require('../../utils/structuredLogger');
const { createContextLogger } = require('../../utils/structuredLogger');
const { DEVICE, PAGINATION } = require('../../config/constants');

// Security utilities
const {
  isMounted,
  mountSmbShare,
  unmountPath,
  validateMountPath,
  validateHost,
  sanitizeForFilesystem
} = require('../../utils/shellSecurity');

// Helper function to verify webhook signature
function verifyWebhookSignature(body, signature, secret) {
  if (!signature || !secret) return false;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(body));
  const expectedSignature = hmac.digest('hex');

  return signature === expectedSignature;
}

module.exports = {
  // Models
  Device,
  DeviceMeasurement,
  DeviceImage,
  DeviceIntegrationLog,
  OphthalmologyExam,
  Patient,
  Alert,
  AuditLog,

  // Middleware
  asyncHandler,

  // Services
  AdapterFactory,

  // Utilities
  crypto,
  fs,
  path,
  success,
  error,
  notFound,
  paginated,
  deviceLogger,
  createContextLogger,
  DEVICE,
  PAGINATION,

  // Security utilities
  isMounted,
  mountSmbShare,
  unmountPath,
  validateMountPath,
  validateHost,
  sanitizeForFilesystem,

  // Helpers
  verifyWebhookSignature
};
