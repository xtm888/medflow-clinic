require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const User = require('../models/User');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const OphthalmologyExam = require('../models/OphthalmologyExam');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Patient.deleteMany({});
    await Appointment.deleteMany({});
    await Prescription.deleteMany({});
    await OphthalmologyExam.deleteMany({});

    // Create users
    console.log('👥 Creating users...');
    // Don't hash here - the User model will hash it in the pre-save hook
    const plainPassword = 'Admin123!';

    const users = await User.create([
      {
        username: 'admin',
        email: 'admin@medflow.com',
        password: plainPassword,
        firstName: 'Admin',
        lastName: 'User',
        phoneNumber: '+212600000001',
        role: 'admin',
        department: 'general',
        employeeId: 'EMP20240001',
        isActive: true,
        isEmailVerified: true
      },
      {
        username: 'doctor',
        email: 'doctor@medflow.com',
        password: plainPassword,
        firstName: 'Dr. Jean',
        lastName: 'Martin',
        phoneNumber: '+212600000002',
        role: 'doctor',
        department: 'general',
        specialization: 'General Medicine',
        licenseNumber: 'MD12345',
        employeeId: 'EMP20240002',
        isActive: true,
        isEmailVerified: true
      },
      {
        username: 'ophthalmologist',
        email: 'ophthalmologist@medflow.com',
        password: plainPassword,
        firstName: 'Dr. Marie',
        lastName: 'Dupont',
        phoneNumber: '+212600000003',
        role: 'ophthalmologist',
        department: 'ophthalmology',
        specialization: 'Ophthalmology',
        licenseNumber: 'MD67890',
        employeeId: 'EMP20240003',
        isActive: true,
        isEmailVerified: true
      },
      {
        username: 'nurse',
        email: 'nurse@medflow.com',
        password: plainPassword,
        firstName: 'Sophie',
        lastName: 'Laurent',
        phoneNumber: '+212600000004',
        role: 'nurse',
        department: 'general',
        employeeId: 'EMP20240004',
        isActive: true,
        isEmailVerified: true
      },
      {
        username: 'receptionist',
        email: 'reception@medflow.com',
        password: plainPassword,
        firstName: 'Pierre',
        lastName: 'Moreau',
        phoneNumber: '+212600000005',
        role: 'receptionist',
        department: 'general',
        employeeId: 'EMP20240005',
        isActive: true,
        isEmailVerified: true
      },
      {
        username: 'pharmacist',
        email: 'pharmacist@medflow.com',
        password: plainPassword,
        firstName: 'Claire',
        lastName: 'Bernard',
        phoneNumber: '+212600000006',
        role: 'pharmacist',
        department: 'pharmacy',
        licenseNumber: 'PH11111',
        employeeId: 'EMP20240006',
        isActive: true,
        isEmailVerified: true
      }
    ]);

    console.log(`✅ Created ${users.length} users`);

    // Create patients
    console.log('🏥 Creating patients...');
    const patients = await Patient.create([
      {
        patientId: 'PAT20240001',
        nationalId: 'AB123456',
        firstName: 'Ahmed',
        lastName: 'Benali',
        dateOfBirth: new Date('1980-05-15'),
        gender: 'male',
        bloodType: 'O+',
        phoneNumber: '+212611111111',
        email: 'ahmed.benali@email.com',
        address: {
          street: '123 Avenue Mohammed V',
          city: 'Casablanca',
          postalCode: '20000',
          country: 'Morocco'
        },
        emergencyContact: {
          name: 'Fatima Benali',
          relationship: 'Spouse',
          phone: '+212611111112'
        },
        medicalHistory: {
          allergies: [
            { allergen: 'Penicillin', reaction: 'Rash', severity: 'moderate' }
          ],
          chronicConditions: [
            { condition: 'Hypertension', diagnosedDate: new Date('2018-03-10'), status: 'managed' }
          ]
        },
        ophthalmology: {
          lastEyeExam: new Date('2024-01-15'),
          currentPrescription: {
            OD: { sphere: -2.00, cylinder: -0.50, axis: 180, va: '20/20' },
            OS: { sphere: -2.25, cylinder: -0.75, axis: 175, va: '20/20' },
            pd: { distance: 65, near: 62 },
            prescribedDate: new Date('2024-01-15'),
            prescribedBy: users[2]._id
          },
          eyeConditions: [
            { condition: 'Myopia', eye: 'OU', diagnosedDate: new Date('2015-06-20'), status: 'Stable' }
          ]
        },
        status: 'active'
      },
      {
        patientId: 'PAT20240002',
        nationalId: 'CD789012',
        firstName: 'Amina',
        lastName: 'Alami',
        dateOfBirth: new Date('1975-08-22'),
        gender: 'female',
        bloodType: 'A+',
        phoneNumber: '+212622222222',
        email: 'amina.alami@email.com',
        address: {
          street: '45 Rue Hassan II',
          city: 'Rabat',
          postalCode: '10000',
          country: 'Morocco'
        },
        emergencyContact: {
          name: 'Mohamed Alami',
          relationship: 'Husband',
          phone: '+212622222223'
        },
        medicalHistory: {
          allergies: [],
          chronicConditions: [
            { condition: 'Type 2 Diabetes', diagnosedDate: new Date('2020-01-15'), status: 'managed' }
          ]
        },
        ophthalmology: {
          lastEyeExam: new Date('2024-02-10'),
          eyeConditions: [
            { condition: 'Presbyopia', eye: 'OU', diagnosedDate: new Date('2021-03-15'), status: 'Progressive' }
          ]
        },
        status: 'active'
      },
      {
        patientId: 'PAT20240003',
        nationalId: 'EF345678',
        firstName: 'Youssef',
        lastName: 'Tazi',
        dateOfBirth: new Date('1990-12-10'),
        gender: 'male',
        bloodType: 'B+',
        phoneNumber: '+212633333333',
        email: 'youssef.tazi@email.com',
        address: {
          street: '78 Boulevard Zerktouni',
          city: 'Casablanca',
          postalCode: '20100',
          country: 'Morocco'
        },
        status: 'active'
      }
    ]);

    console.log(`✅ Created ${patients.length} patients`);

    // Create appointments
    console.log('📅 Creating appointments...');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await Appointment.create([
      {
        appointmentId: 'APT20240001',
        patient: patients[0]._id,
        provider: users[1]._id,
        date: today,
        startTime: '09:00',
        endTime: '09:30',
        type: 'consultation',
        department: 'general',
        status: 'scheduled',
        priority: 'normal',
        reason: 'Annual checkup'
      },
      {
        appointmentId: 'APT20240002',
        patient: patients[1]._id,
        provider: users[2]._id,
        date: today,
        startTime: '10:00',
        endTime: '10:30',
        type: 'ophthalmology',
        department: 'ophthalmology',
        status: 'scheduled',
        priority: 'normal',
        reason: 'Vision check - presbyopia follow-up'
      },
      {
        appointmentId: 'APT20240003',
        patient: patients[2]._id,
        provider: users[1]._id,
        date: tomorrow,
        startTime: '14:00',
        endTime: '14:30',
        type: 'follow-up',
        department: 'general',
        status: 'scheduled',
        priority: 'normal',
        reason: 'Lab results review'
      }
    ]);

    console.log(`✅ Created ${appointments.length} appointments`);

    // Create prescriptions
    console.log('💊 Creating prescriptions...');
    const prescriptions = await Prescription.create([
      {
        prescriptionId: 'MED20240001',
        patient: patients[0]._id,
        prescriber: users[1]._id,
        appointment: appointments[0]._id,
        type: 'medication',
        status: 'active',
        dateIssued: today,
        validUntil: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000), // 90 days
        medications: [
          {
            name: 'Amlodipine',
            genericName: 'Amlodipine Besylate',
            dosage: 'Take 1 tablet daily',
            strength: '5mg',
            form: 'tablet',
            route: 'oral',
            frequency: 'Once daily',
            duration: '90 days',
            quantity: 90,
            unit: 'tablets',
            refills: { allowed: 3, remaining: 3 },
            indication: 'Hypertension'
          }
        ],
        diagnosis: [
          { code: 'I10', description: 'Essential (primary) hypertension' }
        ]
      },
      {
        prescriptionId: 'OPT20240001',
        patient: patients[0]._id,
        prescriber: users[2]._id,
        type: 'optical',
        status: 'active',
        dateIssued: new Date('2024-01-15'),
        validUntil: new Date('2025-01-15'), // 1 year for optical
        optical: {
          prescriptionType: 'glasses',
          OD: { sphere: -2.00, cylinder: -0.50, axis: 180, va: '20/20' },
          OS: { sphere: -2.25, cylinder: -0.75, axis: 175, va: '20/20' },
          pd: { binocular: 65, monocular: { OD: 33, OS: 32 } },
          lensType: 'Single Vision',
          lensMaterial: 'Polycarbonate',
          lensCoatings: ['Anti-reflective', 'UV protection']
        },
        diagnosis: [
          { code: 'H52.1', description: 'Myopia' }
        ]
      }
    ]);

    console.log(`✅ Created ${prescriptions.length} prescriptions`);

    // Create ophthalmology exam
    console.log('👁️  Creating ophthalmology exams...');
    const ophthalmologyExams = await OphthalmologyExam.create([
      {
        examId: 'EYE20240001',
        patient: patients[0]._id,
        examiner: users[2]._id,
        appointment: appointments[1]._id,
        examType: 'comprehensive',
        chiefComplaint: {
          complaint: 'Difficulty reading small print',
          duration: '6 months',
          severity: 'moderate',
          laterality: 'OU'
        },
        visualAcuity: {
          distance: {
            OD: { uncorrected: '20/40', corrected: '20/20' },
            OS: { uncorrected: '20/40', corrected: '20/20' },
            OU: { uncorrected: '20/30', corrected: '20/20' }
          },
          near: {
            OD: { uncorrected: '20/50', corrected: '20/20' },
            OS: { uncorrected: '20/50', corrected: '20/20' },
            OU: { uncorrected: '20/40', corrected: '20/20' },
            testDistance: '40cm'
          },
          method: 'snellen'
        },
        refraction: {
          subjective: {
            OD: { sphere: -2.00, cylinder: -0.50, axis: 180, va: '20/20' },
            OS: { sphere: -2.25, cylinder: -0.75, axis: 175, va: '20/20' },
            add: 1.50
          },
          finalPrescription: {
            OD: { sphere: -2.00, cylinder: -0.50, axis: 180, add: 1.50, va: '20/20' },
            OS: { sphere: -2.25, cylinder: -0.75, axis: 175, add: 1.50, va: '20/20' },
            pd: { distance: 65, near: 62 }
          }
        },
        iop: {
          OD: { value: 15, time: '10:30', method: 'goldmann' },
          OS: { value: 16, time: '10:30', method: 'goldmann' }
        },
        assessment: {
          diagnoses: [
            { eye: 'OU', diagnosis: 'Myopia with presbyopia', icdCode: 'H52.1', status: 'stable' }
          ],
          summary: 'Patient has stable myopia with early presbyopia. Updated prescription for progressive lenses.'
        },
        plan: {
          prescriptions: [prescriptions[1]._id],
          followUp: { required: true, timeframe: '1 year', reason: 'Annual eye exam' },
          education: ['Proper lighting for reading', 'Computer screen distance adjustment']
        },
        status: 'completed',
        completedAt: new Date('2024-01-15')
      }
    ]);

    console.log(`✅ Created ${ophthalmologyExams.length} ophthalmology exams`);

    console.log('\n✨ Database seeded successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Patients: ${patients.length}`);
    console.log(`   - Appointments: ${appointments.length}`);
    console.log(`   - Prescriptions: ${prescriptions.length}`);
    console.log(`   - Ophthalmology Exams: ${ophthalmologyExams.length}`);

    console.log('\n🔑 Login Credentials:');
    console.log('   All users have password: Admin123!');
    console.log('   - admin@medflow.com (Admin)');
    console.log('   - doctor@medflow.com (Doctor)');
    console.log('   - ophthalmologist@medflow.com (Ophthalmologist)');
    console.log('   - nurse@medflow.com (Nurse)');
    console.log('   - reception@medflow.com (Receptionist)');
    console.log('   - pharmacist@medflow.com (Pharmacist)');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

// Run the seed function
seedDatabase();