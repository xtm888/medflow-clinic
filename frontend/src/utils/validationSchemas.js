/**
 * Centralized Validation Schemas and Utilities
 * Provides consistent validation across all forms in the application.
 */

// ============================================================================
// VALIDATION PATTERNS
// ============================================================================

export const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[+]?[\d\s()-]{8,}$/,
  congoPhone: /^(\+243|0)[\d\s]{9,}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  time: /^\d{2}:\d{2}$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  numeric: /^\d+$/
};

// ============================================================================
// VALIDATION MESSAGES (French)
// ============================================================================

export const messages = {
  required: (field) => `${field} est requis`,
  email: 'Adresse email invalide',
  phone: 'Numéro de téléphone invalide',
  password: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre',
  minLength: (field, min) => `${field} doit contenir au moins ${min} caractères`,
  maxLength: (field, max) => `${field} ne doit pas dépasser ${max} caractères`,
  min: (field, min) => `${field} doit être au moins ${min}`,
  max: (field, max) => `${field} ne doit pas dépasser ${max}`,
  date: 'Date invalide',
  futureDate: 'La date doit être dans le futur',
  pastDate: 'La date doit être dans le passé',
  range: (field, min, max) => `${field} doit être entre ${min} et ${max}`
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check if value is empty
 */
export const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

/**
 * Validate required field
 */
export const validateRequired = (value, fieldName = 'Ce champ') => {
  if (isEmpty(value)) {
    return messages.required(fieldName);
  }
  return null;
};

/**
 * Validate email
 */
export const validateEmail = (value) => {
  if (isEmpty(value)) return null;
  if (!patterns.email.test(value)) {
    return messages.email;
  }
  return null;
};

/**
 * Validate phone number
 */
export const validatePhone = (value, isCongo = false) => {
  if (isEmpty(value)) return null;
  const pattern = isCongo ? patterns.congoPhone : patterns.phone;
  if (!pattern.test(value)) {
    return messages.phone;
  }
  return null;
};

/**
 * Validate password strength
 */
export const validatePassword = (value) => {
  if (isEmpty(value)) return null;
  if (!patterns.password.test(value)) {
    return messages.password;
  }
  return null;
};

/**
 * Validate minimum length
 */
export const validateMinLength = (value, min, fieldName = 'Ce champ') => {
  if (isEmpty(value)) return null;
  if (value.length < min) {
    return messages.minLength(fieldName, min);
  }
  return null;
};

/**
 * Validate date is in the future
 */
export const validateFutureDate = (value) => {
  if (isEmpty(value)) return null;
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today) {
    return messages.futureDate;
  }
  return null;
};

/**
 * Validate date is in the past
 */
export const validatePastDate = (value) => {
  if (isEmpty(value)) return null;
  const date = new Date(value);
  const today = new Date();
  if (date > today) {
    return messages.pastDate;
  }
  return null;
};

// ============================================================================
// FORM VALIDATION SCHEMAS
// ============================================================================

/**
 * Patient form validation
 */
export const patientSchema = {
  firstName: [
    (v) => validateRequired(v, 'Le prénom'),
    (v) => validateMinLength(v, 2, 'Le prénom')
  ],
  lastName: [
    (v) => validateRequired(v, 'Le nom'),
    (v) => validateMinLength(v, 2, 'Le nom')
  ],
  dateOfBirth: [
    (v) => validateRequired(v, 'La date de naissance'),
    (v) => validatePastDate(v)
  ],
  gender: [
    (v) => validateRequired(v, 'Le genre')
  ],
  phone: [
    (v) => validatePhone(v, true)
  ],
  email: [
    (v) => validateEmail(v)
  ]
};

/**
 * Appointment form validation
 */
export const appointmentSchema = {
  patient: [
    (v) => validateRequired(v, 'Le patient')
  ],
  provider: [
    (v) => validateRequired(v, 'Le médecin')
  ],
  department: [
    (v) => validateRequired(v, 'Le département')
  ],
  date: [
    (v) => validateRequired(v, 'La date')
  ],
  time: [
    (v) => validateRequired(v, 'L\'heure')
  ],
  type: [
    (v) => validateRequired(v, 'Le type de rendez-vous')
  ],
  reason: [
    (v) => validateRequired(v, 'Le motif')
  ]
};

/**
 * Prescription form validation
 */
export const prescriptionSchema = {
  patient: [
    (v) => validateRequired(v, 'Le patient')
  ],
  medications: [
    (v) => isEmpty(v) ? 'Au moins un médicament est requis' : null
  ]
};

/**
 * Invoice form validation
 */
export const invoiceSchema = {
  patient: [
    (v) => validateRequired(v, 'Le patient')
  ],
  items: [
    (v) => isEmpty(v) ? 'Au moins un article est requis' : null
  ],
  issueDate: [
    (v) => validateRequired(v, 'La date d\'émission')
  ],
  dueDate: [
    (v) => validateRequired(v, 'La date d\'échéance')
  ]
};

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate a single field against its validators
 */
export const validateField = (value, validators) => {
  if (!validators) return null;

  for (const validator of validators) {
    const error = validator(value);
    if (error) return error;
  }

  return null;
};

/**
 * Validate entire form against a schema
 */
export const validateForm = (formData, schema) => {
  const errors = {};

  for (const [field, validators] of Object.entries(schema)) {
    const error = validateField(formData[field], validators);
    if (error) {
      errors[field] = error;
    }
  }

  return errors;
};

/**
 * Check if form has any errors
 */
export const hasErrors = (errors) => {
  return Object.keys(errors).length > 0;
};

/**
 * Get first error message
 */
export const getFirstError = (errors) => {
  const values = Object.values(errors);
  return values.length > 0 ? values[0] : null;
};

// ============================================================================
// CUSTOM VALIDATORS
// ============================================================================

/**
 * Create a custom required validator
 */
export const required = (message) => (value) => {
  if (isEmpty(value)) return message;
  return null;
};

/**
 * Create a minimum value validator
 */
export const min = (minValue, message) => (value) => {
  if (isEmpty(value)) return null;
  if (Number(value) < minValue) return message || messages.min('La valeur', minValue);
  return null;
};

/**
 * Create a maximum value validator
 */
export const max = (maxValue, message) => (value) => {
  if (isEmpty(value)) return null;
  if (Number(value) > maxValue) return message || messages.max('La valeur', maxValue);
  return null;
};

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

const validation = {
  patterns,
  messages,
  isEmpty,
  validateRequired,
  validateEmail,
  validatePhone,
  validatePassword,
  validateMinLength,
  validateFutureDate,
  validatePastDate,
  validateField,
  validateForm,
  hasErrors,
  getFirstError,
  required,
  min,
  max,
  schemas: {
    patient: patientSchema,
    appointment: appointmentSchema,
    prescription: prescriptionSchema,
    invoice: invoiceSchema
  }
};

export default validation;
