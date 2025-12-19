/**
 * Import Legacy Diagnoses from DiagnosticsRP_Local.csv
 *
 * Updates: Visit.diagnoses array
 *
 * MUST RUN AFTER: importLegacyConsultations.js
 *
 * Usage:
 *   DRY_RUN=true node scripts/importLegacyDiagnoses.js   # Validate without importing
 *   node scripts/importLegacyDiagnoses.js                 # Full import
 */

const mongoose = require('mongoose');
const fs = require('fs');
const Papa = require('papaparse');
require('dotenv').config();

// Models
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const User = require('../models/User');

// Configuration
const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = 500;
const DIAGNOSTICS_FILE = '/Users/xtm888/Desktop/DMI_Export/DiagnosticsRP_Local.csv';

// Statistics
const stats = {
  totalRows: 0,
  diagnosesAdded: 0,
  visitsUpdated: 0,
  skipped: 0,
  errors: [],
  patientNotFound: new Set(),
  visitNotFound: new Set(),
  startTime: null
};

/**
 * Map certainty to diagnosis type
 */
function mapCertitudeToType(certitude) {
  if (!certitude) return 'secondary';

  const normalized = certitude.toLowerCase().trim();
  if (normalized === 'certain' || normalized === 'confirmé' || normalized === 'confirme') {
    return 'primary';
  }
  if (normalized === 'probable') {
    return 'secondary';
  }
  if (normalized === 'possible' || normalized === 'à confirmer' || normalized === 'suspect') {
    return 'rule-out';
  }
  return 'secondary';
}

/**
 * Build patient lookup map
 */
async function buildPatientMap() {
  console.log('Building patient lookup map...');
  const patients = await Patient.find(
    { 'legacyIds.lv': { $exists: true } },
    { _id: 1, 'legacyIds.lv': 1, patientId: 1 }
  ).lean();

  const map = new Map();
  for (const p of patients) {
    if (p.legacyIds?.lv) {
      map.set(p.legacyIds.lv, p._id);
    }
  }
  console.log(`  Loaded ${map.size} patients with legacy IDs`);
  return map;
}

/**
 * Build visit lookup map by patient and date
 * Also create a map by NumVisite if available
 */
async function buildVisitMaps() {
  console.log('Building visit lookup maps...');

  const visits = await Visit.find(
    { isLegacyData: true },
    { _id: 1, patient: 1, visitDate: 1, 'legacyIds.lv': 1 }
  ).lean();

  // Map by legacy NumActe (which maps to NumVisite in diagnostics)
  const byLegacyId = new Map();
  // Map by patient+date for fallback matching
  const byPatientDate = new Map();

  for (const v of visits) {
    if (v.legacyIds?.lv) {
      byLegacyId.set(v.legacyIds.lv, v._id);
    }

    // Create patient+date key for fallback
    const dateKey = v.visitDate ? v.visitDate.toISOString().split('T')[0] : '';
    const key = `${v.patient.toString()}_${dateKey}`;
    byPatientDate.set(key, v._id);
  }

  console.log(`  Loaded ${byLegacyId.size} visits by legacy ID`);
  console.log(`  Loaded ${byPatientDate.size} visits by patient+date`);

  return { byLegacyId, byPatientDate };
}

/**
 * Main import function
 */
