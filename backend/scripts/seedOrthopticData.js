#!/usr/bin/env node
/**
 * Orthoptic Data Seeder
 * =====================
 * Populates the system with orthoptic exam data for dashboard testing.
 *
 * Creates:
 * - 25+ orthoptic exams with various findings
 * - Treatment plans and follow-ups
 * - Session tracking for ongoing cases
 *
 * Usage: node scripts/seedOrthopticData.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedOrthopticData.js');

// Models
const OrthopticExam = require('../models/OrthopticExam');
const Patient = require('../models/Patient');
const User = require('../models/User');

// Helper functions
function randomElement(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysBack = 90) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  return date;
}

// Monoyer scale visual acuity values
const MONOYER_VALUES = ['10/10', '9/10', '8/10', '7/10', '6/10', '5/10', '4/10', '3/10', '2/10', '1/10'];

// Parinaud near vision values
const PARINAUD_VALUES = ['P1.5', 'P2', 'P3', 'P4', 'P5', 'P6', 'P8', 'P10', 'P14', 'P20'];

// Cover test values
const COVER_TEST_VALUES = ['E', "E'", 'Et', 'X', "X'", 'Xt', 'HD', 'HG', 'Orthophorie'];

// Motility values
const MOTILITY_VALUES = ['Normal', 'Hyperaction', 'Limitation', 'Parésie', 'Sous action'];

// Diagnoses for orthoptic exams
const ORTHOPTIC_DIAGNOSES = [
  { code: 'H50.0', description: 'Esotropia', descriptionFr: 'Ésotropie' },
  { code: 'H50.1', description: 'Exotropia', descriptionFr: 'Exotropie' },
  { code: 'H50.2', description: 'Vertical strabismus', descriptionFr: 'Strabisme vertical' },
  { code: 'H50.4', description: 'Heterophoria', descriptionFr: 'Hétérophorie' },
  { code: 'H51.1', description: 'Convergence insufficiency', descriptionFr: 'Insuffisance de convergence' },
  { code: 'H51.8', description: 'Accommodative dysfunction', descriptionFr: 'Dysfonction accommodative' },
  { code: 'H53.2', description: 'Diplopia', descriptionFr: 'Diplopie' },
  { code: 'H53.3', description: 'Visual discomfort', descriptionFr: 'Inconfort visuel' }
];

// Conclusion types
const CONCLUSION_TYPES = [
  'Phorie décompensée VL',
  'Phorie décompensée VP',
  'Phorie compensée',
  'Tropie',
  'Micro tropie',
  'Insuffisance de convergence',
  'Excès de convergence'
];

// Treatment types
const TREATMENT_TYPES = [
  'reeducation_orthoptique',
  'barre_lecture',
  'diploscope',
  'synoptophore',
  'exercices_domicile',
  'prismes',
  'combined'
];

// Stats tracking
const stats = {
  examsCreated: 0,
  byType: {},
  withTreatment: 0
};

let examCounter = 0;

function generateMotility() {
  const createEyeMotility = () => ({
    droitExterne: randomElement(MOTILITY_VALUES),
    droitInterne: randomElement(MOTILITY_VALUES),
    droitSuperieur: randomElement(MOTILITY_VALUES),
    droitInferieur: randomElement(MOTILITY_VALUES),
    grandOblique: randomElement(MOTILITY_VALUES),
    petitOblique: randomElement(MOTILITY_VALUES)
  });

  return {
    OD: createEyeMotility(),
    OS: createEyeMotility(),
    versions: randomElement(['Normales', 'Légère limitation en adduction OG', 'Hyperaction PO OD']),
    notes: ''
  };
}

function generateVisualAcuity() {
  return {
    distance: {
      OD: {
        withoutCorrection: randomElement(MONOYER_VALUES),
        withCorrection: randomElement(MONOYER_VALUES.slice(0, 4)),
        scale: 'dixiemes'
      },
      OS: {
        withoutCorrection: randomElement(MONOYER_VALUES),
        withCorrection: randomElement(MONOYER_VALUES.slice(0, 4)),
        scale: 'dixiemes'
      },
      OU: {
        withoutCorrection: randomElement(MONOYER_VALUES),
        withCorrection: randomElement(MONOYER_VALUES.slice(0, 3)),
        scale: 'dixiemes'
      }
    },
    near: {
      OD: {
        withoutCorrection: randomElement(PARINAUD_VALUES),
        withCorrection: randomElement(PARINAUD_VALUES.slice(0, 4)),
        scale: 'parinaud'
      },
      OS: {
        withoutCorrection: randomElement(PARINAUD_VALUES),
        withCorrection: randomElement(PARINAUD_VALUES.slice(0, 4)),
        scale: 'parinaud'
      },
      OU: {
        withoutCorrection: randomElement(PARINAUD_VALUES),
        withCorrection: randomElement(PARINAUD_VALUES.slice(0, 3)),
        scale: 'parinaud'
      }
    }
  };
}

function generateCoverTest() {
  return {
    distance: {
      uncover: randomElement(COVER_TEST_VALUES),
      alternating: randomElement(COVER_TEST_VALUES),
      measurement: `${randomInt(0, 20)}∆`,
      notes: ''
    },
    near: {
      uncover: randomElement(COVER_TEST_VALUES),
      alternating: randomElement(COVER_TEST_VALUES),
      measurement: `${randomInt(0, 25)}∆`,
      notes: ''
    }
  };
}

function generateStereopsis() {
  const wirtCircles = ['40', '50', '60', '80', '100', '140', '200', '400', '800'];
  const wirtArc = [40, 50, 60, 80, 100, 140, 200, 400, 800];
  const wirtIndex = randomInt(0, wirtCircles.length - 1);

  return {
    wirtTest: {
      fly: Math.random() > 0.1,
      animals: randomElement(['all_correct', 'partial', 'none']),
      circles: wirtCircles[wirtIndex],
      secondsOfArc: wirtArc[wirtIndex]
    },
    langTest: {
      chat: Math.random() > 0.2,
      etoile: Math.random() > 0.3,
      voiture: Math.random() > 0.2,
      level: randomElement(['550', '600', '1200'])
    },
    tnoTest: {
      plates: randomInt(1, 7),
      stereopsis: randomElement(['excellent', 'good', 'fair', 'poor']),
      dominance: randomElement(['OD', 'OS', 'none', 'alternating'])
    }
  };
}

function generateNearPointConvergence() {
  const breakPoint = randomInt(5, 25);
  return {
    break: breakPoint,
    recovery: breakPoint + randomInt(2, 8),
    ease: randomElement(['facile', 'moyen', 'difficile']),
    quality: randomElement(['bon', 'moyen', 'faible'])
  };
}

function generateWorthTest() {
  const results = ['fusion', 'diplopie_croisee', 'diplopie_homonyme', 'neutralisation_OD', 'neutralisation_OS'];
  return {
    distance: {
      result: randomElement(results),
      description: ''
    },
    near: {
      result: randomElement(results),
      description: ''
    }
  };
}

function generateVergences() {
  return {
    convergence: {
      C: randomInt(15, 45),
      Cprime: randomInt(10, 35)
    },
    divergence: {
      D: randomInt(4, 15),
      Dprime: randomInt(2, 10)
    },
    vertical: {
      up: randomInt(2, 8),
      down: randomInt(2, 8)
    }
  };
}

function generateTreatment() {
  const prescribed = Math.random() > 0.3;
  if (!prescribed) {
    return { prescribed: false };
  }

  stats.withTreatment++;
  const treatmentType = randomElement(TREATMENT_TYPES);

  return {
    prescribed: true,
    type: treatmentType,
    frequency: randomElement(['1 fois par semaine', '2 fois par semaine', '3 fois par semaine']),
    duration: randomElement(['6 semaines', '8 semaines', '12 semaines']),
    exercises: [{
      name: 'Convergence en marches',
      description: 'Exercices de rapprochement progressif',
      frequency: '5 minutes, 3x/jour'
    }],
    prisms: treatmentType === 'prismes' ? {
      prescribed: true,
      OD: { horizontal: randomInt(1, 6), vertical: 0, base: 'in' },
      OS: { horizontal: randomInt(1, 6), vertical: 0, base: 'in' }
    } : { prescribed: false }
  };
}

function generateFunctionalSigns() {
  return {
    cephalees: Math.random() > 0.5,
    diplopie: Math.random() > 0.7,
    fatigue: Math.random() > 0.4,
    brulures: Math.random() > 0.6,
    flou: Math.random() > 0.5,
    photophobie: Math.random() > 0.7,
    douleurOculaire: Math.random() > 0.6,
    asthenopie: Math.random() > 0.4
  };
}

async function createOrthopticExam(patient, examiner, index) {
  examCounter++;
  const examDate = randomDate(90);
  const examType = randomElement(['initial', 'follow-up', 'pre-treatment', 'post-treatment']);
  const diagnosis = randomElement(ORTHOPTIC_DIAGNOSES);
  const conclusionType = randomElement(CONCLUSION_TYPES);

  stats.byType[examType] = (stats.byType[examType] || 0) + 1;

  const exam = new OrthopticExam({
    examId: `ORTHO${Date.now().toString().slice(-8)}${examCounter.toString().padStart(4, '0')}`,
    patient: patient._id,
    examiner: examiner._id,
    examDate: examDate,
    examType: examType,

    sessionInfo: examType === 'follow-up' ? {
      sessionNumber: randomInt(2, 12),
      totalSessions: 12,
      treatmentPlan: '12_sessions'
    } : undefined,

    visualAcuity: generateVisualAcuity(),
    motility: generateMotility(),
    coverTest: generateCoverTest(),
    stereopsis: generateStereopsis(),
    worthTest: generateWorthTest(),
    nearPointConvergence: generateNearPointConvergence(),
    vergences: generateVergences(),
    functionalSigns: generateFunctionalSigns(),

    convergenceReflex: {
      quality: randomElement(['bon', 'moyen', 'faible']),
      symmetry: Math.random() > 0.3
    },

    diagnosis: [{
      code: diagnosis.code,
      description: diagnosis.description,
      descriptionFr: diagnosis.descriptionFr,
      eye: 'OU',
      severity: randomElement(['mild', 'moderate', 'severe'])
    }],

    conclusion: {
      type: conclusionType,
      recommendations: [
        'Rééducation orthoptique recommandée',
        'Contrôle dans 6 semaines'
      ],
      followUpRequired: true,
      followUpTiming: randomElement(['4 semaines', '6 semaines', '8 semaines', '3 mois'])
    },

    treatment: generateTreatment(),

    status: randomElement(['completed', 'signed', 'completed', 'signed']),
    completedAt: examDate,
    signedBy: examiner._id,
    signedAt: examDate,

    notes: `Examen orthoptique - ${diagnosis.descriptionFr}. Patient coopérant.`
  });

  await exam.save();
  stats.examsCreated++;
  return exam;
}

async function seedOrthopticData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔗 Connected to MongoDB\n');

    // Load reference data
    console.log('📚 Loading reference data...');
    const patients = await Patient.find({}).limit(50).lean();
    const users = await User.find({ isActive: true }).lean();

    if (patients.length === 0) throw new Error('No patients found');

    const orthoptists = users.filter(u => ['orthoptist', 'doctor', 'ophthalmologist', 'admin'].includes(u.role));
    if (orthoptists.length === 0) orthoptists.push(...users.slice(0, 3));

    console.log(`  Found ${patients.length} patients, ${orthoptists.length} orthoptists\n`);

    // Clean up
    console.log('🧹 Cleaning up previous orthoptic data...');
    await OrthopticExam.deleteMany({});
    console.log('  ✅ Cleaned\n');

    // Create orthoptic exams
    console.log('👁️ Creating orthoptic exams...\n');
    const count = 25;

    for (let i = 0; i < count; i++) {
      const patient = randomElement(patients);
      const examiner = randomElement(orthoptists);

      await createOrthopticExam(patient, examiner, i);

      if ((i + 1) % 5 === 0) {
        console.log(`  Created ${i + 1}/${count} exams`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Orthoptic Data Summary');
    console.log('='.repeat(50));
    console.log(`Total exams created: ${stats.examsCreated}`);
    console.log(`Exams with treatment: ${stats.withTreatment}`);

    console.log('\nBy exam type:');
    for (const [type, count] of Object.entries(stats.byType)) {
      console.log(`  - ${type}: ${count}`);
    }

    console.log('\n✅ Orthoptic data seeding complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedOrthopticData();
