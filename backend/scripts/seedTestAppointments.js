#!/usr/bin/env node
/**
 * Seed Test Appointments Data
 * Creates appointments for various dates and statuses
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedTestAppointments.js');

const fs = require('fs');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Clinic = require('../models/Clinic');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medflow';

async function seedAppointments() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get clinic and provider
    const clinic = await Clinic.findOne({ status: 'active' }).sort({ createdAt: 1 });
    const provider = await User.findOne({ role: 'doctor', isActive: true });

    if (!clinic || !provider) {
      throw new Error('Missing clinic or provider. Run seed scripts first.');
    }
    console.log(`Using clinic: ${clinic.name}`);
    console.log(`Using provider: ${provider.firstName} ${provider.lastName}`);

    // Get some patients
    const patients = await Patient.find({ status: 'active' }).limit(10);
    if (patients.length < 5) {
      throw new Error('Not enough patients. Run seedTestQueue.js first.');
    }

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(0, 0, 0, 0);

    const appointments = [];

    // Create appointments for different scenarios
    const scenarios = [
      { patient: patients[0], date: tomorrow, time: '09:00', status: 'scheduled', type: 'consultation' },
      { patient: patients[1], date: tomorrow, time: '10:00', status: 'scheduled', type: 'follow-up' },
      { patient: patients[2], date: tomorrow, time: '11:00', status: 'confirmed', type: 'refraction' },
      { patient: patients[3], date: nextWeek, time: '14:00', status: 'scheduled', type: 'surgery' },
      { patient: patients[4], date: nextWeek, time: '15:00', status: 'scheduled', type: 'imaging' },
    ];

    for (const scenario of scenarios) {
      const scenarioDate = new Date(scenario.date);
      const startOfDay = new Date(scenarioDate.getFullYear(), scenarioDate.getMonth(), scenarioDate.getDate());
      const endOfDay = new Date(scenarioDate.getFullYear(), scenarioDate.getMonth(), scenarioDate.getDate(), 23, 59, 59);

      // Check if similar appointment exists
      const existing = await Appointment.findOne({
        patient: scenario.patient._id,
        date: { $gte: startOfDay, $lte: endOfDay },
        status: { $in: ['scheduled', 'confirmed'] }
      });

      if (!existing) {
        const aptDate = new Date(scenario.date);
        const [startHours, startMins] = scenario.time.split(':').map(Number);
        aptDate.setHours(startHours, startMins, 0, 0);

        // Calculate end time (30 min after start)
        const endHour = startMins + 30 >= 60 ? startHours + 1 : startHours;
        const endMin = (startMins + 30) % 60;
        const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

        const apt = await Appointment.create({
          patient: scenario.patient._id,
          provider: provider._id,
          clinic: clinic._id,
          date: aptDate,
          startTime: scenario.time,
          endTime: endTime,
          duration: 30,
          type: scenario.type,
          department: 'ophthalmology',
          status: scenario.status,
          reason: `Test ${scenario.type}`
        });
        appointments.push(apt);
        console.log(`Created: ${scenario.patient.firstName} - ${scenario.date.toDateString()} ${scenario.time} (${scenario.status})`);
      } else {
        appointments.push(existing);
        console.log(`Exists: ${scenario.patient.firstName} - ${scenario.date.toDateString()}`);
      }
    }

    console.log('\n========================================');
    console.log('SEED APPOINTMENTS COMPLETE');
    console.log('========================================');
    console.log(`Appointments: ${appointments.length}`);

    // Output JSON
    const output = {
      success: true,
      appointments: appointments.map(a => ({
        id: a._id.toString(),
        patientId: a.patient.toString(),
        date: a.date.toISOString(),
        time: a.startTime,
        status: a.status,
        type: a.type
      }))
    };

    fs.writeFileSync('/tmp/medflow_test_appointments.json', JSON.stringify(output, null, 2));
    console.log('\nOutput written to: /tmp/medflow_test_appointments.json');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seedAppointments();
