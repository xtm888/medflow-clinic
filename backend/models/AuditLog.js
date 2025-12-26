const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // User Information
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  // Clinic context (optional for system-wide operations)
  clinic: {
    type: mongoose.Schema.ObjectId,
    ref: 'Clinic',
    index: true
    // Not required - system operations may not have clinic context
  },

  // Action Details
  action: {
    type: String,
    required: true,
    enum: [
      // Authentication
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'LOGOUT',
      'PASSWORD_CHANGE',
      'PASSWORD_RESET',
      'EMAIL_VERIFICATION',
      'TWO_FACTOR_ENABLE',
      'TWO_FACTOR_DISABLE',
      'SESSION_EXPIRED',
      'TOKEN_REFRESH',

      // Generic Data Operations
      'DATA_ACCESS',
      'DATA_CREATE',
      'DATA_UPDATE',
      'DATA_DELETE',
      'DATA_EXPORT',
      'DATA_IMPORT',

      // Patient Management
      'PATIENT_CREATE',
      'PATIENT_UPDATE',
      'PATIENT_DELETE',
      'PATIENT_VIEW',
      'PATIENT_DATA_ACCESS',
      'PATIENT_MERGE',
      'PATIENT_ARCHIVE',

      // Face Recognition / Biometrics
      'FACE_DUPLICATE_CHECK',
      'FACE_ENROLLMENT',
      'FACE_VERIFICATION_SUCCESS',
      'FACE_VERIFICATION_FAILED',
      'FACE_ENCODING_DELETED',

      // Prescriptions
      'PRESCRIPTION_CREATE',
      'PRESCRIPTION_UPDATE',
      'PRESCRIPTION_DELETE',
      'PRESCRIPTION_DISPENSE',
      'PRESCRIPTION_VERIFY',
      'PRESCRIPTION_VIEW',
      'PRESCRIPTION_PRINT',
      'PRESCRIPTION_CANCEL',
      'PRESCRIPTION_REFILL',

      // Appointments
      'APPOINTMENT_CREATE',
      'APPOINTMENT_UPDATE',
      'APPOINTMENT_DELETE',
      'APPOINTMENT_CANCEL',
      'APPOINTMENT_CHECKIN',
      'APPOINTMENT_CHECKOUT',
      'APPOINTMENT_RESCHEDULE',

      // User Management
      'USER_CREATE',
      'USER_UPDATE',
      'USER_DELETE',
      'USER_ACTIVATE',
      'USER_DEACTIVATE',
      'PERMISSION_CHANGE',
      'ROLE_CHANGE',

      // Billing & Payments
      'INVOICE_CREATE',
      'INVOICE_UPDATE',
      'INVOICE_DELETE',
      'INVOICE_VOID',
      'PAYMENT_PROCESS',
      'PAYMENT_REFUND',
      'PAYMENT_VOID',
      'DISCOUNT_APPLY',
      'WRITE_OFF',
      'MULTI_CURRENCY_PAYMENT',
      'INSURANCE_CLAIM_CREATE',
      'INSURANCE_CLAIM_UPDATE',
      'INSURANCE_CLAIM_SUBMIT',

      // Inventory & Pharmacy
      'INVENTORY_ADD',
      'INVENTORY_UPDATE',
      'INVENTORY_DELETE',
      'INVENTORY_ADJUST',
      'INVENTORY_VIEW',
      'INVENTORY_STATS_VIEW',
      'INVENTORY_ALERTS_VIEW',
      'INVENTORY_LOW_STOCK_VIEW',
      'INVENTORY_EXPIRING_VIEW',
      'INVENTORY_VALUE_VIEW',
      'INVENTORY_EXPORT',
      'STOCK_TRANSFER',
      'MEDICATION_DISPENSE',
      'MEDICATION_VIEW',
      'MEDICATION_SEARCH',
      'STOCK_RESERVATION',
      'STOCK_RESERVATION_CANCEL',
      'BATCH_ADD',
      'BATCH_UPDATE',
      'BATCH_VIEW',
      'BATCH_EXPIRE',
      'BATCH_RECALL',
      'LOW_STOCK_ALERT',
      'REORDER_TRIGGERED',
      'REORDER_CREATE',
      'REORDER_SUGGESTIONS_VIEW',
      'ORDER_RECEIVE',
      'SUPPLIER_CREATE',
      'SUPPLIER_UPDATE',
      'SUPPLIER_DELETE',
      'SUPPLIER_VIEW',
      'TRANSACTION_HISTORY_VIEW',
      'PROFIT_MARGIN_VIEW',
      'PROFIT_MARGIN_ANALYSIS',
      'ALERT_RESOLVE',

      // Laboratory
      'LAB_ORDER_CREATE',
      'LAB_ORDER_UPDATE',
      'LAB_ORDER_VIEW',
      'LAB_ORDER_CANCEL',
      'LAB_SPECIMEN_COLLECT',
      'LAB_SPECIMEN_RECEIVE',
      'LAB_RESULT_ENTER',
      'LAB_RESULT_UPDATE',
      'LAB_RESULT_VERIFY',
      'LAB_RESULT_VIEW',
      'LAB_CRITICAL_VALUE_NOTIFY',
      'LAB_CRITICAL_VALUE_ACKNOWLEDGE',

      // Clinical
      'VISIT_CREATE',
      'VISIT_UPDATE',
      'VISIT_COMPLETE',
      'DIAGNOSIS_ADD',
      'DIAGNOSIS_UPDATE',
      'DIAGNOSIS_DELETE',
      'VITAL_SIGNS_RECORD',
      'CLINICAL_NOTE_CREATE',
      'CLINICAL_NOTE_UPDATE',
      'CLINICAL_NOTE_DELETE',

      // IVT (Intravitreal Injections)
      'IVT_INJECTION_CREATE',
      'IVT_INJECTION_UPDATE',
      'IVT_INJECTION_DELETE',
      'IVT_INJECTION_VIEW',
      'IVT_INJECTION_COMPLETE',
      'IVT_INJECTION_CANCEL',
      'IVT_SERIES_START',
      'IVT_PROTOCOL_CHANGE',
      'IVT_FOLLOWUP_RECORD',
      'IVT_PLAN_NEXT',
      'IVT_HISTORY_VIEW',
      'IVT_STATS_VIEW',

      // Queue Management
      'QUEUE_ADD',
      'QUEUE_UPDATE',
      'QUEUE_REMOVE',
      'QUEUE_VIEW',
      'QUEUE_STATS_VIEW',
      'QUEUE_ANALYTICS_VIEW',
      'QUEUE_CALL_PATIENT',
      'QUEUE_CALL_NEXT',
      'QUEUE_ASSIGN_ROOM',
      'QUEUE_PRIORITY_CHANGE',
      'QUEUE_STATUS_CHANGE',

      // Ophthalmology
      'REFRACTION_COPY_FROM_PREVIOUS',
      'REFRACTION_CREATE_BLANK',
      'REFRACTION_CREATE',
      'REFRACTION_UPDATE',
      'REFRACTION_VIEW',
      'OPHTHALMOLOGY_EXAM_CREATE',
      'OPHTHALMOLOGY_EXAM_UPDATE',
      'OPHTHALMOLOGY_EXAM_VIEW',
      'OPTICAL_PRESCRIPTION_CREATE',

      // Documents & Files
      'DOCUMENT_UPLOAD',
      'DOCUMENT_DOWNLOAD',
      'DOCUMENT_DELETE',
      'DOCUMENT_VIEW',
      'DOCUMENT_UPDATE',
      'DOCUMENT_SEARCH',
      'DOCUMENT_ANNOTATE',
      'DOCUMENT_SHARE',
      'DOCUMENT_PRINT',
      'DOCUMENT_GENERATE',
      'TEMPLATE_APPLY',
      'REPORT_GENERATE',
      'REPORT_EXPORT',

      // System & Configuration
      'SYSTEM_CONFIG_CHANGE',
      'SETTINGS_UPDATE',
      'TEMPLATE_CREATE',
      'TEMPLATE_UPDATE',
      'TEMPLATE_DELETE',
      'FEE_SCHEDULE_UPDATE',
      'TAX_RATE_CHANGE',

      // Critical Operations
      'CRITICAL_DATA_EXPORT',
      'CRITICAL_BULK_DELETE',
      'CRITICAL_PERMISSION_CHANGE',
      'CRITICAL_USER_ROLE_CHANGE',
      'CRITICAL_VISIT_SIGN',
      'CRITICAL_PRESCRIPTION_SIGN',
      'CRITICAL_SYSTEM_CONFIG_CHANGE',
      'CRITICAL_AUDIT_VIEW',
      'CRITICAL_BACKUP_CREATE',
      'CRITICAL_BACKUP_RESTORE',
      'CRITICAL_PAYMENT_ADD',
      'CRITICAL_PAYMENT_VOID',
      'CRITICAL_PAYMENT_REFUND',
      'CRITICAL_INVOICE_VOID',
      'CRITICAL_INVOICE_DELETE',

      // Security Events
      'SECURITY_ALERT',
      'SUSPICIOUS_ACTIVITY',
      'BRUTE_FORCE_DETECTED',
      'UNAUTHORIZED_ACCESS_ATTEMPT',
      'DATA_BREACH_DETECTED',

      // System Events
      'SYSTEM_ERROR',
      'BACKUP_CREATE',
      'BACKUP_RESTORE',
      'MAINTENANCE_MODE_TOGGLE',

      // Reagent Inventory
      'REAGENT_CREATE',
      'REAGENT_UPDATE',
      'REAGENT_DELETE',
      'REAGENT_VIEW',
      'REAGENT_LIST_VIEW',
      'REAGENT_SEARCH',
      'REAGENT_BATCH_ADD',
      'REAGENT_CONSUME',
      'REAGENT_CONSUME_QC',
      'REAGENT_ADJUST',
      'REAGENT_BATCH_EXPIRE',
      'REAGENT_DISPOSE',
      'REAGENT_LOW_STOCK_VIEW',
      'REAGENT_EXPIRING_VIEW',
      'REAGENT_STATS_VIEW',
      'REAGENT_VALUE_VIEW',
      'REAGENT_SECTION_VIEW',
      'REAGENT_MANUFACTURERS_VIEW',
      'REAGENT_TRANSACTIONS_VIEW',
      'REAGENT_QC_HISTORY_VIEW',
      'REAGENT_LINK_TEMPLATE',
      'REAGENT_ALERT_VIEW',
      'REAGENT_ALERT_RESOLVE',

      // Lab Consumable Inventory
      'LAB_CONSUMABLE_CREATE',
      'LAB_CONSUMABLE_UPDATE',
      'LAB_CONSUMABLE_DELETE',
      'LAB_CONSUMABLE_VIEW',
      'LAB_CONSUMABLE_LIST_VIEW',
      'LAB_CONSUMABLE_SEARCH',
      'LAB_CONSUMABLE_BATCH_ADD',
      'LAB_CONSUMABLE_CONSUME',
      'LAB_CONSUMABLE_ADJUST',
      'LAB_CONSUMABLE_DAMAGE',
      'LAB_CONSUMABLE_LOW_STOCK_VIEW',
      'LAB_CONSUMABLE_STATS_VIEW',
      'LAB_CONSUMABLE_VALUE_VIEW',
      'LAB_CONSUMABLE_CATEGORY_VIEW',
      'LAB_CONSUMABLE_TUBES_VIEW',
      'LAB_CONSUMABLE_TUBE_STATS_VIEW',
      'LAB_CONSUMABLE_MANUFACTURERS_VIEW',
      'LAB_CONSUMABLE_TRANSACTIONS_VIEW',
      'LAB_CONSUMABLE_ALERTS_VIEW',
      'LAB_CONSUMABLE_ALERT_RESOLVE',

      // Surgery
      'SURGERY_CASE_CREATE',
      'SURGERY_CASE_VIEW',
      'SURGERY_CASE_LIST',
      'SURGERY_SCHEDULE',
      'SURGERY_RESCHEDULE',
      'SURGERY_CANCEL',
      'SURGERY_CHECKIN',
      'SURGERY_START',
      'SURGERY_PREOP_UPDATE',
      'SURGERY_CONSUMABLES_ADD',
      'SURGERY_REPORT_CREATE',
      'SURGERY_REPORT_UPDATE',
      'SURGERY_REPORT_VIEW',
      'SURGERY_REPORT_FINALIZE',
      'SURGERY_SPECIMEN_ADD',
      'SURGERY_SPECIMEN_VIEW',
      'SURGERY_SPECIMEN_RESULTS_UPDATE',
      'SURGERY_DASHBOARD_VIEW',
      'SURGERY_TYPES_VIEW',
      'SURGERY_AGENDA_VIEW',
      'SURGERY_QUEUE_VIEW',
      'SURGERY_QUEUE_OVERDUE_VIEW',
      'SURGERY_OR_ROOMS_VIEW',
      'SURGERY_ROOM_SCHEDULE_VIEW',
      'SURGERY_CLINICAL_BACKGROUND_VIEW',
      'SURGERY_SURGEON_SCHEDULE_VIEW',
      'SURGERY_SURGEON_CHECKEDIN_VIEW',
      'SURGERY_SURGEON_DRAFTS_VIEW',
      'SURGERY_PATIENT_HISTORY_VIEW',
      'SURGERY_PENDING_PATHOLOGY_VIEW',

      // Optical Shop
      'OPTICAL_SHOP_DASHBOARD_VIEW',
      'OPTICAL_SHOP_PATIENT_SEARCH',
      'OPTICAL_SHOP_CONVENTION_VIEW',
      'OPTICAL_SHOP_PRESCRIPTION_VIEW',
      'OPTICAL_SALE_START',
      'OPTICAL_SALE_UPDATE',
      'OPTICAL_SALE_SUBMIT',
      'OPTICAL_AVAILABILITY_CHECK',
      'OPTICAL_VERIFICATION_QUEUE_VIEW',
      'OPTICAL_VERIFICATION_VIEW',
      'OPTICAL_VERIFICATION_APPROVE',
      'OPTICAL_VERIFICATION_REJECT',
      'OPTICAL_EXTERNAL_ORDER_VIEW',
      'OPTICAL_EXTERNAL_ORDER_UPDATE',
      'OPTICAL_EXTERNAL_ORDER_RECEIVE',
      'OPTICAL_UNBILLED_VIEW',
      'OPTICAL_INVOICE_GENERATE',
      'OPTICAL_PERFORMANCE_VIEW',
      'OPTICAL_LEADERBOARD_VIEW',

      // Frame Inventory
      'FRAME_CREATE',
      'FRAME_UPDATE',
      'FRAME_DELETE',
      'FRAME_VIEW',
      'FRAME_LIST_VIEW',
      'FRAME_SEARCH',
      'FRAME_STATS_VIEW',
      'FRAME_ALERTS_VIEW',
      'FRAME_LOW_STOCK_VIEW',
      'FRAME_BATCH_ADD',
      'FRAME_ADJUST',
      'FRAME_TRANSACTIONS_VIEW',
      'FRAME_ALERT_RESOLVE',

      // Optical Lens Inventory
      'OPTICAL_LENS_CREATE',
      'OPTICAL_LENS_UPDATE',
      'OPTICAL_LENS_DELETE',
      'OPTICAL_LENS_VIEW',
      'OPTICAL_LENS_LIST_VIEW',
      'OPTICAL_LENS_SEARCH',
      'OPTICAL_LENS_STATS_VIEW',
      'OPTICAL_LENS_ALERTS_VIEW',
      'OPTICAL_LENS_LOW_STOCK_VIEW',
      'OPTICAL_LENS_BATCH_ADD',
      'OPTICAL_LENS_ADJUST',
      'OPTICAL_LENS_TRANSACTIONS_VIEW',
      'OPTICAL_LENS_ALERT_RESOLVE',

      // Contact Lens Inventory
      'CONTACT_LENS_CREATE',
      'CONTACT_LENS_UPDATE',
      'CONTACT_LENS_DELETE',
      'CONTACT_LENS_VIEW',
      'CONTACT_LENS_LIST_VIEW',
      'CONTACT_LENS_SEARCH',
      'CONTACT_LENS_STATS_VIEW',
      'CONTACT_LENS_ALERTS_VIEW',
      'CONTACT_LENS_LOW_STOCK_VIEW',
      'CONTACT_LENS_BATCH_ADD',
      'CONTACT_LENS_ADJUST',
      'CONTACT_LENS_TRANSACTIONS_VIEW',
      'CONTACT_LENS_ALERT_RESOLVE',

      // Glasses Orders
      'GLASSES_ORDER_CREATE',
      'GLASSES_ORDER_UPDATE',
      'GLASSES_ORDER_DELETE',
      'GLASSES_ORDER_VIEW',
      'GLASSES_ORDER_LIST',
      'GLASSES_ORDER_STATUS_UPDATE',
      'GLASSES_ORDER_STATS_VIEW',
      'GLASSES_ORDER_UNBILLED_VIEW',
      'GLASSES_ORDER_INVOICE_GENERATE',
      'GLASSES_ORDER_PATIENT_VIEW',
      'GLASSES_ORDER_EXAM_VIEW',
      'GLASSES_ORDER_INVENTORY_CHECK',
      'GLASSES_ORDER_INVENTORY_RESERVE',
      'GLASSES_ORDER_INVENTORY_RELEASE',
      'GLASSES_ORDER_INVENTORY_FULFILL',
      'GLASSES_ORDER_INVENTORY_VIEW',
      'GLASSES_ORDER_FRAME_SEARCH',
      'GLASSES_ORDER_CONTACT_LENS_SEARCH',
      'GLASSES_ORDER_RECEIVE',
      'GLASSES_ORDER_QC',
      'GLASSES_ORDER_QC_OVERRIDE',
      'GLASSES_ORDER_DELIVER',
      'GLASSES_ORDER_PICKUP_REMINDER',
      'GLASSES_ORDER_PENDING_QC_VIEW',
      'GLASSES_ORDER_READY_PICKUP_VIEW',
      'GLASSES_ORDER_EXPORT_TO_LAB',
      'GLASSES_ORDER_EXPORT_DATA_VIEW',
      'GLASSES_ORDER_LAB_STATUS_UPDATE',
      'GLASSES_ORDER_PENDING_EXPORT_VIEW',
      'GLASSES_ORDER_AWAITING_LAB_VIEW',

      // Custom
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
auditLogSchema.index({ clinic: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ clinic: 1, user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ 'metadata.patientId': 1 });
auditLogSchema.index({ 'security.suspicious': 1, 'security.threatLevel': 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ ipAddress: 1 });

// TTL index to automatically delete old logs after 6 years (HIPAA requirement)
// HIPAA requires healthcare records be retained for minimum 6 years
// 6 years = 6 * 365.25 * 24 * 60 * 60 = 189,345,600 seconds
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 189345600 });

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
auditLogSchema.pre('save', async function(next) {
  // Auto-classify data based on action
  if (this.action.includes('PATIENT') || this.action.includes('PRESCRIPTION')) {
    this.compliance.hipaaRelevant = true;
    this.compliance.dataClassification = 'confidential';
  }

  // Detect suspicious patterns
  if (this.action === 'LOGIN_FAILED' && !this.security.suspicious) {
    // CRITICAL FIX: Use async/await with error handling to prevent unhandled promise rejection
    try {
      const count = await this.constructor.getFailedLoginAttempts(this.ipAddress, 1);
      if (count > 5) {
        this.security.suspicious = true;
        this.security.threatLevel = 'medium';
        console.warn(`Suspicious activity detected: ${count} failed logins from ${this.ipAddress}`);
      }
    } catch (error) {
      // Log error but don't fail the save operation
      console.error('Error checking failed login attempts:', error.message);
      // Default to flagging as suspicious if check fails (fail-secure)
      this.security.suspicious = true;
      this.security.threatLevel = 'low';
    }
  }

  next();
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
