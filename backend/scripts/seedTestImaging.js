/**
 * Seed Test Imaging Data
 * Creates minimal imaging results for E2E testing
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedTestImaging.js');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

async function seedTestImaging() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const Clinic = require('../models/Clinic');
    const Patient = require('../models/Patient');
    const User = require('../models/User');

    // Check if ImagingResult model exists
    let ImagingResult;
    try {
      ImagingResult = require('../models/ImagingResult');
    } catch (e) {
      console.log('ImagingResult model not found, checking alternatives...');
      // Try to find it another way
      const modelNames = mongoose.modelNames();
      console.log('Available models:', modelNames.filter(n => n.toLowerCase().includes('imag')));

      // If no imaging model, we might store imaging in OphthalmologyExam
      const OphthalmologyExam = require('../models/OphthalmologyExam');
      console.log('Will use OphthalmologyExam for imaging data');

      // Get required references
      const clinic = await Clinic.findOne();
      const patient = await Patient.findOne();
      const user = await User.findOne({ role: 'admin' });

      if (!clinic || !patient || !user) {
        console.log('Missing required data:', { clinic: !!clinic, patient: !!patient, user: !!user });
        await mongoose.connection.close();
        return;
      }

      // Check existing exams
      const existingExams = await OphthalmologyExam.countDocuments({ patient: patient._id });
      if (existingExams > 0) {
        console.log(`Already have ${existingExams} exams for patient. Skipping.`);
        await mongoose.connection.close();
        return;
      }

      // Create a test ophthalmology exam with imaging data
      const exam = new OphthalmologyExam({
        patient: patient._id,
        clinic: clinic._id,
        examDate: new Date(),
        examiner: user._id,
        examType: 'comprehensive',
        chiefComplaint: 'Routine eye examination',
        status: 'completed',
        imaging: {
          fundusOD: {
            imageUrl: '/demo/fundus_od.jpg',
            capturedAt: new Date(),
            quality: 'good',
            findings: 'Normal fundus appearance'
          },
          fundusOS: {
            imageUrl: '/demo/fundus_os.jpg',
            capturedAt: new Date(),
            quality: 'good',
            findings: 'Normal fundus appearance'
          },
          octOD: {
            imageUrl: '/demo/oct_od.jpg',
            capturedAt: new Date(),
            quality: 'good',
            findings: 'Normal RNFL thickness'
          },
          octOS: {
            imageUrl: '/demo/oct_os.jpg',
            capturedAt: new Date(),
            quality: 'good',
            findings: 'Normal RNFL thickness'
          }
        }
      });

      await exam.save();
      console.log('Created test ophthalmology exam with imaging data');
      await mongoose.connection.close();
      console.log('Done!');
      return;
    }

    // If ImagingResult model exists, use it
    const clinic = await Clinic.findOne();
    const patient = await Patient.findOne();
    const user = await User.findOne({ role: 'admin' });

    if (!clinic || !patient || !user) {
      console.log('Missing required data');
      await mongoose.connection.close();
      return;
    }

    // Check existing
    const existingCount = await ImagingResult.countDocuments({ patient: patient._id });
    if (existingCount > 0) {
      console.log(`Already have ${existingCount} imaging results. Skipping.`);
      await mongoose.connection.close();
      return;
    }

    // Create test imaging results
    const imagingTypes = ['fundus', 'oct', 'visual_field'];
    const eyes = ['OD', 'OS'];

    for (const type of imagingTypes) {
      for (const eye of eyes) {
        const result = new ImagingResult({
          patient: patient._id,
          clinic: clinic._id,
          imagingType: type,
          eye: eye,
          imageUrl: `/demo/${type}_${eye.toLowerCase()}.jpg`,
          capturedAt: new Date(),
          capturedBy: user._id,
          quality: 'good',
          status: 'completed',
          findings: `Normal ${type} for ${eye}`
        });
        await result.save();
      }
    }

    console.log('Created 6 test imaging results');
    await mongoose.connection.close();
    console.log('Done!');
  } catch (error) {
    console.error('Error seeding imaging:', error.message);
    await mongoose.connection.close();
  }
}

seedTestImaging();
