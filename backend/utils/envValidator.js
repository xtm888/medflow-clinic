/**
 * Environment Variable Validator
 *
 * CRITICAL: This module validates that all security-sensitive environment
 * variables meet minimum security requirements before the server starts.
 * In production, weak secrets will cause the server to fail fast.
 */

const WEAK_PATTERNS = [
  'change-in-production',
  'default-key',
  'default',
  'placeholder',
  'changeme',
  'secret123',
  'password',
  'example',
  'generate_new',  // Placeholder from .env.example
  'openssl_rand'   // Placeholder from .env.example
];

// SECURITY: Known exposed secrets that were committed to git history
// These MUST be rotated immediately if detected
const EXPOSED_SECRETS = [
  '9a83170de4720f8f478856e3c401c96a7d4224909e1b9a1d6934a79b0adb0937', // JWT_SECRET
  'XkP7mQ2wT9nL4vR8bH5jC1eA6dF3gI0uY2sW5xZ7qN9pO4mK8lJ1cV6bU3tE0rHy', // REFRESH_TOKEN_SECRET
  'ecb9c6c80cd54f2514c0be779f6611cfb5cf3a1e05ce3d3aee2f42414ff53399', // SESSION_SECRET
  '4fdedf3431acc5854d447dd0814bfbefac7f37f48ca99fc180b4c237b25ef3ce', // BACKUP_ENCRYPTION_KEY
  '5031be865e4eaad463c32882189bd2adeb3ad04f8d4358224b6b4a12cfc90e3f', // CALENDAR_ENCRYPTION_KEY
  '53d81ddf5434c4bdcca15ac373143add184c109eb9f10ec76ebcc2db8255e17e', // LIS_ENCRYPTION_KEY
  '56c397b0bb914a8c04a4f51987f20f38'  // HEALTH_API_KEY
];

const MIN_SECRET_LENGTH = 32;

/**
 * Check if a secret has been exposed in git history
 * @param {string} secret - The secret to check
 * @returns {boolean} - True if secret is EXPOSED (bad)
 */
function isExposedSecret(secret) {
  if (!secret || typeof secret !== 'string') {
    return false;
  }
  return EXPOSED_SECRETS.includes(secret);
}

/**
 * Check if a secret meets minimum security requirements
 * @param {string} secret - The secret to validate
 * @returns {boolean} - True if secret is secure
 */
function isSecureSecret(secret) {
  if (!secret || typeof secret !== 'string') {
    return false;
  }

  // Check minimum length
  if (secret.length < MIN_SECRET_LENGTH) {
    return false;
  }

  // Check for weak patterns
  const lowerSecret = secret.toLowerCase();
  for (const pattern of WEAK_PATTERNS) {
    if (lowerSecret.includes(pattern)) {
      return false;
    }
  }

  // CRITICAL: Check for known exposed secrets
  if (isExposedSecret(secret)) {
    return false;
  }

  return true;
}

/**
 * Validate all critical environment variables for production
 * @throws {Error} If any critical variable is missing or insecure
 */
function validateProductionEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];

  // Required variables
  const required = ['MONGODB_URI', 'JWT_SECRET'];
  for (const envVar of required) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  // Security-sensitive variables that need strong values in production
  const securityVars = [
    { name: 'JWT_SECRET', required: true },
    { name: 'REFRESH_TOKEN_SECRET', required: false }, // SECURITY: Separate secret for refresh tokens
    { name: 'CALENDAR_ENCRYPTION_KEY', required: false },
    { name: 'LIS_ENCRYPTION_KEY', required: false },
    { name: 'BACKUP_ENCRYPTION_KEY', required: false },
    { name: 'SESSION_SECRET', required: false }
  ];

  // CRITICAL: In production, REFRESH_TOKEN_SECRET should be different from JWT_SECRET
  if (isProduction) {
    if (!process.env.REFRESH_TOKEN_SECRET) {
      errors.push(
        'REFRESH_TOKEN_SECRET not set in production. ' +
        'Using the same secret for access and refresh tokens reduces security. ' +
        'Generate with: openssl rand -hex 32'
      );
    } else if (process.env.REFRESH_TOKEN_SECRET === process.env.JWT_SECRET) {
      errors.push(
        'REFRESH_TOKEN_SECRET must be different from JWT_SECRET in production. ' +
        'Using the same secret defeats the purpose of separate token types.'
      );
    }
  }

  for (const { name, required: isRequired } of securityVars) {
    const value = process.env[name];

    // CRITICAL: Check for known exposed secrets first
    if (value && isExposedSecret(value)) {
      errors.push(
        `CRITICAL: ${name} contains a known exposed secret that was committed to git history! ` +
        'This secret MUST be rotated immediately. Run: node scripts/rotateSecrets.js'
      );
    } else if (value && !isSecureSecret(value)) {
      if (isProduction) {
        errors.push(
          `${name} is insecure: Must be at least ${MIN_SECRET_LENGTH} characters ` +
          'and not contain weak patterns like \'default\', \'change-in-production\', etc.'
        );
      } else {
        warnings.push(`${name} uses weak value (OK for development, but change for production)`);
      }
    }
  }

  // Warn about backup encryption
  if (isProduction && !process.env.BACKUP_ENCRYPTION_KEY) {
    warnings.push('BACKUP_ENCRYPTION_KEY not set - database backups will NOT be encrypted!');
  }

  // Print warnings
  if (warnings.length > 0) {
    console.warn('\n⚠️  Security Warnings:');
    warnings.forEach(w => console.warn(`   - ${w}`));
    console.warn('');
  }

  // Throw on errors (production only blocks on these)
  if (errors.length > 0) {
    console.error('\n❌ CRITICAL SECURITY ERRORS:');
    errors.forEach(e => console.error(`   - ${e}`));
    console.error('');
    throw new Error(`Security validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Generate a cryptographically secure random secret
 * @param {number} length - Length of secret (default 64)
 * @returns {string} - Hex-encoded random secret
 */
function generateSecureSecret(length = 64) {
  const crypto = require('crypto');
  return crypto.randomBytes(length / 2).toString('hex');
}

module.exports = {
  isSecureSecret,
  isExposedSecret,
  validateProductionEnv,
  generateSecureSecret,
  WEAK_PATTERNS,
  EXPOSED_SECRETS,
  MIN_SECRET_LENGTH
};
