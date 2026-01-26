const mongoose = require('mongoose');
require('dotenv').config();

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedTreatmentProtocols.js');

const TreatmentProtocol = require('../models/TreatmentProtocol');
const User = require('../models/User');

/**
 * Standard Treatment Protocol Templates for Ophthalmology
 * =========================================================
 * Populates the database with system-wide treatment protocols
 * for common ophthalmological conditions.
 *
 * Categories covered:
 * - Post-operative (cataract, glaucoma surgery)
 * - Glaucoma (monotherapy, combination therapy)
 * - Infections (bacterial, viral)
 * - Inflammation (uveitis)
 * - Allergies
 * - Dry eye
 * - IVT protocols
 *
 * Usage: node scripts/seedTreatmentProtocols.js
 */

// Standard ophthalmology treatment protocols
const treatmentProtocols = {
  // POST-OPERATIVE PROTOCOLS
  'post_operatoire': [
    {
      name: 'Post-Cataracte Standard',
      nameFr: 'Post-Cataracte Standard',
      description: 'Standard post-cataract surgery protocol with antibiotics and anti-inflammatory',
      descriptionFr: 'Protocole standard post-opératoire de chirurgie de la cataracte',
      indication: 'Routine post-cataract surgery without complications',
      tags: ['cataracte', 'post-op', 'standard', 'phaco'],
      expectedDuration: { value: 1, unit: 'months' },
      medications: [
        {
          drugName: 'TOBRADEX collyre',
          genericName: 'Tobramycine/Dexaméthasone',
          drugClass: 'Corticoïde + Antibiotique',
          dosage: { eye: 'OU', frequency: '4x/jour', frequencyCode: 'QID', duration: { value: 4, unit: 'weeks' } },
          instructions: 'Semaine 1: 4x/jour, Semaine 2: 3x/jour, Semaine 3: 2x/jour, Semaine 4: 1x/jour',
          instructionsFr: 'Semaine 1: 4x/jour, Semaine 2: 3x/jour, Semaine 3: 2x/jour, Semaine 4: 1x/jour',
          taper: {
            enabled: true,
            schedule: [
              { week: 1, frequency: '4x/jour', frequencyCode: 'QID' },
              { week: 2, frequency: '3x/jour', frequencyCode: 'TID' },
              { week: 3, frequency: '2x/jour', frequencyCode: 'BID' },
              { week: 4, frequency: '1x/jour', frequencyCode: 'QD' }
            ]
          },
          order: 1,
          waitTimeAfter: 5
        },
        {
          drugName: 'INDOCOLLYRE collyre 0,1%',
          genericName: 'Indométacine',
          drugClass: 'AINS ophtalmique',
          dosage: { eye: 'OU', frequency: '3x/jour', frequencyCode: 'TID', duration: { value: 1, unit: 'months' } },
          instructions: 'Space 5 minutes apart from other drops',
          instructionsFr: 'Espacer de 5 minutes avec les autres collyres',
          order: 2,
          waitTimeAfter: 5
        }
      ]
    },
    {
      name: 'Post-Cataracte Renforcé',
      nameFr: 'Post-Cataracte Renforcé',
      description: 'Enhanced post-cataract protocol for high-risk patients',
      descriptionFr: 'Protocole renforcé pour patients à risque inflammatoire élevé',
      indication: 'Diabetic patients, previous uveitis, complicated surgery',
      tags: ['cataracte', 'post-op', 'renforcé', 'diabétique', 'uvéite'],
      expectedDuration: { value: 6, unit: 'weeks' },
      medications: [
        {
          drugName: 'MAXIDEX collyre 0,1%',
          genericName: 'Dexaméthasone',
          drugClass: 'Corticoïde ophtalmique',
          dosage: { eye: 'OU', frequency: '6x/jour', frequencyCode: 'Q4H', duration: { value: 3, unit: 'weeks' } },
          instructions: 'Gradual taper over 3 weeks, monitor IOP',
          instructionsFr: 'Décroissance progressive sur 3 semaines, surveiller la PIO',
          taper: {
            enabled: true,
            schedule: [
              { week: 1, frequency: '6x/jour', frequencyCode: 'Q4H' },
              { week: 2, frequency: '4x/jour', frequencyCode: 'QID' },
              { week: 3, frequency: '2x/jour', frequencyCode: 'BID' }
            ]
          },
          order: 1,
          waitTimeAfter: 5
        },
        {
          drugName: 'CILOXAN collyre 0,3%',
          genericName: 'Ciprofloxacine',
          drugClass: 'Antibiotique fluoroquinolone',
          dosage: { eye: 'OU', frequency: '4x/jour', frequencyCode: 'QID', duration: { value: 10, unit: 'days' } },
          instructionsFr: 'Pendant 10 jours',
          order: 2,
          waitTimeAfter: 5
        },
        {
          drugName: 'INDOCOLLYRE collyre 0,1%',
          genericName: 'Indométacine',
          drugClass: 'AINS ophtalmique',
          dosage: { eye: 'OU', frequency: '3x/jour', frequencyCode: 'TID', duration: { value: 1, unit: 'months' } },
          instructionsFr: 'Pendant 1 mois',
          order: 3,
          waitTimeAfter: 5
        }
      ]
    },
    {
      name: 'Post-Trabéculectomie',
      nameFr: 'Post-Trabéculectomie',
      description: 'Post-trabeculectomy glaucoma surgery protocol',
      descriptionFr: 'Protocole post-opératoire de trabéculectomie',
      indication: 'After trabeculectomy or glaucoma filtering surgery',
      tags: ['glaucome', 'post-op', 'trabéculectomie', 'chirurgie filtrante'],
      expectedDuration: { value: 2, unit: 'months' },
      medications: [
        {
          drugName: 'TOBRADEX collyre',
          genericName: 'Tobramycine/Dexaméthasone',
          drugClass: 'Corticoïde + Antibiotique',
          dosage: { eye: 'OU', frequency: '6x/jour', frequencyCode: 'Q4H', duration: { value: 2, unit: 'months' } },
          instructions: 'Aggressive steroid regimen to prevent scarring',
          instructionsFr: 'Régime corticoïde intensif pour prévenir la cicatrisation',
          order: 1,
          waitTimeAfter: 5
        },
        {
          drugName: 'ATROPINE 1% collyre',
          genericName: 'Atropine',
          drugClass: 'Mydriatique cycloplégique',
          dosage: { eye: 'OU', frequency: '2x/jour', frequencyCode: 'BID', duration: { value: 2, unit: 'weeks' } },
          instructionsFr: 'Pour maintenir la chambre antérieure profonde',
          order: 2,
          waitTimeAfter: 5
        }
      ]
    }
  ],

  // GLAUCOMA PROTOCOLS
  'glaucome': [
    {
      name: 'Glaucome - Prostaglandine',
      nameFr: 'Glaucome - Prostaglandine',
      description: 'First-line prostaglandin analog monotherapy',
      descriptionFr: 'Monothérapie de première ligne par analogue des prostaglandines',
      indication: 'Open-angle glaucoma, ocular hypertension',
      tags: ['glaucome', 'première ligne', 'prostaglandine', 'GPAO'],
      expectedDuration: { value: 3, unit: 'months' },
      medications: [
        {
          drugName: 'XALATAN collyre 0,005%',
          genericName: 'Latanoprost',
          drugClass: 'Analogue prostaglandine',
          dosage: { eye: 'OU', frequency: '1x/jour le soir', frequencyCode: 'QHS', duration: { value: 3, unit: 'months' } },
          instructions: 'One drop at bedtime only - no benefit from higher dosing',
          instructionsFr: 'Une seule goutte le soir - pas de bénéfice à augmenter la dose',
          order: 1
        }
      ]
    },
    {
      name: 'Glaucome - Bêta-bloquant',
      nameFr: 'Glaucome - Bêta-bloquant',
      description: 'Beta-blocker monotherapy for glaucoma',
      descriptionFr: 'Monothérapie par bêta-bloquant',
      indication: 'Open-angle glaucoma, contraindication to prostaglandins',
      tags: ['glaucome', 'bêta-bloquant', 'timolol'],
      expectedDuration: { value: 3, unit: 'months' },
      contraindications: [
        { description: 'Asthma/COPD', descriptionFr: 'Asthme/BPCO', severity: 'absolute' },
        { description: 'Bradycardia', descriptionFr: 'Bradycardie', severity: 'absolute' },
        { description: 'Heart block', descriptionFr: 'Bloc cardiaque', severity: 'absolute' }
      ],
      medications: [
        {
          drugName: 'TIMOPTOL collyre 0,50%',
          genericName: 'Timolol',
          drugClass: 'Bêta-bloquant ophtalmique',
          dosage: { eye: 'OU', frequency: '2x/jour', frequencyCode: 'BID', duration: { value: 3, unit: 'months' } },
          instructions: 'Morning and evening, punctal occlusion for 1 minute',
          instructionsFr: 'Matin et soir, compression du point lacrymal pendant 1 minute',
          order: 1
        }
      ]
    },
    {
      name: 'Glaucome - Bithérapie Fixe',
      nameFr: 'Glaucome - Bithérapie Fixe',
      description: 'Fixed combination dual therapy for uncontrolled glaucoma',
      descriptionFr: 'Association fixe pour glaucome non contrôlé par monothérapie',
      indication: 'Glaucoma not controlled on monotherapy',
      tags: ['glaucome', 'bithérapie', 'association fixe'],
      expectedDuration: { value: 3, unit: 'months' },
      medications: [
        {
          drugName: 'COSOPT collyre',
          genericName: 'Dorzolamide/Timolol',
          drugClass: 'IAC + Bêta-bloquant',
          dosage: { eye: 'OU', frequency: '2x/jour', frequencyCode: 'BID', duration: { value: 3, unit: 'months' } },
          instructionsFr: 'Matin et soir',
          order: 1
        }
      ]
    },
    {
      name: 'Glaucome - Trithérapie',
      nameFr: 'Glaucome - Trithérapie',
      description: 'Triple therapy for severe glaucoma',
      descriptionFr: 'Trithérapie pour glaucome sévère non contrôlé',
      indication: 'Severe glaucoma not controlled on dual therapy',
      tags: ['glaucome', 'trithérapie', 'avancé'],
      expectedDuration: { value: 3, unit: 'months' },
      medications: [
        {
          drugName: 'XALATAN collyre 0,005%',
          genericName: 'Latanoprost',
          drugClass: 'Analogue prostaglandine',
          dosage: { eye: 'OU', frequency: '1x/jour le soir', frequencyCode: 'QHS', duration: { value: 3, unit: 'months' } },
          instructionsFr: 'Le soir au coucher',
          order: 1,
          waitTimeAfter: 5
        },
        {
          drugName: 'COSOPT collyre',
          genericName: 'Dorzolamide/Timolol',
          drugClass: 'IAC + Bêta-bloquant',
          dosage: { eye: 'OU', frequency: '2x/jour', frequencyCode: 'BID', duration: { value: 3, unit: 'months' } },
          instructionsFr: 'Matin et soir',
          order: 2,
          waitTimeAfter: 5
        }
      ]
    },
    {
      name: 'Crise de Glaucome Aigu',
      nameFr: 'Crise de Glaucome Aigu',
      description: 'Acute angle-closure glaucoma emergency protocol',
      descriptionFr: 'Protocole d\'urgence pour crise de glaucome aigu par fermeture de l\'angle',
      indication: 'Acute angle-closure glaucoma attack',
      tags: ['glaucome', 'urgence', 'angle fermé', 'crise'],
      expectedDuration: { value: 1, unit: 'days' },
      medications: [
        {
          drugName: 'DIAMOX comprimé 250mg',
          genericName: 'Acétazolamide',
          drugClass: 'Inhibiteur anhydrase carbonique systémique',
          dosage: { frequency: '500mg stat puis 250mg x4/jour', frequencyCode: 'STAT', duration: { value: 2, unit: 'days' } },
          instructions: '500mg immediately, then 250mg 4 times daily',
          instructionsFr: '500mg immédiatement, puis 250mg 4 fois par jour',
          order: 1
        },
        {
          drugName: 'PILOCARPINE 2% collyre',
          genericName: 'Pilocarpine',
          drugClass: 'Myotique',
          dosage: { eye: 'OU', frequency: 'Toutes les 15 min x4, puis 4x/jour', frequencyCode: 'Q1H', duration: { value: 1, unit: 'days' } },
          instructions: 'Every 15 min x4, then 4 times daily until laser',
          instructionsFr: 'Toutes les 15 min x4, puis 4x/jour jusqu\'au laser',
          order: 2,
          waitTimeAfter: 5
        },
        {
          drugName: 'TIMOPTOL collyre 0,50%',
          genericName: 'Timolol',
          drugClass: 'Bêta-bloquant ophtalmique',
          dosage: { eye: 'OU', frequency: '2x/jour', frequencyCode: 'BID', duration: { value: 1, unit: 'days' } },
          instructionsFr: 'Si pas de contre-indication cardiaque',
          order: 3,
          waitTimeAfter: 5
        }
      ]
    }
  ],

  // INFECTION PROTOCOLS
  'infection': [
    {
      name: 'Conjonctivite Bactérienne',
      nameFr: 'Conjonctivite Bactérienne',
      description: 'Bacterial conjunctivitis treatment',
      descriptionFr: 'Traitement antibiotique de la conjonctivite bactérienne',
      indication: 'Acute bacterial conjunctivitis',
      tags: ['infection', 'conjonctivite', 'bactérienne', 'antibiotique'],
      expectedDuration: { value: 7, unit: 'days' },
      medications: [
        {
          drugName: 'TOBREX collyre',
          genericName: 'Tobramycine',
          drugClass: 'Aminoside ophtalmique',
          dosage: { eye: 'OU', frequency: '4x/jour', frequencyCode: 'QID', duration: { value: 7, unit: 'days' } },
          instructions: 'Continue for 48h after symptom resolution',
          instructionsFr: 'Poursuivre 48h après disparition des symptômes',
          order: 1
        }
      ]
    },
    {
      name: 'Kératite Bactérienne',
      nameFr: 'Kératite Bactérienne',
      description: 'Intensive bacterial keratitis treatment',
      descriptionFr: 'Traitement intensif de la kératite bactérienne',
      indication: 'Bacterial keratitis, corneal ulcer',
      tags: ['infection', 'kératite', 'ulcère', 'urgence', 'abcès cornéen'],
      expectedDuration: { value: 2, unit: 'weeks' },
      medications: [
        {
          drugName: 'CILOXAN collyre 0,3%',
          genericName: 'Ciprofloxacine',
          drugClass: 'Fluoroquinolone ophtalmique',
          dosage: { eye: 'OU', frequency: 'Toutes les heures J1-J2, puis décroissance', frequencyCode: 'Q1H', duration: { value: 14, unit: 'days' } },
          instructions: 'Days 1-2: hourly including night, then progressively decrease',
          instructionsFr: 'J1-J2: toutes les heures y compris la nuit, puis diminuer progressivement',
          order: 1,
          waitTimeAfter: 5
        },
        {
          drugName: 'ATROPINE 1% collyre',
          genericName: 'Atropine',
          drugClass: 'Cycloplégique',
          dosage: { eye: 'OU', frequency: '2x/jour', frequencyCode: 'BID', duration: { value: 7, unit: 'days' } },
          instructions: 'For cycloplegia and anti-inflammatory effect',
          instructionsFr: 'Pour effet cycloplégique et anti-inflammatoire',
          order: 2
        }
      ]
    },
    {
      name: 'Kératite Herpétique',
      nameFr: 'Kératite Herpétique',
      description: 'Herpes simplex keratitis treatment',
      descriptionFr: 'Traitement de la kératite herpétique',
      indication: 'HSV epithelial or stromal keratitis',
      tags: ['infection', 'herpès', 'kératite', 'antiviral'],
      expectedDuration: { value: 3, unit: 'weeks' },
      medications: [
        {
          drugName: 'ZOVIRAX pommade ophtalmique',
          genericName: 'Aciclovir',
          drugClass: 'Antiviral ophtalmique',
          dosage: { eye: 'OU', frequency: '5x/jour', frequencyCode: 'QID', duration: { value: 21, unit: 'days' } },
          instructions: '1 cm ribbon, continue 3 days after healing',
          instructionsFr: 'Un ruban de 1 cm, poursuivre 3 jours après cicatrisation',
          order: 1,
          waitTimeAfter: 10
        },
        {
          drugName: 'ZELITREX comprimé 500mg',
          genericName: 'Valaciclovir',
          drugClass: 'Antiviral systémique',
          dosage: { frequency: '1 cp 2x/jour', frequencyCode: 'BID', duration: { value: 10, unit: 'days' } },
          instructions: 'Oral antiviral for stromal involvement',
          instructionsFr: 'Traitement oral associé en cas d\'atteinte stromale',
          order: 2
        }
      ]
    },
    {
      name: 'Endophtalmie Post-opératoire',
      nameFr: 'Endophtalmie Post-opératoire',
      description: 'Post-operative endophthalmitis emergency protocol',
      descriptionFr: 'Protocole d\'urgence pour endophtalmie post-opératoire',
      indication: 'Suspected post-operative endophthalmitis',
      tags: ['infection', 'endophtalmie', 'urgence', 'post-op'],
      expectedDuration: { value: 2, unit: 'weeks' },
      medications: [
        {
          drugName: 'VANCOMYCINE collyre fortifié 50mg/ml',
          genericName: 'Vancomycine',
          drugClass: 'Antibiotique fortifié',
          dosage: { eye: 'OU', frequency: 'Toutes les heures', frequencyCode: 'Q1H', duration: { value: 7, unit: 'days' } },
          instructionsFr: 'Collyre préparé en pharmacie hospitalière',
          order: 1,
          waitTimeAfter: 5
        },
        {
          drugName: 'CEFTAZIDIME collyre fortifié 50mg/ml',
          genericName: 'Ceftazidime',
          drugClass: 'Antibiotique fortifié',
          dosage: { eye: 'OU', frequency: 'Toutes les heures', frequencyCode: 'Q1H', duration: { value: 7, unit: 'days' } },
          instructionsFr: 'En alternance avec vancomycine, collyre préparé en pharmacie',
          order: 2,
          waitTimeAfter: 5
        }
      ]
    }
  ],

  // ALLERGY PROTOCOLS
  'allergie': [
    {
      name: 'Conjonctivite Allergique',
      nameFr: 'Conjonctivite Allergique',
      description: 'Allergic conjunctivitis treatment',
      descriptionFr: 'Traitement de la conjonctivite allergique',
      indication: 'Seasonal or perennial allergic conjunctivitis',
      tags: ['allergie', 'conjonctivite', 'saisonnière'],
      expectedDuration: { value: 2, unit: 'weeks' },
      medications: [
        {
          drugName: 'OPATANOL collyre',
          genericName: 'Olopatadine',
          drugClass: 'Antihistaminique + stabilisateur mastocytaire',
          dosage: { eye: 'OU', frequency: '2x/jour', frequencyCode: 'BID', duration: { value: 14, unit: 'days' } },
          instructions: 'Can be extended if needed for seasonal allergies',
          instructionsFr: 'Peut être prolongé si nécessaire pour allergies saisonnières',
          order: 1
        }
      ]
    },
    {
      name: 'Kératoconjonctivite Vernale',
      nameFr: 'Kératoconjonctivite Vernale',
      description: 'Vernal keratoconjunctivitis treatment',
      descriptionFr: 'Traitement de la kératoconjonctivite vernale',
      indication: 'Vernal keratoconjunctivitis, severe atopic keratoconjunctivitis',
      tags: ['allergie', 'vernale', 'atopique', 'sévère'],
      expectedDuration: { value: 3, unit: 'weeks' },
      medications: [
        {
          drugName: 'MAXIDEX collyre 0,1%',
          genericName: 'Dexaméthasone',
          drugClass: 'Corticoïde ophtalmique',
          dosage: { eye: 'OU', frequency: '4x/jour', frequencyCode: 'QID', duration: { value: 7, unit: 'days' } },
          instructions: 'Short course, monitor IOP, switch to mast cell stabilizer',
          instructionsFr: 'Traitement court, surveillance PIO, relais par antidégranulant',
          order: 1,
          waitTimeAfter: 5
        },
        {
          drugName: 'ZADITEN collyre',
          genericName: 'Kétotifène',
          drugClass: 'Antihistaminique + antidégranulant',
          dosage: { eye: 'OU', frequency: '2x/jour', frequencyCode: 'BID', duration: { value: 21, unit: 'days' } },
          instructions: 'Maintenance therapy after steroid taper',
          instructionsFr: 'Traitement de relais après les corticoïdes',
          order: 2
        }
      ]
    }
  ],

  // INFLAMMATION PROTOCOLS
  'uveite': [
    {
      name: 'Uvéite Antérieure Aiguë',
      nameFr: 'Uvéite Antérieure Aiguë',
      description: 'Acute anterior uveitis treatment',
      descriptionFr: 'Traitement de l\'uvéite antérieure aiguë non infectieuse',
      indication: 'Non-infectious anterior uveitis',
      tags: ['uvéite', 'inflammation', 'iritis'],
      expectedDuration: { value: 6, unit: 'weeks' },
      medications: [
        {
          drugName: 'MAXIDEX collyre 0,1%',
          genericName: 'Dexaméthasone',
          drugClass: 'Corticoïde ophtalmique',
          dosage: { eye: 'OU', frequency: 'Toutes les heures au début', frequencyCode: 'Q1H', duration: { value: 6, unit: 'weeks' } },
          instructions: 'Intensive initial dosing, very slow taper over 6 weeks',
          instructionsFr: 'Dosage intensif initial, décroissance très progressive sur 6 semaines',
          taper: {
            enabled: true,
            schedule: [
              { week: 1, frequency: 'Toutes les heures', frequencyCode: 'Q1H' },
              { week: 2, frequency: '6x/jour', frequencyCode: 'Q4H' },
              { week: 3, frequency: '4x/jour', frequencyCode: 'QID' },
              { week: 4, frequency: '3x/jour', frequencyCode: 'TID' },
              { week: 5, frequency: '2x/jour', frequencyCode: 'BID' },
              { week: 6, frequency: '1x/jour', frequencyCode: 'QD' }
            ]
          },
          order: 1,
          waitTimeAfter: 5
        },
        {
          drugName: 'ATROPINE 1% collyre',
          genericName: 'Atropine',
          drugClass: 'Cycloplégique',
          dosage: { eye: 'OU', frequency: '3x/jour', frequencyCode: 'TID', duration: { value: 14, unit: 'days' } },
          instructions: 'To prevent synechiae formation',
          instructionsFr: 'Prévention des synéchies',
          order: 2
        }
      ]
    }
  ],

  // DRY EYE PROTOCOLS
  'secheresse_oculaire': [
    {
      name: 'Sécheresse Oculaire Légère',
      nameFr: 'Sécheresse Oculaire Légère',
      description: 'Mild dry eye disease treatment',
      descriptionFr: 'Traitement de la sécheresse oculaire légère',
      indication: 'Mild dry eye symptoms, occasional discomfort',
      tags: ['sécheresse', 'larmes artificielles', 'légère'],
      expectedDuration: { value: 3, unit: 'months' },
      medications: [
        {
          drugName: 'SYSTANE ULTRA collyre',
          genericName: 'Polyéthylène glycol/Propylène glycol',
          drugClass: 'Larmes artificielles',
          dosage: { eye: 'OU', frequency: '4x/jour ou selon besoin', frequencyCode: 'QID', duration: { value: 3, unit: 'months' } },
          instructions: 'Use as needed, minimum 4 times daily',
          instructionsFr: 'Selon les besoins, minimum 4 fois par jour',
          order: 1
        }
      ]
    },
    {
      name: 'Sécheresse Oculaire Modérée à Sévère',
      nameFr: 'Sécheresse Oculaire Modérée à Sévère',
      description: 'Moderate to severe dry eye disease treatment',
      descriptionFr: 'Traitement de la sécheresse oculaire modérée à sévère',
      indication: 'Moderate to severe dry eye, Sjogren syndrome',
      tags: ['sécheresse', 'sévère', 'sjögren'],
      expectedDuration: { value: 3, unit: 'months' },
      medications: [
        {
          drugName: 'HYABAK collyre 0,15%',
          genericName: 'Acide hyaluronique',
          drugClass: 'Larmes artificielles sans conservateur',
          dosage: { eye: 'OU', frequency: '6-8x/jour', frequencyCode: 'Q2H', duration: { value: 3, unit: 'months' } },
          instructions: 'Preservative-free, can use more frequently',
          instructionsFr: 'Sans conservateur, peut être utilisé plus fréquemment',
          order: 1,
          waitTimeAfter: 5
        },
        {
          drugName: 'LACRINORM gel ophtalmique',
          genericName: 'Carbomère',
          drugClass: 'Gel lubrifiant',
          dosage: { eye: 'OU', frequency: 'Au coucher', frequencyCode: 'QHS', duration: { value: 3, unit: 'months' } },
          instructions: 'Use at bedtime for overnight protection',
          instructionsFr: 'Utiliser au coucher pour protection nocturne',
          order: 2
        }
      ]
    },
    {
      name: 'Blépharite et Dysfonction Meibomienne',
      nameFr: 'Blépharite et Dysfonction Meibomienne',
      description: 'Meibomian gland dysfunction and blepharitis treatment',
      descriptionFr: 'Traitement de la blépharite et dysfonction meibomienne',
      indication: 'Meibomian gland dysfunction, chronic blepharitis',
      tags: ['blépharite', 'meibomius', 'chalazion'],
      expectedDuration: { value: 2, unit: 'months' },
      medications: [
        {
          drugName: 'AZYTER unidoses',
          genericName: 'Azithromycine',
          drugClass: 'Macrolide ophtalmique',
          dosage: { eye: 'OU', frequency: '2x/jour pendant 3 jours', frequencyCode: 'BID', duration: { value: 3, unit: 'days' } },
          instructions: 'Apply to lid margin',
          instructionsFr: 'Appliquer sur le bord libre des paupières',
          order: 1
        }
      ]
    }
  ],

  // IVT PROTOCOLS
  'injection': [
    {
      name: 'Pré-IVT Standard',
      nameFr: 'Pré-IVT Standard',
      description: 'Pre-intravitreal injection preparation protocol',
      descriptionFr: 'Protocole de préparation avant injection intravitréenne',
      indication: 'Before any intravitreal injection',
      tags: ['IVT', 'pré-op', 'anti-VEGF'],
      expectedDuration: { value: 3, unit: 'days' },
      medications: [
        {
          drugName: 'CILOXAN collyre 0,3%',
          genericName: 'Ciprofloxacine',
          drugClass: 'Fluoroquinolone ophtalmique',
          dosage: { eye: 'OU', frequency: '4x/jour', frequencyCode: 'QID', duration: { value: 3, unit: 'days' } },
          instructions: 'Start 3 days before injection',
          instructionsFr: 'Commencer 3 jours avant l\'injection',
          order: 1
        }
      ]
    },
    {
      name: 'Post-IVT Standard',
      nameFr: 'Post-IVT Standard',
      description: 'Post-intravitreal injection protocol',
      descriptionFr: 'Protocole post-injection intravitréenne',
      indication: 'After intravitreal injection',
      tags: ['IVT', 'post-op', 'anti-VEGF'],
      expectedDuration: { value: 5, unit: 'days' },
      medications: [
        {
          drugName: 'CILOXAN collyre 0,3%',
          genericName: 'Ciprofloxacine',
          drugClass: 'Fluoroquinolone ophtalmique',
          dosage: { eye: 'OU', frequency: '4x/jour', frequencyCode: 'QID', duration: { value: 5, unit: 'days' } },
          instructions: 'Continue for 5 days post-injection',
          instructionsFr: 'Continuer 5 jours après l\'injection',
          order: 1
        }
      ]
    }
  ],

  // PROPHYLAXIS
  'prophylaxie': [
    {
      name: 'Prophylaxie Pré-opératoire',
      nameFr: 'Prophylaxie Pré-opératoire',
      description: 'Standard pre-operative antibiotic prophylaxis',
      descriptionFr: 'Antibioprophylaxie standard pré-opératoire',
      indication: 'Before any scheduled eye surgery',
      tags: ['prophylaxie', 'pré-op', 'chirurgie'],
      expectedDuration: { value: 3, unit: 'days' },
      medications: [
        {
          drugName: 'CILOXAN collyre 0,3%',
          genericName: 'Ciprofloxacine',
          drugClass: 'Fluoroquinolone ophtalmique',
          dosage: { eye: 'OU', frequency: '4x/jour', frequencyCode: 'QID', duration: { value: 3, unit: 'days' } },
          instructions: 'Start 3 days before surgery',
          instructionsFr: 'Commencer 3 jours avant la chirurgie',
          order: 1
        }
      ]
    }
  ],

  // OTHER
  'autre': [
    {
      name: 'Dilatation pour Fond d\'Oeil',
      nameFr: 'Dilatation pour Fond d\'Oeil',
      description: 'Pupil dilation protocol for fundus examination',
      descriptionFr: 'Protocole de dilatation pour examen du fond d\'oeil',
      indication: 'Fundus examination, retinal imaging',
      tags: ['mydriase', 'examen', 'fond d\'oeil', 'rétinographie'],
      expectedDuration: { value: 1, unit: 'days' },
      medications: [
        {
          drugName: 'TROPICAMIDE 0,5% collyre',
          genericName: 'Tropicamide',
          drugClass: 'Mydriatique',
          dosage: { eye: 'OU', frequency: 'Une fois', frequencyCode: 'STAT' },
          instructions: 'Repeat after 5 minutes if needed',
          instructionsFr: 'Répéter après 5 minutes si nécessaire',
          order: 1,
          waitTimeAfter: 5
        },
        {
          drugName: 'NEOSYNEPHRINE 10% collyre',
          genericName: 'Phényléphrine',
          drugClass: 'Sympathomimétique',
          dosage: { eye: 'OU', frequency: 'Une fois', frequencyCode: 'STAT' },
          instructions: '5 minutes after tropicamide',
          instructionsFr: '5 minutes après le tropicamide',
          order: 2
        }
      ]
    },
    {
      name: 'Cycloplégie pour Réfraction Enfant',
      nameFr: 'Cycloplégie pour Réfraction Enfant',
      description: 'Cycloplegic refraction protocol for children',
      descriptionFr: 'Protocole de cycloplégie pour réfraction pédiatrique',
      indication: 'Cycloplegic refraction in pediatric patients',
      tags: ['cycloplégie', 'réfraction', 'pédiatrie', 'enfant'],
      expectedDuration: { value: 1, unit: 'days' },
      medications: [
        {
          drugName: 'CYCLOPENTOLATE 1% collyre',
          genericName: 'Cyclopentolate',
          drugClass: 'Cycloplégique',
          dosage: { eye: 'OU', frequency: '1 goutte x2 à 5 min d\'intervalle', frequencyCode: 'STAT' },
          instructions: '2 drops 5 minutes apart, wait 45-60 minutes',
          instructionsFr: '2 gouttes à 5 min d\'intervalle, attendre 45-60 minutes',
          order: 1
        }
      ]
    }
  ]
};

