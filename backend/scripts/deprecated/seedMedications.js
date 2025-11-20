const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const Drug = require('../models/Drug');
require('dotenv').config();

// Mapping of formulations from JSON to Drug model enum
const formulationMap = {
  'eye_drops': 'drops',
  'ointment': 'ointment',
  'tablet': 'tablet',
  'injection': 'injection',
  'capsule': 'capsule',
  'syrup': 'liquid',
  'gel': 'gel',
  'solution': 'liquid',
  'single_dose': 'drops',
  'suppository': 'suppository',
  'suspension': 'liquid',
  'other': 'liquid'
};

// Mapping of routes from JSON to Drug model enum
const routeMap = {
  'ophthalmic': 'ophthalmic',
  'oral': 'oral',
  'parenteral': 'intravenous',
  'rectal': 'rectal',
  'topical': 'topical',
  'other': 'oral'
};

// Map French category IDs to English category names
const categoryMapping = {
  'ains_generaux_corticoides': 'nsaid',
  'ains_locaux': 'ophthalmic',
  'anesthesie_locales': 'ophthalmic',
  'anti_spasmodiques': 'other',
  'anti_allergiques': 'antihistamine',
  'antibiotique_locaux': 'ophthalmic',
  'antibiotique_generaux': 'antibiotic',
  'anti_cataracte': 'ophthalmic',
  'anti_glaucomateux': 'ophthalmic',
  'anti_histaminiques_generaux': 'antihistamine',
  'anti_hypertenseurs': 'antihypertensive',
  'anti_mycosiques': 'antifungal',
  'antisept_sans_vasocons': 'ophthalmic',
  'anti_viraux': 'antiviral',
  'cicatrisants': 'ophthalmic',
  'corticoides_antibiotiques': 'ophthalmic',
  'corticoides_locaux': 'ophthalmic',
  'cremes_dermiques': 'topical',
  'decongestionnant': 'ophthalmic',
  'divers_opha': 'ophthalmic',
  'larmes_artificielles': 'ophthalmic',
  'mydriatiques': 'ophthalmic',
  'vasculotropes': 'supplement',
  'vitamines': 'vitamin'
};

// Extract generic name from brand name (simplified - can be enhanced)
function extractGenericName(brandName, description) {
  const genericMap = {
    'ADVIL': 'Ibuprofen',
    'ASPEGIC': 'Aspirin',
    'ASPIRINE': 'Aspirin',
    'BRUFEN': 'Ibuprofen',
    'BRUFENAL': 'Ibuprofen',
    'CATALGINE': 'Paracetamol',
    'DOLIPRANE': 'Paracetamol',
    'EFFERALGAN': 'Paracetamol',
    'IBUPROFENE': 'Ibuprofen',
    'PARACETAMOL': 'Paracetamol',
    'CORTANCYL': 'Prednisone',
    'PREDNISOLONE': 'Prednisolone',
    'CELESTENE': 'Betamethasone',
    'HYDROCORTISONE': 'Hydrocortisone',
    'TOBREX': 'Tobramycin',
    'CILOXAN': 'Ciprofloxacin',
    'RIFAMYCINE': 'Rifamycin',
    'AZYTER': 'Azithromycin',
    'TIMOLOL': 'Timolol',
    'XALATAN': 'Latanoprost',
    'TRAVATAN': 'Travoprost',
    'AZOPT': 'Brinzolamide',
    'DIAMOX': 'Acetazolamide',
    'COSOPT': 'Dorzolamide/Timolol',
    'MAXIDEX': 'Dexamethasone',
    'PRED FORTE': 'Prednisolone acetate',
    'TOBRADEX': 'Tobramycin/Dexamethasone',
    'MAXIDROL': 'Dexamethasone/Neomycin/Polymyxin B',
    'ATROPINE': 'Atropine',
    'TROPICAMIDE': 'Tropicamide',
    'NEOSYNEPHRINE': 'Phenylephrine',
    'ZOVIRAX': 'Acyclovir',
    'VIROPHTA': 'Trifluridine',
    'ZELITREX': 'Valacyclovir',
    'ACULAR': 'Ketorolac',
    'VOLTARENE': 'Diclofenac',
    'INDOCOLLYRE': 'Indomethacin',
    'DICLOCED': 'Diclofenac',
    'CLARITYNE': 'Loratadine',
    'AERIUS': 'Desloratadine',
    'ALLERGODIL': 'Azelastine',
    'ZADITEN': 'Ketotifen',
    'OPATANOL': 'Olopatadine'
  };

  const upperBrand = brandName.toUpperCase().trim();

  // Try to find in generic map
  for (const [brand, generic] of Object.entries(genericMap)) {
    if (upperBrand.includes(brand)) {
      return generic;
    }
  }

  // Try to extract from description (look for parentheses content)
  if (description) {
    const match = description.match(/\(([^)]+)\)/);
    if (match) {
      return match[1];
    }
  }

  // If no match found, use the brand name as generic
  return brandName;
}

