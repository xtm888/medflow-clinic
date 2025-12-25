/**
 * Migration Script: Add clinic field to all inventory items
 *
 * This script:
 * 1. Finds or creates a default clinic
 * 2. Updates all inventory items that don't have a clinic
 * 3. Reports on the migration results
 *
 * Usage: node scripts/migrateInventoryClinic.js [--dry-run]
 */

const mongoose = require('mongoose');
const { PharmacyInventory, FrameInventory, ContactLensInventory, ReagentInventory, LabConsumableInventory } = require('../models/Inventory');
require('dotenv').config();

const { requireNonProductionStrict } = require('./_guards');
requireNonProductionStrict('migrateInventoryClinic.js');

const Clinic = require('../models/Clinic');

const isDryRun = process.argv.includes('--dry-run');

async function migrate() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI?.replace('localhost', '127.0.0.1') ||
                     'mongodb://127.0.0.1:27017/medflow';

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      family: 4
    });

    console.log('✅ Connected to MongoDB');
    console.log(isDryRun ? '🔍 DRY RUN MODE - No changes will be made\n' : '');

    // Step 1: Get or create default clinic
    let defaultClinic = await Clinic.findOne({ status: 'active' }).sort({ type: 1 });

    if (!defaultClinic) {
      if (isDryRun) {
        console.log('⚠️  No clinic found - would create default clinic "Tombalbaye"');
        defaultClinic = { _id: 'DRY_RUN_ID', name: 'Tombalbaye' };
      } else {
        console.log('Creating default clinic...');
        defaultClinic = await Clinic.create({
          clinicId: 'TOMB',
          name: 'Tombalbaye',
          shortName: 'TOMB',
          address: {
            city: 'Kinshasa',
            country: 'RDC'
          },
          status: 'active',
          type: 'main',
          services: ['consultation', 'ophthalmology', 'pharmacy', 'optical_shop']
        });
        console.log(`✅ Created default clinic: ${defaultClinic.name}`);
      }
    } else {
      console.log(`Using existing clinic: ${defaultClinic.name} (${defaultClinic._id})`);
    }

    // Step 2: Get all clinics for reporting
    const allClinics = await Clinic.find({ status: 'active' }).lean();
    console.log(`\nFound ${allClinics.length} active clinic(s):`);
    allClinics.forEach(c => console.log(`  - ${c.name} (${c.clinicId})`));
    console.log('');

    // Step 3: Migrate each inventory type
    const models = [
      { name: 'PharmacyInventory', model: PharmacyInventory },
      { name: 'FrameInventory', model: FrameInventory },
      { name: 'ContactLensInventory', model: ContactLensInventory },
      { name: 'LabConsumableInventory', model: LabConsumableInventory },
      { name: 'ReagentInventory', model: ReagentInventory }
    ];

    const results = [];

    for (const { name, model } of models) {
      console.log(`\n📦 Processing ${name}...`);

      // Count items without clinic
      const withoutClinic = await model.countDocuments({
        $or: [
          { clinic: { $exists: false } },
          { clinic: null }
        ]
      });

      const total = await model.countDocuments();
      const withClinic = total - withoutClinic;

      console.log(`   Total items: ${total}`);
      console.log(`   With clinic: ${withClinic}`);
      console.log(`   Without clinic: ${withoutClinic}`);

      if (withoutClinic > 0) {
        if (isDryRun) {
          console.log(`   ⚠️  Would update ${withoutClinic} items with clinic: ${defaultClinic.name}`);
        } else {
          const updateResult = await model.updateMany(
            {
              $or: [
                { clinic: { $exists: false } },
                { clinic: null }
              ]
            },
            {
              $set: {
                clinic: defaultClinic._id,
                isDepot: false
              }
            }
          );
          console.log(`   ✅ Updated ${updateResult.modifiedCount} items`);
        }
      }

      results.push({
        model: name,
        total,
        withClinic,
        withoutClinic,
        migrated: isDryRun ? 0 : withoutClinic
      });
    }

    // Step 4: Print summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`\nDefault Clinic: ${defaultClinic.name}`);
    console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}\n`);

    console.log('Results by Model:');
    console.log('-'.repeat(60));
    console.log('Model                    | Total | With Clinic | Migrated');
    console.log('-'.repeat(60));

    let totalMigrated = 0;
    results.forEach(r => {
      console.log(
        `${r.model.padEnd(24)} | ${String(r.total).padStart(5)} | ${String(r.withClinic).padStart(11)} | ${String(r.migrated).padStart(8)}`
      );
      totalMigrated += r.migrated;
    });

    console.log('-'.repeat(60));
    console.log(`Total items migrated: ${totalMigrated}`);

    if (isDryRun) {
      console.log('\n⚠️  This was a DRY RUN. Run without --dry-run to apply changes.');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

migrate();