async function importDiagnoses() {
  console.log('\n=== IMPORTING LEGACY DIAGNOSES ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}\n`);

  stats.startTime = Date.now();

  // Get system user
  const systemUser = await User.findOne({ role: 'admin' });
  if (!systemUser) {
    throw new Error('No admin user found!');
  }

  // Build lookup maps
  const patientMap = await buildPatientMap();
  const { byLegacyId: visitByLegacy, byPatientDate: visitByPatientDate } = await buildVisitMaps();

  // Read diagnostics file
  if (!fs.existsSync(DIAGNOSTICS_FILE)) {
    throw new Error(`Diagnostics file not found: ${DIAGNOSTICS_FILE}`);
  }

  const fileContent = fs.readFileSync(DIAGNOSTICS_FILE, 'utf8');
  console.log('\nParsing diagnostics CSV...');

  const parsed = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim()
  });

  if (parsed.errors.length > 0) {
    console.log(`Parse warnings: ${parsed.errors.length}`);
    parsed.errors.slice(0, 5).forEach(e => console.log(`  - ${e.message}`));
  }

  stats.totalRows = parsed.data.length;
  console.log(`Parsed ${stats.totalRows} diagnosis records\n`);

  // Group diagnoses by visit for batch updates
  const diagnosisByVisit = new Map();

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];

    // Skip empty rows
    const numFiche = row.NumFiche?.trim();
    const diagnostic = row.Diagnostic?.trim();

    if (!numFiche || !diagnostic || numFiche === 'NumFiche') {
      stats.skipped++;
      continue;
    }

    // Find patient
    const patientId = patientMap.get(numFiche);
    if (!patientId) {
      stats.patientNotFound.add(numFiche);
      stats.skipped++;
      continue;
    }

    // Find visit - try NumVisite first, then fall back to patient+date
    let visitId = null;
    const numVisite = row.NumVisite?.trim();

    if (numVisite) {
      visitId = visitByLegacy.get(numVisite);
    }

    // Fallback: try patient + date
    if (!visitId && row.DateDiagnostic) {
      const diagDate = new Date(row.DateDiagnostic);
      if (!isNaN(diagDate.getTime())) {
        const dateKey = diagDate.toISOString().split('T')[0];
        const key = `${patientId.toString()}_${dateKey}`;
        visitId = visitByPatientDate.get(key);
      }
    }

    if (!visitId) {
      // If no visit found, we'll need to create one or skip
      // For now, track and skip
      stats.visitNotFound.add(numVisite || `${numFiche}_${row.DateDiagnostic}`);
      stats.skipped++;
      continue;
    }

    // Parse diagnosis date
    let diagnosisDate = new Date();
    if (row.DateDiagnostic) {
      const parsed = new Date(row.DateDiagnostic);
      if (!isNaN(parsed.getTime())) {
        diagnosisDate = parsed;
      }
    }

    // Create diagnosis object
    const diagnosis = {
      code: row.Catégorie || undefined, // Category could be used as code
      description: diagnostic,
      type: mapCertitudeToType(row.Certitude),
      dateOfDiagnosis: diagnosisDate,
      notes: row.Durée ? `Duration: ${row.Durée}` : undefined
    };

    // Group by visit
    if (!diagnosisByVisit.has(visitId.toString())) {
      diagnosisByVisit.set(visitId.toString(), []);
    }
    diagnosisByVisit.get(visitId.toString()).push(diagnosis);
    stats.diagnosesAdded++;
  }

  console.log(`Grouped ${stats.diagnosesAdded} diagnoses into ${diagnosisByVisit.size} visits\n`);

  // Update visits with diagnoses
  let processedCount = 0;
  const updates = [];

  for (const [visitIdStr, diagnoses] of diagnosisByVisit) {
    updates.push({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(visitIdStr) },
        update: {
          $push: { diagnoses: { $each: diagnoses } },
          $set: { updatedAt: new Date() }
        }
      }
    });

    processedCount++;

    // Execute batch
    if (updates.length >= BATCH_SIZE) {
      await executeBatch(updates);
      updates.length = 0;

      const progress = Math.round((processedCount / diagnosisByVisit.size) * 100);
      const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
      console.log(`Progress: ${progress}% (${processedCount}/${diagnosisByVisit.size}) - ${elapsed}s`);
    }
  }

  // Execute remaining
  if (updates.length > 0) {
    await executeBatch(updates);
  }

  printSummary();
}

/**
 * Execute batch of updates
 */
async function executeBatch(updates) {
  if (DRY_RUN) {
    stats.visitsUpdated += updates.length;
    return;
  }

  try {
    const result = await Visit.bulkWrite(updates, { ordered: false });
    stats.visitsUpdated += result.modifiedCount;
  } catch (error) {
    stats.errors.push(`Batch error: ${error.message}`);
  }
}

/**
 * Print summary
 */
function printSummary() {
  const elapsed = Math.round((Date.now() - stats.startTime) / 1000);

  console.log(`\n${'='.repeat(50)}`);
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(50));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE IMPORT'}`);
  console.log(`Total Rows: ${stats.totalRows}`);
  console.log(`Diagnoses Added: ${stats.diagnosesAdded}`);
  console.log(`Visits Updated: ${stats.visitsUpdated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Patients Not Found: ${stats.patientNotFound.size}`);
  console.log(`Visits Not Found: ${stats.visitNotFound.size}`);
  console.log(`Errors: ${stats.errors.length}`);
  console.log(`Time: ${elapsed}s`);

  if (stats.patientNotFound.size > 0 && stats.patientNotFound.size <= 10) {
    console.log('\nPatients not found:');
    Array.from(stats.patientNotFound).slice(0, 10).forEach(p => console.log(`  - ${p}`));
  }

  if (stats.visitNotFound.size > 0) {
    console.log(`\nNote: ${stats.visitNotFound.size} diagnoses skipped due to missing visits.`);
    console.log('Run importLegacyConsultations.js first if visits are missing.');
  }

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
  }

  console.log('='.repeat(50));
}

/**
 * Main entry point
 */
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('Connected to MongoDB\n');

    await importDiagnoses();

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

main();
