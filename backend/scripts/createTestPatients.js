const mongoose = require('mongoose');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Counter = require('../models/Counter');
const User = require('../models/User');

const { requireNonProduction } = require('./_guards');
requireNonProduction('createTestPatients.js');

async function createTestData() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/medflow');
    console.log('Connected to MongoDB');

    // Get admin user
    const admin = await User.findOne({ email: 'admin@medflow.com' });
    if (!admin) {
      console.error('Admin user not found!');
      process.exit(1);
    }

    // Create 5 patients
    const patients = [];
    const names = [
      { first: 'Jean', last: 'Mukendi', dob: new Date(1980, 1, 15) },
      { first: 'Marie', last: 'Kabila', dob: new Date(1975, 3, 22) },
      { first: 'Paul', last: 'Tshisekedi', dob: new Date(1990, 5, 10) },
      { first: 'Sophie', last: 'Nkulu', dob: new Date(1985, 7, 5) },
      { first: 'Luc', last: 'Kasongo', dob: new Date(1992, 9, 18) }
    ];

    for (let i = 0; i < 5; i++) {
      const year = new Date().getFullYear();
      const counterId = `patient-${year}`;
      const sequence = await Counter.getNextSequence(counterId);
      const patientId = `PAT${year}${String(sequence).padStart(6, '0')}`;

      const patient = await Patient.create({
        patientId,
        firstName: names[i].first,
        lastName: names[i].last,
        dateOfBirth: names[i].dob,
        gender: i % 2 === 0 ? 'male' : 'female',
        phoneNumber: `+243${800000000 + i}`,
        status: 'active'
      });

      patients.push(patient);
      console.log(`Created patient: ${patient.firstName} ${patient.lastName}`);
    }

    // Create appointments for patients
    const today = new Date();
    today.setHours(8, 0, 0, 0);

    for (let i = 0; i < 5; i++) {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const aptCounterId = `appointment-${year}${month}${day}`;
      const sequence = await Counter.getNextSequence(aptCounterId);
      const appointmentId = `APT${year}${month}${day}${String(sequence).padStart(4, '0')}`;

      const startTime = new Date(today.getTime() + (i * 30 * 60000));
      const endTime = new Date(startTime.getTime() + 30 * 60000);

      const appointment = await Appointment.create({
        appointmentId,
        patient: patients[i]._id,
        provider: admin._id,
        date: today,
        startTime: `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`,
        endTime: `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`,
        type: 'consultation',
        status: 'scheduled',
        department: 'ophthalmology',
        reason: 'Consultation de routine'
      });

      console.log(`Created appointment: ${appointmentId} for ${patients[i].firstName}`);
    }

    console.log('\n✅ Successfully created 5 patients and 5 appointments!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createTestData();
