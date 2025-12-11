const mongoose = require('mongoose');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const Patient = require('../models/Patient');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' });

async function seedImagingData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('Connected to MongoDB');

    // Get a sample patient (or create one)
    let patient = await Patient.findOne();
    if (!patient) {
      patient = await Patient.create({
        firstName: 'Jean',
        lastName: 'Dupont',
        dateOfBirth: new Date('1980-05-15'),
        gender: 'male',
        contact: {
          phone: '+243 123 456 789',
          email: 'jean.dupont@example.com'
        },
        address: {
          street: '123 Avenue de la Liberté',
          city: 'Kinshasa',
          country: 'RDC'
        },
        patientId: 'PAT20250001'
      });
      console.log('Created sample patient:', patient.patientId);
    } else {
      console.log('Using existing patient:', patient.patientId);
    }

    // Get a sample examiner (admin or doctor)
    let examiner = await User.findOne({ role: { $in: ['admin', 'doctor'] } });
    if (!examiner) {
      console.error('No admin or doctor found. Please create a user first.');
      process.exit(1);
    }
    console.log('Using examiner:', examiner.firstName, examiner.lastName);

    // Create sample exams with imaging
    const examsData = [
      {
        examType: 'comprehensive',
        chiefComplaint: {
          complaint: 'Vision floue et mouches volantes',
          duration: '2 semaines',
          severity: 'moderate',
          laterality: 'OU'
        },
        images: [
          {
            type: 'oct',
            eye: 'OD',
            url: '/images_ophta/oct_fundus_sample/oct_normal_1.jpg',
            caption: 'OCT Maculaire - Œil droit (Analyse des couches rétiniennes)',
            takenAt: new Date()
          },
          {
            type: 'fundus',
            eye: 'OD',
            url: '/images_ophta/oct_fundus_sample/fundus_od.jpg',
            caption: 'Rétinographie couleur OD - Fond d\'œil normal',
            takenAt: new Date()
          },
          {
            type: 'fundus',
            eye: 'OS',
            url: '/images_ophta/oct_fundus_sample/fundus_os.jpg',
            caption: 'Rétinographie couleur OS - Surveillance diabète',
            takenAt: new Date()
          }
        ],
        visualAcuity: {
          distance: {
            OD: { uncorrected: '20/40', corrected: '20/20' },
            OS: { uncorrected: '20/30', corrected: '20/20' }
          },
          method: 'snellen'
        },
        iop: {
          OD: { value: 14, method: 'goldmann', time: '10:00' },
          OS: { value: 15, method: 'goldmann', time: '10:00' }
        },
        fundus: {
          dilated: true,
          dilatingAgent: 'Tropicamide 1%',
          OD: {
            disc: {
              size: 'normal',
              color: 'rose',
              margins: 'nets',
              cupToDisc: 0.3
            },
            vessels: {
              arteries: 'normales',
              veins: 'normales',
              avRatio: '2:3'
            },
            macula: {
              normal: true,
              fovealReflex: 'présent'
            },
            periphery: {
              normal: true
            }
          },
          OS: {
            disc: {
              size: 'normal',
              color: 'rose',
              margins: 'nets',
              cupToDisc: 0.3
            },
            vessels: {
              arteries: 'normales',
              veins: 'normales',
              avRatio: '2:3'
            },
            macula: {
              normal: true,
              fovealReflex: 'présent'
            },
            periphery: {
              normal: true
            }
          }
        },
        additionalTests: {
          oct: {
            performed: true,
            findings: 'Épaisseur maculaire normale. Pas d\'œdème. Structures rétiniennes intactes.'
          },
          fundusPhotography: {
            performed: true,
            findings: 'Disque optique normal. Macula sans particularité. Vaisseaux normaux.'
          }
        },
        assessment: {
          diagnoses: [
            {
              eye: 'OU',
              diagnosis: 'Décollement du vitré postérieur',
              icdCode: 'H43.81',
              severity: 'benign',
              status: 'new'
            }
          ],
          summary: 'Décollement du vitré postérieur bilatéral sans déchirure rétinienne. Fond d\'œil normal.'
        },
        plan: {
          followUp: {
            required: true,
            timeframe: '1 mois',
            reason: 'Surveillance évolution symptômes'
          },
          education: [
            'Consulter immédiatement si augmentation des mouches volantes',
            'Consulter immédiatement si flash lumineux',
            'Consulter immédiatement si voile noir dans le champ visuel'
          ]
        },
        status: 'completed',
        completedAt: new Date()
      },
      {
        examType: 'follow-up',
        chiefComplaint: {
          complaint: 'Contrôle glaucome',
          duration: '3 mois',
          severity: 'mild',
          laterality: 'OU'
        },
        images: [
          {
            type: 'oct',
            eye: 'OU',
            url: '/images_ophta/oct_fundus_sample/oct_normal_1.jpg',
            caption: 'OCT du nerf optique - Surveillance glaucome (RNFL)',
            takenAt: new Date(Date.now() - 86400000) // Yesterday
          }
        ],
        visualAcuity: {
          distance: {
            OD: { corrected: '20/20' },
            OS: { corrected: '20/20' }
          },
          method: 'snellen'
        },
        iop: {
          OD: { value: 16, method: 'goldmann', time: '09:30' },
          OS: { value: 17, method: 'goldmann', time: '09:30' }
        },
        additionalTests: {
          oct: {
            performed: true,
            findings: 'Épaisseur des fibres nerveuses stable. Pas de progression.'
          }
        },
        assessment: {
          diagnoses: [
            {
              eye: 'OU',
              diagnosis: 'Glaucome primaire à angle ouvert, stable',
              icdCode: 'H40.11',
              severity: 'moderate',
              status: 'stable'
            }
          ],
          summary: 'Glaucome stable sous traitement. Tension oculaire contrôlée.'
        },
        plan: {
          followUp: {
            required: true,
            timeframe: '3 mois',
            reason: 'Surveillance habituelle glaucome'
          }
        },
        status: 'completed',
        completedAt: new Date(Date.now() - 86400000)
      },
      {
        examType: 'routine',
        chiefComplaint: {
          complaint: 'Examen de routine',
          duration: '1 an depuis dernier examen',
          severity: 'mild',
          laterality: 'OU'
        },
        images: [
          {
            type: 'fundus',
            eye: 'OD',
            url: '/images_ophta/oct_fundus_sample/fundus_od.jpg',
            caption: 'Rétinographie couleur OD - Bilan annuel',
            takenAt: new Date(Date.now() - 172800000) // 2 days ago
          },
          {
            type: 'fundus',
            eye: 'OS',
            url: '/images_ophta/oct_fundus_sample/fundus_os.jpg',
            caption: 'Rétinographie couleur OS - Bilan annuel',
            takenAt: new Date(Date.now() - 172800000)
          }
        ],
        visualAcuity: {
          distance: {
            OD: { uncorrected: '20/20' },
            OS: { uncorrected: '20/20' }
          },
          method: 'snellen'
        },
        iop: {
          OD: { value: 12, method: 'nct', time: '14:00' },
          OS: { value: 13, method: 'nct', time: '14:00' }
        },
        additionalTests: {
          fundusPhotography: {
            performed: true,
            findings: 'Fond d\'œil normal. Pas de signe de rétinopathie.'
          }
        },
        assessment: {
          diagnoses: [],
          summary: 'Examen ophtalmologique complet normal. Aucune pathologie détectée.'
        },
        plan: {
          followUp: {
            required: true,
            timeframe: '1 an',
            reason: 'Examen de routine annuel'
          }
        },
        status: 'completed',
        completedAt: new Date(Date.now() - 172800000)
      }
    ];

    // Delete existing sample exams (optional - comment out if you want to keep existing data)
    // await OphthalmologyExam.deleteMany({ patient: patient._id });

    // Create exams
    for (const examData of examsData) {
      const exam = new OphthalmologyExam({
        patient: patient._id,
        examiner: examiner._id,
        createdBy: examiner._id,
        examType: examData.examType,
        chiefComplaint: examData.chiefComplaint,
        visualAcuity: examData.visualAcuity,
        iop: examData.iop,
        fundus: examData.fundus,
        additionalTests: examData.additionalTests,
        assessment: examData.assessment,
        plan: examData.plan,
        status: examData.status,
        completedAt: examData.completedAt
      });

      // Manually add images to avoid spread operator issues
      exam.images = examData.images;

      await exam.save();
      console.log(`Created exam: ${exam.examId} with ${exam.images.length} images`);
    }

    console.log('\n✅ Imaging data seeded successfully!');
    console.log(`\nCreated ${examsData.length} ophthalmology exams with imaging data`);
    console.log('Images are served from: backend/public/imaging/');
    console.log('\nYou can now view them at: http://localhost:5173/imaging');

  } catch (error) {
    console.error('Error seeding imaging data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedImagingData();
