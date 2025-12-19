/**
 * Simple Fix for Stuck Visits Script
 *
 * This script directly updates visits that are stuck in 'in-progress' status
 * but have been signed, changing them to 'completed'.
 *
 * This is a simpler version that works with standalone MongoDB (no transactions).
 *
 * Usage:
 *   node scripts/fixStuckVisitsSimple.js [--dry-run]
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Load models
const Visit = require('../models/Visit');
const Patient = require('../models/Patient');
const User = require('../models/User');
const Invoice = require('../models/Invoice');

const DRY_RUN = process.argv.includes('--dry-run');

async function fixStuckVisits() {
  console.log('============================================');
  console.log('  FIX STUCK VISITS SCRIPT (Simple)');
  console.log('============================================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be applied)'}`);
  console.log('');

  try {
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
      let fixedCount = 0;
      let invoicesCreated = 0;
      let errorCount = 0;

      for (const visit of signedButInProgress) {
        const patientName = visit.patient
          ? `${visit.patient.firstName} ${visit.patient.lastName}`
          : 'Unknown';

        console.log(`\n${visit.visitId} - ${patientName}`);
        console.log(`  Clinical Acts: ${visit.clinicalActs?.length || 0}, Has Invoice: ${visit.billing?.invoice ? 'Yes' : 'No'}`);

        if (!DRY_RUN) {
          try {
            // Generate invoice if needed
            if (!visit.billing?.invoice) {
              try {
                const invoiceResult = await visit.generateInvoice(visit.signedBy || visit.primaryProvider);
                if (invoiceResult?.invoice) {
                  console.log(`  ✓ Created invoice: ${invoiceResult.invoice.invoiceId}`);
                  invoicesCreated++;
                }
              } catch (invoiceErr) {
                console.log(`  ⚠ Invoice error: ${invoiceErr.message}`);
              }
            }

            // Directly update visit status (no transaction needed)
            visit.status = 'completed';
            visit.completedAt = visit.signedAt || new Date();
            visit.completedBy = visit.signedBy || visit.primaryProvider;
            visit.endTime = visit.endTime || visit.signedAt || new Date();
            await visit.save();

            // Update patient lastVisit
            if (visit.patient) {
              await Patient.findByIdAndUpdate(visit.patient._id || visit.patient, {
                lastVisit: visit._id,
                lastVisitDate: visit.visitDate,
                lastConsultationDate: visit.signedAt || new Date()
              });
            }

            console.log('  ✅ COMPLETED');
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
      console.log('='.repeat(60));
      console.log(`Summary: ${fixedCount} visits ${DRY_RUN ? 'would be' : 'were'} fixed`);
      if (!DRY_RUN) {
        console.log(`         ${invoicesCreated} invoices created`);
        console.log(`         ${errorCount} errors`);
      }
    }

    // Show current status distribution
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
    console.log('\nDisconnected from MongoDB');
  }
}

fixStuckVisits();
