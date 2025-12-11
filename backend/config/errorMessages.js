/**
 * Standardized Error Messages
 *
 * Centralized error messages for consistent API responses.
 * Organized by domain/feature area for easy maintenance.
 */

module.exports = {
  // ==========================================
  // AUTHENTICATION & AUTHORIZATION
  // ==========================================
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password',
    EMAIL_REQUIRED: 'Email is required',
    PASSWORD_REQUIRED: 'Password is required',
    PASSWORD_TOO_SHORT: 'Password must be at least 8 characters',
    PASSWORD_TOO_WEAK: 'Password must contain uppercase, lowercase, and numbers',
    USER_NOT_FOUND: 'User not found',
    USER_ALREADY_EXISTS: 'User with this email already exists',
    ACCOUNT_DISABLED: 'Your account has been disabled. Contact administrator.',
    TOKEN_INVALID: 'Invalid or expired token',
    TOKEN_MISSING: 'Authentication token required',
    INSUFFICIENT_PERMISSIONS: 'You do not have permission to perform this action',
    SESSION_EXPIRED: 'Your session has expired. Please log in again.',
    PASSWORD_RESET_INVALID: 'Password reset token is invalid or has expired',
    EMAIL_NOT_VERIFIED: 'Please verify your email address',
    TWO_FACTOR_REQUIRED: 'Two-factor authentication code required',
    TWO_FACTOR_INVALID: 'Invalid two-factor authentication code'
  },

  // ==========================================
  // PATIENT MANAGEMENT
  // ==========================================
  PATIENT: {
    NOT_FOUND: 'Patient not found',
    ID_REQUIRED: 'Patient ID is required',
    DUPLICATE_MRN: 'A patient with this medical record number already exists',
    INVALID_DATE_OF_BIRTH: 'Invalid date of birth',
    INVALID_PHONE: 'Invalid phone number format',
    INVALID_EMAIL: 'Invalid email address',
    FIRST_NAME_REQUIRED: 'First name is required',
    LAST_NAME_REQUIRED: 'Last name is required',
    GENDER_REQUIRED: 'Gender is required',
    ALREADY_REGISTERED: 'Patient is already registered',
    MINOR_NO_GUARDIAN: 'Guardian information required for patients under 18',
    MERGE_CONFLICT: 'Cannot merge: patients have conflicting data',
    DUPLICATE_DETECTION: 'Potential duplicate patient detected',
    INVALID_STATUS: 'Invalid patient status'
  },

  // ==========================================
  // APPOINTMENTS
  // ==========================================
  APPOINTMENT: {
    NOT_FOUND: 'Appointment not found',
    ID_REQUIRED: 'Appointment ID is required',
    PATIENT_REQUIRED: 'Patient is required',
    PROVIDER_REQUIRED: 'Provider is required',
    DATE_REQUIRED: 'Appointment date is required',
    TIME_REQUIRED: 'Appointment time is required',
    INVALID_DATE: 'Invalid appointment date',
    DATE_IN_PAST: 'Cannot schedule appointments in the past',
    SLOT_UNAVAILABLE: 'This appointment slot is not available',
    OVERLAPPING: 'This appointment conflicts with an existing appointment',
    ALREADY_CONFIRMED: 'Appointment is already confirmed',
    ALREADY_CANCELLED: 'Appointment is already cancelled',
    TOO_LATE_TO_CANCEL: 'Cannot cancel appointment less than 24 hours before scheduled time',
    INVALID_STATUS: 'Invalid appointment status',
    PROVIDER_UNAVAILABLE: 'Provider is not available at this time'
  },

  // ==========================================
  // VISITS
  // ==========================================
  VISIT: {
    NOT_FOUND: 'Visit not found',
    ID_REQUIRED: 'Visit ID is required',
    PATIENT_REQUIRED: 'Patient is required for visit',
    PROVIDER_REQUIRED: 'Provider is required for visit',
    ALREADY_COMPLETED: 'Visit is already completed',
    NOT_STARTED: 'Visit has not been started',
    CHIEF_COMPLAINT_REQUIRED: 'Chief complaint is required',
    VITAL_SIGNS_REQUIRED: 'Vital signs are required',
    INVALID_STATUS: 'Invalid visit status',
    CANNOT_COMPLETE: 'Cannot complete visit without required documentation',
    ALREADY_HAS_ACTIVE_VISIT: 'Patient already has an active visit'
  },

  // ==========================================
  // PRESCRIPTIONS
  // ==========================================
  PRESCRIPTION: {
    NOT_FOUND: 'Prescription not found',
    ID_REQUIRED: 'Prescription ID is required',
    PATIENT_REQUIRED: 'Patient is required',
    PRESCRIBER_REQUIRED: 'Prescriber is required',
    MEDICATION_REQUIRED: 'At least one medication is required',
    INVALID_DOSAGE: 'Invalid medication dosage',
    INVALID_FREQUENCY: 'Invalid dosage frequency',
    INVALID_DURATION: 'Invalid treatment duration',
    ALREADY_DISPENSED: 'Prescription has already been dispensed',
    ALREADY_CANCELLED: 'Prescription is already cancelled',
    EXPIRED: 'Prescription has expired',
    INSUFFICIENT_STOCK: 'Insufficient inventory for this medication',
    DRUG_INTERACTION: 'Potential drug interaction detected',
    ALLERGY_WARNING: 'Patient has documented allergy to this medication',
    INVALID_REFILLS: 'Invalid number of refills',
    MAX_REFILLS_EXCEEDED: 'Maximum number of refills exceeded'
  },

  // ==========================================
  // INVOICES & BILLING
  // ==========================================
  INVOICE: {
    NOT_FOUND: 'Invoice not found',
    ID_REQUIRED: 'Invoice ID is required',
    PATIENT_REQUIRED: 'Patient is required for invoice',
    NO_ITEMS: 'Invoice must have at least one item',
    INVALID_AMOUNT: 'Invalid invoice amount',
    AMOUNT_MISMATCH: 'Payment amount does not match invoice total',
    ALREADY_PAID: 'Invoice is already paid in full',
    OVERPAYMENT: 'Payment amount exceeds remaining balance',
    NEGATIVE_AMOUNT: 'Invoice amount cannot be negative',
    INVALID_PAYMENT_METHOD: 'Invalid payment method',
    INVALID_ITEM_ID: 'Invalid invoice item ID',
    ITEM_NOT_FOUND: 'Invoice item not found',
    CANNOT_MODIFY_PAID: 'Cannot modify a paid invoice',
    INVALID_STATUS: 'Invalid invoice status',
    DISCOUNT_TOO_HIGH: 'Discount cannot exceed 100%',
    FEE_SCHEDULE_NOT_FOUND: 'Fee schedule code not found',
    CONVENTION_NOT_ACTIVE: 'Patient convention is not active'
  },

  // ==========================================
  // PHARMACY & INVENTORY
  // ==========================================
  PHARMACY: {
    MEDICATION_NOT_FOUND: 'Medication not found in inventory',
    INSUFFICIENT_STOCK: 'Insufficient stock for this medication',
    BATCH_EXPIRED: 'Medication batch has expired',
    BATCH_NOT_FOUND: 'Medication batch not found',
    INVALID_QUANTITY: 'Invalid quantity',
    ALREADY_DISPENSED: 'Medication already dispensed',
    DISPENSE_FAILED: 'Failed to dispense medication',
    STOCK_BELOW_MINIMUM: 'Stock level below minimum threshold',
    REORDER_REQUIRED: 'Reorder required for this item',
    INVALID_EXPIRY_DATE: 'Invalid expiry date',
    NEGATIVE_STOCK: 'Stock level cannot be negative',
    RESERVATION_EXPIRED: 'Inventory reservation has expired',
    RESERVATION_NOT_FOUND: 'Inventory reservation not found'
  },

  // ==========================================
  // LABORATORY
  // ==========================================
  LAB: {
    ORDER_NOT_FOUND: 'Laboratory order not found',
    TEST_NOT_FOUND: 'Laboratory test not found',
    RESULT_NOT_FOUND: 'Laboratory result not found',
    PATIENT_REQUIRED: 'Patient is required for lab order',
    PROVIDER_REQUIRED: 'Ordering provider is required',
    NO_TESTS: 'Lab order must include at least one test',
    SPECIMEN_NOT_COLLECTED: 'Specimen not yet collected',
    ALREADY_COMPLETED: 'Lab test is already completed',
    CRITICAL_VALUE: 'Critical value detected - immediate physician notification required',
    QC_FAILED: 'Quality control check failed',
    ANALYZER_OFFLINE: 'Laboratory analyzer is offline',
    INVALID_RESULT: 'Invalid test result value',
    MISSING_REFERENCE_RANGE: 'Reference range not defined for this test'
  },

  // ==========================================
  // OPHTHALMOLOGY
  // ==========================================
  OPHTHALMOLOGY: {
    EXAM_NOT_FOUND: 'Ophthalmology exam not found',
    INVALID_VISUAL_ACUITY: 'Invalid visual acuity value',
    INVALID_IOP: 'Invalid intraocular pressure value',
    GLASSES_ORDER_NOT_FOUND: 'Glasses order not found',
    INVALID_PRESCRIPTION: 'Invalid optical prescription',
    INVALID_SPHERE: 'Invalid sphere value',
    INVALID_CYLINDER: 'Invalid cylinder value',
    INVALID_AXIS: 'Invalid axis value (must be 0-180)',
    INVALID_PD: 'Invalid pupillary distance',
    FRAME_NOT_SELECTED: 'Frame selection is required',
    LENS_TYPE_REQUIRED: 'Lens type is required',
    IVT_NOT_FOUND: 'IVT injection record not found',
    SURGERY_NOT_FOUND: 'Surgery case not found',
    INVALID_EYE: 'Invalid eye selection (must be OD, OS, or OU)'
  },

  // ==========================================
  // DOCUMENTS
  // ==========================================
  DOCUMENT: {
    NOT_FOUND: 'Document not found',
    INVALID_TYPE: 'Invalid document type',
    UPLOAD_FAILED: 'Document upload failed',
    FILE_TOO_LARGE: 'File size exceeds maximum limit',
    INVALID_FILE_TYPE: 'Invalid file type',
    GENERATION_FAILED: 'Document generation failed',
    TEMPLATE_NOT_FOUND: 'Document template not found',
    SIGNATURE_REQUIRED: 'Document signature is required',
    ALREADY_SIGNED: 'Document is already signed',
    MISSING_DATA: 'Required data missing for document generation'
  },

  // ==========================================
  // GENERAL / VALIDATION
  // ==========================================
  VALIDATION: {
    REQUIRED_FIELD: (field) => `${field} is required`,
    INVALID_FORMAT: (field) => `Invalid ${field} format`,
    INVALID_VALUE: (field) => `Invalid value for ${field}`,
    OUT_OF_RANGE: (field, min, max) => `${field} must be between ${min} and ${max}`,
    TOO_SHORT: (field, min) => `${field} must be at least ${min} characters`,
    TOO_LONG: (field, max) => `${field} must not exceed ${max} characters`,
    INVALID_ENUM: (field, values) => `${field} must be one of: ${values.join(', ')}`,
    INVALID_DATE_RANGE: 'Start date must be before end date',
    FUTURE_DATE_NOT_ALLOWED: 'Future dates are not allowed',
    PAST_DATE_NOT_ALLOWED: 'Past dates are not allowed'
  },

  // ==========================================
  // DATABASE / SYSTEM
  // ==========================================
  SYSTEM: {
    DATABASE_ERROR: 'Database error occurred. Please try again.',
    CONNECTION_ERROR: 'Database connection error',
    TRANSACTION_FAILED: 'Transaction failed and was rolled back',
    INTERNAL_ERROR: 'An internal server error occurred',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try again later.',
    MAINTENANCE_MODE: 'System is currently under maintenance',
    RATE_LIMIT_EXCEEDED: 'Too many requests. Please slow down.',
    TIMEOUT: 'Request timeout. Please try again.',
    NETWORK_ERROR: 'Network error. Please check your connection.',
    FILE_SYSTEM_ERROR: 'File system error occurred',
    REDIS_UNAVAILABLE: 'Cache service unavailable'
  },

  // ==========================================
  // DEVICES & INTEGRATION
  // ==========================================
  DEVICE: {
    NOT_FOUND: 'Medical device not found',
    OFFLINE: 'Device is offline',
    CONNECTION_FAILED: 'Failed to connect to device',
    SYNC_FAILED: 'Device data synchronization failed',
    INVALID_DATA: 'Invalid data received from device',
    FILE_PARSE_ERROR: 'Failed to parse device file',
    UNSUPPORTED_FORMAT: 'Unsupported file format',
    CALIBRATION_REQUIRED: 'Device calibration required',
    MAINTENANCE_DUE: 'Device maintenance is overdue'
  },

  // ==========================================
  // QUEUE MANAGEMENT
  // ==========================================
  QUEUE: {
    PATIENT_NOT_IN_QUEUE: 'Patient is not in queue',
    ALREADY_IN_QUEUE: 'Patient is already in queue',
    QUEUE_FULL: 'Queue is full',
    INVALID_PRIORITY: 'Invalid queue priority',
    CANNOT_SKIP: 'Cannot skip patient in queue',
    DEPARTMENT_REQUIRED: 'Department is required for queue'
  },

  // ==========================================
  // CONVENTIONS & INSURANCE
  // ==========================================
  CONVENTION: {
    NOT_FOUND: 'Convention not found',
    EXPIRED: 'Patient convention has expired',
    NOT_ACTIVE: 'Convention is not active',
    COVERAGE_EXCEEDED: 'Coverage limit exceeded for this service',
    SERVICE_NOT_COVERED: 'This service is not covered by the convention',
    APPROVAL_REQUIRED: 'Prior approval required for this service',
    INVALID_COVERAGE: 'Invalid coverage percentage',
    COMPANY_NOT_FOUND: 'Insurance company not found'
  }
};
