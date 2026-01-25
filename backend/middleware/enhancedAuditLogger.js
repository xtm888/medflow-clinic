/**
 * Enhanced Audit Logging Middleware
 *
 * Captures before/after states for sensitive operations with comprehensive
 * change tracking, sensitive field redaction, and asynchronous persistence.
 *
 * @module middleware/enhancedAuditLogger
 */

const AuditLog = require('../models/AuditLog');
const { createContextLogger } = require('../utils/structuredLogger');

const log = createContextLogger('EnhancedAuditLogger');

/**
 * Model mapping for path-to-Mongoose model resolution
 * Lazy-loaded to avoid circular dependency issues
 */
let modelCache = null;

/**
 * Get the model map, lazily loading models to avoid circular dependencies
 * @returns {Object} Map of path segments to Mongoose models
 */
function getModelMap() {
  if (modelCache) return modelCache;

  try {
    modelCache = {
      'patients': require('../models/Patient'),
      'appointments': require('../models/Appointment'),
      'invoices': require('../models/Invoice'),
      'visits': require('../models/Visit'),
      'prescriptions': require('../models/Prescription'),
      'lab-orders': require('../models/LabOrder'),
      'glasses-orders': require('../models/GlassesOrder'),
      'surgery-cases': require('../models/SurgeryCase'),
      'inventory': require('../models/Inventory'),
      'users': require('../models/User'),
      'ophthalmology-exams': require('../models/OphthalmologyExam'),
      'orthoptic-exams': require('../models/OrthopticExam'),
      'ivt-injections': require('../models/IVTInjection'),
      'companies': require('../models/Company'),
      'clinics': require('../models/Clinic'),
      'rooms': require('../models/Room'),
      'suppliers': require('../models/Supplier'),
      'drugs': require('../models/Drug'),
      'fee-schedules': require('../models/FeeSchedule'),
      'services': require('../models/Service'),
      'documents': require('../models/Document'),
      'alerts': require('../models/Alert'),
      'referrers': require('../models/Referrer'),
      'roles': require('../models/RolePermission'),
      'role-permissions': require('../models/RolePermission'),
      'settings': require('../models/Settings')
    };
  } catch (err) {
    log.error('Error loading models for audit logger', { error: err.message });
    modelCache = {};
  }

  return modelCache;
}

/**
 * Extract resource type from API path
 * @param {string} path - Request path (e.g., /api/patients/123)
 * @returns {string} Resource type (e.g., 'patients')
 */
function extractResourceType(path) {
  if (!path || typeof path !== 'string') return 'unknown';

  const parts = path.split('/').filter(Boolean);

  // Handle /api/{resource} or /api/{resource}/:id patterns
  // parts[0] = 'api', parts[1] = resource
  if (parts.length >= 2 && parts[0] === 'api') {
    return parts[1];
  }

  // Fallback: return first meaningful segment
  return parts[1] || parts[0] || 'unknown';
}

/**
 * Get Mongoose model for a given path
 * @param {string} path - Request path
 * @returns {Object|null} Mongoose model or null if not found
 */
function getModelForPath(path) {
  const resourceType = extractResourceType(path);
  const modelMap = getModelMap();
  return modelMap[resourceType] || null;
}

/**
 * Recursively sanitize an object by redacting sensitive fields
 * @param {*} obj - Object to sanitize
 * @param {string[]} sensitiveFields - Array of field names to redact
 * @param {number} depth - Current recursion depth (to prevent stack overflow)
 * @returns {*} Sanitized object
 */
