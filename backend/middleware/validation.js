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
    .optional()
    .trim()
    .isEmail()
    .withMessage('Adresse email invalide')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email trop long'),
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Nom d\'utilisateur invalide'),
  body('password')
    .notEmpty()
    .withMessage('Mot de passe requis')
    .isLength({ min: 6, max: 128 })
    .withMessage('Mot de passe invalide'),
  // Custom validator: at least email or username required
  body().custom((_, { req }) => {
    if (!req.body.email && !req.body.username) {
      throw new Error('Email ou nom d\'utilisateur requis');
    }
    return true;
  }),
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

// =====================================================
// OPHTHALMOLOGY SESSION VALIDATORS
// =====================================================

const validateOphthalmologySessionStart = [
  body('patientId')
    .notEmpty()
    .withMessage('Patient requis')
    .custom(isValidObjectId)
    .withMessage('ID patient invalide'),
  body('appointmentId')
    .optional()
    .custom(isValidObjectId)
    .withMessage('ID rendez-vous invalide'),
  body('examType')
    .optional()
    .isIn(['comprehensive', 'refraction', 'contact-lens', 'follow-up', 'emergency', 'screening', 'pre-operative', 'post-operative'])
    .withMessage('Type d\'examen invalide'),
  handleValidationErrors
];

const validateOphthalmologyExamUpdate = [
  param('id')
    .custom(isValidObjectId)
    .withMessage('ID examen invalide'),
  body('visualAcuity.OD.uncorrected')
    .optional()
    .matches(/^(10\/10|[1-9]\/10|1\/20|1\/50|CLD|VBLM|PL\+|PL-|NLP)$/i)
    .withMessage('Acuite visuelle OD invalide (Monoyer scale)'),
  body('visualAcuity.OS.uncorrected')
    .optional()
    .matches(/^(10\/10|[1-9]\/10|1\/20|1\/50|CLD|VBLM|PL\+|PL-|NLP)$/i)
    .withMessage('Acuite visuelle OS invalide (Monoyer scale)'),
  body('refraction.*.sphere')
    .optional()
    .isFloat({ min: -30, max: 30 })
    .withMessage('Sphere invalide (-30 a +30)'),
  body('refraction.*.cylinder')
    .optional()
    .isFloat({ min: -10, max: 10 })
    .withMessage('Cylindre invalide (-10 a +10)'),
  body('refraction.*.axis')
    .optional()
    .isInt({ min: 0, max: 180 })
    .withMessage('Axe invalide (0-180)'),
  body('intraocularPressure.OD')
    .optional()
    .isFloat({ min: 0, max: 80 })
    .withMessage('PIO OD invalide (0-80 mmHg)'),
  body('intraocularPressure.OS')
    .optional()
    .isFloat({ min: 0, max: 80 })
    .withMessage('PIO OS invalide (0-80 mmHg)'),
  handleValidationErrors
];

// =====================================================
// LABORATORY ORDER VALIDATORS (enhanced)
// =====================================================

const validateLabOrderCreate = [
  body('patient')
    .notEmpty()
    .withMessage('Patient requis')
    .custom(isValidObjectId)
    .withMessage('ID patient invalide'),
  body('tests')
    .isArray({ min: 1 })
    .withMessage('Au moins un test requis'),
  body('tests.*.testCode')
    .notEmpty()
    .withMessage('Code du test requis')
    .isLength({ max: 50 })
    .withMessage('Code du test trop long'),
  body('tests.*.testName')
    .notEmpty()
    .withMessage('Nom du test requis')
    .isLength({ max: 200 })
    .withMessage('Nom du test trop long')
    .customSanitizer(sanitizeString),
  body('priority')
    .optional()
    .isIn(['routine', 'urgent', 'stat'])
    .withMessage('Priorite invalide'),
  body('clinicalNotes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes cliniques trop longues')
    .customSanitizer(sanitizeString),
  handleValidationErrors
];

const validateLabResultEntry = [
  param('orderId')
    .custom(isValidObjectId)
    .withMessage('ID commande invalide'),
  body('testCode')
    .notEmpty()
    .withMessage('Code du test requis'),
  body('value')
    .notEmpty()
    .withMessage('Valeur du resultat requise'),
  body('unit')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Unite trop longue'),
  body('referenceRange')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Plage de reference trop longue'),
  body('abnormalFlag')
    .optional()
    .isIn(['normal', 'low', 'high', 'critical-low', 'critical-high', 'abnormal'])
    .withMessage('Indicateur anormal invalide'),
  handleValidationErrors
];

