/**
 * Seed depot frames and distribute to clinics with adjusted prices
 * 1. Creates frames in depot with base prices
 * 2. Creates copies in each clinic with adjusted prices
 */
require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedDepotFrames.js');

const { FrameInventory } = require('../models/Inventory');
const Clinic = require('../models/Clinic');

// Sample depot frames with base prices (in CDF)
const DEPOT_FRAMES = [
  { brand: 'Ray-Ban', model: 'Aviator Classic', color: 'Gold', sku: 'RB-AVI-GLD', category: 'premium', material: 'metal', frameType: 'full-rim', gender: 'unisex', basePrice: 150000, costPrice: 80000 },
  { brand: 'Ray-Ban', model: 'Wayfarer', color: 'Black', sku: 'RB-WAY-BLK', category: 'premium', material: 'acetate', frameType: 'full-rim', gender: 'unisex', basePrice: 140000, costPrice: 75000 },
  { brand: 'Ray-Ban', model: 'Clubmaster', color: 'Tortoise', sku: 'RB-CLB-TRT', category: 'premium', material: 'mixed', frameType: 'half-rim', gender: 'unisex', basePrice: 145000, costPrice: 78000 },
  { brand: 'Oakley', model: 'Holbrook', color: 'Matte Black', sku: 'OAK-HOL-MBK', category: 'sport', material: 'plastic', frameType: 'full-rim', gender: 'men', basePrice: 180000, costPrice: 95000 },
  { brand: 'Oakley', model: 'Flak 2.0', color: 'Polished Black', sku: 'OAK-FLK-PBK', category: 'sport', material: 'plastic', frameType: 'half-rim', gender: 'unisex', basePrice: 195000, costPrice: 100000 },
  { brand: 'Essilor', model: 'Basic Frame', color: 'Brown', sku: 'ESS-BAS-BRN', category: 'economic', material: 'plastic', frameType: 'full-rim', gender: 'unisex', basePrice: 45000, costPrice: 20000 },
  { brand: 'Essilor', model: 'Basic Frame', color: 'Black', sku: 'ESS-BAS-BLK', category: 'economic', material: 'plastic', frameType: 'full-rim', gender: 'unisex', basePrice: 45000, costPrice: 20000 },
  { brand: 'Essilor', model: 'Comfort Plus', color: 'Black', sku: 'ESS-CMP-BLK', category: 'standard', material: 'tr90', frameType: 'full-rim', gender: 'unisex', basePrice: 75000, costPrice: 35000 },
  { brand: 'Essilor', model: 'Comfort Plus', color: 'Blue', sku: 'ESS-CMP-BLU', category: 'standard', material: 'tr90', frameType: 'full-rim', gender: 'unisex', basePrice: 75000, costPrice: 35000 },
  { brand: 'Silhouette', model: 'Titan Minimal', color: 'Silver', sku: 'SIL-TMN-SLV', category: 'luxury', material: 'titanium', frameType: 'rimless', gender: 'unisex', basePrice: 350000, costPrice: 180000 },
  { brand: 'Silhouette', model: 'Titan Minimal', color: 'Gold', sku: 'SIL-TMN-GLD', category: 'luxury', material: 'titanium', frameType: 'rimless', gender: 'unisex', basePrice: 360000, costPrice: 185000 },
  { brand: 'Tom Ford', model: 'FT5401', color: 'Havana', sku: 'TF-5401-HAV', category: 'luxury', material: 'acetate', frameType: 'full-rim', gender: 'unisex', basePrice: 420000, costPrice: 220000 },
  { brand: 'Tom Ford', model: 'FT5178', color: 'Black', sku: 'TF-5178-BLK', category: 'luxury', material: 'acetate', frameType: 'full-rim', gender: 'men', basePrice: 400000, costPrice: 210000 },
  { brand: 'Nike', model: 'Flexon', color: 'Blue', sku: 'NIK-FLX-BLU', category: 'sport', material: 'memory-metal', frameType: 'full-rim', gender: 'unisex', basePrice: 95000, costPrice: 50000 },
  { brand: 'Nike', model: 'Flexon', color: 'Black', sku: 'NIK-FLX-BLK', category: 'sport', material: 'memory-metal', frameType: 'full-rim', gender: 'unisex', basePrice: 95000, costPrice: 50000 },
  { brand: 'Carrera', model: 'Champion', color: 'Red', sku: 'CAR-CHP-RED', category: 'standard', material: 'plastic', frameType: 'full-rim', gender: 'unisex', basePrice: 85000, costPrice: 45000 },
  { brand: 'Carrera', model: 'Champion', color: 'Black', sku: 'CAR-CHP-BLK', category: 'standard', material: 'plastic', frameType: 'full-rim', gender: 'unisex', basePrice: 85000, costPrice: 45000 },
  { brand: 'Local Brand', model: 'Economy Basic', color: 'Black', sku: 'LOC-ECO-BLK', category: 'economic', material: 'plastic', frameType: 'full-rim', gender: 'unisex', basePrice: 25000, costPrice: 12000 },
  { brand: 'Local Brand', model: 'Economy Basic', color: 'Brown', sku: 'LOC-ECO-BRN', category: 'economic', material: 'plastic', frameType: 'full-rim', gender: 'unisex', basePrice: 25000, costPrice: 12000 },
  { brand: 'Local Brand', model: 'Kids Fun', color: 'Blue', sku: 'LOC-KID-BLU', category: 'children', material: 'tr90', frameType: 'full-rim', gender: 'children', basePrice: 35000, costPrice: 15000 },
  { brand: 'Local Brand', model: 'Kids Fun', color: 'Pink', sku: 'LOC-KID-PNK', category: 'children', material: 'tr90', frameType: 'full-rim', gender: 'children', basePrice: 35000, costPrice: 15000 }
];

