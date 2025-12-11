/**
 * Legacy Patient ID Mapper Service
 *
 * Maps legacy DMI patient folder IDs (e.g., 10001A01) to MedFlow patient records.
 * This allows seamless integration of archived patient files with the new system.
 *
 * DMI ID Format: {number}{letter}{sequence}
 * Example: 10001A01, 10002C01, etc.
 */

const mongoose = require('mongoose');
const Patient = require('../models/Patient');

// Cache for performance
const idCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Parse a DMI patient ID into its components
 * @param {string} dmiId - Legacy ID like "10001A01"
 * @returns {object} Parsed components
 */
function parseDmiId(dmiId) {
  // Pattern: {number}{letter}{sequence}
  const match = dmiId.match(/^(\d+)([A-Z])(\d+)$/);
  if (!match) return null;

  return {
    number: parseInt(match[1]),
    letter: match[2],
    sequence: parseInt(match[3]),
    full: dmiId
  };
}

/**
 * Find a MedFlow patient by their legacy DMI ID
 * @param {string} dmiId - Legacy DMI ID
 * @returns {Promise<object|null>} Patient document or null
 */
async function findPatientByDmiId(dmiId) {
  // Check cache first
  const cached = idCache.get(dmiId);
  if (cached && cached.timestamp > Date.now() - CACHE_TTL) {
    return cached.patient;
  }

  // Search in Patient model - check legacyId field
  let patient = await Patient.findOne({
    $or: [
      { 'legacyIds.dmi': dmiId },
      { 'legacyIds.dmi': dmiId.toUpperCase() },
      { externalId: dmiId },
      { patientId: dmiId }
    ]
  }).lean();

  // Cache result
  idCache.set(dmiId, {
    patient,
    timestamp: Date.now()
  });

  return patient;
}

/**
 * Create or update a patient mapping
 * @param {string} dmiId - Legacy DMI ID
 * @param {string} medflowPatientId - MedFlow Patient _id
 */
async function createMapping(dmiId, medflowPatientId) {
  const patient = await Patient.findById(medflowPatientId);
  if (!patient) {
    throw new Error(`Patient not found: ${medflowPatientId}`);
  }

  // Add legacy ID to patient record
  if (!patient.legacyIds) {
    patient.legacyIds = {};
  }
  patient.legacyIds.dmi = dmiId;

  await patient.save();

  // Invalidate cache
  idCache.delete(dmiId);

  return patient;
}

/**
 * Bulk import patient mappings from a CSV or legacy database export
 * @param {Array} mappings - Array of {dmiId, firstName, lastName, dateOfBirth}
 * @returns {object} Import statistics
 */
async function bulkImportMappings(mappings) {
  const stats = {
    total: mappings.length,
    matched: 0,
    created: 0,
    failed: 0,
    errors: []
  };

  for (const mapping of mappings) {
    try {
      const { dmiId, firstName, lastName, dateOfBirth, phone } = mapping;

      // Try to find existing patient
      let patient = await findPatientByDmiId(dmiId);

      if (!patient && firstName && lastName) {
        // Try to match by name and DOB
        const query = {
          firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
          lastName: { $regex: new RegExp(`^${lastName}$`, 'i') }
        };

        if (dateOfBirth) {
          query.dateOfBirth = new Date(dateOfBirth);
        }

        patient = await Patient.findOne(query).lean();
      }

      if (patient) {
        // Update existing patient with legacy ID
        await Patient.findByIdAndUpdate(patient._id, {
          $set: { 'legacyIds.dmi': dmiId }
        });
        stats.matched++;
      } else if (firstName && lastName) {
        // Create new patient
        const newPatient = await Patient.create({
          firstName: firstName.toUpperCase(),
          lastName: lastName.toUpperCase(),
          dateOfBirth,
          phone,
          legacyIds: { dmi: dmiId },
          source: 'legacy_import'
        });
        stats.created++;
      } else {
        stats.failed++;
        stats.errors.push({ dmiId, reason: 'Insufficient data to create patient' });
      }
    } catch (err) {
      stats.failed++;
      stats.errors.push({ dmiId: mapping.dmiId, reason: err.message });
    }
  }

  return stats;
}

/**
 * Extract patient info from folder name (if naming convention includes name)
 * Example: "APPROBATION RETINO C MAMENI IKEMBI MAMIE.jpg"
 */
function extractPatientFromFilename(filename) {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');

  // Common patterns in filenames
  const patterns = [
    // "LASTNAME FIRSTNAME.ext"
    /^([A-Z]+)\s+([A-Z]+(?:\s+[A-Z]+)?)$/i,
    // "APPROBATION ... LASTNAME FIRSTNAME MIDDLENAME"
    /APPROBATION.*?([A-Z]+)\s+([A-Z]+(?:\s+[A-Z]+)?)\s*$/i,
    // General name pattern
    /([A-Z]{2,})\s+([A-Z]{2,}(?:\s+[A-Z]{2,})?)/i
  ];

  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern);
    if (match) {
      return {
        lastName: match[1].trim().toUpperCase(),
        firstName: match[2].trim().toUpperCase()
      };
    }
  }

  return null;
}

/**
 * Scan a patient folder and create mapping
 * @param {string} dmiId - Folder name (DMI ID)
 * @param {Array<string>} files - List of files in folder
 */
async function scanAndMapFolder(dmiId, files) {
  // Check if already mapped
  const existing = await findPatientByDmiId(dmiId);
  if (existing) {
    return { status: 'exists', patient: existing };
  }

  // Try to extract patient name from files
  let patientInfo = null;

  for (const file of files) {
    patientInfo = extractPatientFromFilename(file);
    if (patientInfo) break;
  }

  if (patientInfo) {
    // Try to match with existing patient
    const patient = await Patient.findOne({
      firstName: patientInfo.firstName,
      lastName: patientInfo.lastName
    });

    if (patient) {
      await createMapping(dmiId, patient._id);
      return { status: 'matched', patient };
    }

    // Return info for manual creation
    return {
      status: 'pending',
      suggestedPatient: patientInfo,
      dmiId
    };
  }

  return { status: 'unknown', dmiId };
}

/**
 * Get files for a patient using legacy ID
 * @param {string} dmiId - Legacy DMI ID
 * @param {string} basePath - Base SMB path
 */
async function getPatientFiles(dmiId, basePath = '//serverlv/Archives/ArchivesPatients') {
  const patient = await findPatientByDmiId(dmiId);

  return {
    dmiId,
    patient,
    archivePath: `${basePath}/${dmiId}/`,
    isMapped: !!patient
  };
}

/**
 * Clear the ID cache
 */
function clearCache() {
  idCache.clear();
}

module.exports = {
  parseDmiId,
  findPatientByDmiId,
  createMapping,
  bulkImportMappings,
  extractPatientFromFilename,
  scanAndMapFolder,
  getPatientFiles,
  clearCache
};
