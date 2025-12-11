/**
 * Script to enroll a patient's face from their existing photo
 * Usage: node scripts/enrollPatientFace.js <patientId>
 */

const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs').promises;
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';
const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://127.0.0.1:5002';

async function enrollPatientFace(patientId) {
  try {
    console.log('=== PATIENT FACE ENROLLMENT ===\n');

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const Patient = require('../models/Patient');

    // Find patient
    const patient = await Patient.findById(patientId);

    if (!patient) {
      console.error('❌ Patient not found');
      process.exit(1);
    }

    console.log(`Patient: ${patient.firstName} ${patient.lastName}`);
    console.log(`Patient ID: ${patient.patientId}`);
    console.log(`Photo URL: ${patient.photoUrl || 'NONE'}\n`);

    if (!patient.photoUrl) {
      console.error('❌ Patient has no photo uploaded. Please upload a photo first.');
      process.exit(1);
    }

    // Check if already enrolled
    if (patient.biometric?.faceEncoding?.length) {
      console.log('⚠️  Patient already has face encoding enrolled.');
      console.log('   Encoding length:', patient.biometric.faceEncoding.length);
      console.log('\n   Re-enrolling will overwrite existing encoding.');
      console.log('   Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Read the photo from the photoUrl path
    // Assuming photoUrl is a local path like /uploads/patient-photos/xxx.jpg
    let photoPath = patient.photoUrl;

    // If it's a relative path, make it absolute
    if (!photoPath.startsWith('/')) {
      photoPath = `/Users/xtm888/magloire/backend${photoPath}`;
    } else if (photoPath.startsWith('/uploads')) {
      photoPath = `/Users/xtm888/magloire/backend${photoPath}`;
    }

    console.log('Reading photo from:', photoPath);

    let imageBase64;
    try {
      const imageBuffer = await fs.readFile(photoPath);
      imageBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
      console.log('✅ Photo loaded successfully\n');
    } catch (err) {
      console.error('❌ Error reading photo file:', err.message);
      console.error('   Please check that the photo exists at:', photoPath);
      process.exit(1);
    }

    // Call face service to generate encoding
    console.log('Generating face encoding...');
    try {
      const response = await axios.post(`${FACE_SERVICE_URL}/api/face/encode`, {
        image: imageBase64
      }, {
        timeout: 30000
      });

      if (!response.data.success) {
        console.error('❌ Face encoding failed:', response.data.error);
        process.exit(1);
      }

      const encoding = response.data.encoding;
      const faceLocation = response.data.faceLocation;

      console.log('✅ Face encoding generated');
      console.log('   Encoding length:', encoding?.length);
      console.log('   Face detected at:', faceLocation);

      // Save to patient record
      patient.biometric = patient.biometric || {};
      patient.biometric.faceEncoding = encoding;
      patient.biometric.facePhoto = patient.photoUrl;
      patient.biometric.enrollmentDate = new Date();
      patient.biometric.consentDate = new Date();

      await patient.save();

      console.log('\n✅ SUCCESS! Patient face enrolled.');
      console.log('   Patient can now use face verification.');

    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        console.error('❌ Face service is not running!');
        console.error('   Please start the face service: cd face-service && python3 app.py');
      } else {
        console.error('❌ Face encoding error:', err.response?.data || err.message);
      }
      process.exit(1);
    }

    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Get patient ID from command line
const patientId = process.argv[2];

if (!patientId) {
  console.log('Usage: node scripts/enrollPatientFace.js <patientId>');
  console.log('Example: node scripts/enrollPatientFace.js 6927670a3ef72a7afa823c46');
  process.exit(1);
}

enrollPatientFace(patientId);
