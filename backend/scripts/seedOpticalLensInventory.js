const mongoose = require('mongoose');
const { OpticalLensInventory } = require('../models/Inventory');

const Clinic = require('../models/Clinic');
require('dotenv').config();

// Optical lens brands and product lines
const LENS_BRANDS = [
  {
    brand: 'Essilor',
    productLines: [
      { name: 'Varilux Comfort Max', category: 'premium', designs: ['progressive'] },
      { name: 'Varilux Physio', category: 'premium', designs: ['progressive'] },
      { name: 'Varilux X', category: 'premium', designs: ['progressive'] },
      { name: 'Crizal Prevencia', category: 'premium', designs: ['single-vision', 'progressive'] },
      { name: 'Eyezen', category: 'standard', designs: ['single-vision'] },
      { name: 'Orma', category: 'economy', designs: ['single-vision'] }
    ]
  },
  {
    brand: 'Zeiss',
    productLines: [
      { name: 'Progressive Pure', category: 'premium', designs: ['progressive'] },
      { name: 'Progressive Plus', category: 'premium', designs: ['progressive'] },
      { name: 'DriveSafe', category: 'premium', designs: ['single-vision', 'progressive'] },
      { name: 'Digital Lens', category: 'standard', designs: ['single-vision'] },
      { name: 'ClearView', category: 'standard', designs: ['single-vision', 'bifocal-ft28'] }
    ]
  },
  {
    brand: 'Hoya',
    productLines: [
      { name: 'iD MyStyle', category: 'premium', designs: ['progressive'] },
      { name: 'Sensity', category: 'premium', designs: ['single-vision', 'progressive'] },
      { name: 'Sync III', category: 'standard', designs: ['single-vision'] },
      { name: 'Nulux', category: 'standard', designs: ['single-vision'] },
      { name: 'Summit', category: 'economy', designs: ['progressive'] }
    ]
  },
  {
    brand: 'Nikon',
    productLines: [
      { name: 'SeeMax Master', category: 'premium', designs: ['progressive'] },
      { name: 'Presio Power', category: 'premium', designs: ['progressive'] },
      { name: 'MyFocal', category: 'standard', designs: ['single-vision', 'progressive'] },
      { name: 'Lite AS', category: 'standard', designs: ['single-vision'] }
    ]
  },
  {
    brand: 'Rodenstock',
    productLines: [
      { name: 'Impression FreeSign 3', category: 'premium', designs: ['progressive'] },
      { name: 'Progressiv Life', category: 'premium', designs: ['progressive'] },
      { name: 'Mono Plus', category: 'standard', designs: ['single-vision'] }
    ]
  },
  {
    brand: 'Indo',
    productLines: [
      { name: 'Maxima', category: 'premium', designs: ['progressive'] },
      { name: 'Activa', category: 'standard', designs: ['single-vision', 'progressive'] },
      { name: 'Acabado', category: 'economy', designs: ['single-vision', 'bifocal-ft28'] }
    ]
  },
  {
    brand: 'CR Surfacing',
    productLines: [
      { name: 'Standard CR39', category: 'economy', designs: ['single-vision', 'bifocal-ft28', 'bifocal-round'] },
      { name: 'Classic White', category: 'economy', designs: ['single-vision'] }
    ]
  }
];

const MATERIALS = [
  { id: 'cr39', index: 1.50, abbe: 58, gravity: 1.32 },
  { id: 'cr39-1.56', index: 1.56, abbe: 42, gravity: 1.28 },
  { id: 'polycarbonate', index: 1.59, abbe: 30, gravity: 1.20 },
  { id: 'trivex', index: 1.53, abbe: 45, gravity: 1.11 },
  { id: 'hi-index-1.60', index: 1.60, abbe: 42, gravity: 1.34 },
  { id: 'hi-index-1.67', index: 1.67, abbe: 32, gravity: 1.37 },
  { id: 'hi-index-1.74', index: 1.74, abbe: 33, gravity: 1.47 }
];

const COATING_COMBINATIONS = [
  ['uncoated'],
  ['hard-coat'],
  ['hmc'],
  ['hmc', 'uv400'],
  ['shmc'],
  ['shmc', 'blue-light-filter'],
  ['shmc', 'blue-light-filter', 'hydrophobic'],
  ['anti-reflective', 'hard-coat'],
  ['anti-reflective', 'blue-light-filter', 'uv400'],
  ['shmc', 'hydrophobic', 'oleophobic', 'anti-static']
];

const PHOTOCHROMIC_TYPES = [
  { type: 'transitions-signature', colors: ['gray', 'brown', 'green'] },
  { type: 'transitions-xtractive', colors: ['gray', 'graphite-green'] },
  { type: 'transitions-vantage', colors: ['gray'] },
  { type: 'sensity', colors: ['gray', 'brown'] },
  { type: 'photofusion', colors: ['gray', 'brown'] },
  { type: 'photomax', colors: ['gray', 'brown', 'green'] }
];

const PROGRESSIVE_TYPES = ['standard', 'premium', 'personalized', 'digital-freeform'];

