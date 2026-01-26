/**
 * Import CareVision Appointments from Ag_Rdv Table
 *
 * Imports appointments from CareVision SQL Server (Ag_Rdv table) to MedFlow MongoDB.
 * ~32,000+ records in production
 *
 * Features:
 * - Patient matching via legacyIds.lv (CareVision patient ID)
 * - Provider matching by name
 * - Status mapping from CareVision to MedFlow
 * - Idempotent: tracks legacyIds.careVision to prevent duplicates
 * - Batch processing for memory efficiency
 *
 * Usage:
 *   DRY_RUN=true node scripts/importCareVisionAppointments.js   # Validate without importing
 *   node scripts/importCareVisionAppointments.js                 # Full import
 *   node scripts/importCareVisionAppointments.js --start-date 2024-01-01  # From specific date
 *
 * @module scripts/importCareVisionAppointments
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProductionStrict, isDryRun } = require('./_guards');
requireNonProductionStrict('importCareVisionAppointments.js');

// CareVision SQL Client
const careVisionSqlClient = require('../services/careVisionSqlClient');

// Models
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Clinic = require('../models/Clinic');
const User = require('../models/User');

// Configuration
const DRY_RUN = isDryRun();
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 500;
const SQL_BATCH_SIZE = parseInt(process.env.SQL_BATCH_SIZE) || 2000;

// Parse command line arguments
const args = process.argv.slice(2);
const startDateArg = args.find(a => a.startsWith('--start-date='))?.split('=')[1] ||
                     args[args.indexOf('--start-date') + 1];
const endDateArg = args.find(a => a.startsWith('--end-date='))?.split('=')[1] ||
                   args[args.indexOf('--end-date') + 1];

// Statistics
const stats = {
  totalInCareVision: 0,
  fetched: 0,
  created: 0,
  skipped: {
    alreadyImported: 0,
    patientNotFound: 0,
    invalidData: 0
  },
  errors: [],
  patientNotFoundIds: new Set(),
  startTime: null
};

/**
 * Build patient lookup map from legacyIds.lv (CareVision patient ID)
 * @returns {Promise<Map<string, Object>>} Map of CareVision patient ID to MedFlow patient
 */
async function buildPatientMap() {
  console.log('Building patient lookup map from legacyIds.lv...');
  const patients = await Patient.find(
    { 'legacyIds.lv': { $exists: true, $ne: null } },
    { _id: 1, patientId: 1, 'legacyIds.lv': 1, firstName: 1, lastName: 1 }
  ).lean();

  const map = new Map();
  for (const p of patients) {
    if (p.legacyIds?.lv) {
      map.set(p.legacyIds.lv.toString(), {
        _id: p._id,
        patientId: p.patientId,
        name: `${p.firstName} ${p.lastName}`
      });
    }
  }
  console.log(`  Loaded ${map.size} patients with CareVision legacy IDs`);
  return map;
}

/**
 * Build set of already imported appointment IDs
 * @returns {Promise<Set<string>>} Set of CareVision appointment IDs already in MedFlow
 */
async function buildImportedSet() {
  console.log('Checking for previously imported appointments...');
  const imported = await Appointment.find(
    { externalId: { $regex: /^CV-/ } },
    { externalId: 1 }
  ).lean();

  const set = new Set();
  for (const apt of imported) {
    if (apt.externalId) {
      // Extract CareVision ID from external ID format "CV-12345"
      const cvId = apt.externalId.replace('CV-', '');
      set.add(cvId.toString());
    }
  }
  console.log(`  Found ${set.size} previously imported appointments`);
  return set;
}

/**
 * Build provider lookup map by name
 * @returns {Promise<Map<string, mongoose.Types.ObjectId>>} Map of provider name to User ID
 */
