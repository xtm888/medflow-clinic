const mongoose = require('mongoose');
require('dotenv').config();

const Drug = require('../models/Drug');

async function checkDrugs() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    const count = await Drug.countDocuments();
    console.log(`Total drugs: ${count}`);

    // Find some specific drugs
    const timolol = await Drug.findOne({ name: /timolol/i });
    console.log('Timolol:', timolol ? timolol.name : 'NOT FOUND');

    const tobra = await Drug.findOne({ name: /tobra/i });
    console.log('Tobramycin:', tobra ? tobra.name : 'NOT FOUND');

    // Get first 10 drugs
    const sampleDrugs = await Drug.find().limit(10);
    console.log('\nFirst 10 drugs:');
    sampleDrugs.forEach(drug => console.log(`  - ${drug.name}`));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

checkDrugs();
