/**
 * Import CareVision Photos from Photos Table
 *
 * Imports photo metadata from CareVision SQL Server (Photos table) to MedFlow MongoDB.
 * ~368,000+ records in production
 *
 * This script creates metadata bridge entries in DeviceImage model that reference
 * the original CareVision photos. Actual image files remain in CareVision storage
 * and are accessed via the bridge service.
 *
 * Features:
 * - Patient matching via legacyIds.lv (CareVision patient ID)
 * - Photo type detection based on filename/extension
 * - Eye laterality detection from filename patterns (OD, OS, OU)
 * - Idempotent: tracks legacyId with CV-PHOTO- prefix to prevent duplicates
 * - Batch processing for memory efficiency
 * - Links to CareVision consultation/visit when available
 *
 * Usage:
 *   DRY_RUN=true node scripts/importCareVisionPhotos.js   # Validate without importing
 *   node scripts/importCareVisionPhotos.js                 # Full import
 *   node scripts/importCareVisionPhotos.js --start-date 2024-01-01  # From specific date
 *   node scripts/importCareVisionPhotos.js --patient 12345  # Single patient
 *
 * @module scripts/importCareVisionPhotos
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProductionStrict, isDryRun } = require('./_guards');
requireNonProductionStrict('importCareVisionPhotos.js');

// CareVision SQL Client
const careVisionSqlClient = require('../services/careVisionSqlClient');

// Models
const Patient = require('../models/Patient');
const DeviceImage = require('../models/DeviceImage');
const Device = require('../models/Device');
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
const patientArg = args.find(a => a.startsWith('--patient='))?.split('=')[1] ||
                   args[args.indexOf('--patient') + 1];

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
  byType: {
    'fundus': 0,
    'OCT': 0,
    'anterior-segment': 0,
    'visual-field': 0,
    'topography': 0,
    'angiography': 0,
    'slit-lamp': 0,
    'other': 0
  },
  errors: [],
  patientNotFoundIds: new Set(),
  startTime: null
};

/**
 * Get photos from CareVision Photos table
 * Uses raw query since Photos methods aren't in careVisionSqlClient
 *
 * @param {Object} options - Query options
 * @param {Date|string} [options.startDate] - Filter by date >= startDate
 * @param {Date|string} [options.endDate] - Filter by date <= endDate
 * @param {string|number} [options.patientId] - Filter by CareVision patient ID
 * @param {number} [options.limit=2000] - Maximum records to return
 * @param {number} [options.offset=0] - Skip first N records (pagination)
 * @returns {Promise<{records: Array, total: number}>}
 */
