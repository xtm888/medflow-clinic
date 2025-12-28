/**
 * Create a test visit for Playwright testing
 * Run: node scripts/createTestVisit.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function createVisit() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');

    const Visit = require('../models/Visit');
    const Patient = require('../models/Patient');

    // Find patient Marie KULALUKA
    const patientId = '69441d7af3feff49134d2b49';
    const patient = await Patient.findById(patientId);

    if (!patient) {
      console.log('Patient not found:', patientId);
      process.exit(1);
    }

    console.log('Patient:', patient.firstName, patient.lastName);
    console.log('Convention:', patient.convention?.name || 'None');

    // Create a new visit - use homeClinic if clinic not set
    const clinicId = patient.clinic || patient.homeClinic;
    console.log('Using clinic:', clinicId);

    const visit = new Visit({
      patient: patient._id,
      clinic: clinicId,
      visitDate: new Date(),
      status: 'in-progress',
      visitType: 'consultation',
      reason: 'Consultation ophtalmologique de test',
      primaryProvider: '6942cf49300ef632d12cab3d', // Admin user as provider
      createdBy: '6942cf49300ef632d12cab3d' // Admin user
    });

    await visit.save();
    console.log('\n=== New Visit Created ===');
    console.log('Visit ID:', visit._id.toString());
    console.log('Status:', visit.status);
    console.log('Date:', visit.visitDate);

    // Output just the ID for easy copy
    console.log('\nCopy this ID for testing:');
    console.log(visit._id.toString());

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createVisit();
