/**
 * Seed Lab Consumable Inventory for all clinics
 * Creates laboratory consumables (tubes, needles, slides, etc.) inventory
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedLabConsumableInventory.js');

const { LabConsumableInventory } = require('../models/Inventory');
const Clinic = require('../models/Clinic');

// Laboratory consumables data
const CONSUMABLES = [
  // Collection Tubes
  { name: 'EDTA Tube 3ml (Purple Cap)', category: 'collection-tube', tubeType: 'edta-purple', manufacturer: 'BD Vacutainer', specs: { size: '3ml', color: 'Purple', sterile: true, unitsPerBox: 100 } },
  { name: 'EDTA Tube 5ml (Purple Cap)', category: 'collection-tube', tubeType: 'edta-purple', manufacturer: 'BD Vacutainer', specs: { size: '5ml', color: 'Purple', sterile: true, unitsPerBox: 100 } },
  { name: 'Plain Tube 5ml (Red Cap)', category: 'collection-tube', tubeType: 'plain-red', manufacturer: 'BD Vacutainer', specs: { size: '5ml', color: 'Red', sterile: true, unitsPerBox: 100 } },
  { name: 'SST Tube 5ml (Gold Cap)', category: 'collection-tube', tubeType: 'sst-gold', manufacturer: 'BD Vacutainer', specs: { size: '5ml', color: 'Gold/Yellow', sterile: true, unitsPerBox: 100 } },
  { name: 'Heparin Tube 4ml (Green Cap)', category: 'collection-tube', tubeType: 'heparin-green', manufacturer: 'BD Vacutainer', specs: { size: '4ml', color: 'Green', sterile: true, unitsPerBox: 100 } },
  { name: 'Citrate Tube 2.7ml (Blue Cap)', category: 'collection-tube', tubeType: 'citrate-blue', manufacturer: 'BD Vacutainer', specs: { size: '2.7ml', color: 'Blue', sterile: true, unitsPerBox: 100 } },
  { name: 'Citrate Tube 1.8ml (Blue Cap)', category: 'collection-tube', tubeType: 'citrate-blue', manufacturer: 'BD Vacutainer', specs: { size: '1.8ml', color: 'Blue', sterile: true, unitsPerBox: 100 } },
  { name: 'Fluoride Tube 2ml (Gray Cap)', category: 'collection-tube', tubeType: 'fluoride-gray', manufacturer: 'BD Vacutainer', specs: { size: '2ml', color: 'Gray', sterile: true, unitsPerBox: 100 } },
  { name: 'EDTA Tube 1ml Pediatric (Purple Cap)', category: 'collection-tube', tubeType: 'edta-purple', manufacturer: 'BD Microtainer', specs: { size: '1ml', color: 'Purple', sterile: true, unitsPerBox: 50 } },

  // Needles
  { name: 'Needle 21G x 1"', category: 'needle', manufacturer: 'BD', specs: { gauge: '21G', length: '1 inch', sterile: true, unitsPerBox: 100 } },
  { name: 'Needle 22G x 1"', category: 'needle', manufacturer: 'BD', specs: { gauge: '22G', length: '1 inch', sterile: true, unitsPerBox: 100 } },
  { name: 'Needle 23G x 1"', category: 'needle', manufacturer: 'BD', specs: { gauge: '23G', length: '1 inch', sterile: true, unitsPerBox: 100 } },
  { name: 'Needle 25G x 5/8"', category: 'needle', manufacturer: 'BD', specs: { gauge: '25G', length: '5/8 inch', sterile: true, unitsPerBox: 100 } },
  { name: 'Butterfly Needle 21G', category: 'needle', manufacturer: 'BD', specs: { gauge: '21G', sterile: true, unitsPerBox: 50 } },
  { name: 'Butterfly Needle 23G', category: 'needle', manufacturer: 'BD', specs: { gauge: '23G', sterile: true, unitsPerBox: 50 } },
  { name: 'Butterfly Needle 25G Pediatric', category: 'needle', manufacturer: 'BD', specs: { gauge: '25G', sterile: true, unitsPerBox: 50 } },

  // Syringes
  { name: 'Syringe 2ml', category: 'syringe', manufacturer: 'BD', specs: { size: '2ml', sterile: true, unitsPerBox: 100 } },
  { name: 'Syringe 5ml', category: 'syringe', manufacturer: 'BD', specs: { size: '5ml', sterile: true, unitsPerBox: 100 } },
  { name: 'Syringe 10ml', category: 'syringe', manufacturer: 'BD', specs: { size: '10ml', sterile: true, unitsPerBox: 100 } },
  { name: 'Syringe 20ml', category: 'syringe', manufacturer: 'BD', specs: { size: '20ml', sterile: true, unitsPerBox: 50 } },

  // Lancets
  { name: 'Lancet 28G (Blue)', category: 'lancet', manufacturer: 'BD', specs: { gauge: '28G', color: 'Blue', sterile: true, unitsPerBox: 100 } },
  { name: 'Lancet 30G (Yellow)', category: 'lancet', manufacturer: 'BD', specs: { gauge: '30G', color: 'Yellow', sterile: true, unitsPerBox: 100 } },
  { name: 'Lancet 26G (Purple)', category: 'lancet', manufacturer: 'BD', specs: { gauge: '26G', color: 'Purple', sterile: true, unitsPerBox: 100 } },
  { name: 'Safety Lancet Auto-Retract', category: 'lancet', manufacturer: 'Owen Mumford', specs: { sterile: true, unitsPerBox: 100 } },

  // Slides and Coverslips
  { name: 'Microscope Slide Plain', category: 'slide', manufacturer: 'Thermo Fisher', specs: { size: '25x75mm', material: 'Glass', unitsPerBox: 72 } },
  { name: 'Microscope Slide Frosted End', category: 'slide', manufacturer: 'Thermo Fisher', specs: { size: '25x75mm', material: 'Glass', unitsPerBox: 72 } },
  { name: 'Coverslip 22x22mm', category: 'coverslip', manufacturer: 'Thermo Fisher', specs: { size: '22x22mm', material: 'Glass', unitsPerBox: 100 } },
  { name: 'Coverslip 24x50mm', category: 'coverslip', manufacturer: 'Thermo Fisher', specs: { size: '24x50mm', material: 'Glass', unitsPerBox: 100 } },

  // Containers
  { name: 'Urine Container Sterile 60ml', category: 'container', manufacturer: 'Greiner', specs: { size: '60ml', sterile: true, unitsPerBox: 100 } },
  { name: 'Urine Container Non-Sterile 100ml', category: 'container', manufacturer: 'Generic', specs: { size: '100ml', sterile: false, unitsPerBox: 100 } },
  { name: 'Stool Container 30ml', category: 'container', manufacturer: 'Greiner', specs: { size: '30ml', sterile: true, unitsPerBox: 100 } },
  { name: 'Sputum Container 50ml', category: 'container', manufacturer: 'Greiner', specs: { size: '50ml', sterile: true, unitsPerBox: 100 } },
  { name: 'Sample Cup 4oz', category: 'container', manufacturer: 'Generic', specs: { size: '4oz', sterile: false, unitsPerBox: 100 } },

  // Swabs
  { name: 'Cotton Swab Sterile (Wooden Stick)', category: 'swab', manufacturer: 'Copan', specs: { sterile: true, unitsPerBox: 100 } },
  { name: 'Swab with Transport Medium (Stuart)', category: 'swab', manufacturer: 'Copan', specs: { sterile: true, unitsPerBox: 50 } },
  { name: 'Swab with Transport Medium (Amies)', category: 'swab', manufacturer: 'Copan', specs: { sterile: true, unitsPerBox: 50 } },
  { name: 'Nasopharyngeal Swab', category: 'swab', manufacturer: 'Copan', specs: { sterile: true, unitsPerBox: 50 } },
  { name: 'Flocked Swab (Viral Transport)', category: 'swab', manufacturer: 'Copan', specs: { sterile: true, unitsPerBox: 25 } },

  // Pipette Tips
  { name: 'Pipette Tips 10µl', category: 'pipette-tip', manufacturer: 'Eppendorf', specs: { size: '10µl', sterile: true, unitsPerBox: 1000 } },
  { name: 'Pipette Tips 100µl', category: 'pipette-tip', manufacturer: 'Eppendorf', specs: { size: '100µl', sterile: true, unitsPerBox: 1000 } },
  { name: 'Pipette Tips 200µl', category: 'pipette-tip', manufacturer: 'Eppendorf', specs: { size: '200µl', sterile: true, unitsPerBox: 1000 } },
  { name: 'Pipette Tips 1000µl', category: 'pipette-tip', manufacturer: 'Eppendorf', specs: { size: '1000µl', sterile: true, unitsPerBox: 1000 } },
  { name: 'Pasteur Pipette Plastic 3ml', category: 'pipette-tip', manufacturer: 'Generic', specs: { size: '3ml', sterile: false, unitsPerBox: 500 } },

  // Cuvettes
  { name: 'Cuvette Semi-Micro 1.5ml', category: 'cuvette', manufacturer: 'Brand', specs: { size: '1.5ml', material: 'Plastic', unitsPerBox: 100 } },
  { name: 'Cuvette Standard 3ml', category: 'cuvette', manufacturer: 'Brand', specs: { size: '3ml', material: 'Plastic', unitsPerBox: 100 } },
  { name: 'Cuvette Quartz 3ml', category: 'cuvette', manufacturer: 'Brand', specs: { size: '3ml', material: 'Quartz', unitsPerBox: 2 } },

  // Gloves
  { name: 'Gloves Latex Exam (S)', category: 'glove', manufacturer: 'Ansell', specs: { size: 'Small', material: 'Latex', sterile: false, unitsPerBox: 100 } },
  { name: 'Gloves Latex Exam (M)', category: 'glove', manufacturer: 'Ansell', specs: { size: 'Medium', material: 'Latex', sterile: false, unitsPerBox: 100 } },
  { name: 'Gloves Latex Exam (L)', category: 'glove', manufacturer: 'Ansell', specs: { size: 'Large', material: 'Latex', sterile: false, unitsPerBox: 100 } },
  { name: 'Gloves Nitrile (S)', category: 'glove', manufacturer: 'Ansell', specs: { size: 'Small', material: 'Nitrile', latexFree: true, sterile: false, unitsPerBox: 100 } },
  { name: 'Gloves Nitrile (M)', category: 'glove', manufacturer: 'Ansell', specs: { size: 'Medium', material: 'Nitrile', latexFree: true, sterile: false, unitsPerBox: 100 } },
  { name: 'Gloves Nitrile (L)', category: 'glove', manufacturer: 'Ansell', specs: { size: 'Large', material: 'Nitrile', latexFree: true, sterile: false, unitsPerBox: 100 } },

  // Masks and Protective Wear
  { name: 'Face Mask Surgical 3-Ply', category: 'mask', manufacturer: '3M', specs: { sterile: false, unitsPerBox: 50 } },
  { name: 'Face Mask N95', category: 'mask', manufacturer: '3M', specs: { sterile: false, unitsPerBox: 20 } },
  { name: 'Lab Coat Disposable', category: 'protective-wear', manufacturer: 'Generic', specs: { sterile: false, unitsPerBox: 10 } },
  { name: 'Face Shield', category: 'protective-wear', manufacturer: '3M', specs: { sterile: false, unitsPerBox: 10 } },
  { name: 'Shoe Cover', category: 'protective-wear', manufacturer: 'Generic', specs: { sterile: false, unitsPerBox: 100 } },
  { name: 'Apron Plastic Disposable', category: 'protective-wear', manufacturer: 'Generic', specs: { sterile: false, unitsPerBox: 100 } },

  // Cleaning Supplies
  { name: 'Cotton Wool 500g', category: 'cleaning-supply', manufacturer: 'Generic', specs: { size: '500g', unitsPerBox: 1 } },
  { name: 'Gauze Pad 4x4 Sterile', category: 'cleaning-supply', manufacturer: 'Generic', specs: { size: '4x4 inch', sterile: true, unitsPerBox: 100 } },
  { name: 'Alcohol Swab', category: 'cleaning-supply', manufacturer: 'BD', specs: { sterile: true, unitsPerBox: 200 } },
  { name: 'Iodine Swab', category: 'cleaning-supply', manufacturer: 'Generic', specs: { sterile: true, unitsPerBox: 100 } },
  { name: 'Paper Towel Roll', category: 'cleaning-supply', manufacturer: 'Generic', specs: { unitsPerBox: 6 } },

  // Labels
  { name: 'Specimen Labels (Roll)', category: 'label', manufacturer: 'Generic', specs: { unitsPerBox: 1000 } },
  { name: 'Barcode Labels (Roll)', category: 'label', manufacturer: 'Generic', specs: { unitsPerBox: 2000 } },
  { name: 'Hazard Warning Labels', category: 'label', manufacturer: 'Generic', specs: { unitsPerBox: 500 } },

  // Transport Media
  { name: 'Stuart Transport Medium', category: 'transport-media', manufacturer: 'Copan', specs: { sterile: true, unitsPerBox: 50 } },
  { name: 'Amies Transport Medium', category: 'transport-media', manufacturer: 'Copan', specs: { sterile: true, unitsPerBox: 50 } },
  { name: 'Viral Transport Medium (VTM)', category: 'transport-media', manufacturer: 'Copan', specs: { sterile: true, unitsPerBox: 25 } }
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateSKU(name, category, clinicCode) {
  // Use full name code to avoid collisions
  const nameCode = name.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const catCode = category.substring(0, 3).toUpperCase();
  return `LAB-${catCode}-${nameCode}-${clinicCode}`;
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

    // Clear existing lab consumable inventory
    await LabConsumableInventory.deleteMany({});
    console.log('Cleared existing lab consumable inventory');

    let totalCreated = 0;

    for (const clinic of clinics) {
      // Use last 4 chars of ObjectId for guaranteed uniqueness across clinics
      const clinicCode = clinic._id.toString().slice(-4).toUpperCase();
      console.log(`\nSeeding lab consumables for: ${clinic.name} (${clinicCode})`);

      const consumables = [];

      for (const item of CONSUMABLES) {
        const sku = generateSKU(item.name, item.category, clinicCode);

        // Pricing based on category and quantity
        const costPerUnit = item.category === 'collection-tube' ? randomInt(200, 800) :
          item.category === 'needle' ? randomInt(50, 200) :
            item.category === 'syringe' ? randomInt(100, 400) :
              item.category === 'lancet' ? randomInt(50, 150) :
                item.category === 'slide' ? randomInt(30, 100) :
                  item.category === 'coverslip' ? randomInt(20, 50) :
                    item.category === 'container' ? randomInt(100, 500) :
                      item.category === 'swab' ? randomInt(100, 800) :
                        item.category === 'pipette-tip' ? randomInt(10, 50) :
                          item.category === 'cuvette' ? randomInt(50, 500) :
                            item.category === 'glove' ? randomInt(80, 200) :
                              item.category === 'mask' ? randomInt(50, 500) :
                                item.category === 'protective-wear' ? randomInt(200, 1000) :
                                  item.category === 'transport-media' ? randomInt(500, 1500) :
                                    randomInt(100, 500);

        const unitsPerBox = item.specs.unitsPerBox || 100;
        const costPerBox = costPerUnit * unitsPerBox;

        // Stock in boxes
        const currentStock = randomInt(5, 50); // boxes
        const minimumStock = item.category === 'glove' || item.category === 'collection-tube' ? 20 : 10;
        const reorderPoint = minimumStock * 2;

        let status = 'in-stock';
        if (currentStock === 0) status = 'out-of-stock';
        else if (currentStock <= minimumStock) status = 'low-stock';

        // Some consumables have expiration (tubes, sterile items)
        let expirationDate = null;
        if (item.category === 'collection-tube' || item.category === 'swab' || item.category === 'transport-media') {
          expirationDate = new Date();
          expirationDate.setMonth(expirationDate.getMonth() + randomInt(12, 36));
        }

        consumables.push({
          clinic: clinic._id,
          sku,
          name: item.name,
          manufacturer: item.manufacturer,
          category: item.category,
          tubeType: item.tubeType || undefined,
          specifications: {
            size: item.specs.size,
            volume: item.specs.volume,
            gauge: item.specs.gauge,
            length: item.specs.length,
            material: item.specs.material,
            color: item.specs.color,
            sterile: item.specs.sterile !== false,
            latexFree: item.specs.latexFree || false,
            unitsPerBox
          },
          inventory: {
            currentStock,
            reserved: 0,
            unit: 'box',
            minimumStock,
            reorderPoint,
            status
          },
          batches: [{
            lotNumber: `LOT-${Date.now().toString(36).toUpperCase()}-${randomInt(1000, 9999)}`,
            quantity: currentStock,
            reserved: 0,
            expirationDate,
            receivedDate: new Date(Date.now() - randomInt(1, 90) * 24 * 60 * 60 * 1000),
            status: 'active',
            cost: {
              unitCost: costPerUnit,
              boxCost: costPerBox,
              totalCost: costPerBox * currentStock,
              currency: 'CDF'
            }
          }],
          pricing: {
            costPerUnit,
            costPerBox,
            currency: 'CDF'
          },
          storage: {
            location: item.category === 'collection-tube' ? 'Phlebotomy Area' :
              item.category === 'glove' || item.category === 'mask' ? 'Supply Room' :
                'Laboratory Storage',
            temperature: 'room-temp'
          },
          isActive: true
        });
      }

      // Insert all consumables for this clinic
      await LabConsumableInventory.insertMany(consumables);
      console.log(`Created ${consumables.length} consumable entries for ${clinic.name}`);
      totalCreated += consumables.length;
    }

    console.log('\n=== Summary ===');
    console.log(`Total lab consumable inventory entries created: ${totalCreated}`);
    console.log(`Entries per clinic: ~${Math.round(totalCreated / clinics.length)}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
