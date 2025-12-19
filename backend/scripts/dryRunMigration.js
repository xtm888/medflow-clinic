/**
 * DRY RUN - Shows what the migration will do WITHOUT making changes
 * Run with: node scripts/dryRunMigration.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

async function dryRun() {
  try {
    console.log('=== DRY RUN - NO CHANGES WILL BE MADE ===\n');

    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const visitsCollection = db.collection('visits');

    // Find duplicates
    const duplicates = await visitsCollection.aggregate([
      { $match: { appointment: { $exists: true, $ne: null }, deleted: { $ne: true } } },
      { $group: { _id: '$appointment', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found! Safe to create index.');
      process.exit(0);
    }

    console.log(`Found ${duplicates.length} appointments with duplicate visits\n`);

    let totalToUnlink = 0;
    let totalToKeep = 0;

    for (const dup of duplicates) {
      // Get all visits for this appointment, sorted by date (newest first)
      const visits = await visitsCollection.find({ appointment: dup._id })
        .sort({ visitDate: -1 })
        .toArray();

      const appointmentData = await db.collection('appointments').findOne({ _id: dup._id });

      console.log(`\n${'='.repeat(80)}`);
      console.log(`APPOINTMENT: ${appointmentData?.appointmentId || dup._id}`);
      console.log(`Patient: ${appointmentData?.patient}`);
      console.log(`Total Visits: ${visits.length}`);
      console.log(`${'='.repeat(80)}\n`);

      visits.forEach((visit, index) => {
        const action = index === 0 ? '✅ KEEP' : '❌ UNLINK';
        const marker = index === 0 ? '→ MOST RECENT' : `  (${visits.length - index} older)`;

        console.log(`${action} Visit ${index + 1}/${visits.length} ${marker}`);
        console.log(`   Visit ID: ${visit._id}`);
        console.log(`   Created: ${visit.createdAt}`);
        console.log(`   Visit Date: ${visit.visitDate}`);
        console.log(`   Status: ${visit.status}`);
        console.log(`   Prescriptions: ${visit.prescriptions?.length || 0}`);
        console.log(`   Invoice: ${visit.billing?.invoice ? 'YES' : 'NO'}`);

        if (index === 0) {
          console.log('   👉 This visit will keep the appointment link');
          totalToKeep++;
        } else {
          console.log('   👉 This visit\'s appointment field will be set to NULL');
          totalToUnlink++;
        }
        console.log('');
      });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('SUMMARY OF WHAT WILL HAPPEN:');
    console.log(`${'='.repeat(80)}`);
    console.log(`Appointments with duplicates: ${duplicates.length}`);
    console.log(`Visits to KEEP (with appointment link): ${totalToKeep}`);
    console.log(`Visits to UNLINK (appointment → null): ${totalToUnlink}`);
    console.log('');
    console.log('CHANGES THAT WILL BE MADE:');
    console.log('  ✅ Keep most recent visit for each appointment');
    console.log('  ❌ Unlink older duplicate visits (appointment field → null)');
    console.log('  📝 Note: No visits will be DELETED, only unlinked');
    console.log('  📝 Unlinked visits remain in database and can be re-linked manually');
    console.log('');
    console.log('TO PROCEED WITH ACTUAL FIX:');
    console.log('  AUTOFIX=true node scripts/createUniqueVisitIndex.js');
    console.log('');
    console.log('TO BACKUP FIRST (RECOMMENDED):');
    console.log('  bash scripts/backupBeforeMigration.sh');
    console.log(`${'='.repeat(80)}\n`);

    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

dryRun();
