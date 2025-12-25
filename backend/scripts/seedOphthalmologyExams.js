#!/usr/bin/env node
/**
 * Ophthalmology Exam Data Seeder
 * ==============================
 * Populates the system with realistic ophthalmology exam data for dashboard testing.
 *
 * Creates:
 * - 30+ completed ophthalmology exams
 * - Refraction data (autorefractor + subjective)
 * - IOP readings with various methods
 * - Diagnostic codes (Myopia, Presbyopia, Glaucoma, etc.)
 * - Linked to existing patients and clinics
 *
 * Usage: node scripts/seedOphthalmologyExams.js [--count=N]
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedOphthalmologyExams.js');

// Models
const OphthalmologyExam = require('../models/OphthalmologyExam');
const Patient = require('../models/Patient');
const User = require('../models/User');
const Clinic = require('../models/Clinic');

// Parse arguments
const args = process.argv.slice(2);
const countArg = args.find(a => a.startsWith('--count='));
const BASE_COUNT = countArg ? parseInt(countArg.split('=')[1]) : 30;

// Helper functions
function randomElement(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  const value = Math.random() * (max - min) + min;
  return parseFloat(value.toFixed(decimals));
}

function randomDate(daysBack = 90) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  return date;
}

// Visual acuity values (Monoyer scale)
const MONOYER_VALUES = ['10/10', '9/10', '8/10', '7/10', '6/10', '5/10', '4/10', '3/10', '2/10', '1/10', '1/20', '1/50', 'CLD', 'VBLM'];

// Parinaud near vision values
const PARINAUD_VALUES = ['P1.5', 'P2', 'P3', 'P4', 'P5', 'P6', 'P8', 'P10', 'P14', 'P20'];

// IOP methods
const IOP_METHODS = ['goldmann', 'tonopen', 'icare', 'nct'];

// Exam types
const EXAM_TYPES = ['comprehensive', 'routine', 'refraction', 'follow-up', 'screening'];

// Common ophthalmology diagnoses with ICD codes
const DIAGNOSES = [
  { diagnosis: 'Myopie', icdCode: 'H52.1', severity: 'mild' },
  { diagnosis: 'Hypermétropie', icdCode: 'H52.0', severity: 'mild' },
  { diagnosis: 'Astigmatisme', icdCode: 'H52.2', severity: 'mild' },
  { diagnosis: 'Presbytie', icdCode: 'H52.4', severity: 'moderate' },
  { diagnosis: 'Cataracte sénile', icdCode: 'H25.9', severity: 'moderate' },
  { diagnosis: 'Glaucome à angle ouvert', icdCode: 'H40.1', severity: 'moderate' },
  { diagnosis: 'Glaucome à angle fermé', icdCode: 'H40.2', severity: 'severe' },
  { diagnosis: 'Dégénérescence maculaire liée à l\'âge (DMLA)', icdCode: 'H35.3', severity: 'moderate' },
  { diagnosis: 'Rétinopathie diabétique', icdCode: 'E11.3', severity: 'moderate' },
  { diagnosis: 'Œil sec', icdCode: 'H04.12', severity: 'mild' },
  { diagnosis: 'Conjonctivite allergique', icdCode: 'H10.1', severity: 'mild' },
  { diagnosis: 'Blépharite', icdCode: 'H01.0', severity: 'mild' },
  { diagnosis: 'Kératocône', icdCode: 'H18.6', severity: 'moderate' },
  { diagnosis: 'Strabisme', icdCode: 'H50.9', severity: 'mild' },
  { diagnosis: 'Amblyopie', icdCode: 'H53.0', severity: 'moderate' }
];

// Chief complaints
const CHIEF_COMPLAINTS = [
  { complaint: 'Baisse de vision de loin', duration: '3 mois', severity: 'moderate' },
  { complaint: 'Difficulté à lire', duration: '6 mois', severity: 'mild' },
  { complaint: 'Vision floue', duration: '1 mois', severity: 'moderate' },
  { complaint: 'Maux de tête après lecture', duration: '2 semaines', severity: 'mild' },
  { complaint: 'Yeux rouges', duration: '3 jours', severity: 'moderate' },
  { complaint: 'Démangeaisons oculaires', duration: '1 semaine', severity: 'mild' },
  { complaint: 'Douleur oculaire', duration: '2 jours', severity: 'severe' },
  { complaint: 'Vision double', duration: '1 mois', severity: 'moderate' },
  { complaint: 'Larmoiement excessif', duration: '2 semaines', severity: 'mild' },
  { complaint: 'Mouches volantes', duration: '1 mois', severity: 'mild' }
];

// Stats tracking
const stats = {
  examsCreated: 0,
  diagnosisCounts: {},
  examTypes: {}
};

function generateRefraction() {
  // Generate realistic refraction values
  const sphereRange = [-10, 8]; // Myopia to hyperopia
  const cylinderRange = [-4, 0]; // Typical astigmatism

  const odSphere = randomFloat(sphereRange[0], sphereRange[1], 2);
  const osSphere = randomFloat(sphereRange[0], sphereRange[1], 2);
  const odCylinder = randomFloat(cylinderRange[0], cylinderRange[1], 2);
  const osCylinder = randomFloat(cylinderRange[0], cylinderRange[1], 2);
  const odAxis = randomInt(1, 180);
  const osAxis = randomInt(1, 180);

  // Add for presbyopic patients (age-related near vision)
  const add = Math.random() > 0.5 ? randomFloat(0.75, 3.0, 2) : 0;

  return {
    objective: {
      autorefractor: {
        OD: {
          sphere: odSphere,
          cylinder: odCylinder,
          axis: odAxis,
          confidence: randomInt(80, 100)
        },
        OS: {
          sphere: osSphere,
          cylinder: osCylinder,
          axis: osAxis,
          confidence: randomInt(80, 100)
        }
      }
    },
    subjective: {
      OD: {
        sphere: odSphere + randomFloat(-0.5, 0.5, 2),
        cylinder: odCylinder,
        axis: odAxis,
        va: randomElement(MONOYER_VALUES.slice(0, 5)), // Good vision with correction
        parinaud: randomElement(PARINAUD_VALUES.slice(0, 4))
      },
      OS: {
        sphere: osSphere + randomFloat(-0.5, 0.5, 2),
        cylinder: osCylinder,
        axis: osAxis,
        va: randomElement(MONOYER_VALUES.slice(0, 5)),
        parinaud: randomElement(PARINAUD_VALUES.slice(0, 4))
      },
      add: add,
      vertexDistance: 12
    },
    finalPrescription: {
      OD: {
        sphere: Math.round((odSphere + randomFloat(-0.25, 0.25, 2)) * 4) / 4, // Round to 0.25
        cylinder: Math.round(odCylinder * 4) / 4,
        axis: odAxis,
        add: add,
        va: randomElement(MONOYER_VALUES.slice(0, 3)),
        parinaud: add > 0 ? randomElement(PARINAUD_VALUES.slice(0, 3)) : null
      },
      OS: {
        sphere: Math.round((osSphere + randomFloat(-0.25, 0.25, 2)) * 4) / 4,
        cylinder: Math.round(osCylinder * 4) / 4,
        axis: osAxis,
        add: add,
        va: randomElement(MONOYER_VALUES.slice(0, 3)),
        parinaud: add > 0 ? randomElement(PARINAUD_VALUES.slice(0, 3)) : null
      },
      pd: {
        distance: randomInt(58, 68),
        near: randomInt(55, 65)
      },
      prescriptionStatus: {
        status: 'prescribed',
        lensTypes: add > 0 ? ['progressive'] : ['far'],
        prescribedAt: new Date()
      }
    }
  };
}

function generateIOP() {
  const method = randomElement(IOP_METHODS);

  // Normal IOP 10-21 mmHg, some elevated for glaucoma cases
  const isElevated = Math.random() > 0.85;
  const baseIOP = isElevated ? randomInt(22, 35) : randomInt(10, 21);

  return {
    OD: {
      value: baseIOP + randomInt(-2, 2),
      time: `${randomInt(8, 18)}:${randomInt(0, 59).toString().padStart(2, '0')}`,
      method: method
    },
    OS: {
      value: baseIOP + randomInt(-2, 2),
      time: `${randomInt(8, 18)}:${randomInt(0, 59).toString().padStart(2, '0')}`,
      method: method
    },
    pachymetry: {
      OD: randomInt(490, 600),
      OS: randomInt(490, 600)
    }
  };
}

function generateVisualAcuity() {
  const uncorrectedIndex = randomInt(3, 10); // Uncorrected is often worse
  const correctedIndex = randomInt(0, 3); // Corrected should be better

  return {
    distance: {
      OD: {
        uncorrected: MONOYER_VALUES[uncorrectedIndex],
        corrected: MONOYER_VALUES[correctedIndex],
        pinhole: MONOYER_VALUES[Math.min(correctedIndex + 1, 3)]
      },
      OS: {
        uncorrected: MONOYER_VALUES[uncorrectedIndex + randomInt(-1, 1)],
        corrected: MONOYER_VALUES[correctedIndex],
        pinhole: MONOYER_VALUES[Math.min(correctedIndex + 1, 3)]
      },
      OU: {
        uncorrected: MONOYER_VALUES[Math.max(0, uncorrectedIndex - 1)],
        corrected: MONOYER_VALUES[correctedIndex]
      }
    },
    near: {
      OD: {
        uncorrected: PARINAUD_VALUES[randomInt(3, 8)],
        corrected: PARINAUD_VALUES[randomInt(0, 3)]
      },
      OS: {
        uncorrected: PARINAUD_VALUES[randomInt(3, 8)],
        corrected: PARINAUD_VALUES[randomInt(0, 3)]
      },
      OU: {
        uncorrected: PARINAUD_VALUES[randomInt(2, 7)],
        corrected: PARINAUD_VALUES[randomInt(0, 2)]
      },
      testDistance: '40cm'
    },
    method: 'decimal'
  };
}

function generateDiagnoses() {
  // 1-3 diagnoses per exam
  const count = randomInt(1, 3);
  const selectedDiagnoses = [];
  const usedIndices = new Set();

  for (let i = 0; i < count; i++) {
    let idx;
    do {
      idx = randomInt(0, DIAGNOSES.length - 1);
    } while (usedIndices.has(idx));
    usedIndices.add(idx);

    const diag = DIAGNOSES[idx];
    const eye = randomElement(['OD', 'OS', 'OU']);

    selectedDiagnoses.push({
      eye: eye,
      diagnosis: diag.diagnosis,
      icdCode: diag.icdCode,
      severity: diag.severity,
      status: randomElement(['new', 'stable', 'worsening', 'improving'])
    });

    stats.diagnosisCounts[diag.diagnosis] = (stats.diagnosisCounts[diag.diagnosis] || 0) + 1;
  }

  return selectedDiagnoses;
}

let examCounter = 0;

async function createOphthalmologyExam(patient, clinic, examiner) {
  const examType = randomElement(EXAM_TYPES);
  const chiefComplaint = randomElement(CHIEF_COMPLAINTS);
  const examDate = randomDate(90);

  stats.examTypes[examType] = (stats.examTypes[examType] || 0) + 1;
  examCounter++;

  // Generate unique examId to avoid race conditions
  const year = examDate.getFullYear();
  const month = String(examDate.getMonth() + 1).padStart(2, '0');
  const day = String(examDate.getDate()).padStart(2, '0');
  const uniqueId = `EYE${year}${month}${day}${Date.now().toString().slice(-6)}${examCounter.toString().padStart(4, '0')}`;

  const exam = new OphthalmologyExam({
    examId: uniqueId,
    patient: patient._id,
    clinic: clinic._id,
    examiner: examiner._id,
    examType: examType,

    chiefComplaint: {
      complaint: chiefComplaint.complaint,
      duration: chiefComplaint.duration,
      severity: chiefComplaint.severity,
      laterality: randomElement(['OD', 'OS', 'OU'])
    },

    visualAcuity: generateVisualAcuity(),
    refraction: generateRefraction(),
    iop: generateIOP(),

    keratometry: {
      OD: {
        k1: { power: randomFloat(40, 46, 2), axis: randomInt(1, 180) },
        k2: { power: randomFloat(40, 46, 2), axis: randomInt(1, 180) },
        average: randomFloat(41, 45, 2),
        cylinder: randomFloat(-3, 0, 2),
        axis: randomInt(1, 180)
      },
      OS: {
        k1: { power: randomFloat(40, 46, 2), axis: randomInt(1, 180) },
        k2: { power: randomFloat(40, 46, 2), axis: randomInt(1, 180) },
        average: randomFloat(41, 45, 2),
        cylinder: randomFloat(-3, 0, 2),
        axis: randomInt(1, 180)
      },
      method: 'auto-k'
    },

    pupils: {
      OD: {
        size: { photopic: randomFloat(2, 4, 1), scotopic: randomFloat(4, 7, 1) },
        shape: 'round',
        reaction: { direct: 'brisk', consensual: 'present' },
        apd: 'absent'
      },
      OS: {
        size: { photopic: randomFloat(2, 4, 1), scotopic: randomFloat(4, 7, 1) },
        shape: 'round',
        reaction: { direct: 'brisk', consensual: 'present' },
        apd: 'absent'
      }
    },

    slitLamp: {
      OD: {
        lids: { normal: true, findings: '' },
        lashes: { normal: true, findings: '' },
        conjunctiva: { normal: true, findings: '' },
        cornea: { normal: true, findings: '', staining: '' },
        anteriorChamber: { depth: 'deep', cells: 0, flare: 0 }
      },
      OS: {
        lids: { normal: true, findings: '' },
        lashes: { normal: true, findings: '' },
        conjunctiva: { normal: true, findings: '' },
        cornea: { normal: true, findings: '', staining: '' },
        anteriorChamber: { depth: 'deep', cells: 0, flare: 0 }
      }
    },

    assessment: {
      diagnoses: generateDiagnoses(),
      summary: `Examen ${examType} réalisé. Patient présente ${chiefComplaint.complaint.toLowerCase()}.`
    },

    plan: {
      procedures: [],
      medications: [],
      followUp: {
        required: Math.random() > 0.3,
        interval: randomElement([30, 90, 180, 365]),
        reason: 'Suivi de routine'
      },
      referrals: [],
      patientEducation: ['Hygiène oculaire', 'Port de lunettes']
    },

    status: 'completed',
    completedAt: examDate,
    createdBy: examiner._id,
    updatedBy: examiner._id,
    createdAt: examDate,
    updatedAt: examDate
  });

  await exam.save();
  stats.examsCreated++;
  return exam;
}

async function seedOphthalmologyExams() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔗 Connected to MongoDB\n');

    // Load reference data
    console.log('📚 Loading reference data...');
    const patients = await Patient.find({}).limit(100).lean();
    const users = await User.find({ isActive: true }).lean();
    const clinics = await Clinic.find({}).lean();

    if (patients.length === 0) {
      throw new Error('No patients found. Run patient import first.');
    }

    if (clinics.length === 0) {
      throw new Error('No clinics found. Run clinic seeding first.');
    }

    const doctors = users.filter(u => ['doctor', 'ophthalmologist', 'admin'].includes(u.role));
    if (doctors.length === 0) {
      doctors.push(...users.slice(0, 3));
    }

    console.log(`  Found ${patients.length} patients, ${doctors.length} doctors, ${clinics.length} clinics\n`);

    // Clean up previous test exams
    console.log('🧹 Cleaning up previous test exams...');
    const deleteResult = await OphthalmologyExam.deleteMany({
      'assessment.summary': { $regex: /^Examen (comprehensive|routine|refraction|follow-up|screening) réalisé/ }
    });
    console.log(`  Deleted ${deleteResult.deletedCount} previous test exams\n`);

    // Create ophthalmology exams
    console.log('👁️ Creating ophthalmology exam data...\n');

    for (let i = 0; i < BASE_COUNT; i++) {
      const patient = randomElement(patients);
      const clinic = randomElement(clinics);
      const examiner = randomElement(doctors);

      await createOphthalmologyExam(patient, clinic, examiner);

      if ((i + 1) % 10 === 0) {
        console.log(`  Created ${i + 1}/${BASE_COUNT} exams`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Ophthalmology Exam Data Summary');
    console.log('='.repeat(50));
    console.log(`Total exams created: ${stats.examsCreated}`);

    console.log('\nExam types:');
    for (const [type, count] of Object.entries(stats.examTypes)) {
      console.log(`  - ${type}: ${count}`);
    }

    console.log('\nTop diagnoses:');
    const sortedDiagnoses = Object.entries(stats.diagnosisCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [diag, count] of sortedDiagnoses) {
      console.log(`  - ${diag}: ${count}`);
    }

    console.log('\n✅ Ophthalmology exam data seeding complete!');
    console.log('   The Ophthalmology Dashboard should now show exam stats.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedOphthalmologyExams();
