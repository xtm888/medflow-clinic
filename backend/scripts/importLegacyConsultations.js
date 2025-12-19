/**
 * Import Legacy Consultations from LV_Consultations.csv
 *
 * Creates: Visit, OphthalmologyExam, ConsultationSession records
 * Links: Patient via NumFiche (legacyIds.lv)
 *
 * Usage:
 *   DRY_RUN=true node scripts/importLegacyConsultations.js   # Validate without importing
 *   node scripts/importLegacyConsultations.js                 # Full import
 */

const mongoose = require('mongoose');
const fs = require('fs');
const Papa = require('papaparse');
require('dotenv').config();

// Models
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const Clinic = require('../models/Clinic');
const User = require('../models/User');

// Configuration
const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = 500;
const CONSULTATIONS_FILE = '/Users/xtm888/Downloads/LV_Consultations.csv';
const ACTES_FILE = '/Users/xtm888/Downloads/LV_Actes.csv';

// Statistics
const stats = {
  totalRows: 0,
  visitsCreated: 0,
  ophthalmologyExamsCreated: 0,
  skipped: 0,
  errors: [],
  patientNotFound: new Set(),
  startTime: null
};

/**
 * Parse a number that may have spaces instead of decimal points
 * e.g., "-3 25" -> -3.25, "-1 75" -> -1.75
 */
