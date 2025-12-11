/**
 * LV.bak to Care Vision EMR Migration Script (Complete Version)
 *
 * Migrates all patient and clinical data from the legacy LV (DMI) database to Care Vision EMR.
 * Uses existing seeded reference data (companies, fees, clinics, users).
 *
 * Prerequisites:
 * 1. SQL Server running in Docker with LV database restored
 * 2. MongoDB running with medflow database (already seeded)
 *
 * Usage:
 *   node scripts/migrate-lv-data.js [--dry-run] [--phase=1] [--limit=1000]
 *
 * Phases:
 *   1 = Patients only
 *   2 = Ophthalmology Exams (Refractions + Tonometry)
 *   3 = Visits + Consultations + Diagnoses
 *   4 = Glasses Orders
 *   all = Run all phases (default)
 */

const path = require('path');
const backendPath = path.join(__dirname, '..', 'backend');
process.chdir(backendPath);

const mongoose = require(path.join(backendPath, 'node_modules', 'mongoose'));
const sql = require(path.join(backendPath, 'node_modules', 'mssql'));

// Load models
const Patient = require(path.join(backendPath, 'models', 'Patient'));
const Company = require(path.join(backendPath, 'models', 'Company'));
const Visit = require(path.join(backendPath, 'models', 'Visit'));
const OphthalmologyExam = require(path.join(backendPath, 'models', 'OphthalmologyExam'));
const GlassesOrder = require(path.join(backendPath, 'models', 'GlassesOrder'));
const Clinic = require(path.join(backendPath, 'models', 'Clinic'));
const User = require(path.join(backendPath, 'models', 'User'));

// Configuration
// SECURITY: SQL Server credentials must be provided via environment variables
const config = {
  sqlServer: {
    user: process.env.LV_SQL_USER || 'sa',
    password: process.env.LV_SQL_PASSWORD,
    server: process.env.LV_SQL_SERVER || 'localhost',
    database: process.env.LV_SQL_DATABASE || 'LV',
    options: {
      encrypt: false,
      trustServerCertificate: true
    }
  },
  mongodb: process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow',
  batchSize: 500,
  dryRun: process.argv.includes('--dry-run'),
  phase: process.argv.find(a => a.startsWith('--phase='))?.split('=')[1] || 'all',
  limit: parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0')
};

// SECURITY: Require password from environment
if (!config.sqlServer.password) {
  console.error('ERROR: LV_SQL_PASSWORD environment variable is required.');
  console.error('Usage: LV_SQL_PASSWORD=yourpassword node scripts/migrate-lv-data.js');
  process.exit(1);
}

// Migration statistics
const stats = {
  patients: { processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 },
  exams: { processed: 0, created: 0, errors: 0 },
  visits: { processed: 0, created: 0, errors: 0 },
  diagnoses: { processed: 0, added: 0, errors: 0 },
  glassesOrders: { processed: 0, created: 0, errors: 0 }
};

// Caches
let companyCache = new Map();
let patientCache = new Map();
let defaultClinic = null;
let defaultDoctor = null;

// ============================================
// UTILITY FUNCTIONS
// ============================================

const mapGender = (sexe) => {
  if (!sexe) return 'other';
  return sexe.toUpperCase() === 'M' ? 'male' : sexe.toUpperCase() === 'F' ? 'female' : 'other';
};

const parsePhone = (phone) => {
  if (!phone) return null;
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (phone.includes('/')) {
    cleaned = phone.split('/')[0].replace(/[^\d+]/g, '');
  }
  if (cleaned.length >= 9 && !cleaned.startsWith('+') && !cleaned.startsWith('00')) {
    cleaned = '+243' + cleaned;
  }
  return cleaned || null;
};

