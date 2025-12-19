/**
 * Copy Fee Schedules to Clinics with Price Adjustments
 *
 * Usage: node scripts/copyFeeSchedulesWithAdjustment.js
 *
 * This copies template fee schedules to:
 * - Matrix: +30% (multiplier 1.30)
 * - Matadi: -25% (multiplier 0.75)
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Clinic configurations
const CLINIC_ADJUSTMENTS = [
  {
    clinicId: '6937183006cbf9e1213f0fe5',  // Matrix
    name: 'Centre Ophtalmologique Matrix',
    multiplier: 1.30,  // +30%
    description: '+30% par rapport aux modèles'
  },
  {
    clinicId: '6937183006cbf9e1213f0fec',  // Matadi
    name: 'Centre Ophtalmologique Matadi',
    multiplier: 0.75,  // -25%
    description: '-25% par rapport aux modèles'
  }
];

async function copyWithAdjustment() {
  console.log('='.repeat(60));
  console.log('Copy Fee Schedules with Price Adjustments');
  console.log('='.repeat(60));

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('\n✓ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('feeschedules');

    // Get all templates
    const templates = await collection.find({ isTemplate: true }).toArray();
    console.log(`\nFound ${templates.length} template fee schedules`);

    for (const clinicConfig of CLINIC_ADJUSTMENTS) {
      console.log(`\n${'-'.repeat(50)}`);
      console.log(`Processing: ${clinicConfig.name}`);
      console.log(`Adjustment: ${clinicConfig.description}`);
      console.log(`Multiplier: ${clinicConfig.multiplier}`);
      console.log('-'.repeat(50));

      // Check existing records for this clinic
      const existingCount = await collection.countDocuments({
        clinic: new mongoose.Types.ObjectId(clinicConfig.clinicId)
      });

      if (existingCount > 0) {
        console.log(`⚠ Found ${existingCount} existing records for this clinic`);
        console.log('  Deleting existing records to replace with adjusted prices...');

        const deleteResult = await collection.deleteMany({
          clinic: new mongoose.Types.ObjectId(clinicConfig.clinicId)
        });
        console.log(`  Deleted ${deleteResult.deletedCount} records`);
      }

      // Prepare new records with adjusted prices
      const newRecords = templates.map(template => {
        const adjustedPrice = Math.round(template.price * clinicConfig.multiplier);

        // Create new record (exclude _id and template-specific fields)
        const { _id, isTemplate, createdAt, updatedAt, __v, ...baseFields } = template;

        return {
          ...baseFields,
          price: adjustedPrice,
          clinic: new mongoose.Types.ObjectId(clinicConfig.clinicId),
          isTemplate: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      });

      // Insert all records
      const insertResult = await collection.insertMany(newRecords);
      console.log(`✓ Created ${insertResult.insertedCount} fee schedules for ${clinicConfig.name}`);

      // Show some examples
      console.log('\nPrice comparison examples:');
      const examples = templates.slice(0, 5);
      examples.forEach(t => {
        const adjusted = Math.round(t.price * clinicConfig.multiplier);
        const diff = adjusted - t.price;
        const sign = diff >= 0 ? '+' : '';
        console.log(`  ${t.code}: ${t.price} → ${adjusted} ${t.currency} (${sign}${diff})`);
      });
    }

    // Final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('Summary');
    console.log('='.repeat(60));

    const templateCount = await collection.countDocuments({ isTemplate: true });
    console.log(`\nTemplates (central): ${templateCount}`);

    for (const clinicConfig of CLINIC_ADJUSTMENTS) {
      const count = await collection.countDocuments({
        clinic: new mongoose.Types.ObjectId(clinicConfig.clinicId)
      });
      console.log(`${clinicConfig.name}: ${count} (${clinicConfig.description})`);
    }

    // Also show Tombalbaye
    const tombalCount = await collection.countDocuments({
      clinic: new mongoose.Types.ObjectId('6937183006cbf9e1213f0fd9')
    });
    console.log(`Centre Ophtalmologique Tombalbaye: ${tombalCount} (same as templates)`);

    const total = await collection.countDocuments();
    console.log(`\nTotal fee schedules in database: ${total}`);

    console.log('\n✓ All clinics configured successfully!');

  } catch (error) {
    console.error('\n✗ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

copyWithAdjustment();
