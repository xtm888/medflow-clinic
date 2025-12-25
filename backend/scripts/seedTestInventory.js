/**
 * Seed Test Inventory Data
 * Creates minimal pharmacy inventory items for E2E testing
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedTestInventory.js');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

async function seedTestInventory() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get Clinic model
    const Clinic = require('../models/Clinic');
    const { PharmacyInventory } = require('../models/Inventory');

    // Get first clinic
    const clinic = await Clinic.findOne();
    if (!clinic) {
      console.log('No clinic found. Please run seedClinics.js first.');
      process.exit(1);
    }
    console.log(`Using clinic: ${clinic.name}`);

    // Check if we already have inventory
    const existingCount = await PharmacyInventory.countDocuments({ clinic: clinic._id });
    if (existingCount > 0) {
      console.log(`Already have ${existingCount} pharmacy items. Skipping seed.`);
      await mongoose.connection.close();
      return;
    }

    // Create test pharmacy items
    const testItems = [
      {
        inventoryType: 'pharmacy',
        clinic: clinic._id,
        sku: 'MED-001',
        name: 'Paracetamol 500mg',
        brand: 'Generic',
        category: 'analgesic',
        genericName: 'Paracetamol',
        dosageForm: 'tablet',
        strength: '500mg',
        inventory: {
          currentStock: 500,
          available: 500,
          minimumStock: 50,
          reorderPoint: 100,
          status: 'in_stock',
          unit: 'tablet'
        },
        pricing: {
          costPrice: 100,
          sellingPrice: 200,
          currency: 'CDF'
        },
        batches: [{
          lotNumber: 'LOT-2025-001',
          quantity: 500,
          expirationDate: new Date('2026-12-31'),
          status: 'available'
        }],
        active: true
      },
      {
        inventoryType: 'pharmacy',
        clinic: clinic._id,
        sku: 'MED-002',
        name: 'Amoxicilline 500mg',
        brand: 'Generic',
        category: 'antibiotic',
        genericName: 'Amoxicillin',
        dosageForm: 'capsule',
        strength: '500mg',
        inventory: {
          currentStock: 200,
          available: 200,
          minimumStock: 30,
          reorderPoint: 50,
          status: 'in_stock',
          unit: 'capsule'
        },
        pricing: {
          costPrice: 300,
          sellingPrice: 500,
          currency: 'CDF'
        },
        batches: [{
          lotNumber: 'LOT-2025-002',
          quantity: 200,
          expirationDate: new Date('2026-06-30'),
          status: 'available'
        }],
        active: true
      },
      {
        inventoryType: 'pharmacy',
        clinic: clinic._id,
        sku: 'MED-003',
        name: 'Tobramycine Collyre 0.3%',
        brand: 'Tobrex',
        category: 'ophthalmic',
        genericName: 'Tobramycin',
        dosageForm: 'drops',
        strength: '0.3%',
        inventory: {
          currentStock: 50,
          available: 50,
          minimumStock: 10,
          reorderPoint: 20,
          status: 'in_stock',
          unit: 'bottle'
        },
        pricing: {
          costPrice: 5000,
          sellingPrice: 8000,
          currency: 'CDF'
        },
        batches: [{
          lotNumber: 'LOT-2025-003',
          quantity: 50,
          expirationDate: new Date('2025-12-31'),
          status: 'available'
        }],
        active: true
      }
    ];

    console.log('Creating test pharmacy inventory items...');
    const created = await PharmacyInventory.insertMany(testItems);
    console.log(`Created ${created.length} pharmacy inventory items`);

    // Verify
    const count = await PharmacyInventory.countDocuments({ clinic: clinic._id });
    console.log(`Total pharmacy items for ${clinic.name}: ${count}`);

    await mongoose.connection.close();
    console.log('Done!');
  } catch (error) {
    console.error('Error seeding inventory:', error);
    process.exit(1);
  }
}

seedTestInventory();
