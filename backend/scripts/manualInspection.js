/**
 * MANUAL INSPECTION - Review each duplicate and decide what to keep
 * Run with: node scripts/manualInspection.js
 *
 * This shows detailed info about each duplicate so you can make informed decisions
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { requireNonProduction } = require('./_guards');
requireNonProduction('manualInspection.js');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

async function inspect() {
  try {
    console.log('=== MANUAL INSPECTION TOOL ===\n');

    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    const visitsCollection = db.collection('visits');
    const appointmentsCollection = db.collection('appointments');
    const patientsCollection = db.collection('patients');

    // Find duplicates
    const duplicates = await visitsCollection.aggregate([
      { $match: { appointment: { $exists: true, $ne: null }, deleted: { $ne: true } } },
      { $group: { _id: '$appointment', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      process.exit(0);
    }

    console.log(`Found ${duplicates.length} appointments with duplicates\n`);

    // Detailed inspection of each duplicate
    for (let i = 0; i < duplicates.length; i++) {
      const dup = duplicates[i];

      console.log(`\n${'█'.repeat(100)}`);
      console.log(`DUPLICATE SET ${i + 1}/${duplicates.length}`);
      console.log(`${'█'.repeat(100)}\n`);

      // Get appointment details
      const appointment = await appointmentsCollection.findOne({ _id: dup._id });
      const patient = await patientsCollection.findOne({ _id: appointment?.patient });

      console.log('APPOINTMENT INFO:');
      console.log(`  ID: ${appointment?._id}`);
      console.log(`  Appointment #: ${appointment?.appointmentId}`);
      console.log(`  Patient: ${patient?.firstName} ${patient?.lastName} (${patient?.patientId})`);
      console.log(`  Date: ${appointment?.date}`);
      console.log(`  Type: ${appointment?.type}`);
      console.log(`  Status: ${appointment?.status}`);
      console.log(`  Department: ${appointment?.department || 'N/A'}`);

      // Get all visits for this appointment
      const visits = await visitsCollection.find({ appointment: dup._id })
        .sort({ visitDate: -1 })
        .toArray();

      console.log(`\nVISITS (${visits.length} total):\n`);

      visits.forEach((visit, index) => {
        const isNewest = index === 0;
        const boxChar = isNewest ? '█' : '▒';

        console.log(`${boxChar.repeat(80)}`);
        console.log(`${isNewest ? '✅ NEWEST (will be kept by AUTOFIX)' : `❌ OLDER #${visits.length - index} (will be unlinked by AUTOFIX)`}`);
        console.log(`${boxChar.repeat(80)}`);

        console.log(`Visit ID: ${visit._id}`);
        console.log(`Visit Number: ${visit.visitId || 'N/A'}`);
        console.log(`Created At: ${visit.createdAt}`);
        console.log(`Visit Date: ${visit.visitDate}`);
        console.log(`Status: ${visit.status}`);
        console.log(`Primary Provider: ${visit.primaryProvider}`);

        // Detailed content check
        console.log('\nCONTENT CHECK:');
        console.log(`  Prescriptions: ${visit.prescriptions?.length || 0}`);
        console.log(`  Clinical Acts: ${visit.clinicalActs?.length || 0}`);
        console.log(`  Diagnoses: ${visit.diagnoses?.length || 0}`);
        console.log(`  Vital Signs: ${visit.vitalSigns ? 'YES' : 'NO'}`);
        console.log(`  Chief Complaint: ${visit.chiefComplaint?.complaint || 'N/A'}`);
        console.log(`  Notes: ${visit.notes ? `${visit.notes.substring(0, 50)}...` : 'N/A'}`);

        // Financial check
        console.log('\nFINANCIAL CHECK:');
        console.log(`  Invoice: ${visit.billing?.invoice ? `YES (${visit.billing.invoice})` : 'NO'}`);
        console.log(`  Amount Charged: ${visit.billing?.amountCharged || 0}`);
        console.log(`  Insurance Claim: ${visit.billing?.insuranceClaim ? 'YES' : 'NO'}`);

        // Timestamps
        console.log('\nTIMESTAMPS:');
        console.log(`  Created: ${visit.createdAt}`);
        console.log(`  Updated: ${visit.updatedAt}`);
        console.log(`  Completed: ${visit.completedAt || 'N/A'}`);

        // Calculate score
        const score = (
          (visit.prescriptions?.length || 0) * 10 +
          (visit.clinicalActs?.length || 0) * 5 +
          (visit.diagnoses?.length || 0) * 5 +
          (visit.vitalSigns ? 5 : 0) +
          (visit.chiefComplaint ? 5 : 0) +
          (visit.billing?.invoice ? 50 : 0) +
          (visit.status === 'completed' ? 20 : 0)
        );

        console.log(`\n📊 DATA RICHNESS SCORE: ${score}/100`);

        if (score > 50) {
          console.log('   ⚠️  HIGH VALUE - Contains significant clinical data');
        } else if (score > 10) {
          console.log('   ℹ️  MEDIUM VALUE - Contains some data');
        } else {
          console.log('   ✅ LOW VALUE - Mostly empty (safe to unlink)');
        }

        console.log('');
      });

      console.log('─'.repeat(80));
      console.log('RECOMMENDATION:');

      // Check if keeping newest is safe
      const newestVisit = visits[0];
      const olderVisits = visits.slice(1);

      const newestScore = (
        (newestVisit.prescriptions?.length || 0) * 10 +
        (newestVisit.billing?.invoice ? 50 : 0) +
        (newestVisit.status === 'completed' ? 20 : 0)
      );

      const hasValuableOlderVisits = olderVisits.some(v =>
        v.billing?.invoice || v.status === 'completed' || (v.prescriptions?.length || 0) > 0
      );

      if (hasValuableOlderVisits && newestScore < 20) {
        console.log('⚠️  WARNING: Older visits have more data than newest!');
        console.log('   Consider MANUAL cleanup instead of AUTOFIX');
        console.log('   The newest visit might be the duplicate, not the older ones');
      } else {
        console.log('✅ SAFE: AUTOFIX will keep the right visit');
        console.log('   Newest visit is most complete or all are empty');
      }
      console.log('─'.repeat(80));
    }

    console.log(`\n\n${'█'.repeat(100)}`);
    console.log('INSPECTION COMPLETE');
    console.log('█'.repeat(100));

    console.log('\nNEXT STEPS:');
    console.log('1. Review the output above');
    console.log('2. If all recommendations say "SAFE", run:');
    console.log('     bash scripts/backupBeforeMigration.sh');
    console.log('     AUTOFIX=true node scripts/createUniqueVisitIndex.js');
    console.log('');
    console.log('3. If any recommendations say "WARNING", do manual cleanup:');
    console.log('     mongosh medflow');
    console.log('     db.visits.updateOne({_id: ObjectId("visitId")}, {$unset: {appointment: ""}})');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

inspect();
