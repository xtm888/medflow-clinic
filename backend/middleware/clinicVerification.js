/**
 * Clinic Verification Middleware
 *
 * CRITICAL SECURITY: Prevents cross-clinic data access in multi-tenant environment.
 *
 * This module provides utilities to verify that documents belong to the user's
 * current clinic context, preventing unauthorized access across clinic boundaries.
 *
 * Usage:
 * - Use verifyClinicOwnership() for manual checks in controllers
 * - Use findByIdWithClinic() as a drop-in replacement for findById()
 * - Use requireClinicOwnership() as route middleware for automatic verification
 */

const AuditLog = require('../models/AuditLog');
const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('ClinicVerification');

/**
 * Verify that a document belongs to the user's current clinic
 *
 * @param {Object} document - The Mongoose document to verify
 * @param {String|ObjectId} userClinicId - The user's current clinic ID
 * @param {String} clinicField - The field name containing clinic reference (default: 'clinic')
 * @returns {Boolean} - True if document belongs to user's clinic
 *
 * @example
 * const patient = await Patient.findById(id);
 * if (!verifyClinicOwnership(patient, req.clinicId, 'homeClinic')) {
 *   return res.status(403).json({ message: 'Access denied' });
 * }
 */
const verifyClinicOwnership = (document, userClinicId, clinicField = 'clinic') => {
  if (!document) return false;
  if (!userClinicId) return false;

  // Get the clinic ID from the document (handle both ObjectId and string)
  const docClinicValue = document[clinicField];
  if (!docClinicValue) return false;

  // Convert both to strings for comparison
  const docClinicId = docClinicValue._id
    ? docClinicValue._id.toString()
    : docClinicValue.toString();
  const userClinicIdStr = userClinicId._id
    ? userClinicId._id.toString()
    : userClinicId.toString();

  return docClinicId === userClinicIdStr;
};

/**
 * Find a document by ID with clinic verification built-in.
 * This is a secure replacement for Model.findById() that enforces clinic isolation.
 *
 * @param {Model} Model - Mongoose model
 * @param {String} id - Document ID
 * @param {String|ObjectId} clinicId - User's clinic ID
 * @param {Object} options - Additional options
 * @param {String} options.clinicField - Field containing clinic reference (default: 'clinic')
 * @param {String} options.select - Fields to select
 * @param {Array|Object} options.populate - Population options
 * @returns {Promise<Document|null>} - The document if found and belongs to clinic, null otherwise
 *
 * @example
 * // Basic usage
 * const invoice = await findByIdWithClinic(Invoice, id, req.clinicId);
 *
 * // With options
 * const patient = await findByIdWithClinic(Patient, id, req.clinicId, {
 *   clinicField: 'homeClinic',
 *   select: 'firstName lastName',
 *   populate: { path: 'visits', select: 'visitDate' }
 * });
 */
const findByIdWithClinic = async (Model, id, clinicId, options = {}) => {
  const {
    clinicField = 'clinic',
    select = null,
    populate = null
  } = options;

  if (!id || !clinicId) return null;

  // Build the query with both ID and clinic constraints
  let query = Model.findOne({
    _id: id,
    [clinicField]: clinicId
  });

  if (select) {
    query = query.select(select);
  }

  if (populate) {
    if (Array.isArray(populate)) {
      populate.forEach(p => {
        query = query.populate(p);
      });
    } else {
      query = query.populate(populate);
    }
  }

  return query.exec();
};

/**
 * Find a document by ID or custom code with clinic verification.
 * Supports finding by MongoDB ObjectId or a custom identifier field.
 *
 * @param {Model} Model - Mongoose model
 * @param {String} idOrCode - Document ID or custom code
 * @param {String|ObjectId} clinicId - User's clinic ID
 * @param {Object} options - Additional options
 * @param {String} options.clinicField - Field containing clinic reference (default: 'clinic')
 * @param {String} options.codeField - Alternative field to search by (e.g., 'patientId', 'invoiceId')
 * @param {String} options.select - Fields to select
 * @param {Array|Object} options.populate - Population options
 * @returns {Promise<Document|null>} - The document if found and belongs to clinic
 *
 * @example
 * const patient = await findByIdOrCodeWithClinic(Patient, 'PAT-2024-001', req.clinicId, {
 *   clinicField: 'homeClinic',
 *   codeField: 'patientId'
 * });
 */
const findByIdOrCodeWithClinic = async (Model, idOrCode, clinicId, options = {}) => {
  const {
    clinicField = 'clinic',
    codeField = null,
    select = null,
    populate = null
  } = options;

  if (!idOrCode || !clinicId) return null;

  // Check if it's a valid MongoDB ObjectId
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrCode);

  // Build query conditions
  let conditions;
  if (isObjectId && codeField) {
    // Try both _id and code field
    conditions = {
      $or: [
        { _id: idOrCode },
        { [codeField]: idOrCode }
      ],
      [clinicField]: clinicId
    };
  } else if (isObjectId) {
    conditions = {
      _id: idOrCode,
      [clinicField]: clinicId
    };
  } else if (codeField) {
    conditions = {
      [codeField]: idOrCode,
      [clinicField]: clinicId
    };
  } else {
    // If not ObjectId and no code field, can't query
    return null;
  }

  let query = Model.findOne(conditions);

  if (select) {
    query = query.select(select);
  }

  if (populate) {
    if (Array.isArray(populate)) {
      populate.forEach(p => {
        query = query.populate(p);
      });
    } else {
      query = query.populate(populate);
    }
  }

  return query.exec();
};

