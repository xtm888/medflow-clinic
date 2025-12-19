/**
 * Simulate low stock across all inventory types for testing cross-clinic features
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { PharmacyInventory, FrameInventory, ContactLensInventory, ReagentInventory, LabConsumableInventory } = require('../models/Inventory');

const Clinic = require('../models/Clinic');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the first clinic (Matrix)
    const clinics = await Clinic.find({ status: { $ne: 'inactive' } }).sort({ name: 1 });
    if (clinics.length < 2) {
      console.log('Need at least 2 clinics for cross-clinic testing');
      process.exit(1);
    }

    const targetClinic = clinics[0]; // Matrix
    const sourceClinic = clinics[1]; // Tombalbaye
    console.log(`\nTarget clinic (low stock): ${targetClinic.name}`);
    console.log(`Source clinic (has stock): ${sourceClinic.name}\n`);

    // ============ PHARMACY ============
    console.log('=== Simulating Pharmacy Inventory ===');
    // Set 3 items to out-of-stock at target clinic
    const pharmacyOutOfStock = await PharmacyInventory.updateMany(
      { clinic: targetClinic._id },
      [
        {
          $set: {
            'inventory.currentStock': 0,
            'inventory.status': 'out-of-stock'
          }
        }
      ],
      { limit: 3 }
    );
    // Actually need to do this differently - update top 3 items
    await PharmacyInventory.find({ clinic: targetClinic._id }).limit(3).then(async (items) => {
      for (const item of items) {
        await PharmacyInventory.updateOne(
          { _id: item._id },
          { 'inventory.currentStock': 0, 'inventory.status': 'out-of-stock' }
        );
      }
    });
    // Set 5 items to low-stock at target clinic
    await PharmacyInventory.find({ clinic: targetClinic._id, 'inventory.status': { $ne: 'out-of-stock' } }).skip(3).limit(5).then(async (items) => {
      for (const item of items) {
        await PharmacyInventory.updateOne(
          { _id: item._id },
          { 'inventory.currentStock': 2, 'inventory.status': 'low-stock' }
        );
      }
    });
    console.log('Set 3 pharmacy items to out-of-stock, 5 to low-stock');

    // ============ FRAMES ============
    console.log('\n=== Simulating Frame Inventory ===');
    await FrameInventory.find({ clinic: targetClinic._id }).limit(2).then(async (items) => {
      for (const item of items) {
        await FrameInventory.updateOne(
          { _id: item._id },
          { 'inventory.currentStock': 0, 'inventory.status': 'out-of-stock' }
        );
      }
    });
    await FrameInventory.find({ clinic: targetClinic._id, 'inventory.status': { $ne: 'out-of-stock' } }).skip(2).limit(4).then(async (items) => {
      for (const item of items) {
        await FrameInventory.updateOne(
          { _id: item._id },
          { 'inventory.currentStock': 1, 'inventory.status': 'low-stock' }
        );
      }
    });
    console.log('Set 2 frame items to out-of-stock, 4 to low-stock');

    // ============ CONTACT LENSES ============
    console.log('\n=== Simulating Contact Lens Inventory ===');
    await ContactLensInventory.find({ clinic: targetClinic._id }).limit(2).then(async (items) => {
      for (const item of items) {
        await ContactLensInventory.updateOne(
          { _id: item._id },
          { 'inventory.currentStock': 0, 'inventory.status': 'out-of-stock' }
        );
      }
    });
    await ContactLensInventory.find({ clinic: targetClinic._id, 'inventory.status': { $ne: 'out-of-stock' } }).skip(2).limit(3).then(async (items) => {
      for (const item of items) {
        await ContactLensInventory.updateOne(
          { _id: item._id },
          { 'inventory.currentStock': 2, 'inventory.status': 'low-stock' }
        );
      }
    });
    console.log('Set 2 contact lens items to out-of-stock, 3 to low-stock');

    // ============ REAGENTS ============
    console.log('\n=== Simulating Reagent Inventory ===');
    await ReagentInventory.find({ clinic: targetClinic._id }).limit(3).then(async (items) => {
      for (const item of items) {
        await ReagentInventory.updateOne(
          { _id: item._id },
          { 'inventory.currentStock': 0, 'inventory.status': 'out-of-stock' }
        );
      }
    });
    await ReagentInventory.find({ clinic: targetClinic._id, 'inventory.status': { $ne: 'out-of-stock' } }).skip(3).limit(4).then(async (items) => {
      for (const item of items) {
        await ReagentInventory.updateOne(
          { _id: item._id },
          { 'inventory.currentStock': 1, 'inventory.status': 'low-stock' }
        );
      }
    });
    console.log('Set 3 reagent items to out-of-stock, 4 to low-stock');

    // ============ LAB CONSUMABLES ============
    console.log('\n=== Simulating Lab Consumable Inventory ===');
    await LabConsumableInventory.find({ clinic: targetClinic._id }).limit(2).then(async (items) => {
      for (const item of items) {
        await LabConsumableInventory.updateOne(
          { _id: item._id },
          { 'inventory.currentStock': 0, 'inventory.status': 'out-of-stock' }
        );
      }
    });
    await LabConsumableInventory.find({ clinic: targetClinic._id, 'inventory.status': { $ne: 'out-of-stock' } }).skip(2).limit(4).then(async (items) => {
      for (const item of items) {
        await LabConsumableInventory.updateOne(
          { _id: item._id },
          { 'inventory.currentStock': 5, 'inventory.status': 'low-stock' }
        );
      }
    });
    console.log('Set 2 lab consumable items to out-of-stock, 4 to low-stock');

    // Summary
    console.log('\n=== Summary ===');
    const stats = {
      pharmacy: {
        outOfStock: await PharmacyInventory.countDocuments({ clinic: targetClinic._id, 'inventory.status': 'out-of-stock' }),
        lowStock: await PharmacyInventory.countDocuments({ clinic: targetClinic._id, 'inventory.status': 'low-stock' })
      },
      frames: {
        outOfStock: await FrameInventory.countDocuments({ clinic: targetClinic._id, 'inventory.status': 'out-of-stock' }),
        lowStock: await FrameInventory.countDocuments({ clinic: targetClinic._id, 'inventory.status': 'low-stock' })
      },
      contactLenses: {
        outOfStock: await ContactLensInventory.countDocuments({ clinic: targetClinic._id, 'inventory.status': 'out-of-stock' }),
        lowStock: await ContactLensInventory.countDocuments({ clinic: targetClinic._id, 'inventory.status': 'low-stock' })
      },
      reagents: {
        outOfStock: await ReagentInventory.countDocuments({ clinic: targetClinic._id, 'inventory.status': 'out-of-stock' }),
        lowStock: await ReagentInventory.countDocuments({ clinic: targetClinic._id, 'inventory.status': 'low-stock' })
      },
      labConsumables: {
        outOfStock: await LabConsumableInventory.countDocuments({ clinic: targetClinic._id, 'inventory.status': 'out-of-stock' }),
        lowStock: await LabConsumableInventory.countDocuments({ clinic: targetClinic._id, 'inventory.status': 'low-stock' })
      }
    };

    console.log(`Pharmacy: ${stats.pharmacy.outOfStock} out-of-stock, ${stats.pharmacy.lowStock} low-stock`);
    console.log(`Frames: ${stats.frames.outOfStock} out-of-stock, ${stats.frames.lowStock} low-stock`);
    console.log(`Contact Lenses: ${stats.contactLenses.outOfStock} out-of-stock, ${stats.contactLenses.lowStock} low-stock`);
    console.log(`Reagents: ${stats.reagents.outOfStock} out-of-stock, ${stats.reagents.lowStock} low-stock`);
    console.log(`Lab Consumables: ${stats.labConsumables.outOfStock} out-of-stock, ${stats.labConsumables.lowStock} low-stock`);

    const totalAlerts = Object.values(stats).reduce((sum, s) => sum + s.outOfStock + s.lowStock, 0);
    console.log(`\nTotal expected alerts: ${totalAlerts}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
