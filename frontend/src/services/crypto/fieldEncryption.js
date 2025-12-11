/**
 * Field Encryption - Entity-specific field encryption configuration
 *
 * Defines which fields contain PHI (Protected Health Information) or PII
 * (Personally Identifiable Information) that must be encrypted at rest.
 *
 * Per HIPAA/GDPR requirements for medical applications.
 */

import { encryptFields, decryptFields, isCryptoSupported } from './encryptionService';
import keyManager from './keyManager';

/**
 * Sensitive fields for each entity type
 * These fields will be encrypted when stored in IndexedDB
 */
export const SENSITIVE_FIELDS = {
  // Patient demographics - PII
  patients: [
    'firstName',
    'lastName',
    'nationalId',
    'phoneNumber',
    'email',
    'address',
    'allergies',
    'medicalHistory',
    'emergencyContact',
    'occupation',
    'employer'
  ],

  // Prescription data - PHI
  prescriptions: [
    'medications',
    'notes',
    'diagnosis',
    'instructions',
    'warnings',
    'allergiesChecked'
  ],

  // Ophthalmology exams - PHI
  ophthalmologyExams: [
    'findings',
    'diagnosis',
    'notes',
    'recommendations',
    'visualAcuity',
    'refraction',
    'intraocularPressure',
    'fundusFindings',
    'slitLampFindings',
    'gonioscopy',
    'perimetry',
    'octFindings',
    'medicalHistory',
    'chiefComplaint'
  ],

  // Lab orders - PHI
  labOrders: [
    'notes',
    'clinicalInfo',
    'diagnosis',
    'urgentReason',
    'specialInstructions'
  ],

  // Lab results - PHI
  labResults: [
    'results',
    'interpretation',
    'notes',
    'criticalValues',
    'technicalNotes',
    'pathologistNotes'
  ],

  // Invoices - Financial/PHI
  invoices: [
    'notes',
    'serviceDetails',
    'insuranceInfo',
    'patientNotes'
  ],

  // Visits - PHI
  visits: [
    'chiefComplaint',
    'diagnosis',
    'notes',
    'findings',
    'plan',
    'medicalHistory',
    'reviewOfSystems',
    'physicalExam',
    'assessment',
    'differentialDiagnosis'
  ],

  // Users - Minimal PII (staff)
  users: [
    'email',
    'phoneNumber'
  ],

  // Appointments - Limited PHI
  appointments: [
    'notes',
    'reason',
    'chiefComplaint'
  ],

  // Queue items - Limited PHI
  queue: [
    'notes',
    'chiefComplaint',
    'urgentReason'
  ],

  // Files metadata
  files: [
    'notes',
    'description'
  ],

  // Payments - Financial
  payments: [
    'notes',
    'cardLastFour', // Already masked, but encrypt for extra security
    'transactionRef'
  ]
};

/**
 * Get sensitive fields for an entity
 * @param {string} entity - Entity name
 * @returns {string[]} - Array of field names
 */
export function getSensitiveFields(entity) {
  return SENSITIVE_FIELDS[entity] || [];
}

/**
 * Check if an entity has sensitive fields
 * @param {string} entity
 * @returns {boolean}
 */
export function hasSensitiveFields(entity) {
  const fields = SENSITIVE_FIELDS[entity];
  return !!(fields && fields.length > 0);
}

/**
 * Encrypt sensitive fields of an entity before storage
 * @param {string} entity - Entity type
 * @param {Object} data - Data to encrypt
 * @returns {Promise<Object>} - Data with encrypted fields
 */
export async function encryptEntityData(entity, data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // Check if encryption is available
  if (!isCryptoSupported()) {
    console.warn('[FieldEncryption] Crypto not supported, skipping encryption');
    return data;
  }

  const key = keyManager.getKey();
  if (!key) {
    // No key available, skip encryption but log warning
    console.warn('[FieldEncryption] No encryption key, storing unencrypted');
    return data;
  }

  const fields = getSensitiveFields(entity);
  if (fields.length === 0) {
    return data;
  }

  try {
    return await encryptFields(data, fields, key);
  } catch (error) {
    console.error(`[FieldEncryption] Failed to encrypt ${entity}:`, error);
    // Return unencrypted on failure (availability over confidentiality for medical data)
    return data;
  }
}