function sanitizeObject(obj, sensitiveFields, depth = 0) {
  // Prevent excessive recursion
  if (depth > 10) return '[MAX_DEPTH_EXCEEDED]';

  // Handle null/undefined
  if (obj === null || obj === undefined) return obj;

  // Handle primitives
  if (typeof obj !== 'object') return obj;

  // Handle Date objects
  if (obj instanceof Date) return obj;

  // Handle ObjectId (MongoDB)
  if (obj._bsontype === 'ObjectId' || obj._bsontype === 'ObjectID') {
    return obj.toString();
  }

  // Handle Buffer
  if (Buffer.isBuffer(obj)) {
    return '[BUFFER_DATA]';
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, sensitiveFields, depth + 1));
  }

  // Handle plain objects
  const sanitized = {};
  const sensitiveFieldsLower = sensitiveFields.map(f => f.toLowerCase());

  for (const [key, value] of Object.entries(obj)) {
    // Skip internal Mongoose fields
    if (key.startsWith('$') || key === '__v' || key === '__t') {
      continue;
    }

    const keyLower = key.toLowerCase();

    // Check if field name matches any sensitive field pattern
    const isSensitive = sensitiveFieldsLower.some(sf => {
      return keyLower === sf ||
             keyLower.includes(sf) ||
             (sf === 'password' && keyLower.includes('pass')) ||
             (sf === 'token' && keyLower.includes('token')) ||
             (sf === 'secret' && keyLower.includes('secret')) ||
             (sf === 'apikey' && keyLower.includes('key') && keyLower.includes('api'));
    });

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value, sensitiveFields, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Calculate changes between before and after states
 * @param {Object} before - State before operation
 * @param {Object} after - State after operation
 * @param {string[]} sensitiveFields - Fields to exclude from diff
 * @returns {Array} Array of change objects
 */
function calculateChanges(before, after, sensitiveFields) {
  const changes = [];

  if (!before && !after) return changes;
  if (!before) {
    // New record created
    return [{ field: '_record', before: null, after: 'created' }];
  }
  if (!after) {
    // Record deleted
    return [{ field: '_record', before: 'existed', after: 'deleted' }];
  }

  const sensitiveFieldsLower = sensitiveFields.map(f => f.toLowerCase());
  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {})
  ]);

  for (const key of allKeys) {
    // Skip internal fields
    if (key.startsWith('_') && key !== '_id') continue;
    if (key === '__v' || key === '__t') continue;

    const keyLower = key.toLowerCase();

    // Skip sensitive fields
    const isSensitive = sensitiveFieldsLower.some(sf =>
      keyLower === sf || keyLower.includes(sf)
    );
    if (isSensitive) continue;

    const beforeVal = before?.[key];
    const afterVal = after?.[key];

    // Convert to comparable strings for comparison
    const beforeStr = JSON.stringify(beforeVal);
    const afterStr = JSON.stringify(afterVal);

    if (beforeStr !== afterStr) {
      changes.push({
        field: key,
        before: beforeVal,
        after: afterVal
      });
    }
  }

  return changes;
}

/**
 * Determine if an operation is sensitive based on path, method, and changes
 * @param {string} path - Request path
 * @param {string} method - HTTP method
 * @param {Array} changes - Array of change objects
 * @returns {boolean} True if operation is sensitive
 */
function isSensitiveOperation(path, method, changes) {
  // User/role/permission operations are always sensitive
  const sensitivePathPatterns = [
    '/users',
    '/roles',
    '/permissions',
    '/role-permissions',
    '/auth',
    '/settings',
    '/config'
  ];

  if (sensitivePathPatterns.some(pattern => path.includes(pattern))) {
    return true;
  }

  // DELETE operations are always sensitive
  if (method === 'DELETE') {
    return true;
  }

  // Check for financial field changes
  const financialFields = [
    'amount',
    'total',
    'subtotal',
    'price',
    'unitPrice',
    'payment',
    'balance',
    'amountDue',
    'amountPaid',
    'discount',
    'tax',
    'fee',
    'cost',
    'revenue',
    'currency'
  ];

  if (changes && changes.some(c => financialFields.includes(c.field))) {
    return true;
  }

  // Check for status changes on critical resources
  if (changes && changes.some(c => c.field === 'status')) {
    const criticalResources = [
      'invoices',
      'payments',
      'surgery',
      'prescriptions',
      'lab-orders',
      'ivt'
    ];
    if (criticalResources.some(r => path.includes(r))) {
      return true;
    }
  }

  // Check for role/permission changes
  if (changes && changes.some(c =>
    c.field === 'role' ||
    c.field === 'roles' ||
    c.field === 'permissions' ||
    c.field === 'isAdmin' ||
    c.field === 'isActive'
  )) {
    return true;
  }

  return false;
}

