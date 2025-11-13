const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // User Information
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  // Action Details
  action: {
    type: String,
    required: true,
    enum: [
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'LOGOUT',
      'DATA_ACCESS',
      'DATA_CREATE',
      'DATA_UPDATE',
      'DATA_DELETE',
      'PATIENT_DATA_ACCESS',
      'PRESCRIPTION_CREATE',
      'PRESCRIPTION_UPDATE',
      'PRESCRIPTION_DELETE',
      'PRESCRIPTION_DISPENSE',
      'PRESCRIPTION_VERIFY',
      'PRESCRIPTION_VIEW',
      'APPOINTMENT_CREATE',
      'APPOINTMENT_UPDATE',
      'APPOINTMENT_CANCEL',
      'USER_CREATE',
      'USER_UPDATE',
      'USER_DELETE',
      'PERMISSION_CHANGE',
      'PASSWORD_CHANGE',
      'PASSWORD_RESET',
      'EMAIL_VERIFICATION',
      'TWO_FACTOR_ENABLE',
      'TWO_FACTOR_DISABLE',
      'CRITICAL_DATA_EXPORT',
      'CRITICAL_BULK_DELETE',
      'CRITICAL_PERMISSION_CHANGE',
      'CRITICAL_USER_ROLE_CHANGE',
      'CRITICAL_SYSTEM_CONFIG_CHANGE',
      'REPORT_GENERATE',
      'BACKUP_CREATE',
      'BACKUP_RESTORE',
      'SYSTEM_ERROR',
      'SECURITY_ALERT',
      'CUSTOM'
    ]
  },

  // Resource Information
  resource: {
    type: String,
    required: true
  },

  // Request Information
  ipAddress: String,
  userAgent: String,
  requestBody: mongoose.Schema.Types.Mixed,
  requestMethod: String,
  requestHeaders: mongoose.Schema.Types.Mixed,

  // Response Information
  responseStatus: Number,
  responseTime: Number, // in milliseconds
  responseBody: mongoose.Schema.Types.Mixed,

  // Additional Metadata
  metadata: {
    patientId: String,
    prescriptionId: String,
    appointmentId: String,
    userId: String,
    operation: String,
    reason: String,
    department: String,
    location: String,
    deviceId: String,
    sessionId: String,
    errorMessage: String,
    stackTrace: String,
    additionalInfo: mongoose.Schema.Types.Mixed
  },

  // Security Information
  security: {
    threatLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    suspicious: {
      type: Boolean,
      default: false
    },
    blocked: {
      type: Boolean,
      default: false
    }
  },

  // Compliance Information
  compliance: {
    hipaaRelevant: {
      type: Boolean,
      default: false
    },
    gdprRelevant: {
      type: Boolean,
      default: false
    },
    dataClassification: {
      type: String,
      enum: ['public', 'internal', 'confidential', 'restricted']
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ 'metadata.patientId': 1 });
auditLogSchema.index({ 'security.suspicious': 1, 'security.threatLevel': 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ ipAddress: 1 });

// TTL index to automatically delete old logs after 2 years
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });

// Static methods
auditLogSchema.statics.logUserActivity = async function(userId, action, metadata = {}) {
  return await this.create({
    user: userId,
    action,
    resource: metadata.resource || 'N/A',
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
    metadata
  });
};

auditLogSchema.statics.logSecurityEvent = async function(action, threatLevel, metadata = {}) {
  return await this.create({
    action,
    resource: metadata.resource || 'SYSTEM',
    security: {
      threatLevel,
      suspicious: true
    },
    metadata
  });
};

auditLogSchema.statics.getRecentActivity = async function(userId, limit = 10) {
  return await this.find({ user: userId })
    .sort('-createdAt')
    .limit(limit)
    .select('action resource createdAt responseStatus');
};

auditLogSchema.statics.getSuspiciousActivity = async function(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return await this.find({
    'security.suspicious': true,
    createdAt: { $gte: since }
  })
    .populate('user', 'firstName lastName email')
    .sort('-createdAt');
};

auditLogSchema.statics.getFailedLoginAttempts = async function(ipAddress, hours = 1) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return await this.countDocuments({
    action: 'LOGIN_FAILED',
    ipAddress,
    createdAt: { $gte: since }
  });
};

auditLogSchema.statics.generateComplianceReport = async function(startDate, endDate, type = 'hipaa') {
  const query = {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  if (type === 'hipaa') {
    query['compliance.hipaaRelevant'] = true;
  } else if (type === 'gdpr') {
    query['compliance.gdprRelevant'] = true;
  }

  const logs = await this.find(query)
    .populate('user', 'firstName lastName email role')
    .sort('-createdAt');

  // Group by action type
  const summary = logs.reduce((acc, log) => {
    if (!acc[log.action]) {
      acc[log.action] = 0;
    }
    acc[log.action]++;
    return acc;
  }, {});

  return {
    period: {
      start: startDate,
      end: endDate
    },
    totalEvents: logs.length,
    summary,
    logs: logs.slice(0, 1000) // Limit to 1000 entries
  };
};

// Instance methods
auditLogSchema.methods.markAsSuspicious = async function(reason) {
  this.security.suspicious = true;
  this.metadata.suspiciousReason = reason;
  return await this.save();
};

auditLogSchema.methods.setThreatLevel = async function(level) {
  this.security.threatLevel = level;
  return await this.save();
};

// Pre-save middleware
auditLogSchema.pre('save', function(next) {
  // Auto-classify data based on action
  if (this.action.includes('PATIENT') || this.action.includes('PRESCRIPTION')) {
    this.compliance.hipaaRelevant = true;
    this.compliance.dataClassification = 'confidential';
  }

  // Detect suspicious patterns
  if (this.action === 'LOGIN_FAILED' && !this.security.suspicious) {
    // Check for multiple failed attempts
    this.constructor.getFailedLoginAttempts(this.ipAddress, 1).then(count => {
      if (count > 5) {
        this.security.suspicious = true;
        this.security.threatLevel = 'medium';
      }
    });
  }

  next();
});

module.exports = mongoose.model('AuditLog', auditLogSchema);