async function buildProviderMap() {
  console.log('Building provider lookup map...');
  const providers = await User.find(
    { role: { $in: ['doctor', 'ophthalmologist', 'optometrist', 'admin'] } },
    { _id: 1, firstName: 1, lastName: 1, username: 1 }
  ).lean();

  const map = new Map();
  for (const p of providers) {
    // Map by various name formats
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase().trim();
    const reversed = `${p.lastName} ${p.firstName}`.toLowerCase().trim();
    const lastName = p.lastName?.toLowerCase().trim();
    const username = p.username?.toLowerCase().trim();

    if (fullName && fullName.length > 1) map.set(fullName, p._id);
    if (reversed && reversed.length > 1) map.set(reversed, p._id);
    if (lastName && lastName.length > 1) map.set(lastName, p._id);
    if (username && username.length > 1) map.set(username, p._id);
  }
  console.log(`  Loaded ${providers.length} providers`);
  return map;
}

/**
 * Map CareVision appointment type to MedFlow appointment type
 * @param {string} cvType - CareVision appointment type
 * @returns {string} MedFlow appointment type
 */
function mapAppointmentType(cvType) {
  if (!cvType) return 'consultation';

  const typeMap = {
    'consultation': 'consultation',
    'consult': 'consultation',
    'controle': 'follow-up',
    'control': 'follow-up',
    'suivi': 'follow-up',
    'urgence': 'emergency',
    'urgent': 'emergency',
    'refraction': 'refraction',
    'chirurgie': 'surgery',
    'operation': 'surgery',
    'ivt': 'procedure',
    'injection': 'procedure',
    'examen': 'ophthalmology',
    'fond_oeil': 'ophthalmology',
    'champ_visuel': 'ophthalmology',
    'oct': 'imaging',
    'angio': 'imaging',
    'laser': 'procedure'
  };

  const normalized = cvType.toLowerCase().trim().replace(/\s+/g, '_');
  return typeMap[normalized] || 'consultation';
}

/**
 * Calculate end time from start time and duration
 * @param {string} startTime - Start time in HH:MM format
 * @param {number} duration - Duration in minutes
 * @returns {string} End time in HH:MM format
 */