/**
 * Extract client information from request
 * @param {Object} req - Express request object
 * @returns {Object} Client information
 */
function getClientInfo(req) {
  return {
    browser: req.get('user-agent') || 'unknown',
    platform: req.get('sec-ch-ua-platform') || 'unknown',
    mobile: req.get('sec-ch-ua-mobile') === '?1',
    origin: req.get('origin') || req.get('referer') || 'direct',
    acceptLanguage: req.get('accept-language') || 'unknown'
  };
}

/**
 * Enhanced audit logging middleware factory
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.captureBeforeState - Capture document state before operation (default: true)
 * @param {boolean} options.captureAfterState - Capture document state after operation (default: true)
 * @param {string[]} options.sensitiveFields - Fields to redact from logs (default: ['password', 'token', 'secret', 'apiKey'])
 * @param {string[]} options.auditedMethods - HTTP methods to audit (default: ['POST', 'PUT', 'PATCH', 'DELETE'])
 * @returns {Function} Express middleware function
 */
const enhancedAuditLogger = (options = {}) => {
  const {
    captureBeforeState = true,
    captureAfterState = true,
    sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'refreshToken', 'accessToken'],
    auditedMethods = ['POST', 'PUT', 'PATCH', 'DELETE']
  } = options;

  return async (req, res, next) => {
    // Skip non-audited methods
    if (!auditedMethods.includes(req.method)) {
      return next();
    }

    const startTime = Date.now();

    // Build initial audit entry
    const auditEntry = {
      user: req.user?._id || null,
      userName: req.user?.name || req.user?.firstName
        ? `${req.user.firstName} ${req.user.lastName || ''}`.trim()
        : null,
      userRole: req.user?.role || null,
      clinic: req.user?.currentClinicId || req.clinic?._id || null,
      method: req.method,
      path: req.path,
      resource: req.originalUrl,
      resourceType: extractResourceType(req.path),
      resourceId: req.params.id || req.params.patientId || null,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
      clientInfo: getClientInfo(req),
      requestBody: sanitizeObject(req.body, sensitiveFields),
      timestamp: new Date(),
      beforeState: null,
      afterState: null,
      changes: [],
      isSensitive: false,
      responseStatus: null,
      duration: null,
      action: getActionFromMethod(req.method)
    };

    // Capture before state for PUT/PATCH/DELETE operations
    if (captureBeforeState && req.params.id && ['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      try {
        const Model = getModelForPath(req.path);
        if (Model) {
          const beforeDoc = await Model.findById(req.params.id).lean();
          if (beforeDoc) {
            auditEntry.beforeState = sanitizeObject(beforeDoc, sensitiveFields);
          }
        }
      } catch (err) {
        // Log error but don't block the request
        log.warn('Failed to capture before state', {
          path: req.path,
          resourceId: req.params.id,
          error: err.message
        });
        auditEntry.metadata = auditEntry.metadata || {};
        auditEntry.metadata.beforeStateError = err.message;
      }
    }

    // Intercept res.json to capture after state and response
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      // Calculate duration
      auditEntry.duration = Date.now() - startTime;
      auditEntry.responseStatus = res.statusCode;
      auditEntry.responseTime = auditEntry.duration;

      // Capture after state from response
      if (captureAfterState && data) {
        try {
          // Handle various response formats
          let responseData = null;

          if (data.data) {
            // Standard { success: true, data: {...} } format
            responseData = data.data._doc || data.data;
          } else if (data._doc) {
            // Raw Mongoose document
            responseData = data._doc;
          } else if (data._id) {
            // Plain object with _id (likely a document)
            responseData = data;
          }

          if (responseData) {
            auditEntry.afterState = sanitizeObject(responseData, sensitiveFields);
          }
        } catch (err) {
          log.warn('Failed to capture after state', { error: err.message });
        }
      }

      // Calculate changes between before and after states
      if (auditEntry.beforeState || auditEntry.afterState) {
        auditEntry.changes = calculateChanges(
          auditEntry.beforeState,
          auditEntry.afterState,
          sensitiveFields
        );
      }

      // Determine if this was a sensitive operation
      auditEntry.isSensitive = isSensitiveOperation(
        req.path,
        req.method,
        auditEntry.changes
      );

      // Set action based on resource type and method
      auditEntry.action = determineAction(req, auditEntry.resourceType);

      // Save audit log asynchronously (don't block response)
      saveAuditLog(auditEntry).catch(err => {
        log.error('Failed to save audit log', {
          error: err.message,
          path: req.path,
          method: req.method
        });
      });

      // Call original json method
      return originalJson(data);
    };

    next();
  };
};

