const mongoose = require('mongoose');
require('dotenv').config();

// Use existing models
const ClinicalAct = require('../models/ClinicalAct');
const AppointmentType = require('../models/AppointmentType');

// Map French categories to model enum values
function mapCategoryToEnum(frenchCategory) {
  const mapping = {
    'Anesthésie': 'anesthesia',
    'Examens diagnostiques': 'diagnostic',
    'Périmétrie': 'examination',
    'Tonométrie': 'examination',
    'Imagerie': 'imaging',
    'Examen du fond d\'œil': 'examination',
    'Consultations': 'consultation',
    'Forfaits': 'procedure',
    'Laser': 'laser',
    'Injections intravitréennes': 'injection',
    'Injections': 'injection',
    'Perfusions': 'therapy',
    'Petites interventions': 'procedure',
    'Chirurgie cataracte': 'surgical',
    'Chirurgie glaucome': 'surgical',
    'Chirurgie cornée': 'surgical',
    'Chirurgie conjonctive': 'surgical',
    'Chirurgie paupières': 'surgical',
    'Chirurgie autre': 'surgical',
    'Radiologie': 'imaging',
    'Échographie': 'imaging',
    'Divers': 'other'
  };
  return mapping[frenchCategory] || 'other';
}

// Map French categories to AppointmentType enum values
function mapAppointmentCategory(frenchCategory) {
  const mapping = {
    'Anesthésie': 'surgical',
    'Examens diagnostiques': 'diagnostic',
    'Périmétrie': 'diagnostic',
    'Tonométrie': 'diagnostic',
    'Imagerie': 'imaging',
    'Examen du fond d\'œil': 'diagnostic',
    'Consultations': 'consultation',
    'Forfaits': 'consultation',
    'Laser': 'laser',
    'Injections intravitréennes': 'injection',
    'Injections': 'injection',
    'Perfusions': 'therapy',
    'Petites interventions': 'therapy',
    'Chirurgie cataracte': 'surgical',
    'Chirurgie glaucome': 'surgical',
    'Chirurgie cornée': 'surgical',
    'Chirurgie conjonctive': 'surgical',
    'Chirurgie paupières': 'surgical',
    'Chirurgie autre': 'surgical',
    'Radiologie': 'imaging',
    'Échographie': 'imaging',
    'Divers': 'consultation'
  };
  return mapping[frenchCategory] || 'consultation';
}

