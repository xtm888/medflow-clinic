require('dotenv').config();
const mongoose = require('mongoose');
const MedicationTemplate = require('../models/MedicationTemplate');
const ExaminationTemplate = require('../models/ExaminationTemplate');
const PathologyTemplate = require('../models/PathologyTemplate');
const LaboratoryTemplate = require('../models/LaboratoryTemplate');
const ClinicalTemplate = require('../models/ClinicalTemplate');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
  console.log('Connected to MongoDB');

  try {
    // Clear existing templates
    console.log('Clearing existing templates...');
    await Promise.all([
      MedicationTemplate.deleteMany({}),
      ExaminationTemplate.deleteMany({}),
      PathologyTemplate.deleteMany({}),
      LaboratoryTemplate.deleteMany({}),
      ClinicalTemplate.deleteMany({})
    ]);
    console.log('✓ Cleared existing templates');

    // Seed all templates
    await seedMedicationTemplates();
    await seedExaminationTemplates();
    await seedLaboratoryTemplates();
    await seedClinicalTemplates();
    await seedPathologyTemplates();

    console.log('\n✅ All templates seeded successfully!');

    // Wait a moment to ensure all writes are flushed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Close connection properly
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
});

// ===== MEDICATION TEMPLATES =====
async function seedMedicationTemplates() {
  console.log('\nSeeding Medication Templates...');

  const medications = [
    // A.I.N.S GENERAUX + CORTICOIDES
    ...generateMedications('A.I.N.S GENERAUX + CORTICOIDES', [
      { name: 'ADVIL', form: 'cp' },
      { name: 'ASPEGIC', form: 'pdre sol inj', dosage: '500 mg', packaging: '6 fl +6 amp 5 ml' },
      { name: 'ASPIRINE DU RHONE', form: 'cp', dosage: '500 mg', packaging: '20' },
      { name: 'BRUFEN', form: 'cp', dosage: '400mg', packaging: '10' },
      { name: 'BRUFENAL', form: 'Capsules', dosage: '400mg' },
      { name: 'CATALGINE NORMALE', form: 'pdre sol buv', dosage: '0,50 g', packaging: '20 sach' },
      { name: 'CELESTENE', form: 'cp', dosage: '2mg' },
      { name: 'CELESTENE INJECTABLE', form: 'inj' },
      { name: 'CORTANCYL', form: 'cp', dosage: '1 mg', packaging: '30' },
      { name: 'CORTANCYL', form: 'cp séc', dosage: '20 mg', packaging: '20' },
      { name: 'CORTANCYL', form: 'cp séc', dosage: '5 mg', packaging: '30' },
      { name: 'DAFALGAN', form: 'gél', dosage: '500 mg', packaging: '16' },
      { name: 'DICLOFENAC', form: 'cp' },
      { name: 'DICLOFENAC', form: 'inj' },
      { name: 'DICLOFENAC', form: 'suppo', dosage: '100 MG' },
      { name: 'DOLIPRANE', form: 'cp', dosage: '500 mg', packaging: '16' },
      { name: 'EFFERALGAN', form: 'cp', dosage: '500 mg', packaging: '16' },
      { name: 'IBUPROFEN', form: 'cp', dosage: '400 MG' },
      { name: 'PREDNISOLONE', form: 'cp', dosage: '20 MG' },
      { name: 'PREDNISOLONE', form: 'cp', dosage: '5 MG' }
    ]),

    // A.I.N.S LOCAUX
    ...generateMedications('A.I.N.S LOCAUX', [
      { name: 'ACULAR', form: 'collyre', dosage: '0,5 %', packaging: 'fl 5 ml' },
      { name: 'DICLOCED', form: 'collyre', dosage: '0,1%' },
      { name: 'INDOCOLLYRE', form: 'collyre', dosage: '0,1 %', packaging: 'fl 5 ml' },
      { name: 'INDOCOLLYRE', form: 'collyre unidose', dosage: '0,1 %', packaging: '20x0,35 ml' },
      { name: 'VOLTARENE', form: 'collyre', dosage: '0,1 %', packaging: 'fl 5 ml' },
      { name: 'VOLTARENE', form: 'collyre unidose', dosage: '0,1 %', packaging: '20x0,3 ml' }
    ]),

    // ANTI ALLERGIQUES
    ...generateMedications('ANTI ALLERGIQUES', [
      { name: 'AERIUS', form: 'cp' },
      { name: 'AERIUS', form: 'sirop' },
      { name: 'ALLERGODIL', form: 'collyre', dosage: '0,05 %', packaging: 'fl 6 ml' },
      { name: 'CROMABAK', form: 'collyre', dosage: '2 %', packaging: 'fl 10 ml' },
      { name: 'OPATANOL', form: 'collyre', packaging: 'fl 5 ml' },
      { name: 'ZADITEN', form: 'collyre', dosage: '0,25mg', packaging: 'fl 5ml' },
      { name: 'ZADITEN', form: 'collyre unidose', dosage: '0,25mg' },
      { name: 'CLARITYNE', form: 'cp', dosage: '10 mg', packaging: '15' },
      { name: 'CLARITYNE', form: 'sirop', dosage: '0,1 %', packaging: 'fl 60 ml' }
    ]),

    // ANTIBIOTIQUE LOCAUX
    ...generateMedications('ANTIBIOTIQUE LOCAUX', [
      { name: 'TOBREX', form: 'collyre', packaging: 'fl 5 ml' },
      { name: 'TOBREX', form: 'pom opht', packaging: 'tube 5 g' },
      { name: 'CILOXAN', form: 'collyre', dosage: '0,3 %', packaging: 'fl 5 ml' },
      { name: 'CILOXAN', form: 'pom' },
      { name: 'GENTALLINE', form: 'collyre', dosage: '0,3 %', packaging: 'fl 5 ml' },
      { name: 'RIFAMYCINE CHIBRET', form: 'collyre', dosage: '1 %', packaging: 'fl 10 ml' },
      { name: 'RIFAMYCINE CHIBRET', form: 'pom opht', dosage: '1 %', packaging: 'tube 5 g' },
      { name: 'AZYTER', form: 'unidoses' }
    ]),

    // ANTIBIOTIQUE GENERAUX
    ...generateMedications('ANTIBIOTIQUE GENERAUX', [
      { name: 'AUGMENTIN', form: 'cp', dosage: '500 MG' },
      { name: 'CLAMOXYL', form: 'gélules', dosage: '500mg', packaging: '12' },
      { name: 'CIPRODAC', form: 'cp', dosage: '500mg', packaging: '10' },
      { name: 'ROVAMYCINE', form: 'cp', dosage: '1,5M' },
      { name: 'ROVAMYCINE', form: 'cp', dosage: '3M' },
      { name: 'DOXY', form: 'cp', dosage: '100' }
    ]),

    // ANTI GLAUCOMATEUX
    ...generateMedications('ANTI GLAUCOMATEUX', [
      { name: 'TIMOPTOL', form: 'collyre', dosage: '0,25 %', packaging: 'fl 3 ml' },
      { name: 'TIMOPTOL', form: 'collyre', dosage: '0,50 %', packaging: 'fl 3 ml' },
      { name: 'TIMOPTOL LP', form: 'collyre', dosage: '0,25 %', packaging: 'fl 2,5 ml' },
      { name: 'TIMOPTOL LP', form: 'collyre', dosage: '0,50 %', packaging: 'fl 2,5 ml' },
      { name: 'XALATAN', form: 'collyre', dosage: '0,005 %', packaging: '2,5 ml en fl 5 ml' },
      { name: 'XALACOM', form: 'collyre' },
      { name: 'LUMIGAN', form: 'collyre', dosage: '0,3%' },
      { name: 'TRAVATAN', form: 'collyre' },
      { name: 'COSOPT', form: 'collyre', packaging: 'fl 5 ml' },
      { name: 'AZOPT', form: 'collyre' },
      { name: 'DIAMOX', form: 'cp séc', dosage: '250 mg', packaging: '24' },
      { name: 'PILOCARPINE', form: 'collyre', dosage: '1%' },
      { name: 'PILOCARPINE', form: 'collyre', dosage: '2%' },
      { name: 'ALPHAGAN', form: 'collyre', dosage: '0,2 %', packaging: 'fl 5 ml' }
    ]),

    // CORTICOIDES LOCAUX
    ...generateMedications('CORTICOIDES LOCAUX', [
      { name: 'MAXIDEX', form: 'collyre', dosage: '0,1 %', packaging: 'fl 3 ml' },
      { name: 'DEXAMETHASONE', form: 'collyre', dosage: '0,1%' },
      { name: 'DEXAMETHASONE', form: 'unidose' },
      { name: 'PRED FORTE', form: 'collyre', dosage: '1%' },
      { name: 'VEXOL', form: 'collyre', dosage: '1%' },
      { name: 'FML', form: 'collyre' }
    ]),

    // CORTICOIDES + ANTIBIOTIQUES
    ...generateMedications('CORTICOIDES + ANTIBIOTIQUES', [
      { name: 'TOBRADEX', form: 'collyre', packaging: 'fl 5 ml' },
      { name: 'TOBRADEX', form: 'pommade' },
      { name: 'MAXIDROL', form: 'collyre', packaging: 'fl 3 ml' },
      { name: 'MAXIDROL', form: 'pom opht', packaging: 'tube 3,5 g' },
      { name: 'FRAKIDEX', form: 'collyre', packaging: 'fl 5 ml' },
      { name: 'FRAKIDEX', form: 'pom opht', packaging: 'tube 5 g' }
    ]),

    // CICATRISANTS
    ...generateMedications('CICATRISANTS', [
      { name: 'VITACIC', form: 'collyre', packaging: '5 ml' },
      { name: 'VITACIC', form: 'collyre unidose', packaging: '100x0,4 ml' },
      { name: 'VITAMINE A FAURE', form: 'collyre', packaging: '10 ml' },
      { name: 'VITAMINE A DULCIS', form: 'pom opht', packaging: 'tube 10 g' },
      { name: 'VITAMINE B12', form: 'collyre', dosage: '0,05 %', packaging: '5 ml' },
      { name: 'VITAMINE B12', form: 'collyre unidose', dosage: '0,05 %', packaging: '20x0,4 ml' }
    ]),

    // MYDRIATIQUES
    ...generateMedications('MYDRIATIQUES', [
      { name: 'ATROPINE', form: 'collyre', dosage: '0,5%' },
      { name: 'ATROPINE', form: 'collyre', dosage: '1%' },
      { name: 'ATROPINE FAURE', form: 'collyre unidose', dosage: '1 %', packaging: '100 unidoses 0,4 ml' },
      { name: 'CYCLOGYL', form: 'collyre', dosage: '1%' },
      { name: 'TROPICAMIDE FAURE', form: 'collyre unidose', dosage: '0,5 %', packaging: '20 unidoses 0,4 ml' },
      { name: 'NEOSYNEPHRINE FAURE', form: 'collyre', dosage: '10 %', packaging: '5 ml' },
      { name: 'NEOSYNEPHRINE FAURE', form: 'collyre', dosage: '5 %', packaging: '5 ml' },
      { name: 'MYDRIASERT', form: 'insert' }
    ]),

    // LARMES ARTIFICIELLES
    ...generateMedications('LARMES ARTIFICIELLES', [
      { name: 'Lacrinorm', form: 'gel' }
    ]),

    // VASCULOTROPES
    ...generateMedications('VASCULOTROPES', [
      { name: 'PRESERVISION 3', form: 'cp' },
      { name: 'NUTROF TOTAL', form: 'cp' },
      { name: 'VITALUX', form: 'cp' },
      { name: 'VISIOPREV', form: 'cp' },
      { name: 'VISIOPREV Duo', form: 'cp' },
      { name: 'DIFRAREL 100', form: 'cp' },
      { name: 'DIFRAREL E', form: 'cp' },
      { name: 'VASTAREL 35', form: 'cp' }
    ]),

    // ANTI VIRAUX
    ...generateMedications('ANTI VIRAUX', [
      { name: 'ZOVIRAX', form: 'pommade ophtalmique' },
      { name: 'ZOVIRAX', form: 'crème dermique' },
      { name: 'ZOVIRAX', form: 'cp', dosage: '800' },
      { name: 'ZELITREX', form: 'cp' },
      { name: 'VIRGAN', form: 'gel opht' }
    ]),

    // VITAMINES
    ...generateMedications('VITAMINES', [
      { name: 'BENERVA COMPRIMES', form: 'cp' },
      { name: 'CEVITE', form: 'cp' },
      { name: 'CIPROVITAL SP', form: 'sp' },
      { name: 'FOREVER ABSORBENT - C', form: 'cp' },
      { name: 'FORTALINE PLUS', form: 'cp' },
      { name: 'FORVER VISION', form: 'cp' },
      { name: 'HIFER SP', form: 'sp' },
      { name: 'MULTIVITAMINE SP', form: 'sp' },
      { name: 'MY VITA AD', form: 'cp' },
      { name: 'MY VITA KID', form: 'cp' },
      { name: 'OCUGUARD', form: 'cp' },
      { name: 'PRESERVISION COMPRIMES', form: 'cp' },
      { name: 'ROVIGON/ CAPSULES', form: 'cp' },
      { name: 'TRIBEXFORT COMPRIMES', form: 'cp' },
      { name: 'TRIOMEGA', form: 'cp' },
      { name: 'VITAMINE B6 CES', form: 'cp' },
      { name: 'VITAMINE C INJ', form: 'inj' },
      { name: 'VITAMINES B-DENK', form: 'cp' }
    ])
  ];

  await MedicationTemplate.insertMany(medications);
  console.log(`✓ Seeded ${medications.length} medication templates`);
}

