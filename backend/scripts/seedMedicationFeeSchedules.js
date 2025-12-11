/**
 * Add all medications from PharmacyInventory to FeeSchedule
 * This ensures medications can be properly billed when prescribed
 *
 * Run with: node scripts/seedMedicationFeeSchedules.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

// Generate clean code from medication name
function generateMedicationCode(genericName, brandName, strength) {
  // Use brand name if available, otherwise generic name
  const baseName = brandName || genericName;

  // Clean the name
  let code = baseName
    .toUpperCase()
    .replace(/[ÀÁÂÃÄÅ]/g, 'A')
    .replace(/[ÈÉÊË]/g, 'E')
    .replace(/[ÌÍÎÏ]/g, 'I')
    .replace(/[ÒÓÔÕÖ]/g, 'O')
    .replace(/[ÙÚÛÜ]/g, 'U')
    .replace(/[Ç]/g, 'C')
    .replace(/'/g, '')
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  // Add strength suffix if available
  if (strength) {
    const strengthCode = strength
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    if (strengthCode && strengthCode !== code) {
      code = `${code}_${strengthCode}`;
    }
  }

  // Ensure code is unique by limiting length
  if (code.length > 50) {
    code = code.substring(0, 50);
  }

  return `MED_${code}`;
}

async function seedMedicationFeeSchedules() {
  try {
    console.log('=== ADDING MEDICATIONS TO FEE SCHEDULE ===\n');

    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    const PharmacyInventory = require('../models/PharmacyInventory');
    const FeeSchedule = require('../models/FeeSchedule');

    // Get all active medications from pharmacy inventory
    console.log('Fetching medications from pharmacy inventory...');
    const medications = await PharmacyInventory.find({ active: true })
      .select('medication pricing category categoryFr')
      .lean();

    console.log(`Found ${medications.length} active medications\n`);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    console.log('Processing medications...\n');

    for (const med of medications) {
      try {
        const genericName = med.medication?.genericName || 'Unknown';
        const brandName = med.medication?.brandName || med.medication?.nameFr;
        const strength = med.medication?.strength || '';
        const formulation = med.medication?.formulation || '';

        // Generate unique code
        const code = generateMedicationCode(genericName, brandName, strength);

        // Create display name
        const displayName = brandName || genericName;
        const fullName = strength
          ? `${displayName} ${strength} ${formulation}`.trim()
          : `${displayName} ${formulation}`.trim();

        // Get price (use selling price if available, otherwise cost)
        const price = med.pricing?.sellingPrice || med.pricing?.cost || 0;

        // Map category
        let category = 'medication';
        let displayCategory = 'Médicament';

        if (med.category === 'antibiotic') {
          displayCategory = 'Antibiotique';
        } else if (med.category === 'anti-inflammatory') {
          displayCategory = 'Anti-inflammatoire';
        } else if (med.category === 'vitamin') {
          displayCategory = 'Vitamine';
        } else if (med.category === 'supplement') {
          displayCategory = 'Supplément';
        } else if (med.categoryFr?.name) {
          displayCategory = med.categoryFr.name;
        }

        // Check if already exists
        const existing = await FeeSchedule.findOne({ code });

        if (existing) {
          // Update if price changed
          if (existing.price !== price) {
            await FeeSchedule.updateOne(
              { code },
              {
                $set: {
                  name: fullName,
                  price: price,
                  currency: med.pricing?.currency || 'CDF',
                  category: category,
                  displayCategory: displayCategory,
                  department: 'Pharmacie',
                  active: true,
                  effectiveFrom: new Date(),
                  effectiveTo: null,
                  updatedAt: new Date()
                }
              }
            );
            updated++;

            if (updated % 50 === 0) {
              console.log(`  Updated ${updated} medications...`);
            }
          } else {
            skipped++;
          }
        } else {
          // Create new
          await FeeSchedule.create({
            code,
            name: fullName,
            description: `${genericName} - ${formulation}`,
            category: category,
            displayCategory: displayCategory,
            department: 'Pharmacie',
            price: price,
            currency: med.pricing?.currency || 'CDF',
            active: true,
            effectiveFrom: new Date(),
            effectiveTo: null
          });
          created++;

          if (created % 50 === 0) {
            console.log(`  Created ${created} medications...`);
          }
        }
      } catch (error) {
        errors++;
        if (errors <= 10) {
          console.error(`  ❌ Error processing medication: ${error.message}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('MEDICATION FEE SCHEDULE SEEDING COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total medications processed: ${medications.length}`);
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);

    // Get total count of medication fee schedules
    const totalMedicationFees = await FeeSchedule.countDocuments({
      category: 'medication',
      active: true
    });

    console.log('\n' + '='.repeat(60));
    console.log(`TOTAL ACTIVE MEDICATION FEE SCHEDULES: ${totalMedicationFees}`);
    console.log('='.repeat(60));

    // Get total fee schedules
    const totalFeeSchedules = await FeeSchedule.countDocuments({ active: true });
    console.log(`\nGRAND TOTAL FEE SCHEDULES: ${totalFeeSchedules}`);

    console.log('\n✅ All medication fee schedules created successfully!\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

seedMedicationFeeSchedules();