function calculateEndTime(startTime, duration) {
  if (!startTime || !duration) {
    // Default to 30 minutes after start or 30-minute slot
    if (!startTime) return '09:00';
    const [hours, minutes] = startTime.split(':').map(Number);
    const endMinutes = (hours * 60 + minutes + 30) % (24 * 60);
    return `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
  }

  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + duration;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMins = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
}

/**
 * Transform CareVision appointment to MedFlow Appointment document
 * @param {Object} cvAppointment - CareVision appointment from SQL client
 * @param {Object} context - Import context with maps and references
 * @returns {Object|null} MedFlow appointment document or null if invalid
 */
function transformToMedFlowAppointment(cvAppointment, context) {
  const { patientMap, providerMap, clinic, systemUser, importedSet } = context;

  // Check if already imported
  const cvId = cvAppointment.legacyId?.toString();
  if (!cvId || importedSet.has(cvId)) {
    stats.skipped.alreadyImported++;
    return null;
  }

  // Find patient
  const cvPatientId = cvAppointment.careVisionPatientId?.toString();
  const patient = patientMap.get(cvPatientId);
  if (!patient) {
    stats.skipped.patientNotFound++;
    stats.patientNotFoundIds.add(cvPatientId);
    return null;
  }

  // Validate scheduled date
  if (!cvAppointment.scheduledAt) {
    stats.skipped.invalidData++;
    stats.errors.push(`Appointment ${cvId}: Missing scheduled date`);
    return null;
  }

  const scheduledDate = new Date(cvAppointment.scheduledAt);
  if (isNaN(scheduledDate.getTime())) {
    stats.skipped.invalidData++;
    stats.errors.push(`Appointment ${cvId}: Invalid date`);
    return null;
  }

  // Extract time from scheduledAt or use default
  let startTime = '09:00';
  if (cvAppointment.scheduledAt) {
    const hours = scheduledDate.getHours();
    const mins = scheduledDate.getMinutes();
    startTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  const duration = cvAppointment.duration || 30;
  const endTime = calculateEndTime(startTime, duration);

  // Find provider (try to match by name)
  let providerId = systemUser._id;
  if (cvAppointment.provider) {
    const providerName = cvAppointment.provider.toLowerCase().trim();
    if (providerMap.has(providerName)) {
      providerId = providerMap.get(providerName);
    }
  }

  // Map appointment type
  const appointmentType = mapAppointmentType(cvAppointment.appointmentType);

  // Build appointment document
  return {
    patient: patient._id,
    provider: providerId,
    clinic: clinic._id,

    // Scheduling
    date: scheduledDate,
    startTime: startTime,
    endTime: endTime,
    duration: duration,

    // Type and department
    type: appointmentType,
    department: 'ophthalmology',

    // Status (map from CareVision)
    status: cvAppointment.status || 'completed',

    // Reason and notes
    reason: cvAppointment.reason || 'Consultation ophtalmologique',
    notes: cvAppointment.notes || null,

    // Location
    location: {
      room: cvAppointment.room || null
    },

    // Reminders
    reminders: cvAppointment.reminderSent ? [{
      type: 'sms',
      sent: true,
      sentAt: cvAppointment.createdAt
    }] : [],

    // Source and external ID (for idempotency)
    source: 'referral', // Imported from legacy system
    externalId: `CV-${cvId}`,

    // Audit
    createdBy: systemUser._id,
    createdAt: cvAppointment.createdAt || scheduledDate,
    updatedAt: cvAppointment.updatedAt || scheduledDate,

    // Legacy tracking
    isDeleted: false
  };
}

/**
 * Process a batch of appointments
 * @param {Array} appointments - Array of MedFlow appointment documents
 */
async function processBatch(appointments) {
  if (appointments.length === 0) return;

  if (DRY_RUN) {
    stats.created += appointments.length;
    return;
  }

  try {
    // Use native MongoDB driver for reliable bulk inserts
    const collection = mongoose.connection.db.collection('appointments');
    const result = await collection.insertMany(appointments, { ordered: false });
    stats.created += result.insertedCount || appointments.length;
  } catch (error) {
    if (error.writeErrors) {
      // Partial success - some documents inserted
      const inserted = appointments.length - error.writeErrors.length;
      stats.created += inserted;
      for (const writeErr of error.writeErrors.slice(0, 5)) {
        stats.errors.push(`Insert error: ${writeErr.errmsg}`);
      }
    } else {
      stats.errors.push(`Batch error: ${error.message}`);
    }
  }
}

/**
 * Main import function
 */
async function importAppointments() {
  console.log('\n' + '='.repeat(60));
  console.log('  CAREVISION APPOINTMENTS IMPORT');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}`);
  if (startDateArg) console.log(`Start Date Filter: ${startDateArg}`);
  if (endDateArg) console.log(`End Date Filter: ${endDateArg}`);
  console.log('');

  stats.startTime = Date.now();

  // Test CareVision connection
  console.log('Testing CareVision database connection...');
  const connTest = await careVisionSqlClient.testConnection();
  if (!connTest.connected) {
    throw new Error(`CareVision connection failed: ${connTest.message}`);
  }
  console.log(`  Connected to ${connTest.server}/${connTest.database}`);

  // Get total count from CareVision
  stats.totalInCareVision = await careVisionSqlClient.getAppointmentCount();
  console.log(`  Total appointments in CareVision: ${stats.totalInCareVision.toLocaleString()}`);

  // Get clinic and system user
  const clinic = await Clinic.findOne({ clinicId: 'TOMBALBAYE-001' });
  if (!clinic) {
    throw new Error('Tombalbaye clinic not found! Run seedClinics.js first.');
  }

  const systemUser = await User.findOne({ role: 'admin' });
  if (!systemUser) {
    throw new Error('No admin user found! Create admin user first.');
  }

  console.log(`Clinic: ${clinic.name} (${clinic._id})`);
  console.log(`System User: ${systemUser.firstName} ${systemUser.lastName}`);

  // Build lookup maps
  const patientMap = await buildPatientMap();
  const importedSet = await buildImportedSet();
  const providerMap = await buildProviderMap();

  const context = {
    patientMap,
    importedSet,
    providerMap,
    clinic,
    systemUser
  };

  // Process in batches from SQL Server
  console.log('\nImporting appointments...');
  let offset = 0;
  let hasMore = true;
  const appointmentBatch = [];

  while (hasMore) {
    // Build query options
    const queryOptions = {
      limit: SQL_BATCH_SIZE,
      offset: offset
    };

    if (startDateArg) {
      queryOptions.startDate = new Date(startDateArg);
    }
    if (endDateArg) {
      queryOptions.endDate = new Date(endDateArg);
    }

    // Fetch batch from CareVision
    const { records, total } = await careVisionSqlClient.getAppointments(queryOptions);
    stats.fetched += records.length;

    if (records.length === 0) {
      hasMore = false;
      break;
    }

    // Transform and accumulate
    for (const cvAppointment of records) {
      const medflowAppointment = transformToMedFlowAppointment(cvAppointment, context);
      if (medflowAppointment) {
        // Add required MongoDB _id
        medflowAppointment._id = new mongoose.Types.ObjectId();
        appointmentBatch.push(medflowAppointment);
      }

      // Process batch when full
      if (appointmentBatch.length >= BATCH_SIZE) {
        await processBatch([...appointmentBatch]);
        appointmentBatch.length = 0;

        // Progress update
        const progress = Math.round((stats.fetched / total) * 100);
        const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
        process.stdout.write(`\r  Progress: ${progress}% (${stats.fetched.toLocaleString()}/${total.toLocaleString()}) - ${stats.created.toLocaleString()} created - ${elapsed}s elapsed`);
      }
    }

    offset += records.length;
    if (records.length < SQL_BATCH_SIZE) {
      hasMore = false;
    }
  }

  // Process remaining batch
  if (appointmentBatch.length > 0) {
    await processBatch(appointmentBatch);
  }

  console.log('\n');
}