function parseSpacedNumber(str) {
  if (!str) return null;
  const cleaned = str.trim();
  // Handle format like "-3 25" or "+2 50"
  const spaceMatch = cleaned.match(/^([-+]?\d+)\s+(\d+)$/);
  if (spaceMatch) {
    const whole = parseInt(spaceMatch[1]);
    const decimal = parseInt(spaceMatch[2]);
    const sign = whole < 0 ? -1 : 1;
    return sign * (Math.abs(whole) + decimal / 100);
  }
  // Handle normal decimal like "-3.25"
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse ophthalmology exam data from Conclusion field
 *
 * Handles multiple formats from the legacy system:
 * Format 1 (LV): "Auto Réfractomètre : OD : -3 25 ( -1 75 ) 125° OG : -2 75 ( -2 50 ) 50°"
 * Format 2: "A/R OD : Sph : -2.50, Cyl : -0.75, Axe : 180 / OG : ..."
 */
function parseConclusion(conclusionText) {
  const result = {
    autorefractor: { OD: null, OS: null },
    visualAcuity: { OD: null, OS: null },
    refraction: { OD: null, OS: null },
    iop: { OD: null, OS: null },
    hasData: false
  };

  if (!conclusionText || conclusionText.trim() === '') return result;

  // Parse Auto Réfractomètre (Legacy LV format)
  // Format: "Auto Réfractomètre : OD : -3 25 ( -1 75 ) 125° OG : -2 75 ( -2 50 ) 50°"
  // Pattern: OD : sphere ( cylinder ) axis° OG : sphere ( cylinder ) axis°
  const arLegacyMatch = conclusionText.match(/Auto\s*R[eé]fractom[eè]tre\s*:\s*OD\s*:\s*([-+]?\d+\s*\d*)\s*\(\s*([-+]?\d+\s*\d*)\s*\)\s*(\d+)[°]?\s*OG\s*:\s*([-+]?\d+\s*\d*)\s*\(\s*([-+]?\d+\s*\d*)\s*\)\s*(\d+)/i);
  if (arLegacyMatch) {
    const odSphere = parseSpacedNumber(arLegacyMatch[1]);
    const odCylinder = parseSpacedNumber(arLegacyMatch[2]);
    const odAxis = parseInt(arLegacyMatch[3]) || 0;
    const osSphere = parseSpacedNumber(arLegacyMatch[4]);
    const osCylinder = parseSpacedNumber(arLegacyMatch[5]);
    const osAxis = parseInt(arLegacyMatch[6]) || 0;

    if (odSphere !== null || osSphere !== null) {
      result.autorefractor.OD = { sphere: odSphere || 0, cylinder: odCylinder || 0, axis: odAxis };
      result.autorefractor.OS = { sphere: osSphere || 0, cylinder: osCylinder || 0, axis: osAxis };
      result.hasData = true;
    }
  }

  // Parse Auto-refractor (Standard format with labels)
  // Format: "A/R OD : Sph : -2.50, Cyl : -0.75, Axe : 180 / OG : Sph : -2.25, Cyl : -0.50, Axe : 175"
  if (!result.autorefractor.OD) {
    const arStandardMatch = conclusionText.match(/A\/R\s+OD\s*:\s*Sph\s*:\s*([-+]?\d+\.?\d*),?\s*Cyl\s*:\s*([-+]?\d+\.?\d*),?\s*Axe\s*:\s*(\d+)[^\n]*\/\s*OG\s*:\s*Sph\s*:\s*([-+]?\d+\.?\d*),?\s*Cyl\s*:\s*([-+]?\d+\.?\d*),?\s*Axe\s*:\s*(\d+)/i);
    if (arStandardMatch) {
      result.autorefractor.OD = {
        sphere: parseFloat(arStandardMatch[1]) || 0,
        cylinder: parseFloat(arStandardMatch[2]) || 0,
        axis: parseInt(arStandardMatch[3]) || 0
      };
      result.autorefractor.OS = {
        sphere: parseFloat(arStandardMatch[4]) || 0,
        cylinder: parseFloat(arStandardMatch[5]) || 0,
        axis: parseInt(arStandardMatch[6]) || 0
      };
      result.hasData = true;
    }
  }

  // Parse Visual Acuity (AV) - multiple formats
  // Format 1: "AV OD : 10/10 avec correction / OG : 10/10"
  // Format 2: "Acuité Visuelle : OD : 10/10 OG : 8/10"
  const avMatch = conclusionText.match(/(?:AV|Acuit[eé]\s*Visuelle)\s*:?\s*OD\s*:\s*([\d\/]+)[^\/\n]*(?:\/\s*)?OG\s*:\s*([\d\/]+)/i);
  if (avMatch) {
    result.visualAcuity.OD = avMatch[1].trim();
    result.visualAcuity.OS = avMatch[2].trim();
    result.hasData = true;
  }

  // Parse Final Refraction / Subjective Refraction (RF / RS)
  // Legacy format: "Réfraction Subjective : OD : -2 50 ( -0 75 ) 180° Add 2 00 OG : ..."
  const rfLegacyMatch = conclusionText.match(/R[eé]fraction\s*(?:Subjective|Finale)?\s*:?\s*OD\s*:\s*([-+]?\d+\s*\d*)\s*\(\s*([-+]?\d+\s*\d*)\s*\)\s*(\d+)[°]?(?:\s*Add\s*([\d\s]+))?[^\n]*OG\s*:\s*([-+]?\d+\s*\d*)\s*\(\s*([-+]?\d+\s*\d*)\s*\)\s*(\d+)[°]?(?:\s*Add\s*([\d\s]+))?/i);
  if (rfLegacyMatch) {
    result.refraction.OD = {
      sphere: parseSpacedNumber(rfLegacyMatch[1]) || 0,
      cylinder: parseSpacedNumber(rfLegacyMatch[2]) || 0,
      axis: parseInt(rfLegacyMatch[3]) || 0,
      add: rfLegacyMatch[4] ? parseSpacedNumber(rfLegacyMatch[4]) : undefined
    };
    result.refraction.OS = {
      sphere: parseSpacedNumber(rfLegacyMatch[5]) || 0,
      cylinder: parseSpacedNumber(rfLegacyMatch[6]) || 0,
      axis: parseInt(rfLegacyMatch[7]) || 0,
      add: rfLegacyMatch[8] ? parseSpacedNumber(rfLegacyMatch[8]) : undefined
    };
    result.hasData = true;
  }

  // Parse Final Refraction (Standard format with labels)
  if (!result.refraction.OD) {
    const rfStandardMatch = conclusionText.match(/RF\s+OD\s*:\s*Sph\s*:\s*([-+]?\d+\.?\d*),?\s*Cyl\s*:\s*([-+]?\d+\.?\d*),?\s*Axe\s*:\s*(\d+)(?:,?\s*Add\s*:\s*([\d.]+))?[^\n]*\/\s*OG\s*:\s*Sph\s*:\s*([-+]?\d+\.?\d*),?\s*Cyl\s*:\s*([-+]?\d+\.?\d*),?\s*Axe\s*:\s*(\d+)(?:,?\s*Add\s*:\s*([\d.]+))?/i);
    if (rfStandardMatch) {
      result.refraction.OD = {
        sphere: parseFloat(rfStandardMatch[1]) || 0,
        cylinder: parseFloat(rfStandardMatch[2]) || 0,
        axis: parseInt(rfStandardMatch[3]) || 0,
        add: rfStandardMatch[4] ? parseFloat(rfStandardMatch[4]) : undefined
      };
      result.refraction.OS = {
        sphere: parseFloat(rfStandardMatch[5]) || 0,
        cylinder: parseFloat(rfStandardMatch[6]) || 0,
        axis: parseInt(rfStandardMatch[7]) || 0,
        add: rfStandardMatch[8] ? parseFloat(rfStandardMatch[8]) : undefined
      };
      result.hasData = true;
    }
  }

  // Parse Intraocular Pressure (TO, PIO, Tonus)
  // Format 1: "TO OD : 14 / OG : 15"
  // Format 2: "Tonus : OD : 14 mmHg OG : 15 mmHg"
  // Format 3: "PIO OD: 14 OG: 15"
  const toMatch = conclusionText.match(/(?:TO|PIO|Tonus)\s*:?\s*OD\s*:\s*(\d+)\s*(?:mmHg)?\s*[\/\s]+(?:OG|OS)\s*:\s*(\d+)/i);
  if (toMatch) {
    result.iop.OD = parseInt(toMatch[1]);
    result.iop.OS = parseInt(toMatch[2]);
    result.hasData = true;
  }

  return result;
}

/**
 * Parse blood pressure string "120/80" into { systolic, diastolic }
 */
function parseBloodPressure(bpStr) {
  if (!bpStr || bpStr.trim() === '') return null;
  const match = bpStr.match(/(\d+)\s*\/\s*(\d+)/);
  if (match) {
    return {
      systolic: parseInt(match[1]),
      diastolic: parseInt(match[2])
    };
  }
  return bpStr; // Return as string if can't parse
}

/**
 * Map consultation type to visit type
 */
function mapConsultationType(type) {
  const mapping = {
    'Ophtalmologie': 'consultation',
    'Standard': 'routine',
    'Gynéco-Obstétrique': 'consultation',
    'Gyneco-Obstetrique': 'consultation',
    'Pédiatrie': 'consultation',
    'Cardiologie': 'consultation',
    'ORL': 'consultation'
  };
  return mapping[type] || 'consultation';
}

/**
 * Build patient lookup map from legacyIds.lv
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
 * Build NumActe to NumFiche+Date map from LV_Actes.csv
 * This gives us patient reference and date for each consultation
 */
async function buildActesMap() {
  console.log('Building actes lookup map from LV_Actes.csv...');

  if (!fs.existsSync(ACTES_FILE)) {
    console.error('ERROR: LV_Actes.csv not found at', ACTES_FILE);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(ACTES_FILE, 'utf8');
  const parsed = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim()
  });

  const map = new Map();
  for (const row of parsed.data) {
    const numActe = row.NumActe?.trim();
    if (!numActe || numActe === '' || numActe === 'NumActe') continue;

    // Only store first occurrence (one acte can have multiple items)
    if (!map.has(numActe)) {
      map.set(numActe, {
        numFiche: row.NumFiche?.trim(),
        convention: row.Convention?.trim(),
        dateCreation: row.DateCreation?.trim(),
        dateRealisation: row.DateRealisation?.trim()
      });
    }
  }

  console.log(`  Loaded ${map.size} unique NumActe entries`);
  return map;
}