// All clinical acts from the maquettes (RENDEZ-VOUS POUR EXAMENS section)
const clinicalActsData = [
  // Anesthésie
  { name: 'Anesthésie générale', category: 'Anesthésie', duration: 120 },
  { name: 'Anesthésie sous ténonienne', category: 'Anesthésie', duration: 30 },

  // Examens de base
  { name: 'Biométrie', category: 'Examens diagnostiques', duration: 15 },
  { name: 'Biomicroscopie', category: 'Examens diagnostiques', duration: 15 },
  { name: 'Tonométrie', category: 'Examens diagnostiques', duration: 10 },
  { name: 'Pachymétrie', category: 'Examens diagnostiques', duration: 15 },
  { name: 'Kératométrie', category: 'Examens diagnostiques', duration: 15 },
  { name: 'Kératoréf', category: 'Examens diagnostiques', duration: 15 },
  { name: 'Topographie Cornéenne', category: 'Examens diagnostiques', duration: 20 },
  { name: 'Réfractométrie automatique', category: 'Examens diagnostiques', duration: 15 },
  { name: 'Réfractométrie automatique + cycloplégie', category: 'Examens diagnostiques', duration: 30 },
  { name: 'Réfractométrie automatique mode binoculaire', category: 'Examens diagnostiques', duration: 20 },
  { name: 'Skiascopie', category: 'Examens diagnostiques', duration: 20 },
  { name: 'Skiascopie avec cycloplégie', category: 'Examens diagnostiques', duration: 30 },
  { name: 'Essai subjectif des verres', category: 'Examens diagnostiques', duration: 30 },
  { name: 'Vision des couleurs', category: 'Examens diagnostiques', duration: 15 },
  { name: 'Grille d\'Amsler', category: 'Examens diagnostiques', duration: 10 },
  { name: 'Test à la fluorescéïne', category: 'Examens diagnostiques', duration: 10 },
  { name: 'Test de Jones', category: 'Examens diagnostiques', duration: 15 },
  { name: 'Test de Schirmer', category: 'Examens diagnostiques', duration: 10 },
  { name: 'Exophtalmomètre de Hertel', category: 'Examens diagnostiques', duration: 10 },
  { name: 'Gonioscopie', category: 'Examens diagnostiques', duration: 15 },
  { name: 'Goniographie', category: 'Examens diagnostiques', duration: 20 },
  { name: 'TAR', category: 'Examens diagnostiques', duration: 15 },

  // Champ visuel
  { name: 'Champ visuel automatique', category: 'Périmétrie', duration: 30 },
  { name: 'Périmétrie automatisée blanc/blanc centrale', category: 'Périmétrie', duration: 30 },
  { name: 'Périmétrie automatisée blanc/blanc centre + périphérique', category: 'Périmétrie', duration: 45 },
  { name: 'Périmétrie automatisée bleu/jaune', category: 'Périmétrie', duration: 30 },

  // Pression intraoculaire
  { name: 'Courbe de pression intraoculaire diurne', category: 'Tonométrie', duration: 240 },
  { name: 'Courbe de pression intraoculaire 24 heures', category: 'Tonométrie', duration: 1440 },

  // Imagerie
  { name: 'OCT Macula', category: 'Imagerie', duration: 15 },
  { name: 'OCT NO', category: 'Imagerie', duration: 15 },
  { name: 'OCT NO + Macula', category: 'Imagerie', duration: 20 },
  { name: 'Échographie oculaire', category: 'Imagerie', duration: 20 },
  { name: 'Rétinophotographie C', category: 'Imagerie', duration: 15 },
  { name: 'Rétinophotographie C+P', category: 'Imagerie', duration: 20 },
  { name: 'Photographie segment antérieur', category: 'Imagerie', duration: 15 },
  { name: 'Fluoangiographie rétinienne', category: 'Imagerie', duration: 45 },

  // Fond d'oeil
  { name: 'Fond d\'œil direct', category: 'Examen du fond d\'œil', duration: 15 },
  { name: 'Ophtalmoscopie Binoculaire', category: 'Examen du fond d\'œil', duration: 20 },
  { name: 'Verre à trois miroirs', category: 'Examen du fond d\'œil', duration: 20 },

  // Consultations
  { name: 'Consultation ophtalmologique', category: 'Consultations', duration: 30 },
  { name: 'Consultation ophtalmologique + examens de base', category: 'Consultations', duration: 45 },
  { name: 'Consultation en urgence', category: 'Consultations', duration: 30 },
  { name: 'Consultation pré et post opératoire', category: 'Consultations', duration: 30 },
  { name: 'Consultation anesthésiste', category: 'Consultations', duration: 30 },
  { name: 'Consultation ophta-pédiatrique', category: 'Consultations', duration: 45 },
  { name: 'Consultation et Examen Orthoptique', category: 'Consultations', duration: 45 },
  { name: 'Consultation Essai lentille de contact', category: 'Consultations', duration: 45 },
  { name: 'Consultation NTBC', category: 'Consultations', duration: 30 },
  { name: 'Contrôle post chirurgie', category: 'Consultations', duration: 20 },
  { name: 'Examen NTBC', category: 'Consultations', duration: 30 },
  { name: 'Rééducation orthoptique', category: 'Consultations', duration: 30 },

  // Forfaits
  { name: 'Forfait cons examens 1', category: 'Forfaits', duration: 45 },
  { name: 'Forfait cons examens 2', category: 'Forfaits', duration: 60 },
  { name: 'Forfait Examens préliminaires Chirurgie', category: 'Forfaits', duration: 60 },

  // Laser
  { name: 'Laser YAG', category: 'Laser', duration: 30 },
  { name: 'Laser SLT', category: 'Laser', duration: 30 },
  { name: 'Laser iridotomie périphérique', category: 'Laser', duration: 30 },
  { name: 'Laser photocoagulation pan rétinienne', category: 'Laser', duration: 45 },
  { name: 'Laser photocoagulation rétinienne focale', category: 'Laser', duration: 30 },

  // IVT
  { name: 'Séance IVT Ranibizumab', category: 'Injections intravitréennes', duration: 30 },
  { name: 'Séance IVT Ranibizumab + Kenacort', category: 'Injections intravitréennes', duration: 30 },
  { name: 'Séance IVT AVASTIN', category: 'Injections intravitréennes', duration: 30 },
  { name: 'Séance IVT AVASTIN + KENACORT', category: 'Injections intravitréennes', duration: 30 },
  { name: 'Séance IVT Ozurdex', category: 'Injections intravitréennes', duration: 30 },
  { name: 'Séance IVT Kenacort', category: 'Injections intravitréennes', duration: 30 },

  // Autres injections
  { name: 'Injection IM', category: 'Injections', duration: 10 },
  { name: 'Injection Rétrobulbaire', category: 'Injections', duration: 15 },
  { name: 'Injection rétrobulbaire Largactyl', category: 'Injections', duration: 15 },
  { name: 'Injection sous conjonctivale + produit standard', category: 'Injections', duration: 15 },
  { name: 'Injection sous conjonctivale + Kenacort', category: 'Injections', duration: 15 },
  { name: 'Injection sous ténonienne + produit standard', category: 'Injections', duration: 15 },
  { name: 'Injection Kenacort chalazion', category: 'Injections', duration: 15 },
  { name: 'Séance Injection Botox OD / PRODUIT LV', category: 'Injections', duration: 30 },
  { name: 'Séance Injection Botox OD / PRODUIT PATIENT', category: 'Injections', duration: 30 },

  // Perfusions
  { name: 'Séance perfusion IVD', category: 'Perfusions', duration: 60 },
  { name: 'Séance perfusion manitol', category: 'Perfusions', duration: 60 },
  { name: 'Séance perfusion + solumédrol', category: 'Perfusions', duration: 60 },

  // Petites interventions
  { name: 'Épilation', category: 'Petites interventions', duration: 15 },
  { name: 'Extraction corps étranger superficiel', category: 'Petites interventions', duration: 15 },
  { name: 'Extraction corps étranger profond', category: 'Petites interventions', duration: 30 },
  { name: 'Soins + Pansement', category: 'Petites interventions', duration: 15 },
  { name: 'Soins1', category: 'Petites interventions', duration: 15 },
  { name: 'Soins2', category: 'Petites interventions', duration: 20 },
  { name: 'Lavage et Sondage voies lacrymales', category: 'Petites interventions', duration: 20 },
  { name: 'Irrigation et sondage des voies lacrymales', category: 'Petites interventions', duration: 20 },

  // Chirurgies cataracte
  { name: 'Chirurgie Phaco implant standard', category: 'Chirurgie cataracte', duration: 45 },
  { name: 'Chirurgie Phaco implant Privilège', category: 'Chirurgie cataracte', duration: 45 },
  { name: 'Chirurgie Phaco implant Premium', category: 'Chirurgie cataracte', duration: 60 },
  { name: 'Chirurgie SICS implant rigide standard', category: 'Chirurgie cataracte', duration: 45 },
  { name: 'Chirurgie SICS implant pliable standard', category: 'Chirurgie cataracte', duration: 45 },
  { name: 'Chirurgie SICS implant pliable Privilège', category: 'Chirurgie cataracte', duration: 45 },
  { name: 'Aspiration masses', category: 'Chirurgie cataracte', duration: 30 },
  { name: 'Discission capsule postérieure', category: 'Chirurgie cataracte', duration: 30 },

  // Chirurgies glaucome
  { name: 'Chirurgie Trabéculectomie', category: 'Chirurgie glaucome', duration: 60 },
  { name: 'Chirurgie Sclérectomie prof non perf', category: 'Chirurgie glaucome', duration: 60 },
  { name: 'Chirurgie Needling', category: 'Chirurgie glaucome', duration: 30 },

  // Chirurgies cornée
  { name: 'Chirurgie Kératoplastie', category: 'Chirurgie cornée', duration: 90 },
  { name: 'Chirurgie perforation cornéenne simple', category: 'Chirurgie cornée', duration: 45 },
  { name: 'Chirurgie perforation cornéenne complexe', category: 'Chirurgie cornée', duration: 60 },
  { name: 'Chirurgie Pelage à l\'EDTA', category: 'Chirurgie cornée', duration: 30 },
  { name: 'Chirurgie Débridement ulcère', category: 'Chirurgie cornée', duration: 30 },

  // Chirurgies conjonctive
  { name: 'Chirurgie Excision ptérygion', category: 'Chirurgie conjonctive', duration: 30 },
  { name: 'Chirurgie Excision ptérygion + greffe', category: 'Chirurgie conjonctive', duration: 45 },
  { name: 'Chirurgie Excision pinguecula', category: 'Chirurgie conjonctive', duration: 30 },
  { name: 'Chirurgie Biopsie tumeur conjonctivale', category: 'Chirurgie conjonctive', duration: 30 },
  { name: 'Chirurgie exploration sous conjonctival', category: 'Chirurgie conjonctive', duration: 30 },
  { name: 'Chirurgie Excision granulome pyogénique', category: 'Chirurgie conjonctive', duration: 30 },

  // Chirurgies paupières
  { name: 'Chirurgie Curetage chalazion', category: 'Chirurgie paupières', duration: 20 },
  { name: 'Chirurgie Biopsie tumeur palpébrale', category: 'Chirurgie paupières', duration: 30 },
  { name: 'Chirurgie Incision abcès palpébrale', category: 'Chirurgie paupières', duration: 20 },
  { name: 'Chirurgie Incision glande eccrine', category: 'Chirurgie paupières', duration: 20 },
  { name: 'Chirurgie Cure ankyloblépharon sous anesthésie locale', category: 'Chirurgie paupières', duration: 45 },
  { name: 'Chirurgie Cure symblépharon + autogreffe', category: 'Chirurgie paupières', duration: 60 },
  { name: 'Chirurgie Cure symblépharon + ankyloblépharon', category: 'Chirurgie paupières', duration: 60 },
  { name: 'Chirurgie Suture palpébrale et exploration canaux lacrymaux', category: 'Chirurgie paupières', duration: 45 },
  { name: 'Chirurgie Ablation fils', category: 'Chirurgie paupières', duration: 15 },

  // Chirurgies autres
  { name: 'Chirurgie Vitrectomie antérieure', category: 'Chirurgie autre', duration: 45 },
  { name: 'Chirurgie Vitréorétinienne', category: 'Chirurgie autre', duration: 90 },
  { name: 'Chirurgie Vitréorétinienne + endolaser', category: 'Chirurgie autre', duration: 120 },
  { name: 'Chirurgie ablation huile de silicone', category: 'Chirurgie autre', duration: 60 },
  { name: 'Chirurgie Glued IOL', category: 'Chirurgie autre', duration: 60 },
  { name: 'Chirurgie Réduction hernie iris pupilloplastie/vitrectomie antérieure', category: 'Chirurgie autre', duration: 60 },
  { name: 'Chirurgie Ablation Lipome', category: 'Chirurgie autre', duration: 30 },
  { name: 'Chirurgie Ablation Amygdales + végétations', category: 'Chirurgie autre', duration: 45 },

  // Radiologie
  { name: 'Radio thorax face', category: 'Radiologie', duration: 15 },
  { name: 'Radio thorax face et profil adulte', category: 'Radiologie', duration: 20 },
  { name: 'Radio thorax face et profil enfant', category: 'Radiologie', duration: 20 },
  { name: 'Radio sinus', category: 'Radiologie', duration: 15 },
  { name: 'Radio cavum', category: 'Radiologie', duration: 15 },
  { name: 'Radio colonne', category: 'Radiologie', duration: 20 },
  { name: 'Radio colonne cervicale', category: 'Radiologie', duration: 20 },
  { name: 'Radio colonne cervico-dorsale', category: 'Radiologie', duration: 20 },
  { name: 'Radio colonne dorsale', category: 'Radiologie', duration: 20 },
  { name: 'Radio colonne lombo-sacrée', category: 'Radiologie', duration: 20 },
  { name: 'Radio articulation comparative', category: 'Radiologie', duration: 20 },

  // Échographie non oculaire
  { name: 'Échographie abdominale', category: 'Échographie', duration: 30 },
  { name: 'Échographie abdominale et pelvienne', category: 'Échographie', duration: 45 },
  { name: 'Échographie rénale', category: 'Échographie', duration: 20 },
  { name: 'Échographie vésico-prostatique', category: 'Échographie', duration: 20 },

  // Divers
  { name: 'Surveillance et réanimation', category: 'Divers', duration: 60 },
  { name: 'Matériel', category: 'Divers', duration: 0 }
];

