/**
 * Simulate low stock conditions for testing cross-clinic inventory features
 * This script sets some random items to low-stock or out-of-stock at specific clinics
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PharmacyInventory = require('../models/PharmacyInventory');
const Clinic = require('../models/Clinic');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const clinics = await Clinic.find({ status: { $ne: 'inactive' } });
    console.log(`Found ${clinics.length} clinics`);

    if (clinics.length < 2) {
      console.log('Need at least 2 clinics for cross-clinic simulation');
      process.exit(1);
    }

    // Select first clinic to have some low/out of stock items
    const targetClinic = clinics[0];
    console.log(`\nSimulating stock issues at: ${targetClinic.name}`);

    // Get some random inventory items at this clinic
    const items = await PharmacyInventory.find({ clinic: targetClinic._id })
      .limit(10)
      .lean();

    console.log(`Found ${items.length} items to modify`);

    // Set 5 items to low stock and 3 to out of stock
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let updateData = {};

      if (i < 3) {
        // Out of stock
        updateData = {
          'inventory.currentStock': 0,
          'inventory.status': 'out-of-stock'
        };
        outOfStockCount++;
      } else if (i < 8) {
        // Low stock (below reorder point)
        const reorderPoint = item.inventory?.reorderPoint || 20;
        updateData = {
          'inventory.currentStock': Math.floor(reorderPoint / 3),
          'inventory.status': 'low-stock'
        };
        lowStockCount++;
      }

      if (Object.keys(updateData).length > 0) {
        await PharmacyInventory.updateOne(
          { _id: item._id },
          { $set: updateData }
        );
        console.log(`Updated: ${item.medication?.genericName || 'Unknown'} -> ${updateData['inventory.status']}`);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Set ${outOfStockCount} items to out-of-stock`);
    console.log(`Set ${lowStockCount} items to low-stock`);
    console.log(`\nOther clinics should still have stock for these items.`);
    console.log(`Visit http://localhost:5173/cross-clinic-inventory to see alerts.`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
