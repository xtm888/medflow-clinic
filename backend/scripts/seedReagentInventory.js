/**
 * Seed Reagent Inventory for all clinics
 * Creates laboratory reagent inventory with realistic lab supplies
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { ReagentInventory } = require('../models/Inventory');

const Clinic = require('../models/Clinic');

// Laboratory reagents by category and lab section
const REAGENTS = [
  // Hematology
  { name: 'Giemsa Stain', category: 'stain', labSection: 'hematology', manufacturer: 'Sigma-Aldrich', specs: { concentration: '1:10', volume: '500ml' } },
  { name: 'Wright Stain', category: 'stain', labSection: 'hematology', manufacturer: 'Merck', specs: { concentration: '100%', volume: '500ml' } },
  { name: 'Leishman Stain', category: 'stain', labSection: 'hematology', manufacturer: 'HiMedia', specs: { concentration: '100%', volume: '500ml' } },
  { name: 'Reticulocyte Stain (New Methylene Blue)', category: 'stain', labSection: 'hematology', manufacturer: 'Sigma-Aldrich', specs: { volume: '100ml' } },
  { name: 'CBC Diluent', category: 'diluent', labSection: 'hematology', manufacturer: 'Sysmex', specs: { volume: '20L' } },
  { name: 'Hemoglobin Reagent', category: 'reagent-kit', labSection: 'hematology', manufacturer: 'Sysmex', specs: { volume: '500ml', testsPerUnit: 500 } },
  { name: 'ESR Tubes Solution', category: 'solution', labSection: 'hematology', manufacturer: 'BD', specs: { volume: '100ml' } },

  // Biochemistry
  { name: 'Glucose Reagent Kit', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Roche', specs: { volume: '200ml', testsPerUnit: 200 } },
  { name: 'Creatinine Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Roche', specs: { volume: '100ml', testsPerUnit: 150 } },
  { name: 'Urea/BUN Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Roche', specs: { volume: '100ml', testsPerUnit: 150 } },
  { name: 'AST/ALT Reagent Kit', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Roche', specs: { volume: '100ml', testsPerUnit: 100 } },
  { name: 'Cholesterol Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Beckman Coulter', specs: { volume: '150ml', testsPerUnit: 200 } },
  { name: 'Triglyceride Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Beckman Coulter', specs: { volume: '150ml', testsPerUnit: 200 } },
  { name: 'HDL/LDL Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Roche', specs: { volume: '100ml', testsPerUnit: 100 } },
  { name: 'Total Protein Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Abbott', specs: { volume: '200ml', testsPerUnit: 250 } },
  { name: 'Albumin Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Abbott', specs: { volume: '200ml', testsPerUnit: 250 } },
  { name: 'Bilirubin Reagent (Total/Direct)', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Roche', specs: { volume: '100ml', testsPerUnit: 100 } },
  { name: 'Alkaline Phosphatase Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Roche', specs: { volume: '100ml', testsPerUnit: 100 } },
  { name: 'GGT Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Roche', specs: { volume: '100ml', testsPerUnit: 100 } },
  { name: 'Uric Acid Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Beckman Coulter', specs: { volume: '150ml', testsPerUnit: 200 } },
  { name: 'Electrolyte Solution (Na/K/Cl)', category: 'solution', labSection: 'biochemistry', manufacturer: 'Roche', specs: { volume: '500ml' } },
  { name: 'Calcium Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Abbott', specs: { volume: '100ml', testsPerUnit: 150 } },
  { name: 'Phosphorus Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Abbott', specs: { volume: '100ml', testsPerUnit: 150 } },
  { name: 'Magnesium Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Roche', specs: { volume: '100ml', testsPerUnit: 150 } },
  { name: 'Amylase Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Roche', specs: { volume: '100ml', testsPerUnit: 100 } },
  { name: 'Lipase Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Roche', specs: { volume: '100ml', testsPerUnit: 100 } },
  { name: 'LDH Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Beckman Coulter', specs: { volume: '100ml', testsPerUnit: 100 } },
  { name: 'CK/CPK Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Roche', specs: { volume: '100ml', testsPerUnit: 100 } },
  { name: 'Iron Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Roche', specs: { volume: '100ml', testsPerUnit: 100 } },
  { name: 'TIBC Reagent', category: 'reagent-kit', labSection: 'biochemistry', manufacturer: 'Roche', specs: { volume: '100ml', testsPerUnit: 100 } },

  // QC Materials
  { name: 'Chemistry Control Level 1', category: 'control-material', labSection: 'biochemistry', manufacturer: 'Bio-Rad', specs: { volume: '10x5ml' } },
  { name: 'Chemistry Control Level 2', category: 'control-material', labSection: 'biochemistry', manufacturer: 'Bio-Rad', specs: { volume: '10x5ml' } },
  { name: 'Hematology Control Normal', category: 'control-material', labSection: 'hematology', manufacturer: 'Sysmex', specs: { volume: '3x3ml' } },
  { name: 'Hematology Control Abnormal', category: 'control-material', labSection: 'hematology', manufacturer: 'Sysmex', specs: { volume: '3x3ml' } },

  // Calibrators
  { name: 'Chemistry Calibrator Set', category: 'calibrator', labSection: 'biochemistry', manufacturer: 'Roche', specs: { volume: '5x5ml' } },
  { name: 'Coagulation Calibrator', category: 'calibrator', labSection: 'coagulation', manufacturer: 'Siemens', specs: { volume: '5x1ml' } },

  // Urinalysis
  { name: 'Urine Dipstick Strips', category: 'reagent-kit', labSection: 'urinalysis', manufacturer: 'Siemens', specs: { unitsPerPackage: 100, testsPerUnit: 100 } },
  { name: 'Sulfosalicylic Acid (3%)', category: 'solution', labSection: 'urinalysis', manufacturer: 'Sigma-Aldrich', specs: { concentration: '3%', volume: '500ml' } },
  { name: 'Acetic Acid', category: 'solution', labSection: 'urinalysis', manufacturer: 'Merck', specs: { concentration: '10%', volume: '500ml' } },
  { name: 'Sternheimer-Malbin Stain', category: 'stain', labSection: 'urinalysis', manufacturer: 'HiMedia', specs: { volume: '100ml' } },

  // Microbiology
  { name: 'Blood Agar Base', category: 'culture-media', labSection: 'microbiology', manufacturer: 'HiMedia', specs: { volume: '500g' } },
  { name: 'MacConkey Agar', category: 'culture-media', labSection: 'microbiology', manufacturer: 'HiMedia', specs: { volume: '500g' } },
  { name: 'Chocolate Agar', category: 'culture-media', labSection: 'microbiology', manufacturer: 'Oxoid', specs: { volume: '500g' } },
  { name: 'Mueller-Hinton Agar', category: 'culture-media', labSection: 'microbiology', manufacturer: 'Oxoid', specs: { volume: '500g' } },
  { name: 'Sabouraud Dextrose Agar', category: 'culture-media', labSection: 'microbiology', manufacturer: 'HiMedia', specs: { volume: '500g' } },
  { name: 'Gram Stain Kit', category: 'stain', labSection: 'microbiology', manufacturer: 'BD', specs: { volume: '4x250ml' } },
  { name: 'Ziehl-Neelsen Stain Kit', category: 'stain', labSection: 'microbiology', manufacturer: 'Merck', specs: { volume: '4x250ml' } },
  { name: 'India Ink', category: 'stain', labSection: 'microbiology', manufacturer: 'HiMedia', specs: { volume: '100ml' } },
  { name: 'KOH Solution (10%)', category: 'solution', labSection: 'microbiology', manufacturer: 'Sigma-Aldrich', specs: { concentration: '10%', volume: '500ml' } },
  { name: 'Normal Saline (0.9%)', category: 'solution', labSection: 'microbiology', manufacturer: 'B.Braun', specs: { concentration: '0.9%', volume: '500ml' } },
  { name: 'Catalase Reagent (3% H2O2)', category: 'solution', labSection: 'microbiology', manufacturer: 'Sigma-Aldrich', specs: { concentration: '3%', volume: '100ml' } },
  { name: 'Oxidase Reagent', category: 'solution', labSection: 'microbiology', manufacturer: 'HiMedia', specs: { volume: '100ml' } },
  { name: 'Coagulase Plasma', category: 'reagent-kit', labSection: 'microbiology', manufacturer: 'HiMedia', specs: { volume: '10x3ml' } },

  // Immunology/Serology
  { name: 'RPR Test Kit', category: 'reagent-kit', labSection: 'immunology', manufacturer: 'Bio-Rad', specs: { testsPerUnit: 100 } },
  { name: 'TPHA Test Kit', category: 'reagent-kit', labSection: 'immunology', manufacturer: 'Fujirebio', specs: { testsPerUnit: 100 } },
  { name: 'ASO Latex Kit', category: 'reagent-kit', labSection: 'immunology', manufacturer: 'Spinreact', specs: { testsPerUnit: 100 } },
  { name: 'CRP Latex Kit', category: 'reagent-kit', labSection: 'immunology', manufacturer: 'Spinreact', specs: { testsPerUnit: 100 } },
  { name: 'RF Latex Kit', category: 'reagent-kit', labSection: 'immunology', manufacturer: 'Spinreact', specs: { testsPerUnit: 100 } },
  { name: 'Widal Test Kit', category: 'reagent-kit', labSection: 'immunology', manufacturer: 'Spinreact', specs: { testsPerUnit: 50 } },
  { name: 'HIV Rapid Test Kit', category: 'reagent-kit', labSection: 'immunology', manufacturer: 'Abbott', specs: { testsPerUnit: 25 } },
  { name: 'HBsAg Rapid Test', category: 'reagent-kit', labSection: 'immunology', manufacturer: 'Abbott', specs: { testsPerUnit: 25 } },
  { name: 'HCV Rapid Test', category: 'reagent-kit', labSection: 'immunology', manufacturer: 'Abbott', specs: { testsPerUnit: 25 } },
  { name: 'Pregnancy Test (hCG)', category: 'reagent-kit', labSection: 'immunology', manufacturer: 'Abbott', specs: { testsPerUnit: 50 } },

  // Coagulation
  { name: 'PT Reagent (Thromboplastin)', category: 'reagent-kit', labSection: 'coagulation', manufacturer: 'Siemens', specs: { volume: '10x5ml', testsPerUnit: 200 } },
  { name: 'APTT Reagent', category: 'reagent-kit', labSection: 'coagulation', manufacturer: 'Siemens', specs: { volume: '10x5ml', testsPerUnit: 200 } },
  { name: 'Calcium Chloride (0.025M)', category: 'solution', labSection: 'coagulation', manufacturer: 'Siemens', specs: { concentration: '0.025M', volume: '100ml' } },
  { name: 'INR Control Normal', category: 'control-material', labSection: 'coagulation', manufacturer: 'Siemens', specs: { volume: '10x1ml' } },
  { name: 'INR Control Abnormal', category: 'control-material', labSection: 'coagulation', manufacturer: 'Siemens', specs: { volume: '10x1ml' } },

  // Parasitology
  { name: 'Lugol Iodine Solution', category: 'stain', labSection: 'parasitology', manufacturer: 'Sigma-Aldrich', specs: { volume: '500ml' } },
  { name: 'Formalin (10%)', category: 'fixative', labSection: 'parasitology', manufacturer: 'Merck', specs: { concentration: '10%', volume: '500ml' } },
  { name: 'Ether', category: 'solution', labSection: 'parasitology', manufacturer: 'Merck', specs: { volume: '500ml' } },
  { name: 'Thick Blood Film Stain (Field Stain)', category: 'stain', labSection: 'parasitology', manufacturer: 'HiMedia', specs: { volume: '2x500ml' } },

  // Blood Bank
  { name: 'Anti-A Serum', category: 'antibody', labSection: 'blood-bank', manufacturer: 'Ortho Clinical', specs: { volume: '10ml' } },
  { name: 'Anti-B Serum', category: 'antibody', labSection: 'blood-bank', manufacturer: 'Ortho Clinical', specs: { volume: '10ml' } },
  { name: 'Anti-D Serum (Rh)', category: 'antibody', labSection: 'blood-bank', manufacturer: 'Ortho Clinical', specs: { volume: '10ml' } },
  { name: 'Anti-Human Globulin (Coombs)', category: 'antibody', labSection: 'blood-bank', manufacturer: 'Ortho Clinical', specs: { volume: '10ml' } },
  { name: 'LISS Solution', category: 'solution', labSection: 'blood-bank', manufacturer: 'Ortho Clinical', specs: { volume: '500ml' } },

  // General/Wash Buffers
  { name: 'Distilled Water', category: 'solution', labSection: 'general', manufacturer: 'Local', specs: { volume: '5L' } },
  { name: 'PBS Buffer (pH 7.4)', category: 'wash-buffer', labSection: 'general', manufacturer: 'Sigma-Aldrich', specs: { pH: '7.4', volume: '1L' } },
  { name: 'Deionized Water', category: 'solution', labSection: 'general', manufacturer: 'Local', specs: { volume: '5L' } },
  { name: 'Immersion Oil', category: 'mounting-medium', labSection: 'general', manufacturer: 'Merck', specs: { volume: '100ml' } },
  { name: 'Methanol', category: 'fixative', labSection: 'general', manufacturer: 'Merck', specs: { volume: '2.5L' } },
  { name: 'Ethanol (70%)', category: 'solution', labSection: 'general', manufacturer: 'Merck', specs: { concentration: '70%', volume: '2.5L' } },
  { name: 'Hypochlorite Solution (Disinfectant)', category: 'solution', labSection: 'general', manufacturer: 'Local', specs: { concentration: '1%', volume: '5L' } }
];

const STORAGE_TEMPS = ['room-temp', 'refrigerated', 'frozen'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSKU(name, category, clinicCode) {
  // Use full name code to avoid collisions (e.g., "Chemistry Control Level 1" vs "Level 2")
  const nameCode = name.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const catCode = category.substring(0, 3).toUpperCase();
  return `RGT-${catCode}-${nameCode}-${clinicCode}`;
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

    // Clear existing reagent inventory
    await ReagentInventory.deleteMany({});
    console.log('Cleared existing reagent inventory');

    let totalCreated = 0;

    for (const clinic of clinics) {
      // Use last 4 chars of ObjectId for guaranteed uniqueness across clinics
      const clinicCode = clinic._id.toString().slice(-4).toUpperCase();
      console.log(`\nSeeding reagents for: ${clinic.name} (${clinicCode})`);

      const reagents = [];

      for (const reagent of REAGENTS) {
        const sku = generateSKU(reagent.name, reagent.category, clinicCode);

        // Pricing based on category
        const costPrice = reagent.category === 'reagent-kit' ? randomInt(50000, 200000) :
          reagent.category === 'control-material' ? randomInt(80000, 250000) :
            reagent.category === 'calibrator' ? randomInt(100000, 300000) :
              reagent.category === 'antibody' ? randomInt(30000, 80000) :
                reagent.category === 'culture-media' ? randomInt(40000, 100000) :
                  randomInt(10000, 50000);

        const currentStock = randomInt(2, 20);
        const minimumStock = 2;
        const reorderPoint = 5;

        let status = 'in-stock';
        if (currentStock === 0) status = 'out-of-stock';
        else if (currentStock <= minimumStock) status = 'low-stock';

        // Calculate expiration date (3-18 months from now)
        const expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + randomInt(3, 18));

        // Determine storage temperature
        let storage = 'room-temp';
        if (['antibody', 'control-material', 'enzyme', 'reagent-kit'].includes(reagent.category)) {
          storage = 'refrigerated';
        }
        if (reagent.category === 'calibrator' || reagent.name.includes('Control')) {
          storage = randomElement(['refrigerated', 'frozen']);
        }

        reagents.push({
          clinic: clinic._id,
          sku,
          name: reagent.name,
          manufacturer: reagent.manufacturer,
          category: reagent.category,
          labSection: reagent.labSection,
          specifications: {
            concentration: reagent.specs.concentration,
            volume: reagent.specs.volume,
            testsPerUnit: reagent.specs.testsPerUnit,
            unitsPerPackage: reagent.specs.unitsPerPackage || 1
          },
          inventory: {
            currentStock,
            reserved: 0,
            unit: reagent.category === 'reagent-kit' ? 'kit' : 'bottle',
            minimumStock,
            reorderPoint,
            status
          },
          batches: [{
            lotNumber: `LOT-${Date.now().toString(36).toUpperCase()}-${randomInt(1000, 9999)}`,
            quantity: currentStock,
            reserved: 0,
            expirationDate,
            receivedDate: new Date(Date.now() - randomInt(1, 60) * 24 * 60 * 60 * 1000),
            status: 'active',
            cost: {
              unitCost: costPrice,
              totalCost: costPrice * currentStock,
              currency: 'CDF'
            }
          }],
          storage: {
            temperature: storage,
            lightSensitive: ['stain', 'antibody'].includes(reagent.category),
            hazardous: ['fixative', 'solution'].includes(reagent.category) && reagent.name.includes('Formalin')
          },
          pricing: {
            costPrice,
            currency: 'CDF'
          },
          qc: {
            requiresQC: ['control-material', 'calibrator'].includes(reagent.category),
            qcFrequency: reagent.category === 'control-material' ? 'daily' : 'none'
          },
          isActive: true
        });
      }

      // Insert all reagents for this clinic
      await ReagentInventory.insertMany(reagents);
      console.log(`Created ${reagents.length} reagent entries for ${clinic.name}`);
      totalCreated += reagents.length;
    }

    console.log('\n=== Summary ===');
    console.log(`Total reagent inventory entries created: ${totalCreated}`);
    console.log(`Entries per clinic: ~${Math.round(totalCreated / clinics.length)}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
