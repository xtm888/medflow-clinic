/**
 * Input Validation Middleware
 * Provides reusable validation schemas for API endpoints
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to handle validation errors
 * Returns 400 with detailed error messages if validation fails
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }

  next();
};

// =====================================================
// COMMON VALIDATORS
// =====================================================

/**
 * Validate MongoDB ObjectId format
 */
const isValidObjectId = (value) => {
  return /^[0-9a-fA-F]{24}$/.test(value);
};

/**
 * Sanitize string to prevent XSS
 */
const sanitizeString = (value) => {
  if (typeof value !== 'string') return value;
  return value
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim();
};

// =====================================================
// AUTHENTICATION VALIDATORS
// =====================================================

const validateLogin = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Adresse email invalide')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email trop long'),
  body('password')
    .notEmpty()
    .withMessage('Mot de passe requis')
    .isLength({ min: 6, max: 128 })
    .withMessage('Mot de passe invalide'),
  handleValidationErrors
];

const validateRegister = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Adresse email invalide')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email trop long'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Prénom requis')
    .isLength({ max: 100 })
    .withMessage('Prénom trop long')
    .customSanitizer(sanitizeString),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Nom requis')
    .isLength({ max: 100 })
    .withMessage('Nom trop long')
    .customSanitizer(sanitizeString),
  body('role')
    .optional()
    .isIn(['admin', 'doctor', 'nurse', 'receptionist', 'ophthalmologist', 'optometrist', 'pharmacist', 'lab_technician'])
    .withMessage('Rôle invalide'),
  handleValidationErrors
];

const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Mot de passe actuel requis'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Le nouveau mot de passe doit contenir au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('Le nouveau mot de passe doit être différent de l\'ancien');
      }
      return true;
    }),
  handleValidationErrors
];

// =====================================================
// PATIENT VALIDATORS
// =====================================================

const validatePatientCreate = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Prénom requis')
    .isLength({ max: 100 })
    .withMessage('Prénom trop long')
    .customSanitizer(sanitizeString),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Nom requis')
    .isLength({ max: 100 })
    .withMessage('Nom trop long')
    .customSanitizer(sanitizeString),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date de naissance invalide')
    .custom((value) => {
      const dob = new Date(value);
      const now = new Date();
      if (dob > now) {
        throw new Error('La date de naissance ne peut pas être dans le futur');
      }
      const age = (now - dob) / (365.25 * 24 * 60 * 60 * 1000);
      if (age > 150) {
        throw new Error('Date de naissance invalide');
      }
      return true;
    }),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Genre invalide'),
  body('phoneNumber')
    .optional()
    .trim()
    .matches(/^[+]?[\d\s\-()]{6,20}$/)
    .withMessage('Numéro de téléphone invalide'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Adresse email invalide')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email trop long'),
  body('address.street')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Adresse trop longue')
    .customSanitizer(sanitizeString),
  body('address.city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Ville trop longue')
    .customSanitizer(sanitizeString),
  body('emergencyContact.name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Nom du contact trop long')
    .customSanitizer(sanitizeString),
  body('emergencyContact.phone')
    .optional()
    .trim()
    .matches(/^[+]?[\d\s\-()]{6,20}$/)
    .withMessage('Numéro de téléphone du contact invalide'),
  handleValidationErrors
];

const validatePatientUpdate = [
  param('id')
    .custom(isValidObjectId)
    .withMessage('ID patient invalide'),
  body('firstName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Prénom ne peut pas être vide')
    .isLength({ max: 100 })
    .withMessage('Prénom trop long')
    .customSanitizer(sanitizeString),
  body('lastName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Nom ne peut pas être vide')
    .isLength({ max: 100 })
    .withMessage('Nom trop long')
    .customSanitizer(sanitizeString),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Adresse email invalide')
    .normalizeEmail(),
  handleValidationErrors
];

// =====================================================
// APPOINTMENT VALIDATORS
// =====================================================

