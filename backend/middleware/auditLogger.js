const AuditLog = require('../models/AuditLog');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('AuditLogger');

// Main audit logging middleware
exports.auditLogger = async (req, res, next) => {
  // Store the original send function
  const originalSend = res.send;

  // Create audit log entry
  const auditEntry = {
    user: req.user ? req.user._id : null,
    action: 'DATA_ACCESS', // Default action, will be overridden based on request type
    resource: req.originalUrl,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    requestBody: {},
    responseStatus: null,
    responseTime: Date.now(),
    metadata: {}
  };

  // Filter sensitive data from request body
  if (req.body) {
    const sanitizedBody = { ...req.body };
    const sensitiveFields = ['password', 'newPassword', 'currentPassword', 'token', 'creditCard', 'ssn'];
    sensitiveFields.forEach(field => {
      if (sanitizedBody[field]) {
        sanitizedBody[field] = '[REDACTED]';
      }
    });
    auditEntry.requestBody = sanitizedBody;
  }

  // Track response time
  const startTime = Date.now();

  // Override res.send to capture response
  res.send = function(data) {
    res.send = originalSend;

    // Calculate response time
    auditEntry.responseTime = Date.now() - startTime;
    auditEntry.responseStatus = res.statusCode;

    // Log successful authentication attempts
    if (req.originalUrl.includes('/auth/login') && res.statusCode === 200) {
      auditEntry.action = 'LOGIN_SUCCESS';
      auditEntry.metadata.loginMethod = req.body.email ? 'email' : 'username';
    }

    // Log failed authentication attempts
    if (req.originalUrl.includes('/auth/login') && res.statusCode === 401) {
      auditEntry.action = 'LOGIN_FAILED';
      auditEntry.metadata.loginAttempt = req.body.email || req.body.username;
    }

    // Log data access
    if (req.method === 'GET' && res.statusCode === 200) {
      auditEntry.action = 'DATA_ACCESS';
    }

    // Log data modifications
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const actionMap = {
        'POST': 'DATA_CREATE',
        'PUT': 'DATA_UPDATE',
        'PATCH': 'DATA_UPDATE',
        'DELETE': 'DATA_DELETE'
      };
      auditEntry.action = actionMap[req.method];
    }

    // Save audit log asynchronously
    if (shouldLogRequest(req)) {
      AuditLog.create(auditEntry).catch(err => {
        log.error('Audit logging error:', { error: err });
      });
    }

    return originalSend.apply(res, arguments);
  };

  next();
};

// Log specific actions
exports.logAction = (action, metadata = {}) => {
  return async (req, res, next) => {
    try {
      await AuditLog.create({
        user: req.user ? req.user._id : null,
        action,
        resource: req.originalUrl,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata,
        responseStatus: res.statusCode,
        requestBody: req.body ? sanitizeRequestBody(req.body) : {}
      });
    } catch (error) {
      log.error('Action logging error:', { error: error });
    }
    next();
  };
};

// Log patient data access (HIPAA compliance)
exports.logPatientDataAccess = async (req, res, next) => {
  if (!req.user) return next();

  try {
    const patientId = req.params.patientId || req.params.id;

    if (patientId) {
      await AuditLog.create({
        user: req.user._id,
        action: 'PATIENT_DATA_ACCESS',
        resource: req.originalUrl,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          patientId,
          accessType: req.method,
          reason: req.headers['x-access-reason'] || 'routine',
          department: req.user.department
        },
        responseStatus: res.statusCode
      });
    }
  } catch (error) {
    log.error('Patient data access logging error:', { error: error });
  }
  next();
};

// Log critical operations
exports.logCriticalOperation = (operation) => {
  return async (req, res, next) => {
    try {
      const entry = {
        user: req.user ? req.user._id : null,
        action: `CRITICAL_${operation}`,
        resource: req.originalUrl,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          operation,
          timestamp: new Date(),
          requestId: req.id
        },
        requestBody: sanitizeRequestBody(req.body)
      };

      // Save immediately for critical operations
      await AuditLog.create(entry);

      // Also trigger alert for critical operations
      if (shouldTriggerAlert(operation)) {
        triggerSecurityAlert(entry);
      }
    } catch (error) {
      log.error('Critical operation logging error:', { error: error });
    }
    next();
  };
};

// Log prescription activities
exports.logPrescriptionActivity = async (req, res, next) => {
  if (!req.user) return next();

  try {
    const prescriptionId = req.params.prescriptionId || req.params.id;
    const action = getPrescriptionAction(req.method, req.originalUrl);

    if (prescriptionId && action) {
      await AuditLog.create({
        user: req.user._id,
        action: `PRESCRIPTION_${action}`,
        resource: req.originalUrl,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          prescriptionId,
          prescriber: req.user.fullName,
          licenseNumber: req.user.licenseNumber,
          timestamp: new Date()
        },
        requestBody: sanitizeRequestBody(req.body)
      });
    }
  } catch (error) {
    log.error('Prescription activity logging error:', { error: error });
  }
  next();
};