// Helper function to generate medication objects
function generateMedications(category, meds) {
  return meds.map(med => ({
    category,
    name: med.name,
    form: med.form || '',
    dosage: med.dosage || '',
    packaging: med.packaging || '',
    description: med.description || '',
    searchTerms: [med.name.toLowerCase()],
    isActive: true
  }));
}

// ===== EXAMINATION TEMPLATES =====
async function seedExaminationTemplates() {
  console.log('\nSeeding Examination Templates...');

  const examinations = [
    // TYPE REFRACTION
    ...generateExaminations('TYPE REFRACTION', [
      'Sans correction',
      'Ancienne réfraction',
      'Lunettes portées',
      'Lunettes portées - De loin',
      'Lunettes portées - De près',
      'Lunettes portées - Progressifs',
      'Lunettes portées - Bifocaux',
      'Autoréfractomètre',
      'Autoréfractomètre sous cyclo',
      'Réfraction subjective',
      'Réfraction subjective sous cyclo',
      'Tar',
      'Réfraction finale',
      'Prescription',
      'Skiascopie',
      'Javal'
    ]),

    // OPHTALMOLOGIE PROCEDURES
    ...generateExaminations('OPHTALMOLOGIE', [
      'Consultation ophtalmologique',
      'Consultation en urgence',
      'Consultation pré et post opératoire',
      'Biométrie',
      'OCT Macula',
      'OCT NO',
      'OCT NO et macula',
      'Champ visuel automatique',
      'Perimétrie automatisée blanc/blanc centrale',
      'Fluoangiographie retinienne',
      'Angiographie',
      'Fond d\'œil direct',
      'Fond d\'œil direct dilaté',
      'Gonioscopie',
      'Pachymétrie',
      'Tonométrie',
      'Kératométrie',
      'Topographie Cornéenne',
      'Refractométrie automatique',
      'Refractométrie automatique + cycloplégie',
      'Rétinophotographie C',
      'Rétinophotographie C+P',
      'Test de Schirmer',
      'Test de Jones',
      'Test à la Fluorescéïne',
      'Seance IVT AVASTIN',
      'Seance IVT Ranibizumab',
      'Seance IVT Ozurdex',
      'Seance IVT Kenacort',
      'LASER YAG',
      'LASER SLT',
      'LASER PHOTOCOAGULATION',
      'Chirurgie Phaco implant',
      'Chirurgie SICS',
      'CURETAGE CHALAZION',
      'Excision ptérygion',
      'Extraction corps étranger'
    ]),

    // ECHOGRAPHIE
    ...generateExaminations('ECHOGRAPHIE', [
      'ECHOGRAPHIE OCULAIRE',
      'ECHOGRAPHIE TETE ET COU',
      'ECHOGRAPHIE THORACIQUE',
      'ECHOGRAPHIE ABDOMINO-PELVIENNE',
      'ECHOGRAPHIE ARTICULATIONS/MEMBRES'
    ])
  ];

  await ExaminationTemplate.insertMany(examinations);
  console.log(`✓ Seeded ${examinations.length} examination templates`);
}

