#!/usr/bin/env node
/**
 * PHI Encryption Migration Script
 *
 * This script encrypts existing PHI (Protected Health Information) data in the database.
 * Run this ONCE after deploying the PHI encryption feature.
 *
 * IMPORTANT:
 * 1. BACKUP YOUR DATABASE BEFORE RUNNING THIS SCRIPT
 * 2. Set PHI_ENCRYPTION_KEY in your .env file
 * 3. Run with DRY_RUN=true first to see what will be encrypted
 *
 * Usage:
 *   DRY_RUN=true node scripts/migratePHIEncryption.js  # Preview changes
 *   node scripts/migratePHIEncryption.js               # Execute migration
 *
 * The script will:
 * - Find all patients with unencrypted PHI fields
 * - Encrypt nationalId, insurance.policyNumber, payment method data
 * - Log progress and create audit trail
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProductionStrict } = require('./_guards');
requireNonProductionStrict('migratePHIEncryption.js');

const { encrypt, isEncrypted, ENCRYPTED_PREFIX } = require('../utils/phiEncryption');
const { withTransaction, supportsTransactions } = require('../utils/migrationTransaction');

const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100', 10);

// PHI fields to encrypt (dot notation for nested fields)
const PHI_FIELDS = [
  'nationalId',
  'insurance.policyNumber'
];

// Array fields with PHI
const PHI_ARRAY_FIELDS = [
  {
    arrayPath: 'storedPaymentMethods',
    fields: ['phoneNumber', 'stripePaymentMethodId', 'stripeCustomerId']
  }
];

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medflow';
  console.log(`Connecting to MongoDB: ${uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

async function migratePatients(session = null) {
  // Access collection directly to avoid model middleware
  const db = mongoose.connection.db;
  const patientsCollection = db.collection('patients');

  console.log('\n=== PHI Encryption Migration ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE MIGRATION'}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Transaction: ${session ? 'Yes (replica set)' : 'No (standalone)'}`);
  console.log(`Fields to encrypt: ${PHI_FIELDS.join(', ')}`);
  console.log(`Array fields: ${PHI_ARRAY_FIELDS.map(f => `${f.arrayPath}.{${f.fields.join(',')}}`).join(', ')}`);

  // Count total patients
  const totalPatients = await patientsCollection.countDocuments({});
  console.log(`\nTotal patients in database: ${totalPatients}`);

  // Find patients with unencrypted PHI data
  // Build query to find documents where any PHI field exists and is not encrypted
  const orConditions = [];

  // Regular fields
  for (const field of PHI_FIELDS) {
    orConditions.push({
      [field]: {
        $exists: true,
        $ne: null,
        $not: { $regex: `^${ENCRYPTED_PREFIX}` }
      }
    });
  }

  // Array fields
  for (const arrayField of PHI_ARRAY_FIELDS) {
    for (const field of arrayField.fields) {
      orConditions.push({
        [`${arrayField.arrayPath}.${field}`]: {
          $exists: true,
          $ne: null,
          $not: { $regex: `^${ENCRYPTED_PREFIX}` }
        }
      });
    }
  }

  const query = { $or: orConditions };

  const patientsToMigrate = await patientsCollection.countDocuments(query);
  console.log(`Patients with unencrypted PHI: ${patientsToMigrate}`);

  if (patientsToMigrate === 0) {
    console.log('\nNo patients need PHI encryption migration. All done!');
    return { migrated: 0, skipped: 0, errors: 0 };
  }

  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  let processed = 0;

  // Process in batches using cursor
  const cursor = patientsCollection.find(query).batchSize(BATCH_SIZE);

  console.log(`\nProcessing ${patientsToMigrate} patients...`);

  while (await cursor.hasNext()) {
    const patient = await cursor.next();
    processed++;

    try {
      const updates = {};
      let hasUpdates = false;

      // Check regular fields
      for (const field of PHI_FIELDS) {
        const value = getNestedValue(patient, field);
        if (value && typeof value === 'string' && !isEncrypted(value)) {
          const encryptedValue = encrypt(value);
          updates[field] = encryptedValue;
          hasUpdates = true;

          if (DRY_RUN) {
            console.log(`  [DRY RUN] Would encrypt ${field}: "${value.substring(0, 4)}..." -> "${encryptedValue.substring(0, 20)}..."`);
          }
        }
      }

      // Check array fields
      for (const arrayField of PHI_ARRAY_FIELDS) {
        const array = patient[arrayField.arrayPath];
        if (Array.isArray(array) && array.length > 0) {
          const updatedArray = [];
          let arrayModified = false;

          for (const item of array) {
            const updatedItem = { ...item };

            for (const field of arrayField.fields) {
              const value = item[field];
              if (value && typeof value === 'string' && !isEncrypted(value)) {
                updatedItem[field] = encrypt(value);
                arrayModified = true;

                if (DRY_RUN) {
                  console.log(`  [DRY RUN] Would encrypt ${arrayField.arrayPath}.${field}: "${value.substring(0, 4)}..." -> encrypted`);
                }
              }
            }

            updatedArray.push(updatedItem);
          }

          if (arrayModified) {
            updates[arrayField.arrayPath] = updatedArray;
            hasUpdates = true;
          }
        }
      }

      if (hasUpdates) {
        if (!DRY_RUN) {
          const updateOptions = session ? { session } : {};
          await patientsCollection.updateOne(
            { _id: patient._id },
            { $set: updates },
            updateOptions
          );
        }
        migrated++;

        if (migrated % 100 === 0 || DRY_RUN) {
          console.log(`  Processed ${processed}/${patientsToMigrate} - Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors}`);
        }
      } else {
        skipped++;
      }

    } catch (err) {
      errors++;
      console.error(`  Error processing patient ${patient._id}: ${err.message}`);
    }
  }

  console.log('\n=== Migration Complete ===');
  console.log(`Total processed: ${processed}`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (DRY_RUN) {
    console.log('\nThis was a DRY RUN. No changes were made.');
    console.log('Run without DRY_RUN=true to apply changes.');
  }

  return { migrated, skipped, errors };
}

async function createAuditRecord(stats) {
  if (DRY_RUN) return;

  try {
    const db = mongoose.connection.db;
    const auditCollection = db.collection('auditlogs');

    await auditCollection.insertOne({
      user: null, // System operation
      action: 'PHI_ENCRYPTION_MIGRATION',
      resource: '/scripts/migratePHIEncryption',
      metadata: {
        ...stats,
        timestamp: new Date(),
        nodeEnv: process.env.NODE_ENV,
        dryRun: DRY_RUN
      },
      createdAt: new Date()
    });

    console.log('\nAudit record created.');
  } catch (err) {
    console.error('Failed to create audit record:', err.message);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('PHI Encryption Migration Script');
  console.log('='.repeat(60));

  // Check for encryption key
  if (!process.env.PHI_ENCRYPTION_KEY) {
    console.error('\nERROR: PHI_ENCRYPTION_KEY is not set in environment variables.');
    console.error('Generate one with: openssl rand -hex 32');
    console.error('Add to .env: PHI_ENCRYPTION_KEY=<generated-key>');
    process.exit(1);
  }

  if (process.env.PHI_ENCRYPTION_KEY.length !== 64) {
    console.error('\nERROR: PHI_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).');
    console.error('Generate one with: openssl rand -hex 32');
    process.exit(1);
  }

  try {
    await connectDB();

    // Check transaction support
    const hasTransactions = await supportsTransactions();
    console.log(`Transaction support: ${hasTransactions ? '✅ Available (replica set)' : '⚠️ Not available (standalone)'}`);

    // Run migration with transaction support (if available)
    const result = await withTransaction(
      async (session) => {
        const stats = await migratePatients(session);
        await createAuditRecord(stats);
        return stats;
      },
      {
        operationName: 'PHI Encryption Migration',
        requireTransaction: false // Allow fallback for standalone MongoDB
      }
    );

    console.log('\nMigration script finished successfully.');
    console.log(`Transaction used: ${result.usedTransaction ? 'Yes' : 'No'}`);

  } catch (err) {
    console.error('\nMigration failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

main();
