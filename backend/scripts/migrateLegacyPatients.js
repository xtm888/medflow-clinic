#!/usr/bin/env node
/**
 * Legacy Patient Migration Script
 *
 * Migrates patient data from legacy hospital systems to MedFlow.
 * Supports multiple sources: folder-based, CSV exports, database dumps.
 *
 * Features:
 * - Scan mode: Discover patients from folder structure
 * - Match mode: Match to existing MedFlow patients
 * - Import mode: Create/link patients and import exams
 * - Dry-run support
 * - Resume capability
 * - Detailed logging and reporting
 *
 * Usage:
 *   node scripts/migrateLegacyPatients.js --source=/path/to/folders --device-type=nidek --dry-run
 *   node scripts/migrateLegacyPatients.js --source=/path/to/csv --format=csv --import
 *   node scripts/migrateLegacyPatients.js --status  # Show migration status
 */

const { requireNonProductionStrict } = require('./_guards');
requireNonProductionStrict('migrateLegacyPatients.js');

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs').promises;
const readline = require('readline');

// Models
const Patient = require('../models/Patient');
const LegacyMapping = require('../models/LegacyMapping');
const DeviceMeasurement = require('../models/DeviceMeasurement');

// Adapters
const AdapterFactory = require('../services/adapters/AdapterFactory');

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.slice(2).split('=');
    acc[key] = value === undefined ? true : value;
  }
  return acc;
}, {});

// Configuration
const config = {
  source: args.source || process.env.LEGACY_DATA_PATH,
  deviceType: args['device-type'] || args.deviceType || 'auto',
  format: args.format || 'folder', // folder, csv, xml, json
  dryRun: args['dry-run'] || args.dryRun || false,
  limit: parseInt(args.limit) || 0,
  skip: parseInt(args.skip) || 0,
  matchThreshold: parseFloat(args['match-threshold'] || args.matchThreshold) || 0.85,
  skipMatched: args['skip-matched'] || args.skipMatched || false,
  importExams: args['import-exams'] !== 'false',
  fastScan: args['fast-scan'] || args.fastScan || false, // Skip reading folder contents for faster scanning
  verbose: args.verbose || args.v || false,
  status: args.status || false,
  resume: args.resume || false,
  output: args.output || './migration-report.csv',
  legacySystem: args['legacy-system'] || 'folder_based'
};

// Statistics
const stats = {
  totalScanned: 0,
  matched: 0,
  created: 0,
  skipped: 0,
  errors: 0,
  examsImported: 0,
  documentsImported: 0,
  startTime: null,
  endTime: null
};

// Logging utilities
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '\x1b[36m[INFO]\x1b[0m',
    success: '\x1b[32m[SUCCESS]\x1b[0m',
    warn: '\x1b[33m[WARN]\x1b[0m',
    error: '\x1b[31m[ERROR]\x1b[0m',
    debug: '\x1b[90m[DEBUG]\x1b[0m'
  }[level] || '[INFO]';

  if (level === 'debug' && !config.verbose) return;
  console.log(`${timestamp} ${prefix} ${message}`);
}

