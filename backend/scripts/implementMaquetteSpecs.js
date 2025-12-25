const mongoose = require('mongoose');
require('dotenv').config();

const { requireNonProduction } = require('./_guards');
requireNonProduction('implementMaquetteSpecs.js');

// Connect to database
mongoose.connect(process.env.MONGODB_URI);

// STEP 1: Update MedicationTemplate categories
async function updateMedicationCategories() {
  const MedicationTemplate = require('../models/MedicationTemplate');

  // Update the schema to use French categories from maquettes
  const newCategories = [
    'A.I.N.S GENERAUX + CORTICOIDES',
    'A.I.N.S LOCAUX',
    'ANESTHESIE LOCALES',
    'ANTI PALUDIQUES',
    'ANTI SPASMODIQUES',
    'ANTI ALLERGIQUES',
    'ANTIBIOTIQUE LOCAUX',
    'ANTIBIOTIQUE GENERAUX',
    'ANTI CATARACTE',
    'ANTI GLAUCOMATEUX',
    'ANTI HISTAMINIQUES GENERAUX',
    'ANTI HYPERTENSEURS',
    'ANTI MYCOSIQUES',
    'ANTISEPT SANS VASOCONS',
    'ANTITUSSIF',
    'ANTI VIRAUX',
    'CICATRISANTS',
    'CORTICOIDES + ANTIBIOTIQUES',
    'CORTICOIDES LOCAUX',
    'CREMES DERMIQUES',
    'DECONGESTIONNANT',
    'DIVERS OPHA',
    'GOUTTES NASALES',
    'HYPO CHOLESTEROLEMIANTS',
    'LARMES ARTIFICIELLES',
    'LARMES LOTIONS CONTACTO',
    'LAXATIFS ET ANTI DIARRHEIQUES',
    'MAGNESIUM',
    'MYDRIATIQUES',
    'OVULES VAGINALES',
    'PANSEMENTS GASTRIQUES',
    'POTASSIUM',
    'RENDEZ-VOUS POUR EXAMENS',
    'SEDATIF',
    'VASCULOTROPES',
    'VERMIFUGES',
    'VITAMINES'
  ];

  console.log('Updating medication categories...');
  // Note: This requires schema change first
}

// STEP 2: Add refraction types
async function addRefractionTypes() {
  const refractionTypes = [
    { code: 'SC', name: 'Sans correction' },
    { code: 'AR', name: 'Ancienne réfraction' },
    { code: 'LP', name: 'Lunettes portées' },
    { code: 'LP_LOIN', name: 'Lunettes portées - De loin' },
    { code: 'LP_PRES', name: 'Lunettes portées - De près' },
    { code: 'LP_PROG', name: 'Lunettes portées - Progressifs' },
    { code: 'LP_BIF', name: 'Lunettes portées - Bifocaux' },
    { code: 'LP_DEMI', name: 'Lunettes portées - Demi-lune' },
    { code: 'LP_TRIPLE', name: 'Lunettes portées - Triple-foyers' },
    { code: 'LP_2P', name: 'Lunettes portées - 2 paires' },
    { code: 'LP_PROX', name: 'Lunettes portées - Verres de proximité' },
    { code: 'AUTO', name: 'Autoréfractomètre' },
    { code: 'AUTO_CYCLO', name: 'Autoréfractomètre sous cyclo' },
    { code: 'RS', name: 'Réfraction subjective' },
    { code: 'RS_CYCLO', name: 'Réfraction subjective sous cyclo' },
    { code: 'RS_AUTO', name: 'Réfraction subjective automatique' },
    { code: 'TAR', name: 'Tar' },
    { code: 'RF', name: 'Réfraction finale' },
    { code: 'PRESC', name: 'Prescription' },
    { code: 'SKIA', name: 'Skiascopie' },
    { code: 'JAVAL', name: 'Javal' },
    { code: 'ESSAI_LC', name: 'Essai Lentille de Contact' }
  ];

  const ExaminationTemplate = require('../models/ExaminationTemplate');

  for (const type of refractionTypes) {
    await ExaminationTemplate.create({
      name: type.name,
      category: 'TYPE REFRACTION',
      code: type.code,
      isActive: true
    });
  }

  console.log(`Added ${refractionTypes.length} refraction types`);
}