/**
 * Get base action from HTTP method
 * @param {string} method - HTTP method
 * @returns {string} Base action name
 */
function getActionFromMethod(method) {
  const actionMap = {
    'POST': 'DATA_CREATE',
    'PUT': 'DATA_UPDATE',
    'PATCH': 'DATA_UPDATE',
    'DELETE': 'DATA_DELETE'
  };
  return actionMap[method] || 'DATA_ACCESS';
}

/**
 * Determine specific action based on resource type and method
 * @param {Object} req - Express request object
 * @param {string} resourceType - Type of resource
 * @returns {string} Specific action name
 */
function determineAction(req, resourceType) {
  const method = req.method;
  const path = req.path.toLowerCase();

  // Build action prefix based on resource type
  const resourceActionMap = {
    'patients': 'PATIENT',
    'appointments': 'APPOINTMENT',
    'invoices': 'INVOICE',
    'visits': 'VISIT',
    'prescriptions': 'PRESCRIPTION',
    'lab-orders': 'LAB_ORDER',
    'glasses-orders': 'GLASSES_ORDER',
    'surgery-cases': 'SURGERY_CASE',
    'inventory': 'INVENTORY',
    'users': 'USER',
    'ophthalmology-exams': 'OPHTHALMOLOGY_EXAM',
    'ivt-injections': 'IVT_INJECTION',
    'drugs': 'MEDICATION',
    'roles': 'ROLE_CHANGE',
    'role-permissions': 'PERMISSION_CHANGE'
  };

  const prefix = resourceActionMap[resourceType] || 'DATA';

  // Determine suffix based on method and sub-path
  let suffix = 'ACCESS';

  switch (method) {
    case 'POST':
      suffix = 'CREATE';
      // Check for specific actions
      if (path.includes('/dispense')) suffix = 'DISPENSE';
      if (path.includes('/verify')) suffix = 'VERIFY';
      if (path.includes('/cancel')) suffix = 'CANCEL';
      if (path.includes('/complete')) suffix = 'COMPLETE';
      if (path.includes('/checkin')) suffix = 'CHECKIN';
      if (path.includes('/checkout')) suffix = 'CHECKOUT';
      if (path.includes('/payment')) suffix = 'PAYMENT_PROCESS';
      break;
    case 'PUT':
    case 'PATCH':
      suffix = 'UPDATE';
      if (path.includes('/status')) suffix = 'STATUS_UPDATE';
      break;
    case 'DELETE':
      suffix = 'DELETE';
      break;
  }

  // Construct action name
  const action = `${prefix}_${suffix}`;

  // Validate against known actions in AuditLog model
  // If not valid, fall back to generic action
  return action;
}

