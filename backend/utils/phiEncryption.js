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
 * Supports key rotation with multiple key versions.
 */

const crypto = require('crypto');
const { createContextLogger } = require('./structuredLogger');
const log = createContextLogger('PHIEncryption');

// Algorithm configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;      // GCM standard IV length
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;     // 256 bits

// Prefixes for encrypted values (allows detection of encrypted vs plaintext)
const ENCRYPTED_PREFIX_V1 = 'enc:v1:';  // Legacy format: enc:v1:{iv}:{authTag}:{ciphertext}
const ENCRYPTED_PREFIX_V2 = 'enc:v2:';  // New format: enc:v2:{keyId}:{iv}:{authTag}:{ciphertext}

// Key management
const KEY_REGISTRY = {};
let currentKeyId = null;

/**
 * Initialize the key registry from environment variables
 * Supports multiple keys: PHI_ENCRYPTION_KEY, PHI_ENCRYPTION_KEY_V2, etc.
 */
function initializeKeys() {
  // Clear existing registry
  Object.keys(KEY_REGISTRY).forEach(k => delete KEY_REGISTRY[k]);

  // Load primary key (v1/default)
  const primaryKey = process.env.PHI_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  if (primaryKey) {
    KEY_REGISTRY['key_v1'] = Buffer.from(primaryKey, 'hex');
  }

  // Load additional keys (v2, v3, etc.)
  for (let i = 2; i <= 10; i++) {
    const keyEnv = process.env[`PHI_ENCRYPTION_KEY_V${i}`];
    if (keyEnv) {
      KEY_REGISTRY[`key_v${i}`] = Buffer.from(keyEnv, 'hex');
    }
  }

  // Determine current key ID (use PHI_KEY_ID env or highest version)
  currentKeyId = process.env.PHI_KEY_ID;
  if (!currentKeyId) {
    // Default to highest version key available
    const versions = Object.keys(KEY_REGISTRY)
      .map(k => parseInt(k.replace('key_v', '')))
      .sort((a, b) => b - a);
    currentKeyId = versions.length > 0 ? `key_v${versions[0]}` : 'key_v1';
  }

  return Object.keys(KEY_REGISTRY).length;
}

// Initialize on module load
initializeKeys();

/**
 * Get encryption key by ID
 * @param {string} keyId - Key identifier (e.g., 'key_v1', 'key_v2')
 * @returns {Buffer} 32-byte encryption key
 * @throws {Error} If key is not found or invalid
 */