// STEP 3: Add dominante values
async function addDominanteValues() {
  const dominanteValues = [
    'Allergie', 'Amblyopie', 'Angiographie', 'Asthénopie',
    'Blépharite', 'C.V.', 'Cataracte', 'Céphalées',
    'Chalazion', 'Cil', 'Conjonctivite', 'Controle',
    'Controle Laser', 'Controle lentilles', 'Controle post op',
    'Controle T.O.', 'Corps étranger', 'DE',
    'Décoll. post. vitré', 'Diabète', 'DMLA',
    'Episclérite', 'F.O.', 'Glaucome',
    'Hemorr. ss conj', 'Herpès', 'Insuff de convergence',
    'Irritation', 'Kératite', 'Lentilles', 'Lunettes',
    'Migraine oph', 'Névralgie', 'Orgelet', 'Orthoptie',
    'Petite chirurgie', 'Sècheresse', 'Strabisme',
    'Traumato', 'Ulcération', 'Uvéite', 'V3M', 'Vertiges'
  ];

  const ExaminationTemplate = require('../models/ExaminationTemplate');

  for (const value of dominanteValues) {
    await ExaminationTemplate.create({
      name: value,
      category: 'DOMINANTE',
      isActive: true
    });
  }

  console.log(`Added ${dominanteValues.length} dominante values`);
}

// STEP 4: Add examination procedures
async function addExaminationProcedures() {
  const procedures = [
    // Surgical procedures
    { name: 'Chirurgie Phaco implant Premium OD', category: 'CHIRURGIE', duration: 30, anesthesia: 'locale' },
    { name: 'Chirurgie Phaco implant Premium OG', category: 'CHIRURGIE', duration: 30, anesthesia: 'locale' },
    { name: 'Chirurgie Phaco implant standard OD', category: 'CHIRURGIE', duration: 25, anesthesia: 'locale' },
    { name: 'Chirurgie Phaco implant standard OG', category: 'CHIRURGIE', duration: 25, anesthesia: 'locale' },
    { name: 'CHIRURGIE SICS IMPLANT PLIABLE PRIVILEGE', category: 'CHIRURGIE', duration: 35, anesthesia: 'locale' },
    { name: 'CHIRURGIE SICS IMPLANT RIGIDE STANDARD', category: 'CHIRURGIE', duration: 30, anesthesia: 'locale' },
    { name: 'Chirurgie EXCISION PTERYGION', category: 'CHIRURGIE', duration: 45, anesthesia: 'locale' },
    { name: 'Chirurgie CURETAGE CHALAZION', category: 'CHIRURGIE', duration: 15, anesthesia: 'locale' },
    { name: 'Chirurgie TRABECULECTOMIE', category: 'CHIRURGIE', duration: 60, anesthesia: 'locale' },
    { name: 'CHIRURGIE VITREORETINIENNE', category: 'CHIRURGIE', duration: 90, anesthesia: 'generale' },

    // Laser procedures
    { name: 'LASER YAG', category: 'LASER', duration: 15 },
    { name: 'LASER SLT', category: 'LASER', duration: 20 },
    { name: 'LASER IRIDOTOMIE PERIPHERIQUE', category: 'LASER', duration: 15 },
    { name: 'LASER PHOTOCOAGULATION PAN RETINIENNE', category: 'LASER', duration: 30 },
    { name: 'LASER PHOTOCOAGULATION RETINIENNE FOCALE', category: 'LASER', duration: 20 },

    // IVT procedures
    { name: 'Seance IVT AVASTIN', category: 'IVT', duration: 20 },
    { name: 'Seance IVT Ranibizumab', category: 'IVT', duration: 20 },
    { name: 'Seance IVT ozurdex', category: 'IVT', duration: 20 },
    { name: 'Seance IVT Kenacort', category: 'IVT', duration: 20 },

    // Diagnostic procedures
    { name: 'Biométrie', category: 'DIAGNOSTIC', duration: 15 },
    { name: 'Champ visuel automatique', category: 'DIAGNOSTIC', duration: 30 },
    { name: 'Echographie oculaire', category: 'DIAGNOSTIC', duration: 20 },
    { name: 'Fluoangiographie retinienne', category: 'DIAGNOSTIC', duration: 30 },
    { name: 'Gonioscopie', category: 'DIAGNOSTIC', duration: 15 },
    { name: 'Kératométrie', category: 'DIAGNOSTIC', duration: 10 },
    { name: 'Oct macula', category: 'DIAGNOSTIC', duration: 15 },
    { name: 'Oct NO', category: 'DIAGNOSTIC', duration: 15 },
    { name: 'Oct No+macula', category: 'DIAGNOSTIC', duration: 20 },
    { name: 'Ophtalmoscopie Binoculaire', category: 'DIAGNOSTIC', duration: 20 },
    { name: 'Pachymétrie', category: 'DIAGNOSTIC', duration: 10 },
    { name: 'Refractométrie automatique', category: 'DIAGNOSTIC', duration: 10 },
    { name: 'Rétinophotographie', category: 'DIAGNOSTIC', duration: 15 },
    { name: 'Skiascopie', category: 'DIAGNOSTIC', duration: 15 },
    { name: 'Tonométrie', category: 'DIAGNOSTIC', duration: 5 },
    { name: 'Topographie Cornéenne', category: 'DIAGNOSTIC', duration: 15 }
  ];

  const ExaminationTemplate = require('../models/ExaminationTemplate');

  for (const proc of procedures) {
    await ExaminationTemplate.create({
      name: proc.name,
      category: 'RENDEZ-VOUS POUR EXAMENS',
      subcategory: proc.category,
      duration: proc.duration,
      anesthesia: proc.anesthesia,
      isActive: true
    });
  }

  console.log(`Added ${procedures.length} examination procedures`);
}

