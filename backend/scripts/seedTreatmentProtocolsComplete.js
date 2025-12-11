const mongoose = require('mongoose');
require('dotenv').config();
const TreatmentProtocol = require('../models/TreatmentProtocol');
const Drug = require('../models/Drug');
const User = require('../models/User');

// Protocol definitions with medication references by brand name
const protocolDefinitions = [
  // POST-CATARACT SURGERY PROTOCOLS
  {
    name: 'Post-Cataracte Standard',
    description: 'Protocole standard post-opératoire de chirurgie de la cataracte',
    category: 'post_operatoire',
    type: 'standard',
    isSystemWide: true,
    tags: ['cataracte', 'post-op', 'standard'],
    indication: 'Après chirurgie de la cataracte sans complication',
    expectedDuration: { value: 1, unit: 'months' },
    medicationSearches: [
      {
        searchTerm: 'TOBRADEX',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '4x_jour', label: '4x/jour', text: 'quatre fois par jour' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: '1_mois', label: '1 mois', text: 'pendant 1 mois en décroissance' },
        instructions: 'Semaine 1: 4x/jour, Semaine 2: 3x/jour, Semaine 3: 2x/jour, Semaine 4: 1x/jour',
        order: 1
      },
      {
        searchTerm: 'INDOCOLLYRE',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '3x_jour', label: '3x/jour', text: 'trois fois par jour' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: '1_mois', label: '1 mois', text: 'pendant 1 mois' },
        instructions: 'Espacer de 5 minutes avec les autres collyres',
        order: 2
      }
    ]
  },

  {
    name: 'Post-Cataracte Renforcé',
    description: 'Protocole renforcé pour patients à risque inflammatoire',
    category: 'post_operatoire',
    type: 'standard',
    isSystemWide: true,
    tags: ['cataracte', 'post-op', 'renforcé', 'inflammation'],
    indication: 'Cataracte compliquée, patients diabétiques, uvéite préexistante',
    expectedDuration: { value: 6, unit: 'weeks' },
    medicationSearches: [
      {
        searchTerm: 'MAXIDEX',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '6x_jour', label: '6x/jour', text: 'six fois par jour' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: '21_jours', label: '3 semaines', text: 'pendant 3 semaines en décroissance' },
        instructions: 'Décroissance progressive sur 3 semaines',
        order: 1
      },
      {
        searchTerm: 'CILOXAN',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '4x_jour', label: '4x/jour', text: 'quatre fois par jour' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: '10_jours', label: '10 jours', text: 'pendant 10 jours' },
        instructions: '',
        order: 2
      },
      {
        searchTerm: 'INDOCOLLYRE',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '3x_jour', label: '3x/jour', text: 'trois fois par jour' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: '1_mois', label: '1 mois', text: 'pendant 1 mois' },
        instructions: '',
        order: 3
      }
    ]
  },

  // GLAUCOMA PROTOCOLS
  {
    name: 'Glaucome - Monothérapie Bêta-bloquant',
    description: 'Traitement initial du glaucome par bêta-bloquant',
    category: 'glaucome',
    type: 'standard',
    isSystemWide: true,
    tags: ['glaucome', 'première ligne', 'bêta-bloquant'],
    indication: 'Glaucome à angle ouvert, hypertonie oculaire',
    expectedDuration: { value: 3, unit: 'months' },
    medicationSearches: [
      {
        searchTerm: 'TIMOLOL',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '2x_jour', label: '2x/jour', text: 'deux fois par jour' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: 'long_cours', label: 'Au long cours', text: 'traitement au long cours' },
        instructions: 'Compression du point lacrymal 1 minute après instillation',
        order: 1
      }
    ]
  },

  {
    name: 'Glaucome - Monothérapie Prostaglandine',
    description: 'Traitement initial du glaucome par analogue des prostaglandines',
    category: 'glaucome',
    type: 'standard',
    isSystemWide: true,
    tags: ['glaucome', 'première ligne', 'prostaglandine'],
    indication: 'Glaucome à angle ouvert, meilleure efficacité nocturne',
    expectedDuration: { value: 3, unit: 'months' },
    medicationSearches: [
      {
        searchTerm: 'XALATAN',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: 'soir', label: 'Le soir', text: 'le soir au coucher' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: 'long_cours', label: 'Au long cours', text: 'traitement au long cours' },
        instructions: 'Une seule goutte le soir, pas de bénéfice à augmenter la dose',
        order: 1
      }
    ]
  },

  {
    name: 'Glaucome - Bithérapie Fixe',
    description: 'Association fixe pour glaucome non contrôlé',
    category: 'glaucome',
    type: 'standard',
    isSystemWide: true,
    tags: ['glaucome', 'bithérapie', 'association'],
    indication: 'Glaucome non contrôlé par monothérapie',
    expectedDuration: { value: 3, unit: 'months' },
    medicationSearches: [
      {
        searchTerm: 'COSOPT',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '2x_jour', label: '2x/jour', text: 'deux fois par jour' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: 'long_cours', label: 'Au long cours', text: 'traitement au long cours' },
        instructions: 'Matin et soir',
        order: 1
      }
    ]
  },

  // ALLERGY PROTOCOLS
  {
    name: 'Conjonctivite Allergique Aiguë',
    description: 'Traitement de la conjonctivite allergique aiguë',
    category: 'allergie',
    type: 'standard',
    isSystemWide: true,
    tags: ['allergie', 'conjonctivite', 'aigu'],
    indication: 'Conjonctivite allergique saisonnière ou perannuelle',
    expectedDuration: { value: 2, unit: 'weeks' },
    medicationSearches: [
      {
        searchTerm: 'OPATANOL',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '2x_jour', label: '2x/jour', text: 'deux fois par jour' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: '14_jours', label: '14 jours', text: 'pendant 14 jours' },
        instructions: 'Peut être prolongé si nécessaire',
        order: 1
      }
    ]
  },

  {
    name: 'Conjonctivite Allergique Sévère',
    description: 'Traitement renforcé des conjonctivites allergiques sévères',
    category: 'allergie',
    type: 'standard',
    isSystemWide: true,
    tags: ['allergie', 'conjonctivite', 'sévère'],
    indication: 'Kératoconjonctivite vernale, conjonctivite atopique',
    expectedDuration: { value: 3, unit: 'weeks' },
    medicationSearches: [
      {
        searchTerm: 'MAXIDEX',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '4x_jour', label: '4x/jour', text: 'quatre fois par jour' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: '7_jours', label: '7 jours', text: 'pendant 7 jours puis décroissance' },
        instructions: 'Traitement court, surveillance PIO',
        order: 1
      },
      {
        searchTerm: 'ZADITEN',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '2x_jour', label: '2x/jour', text: 'deux fois par jour' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: '21_jours', label: '3 semaines', text: 'pendant 3 semaines' },
        instructions: 'Prendre le relais après les corticoïdes',
        order: 2
      }
    ]
  },

  // INFECTION PROTOCOLS
  {
    name: 'Conjonctivite Bactérienne',
    description: 'Traitement antibiotique des conjonctivites bactériennes',
    category: 'infection',
    type: 'standard',
    isSystemWide: true,
    tags: ['infection', 'conjonctivite', 'bactérienne'],
    indication: 'Conjonctivite bactérienne aiguë',
    expectedDuration: { value: 1, unit: 'weeks' },
    medicationSearches: [
      {
        searchTerm: 'TOBREX',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '4x_jour', label: '4x/jour', text: 'quatre fois par jour' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: '7_jours', label: '7 jours', text: 'pendant 7 jours' },
        instructions: 'Poursuivre 48h après disparition des symptômes',
        order: 1
      }
    ]
  },

  {
    name: 'Kératite Bactérienne',
    description: 'Traitement intensif des kératites bactériennes',
    category: 'infection',
    type: 'standard',
    isSystemWide: true,
    tags: ['infection', 'kératite', 'bactérienne', 'urgence'],
    indication: 'Kératite bactérienne, abcès cornéen',
    expectedDuration: { value: 2, unit: 'weeks' },
    medicationSearches: [
      {
        searchTerm: 'CILOXAN',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: 'toutes_heures', label: 'Toutes les heures', text: 'toutes les heures J1-J2' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: '14_jours', label: '14 jours', text: 'pendant 14 jours' },
        instructions: 'J1-J2: toutes les heures, puis diminuer progressivement',
        order: 1
      },
      {
        searchTerm: 'ATROPINE',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '2x_jour', label: '2x/jour', text: 'deux fois par jour' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: '7_jours', label: '7 jours', text: 'pendant 7 jours' },
        instructions: 'Pour effet cycloplégique et anti-inflammatoire',
        order: 2
      }
    ]
  },

  {
    name: 'Kératite Herpétique',
    description: 'Traitement antiviral des kératites herpétiques',
    category: 'infection',
    type: 'standard',
    isSystemWide: true,
    tags: ['infection', 'kératite', 'herpès', 'antiviral'],
    indication: 'Kératite herpétique épithéliale ou stromale',
    expectedDuration: { value: 3, unit: 'weeks' },
    medicationSearches: [
      {
        searchTerm: 'ZOVIRAX',
        dose: { value: '1_application', label: '1 application', text: 'un ruban de 1 cm' },
        posologie: { value: '5x_jour', label: '5x/jour', text: 'cinq fois par jour' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: '21_jours', label: '3 semaines', text: 'pendant 3 semaines' },
        instructions: 'Poursuivre 3 jours après cicatrisation',
        order: 1
      },
      {
        searchTerm: 'ZELITREX',
        dose: { value: '1_cp', label: '1 cp', text: 'un comprimé de 500mg' },
        posologie: { value: '2x_jour', label: '2x/jour', text: 'deux fois par jour' },
        details: [],
        duration: { value: '10_jours', label: '10 jours', text: 'pendant 10 jours' },
        instructions: 'Traitement oral associé',
        order: 2
      }
    ]
  },

  // DRY EYE PROTOCOLS
  {
    name: 'Sécheresse Oculaire Légère',
    description: 'Traitement de la sécheresse oculaire légère',
    category: 'secheresse_oculaire',
    type: 'standard',
    isSystemWide: true,
    tags: ['sécheresse', 'larmes', 'légère'],
    indication: 'Syndrome sec débutant, inconfort oculaire',
    expectedDuration: { value: 1, unit: 'months' },
    medicationSearches: [
      {
        searchTerm: 'REFRESH',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '4x_jour', label: '4x/jour', text: 'quatre fois par jour' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: 'long_cours', label: 'Au long cours', text: 'traitement au long cours' },
        instructions: 'À adapter selon les symptômes',
        order: 1
      }
    ]
  },

  {
    name: 'Sécheresse Oculaire Modérée à Sévère',
    description: 'Traitement renforcé de la sécheresse oculaire',
    category: 'secheresse_oculaire',
    type: 'standard',
    isSystemWide: true,
    tags: ['sécheresse', 'larmes', 'sévère'],
    indication: 'Syndrome sec modéré à sévère, Sjögren',
    expectedDuration: { value: 3, unit: 'months' },
    medicationSearches: [
      {
        searchTerm: 'HYLOFORTE',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '6x_jour', label: '6x/jour', text: 'six fois par jour' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: 'long_cours', label: 'Au long cours', text: 'traitement au long cours' },
        instructions: 'Sans conservateur',
        order: 1
      }
    ]
  },

  // INFLAMMATION PROTOCOLS
  {
    name: 'Uvéite Antérieure Aiguë',
    description: 'Traitement de l\'uvéite antérieure aiguë',
    category: 'uveite',
    type: 'standard',
    isSystemWide: true,
    tags: ['uvéite', 'inflammation', 'aigu'],
    indication: 'Uvéite antérieure non infectieuse',
    expectedDuration: { value: 6, unit: 'weeks' },
    medicationSearches: [
      {
        searchTerm: 'MAXIDEX',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: 'toutes_heures', label: 'Toutes les heures', text: 'toutes les heures au début' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: '21_jours', label: '3 semaines', text: 'pendant 3-6 semaines en décroissance' },
        instructions: 'Décroissance très progressive sur 6 semaines',
        order: 1
      },
      {
        searchTerm: 'ATROPINE',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '3x_jour', label: '3x/jour', text: 'trois fois par jour' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: '14_jours', label: '14 jours', text: 'pendant 14 jours' },
        instructions: 'Prévention des synéchies',
        order: 2
      }
    ]
  },

  // PROPHYLAXIS
  {
    name: 'Prophylaxie Pré-opératoire',
    description: 'Préparation standard avant chirurgie oculaire',
    category: 'prophylaxie',
    type: 'standard',
    isSystemWide: true,
    tags: ['prophylaxie', 'pré-op', 'antibiotique'],
    indication: 'Avant toute chirurgie oculaire programmée',
    expectedDuration: { value: 3, unit: 'days' },
    medicationSearches: [
      {
        searchTerm: 'CILOXAN',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '4x_jour', label: '4x/jour', text: 'quatre fois par jour' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: '3_jours', label: '3 jours', text: 'pendant 3 jours avant intervention' },
        instructions: 'Commencer 3 jours avant la chirurgie',
        order: 1
      }
    ]
  },

  // MYDRIATICS FOR EXAM
  {
    name: 'Dilatation pour Fond d\'Oeil',
    description: 'Protocole de dilatation pupillaire standard',
    category: 'autre',
    type: 'standard',
    isSystemWide: true,
    tags: ['mydriase', 'fond d\'oeil', 'examen'],
    indication: 'Examen du fond d\'oeil, rétinographie',
    expectedDuration: { value: 1, unit: 'days' },
    medicationSearches: [
      {
        searchTerm: 'TROPICAMIDE',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '1x_jour', label: '1x', text: 'une fois' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: '1_injection', label: 'Unique', text: 'application unique' },
        instructions: 'Répéter après 5 minutes si nécessaire',
        order: 1
      },
      {
        searchTerm: 'NEOSYNEPHRINE',
        dose: { value: '1_goutte', label: '1 goutte', text: '1 goutte' },
        posologie: { value: '1x_jour', label: '1x', text: 'une fois' },
        details: [{ value: 'odg', label: 'ODG', text: 'dans les deux yeux' }],
        duration: { value: '1_injection', label: 'Unique', text: 'application unique' },
        instructions: '5 minutes après le tropicamide',
        order: 2
      }
    ]
  }
];