const parseNumber = (str) => {
  if (!str) return null;
  const cleaned = str.toString().replace(',', '.').replace(/[^\d.\-+]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const mapLaterality = (oeil) => {
  if (!oeil) return 'OU';
  const o = oeil.toUpperCase();
  if (o === 'D' || o === 'OD' || o.includes('DROIT')) return 'OD';
  if (o === 'G' || o === 'OG' || o === 'OS' || o.includes('GAUCHE')) return 'OS';
  return 'OU';
};

// ============================================
// INITIALIZATION
// ============================================

async function initialize() {
  console.log('Initializing caches...');

  // Load companies into cache (match by name)
  const companies = await Company.find({});
  companies.forEach(c => {
    companyCache.set(c.name.toUpperCase(), c._id);
    // Also add without accents/special chars for fuzzy matching
    companyCache.set(c.name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), c._id);
  });
  console.log(`  Loaded ${companies.length} companies into cache`);

  // Get default clinic (first one)
  defaultClinic = await Clinic.findOne({});
  if (!defaultClinic) {
    throw new Error('No clinic found in database. Please run seed scripts first.');
  }
  console.log(`  Default clinic: ${defaultClinic.name}`);

  // Get default doctor (ophthalmologist or doctor role)
  defaultDoctor = await User.findOne({ role: { $in: ['ophthalmologist', 'doctor'] } });
  if (!defaultDoctor) {
    defaultDoctor = await User.findOne({});
  }
  console.log(`  Default doctor: ${defaultDoctor?.email || 'None'}`);
}

// ============================================
// PHASE 1: PATIENTS
// ============================================

async function migratePatients(pool) {
  console.log('\n' + '='.repeat(50));
  console.log('  PHASE 1: MIGRATING PATIENTS');
  console.log('='.repeat(50));

  const limitClause = config.limit > 0 ? `TOP ${config.limit}` : '';

  const result = await pool.request().query(`
    SELECT ${limitClause}
      NumFiche, Noms, Postnom, [Prénom] as Prenom, Sexe, Naissance,
      EtatCivil, [Nationalité] as Nationalite, Convention, Code,
      Profession, Avenue, Quartier, Commune, Ville,
      [Téléphone] as Telephone, Messagerie, GS,
      [PremièreVisite] as PremiereVisite, Allergie,
      [Antécédents] as Antecedents, Observation
    FROM Patients
    WHERE NumFiche IS NOT NULL AND NumFiche != '' AND NumFiche != '000'
    ORDER BY [PremièreVisite] DESC
  `);

  console.log(`Found ${result.recordset.length} patients to migrate\n`);

  for (const row of result.recordset) {
    stats.patients.processed++;

    try {
      // Check if patient already exists
      const existing = await Patient.findOne({ 'legacyIds.dmi': row.NumFiche });
      if (existing) {
        stats.patients.skipped++;
        patientCache.set(row.NumFiche, existing._id);
        continue;
      }

      const firstName = (row.Prenom?.trim() || row.Postnom?.trim() || 'INCONNU').toUpperCase();
      const lastName = (row.Noms?.trim() || 'INCONNU').toUpperCase();

      const hasValidDOB = row.Naissance && new Date(row.Naissance) < new Date() && new Date(row.Naissance).getFullYear() > 1900;
      const hasValidPhone = row.Telephone && row.Telephone.length >= 6;

      const placeholderFields = [];
      if (!hasValidDOB) placeholderFields.push('dateOfBirth');
      if (!hasValidPhone) placeholderFields.push('phoneNumber');
      if (!row.Sexe) placeholderFields.push('gender');

      // Find matching company
      let companyId = null;
      if (row.Convention && row.Convention !== '[Patient Privé]') {
        const convName = row.Convention.trim().toUpperCase();
        companyId = companyCache.get(convName) ||
                   companyCache.get(convName.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      }

      const patientData = {
        legacyIds: { dmi: row.NumFiche, oldEmr: row.Code || null },
        legacyPatientNumber: row.NumFiche,
        dataStatus: placeholderFields.length > 0 ? 'incomplete' : 'complete',
        placeholderFields,
        firstName,
        lastName,
        dateOfBirth: hasValidDOB ? new Date(row.Naissance) : new Date('1970-01-01'),
        gender: mapGender(row.Sexe),
        bloodType: row.GS && ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(row.GS) ? row.GS : undefined,
        occupation: row.Profession?.trim() || undefined,
        phoneNumber: parsePhone(row.Telephone) || '+243000000000',
        email: row.Messagerie?.includes('@') ? row.Messagerie.toLowerCase().trim() : undefined,
        address: {
          street: row.Avenue?.trim() || undefined,
          city: row.Commune?.trim() || row.Ville?.trim() || 'Kinshasa',
          state: row.Quartier?.trim() || undefined,
          country: 'RD Congo'
        },
        convention: companyId ? {
          company: companyId,
          employeeId: row.Code?.trim() || undefined,
          status: 'active',
          beneficiaryType: 'employee'
        } : undefined,
        medicalHistory: {
          allergies: row.Allergie ? [{ allergen: row.Allergie.substring(0, 200), severity: 'moderate' }] : [],
          chronicConditions: []
        },
        notes: (row.Antecedents || row.Observation) ? [{
          content: `[Importé de DMI]\n${row.Antecedents || ''}\n${row.Observation || ''}`.trim(),
          category: 'medical_history',
          createdAt: new Date(),
          isPrivate: false
        }] : [],
        registrationDate: row.PremiereVisite ? new Date(row.PremiereVisite) : new Date(),
        status: 'active',
        clinic: defaultClinic._id
      };

      if (!config.dryRun) {
        const patient = new Patient(patientData);
        await patient.save({ validateBeforeSave: false });
        patientCache.set(row.NumFiche, patient._id);
        stats.patients.created++;
      } else {
        stats.patients.created++;
      }

      if (stats.patients.processed % 1000 === 0) {
        console.log(`  Progress: ${stats.patients.processed}/${result.recordset.length} (${stats.patients.created} created, ${stats.patients.skipped} skipped)`);
      }

    } catch (error) {
      stats.patients.errors++;
      if (stats.patients.errors <= 5) {
        console.error(`  Error migrating patient ${row.NumFiche}: ${error.message}`);
      }
    }
  }

  console.log(`\nPatients complete: ${stats.patients.created} created, ${stats.patients.skipped} skipped, ${stats.patients.errors} errors`);
}

// ============================================
// PHASE 2: OPHTHALMOLOGY EXAMS
// ============================================

async function migrateOphthalmologyExams(pool) {
  console.log('\n' + '='.repeat(50));
  console.log('  PHASE 2: MIGRATING OPHTHALMOLOGY EXAMS');
  console.log('='.repeat(50));

  // First, load patient cache if not already loaded
  if (patientCache.size === 0) {
    console.log('Loading patient cache...');
    const patients = await Patient.find({ 'legacyIds.dmi': { $exists: true } }, { 'legacyIds.dmi': 1 });
    patients.forEach(p => patientCache.set(p.legacyIds.dmi, p._id));
    console.log(`  Loaded ${patientCache.size} patients into cache`);
  }

  const limitClause = config.limit > 0 ? `TOP ${config.limit}` : '';

  // Get refractions with patient info via Actes table
  const result = await pool.request().query(`
    SELECT ${limitClause}
      r.IdRefraction, r.NumActe, r.[TypeRéfraction] as TypeRefraction,
      r.AV_OD, r.AV_OG, r.Sph_OD, r.Sph_OG, r.Cyl_OD, r.Cyl_OG,
      r.Axe_OD, r.Axe_OG, r.Add_OD, r.Add_OG, r.AVp_OD, r.AVp_OG,
      r.Binoculaire, r.DIP, r.Heure,
      a.NumFiche, a.DateCréation as DateCreation
    FROM [Ophta_Réfractions] r
    INNER JOIN Actes a ON r.NumActe = a.NumActe
    WHERE a.NumFiche IS NOT NULL
    ORDER BY a.DateCréation DESC
  `);

  console.log(`Found ${result.recordset.length} refractions to migrate\n`);

  // Group refractions by NumActe (same exam session)
  const examGroups = new Map();
  for (const row of result.recordset) {
    if (!examGroups.has(row.NumActe)) {
      examGroups.set(row.NumActe, { info: row, refractions: [] });
    }
    examGroups.get(row.NumActe).refractions.push(row);
  }

  console.log(`Grouped into ${examGroups.size} exam sessions`);

  let processed = 0;
  for (const [numActe, group] of examGroups) {
    processed++;
    stats.exams.processed++;

    try {
      const patientId = patientCache.get(group.info.NumFiche);
      if (!patientId) continue;

      // Check if exam already migrated
      const existing = await OphthalmologyExam.findOne({ 'notes.internal': { $regex: numActe } });
      if (existing) continue;

      // Build refraction data from all records in this session
      let subjective = null;
      let objective = null;
      let visualAcuity = {};

      for (const ref of group.refractions) {
        const type = (ref.TypeRefraction || '').toLowerCase();

        // Visual acuity without correction
        if (type.includes('sans correction') || type.includes('acuit')) {
          visualAcuity = {
            distance: {
              OD: { uncorrected: ref.AV_OD || undefined },
              OS: { uncorrected: ref.AV_OG || undefined }
            }
          };
        }

        // Subjective refraction
        if (type.includes('subjectiv')) {
          subjective = {
            OD: {
              sphere: parseNumber(ref.Sph_OD),
              cylinder: parseNumber(ref.Cyl_OD),
              axis: parseNumber(ref.Axe_OD?.replace('°', '')),
              va: ref.AV_OD,
              parinaud: ref.AVp_OD
            },
            OS: {
              sphere: parseNumber(ref.Sph_OG),
              cylinder: parseNumber(ref.Cyl_OG),
              axis: parseNumber(ref.Axe_OG?.replace('°', '')),
              va: ref.AV_OG,
              parinaud: ref.AVp_OG
            },
            add: parseNumber(ref.Add_OD) || parseNumber(ref.Add_OG)
          };
        }

        // Auto-refraction (objective)
        if (type.includes('auto') || type.includes('objectiv')) {
          objective = {
            autorefractor: {
              OD: {
                sphere: parseNumber(ref.Sph_OD),
                cylinder: parseNumber(ref.Cyl_OD),
                axis: parseNumber(ref.Axe_OD?.replace('°', ''))
              },
              OS: {
                sphere: parseNumber(ref.Sph_OG),
                cylinder: parseNumber(ref.Cyl_OG),
                axis: parseNumber(ref.Axe_OG?.replace('°', ''))
              }
            }
          };
        }
      }

      const examData = {
        patient: patientId,
        clinic: defaultClinic._id,
        examiner: defaultDoctor._id,
        examType: 'refraction',
        examDate: group.info.DateCreation ? new Date(group.info.DateCreation) : new Date(),
        visualAcuity: Object.keys(visualAcuity).length > 0 ? visualAcuity : undefined,
        refraction: {
          objective: objective || undefined,
          subjective: subjective || undefined,
          finalPrescription: subjective ? {
            OD: subjective.OD,
            OS: subjective.OS,
            pd: { distance: parseNumber(group.info.DIP) }
          } : undefined
        },
        notes: {
          internal: `[Importé de DMI - NumActe: ${numActe}]`
        },
        status: 'completed',
        completedAt: group.info.DateCreation ? new Date(group.info.DateCreation) : new Date()
      };

      if (!config.dryRun) {
        const exam = new OphthalmologyExam(examData);
        await exam.save({ validateBeforeSave: false });
        stats.exams.created++;
      } else {
        stats.exams.created++;
      }

      if (processed % 5000 === 0) {
        console.log(`  Progress: ${processed}/${examGroups.size} exam sessions (${stats.exams.created} created)`);
      }

    } catch (error) {
      stats.exams.errors++;
      if (stats.exams.errors <= 5) {
        console.error(`  Error migrating exam ${numActe}: ${error.message}`);
      }
    }
  }

  // Now migrate tonometry data
  console.log('\nMigrating tonometry (IOP) data...');

  const tonoResult = await pool.request().query(`
    SELECT ${limitClause}
      t.Id_TO, t.NumFiche, t.DateHeure, t.TOD, t.TOG, t.NumActe
    FROM [Ophta_Tonométrie] t
    WHERE t.NumFiche IS NOT NULL
    ORDER BY t.DateHeure DESC
  `);

  console.log(`Found ${tonoResult.recordset.length} tonometry records`);

  let tonoProcessed = 0;
  for (const row of tonoResult.recordset) {
    tonoProcessed++;

    try {
      const patientId = patientCache.get(row.NumFiche);
      if (!patientId) continue;

      // Find existing exam for this date or create new
      const examDate = row.DateHeure ? new Date(row.DateHeure) : new Date();
      let exam = await OphthalmologyExam.findOne({
        patient: patientId,
        examDate: {
          $gte: new Date(examDate.setHours(0, 0, 0, 0)),
          $lt: new Date(examDate.setHours(23, 59, 59, 999))
        }
      });

      if (exam) {
        // Update existing exam with IOP
        if (!config.dryRun) {
          exam.iop = {
            OD: { value: row.TOD, method: 'nct' },
            OS: { value: row.TOG, method: 'nct' }
          };
          await exam.save({ validateBeforeSave: false });
        }
      } else {
        // Create new exam with just IOP
        if (!config.dryRun) {
          const newExam = new OphthalmologyExam({
            patient: patientId,
            clinic: defaultClinic._id,
            examiner: defaultDoctor._id,
            examType: 'routine',
            examDate: row.DateHeure ? new Date(row.DateHeure) : new Date(),
            iop: {
              OD: { value: row.TOD, method: 'nct' },
              OS: { value: row.TOG, method: 'nct' }
            },
            notes: { internal: `[Importé de DMI - Tonométrie ID: ${row.Id_TO}]` },
            status: 'completed'
          });
          await newExam.save({ validateBeforeSave: false });
          stats.exams.created++;
        }
      }

      if (tonoProcessed % 10000 === 0) {
        console.log(`  Tonometry progress: ${tonoProcessed}/${tonoResult.recordset.length}`);
      }

    } catch (error) {
      stats.exams.errors++;
    }
  }

  console.log(`\nExams complete: ${stats.exams.created} created, ${stats.exams.errors} errors`);
}

// ============================================
// PHASE 3: VISITS + DIAGNOSES
// ============================================

async function migrateVisits(pool) {
  console.log('\n' + '='.repeat(50));
  console.log('  PHASE 3: MIGRATING VISITS & DIAGNOSES');
  console.log('='.repeat(50));

  // Load patient cache if needed
  if (patientCache.size === 0) {
    console.log('Loading patient cache...');
    const patients = await Patient.find({ 'legacyIds.dmi': { $exists: true } }, { 'legacyIds.dmi': 1 });
    patients.forEach(p => patientCache.set(p.legacyIds.dmi, p._id));
    console.log(`  Loaded ${patientCache.size} patients into cache`);
  }

  const limitClause = config.limit > 0 ? `TOP ${config.limit}` : '';

  // Get consultations with diagnoses
  const result = await pool.request().query(`
    SELECT ${limitClause}
      c.[Réf] as Ref, c.NumActe, c.Type,
      c.[Température] as Temperature, c.Poids, c.Taille,
      c.TA, c.FC, c.FR, c.Plaintes,
      c.DiagnosticsCertitude as DiagnosticsCert,
      c.Conclusion,
      a.NumFiche, a.NomsPatient, a.DateCréation as DateCreation,
      a.AuteurCréation as Auteur, a.Service
    FROM Consultations c
    INNER JOIN Actes a ON c.NumActe = a.NumActe
    WHERE a.NumFiche IS NOT NULL
    ORDER BY a.DateCréation DESC
  `);

  console.log(`Found ${result.recordset.length} consultations to migrate\n`);

  // Pre-load diagnoses for batch processing
  const diagResult = await pool.request().query(`
    SELECT NumActe, Diagnostic, CatDiagnostic, Oeil, DateDiagnostic, Famille
    FROM DiagnosticsPatients
    WHERE NumActe IS NOT NULL
  `);

  const diagByActe = new Map();
  for (const d of diagResult.recordset) {
    if (!diagByActe.has(d.NumActe)) {
      diagByActe.set(d.NumActe, []);
    }
    diagByActe.get(d.NumActe).push(d);
  }
  console.log(`Loaded ${diagResult.recordset.length} diagnoses for ${diagByActe.size} visits`);

  for (const row of result.recordset) {
    stats.visits.processed++;

    try {
      const patientId = patientCache.get(row.NumFiche);
      if (!patientId) continue;

      // Check if already migrated
      const existing = await Visit.findOne({ 'notes.internal': { $regex: row.NumActe } });
      if (existing) continue;

      // Parse vital signs
      const vitalSigns = {};
      if (row.Temperature) vitalSigns.temperature = parseNumber(row.Temperature);
      if (row.Poids) vitalSigns.weight = parseNumber(row.Poids);
      if (row.Taille) vitalSigns.height = parseNumber(row.Taille);
      if (row.FC) vitalSigns.heartRate = parseInt(row.FC);
      if (row.FR) vitalSigns.respiratoryRate = parseInt(row.FR);
      if (row.TA) {
        const bp = row.TA.match(/(\d+)\/(\d+)/);
        if (bp) vitalSigns.bloodPressure = `${bp[1]}/${bp[2]}`;
      }

      // Get diagnoses for this visit
      const visitDiagnoses = diagByActe.get(row.NumActe) || [];
      const diagnoses = visitDiagnoses.map(d => ({
        code: d.CatDiagnostic || 'LEGACY',
        description: d.Diagnostic?.substring(0, 500) || 'Non spécifié',
        type: 'primary',
        laterality: mapLaterality(d.Oeil),
        dateOfDiagnosis: d.DateDiagnostic ? new Date(d.DateDiagnostic) : undefined
      }));

      stats.diagnoses.processed += visitDiagnoses.length;
      stats.diagnoses.added += diagnoses.length;

      const visitData = {
        patient: patientId,
        clinic: defaultClinic._id,
        primaryProvider: defaultDoctor._id,
        visitDate: row.DateCreation ? new Date(row.DateCreation) : new Date(),
        visitType: 'consultation',
        chiefComplaint: row.Plaintes ? {
          complaint: row.Plaintes.substring(0, 500),
          severity: 'moderate'
        } : undefined,
        physicalExamination: Object.keys(vitalSigns).length > 0 ? { vitalSigns } : undefined,
        diagnoses: diagnoses.length > 0 ? diagnoses : undefined,
        notes: {
          clinical: row.Conclusion || '',
          internal: `[Importé de DMI - NumActe: ${row.NumActe}]`
        },
        status: 'completed',
        completedAt: row.DateCreation ? new Date(row.DateCreation) : new Date()
      };

      if (!config.dryRun) {
        const visit = new Visit(visitData);
        await visit.save({ validateBeforeSave: false });
        stats.visits.created++;

        // Update patient's last visit
        await Patient.findByIdAndUpdate(patientId, {
          lastVisit: visit._id,
          lastVisitDate: visit.visitDate
        });
      } else {
        stats.visits.created++;
      }

      if (stats.visits.processed % 5000 === 0) {
        console.log(`  Progress: ${stats.visits.processed}/${result.recordset.length} (${stats.visits.created} created)`);
      }

    } catch (error) {
      stats.visits.errors++;
      if (stats.visits.errors <= 5) {
        console.error(`  Error migrating visit ${row.NumActe}: ${error.message}`);
      }
    }
  }

  console.log(`\nVisits complete: ${stats.visits.created} created, ${stats.diagnoses.added} diagnoses added, ${stats.visits.errors} errors`);
}

// ============================================
// PHASE 4: GLASSES ORDERS
// ============================================

async function migrateGlassesOrders(pool) {
  console.log('\n' + '='.repeat(50));
  console.log('  PHASE 4: MIGRATING GLASSES ORDERS');
  console.log('='.repeat(50));

  // Load patient cache if needed
  if (patientCache.size === 0) {
    console.log('Loading patient cache...');
    const patients = await Patient.find({ 'legacyIds.dmi': { $exists: true } }, { 'legacyIds.dmi': 1 });
    patients.forEach(p => patientCache.set(p.legacyIds.dmi, p._id));
  }

  const limitClause = config.limit > 0 ? `TOP ${config.limit}` : '';

  const result = await pool.request().query(`
    SELECT ${limitClause}
      o.NumVisite, o.Type, o.Ordonnance, o.Optique, o.Servi,
      o.Prescripteur, o.DatePrescription, o.NomsPatients,
      a.NumFiche
    FROM [Ophta_Optique] o
    INNER JOIN Actes a ON o.NumVisite = a.NumActe
    WHERE a.NumFiche IS NOT NULL
    ORDER BY o.DatePrescription DESC
  `);

  console.log(`Found ${result.recordset.length} glasses orders to migrate\n`);

  for (const row of result.recordset) {
    stats.glassesOrders.processed++;

    try {
      const patientId = patientCache.get(row.NumFiche);
      if (!patientId) continue;

      // Check if already migrated
      const existing = await GlassesOrder.findOne({ 'notes': { $regex: row.NumVisite } });
      if (existing) continue;

      // Find related ophthalmology exam
      const exam = await OphthalmologyExam.findOne({
        patient: patientId,
        'notes.internal': { $regex: row.NumVisite }
      });

      if (!exam) continue; // Need an exam to link to

      const orderData = {
        patient: patientId,
        exam: exam._id,
        orderedBy: defaultDoctor._id,
        orderType: row.Type?.toLowerCase().includes('lentille') ? 'contact-lenses' : 'glasses',
        orderDate: row.DatePrescription ? new Date(row.DatePrescription) : new Date(),
        prescriptionData: exam.refraction?.finalPrescription ? {
          od: exam.refraction.finalPrescription.OD,
          os: exam.refraction.finalPrescription.OS,
          pd: exam.refraction.finalPrescription.pd
        } : {},
        status: row.Servi ? 'completed' : 'pending',
        notes: `[Importé de DMI - NumVisite: ${row.NumVisite}]\n${row.Ordonnance || ''}`
      };

      if (!config.dryRun) {
        const order = new GlassesOrder(orderData);
        await order.save({ validateBeforeSave: false });
        stats.glassesOrders.created++;
      } else {
        stats.glassesOrders.created++;
      }

      if (stats.glassesOrders.processed % 5000 === 0) {
        console.log(`  Progress: ${stats.glassesOrders.processed}/${result.recordset.length}`);
      }

    } catch (error) {
      stats.glassesOrders.errors++;
      if (stats.glassesOrders.errors <= 5) {
        console.error(`  Error migrating glasses order ${row.NumVisite}: ${error.message}`);
      }
    }
  }

  console.log(`\nGlasses orders complete: ${stats.glassesOrders.created} created, ${stats.glassesOrders.errors} errors`);
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('     LV.bak to Care Vision EMR - Complete Migration');
  console.log('='.repeat(60));
  console.log(`Mode: ${config.dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Phase: ${config.phase}`);
  console.log(`Limit: ${config.limit || 'No limit'}`);
  console.log(`Database: ${config.mongodb}`);
  console.log('');

  let sqlPool;

  try {
    console.log('Connecting to SQL Server...');
    sqlPool = await sql.connect(config.sqlServer);
    console.log('Connected to SQL Server');

    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.mongodb);
    console.log('Connected to MongoDB');

    await initialize();

    // Run phases
    const phase = config.phase;

    if (phase === 'all' || phase === '1') {
      await migratePatients(sqlPool);
    }

    if (phase === 'all' || phase === '2') {
      await migrateOphthalmologyExams(sqlPool);
    }

    if (phase === 'all' || phase === '3') {
      await migrateVisits(sqlPool);
    }

    if (phase === 'all' || phase === '4') {
      await migrateGlassesOrders(sqlPool);
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('     MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Patients:       ${stats.patients.created} created, ${stats.patients.skipped} skipped, ${stats.patients.errors} errors`);
    console.log(`Exams:          ${stats.exams.created} created, ${stats.exams.errors} errors`);
    console.log(`Visits:         ${stats.visits.created} created, ${stats.visits.errors} errors`);
    console.log(`Diagnoses:      ${stats.diagnoses.added} added to visits`);
    console.log(`Glasses Orders: ${stats.glassesOrders.created} created, ${stats.glassesOrders.errors} errors`);

    if (config.dryRun) {
      console.log('\n*** DRY RUN - No data was modified ***');
    }

  } catch (error) {
    console.error('\nMigration failed:', error.message);
    process.exit(1);
  } finally {
    if (sqlPool) await sql.close();
    await mongoose.disconnect();
  }
}

main();
