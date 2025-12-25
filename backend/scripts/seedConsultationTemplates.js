/**
 * Seed Consultation Templates
 *
 * Creates 6 default system templates for common ophthalmology consultation types.
 * Run with: node scripts/seedConsultationTemplates.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedConsultationTemplates.js');

const ConsultationTemplate = require('../models/ConsultationTemplate');

const systemTemplates = [
  // 1. Routine Refraction
  {
    name: 'Réfraction de routine',
    description: 'Consultation standard pour contrôle de la vue et prescription de lunettes',
    type: 'routine',
    category: 'refraction',
    isSystemTemplate: true,
    order: 10,
    icon: 'glasses',
    color: 'blue',
    prefillData: {
      complaint: {
        motif: 'Contrôle de la vue',
        duration: '',
        notes: ''
      },
      examination: {
        focusSections: ['visualAcuity', 'refraction'],
        requiredFields: ['visualAcuity.OD.uncorrected', 'visualAcuity.OS.uncorrected', 'subjective.OD.sphere', 'subjective.OS.sphere'],
        notes: ''
      },
      diagnoses: [
        { code: 'H52.1', name: 'Myopie', category: 'Refraction' },
        { code: 'H52.0', name: 'Hypermétropie', category: 'Refraction' },
        { code: 'H52.2', name: 'Astigmatisme', category: 'Refraction' }
      ],
      procedures: [],
      medications: [],
      followUp: {
        suggestedInterval: 12,
        intervalUnit: 'months',
        notes: 'Contrôle annuel de la vue'
      }
    }
  },

  // 2. Glaucoma Follow-up
  {
    name: 'Suivi glaucome',
    description: 'Suivi de patient glaucomateux - PIO, champ visuel, OCT',
    type: 'glaucoma-followup',
    category: 'medical',
    isSystemTemplate: true,
    order: 20,
    icon: 'eye',
    color: 'green',
    prefillData: {
      complaint: {
        motif: 'Suivi glaucome',
        duration: '',
        notes: ''
      },
      examination: {
        focusSections: ['iop', 'fundus', 'gonioscopy', 'visualField', 'oct'],
        requiredFields: ['iop.OD.value', 'iop.OS.value'],
        notes: 'Vérifier observance traitement'
      },
      diagnoses: [
        { code: 'H40.11', name: 'Glaucome primitif à angle ouvert', category: 'Glaucoma' }
      ],
      procedures: [
        { code: 'CV', name: 'Champ Visuel (Humphrey)', category: 'Functional', laterality: 'OU' },
        { code: 'OCT', name: 'OCT Nerf Optique', category: 'Imaging', laterality: 'OU' },
        { code: 'PACHY', name: 'Pachymétrie', category: 'Functional', laterality: 'OU' }
      ],
      medications: [],
      followUp: {
        suggestedInterval: 3,
        intervalUnit: 'months',
        notes: 'Contrôle trimestriel de la PIO'
      }
    }
  },

  // 3. Post-Cataract Day 1
  {
    name: 'Post-cataracte J1',
    description: 'Contrôle post-opératoire J1 après chirurgie de la cataracte',
    type: 'post-cataract',
    category: 'surgical',
    isSystemTemplate: true,
    order: 30,
    icon: 'check-circle',
    color: 'purple',
    prefillData: {
      complaint: {
        motif: 'Contrôle post-opératoire J1',
        duration: '1',
        durationUnit: 'days',
        notes: 'Chirurgie cataracte réalisée hier'
      },
      examination: {
        focusSections: ['visualAcuity', 'slitLamp', 'iop'],
        requiredFields: ['visualAcuity.OD.uncorrected', 'iop.OD.value', 'iop.OS.value'],
        notes: 'Vérifier: cornée claire, chambre antérieure calme, IOL en place, PIO normale'
      },
      diagnoses: [
        { code: 'Z96.1', name: 'Présence de lentille intraoculaire', category: 'Post-op' },
        { code: 'H25.9', name: 'Cataracte sénile (opérée)', category: 'Cataract' }
      ],
      procedures: [],
      medications: [
        {
          name: 'Pred Forte 1%',
          dosage: '1 goutte',
          frequency: '4x/jour',
          duration: '4 semaines',
          instructions: 'Diminuer progressivement'
        },
        {
          name: 'Tobramycine 0.3%',
          dosage: '1 goutte',
          frequency: '3x/jour',
          duration: '2 semaines',
          instructions: ''
        },
        {
          name: 'Nepafenac 0.1%',
          dosage: '1 goutte',
          frequency: '3x/jour',
          duration: '4 semaines',
          instructions: 'AINS'
        }
      ],
      followUp: {
        suggestedInterval: 7,
        intervalUnit: 'days',
        notes: 'Contrôle à 1 semaine post-op'
      }
    }
  },

  // 4. Diabetic Screening
  {
    name: 'Dépistage diabétique',
    description: 'Examen de fond d\'oeil pour rétinopathie diabétique',
    type: 'diabetic-screening',
    category: 'screening',
    isSystemTemplate: true,
    order: 40,
    icon: 'search',
    color: 'orange',
    prefillData: {
      complaint: {
        motif: 'Dépistage rétinopathie diabétique',
        duration: '',
        notes: 'Patient diabétique - contrôle annuel FO'
      },
      examination: {
        focusSections: ['visualAcuity', 'fundus', 'oct'],
        requiredFields: ['visualAcuity.OD.corrected', 'visualAcuity.OS.corrected'],
        notes: 'FO dilaté obligatoire. Classer selon ETDRS.'
      },
      diagnoses: [
        { code: 'E11.311', name: 'Diabète type 2 avec rétinopathie', category: 'Retina' }
      ],
      procedures: [
        { code: 'PHOTO', name: 'Rétinographie', category: 'Imaging', laterality: 'OU' },
        { code: 'OCT', name: 'OCT Macula', category: 'Imaging', laterality: 'OU' }
      ],
      medications: [],
      followUp: {
        suggestedInterval: 12,
        intervalUnit: 'months',
        notes: 'Contrôle annuel si pas de rétinopathie. Plus fréquent si RD présente.'
      }
    }
  },

  // 5. Red Eye
  {
    name: 'Œil rouge',
    description: 'Consultation pour œil rouge aigu - examen segment antérieur',
    type: 'red-eye',
    category: 'medical',
    isSystemTemplate: true,
    order: 50,
    icon: 'alert-circle',
    color: 'red',
    prefillData: {
      complaint: {
        motif: 'Œil rouge',
        duration: '',
        severity: 'moderate',
        notes: 'Interroger: douleur, photophobie, BAV, sécrétions, prurit'
      },
      examination: {
        focusSections: ['visualAcuity', 'slitLamp', 'iop'],
        requiredFields: ['visualAcuity.OD.uncorrected', 'visualAcuity.OS.uncorrected', 'iop.OD.value', 'iop.OS.value'],
        notes: 'Test fluorescéine. Éversion paupières si corps étranger suspecté.'
      },
      diagnoses: [
        { code: 'H10.9', name: 'Conjonctivite', category: 'External' },
        { code: 'H16.0', name: 'Kératite', category: 'Cornea' },
        { code: 'H20.0', name: 'Iridocyclite aiguë', category: 'Uvea' }
      ],
      procedures: [],
      medications: [
        {
          name: 'Tobramycine 0.3%',
          dosage: '1 goutte',
          frequency: '4x/jour',
          duration: '7 jours',
          instructions: 'Si conjonctivite bactérienne'
        }
      ],
      followUp: {
        suggestedInterval: 3,
        intervalUnit: 'days',
        notes: 'Recontrôle si persistance ou aggravation'
      }
    }
  },

  // 6. Presbyopia Control
  {
    name: 'Contrôle presbytie',
    description: 'Ajustement de l\'addition pour vision de près',
    type: 'presbyopia',
    category: 'refraction',
    isSystemTemplate: true,
    order: 60,
    icon: 'book-open',
    color: 'indigo',
    prefillData: {
      complaint: {
        motif: 'Difficulté vision de près',
        duration: '',
        notes: 'Fatigue lecture, éloigne documents'
      },
      examination: {
        focusSections: ['visualAcuity', 'refraction'],
        requiredFields: ['visualAcuity.OD.near', 'visualAcuity.OS.near', 'subjective.OD.add', 'subjective.OS.add'],
        notes: 'Tester ADD progressive. Vérifier distance de travail habituelle.'
      },
      diagnoses: [
        { code: 'H52.4', name: 'Presbytie', category: 'Refraction' }
      ],
      procedures: [],
      medications: [],
      followUp: {
        suggestedInterval: 18,
        intervalUnit: 'months',
        notes: 'Réajustement ADD si nécessaire (progression jusqu\'à ~60 ans)'
      }
    }
  }
];

async function seedTemplates() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Check existing system templates
    const existingCount = await ConsultationTemplate.countDocuments({ isSystemTemplate: true });
    console.log(`Found ${existingCount} existing system templates`);

    if (existingCount > 0) {
      console.log('Removing existing system templates...');
      await ConsultationTemplate.deleteMany({ isSystemTemplate: true });
    }

    // Insert new templates
    console.log('Inserting system templates...');
    const result = await ConsultationTemplate.insertMany(systemTemplates);
    console.log(`Successfully inserted ${result.length} consultation templates:`);

    result.forEach((template, index) => {
      console.log(`  ${index + 1}. ${template.name} (${template.type})`);
    });

    console.log('\n✓ Consultation templates seeded successfully!');

  } catch (error) {
    console.error('Error seeding templates:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  seedTemplates();
}

module.exports = { seedTemplates, systemTemplates };
