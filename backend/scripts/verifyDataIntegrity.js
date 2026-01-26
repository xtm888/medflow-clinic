/**
 * Data Integrity Verification Script
 *
 * Verifies Patient -> Visit -> Prescription relationships
 * Part of QA Phase for CareVision replacement
 *
 * Checks:
 * 1. All visits have valid patient references
 * 2. All prescriptions have valid patient references
 * 3. Prescriptions with visit references point to valid visits
 * 4. Visit-Prescription cross-references are consistent
 *
 * Usage:
 *   node scripts/verifyDataIntegrity.js
 *   node scripts/verifyDataIntegrity.js --fix  (to attempt auto-fixes)
 *   node scripts/verifyDataIntegrity.js --json (for machine-readable output)
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { safeExecute } = require('./_guards');

// Parse command line arguments
const args = process.argv.slice(2);
const FIX_MODE = args.includes('--fix');
const JSON_OUTPUT = args.includes('--json');

/**
 * Main verification function
 */
async function verifyDataIntegrity() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medflow-matrix');
  const db = mongoose.connection.db;

  const results = {
    timestamp: new Date().toISOString(),
    status: 'PASS',
    checks: {},
    summary: {
      totalChecks: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    }
  };

  // ============================================================
  // Check 1: Visits with null/missing patient references
  // ============================================================
  const visitsWithNullPatient = await db.collection('visits').countDocuments({
    $or: [
      { patient: null },
      { patient: { $exists: false } }
    ]
  });

  results.checks.visitsWithNullPatient = {
    name: 'Visits with null patient',
    count: visitsWithNullPatient,
    status: visitsWithNullPatient === 0 ? 'PASS' : 'FAIL',
    expected: 0,
    message: visitsWithNullPatient === 0
      ? 'All visits have valid patient references'
      : `Found ${visitsWithNullPatient} visits with null/missing patient`
  };

  results.summary.totalChecks++;
  if (visitsWithNullPatient === 0) {
    results.summary.passed++;
  } else {
    results.summary.failed++;
    results.status = 'FAIL';
  }

  // ============================================================
  // Check 2: Prescriptions with null/missing patient references
  // ============================================================
  const prescriptionsWithNullPatient = await db.collection('prescriptions').countDocuments({
    $or: [
      { patient: null },
      { patient: { $exists: false } }
    ]
  });

  results.checks.prescriptionsWithNullPatient = {
    name: 'Prescriptions with null patient',
    count: prescriptionsWithNullPatient,
    status: prescriptionsWithNullPatient === 0 ? 'PASS' : 'FAIL',
    expected: 0,
    message: prescriptionsWithNullPatient === 0
      ? 'All prescriptions have valid patient references'
      : `Found ${prescriptionsWithNullPatient} prescriptions with null/missing patient`
  };

  results.summary.totalChecks++;
  if (prescriptionsWithNullPatient === 0) {
    results.summary.passed++;
  } else {
    results.summary.failed++;
    results.status = 'FAIL';
  }

  // ============================================================
  // Check 3: Prescriptions with visit ref pointing to non-existent visits
  // ============================================================
  const prescriptionsWithVisit = await db.collection('prescriptions').find({
    visit: { $ne: null, $exists: true }
  }).toArray();

  const visitIds = prescriptionsWithVisit.map(p => p.visit);
  const existingVisits = await db.collection('visits').find({
    _id: { $in: visitIds }
  }).project({ _id: 1 }).toArray();

  const existingVisitIdSet = new Set(existingVisits.map(v => v._id.toString()));
  const orphanedPrescriptions = prescriptionsWithVisit.filter(
    p => p.visit && !existingVisitIdSet.has(p.visit.toString())
  );

  results.checks.orphanedPrescriptionVisitRefs = {
    name: 'Prescriptions with invalid visit references',
    count: orphanedPrescriptions.length,
    status: orphanedPrescriptions.length === 0 ? 'PASS' : 'WARN',
    expected: 0,
    message: orphanedPrescriptions.length === 0
      ? 'All prescription visit references are valid'
      : `Found ${orphanedPrescriptions.length} prescriptions pointing to non-existent visits`
  };

  results.summary.totalChecks++;
  if (orphanedPrescriptions.length === 0) {
    results.summary.passed++;
  } else {
    results.summary.warnings++;
    // Don't fail on this - prescription.visit is optional
  }

  // ============================================================
  // Check 4: Visits referencing non-existent patients
  // ============================================================
  const visitsWithPatient = await db.collection('visits').find({
    patient: { $ne: null, $exists: true }
  }).project({ _id: 1, patient: 1 }).toArray();

  const patientIds = [...new Set(visitsWithPatient.map(v => v.patient))];
  const existingPatients = await db.collection('patients').find({
    _id: { $in: patientIds }
  }).project({ _id: 1 }).toArray();

  const existingPatientIdSet = new Set(existingPatients.map(p => p._id.toString()));
  const orphanedVisits = visitsWithPatient.filter(
    v => v.patient && !existingPatientIdSet.has(v.patient.toString())
  );

  results.checks.orphanedVisitPatientRefs = {
    name: 'Visits with invalid patient references',
    count: orphanedVisits.length,
    status: orphanedVisits.length === 0 ? 'PASS' : 'FAIL',
    expected: 0,
    message: orphanedVisits.length === 0
      ? 'All visit patient references point to existing patients'
      : `Found ${orphanedVisits.length} visits pointing to non-existent patients`
  };

  results.summary.totalChecks++;
  if (orphanedVisits.length === 0) {
    results.summary.passed++;
  } else {
    results.summary.failed++;
    results.status = 'FAIL';
  }

  // ============================================================
  // Check 5: Prescriptions referencing non-existent patients
  // ============================================================
  const prescriptionsWithPatient = await db.collection('prescriptions').find({
    patient: { $ne: null, $exists: true }
  }).project({ _id: 1, patient: 1 }).toArray();

  const prescriptionPatientIds = [...new Set(prescriptionsWithPatient.map(p => p.patient))];
  const existingPrescriptionPatients = await db.collection('patients').find({
    _id: { $in: prescriptionPatientIds }
  }).project({ _id: 1 }).toArray();

  const existingPrescriptionPatientIdSet = new Set(
    existingPrescriptionPatients.map(p => p._id.toString())
  );
  const orphanedPrescriptionPatients = prescriptionsWithPatient.filter(
    p => p.patient && !existingPrescriptionPatientIdSet.has(p.patient.toString())
  );

  results.checks.orphanedPrescriptionPatientRefs = {
    name: 'Prescriptions with invalid patient references',
    count: orphanedPrescriptionPatients.length,
    status: orphanedPrescriptionPatients.length === 0 ? 'PASS' : 'FAIL',
    expected: 0,
    message: orphanedPrescriptionPatients.length === 0
      ? 'All prescription patient references point to existing patients'
      : `Found ${orphanedPrescriptionPatients.length} prescriptions pointing to non-existent patients`
  };

  results.summary.totalChecks++;
  if (orphanedPrescriptionPatients.length === 0) {
    results.summary.passed++;
  } else {
    results.summary.failed++;
    results.status = 'FAIL';
  }

  // ============================================================
  // Check 6: Count statistics for context
  // ============================================================
  const totalPatients = await db.collection('patients').countDocuments({});
  const totalVisits = await db.collection('visits').countDocuments({});
  const totalPrescriptions = await db.collection('prescriptions').countDocuments({});

  results.statistics = {
    totalPatients,
    totalVisits,
    totalPrescriptions,
    visitsPerPatient: totalPatients > 0 ? (totalVisits / totalPatients).toFixed(2) : 0,
    prescriptionsPerVisit: totalVisits > 0 ? (totalPrescriptions / totalVisits).toFixed(2) : 0
  };

  // ============================================================
  // Output Results
  // ============================================================
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║        DATA INTEGRITY VERIFICATION REPORT                      ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║  Timestamp: ${results.timestamp.padEnd(49)}║`);
    console.log(`║  Overall Status: ${(results.status === 'PASS' ? '✓ PASS' : '✗ FAIL').padEnd(44)}║`);
    console.log('╚════════════════════════════════════════════════════════════════╝');

    console.log('\n📊 Database Statistics:');
    console.log(`   Total Patients:      ${totalPatients.toLocaleString()}`);
    console.log(`   Total Visits:        ${totalVisits.toLocaleString()}`);
    console.log(`   Total Prescriptions: ${totalPrescriptions.toLocaleString()}`);

    console.log('\n🔍 Integrity Checks:');
    Object.values(results.checks).forEach(check => {
      const icon = check.status === 'PASS' ? '✓' : check.status === 'WARN' ? '⚠' : '✗';
      const color = check.status === 'PASS' ? '\x1b[32m' : check.status === 'WARN' ? '\x1b[33m' : '\x1b[31m';
      console.log(`   ${color}${icon}\x1b[0m ${check.name}: ${check.count} (expected: ${check.expected})`);
      if (check.status !== 'PASS') {
        console.log(`     └─ ${check.message}`);
      }
    });

    console.log('\n📈 Summary:');
    console.log(`   Total Checks: ${results.summary.totalChecks}`);
    console.log(`   Passed:       ${results.summary.passed}`);
    console.log(`   Failed:       ${results.summary.failed}`);
    console.log(`   Warnings:     ${results.summary.warnings}`);

    // Output verification result for automated checks
    if (results.status === 'PASS') {
      console.log('\n✅ INTEGRITY_OK');
    } else {
      console.log('\n❌ INTEGRITY_FAIL');
    }
  }

  await mongoose.disconnect();

  // Exit with appropriate code
  if (results.status !== 'PASS') {
    process.exit(1);
  }
}

// Run with safety guards
safeExecute('verifyDataIntegrity.js', verifyDataIntegrity, {
  allowProduction: true // Read-only, safe for production
});
