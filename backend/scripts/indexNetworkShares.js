/**
 * Network Share Indexing Script
 *
 * Scans network share directories for ophthalmology images (OCT, Refraction, Retina, Fundus)
 * and creates/updates ImagingStudy records in MongoDB.
 *
 * Usage:
 *   node scripts/indexNetworkShares.js                    # Full scan of configured shares
 *   node scripts/indexNetworkShares.js --path=/tmp/mount  # Scan specific path
 *   node scripts/indexNetworkShares.js --dry-run          # Preview without saving
 *   node scripts/indexNetworkShares.js --patient=123456   # Only for specific patient ID pattern
 *
 * Expected directory structure:
 *   /share/OCT/PatientID_YYYYMMDD_001.jpg
 *   /share/Refraction/PatientID_YYYYMMDD_001.png
 *   /share/Retina/PatientID_YYYYMMDD_001.tiff
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ImagingStudy = require('../models/ImagingStudy');
const Patient = require('../models/Patient');
const Device = require('../models/Device');

// Configuration - Update these for your network shares
// Each clinic can have multiple device shares
const NETWORK_SHARES = [
  // ========== CLINIC 1 (Main) ==========
  {
    path: '/tmp/zeiss_mount',
    name: 'Zeiss RETINO',
    modality: 'OCT',
    clinicId: 'clinic_main',
    clinicName: 'Clinique Principale',
    devicePattern: /zeiss/i
  },
  {
    path: '/tmp/solix_mount',
    name: 'Solix OCT',
    modality: 'OCT',
    clinicId: 'clinic_main',
    clinicName: 'Clinique Principale',
    devicePattern: /solix/i
  },
  // ========== CLINIC 2 ==========
  {
    path: '/mnt/clinic2/oct',
    name: 'Clinic 2 OCT',
    modality: 'OCT',
    clinicId: 'clinic_2',
    clinicName: 'Clinique 2',
    devicePattern: /oct/i
  },
  {
    path: '/mnt/clinic2/refraction',
    name: 'Clinic 2 Refraction',
    modality: 'Refraction',
    clinicId: 'clinic_2',
    clinicName: 'Clinique 2',
    devicePattern: /refract/i
  },
  // ========== CLINIC 3 ==========
  {
    path: '/mnt/clinic3/imaging',
    name: 'Clinic 3 Imaging',
    modality: 'OCT',
    clinicId: 'clinic_3',
    clinicName: 'Clinique 3',
    devicePattern: /imaging/i
  }
];

// Allowed image extensions
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.gif', '.webp', '.dcm'];

// Filename patterns to extract patient info
// Adjust these patterns based on your actual file naming conventions
const FILENAME_PATTERNS = [
  // Pattern: PatientID_YYYYMMDD_sequence.ext
  /^([A-Z0-9]+)_(\d{8})_(\d+)\.(jpg|jpeg|png|tiff|tif|bmp|dcm)$/i,
  // Pattern: PatientID-YYYYMMDD-sequence.ext
  /^([A-Z0-9]+)-(\d{8})-(\d+)\.(jpg|jpeg|png|tiff|tif|bmp|dcm)$/i,
  // Pattern: YYYYMMDD_PatientID_sequence.ext
  /^(\d{8})_([A-Z0-9]+)_(\d+)\.(jpg|jpeg|png|tiff|tif|bmp|dcm)$/i,
  // Pattern: PatientLastName_PatientFirstName_YYYYMMDD.ext
  /^([A-Z]+)_([A-Z]+)_(\d{8})\.(jpg|jpeg|png|tiff|tif|bmp|dcm)$/i
];

// Stats tracking
const stats = {
  scanned: 0,
  matched: 0,
  created: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
  patientsFound: 0,
  patientsMissing: 0
};

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const customPath = args.find(a => a.startsWith('--path='))?.split('=')[1];
const patientFilter = args.find(a => a.startsWith('--patient='))?.split('=')[1];
const verbose = args.includes('--verbose');

async function indexNetworkShares() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     NETWORK SHARE IMAGING INDEXER                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Connect to MongoDB
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
  console.log('✓ Connected to MongoDB\n');

  // Determine which shares to scan
  const sharesToScan = customPath
    ? [{ path: customPath, name: 'Custom', modality: 'Unknown' }]
    : NETWORK_SHARES;

  // Pre-load devices for matching
  const devices = await Device.find({}).lean();
  console.log(`Loaded ${devices.length} devices for matching\n`);

  for (const share of sharesToScan) {
    console.log(`\n━━━ Scanning: ${share.name} (${share.path}) ━━━\n`);

    if (!fs.existsSync(share.path)) {
      console.log(`  ⚠️  Path not found: ${share.path}`);
      continue;
    }

    await scanDirectory(share.path, share, devices, 0);
  }

  // Print summary
  printSummary();

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB');
}

async function scanDirectory(directory, share, devices, depth) {
  if (depth > 10) return; // Prevent infinite recursion

  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (err) {
    console.log(`  ⚠️  Cannot read directory: ${directory}`);
    stats.errors++;
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      // Recurse into subdirectories
      await scanDirectory(fullPath, share, devices, depth + 1);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();

      if (ALLOWED_EXTENSIONS.includes(ext)) {
        stats.scanned++;
        await processImageFile(fullPath, entry.name, share, devices);
      }
    }
  }
}

async function processImageFile(filePath, filename, share, devices) {
  // Try to match filename to known patterns
  let patientIdentifier = null;
  let examDate = null;
  let sequence = null;

  for (const pattern of FILENAME_PATTERNS) {
    const match = filename.match(pattern);
    if (match) {
      // Different patterns have different group orders
      if (pattern.source.startsWith('^([A-Z0-9]+)_')) {
        patientIdentifier = match[1];
        examDate = parseDate(match[2]);
        sequence = match[3];
      } else if (pattern.source.startsWith('^(\\d{8})_')) {
        examDate = parseDate(match[1]);
        patientIdentifier = match[2];
        sequence = match[3];
      } else if (pattern.source.includes('_([A-Z]+)_([A-Z]+)_')) {
        // LastName_FirstName format
        patientIdentifier = `${match[1]}_${match[2]}`;
        examDate = parseDate(match[3]);
      }
      stats.matched++;
      break;
    }
  }

  // Apply patient filter if specified
  if (patientFilter && patientIdentifier) {
    if (!patientIdentifier.includes(patientFilter)) {
      stats.skipped++;
      return;
    }
  }

  if (!patientIdentifier && !examDate) {
    // Try to extract from directory structure
    const pathParts = filePath.split(path.sep);
    // Look for patient ID in parent directories
    for (const part of pathParts) {
      if (/^[A-Z]{2,3}\d{4,}$/i.test(part)) {
        patientIdentifier = part;
        break;
      }
    }
  }

  if (verbose) {
    console.log(`  File: ${filename}`);
    console.log(`    Patient: ${patientIdentifier || 'Unknown'}`);
    console.log(`    Date: ${examDate || 'Unknown'}`);
  }

  // Try to find patient in database
  let patient = null;
  if (patientIdentifier) {
    // Try exact patientId match first
    patient = await Patient.findOne({ patientId: patientIdentifier }).lean();

    // Try name-based search if pattern is LastName_FirstName
    if (!patient && patientIdentifier.includes('_')) {
      const [lastName, firstName] = patientIdentifier.split('_');
      patient = await Patient.findOne({
        lastName: { $regex: new RegExp(`^${lastName}$`, 'i') },
        firstName: { $regex: new RegExp(`^${firstName}$`, 'i') }
      }).lean();
    }
  }

  if (patient) {
    stats.patientsFound++;
  } else {
    stats.patientsMissing++;
    if (verbose) {
      console.log(`    ⚠️  No patient match found`);
    }
  }

  // Get file stats
  const fileStat = fs.statSync(filePath);

  // Get image dimensions if possible
  let dimensions = { width: null, height: null };
  try {
    const metadata = await sharp(filePath).metadata();
    dimensions.width = metadata.width;
    dimensions.height = metadata.height;
  } catch (e) {
    // Ignore - not all files are readable by sharp
  }

  // Find matching device
  const matchingDevice = devices.find(d =>
    share.devicePattern?.test(d.deviceName) ||
    share.devicePattern?.test(d.manufacturer)
  );

  if (dryRun) {
    console.log(`  [DRY] Would create study for: ${filename}`);
    console.log(`         Patient: ${patient?.patientId || patientIdentifier || 'Unknown'}`);
    console.log(`         Modality: ${share.modality}`);
    return;
  }

  // Create or update imaging study
  try {
    // Check if study already exists for this file
    const existingStudy = await ImagingStudy.findOne({
      'images.url': filePath
    });

    if (existingStudy) {
      stats.updated++;
      if (verbose) {
        console.log(`    ✓ Study already exists (${existingStudy.studyId})`);
      }
      return;
    }

    // Create new study
    const studyData = {
      patient: patient?._id,
      modality: share.modality,
      studyDate: examDate || fileStat.mtime,
      description: `${share.modality} - ${filename}`,
      numberOfImages: 1,
      images: [{
        url: filePath,
        description: filename,
        acquisitionDate: examDate || fileStat.mtime,
        rows: dimensions.height,
        columns: dimensions.width
      }],
      storage: {
        location: share.name,
        size: fileStat.size,
        archiveStatus: 'online',
        // Multi-clinic support
        clinicId: share.clinicId,
        clinicName: share.clinicName,
        networkPath: share.path
      },
      equipment: matchingDevice?._id,
      equipmentInfo: matchingDevice ? {
        manufacturer: matchingDevice.manufacturer,
        model: matchingDevice.model,
        stationName: matchingDevice.deviceName
      } : undefined,
      status: 'acquired',
      notes: `Indexed from network share: ${share.path} (${share.clinicName || 'Unknown Clinic'})`
    };

    const study = await ImagingStudy.create(studyData);
    stats.created++;

    if (verbose) {
      console.log(`    ✓ Created study: ${study.studyId}`);
    }
  } catch (err) {
    console.error(`    ✗ Error creating study: ${err.message}`);
    stats.errors++;
  }
}

function parseDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return null;

  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1;
  const day = parseInt(dateStr.substring(6, 8));

  const date = new Date(year, month, day);

  // Validate date
  if (isNaN(date.getTime()) || year < 2000 || year > 2100) {
    return null;
  }

  return date;
}

function printSummary() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    INDEXING SUMMARY                           ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Files scanned:          ${String(stats.scanned).padStart(10)}                    ║`);
  console.log(`║  Filename patterns matched: ${String(stats.matched).padStart(7)}                    ║`);
  console.log(`║  Studies created:        ${String(stats.created).padStart(10)}                    ║`);
  console.log(`║  Studies updated:        ${String(stats.updated).padStart(10)}                    ║`);
  console.log(`║  Files skipped:          ${String(stats.skipped).padStart(10)}                    ║`);
  console.log(`║  Errors:                 ${String(stats.errors).padStart(10)}                    ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Patients matched:       ${String(stats.patientsFound).padStart(10)}                    ║`);
  console.log(`║  Patients not found:     ${String(stats.patientsMissing).padStart(10)}                    ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (dryRun) {
    console.log('\n👉 Run without --dry-run to apply changes\n');
  } else {
    console.log('\n✅ Indexing completed!\n');
  }
}

// Run the indexer
indexNetworkShares().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
