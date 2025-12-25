require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedVitaminsFromTemplates.js');

const { PharmacyInventory } = require('../models/Inventory');
const Drug = require('../models/Drug');

const MedicationTemplate = require('../models/MedicationTemplate');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
  console.log('Connected to MongoDB');

  try {
    // Get all vitamin templates
    const vitaminTemplates = await MedicationTemplate.find({ category: 'VITAMINES' });
    console.log(`Found ${vitaminTemplates.length} vitamin templates`);

    let drugsCreated = 0;
    let inventoryCreated = 0;

    for (const template of vitaminTemplates) {
      // Create Drug entry
      const drugDoc = {
        genericName: template.name,
        genericNameFr: template.name,
        brandNames: [{
          name: template.name,
          nameFr: template.name,
          country: 'France'
        }],
        category: 'vitamin',
        categoryFr: {
          id: 'vitamines',
          name: 'VITAMINES',
          nameEn: 'Vitamins'
        },
        formulations: [{
          form: template.form === 'cp' ? 'tablet' :
            template.form === 'inj' ? 'injection' :
              template.form === 'sp' ? 'liquid' : 'tablet',
          route: 'oral',
          strengths: template.dosage ? [{
            value: parseFloat(template.dosage) || 1,
            unit: 'unit'
          }] : []
        }],
        active: true
      };

      const drug = await Drug.create(drugDoc);
      drugsCreated++;

      // Create PharmacyInventory entry
      const inventoryDoc = {
        drug: drug._id,
        medication: {
          genericName: template.name,
          brandName: template.name,
          nameFr: template.name,
          strength: template.dosage || '1 unit',
          formulation: template.form === 'cp' ? 'tablet' :
            template.form === 'inj' ? 'injection' :
              template.form === 'sp' ? 'liquid' : 'tablet',
          route: 'oral'
        },
        category: 'vitamin',
        categoryFr: {
          id: 'vitamines',
          name: 'VITAMINES'
        },
        location: {
          pharmacy: 'Main Pharmacy',
          section: 'Vitamins & Supplements'
        },
        inventory: {
          currentStock: Math.floor(Math.random() * 100) + 50,
          unit: 'units',
          minimumStock: 20,
          reorderPoint: 30,
          maximumStock: 200,
          status: 'in-stock'
        },
        batches: [{
          lotNumber: `LOT${Math.floor(Math.random() * 90000) + 10000}`,
          expirationDate: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000), // 2 years
          manufactureDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 1 month ago
          quantity: Math.floor(Math.random() * 50) + 20,
          supplier: {
            name: 'PharmaCo International'
          }
        }],
        pricing: {
          cost: Math.floor(Math.random() * 3000) + 1000,
          sellingPrice: Math.floor(Math.random() * 5000) + 2000,
          currency: process.env.BASE_CURRENCY || 'CDF'
        },
        prescription: {
          required: false
        },
        controlledSubstance: false,
        active: true
      };

      await PharmacyInventory.create(inventoryDoc);
      inventoryCreated++;

      console.log(`  ✓ Created: ${template.name}`);
    }

    console.log('\n✅ Vitamin seeding complete!');
    console.log(`Drugs created: ${drugsCreated}`);
    console.log(`Inventory entries created: ${inventoryCreated}`);

    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding vitamins:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
});