const LENS_TYPES = ['blank', 'semi-finished', 'finished', 'stock'];

const DIAMETERS = [60, 65, 70, 75, 80];

function generateSKU(brand, productLine, material, design, coatings, clinicCode) {
  const brandCode = brand.replace(/[^A-Z]/gi, '').substring(0, 3).toUpperCase();
  const productCode = productLine.replace(/[^A-Z0-9]/gi, '').substring(0, 4).toUpperCase();
  const matCode = material.split('-')[0].substring(0, 3).toUpperCase();
  const designCode = design.split('-')[0].substring(0, 2).toUpperCase();
  const coatCode = coatings[0]?.substring(0, 2).toUpperCase() || 'NC';
  return `OPT-${brandCode}-${productCode}-${matCode}-${designCode}-${coatCode}-${clinicCode}`;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seedOpticalLensInventory() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all clinics
    const clinics = await Clinic.find({ status: { $ne: 'inactive' } });
    if (clinics.length === 0) {
      console.error('No clinics found! Please seed clinics first.');
      process.exit(1);
    }

    console.log(`Found ${clinics.length} clinics`);

    // Clear existing data
    await OpticalLensInventory.deleteMany({});
    console.log('Cleared existing optical lens inventory');

    const lensesToInsert = [];
    const skuSet = new Set();

    for (const clinic of clinics) {
      const clinicCode = clinic._id.toString().slice(-4).toUpperCase();
      console.log(`\nGenerating optical lenses for ${clinic.name} (${clinicCode})...`);

      for (const brandData of LENS_BRANDS) {
        for (const productLine of brandData.productLines) {
          // For each product line, generate multiple material/coating combinations
          const materialsToUse = productLine.category === 'economy'
            ? MATERIALS.slice(0, 2)
            : productLine.category === 'premium'
              ? MATERIALS.slice(2)
              : MATERIALS.slice(0, 5);

          for (const material of materialsToUse) {
            for (const design of productLine.designs) {
              // Generate 2-3 coating variations per combination
              const coatingVariations = productLine.category === 'economy'
                ? COATING_COMBINATIONS.slice(0, 3)
                : productLine.category === 'premium'
                  ? COATING_COMBINATIONS.slice(5)
                  : COATING_COMBINATIONS.slice(2, 7);

              for (const coatings of coatingVariations) {
                const sku = generateSKU(brandData.brand, productLine.name, material.id, design, coatings, clinicCode);

                // Skip if duplicate SKU
                if (skuSet.has(sku)) continue;
                skuSet.add(sku);

                const isPhotochromic = Math.random() < 0.15; // 15% photochromic
                const isPolarized = !isPhotochromic && Math.random() < 0.1; // 10% polarized (not if photochromic)
                const isTinted = !isPhotochromic && !isPolarized && Math.random() < 0.05; // 5% tinted

                let photochromicType, photochromicColor;
                if (isPhotochromic) {
                  const photoOption = getRandomElement(PHOTOCHROMIC_TYPES);
                  photochromicType = photoOption.type;
                  photochromicColor = getRandomElement(photoOption.colors);
                }

                const lensType = design.includes('progressive')
                  ? getRandomElement(['blank', 'semi-finished'])
                  : getRandomElement(LENS_TYPES);

                const baseCost = productLine.category === 'premium' ? getRandomInt(80000, 200000)
                  : productLine.category === 'standard' ? getRandomInt(30000, 80000)
                    : getRandomInt(10000, 30000);

                const materialMultiplier = material.index >= 1.67 ? 1.5
                  : material.index >= 1.60 ? 1.2
                    : 1.0;

                const coatingMultiplier = coatings.includes('shmc') ? 1.3
                  : coatings.includes('hmc') ? 1.15
                    : 1.0;

                const costPrice = Math.round(baseCost * materialMultiplier * coatingMultiplier);
                const sellingPrice = Math.round(costPrice * (1.4 + Math.random() * 0.4));

                const currentStock = lensType === 'stock'
                  ? getRandomInt(10, 50)
                  : getRandomInt(2, 20);

                const lens = {
                  clinic: clinic._id,
                  isDepot: false,
                  sku,
                  brand: brandData.brand,
                  productLine: productLine.name,
                  manufacturer: brandData.brand,
                  lensType,
                  design,
                  material: material.id,
                  refractiveIndex: material.index,
                  coatings,
                  isPhotochromic,
                  photochromicType,
                  photochromicColor,
                  isPolarized,
                  polarizedColor: isPolarized ? getRandomElement(['Gray', 'Brown', 'Green']) : undefined,
                  isTinted,
                  tintType: isTinted ? getRandomElement(['solid', 'gradient']) : undefined,
                  tintColor: isTinted ? getRandomElement(['Gray', 'Brown', 'Blue', 'Green']) : undefined,
                  tintDensity: isTinted ? getRandomInt(15, 85) : undefined,
                  diameter: getRandomElement(DIAMETERS),
                  minFittingHeight: design.includes('progressive') ? getRandomInt(14, 18) : undefined,
                  centerThickness: getRandomInt(10, 25) / 10,
                  abbe: material.abbe,
                  specificGravity: material.gravity,
                  progressiveType: design.includes('progressive')
                    ? getRandomElement(PROGRESSIVE_TYPES)
                    : undefined,
                  progressiveBrand: design.includes('progressive')
                    ? `${brandData.brand} ${productLine.name}`
                    : undefined,
                  powerRange: {
                    sphereMin: -10,
                    sphereMax: 8,
                    sphereStep: 0.25,
                    cylinderMin: 0,
                    cylinderMax: -4,
                    cylinderStep: 0.25,
                    addMin: design.includes('progressive') || design.includes('bifocal') ? 0.75 : undefined,
                    addMax: design.includes('progressive') || design.includes('bifocal') ? 3.50 : undefined,
                    addStep: design.includes('progressive') || design.includes('bifocal') ? 0.25 : undefined
                  },
                  inventory: {
                    currentStock,
                    reserved: 0,
                    available: currentStock,
                    unit: 'pairs',
                    minimumStock: lensType === 'stock' ? 5 : 2,
                    reorderPoint: lensType === 'stock' ? 10 : 4,
                    reorderQuantity: lensType === 'stock' ? 20 : 10,
                    status: currentStock === 0 ? 'out-of-stock'
                      : currentStock <= (lensType === 'stock' ? 5 : 2) ? 'low-stock'
                        : 'in-stock'
                  },
                  pricing: {
                    costPrice,
                    sellingPrice,
                    margin: Math.round(((sellingPrice - costPrice) / costPrice) * 100),
                    currency: 'CDF',
                    coatingPrices: {
                      hmc: 15000,
                      shmc: 25000,
                      blueLightFilter: 20000,
                      photochromic: 45000,
                      polarized: 35000
                    }
                  },
                  category: productLine.category,
                  features: [
                    material.index >= 1.60 ? 'Thin & Light' : null,
                    material.id === 'polycarbonate' ? 'Impact Resistant' : null,
                    material.id === 'trivex' ? 'Lightweight' : null,
                    coatings.includes('blue-light-filter') ? 'Blue Light Protection' : null,
                    coatings.includes('uv400') ? 'UV400 Protection' : null,
                    isPhotochromic ? 'Photochromic' : null,
                    isPolarized ? 'Polarized' : null
                  ].filter(Boolean),
                  compatibleFrameTypes: material.index >= 1.67
                    ? ['full-rim', 'half-rim', 'rimless']
                    : ['full-rim', 'half-rim'],
                  labProcessing: {
                    surfacingRequired: lensType === 'blank' || lensType === 'semi-finished',
                    edgingDifficulty: material.index >= 1.67 ? 'difficult'
                      : material.id === 'polycarbonate' ? 'medium'
                        : 'easy',
                    specialInstructions: material.index >= 1.74
                      ? 'Use diamond wheel for edging'
                      : undefined
                  },
                  active: true,
                  discontinued: false,
                  usage: {
                    totalSold: getRandomInt(0, 50),
                    totalReturned: getRandomInt(0, 2),
                    averageMonthlyUsage: getRandomInt(1, 10)
                  }
                };

                lensesToInsert.push(lens);
              }
            }
          }
        }
      }
    }

    console.log(`\nInserting ${lensesToInsert.length} optical lenses...`);

    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < lensesToInsert.length; i += batchSize) {
      const batch = lensesToInsert.slice(i, i + batchSize);
      await OpticalLensInventory.insertMany(batch);
      console.log(`Inserted ${Math.min(i + batchSize, lensesToInsert.length)}/${lensesToInsert.length}`);
    }

    // Summary
    const summary = await OpticalLensInventory.aggregate([
      {
        $group: {
          _id: '$clinic',
          totalItems: { $sum: 1 },
          totalStock: { $sum: '$inventory.currentStock' },
          brands: { $addToSet: '$brand' }
        }
      },
      {
        $lookup: {
          from: 'clinics',
          localField: '_id',
          foreignField: '_id',
          as: 'clinicInfo'
        }
      }
    ]);

    console.log('\n=== OPTICAL LENS INVENTORY SUMMARY ===');
    for (const s of summary) {
      const clinicName = s.clinicInfo[0]?.name || 'Unknown';
      console.log(`${clinicName}:`);
      console.log(`  - Items: ${s.totalItems}`);
      console.log(`  - Total Stock: ${s.totalStock} pairs`);
      console.log(`  - Brands: ${s.brands.join(', ')}`);
    }

    // Material breakdown
    const materialStats = await OpticalLensInventory.aggregate([
      { $group: { _id: '$material', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\n=== BY MATERIAL ===');
    for (const m of materialStats) {
      console.log(`${m._id}: ${m.count} items`);
    }

    // Design breakdown
    const designStats = await OpticalLensInventory.aggregate([
      { $group: { _id: '$design', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\n=== BY DESIGN ===');
    for (const d of designStats) {
      console.log(`${d._id}: ${d.count} items`);
    }

    console.log('\nOptical lens inventory seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding optical lens inventory:', error);
    process.exit(1);
  }
}

seedOpticalLensInventory();
