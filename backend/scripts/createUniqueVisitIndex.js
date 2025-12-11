/**
 * Migration script to create unique sparse index on Visit.appointment
 * This prevents duplicate visits for the same appointment
 * Run with: node scripts/createUniqueVisitIndex.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

async function createIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully');

    const db = mongoose.connection.db;
    const visitsCollection = db.collection('visits');

    console.log('\n=== Creating unique sparse index on appointment field ===\n');

    // First, check for any duplicate appointments in existing data
    console.log('Checking for duplicate appointments...');
    const duplicates = await visitsCollection.aggregate([
      { $match: { appointment: { $exists: true, $ne: null } } },
      { $group: { _id: '$appointment', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    if (duplicates.length > 0) {
      console.log(`⚠️  WARNING: Found ${duplicates.length} appointments with duplicate visits:`);
      for (const dup of duplicates) {
        console.log(`  - Appointment ${dup._id}: ${dup.count} visits`);

        // Show details of duplicate visits
        const visits = await visitsCollection.find({ appointment: dup._id }).toArray();
        visits.forEach((v, i) => {
          console.log(`    ${i + 1}. Visit ${v._id} - ${v.visitDate} - Status: ${v.status}`);
        });
      }
      console.log('\n⚠️  You must resolve these duplicates before the unique index can be created.');
      console.log('   Suggestion: Keep the most recent visit and delete or unlink older ones.\n');

      // Ask if user wants to auto-fix by unlinking older duplicate visits
      console.log('Auto-fix option: Set appointment=null on older duplicate visits (keeps most recent)');
      console.log('Run with AUTOFIX=true to enable auto-fix: AUTOFIX=true node scripts/createUniqueVisitIndex.js\n');

      if (process.env.AUTOFIX === 'true') {
        console.log('Auto-fixing duplicates...');
        let fixedCount = 0;

        for (const dup of duplicates) {
          const visits = await visitsCollection.find({ appointment: dup._id })
            .sort({ visitDate: -1 })
            .toArray();

          // Keep the first (most recent), unlink the rest
          for (let i = 1; i < visits.length; i++) {
            await visitsCollection.updateOne(
              { _id: visits[i]._id },
              { $unset: { appointment: "" } }
            );
            console.log(`  ✓ Unlinked visit ${visits[i]._id} from appointment ${dup._id}`);
            fixedCount++;
          }
        }
        console.log(`\n✅ Fixed ${fixedCount} duplicate visits\n`);
      } else {
        process.exit(1);
      }
    } else {
      console.log('✓ No duplicate appointments found');
    }

    // Create the unique sparse index
    console.log('\nCreating unique sparse index on appointment field...');
    await visitsCollection.createIndex(
      { appointment: 1 },
      { unique: true, sparse: true, background: true }
    );
    console.log('✅ Index created successfully');

    // Verify the index
    const indexes = await visitsCollection.indexes();
    const appointmentIndex = indexes.find(idx => idx.key.appointment);

    console.log('\n=== Verification ===');
    console.log('Appointment index:', appointmentIndex);

    if (appointmentIndex?.unique && appointmentIndex?.sparse) {
      console.log('✅ Index is properly configured as unique and sparse');
    } else {
      console.log('⚠️  Index may not be properly configured');
    }

    console.log('\n✅ Migration completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error creating index:', error.message);
    if (error.code === 11000) {
      console.error('\nDuplicate key error - there are still duplicate appointments in the database.');
      console.error('Run the script again with AUTOFIX=true or manually resolve duplicates.');
    }
    process.exit(1);
  }
}

createIndex();