const validateAppointmentCreate = [
  body('patient')
    .notEmpty()
    .withMessage('Patient requis')
    .custom(isValidObjectId)
    .withMessage('ID patient invalide'),
  body('provider')
    .optional()
    .custom(isValidObjectId)
    .withMessage('ID praticien invalide'),
  body('date')
    .notEmpty()
    .withMessage('Date requise')
    .isISO8601()
    .withMessage('Format de date invalide')
    .custom((value) => {
      const appointmentDate = new Date(value);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (appointmentDate < now) {
        throw new Error('La date du rendez-vous ne peut pas être dans le passé');
      }
      return true;
    }),
  body('startTime')
    .notEmpty()
    .withMessage('Heure de début requise')
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Format d\'heure invalide (HH:MM)'),
  body('endTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Format d\'heure invalide (HH:MM)'),
  body('type')
    .optional()
    .isIn(['consultation', 'follow-up', 'emergency', 'routine-checkup', 'vaccination', 'lab-test', 'imaging', 'procedure', 'surgery', 'ophthalmology', 'refraction', 'telemedicine'])
    .withMessage('Type de rendez-vous invalide'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Motif trop long')
    .customSanitizer(sanitizeString),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes trop longues')
    .customSanitizer(sanitizeString),
  handleValidationErrors
];

const validateAppointmentUpdate = [
  param('id')
    .custom(isValidObjectId)
    .withMessage('ID rendez-vous invalide'),
  body('status')
    .optional()
    .isIn(['scheduled', 'confirmed', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show'])
    .withMessage('Statut invalide'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Format de date invalide'),
  body('startTime')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Format d\'heure invalide (HH:MM)'),
  handleValidationErrors
];

// =====================================================
// PRESCRIPTION VALIDATORS
// =====================================================

const validatePrescriptionCreate = [
  body('patient')
    .notEmpty()
    .withMessage('Patient requis')
    .custom(isValidObjectId)
    .withMessage('ID patient invalide'),
  body('medications')
    .isArray({ min: 1 })
    .withMessage('Au moins un médicament requis'),
  body('medications.*.medication')
    .notEmpty()
    .withMessage('Nom du médicament requis')
    .isLength({ max: 200 })
    .withMessage('Nom du médicament trop long'),
  body('medications.*.dosage')
    .notEmpty()
    .withMessage('Dosage requis')
    .isLength({ max: 100 })
    .withMessage('Dosage trop long'),
  body('medications.*.quantity')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Quantité invalide'),
  body('duration')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Durée invalide (1-365 jours)'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes trop longues')
    .customSanitizer(sanitizeString),
  handleValidationErrors
];

// =====================================================
// INVOICE VALIDATORS
// =====================================================

const validateInvoiceCreate = [
  body('patient')
    .notEmpty()
    .withMessage('Patient requis')
    .custom(isValidObjectId)
    .withMessage('ID patient invalide'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Au moins un article requis'),
  body('items.*.description')
    .notEmpty()
    .withMessage('Description requise')
    .isLength({ max: 500 })
    .withMessage('Description trop longue'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 10000 })
    .withMessage('Quantité invalide'),
  body('items.*.unitPrice')
    .isFloat({ min: 0, max: 1000000 })
    .withMessage('Prix unitaire invalide'),
  body('discount')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Remise invalide (0-100%)'),
  handleValidationErrors
];

const validatePayment = [
  body('amount')
    .isFloat({ min: 0.01, max: 10000000 })
    .withMessage('Montant invalide'),
  body('method')
    .isIn(['cash', 'card', 'transfer', 'mobile_money', 'insurance', 'check', 'other'])
    .withMessage('Mode de paiement invalide'),
  body('reference')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Référence trop longue')
    .customSanitizer(sanitizeString),
  handleValidationErrors
];

// =====================================================
// QUERY VALIDATORS
// =====================================================

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Numéro de page invalide')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite invalide (max 100)')
    .toInt(),
  handleValidationErrors
];

const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Format de date de début invalide'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Format de date de fin invalide')
    .custom((value, { req }) => {
      if (req.query.startDate && new Date(value) < new Date(req.query.startDate)) {
        throw new Error('La date de fin doit être après la date de début');
      }
      return true;
    }),
  handleValidationErrors
];

const validateObjectIdParam = [
  param('id')
    .custom(isValidObjectId)
    .withMessage('ID invalide'),
  handleValidationErrors
];