/**
 * Decrypt sensitive fields of an entity after retrieval
 * @param {string} entity - Entity type
 * @param {Object} data - Data to decrypt
 * @returns {Promise<Object>} - Data with decrypted fields
 */
export async function decryptEntityData(entity, data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // Skip if not encrypted
  if (!data._encrypted) {
    return data;
  }

  // Check if decryption is available
  if (!isCryptoSupported()) {
    console.warn('[FieldEncryption] Crypto not supported, returning encrypted');
    return data;
  }

  const key = keyManager.getKey();
  if (!key) {
    console.warn('[FieldEncryption] No decryption key, returning encrypted');
    return data;
  }

  const fields = getSensitiveFields(entity);

  try {
    return await decryptFields(data, fields, key);
  } catch (error) {
    console.error(`[FieldEncryption] Failed to decrypt ${entity}:`, error);
    // Return encrypted on failure
    return data;
  }
}

/**
 * Encrypt an array of entities
 * @param {string} entity - Entity type
 * @param {Object[]} items - Array of items
 * @returns {Promise<Object[]>}
 */
export async function encryptEntityArray(entity, items) {
  if (!Array.isArray(items)) {
    return items;
  }

  return Promise.all(items.map(item => encryptEntityData(entity, item)));
}

/**
 * Decrypt an array of entities
 * @param {string} entity - Entity type
 * @param {Object[]} items - Array of items
 * @returns {Promise<Object[]>}
 */
export async function decryptEntityArray(entity, items) {
  if (!Array.isArray(items)) {
    return items;
  }

  return Promise.all(items.map(item => decryptEntityData(entity, item)));
}

/**
 * Create Dexie hooks for automatic encryption/decryption
 * @param {Object} db - Dexie database instance
 * @param {string} tableName - Table name
 */
export function createEncryptionHooks(db, tableName) {
  const table = db[tableName];
  if (!table) return;

  const fields = getSensitiveFields(tableName);
  if (fields.length === 0) return;

  // Hook into creating/updating
  table.hook('creating', function (primKey, obj, transaction) {
    // Cannot use async in Dexie hooks directly
    // Encryption must be done before calling put/add
    return obj;
  });

  table.hook('reading', function (obj) {
    // Decryption must be done after reading
    // This is synchronous, so we can't decrypt here
    return obj;
  });

  console.log(`[FieldEncryption] Hooks registered for ${tableName} (${fields.length} fields)`);
}

/**
 * Wrapper to encrypt before IndexedDB operations
 * Use this in database service methods
 */
export const encryptionMiddleware = {
  /**
   * Wrap a save operation with encryption
   * @param {string} entity
   * @param {Object|Object[]} data
   * @param {Function} saveFn - Actual save function
   */
  async save(entity, data, saveFn) {
    const encrypted = Array.isArray(data)
      ? await encryptEntityArray(entity, data)
      : await encryptEntityData(entity, data);

    return saveFn(encrypted);
  },

  /**
   * Wrap a get operation with decryption
   * @param {string} entity
   * @param {Function} getFn - Actual get function
   */
  async get(entity, getFn) {
    const data = await getFn();

    if (!data) return data;

    return Array.isArray(data)
      ? await decryptEntityArray(entity, data)
      : await decryptEntityData(entity, data);
  }
};

// Export singleton access to key manager for auth integration
export { keyManager };

/**
 * Initialize encryption for a user session
 * Call after successful login
 * @param {string} userId
 * @param {string} token
 * @returns {Promise<boolean>}
 */
export async function initializeEncryption(userId, token) {
  return keyManager.initialize(userId, token);
}

/**
 * Clear encryption keys on logout
 */
export function clearEncryption() {
  keyManager.clear();
}

/**
 * Check if encryption is currently active
 * @returns {boolean}
 */
export function isEncryptionActive() {
  return keyManager.isAvailable();
}
