#!/usr/bin/env node
/**
 * PHI Key Rotation Script
 *
 * Re-encrypts all PHI data with the current encryption key.
 * Use this when rotating to a new encryption key.
 *
 * IMPORTANT:
 * 1. BACKUP YOUR DATABASE BEFORE RUNNING THIS SCRIPT
 * 2. Ensure both old and new keys are configured in .env
 * 3. Run with DRY_RUN=true first to preview changes
 *
 * Setup:
 *   1. Generate new key: openssl rand -hex 32
 *   2. Add to .env: PHI_ENCRYPTION_KEY_V2=<new-key>
 *   3. Set in .env: PHI_KEY_ID=key_v2
 *   4. Run: DRY_RUN=true node scripts/rotatePHIKeys.js
 *   5. If preview looks good: node scripts/rotatePHIKeys.js
 *
 * Usage:
 *   DRY_RUN=true node scripts/rotatePHIKeys.js   # Preview changes
 *   node scripts/rotatePHIKeys.js                 # Execute rotation
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProductionStrict } = require('./_guards');
requireNonProductionStrict('rotatePHIKeys.js');

const {
  getCurrentKeyId,
  getAvailableKeyIds,
  rotateModelKeys,
  generateKey,
  validateKey,
  PHI_FIELDS
} = require('../utils/phiEncryption');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('PHIKeyRotation');

const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100', 10);

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medflow';
  log.info('Connecting to MongoDB', { uri: uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') });
  await mongoose.connect(uri);
  log.info('Connected to MongoDB');
}

async function showKeyStatus() {
  console.log('\n' + '='.repeat(60));
  console.log('PHI Encryption Key Status');
  console.log('='.repeat(60));

  const currentKey = getCurrentKeyId();
  const availableKeys = getAvailableKeyIds();

  console.log(`\nCurrent encryption key: ${currentKey}`);
  console.log(`Available keys: ${availableKeys.join(', ') || 'None configured!'}`);

  if (availableKeys.length === 0) {
    console.error('\n⛔ ERROR: No encryption keys configured!');
    console.error('Set PHI_ENCRYPTION_KEY in your .env file.');
    console.error('Generate with: openssl rand -hex 32');
    process.exit(1);
  }

  if (availableKeys.length === 1) {
    console.log('\n⚠️  Only one key configured. For rotation, you need at least 2 keys.');
    console.log('To add a new key:');
    console.log('  1. Generate: openssl rand -hex 32');
    console.log('  2. Add to .env: PHI_ENCRYPTION_KEY_V2=<new-key>');
    console.log('  3. Set: PHI_KEY_ID=key_v2');
  }

  // Validate all keys
  for (const keyId of availableKeys) {
    const keyEnv = keyId === 'key_v1'
      ? process.env.PHI_ENCRYPTION_KEY
      : process.env[`PHI_ENCRYPTION_KEY_V${keyId.replace('key_v', '')}`];

    if (!validateKey(keyEnv)) {
      console.error(`\n⛔ ERROR: Key ${keyId} is invalid (must be 64 hex characters)`);
      process.exit(1);
    }
  }

  console.log('\n✅ All keys validated successfully');
  return { currentKey, availableKeys };
}

async function rotatePatients() {
  const Patient = require('../models/Patient');

  const fields = PHI_FIELDS.PATIENT;
  log.info('Rotating Patient PHI fields', { fields });

  const stats = await rotateModelKeys(Patient, fields, {
    batchSize: BATCH_SIZE,
    dryRun: DRY_RUN
  });

  return { model: 'Patient', ...stats };
}

async function rotateVisits() {
  const Visit = require('../models/Visit');

  const fields = PHI_FIELDS.VISIT;
  if (fields.length === 0) {
    log.info('No Visit PHI fields configured, skipping');
    return { model: 'Visit', total: 0, rotated: 0, skipped: 0, errors: 0 };
  }

  log.info('Rotating Visit PHI fields', { fields });

  const stats = await rotateModelKeys(Visit, fields, {
    batchSize: BATCH_SIZE,
    dryRun: DRY_RUN
  });

  return { model: 'Visit', ...stats };
}

async function createAuditRecord(results) {
  if (DRY_RUN) return;

  try {
    const db = mongoose.connection.db;
    const auditCollection = db.collection('auditlogs');

    await auditCollection.insertOne({
      user: null, // System operation
      action: 'PHI_KEY_ROTATION',
      resource: '/scripts/rotatePHIKeys',
      metadata: {
        currentKeyId: getCurrentKeyId(),
        results,
        timestamp: new Date(),
        nodeEnv: process.env.NODE_ENV
      },
      createdAt: new Date()
    });

    log.info('Audit record created');
  } catch (err) {
    log.error('Failed to create audit record', { error: err.message });
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('PHI Key Rotation Script');
  console.log('='.repeat(60));

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('\n⚠️  LIVE MODE - Data will be modified!\n');
    console.log('Make sure you have a database backup before proceeding.');
    console.log('Press Ctrl+C within 5 seconds to abort...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  try {
    // Show key status
    const { currentKey, availableKeys } = await showKeyStatus();

    // Connect to database
    await connectDB();

    // Rotate each model
    const results = [];

    console.log('\n' + '='.repeat(60));
    console.log('Starting Key Rotation');
    console.log('='.repeat(60));
    console.log(`Target key: ${currentKey}`);
    console.log(`Batch size: ${BATCH_SIZE}`);
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

    // Rotate Patient records
    console.log('\n--- Rotating Patient records ---');
    const patientResult = await rotatePatients();
    results.push(patientResult);

    // Rotate Visit records
    console.log('\n--- Rotating Visit records ---');
    const visitResult = await rotateVisits();
    results.push(visitResult);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Rotation Summary');
    console.log('='.repeat(60));

    let totalRotated = 0;
    let totalErrors = 0;

    for (const result of results) {
      console.log(`\n${result.model}:`);
      console.log(`  Total: ${result.total}`);
      console.log(`  Rotated: ${result.rotated}`);
      console.log(`  Skipped (already current): ${result.skipped}`);
      console.log(`  Errors: ${result.errors}`);
      totalRotated += result.rotated;
      totalErrors += result.errors;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`TOTAL ROTATED: ${totalRotated}`);
    console.log(`TOTAL ERRORS: ${totalErrors}`);

    if (DRY_RUN) {
      console.log('\nThis was a DRY RUN. No changes were made.');
      console.log('Run without DRY_RUN=true to apply changes.');
    } else {
      // Create audit record
      await createAuditRecord(results);
      console.log('\n✅ Key rotation completed successfully.');
    }

    if (totalErrors > 0) {
      console.log('\n⚠️  Some records had errors. Check logs for details.');
    }

  } catch (err) {
    log.error('Key rotation failed', { error: err.message, stack: err.stack });
    console.error('\n❌ Key rotation failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    log.info('Disconnected from MongoDB');
  }
}

// Generate new key helper
if (process.argv.includes('--generate-key')) {
  const newKey = generateKey();
  console.log('\nGenerated new PHI encryption key:');
  console.log(newKey);
  console.log('\nAdd to .env as PHI_ENCRYPTION_KEY_V2 (or next version)');
  process.exit(0);
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
PHI Key Rotation Script

Usage:
  node scripts/rotatePHIKeys.js [options]

Options:
  --generate-key    Generate a new encryption key
  --help, -h        Show this help message

Environment Variables:
  DRY_RUN=true      Preview changes without modifying data
  BATCH_SIZE=100    Number of documents per batch (default: 100)

  PHI_ENCRYPTION_KEY       Primary/V1 encryption key (required)
  PHI_ENCRYPTION_KEY_V2    Version 2 key (for rotation)
  PHI_ENCRYPTION_KEY_V3    Version 3 key (for next rotation)
  PHI_KEY_ID               Which key to use for new encryption (e.g., key_v2)

Examples:
  # Generate a new key
  node scripts/rotatePHIKeys.js --generate-key

  # Preview rotation (no changes)
  DRY_RUN=true node scripts/rotatePHIKeys.js

  # Execute rotation
  node scripts/rotatePHIKeys.js
`);
  process.exit(0);
}

main();