// Determine if medication is ophthalmic based on category and formulation
function isOphthalmicMedication(categoryId, formulation, route) {
  const ophthalmicCategories = [
    'ains_locaux', 'anesthesie_locales', 'antibiotique_locaux',
    'anti_cataracte', 'anti_glaucomateux', 'antisept_sans_vasocons',
    'cicatrisants', 'corticoides_antibiotiques', 'corticoides_locaux',
    'decongestionnant', 'divers_opha', 'larmes_artificielles', 'mydriatiques'
  ];

  return ophthalmicCategories.includes(categoryId) ||
         route === 'ophthalmic' ||
         formulation === 'drops' ||
         formulation === 'ointment';
}

// Create drug document from medication data
function createDrugDocument(medication, category) {
  const genericName = extractGenericName(medication.name, medication.fullDescription);
  const englishCategory = categoryMapping[category.id] || 'other';

  // Map formulation and route
  const formulation = formulationMap[medication.formulation] || 'liquid';
  const route = routeMap[medication.route] || 'oral';

  const isOphthalmic = isOphthalmicMedication(category.id, formulation, route);

  const drugDoc = {
    genericName: genericName,
    genericNameFr: genericName, // Can be enhanced with French translation
    brandNames: [{
      name: medication.name,
      nameFr: medication.name,
      country: 'France'
    }],
    category: englishCategory,
    categoryFr: {
      id: category.id,
      name: category.nameFr,
      nameEn: category.nameEn
    },
    formulations: [{
      form: formulation,
      route: route,
      strengths: medication.dosages.map(dosage => {
        // Parse dosage (e.g., "500mg" -> {value: 500, unit: "mg"})
        const match = dosage.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z%]+)/);
        if (match) {
          return {
            value: parseFloat(match[1]),
            unit: match[2]
          };
        }
        return null;
      }).filter(Boolean)
    }],
    active: true
  };

  // Add ophthalmic-specific information if applicable
  if (isOphthalmic) {
    drugDoc.ophthalmicUse = {
      indication: [],
      preservativeFree: medication.fullDescription.toLowerCase().includes('preservative free') ||
                        medication.fullDescription.toLowerCase().includes('sans conservateur'),
      contactLensCompatible: medication.fullDescription.toLowerCase().includes('contact lens') ||
                             medication.fullDescription.toLowerCase().includes('lentilles'),
      storage: 'Store at room temperature'
    };
  }

  // Add storage based on formulation
  if (formulation === 'drops' || formulation === 'injection') {
    drugDoc.storage = {
      temperature: 'room_temperature',
      temperatureRange: '15-25°C',
      lightProtection: true,
      shelfLife: '24 months',
      afterOpening: '30 days for eye drops'
    };
  }

  return drugDoc;
}

// Main seeding function
async function seedMedications() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/care-vision');
    console.log('Connected to MongoDB');

    // Read medications JSON file
    console.log('Reading medications data...');
    const dataPath = path.join(__dirname, '../data/medications.json');
    const jsonData = await fs.readFile(dataPath, 'utf-8');
    const medicationsData = JSON.parse(jsonData);

    console.log(`Found ${medicationsData.categories.length} categories`);

    // Clear existing medications (optional - comment out to preserve existing data)
    console.log('Clearing existing medications...');
    await Drug.deleteMany({ 'categoryFr.id': { $exists: true } });

    let totalProcessed = 0;
    let totalCreated = 0;
    const errors = [];

    // Process each category
    for (const category of medicationsData.categories) {
      console.log(`\nProcessing category: ${category.nameFr} (${category.medications.length} medications)`);

      for (const medication of category.medications) {
        totalProcessed++;

        try {
          // Create drug document
          const drugDoc = createDrugDocument(medication, category);

          // Check if medication already exists
          const existingDrug = await Drug.findOne({
            genericName: drugDoc.genericName,
            'brandNames.name': medication.name
          });

          if (existingDrug) {
            console.log(`  - Skipping duplicate: ${medication.name}`);
            continue;
          }

          // Create new drug
          await Drug.create(drugDoc);
          totalCreated++;

          if (totalCreated % 100 === 0) {
            console.log(`  - Created ${totalCreated} medications so far...`);
          }
        } catch (error) {
          errors.push({
            medication: medication.name,
            category: category.nameFr,
            error: error.message
          });
          console.error(`  - Error creating ${medication.name}: ${error.message}`);
        }
      }

      console.log(`  ✓ Category completed: ${category.nameFr}`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SEEDING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total medications processed: ${totalProcessed}`);
    console.log(`Total medications created: ${totalCreated}`);
    console.log(`Total errors: ${errors.length}`);

    if (errors.length > 0 && errors.length < 20) {
      console.log('\nErrors:');
      errors.forEach(err => {
        console.log(`  - ${err.medication} (${err.category}): ${err.error}`);
      });
    } else if (errors.length >= 20) {
      console.log(`\n${errors.length} errors occurred (too many to display)`);
    }

    console.log('\n✓ Medication seeding completed successfully!');

    // Verify count
    const count = await Drug.countDocuments();
    console.log(`\nTotal medications in database: ${count}`);

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
  seedMedications()
    .then(() => {
      console.log('\nSeeding script completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nSeeding script failed:', error);
      process.exit(1);
    });
}

module.exports = seedMedications;