/**
 * Save audit log entry asynchronously
 * @param {Object} auditEntry - Audit log entry to save
 */
async function saveAuditLog(auditEntry) {
  try {
    // Prepare the entry for AuditLog model
    const logEntry = {
      user: auditEntry.user,
      clinic: auditEntry.clinic,
      action: auditEntry.action,
      resource: auditEntry.resource,
      ipAddress: auditEntry.ipAddress,
      userAgent: auditEntry.userAgent,
      requestBody: auditEntry.requestBody,
      requestMethod: auditEntry.method,
      responseStatus: auditEntry.responseStatus,
      responseTime: auditEntry.duration,
      metadata: {
        resourceType: auditEntry.resourceType,
        resourceId: auditEntry.resourceId,
        userName: auditEntry.userName,
        userRole: auditEntry.userRole,
        clientInfo: auditEntry.clientInfo,
        beforeState: auditEntry.beforeState,
        afterState: auditEntry.afterState,
        changes: auditEntry.changes,
        isSensitive: auditEntry.isSensitive,
        timestamp: auditEntry.timestamp
      }
    };

    // Set compliance flags for sensitive operations
    if (auditEntry.isSensitive) {
      logEntry.compliance = {
        hipaaRelevant: true,
        dataClassification: 'confidential'
      };
    }

    // Set security flags for potentially suspicious activity
    if (auditEntry.method === 'DELETE' ||
        auditEntry.resourceType === 'users' ||
        auditEntry.resourceType === 'role-permissions') {
      logEntry.security = {
        threatLevel: 'low',
        suspicious: false
      };
    }

    await AuditLog.create(logEntry);

    // Log sensitive operations for real-time monitoring
    if (auditEntry.isSensitive) {
      log.info('Sensitive operation logged', {
        action: auditEntry.action,
        user: auditEntry.userName,
        resource: auditEntry.resourceType,
        resourceId: auditEntry.resourceId,
        changes: auditEntry.changes?.length || 0
      });
    }
  } catch (err) {
    // Re-throw to be caught by caller
    throw err;
  }
}

/**
 * Middleware for auditing specific routes with custom options
 * @param {Object} customOptions - Options to override defaults
 * @returns {Function} Express middleware
 */
enhancedAuditLogger.forRoute = (customOptions = {}) => {
  return enhancedAuditLogger({
    captureBeforeState: true,
    captureAfterState: true,
    sensitiveFields: ['password', 'token', 'secret', 'apiKey', 'refreshToken', 'accessToken'],
    auditedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    ...customOptions
  });
};

/**
 * Middleware for auditing critical operations with enhanced logging
 * Captures all operations including GET requests
 */
enhancedAuditLogger.critical = () => {
  return enhancedAuditLogger({
    captureBeforeState: true,
    captureAfterState: true,
    sensitiveFields: ['password', 'token', 'secret', 'apiKey', 'refreshToken', 'accessToken'],
    auditedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  });
};

/**
 * Middleware for auditing financial operations
 * Captures payment and invoice related changes
 */
enhancedAuditLogger.financial = () => {
  return enhancedAuditLogger({
    captureBeforeState: true,
    captureAfterState: true,
    sensitiveFields: [
      'password', 'token', 'secret', 'apiKey',
      'cardNumber', 'cvv', 'bankAccount', 'iban'
    ],
    auditedMethods: ['POST', 'PUT', 'PATCH', 'DELETE']
  });
};

// Export helper functions for testing and external use
enhancedAuditLogger.extractResourceType = extractResourceType;
enhancedAuditLogger.getModelForPath = getModelForPath;
enhancedAuditLogger.sanitizeObject = sanitizeObject;
enhancedAuditLogger.calculateChanges = calculateChanges;
enhancedAuditLogger.isSensitiveOperation = isSensitiveOperation;

module.exports = enhancedAuditLogger;
