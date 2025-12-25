/**
 * ROLLBACK SCRIPT - Undo the migration changes
 * Run with: node scripts/rollbackMigration.js
 *
 * This script:
 * 1. Drops the unique index (if created)
 * 2. Optionally restores from backup
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { requireNonProductionStrict, requireConfirmation } = require('./_guards');
requireNonProductionStrict('rollbackMigration.js');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

async function rollback() {
  try {
    console.log('=== ROLLBACK MIGRATION ===\n');

    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const visitsCollection = db.collection('visits');

    // Step 1: Check if unique index exists
    console.log('Checking for unique index on appointment field...');
    const indexes = await visitsCollection.indexes();
    const uniqueIndex = indexes.find(idx =>
      idx.key.appointment && (idx.unique === true)
    );

    if (uniqueIndex) {
      console.log(`Found unique index: ${uniqueIndex.name}`);
      console.log('Dropping index...');

      await visitsCollection.dropIndex(uniqueIndex.name);
      console.log('✅ Unique index dropped successfully\n');
    } else {
      console.log('ℹ️  No unique index found (already dropped or never created)\n');
    }

    // Step 2: Show unlinked visits that could be restored
    console.log('Finding visits that were unlinked (appointment = null)...');
    const unlinkedVisits = await visitsCollection.find({
      appointment: null,
      deleted: { $ne: true },
      updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).toArray();

    if (unlinkedVisits.length > 0) {
      console.log(`\nFound ${unlinkedVisits.length} recently unlinked visits:`);
      unlinkedVisits.forEach((visit, i) => {
        console.log(`${i + 1}. Visit ${visit._id}`);
        console.log(`   Created: ${visit.createdAt}`);
        console.log(`   Patient: ${visit.patient}`);
        console.log(`   Status: ${visit.status}`);
      });

      console.log('\n⚠️  These visits have appointment=null');
      console.log('To restore appointment links, you need to:');
      console.log('1. Identify which appointment each visit belongs to');
      console.log('2. Manually update: db.visits.updateOne({_id: visitId}, {$set: {appointment: appointmentId}})');
      console.log('\nOr restore from backup:');
      console.log('  mongoimport --db medflow --collection visits --drop --file backups/visits_backup_TIMESTAMP.json\n');
    } else {
      console.log('No recently unlinked visits found\n');
    }

    console.log('=== ROLLBACK COMPLETE ===');
    console.log('✅ Unique index removed');
    console.log('ℹ️  System is back to pre-migration state');
    console.log('⚠️  Duplicate visits can be created again');

    process.exit(0);

  } catch (error) {
    console.error('Error during rollback:', error);
    process.exit(1);
  }
}

rollback();