function progressBar(current, total, width = 40) {
  const percent = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  process.stdout.write(`\r[${bar}] ${percent}% (${current}/${total})`);
}

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    log('Connected to MongoDB', 'success');
  } catch (error) {
    log(`MongoDB connection failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

/**
 * Show migration status
 */
async function showStatus() {
  const migrationStats = await LegacyMapping.getMigrationStats();

  console.log('\n=== Legacy Migration Status ===\n');
  console.log(`Total Records:     ${migrationStats.total}`);
  console.log(`Pending:           ${migrationStats.pending}`);
  console.log(`Matched:           ${migrationStats.matched}`);
  console.log(`Created:           ${migrationStats.created}`);
  console.log(`Merged:            ${migrationStats.merged}`);
  console.log(`Skipped:           ${migrationStats.skipped}`);
  console.log(`Errors:            ${migrationStats.error}`);
  console.log(`Needs Review:      ${migrationStats.needsReview}`);
  console.log(`\nCompletion Rate:   ${((migrationStats.completed / migrationStats.total) * 100 || 0).toFixed(1)}%`);

  if (migrationStats.bySystem && migrationStats.bySystem.length > 0) {
    console.log('\n--- By Legacy System ---');
    for (const sys of migrationStats.bySystem) {
      console.log(`  ${sys._id}: ${sys.count} records`);
    }
  }

  // Show recent errors
  const recentErrors = await LegacyMapping.find({ status: 'error' })
    .sort({ updatedAt: -1 })
    .limit(5)
    .select('legacyId errorDetails updatedAt');

  if (recentErrors.length > 0) {
    console.log('\n--- Recent Errors ---');
    for (const err of recentErrors) {
      console.log(`  ${err.legacyId}: ${err.errorDetails?.message || 'Unknown error'}`);
    }
  }
}

/**
 * Scan folder structure for patient data
 */
async function scanFolders(sourcePath) {
  const patients = [];

  try {
    const entries = await fs.readdir(sourcePath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const folderPath = path.join(sourcePath, entry.name);
      const patientInfo = await extractPatientFromFolder(entry.name, folderPath);

      if (patientInfo) {
        patients.push(patientInfo);
      }
    }
  } catch (error) {
    log(`Error scanning folders: ${error.message}`, 'error');
  }

  return patients;
}

/**
 * Extract patient information from folder name and contents
 * Common patterns:
 * - "LASTNAME_FIRSTNAME_DOB"
 * - "PATIENT_ID_NAME"
 * - "12345_DOE_JOHN"
 */
async function extractPatientFromFolder(folderName, folderPath) {
  const info = {
    folderId: folderName,
    folderPath: folderPath,
    source: 'folder'
  };

  // Try various naming patterns
  const patterns = [
    // Pattern: ID_LASTNAME_FIRSTNAME
    /^(\d+)_([A-Za-z]+)_([A-Za-z]+)$/,
    // Pattern: LASTNAME_FIRSTNAME_DDMMYYYY
    /^([A-Za-z]+)_([A-Za-z]+)_(\d{8})$/,
    // Pattern: LASTNAME FIRSTNAME (PATIENTID)
    /^([A-Za-z]+)\s+([A-Za-z]+)\s*\((\d+)\)$/,
    // Pattern: LASTNAME FIRSTNAME (simple space-separated) - common in Zeiss/Solix
    /^([A-Za-zÀ-ÿ'-]+)\s+([A-Za-zÀ-ÿ'-]+(?:\s+[A-Za-zÀ-ÿ'-]+)*)$/,
    // Pattern: Just ID
    /^(\d{4,})$/,
    // Pattern: NAME_ID
    /^([A-Za-z_]+)_(\d+)$/
  ];

  for (const pattern of patterns) {
    const match = folderName.match(pattern);
    if (match) {
      if (pattern === patterns[0]) {
        info.legacyId = match[1];
        info.lastName = match[2];
        info.firstName = match[3];
      } else if (pattern === patterns[1]) {
        info.lastName = match[1];
        info.firstName = match[2];
        info.dateOfBirth = parseDateString(match[3]);
      } else if (pattern === patterns[2]) {
        info.lastName = match[1];
        info.firstName = match[2];
        info.legacyId = match[3];
      } else if (pattern === patterns[3]) {
        // LASTNAME FIRSTNAME pattern
        info.lastName = match[1];
        info.firstName = match[2];
        // Use sanitized folder name as legacyId
        info.legacyId = folderName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
      } else if (pattern === patterns[4]) {
        info.legacyId = match[1];
      } else if (pattern === patterns[5]) {
        info.name = match[1].replace(/_/g, ' ');
        info.legacyId = match[2];
      }
      break;
    }
  }

  // If no pattern matched, use folder name as identifier
  if (!info.legacyId && !info.lastName) {
    info.legacyId = folderName.replace(/[^a-zA-Z0-9]/g, '_');
  }

  // Skip folder content reading if fast-scan is enabled
  if (!config.fastScan) {
    // Try to find metadata file in folder
    const metadataFiles = ['patient.json', 'info.xml', 'metadata.txt', 'patient.xml'];
    for (const metaFile of metadataFiles) {
      try {
        const metaPath = path.join(folderPath, metaFile);
        const content = await fs.readFile(metaPath, 'utf-8');
        const metadata = parseMetadataFile(content, metaFile);
        Object.assign(info, metadata);
        break;
      } catch {
        // File doesn't exist, continue
      }
    }

    // Count exam files in folder
    try {
      const files = await fs.readdir(folderPath);
      info.examFiles = files.filter(f =>
        /\.(xml|json|csv|jpg|jpeg|png|dcm|pdf)$/i.test(f)
      );
      info.examCount = info.examFiles.length;
    } catch {
      info.examFiles = [];
      info.examCount = 0;
    }
  } else {
    info.examFiles = [];
    info.examCount = 0;
  }

  return info;
}

/**
 * Parse metadata file content
 */
function parseMetadataFile(content, filename) {
  const ext = path.extname(filename).toLowerCase();
  const metadata = {};

  try {
    if (ext === '.json') {
      const data = JSON.parse(content);
      metadata.firstName = data.firstName || data.first_name || data.givenName;
      metadata.lastName = data.lastName || data.last_name || data.familyName;
      metadata.dateOfBirth = data.dateOfBirth || data.dob || data.birthDate;
      metadata.legacyId = data.patientId || data.id || data.patient_id;
      metadata.gender = data.gender || data.sex;
      metadata.phone = data.phone || data.phoneNumber;
    } else if (ext === '.xml') {
      // Simple XML parsing
      const extractTag = (tag) => {
        const match = content.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'));
        return match ? match[1].trim() : null;
      };
      metadata.firstName = extractTag('FirstName') || extractTag('GivenName');
      metadata.lastName = extractTag('LastName') || extractTag('FamilyName');
      metadata.dateOfBirth = extractTag('DateOfBirth') || extractTag('BirthDate');
      metadata.legacyId = extractTag('PatientID') || extractTag('ID');
      metadata.gender = extractTag('Gender') || extractTag('Sex');
    } else if (ext === '.txt') {
      // Key-value parsing
      const lines = content.split('\n');
      for (const line of lines) {
        const [key, value] = line.split(/[=:]\s*/).map(s => s.trim());
        if (key && value) {
          const keyLower = key.toLowerCase();
          if (keyLower.includes('first')) metadata.firstName = value;
          if (keyLower.includes('last')) metadata.lastName = value;
          if (keyLower.includes('dob') || keyLower.includes('birth')) metadata.dateOfBirth = value;
          if (keyLower.includes('id') || keyLower.includes('patient')) metadata.legacyId = value;
        }
      }
    }
  } catch (error) {
    log(`Error parsing metadata file: ${error.message}`, 'debug');
  }

  return metadata;
}

/**
 * Parse date string in various formats
 */
function parseDateString(dateStr) {
  if (!dateStr) return null;

  // Try various formats
  const formats = [
    /^(\d{2})(\d{2})(\d{4})$/, // DDMMYYYY
    /^(\d{4})(\d{2})(\d{2})$/, // YYYYMMDD
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{4})-(\d{2})-(\d{2})$/ // YYYY-MM-DD
  ];

  for (let i = 0; i < formats.length; i++) {
    const match = dateStr.match(formats[i]);
    if (match) {
      let year, month, day;
      if (i === 0) { // DDMMYYYY
        [, day, month, year] = match;
      } else if (i === 1 || i === 3) { // YYYYMMDD or YYYY-MM-DD
        [, year, month, day] = match;
      } else { // DD/MM/YYYY
        [, day, month, year] = match;
      }
      return new Date(year, month - 1, day);
    }
  }

  // Try native parsing
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Match legacy patient to existing MedFlow patient
 */
async function matchPatient(legacyPatient) {
  const matches = [];

  // Strategy 1: Exact legacy ID match
  if (legacyPatient.legacyId) {
    const exactMatch = await Patient.findOne({ legacyId: legacyPatient.legacyId });
    if (exactMatch) {
      return {
        patient: exactMatch,
        confidence: 1.0,
        method: 'exact_id'
      };
    }
  }

  // Strategy 2: Folder ID match
  if (legacyPatient.folderId) {
    const folderMatch = await Patient.findOne({ 'folderIds.folderId': legacyPatient.folderId });
    if (folderMatch) {
      return {
        patient: folderMatch,
        confidence: 1.0,
        method: 'folder_id'
      };
    }
  }

  // Strategy 3: Name + DOB exact match
  if (legacyPatient.firstName && legacyPatient.lastName && legacyPatient.dateOfBirth) {
    const nameMatch = await Patient.findOne({
      firstName: new RegExp(`^${escapeRegex(legacyPatient.firstName)}$`, 'i'),
      lastName: new RegExp(`^${escapeRegex(legacyPatient.lastName)}$`, 'i'),
      dateOfBirth: legacyPatient.dateOfBirth
    });
    if (nameMatch) {
      return {
        patient: nameMatch,
        confidence: 0.98,
        method: 'name_dob'
      };
    }
  }

  // Strategy 4: Fuzzy name match (if we have names)
  if (legacyPatient.firstName && legacyPatient.lastName) {
    const fuzzyMatches = await Patient.find({
      $or: [
        {
          firstName: new RegExp(escapeRegex(legacyPatient.firstName), 'i'),
          lastName: new RegExp(escapeRegex(legacyPatient.lastName), 'i')
        },
        {
          // Try reversed (sometimes first/last are swapped)
          firstName: new RegExp(escapeRegex(legacyPatient.lastName), 'i'),
          lastName: new RegExp(escapeRegex(legacyPatient.firstName), 'i')
        }
      ]
    }).limit(5);

    for (const match of fuzzyMatches) {
      const confidence = calculateNameSimilarity(
        `${legacyPatient.firstName} ${legacyPatient.lastName}`,
        `${match.firstName} ${match.lastName}`
      );

      // If DOB also matches, boost confidence
      let dobBoost = 0;
      if (legacyPatient.dateOfBirth && match.dateOfBirth) {
        const legacy = new Date(legacyPatient.dateOfBirth).getTime();
        const existing = new Date(match.dateOfBirth).getTime();
        if (legacy === existing) dobBoost = 0.15;
      }

      if (confidence + dobBoost >= config.matchThreshold) {
        matches.push({
          patient: match,
          confidence: Math.min(confidence + dobBoost, 0.99),
          method: 'fuzzy_name'
        });
      }
    }
  }

  // Return best match if above threshold
  if (matches.length > 0) {
    matches.sort((a, b) => b.confidence - a.confidence);
    return matches[0];
  }

  return null;
}

/**
 * Escape regex special characters
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate name similarity using Levenshtein distance
 */
function calculateNameSimilarity(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;

  // Create distance matrix
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - (distance / maxLen);
}

/**
 * Create new patient from legacy data
 */
async function createPatientFromLegacy(legacyPatient) {
  // Use placeholder values for required fields not available in legacy data
  const placeholderDOB = new Date('1900-01-01'); // Placeholder for unknown DOB
  // Generate unique placeholder phone using timestamp + random to avoid duplicates
  // Format: 999XXXXXX where X is unique digits (999 prefix indicates legacy placeholder)
  const uniqueSuffix = Date.now().toString().slice(-7);
  const randomPart = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  const placeholderPhone = `999${uniqueSuffix}${randomPart}`; // Unique numeric placeholder

  // Track which fields are placeholders for data completion workflow
  const placeholderFields = [];
  if (!legacyPatient.dateOfBirth) placeholderFields.push('dateOfBirth');
  if (!legacyPatient.gender) placeholderFields.push('gender');
  if (!legacyPatient.phone) placeholderFields.push('phoneNumber');
  if (!legacyPatient.email) placeholderFields.push('email');
  if (!legacyPatient.address) placeholderFields.push('address');
  // bloodType is always missing from legacy imports
  placeholderFields.push('bloodType');

  const patientData = {
    firstName: legacyPatient.firstName || 'Unknown',
    lastName: legacyPatient.lastName || legacyPatient.folderId || 'Unknown',
    dateOfBirth: legacyPatient.dateOfBirth || placeholderDOB,
    gender: legacyPatient.gender || 'other',
    legacyId: legacyPatient.legacyId,
    legacyPatientNumber: legacyPatient.legacyPatientNumber,
    phoneNumber: legacyPatient.phone || placeholderPhone,
    email: legacyPatient.email || '',
    address: legacyPatient.address || {},
    folderIds: [{
      deviceType: config.deviceType === 'auto' ? 'other' : config.deviceType,
      folderId: legacyPatient.folderId,
      path: legacyPatient.folderPath,
      linkedAt: new Date()
    }],
    medicalHistory: {
      notes: `Migrated from legacy system on ${new Date().toISOString()}. ${
        !legacyPatient.dateOfBirth ? 'DOB: Unknown (placeholder). ' : ''
      }${!legacyPatient.phone ? 'Phone: Unknown (placeholder).' : ''}`
    },
    status: 'active',
    // Mark as legacy import for easy identification
    isLegacyImport: true,
    // Data completeness tracking
    dataStatus: 'incomplete',
    placeholderFields: placeholderFields
  };

  // Generate patient ID using atomic counter with timestamp + random to ensure uniqueness
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  patientData.patientId = `MF${year}L${timestamp}${random}`; // L = Legacy import

  const patient = new Patient(patientData);
  await patient.save();

  return patient;
}

/**
 * Import exams from legacy folder
 */
async function importExams(patientId, folderPath, deviceType) {
  let imported = 0;

  try {
    const files = await fs.readdir(folderPath);

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const ext = path.extname(file).toLowerCase();

      // Skip non-data files
      if (!['.xml', '.json', '.csv'].includes(ext)) continue;

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const adapter = AdapterFactory.getAdapterByType(deviceType);

        let data;
        if (ext === '.xml') {
          data = adapter.parseXML ? adapter.parseXML(content) : { raw: content };
        } else if (ext === '.json') {
          data = JSON.parse(content);
        } else if (ext === '.csv') {
          data = adapter.parseCSV ? adapter.parseCSV(content) : { raw: content };
        }

        if (data) {
          data.source = 'legacy-migration';
          data.sourceFile = filePath;

          if (!config.dryRun) {
            const result = await adapter.process(data, patientId, null);
            if (result.success) {
              imported++;
            }
          } else {
            imported++; // Count would-be imports in dry run
          }
        }
      } catch (error) {
        log(`Error importing ${file}: ${error.message}`, 'debug');
      }
    }
  } catch (error) {
    log(`Error reading exam folder: ${error.message}`, 'debug');
  }

  return imported;
}

/**
 * Process single legacy patient
 */
async function processLegacyPatient(legacyPatient, index, total) {
  try {
    // Check if already processed (for resume)
    if (config.resume) {
      const existing = await LegacyMapping.findOne({
        legacyId: legacyPatient.legacyId || legacyPatient.folderId,
        legacySystem: config.legacySystem
      });

      if (existing && ['matched', 'created', 'merged', 'skipped'].includes(existing.status)) {
        stats.skipped++;
        return { action: 'skipped', reason: 'already_processed' };
      }
    }

    // Try to match to existing patient
    const match = await matchPatient(legacyPatient);

    let patient;
    let action;
    let matchMethod = null;
    let matchConfidence = 0;

    if (match && match.confidence >= config.matchThreshold) {
      // Found a match
      patient = match.patient;
      action = 'matched';
      matchMethod = match.method;
      matchConfidence = match.confidence;

      // Link folder if not already linked
      if (!config.dryRun && legacyPatient.folderId) {
        const hasFolder = patient.folderIds?.some(f => f.folderId === legacyPatient.folderId);
        if (!hasFolder) {
          await Patient.findByIdAndUpdate(patient._id, {
            $push: {
              folderIds: {
                deviceType: config.deviceType === 'auto' ? 'other' : config.deviceType,
                folderId: legacyPatient.folderId,
                path: legacyPatient.folderPath,
                linkedAt: new Date()
              }
            },
            $set: {
              legacyId: legacyPatient.legacyId || patient.legacyId
            }
          });
        }
      }

      stats.matched++;
    } else if (match && match.confidence >= 0.5) {
      // Possible match - needs review
      action = 'needs_review';
      matchMethod = match.method;
      matchConfidence = match.confidence;
      patient = match.patient;
    } else {
      // No match - create new patient
      if (!config.dryRun) {
        patient = await createPatientFromLegacy(legacyPatient);
      }
      action = 'created';
      stats.created++;
    }

    // Import exams if enabled
    let examsImported = 0;
    if (config.importExams && legacyPatient.folderPath && patient) {
      examsImported = await importExams(
        patient._id,
        legacyPatient.folderPath,
        config.deviceType
      );
      stats.examsImported += examsImported;
    }

    // Create/update LegacyMapping record
    if (!config.dryRun) {
      await LegacyMapping.findOneAndUpdate(
        {
          legacyId: legacyPatient.legacyId || legacyPatient.folderId,
          legacySystem: config.legacySystem
        },
        {
          medflowPatientId: patient?._id,
          status: action === 'needs_review' ? 'pending' : action,
          matchConfidence: matchConfidence,
          matchMethod: matchMethod,
          importedData: {
            demographics: {
              firstName: legacyPatient.firstName,
              lastName: legacyPatient.lastName,
              dateOfBirth: legacyPatient.dateOfBirth,
              gender: legacyPatient.gender
            },
            source: legacyPatient.source,
            folderPath: legacyPatient.folderPath,
            examCount: legacyPatient.examCount
          },
          importStats: {
            examsImported: examsImported,
            documentsImported: 0
          },
          needsReview: action === 'needs_review',
          reviewReason: action === 'needs_review' ? `Low confidence match (${(matchConfidence * 100).toFixed(1)}%)` : null,
          migratedAt: new Date()
        },
        { upsert: true, new: true }
      );
    }

    log(`[${index + 1}/${total}] ${legacyPatient.folderId || legacyPatient.legacyId}: ${action} (${(matchConfidence * 100).toFixed(0)}% confidence)`,
      action === 'needs_review' ? 'warn' : 'info');

    return { action, patient, matchConfidence, examsImported };

  } catch (error) {
    stats.errors++;
    log(`Error processing ${legacyPatient.folderId || legacyPatient.legacyId}: ${error.message}`, 'error');

    // Record error
    if (!config.dryRun) {
      await LegacyMapping.markError(
        legacyPatient.legacyId || legacyPatient.folderId,
        config.legacySystem,
        error.message,
        { stack: error.stack }
      );
    }

    return { action: 'error', error: error.message };
  }
}

/**
 * Generate CSV report
 */
async function generateReport(results) {
  const csvLines = [
    'Legacy ID,Folder ID,Name,DOB,Action,Confidence,MedFlow Patient ID,Exams Imported,Notes'
  ];

  for (const result of results) {
    const r = result.legacyPatient;
    csvLines.push([
      r.legacyId || '',
      r.folderId || '',
      `${r.firstName || ''} ${r.lastName || ''}`.trim(),
      r.dateOfBirth ? new Date(r.dateOfBirth).toISOString().split('T')[0] : '',
      result.result.action,
      `${((result.result.matchConfidence || 0) * 100).toFixed(0)}%`,
      result.result.patient?._id || '',
      result.result.examsImported || 0,
      result.result.error || ''
    ].map(v => `"${v}"`).join(','));
  }

  await fs.writeFile(config.output, csvLines.join('\n'));
  log(`Report saved to ${config.output}`, 'success');
}

/**
 * Main migration function
 */
async function migrate() {
  stats.startTime = new Date();

  log('=== MedFlow Legacy Patient Migration ===');
  log(`Source: ${config.source}`);
  log(`Device Type: ${config.deviceType}`);
  log(`Format: ${config.format}`);
  log(`Dry Run: ${config.dryRun}`);
  log(`Match Threshold: ${config.matchThreshold * 100}%`);

  // Validate source path
  if (!config.source) {
    log('Error: Source path required. Use --source=/path/to/data', 'error');
    process.exit(1);
  }

  try {
    await fs.access(config.source);
  } catch {
    log(`Error: Source path not accessible: ${config.source}`, 'error');
    process.exit(1);
  }

  // Scan for patients
  log('\nScanning for patient data...', 'info');
  let legacyPatients = [];

  if (config.format === 'folder') {
    legacyPatients = await scanFolders(config.source);
  } else if (config.format === 'csv') {
    const content = await fs.readFile(config.source, 'utf-8');
    legacyPatients = parseCSVPatients(content);
  }

  stats.totalScanned = legacyPatients.length;
  log(`Found ${legacyPatients.length} patient records`, 'success');

  // Apply skip/limit
  if (config.skip > 0) {
    legacyPatients = legacyPatients.slice(config.skip);
  }
  if (config.limit > 0) {
    legacyPatients = legacyPatients.slice(0, config.limit);
  }

  log(`Processing ${legacyPatients.length} patients (skip: ${config.skip}, limit: ${config.limit || 'none'})`);

  // Process each patient
  const results = [];
  for (let i = 0; i < legacyPatients.length; i++) {
    const result = await processLegacyPatient(legacyPatients[i], i, legacyPatients.length);
    results.push({ legacyPatient: legacyPatients[i], result });

    // Progress update
    if (!config.verbose && (i + 1) % 10 === 0) {
      progressBar(i + 1, legacyPatients.length);
    }
  }

  if (!config.verbose) {
    console.log(); // New line after progress bar
  }

  stats.endTime = new Date();

  // Generate report
  await generateReport(results);

  // Print summary
  console.log('\n=== Migration Summary ===');
  console.log(`Total Scanned:    ${stats.totalScanned}`);
  console.log(`Matched:          ${stats.matched}`);
  console.log(`Created:          ${stats.created}`);
  console.log(`Skipped:          ${stats.skipped}`);
  console.log(`Errors:           ${stats.errors}`);
  console.log(`Exams Imported:   ${stats.examsImported}`);
  console.log(`Duration:         ${((stats.endTime - stats.startTime) / 1000).toFixed(1)}s`);

  if (config.dryRun) {
    console.log('\n*** DRY RUN - No changes were made ***');
    console.log('Run without --dry-run to perform actual migration');
  }
}

/**
 * Parse CSV patients file
 */
function parseCSVPatients(content) {
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const patients = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (values.length < headers.length) continue;

    const patient = {};
    headers.forEach((header, index) => {
      const key = {
        'patient_id': 'legacyId',
        'patientid': 'legacyId',
        'id': 'legacyId',
        'first_name': 'firstName',
        'firstname': 'firstName',
        'last_name': 'lastName',
        'lastname': 'lastName',
        'dob': 'dateOfBirth',
        'date_of_birth': 'dateOfBirth',
        'gender': 'gender',
        'sex': 'gender',
        'phone': 'phone',
        'email': 'email',
        'folder': 'folderId',
        'folder_id': 'folderId'
      }[header] || header;

      patient[key] = values[index];
    });

    if (patient.dateOfBirth) {
      patient.dateOfBirth = parseDateString(patient.dateOfBirth);
    }

    patients.push(patient);
  }

  return patients;
}

// Main execution
async function main() {
  await connectDB();

  if (config.status) {
    await showStatus();
  } else {
    await migrate();
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  console.error(error.stack);
  process.exit(1);
});
