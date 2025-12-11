/**
 * Seed Contact Lens Inventory for all clinics
 * Creates contact lens inventory with realistic optical brands
 */

require('dotenv').config();
const mongoose = require('mongoose');
const ContactLensInventory = require('../models/ContactLensInventory');
const Clinic = require('../models/Clinic');

// Popular contact lens brands and product lines
const LENS_BRANDS = [
  {
    brand: 'Acuvue',
    manufacturer: 'Johnson & Johnson',
    products: [
      { name: 'Oasys 1-Day', wearSchedule: 'daily', packSize: 30, lensType: 'spherical' },
      { name: 'Oasys 2-Week', wearSchedule: 'bi-weekly', packSize: 6, lensType: 'spherical' },
      { name: 'Moist 1-Day', wearSchedule: 'daily', packSize: 30, lensType: 'spherical' },
      { name: 'Vita', wearSchedule: 'bi-weekly', packSize: 6, lensType: 'spherical' },
      { name: 'Oasys for Astigmatism', wearSchedule: 'bi-weekly', packSize: 6, lensType: 'toric' },
      { name: 'Define', wearSchedule: 'daily', packSize: 30, lensType: 'colored' }
    ]
  },
  {
    brand: 'Air Optix',
    manufacturer: 'Alcon',
    products: [
      { name: 'Night & Day Aqua', wearSchedule: 'monthly', packSize: 6, lensType: 'spherical' },
      { name: 'HydraGlyde', wearSchedule: 'monthly', packSize: 6, lensType: 'spherical' },
      { name: 'for Astigmatism', wearSchedule: 'monthly', packSize: 6, lensType: 'toric' },
      { name: 'Multifocal', wearSchedule: 'monthly', packSize: 6, lensType: 'multifocal' },
      { name: 'Colors', wearSchedule: 'monthly', packSize: 2, lensType: 'colored' }
    ]
  },
  {
    brand: 'Dailies',
    manufacturer: 'Alcon',
    products: [
      { name: 'Total 1', wearSchedule: 'daily', packSize: 30, lensType: 'spherical' },
      { name: 'AquaComfort Plus', wearSchedule: 'daily', packSize: 30, lensType: 'spherical' },
      { name: 'Total 1 for Astigmatism', wearSchedule: 'daily', packSize: 30, lensType: 'toric' },
      { name: 'Total 1 Multifocal', wearSchedule: 'daily', packSize: 30, lensType: 'multifocal' }
    ]
  },
  {
    brand: 'Biofinity',
    manufacturer: 'CooperVision',
    products: [
      { name: 'Sphere', wearSchedule: 'monthly', packSize: 6, lensType: 'spherical' },
      { name: 'Toric', wearSchedule: 'monthly', packSize: 6, lensType: 'toric' },
      { name: 'Multifocal', wearSchedule: 'monthly', packSize: 6, lensType: 'multifocal' },
      { name: 'Energys', wearSchedule: 'monthly', packSize: 6, lensType: 'spherical' },
      { name: 'XR', wearSchedule: 'monthly', packSize: 6, lensType: 'spherical' }
    ]
  },
  {
    brand: 'Clariti',
    manufacturer: 'CooperVision',
    products: [
      { name: '1-Day', wearSchedule: 'daily', packSize: 30, lensType: 'spherical' },
      { name: '1-Day Toric', wearSchedule: 'daily', packSize: 30, lensType: 'toric' },
      { name: '1-Day Multifocal', wearSchedule: 'daily', packSize: 30, lensType: 'multifocal' }
    ]
  },
  {
    brand: 'Proclear',
    manufacturer: 'CooperVision',
    products: [
      { name: '1-Day', wearSchedule: 'daily', packSize: 30, lensType: 'spherical' },
      { name: 'Sphere', wearSchedule: 'monthly', packSize: 6, lensType: 'spherical' },
      { name: 'Toric', wearSchedule: 'monthly', packSize: 6, lensType: 'toric' },
      { name: 'Multifocal', wearSchedule: 'monthly', packSize: 6, lensType: 'multifocal' }
    ]
  },
  {
    brand: 'Bausch + Lomb',
    manufacturer: 'Bausch & Lomb',
    products: [
      { name: 'Ultra', wearSchedule: 'monthly', packSize: 6, lensType: 'spherical' },
      { name: 'Ultra for Astigmatism', wearSchedule: 'monthly', packSize: 6, lensType: 'toric' },
      { name: 'Biotrue ONEday', wearSchedule: 'daily', packSize: 30, lensType: 'spherical' },
      { name: 'SofLens Daily', wearSchedule: 'daily', packSize: 30, lensType: 'spherical' }
    ]
  },
  {
    brand: 'FreshLook',
    manufacturer: 'Alcon',
    products: [
      { name: 'ColorBlends', wearSchedule: 'monthly', packSize: 2, lensType: 'colored' },
      { name: 'Colors', wearSchedule: 'monthly', packSize: 2, lensType: 'colored' },
      { name: 'One-Day', wearSchedule: 'daily', packSize: 10, lensType: 'colored' }
    ]
  }
];

