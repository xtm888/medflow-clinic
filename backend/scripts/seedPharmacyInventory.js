const mongoose = require('mongoose');
const Drug = require('../models/Drug');
const PharmacyInventory = require('../models/PharmacyInventory');
const Clinic = require('../models/Clinic');
require('dotenv').config();

// Generate random stock levels based on medication type
function generateStockLevels(isOphthalmic) {
  if (isOphthalmic) {
    return {
      current: Math.floor(Math.random() * 100) + 20,
      minimum: 10,
      maximum: 150,
      reorderPoint: 20
    };
  } else {
    return {
      current: Math.floor(Math.random() * 200) + 50,
      minimum: 30,
      maximum: 300,
      reorderPoint: 50
    };
  }
}

// Generate pricing
function generatePricing(category) {
  const basePrice = Math.floor(Math.random() * 5000) + 500; // 500-5500
  return {
    cost: basePrice,
    sellingPrice: Math.floor(basePrice * 1.3), // 30% markup
    currency: process.env.BASE_CURRENCY || 'CDF'
  };
}

// Generate random batch
function generateBatch(medicationName, strength) {
  const lotNumber = `LOT${Math.floor(Math.random() * 90000) + 10000}`;
  const manufactureDate = new Date();
  manufactureDate.setMonth(manufactureDate.getMonth() - Math.floor(Math.random() * 6));

  const expirationDate = new Date(manufactureDate);
  expirationDate.setFullYear(expirationDate.getFullYear() + 2);

  const quantity = Math.floor(Math.random() * 50) + 10;

  return {
    lotNumber,
    expirationDate,
    manufactureDate,
    quantity: quantity,  // Changed from quantityInBatch
    supplier: {
      name: 'PharmaCo International'
    }
  };
}

// Map Drug category to PharmacyInventory category enum
// Uses French category names for more accurate mapping
function mapCategory(drugCategory, categoryFrName) {
  // First try to map using French category name for better granularity
  if (categoryFrName) {
    const frenchCategoryMap = {
      // Antibiotics
      'ANTIBIOTIQUE LOCAUX': 'antibiotic',
      'ANTIBIOTIQUE GENERAUX': 'antibiotic',
      'CORTICOIDES + ANTIBIOTIQUES': 'antibiotic',

      // Anti-inflammatory
      'A.I.N.S LOCAUX': 'anti-inflammatory',
      'A.I.N.S GENERAUX + CORTICOIDES': 'anti-inflammatory',
      'CORTICOIDES LOCAUX': 'anti-inflammatory',

      // Antihistamines
      'ANTI ALLERGIQUES': 'antihistamine',

      // Antivirals
      'ANTI VIRAUX': 'antiviral',

      // Antifungals
      'ANTI MYCOSIQUES': 'antifungal',

      // Vitamins
      'VITAMINES': 'vitamin',

      // Supplements
      'VASCULOTROPES': 'supplement',

      // Everything else maps to 'other' including:
      // MYDRIATIQUES, LARMES ARTIFICIELLES, ANTI GLAUCOMATEUX,
      // DIVERS OPHA, ANTISEPT SANS VASOCONS, DECONGESTIONNANT,
      // CICATRISANTS, ANESTHESIE LOCALES, ANTI HYPERTENSEURS,
      // ANTI CATARACTE, CREMES DERMIQUES, etc.
    };

    if (frenchCategoryMap[categoryFrName]) {
      return frenchCategoryMap[categoryFrName];
    }
  }

  // Fallback to English category mapping
  const categoryMap = {
    'nsaid': 'anti-inflammatory',
    'antibiotic': 'antibiotic',
    'ophthalmic': 'other',
    'antihistamine': 'antihistamine',
    'antihypertensive': 'other',
    'antifungal': 'antifungal',
    'antiviral': 'antiviral',
    'vitamin': 'vitamin',
    'supplement': 'supplement'
  };
  return categoryMap[drugCategory] || 'other';
}

// Map Drug route to PharmacyInventory route enum
function mapRoute(drugRoute) {
  const routeMap = {
    'ophthalmic': 'ophthalmic',
    'oral': 'oral',
    'intravenous': 'injectable',
    'topical': 'topical',
    'nasal': 'nasal',
    'rectal': 'rectal',
    'otic': 'otic'
  };
  return routeMap[drugRoute] || 'other';
}

