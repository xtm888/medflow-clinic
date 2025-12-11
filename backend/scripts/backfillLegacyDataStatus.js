#!/usr/bin/env node
/**
 * Backfill Legacy Patient Data Status
 *
 * This script updates existing legacy patients with the new dataStatus
 * and placeholderFields tracking. Run this after adding the new fields
 * to update patients that were imported before the tracking was added.
 *
 * Usage:
 *   node scripts/backfillLegacyDataStatus.js [--dry-run]
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('✓ Connected to MongoDB');
  } catch (err) {
    console.error('✗ MongoDB connection error:', err);
    process.exit(1);
  }
};

// Import Patient model
const Patient = require('../models/Patient');

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key.replace('--', '')] = value || true;
  return acc;
}, {});

const DRY_RUN = args['dry-run'] === true || args['dry-run'] === 'true';

/**
 * Detect placeholder data in a patient record
 */
function detectPlaceholderFields(patient) {
  const placeholderFields = [];

  // Check dateOfBirth - placeholder is 1900-01-01 or null
  if (!patient.dateOfBirth) {
    placeholderFields.push('dateOfBirth');
  } else {
    const dob = new Date(patient.dateOfBirth);
    const year = dob.getFullYear();
    if (year <= 1900 || year > new Date().getFullYear()) {
      placeholderFields.push('dateOfBirth');
    }
  }

  // Check gender - placeholder is "other" or null
  if (!patient.gender || patient.gender === 'other') {
    placeholderFields.push('gender');
  }

  // Check phoneNumber - placeholder starts with 999 or is null/invalid
  const phone = patient.phoneNumber || patient.phone;
  if (!phone || phone.startsWith('999') || phone === '0000000000' || phone.length < 8) {
    placeholderFields.push('phoneNumber');
  }

  // Check email - placeholder contains @placeholder or is null
  if (!patient.email || patient.email.includes('@placeholder') || patient.email.includes('@example')) {
    placeholderFields.push('email');
  }

  // Check address - placeholder or null
  const addr = patient.address;
  if (!addr || (typeof addr === 'object' && !addr.street && !addr.city) || addr === 'N/A' || addr === 'Unknown') {
    placeholderFields.push('address');
  }

  // Check bloodType - usually null for legacy imports
  if (!patient.bloodType && !patient.bloodGroup) {
    placeholderFields.push('bloodType');
  }

  return placeholderFields;
}

/**
 * Main backfill function
 */
async function backfillDataStatus() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║       BACKFILL LEGACY PATIENT DATA STATUS                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '💾 LIVE (will update database)'}`);
  console.log('\n' + '─'.repeat(60) + '\n');

  // Find all patients that might be legacy (have legacyId or folderIds or phoneNumber starting with 999)
  const legacyPatients = await Patient.find({
    $or: [
      { legacyId: { $exists: true, $ne: null } },
      { 'folderIds.0': { $exists: true } },
      { phoneNumber: { $regex: /^999/ } },
      { isLegacyImport: true }
    ]
  });

  console.log(`Found ${legacyPatients.length} potential legacy patients\n`);

  let updated = 0;
  let alreadyComplete = 0;
  let alreadyTracked = 0;
  let needsUpdate = 0;

  for (const patient of legacyPatients) {
    const placeholderFields = detectPlaceholderFields(patient);
    const hasPlaceholders = placeholderFields.length > 0;

    // Check if already properly tracked
    const currentStatus = patient.dataStatus || 'complete';
    const currentPlaceholders = patient.placeholderFields || [];

    // Determine if update is needed
    const needsStatusUpdate = hasPlaceholders && currentStatus !== 'incomplete';
    const needsPlaceholderUpdate = hasPlaceholders &&
      JSON.stringify(currentPlaceholders.sort()) !== JSON.stringify(placeholderFields.sort());

    if (needsStatusUpdate || needsPlaceholderUpdate) {
      needsUpdate++;

      if (!DRY_RUN) {
        await Patient.updateOne(
          { _id: patient._id },
          {
            $set: {
              dataStatus: hasPlaceholders ? 'incomplete' : 'complete',
              placeholderFields: placeholderFields
            }
          }
        );
      }

      updated++;
      console.log(`  ✓ Updated: ${patient.firstName} ${patient.lastName} (${patient.patientId})`);
      console.log(`    Placeholders: ${placeholderFields.join(', ')}`);
    } else if (!hasPlaceholders) {
      alreadyComplete++;
    } else {
      alreadyTracked++;
    }
  }

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('                        SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Legacy patients found:  ${legacyPatients.length}`);
  console.log(`  Updated:                ${updated}`);
  console.log(`  Already complete:       ${alreadyComplete}`);
  console.log(`  Already tracked:        ${alreadyTracked}`);
  console.log('═'.repeat(60) + '\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN - No changes were made to the database\n');
    console.log('Run without --dry-run to apply changes.\n');
  } else {
    console.log('✓ Backfill complete!\n');
  }
}

// Main execution
async function main() {
  await connectDB();
  await backfillDataStatus();
  await mongoose.disconnect();
  console.log('✓ Disconnected from MongoDB');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