function generateExaminations(category, names) {
  return names.map(name => ({
    category,
    name,
    code: name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase(),
    isActive: true
  }));
}

// ===== LABORATORY TEMPLATES =====
async function seedLaboratoryTemplates() {
  console.log('\nSeeding Laboratory Templates...');

  const labs = [
    // HEMOGRAMME
    ...generateLabs('HEMOGRAMME', [
      { name: 'Hb', unit: 'g/dL', specimen: 'Sang' },
      { name: 'Hct', unit: '%', specimen: 'Sang' },
      { name: 'GR', unit: 'x10^6/µL', specimen: 'Sang' },
      { name: 'GB', unit: 'x10^3/µL', specimen: 'Sang' },
      { name: 'Plaquette', unit: 'x10^3/µL', specimen: 'Sang' },
      { name: 'VGM', unit: 'fL', specimen: 'Sang' },
      { name: 'TCMH', unit: 'pg', specimen: 'Sang' },
      { name: 'CCMH', unit: 'g/dL', specimen: 'Sang' },
      { name: 'Réticulocyte', unit: '%', specimen: 'Sang' }
    ]),

    // FONCTION HEPATIQUE
    ...generateLabs('BIOCHIMIE FONCTION HEPATIQUE', [
      { name: 'SGOT/ASAT', unit: 'U/L', normalRange: '< 45', specimen: 'Sang' },
      { name: 'SGPT/ALAT', unit: 'U/L', normalRange: '< 50', specimen: 'Sang' },
      { name: 'GGT', unit: 'U/L', normalRange: '6-50', specimen: 'Sang' },
      { name: 'PAL', unit: 'U/L', normalRange: '200-400', specimen: 'Sang' },
      { name: 'Bilirubine totale', unit: 'mg%', normalRange: '< 0.2', specimen: 'Sang' },
      { name: 'Bilirubine directe', unit: 'mg%', normalRange: '0.1', specimen: 'Sang' },
      { name: 'Bilirubine indirecte', unit: 'mg%', normalRange: '0.2', specimen: 'Sang' }
    ]),

    // FONCTION RENALE
    ...generateLabs('BIOCHIMIE FONCTION RENALE', [
      { name: 'Urée', unit: 'mg%', normalRange: '10-45', specimen: 'Sang' },
      { name: 'Créatinine', unit: 'mg%', normalRange: '0.8-1.3', specimen: 'Sang' },
      { name: 'Acide urique', unit: 'mg%', normalRange: '3.5-7 (H), 2.5-6 (F)', specimen: 'Sang' },
      { name: 'Clearance créatinine', unit: 'ml/min', normalRange: '90-120', specimen: 'Autre' }
    ]),

    // GLYCEMIE
    ...generateLabs('DIABETE', [
      { name: 'Glycémie', unit: 'g/L', normalRange: '0.7-1.1', specimen: 'Sang' },
      { name: 'HbA1c', unit: '%', normalRange: '< 6.5', specimen: 'Sang' }
    ]),

    // LIPIDES
    ...generateLabs('BIOCHIMIE LIPIDES', [
      { name: 'Cholestérol Total', unit: 'g/L', normalRange: '< 2.0', specimen: 'Sang' },
      { name: 'HDL cholestérol', unit: 'g/L', normalRange: '> 0.4', specimen: 'Sang' },
      { name: 'LDL cholestérol', unit: 'g/L', normalRange: '< 1.3', specimen: 'Sang' },
      { name: 'Triglycéride', unit: 'g/L', normalRange: '< 1.5', specimen: 'Sang' },
      { name: 'Ratio LDL/HDL', normalRange: '< 3.5', specimen: 'Sang' }
    ]),

    // SEROLOGIE VIRALE
    ...generateLabs('SEROLOGIE VIRALE', [
      { name: 'VIH', specimen: 'Sang' },
      { name: 'AG HBS', specimen: 'Sang' },
      { name: 'AC ANTI-HBS', specimen: 'Sang' },
      { name: 'AC ANTI-HBC', specimen: 'Sang' },
      { name: 'AG HBE', specimen: 'Sang' },
      { name: 'AC ANTI HBE', specimen: 'Sang' },
      { name: 'SEROLOGIE VIRALE C (ANTI-CORPS)', specimen: 'Sang' },
      { name: 'PCR VIRUS B', specimen: 'Sang' },
      { name: 'PCR VIRUS C', specimen: 'Sang' }
    ]),

    // COAGULATION
    ...generateLabs('COAGULATION', [
      { name: 'TP/INR', normalRange: '70-100% / 0.8-1.2', specimen: 'Sang' },
      { name: 'TCA', unit: 'sec', normalRange: '25-35', specimen: 'Sang' },
      { name: 'Fibrinogène', unit: 'g/L', normalRange: '2-4', specimen: 'Sang' },
      { name: 'D-DIMER', unit: 'ng/mL', normalRange: '< 500', specimen: 'Sang' }
    ]),

    // IONOGRAMME
    ...generateLabs('IONOGRAMME SANGUIN', [
      { name: 'Sodium', unit: 'mEq/L', normalRange: '135-145', specimen: 'Sang' },
      { name: 'Potassium', unit: 'mEq/L', normalRange: '3.5-5.0', specimen: 'Sang' },
      { name: 'Chlore', unit: 'mEq/L', normalRange: '95-105', specimen: 'Sang' },
      { name: 'Calcium', unit: 'mg/dL', normalRange: '8.5-10.5', specimen: 'Sang' },
      { name: 'Phosphore', unit: 'mg/dL', normalRange: '2.5-4.5', specimen: 'Sang' },
      { name: 'Magnésium', unit: 'mg/dL', normalRange: '1.5-2.5', specimen: 'Sang' }
    ]),

    // URINES
    ...generateLabs('URINES', [
      { name: 'SEDIMENT URINAIRE', specimen: 'Urine' },
      { name: 'URO-CULTURE (ECBU)', specimen: 'Urine' },
      { name: 'Bandelette Urinaire', specimen: 'Urine' }
    ]),

    // PROFIL UVEITE
    ...generateLabs('PROFIL UVEITE', [
      { name: 'ANA', specimen: 'Sang' },
      { name: 'FACTEUR RHUMATOIDE', specimen: 'Sang' },
      { name: 'ACE', specimen: 'Sang' },
      { name: 'HERPES SIMPLEX I IgM et IgG', specimen: 'Sang' },
      { name: 'HERPES SIMPLEX II IgM et IgG', specimen: 'Sang' },
      { name: 'HLA B27', specimen: 'Sang' },
      { name: 'TOXOPLASMA IgG', specimen: 'Sang' },
      { name: 'TOXOPLASMA IgM', specimen: 'Sang' }
    ])
  ];

  // Create lab profiles
  const profiles = [
    {
      category: 'CHECK UP PROMO',
      name: 'CHECK UP PROMO - Complet',
      isProfile: true,
      price: 50000,
      description: 'Bilan de santé complet'
    },
    {
      category: 'PROFIL DIABETIQUE A',
      name: 'PROFIL DIABETIQUE A - Complet',
      isProfile: true,
      price: 35000,
      description: 'Bilan diabétique complet'
    },
    {
      category: 'CHIRURGIE OPHTALMOLOGIQUE',
      name: 'CHIRURGIE OPHTALMOLOGIQUE 1 - Pré-op',
      isProfile: true,
      price: 25000,
      description: 'Bilan pré-opératoire'
    }
  ];

  await LaboratoryTemplate.insertMany([...labs, ...profiles]);
  console.log(`✓ Seeded ${labs.length + profiles.length} laboratory templates`);
}