async function seedPharmacyInventory() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/care-vision');
    console.log('Connected to MongoDB');

    // Clear existing pharmacy inventory
    console.log('Clearing existing pharmacy inventory...');
    await PharmacyInventory.deleteMany({});

    // Get all clinics for inventory
    console.log('Fetching all clinics...');
    const clinics = await Clinic.find({ isActive: { $ne: false } }); // Include clinics without isActive field
    if (clinics.length === 0) {
      console.error('ERROR: No clinics found. Please run seedClinics.js first.');
      process.exit(1);
    }
    console.log(`Found ${clinics.length} clinics: ${clinics.map(c => c.shortName).join(', ')}`);

    // Get all drugs from Drug collection
    console.log('Fetching medications from Drug collection...');
    const drugs = await Drug.find({ isActive: true }).lean();
    console.log(`Found ${drugs.length} active medications`);

    let totalCreated = 0;
    const errors = [];
    const clinicStats = {};

    // Create pharmacy inventory entries for each drug at each clinic
    for (const clinic of clinics) {
      console.log(`\nSeeding inventory for ${clinic.shortName}...`);
      clinicStats[clinic.shortName] = 0;

      for (const drug of drugs) {
        try {
          // Get first brand name and formulation
          const brandName = drug.brandNames && drug.brandNames.length > 0
            ? drug.brandNames[0].name
            : drug.genericName;

          const formulation = drug.formulations && drug.formulations.length > 0
            ? drug.formulations[0]
            : { form: 'tablet', route: 'oral', strengths: [] };

          // Determine if ophthalmic
          const isOphthalmic = drug.ophthalmicUse ||
                             formulation.route === 'ophthalmic' ||
                             formulation.form === 'drops' ||
                             drug.category === 'ophthalmic';

          // Generate stock levels - different for each clinic
          const stockLevels = generateStockLevels(isOphthalmic);

          // Generate pricing - same across clinics
          const pricing = generatePricing(drug.category);

          // Get strength or use default
          const strength = formulation.strengths && formulation.strengths.length > 0
            ? `${formulation.strengths[0].value}${formulation.strengths[0].unit}`
            : '1 unit';

          // Map category and route to enum
          const categoryFrName = drug.categoryFr?.name || drug.categoryFr?.id;
          const category = mapCategory(drug.category, categoryFrName);
          const route = mapRoute(formulation.route);

          // Create inventory entry for this clinic
          const inventoryEntry = {
            clinic: clinic._id,  // Required clinic reference - unique per clinic
            drug: drug._id,  // ObjectId reference
            medication: {
              genericName: drug.genericName,
              brandName: brandName,
              nameFr: brandName,
              strength: strength,
              formulation: formulation.form,
              route: route
            },
            category: category,
            categoryFr: drug.categoryFr || { id: drug.category, name: drug.category },
            location: {
              pharmacy: `${clinic.shortName} Pharmacy`,
              section: isOphthalmic ? 'Ophthalmic Section' : 'General Pharmacy'
            },
            inventory: {
              currentStock: stockLevels.current,
              unit: 'units',
              minimumStock: stockLevels.minimum,
              reorderPoint: stockLevels.reorderPoint,
              maximumStock: stockLevels.maximum,
              status: stockLevels.current <= stockLevels.reorderPoint ? 'low-stock' : 'in-stock'
            },
            batches: [generateBatch(brandName, strength)],
            pricing: {
              cost: pricing.cost,
              sellingPrice: pricing.sellingPrice,
              currency: process.env.BASE_CURRENCY || 'CDF'
            },
            prescription: {
              required: drug.category !== 'vitamin' && drug.category !== 'supplement'
            },
            controlledSubstance: false,
            active: true
          };

          // Add ophthalmic-specific fields
          if (isOphthalmic && drug.ophthalmicUse) {
            inventoryEntry.ophthalmicProperties = {
              preservativeFree: drug.ophthalmicUse.preservativeFree || false
            };
          }

          await PharmacyInventory.create(inventoryEntry);
          totalCreated++;
          clinicStats[clinic.shortName]++;

          if (totalCreated % 500 === 0) {
            console.log(`  - Created ${totalCreated} inventory entries...`);
          }
        } catch (error) {
          errors.push({
            clinic: clinic.shortName,
            medication: drug.genericName,
            error: error.message
          });
          if (errors.length <= 10) {
            console.error(`  - Error creating inventory for ${drug.genericName} at ${clinic.shortName}: ${error.message}`);
          }
        }
      }
      console.log(`  ✓ ${clinic.shortName}: ${clinicStats[clinic.shortName]} medications`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('PHARMACY INVENTORY SEEDING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Clinics: ${clinics.length}`);
    console.log(`Medications per clinic: ${drugs.length}`);
    console.log(`Total inventory entries created: ${totalCreated}`);
    console.log('\nPer-clinic breakdown:');
    for (const [clinicName, count] of Object.entries(clinicStats)) {
      console.log(`  - ${clinicName}: ${count} items`);
    }
    console.log(`\nTotal errors: ${errors.length}`);

    if (errors.length > 0 && errors.length < 20) {
      console.log('\nErrors:');
      errors.forEach(err => {
        console.log(`  - ${err.medication}: ${err.error}`);
      });
    }

    // Verify counts
    const totalCount = await PharmacyInventory.countDocuments();
    const lowStockCount = await PharmacyInventory.countDocuments({
      $expr: { $lte: ['$quantity', '$reorderPoint'] }
    });
    const expiringCount = await PharmacyInventory.countDocuments({
      'batches.expirationDate': {
        $lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('DATABASE STATUS');
    console.log('='.repeat(60));
    console.log(`Total medications in inventory: ${totalCount}`);
    console.log(`Low stock items: ${lowStockCount}`);
    console.log(`Expiring within 90 days: ${expiringCount}`);

    console.log('\n✓ Pharmacy inventory seeding completed successfully!');

  } catch (error) {
    console.error('Fatal error during seeding:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedPharmacyInventory()
    .then(() => {
      console.log('\nSeeding script completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nSeeding script failed:', error);
      process.exit(1);
    });
}

module.exports = seedPharmacyInventory;
