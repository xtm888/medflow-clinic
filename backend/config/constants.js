/**
 * Application Constants
 *
 * Centralized constants to replace magic numbers throughout the codebase.
 * This improves maintainability and makes the intent of values clear.
 */

module.exports = {
  // ==========================================
  // PRESCRIPTION & MEDICATION
  // ==========================================
  PRESCRIPTION: {
    // Validity periods (in days)
    MEDICATION_VALIDITY_DAYS: 90,      // Standard medication prescription valid for 90 days
    OPTICAL_VALIDITY_DAYS: 365,        // Optical prescriptions valid for 1 year
    THERAPY_VALIDITY_DAYS: 180,        // Therapy prescriptions valid for 6 months

    // Refill limits
    MAX_REFILLS: 5,
    DEFAULT_REFILLS: 0
  },

  // ==========================================
  // INVOICES & BILLING
  // ==========================================
  INVOICE: {
    // Payment terms (in days)
    DEFAULT_DUE_DAYS: 30,              // Standard invoices due in 30 days
    URGENT_DUE_DAYS: 7,                // Urgent invoices due in 7 days
    INSURANCE_DUE_DAYS: 60,            // Insurance invoices due in 60 days

    // Overdue periods
    OVERDUE_WARNING_DAYS: 7,           // Warn when 7 days overdue
    OVERDUE_CRITICAL_DAYS: 30,         // Critical when 30 days overdue

    // Payment limits
    MIN_PAYMENT_AMOUNT: 100,           // Minimum payment: 100 CDF
    MAX_PAYMENT_AMOUNT: 100000000      // Maximum single payment: 100M CDF
  },

  // ==========================================
  // FILE UPLOADS
  // ==========================================
  UPLOAD: {
    // Size limits (in bytes)
    MAX_IMAGE_SIZE_MB: 10,
    MAX_IMAGE_SIZE_BYTES: 10 * 1024 * 1024,      // 10 MB
    MAX_DOCUMENT_SIZE_MB: 20,
    MAX_DOCUMENT_SIZE_BYTES: 20 * 1024 * 1024,   // 20 MB
    MAX_VIDEO_SIZE_MB: 100,
    MAX_VIDEO_SIZE_BYTES: 100 * 1024 * 1024,     // 100 MB

    // Allowed file types
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp'],
    ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ALLOWED_DICOM_TYPES: ['application/dicom'],

    // File extensions
    ALLOWED_IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
    ALLOWED_DOCUMENT_EXTENSIONS: ['.pdf', '.doc', '.docx'],
    ALLOWED_DICOM_EXTENSIONS: ['.dcm', '.dicom']
  },

  // ==========================================
  // AUTHENTICATION & SECURITY
  // ==========================================
  AUTH: {
    // Session & token expiry
    SESSION_TIMEOUT_MINUTES: 60,       // User session timeout
    SESSION_TIMEOUT_MS: 60 * 60 * 1000,
    ACCESS_TOKEN_EXPIRY_MINUTES: 15,   // Short-lived access tokens
    REFRESH_TOKEN_EXPIRY_DAYS: 7,      // Refresh tokens valid for 1 week
    RESET_TOKEN_EXPIRY_HOURS: 1,       // Password reset tokens valid for 1 hour

    // Password requirements
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_MAX_LENGTH: 128,
    PASSWORD_REQUIRE_UPPERCASE: true,
    PASSWORD_REQUIRE_LOWERCASE: true,
    PASSWORD_REQUIRE_NUMBER: true,
    PASSWORD_REQUIRE_SPECIAL: false,   // Optional for DRC context

    // Login attempt limits
    MAX_LOGIN_ATTEMPTS: 5,
    LOGIN_LOCKOUT_MINUTES: 15,
    LOGIN_LOCKOUT_MS: 15 * 60 * 1000,

    // Two-factor authentication
    TWO_FACTOR_CODE_LENGTH: 6,
    TWO_FACTOR_CODE_EXPIRY_MINUTES: 10
  },

  // ==========================================
  // APPOINTMENTS & VISITS
  // ==========================================
  APPOINTMENT: {
    // Duration (in minutes)
    DEFAULT_DURATION_MINUTES: 30,
    CONSULTATION_DURATION_MINUTES: 30,
    FOLLOW_UP_DURATION_MINUTES: 15,
    PROCEDURE_DURATION_MINUTES: 60,
    SURGERY_DURATION_MINUTES: 120,

    // Reminder timing
    REMINDER_HOURS_BEFORE: 24,         // Send reminder 24 hours before
    REMINDER_DAYS_BEFORE: 1,

    // No-show timeout
    NO_SHOW_TIMEOUT_MINUTES: 30        // Mark as no-show if 30 min late
  },

  VISIT: {
    // Auto-complete timeout
    AUTO_COMPLETE_HOURS: 24,           // Auto-complete visits older than 24 hours

    // Documentation requirements
    MIN_CHIEF_COMPLAINT_LENGTH: 3,
    MIN_HPI_LENGTH: 10
  },

  // ==========================================
  // QUEUE MANAGEMENT
  // ==========================================
  QUEUE: {
    // Time estimates (in minutes)
    WAIT_TIME_PER_PATIENT_MINUTES: 15,     // Estimated wait per patient in queue
    MAX_WAIT_TIME_MINUTES: 180,            // Max reasonable wait time (3 hours)

    // Priority levels
    PRIORITY_LEVELS: ['emergency', 'urgent', 'normal', 'low'],
    PRIORITY_WEIGHTS: {
      emergency: 0,    // No wait
      urgent: 5,       // 5 min
      normal: 15,      // 15 min
      low: 30          // 30 min
    },

    // Auto-actions
    AUTO_CALL_TIMEOUT_MINUTES: 5,          // Auto-skip if not called within 5 min
    AUTO_NO_SHOW_MINUTES: 30               // Mark no-show after 30 min
  },

  // ==========================================
  // APPOINTMENT CANCELLATION
  // ==========================================
  CANCELLATION: {
    // Fee thresholds (in hours before appointment)
    VERY_LATE_THRESHOLD_HOURS: 2,          // Less than 2 hours = very late
    LATE_THRESHOLD_HOURS: 24,              // Less than 24 hours = late

    // Fee percentages
    VERY_LATE_FEE_PERCENT: 100,            // 100% fee if < 2 hours
    LATE_FEE_PERCENT: 50,                  // 50% fee if < 24 hours
    NORMAL_FEE_PERCENT: 0,                 // No fee if >= 24 hours

    // Approval requirements
    REQUIRE_APPROVAL_THRESHOLD_HOURS: 2    // Require approval if < 2 hours
  },

  // ==========================================
  // PAGINATION & LIMITS
  // ==========================================
  PAGINATION: {
    // Default page sizes
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    MIN_PAGE_SIZE: 5,

    // Specific entity limits
    PATIENTS_PER_PAGE: 20,
    APPOINTMENTS_PER_PAGE: 50,
    VISITS_PER_PAGE: 20,
    INVOICES_PER_PAGE: 20,
    PRESCRIPTIONS_PER_PAGE: 20,
    LAB_RESULTS_PER_PAGE: 50,

    // Search limits
    SEARCH_RESULTS_LIMIT: 50,
    AUTOCOMPLETE_RESULTS_LIMIT: 10
  },

  // ==========================================
  // DATABASE & PERFORMANCE
  // ==========================================
  DATABASE: {
    // Connection pooling
    MIN_POOL_SIZE: 10,
    MAX_POOL_SIZE: 50,

    // Timeouts (in milliseconds)
    SOCKET_TIMEOUT_MS: 45000,          // 45 seconds
    SERVER_SELECTION_TIMEOUT_MS: 5000, // 5 seconds
    CONNECT_TIMEOUT_MS: 10000,         // 10 seconds

    // Reconnection
    RECONNECT_TRIES: Number.MAX_VALUE,
    RECONNECT_INTERVAL_MS: 1000,       // 1 second between retries

    // Query limits
    MAX_QUERY_TIME_MS: 30000,          // 30 second max query time
    SLOW_QUERY_THRESHOLD_MS: 100       // Log queries slower than 100ms
  },

  // ==========================================
  // CACHING
  // ==========================================
  CACHE: {
    // TTL (Time To Live) in seconds
    FEE_SCHEDULE_TTL: 3600,            // 1 hour
    USER_TTL: 900,                     // 15 minutes
    PATIENT_TTL: 300,                  // 5 minutes
    SETTINGS_TTL: 3600,                // 1 hour
    CLINIC_TTL: 3600,                  // 1 hour

    // Cache key prefixes
    PREFIX_FEE: 'fee:',
    PREFIX_USER: 'user:',
    PREFIX_PATIENT: 'patient:',
    PREFIX_SETTINGS: 'settings:',
    PREFIX_SESSION: 'session:'
  },

  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  NOTIFICATION: {
    // SMS limits
    MAX_SMS_LENGTH: 160,               // Standard SMS length
    MAX_SMS_BATCH_SIZE: 100,           // Send max 100 SMS at once

    // Email limits
    MAX_EMAIL_RECIPIENTS: 50,
    MAX_EMAIL_ATTACHMENTS: 5,
    MAX_EMAIL_ATTACHMENT_SIZE_MB: 10,

    // Retry logic
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 5000,              // 5 seconds between retries

    // Rate limiting
    SMS_PER_HOUR_LIMIT: 100,
    EMAIL_PER_HOUR_LIMIT: 200
  },

  // ==========================================
  // WEBSOCKET / REAL-TIME
  // ==========================================
  WEBSOCKET: {
    // Heartbeat / ping-pong
    PING_INTERVAL_MS: 30000,           // Ping every 30 seconds
    PONG_TIMEOUT_MS: 5000,             // Expect pong within 5 seconds

    // Reconnection
    MAX_RECONNECT_ATTEMPTS: 5,
    RECONNECT_DELAY_MS: 3000,          // 3 seconds between attempts
    RECONNECT_BACKOFF_MULTIPLIER: 1.5  // Exponential backoff
  },

  // ==========================================
  // INVENTORY
  // ==========================================
  INVENTORY: {
    // Stock levels
    LOW_STOCK_THRESHOLD: 10,           // Alert when stock below 10 units
    CRITICAL_STOCK_THRESHOLD: 5,       // Critical when below 5 units

    // Expiry warnings
    EXPIRING_SOON_DAYS: 90,            // Warn when expires in 90 days
    EXPIRED_GRACE_PERIOD_DAYS: 7,      // Grace period for expired items

    // Reservation timeout
    RESERVATION_TIMEOUT_HOURS: 24,     // Release reservation after 24 hours
    RESERVATION_TIMEOUT_MS: 24 * 60 * 60 * 1000
  },

  // ==========================================
  // REPORTS & ANALYTICS
  // ==========================================
  REPORTS: {
    // Date ranges
    DEFAULT_REPORT_DAYS: 30,           // Default to last 30 days
    MAX_REPORT_DAYS: 365,              // Max 1 year of data

    // Export limits
    MAX_EXPORT_ROWS: 10000,            // Max rows in CSV/Excel export
    EXPORT_TIMEOUT_MS: 60000           // 60 second export timeout
  },

  // ==========================================
  // DEVICE INTEGRATION
  // ==========================================
  DEVICE: {
    // Sync intervals (in milliseconds)
    AUTO_SYNC_INTERVAL_MS: 300000,     // Auto-sync every 5 minutes
    DEVICE_TIMEOUT_MS: 30000,          // 30 second device timeout

    // File monitoring
    FILE_WATCH_DEBOUNCE_MS: 5000,      // 5 second debounce for file changes
    MAX_FILES_PER_SYNC: 100,           // Process max 100 files per sync

    // Network discovery
    DISCOVERY_TIMEOUT_MS: 5000,        // 5 second discovery timeout
    DISCOVERY_RETRY_ATTEMPTS: 3
  },

  // ==========================================
  // RATE LIMITING
  // ==========================================
  RATE_LIMIT: {
    // General API
    GENERAL_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    GENERAL_MAX_REQUESTS: 100,

    // Login endpoint
    LOGIN_WINDOW_MS: 15 * 60 * 1000,   // 15 minutes
    LOGIN_MAX_ATTEMPTS: 5,

    // Password reset
    RESET_WINDOW_MS: 60 * 60 * 1000,   // 1 hour
    RESET_MAX_ATTEMPTS: 3,

    // Search endpoint
    SEARCH_WINDOW_MS: 60 * 1000,       // 1 minute
    SEARCH_MAX_REQUESTS: 30,

    // Report generation
    REPORT_WINDOW_MS: 60 * 60 * 1000,  // 1 hour
    REPORT_MAX_REQUESTS: 10
  },

  // ==========================================
  // AUDIT & LOGGING
  // ==========================================
  AUDIT: {
    // Retention periods (in days)
    AUDIT_LOG_RETENTION_DAYS: 2555,    // 7 years for medical records
    ERROR_LOG_RETENTION_DAYS: 90,
    ACCESS_LOG_RETENTION_DAYS: 365,

    // Log levels
    LOG_LEVELS: ['error', 'warn', 'info', 'debug'],
    DEFAULT_LOG_LEVEL: 'info',

    // Batch processing
    AUDIT_BATCH_SIZE: 100,             // Write audit logs in batches of 100
    AUDIT_BATCH_INTERVAL_MS: 5000      // Flush every 5 seconds
  },

  // ==========================================
  // CURRENCIES
  // ==========================================
  CURRENCY: {
    // Base currency
    BASE_CURRENCY: 'CDF',              // Congolese Franc

    // Supported currencies
    SUPPORTED_CURRENCIES: ['CDF', 'USD', 'EUR'],

    // Exchange rate update
    EXCHANGE_RATE_UPDATE_HOURS: 24,    // Update rates daily

    // Rounding precision
    AMOUNT_DECIMAL_PLACES: 2
  },

  // ==========================================
  // SYSTEM HEALTH
  // ==========================================
  HEALTH: {
    // Check intervals (in milliseconds)
    HEALTH_CHECK_INTERVAL_MS: 60000,   // Check every minute

    // Thresholds
    CPU_THRESHOLD_PERCENT: 80,
    MEMORY_THRESHOLD_PERCENT: 85,
    DISK_THRESHOLD_PERCENT: 90,

    // Response time thresholds (in milliseconds)
    RESPONSE_TIME_WARNING_MS: 1000,    // Warn if response > 1 second
    RESPONSE_TIME_CRITICAL_MS: 5000    // Critical if response > 5 seconds
  }
};
