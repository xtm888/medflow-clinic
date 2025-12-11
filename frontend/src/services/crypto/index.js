/**
 * Crypto Module - IndexedDB Field-Level Encryption
 *
 * Provides transparent encryption for sensitive data in IndexedDB.
 * Uses AES-256-GCM with PBKDF2 key derivation.
 *
 * Usage:
 * 1. After login: await initializeEncryption(userId, token)
 * 2. Before storing: encryptedData = await encryptEntityData('patients', patientData)
 * 3. After retrieving: decryptedData = await decryptEntityData('patients', encryptedData)
 * 4. On logout: clearEncryption()
 */

// Core encryption functions
export {
  encrypt,
  decrypt,
  encryptFields,
  decryptFields,
  isEncrypted,
  isCryptoSupported,
  ENCRYPTION_CONFIG
} from './encryptionService';

// Key management
export { default as keyManager } from './keyManager';
export {
  PBKDF2_ITERATIONS,
  KEY_LENGTH,
  HASH_ALGORITHM
} from './keyManager';

// Field-level encryption
export {
  SENSITIVE_FIELDS,
  getSensitiveFields,
  hasSensitiveFields,
  encryptEntityData,
  decryptEntityData,
  encryptEntityArray,
  decryptEntityArray,
  encryptionMiddleware,
  initializeEncryption,
  clearEncryption,
  isEncryptionActive,
  createEncryptionHooks
} from './fieldEncryption';
