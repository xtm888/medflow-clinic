/**
 * Seed Realistic Patient Data for StudioVision Testing
 *
 * Creates complete patient records with:
 * - Profile photo (base64 placeholder or URL)
 * - Profession
 * - Referring doctor
 * - Phone numbers
 * - Allergies
 * - Medical history
 * - Visit history with images and documents
 * - Ophthalmology exams with full refraction data
 * - Imaging studies
 *
 * Usage: node scripts/seedRealisticPatientData.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedRealisticPatientData.js');

// Models
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const ImagingStudy = require('../models/ImagingStudy');
const Document = require('../models/Document');
const Clinic = require('../models/Clinic');
const User = require('../models/User');

// Congolese names and professions
const CONGOLESE_FIRST_NAMES = [
  'Jean-Pierre', 'Marie-Claire', 'Patrick', 'Sylvie', 'Emmanuel',
  'Béatrice', 'Joseph', 'Françoise', 'Albert', 'Henriette',
  'Claude', 'Monique', 'André', 'Jeanne', 'Paul'
];

const CONGOLESE_LAST_NAMES = [
  'MBEKI', 'KALALA', 'TSHISEKEDI', 'MUKEBA', 'KASONGO',
  'MWAMBA', 'KABONGO', 'LUKUSA', 'MULONGO', 'NZUZI',
  'KANDA', 'BANZA', 'LUMUMBA', 'MPUTU', 'KAYEMBE'
];

const PROFESSIONS = [
  'Enseignant(e)', 'Commerçant(e)', 'Informaticien(ne)', 'Médecin',
  'Infirmier(ère)', 'Chauffeur', 'Secrétaire', 'Comptable',
  'Avocat(e)', 'Ingénieur', 'Fonctionnaire', 'Agriculteur',
  'Mécanicien', 'Électricien', 'Couturier(ère)', 'Banquier',
  'Étudiant(e)', 'Retraité(e)', 'Sans emploi', 'Entrepreneur'
];

const REFERRING_DOCTORS = [
  'Dr MUKENDI Pierre', 'Dr KABWE Marie', 'Dr TSHILOMBO Jean',
  'Dr NGANDU Paul', 'Dr KASALA Anne', 'Dr MBUYI Joseph',
  'Dr KABEYA Claire', 'Dr NTUMBA Albert', 'Dr ILUNGA Rose'
];

const ALLERGIES = [
  { name: 'Pénicilline', severity: 'high', reaction: 'Urticaire, œdème' },
  { name: 'Sulfamides', severity: 'medium', reaction: 'Éruption cutanée' },
  { name: 'Aspirine', severity: 'low', reaction: 'Troubles gastriques' },
  { name: 'Latex', severity: 'high', reaction: 'Réaction anaphylactique' },
  { name: 'Atropine', severity: 'medium', reaction: 'Tachycardie' },
  { name: 'Iode', severity: 'high', reaction: 'Choc anaphylactique' }
];

const MEDICAL_CONDITIONS = [
  'Diabète type 2', 'Hypertension artérielle', 'Glaucome familial',
  'Cataracte congénitale', 'Dégénérescence maculaire', 'Rétinopathie diabétique',
  'Asthme', 'Arthrite', 'Hypothyroïdie'
];

const OPHTHALMIC_HISTORY = [
  'Port de lunettes depuis 10 ans', 'Chirurgie cataracte OD 2020',
  'Laser rétinien OS 2019', 'Kératocône bilatéral stable',
  'Strabisme corrigé enfance', 'Traumatisme oculaire 2015'
];

const DIAGNOSES = [
  { code: 'H52.1', name: 'Myopie', laterality: 'OU' },
  { code: 'H52.0', name: 'Hypermétropie', laterality: 'OU' },
  { code: 'H52.2', name: 'Astigmatisme', laterality: 'OD' },
  { code: 'H25.0', name: 'Cataracte sénile incipiente', laterality: 'OU' },
  { code: 'H40.1', name: 'Glaucome primitif à angle ouvert', laterality: 'OS' },
  { code: 'H35.3', name: 'Dégénérescence maculaire liée à l\'âge', laterality: 'OD' },
  { code: 'H36.0', name: 'Rétinopathie diabétique', laterality: 'OU' },
  { code: 'H04.1', name: 'Sécheresse oculaire', laterality: 'OU' },
  { code: 'H10.1', name: 'Conjonctivite allergique', laterality: 'OU' }
];

const VISIT_TYPES = [
  { type: 'consultation', description: 'Consultation ophtalmologique' },
  { type: 'refraction', description: 'Examen de réfraction' },
  { type: 'controle', description: 'Contrôle post-opératoire' },
  { type: 'suivi', description: 'Suivi glaucome' },
  { type: 'urgence', description: 'Urgence - Corps étranger' },
  { type: 'lunettes', description: 'Renouvellement lunettes' }
];

// Generate random phone number (Congolese format)
function generatePhone() {
  const prefixes = ['081', '082', '083', '084', '085', '089', '097', '099'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Math.floor(Math.random() * 9000000) + 1000000;
  return `+243 ${prefix} ${number.toString().substring(0, 3)} ${number.toString().substring(3)}`;
}

// Generate random date in the past
function randomPastDate(yearsBack = 5) {
  const now = new Date();
  const past = new Date(now.getTime() - Math.random() * yearsBack * 365 * 24 * 60 * 60 * 1000);
  return past;
}

// Generate refraction data
function generateRefraction() {
  const sphereRange = [-8, 6];
  const cylRange = [-4, 0];

  const randomSphere = () => (Math.round((Math.random() * (sphereRange[1] - sphereRange[0]) + sphereRange[0]) * 4) / 4).toFixed(2);
  const randomCyl = () => (Math.round((Math.random() * (cylRange[1] - cylRange[0]) + cylRange[0]) * 4) / 4).toFixed(2);
  const randomAxis = () => Math.floor(Math.random() * 180);
  const randomAdd = () => (Math.round((Math.random() * 2 + 0.75) * 4) / 4).toFixed(2);

  return {
    OD: {
      sphere: randomSphere(),
      cylinder: randomCyl(),
      axis: randomAxis(),
      add: Math.random() > 0.5 ? randomAdd() : null
    },
    OS: {
      sphere: randomSphere(),
      cylinder: randomCyl(),
      axis: randomAxis(),
      add: Math.random() > 0.5 ? randomAdd() : null
    }
  };
}

// Generate visual acuity
function generateVisualAcuity() {
  const acuities = ['10/10', '9/10', '8/10', '7/10', '6/10', '5/10', '4/10', '3/10'];
  const nearAcuities = ['P2', 'P3', 'P4', 'P5', 'P6'];

  return {
    OD: {
      uncorrected: acuities[Math.floor(Math.random() * acuities.length)],
      corrected: acuities[Math.floor(Math.random() * 3)], // Usually better
      pinhole: acuities[Math.floor(Math.random() * 2)],
      near: nearAcuities[Math.floor(Math.random() * nearAcuities.length)]
    },
    OS: {
      uncorrected: acuities[Math.floor(Math.random() * acuities.length)],
      corrected: acuities[Math.floor(Math.random() * 3)],
      pinhole: acuities[Math.floor(Math.random() * 2)],
      near: nearAcuities[Math.floor(Math.random() * nearAcuities.length)]
    }
  };
}

// Generate IOP
function generateIOP() {
  const randomIOP = () => Math.floor(Math.random() * 10) + 12; // 12-22 mmHg
  const methods = ['goldmann', 'tonopen', 'icare', 'nct'];
  const method = methods[Math.floor(Math.random() * methods.length)];
  return {
    OD: { value: randomIOP(), method, time: '10:00' },
    OS: { value: randomIOP(), method, time: '10:00' }
  };
}

// Generate keratometry (correct schema structure)
function generateKeratometry() {
  const randomK = () => Math.round((Math.random() * 1.5 + 42) * 100) / 100; // 42-43.5 D
  const randomAxis = () => Math.floor(Math.random() * 180);

  const odAxis1 = randomAxis();
  const osAxis1 = randomAxis();

  return {
    OD: {
      k1: { power: randomK(), axis: odAxis1 },
      k2: { power: randomK(), axis: (odAxis1 + 90) % 180 },
      average: randomK(),
      cylinder: Math.round((Math.random() * 2) * 100) / 100,
      axis: odAxis1
    },
    OS: {
      k1: { power: randomK(), axis: osAxis1 },
      k2: { power: randomK(), axis: (osAxis1 + 90) % 180 },
      average: randomK(),
      cylinder: Math.round((Math.random() * 2) * 100) / 100,
      axis: osAxis1
    }
  };
}

async function seedRealisticData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('Connected to MongoDB\n');

    // Get clinic and doctor
    const clinic = await Clinic.findOne({});
    const doctor = await User.findOne({ role: { $in: ['doctor', 'admin'] } });

    if (!clinic) {
      console.error('No clinic found! Run seedClinics.js first.');
      process.exit(1);
    }

    console.log(`Using clinic: ${clinic.name}`);
    console.log(`Using doctor: ${doctor?.username || 'system'}\n`);

    // Get existing patients to update
    const patients = await Patient.find({}).limit(10);
    console.log(`Found ${patients.length} patients to enhance\n`);

    let updatedCount = 0;
    let visitsCreated = 0;
    let examsCreated = 0;
    let imagingCreated = 0;

    for (const patient of patients) {
      console.log(`\nProcessing: ${patient.lastName} ${patient.firstName}`);

      // Update patient with realistic data
      const updates = {
        profession: PROFESSIONS[Math.floor(Math.random() * PROFESSIONS.length)],
        referringDoctor: REFERRING_DOCTORS[Math.floor(Math.random() * REFERRING_DOCTORS.length)],
        phone: patient.phone || generatePhone(),
        phone2: Math.random() > 0.5 ? generatePhone() : undefined,
        allergies: Math.random() > 0.6 ? [ALLERGIES[Math.floor(Math.random() * ALLERGIES.length)]] : [],
        medicalHistory: {
          chronicConditions: Math.random() > 0.5 ? [{
            condition: 'Diabète type 2',
            status: 'active'
          }] : [],
          familyHistory: Math.random() > 0.5 ? [{
            relation: 'Père',
            condition: 'Glaucome',
            isOcularCondition: true,
            specificEyeCondition: 'glaucoma'
          }] : [],
          surgeries: []
        },
        // Additional fields for display
        ophthalmicHistory: OPHTHALMIC_HISTORY[Math.floor(Math.random() * OPHTHALMIC_HISTORY.length)],
        importantNotes: Math.random() > 0.7 ? 'Patient sous anticoagulants - Attention chirurgie' : undefined,
        // Placeholder photo URL (using UI Avatars service)
        photo: `https://ui-avatars.com/api/?name=${encodeURIComponent(patient.firstName + '+' + patient.lastName)}&background=random&size=200`
      };

      await Patient.findByIdAndUpdate(patient._id, { $set: updates });
      console.log(`  ✓ Updated profile (profession: ${updates.profession})`);
      updatedCount++;

      // Create 2-5 visits with realistic data
      const numVisits = Math.floor(Math.random() * 4) + 2;

      for (let v = 0; v < numVisits; v++) {
        const visitDate = randomPastDate(3);
        const visitType = VISIT_TYPES[Math.floor(Math.random() * VISIT_TYPES.length)];
        const hasImaging = Math.random() > 0.5;
        const hasDocs = Math.random() > 0.4;

        // Create visit
        const visit = await Visit.create({
          patient: patient._id,
          clinic: clinic._id,
          visitDate,
          type: visitType.type,
          reason: visitType.description,
          status: 'completed',
          primaryProvider: doctor?._id,
          dominantEye: ['OD', 'OS', 'OU'][Math.floor(Math.random() * 3)],
          chiefComplaint: visitType.description,
          hasImages: hasImaging,
          hasDocuments: hasDocs,
          notes: `Consultation du ${visitDate.toLocaleDateString('fr-FR')}`,
          createdBy: doctor?._id
        });
        visitsCreated++;

        // Create ophthalmology exam
        const diagnoses = Math.random() > 0.3
          ? [DIAGNOSES[Math.floor(Math.random() * DIAGNOSES.length)]]
          : [];

        const examTypes = ['comprehensive', 'routine', 'refraction', 'follow-up', 'screening'];
        const examType = examTypes[Math.floor(Math.random() * examTypes.length)];

        const exam = await OphthalmologyExam.create({
          patient: patient._id,
          visit: visit._id,
          clinic: clinic._id,
          examiner: doctor?._id,
          examDate: visitDate,
          examType,
          visualAcuity: generateVisualAcuity(),
          refraction: {
            objective: generateRefraction(),
            subjective: generateRefraction()
          },
          iop: generateIOP(),
          keratometry: generateKeratometry(),
          diagnoses,
          anteriorSegment: {
            OD: { conjunctiva: 'calme', cornea: 'claire', iris: 'normal', lens: 'claire' },
            OS: { conjunctiva: 'calme', cornea: 'claire', iris: 'normal', lens: 'claire' }
          },
          posteriorSegment: {
            OD: { vitreous: 'clair', opticDisc: 'normal', macula: 'normale', vessels: 'normaux' },
            OS: { vitreous: 'clair', opticDisc: 'normal', macula: 'normale', vessels: 'normaux' }
          },
          plan: diagnoses.length > 0 ? 'Surveillance et traitement adapté' : 'Correction optique à renouveler',
          status: 'completed'
        });
        examsCreated++;

        // Create imaging study if applicable
        if (hasImaging) {
          const imagingTypes = ['OCT', 'Fundus Photo', 'Visual Field', 'Topography'];
          const imagingType = imagingTypes[Math.floor(Math.random() * imagingTypes.length)];

          await ImagingStudy.create({
            patient: patient._id,
            visit: visit._id,
            clinic: clinic._id,
            studyDate: visitDate,
            modality: imagingType,
            deviceName: `${imagingType} Device`,
            status: 'final',
            interpretation: {
              status: 'final',
              findings: `Examen ${imagingType} sans anomalie significative`
            },
            images: [{
              filename: `${imagingType.toLowerCase().replace(' ', '_')}_${Date.now()}.jpg`,
              contentType: 'image/jpeg',
              eye: ['OD', 'OS'][Math.floor(Math.random() * 2)],
              capturedAt: visitDate
            }],
            performedBy: doctor?._id
          });
          imagingCreated++;
        }

        // Link existing documents to visit if applicable
        if (hasDocs) {
          await Document.updateMany(
            { patient: patient._id, visit: { $exists: false } },
            { $set: { visit: visit._id } },
            { limit: 1 }
          );
        }
      }

      console.log(`  ✓ Created ${numVisits} visits with exams`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('SEEDING COMPLETE');
    console.log('='.repeat(50));
    console.log(`Patients updated: ${updatedCount}`);
    console.log(`Visits created: ${visitsCreated}`);
    console.log(`Exams created: ${examsCreated}`);
    console.log(`Imaging studies created: ${imagingCreated}`);

    // Verify the data
    console.log('\n=== VERIFICATION ===');
    const verifyPatient = await Patient.findOne({ profession: { $exists: true, $ne: null } });
    if (verifyPatient) {
      console.log(`\nSample Patient: ${verifyPatient.lastName} ${verifyPatient.firstName}`);
      console.log(`  Photo: ${verifyPatient.photo ? 'YES' : 'NO'}`);
      console.log(`  Profession: ${verifyPatient.profession}`);
      console.log(`  Referring Doctor: ${verifyPatient.referringDoctor}`);
      console.log(`  Phone: ${verifyPatient.phone}`);
      console.log(`  Allergies: ${verifyPatient.allergies?.length || 0}`);
    }

    const visitsWithData = await Visit.countDocuments({ hasImages: true });
    console.log(`\nVisits with images flag: ${visitsWithData}`);

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

seedRealisticData();