function getKey(keyId = currentKeyId) {
  // Reload keys if registry is empty
  if (Object.keys(KEY_REGISTRY).length === 0) {
    initializeKeys();
  }

  const key = KEY_REGISTRY[keyId];

  if (!key) {
    throw new Error(`Encryption key '${keyId}' not found. Available keys: ${Object.keys(KEY_REGISTRY).join(', ')}`);
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key '${keyId}' must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters)`);
  }

  return key;
}

/**
 * Get the current key ID being used for encryption
 * @returns {string} Current key ID
 */
function getCurrentKeyId() {
  return currentKeyId;
}

/**
 * Get list of available key IDs
 * @returns {string[]} Array of key IDs
 */
function getAvailableKeyIds() {
  return Object.keys(KEY_REGISTRY);
}

/**
 * Encrypt a string value using the current key
 * @param {string} plaintext - The value to encrypt
 * @returns {string} - Encrypted value with prefix, keyId, IV, auth tag, and ciphertext
 */
function encrypt(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') {
    return plaintext; // Return as-is if not a string
  }

  // Already encrypted (v1 or v2)
  if (plaintext.startsWith(ENCRYPTED_PREFIX_V1) || plaintext.startsWith(ENCRYPTED_PREFIX_V2)) {
    return plaintext;
  }

  const key = getKey(currentKeyId);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Format v2: enc:v2:{keyId}:{iv}:{authTag}:{ciphertext}
  return `${ENCRYPTED_PREFIX_V2}${currentKeyId}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt an encrypted value (supports both v1 and v2 formats)
 * @param {string} encryptedValue - The encrypted value to decrypt
 * @returns {string} - Decrypted plaintext
 */
function decrypt(encryptedValue) {
  if (!encryptedValue || typeof encryptedValue !== 'string') {
    return encryptedValue;
  }

  // Handle v2 format: enc:v2:{keyId}:{iv}:{authTag}:{ciphertext}
  if (encryptedValue.startsWith(ENCRYPTED_PREFIX_V2)) {
    const parts = encryptedValue.substring(ENCRYPTED_PREFIX_V2.length).split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted value format (v2)');
    }

    const [keyId, ivB64, authTagB64, ciphertext] = parts;
    const key = getKey(keyId);
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Handle v1 format (backward compatibility): enc:v1:{iv}:{authTag}:{ciphertext}
  if (encryptedValue.startsWith(ENCRYPTED_PREFIX_V1)) {
    const parts = encryptedValue.substring(ENCRYPTED_PREFIX_V1.length).split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format (v1)');
    }

    // V1 always used the primary key
    const key = getKey('key_v1');
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const ciphertext = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Not encrypted - return as-is
  return encryptedValue;
}

/**
 * Check if a value is encrypted
 * @param {string} value - The value to check
 * @returns {boolean} - True if encrypted
 */
function isEncrypted(value) {
  return typeof value === 'string' &&
    (value.startsWith(ENCRYPTED_PREFIX_V1) || value.startsWith(ENCRYPTED_PREFIX_V2));
}

/**
 * Get the key ID used to encrypt a value
 * @param {string} encryptedValue - The encrypted value
 * @returns {string|null} - Key ID or null if not encrypted
 */
function getKeyIdFromValue(encryptedValue) {
  if (!isEncrypted(encryptedValue)) {
    return null;
  }

  if (encryptedValue.startsWith(ENCRYPTED_PREFIX_V2)) {
    const parts = encryptedValue.substring(ENCRYPTED_PREFIX_V2.length).split(':');
    return parts[0];
  }

  // V1 format - implicit key_v1
  return 'key_v1';
}

/**
 * Check if a value needs rotation (encrypted with old key)
 * @param {string} encryptedValue - The encrypted value
 * @returns {boolean} - True if the value uses an old key
 */
function needsRotation(encryptedValue) {
  const keyId = getKeyIdFromValue(encryptedValue);
  return keyId !== null && keyId !== currentKeyId;
}

/**
 * Re-encrypt a value with the current key
 * @param {string} encryptedValue - Currently encrypted value
 * @returns {string} - Re-encrypted value with current key
 */
function rotateValue(encryptedValue) {
  if (!isEncrypted(encryptedValue)) {
    return encrypt(encryptedValue); // Encrypt plaintext
  }

  const keyId = getKeyIdFromValue(encryptedValue);
  if (keyId === currentKeyId) {
    return encryptedValue; // Already using current key
  }

  // Decrypt with old key and re-encrypt with current key
  const plaintext = decrypt(encryptedValue);
  return encrypt(plaintext);
}

/**
 * Create a Mongoose getter/setter pair for encrypted fields
 * @param {string} fieldName - Field name for error messages
 * @returns {Object} - Object with get and set functions for Mongoose schema
 */
function encryptedField(fieldName) {
  return {
    get: function(value) {
      try {
        return decrypt(value);
      } catch (err) {
        log.error('Error decrypting field', { field: fieldName, error: err.message });
        return value; // Return encrypted value if decryption fails
      }
    },
    set: function(value) {
      try {
        return encrypt(value);
      } catch (err) {
        log.error('Error encrypting field', { field: fieldName, error: err.message });
        return value; // Return plaintext if encryption fails
      }
    }
  };
}

/**
 * Mongoose plugin for PHI field encryption
 * Automatically encrypts/decrypts specified fields
 */
function phiEncryptionPlugin(schema, options = {}) {
  const { fields = [] } = options;

  // Apply encryption to specified fields
  fields.forEach(fieldPath => {
    const schemaPath = schema.path(fieldPath);
    if (schemaPath) {
      // Add getter and setter
      schemaPath.get((value) => {
        try {
          return decrypt(value);
        } catch (err) {
          return value;
        }
      });

      schemaPath.set((value) => {
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
 * Rotate encryption keys for a Mongoose model
 * Re-encrypts all PHI fields with the current key
 *
 * @param {Model} Model - Mongoose model to rotate
 * @param {string[]} fields - PHI field names to rotate
 * @param {Object} options - Rotation options
 * @param {number} options.batchSize - Documents per batch (default: 100)
 * @param {boolean} options.dryRun - If true, don't save changes (default: false)
 * @returns {Object} - Rotation statistics
 */
async function rotateModelKeys(Model, fields, options = {}) {
  const { batchSize = 100, dryRun = false } = options;

  const stats = {
    total: 0,
    rotated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: []
  };

  const modelName = Model.modelName || 'Unknown';
  log.info('Starting key rotation', { model: modelName, fields, batchSize, dryRun });

  try {
    // Count total documents
    stats.total = await Model.countDocuments({});
    log.info('Found documents to process', { model: modelName, total: stats.total });

    let processed = 0;

    while (processed < stats.total) {
      // Fetch batch - use lean() to get raw documents, then manually process
      const docs = await Model.find({})
        .skip(processed)
        .limit(batchSize)
        .select(fields.concat(['_id']))
        .lean();

      for (const doc of docs) {
        try {
          const updates = {};
          let needsUpdate = false;

          for (const field of fields) {
            const value = doc[field];
            if (value && isEncrypted(value) && needsRotation(value)) {
              updates[field] = rotateValue(value);
              needsUpdate = true;
            }
          }

          if (needsUpdate) {
            if (!dryRun) {
              await Model.updateOne({ _id: doc._id }, { $set: updates });
            }
            stats.rotated++;
          } else {
            stats.skipped++;
          }
        } catch (err) {
          stats.errors++;
          stats.errorDetails.push({
            documentId: doc._id?.toString(),
            error: err.message
          });
          log.error('Error rotating document', {
            model: modelName,
            documentId: doc._id?.toString(),
            error: err.message
          });
        }
      }

      processed += docs.length;

      if (processed % (batchSize * 10) === 0) {
        log.info('Key rotation progress', {
          model: modelName,
          processed,
          total: stats.total,
          rotated: stats.rotated,
          percent: Math.round((processed / stats.total) * 100)
        });
      }
    }

    log.info('Key rotation complete', {
      model: modelName,
      ...stats,
      errorDetails: undefined
    });

  } catch (err) {
    log.error('Key rotation failed', { model: modelName, error: err.message });
    throw err;
  }

  return stats;
}

/**
 * Generate a new encryption key
 * @returns {string} - 64-character hex string (32 bytes)
 */
function generateKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Validate an encryption key format
 * @param {string} keyHex - Key in hex format
 * @returns {boolean} - True if valid
 */
function validateKey(keyHex) {
  if (!keyHex || typeof keyHex !== 'string') {
    return false;
  }
  if (keyHex.length !== KEY_LENGTH * 2) {
    return false;
  }
  if (!/^[0-9a-fA-F]+$/.test(keyHex)) {
    return false;
  }
  return true;
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

// Legacy compatibility - the old function signature
function reEncrypt(encryptedValue, newKeyHex) {
  log.warn('reEncrypt() is deprecated. Use rotateValue() instead.');

  // This function temporarily overrides the key - not recommended
  const originalKey = process.env.PHI_ENCRYPTION_KEY;

  try {
    // Decrypt with current key
    const plaintext = decrypt(encryptedValue);

    // Temporarily set new key
    process.env.PHI_ENCRYPTION_KEY = newKeyHex;
    initializeKeys();

    // Re-encrypt with new key
    return encrypt(plaintext);
  } finally {
    // Restore original key
    if (originalKey) {
      process.env.PHI_ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.PHI_ENCRYPTION_KEY;
    }
    initializeKeys();
  }
}

module.exports = {
  // Core encryption functions
  encrypt,
  decrypt,
  isEncrypted,

  // Key management
  getCurrentKeyId,
  getAvailableKeyIds,
  getKeyIdFromValue,
  needsRotation,
  rotateValue,
  rotateModelKeys,
  generateKey,
  validateKey,
  initializeKeys,

  // Mongoose integration
  encryptedField,
  phiEncryptionPlugin,

  // Bulk operations
  encryptFields,
  decryptFields,

  // Constants
  PHI_FIELDS,
  ENCRYPTED_PREFIX: ENCRYPTED_PREFIX_V2,
  ENCRYPTED_PREFIX_V1,
  ENCRYPTED_PREFIX_V2,

  // Legacy (deprecated)
  reEncrypt
};
