const mongoose = require('mongoose');
require('dotenv').config();

const TreatmentProtocol = require('../models/TreatmentProtocol');
const Drug = require('../models/Drug');

/**
 * Seed standard treatment protocols
 * Common ophthalmic treatment combinations
 */

async function seedTreatmentProtocols() {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Find common medications by name
    const medications = {
      timolol: await Drug.findOne({ name: /timolol/i }),
      latanoprost: await Drug.findOne({ name: /latanoprost/i }),
      dorzolamide: await Drug.findOne({ name: /dorzolamide/i }),
      tobramycine: await Drug.findOne({ name: /tobramycine/i }),
      dexamethasone: await Drug.findOne({ name: /dexamethasone/i }),
      fluorometholone: await Drug.findOne({ name: /fluorométholone/i }),
      hyaluronate: await Drug.findOne({ name: /hyaluronate/i }),
      atropine: await Drug.findOne({ name: /atropine/i })
    };

    console.log('📦 Medications found:', Object.keys(medications).filter(k => medications[k]).length);

    // Delete existing treatment protocols
    await TreatmentProtocol.deleteMany({});
    console.log('🗑️  Cleared existing treatment protocols');

    const protocols = [];

    // ============================================
    // GLAUCOME PROTOCOLS
    // ============================================

    if (medications.timolol) {
      protocols.push({
        name: 'Monothérapie Glaucome - Bêtabloquant',
        category: 'glaucome',
        description: 'Traitement initial du glaucome par bêtabloquant',
        type: 'standard',
        isSystemWide: true,
        medications: [
          {
            medicationTemplate: medications.timolol._id,
            dose: { value: '1_goutte', label: '1 goutte', text: 'Instiller 1 goutte' },
            posologie: { value: 'matin_soir', label: 'Matin et soir', text: 'matin et soir' },
            details: [
              { value: 'chaque_oeil', label: 'Dans chaque œil', text: 'dans chaque œil' }
            ],
            duration: { value: 'au_long_cours', label: 'Au long cours', text: 'au long cours' },
            quantity: 1,
            order: 1
          }
        ],
        tags: ['glaucome', 'monotherapie', 'betabloquant']
      });
    }

    if (medications.latanoprost) {
      protocols.push({
        name: 'Monothérapie Glaucome - Prostaglandine',
        category: 'glaucome',
        description: 'Traitement initial du glaucome par prostaglandine',
        type: 'standard',
        isSystemWide: true,
        medications: [
          {
            medicationTemplate: medications.latanoprost._id,
            dose: { value: '1_goutte', label: '1 goutte', text: 'Instiller 1 goutte' },
            posologie: { value: 'le_soir', label: 'Le soir', text: 'le soir au coucher' },
            details: [
              { value: 'chaque_oeil', label: 'Dans chaque œil', text: 'dans chaque œil' }
            ],
            duration: { value: 'au_long_cours', label: 'Au long cours', text: 'au long cours' },
            quantity: 1,
            order: 1
          }
        ],
        tags: ['glaucome', 'monotherapie', 'prostaglandine']
      });
    }

    if (medications.latanoprost && medications.timolol) {
      protocols.push({
        name: 'Bithérapie Glaucome - Prostaglandine + Bêtabloquant',
        category: 'glaucome',
        description: 'Association fixe pour glaucome insuffisamment contrôlé',
        type: 'standard',
        isSystemWide: true,
        medications: [
          {
            medicationTemplate: medications.latanoprost._id,
            dose: { value: '1_goutte', label: '1 goutte', text: 'Instiller 1 goutte' },
            posologie: { value: 'le_soir', label: 'Le soir', text: 'le soir au coucher' },
            details: [
              { value: 'chaque_oeil', label: 'Dans chaque œil', text: 'dans chaque œil' }
            ],
            duration: { value: 'au_long_cours', label: 'Au long cours', text: 'au long cours' },
            quantity: 1,
            order: 1
          },
          {
            medicationTemplate: medications.timolol._id,
            dose: { value: '1_goutte', label: '1 goutte', text: 'Instiller 1 goutte' },
            posologie: { value: 'le_matin', label: 'Le matin', text: 'le matin' },
            details: [
              { value: 'chaque_oeil', label: 'Dans chaque œil', text: 'dans chaque œil' },
              { value: 'intervalle_5min', label: 'Intervalle de 5 minutes', text: 'en respectant un intervalle de 5 minutes si autre collyre' }
            ],
            duration: { value: 'au_long_cours', label: 'Au long cours', text: 'au long cours' },
            quantity: 1,
            order: 2
          }
        ],
        tags: ['glaucome', 'bitherapie', 'association']
      });
    }

    // ============================================
    // POST-OPERATIVE CATARACT PROTOCOLS
    // ============================================

    if (medications.tobramycine && medications.dexamethasone) {
      protocols.push({
        name: 'Post-Opératoire Cataracte - Standard',
        category: 'cataracte',
        description: 'Protocole standard après chirurgie de la cataracte',
        type: 'standard',
        isSystemWide: true,
        medications: [
          {
            medicationTemplate: medications.tobramycine._id,
            dose: { value: '1_goutte', label: '1 goutte', text: 'Instiller 1 goutte' },
            posologie: { value: '4_fois_jour', label: '4 fois par jour', text: '4 fois par jour' },
            details: [
              { value: 'oeil_opere', label: 'Œil opéré', text: 'dans l\'œil opéré' },
              { value: 'apres_toilette', label: 'Après toilette', text: 'après toilette oculaire' }
            ],
            duration: { value: '15_jours', label: '15 jours', text: 'pendant 15 jours' },
            quantity: 1,
            order: 1
          },
          {
            medicationTemplate: medications.dexamethasone._id,
            dose: { value: '1_goutte', label: '1 goutte', text: 'Instiller 1 goutte' },
            posologie: { value: '4_fois_jour', label: '4 fois par jour', text: '4 fois par jour' },
            details: [
              { value: 'oeil_opere', label: 'Œil opéré', text: 'dans l\'œil opéré' },
              { value: 'intervalle_5min', label: 'Intervalle de 5 minutes', text: 'en respectant un intervalle de 5 minutes après l\'antibiotique' }
            ],
            duration: { value: '1_mois', label: '1 mois', text: 'pendant 1 mois avec diminution progressive' },
            quantity: 1,
            order: 2
          }
        ],
        tags: ['cataracte', 'postoperatoire', 'standard']
      });
    }

    if (medications.dexamethasone && medications.fluorometholone) {
      protocols.push({
        name: 'Post-Opératoire Cataracte - Dégression Corticoïde',
        category: 'cataracte',
        description: 'Protocole de dégression progressive des corticoïdes',
        type: 'standard',
        isSystemWide: true,
        medications: [
          {
            medicationTemplate: medications.dexamethasone._id,
            dose: { value: '1_goutte', label: '1 goutte', text: 'Instiller 1 goutte' },
            posologie: { value: '4_fois_jour', label: '4 fois par jour', text: '4 fois par jour' },
            details: [
              { value: 'oeil_opere', label: 'Œil opéré', text: 'dans l\'œil opéré' }
            ],
            duration: { value: '15_jours', label: '15 jours', text: 'pendant 15 jours' },
            quantity: 1,
            order: 1
          },
          {
            medicationTemplate: medications.fluorometholone._id,
            dose: { value: '1_goutte', label: '1 goutte', text: 'Instiller 1 goutte' },
            posologie: { value: '3_fois_jour', label: '3 fois par jour', text: '3 fois par jour' },
            details: [
              { value: 'oeil_opere', label: 'Œil opéré', text: 'dans l\'œil opéré' }
            ],
            duration: { value: '15_jours', label: '15 jours', text: 'pendant 15 jours supplémentaires' },
            quantity: 1,
            order: 2
          }
        ],
        tags: ['cataracte', 'postoperatoire', 'degression']
      });
    }

    // ============================================
    // DRY EYE PROTOCOLS
    // ============================================

    if (medications.hyaluronate) {
      protocols.push({
        name: 'Sécheresse Oculaire - Légère',
        category: 'secheresse',
        description: 'Traitement de la sécheresse oculaire légère à modérée',
        type: 'standard',
        isSystemWide: true,
        medications: [
          {
            medicationTemplate: medications.hyaluronate._id,
            dose: { value: '1_goutte', label: '1 goutte', text: 'Instiller 1 goutte' },
            posologie: { value: '4_fois_jour', label: '4 fois par jour', text: '4 fois par jour ou plus selon besoin' },
            details: [
              { value: 'chaque_oeil', label: 'Dans chaque œil', text: 'dans chaque œil' }
            ],
            duration: { value: 'au_long_cours', label: 'Au long cours', text: 'au long cours' },
            quantity: 2,
            order: 1
          }
        ],
        tags: ['secheresse', 'larmes_artificielles']
      });
    }

    // ============================================
    // INFECTION PROTOCOLS
    // ============================================

    if (medications.tobramycine) {
      protocols.push({
        name: 'Infection Bactérienne - Conjonctivite',
        category: 'infection',
        description: 'Traitement antibiotique d\'une conjonctivite bactérienne',
        type: 'standard',
        isSystemWide: true,
        medications: [
          {
            medicationTemplate: medications.tobramycine._id,
            dose: { value: '1_goutte', label: '1 goutte', text: 'Instiller 1 goutte' },
            posologie: { value: '5_fois_jour', label: '5 fois par jour', text: '5 fois par jour' },
            details: [
              { value: 'chaque_oeil', label: 'Dans chaque œil', text: 'dans chaque œil' },
              { value: 'apres_toilette', label: 'Après toilette', text: 'après toilette oculaire au sérum physiologique' }
            ],
            duration: { value: '7_jours', label: '7 jours', text: 'pendant 7 jours' },
            quantity: 1,
            order: 1
          }
        ],
        tags: ['infection', 'conjonctivite', 'antibiotique']
      });
    }

    // ============================================
    // MYDRIASIS PROTOCOLS
    // ============================================

    if (medications.atropine) {
      protocols.push({
        name: 'Cycloplégie - Examen Pédiatrique',
        category: 'diagnostic',
        description: 'Préparation pour examen sous cycloplégie chez l\'enfant',
        type: 'standard',
        isSystemWide: true,
        medications: [
          {
            medicationTemplate: medications.atropine._id,
            dose: { value: '1_goutte', label: '1 goutte', text: 'Instiller 1 goutte' },
            posologie: { value: 'matin_soir', label: 'Matin et soir', text: 'matin et soir' },
            details: [
              { value: 'chaque_oeil', label: 'Dans chaque œil', text: 'dans chaque œil' },
              { value: 'compression_lacrymale', label: 'Compression point lacrymal', text: 'avec compression du point lacrymal pendant 1 minute' }
            ],
            duration: { value: '3_jours', label: '3 jours', text: 'pendant 3 jours avant la consultation' },
            quantity: 1,
            order: 1
          }
        ],
        tags: ['cycloplegie', 'pediatrie', 'diagnostic']
      });
    }

    // Insert protocols
    if (protocols.length > 0) {
      const insertedProtocols = await TreatmentProtocol.insertMany(protocols);
      console.log(`✅ Successfully inserted ${insertedProtocols.length} treatment protocols`);

      // Display summary
      console.log('\n📋 Protocol Summary:');
      const categoryCounts = {};
      insertedProtocols.forEach(p => {
        categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
      });
      Object.keys(categoryCounts).forEach(category => {
        console.log(`   ${category}: ${categoryCounts[category]} protocols`);
      });
    } else {
      console.log('⚠️  No protocols to insert. Please ensure medications are seeded first.');
    }

    console.log('\n🎉 Treatment protocol seeding complete!');
  } catch (error) {
    console.error('❌ Error seeding treatment protocols:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the seed function
seedTreatmentProtocols()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
