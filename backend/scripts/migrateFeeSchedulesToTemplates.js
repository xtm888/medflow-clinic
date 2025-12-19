/**
 * Migration Script: Convert existing fee schedules to templates
 *
 * This script:
 * 1. Sets isTemplate = true and clinic = null for all existing fee schedules without a clinic
 * 2. Recreates the unique index if needed
 *
 * Run with: node scripts/migrateFeeSchedulesToTemplates.js
 * Dry run: DRY_RUN=true node scripts/migrateFeeSchedulesToTemplates.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DRY_RUN = process.env.DRY_RUN === 'true';

async function migrate() {
  console.log('='.repeat(60));
  console.log('Fee Schedule Migration: Convert to Templates');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log('='.repeat(60));

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('\n✓ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('feeschedules');

    // 1. Count existing records
    const totalCount = await collection.countDocuments();
    console.log(`\nTotal fee schedules in database: ${totalCount}`);

    // 2. Find records without isTemplate field or with null clinic that aren't marked as template
    const needsMigration = await collection.countDocuments({
      $or: [
        { isTemplate: { $exists: false } },
        { isTemplate: { $ne: true }, clinic: null },
        { isTemplate: { $ne: true }, clinic: { $exists: false } }
      ]
    });
    console.log(`Records needing migration: ${needsMigration}`);

    if (needsMigration === 0) {
      console.log('\n✓ All records already have isTemplate set properly. Nothing to migrate.');
    } else {
      // 3. Update records
      if (!DRY_RUN) {
        const result = await collection.updateMany(
          {
            $or: [
              { isTemplate: { $exists: false } },
              { isTemplate: { $ne: true }, clinic: null },
              { isTemplate: { $ne: true }, clinic: { $exists: false } }
            ]
          },
          {
            $set: {
              isTemplate: true,
              clinic: null
            }
          }
        );
        console.log(`\n✓ Updated ${result.modifiedCount} records to isTemplate: true`);
      } else {
        console.log(`\n[DRY RUN] Would update ${needsMigration} records to isTemplate: true`);
      }
    }

    // 4. Check indexes
    console.log('\n--- Index Information ---');
    const indexes = await collection.indexes();
    console.log('Current indexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}${idx.unique ? ' (unique)' : ''}`);
    });

    // 5. Check for old code-only unique index
    const hasOldCodeIndex = indexes.some(idx =>
      idx.unique &&
      Object.keys(idx.key).length === 1 &&
      idx.key.code === 1
    );

    const hasNewCompoundIndex = indexes.some(idx =>
      idx.unique &&
      idx.key.code === 1 &&
      idx.key.clinic === 1
    );

    if (hasOldCodeIndex && !hasNewCompoundIndex) {
      console.log('\n⚠ Found old unique index on code only');
      console.log('  The new compound index { code: 1, clinic: 1 } should be created');

      if (!DRY_RUN) {
        // Drop old index
        try {
          await collection.dropIndex('code_1');
          console.log('  ✓ Dropped old code_1 index');
        } catch (err) {
          console.log('  Note: Could not drop old index:', err.message);
        }

        // Create new compound index
        try {
          await collection.createIndex(
            { code: 1, clinic: 1 },
            { unique: true, name: 'code_clinic_unique' }
          );
          console.log('  ✓ Created new compound index { code: 1, clinic: 1 }');
        } catch (err) {
          console.log('  Error creating new index:', err.message);
        }
      } else {
        console.log('  [DRY RUN] Would drop old index and create new compound index');
      }
    } else if (hasNewCompoundIndex) {
      console.log('\n✓ Compound index { code: 1, clinic: 1 } already exists');
    }

    // 6. Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('Migration Summary');
    console.log('='.repeat(60));

    // Count by template status
    const templateCount = await collection.countDocuments({ isTemplate: true });
    const clinicCount = await collection.countDocuments({ clinic: { $ne: null } });

    console.log(`  Templates (central prices): ${templateCount}`);
    console.log(`  Clinic-specific prices: ${clinicCount}`);
    console.log(`  Total: ${templateCount + clinicCount}`);

    if (DRY_RUN) {
      console.log('\n[DRY RUN] No changes were made. Run without DRY_RUN=true to apply changes.');
    } else {
      console.log('\n✓ Migration completed successfully');
    }

  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

// Run migration
migrate();
