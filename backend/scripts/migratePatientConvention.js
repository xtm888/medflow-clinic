/**
 * Migration Script: Patient Convention Fields
 *
 * This script:
 * 1. Converts existing patient names to UPPERCASE (per convention requirements)
 * 2. Creates indexes for convention fields
 * 3. Reports statistics
 *
 * Usage: node scripts/migratePatientConvention.js
 *
 * Options:
 *   --dry-run    Preview changes without modifying database
 *   --limit=N    Process only N patients (for testing)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Patient = require('../models/Patient');

const BATCH_SIZE = 100;

async function migrate() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     PATIENT CONVENTION MIGRATION                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Connect to MongoDB
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
  console.log('✓ Connected to MongoDB\n');

  const stats = {
    totalPatients: 0,
    namesUpdated: 0,
    alreadyUppercase: 0,
    errors: 0,
    conventionPatients: 0
  };

  try {
    // Count total patients
    stats.totalPatients = await Patient.countDocuments();
    console.log(`Total patients in database: ${stats.totalPatients}`);

    // Count patients with convention
    stats.conventionPatients = await Patient.countDocuments({ 'convention.company': { $ne: null } });
    console.log(`Patients with convention: ${stats.conventionPatients}\n`);

    // Find patients whose names need uppercase conversion
    const query = {
      $or: [
        { firstName: { $regex: /[a-z]/ } },
        { lastName: { $regex: /[a-z]/ } }
      ]
    };

    let cursor = Patient.find(query).cursor();
    let processedCount = 0;
    let batch = [];

    console.log('Processing patients...\n');

    for await (const patient of cursor) {
      if (limit && processedCount >= limit) break;

      const originalFirst = patient.firstName;
      const originalLast = patient.lastName;
      const newFirst = originalFirst.toUpperCase();
      const newLast = originalLast.toUpperCase();

      const needsUpdate = originalFirst !== newFirst || originalLast !== newLast;

      if (needsUpdate) {
        if (!dryRun) {
          batch.push({
            updateOne: {
              filter: { _id: patient._id },
              update: {
                $set: {
                  firstName: newFirst,
                  lastName: newLast
                }
              }
            }
          });

          // Process batch
          if (batch.length >= BATCH_SIZE) {
            try {
              await Patient.bulkWrite(batch);
              stats.namesUpdated += batch.length;
            } catch (err) {
              console.error('Batch write error:', err.message);
              stats.errors += batch.length;
            }
            batch = [];
          }
        } else {
          stats.namesUpdated++;
          if (stats.namesUpdated <= 10) {
            console.log(`  Would update: "${originalFirst} ${originalLast}" → "${newFirst} ${newLast}"`);
          }
        }
      } else {
        stats.alreadyUppercase++;
      }

      processedCount++;

      // Progress indicator
      if (processedCount % 100 === 0) {
        process.stdout.write(`  Processed: ${processedCount}\r`);
      }
    }

    // Process remaining batch
    if (!dryRun && batch.length > 0) {
      try {
        await Patient.bulkWrite(batch);
        stats.namesUpdated += batch.length;
      } catch (err) {
        console.error('Final batch write error:', err.message);
        stats.errors += batch.length;
      }
    }

    console.log('\n');

    // Create indexes for convention fields
    if (!dryRun) {
      console.log('Creating convention indexes...');
      try {
        await Patient.collection.createIndex({ 'convention.company': 1, status: 1 });
        await Patient.collection.createIndex({ 'convention.company': 1, 'convention.status': 1 });
        await Patient.collection.createIndex({ 'convention.employeeId': 1 });
        console.log('✓ Indexes created successfully\n');
      } catch (err) {
        if (err.code === 85 || err.message.includes('already exists')) {
          console.log('✓ Indexes already exist\n');
        } else {
          console.error('Index creation error:', err.message);
        }
      }
    }

    // Print summary
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    MIGRATION SUMMARY                          ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Total patients:         ${String(stats.totalPatients).padStart(10)}                    ║`);
    console.log(`║  Names converted:        ${String(stats.namesUpdated).padStart(10)}                    ║`);
    console.log(`║  Already uppercase:      ${String(stats.alreadyUppercase).padStart(10)}                    ║`);
    console.log(`║  Errors:                 ${String(stats.errors).padStart(10)}                    ║`);
    console.log(`║  Convention patients:    ${String(stats.conventionPatients).padStart(10)}                    ║`);
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    if (dryRun) {
      console.log('👉 Run without --dry-run to apply changes\n');
    } else {
      console.log('✅ Migration completed successfully!\n');
    }

  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

migrate().catch(console.error);
