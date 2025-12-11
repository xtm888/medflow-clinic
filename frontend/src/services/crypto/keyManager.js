/**
 * Key Manager - PBKDF2 key derivation and session key storage
 *
 * Key derivation uses PBKDF2 with:
 * - 100,000 iterations (OWASP recommendation)
 * - SHA-256 hash function
 * - 256-bit derived key for AES-256
 *
 * Key storage:
 * - Keys stored in sessionStorage (cleared on tab close)
 * - Never stored in localStorage (persists too long)
 * - Never stored in IndexedDB (would defeat the purpose)
 */

import { isCryptoSupported } from './encryptionService';

// Configuration
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256; // bits
const HASH_ALGORITHM = 'SHA-256';
const SALT_LENGTH = 16; // bytes

// Session storage keys
const KEY_STORAGE_KEY = 'medflow_encryption_key';
const SALT_STORAGE_KEY = 'medflow_encryption_salt';

/**
 * Generate a random salt
 * @returns {Uint8Array}
 */
function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Convert Uint8Array to hex string
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 * @param {string} hex
 * @returns {Uint8Array}
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Derive an encryption key from user credentials using PBKDF2
 * @param {string} userId - User ID
 * @param {string} sessionToken - Session token or password-derived value
 * @param {Uint8Array} salt - Salt for key derivation
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(userId, sessionToken, salt) {
  if (!isCryptoSupported()) {
    throw new Error('Web Crypto API not supported');
  }

  // Create the key material from user ID + session token
  const keyMaterial = `${userId}:${sessionToken}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyMaterial);

  // Import the password as a key
  const baseKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive the actual encryption key using PBKDF2
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGORITHM
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: KEY_LENGTH
    },
    false, // Not extractable for security
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Export a CryptoKey to a storable format
 * @param {CryptoKey} key
 * @returns {Promise<string>}
 */
async function exportKey(key) {
  // For extractable keys only
  const exported = await crypto.subtle.exportKey('raw', key);
  return bytesToHex(new Uint8Array(exported));
}

/**
 * Import a key from stored format
 * @param {string} keyHex
 * @returns {Promise<CryptoKey>}
 */
async function importKey(keyHex) {
  const keyBytes = hexToBytes(keyHex);
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: KEY_LENGTH },
    true, // Extractable for re-export
    ['encrypt', 'decrypt']
  );
}

class KeyManager {
  constructor() {
    this.currentKey = null;
    this.userId = null;
    this.initialized = false;
  }

  /**
   * Initialize the key manager with user credentials
   * Call this after user login
   * @param {string} userId - User ID
   * @param {string} sessionToken - Session token (JWT or similar)
   * @returns {Promise<boolean>}
   */
  async initialize(userId, sessionToken) {
    if (!isCryptoSupported()) {
      console.warn('[KeyManager] Web Crypto API not supported, encryption disabled');
      return false;
    }

    if (!userId || !sessionToken) {
      console.warn('[KeyManager] Missing credentials, encryption disabled');
      return false;
    }

    try {
      // Check for existing salt or generate new one
      let salt;
      const storedSalt = sessionStorage.getItem(SALT_STORAGE_KEY);

      if (storedSalt) {
        salt = hexToBytes(storedSalt);
      } else {
        salt = generateSalt();
        sessionStorage.setItem(SALT_STORAGE_KEY, bytesToHex(salt));
      }

      // Derive the encryption key
      this.currentKey = await deriveKey(userId, sessionToken, salt);
      this.userId = userId;
      this.initialized = true;

      console.log('[KeyManager] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[KeyManager] Initialization failed:', error);
      this.clear();
      return false;
    }
  }

  /**
   * Re-initialize with stored salt (for session restoration)
   * @param {string} userId
   * @param {string} sessionToken
   * @returns {Promise<boolean>}
   */
  async restore(userId, sessionToken) {
    const storedSalt = sessionStorage.getItem(SALT_STORAGE_KEY);

    if (!storedSalt) {
      // No existing salt, do full initialization
      return this.initialize(userId, sessionToken);
    }

    try {
      const salt = hexToBytes(storedSalt);
      this.currentKey = await deriveKey(userId, sessionToken, salt);
      this.userId = userId;
      this.initialized = true;

      console.log('[KeyManager] Restored successfully');
      return true;
    } catch (error) {
      console.error('[KeyManager] Restore failed:', error);
      return this.initialize(userId, sessionToken);
    }
  }

  /**
   * Get the current encryption key
   * @returns {CryptoKey|null}
   */
  getKey() {
    if (!this.initialized) {
      console.warn('[KeyManager] Not initialized, returning null key');
      return null;
    }
    return this.currentKey;
  }

  /**
   * Check if encryption is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.initialized && this.currentKey !== null;
  }

  /**
   * Clear all keys and session data
   * Call this on logout
   */
  clear() {
    this.currentKey = null;
    this.userId = null;
    this.initialized = false;

    // Clear session storage
    sessionStorage.removeItem(KEY_STORAGE_KEY);
    sessionStorage.removeItem(SALT_STORAGE_KEY);

    console.log('[KeyManager] Cleared');
  }

  /**
   * Rotate the encryption key (generate new salt)
   * Use when user changes password
   * @param {string} sessionToken - New session token
   * @returns {Promise<boolean>}
   */
  async rotateKey(sessionToken) {
    if (!this.userId) {
      console.error('[KeyManager] Cannot rotate key: not initialized');
      return false;
    }

    try {
      // Generate new salt
      const newSalt = generateSalt();
      sessionStorage.setItem(SALT_STORAGE_KEY, bytesToHex(newSalt));

      // Derive new key
      this.currentKey = await deriveKey(this.userId, sessionToken, newSalt);

      console.log('[KeyManager] Key rotated successfully');
      return true;
    } catch (error) {
      console.error('[KeyManager] Key rotation failed:', error);
      return false;
    }
  }

  /**
   * Get key metadata (for debugging, not the actual key)
   * @returns {Object}
   */
  getMetadata() {
    return {
      initialized: this.initialized,
      userId: this.userId ? `${this.userId.substring(0, 4)}...` : null,
      hasSalt: !!sessionStorage.getItem(SALT_STORAGE_KEY),
      cryptoSupported: isCryptoSupported()
    };
  }
}

// Export singleton instance
const keyManager = new KeyManager();
export default keyManager;

// Export for testing
export {
  deriveKey,
  generateSalt,
  bytesToHex,
  hexToBytes,
  PBKDF2_ITERATIONS,
  KEY_LENGTH,
  HASH_ALGORITHM
};