// =====================================================
// LABORATORY VALIDATORS
// =====================================================

const validateLabTestCreate = [
  body('patient')
    .notEmpty()
    .withMessage('Patient requis')
    .custom(isValidObjectId)
    .withMessage('ID patient invalide'),
  body('tests')
    .isArray({ min: 1 })
    .withMessage('Au moins un test requis'),
  body('tests.*.name')
    .notEmpty()
    .withMessage('Nom du test requis')
    .isLength({ max: 200 })
    .withMessage('Nom du test trop long'),
  body('priority')
    .optional()
    .isIn(['routine', 'urgent', 'stat'])
    .withMessage('Priorité invalide'),
  handleValidationErrors
];

// =====================================================
// OPHTHALMOLOGY VALIDATORS
// =====================================================

const validateOphthalmologyExam = [
  body('patient')
    .notEmpty()
    .withMessage('Patient requis')
    .custom(isValidObjectId)
    .withMessage('ID patient invalide'),
  body('visualAcuity.rightEye.uncorrected')
    .optional()
    .matches(/^(20\/\d+|[0-9]+\/[0-9]+|CF|HM|LP|NLP|NT)$/i)
    .withMessage('Format d\'acuité visuelle invalide'),
  body('visualAcuity.leftEye.uncorrected')
    .optional()
    .matches(/^(20\/\d+|[0-9]+\/[0-9]+|CF|HM|LP|NLP|NT)$/i)
    .withMessage('Format d\'acuité visuelle invalide'),
  body('intraocularPressure.rightEye')
    .optional()
    .isFloat({ min: 0, max: 80 })
    .withMessage('PIO invalide (0-80 mmHg)'),
  body('intraocularPressure.leftEye')
    .optional()
    .isFloat({ min: 0, max: 80 })
    .withMessage('PIO invalide (0-80 mmHg)'),
  handleValidationErrors
];

// =====================================================
// QUEUE VALIDATORS
// =====================================================

const validateQueueAdd = [
  body('appointmentId')
    .optional()
    .custom(isValidObjectId)
    .withMessage('ID rendez-vous invalide'),
  body('walkIn')
    .optional()
    .isBoolean()
    .withMessage('walkIn doit être un booléen'),
  body('patientInfo.firstName')
    .if(body('walkIn').equals('true'))
    .notEmpty()
    .withMessage('Prénom requis pour walk-in')
    .isLength({ max: 100 })
    .customSanitizer(sanitizeString),
  body('patientInfo.lastName')
    .if(body('walkIn').equals('true'))
    .notEmpty()
    .withMessage('Nom requis pour walk-in')
    .isLength({ max: 100 })
    .customSanitizer(sanitizeString),
  body('priority')
    .optional()
    .isIn(['normal', 'high', 'urgent', 'emergency', 'vip', 'pregnant', 'elderly'])
    .withMessage('Priorité invalide'),
  handleValidationErrors
];

const validateQueueUpdate = [
  param('id')
    .custom(isValidObjectId)
    .withMessage('ID invalide'),
  body('status')
    .optional()
    .isIn(['checked-in', 'in-progress', 'completed', 'cancelled', 'no-show'])
    .withMessage('Statut invalide'),
  body('priority')
    .optional()
    .isIn(['normal', 'high', 'urgent', 'emergency', 'vip', 'pregnant', 'elderly'])
    .withMessage('Priorité invalide'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  isValidObjectId,
  sanitizeString,
  // Auth
  validateLogin,
  validateRegister,
  validatePasswordChange,
  // Patient
  validatePatientCreate,
  validatePatientUpdate,
  // Appointment
  validateAppointmentCreate,
  validateAppointmentUpdate,
  // Prescription
  validatePrescriptionCreate,
  // Invoice
  validateInvoiceCreate,
  validatePayment,
  // Lab
  validateLabTestCreate,
  // Ophthalmology
  validateOphthalmologyExam,
  // Queue
  validateQueueAdd,
  validateQueueUpdate,
  // Common
  validatePagination,
  validateDateRange,
  validateObjectIdParam
};
