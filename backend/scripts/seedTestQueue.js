#!/usr/bin/env node
/**
 * Seed Test Queue Data
 * Creates patients and adds them to queue for E2E testing
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedTestQueue.js');

const fs = require('fs');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const Counter = require('../models/Counter');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medflow';

// Test patients to create
const TEST_PATIENTS = [
  { firstName: 'QUEUE', lastName: 'PATIENT_ONE', dob: new Date(1985, 0, 15), gender: 'male', phone: '+243890000001' },
  { firstName: 'QUEUE', lastName: 'PATIENT_TWO', dob: new Date(1990, 5, 20), gender: 'female', phone: '+243890000002' },
  { firstName: 'QUEUE', lastName: 'PATIENT_THREE', dob: new Date(1978, 11, 5), gender: 'male', phone: '+243890000003' },
  { firstName: 'QUEUE', lastName: 'PATIENT_FOUR', dob: new Date(1995, 3, 10), gender: 'female', phone: '+243890000004' },
  { firstName: 'QUEUE', lastName: 'PATIENT_FIVE', dob: new Date(1982, 7, 25), gender: 'male', phone: '+243890000005' },
];

async function generatePatientId() {
  const year = new Date().getFullYear();
  const counterId = Counter.getYearlyCounterId('patient');

  // Use Counter's static method for atomic increment
  const seq = await Counter.getNextSequence(counterId);

  return `PAT${year}${String(seq).padStart(6, '0')}`;
}

async function seedQueue() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get default clinic
    const clinic = await Clinic.findOne({ status: 'active' }).sort({ createdAt: 1 });
    if (!clinic) {
      throw new Error('No active clinic found. Run seedClinics.js first.');
    }
    console.log(`Using clinic: ${clinic.name} (${clinic._id})`);

    // Get a provider (doctor)
    const provider = await User.findOne({ role: 'doctor', isActive: true });
    if (!provider) {
      throw new Error('No active doctor found. Run seedUsers.js first.');
    }
    console.log(`Using provider: ${provider.firstName} ${provider.lastName}`);

    const createdPatients = [];
    const createdAppointments = [];

    // Create patients and queue entries
    for (let i = 0; i < TEST_PATIENTS.length; i++) {
      const testPatient = TEST_PATIENTS[i];

      // Check if patient already exists
      let patient = await Patient.findOne({
        firstName: testPatient.firstName,
        lastName: testPatient.lastName
      });

      if (!patient) {
        const patientId = await generatePatientId();
        patient = await Patient.create({
          patientId,
          firstName: testPatient.firstName,
          lastName: testPatient.lastName,
          dateOfBirth: testPatient.dob,
          gender: testPatient.gender,
          phoneNumber: testPatient.phone,
          registeredAtClinic: clinic._id,
          homeClinic: clinic._id,
          status: 'active'
        });
        console.log(`Created patient: ${patient.patientId} - ${patient.firstName} ${patient.lastName}`);
      } else {
        console.log(`Patient exists: ${patient.patientId} - ${patient.firstName} ${patient.lastName}`);
      }
      createdPatients.push(patient);

      // Create appointment for today (checked-in status = in queue)
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      // Delete any existing queue entries for this patient today
      await Appointment.deleteMany({
        patient: patient._id,
        date: { $gte: startOfDay, $lte: endOfDay },
        status: 'checked-in'
      });

      // Create new queue entry
      const appointmentTime = new Date(today);
      appointmentTime.setHours(8 + i, 0, 0, 0);

      const appointment = await Appointment.create({
        patient: patient._id,
        provider: provider._id,
        clinic: clinic._id,
        date: appointmentTime,
        startTime: `${String(8 + i).padStart(2, '0')}:00`,
        endTime: `${String(8 + i).padStart(2, '0')}:30`,
        duration: 30,
        type: 'consultation',
        department: 'ophthalmology',
        status: 'checked-in', // This puts them in queue
        checkedInAt: new Date(),
        queueNumber: i + 1,
        reason: 'Test consultation'
      });
      console.log(`Created queue entry: ${appointment._id} - Queue #${appointment.queueNumber}`);
      createdAppointments.push(appointment);
    }

    console.log('\n========================================');
    console.log('SEED QUEUE COMPLETE');
    console.log('========================================');
    console.log(`Patients created/found: ${createdPatients.length}`);
    console.log(`Queue entries created: ${createdAppointments.length}`);
    console.log('\nPatients in queue:');
    for (let i = 0; i < createdPatients.length; i++) {
      console.log(`  ${i + 1}. ${createdPatients[i].firstName} ${createdPatients[i].lastName} (${createdPatients[i].patientId})`);
    }

    // Output JSON for test consumption
    const output = {
      success: true,
      clinic: { id: clinic._id.toString(), name: clinic.name },
      provider: { id: provider._id.toString(), name: `${provider.firstName} ${provider.lastName}` },
      patients: createdPatients.map(p => ({
        id: p._id.toString(),
        patientId: p.patientId,
        name: `${p.firstName} ${p.lastName}`
      })),
      queueEntries: createdAppointments.map(a => ({
        id: a._id.toString(),
        patientId: a.patient.toString(),
        queueNumber: a.queueNumber,
        status: a.status
      }))
    };

    // Write to temp file for test consumption
    fs.writeFileSync('/tmp/medflow_test_queue.json', JSON.stringify(output, null, 2));
    console.log('\nOutput written to: /tmp/medflow_test_queue.json');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seedQueue();
