/**
 * Fix Stuck Visits Script
 *
 * This script finds visits that are stuck in 'in-progress' status
 * but have been signed, and completes them properly.
 *
 * Usage:
 *   node scripts/fixStuckVisits.js [--dry-run]
 *
 * Options:
 *   --dry-run   Show what would be fixed without making changes
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProductionStrict } = require('./_guards');
requireNonProductionStrict('fixStuckVisits.js');

// Load all required models for populate to work
const Visit = require('../models/Visit');
const Patient = require('../models/Patient');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const Prescription = require('../models/Prescription');
const Appointment = require('../models/Appointment');

const DRY_RUN = process.argv.includes('--dry-run');

async function fixStuckVisits() {
  console.log('============================================');
  console.log('  FIX STUCK VISITS SCRIPT');
  console.log('============================================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be applied)'}`);
  console.log('');

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('Connected to MongoDB');
    console.log('');

    // Find visits that are in-progress but have been signed
    const signedButInProgress = await Visit.find({
      status: 'in-progress',
      signatureStatus: 'signed'
    }).populate('patient', 'firstName lastName patientId');

    console.log(`Found ${signedButInProgress.length} visits that are SIGNED but still IN-PROGRESS`);
    console.log('');

    if (signedButInProgress.length === 0) {
      console.log('No stuck visits found. All good!');
    } else {
      console.log('Visits to fix:');
      console.log('-'.repeat(80));

      let fixedCount = 0;
      let errorCount = 0;

      for (const visit of signedButInProgress) {
        const patientName = visit.patient
          ? `${visit.patient.firstName} ${visit.patient.lastName}`
          : 'Unknown';
        const patientId = visit.patient?.patientId || visit.patient?._id || 'N/A';

        console.log(`\nVisit: ${visit.visitId}`);
        console.log(`  Patient: ${patientName} (${patientId})`);
        console.log(`  Date: ${visit.visitDate?.toLocaleDateString('fr-FR') || 'N/A'}`);
        console.log(`  Clinical Acts: ${visit.clinicalActs?.length || 0}`);
        console.log(`  Signed By: ${visit.signedBy}`);
        console.log(`  Signed At: ${visit.signedAt?.toLocaleDateString('fr-FR') || 'N/A'}`);
        console.log(`  Has Invoice: ${visit.billing?.invoice ? 'Yes' : 'No'}`);

        if (!DRY_RUN) {
          try {
            // Complete the visit (this will generate invoice if needed)
            const result = await visit.completeVisit(visit.signedBy || visit.primaryProvider);

            console.log('  ✅ FIXED - Status: completed');
            console.log(`     Invoice: ${result.invoiceGenerated ? 'Generated' : 'Already existed or not generated'}`);
            fixedCount++;
          } catch (err) {
            console.log(`  ❌ ERROR: ${err.message}`);
            errorCount++;
          }
        } else {
          console.log('  [DRY RUN] Would complete this visit');
          fixedCount++;
        }
      }

      console.log('');
      console.log('-'.repeat(80));
      console.log(`Summary: ${fixedCount} visits ${DRY_RUN ? 'would be' : 'were'} fixed, ${errorCount} errors`);
    }

    // Also report on very old in-progress visits (might be abandoned)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const oldInProgressVisits = await Visit.find({
      status: 'in-progress',
      signatureStatus: { $ne: 'signed' },
      visitDate: { $lt: thirtyDaysAgo }
    }).countDocuments();

    if (oldInProgressVisits > 0) {
      console.log('');
      console.log(`⚠️  Warning: ${oldInProgressVisits} visits are in-progress for more than 30 days (unsigned).`);
      console.log('   These may be abandoned consultations that need manual review.');
    }

    // Report current stats
    console.log('');
    console.log('Current Visit Status Distribution:');
    const statusCounts = await Visit.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    statusCounts.forEach(s => {
      console.log(`  ${s._id || 'null'}: ${s.count}`);
    });

  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('');
    console.log('Disconnected from MongoDB');
  }
}

fixStuckVisits();
