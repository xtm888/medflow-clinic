/**
 * Update fee schedules to match Services page expectations
 * - Standardize currency to CDF
 * - Add proper categories
 * - Add department/specialty field
 */

require('dotenv').config();
const { requireNonProduction } = require('./_guards');
requireNonProduction('updateFeeSchedules.js');

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

// Category mapping from internal to display
const categoryMap = {
  'consultation': 'Consultation',
  'examination': 'Examen',
  'procedure': 'Procédure',
  'imaging': 'Imagerie',
  'laboratory': 'Laboratoire',
  'surgery': 'Procédure', // Map surgery to Procedure
  'therapy': 'Procédure'
};

// Conversion rates (approximate)
const MAD_TO_CDF = 25; // 1 MAD ≈ 25 CDF

async function updateFeeSchedules() {
  try {
    console.log('=== UPDATING FEE SCHEDULES ===\n');

    await mongoose.connect(MONGODB_URI);

    const FeeSchedule = require('../models/FeeSchedule');

    // Get all active fee schedules
    const feeSchedules = await FeeSchedule.find({ active: true });

    console.log(`Found ${feeSchedules.length} active fee schedules\n`);

    let updated = 0;

    for (const fee of feeSchedules) {
      let needsUpdate = false;
      const updates = {};

      // Convert MAD to CDF
      if (fee.currency === 'MAD') {
        updates.price = Math.round(fee.price * MAD_TO_CDF);
        updates.currency = 'CDF';
        needsUpdate = true;
        console.log(`${fee.code}: Converting ${fee.price} MAD → ${updates.price} CDF`);
      }

      // Map category
      const currentCategory = fee.category?.toLowerCase();
      if (currentCategory && categoryMap[currentCategory]) {
        // Store both internal and display category
        if (!fee.displayCategory || fee.displayCategory !== categoryMap[currentCategory]) {
          updates.displayCategory = categoryMap[currentCategory];
          needsUpdate = true;
          console.log(`${fee.code}: Adding displayCategory: ${categoryMap[currentCategory]}`);
        }
      }

      // Add department if missing
      if (!fee.department && !fee.specialty) {
        // Infer department from category
        const dept = categoryMap[currentCategory] === 'Examen' ? 'Ophtalmologie' : 'Général';
        updates.department = dept;
        needsUpdate = true;
        console.log(`${fee.code}: Adding department: ${dept}`);
      }

      // Apply updates
      if (needsUpdate) {
        await FeeSchedule.updateOne({ _id: fee._id }, { $set: updates });
        updated++;
      }
    }

    console.log(`\n✅ Updated ${updated} fee schedules`);

    // Show summary
    console.log('\n=== SUMMARY ===');
    const summary = await FeeSchedule.aggregate([
      { $match: { active: true } },
      {
        $group: {
          _id: '$currency',
          count: { $sum: 1 },
          totalPrice: { $sum: '$price' }
        }
      }
    ]);

    summary.forEach(s => {
      console.log(`${s._id}: ${s.count} items, total value: ${s.totalPrice.toFixed(2)} ${s._id}`);
    });

    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateFeeSchedules();
