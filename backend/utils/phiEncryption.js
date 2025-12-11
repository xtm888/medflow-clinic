/**
 * PHI (Protected Health Information) Field-Level Encryption
 *
 * Provides encryption at rest for sensitive medical data including:
 * - Social Security Numbers
 * - Medical Record Numbers (if external)
 * - Diagnoses/ICD codes
 * - Genetic information
 * - Mental health records
 * - HIV/AIDS status
 * - Substance abuse treatment records
 *
 * Uses AES-256-GCM for authenticated encryption.
 * Encryption keys must be stored securely (e.g., in environment variables, HSM, or KMS).
 */

const crypto = require('crypto');

// Algorithm configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;      // GCM standard IV length
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;     // 256 bits

// Prefix for encrypted values (allows detection of encrypted vs plaintext)
const ENCRYPTED_PREFIX = 'enc:v1:';

/**
 * Get or validate encryption key
 * @returns {Buffer} 32-byte encryption key
 * @throws {Error} If key is not properly configured
 */
function getEncryptionKey() {
  const keyHex = process.env.PHI_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error('PHI_ENCRYPTION_KEY or ENCRYPTION_KEY environment variable not set');
  }

  // Convert hex string to buffer
  const key = Buffer.from(keyHex, 'hex');

  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters)`);
  }

  return key;
}

/**
 * Encrypt a string value
 * @param {string} plaintext - The value to encrypt
 * @returns {string} - Encrypted value with prefix, IV, auth tag, and ciphertext
 */
function encrypt(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') {
    return plaintext; // Return as-is if not a string
  }

  // Already encrypted
  if (plaintext.startsWith(ENCRYPTED_PREFIX)) {
    return plaintext;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Format: enc:v1:{iv}:{authTag}:{ciphertext}
  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt an encrypted value
 * @param {string} encryptedValue - The encrypted value to decrypt
 * @returns {string} - Decrypted plaintext
 */
function decrypt(encryptedValue) {
  if (!encryptedValue || typeof encryptedValue !== 'string') {
    return encryptedValue;
  }

  // Not encrypted
  if (!encryptedValue.startsWith(ENCRYPTED_PREFIX)) {
    return encryptedValue;
  }

  const key = getEncryptionKey();

  // Parse: enc:v1:{iv}:{authTag}:{ciphertext}
  const parts = encryptedValue.substring(ENCRYPTED_PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Check if a value is encrypted
 * @param {string} value - The value to check
 * @returns {boolean} - True if encrypted
 */
function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Create a Mongoose getter/setter pair for encrypted fields
 * @param {string} fieldName - Field name for error messages
 * @returns {Object} - Object with get and set functions for Mongoose schema
 *
 * @example
 * const patientSchema = new Schema({
 *   ssn: {
 *     type: String,
 *     ...encryptedField('ssn')
 *   }
 * });
 */
function encryptedField(fieldName) {
  return {
    get: function(value) {
      try {
        return decrypt(value);
      } catch (err) {
        console.error(`Error decrypting ${fieldName}:`, err.message);
        return value; // Return encrypted value if decryption fails
      }
    },
    set: function(value) {
      try {
        return encrypt(value);
      } catch (err) {
        console.error(`Error encrypting ${fieldName}:`, err.message);
        return value; // Return plaintext if encryption fails (log for debugging)
      }
    }
  };
}

/**
 * Mongoose plugin for PHI field encryption
 * Automatically encrypts/decrypts specified fields
 *
 * @example
 * const patientSchema = new Schema({ ... });
 * patientSchema.plugin(phiEncryptionPlugin, {
 *   fields: ['ssn', 'medicalRecordNumber', 'hivStatus']
 * });
 */
function phiEncryptionPlugin(schema, options = {}) {
  const { fields = [] } = options;

  // Apply encryption to specified fields
  fields.forEach(fieldPath => {
    const schemaPath = schema.path(fieldPath);
    if (schemaPath) {
      // Add getter and setter
      schemaPath.get(function(value) {
        try {
          return decrypt(value);
        } catch (err) {
          return value;
        }
      });

      schemaPath.set(function(value) {
        try {
          return encrypt(value);
        } catch (err) {
          return value;
        }
      });
    }
  });

  // Ensure getters are applied when converting to JSON/Object
  schema.set('toJSON', { getters: true, ...(schema.get('toJSON') || {}) });
  schema.set('toObject', { getters: true, ...(schema.get('toObject') || {}) });
}

/**
 * Encrypt an object's PHI fields
 * @param {Object} data - Object with PHI fields
 * @param {string[]} fields - Array of field names to encrypt
 * @returns {Object} - Object with encrypted fields
 */
function encryptFields(data, fields) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const result = { ...data };

  fields.forEach(field => {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = encrypt(String(result[field]));
    }
  });

  return result;
}

/**
 * Decrypt an object's PHI fields
 * @param {Object} data - Object with encrypted PHI fields
 * @param {string[]} fields - Array of field names to decrypt
 * @returns {Object} - Object with decrypted fields
 */
function decryptFields(data, fields) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const result = { ...data };

  fields.forEach(field => {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = decrypt(String(result[field]));
    }
  });

  return result;
}

/**
 * Re-encrypt data with a new key (for key rotation)
 * @param {string} encryptedValue - Currently encrypted value
 * @param {string} newKeyHex - New encryption key (hex string)
 * @returns {string} - Re-encrypted value
 */
function reEncrypt(encryptedValue, newKeyHex) {
  // Decrypt with current key
  const plaintext = decrypt(encryptedValue);

  // Store original key
  const originalKey = process.env.PHI_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;

  try {
    // Temporarily set new key
    process.env.PHI_ENCRYPTION_KEY = newKeyHex;

    // Re-encrypt with new key
    return encrypt(plaintext);
  } finally {
    // Restore original key
    if (originalKey) {
      process.env.PHI_ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.PHI_ENCRYPTION_KEY;
    }
  }
}

// PHI fields commonly requiring encryption in medical systems
const PHI_FIELDS = {
  PATIENT: [
    'ssn',
    'externalMRN',
    'hivStatus',
    'mentalHealthNotes',
    'substanceAbuse',
    'geneticInfo'
  ],
  VISIT: [
    'confidentialNotes'
  ],
  DOCUMENT: [
    'content' // If storing sensitive documents as text
  ]
};

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
  encryptedField,
  phiEncryptionPlugin,
  encryptFields,
  decryptFields,
  reEncrypt,
  PHI_FIELDS,
  ENCRYPTED_PREFIX
};