async function seedFrames() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get depot clinic (type='depot')
    const depotClinic = await Clinic.findOne({ type: 'depot' });
    if (!depotClinic) {
      console.log('ERROR: No depot clinic found. Please run seedClinics.js first.');
      return;
    }
    console.log(`Found depot: ${depotClinic.name}`);

    // Get all NON-depot clinics (actual clinic locations)
    const clinics = await Clinic.find({
      status: { $ne: 'inactive' },
      type: { $ne: 'depot' }
    });
    console.log(`Found ${clinics.length} clinic locations`);

    let depotCreated = 0;
    let clinicCreated = 0;
    let skipped = 0;

    for (const frameData of DEPOT_FRAMES) {
      // Check if depot frame exists
      let depotFrame = await FrameInventory.findOne({ sku: frameData.sku, isDepot: true });

      if (!depotFrame) {
        // Create depot frame
        depotFrame = await FrameInventory.create({
          clinic: depotClinic._id,
          isDepot: true,
          sku: frameData.sku,
          brand: frameData.brand,
          model: frameData.model,
          color: frameData.color,
          category: frameData.category,
          material: frameData.material,
          frameType: frameData.frameType,
          gender: frameData.gender,
          inventory: {
            currentStock: 50,
            minimumStock: 5,
            reorderPoint: 10,
            status: 'in-stock'
          },
          pricing: {
            costPrice: frameData.costPrice,
            sellingPrice: frameData.basePrice,
            wholesalePrice: Math.round(frameData.costPrice * 1.2),
            currency: 'CDF'
          },
          active: true
        });
        console.log(`✅ DEPOT: ${frameData.brand} ${frameData.model} (${frameData.color}) - ${frameData.basePrice.toLocaleString()} CDF`);
        depotCreated++;
      } else {
        skipped++;
      }

      // Create clinic copies with adjusted prices
      for (const clinic of clinics) {
        const modifier = clinic.pricingModifiers?.optical || 0;
        const clinicPrice = Math.round(frameData.basePrice * (1 + modifier / 100));
        const clinicSku = `${frameData.sku}-${(clinic.shortName || clinic.clinicId || clinic.name.substring(0, 3)).toUpperCase()}`;

        const existingClinic = await FrameInventory.findOne({
          sku: clinicSku,
          clinic: clinic._id
        });

        if (!existingClinic) {
          await FrameInventory.create({
            clinic: clinic._id,
            isDepot: false,
            sku: clinicSku,
            brand: frameData.brand,
            model: frameData.model,
            color: frameData.color,
            category: frameData.category,
            material: frameData.material,
            frameType: frameData.frameType,
            gender: frameData.gender,
            inventory: {
              currentStock: Math.floor(Math.random() * 8) + 2, // 2-10 initial stock
              minimumStock: 2,
              reorderPoint: 3,
              status: 'in-stock'
            },
            pricing: {
              costPrice: frameData.costPrice,
              sellingPrice: clinicPrice,
              wholesalePrice: Math.round(frameData.costPrice * 1.2),
              currency: 'CDF',
              basePrice: frameData.basePrice,
              priceModifier: modifier
            },
            active: true
          });
          console.log(`   └─ ${clinic.shortName || clinic.name}: ${clinicPrice.toLocaleString()} CDF (${modifier >= 0 ? '+' : ''}${modifier}%)`);
          clinicCreated++;
        }
      }
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log('✅ COMPLETE');
    console.log(`   Depot frames: ${depotCreated} created, ${skipped} already existed`);
    console.log(`   Clinic frames: ${clinicCreated} created`);
    console.log(`${'═'.repeat(50)}`);

    // Show summary by clinic
    console.log('\n📊 INVENTORY SUMMARY BY CLINIC:\n');
    for (const clinic of clinics) {
      const modifier = clinic.pricingModifiers?.optical || 0;
      const count = await FrameInventory.countDocuments({ clinic: clinic._id, active: true });
      const depotCount = await FrameInventory.countDocuments({ clinic: clinic._id, isDepot: true });
      const priceLabel = modifier === 0 ? 'base' : (modifier > 0 ? `+${modifier}%` : `${modifier}%`);
      console.log(`   ${clinic.name.padEnd(20)} │ ${count.toString().padStart(3)} frames │ ${depotCount > 0 ? 'DEPOT' : priceLabel.padStart(6)}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

seedFrames();