// Helper to get icon based on category
function getCategoryIcon(category) {
  const icons = {
    'post_operatoire': '🔪',
    'glaucome': '👁️',
    'infection': '🦠',
    'allergie': '🌸',
    'uveite': '🔥',
    'secheresse_oculaire': '💧',
    'injection': '💉',
    'prophylaxie': '🛡️',
    'autre': '💊'
  };
  return icons[category] || '💊';
}

// Helper to get color based on category
function getCategoryColor(category) {
  const colors = {
    'post_operatoire': '#10B981',
    'glaucome': '#8B5CF6',
    'infection': '#EF4444',
    'allergie': '#EC4899',
    'uveite': '#F97316',
    'secheresse_oculaire': '#3B82F6',
    'injection': '#DC2626',
    'prophylaxie': '#059669',
    'autre': '#6B7280'
  };
  return colors[category] || '#6B7280';
}

async function seedTreatmentProtocols() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find admin user for createdBy
    let systemUser = await User.findOne({ role: 'admin' });
    if (!systemUser) {
      systemUser = await User.findOne({});
    }
    if (!systemUser) {
      console.error('ERROR: No users found. Please create users first.');
      process.exit(1);
    }
    console.log(`Using user: ${systemUser.firstName} ${systemUser.lastName}`);

    // Clear existing system-wide protocols
    console.log('Clearing existing system-wide treatment protocols...');
    await TreatmentProtocol.deleteMany({ isSystemWide: true, type: 'standard' });

    let created = 0;
    let displayOrder = 0;

    console.log('\nCreating treatment protocols...\n');

    for (const [category, protocols] of Object.entries(treatmentProtocols)) {
      console.log(`\n=== ${category.toUpperCase()} ===`);

      for (const protocolDef of protocols) {
        displayOrder++;

        const protocol = {
          name: protocolDef.name,
          nameFr: protocolDef.nameFr || protocolDef.name,
          description: protocolDef.description,
          descriptionFr: protocolDef.descriptionFr || protocolDef.description,
          category: category,
          type: 'standard',
          visibility: 'system',
          isSystemWide: true,
          isActive: true,
          tags: protocolDef.tags || [],
          indication: protocolDef.indication,
          contraindications: protocolDef.contraindications || [],
          expectedDuration: protocolDef.expectedDuration,
          medications: protocolDef.medications.map((med, idx) => ({
            drugName: med.drugName,
            genericName: med.genericName,
            drugClass: med.drugClass,
            dosage: med.dosage || {},
            taper: med.taper || { enabled: false, schedule: [] },
            instructions: med.instructions,
            instructionsFr: med.instructionsFr || med.instructions,
            order: med.order || idx + 1,
            waitTimeAfter: med.waitTimeAfter || 5,
            isOptional: med.isOptional || false
          })),
          createdBy: systemUser._id,
          displayOrder: displayOrder,
          icon: getCategoryIcon(category),
          color: getCategoryColor(category)
        };

        await TreatmentProtocol.create(protocol);
        created++;
        console.log(`  ✓ ${protocolDef.name} (${protocolDef.medications.length} medications)`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('SUMMARY');
    console.log('='.repeat(50));
    console.log(`Protocols created: ${created}`);

    // Summary by category
    const summary = await TreatmentProtocol.aggregate([
      { $match: { isSystemWide: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('\nBy category:');
    summary.forEach(s => console.log(`  ${s._id}: ${s.count}`));

    const total = await TreatmentProtocol.countDocuments();
    console.log(`\nTotal protocols in database: ${total}`);

  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

seedTreatmentProtocols();