// =====================================================
// SURGERY VALIDATORS
// =====================================================

const validateSurgeryCaseCreate = [
  body('patient')
    .notEmpty()
    .withMessage('Patient requis')
    .custom(isValidObjectId)
    .withMessage('ID patient invalide'),
  body('surgeryType')
    .notEmpty()
    .withMessage('Type de chirurgie requis')
    .isLength({ max: 200 })
    .withMessage('Type de chirurgie trop long')
    .customSanitizer(sanitizeString),
  body('eye')
    .optional()
    .isIn(['OD', 'OS', 'OU'])
    .withMessage('Oeil invalide (OD, OS, ou OU)'),
  body('scheduledDate')
    .notEmpty()
    .withMessage('Date programmee requise')
    .isISO8601()
    .withMessage('Format de date invalide'),
  body('surgeon')
    .notEmpty()
    .withMessage('Chirurgien requis')
    .custom(isValidObjectId)
    .withMessage('ID chirurgien invalide'),
  body('anesthesiaType')
    .optional()
    .isIn(['local', 'topical', 'peribulbar', 'retrobulbar', 'general', 'sedation'])
    .withMessage('Type d\'anesthesie invalide'),
  body('preOpDiagnosis')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Diagnostic pre-operatoire trop long')
    .customSanitizer(sanitizeString),
  handleValidationErrors
];

const validateSurgeryNoteCreate = [
  param('caseId')
    .custom(isValidObjectId)
    .withMessage('ID cas chirurgical invalide'),
  body('noteType')
    .notEmpty()
    .withMessage('Type de note requis')
    .isIn(['operative', 'pre-op', 'post-op', 'complication', 'follow-up'])
    .withMessage('Type de note invalide'),
  body('content')
    .notEmpty()
    .withMessage('Contenu de la note requis')
    .isLength({ max: 10000 })
    .withMessage('Contenu de la note trop long')
    .customSanitizer(sanitizeString),
  handleValidationErrors
];

const validateSurgeryReportCreate = [
  param('id')
    .custom(isValidObjectId)
    .withMessage('ID cas chirurgical invalide'),
  body('procedure')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description de la procedure trop longue')
    .customSanitizer(sanitizeString),
  body('findings')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Constatations trop longues')
    .customSanitizer(sanitizeString),
  body('complications')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Complications trop longues')
    .customSanitizer(sanitizeString),
  handleValidationErrors
];

// =====================================================
// PRESCRIPTION VALIDATORS (enhanced)
// =====================================================

const validatePrescriptionUpdate = [
  param('id')
    .custom(isValidObjectId)
    .withMessage('ID ordonnance invalide'),
  body('status')
    .optional()
    .isIn(['pending', 'partial', 'dispensed', 'expired', 'cancelled'])
    .withMessage('Statut invalide'),
  body('medications.*.quantity')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Quantite invalide (1-1000)'),
  handleValidationErrors
];

