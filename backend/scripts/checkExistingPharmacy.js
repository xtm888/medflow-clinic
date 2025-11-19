const mongoose = require('mongoose');
require('dotenv').config();
const Drug = require('../models/Drug');
const MedicationTemplate = require('../models/MedicationTemplate');
const PharmacyInventory = require('../models/PharmacyInventory');

async function checkPharmacy() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');

    // Check Drug collection
    const drugCount = await Drug.countDocuments();
    console.log('=== DRUG COLLECTION ===');
    console.log('Total drugs:', drugCount);

    // Get sample drugs with proper fields
    const samples = await Drug.find().limit(5).select('genericName brandNames category categoryFr');
    console.log('\nSample drugs:');
    samples.forEach(d => {
      const brandName = d.brandNames && d.brandNames[0] ? d.brandNames[0].name : 'N/A';
      console.log('  -', d.genericName, '(', brandName, ') -', d.categoryFr?.name || d.category);
    });

    // Get categories count
    const categoryStats = await Drug.aggregate([
      { $group: { _id: '$categoryFr.name', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log('\nCategories in Drug collection:');
    categoryStats.slice(0, 20).forEach(c => console.log('  ', c._id || 'Unknown', ':', c.count));

    // Check MedicationTemplate collection
    const medTemplateCount = await MedicationTemplate.countDocuments();
    console.log('\n=== MEDICATION TEMPLATE COLLECTION ===');
    console.log('Total medication templates:', medTemplateCount);

    if (medTemplateCount > 0) {
      const templateCategories = await MedicationTemplate.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      console.log('\nCategories in MedicationTemplate:');
      templateCategories.forEach(c => console.log('  ', c._id, ':', c.count));
    }

    // Check PharmacyInventory
    const inventoryCount = await PharmacyInventory.countDocuments();
    console.log('\n=== PHARMACY INVENTORY ===');
    console.log('Total inventory items:', inventoryCount);

    if (inventoryCount > 0) {
      const invSamples = await PharmacyInventory.find().limit(5).select('medication category');
      console.log('\nSample inventory:');
      invSamples.forEach(inv => console.log('  -', inv.medication?.genericName || 'Unknown'));
    }

    // Search for specific ophthalmology drugs
    console.log('\n=== OPHTHALMOLOGY DRUG CHECK ===');
    const ophthalmicDrugs = await Drug.find({
      $or: [
        { 'categoryFr.id': /glaucomateux/i },
        { 'categoryFr.id': /mydriatiques/i },
        { 'categoryFr.id': /larmes/i }
      ]
    }).countDocuments();
    console.log('Anti-glaucoma/Mydriatics/Tears:', ophthalmicDrugs);

    // Check specific drugs
    const timolol = await Drug.findOne({
      $or: [
        { genericName: /timolol/i },
        { 'brandNames.name': /timolol/i }
      ]
    });
    console.log('Timolol found:', timolol ? 'YES' : 'NO');

    const atropine = await Drug.findOne({
      $or: [
        { genericName: /atropine/i },
        { 'brandNames.name': /atropine/i }
      ]
    });
    console.log('Atropine found:', atropine ? 'YES' : 'NO');

    const tropicamide = await Drug.findOne({
      $or: [
        { genericName: /tropicamide/i },
        { 'brandNames.name': /tropicamide/i }
      ]
    });
    console.log('Tropicamide found:', tropicamide ? 'YES' : 'NO');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

checkPharmacy();
