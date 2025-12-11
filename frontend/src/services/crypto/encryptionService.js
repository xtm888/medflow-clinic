/**
 * Encryption Service - AES-GCM encryption using Web Crypto API
 *
 * Uses AES-256-GCM for authenticated encryption:
 * - AES-256: 256-bit key for strong encryption
 * - GCM mode: Provides both encryption and authentication
 * - Unique IV per encryption for semantic security
 *
 * Data format: base64(IV) + ':' + base64(ciphertext + authTag)
 */

// Configuration
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256; // bits
const IV_LENGTH = 12;   // bytes (96 bits, recommended for GCM)
const TAG_LENGTH = 128; // bits (authentication tag length)

/**
 * Check if Web Crypto API is available
 * @returns {boolean}
 */
export function isCryptoSupported() {
  return typeof window !== 'undefined' &&
    window.crypto &&
    window.crypto.subtle &&
    typeof window.crypto.subtle.encrypt === 'function';
}

/**
 * Generate a random IV for encryption
 * @returns {Uint8Array}
 */
function generateIV() {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Convert ArrayBuffer to Base64 string
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 * @param {string} base64
 * @returns {ArrayBuffer}
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypt a string value using AES-GCM
 * @param {string} plaintext - The string to encrypt
 * @param {CryptoKey} key - The encryption key
 * @returns {Promise<string>} - Encrypted data in format: iv:ciphertext
 */
export async function encrypt(plaintext, key) {
  if (!plaintext || typeof plaintext !== 'string') {
    return plaintext;
  }

  if (!key) {
    throw new Error('Encryption key is required');
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = generateIV();

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv,
        tagLength: TAG_LENGTH
      },
      key,
      data
    );

    // Format: base64(iv):base64(ciphertext)
    const ivBase64 = arrayBufferToBase64(iv);
    const ciphertextBase64 = arrayBufferToBase64(ciphertext);

    return `${ivBase64}:${ciphertextBase64}`;
  } catch (error) {
    console.error('[Encryption] Encrypt failed:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt a string value using AES-GCM
 * @param {string} encryptedData - Data in format: iv:ciphertext
 * @param {CryptoKey} key - The decryption key
 * @returns {Promise<string>} - Decrypted plaintext
 */
export async function decrypt(encryptedData, key) {
  if (!encryptedData || typeof encryptedData !== 'string') {
    return encryptedData;
  }

  // Check if data is encrypted (contains IV separator)
  if (!encryptedData.includes(':')) {
    // Data is not encrypted, return as-is
    return encryptedData;
  }

  if (!key) {
    throw new Error('Decryption key is required');
  }

  try {
    const [ivBase64, ciphertextBase64] = encryptedData.split(':');

    if (!ivBase64 || !ciphertextBase64) {
      // Invalid format, return as-is
      return encryptedData;
    }

    const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
    const ciphertext = base64ToArrayBuffer(ciphertextBase64);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv,
        tagLength: TAG_LENGTH
      },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    // If decryption fails, assume data is not encrypted
    console.warn('[Encryption] Decrypt failed, returning original:', error.message);
    return encryptedData;
  }
}

/**
 * Encrypt an object's sensitive fields
 * @param {Object} obj - Object to encrypt
 * @param {string[]} fields - Field names to encrypt
 * @param {CryptoKey} key - Encryption key
 * @returns {Promise<Object>} - Object with encrypted fields
 */
export async function encryptFields(obj, fields, key) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (!key) {
    console.warn('[Encryption] No key provided, skipping encryption');
    return obj;
  }

  const encrypted = { ...obj };

  for (const field of fields) {
    if (field in encrypted && encrypted[field] != null) {
      const value = encrypted[field];

      // Handle different types
      if (typeof value === 'string') {
        encrypted[field] = await encrypt(value, key);
      } else if (Array.isArray(value)) {
        // Encrypt array items (e.g., allergies)
        encrypted[field] = await Promise.all(
          value.map(async (item) => {
            if (typeof item === 'string') {
              return encrypt(item, key);
            } else if (typeof item === 'object' && item !== null) {
              // Encrypt as JSON string
              return encrypt(JSON.stringify(item), key);
            }
            return item;
          })
        );
      } else if (typeof value === 'object') {
        // Encrypt nested object as JSON string
        encrypted[field] = await encrypt(JSON.stringify(value), key);
      }
    }
  }

  // Mark as encrypted for identification
  encrypted._encrypted = true;
  encrypted._encryptedFields = fields.filter(f => f in encrypted && encrypted[f] != null);

  return encrypted;
}

/**
 * Decrypt an object's encrypted fields
 * @param {Object} obj - Object to decrypt
 * @param {string[]} fields - Field names to decrypt
 * @param {CryptoKey} key - Decryption key
 * @returns {Promise<Object>} - Object with decrypted fields
 */
export async function decryptFields(obj, fields, key) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Skip if not encrypted
  if (!obj._encrypted) {
    return obj;
  }

  if (!key) {
    console.warn('[Encryption] No key provided, returning encrypted data');
    return obj;
  }

  const decrypted = { ...obj };
  const encryptedFields = obj._encryptedFields || fields;

  for (const field of encryptedFields) {
    if (field in decrypted && decrypted[field] != null) {
      const value = decrypted[field];

      try {
        if (typeof value === 'string') {
          const decryptedValue = await decrypt(value, key);
          // Try to parse as JSON if it looks like JSON
          if (decryptedValue.startsWith('{') || decryptedValue.startsWith('[')) {
            try {
              decrypted[field] = JSON.parse(decryptedValue);
            } catch {
              decrypted[field] = decryptedValue;
            }
          } else {
            decrypted[field] = decryptedValue;
          }
        } else if (Array.isArray(value)) {
          // Decrypt array items
          decrypted[field] = await Promise.all(
            value.map(async (item) => {
              if (typeof item === 'string') {
                const decryptedItem = await decrypt(item, key);
                // Try to parse as JSON
                if (decryptedItem.startsWith('{') || decryptedItem.startsWith('[')) {
                  try {
                    return JSON.parse(decryptedItem);
                  } catch {
                    return decryptedItem;
                  }
                }
                return decryptedItem;
              }
              return item;
            })
          );
        }
      } catch (error) {
        console.warn(`[Encryption] Failed to decrypt field ${field}:`, error.message);
        // Keep encrypted value on failure
      }
    }
  }

  // Remove encryption markers
  delete decrypted._encrypted;
  delete decrypted._encryptedFields;

  return decrypted;
}

/**
 * Check if a value appears to be encrypted
 * @param {string} value
 * @returns {boolean}
 */
export function isEncrypted(value) {
  if (typeof value !== 'string') return false;

  // Check for IV:ciphertext format with base64 characters
  const parts = value.split(':');
  if (parts.length !== 2) return false;

  // IV should be 16 chars (12 bytes base64), ciphertext longer
  const [iv, ciphertext] = parts;
  if (iv.length !== 16) return false;
  if (ciphertext.length < 20) return false;

  // Check base64 pattern
  const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
  return base64Pattern.test(iv) && base64Pattern.test(ciphertext);
}

// Export constants for testing
export const ENCRYPTION_CONFIG = {
  ALGORITHM,
  KEY_LENGTH,
  IV_LENGTH,
  TAG_LENGTH
};