const validatePrescriptionDispense = [
  param('id')
    .custom(isValidObjectId)
    .withMessage('ID ordonnance invalide'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Au moins un medicament a dispenser requis'),
  body('items.*.medicationId')
    .notEmpty()
    .withMessage('ID medicament requis')
    .custom(isValidObjectId)
    .withMessage('ID medicament invalide'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Quantite invalide (1-1000)'),
  body('items.*.lotNumber')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Numero de lot trop long'),
  handleValidationErrors
];

// =====================================================
// PHARMACY VALIDATORS
// =====================================================

const validatePharmacyDispense = [
  body('prescriptionId')
    .optional()
    .custom(isValidObjectId)
    .withMessage('ID ordonnance invalide'),
  body('patientId')
    .notEmpty()
    .withMessage('Patient requis')
    .custom(isValidObjectId)
    .withMessage('ID patient invalide'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Au moins un article requis'),
  body('items.*.inventoryId')
    .notEmpty()
    .withMessage('ID inventaire requis')
    .custom(isValidObjectId)
    .withMessage('ID inventaire invalide'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 10000 })
    .withMessage('Quantite invalide (1-10000)'),
  body('items.*.lotNumber')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Numero de lot trop long'),
  handleValidationErrors
];

const validatePharmacyStockAdjustment = [
  body('inventoryId')
    .notEmpty()
    .withMessage('ID inventaire requis')
    .custom(isValidObjectId)
    .withMessage('ID inventaire invalide'),
  body('quantity')
    .isInt({ min: -100000, max: 100000 })
    .withMessage('Quantite invalide'),
  body('reason')
    .notEmpty()
    .withMessage('Motif requis')
    .isIn(['damaged', 'expired', 'lost', 'found', 'correction', 'transfer', 'return', 'other'])
    .withMessage('Motif invalide'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes trop longues')
    .customSanitizer(sanitizeString),
  handleValidationErrors
];

const validatePharmacyMedicationCreate = [
  body('name')
    .notEmpty()
    .withMessage('Nom du medicament requis')
    .isLength({ max: 200 })
    .withMessage('Nom du medicament trop long')
    .customSanitizer(sanitizeString),
  body('genericName')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Nom generique trop long')
    .customSanitizer(sanitizeString),
  body('category')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Categorie trop longue'),
  body('dosageForm')
    .optional()
    .isIn(['tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'patch', 'suppository', 'solution', 'suspension', 'powder', 'other'])
    .withMessage('Forme galenique invalide'),
  body('strength')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Dosage trop long'),
  body('quantity')
    .optional()
    .isInt({ min: 0, max: 1000000 })
    .withMessage('Quantite invalide'),
  body('reorderLevel')
    .optional()
    .isInt({ min: 0, max: 100000 })
    .withMessage('Seuil de reapprovisionnement invalide'),
  body('price')
    .optional()
    .isFloat({ min: 0, max: 10000000 })
    .withMessage('Prix invalide'),
  handleValidationErrors
];

// =====================================================
// INVENTORY TRANSFER VALIDATORS
// =====================================================

const validateInventoryTransferCreate = [
  body('sourceClinic')
    .notEmpty()
    .withMessage('Clinique source requise')
    .custom(isValidObjectId)
    .withMessage('ID clinique source invalide'),
  body('destinationClinic')
    .notEmpty()
    .withMessage('Clinique destination requise')
    .custom(isValidObjectId)
    .withMessage('ID clinique destination invalide')
    .custom((value, { req }) => {
      if (value === req.body.sourceClinic) {
        throw new Error('La clinique destination doit etre differente de la source');
      }
      return true;
    }),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Au moins un article requis'),
  body('items.*.inventoryId')
    .notEmpty()
    .withMessage('ID inventaire requis')
    .custom(isValidObjectId)
    .withMessage('ID inventaire invalide'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 10000 })
    .withMessage('Quantite invalide (1-10000)'),
  body('items.*.lotNumber')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Numero de lot trop long'),
  body('priority')
    .optional()
    .isIn(['normal', 'urgent', 'emergency'])
    .withMessage('Priorite invalide'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes trop longues')
    .customSanitizer(sanitizeString),
  handleValidationErrors
];

const validateInventoryTransferUpdate = [
  param('id')
    .custom(isValidObjectId)
    .withMessage('ID transfert invalide'),
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'in-transit', 'received', 'completed', 'cancelled'])
    .withMessage('Statut invalide'),
  body('receivedQuantities')
    .optional()
    .isArray()
    .withMessage('Quantites recues doivent etre un tableau'),
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
  validatePrescriptionUpdate,
  validatePrescriptionDispense,
  // Invoice
  validateInvoiceCreate,
  validatePayment,
  // Lab
  validateLabTestCreate,
  validateLabOrderCreate,
  validateLabResultEntry,
  // Ophthalmology
  validateOphthalmologyExam,
  validateOphthalmologySessionStart,
  validateOphthalmologyExamUpdate,
  // Surgery
  validateSurgeryCaseCreate,
  validateSurgeryNoteCreate,
  validateSurgeryReportCreate,
  // Pharmacy
  validatePharmacyDispense,
  validatePharmacyStockAdjustment,
  validatePharmacyMedicationCreate,
  // Inventory Transfer
  validateInventoryTransferCreate,
  validateInventoryTransferUpdate,
  // Queue
  validateQueueAdd,
  validateQueueUpdate,
  // Common
  validatePagination,
  validateDateRange,
  validateObjectIdParam
};