async function seedFrenchClinicalActs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing clinical acts and appointment types
    await ClinicalAct.deleteMany({});
    await AppointmentType.deleteMany({});
    console.log('Cleared existing clinical acts and appointment types');

    // Create clinical acts with proper structure
    const clinicalActs = clinicalActsData.map((act, index) => ({
      actId: `ACT-${String(index + 1).padStart(4, '0')}`,
      name: act.name,
      nameFr: act.name,
      category: mapCategoryToEnum(act.category),
      subCategory: act.category,
      duration: act.duration,
      department: 'ophthalmology',
      active: true,
      descriptionFr: `${act.name} - ${act.category}`
    }));

    await ClinicalAct.insertMany(clinicalActs);
    console.log(`Created ${clinicalActs.length} French clinical acts`);

    // Create appointment types with proper structure
    const appointmentTypes = clinicalActsData.map((act, index) => ({
      typeId: `APPT-${String(index + 1).padStart(4, '0')}`,
      name: act.name,
      nameFr: act.name,
      category: mapAppointmentCategory(act.category),
      subcategory: act.category,
      duration: {
        estimated: act.duration,
        total: act.duration
      },
      department: 'ophthalmology',
      active: true,
      descriptionFr: `${act.name} - ${act.category}`
    }));

    await AppointmentType.insertMany(appointmentTypes);
    console.log(`Created ${appointmentTypes.length} French appointment types`);

    // Summary by category
    const categories = {};
    clinicalActsData.forEach(act => {
      if (!categories[act.category]) categories[act.category] = 0;
      categories[act.category]++;
    });

    console.log('\n=== SUMMARY BY CATEGORY ===');
    Object.entries(categories).sort().forEach(([cat, count]) => {
      console.log(`${cat}: ${count} actes`);
    });

  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

function getCategoryColor(category) {
  const colors = {
    'Anesthésie': '#8B5CF6',
    'Examens diagnostiques': '#3B82F6',
    'Périmétrie': '#06B6D4',
    'Tonométrie': '#10B981',
    'Imagerie': '#F59E0B',
    'Examen du fond d\'œil': '#EF4444',
    'Consultations': '#6366F1',
    'Forfaits': '#EC4899',
    'Laser': '#F97316',
    'Injections intravitréennes': '#DC2626',
    'Injections': '#7C3AED',
    'Perfusions': '#2563EB',
    'Petites interventions': '#059669',
    'Chirurgie cataracte': '#B45309',
    'Chirurgie glaucome': '#7C2D12',
    'Chirurgie cornée': '#1E40AF',
    'Chirurgie conjonctive': '#166534',
    'Chirurgie paupières': '#9D174D',
    'Chirurgie autre': '#6B21A8',
    'Radiologie': '#475569',
    'Échographie': '#0891B2',
    'Divers': '#64748B'
  };
  return colors[category] || '#64748B';
}

seedFrenchClinicalActs();