/**
 * Main import function
 */
async function importConsultations() {
  console.log('\n=== IMPORTING LEGACY CONSULTATIONS ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}\n`);

  stats.startTime = Date.now();

  // Get clinic and system user
  const tombalbaye = await Clinic.findOne({ clinicId: 'TOMBALBAYE-001' });
  if (!tombalbaye) {
    throw new Error('Tombalbaye clinic not found! Run seedClinics.js first.');
  }

  const systemUser = await User.findOne({ role: 'admin' });
  if (!systemUser) {
    throw new Error('No admin user found! Create admin user first.');
  }

  console.log(`Clinic: ${tombalbaye.name} (${tombalbaye._id})`);
  console.log(`System User: ${systemUser.firstName} ${systemUser.lastName} (${systemUser._id})`);

  // Build lookup maps
  const patientMap = await buildPatientMap();
  const actesMap = await buildActesMap();

  // Read consultations file
  if (!fs.existsSync(CONSULTATIONS_FILE)) {
    throw new Error(`Consultations file not found: ${CONSULTATIONS_FILE}`);
  }

  const fileContent = fs.readFileSync(CONSULTATIONS_FILE, 'utf8');
  console.log('\nParsing consultations CSV...');

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
  console.log(`Parsed ${stats.totalRows} consultation records\n`);

  // Process in batches
  const visitsToBatch = [];
  const examsToBatch = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];

    // Skip header duplicates or empty rows
    if (!row.NumActe || row.NumActe.trim() === '' || row.NumActe === 'NumActe') {
      stats.skipped++;
      continue;
    }

    const numActe = row.NumActe.trim();

    // Get patient info from actes map
    const acteInfo = actesMap.get(numActe);
    if (!acteInfo || !acteInfo.numFiche) {
      stats.skipped++;
      stats.errors.push(`Row ${i + 1}: NumActe ${numActe} not found in LV_Actes.csv`);
      continue;
    }

    // Find patient
    const patientId = patientMap.get(acteInfo.numFiche);
    if (!patientId) {
      stats.patientNotFound.add(acteInfo.numFiche);
      stats.skipped++;
      continue;
    }

    // Parse date
    let visitDate = new Date();
    if (acteInfo.dateCreation) {
      const parsed = new Date(acteInfo.dateCreation);
      if (!isNaN(parsed.getTime())) {
        visitDate = parsed;
      }
    }

    // Parse vital signs
    const vitalSigns = {};
    if (row.Temperature && !isNaN(parseFloat(row.Temperature))) {
      vitalSigns.temperature = parseFloat(row.Temperature);
    }
    if (row.Poids && !isNaN(parseFloat(row.Poids))) {
      vitalSigns.weight = parseFloat(row.Poids);
    }
    if (row.Taille && !isNaN(parseFloat(row.Taille))) {
      vitalSigns.height = parseFloat(row.Taille);
    }
    if (row.TA) {
      vitalSigns.bloodPressure = parseBloodPressure(row.TA);
    }
    if (row.FC && !isNaN(parseInt(row.FC))) {
      vitalSigns.heartRate = parseInt(row.FC);
    }
    if (row.FR && !isNaN(parseInt(row.FR))) {
      vitalSigns.respiratoryRate = parseInt(row.FR);
    }

    // Parse ophthalmology data from Conclusion
    const eyeData = parseConclusion(row.Conclusion || '');

    // Create Visit document
    const visit = {
      patient: patientId,
      clinic: tombalbaye._id,
      visitType: mapConsultationType(row.Type || 'Standard'),
      visitDate: visitDate,
      status: 'completed',
      checkInTime: visitDate,
      checkOutTime: visitDate,
      chiefComplaint: row.Plaintes ? {
        complaint: row.Plaintes.substring(0, 2000), // Limit length
        duration: ''
      } : undefined,
      physicalExamination: Object.keys(vitalSigns).length > 0 ? {
        vitalSigns: vitalSigns
      } : undefined,
      diagnoses: row.Diagnostics ? [{
        description: row.Diagnostics.substring(0, 2000),
        type: 'primary',
        dateOfDiagnosis: visitDate
      }] : [],
      primaryProvider: systemUser._id,
      legacyIds: {
        lv: numActe,
        consultationRef: row.Ref
      },
      isLegacyData: true,
      createdBy: systemUser._id
    };

    visitsToBatch.push(visit);

    // Create OphthalmologyExam if we have eye data
    if (eyeData.hasData && row.Type === 'Ophtalmologie') {
      // Generate unique examId from legacy reference
      const dateStr = visitDate.toISOString().slice(0, 10).replace(/-/g, '');
      const uniquePart = numActe.slice(-8);
      const examId = `OPH${dateStr}${uniquePart}`;

      const exam = {
        _visitLegacyId: numActe, // Temp field to link after insert
        examId: examId, // Required unique field
        patient: patientId,
        clinic: tombalbaye._id,
        examiner: systemUser._id,
        examType: 'refraction',
        status: 'completed',
        completedAt: visitDate,
        refraction: {
          objective: {
            autorefractor: eyeData.autorefractor.OD || eyeData.autorefractor.OS ? {
              OD: eyeData.autorefractor.OD || {},
              OS: eyeData.autorefractor.OS || {}
            } : undefined
          },
          finalPrescription: eyeData.refraction.OD || eyeData.refraction.OS ? {
            OD: eyeData.refraction.OD || {},
            OS: eyeData.refraction.OS || {}
          } : undefined
        },
        visualAcuity: eyeData.visualAcuity.OD || eyeData.visualAcuity.OS ? {
          distance: {
            OD: eyeData.visualAcuity.OD ? { corrected: eyeData.visualAcuity.OD } : {},
            OS: eyeData.visualAcuity.OS ? { corrected: eyeData.visualAcuity.OS } : {}
          },
          method: 'snellen'
        } : undefined,
        iop: eyeData.iop.OD != null || eyeData.iop.OS != null ? {
          OD: eyeData.iop.OD != null ? { value: eyeData.iop.OD, method: 'nct' } : undefined,
          OS: eyeData.iop.OS != null ? { value: eyeData.iop.OS, method: 'nct' } : undefined
        } : undefined,
        notes: {
          clinical: row.Conclusion ? row.Conclusion.substring(0, 5000) : undefined
        },
        isLegacyData: true,
        createdBy: systemUser._id,
        createdAt: visitDate,
        updatedAt: visitDate
      };

      examsToBatch.push(exam);
    }

    // Batch insert when we hit BATCH_SIZE
    if (visitsToBatch.length >= BATCH_SIZE) {
      await processBatch(visitsToBatch, examsToBatch);
      visitsToBatch.length = 0;
      examsToBatch.length = 0;

      // Progress
      const progress = Math.round((i / parsed.data.length) * 100);
      const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
      console.log(`Progress: ${progress}% (${i}/${parsed.data.length}) - ${elapsed}s elapsed`);
    }
  }

  // Process remaining batch
  if (visitsToBatch.length > 0) {
    await processBatch(visitsToBatch, examsToBatch);
  }

  // Print summary
  printSummary();
}

