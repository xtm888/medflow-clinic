/**
 * Seed Frame Inventory for all clinics
 * Creates eyeglass frame inventory with realistic optical brands
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedFrameInventory.js');

const { FrameInventory } = require('../models/Inventory');
const Clinic = require('../models/Clinic');

// Popular frame brands and models
const FRAME_BRANDS = [
  { brand: 'Ray-Ban', models: ['Aviator', 'Wayfarer', 'Clubmaster', 'Round Metal', 'Erika', 'Justin', 'New Wayfarer', 'Hexagonal'] },
  { brand: 'Oakley', models: ['Holbrook', 'Frogskins', 'Radar', 'Flak', 'Sutro', 'Sylas', 'Portal X'] },
  { brand: 'Gucci', models: ['GG0061S', 'GG0396S', 'GG0025O', 'GG0034O', 'GG0418O', 'GG0466O'] },
  { brand: 'Prada', models: ['PR01OS', 'PR16MV', 'PR17WS', 'PR54TV', 'PR61XV', 'VPR08T'] },
  { brand: 'Versace', models: ['VE4361', 'VE4402', 'VE3186', 'VE3271', 'VE3301', 'VE1275'] },
  { brand: 'Tom Ford', models: ['FT5401', 'FT5504', 'FT5634', 'FT5178', 'FT5294', 'TF5505'] },
  { brand: 'Dior', models: ['DiorSoReal', 'DiorSpirit', 'Montaigne', 'DiorSight', 'DiorClub', 'DiorTag'] },
  { brand: 'Persol', models: ['PO0649', 'PO2445', 'PO3019', 'PO3092', 'PO3152', 'PO3199'] },
  { brand: 'Carrera', models: ['1001S', '1007S', '8053CS', 'Glory', 'Champion', '166S'] },
  { brand: 'Hugo Boss', models: ['BOSS0921', 'BOSS0760', 'BOSS1042', 'BOSS1086', 'BOSS1116', 'BOSS1131'] },
  { brand: 'Emporio Armani', models: ['EA3073', 'EA3099', 'EA4033', 'EA4129', 'EA4167', 'EA4177'] },
  { brand: 'Michael Kors', models: ['MK4030', 'MK4054', 'MK4060', 'MK4067', 'MK4074', 'MK3032'] },
  { brand: 'Coach', models: ['HC6089', 'HC6116', 'HC6157', 'HC8271', 'HC8324', 'HC8354'] },
  { brand: 'Burberry', models: ['BE2128', 'BE2280', 'BE4291', 'BE4316', 'BE4346', 'BE2344'] },
  { brand: 'Dolce & Gabbana', models: ['DG3268', 'DG3285', 'DG4268', 'DG4348', 'DG5034', 'DG5048'] }
];

const COLORS = ['Black', 'Tortoise', 'Gold', 'Silver', 'Brown', 'Blue', 'Havana', 'Gunmetal', 'Rose Gold', 'Matte Black'];
const CATEGORIES = ['economic', 'standard', 'premium', 'luxury'];
const MATERIALS = ['metal', 'plastic', 'titanium', 'acetate', 'tr90', 'mixed'];
const FRAME_TYPES = ['full-rim', 'half-rim', 'rimless'];
const GENDERS = ['unisex', 'men', 'women'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSKU(brand, model, color, clinicCode) {
  const brandCode = brand.replace(/[^A-Z]/gi, '').substring(0, 3).toUpperCase();
  // Use full model code to avoid collisions (e.g., GG0418O vs GG0466O)
  const modelCode = model.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const colorCode = color.replace(/\s+/g, '').substring(0, 2).toUpperCase();
  return `FRM-${brandCode}-${modelCode}-${colorCode}-${clinicCode}`;
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const clinics = await Clinic.find({ status: { $ne: 'inactive' } });
    console.log(`Found ${clinics.length} clinics`);

    if (clinics.length === 0) {
      console.log('No clinics found. Run seedClinics.js first.');
      process.exit(1);
    }

    // Clear existing frame inventory
    await FrameInventory.deleteMany({});
    console.log('Cleared existing frame inventory');

    let totalCreated = 0;

    for (const clinic of clinics) {
      // Use last 4 chars of ObjectId for guaranteed uniqueness across clinics
      const clinicCode = clinic._id.toString().slice(-4).toUpperCase();
      console.log(`\nSeeding frames for: ${clinic.name} (${clinicCode})`);

      const frames = [];

      const createdSKUs = new Set();

      for (const brandData of FRAME_BRANDS) {
        for (const model of brandData.models) {
          // Create 1-3 color variants per model
          const numColors = randomInt(1, 3);
          const selectedColors = [];

          for (let c = 0; c < numColors; c++) {
            let color = randomElement(COLORS);
            let attempts = 0;
            while (selectedColors.includes(color) && attempts < 20) {
              color = randomElement(COLORS);
              attempts++;
            }
            if (selectedColors.includes(color)) continue; // Skip if can't find unique color
            selectedColors.push(color);

            const sku = generateSKU(brandData.brand, model, color, clinicCode);

            // Skip if SKU already exists (safety check)
            if (createdSKUs.has(sku)) continue;
            createdSKUs.add(sku);
            const category = FRAME_BRANDS.indexOf(brandData) < 6 ?
              (FRAME_BRANDS.indexOf(brandData) < 3 ? 'premium' : 'luxury') :
              randomElement(['economic', 'standard', 'premium']);

            const costPrice = category === 'luxury' ? randomInt(150000, 400000) :
              category === 'premium' ? randomInt(80000, 180000) :
                category === 'standard' ? randomInt(40000, 100000) :
                  randomInt(15000, 50000);

            const sellingPrice = Math.round(costPrice * (1.5 + Math.random() * 0.5));
            const currentStock = randomInt(2, 15);
            const minimumStock = 2;
            const reorderPoint = 4;

            let status = 'in-stock';
            if (currentStock === 0) status = 'out-of-stock';
            else if (currentStock <= minimumStock) status = 'low-stock';

            frames.push({
              clinic: clinic._id,
              sku,
              brand: brandData.brand,
              model,
              color,
              category,
              material: randomElement(MATERIALS),
              frameType: randomElement(FRAME_TYPES),
              gender: randomElement(GENDERS),
              size: `${randomInt(48, 58)}-${randomInt(16, 22)}-${randomInt(135, 150)}`,
              dimensions: {
                lensWidth: randomInt(48, 58),
                bridgeWidth: randomInt(16, 22),
                templeLength: randomInt(135, 150),
                lensHeight: randomInt(35, 50)
              },
              inventory: {
                currentStock,
                reserved: 0,
                unit: 'units',
                minimumStock,
                reorderPoint,
                status
              },
              batches: [{
                lotNumber: `LOT-${Date.now().toString(36).toUpperCase()}-${randomInt(1000, 9999)}`,
                quantity: currentStock,
                reserved: 0,
                receivedDate: new Date(Date.now() - randomInt(1, 180) * 24 * 60 * 60 * 1000),
                status: 'active',
                cost: {
                  unitCost: costPrice,
                  totalCost: costPrice * currentStock,
                  currency: 'CDF'
                }
              }],
              pricing: {
                costPrice,
                sellingPrice,
                margin: Math.round(((sellingPrice - costPrice) / costPrice) * 100),
                currency: 'CDF'
              },
              active: true,
              discontinued: false
            });
          }
        }
      }

      // Insert all frames for this clinic
      await FrameInventory.insertMany(frames);
      console.log(`Created ${frames.length} frame entries for ${clinic.name}`);
      totalCreated += frames.length;
    }

    console.log('\n=== Summary ===');
    console.log(`Total frame inventory entries created: ${totalCreated}`);
    console.log(`Entries per clinic: ~${Math.round(totalCreated / clinics.length)}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