/**
 * Express middleware to verify clinic ownership for route parameters.
 * Automatically checks if the requested resource belongs to the user's clinic
 * and attaches the document to req.resource if valid.
 *
 * IMPORTANT: This middleware should be used AFTER auth middleware (protect, clinicContext)
 *
 * @param {Model} Model - Mongoose model
 * @param {Object} options - Configuration options
 * @param {String} options.paramName - Route param name containing the ID (default: 'id')
 * @param {String} options.clinicField - Field containing clinic reference (default: 'clinic')
 * @param {String} options.codeField - Alternative field to search by (e.g., 'patientId')
 * @param {Boolean} options.allowAllClinics - Allow users with accessAllClinics to bypass (default: true)
 * @param {String} options.resourceName - Human-readable name for error messages
 * @returns {Function} Express middleware
 *
 * @example
 * // In routes file:
 * router.get('/:id',
 *   protect,
 *   clinicContext,
 *   requireClinicOwnership(Invoice, { clinicField: 'clinic' }),
 *   invoiceController.getInvoice
 * );
 *
 * // In controller, document is available as req.resource:
 * const getInvoice = (req, res) => {
 *   return success(res, { data: req.resource });
 * };
 */
const requireClinicOwnership = (Model, options = {}) => {
  const {
    paramName = 'id',
    clinicField = 'clinic',
    codeField = null,
    allowAllClinics = true,
    resourceName = null
  } = options;

  const modelName = resourceName || Model.modelName || 'Resource';

  return async (req, res, next) => {
    try {
      const id = req.params[paramName];
      const clinicId = req.clinicId;
      const hasAllClinicsAccess = req.accessAllClinics;

      // Validate ID is provided
      if (!id) {
        return res.status(400).json({
          success: false,
          message: `${modelName} ID is required`
        });
      }

      // If user has accessAllClinics and we allow it, skip clinic verification
      if (allowAllClinics && hasAllClinicsAccess) {
        // Still need to find the document
        let document;
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

        if (isObjectId) {
          document = await Model.findById(id);
        }

        if (!document && codeField) {
          document = await Model.findOne({ [codeField]: id });
        }

        if (!document) {
          return res.status(404).json({
            success: false,
            message: `${modelName} not found`
          });
        }

        req.resource = document;
        return next();
      }

      // Clinic context is required for non-admin users
      if (!clinicId) {
        return res.status(400).json({
          success: false,
          message: 'Clinic context required for this operation'
        });
      }

      // Find document with clinic verification
      const document = await findByIdOrCodeWithClinic(Model, id, clinicId, {
        clinicField,
        codeField
      });

      if (!document) {
        // Document not found OR doesn't belong to user's clinic
        // First check if document exists at all (for proper error message)
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
        let existsInOtherClinic = false;

        if (isObjectId) {
          existsInOtherClinic = await Model.exists({ _id: id });
        }
        if (!existsInOtherClinic && codeField) {
          existsInOtherClinic = await Model.exists({ [codeField]: id });
        }

        if (existsInOtherClinic) {
          // Document exists but belongs to different clinic - log security event
          await logCrossClinicAccessAttempt(req, Model.modelName, id, clinicId);

          return res.status(403).json({
            success: false,
            message: `Access denied - ${modelName.toLowerCase()} belongs to a different clinic`
          });
        }

        // Document doesn't exist at all
        return res.status(404).json({
          success: false,
          message: `${modelName} not found`
        });
      }

      // Attach document to request for controller use
      req.resource = document;
      next();
    } catch (error) {
      log.error('Clinic ownership verification error', {
        error: error.message,
        model: Model.modelName,
        paramName,
        clinicField
      });
      next(error);
    }
  };
};

/**
 * Log cross-clinic access attempt to audit log
 * @private
 */
const logCrossClinicAccessAttempt = async (req, resourceType, resourceId, userClinicId) => {
  try {
    // Log to structured logger
    log.warn('SECURITY: Cross-clinic access attempt', {
      userId: req.user?._id,
      userClinicId,
      resourceType,
      resourceId,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    // Log to audit trail
    await AuditLog.create({
      user: req.user?._id,
      action: 'CROSS_CLINIC_ACCESS_ATTEMPT',
      resource: req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        resourceType,
        resourceId,
        userClinicId: userClinicId?.toString(),
        severity: 'high',
        securityEvent: true
      },
      responseStatus: 403
    });
  } catch (error) {
    log.error('Failed to log cross-clinic access attempt', { error: error.message });
  }
};

/**
 * Helper to check if user can access a specific clinic's data
 *
 * @param {Object} user - User object with clinics array and accessAllClinics flag
 * @param {String|ObjectId} targetClinicId - The clinic to check access for
 * @returns {Boolean} - True if user can access the clinic's data
 */
const canAccessClinic = (user, targetClinicId) => {
  if (!user || !targetClinicId) return false;

  // Admin with all clinics access
  if (user.accessAllClinics) return true;

  // Check if target clinic is in user's assigned clinics
  const userClinicIds = (user.clinics || []).map(c => c.toString());
  return userClinicIds.includes(targetClinicId.toString());
};

module.exports = {
  verifyClinicOwnership,
  findByIdWithClinic,
  findByIdOrCodeWithClinic,
  requireClinicOwnership,
  canAccessClinic
};
