const mongoose = require('mongoose');
require('dotenv').config();

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedDoseTemplatesComplete.js');

const DoseTemplate = require('../models/DoseTemplate');

const doseTemplates = [
  // Eye Drops (Collyre) - Most important for ophthalmology
  {
    medicationForm: 'collyre',
    doseOptions: [
      { value: '1_goutte', labelFr: '1 goutte', textFr: '1 goutte', sortOrder: 1 },
      { value: '2_gouttes', labelFr: '2 gouttes', textFr: '2 gouttes', sortOrder: 2 },
      { value: '3_gouttes', labelFr: '3 gouttes', textFr: '3 gouttes', sortOrder: 3 }
    ],
    posologieOptions: [
      { value: 'od', labelFr: 'OD', textFr: "dans l'œil droit", sortOrder: 1 },
      { value: 'og', labelFr: 'OG', textFr: "dans l'œil gauche", sortOrder: 2 },
      { value: 'odg', labelFr: 'ODG', textFr: 'dans les deux yeux', sortOrder: 3 },
      { value: '1x_jour', labelFr: '1x/jour', textFr: 'une fois par jour', sortOrder: 4 },
      { value: '2x_jour', labelFr: '2x/jour', textFr: 'deux fois par jour', sortOrder: 5 },
      { value: '3x_jour', labelFr: '3x/jour', textFr: 'trois fois par jour', sortOrder: 6 },
      { value: '4x_jour', labelFr: '4x/jour', textFr: 'quatre fois par jour', sortOrder: 7 },
      { value: '6x_jour', labelFr: '6x/jour', textFr: 'six fois par jour', sortOrder: 8 },
      { value: 'toutes_heures', labelFr: 'Toutes les heures', textFr: 'toutes les heures', sortOrder: 9 },
      { value: 'toutes_2h', labelFr: 'Toutes les 2h', textFr: 'toutes les 2 heures', sortOrder: 10 },
      { value: 'toutes_4h', labelFr: 'Toutes les 4h', textFr: 'toutes les 4 heures', sortOrder: 11 },
      { value: 'matin', labelFr: 'Le matin', textFr: 'le matin', sortOrder: 12 },
      { value: 'soir', labelFr: 'Le soir', textFr: 'le soir', sortOrder: 13 },
      { value: 'coucher', labelFr: 'Au coucher', textFr: 'au coucher', sortOrder: 14 }
    ],
    detailsOptions: [
      { value: 'avant_repas', labelFr: 'Avant les repas', textFr: 'avant les repas', sortOrder: 1 },
      { value: 'apres_repas', labelFr: 'Après les repas', textFr: 'après les repas', sortOrder: 2 },
      { value: 'espacer_5min', labelFr: 'Espacer de 5 min', textFr: 'espacer de 5 minutes des autres collyres', sortOrder: 3 },
      { value: 'espacer_15min', labelFr: 'Espacer de 15 min', textFr: 'espacer de 15 minutes des autres collyres', sortOrder: 4 },
      { value: 'agiter', labelFr: 'Agiter avant', textFr: 'bien agiter le flacon avant utilisation', sortOrder: 5 },
      { value: 'conserver_frigo', labelFr: 'Conserver au frigo', textFr: 'conserver au réfrigérateur', sortOrder: 6 },
      { value: 'sans_lentilles', labelFr: 'Retirer lentilles', textFr: 'retirer les lentilles de contact avant application', sortOrder: 7 },
      { value: 'attendre_lentilles', labelFr: 'Attendre 15min lentilles', textFr: 'attendre 15 minutes avant de remettre les lentilles', sortOrder: 8 },
      { value: 'decremental', labelFr: 'Décroissance', textFr: 'en décroissance progressive', sortOrder: 9 }
    ],
    durationOptions: [
      { value: '3_jours', labelFr: '3 jours', textFr: 'pendant 3 jours', sortOrder: 1 },
      { value: '5_jours', labelFr: '5 jours', textFr: 'pendant 5 jours', sortOrder: 2 },
      { value: '7_jours', labelFr: '7 jours', textFr: 'pendant 7 jours', sortOrder: 3 },
      { value: '10_jours', labelFr: '10 jours', textFr: 'pendant 10 jours', sortOrder: 4 },
      { value: '14_jours', labelFr: '14 jours', textFr: 'pendant 14 jours', sortOrder: 5 },
      { value: '21_jours', labelFr: '21 jours', textFr: 'pendant 21 jours', sortOrder: 6 },
      { value: '1_mois', labelFr: '1 mois', textFr: 'pendant 1 mois', sortOrder: 7 },
      { value: '2_mois', labelFr: '2 mois', textFr: 'pendant 2 mois', sortOrder: 8 },
      { value: '3_mois', labelFr: '3 mois', textFr: 'pendant 3 mois', sortOrder: 9 },
      { value: 'long_cours', labelFr: 'Au long cours', textFr: 'traitement au long cours', sortOrder: 10 },
      { value: 'a_vie', labelFr: 'À vie', textFr: 'traitement à vie', sortOrder: 11 },
      { value: 'jusqu_rdv', labelFr: "Jusqu'au RDV", textFr: "jusqu'au prochain rendez-vous", sortOrder: 12 }
    ]
  },

  // Ophthalmic Ointment
  {
    medicationForm: 'pommade_ophtalmique',
    doseOptions: [
      { value: '1_application', labelFr: '1 application', textFr: '1 application', sortOrder: 1 },
      { value: 'ruban_1cm', labelFr: 'Ruban 1cm', textFr: 'un ruban de 1 cm', sortOrder: 2 }
    ],
    posologieOptions: [
      { value: 'od', labelFr: 'OD', textFr: "dans l'œil droit", sortOrder: 1 },
      { value: 'og', labelFr: 'OG', textFr: "dans l'œil gauche", sortOrder: 2 },
      { value: 'odg', labelFr: 'ODG', textFr: 'dans les deux yeux', sortOrder: 3 },
      { value: '1x_jour', labelFr: '1x/jour', textFr: 'une fois par jour', sortOrder: 4 },
      { value: '2x_jour', labelFr: '2x/jour', textFr: 'deux fois par jour', sortOrder: 5 },
      { value: '3x_jour', labelFr: '3x/jour', textFr: 'trois fois par jour', sortOrder: 6 },
      { value: 'coucher', labelFr: 'Au coucher', textFr: 'au coucher', sortOrder: 7 },
      { value: 'matin_soir', labelFr: 'Matin et soir', textFr: 'matin et soir', sortOrder: 8 }
    ],
    detailsOptions: [
      { value: 'cul_sac', labelFr: 'Cul-de-sac', textFr: 'dans le cul-de-sac conjonctival inférieur', sortOrder: 1 },
      { value: 'bord_paupieres', labelFr: 'Bord paupières', textFr: 'sur le bord des paupières', sortOrder: 2 },
      { value: 'sans_lentilles', labelFr: 'Sans lentilles', textFr: 'ne pas porter de lentilles pendant le traitement', sortOrder: 3 }
    ],
    durationOptions: [
      { value: '3_jours', labelFr: '3 jours', textFr: 'pendant 3 jours', sortOrder: 1 },
      { value: '5_jours', labelFr: '5 jours', textFr: 'pendant 5 jours', sortOrder: 2 },
      { value: '7_jours', labelFr: '7 jours', textFr: 'pendant 7 jours', sortOrder: 3 },
      { value: '10_jours', labelFr: '10 jours', textFr: 'pendant 10 jours', sortOrder: 4 },
      { value: '14_jours', labelFr: '14 jours', textFr: 'pendant 14 jours', sortOrder: 5 }
    ]
  },

  // Tablets
  {
    medicationForm: 'comprime',
    doseOptions: [
      { value: '0.5_cp', labelFr: '½ cp', textFr: 'un demi comprimé', sortOrder: 1 },
      { value: '1_cp', labelFr: '1 cp', textFr: 'un comprimé', sortOrder: 2 },
      { value: '2_cp', labelFr: '2 cp', textFr: 'deux comprimés', sortOrder: 3 },
      { value: '3_cp', labelFr: '3 cp', textFr: 'trois comprimés', sortOrder: 4 }
    ],
    posologieOptions: [
      { value: '1x_jour', labelFr: '1x/jour', textFr: 'une fois par jour', sortOrder: 1 },
      { value: '2x_jour', labelFr: '2x/jour', textFr: 'deux fois par jour', sortOrder: 2 },
      { value: '3x_jour', labelFr: '3x/jour', textFr: 'trois fois par jour', sortOrder: 3 },
      { value: 'matin', labelFr: 'Le matin', textFr: 'le matin', sortOrder: 4 },
      { value: 'midi', labelFr: 'Le midi', textFr: 'le midi', sortOrder: 5 },
      { value: 'soir', labelFr: 'Le soir', textFr: 'le soir', sortOrder: 6 },
      { value: 'matin_soir', labelFr: 'Matin et soir', textFr: 'matin et soir', sortOrder: 7 },
      { value: 'matin_midi_soir', labelFr: 'M/M/S', textFr: 'matin, midi et soir', sortOrder: 8 }
    ],
    detailsOptions: [
      { value: 'a_jeun', labelFr: 'À jeun', textFr: 'à jeun', sortOrder: 1 },
      { value: 'pendant_repas', labelFr: 'Pendant repas', textFr: 'pendant les repas', sortOrder: 2 },
      { value: 'apres_repas', labelFr: 'Après repas', textFr: 'après les repas', sortOrder: 3 },
      { value: 'avec_eau', labelFr: 'Avec eau', textFr: 'avec un grand verre d\'eau', sortOrder: 4 },
      { value: 'sans_croquer', labelFr: 'Sans croquer', textFr: 'avaler sans croquer', sortOrder: 5 },
      { value: 'sucer', labelFr: 'À sucer', textFr: 'à sucer', sortOrder: 6 }
    ],
    durationOptions: [
      { value: '3_jours', labelFr: '3 jours', textFr: 'pendant 3 jours', sortOrder: 1 },
      { value: '5_jours', labelFr: '5 jours', textFr: 'pendant 5 jours', sortOrder: 2 },
      { value: '7_jours', labelFr: '7 jours', textFr: 'pendant 7 jours', sortOrder: 3 },
      { value: '10_jours', labelFr: '10 jours', textFr: 'pendant 10 jours', sortOrder: 4 },
      { value: '14_jours', labelFr: '14 jours', textFr: 'pendant 14 jours', sortOrder: 5 },
      { value: '21_jours', labelFr: '21 jours', textFr: 'pendant 21 jours', sortOrder: 6 },
      { value: '1_mois', labelFr: '1 mois', textFr: 'pendant 1 mois', sortOrder: 7 },
      { value: '3_mois', labelFr: '3 mois', textFr: 'pendant 3 mois', sortOrder: 8 }
    ]
  },

  // Capsules
  {
    medicationForm: 'gelule',
    doseOptions: [
      { value: '1_gelule', labelFr: '1 gélule', textFr: 'une gélule', sortOrder: 1 },
      { value: '2_gelules', labelFr: '2 gélules', textFr: 'deux gélules', sortOrder: 2 }
    ],
    posologieOptions: [
      { value: '1x_jour', labelFr: '1x/jour', textFr: 'une fois par jour', sortOrder: 1 },
      { value: '2x_jour', labelFr: '2x/jour', textFr: 'deux fois par jour', sortOrder: 2 },
      { value: '3x_jour', labelFr: '3x/jour', textFr: 'trois fois par jour', sortOrder: 3 },
      { value: 'matin', labelFr: 'Le matin', textFr: 'le matin', sortOrder: 4 },
      { value: 'soir', labelFr: 'Le soir', textFr: 'le soir', sortOrder: 5 }
    ],
    detailsOptions: [
      { value: 'a_jeun', labelFr: 'À jeun', textFr: 'à jeun', sortOrder: 1 },
      { value: 'pendant_repas', labelFr: 'Pendant repas', textFr: 'pendant les repas', sortOrder: 2 },
      { value: 'avec_eau', labelFr: 'Avec eau', textFr: 'avec un grand verre d\'eau', sortOrder: 3 }
    ],
    durationOptions: [
      { value: '5_jours', labelFr: '5 jours', textFr: 'pendant 5 jours', sortOrder: 1 },
      { value: '7_jours', labelFr: '7 jours', textFr: 'pendant 7 jours', sortOrder: 2 },
      { value: '10_jours', labelFr: '10 jours', textFr: 'pendant 10 jours', sortOrder: 3 },
      { value: '1_mois', labelFr: '1 mois', textFr: 'pendant 1 mois', sortOrder: 4 },
      { value: '3_mois', labelFr: '3 mois', textFr: 'pendant 3 mois', sortOrder: 5 }
    ]
  },

  // Syrup
  {
    medicationForm: 'sirop',
    doseOptions: [
      { value: '5ml', labelFr: '5 ml', textFr: '5 ml (1 cuillère à café)', sortOrder: 1 },
      { value: '10ml', labelFr: '10 ml', textFr: '10 ml (2 cuillères à café)', sortOrder: 2 },
      { value: '15ml', labelFr: '15 ml', textFr: '15 ml (1 cuillère à soupe)', sortOrder: 3 }
    ],
    posologieOptions: [
      { value: '1x_jour', labelFr: '1x/jour', textFr: 'une fois par jour', sortOrder: 1 },
      { value: '2x_jour', labelFr: '2x/jour', textFr: 'deux fois par jour', sortOrder: 2 },
      { value: '3x_jour', labelFr: '3x/jour', textFr: 'trois fois par jour', sortOrder: 3 }
    ],
    detailsOptions: [
      { value: 'agiter', labelFr: 'Agiter', textFr: 'bien agiter avant utilisation', sortOrder: 1 },
      { value: 'avant_repas', labelFr: 'Avant repas', textFr: 'avant les repas', sortOrder: 2 }
    ],
    durationOptions: [
      { value: '5_jours', labelFr: '5 jours', textFr: 'pendant 5 jours', sortOrder: 1 },
      { value: '7_jours', labelFr: '7 jours', textFr: 'pendant 7 jours', sortOrder: 2 },
      { value: '10_jours', labelFr: '10 jours', textFr: 'pendant 10 jours', sortOrder: 3 }
    ]
  },

  // Injectable
  {
    medicationForm: 'injectable',
    doseOptions: [
      { value: '1_injection', labelFr: '1 injection', textFr: 'une injection', sortOrder: 1 },
      { value: '1_ampoule', labelFr: '1 ampoule', textFr: 'une ampoule', sortOrder: 2 }
    ],
    posologieOptions: [
      { value: 'iv', labelFr: 'IV', textFr: 'par voie intraveineuse', sortOrder: 1 },
      { value: 'im', labelFr: 'IM', textFr: 'par voie intramusculaire', sortOrder: 2 },
      { value: 'sc', labelFr: 'SC', textFr: 'par voie sous-cutanée', sortOrder: 3 },
      { value: 'ivt', labelFr: 'IVT', textFr: 'par injection intravitréenne', sortOrder: 4 },
      { value: '1x_jour', labelFr: '1x/jour', textFr: 'une fois par jour', sortOrder: 5 },
      { value: '2x_jour', labelFr: '2x/jour', textFr: 'deux fois par jour', sortOrder: 6 }
    ],
    detailsOptions: [
      { value: 'lent', labelFr: 'Injection lente', textFr: 'injection lente', sortOrder: 1 },
      { value: 'perfusion', labelFr: 'En perfusion', textFr: 'en perfusion', sortOrder: 2 }
    ],
    durationOptions: [
      { value: '1_injection', labelFr: '1 injection', textFr: 'une seule injection', sortOrder: 1 },
      { value: '3_jours', labelFr: '3 jours', textFr: 'pendant 3 jours', sortOrder: 2 },
      { value: '5_jours', labelFr: '5 jours', textFr: 'pendant 5 jours', sortOrder: 3 },
      { value: '7_jours', labelFr: '7 jours', textFr: 'pendant 7 jours', sortOrder: 4 }
    ]
  },

  // Cream
  {
    medicationForm: 'creme',
    doseOptions: [
      { value: '1_application', labelFr: '1 application', textFr: 'une application', sortOrder: 1 },
      { value: 'fine_couche', labelFr: 'Fine couche', textFr: 'une fine couche', sortOrder: 2 }
    ],
    posologieOptions: [
      { value: '1x_jour', labelFr: '1x/jour', textFr: 'une fois par jour', sortOrder: 1 },
      { value: '2x_jour', labelFr: '2x/jour', textFr: 'deux fois par jour', sortOrder: 2 },
      { value: '3x_jour', labelFr: '3x/jour', textFr: 'trois fois par jour', sortOrder: 3 }
    ],
    detailsOptions: [
      { value: 'masser', labelFr: 'En massant', textFr: 'en massant légèrement', sortOrder: 1 },
      { value: 'peau_propre', labelFr: 'Peau propre', textFr: 'sur peau propre et sèche', sortOrder: 2 }
    ],
    durationOptions: [
      { value: '7_jours', labelFr: '7 jours', textFr: 'pendant 7 jours', sortOrder: 1 },
      { value: '14_jours', labelFr: '14 jours', textFr: 'pendant 14 jours', sortOrder: 2 },
      { value: '21_jours', labelFr: '21 jours', textFr: 'pendant 21 jours', sortOrder: 3 }
    ]
  },

  // Gel
  {
    medicationForm: 'gel',
    doseOptions: [
      { value: '1_noisette', labelFr: '1 noisette', textFr: 'une noisette', sortOrder: 1 },
      { value: '1_application', labelFr: '1 application', textFr: 'une application', sortOrder: 2 }
    ],
    posologieOptions: [
      { value: '1x_jour', labelFr: '1x/jour', textFr: 'une fois par jour', sortOrder: 1 },
      { value: '2x_jour', labelFr: '2x/jour', textFr: 'deux fois par jour', sortOrder: 2 },
      { value: '3x_jour', labelFr: '3x/jour', textFr: 'trois fois par jour', sortOrder: 3 }
    ],
    detailsOptions: [
      { value: 'masser', labelFr: 'En massant', textFr: 'en massant légèrement', sortOrder: 1 }
    ],
    durationOptions: [
      { value: '7_jours', labelFr: '7 jours', textFr: 'pendant 7 jours', sortOrder: 1 },
      { value: '14_jours', labelFr: '14 jours', textFr: 'pendant 14 jours', sortOrder: 2 }
    ]
  },

  // Suppository
  {
    medicationForm: 'suppositoire',
    doseOptions: [
      { value: '1_suppo', labelFr: '1 suppositoire', textFr: 'un suppositoire', sortOrder: 1 }
    ],
    posologieOptions: [
      { value: '1x_jour', labelFr: '1x/jour', textFr: 'une fois par jour', sortOrder: 1 },
      { value: '2x_jour', labelFr: '2x/jour', textFr: 'deux fois par jour', sortOrder: 2 },
      { value: 'soir', labelFr: 'Le soir', textFr: 'le soir', sortOrder: 3 }
    ],
    detailsOptions: [
      { value: 'voie_rectale', labelFr: 'Voie rectale', textFr: 'par voie rectale', sortOrder: 1 }
    ],
    durationOptions: [
      { value: '3_jours', labelFr: '3 jours', textFr: 'pendant 3 jours', sortOrder: 1 },
      { value: '5_jours', labelFr: '5 jours', textFr: 'pendant 5 jours', sortOrder: 2 }
    ]
  },

  // Oral solution
  {
    medicationForm: 'solution_buvable',
    doseOptions: [
      { value: '5ml', labelFr: '5 ml', textFr: '5 ml', sortOrder: 1 },
      { value: '10ml', labelFr: '10 ml', textFr: '10 ml', sortOrder: 2 },
      { value: '1_dose', labelFr: '1 dose', textFr: 'une dose', sortOrder: 3 },
      { value: '1_sachet', labelFr: '1 sachet', textFr: 'un sachet', sortOrder: 4 }
    ],
    posologieOptions: [
      { value: '1x_jour', labelFr: '1x/jour', textFr: 'une fois par jour', sortOrder: 1 },
      { value: '2x_jour', labelFr: '2x/jour', textFr: 'deux fois par jour', sortOrder: 2 },
      { value: '3x_jour', labelFr: '3x/jour', textFr: 'trois fois par jour', sortOrder: 3 }
    ],
    detailsOptions: [
      { value: 'diluer', labelFr: 'Diluer', textFr: 'à diluer dans un verre d\'eau', sortOrder: 1 },
      { value: 'avant_repas', labelFr: 'Avant repas', textFr: 'avant les repas', sortOrder: 2 }
    ],
    durationOptions: [
      { value: '7_jours', labelFr: '7 jours', textFr: 'pendant 7 jours', sortOrder: 1 },
      { value: '14_jours', labelFr: '14 jours', textFr: 'pendant 14 jours', sortOrder: 2 },
      { value: '1_mois', labelFr: '1 mois', textFr: 'pendant 1 mois', sortOrder: 3 }
    ]
  },

  // Aerosol
  {
    medicationForm: 'aerosol',
    doseOptions: [
      { value: '1_bouffee', labelFr: '1 bouffée', textFr: 'une bouffée', sortOrder: 1 },
      { value: '2_bouffees', labelFr: '2 bouffées', textFr: 'deux bouffées', sortOrder: 2 }
    ],
    posologieOptions: [
      { value: '1x_jour', labelFr: '1x/jour', textFr: 'une fois par jour', sortOrder: 1 },
      { value: '2x_jour', labelFr: '2x/jour', textFr: 'deux fois par jour', sortOrder: 2 },
      { value: 'si_besoin', labelFr: 'Si besoin', textFr: 'si besoin', sortOrder: 3 }
    ],
    detailsOptions: [
      { value: 'agiter', labelFr: 'Agiter', textFr: 'bien agiter avant utilisation', sortOrder: 1 }
    ],
    durationOptions: [
      { value: 'si_besoin', labelFr: 'Si besoin', textFr: 'si besoin', sortOrder: 1 },
      { value: '1_mois', labelFr: '1 mois', textFr: 'pendant 1 mois', sortOrder: 2 }
    ]
  },

  // Powder
  {
    medicationForm: 'poudre',
    doseOptions: [
      { value: '1_sachet', labelFr: '1 sachet', textFr: 'un sachet', sortOrder: 1 },
      { value: '1_mesure', labelFr: '1 mesure', textFr: 'une mesure', sortOrder: 2 }
    ],
    posologieOptions: [
      { value: '1x_jour', labelFr: '1x/jour', textFr: 'une fois par jour', sortOrder: 1 },
      { value: '2x_jour', labelFr: '2x/jour', textFr: 'deux fois par jour', sortOrder: 2 },
      { value: '3x_jour', labelFr: '3x/jour', textFr: 'trois fois par jour', sortOrder: 3 }
    ],
    detailsOptions: [
      { value: 'diluer', labelFr: 'Diluer', textFr: 'à diluer dans un verre d\'eau', sortOrder: 1 }
    ],
    durationOptions: [
      { value: '7_jours', labelFr: '7 jours', textFr: 'pendant 7 jours', sortOrder: 1 },
      { value: '14_jours', labelFr: '14 jours', textFr: 'pendant 14 jours', sortOrder: 2 }
    ]
  },

  // Patch
  {
    medicationForm: 'patch',
    doseOptions: [
      { value: '1_patch', labelFr: '1 patch', textFr: 'un patch', sortOrder: 1 }
    ],
    posologieOptions: [
      { value: '1x_jour', labelFr: '1x/jour', textFr: 'une fois par jour', sortOrder: 1 },
      { value: 'tous_3_jours', labelFr: 'Tous les 3 jours', textFr: 'tous les 3 jours', sortOrder: 2 },
      { value: '1x_semaine', labelFr: '1x/semaine', textFr: 'une fois par semaine', sortOrder: 3 }
    ],
    detailsOptions: [
      { value: 'peau_seche', labelFr: 'Peau sèche', textFr: 'sur peau propre et sèche', sortOrder: 1 },
      { value: 'changer_site', labelFr: 'Changer site', textFr: 'changer de site à chaque application', sortOrder: 2 }
    ],
    durationOptions: [
      { value: '1_mois', labelFr: '1 mois', textFr: 'pendant 1 mois', sortOrder: 1 },
      { value: '3_mois', labelFr: '3 mois', textFr: 'pendant 3 mois', sortOrder: 2 }
    ]
  }
];

async function seedDoseTemplates() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('Connected to MongoDB');

    // Clear existing dose templates
    console.log('Clearing existing dose templates...');
    await DoseTemplate.deleteMany({});

    // Insert new templates
    console.log('Inserting dose templates...');
    let created = 0;

    for (const template of doseTemplates) {
      await DoseTemplate.create(template);
      created++;
      console.log(`  ✓ ${template.medicationForm}`);
    }

    console.log(`\n✅ Successfully created ${created} dose templates`);

    // Verify
    const count = await DoseTemplate.countDocuments();
    console.log(`Total dose templates in database: ${count}`);

  } catch (error) {
    console.error('Error seeding dose templates:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

if (require.main === module) {
  seedDoseTemplates().then(() => process.exit(0));
}

module.exports = seedDoseTemplates;
