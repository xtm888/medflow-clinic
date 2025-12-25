#!/usr/bin/env node
/**
 * Lab Inventory Seeder
 * ====================
 * Populates the system with reagent and lab consumable inventory for dashboard testing.
 *
 * Creates:
 * - 30+ reagent items with lot numbers
 * - 25+ lab consumables (tubes, slides, etc.)
 * - Expiration dates and stock levels
 *
 * Usage: node scripts/seedLabInventory.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedLabInventory.js');

// Models
const { ReagentInventory, LabConsumableInventory } = require('../models/Inventory');
const Clinic = require('../models/Clinic');
const User = require('../models/User');

// Helper functions
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function futureDate(daysAhead = 365) {
  const date = new Date();
  date.setDate(date.getDate() + Math.floor(Math.random() * daysAhead) + 30);
  return date;
}

function randomDate(daysBack = 30) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  return date;
}

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Reagent data
const REAGENTS = [
  { name: 'Fluorescéine 2%', category: 'diagnostic', type: 'ophthalmic', unit: 'mL', unitSize: 15, reorderPoint: 5, maxStock: 50 },
  { name: 'Rose Bengale 1%', category: 'diagnostic', type: 'ophthalmic', unit: 'mL', unitSize: 5, reorderPoint: 3, maxStock: 30 },
  { name: 'Tropicamide 1%', category: 'mydriatic', type: 'ophthalmic', unit: 'mL', unitSize: 15, reorderPoint: 10, maxStock: 100 },
  { name: 'Phényléphrine 10%', category: 'mydriatic', type: 'ophthalmic', unit: 'mL', unitSize: 10, reorderPoint: 8, maxStock: 80 },
  { name: 'Oxybuprocaïne 0.4%', category: 'anesthetic', type: 'ophthalmic', unit: 'mL', unitSize: 10, reorderPoint: 10, maxStock: 100 },
  { name: 'Tétracaïne 1%', category: 'anesthetic', type: 'ophthalmic', unit: 'mL', unitSize: 15, reorderPoint: 8, maxStock: 80 },
  { name: 'Povidone iodée 5%', category: 'antiseptic', type: 'surgical', unit: 'mL', unitSize: 500, reorderPoint: 5, maxStock: 30 },
  { name: 'Chlorhexidine 0.05%', category: 'antiseptic', type: 'surgical', unit: 'mL', unitSize: 500, reorderPoint: 5, maxStock: 30 },
  { name: 'BSS (Solution saline équilibrée)', category: 'irrigation', type: 'surgical', unit: 'mL', unitSize: 500, reorderPoint: 10, maxStock: 50 },
  { name: 'Viscoélastique OVD', category: 'surgical', type: 'surgical', unit: 'seringue', unitSize: 1, reorderPoint: 10, maxStock: 100 },
  { name: 'Trypsine bleue', category: 'staining', type: 'surgical', unit: 'mL', unitSize: 0.5, reorderPoint: 5, maxStock: 30 },
  { name: 'ICG (Vert d\'indocyanine)', category: 'diagnostic', type: 'angiography', unit: 'mg', unitSize: 25, reorderPoint: 5, maxStock: 30 },
  { name: 'Contraste fluorescent', category: 'diagnostic', type: 'angiography', unit: 'mL', unitSize: 10, reorderPoint: 10, maxStock: 50 },
  { name: 'Cyclopentolate 1%', category: 'mydriatic', type: 'ophthalmic', unit: 'mL', unitSize: 15, reorderPoint: 10, maxStock: 80 },
  { name: 'Atropine 1%', category: 'mydriatic', type: 'ophthalmic', unit: 'mL', unitSize: 10, reorderPoint: 5, maxStock: 50 },
  { name: 'Pilocarpine 2%', category: 'miotic', type: 'ophthalmic', unit: 'mL', unitSize: 15, reorderPoint: 5, maxStock: 40 },
  { name: 'Glycérine 100%', category: 'dehydrating', type: 'laboratory', unit: 'mL', unitSize: 100, reorderPoint: 5, maxStock: 20 },
  { name: 'Wright Stain', category: 'staining', type: 'laboratory', unit: 'mL', unitSize: 100, reorderPoint: 3, maxStock: 15 },
  { name: 'Giemsa Stain', category: 'staining', type: 'laboratory', unit: 'mL', unitSize: 100, reorderPoint: 3, maxStock: 15 },
  { name: 'Papanicolaou Stain', category: 'staining', type: 'laboratory', unit: 'kit', unitSize: 1, reorderPoint: 2, maxStock: 10 },
  { name: 'Gram Stain Kit', category: 'staining', type: 'laboratory', unit: 'kit', unitSize: 1, reorderPoint: 3, maxStock: 15 },
  { name: 'Alcool 70%', category: 'antiseptic', type: 'laboratory', unit: 'L', unitSize: 1, reorderPoint: 10, maxStock: 50 },
  { name: 'Formaldéhyde 10%', category: 'fixative', type: 'laboratory', unit: 'L', unitSize: 1, reorderPoint: 5, maxStock: 20 },
  { name: 'Methanol', category: 'solvent', type: 'laboratory', unit: 'L', unitSize: 1, reorderPoint: 3, maxStock: 15 },
  { name: 'Xylène', category: 'solvent', type: 'laboratory', unit: 'L', unitSize: 1, reorderPoint: 3, maxStock: 15 },
  { name: 'Paraffine', category: 'embedding', type: 'laboratory', unit: 'kg', unitSize: 1, reorderPoint: 5, maxStock: 20 },
  { name: 'Huile à immersion', category: 'microscopy', type: 'laboratory', unit: 'mL', unitSize: 50, reorderPoint: 3, maxStock: 15 },
  { name: 'Milieu de montage', category: 'microscopy', type: 'laboratory', unit: 'mL', unitSize: 100, reorderPoint: 3, maxStock: 15 },
  { name: 'Solution tampon pH 7', category: 'buffer', type: 'laboratory', unit: 'L', unitSize: 1, reorderPoint: 5, maxStock: 20 },
  { name: 'Eau distillée', category: 'solvent', type: 'laboratory', unit: 'L', unitSize: 5, reorderPoint: 10, maxStock: 50 }
];

// Consumable data
const CONSUMABLES = [
  { name: 'Tube EDTA (violet)', category: 'blood_collection', unit: 'pièce', reorderPoint: 100, maxStock: 1000 },
  { name: 'Tube hépariné (vert)', category: 'blood_collection', unit: 'pièce', reorderPoint: 100, maxStock: 1000 },
  { name: 'Tube sec (rouge)', category: 'blood_collection', unit: 'pièce', reorderPoint: 100, maxStock: 1000 },
  { name: 'Tube citrate (bleu)', category: 'blood_collection', unit: 'pièce', reorderPoint: 50, maxStock: 500 },
  { name: 'Aiguille prélèvement 21G', category: 'blood_collection', unit: 'pièce', reorderPoint: 100, maxStock: 1000 },
  { name: 'Aiguille prélèvement 23G', category: 'blood_collection', unit: 'pièce', reorderPoint: 100, maxStock: 1000 },
  { name: 'Lame porte-objet', category: 'microscopy', unit: 'boîte', reorderPoint: 10, maxStock: 100 },
  { name: 'Lamelle couvre-objet', category: 'microscopy', unit: 'boîte', reorderPoint: 10, maxStock: 100 },
  { name: 'Lancette stérile', category: 'blood_collection', unit: 'boîte', reorderPoint: 5, maxStock: 50 },
  { name: 'Garrot', category: 'blood_collection', unit: 'pièce', reorderPoint: 5, maxStock: 30 },
  { name: 'Coton hydrophile', category: 'general', unit: 'paquet', reorderPoint: 10, maxStock: 50 },
  { name: 'Compresse stérile', category: 'general', unit: 'boîte', reorderPoint: 10, maxStock: 50 },
  { name: 'Gants latex S', category: 'protection', unit: 'boîte', reorderPoint: 10, maxStock: 100 },
  { name: 'Gants latex M', category: 'protection', unit: 'boîte', reorderPoint: 10, maxStock: 100 },
  { name: 'Gants latex L', category: 'protection', unit: 'boîte', reorderPoint: 10, maxStock: 100 },
  { name: 'Gants nitrile M', category: 'protection', unit: 'boîte', reorderPoint: 10, maxStock: 100 },
  { name: 'Pipette Pasteur', category: 'laboratory', unit: 'boîte', reorderPoint: 5, maxStock: 50 },
  { name: 'Embout pipette bleu (1000µL)', category: 'laboratory', unit: 'sachet', reorderPoint: 5, maxStock: 30 },
  { name: 'Embout pipette jaune (200µL)', category: 'laboratory', unit: 'sachet', reorderPoint: 5, maxStock: 30 },
  { name: 'Tube Eppendorf 1.5mL', category: 'laboratory', unit: 'sachet', reorderPoint: 5, maxStock: 30 },
  { name: 'Boîte de Petri', category: 'laboratory', unit: 'paquet', reorderPoint: 5, maxStock: 30 },
  { name: 'Écouvillon stérile', category: 'sampling', unit: 'boîte', reorderPoint: 10, maxStock: 50 },
  { name: 'Pot à urine stérile', category: 'sampling', unit: 'pièce', reorderPoint: 50, maxStock: 200 },
  { name: 'Récipient à selles', category: 'sampling', unit: 'pièce', reorderPoint: 30, maxStock: 100 },
  { name: 'Bandelette urinaire', category: 'diagnostic', unit: 'boîte', reorderPoint: 5, maxStock: 30 }
];

// Stats tracking
const stats = {
  reagentsCreated: 0,
  consumablesCreated: 0,
  lowStockItems: 0
};

// Counter for unique SKUs
let skuCounter = 0;

function generateSKU(prefix) {
  skuCounter++;
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${skuCounter.toString().padStart(4, '0')}`;
}

async function seedLabInventory() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔗 Connected to MongoDB\n');

    // Load reference data
    console.log('📚 Loading reference data...');
    const clinics = await Clinic.find({}).lean();
    const users = await User.find({ isActive: true }).lean();

    if (clinics.length === 0) throw new Error('No clinics found');

    const admin = users.find(u => u.role === 'admin') || users[0];
    console.log(`  Found ${clinics.length} clinics\n`);

    // Clean up
    console.log('🧹 Cleaning up previous lab inventory...');
    await ReagentInventory.deleteMany({});
    await LabConsumableInventory.deleteMany({});
    console.log('  ✅ Cleaned\n');

    // Create reagents
    console.log('🧪 Creating reagent inventory...');
    for (const clinic of clinics) {
      for (const reagent of REAGENTS) {
        const currentStock = randomInt(0, reagent.maxStock);
        const isLowStock = currentStock <= reagent.reorderPoint;
        if (isLowStock) stats.lowStockItems++;

        // Map category to valid reagentType
        const reagentTypeMap = {
          'diagnostic': 'chemistry',
          'mydriatic': 'chemistry',
          'anesthetic': 'chemistry',
          'antiseptic': 'chemistry',
          'irrigation': 'chemistry',
          'surgical': 'chemistry',
          'staining': 'hematology',
          'angiography': 'immunology',
          'miotic': 'chemistry',
          'dehydrating': 'chemistry',
          'fixative': 'other',
          'solvent': 'other',
          'embedding': 'other',
          'microscopy': 'other',
          'buffer': 'chemistry'
        };

        await ReagentInventory.create({
          sku: generateSKU('REA'),
          name: reagent.name,
          reagentType: reagentTypeMap[reagent.category] || 'other',
          clinic: clinic._id,
          inventory: {
            currentStock: currentStock,
            unit: reagent.unit,
            reorderPoint: reagent.reorderPoint,
            maximumStock: reagent.maxStock
          },
          batches: [{
            lotNumber: `LOT${Date.now().toString().slice(-6)}${randomInt(100, 999)}`,
            quantity: currentStock,
            expirationDate: futureDate(randomInt(180, 730)),
            receivedDate: randomDate(60)
          }],
          storage: {
            temperature: reagent.type === 'ophthalmic' ? 'refrigerated' : 'room_temperature',
            lightSensitive: reagent.type === 'ophthalmic'
          },
          supplierInfo: {
            name: randomElement(['Alcon', 'Novartis', 'Johnson & Johnson', 'Zeiss', 'Bausch + Lomb'])
          },
          createdBy: admin._id
        });
        stats.reagentsCreated++;
      }
    }
    console.log(`  ✅ Created ${stats.reagentsCreated} reagent items across ${clinics.length} clinics`);

    // Create consumables
    console.log('📦 Creating lab consumable inventory...');
    for (const clinic of clinics) {
      for (const consumable of CONSUMABLES) {
        const currentStock = randomInt(0, consumable.maxStock);
        const isLowStock = currentStock <= consumable.reorderPoint;
        if (isLowStock) stats.lowStockItems++;

        await LabConsumableInventory.create({
          sku: generateSKU('CON'),
          name: consumable.name,
          consumableType: consumable.category === 'blood_collection' ? 'tubes' :
                         consumable.category === 'microscopy' ? 'slides' :
                         consumable.category === 'protection' ? 'gloves' :
                         consumable.category === 'laboratory' ? 'tips' : 'other',
          clinic: clinic._id,
          inventory: {
            currentStock: currentStock,
            unit: consumable.unit,
            reorderPoint: consumable.reorderPoint,
            maximumStock: consumable.maxStock
          },
          supplierInfo: {
            name: randomElement(['BD', 'Greiner', 'Sarstedt', 'VWR', 'Fisher Scientific'])
          },
          createdBy: admin._id
        });
        stats.consumablesCreated++;
      }
    }
    console.log(`  ✅ Created ${stats.consumablesCreated} consumable items across ${clinics.length} clinics`);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Lab Inventory Summary');
    console.log('='.repeat(50));
    console.log(`Reagents created: ${stats.reagentsCreated}`);
    console.log(`Consumables created: ${stats.consumablesCreated}`);
    console.log(`Low stock items: ${stats.lowStockItems}`);
    console.log(`Total items: ${stats.reagentsCreated + stats.consumablesCreated}`);
    console.log('\n✅ Lab inventory seeding complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedLabInventory();