function generateLabs(category, tests) {
  return tests.map(test => ({
    category,
    name: test.name,
    unit: test.unit || '',
    normalRange: test.normalRange || '',
    specimen: test.specimen || 'Sang',
    isProfile: false,
    isActive: true
  }));
}

// ===== CLINICAL TEMPLATES =====
async function seedClinicalTemplates() {
  console.log('\nSeeding Clinical Templates...');

  const templates = [
    // ANAMNESE MOBILE - Complete list from Care Vision mockups
    ...generateClinicalTemplates('ANAMNESE MOBILE', [
      'Baisse de la vision de loin et près',
      'Baisse de la vision de loin',
      'Baisse de la vision de près',
      'Céphalées',
      'Clignement de la paupière',
      'Contrôle',
      'Douleur',
      'Fatigue visuelle lecture',
      'Fatigue visuelle devant l\'ordinateur / TV',
      'Larmoiement',
      'Louche',
      'Lunettes: a abandonné(e)',
      'Lunettes: jamais portées',
      'Lunettes: pas à l\'aise',
      'Lunettes: renouvellement ordonnance',
      'Lunettes: Verres cassés',
      'Lunettes: port inconstant',
      'Picotement',
      'Rougeur',
      'Sécrétions',
      'Traitement',
      'Traitement: pas sérieux dans l\'observance',
      'Trauma',
      'Tuméfaction',
      'Vertiges',
      'Sensation de corps étrangers',
      'autre'
    ]),

    // DOMINANTE - Complete list from Care Vision mockups
    ...generateClinicalTemplates('DOMINANTE', [
      'Allergie',
      'Amblyopie',
      'Angiographie',
      'Asthénopie',
      'Blépharite',
      'C.V.',
      'Cataracte',
      'Céphalées',
      'Chalazion',
      'Cil',
      'Conjonctivite',
      'Controle',
      'Controle Laser',
      'Controle lentilles',
      'Controle post op',
      'Controle T.O.',
      'Corps étranger',
      'DE',
      'Décoll. post. vitré',
      'Diabète',
      'DMLA',
      'Episclérite',
      'F.O.',
      'Glaucome',
      'Hemorr. ss conj',
      'Herpès',
      'Insuff de convergence',
      'Irritation',
      'Kératite',
      'Lentilles',
      'Lunettes',
      'Migraine oph',
      'Névralgie',
      'Orgelet',
      'Orthoptie',
      'Petite chirurgie',
      'Sècheresse',
      'Strabisme',
      'Traumato',
      'Ulcération',
      'Uvéite',
      'V3M',
      'Vertiges'
    ]),

    // NOTE - Complete list from Care Vision mockups
    ...generateClinicalTemplates('NOTE', [
      { name: 'RDV', value: 'PROCHAIN RENDEZ-VOUS A PRENDRE' },
      { name: 'RDV LE', value: 'PROCHAIN RENDEZ-VOUS LE:' },
      { name: 'COMPLIANCE', value: 'NE JAMAIS ARRETER LE TRAITEMENT SANS AVIS MEDICAL' },
      { name: 'INTOLERANCE', value: 'Recontacter le médecin en cas d\'intolérance au traitement.' },
      { name: 'A REGRESSER', value: 'A REGRESSER' },
      { name: 'A RENOUVELER', value: 'A RENOUVELER' },
      { name: 'A RENOUVELER 3 FOIS', value: 'A RENOUVELER 3 FOIS' },
      { name: 'A RENOUVELER 4 FOIS', value: 'A RENOUVELER 4 FOIS' },
      { name: 'A RENOUVELER 6 FOIS', value: 'A RENOUVELER 6 FOIS' },
      { name: 'REAJUSTER', value: 'REVOIR LE MEDECIN POUR REAJUSTER LE TRAITEMENT' },
      { name: 'QSP 3 MOIS', value: 'QSP 3 MOIS' },
      { name: 'QSP 4 MOIS', value: 'QSP 4 MOIS' },
      { name: 'QSP 6 MOIS', value: 'QSP 6 MOIS' }
    ]),

    // OCULAIRE DESCRIPTION
    ...generateClinicalTemplates('OCULAIRE DESCRIPTION', [
      'Corps flottants',
      'DPV',
      'DR Partiel',
      'DR Total',
      'Hémorragie Vitréenne',
      'Rien à signaler'
    ])
  ];

  await ClinicalTemplate.insertMany(templates);
  console.log(`✓ Seeded ${templates.length} clinical templates`);
}

