/**
 * Test script for consultation completion service
 * Run: node scripts/testConsultationCompletion.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('Connected to MongoDB');

    const consultationCompletionService = require('../services/consultationCompletionService');

    // Test data
    const visitId = '695168c5250315dc4220fcb5';
    const patientId = '69441d7af3feff49134d2b49';

    // Get clinic from visit
    const Visit = require('../models/Visit');
    const visit = await Visit.findById(visitId);

    if (!visit) {
      console.error('Visit not found:', visitId);
      process.exit(1);
    }

    console.log('Visit found:', {
      _id: visit._id,
      patient: visit.patient,
      clinic: visit.clinic,
      status: visit.status
    });

    const examData = {
      visualAcuity: {
        od: { uncorrected: '10/10', corrected: '10/10' },
        os: { uncorrected: '10/10', corrected: '10/10' }
      },
      intraocularPressure: {
        od: { value: 15, method: 'goldmann' },
        os: { value: 16, method: 'goldmann' }
      },
      refraction: {
        od: { sphere: 0, cylinder: 0, axis: 0 },
        os: { sphere: 0, cylinder: 0, axis: 0 }
      },
      conclusion: 'Examen normal',
      diagnostic: {
        laboratory: [],
        procedures: [],
        surgery: []
      },
      prescription: {
        medications: []
      }
    };

    console.log('\nCalling completeConsultation...');

    const result = await consultationCompletionService.completeConsultation({
      examId: null,
      patientId,
      visitId,
      clinicId: visit.clinic?.toString(),
      userId: '6942cf49300ef632d12cab3d', // Admin user
      examData,
      options: {}
    });

    console.log('\nResult:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('\nError:', error.message);
    console.error('\nStack:', error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

test();