/**
 * Print import summary
 */
function printSummary() {
  const elapsed = Math.round((Date.now() - stats.startTime) / 1000);

  console.log('='.repeat(60));
  console.log('  IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE IMPORT'}`);
  console.log(`Total in CareVision: ${stats.totalInCareVision.toLocaleString()}`);
  console.log(`Fetched: ${stats.fetched.toLocaleString()}`);
  console.log(`Created: ${stats.created.toLocaleString()}`);
  console.log('');
  console.log('Skipped:');
  console.log(`  Already imported: ${stats.skipped.alreadyImported.toLocaleString()}`);
  console.log(`  Patient not found: ${stats.skipped.patientNotFound.toLocaleString()}`);
  console.log(`  Invalid data: ${stats.skipped.invalidData.toLocaleString()}`);
  console.log('');
  console.log(`Errors: ${stats.errors.length}`);
  console.log(`Duration: ${elapsed}s`);

  if (stats.patientNotFoundIds.size > 0 && stats.patientNotFoundIds.size <= 20) {
    console.log('\nSample patients not found (CareVision IDs):');
    Array.from(stats.patientNotFoundIds).slice(0, 20).forEach(id => {
      console.log(`  - ${id}`);
    });
  } else if (stats.patientNotFoundIds.size > 20) {
    console.log(`\n${stats.patientNotFoundIds.size} unique patients not found in MedFlow`);
  }

  if (stats.errors.length > 0) {
    console.log('\nFirst 10 errors:');
    stats.errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
  }

  console.log('='.repeat(60));
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medflow-matrix';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Run import
    await importAppointments();

    // Print summary
    printSummary();

    // Cleanup
    await careVisionSqlClient.closePool();
    await mongoose.disconnect();

    process.exit(stats.errors.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('\nImport failed:', error.message);
    if (process.env.DEBUG === 'true') {
      console.error(error.stack);
    }

    // Cleanup on error
    try {
      await careVisionSqlClient.closePool();
      await mongoose.disconnect();
    } catch (cleanupErr) {
      // Ignore cleanup errors
    }

    process.exit(1);
  }
}

// Run the import
main();
