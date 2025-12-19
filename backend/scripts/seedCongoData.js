/**
 * Congo Data Seed Script
 * Creates consistent test data with Congolese names
 *
 * SAFE MODE (default): Only adds sample data, does NOT delete existing data
 * DESTRUCTIVE MODE: Use FORCE_CLEAR=true to clear data first (DANGEROUS!)
 *
 * Run with:
 *   node scripts/seedCongoData.js              # Safe - adds sample data only
 *   FORCE_CLEAR=true node scripts/seedCongoData.js  # Destructive - clears all first
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const Visit = require('../models/Visit');
const User = require('../models/User');
const Counter = require('../models/Counter');
const Clinic = require('../models/Clinic');

async function seedCongoData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB\n');

    // SAFETY CHECK: Only clear data if explicitly requested
    const forceClear = process.env.FORCE_CLEAR === 'true';

    if (forceClear) {
      console.log('⚠️  WARNING: FORCE_CLEAR=true - This will DELETE ALL DATA!');
      console.log('⚠️  You have 5 seconds to cancel (Ctrl+C)...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log('🗑️  Clearing existing data...');
      await Patient.deleteMany({});
      await Appointment.deleteMany({});
      await Prescription.deleteMany({});
      await OphthalmologyExam.deleteMany({});
      await Visit.deleteMany({});

      // Reset counters using the static method
      await Counter.resetSequence('patientId', 0);
      console.log('✓ All data cleared\n');
    } else {
      // Check existing data counts
      const patientCount = await Patient.countDocuments();
      const visitCount = await Visit.countDocuments();
      const examCount = await OphthalmologyExam.countDocuments();

      console.log('📊 Current database state:');
      console.log(`   - Patients: ${patientCount.toLocaleString()}`);
      console.log(`   - Visits: ${visitCount.toLocaleString()}`);
      console.log(`   - Ophthalmology Exams: ${examCount.toLocaleString()}`);
      console.log('\n✅ SAFE MODE: Adding sample data without deleting existing data');
      console.log('   (Use FORCE_CLEAR=true to clear all data first)\n');
    }

    // Get a doctor user for references (or create one)
    let doctor = await User.findOne({ role: { $in: ['doctor', 'ophthalmologist', 'admin'] } });
    if (!doctor) {
      doctor = await User.create({
        username: 'dr.kabila',
        email: 'dr.kabila@clinique-kinshasa.cd',
        password: 'password123',
        firstName: 'Joseph',
        lastName: 'Kabila',
        role: 'ophthalmologist',
        specialization: 'Ophtalmologie'
      });
    }

    // Get a clinic for references (required for OphthalmologyExam)
    const clinic = await Clinic.findOne({ isActive: true });
    if (!clinic) {
      console.log('⚠️  No clinic found. Please run seedClinics.js first.');
      console.log('Skipping ophthalmology exams creation...');
    }

    console.log('Creating Congolese patient data...\n');

    // Create patients with Congolese names
    const patientsData = [
      {
        patientId: 'PAT-000001',
        firstName: 'Mbuyi',
        lastName: 'Kabongo',
        dateOfBirth: new Date('1985-03-15'),
        gender: 'male',
        phoneNumber: '+243 81 234 5678',
        email: 'mbuyi.kabongo@email.cd',
        address: {
          street: '123 Avenue Lumumba',
          city: 'Kinshasa',
          postalCode: '',
          country: 'RD Congo'
        },
        bloodType: 'O+',
        allergies: ['Pénicilline'],
        medicalHistory: {
          chronicConditions: [
            { condition: 'Hypertension', status: 'active', diagnosedDate: new Date('2020-01-15') }
          ],
          allergies: [
            { allergen: 'Pénicilline', severity: 'severe', reaction: 'Anaphylaxie' }
          ]
        },
        emergencyContact: {
          name: 'Marie Kabongo',
          relationship: 'Épouse',
          phoneNumber: '+243 81 234 5679'
        },
        insurance: {
          provider: 'SONAS',
          policyNumber: 'SON-2024-001234'
        },
        status: 'active'
      },
      {
        patientId: 'PAT-000002',
        firstName: 'Tshala',
        lastName: 'Mwamba',
        dateOfBirth: new Date('1990-07-22'),
        gender: 'female',
        phoneNumber: '+243 82 345 6789',
        email: 'tshala.mwamba@email.cd',
        address: {
          street: '45 Boulevard du 30 Juin',
          city: 'Lubumbashi',
          postalCode: '',
          country: 'RD Congo'
        },
        bloodType: 'A+',
        allergies: [],
        medicalHistory: {
          chronicConditions: [],
          allergies: []
        },
        emergencyContact: {
          name: 'Jean Mwamba',
          relationship: 'Frère',
          phoneNumber: '+243 82 345 6780'
        },
        insurance: {
          provider: 'Rawbank Assurance',
          policyNumber: 'RAW-2024-005678'
        },
        status: 'active'
      },
      {
        patientId: 'PAT-000003',
        firstName: 'Nkulu',
        lastName: 'Tshisekedi',
        dateOfBirth: new Date('1978-11-08'),
        gender: 'male',
        phoneNumber: '+243 83 456 7890',
        email: 'nkulu.tshisekedi@email.cd',
        address: {
          street: '78 Avenue Kasa-Vubu',
          city: 'Kinshasa',
          postalCode: '',
          country: 'RD Congo'
        },
        bloodType: 'B+',
        allergies: ['Aspirine', 'Sulfamides'],
        medicalHistory: {
          chronicConditions: [
            { condition: 'Diabète type 2', status: 'active', diagnosedDate: new Date('2018-05-20') },
            { condition: 'Glaucome', status: 'active', diagnosedDate: new Date('2022-03-10') }
          ],
          allergies: [
            { allergen: 'Aspirine', severity: 'moderate', reaction: 'Urticaire' },
            { allergen: 'Sulfamides', severity: 'mild', reaction: 'Éruption cutanée' }
          ]
        },
        emergencyContact: {
          name: 'Béatrice Tshisekedi',
          relationship: 'Épouse',
          phoneNumber: '+243 83 456 7891'
        },
        insurance: {
          provider: 'SONAS',
          policyNumber: 'SON-2024-009012'
        },
        status: 'active'
      },
      {
        patientId: 'PAT-000004',
        firstName: 'Marie',
        lastName: 'Lukusa',
        dateOfBirth: new Date('1995-02-14'),
        gender: 'female',
        phoneNumber: '+243 84 567 8901',
        email: 'marie.lukusa@email.cd',
        address: {
          street: '12 Rue de la Révolution',
          city: 'Goma',
          postalCode: '',
          country: 'RD Congo'
        },
        bloodType: 'AB+',
        allergies: [],
        medicalHistory: {
          chronicConditions: [],
          allergies: []
        },
        emergencyContact: {
          name: 'Pierre Lukusa',
          relationship: 'Père',
          phoneNumber: '+243 84 567 8902'
        },
        status: 'active'
      },
      {
        patientId: 'PAT-000005',
        firstName: 'Jean',
        lastName: 'Ilunga',
        dateOfBirth: new Date('1982-09-30'),
        gender: 'male',
        phoneNumber: '+243 85 678 9012',
        email: 'jean.ilunga@email.cd',
        address: {
          street: '89 Avenue de l\'Indépendance',
          city: 'Mbuji-Mayi',
          postalCode: '',
          country: 'RD Congo'
        },
        bloodType: 'O-',
        allergies: ['Latex'],
        medicalHistory: {
          chronicConditions: [
            { condition: 'Myopie sévère', status: 'active', diagnosedDate: new Date('2010-08-15') }
          ],
          allergies: [
            { allergen: 'Latex', severity: 'moderate', reaction: 'Dermatite de contact' }
          ]
        },
        emergencyContact: {
          name: 'Sophie Ilunga',
          relationship: 'Sœur',
          phoneNumber: '+243 85 678 9013'
        },
        insurance: {
          provider: 'BIAC Assurance',
          policyNumber: 'BIA-2024-003456'
        },
        status: 'active'
      }
    ];

    // Insert patients only if they don't already exist (upsert-like behavior)
    const patients = [];
    let created = 0;
    let skipped = 0;

    for (const patientData of patientsData) {
      const existing = await Patient.findOne({ patientId: patientData.patientId });
      if (existing) {
        patients.push(existing);
        skipped++;
      } else {
        const newPatient = await Patient.create(patientData);
        patients.push(newPatient);
        created++;
      }
    }
    console.log(`Patients: ${created} created, ${skipped} already existed`);

    // Create appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointmentsData = [
      {
        appointmentId: 'APT-000001',
        patient: patients[0]._id,
        provider: doctor._id,
        date: new Date(today),
        startTime: '09:00',
        endTime: '09:30',
        time: '09:00',
        duration: 30,
        type: 'consultation',
        department: 'ophthalmology',
        status: 'confirmed',
        reason: 'Contrôle de la tension artérielle',
        notes: 'Patient hypertendu, suivi régulier'
      },
      {
        appointmentId: 'APT-000002',
        patient: patients[1]._id,
        provider: doctor._id,
        date: new Date(today),
        startTime: '10:00',
        endTime: '10:45',
        time: '10:00',
        duration: 45,
        type: 'routine-checkup',
        department: 'ophthalmology',
        status: 'confirmed',
        reason: 'Examen ophtalmologique annuel',
        notes: 'Première visite'
      },
      {
        appointmentId: 'APT-000003',
        patient: patients[2]._id,
        provider: doctor._id,
        date: new Date(today),
        startTime: '11:00',
        endTime: '12:00',
        time: '11:00',
        duration: 60,
        type: 'follow-up',
        department: 'ophthalmology',
        status: 'scheduled',
        reason: 'Suivi glaucome',
        notes: 'Vérifier la pression intraoculaire'
      },
      {
        appointmentId: 'APT-000004',
        patient: patients[3]._id,
        provider: doctor._id,
        date: new Date(today),
        startTime: '14:00',
        endTime: '14:30',
        time: '14:00',
        duration: 30,
        type: 'consultation',
        department: 'ophthalmology',
        status: 'confirmed',
        reason: 'Consultation générale',
        notes: ''
      },
      {
        appointmentId: 'APT-000005',
        patient: patients[4]._id,
        provider: doctor._id,
        date: new Date(today),
        startTime: '15:00',
        endTime: '15:45',
        time: '15:00',
        duration: 45,
        type: 'routine-checkup',
        department: 'ophthalmology',
        status: 'scheduled',
        reason: 'Prescription de lunettes',
        notes: 'Myopie sévère, vérifier la correction'
      }
    ];

    // Insert appointments only if they don't already exist
    const appointments = [];
    let aptsCreated = 0;
    let aptsSkipped = 0;

    for (const aptData of appointmentsData) {
      const existing = await Appointment.findOne({ appointmentId: aptData.appointmentId });
      if (existing) {
        appointments.push(existing);
        aptsSkipped++;
      } else {
        const newApt = await Appointment.create(aptData);
        appointments.push(newApt);
        aptsCreated++;
      }
    }
    console.log(`Appointments: ${aptsCreated} created, ${aptsSkipped} already existed`);

    // Note: Prescriptions require visits which adds complexity
    // Skipping for now to maintain data consistency
    console.log('Skipping prescriptions (require visit references)');

    // Create ophthalmology exams (only if clinic exists)
    const exams = [];
    if (clinic) {
      const examsData = [
        {
          patient: patients[2]._id,
          examiner: doctor._id,
          clinic: clinic._id,
          examType: 'comprehensive',
          visualAcuity: {
            distance: {
              OD: { uncorrected: '20/40', corrected: '20/25' },
              OS: { uncorrected: '20/50', corrected: '20/30' }
            }
          },
          iop: {
            OD: { value: 22, method: 'goldmann' },
            OS: { value: 24, method: 'goldmann' }
          },
          refraction: {
            subjective: {
              OD: { sphere: -1.50, cylinder: -0.50, axis: 90 },
              OS: { sphere: -1.75, cylinder: -0.75, axis: 85 }
            }
          },
          assessment: {
            summary: 'Glaucome à angle ouvert bilatéral avec pression intraoculaire élevée',
            diagnoses: [
              { eye: 'OU', diagnosis: 'Glaucome primaire à angle ouvert', icdCode: 'H40.1', status: 'stable' }
            ]
          },
          plan: {
            followUp: {
              required: true,
              timeframe: '3 months',
              reason: 'Contrôle pression intraoculaire'
            }
          },
          status: 'completed'
        },
        {
          patient: patients[4]._id,
          examiner: doctor._id,
          clinic: clinic._id,
          examType: 'refraction',
          visualAcuity: {
            distance: {
              OD: { uncorrected: '20/200', corrected: '20/25' },
              OS: { uncorrected: '20/200', corrected: '20/25' }
            }
          },
          refraction: {
            subjective: {
              OD: { sphere: -6.00, cylinder: -1.25, axis: 180 },
              OS: { sphere: -5.75, cylinder: -1.00, axis: 175 }
            }
          },
          assessment: {
            summary: 'Myopie forte bilatérale stable',
            diagnoses: [
              { eye: 'OU', diagnosis: 'Myopie dégénérative', icdCode: 'H44.2', status: 'stable' }
            ]
          },
          plan: {
            followUp: {
              required: true,
              timeframe: '1 year',
              reason: 'Surveillance du fond d\'œil'
            },
            education: ['Verres amincis recommandés']
          },
          status: 'completed'
        }
      ];

      // Use save() to trigger pre-save hook for examId generation
      for (const examData of examsData) {
        const exam = new OphthalmologyExam(examData);
        await exam.save();
        exams.push(exam);
      }
      console.log(`Created ${exams.length} ophthalmology exams`);
    } else {
      console.log('Skipped ophthalmology exams (no clinic found)');
    }

    // Final counts
    const finalPatientCount = await Patient.countDocuments();
    const finalVisitCount = await Visit.countDocuments();
    const finalExamCount = await OphthalmologyExam.countDocuments();

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('CONGO DATA SEED COMPLETE');
    console.log('='.repeat(60));
    console.log(`
Mode: ${forceClear ? '🗑️  DESTRUCTIVE (data was cleared)' : '✅ SAFE (data preserved)'}

Sample Patients Added:
  - Mbuyi Kabongo (Kinshasa) - Hypertension
  - Tshala Mwamba (Lubumbashi)
  - Nkulu Tshisekedi (Kinshasa) - Diabète, Glaucome
  - Marie Lukusa (Goma)
  - Jean Ilunga (Mbuji-Mayi) - Myopie sévère

This Session:
  - Patients: ${created} created, ${skipped} skipped
  - Appointments: ${aptsCreated} created, ${aptsSkipped} skipped
  - Ophthalmology Exams: ${exams.length} created

Final Database Totals:
  - Total Patients: ${finalPatientCount.toLocaleString()}
  - Total Visits: ${finalVisitCount.toLocaleString()}
  - Total Ophthalmology Exams: ${finalExamCount.toLocaleString()}
`);
    console.log('='.repeat(60));
    console.log('\n💡 TIP: To import real Tombalbaye data, run:');
    console.log('   node scripts/importPatientsWithPapa.js');
    console.log('   node scripts/importLegacyConsultations.js');
    console.log('   node scripts/importLegacyActes.js');

  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

// Run the seed
seedCongoData();
