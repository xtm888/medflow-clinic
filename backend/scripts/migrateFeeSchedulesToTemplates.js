/**
 * Migration: Convert existing fee schedules to templates
 *
 * Problem: All 252 fee schedules have isTemplate=false and clinic=null
 * Solution: Convert them to isTemplate=true (central templates)
 *
 * Usage:
 *   DRY_RUN=true node scripts/migrateFeeSchedulesToTemplates.js   # Preview changes
 *   node scripts/migrateFeeSchedulesToTemplates.js                 # Execute migration
 */

require('dotenv').config();
const mongoose = require('mongoose');
const FeeSchedule = require('../models/FeeSchedule');

const DRY_RUN = process.env.DRY_RUN === 'true';

async function migrate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('Connected to MongoDB');

    if (DRY_RUN) {
      console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
    }

    // Find all fee schedules that should be templates
    // (isTemplate=false AND clinic=null means they're orphaned)
    const orphanedRecords = await FeeSchedule.find({
      isTemplate: false,
      clinic: null
    }).lean();

    console.log(`Found ${orphanedRecords.length} fee schedules with isTemplate=false and clinic=null`);

    if (orphanedRecords.length === 0) {
      console.log('No records to migrate. Checking current state...');

      const templateCount = await FeeSchedule.countDocuments({ isTemplate: true });
      const clinicPriceCount = await FeeSchedule.countDocuments({ isTemplate: false, clinic: { $ne: null } });

      console.log(`  Templates (isTemplate=true): ${templateCount}`);
      console.log(`  Clinic prices (clinic != null): ${clinicPriceCount}`);

      await mongoose.disconnect();
      return;
    }

    // Show sample of what will be converted
    console.log('\nSample records to be converted to templates:');
    orphanedRecords.slice(0, 5).forEach(r => {
      console.log(`  - ${r.code}: ${r.name} (${r.category}) @ ${r.price} ${r.currency}`);
    });
    if (orphanedRecords.length > 5) {
      console.log(`  ... and ${orphanedRecords.length - 5} more`);
    }

    if (!DRY_RUN) {
      // Execute migration
      console.log('\nMigrating...');

      const result = await FeeSchedule.updateMany(
        { isTemplate: false, clinic: null },
        { $set: { isTemplate: true } }
      );

      console.log(`\n✅ Migration complete!`);
      console.log(`   Modified: ${result.modifiedCount} records`);
      console.log(`   Matched: ${result.matchedCount} records`);

      // Verify
      const newTemplateCount = await FeeSchedule.countDocuments({ isTemplate: true });
      const remainingOrphans = await FeeSchedule.countDocuments({ isTemplate: false, clinic: null });

      console.log('\nVerification:');
      console.log(`   Templates now: ${newTemplateCount}`);
      console.log(`   Remaining orphans: ${remainingOrphans}`);
    } else {
      console.log('\n⚠️  DRY RUN - Run without DRY_RUN=true to execute migration');
    }

    await mongoose.disconnect();
    console.log('\nDone!');
  } catch (error) {
    console.error('Migration error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrate();
