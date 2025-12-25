#!/usr/bin/env node
/**
 * IVT (Intravitreal Injection) Data Seeder
 * =========================================
 * Populates the system with IVT vials and injections for dashboard testing.
 *
 * Creates:
 * - 5 IVT vials (Lucentis, Eylea, Avastin)
 * - 20+ IVT injections with protocols
 * - Complication tracking
 * - Follow-up schedules
 *
 * Usage: node scripts/seedIVTData.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedIVTData.js');

// Models
const IVTVial = require('../models/IVTVial');
const IVTInjection = require('../models/IVTInjection');
const Patient = require('../models/Patient');
const User = require('../models/User');
const Clinic = require('../models/Clinic');

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

function futureDate(daysAhead = 30) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date;
}

// IVT Medications (anti-VEGF only to avoid interval validation issues)
const IVT_MEDICATIONS = [
  {
    name: 'Lucentis',
    genericName: 'Ranibizumab',
    type: 'anti-VEGF',
    manufacturer: 'Novartis',
    concentration: '10mg/mL',
    totalVolume: 0.23,
    dosesPerVial: 1,
    doseValue: 0.5,
    doseUnit: 'mg'
  },
  {
    name: 'Eylea',
    genericName: 'Aflibercept',
    type: 'anti-VEGF',
    manufacturer: 'Regeneron/Bayer',
    concentration: '40mg/mL',
    totalVolume: 0.278,
    dosesPerVial: 1,
    doseValue: 2,
    doseUnit: 'mg'
  },
  {
    name: 'Avastin',
    genericName: 'Bevacizumab',
    type: 'anti-VEGF',
    manufacturer: 'Roche',
    concentration: '25mg/mL',
    totalVolume: 4,
    dosesPerVial: 10,
    doseValue: 1.25,
    doseUnit: 'mg'
  },
  {
    name: 'Beovu',
    genericName: 'Brolucizumab',
    type: 'anti-VEGF',
    manufacturer: 'Novartis',
    concentration: '120mg/mL',
    totalVolume: 0.05,
    dosesPerVial: 1,
    doseValue: 6,
    doseUnit: 'mg'
  }
];

// Indications
const INDICATIONS = [
  { primary: 'wet_AMD', icdCode: 'H35.32', description: 'DMLA humide' },
  { primary: 'DME', icdCode: 'H36.0', description: 'Œdème maculaire diabétique' },
  { primary: 'BRVO', icdCode: 'H34.81', description: 'Occlusion de branche veineuse rétinienne' },
  { primary: 'CRVO', icdCode: 'H34.81', description: 'Occlusion de la veine centrale de la rétine' },
  { primary: 'myopic_CNV', icdCode: 'H44.2', description: 'Néovascularisation choroïdienne myopique' },
  { primary: 'PDR', icdCode: 'E11.35', description: 'Rétinopathie diabétique proliférante' }
];

// Stats tracking
const stats = {
  vialsCreated: 0,
  injectionsCreated: 0,
  byMedication: {}
};

let vialCounter = 0;
let injectionCounter = 0;

async function createIVTVials(clinic, user) {
  console.log('  Creating IVT vials...');
  const vials = [];

  for (const med of IVT_MEDICATIONS) {
    vialCounter++;
    const lotNumber = `LOT${Date.now().toString().slice(-6)}${vialCounter.toString().padStart(3, '0')}`;

    const vial = new IVTVial({
      vialNumber: `VIA${Date.now().toString().slice(-8)}${vialCounter.toString().padStart(4, '0')}`,
      medication: {
        name: med.name,
        genericName: med.genericName,
        manufacturer: med.manufacturer,
        concentration: med.concentration,
        totalVolume: med.totalVolume,
        dosesPerVial: med.dosesPerVial
      },
      lotNumber: lotNumber,
      expirationDate: futureDate(365),
      storage: {
        requiredTempMin: 2,
        requiredTempMax: 8,
        lightSensitive: true,
        currentLocation: 'pharmacy_refrigerator'
      },
      dosesUsed: 0,
      dosesRemaining: med.dosesPerVial,
      currentStatus: 'in_stock',
      receivedBy: user._id,
      receivedAt: randomDate(30),
      clinic: clinic._id,
      createdBy: user._id
    });

    await vial.save();
    vials.push(vial);
    stats.vialsCreated++;
  }

  console.log(`    ✅ Created ${stats.vialsCreated} vials`);
  return vials;
}

async function createIVTInjections(patients, doctors, clinic, vials) {
  console.log('  Creating IVT injections...');
  const count = 20;
  let skipped = 0;

  for (let i = 0; i < count; i++) {
    try {
      injectionCounter++;
      const patient = randomElement(patients);
      const doctor = randomElement(doctors);
      const medication = randomElement(IVT_MEDICATIONS);
      const indication = randomElement(INDICATIONS);
      const eye = randomElement(['OD', 'OS']);
      const injectionDate = randomDate(90);

      const injectionNumber = randomInt(1, 12);
      const protocol = injectionNumber <= 3 ? 'loading' : randomElement(['treat_and_extend', 'PRN', 'maintenance_monthly', 'maintenance_q8w']);

      const injection = new IVTInjection({
        injectionId: `IVT${Date.now().toString().slice(-8)}${injectionCounter.toString().padStart(4, '0')}`,
        patient: patient._id,
        eye: eye,
        injectionDate: injectionDate,
        performedBy: doctor._id,
        clinic: clinic._id,

        medication: {
          type: medication.type,
          name: medication.name,
          genericName: medication.genericName,
          dose: {
            value: medication.doseValue,
            unit: medication.doseUnit
          },
          volume: {
            value: 0.05,
            unit: 'ml'
          },
          lotNumber: `LOT${Date.now().toString().slice(-6)}`,
          manufacturer: medication.manufacturer
        },

        indication: {
          primary: indication.primary,
          icdCode: indication.icdCode,
          description: indication.description,
          descriptionFr: indication.description
        },

        series: {
          injectionNumber: injectionNumber,
          protocol: protocol,
          targetInterval: randomInt(28, 84),
          cumulativeDose: injectionNumber * medication.doseValue
        },

        preInjection: {
          iop: {
            value: randomInt(12, 18),
            time: '09:00',
            method: 'icare'
          },
          bestCorrectedVA: randomElement(['10/10', '8/10', '6/10', '4/10', '2/10']),
          pupilDilated: true,
          dilationAgent: 'Tropicamide 1%',
          anesthesia: {
            type: 'topical',
            agent: 'Oxybuprocaïne 0.4%'
          },
          antisepsis: {
            performed: true,
            agent: 'Povidone iodée 5%'
          }
        },

        procedure: {
          startTime: new Date(injectionDate.getTime()),
          endTime: new Date(injectionDate.getTime() + 10 * 60000),
          injectionSite: randomElement(['superotemporal', 'inferotemporal', 'superonasal']),
          distanceFromLimbus: 3.5,
          needleGauge: 30,
          speculumUsed: true,
          complications: {
            occurred: false
          }
        },

        postInjection: {
          immediateIOP: {
            value: randomInt(15, 30),
            time: new Date(injectionDate.getTime() + 5 * 60000).toISOString().slice(11, 16),
            method: 'palpation'
          },
          fingerCounting: true,
          antibioticGiven: true,
          antibioticName: 'Ofloxacine collyre',
          patientInstructions: 'Éviter le port de lentilles pendant 48h. Consulter en urgence si douleur, rougeur ou baisse de vision.'
        },

        followUp: {
          nextInjectionDate: futureDate(randomInt(28, 84)),
          nextExamDate: futureDate(randomInt(14, 30)),
          monitoring: ['VA', 'IOP', 'OCT']
        },

        status: 'completed',
        createdBy: doctor._id,
        updatedBy: doctor._id
      });

      await injection.save();
      stats.injectionsCreated++;
      stats.byMedication[medication.name] = (stats.byMedication[medication.name] || 0) + 1;
    } catch (err) {
      skipped++;
      // Skip validation errors silently (e.g., interval validations)
    }
  }

  console.log(`    ✅ Created ${stats.injectionsCreated} injections (${skipped} skipped due to validation)`);
}

async function seedIVTData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔗 Connected to MongoDB\n');

    // Load reference data
    console.log('📚 Loading reference data...');
    const patients = await Patient.find({}).limit(50).lean();
    const users = await User.find({ isActive: true }).lean();
    const clinics = await Clinic.find({}).lean();

    if (patients.length === 0) throw new Error('No patients found');
    if (clinics.length === 0) throw new Error('No clinics found');

    const doctors = users.filter(u => ['doctor', 'ophthalmologist', 'admin'].includes(u.role));
    if (doctors.length === 0) doctors.push(...users.slice(0, 3));

    const clinic = clinics[0];
    const admin = users.find(u => u.role === 'admin') || users[0];

    console.log(`  Found ${patients.length} patients, ${doctors.length} doctors\n`);

    // Clean up
    console.log('🧹 Cleaning up previous IVT data...');
    await IVTVial.deleteMany({});
    await IVTInjection.deleteMany({});
    console.log('  ✅ Cleaned\n');

    // Create data
    console.log('💉 Creating IVT data...\n');
    const vials = await createIVTVials(clinic, admin);
    await createIVTInjections(patients, doctors, clinic, vials);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 IVT Data Summary');
    console.log('='.repeat(50));
    console.log(`Vials created: ${stats.vialsCreated}`);
    console.log(`Injections created: ${stats.injectionsCreated}`);
    console.log('\nInjections by medication:');
    for (const [med, count] of Object.entries(stats.byMedication)) {
      console.log(`  - ${med}: ${count}`);
    }
    console.log('\n✅ IVT data seeding complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedIVTData();
