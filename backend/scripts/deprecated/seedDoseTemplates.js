const mongoose = require('mongoose');
const DoseTemplate = require('../models/DoseTemplate');
require('dotenv').config();

const doseTemplates = [
  {
    medicationForm: 'collyre',
    doseOptions: [
      { value: '1_goutte', labelFr: '1 goutte', textFr: 'Instiller 1 goutte', sortOrder: 1 },
      { value: '2_gouttes', labelFr: '2 gouttes', textFr: 'Instiller 2 gouttes', sortOrder: 2 },
      { value: '3_gouttes', labelFr: '3 gouttes', textFr: 'Instiller 3 gouttes', sortOrder: 3 },
      { value: '1-2_gouttes', labelFr: '1-2 gouttes', textFr: 'Instiller 1 à 2 gouttes', sortOrder: 4 }
    ],
    posologieOptions: [
      { value: 'chaque_oeil', labelFr: 'Dans chaque œil', textFr: 'dans chaque œil', sortOrder: 1 },
      { value: 'oeil_droit', labelFr: 'Dans l\'œil droit', textFr: 'dans l\'œil droit uniquement', sortOrder: 2 },
      { value: 'oeil_gauche', labelFr: 'Dans l\'œil gauche', textFr: 'dans l\'œil gauche uniquement', sortOrder: 3 },
      { value: 'oeil_atteint', labelFr: 'Dans l\'œil atteint', textFr: 'dans l\'œil atteint', sortOrder: 4 },
      { value: 'matin', labelFr: 'Le matin', textFr: 'le matin', sortOrder: 5 },
      { value: 'soir', labelFr: 'Le soir', textFr: 'le soir', sortOrder: 6 },
      { value: 'matin_soir', labelFr: 'Matin et soir', textFr: 'matin et soir', sortOrder: 7 },
      { value: '3_fois_jour', labelFr: '3 fois par jour', textFr: '3 fois par jour', sortOrder: 8 },
      { value: '4_fois_jour', labelFr: '4 fois par jour', textFr: '4 fois par jour', sortOrder: 9 },
      { value: 'selon_besoin', labelFr: 'Selon besoin', textFr: 'selon besoin', sortOrder: 10 }
    ],
    detailsOptions: [
      { value: 'apres_toilette', labelFr: 'Après toilette oculaire', textFr: 'après toilette oculaire', sortOrder: 1 },
      { value: 'avant_coucher', labelFr: 'Avant le coucher', textFr: 'avant le coucher', sortOrder: 2 },
      { value: 'au_reveil', labelFr: 'Au réveil', textFr: 'au réveil', sortOrder: 3 },
      { value: 'intervalle_5min', labelFr: 'Intervalle de 5 minutes', textFr: 'en respectant un intervalle de 5 minutes entre chaque collyre', sortOrder: 4 },
      { value: 'agiter_avant', labelFr: 'Agiter avant emploi', textFr: 'agiter le flacon avant emploi', sortOrder: 5 },
      { value: 'position_allongee', labelFr: 'En position allongée', textFr: 'en position allongée', sortOrder: 6 },
      { value: 'fermer_yeux_2min', labelFr: 'Fermer les yeux 2 minutes', textFr: 'fermer les yeux pendant 2 minutes après instillation', sortOrder: 7 }
    ],
    durationOptions: [
      { value: '3_jours', labelFr: '3 jours', textFr: 'pendant 3 jours', sortOrder: 1 },
      { value: '5_jours', labelFr: '5 jours', textFr: 'pendant 5 jours', sortOrder: 2 },
      { value: '7_jours', labelFr: '7 jours', textFr: 'pendant 7 jours', sortOrder: 3 },
      { value: '10_jours', labelFr: '10 jours', textFr: 'pendant 10 jours', sortOrder: 4 },
      { value: '15_jours', labelFr: '15 jours', textFr: 'pendant 15 jours', sortOrder: 5 },
      { value: '1_mois', labelFr: '1 mois', textFr: 'pendant 1 mois', sortOrder: 6 },
      { value: '2_mois', labelFr: '2 mois', textFr: 'pendant 2 mois', sortOrder: 7 },
      { value: '3_mois', labelFr: '3 mois', textFr: 'pendant 3 mois', sortOrder: 8 },
      { value: 'au_long_cours', labelFr: 'Au long cours', textFr: 'au long cours', sortOrder: 9 },
      { value: 'jusqua_amelioration', labelFr: 'Jusqu\'à amélioration', textFr: 'jusqu\'à amélioration des symptômes', sortOrder: 10 }
    ]
  },
  {
    medicationForm: 'pommade_ophtalmique',
    doseOptions: [
      { value: 'application', labelFr: 'Une application', textFr: 'Appliquer', sortOrder: 1 },
      { value: 'noisette', labelFr: 'Une noisette', textFr: 'Appliquer une noisette', sortOrder: 2 }
    ],
    posologieOptions: [
      { value: 'chaque_oeil', labelFr: 'Dans chaque œil', textFr: 'dans chaque œil', sortOrder: 1 },
      { value: 'oeil_droit', labelFr: 'Dans l\'œil droit', textFr: 'dans l\'œil droit uniquement', sortOrder: 2 },
      { value: 'oeil_gauche', labelFr: 'Dans l\'œil gauche', textFr: 'dans l\'œil gauche uniquement', sortOrder: 3 },
      { value: 'oeil_atteint', labelFr: 'Dans l\'œil atteint', textFr: 'dans l\'œil atteint', sortOrder: 4 },
      { value: 'soir', labelFr: 'Le soir', textFr: 'le soir', sortOrder: 5 },
      { value: 'matin_soir', labelFr: 'Matin et soir', textFr: 'matin et soir', sortOrder: 6 },
      { value: 'avant_coucher', labelFr: 'Avant le coucher', textFr: 'avant le coucher', sortOrder: 7 }
    ],
    detailsOptions: [
      { value: 'cul_sac_conjonctival', labelFr: 'Dans le cul-de-sac conjonctival', textFr: 'dans le cul-de-sac conjonctival', sortOrder: 1 },
      { value: 'paupiere_inferieure', labelFr: 'Sur la paupière inférieure', textFr: 'sur la face interne de la paupière inférieure', sortOrder: 2 },
      { value: 'apres_nettoyage', labelFr: 'Après nettoyage', textFr: 'après nettoyage des paupières', sortOrder: 3 }
    ],
    durationOptions: [
      { value: '5_jours', labelFr: '5 jours', textFr: 'pendant 5 jours', sortOrder: 1 },
      { value: '7_jours', labelFr: '7 jours', textFr: 'pendant 7 jours', sortOrder: 2 },
      { value: '10_jours', labelFr: '10 jours', textFr: 'pendant 10 jours', sortOrder: 3 },
      { value: '15_jours', labelFr: '15 jours', textFr: 'pendant 15 jours', sortOrder: 4 },
      { value: '1_mois', labelFr: '1 mois', textFr: 'pendant 1 mois', sortOrder: 5 }
    ]
  },
  {
    medicationForm: 'comprime',
    doseOptions: [
      { value: '1_cp', labelFr: '1 comprimé', textFr: 'Prendre 1 comprimé', sortOrder: 1 },
      { value: '2_cp', labelFr: '2 comprimés', textFr: 'Prendre 2 comprimés', sortOrder: 2 },
      { value: '3_cp', labelFr: '3 comprimés', textFr: 'Prendre 3 comprimés', sortOrder: 3 },
      { value: '1/2_cp', labelFr: '1/2 comprimé', textFr: 'Prendre 1/2 comprimé', sortOrder: 4 }
    ],
    posologieOptions: [
      { value: 'matin', labelFr: 'Le matin', textFr: 'le matin', sortOrder: 1 },
      { value: 'midi', labelFr: 'Le midi', textFr: 'le midi', sortOrder: 2 },
      { value: 'soir', labelFr: 'Le soir', textFr: 'le soir', sortOrder: 3 },
      { value: 'matin_soir', labelFr: 'Matin et soir', textFr: 'matin et soir', sortOrder: 4 },
      { value: 'matin_midi_soir', labelFr: 'Matin, midi et soir', textFr: 'matin, midi et soir', sortOrder: 5 },
      { value: '1_fois_jour', labelFr: '1 fois par jour', textFr: '1 fois par jour', sortOrder: 6 },
      { value: '2_fois_jour', labelFr: '2 fois par jour', textFr: '2 fois par jour', sortOrder: 7 },
      { value: '3_fois_jour', labelFr: '3 fois par jour', textFr: '3 fois par jour', sortOrder: 8 }
    ],
    detailsOptions: [
      { value: 'pendant_repas', labelFr: 'Pendant le repas', textFr: 'pendant le repas', sortOrder: 1 },
      { value: 'en_dehors_repas', labelFr: 'En dehors des repas', textFr: 'en dehors des repas', sortOrder: 2 },
      { value: 'a_jeun', labelFr: 'À jeun', textFr: 'à jeun', sortOrder: 3 },
      { value: 'avec_verre_eau', labelFr: 'Avec un grand verre d\'eau', textFr: 'avec un grand verre d\'eau', sortOrder: 4 },
      { value: 'avant_coucher', labelFr: 'Avant le coucher', textFr: 'avant le coucher', sortOrder: 5 },
      { value: 'au_reveil', labelFr: 'Au réveil', textFr: 'au réveil', sortOrder: 6 }
    ],
    durationOptions: [
      { value: '3_jours', labelFr: '3 jours', textFr: 'pendant 3 jours', sortOrder: 1 },
      { value: '5_jours', labelFr: '5 jours', textFr: 'pendant 5 jours', sortOrder: 2 },
      { value: '7_jours', labelFr: '7 jours', textFr: 'pendant 7 jours', sortOrder: 3 },
      { value: '10_jours', labelFr: '10 jours', textFr: 'pendant 10 jours', sortOrder: 4 },
      { value: '15_jours', labelFr: '15 jours', textFr: 'pendant 15 jours', sortOrder: 5 },
      { value: '1_mois', labelFr: '1 mois', textFr: 'pendant 1 mois', sortOrder: 6 },
      { value: '2_mois', labelFr: '2 mois', textFr: 'pendant 2 mois', sortOrder: 7 },
      { value: '3_mois', labelFr: '3 mois', textFr: 'pendant 3 mois', sortOrder: 8 },
      { value: '6_mois', labelFr: '6 mois', textFr: 'pendant 6 mois', sortOrder: 9 },
      { value: 'au_long_cours', labelFr: 'Au long cours', textFr: 'au long cours', sortOrder: 10 }
    ]
  },
  {
    medicationForm: 'gelule',
    doseOptions: [
      { value: '1_gel', labelFr: '1 gélule', textFr: 'Prendre 1 gélule', sortOrder: 1 },
      { value: '2_gel', labelFr: '2 gélules', textFr: 'Prendre 2 gélules', sortOrder: 2 },
      { value: '3_gel', labelFr: '3 gélules', textFr: 'Prendre 3 gélules', sortOrder: 3 }
    ],
    posologieOptions: [
      { value: 'matin', labelFr: 'Le matin', textFr: 'le matin', sortOrder: 1 },
      { value: 'midi', labelFr: 'Le midi', textFr: 'le midi', sortOrder: 2 },
      { value: 'soir', labelFr: 'Le soir', textFr: 'le soir', sortOrder: 3 },
      { value: 'matin_soir', labelFr: 'Matin et soir', textFr: 'matin et soir', sortOrder: 4 },
      { value: '1_fois_jour', labelFr: '1 fois par jour', textFr: '1 fois par jour', sortOrder: 5 },
      { value: '2_fois_jour', labelFr: '2 fois par jour', textFr: '2 fois par jour', sortOrder: 6 },
      { value: '3_fois_jour', labelFr: '3 fois par jour', textFr: '3 fois par jour', sortOrder: 7 }
    ],
    detailsOptions: [
      { value: 'pendant_repas', labelFr: 'Pendant le repas', textFr: 'pendant le repas', sortOrder: 1 },
      { value: 'a_jeun', labelFr: 'À jeun', textFr: 'à jeun', sortOrder: 2 },
      { value: 'avec_verre_eau', labelFr: 'Avec un grand verre d\'eau', textFr: 'avec un grand verre d\'eau', sortOrder: 3 },
      { value: 'ne_pas_croquer', labelFr: 'Ne pas croquer', textFr: 'ne pas croquer ni ouvrir', sortOrder: 4 }
    ],
    durationOptions: [
      { value: '7_jours', labelFr: '7 jours', textFr: 'pendant 7 jours', sortOrder: 1 },
      { value: '14_jours', labelFr: '14 jours', textFr: 'pendant 14 jours', sortOrder: 2 },
      { value: '1_mois', labelFr: '1 mois', textFr: 'pendant 1 mois', sortOrder: 3 },
      { value: '2_mois', labelFr: '2 mois', textFr: 'pendant 2 mois', sortOrder: 4 },
      { value: '3_mois', labelFr: '3 mois', textFr: 'pendant 3 mois', sortOrder: 5 },
      { value: 'au_long_cours', labelFr: 'Au long cours', textFr: 'au long cours', sortOrder: 6 }
    ]
  },
  {
    medicationForm: 'sirop',
    doseOptions: [
      { value: '1_cuillere_cafe', labelFr: '1 cuillère à café', textFr: 'Prendre 1 cuillère à café', sortOrder: 1 },
      { value: '2_cuilleres_cafe', labelFr: '2 cuillères à café', textFr: 'Prendre 2 cuillères à café', sortOrder: 2 },
      { value: '1_cuillere_soupe', labelFr: '1 cuillère à soupe', textFr: 'Prendre 1 cuillère à soupe', sortOrder: 3 },
      { value: '5ml', labelFr: '5 ml', textFr: 'Prendre 5 ml', sortOrder: 4 },
      { value: '10ml', labelFr: '10 ml', textFr: 'Prendre 10 ml', sortOrder: 5 }
    ],
    posologieOptions: [
      { value: 'matin', labelFr: 'Le matin', textFr: 'le matin', sortOrder: 1 },
      { value: 'soir', labelFr: 'Le soir', textFr: 'le soir', sortOrder: 2 },
      { value: 'matin_soir', labelFr: 'Matin et soir', textFr: 'matin et soir', sortOrder: 3 },
      { value: '2_fois_jour', labelFr: '2 fois par jour', textFr: '2 fois par jour', sortOrder: 4 },
      { value: '3_fois_jour', labelFr: '3 fois par jour', textFr: '3 fois par jour', sortOrder: 5 }
    ],
    detailsOptions: [
      { value: 'agiter_avant', labelFr: 'Agiter avant emploi', textFr: 'agiter avant emploi', sortOrder: 1 },
      { value: 'diluer_eau', labelFr: 'Diluer dans de l\'eau', textFr: 'diluer dans un verre d\'eau', sortOrder: 2 }
    ],
    durationOptions: [
      { value: '5_jours', labelFr: '5 jours', textFr: 'pendant 5 jours', sortOrder: 1 },
      { value: '7_jours', labelFr: '7 jours', textFr: 'pendant 7 jours', sortOrder: 2 },
      { value: '10_jours', labelFr: '10 jours', textFr: 'pendant 10 jours', sortOrder: 3 }
    ]
  }
];

async function seedDoseTemplates() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Delete existing dose templates
    await DoseTemplate.deleteMany({});
    console.log('🗑️  Deleted existing dose templates');

    // Insert new templates
    const result = await DoseTemplate.insertMany(doseTemplates);
    console.log(`✅ Successfully seeded ${result.length} dose templates`);

    // Display created templates
    result.forEach(template => {
      console.log(`  - ${template.medicationForm}: ${template.doseOptions.length} dose options`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding dose templates:', error);
    process.exit(1);
  }
}

// Run the seed function
seedDoseTemplates();
