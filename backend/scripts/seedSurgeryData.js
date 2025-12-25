#!/usr/bin/env node
/**
 * Surgery Data Seeder
 * ====================
 * Populates the system with surgical cases for dashboard testing.
 *
 * Creates:
 * - 15+ surgical cases (cataract, glaucoma, retina)
 * - Various statuses (scheduled, completed, in_surgery)
 * - Pre-op checklists
 * - Surgeon assignments
 *
 * Usage: node scripts/seedSurgeryData.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedSurgeryData.js');

// Models
const SurgeryCase = require('../models/SurgeryCase');
const Invoice = require('../models/Invoice');
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

function randomDate(daysBack = 30) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  return date;
}

function futureDate(daysAhead = 30) {
  const date = new Date();
  date.setDate(date.getDate() + Math.floor(Math.random() * daysAhead) + 1);
  date.setHours(randomInt(8, 14), randomInt(0, 3) * 15, 0, 0);
  return date;
}

// Surgery types
const SURGERY_TYPES = [
  { description: 'Chirurgie de la cataracte - Phacoémulsification + IOL', duration: 45, eye: true },
  { description: 'Trabéculectomie (chirurgie du glaucome)', duration: 60, eye: true },
  { description: 'Vitrectomie postérieure', duration: 90, eye: true },
  { description: 'Chirurgie réfractive LASIK', duration: 30, eye: true },
  { description: 'Blépharoplastie', duration: 60, eye: false },
  { description: 'Exérèse de chalazion', duration: 20, eye: true },
  { description: 'Cure de ptérygion', duration: 45, eye: true },
  { description: 'Greffe de cornée (kératoplastie)', duration: 90, eye: true },
  { description: 'Chirurgie du strabisme', duration: 60, eye: true },
  { description: 'Implant de drainage pour glaucome', duration: 75, eye: true },
  { description: 'Cerclage scléral (décollement de rétine)', duration: 90, eye: true },
  { description: 'Injection sous-ténonienne', duration: 15, eye: true }
];

// Statuses with distribution
const STATUS_DISTRIBUTION = [
  { status: 'scheduled', weight: 4 },
  { status: 'awaiting_scheduling', weight: 2 },
  { status: 'completed', weight: 6 },
  { status: 'checked_in', weight: 1 },
  { status: 'in_surgery', weight: 1 }
];

function weightedRandomStatus() {
  const totalWeight = STATUS_DISTRIBUTION.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of STATUS_DISTRIBUTION) {
    random -= item.weight;
    if (random <= 0) return item.status;
  }
  return 'scheduled';
}

// Stats tracking
const stats = {
  casesCreated: 0,
  byStatus: {},
  byType: {}
};

let caseCounter = 0;

async function createSurgeryCase(patient, surgeon, clinic, invoice) {
  caseCounter++;
  const surgeryType = randomElement(SURGERY_TYPES);
  const status = weightedRandomStatus();
  const eye = surgeryType.eye ? randomElement(['OD', 'OS']) : 'N/A';
  const priority = randomElement(['routine', 'routine', 'routine', 'urgent']);

  stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
  stats.byType[surgeryType.description.split(' - ')[0]] =
    (stats.byType[surgeryType.description.split(' - ')[0]] || 0) + 1;

  const paymentDate = randomDate(60);
  let scheduledDate = null;
  let checkInTime = null;
  let surgeryStartTime = null;
  let surgeryEndTime = null;

  // Set timeline based on status
  if (status !== 'awaiting_scheduling') {
    scheduledDate = status === 'scheduled' ? futureDate(30) : randomDate(30);
  }

  if (status === 'checked_in' || status === 'in_surgery' || status === 'completed') {
    checkInTime = new Date(scheduledDate.getTime() - 60 * 60000);
  }

  if (status === 'in_surgery' || status === 'completed') {
    surgeryStartTime = new Date(scheduledDate.getTime());
  }

  if (status === 'completed') {
    surgeryEndTime = new Date(surgeryStartTime.getTime() + surgeryType.duration * 60000);
  }

  // Pre-op checklist (for checked_in, in_surgery, completed)
  const preOpChecklist = {
    consentSigned: status !== 'awaiting_scheduling',
    consentSignedAt: status !== 'awaiting_scheduling' ? paymentDate : null,
    npoDuration: randomInt(6, 12),
    labsReviewed: ['completed', 'in_surgery', 'checked_in'].includes(status),
    imagingReviewed: ['completed', 'in_surgery', 'checked_in'].includes(status),
    allergiesVerified: ['completed', 'in_surgery', 'checked_in'].includes(status),
    medicationsVerified: ['completed', 'in_surgery', 'checked_in'].includes(status),
    siteMarked: ['completed', 'in_surgery', 'checked_in'].includes(status) && surgeryType.eye,
    eyeMarked: surgeryType.eye ? eye : null,
    patientIdentityVerified: ['completed', 'in_surgery', 'checked_in'].includes(status),
    anesthesiaEvaluated: ['completed', 'in_surgery', 'checked_in'].includes(status),
    iolCalculated: surgeryType.description.includes('cataracte')
  };

  const surgeryCase = new SurgeryCase({
    patient: patient._id,
    clinic: clinic._id,
    invoice: invoice._id,
    surgeryDescription: surgeryType.description,
    eye: eye,
    status: status,
    priority: priority,
    paymentDate: paymentDate,
    scheduledDate: scheduledDate,
    scheduledEndTime: scheduledDate
      ? new Date(scheduledDate.getTime() + surgeryType.duration * 60000)
      : null,
    estimatedDuration: surgeryType.duration,
    checkInTime: checkInTime,
    surgeryStartTime: surgeryStartTime,
    surgeryEndTime: surgeryEndTime,
    surgeon: surgeon._id,
    preOpChecklist: preOpChecklist,
    anesthesiaType: randomElement(['topical', 'local', 'general']),
    notes: `Cas chirurgical créé pour test. ${surgeryType.description}`,
    createdBy: surgeon._id,
    updatedBy: surgeon._id
  });

  await surgeryCase.save();
  stats.casesCreated++;
  return surgeryCase;
}

async function seedSurgeryData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔗 Connected to MongoDB\n');

    // Load reference data
    console.log('📚 Loading reference data...');
    const patients = await Patient.find({}).limit(50).lean();
    const users = await User.find({ isActive: true }).lean();
    const clinics = await Clinic.find({}).lean();
    const invoices = await Invoice.find({ status: 'paid' }).limit(30).lean();

    if (patients.length === 0) throw new Error('No patients found');
    if (clinics.length === 0) throw new Error('No clinics found');
    if (invoices.length === 0) throw new Error('No paid invoices found. Run seedFinancialData.js first.');

    const surgeons = users.filter(u => ['doctor', 'ophthalmologist', 'admin'].includes(u.role));
    if (surgeons.length === 0) surgeons.push(...users.slice(0, 3));

    const clinic = clinics[0];

    console.log(`  Found ${patients.length} patients, ${surgeons.length} surgeons, ${invoices.length} invoices\n`);

    // Clean up
    console.log('🧹 Cleaning up previous surgery data...');
    await SurgeryCase.deleteMany({});
    console.log('  ✅ Cleaned\n');

    // Create surgery cases
    console.log('🏥 Creating surgery cases...\n');
    const count = 15;

    for (let i = 0; i < count; i++) {
      const patient = randomElement(patients);
      const surgeon = randomElement(surgeons);
      const invoice = randomElement(invoices);

      await createSurgeryCase(patient, surgeon, clinic, invoice);

      if ((i + 1) % 5 === 0) {
        console.log(`  Created ${i + 1}/${count} cases`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Surgery Data Summary');
    console.log('='.repeat(50));
    console.log(`Total cases created: ${stats.casesCreated}`);

    console.log('\nBy status:');
    for (const [status, count] of Object.entries(stats.byStatus)) {
      console.log(`  - ${status}: ${count}`);
    }

    console.log('\nBy surgery type:');
    for (const [type, count] of Object.entries(stats.byType)) {
      console.log(`  - ${type}: ${count}`);
    }

    console.log('\n✅ Surgery data seeding complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedSurgeryData();
