/**
 * Set pricing modifiers for each clinic
 * All prices are relative to depot base price:
 * - Tombalbaye (main): +10% (premium location)
 * - Matrix: +30% (premium location)
 * - Matadi: -25% (regional, competitive pricing)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Clinic = require('../models/Clinic');

const CLINIC_MODIFIERS = {
  'TOMBALBAYE': { optical: 10, pharmacy: 10 },  // +10% (premium main)
  'MATRIX': { optical: 30, pharmacy: 30 },      // +30% (premium)
  'MATADI': { optical: -25, pharmacy: -25 }     // -25% (regional)
};

async function setModifiers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    for (const [clinicId, modifiers] of Object.entries(CLINIC_MODIFIERS)) {
      const result = await Clinic.findOneAndUpdate(
        { clinicId: { $regex: new RegExp(clinicId, 'i') } },
        { $set: { pricingModifiers: modifiers } },
        { new: true }
      );

      if (result) {
        console.log(`✅ ${result.name}: optical=${modifiers.optical}%, pharmacy=${modifiers.pharmacy}%`);
      } else {
        // Try by name
        const byName = await Clinic.findOneAndUpdate(
          { name: { $regex: new RegExp(clinicId, 'i') } },
          { $set: { pricingModifiers: modifiers } },
          { new: true }
        );
        if (byName) {
          console.log(`✅ ${byName.name}: optical=${modifiers.optical}%, pharmacy=${modifiers.pharmacy}%`);
        } else {
          console.log(`⚠️  Clinic ${clinicId} not found`);
        }
      }
    }

    console.log('\n✅ Pricing modifiers set successfully');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

setModifiers();