async function findDrugBySearchTerm(searchTerm) {
  // Try multiple search strategies - use 'name' field which is the actual field in the Drug model
  let drug = await Drug.findOne({
    $or: [
      { name: new RegExp(searchTerm, 'i') },
      { genericName: new RegExp(searchTerm, 'i') },
      { 'brandNames.name': new RegExp(searchTerm, 'i') }
    ],
    isActive: { $ne: false }
  });

  if (!drug) {
    // Try partial match (first 4 characters)
    drug = await Drug.findOne({
      $or: [
        { name: { $regex: searchTerm.substring(0, 4), $options: 'i' } },
        { genericName: { $regex: searchTerm.substring(0, 4), $options: 'i' } }
      ],
      isActive: { $ne: false }
    });
  }

  return drug;
}

async function seedTreatmentProtocols() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('Connected to MongoDB');

    // Find or create a system user for createdBy
    let systemUser = await User.findOne({ role: 'admin' });
    if (!systemUser) {
      console.log('No admin user found, looking for any user...');
      systemUser = await User.findOne({});
    }

    if (!systemUser) {
      console.error('ERROR: No users found in database. Please create a user first.');
      process.exit(1);
    }

    console.log(`Using user: ${systemUser.firstName} ${systemUser.lastName} (${systemUser.email})`);

    // Clear existing system-wide protocols
    console.log('Clearing existing system-wide treatment protocols...');
    await TreatmentProtocol.deleteMany({ isSystemWide: true, type: 'standard' });

    // Create protocols
    console.log('\nCreating treatment protocols...\n');
    let created = 0;
    let skipped = 0;

    for (const protocolDef of protocolDefinitions) {
      const medications = [];
      let hasAllMedications = true;

      // Find medications for this protocol
      for (const medSearch of protocolDef.medicationSearches) {
        const drug = await findDrugBySearchTerm(medSearch.searchTerm);

        if (drug) {
          medications.push({
            medicationTemplate: drug._id,
            dose: medSearch.dose,
            posologie: medSearch.posologie,
            details: medSearch.details,
            duration: medSearch.duration,
            instructions: medSearch.instructions,
            order: medSearch.order
          });
        } else {
          console.log(`  ⚠ Drug not found: ${medSearch.searchTerm} (for ${protocolDef.name})`);
          hasAllMedications = false;
        }
      }

      // Only create protocol if we have at least one medication
      if (medications.length > 0) {
        const protocol = {
          name: protocolDef.name,
          description: protocolDef.description,
          category: protocolDef.category,
          type: protocolDef.type,
          isSystemWide: protocolDef.isSystemWide,
          tags: protocolDef.tags,
          indication: protocolDef.indication,
          expectedDuration: protocolDef.expectedDuration,
          medications: medications,
          createdBy: systemUser._id,
          isActive: true
        };

        await TreatmentProtocol.create(protocol);
        created++;

        const status = hasAllMedications ? '✓' : '⚠';
        console.log(`${status} ${protocolDef.name} (${medications.length}/${protocolDef.medicationSearches.length} medications)`);
      } else {
        skipped++;
        console.log(`✗ Skipped: ${protocolDef.name} (no medications found)`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('SUMMARY');
    console.log('='.repeat(50));
    console.log(`Protocols created: ${created}`);
    console.log(`Protocols skipped: ${skipped}`);

    // Verify
    const count = await TreatmentProtocol.countDocuments();
    console.log(`Total treatment protocols in database: ${count}`);

    // Show by category
    const byCategory = await TreatmentProtocol.aggregate([
      { $match: { isSystemWide: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\nBy category:');
    byCategory.forEach(c => console.log(`  ${c._id}: ${c.count}`));

  } catch (error) {
    console.error('Error seeding treatment protocols:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

if (require.main === module) {
  seedTreatmentProtocols().then(() => process.exit(0));
}

module.exports = seedTreatmentProtocols;