const BASE_CURVES = [8.4, 8.5, 8.6, 8.7, 8.8];
const DIAMETERS = [14.0, 14.2, 14.3, 14.5];
const COLORS_FOR_LENSES = ['Blue', 'Green', 'Gray', 'Honey', 'Brown', 'Hazel', 'Amethyst', 'Turquoise'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSKU(brand, productLine, bc, dia, clinicCode) {
  const brandCode = brand.replace(/[^A-Z]/gi, '').substring(0, 3).toUpperCase();
  // Use full product line code to avoid collisions
  const productCode = productLine.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const bcCode = bc.toString().replace('.', '');
  const diaCode = dia.toString().replace('.', '');
  return `CL-${brandCode}-${productCode}-${bcCode}-${diaCode}-${clinicCode}`;
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

    // Clear existing contact lens inventory
    await ContactLensInventory.deleteMany({});
    console.log('Cleared existing contact lens inventory');

    let totalCreated = 0;

    for (const clinic of clinics) {
      // Use last 4 chars of ObjectId for guaranteed uniqueness across clinics
      const clinicCode = clinic._id.toString().slice(-4).toUpperCase();
      console.log(`\nSeeding contact lenses for: ${clinic.name} (${clinicCode})`);

      const lenses = [];
      const createdSKUs = new Set();

      for (const brandData of LENS_BRANDS) {
        for (const product of brandData.products) {
          // Create 1-2 base curve / diameter combinations per product
          const numVariants = randomInt(1, 2);

          for (let v = 0; v < numVariants; v++) {
            const baseCurve = randomElement(BASE_CURVES);
            const diameter = randomElement(DIAMETERS);
            const sku = generateSKU(brandData.brand, product.name, baseCurve, diameter, clinicCode);

            // Skip if this exact SKU already exists for this clinic
            if (createdSKUs.has(sku)) continue;
            createdSKUs.add(sku);

            // Pricing based on wear schedule and lens type
            let costPrice = product.wearSchedule === 'daily' ? randomInt(15000, 35000) :
                           product.wearSchedule === 'bi-weekly' ? randomInt(20000, 45000) :
                           randomInt(25000, 60000);

            if (product.lensType === 'toric') costPrice = Math.round(costPrice * 1.3);
            if (product.lensType === 'multifocal') costPrice = Math.round(costPrice * 1.4);
            if (product.lensType === 'colored') costPrice = Math.round(costPrice * 0.9);

            const sellingPrice = Math.round(costPrice * (1.4 + Math.random() * 0.4));
            const currentStock = randomInt(5, 25);
            const minimumStock = 5;
            const reorderPoint = 10;

            let status = 'in-stock';
            if (currentStock === 0) status = 'out-of-stock';
            else if (currentStock <= minimumStock) status = 'low-stock';

            // Calculate expiration date (6-24 months from now)
            const expirationDate = new Date();
            expirationDate.setMonth(expirationDate.getMonth() + randomInt(6, 24));

            const parameters = {
              baseCurve,
              diameter
            };

            // Add color for colored lenses
            if (product.lensType === 'colored') {
              parameters.color = randomElement(COLORS_FOR_LENSES);
            }

            lenses.push({
              clinic: clinic._id,
              sku,
              brand: brandData.brand,
              productLine: product.name,
              manufacturer: brandData.manufacturer,
              parameters,
              lensType: product.lensType,
              wearSchedule: product.wearSchedule,
              packSize: product.packSize,
              material: 'silicone-hydrogel',
              features: ['uv-blocking', 'moisture-retention'],
              stockingType: 'in-stock',
              inventory: {
                currentStock,
                reserved: 0,
                unit: 'boxes',
                minimumStock,
                reorderPoint,
                status
              },
              batches: [{
                lotNumber: `LOT-${Date.now().toString(36).toUpperCase()}-${randomInt(1000, 9999)}`,
                quantity: currentStock,
                reserved: 0,
                receivedDate: new Date(Date.now() - randomInt(1, 90) * 24 * 60 * 60 * 1000),
                expirationDate,
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
                currency: 'CDF',
                pricePerLens: Math.round(sellingPrice / product.packSize)
              },
              active: true,
              discontinued: false
            });
          }
        }
      }

      // Insert all lenses for this clinic
      await ContactLensInventory.insertMany(lenses);
      console.log(`Created ${lenses.length} contact lens entries for ${clinic.name}`);
      totalCreated += lenses.length;
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total contact lens inventory entries created: ${totalCreated}`);
    console.log(`Entries per clinic: ~${Math.round(totalCreated / clinics.length)}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