// Log permission denials (for admin audit trail)
exports.logPermissionDenial = async (denialDetails) => {
  try {
    await AuditLog.create({
      user: denialDetails.userId,
      action: 'PERMISSION_DENIED',
      resource: denialDetails.path,
      ipAddress: denialDetails.ip,
      userAgent: denialDetails.userAgent,
      metadata: {
        userRole: denialDetails.userRole,
        requiredRoles: denialDetails.requiredRoles,
        requiredPermission: denialDetails.requiredPermission,
        denialType: denialDetails.denialType, // 'role_mismatch', 'missing_permission', 'ownership_check'
        method: denialDetails.method,
        resourceId: denialDetails.resourceId,
        resourceModel: denialDetails.resourceModel,
        timestamp: new Date(),
        severity: 'warning'
      },
      responseStatus: 403
    });

    // Log to console for real-time monitoring
    log.warn('PERMISSION DENIED - Audit logged:', {
      userId: denialDetails.userId,
      userRole: denialDetails.userRole,
      path: denialDetails.path,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Permission denial logging error:', { error: error });
  }
};

// Helper functions
function shouldLogRequest(req) {
  // Skip logging for health checks and static assets
  const skipEndpoints = ['/health', '/api/logs', '/static'];

  // Skip high-frequency polling endpoints (read-only, no audit value)
  const skipPollingEndpoints = [
    '/api/alerts/count',
    '/api/queue',
    '/api/pharmacy/low-stock',
    '/api/pharmacy/expiring',
    '/api/dashboard/stats',
    '/api/dashboard/pending-actions',
    '/api/dashboard/today-tasks',
    '/api/dashboard/recent-patients',
    '/api/auth/me',
    '/api/role-permissions/me',
    '/api/billing/statistics'
  ];

  // Only skip GET requests for polling endpoints (still log POST/PUT/DELETE)
  if (req.method === 'GET') {
    if (skipPollingEndpoints.some(endpoint => req.originalUrl.startsWith(endpoint))) {
      return false;
    }
  }

  return !skipEndpoints.some(endpoint => req.originalUrl.includes(endpoint));
}

function sanitizeRequestBody(body) {
  if (!body) return {};

  const sanitized = { ...body };
  const sensitiveFields = [
    'password',
    'newPassword',
    'currentPassword',
    'token',
    'creditCard',
    'ssn',
    'twoFactorCode',
    'resetToken',
    'apiKey',
    'secret'
  ];

  const sanitizeObject = (obj) => {
    Object.keys(obj).forEach(key => {
      if (sensitiveFields.includes(key)) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    });
    return obj;
  };

  return sanitizeObject(sanitized);
}

function getPrescriptionAction(method, url) {
  if (method === 'POST' && url.includes('/prescriptions')) return 'CREATE';
  if (method === 'PUT' && url.includes('/prescriptions')) return 'UPDATE';
  if (method === 'DELETE' && url.includes('/prescriptions')) return 'DELETE';
  if (method === 'POST' && url.includes('/dispense')) return 'DISPENSE';
  if (method === 'POST' && url.includes('/verify')) return 'VERIFY';
  if (method === 'GET' && url.includes('/prescriptions')) return 'VIEW';
  return null;
}

function shouldTriggerAlert(operation) {
  const alertOperations = [
    'DATA_EXPORT',
    'BULK_DELETE',
    'PERMISSION_CHANGE',
    'USER_ROLE_CHANGE',
    'SYSTEM_CONFIG_CHANGE',
    'MULTIPLE_FAILED_LOGINS'
  ];
  return alertOperations.includes(operation);
}

function triggerSecurityAlert(entry) {
  // Implement your alert mechanism here
  // This could send emails, SMS, or push notifications to administrators
  log.warn('SECURITY ALERT:', { data: entry });

  // Example: Send email to admin
  // sendEmail({
  //   to: process.env.ADMIN_EMAIL,
  //   subject: `Security Alert: ${entry.action}`,
  //   text: `A critical operation was performed: ${JSON.stringify(entry, null, 2)}`
  // });
}

// Export audit report generator
exports.generateAuditReport = async (req, res, next) => {
  try {
    const { startDate, endDate, userId, action, resource } = req.query;

    const query = {};

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (userId) query.user = userId;
    if (action) query.action = action;
    if (resource) query.resource = new RegExp(resource, 'i');

    const logs = await AuditLog.find(query)
      .populate('user', 'firstName lastName email role')
      .sort('-createdAt')
      .limit(1000);

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    log.error('Audit report generation error:', { error: error });
    res.status(500).json({
      success: false,
      error: 'Error generating audit report'
    });
  }
};