async function getPhotos(options = {}) {
  const {
    startDate,
    endDate,
    patientId,
    limit = 2000,
    offset = 0
  } = options;

  const pool = await careVisionSqlClient.getPool();

  // Build WHERE conditions
  const conditions = [];
  const params = {};

  if (startDate) {
    conditions.push('datephoto >= @startDate');
    params.startDate = new Date(startDate);
  }

  if (endDate) {
    conditions.push('datephoto <= @endDate');
    params.endDate = new Date(endDate);
  }

  if (patientId) {
    conditions.push('numclient = @patientId');
    params.patientId = String(patientId);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  // Get total count first
  let countRequest = pool.request();
  Object.entries(params).forEach(([key, value]) => {
    if (value instanceof Date) {
      countRequest.input(key, require('mssql').DateTime, value);
    } else {
      countRequest.input(key, require('mssql').VarChar, value);
    }
  });

  const countResult = await countRequest.query(`
    SELECT COUNT(*) as total FROM Photos ${whereClause}
  `);
  const total = countResult.recordset[0].total;

  // Get paginated records
  let dataRequest = pool.request();
  Object.entries(params).forEach(([key, value]) => {
    if (value instanceof Date) {
      dataRequest.input(key, require('mssql').DateTime, value);
    } else {
      dataRequest.input(key, require('mssql').VarChar, value);
    }
  });
  dataRequest.input('offset', require('mssql').Int, offset);
  dataRequest.input('limit', require('mssql').Int, limit);

  const dataQuery = `
    SELECT
      id,
      numclient,
      numconsultation,
      datephoto,
      typephoto,
      nomfichier,
      cheminphoto,
      extension,
      taille,
      oeil,
      observations,
      appareil,
      medecin,
      datecreation,
      datemodification
    FROM Photos
    ${whereClause}
    ORDER BY datephoto DESC
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY
  `;

  const dataResult = await dataRequest.query(dataQuery);

  return {
    records: dataResult.recordset,
    total
  };
}

/**
 * Get total photo count from CareVision
 * @returns {Promise<number>}
 */
async function getPhotoCount() {
  return careVisionSqlClient.getTableCount('Photos');
}

/**
 * Build patient lookup map from legacyIds.lv (CareVision patient ID)
 * @returns {Promise<Map<string, Object>>} Map of CareVision patient ID to MedFlow patient
 */
async function buildPatientMap() {
  process.stdout.write('Building patient lookup map from legacyIds.lv...');
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
  process.stdout.write(` Loaded ${map.size} patients\n`);
  return map;
}

/**
 * Build set of already imported photo IDs
 * Uses imageId field with CV-PHOTO- prefix for legacy imports
 * @returns {Promise<Set<string>>} Set of CareVision photo IDs already in MedFlow
 */
async function buildImportedSet() {
  process.stdout.write('Checking for previously imported photos...');
  const imported = await DeviceImage.find(
    { imageId: { $regex: /^CV-PHOTO-/ } },
    { imageId: 1 }
  ).lean();

  const set = new Set();
  for (const img of imported) {
    if (img.imageId) {
      // Extract CareVision ID from imageId format "CV-PHOTO-12345"
      const cvId = img.imageId.replace('CV-PHOTO-', '');
      set.add(cvId.toString());
    }
  }
  process.stdout.write(` Found ${set.size} previously imported\n`);
  return set;
}

/**
 * Get or create a legacy device for CareVision photos
 * @param {Object} clinic - Clinic document
 * @param {Object} systemUser - System user document
 * @returns {Promise<Object>} Device document
 */
async function getOrCreateLegacyDevice(clinic, systemUser) {
  let device = await Device.findOne({
    name: 'CareVision Legacy Photos',
    clinic: clinic._id
  });

  if (!device) {
    if (!DRY_RUN) {
      device = await Device.create({
        name: 'CareVision Legacy Photos',
        type: 'fundus-camera',
        manufacturer: 'CareVision',
        model: 'Legacy Import',
        clinic: clinic._id,
        status: 'active',
        createdBy: systemUser._id
      });
    } else {
      device = {
        _id: new mongoose.Types.ObjectId(),
        name: 'CareVision Legacy Photos (dry run)'
      };
    }
  }

  return device;
}

/**
 * Detect image type from filename, extension, and type fields
 * @param {Object} photo - CareVision photo record
 * @returns {string} MedFlow image type
 */
function detectImageType(photo) {
  const filename = (photo.nomfichier || '').toLowerCase();
  const photoType = (photo.typephoto || '').toLowerCase();

  // Check type field first
  if (photoType.includes('oct') || photoType.includes('tomograph')) {
    return 'OCT';
  }
  if (photoType.includes('fundus') || photoType.includes('fond') || photoType.includes('retino')) {
    return 'fundus';
  }
  if (photoType.includes('angio')) {
    return 'angiography';
  }
  if (photoType.includes('topo') || photoType.includes('cornee')) {
    return 'topography';
  }
  if (photoType.includes('champ') || photoType.includes('visual') || photoType.includes('cv')) {
    return 'visual-field';
  }
  if (photoType.includes('laf') || photoType.includes('segment') || photoType.includes('slit') ||
      photoType.includes('biom') || photoType.includes('lamp')) {
    return 'slit-lamp';
  }
  if (photoType.includes('segment') && photoType.includes('ant')) {
    return 'anterior-segment';
  }

  // Check filename patterns
  if (filename.includes('oct') || filename.includes('tomog')) {
    return 'OCT';
  }
  if (filename.includes('fundus') || filename.includes('retino') || filename.includes('fond')) {
    return 'fundus';
  }
  if (filename.includes('angio') || filename.includes('icg') || filename.includes('fa_')) {
    return 'angiography';
  }
  if (filename.includes('topo') || filename.includes('kerato')) {
    return 'topography';
  }
  if (filename.includes('cv') || filename.includes('field') || filename.includes('perim')) {
    return 'visual-field';
  }
  if (filename.includes('laf') || filename.includes('slit') || filename.includes('anterior')) {
    return 'anterior-segment';
  }

  // Default to fundus for general photos
  return 'fundus';
}

/**
 * Detect eye laterality from filename and oeil field
 * @param {Object} photo - CareVision photo record
 * @returns {string} Eye laterality (OD, OS, OU, NA)
 */
function detectEye(photo) {
  // Check oeil field first
  const oeil = (photo.oeil || '').toUpperCase().trim();
  if (oeil === 'OD' || oeil === 'D' || oeil === 'DROIT' || oeil === 'RIGHT') {
    return 'OD';
  }
  if (oeil === 'OS' || oeil === 'G' || oeil === 'GAUCHE' || oeil === 'LEFT') {
    return 'OS';
  }
  if (oeil === 'OU' || oeil === 'LES_DEUX' || oeil === 'BOTH') {
    return 'OU';
  }

  // Check filename patterns
  const filename = (photo.nomfichier || '').toUpperCase();
  if (filename.includes('_OD') || filename.includes('-OD') || filename.includes('OD_') ||
      filename.includes('_D_') || filename.includes('DROIT')) {
    return 'OD';
  }
  if (filename.includes('_OS') || filename.includes('-OS') || filename.includes('OS_') ||
      filename.includes('_G_') || filename.includes('GAUCHE')) {
    return 'OS';
  }
  if (filename.includes('_OU') || filename.includes('-OU') || filename.includes('OU_')) {
    return 'OU';
  }

  // Default to OU for unknown
  return 'OU';
}

/**
 * Map file extension to MIME type and format
 * @param {string} extension - File extension
 * @returns {Object} mimeType and format
 */
function mapFileFormat(extension) {
  const ext = (extension || '').toLowerCase().replace('.', '');

  const formatMap = {
    'jpg': { mimeType: 'image/jpeg', format: 'JPEG' },
    'jpeg': { mimeType: 'image/jpeg', format: 'JPEG' },
    'png': { mimeType: 'image/png', format: 'PNG' },
    'bmp': { mimeType: 'image/bmp', format: 'BMP' },
    'tif': { mimeType: 'image/tiff', format: 'TIFF' },
    'tiff': { mimeType: 'image/tiff', format: 'TIFF' },
    'dcm': { mimeType: 'application/dicom', format: 'DICOM' },
    'dicom': { mimeType: 'application/dicom', format: 'DICOM' },
    'pdf': { mimeType: 'application/pdf', format: 'PDF' }
  };

  return formatMap[ext] || { mimeType: 'image/jpeg', format: 'JPEG' };
}

/**
 * Transform CareVision photo to MedFlow DeviceImage document
 * @param {Object} cvPhoto - CareVision photo from SQL query
 * @param {Object} context - Import context with maps and references
 * @returns {Object|null} MedFlow DeviceImage document or null if invalid
 */
function transformToMedFlowImage(cvPhoto, context) {
  const { patientMap, importedSet, clinic, systemUser, legacyDevice } = context;

  // Check if already imported
  const cvId = cvPhoto.id?.toString();
  if (!cvId || importedSet.has(cvId)) {
    stats.skipped.alreadyImported++;
    return null;
  }

  // Find patient
  const cvPatientId = cvPhoto.numclient?.toString();
  const patient = patientMap.get(cvPatientId);
  if (!patient) {
    stats.skipped.patientNotFound++;
    stats.patientNotFoundIds.add(cvPatientId);
    return null;
  }

  // Detect image type
  const imageType = detectImageType(cvPhoto);
  if (stats.byType[imageType] !== undefined) {
    stats.byType[imageType]++;
  } else {
    stats.byType.other++;
  }

  // Detect eye
  const eye = detectEye(cvPhoto);

  // Get file format info
  const fileFormat = mapFileFormat(cvPhoto.extension);

  // Parse capture date
  let capturedAt = new Date();
  if (cvPhoto.datephoto) {
    capturedAt = new Date(cvPhoto.datephoto);
    if (isNaN(capturedAt.getTime())) {
      capturedAt = new Date();
    }
  }

  // Build CareVision file path reference
  const careVisionPath = cvPhoto.cheminphoto
    ? `${cvPhoto.cheminphoto}/${cvPhoto.nomfichier || ''}`
    : cvPhoto.nomfichier || '';

  // Build DeviceImage document
  return {
    imageId: `CV-PHOTO-${cvId}`,

    // Device reference (legacy device)
    device: legacyDevice._id,
    deviceType: 'fundus-camera',

    // Patient and clinic
    patient: patient._id,
    clinic: clinic._id,

    // Image metadata
    imageType: imageType,
    eye: eye,
    capturedAt: capturedAt,

    // File information
    file: {
      originalName: cvPhoto.nomfichier || `photo_${cvId}`,
      fileName: cvPhoto.nomfichier || `CV-PHOTO-${cvId}`,
      path: careVisionPath,
      size: parseInt(cvPhoto.taille) || 0,
      mimeType: fileFormat.mimeType,
      format: fileFormat.format
    },

    // Processing status
    processing: {
      status: 'completed',
      uploadedAt: cvPhoto.datecreation || capturedAt,
      processedAt: cvPhoto.datecreation || capturedAt,
      thumbnailGenerated: false,
      dicomParsed: fileFormat.format === 'DICOM',
      metadataExtracted: true
    },

    // Validation
    validation: {
      status: 'validated'
    },

    // Storage
    storage: {
      location: 'local',
      archived: false
    },

    // Source tracking
    source: 'folder-sync',
    imported: {
      at: new Date(),
      by: systemUser._id,
      from: 'CareVision Photos table'
    },

    // Notes
    notes: cvPhoto.observations ? [{
      date: capturedAt,
      note: cvPhoto.observations,
      createdBy: systemUser._id
    }] : [],

    // Custom metadata - store CareVision reference
    customMetadata: {
      careVisionId: cvId,
      careVisionPatientId: cvPatientId,
      careVisionConsultationId: cvPhoto.numconsultation || null,
      careVisionAppareil: cvPhoto.appareil || null,
      careVisionMedecin: cvPhoto.medecin || null,
      careVisionPath: careVisionPath,
      originalType: cvPhoto.typephoto || null
    },

    // Tags
    tags: ['carevision-import', 'legacy'],

    // Status
    status: 'active',

    // Audit fields
    createdBy: systemUser._id,
    createdAt: cvPhoto.datecreation || capturedAt,
    updatedAt: cvPhoto.datemodification || capturedAt,

    isDeleted: false
  };
}

/**
 * Process a batch of images
 * @param {Array} images - Array of MedFlow DeviceImage documents
 */
async function processBatch(images) {
  if (images.length === 0) return;

  if (DRY_RUN) {
    stats.created += images.length;
    return;
  }

  try {
    // Use native MongoDB driver for reliable bulk inserts
    const collection = mongoose.connection.db.collection('deviceimages');
    const result = await collection.insertMany(images, { ordered: false });
    stats.created += result.insertedCount || images.length;
  } catch (error) {
    if (error.writeErrors) {
      // Partial success - some documents inserted
      const inserted = images.length - error.writeErrors.length;
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
async function importPhotos() {
  console.log('\n' + '='.repeat(60));
  console.log('  CAREVISION PHOTOS IMPORT');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}`);
  if (startDateArg) console.log(`Start Date Filter: ${startDateArg}`);
  if (endDateArg) console.log(`End Date Filter: ${endDateArg}`);
  if (patientArg) console.log(`Patient Filter: ${patientArg}`);
  console.log('');

  stats.startTime = Date.now();

  // Test CareVision connection
  process.stdout.write('Testing CareVision database connection...');
  const connTest = await careVisionSqlClient.testConnection();
  if (!connTest.connected) {
    throw new Error(`CareVision connection failed: ${connTest.message}`);
  }
  console.log(` Connected to ${connTest.server}/${connTest.database}`);

  // Get total count from CareVision
  stats.totalInCareVision = await getPhotoCount();
  console.log(`Total photos in CareVision: ${stats.totalInCareVision.toLocaleString()}`);

  // Get clinic
  const clinic = await Clinic.findOne({ clinicId: 'TOMBALBAYE-001' });
  if (!clinic) {
    throw new Error('Tombalbaye clinic not found! Run seedClinics.js first.');
  }

  // Get system user
  const systemUser = await User.findOne({ role: 'admin' });
  if (!systemUser) {
    throw new Error('No admin user found! Create admin user first.');
  }

  console.log(`Clinic: ${clinic.name} (${clinic._id})`);
  console.log(`System User: ${systemUser.firstName} ${systemUser.lastName}`);

  // Get or create legacy device
  const legacyDevice = await getOrCreateLegacyDevice(clinic, systemUser);
  console.log(`Legacy Device: ${legacyDevice.name} (${legacyDevice._id})`);

  // Build lookup maps
  const patientMap = await buildPatientMap();
  const importedSet = await buildImportedSet();

  const context = {
    patientMap,
    importedSet,
    clinic,
    systemUser,
    legacyDevice
  };

  // Process in batches from SQL Server
  console.log('\nImporting photo metadata...');
  let offset = 0;
  let hasMore = true;
  const imageBatch = [];

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
    if (patientArg) {
      queryOptions.patientId = patientArg;
    }

    // Fetch batch from CareVision
    const { records, total } = await getPhotos(queryOptions);
    stats.fetched += records.length;

    if (records.length === 0) {
      hasMore = false;
      break;
    }

    // Transform and accumulate
    for (const cvPhoto of records) {
      const medflowImage = transformToMedFlowImage(cvPhoto, context);
      if (medflowImage) {
        // Add required MongoDB _id
        medflowImage._id = new mongoose.Types.ObjectId();
        imageBatch.push(medflowImage);
      }

      // Process batch when full
      if (imageBatch.length >= BATCH_SIZE) {
        await processBatch([...imageBatch]);
        imageBatch.length = 0;

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
  if (imageBatch.length > 0) {
    await processBatch(imageBatch);
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
  console.log('By Image Type:');
  Object.entries(stats.byType).forEach(([type, count]) => {
    if (count > 0) {
      console.log(`  ${type}: ${count.toLocaleString()}`);
    }
  });
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
    await importPhotos();

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