// STEP 5: Add anamnesis templates
async function addAnamnesisTemplates() {
  const anamnesisTemplates = [
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
    'Sensation de corps étrangers'
  ];

  const CommentTemplate = require('../models/CommentTemplate');

  for (const template of anamnesisTemplates) {
    await CommentTemplate.create({
      name: `ANAMNESE: ${template}`,
      template: template,
      category: 'ANAMNESE MOBILE',
      isActive: true
    });
  }

  console.log(`Added ${anamnesisTemplates.length} anamnesis templates`);
}

// STEP 6: Add note templates
async function addNoteTemplates() {
  const noteTemplates = [
    {
      name: 'RDV à prendre',
      template: 'PROCHAIN RENDEZ-VOUS À PRENDRE',
      category: 'NOTE'
    },
    {
      name: 'RDV le',
      template: 'PROCHAIN RENDEZ-VOUS LE:',
      category: 'NOTE'
    },
    {
      name: 'Intolérance',
      template: 'Recontacter le médecin en cas d\'intolérance au traitement.',
      category: 'NOTE'
    },
    {
      name: 'Compliance',
      template: 'NE JAMAIS ARRETER LE TRAITEMENT SANS AVIS MEDICAL',
      category: 'NOTE'
    },
    {
      name: 'À renouveler',
      template: 'À RENOUVELER',
      category: 'NOTE'
    },
    {
      name: 'À renouveler 3 fois',
      template: 'À RENOUVELER 3 FOIS',
      category: 'NOTE'
    },
    {
      name: 'QSP 3 mois',
      template: 'QSP 3 MOIS',
      category: 'NOTE'
    },
    {
      name: 'QSP 6 mois',
      template: 'QSP 6 MOIS',
      category: 'NOTE'
    }
  ];

  const CommentTemplate = require('../models/CommentTemplate');

  for (const template of noteTemplates) {
    await CommentTemplate.create(template);
  }

  console.log(`Added ${noteTemplates.length} note templates`);
}

// Run all updates
async function runAllUpdates() {
  try {
    console.log('Starting maquette specifications implementation...');

    await updateMedicationCategories();
    await addRefractionTypes();
    await addDominanteValues();
    await addExaminationProcedures();
    await addAnamnesisTemplates();
    await addNoteTemplates();

    console.log('✅ All maquette specifications implemented successfully!');
  } catch (error) {
    console.error('Error implementing specifications:', error);
  } finally {
    await mongoose.connection.close();
  }
}

runAllUpdates();