/**
 * Process a batch of visits and exams
 * Uses native MongoDB driver for reliable bulk inserts (Mongoose insertMany has issues in v7)
 */
async function processBatch(visits, exams) {
  if (DRY_RUN) {
    stats.visitsCreated += visits.length;
    stats.ophthalmologyExamsCreated += exams.length;
    return;
  }

  try {
    // Generate visitIds and add timestamps for each visit
    const now = new Date();
    for (const visit of visits) {
      // Generate a visitId based on date
      const date = new Date(visit.visitDate);
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const uniquePart = visit.legacyIds?.lv?.slice(-6) || Math.random().toString(36).slice(2, 8);
      visit.visitId = `VIS${dateStr}${uniquePart}`;
      visit.createdAt = now;
      visit.updatedAt = now;
      // Ensure _id is set
      if (!visit._id) {
        visit._id = new mongoose.Types.ObjectId();
      }
    }

    // Use native MongoDB driver for reliable inserts
    const visitsCollection = mongoose.connection.db.collection('visits');
    const insertResult = await visitsCollection.insertMany(visits, { ordered: false });
    stats.visitsCreated += insertResult.insertedCount || 0;

    // Map legacy IDs to new visit IDs
    const visitIdMap = new Map();
    for (const visit of visits) {
      if (visit.legacyIds?.lv) {
        visitIdMap.set(visit.legacyIds.lv, visit._id);
      }
    }

    // Update exams with visit references (OphthalmologyExam uses 'appointment' field)
    for (const exam of exams) {
      const visitId = visitIdMap.get(exam._visitLegacyId);
      if (visitId) {
        exam.appointment = visitId; // Link to visit via appointment field
      }
      delete exam._visitLegacyId;
      // Add timestamps
      exam.createdAt = now;
      exam.updatedAt = now;
      if (!exam._id) {
        exam._id = new mongoose.Types.ObjectId();
      }
    }

    // Insert exams using native driver
    if (exams.length > 0) {
      const examsCollection = mongoose.connection.db.collection('ophthalmologyexams');
      const examResult = await examsCollection.insertMany(exams, { ordered: false });
      stats.ophthalmologyExamsCreated += examResult.insertedCount || 0;
    }

  } catch (error) {
    if (error.writeErrors) {
      const inserted = visits.length - error.writeErrors.length;
      stats.visitsCreated += inserted;
      stats.errors.push(`Batch insert: ${error.writeErrors.length} errors`);
    } else {
      stats.errors.push(`Batch error: ${error.message}`);
    }
  }
}

/**
 * Print import summary
 */
function printSummary() {
  const elapsed = Math.round((Date.now() - stats.startTime) / 1000);

  console.log(`\n${'='.repeat(50)}`);
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(50));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE IMPORT'}`);
  console.log(`Total Rows: ${stats.totalRows}`);
  console.log(`Visits Created: ${stats.visitsCreated}`);
  console.log(`Ophthalmology Exams Created: ${stats.ophthalmologyExamsCreated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Patients Not Found: ${stats.patientNotFound.size}`);
  console.log(`Errors: ${stats.errors.length}`);
  console.log(`Time: ${elapsed}s`);

  if (stats.patientNotFound.size > 0 && stats.patientNotFound.size <= 20) {
    console.log('\nPatients not found:');
    Array.from(stats.patientNotFound).slice(0, 20).forEach(p => console.log(`  - ${p}`));
  }

  if (stats.errors.length > 0) {
    console.log('\nFirst 10 errors:');
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

    await importConsultations();

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

main();
