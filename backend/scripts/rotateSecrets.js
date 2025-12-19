#!/usr/bin/env node
/**
 * Secret Rotation Script
 *
 * IMPORTANT: Run this script when:
 * 1. Setting up a new environment
 * 2. After any suspected security breach
 * 3. If .env was ever committed to version control
 *
 * Usage: node scripts/rotateSecrets.js
 *
 * This will generate new cryptographically secure secrets and
 * output them for you to copy to your .env file.
 */

const crypto = require('crypto');

console.log('='.repeat(60));
console.log('MedFlow Secret Rotation Script');
console.log('='.repeat(60));
console.log('\nGenerating new cryptographically secure secrets...\n');

// Generate secrets
const secrets = {
  JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  REFRESH_TOKEN_SECRET: crypto.randomBytes(48).toString('base64'),
  SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
  ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
  BACKUP_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
  CALENDAR_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
  LIS_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
  PHI_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
  HEALTH_API_KEY: crypto.randomBytes(16).toString('hex')
};

console.log('Copy these values to your .env file:\n');
console.log('-'.repeat(60));

for (const [key, value] of Object.entries(secrets)) {
  console.log(`${key}=${value}`);
}

console.log('-'.repeat(60));
console.log('\nSECURITY REMINDERS:');
console.log('1. NEVER commit .env to version control');
console.log('2. If secrets were exposed, force logout all users');
console.log('3. Rotate database credentials separately');
console.log('4. Consider enabling 2FA for all admin accounts');
console.log('5. Review audit logs for suspicious activity');
console.log(`\n${'='.repeat(60)}`);
