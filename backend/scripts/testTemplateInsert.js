require('dotenv').config();
const mongoose = require('mongoose');
const MedicationTemplate = require('../models/MedicationTemplate');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
  console.log('Connected to MongoDB');
  console.log('Database:', db.name);

  try {
    // Clear existing
    await MedicationTemplate.deleteMany({});
    console.log('Cleared existing medications');

    // Insert test medication
    const testMed = await MedicationTemplate.create({
      category: 'A.I.N.S GENERAUX + CORTICOIDES',
      name: 'TEST MEDICATION',
      form: 'cp',
      dosage: '500mg',
      packaging: '10',
      searchTerms: ['test']
    });

    console.log('Created test medication:', testMed._id);

    // Wait a bit to ensure write is flushed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify it was inserted
    const count = await MedicationTemplate.countDocuments();
    console.log('Total medications in DB:', count);

    // Close connection properly
    await mongoose.connection.close();
    console.log('Connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
});