function generateClinicalTemplates(category, items) {
  return items.map(item => {
    if (typeof item === 'string') {
      return {
        category,
        name: item,
        value: item,
        isActive: true
      };
    } else {
      return {
        category,
        name: item.name,
        value: item.value,
        isActive: true
      };
    }
  });
}

// ===== PATHOLOGY TEMPLATES =====
async function seedPathologyTemplates() {
  console.log('\nSeeding Pathology Templates...');

  const templates = [
    // MOTIF DE CONSULTATION - Symptoms (Complete list from Care Vision mockups)
    ...generatePathologyTemplates('MOTIF DE CONSULTATION', 'symptom', [
      'B.A.V',
      'B.A.V. Loin',
      'B.A.V. Près',
      'Céphalées',
      'Clignement de la paupière',
      'Contrôle',
      'Diplopie binoculaire',
      'Diplopie monoculaire',
      'Douleur',
      'Dyslexie',
      'Fatigue visuelle lecture',
      'Fatigue visuelle ordinateur / TV',
      'Fond d\'oeil bilan retentissement HTA/ Diabète',
      'Larmoiement',
      'Louche',
      'Lunettes: a abandonné(e)',
      'Lunettes: jamais portées',
      'Lunettes: pas à l\'aise',
      'Lunettes: renouvellement ordonnance',
      'Lunettes/Verres cassés/',
      'Lunettes: port inconstant',
      'Métamorphopsie',
      'Myodésopsie',
      'Picotement',
      'Prurit',
      'Phosphènes',
      'Photophobie',
      'Rougeur',
      'Scotome positif',
      'Sécrétions',
      'Sensation de C.E.',
      'Traitement',
      'Traitement: pas sérieux dans l\'observance',
      'Trauma',
      'Tuméfaction',
      'Voile',
      'Vertiges'
    ]),

    // MOTIF DE CONSULTATION - Descriptions (Complete list from Care Vision mockups)
    ...generatePathologyTemplates('MOTIF DE CONSULTATION', 'description', [
      'Oeil droit',
      'Oeil gauche',
      'OD et OG',
      'Droite',
      'Gauche',
      'Brutalement',
      'Intermittent',
      'Progressivement',
      'Bitemporale',
      'Frontale',
      'Hémicrânie',
      'Holocrânie',
      'Occipitale',
      '= 0',
      '= +/-',
      '= +',
      '++',
      '+++',
      '++++',
      'OK',
      'RAS',
      'depuis',
      'depuis hier',
      'depuis 2 jours',
      'depuis 3 jours',
      'depuis 4 jours',
      'depuis 5 jours',
      'depuis 6 jours',
      'depuis une semaine',
      'depuis deux semaines',
      'depuis un mois',
      'semaines',
      'mois',
      'an',
      'Par moment'
    ]),

    // LAF - Conjonctive Symptoms
    ...generatePathologyTemplates('LAF', 'symptom', [
      'Chémosis',
      'Corps étranger',
      'Follicules',
      'Hémorragie sous conjonctivale',
      'Papilles',
      'Pinguécula',
      'Ptérygion',
      'Sécrétions'
    ], 'Conjonctive'),

    // LAF - Cornée Symptoms
    ...generatePathologyTemplates('LAF', 'symptom', [
      'Abcès',
      'Arc sénile',
      'Cercle périkératique',
      'Erosion cornéenne',
      'K P S',
      'Leucome',
      'Plaie',
      'Ulcère',
      'Ulcère dendritique',
      'Vascularisation cornéenne'
    ], 'Cornée'),

    // LAF - Cristallin Symptoms
    ...generatePathologyTemplates('LAF', 'symptom', [
      'Cataracte nucléaire',
      'Cataracte corticale antérieure',
      'Cataracte corticale postérieure',
      'Cataracte sous capsulaire antérieure',
      'Cataracte sous capsulaire postérieure',
      'LIO CP',
      'LIO CA',
      'Luxation',
      'Subluxation',
      'PEX capsulaire'
    ], 'Cristallin'),

    // LAF - Iris Symptoms
    ...generatePathologyTemplates('LAF', 'symptom', [
      'Mydriase',
      'Myosis',
      'Nodules de Koeppe',
      'Nodules de Busacca',
      'PEX',
      'Rubéose irienne',
      'Sécclusion pupillaire',
      'Synéchies postérieures'
    ], 'Iris'),

    // LAF - Vitré Symptoms
    ...generatePathologyTemplates('LAF', 'symptom', [
      'Corps flottant',
      'Dégénérescence astéroïde',
      'Tobacco dust',
      'Tyndall',
      'Vitré décollé (DPV)',
      'Vitré trouble',
      'Vitré hémorragique'
    ], 'Vitré'),

    // LAF - Common Descriptions
    ...generatePathologyTemplates('LAF', 'description', [
      'O.D',
      'O.G',
      'O.D.G.',
      'Calme',
      'Clair(e)',
      '-',
      '+/-',
      '+',
      '++',
      '+++',
      '++++',
      '= 0',
      '= R.A.S.',
      '= Normal',
      'Nasal',
      'Temporal',
      'Inférieur',
      'Supérieur',
      'à 12 h',
      'à 3 h',
      'à 6 h',
      'à 9 h'
    ]),

    // DIABETE - Symptoms
    ...generatePathologyTemplates('Diabète', 'symptom', [
      'Microanevrysmes',
      'Exsudats durs',
      'Exsudats floconneux',
      'Hémorragie intra rétinienne',
      'Hémorragie pré rétinienne',
      'Hémorragie intra vitréenne',
      'Oedème maculaire',
      'Oedème rétinien',
      'Néovaisseaux',
      'Rubéose irienne',
      'Maculopathie exsudative',
      'Maculopathie oedémateuse'
    ]),

    // GLAUCOME - Symptoms
    ...generatePathologyTemplates('Glaucome', 'symptom', [
      'Angle étroit',
      'Angle fermé',
      'Angle ouvert',
      'Angle pigmenté',
      'Chambre ant. étroite',
      'Chambre ant. profonde',
      'Faisceau de Krukenberg',
      'Pseudo-exfoliation capsulaire',
      'Rapport C/D'
    ]),

    // RETINE CENTRALE - Symptoms
    ...generatePathologyTemplates('Rétine Centrale', 'symptom', [
      'Atrophie de l\'épithélium pigm.',
      'Drusen',
      'Décollement séreux rétinien',
      'Exsudats lipidiques',
      'Hémorragies rétiniennes',
      'Hémorragies sous rétiniennes',
      'Métamorphopsies',
      'Néovaisseaux'
    ]),

    // RETINE PERIPHERIQUE - Symptoms
    ...generatePathologyTemplates('Rétine Périphérique', 'symptom', [
      'Blanc avec pression',
      'Blanc sans pression',
      'D.P.V. récent',
      'Déchirure en croissant',
      'Déchirure en fer à cheval',
      'Palissade',
      'Trou rétinien',
      'Trou à opercule',
      'Vitré décollé',
      'Vitré trouble'
    ])
  ];

  await PathologyTemplate.insertMany(templates);
  console.log(`✓ Seeded ${templates.length} pathology templates`);
}

function generatePathologyTemplates(category, type, items, subcategory = null) {
  return items.map(item => ({
    category,
    subcategory,
    type,
    name: item,
    value: item,
    isActive: true
  }));
}
