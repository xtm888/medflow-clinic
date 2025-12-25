require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProduction } = require('./_guards');
requireNonProduction('diagnoseSeed.js');

const MedicationTemplate = require('../models/MedicationTemplate');

const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

console.log('Connecting to:', DB_URI.replace(/:[^:]*@/, ':***@'));

mongoose.connect(DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', async () => {
  console.log('✓ Connected to MongoDB');
  console.log('✓ Database name:', db.name);

  try {
    // Test 1: Clear collection
    console.log('\n[Test 1] Clearing existing medications...');
    const deleteResult = await MedicationTemplate.deleteMany({});
    console.log('✓ Deleted:', deleteResult.deletedCount, 'documents');

    // Test 2: Insert single document
    console.log('\n[Test 2] Inserting single medication...');
    const single = await MedicationTemplate.create({
      category: 'A.I.N.S GENERAUX + CORTICOIDES',
      name: 'TEST SINGLE',
      form: 'cp',
      searchTerms: ['test']
    });
    console.log('✓ Created:', single._id);

    // Test 3: Count after single insert
    console.log('\n[Test 3] Counting after single insert...');
    const count1 = await MedicationTemplate.countDocuments();
    console.log('✓ Count:', count1);

    // Test 4: InsertMany with multiple documents
    console.log('\n[Test 4] Inserting multiple medications using insertMany...');
    const multiple = await MedicationTemplate.insertMany([
      {
        category: 'A.I.N.S GENERAUX + CORTICOIDES',
        name: 'TEST MULTI 1',
        form: 'cp',
        searchTerms: ['test']
      },
      {
        category: 'A.I.N.S LOCAUX',
        name: 'TEST MULTI 2',
        form: 'collyre',
        searchTerms: ['test']
      }
    ]);
    console.log('✓ Inserted:', multiple.length, 'documents');

    // Test 5: Count after insertMany
    console.log('\n[Test 5] Counting after insertMany...');
    const count2 = await MedicationTemplate.countDocuments();
    console.log('✓ Count:', count2);

    // Test 6: Wait and verify persistence
    console.log('\n[Test 6] Waiting 2 seconds for write to flush...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const count3 = await MedicationTemplate.countDocuments();
    console.log('✓ Count after wait:', count3);

    // Test 7: Query the documents
    console.log('\n[Test 7] Querying all documents...');
    const all = await MedicationTemplate.find({}).limit(10);
    console.log('✓ Found:', all.length, 'documents');
    all.forEach(med => console.log('  -', med.name));

    // Close connection
    await mongoose.connection.close();
    console.log('\n✓ Connection closed successfully');

  } catch (error) {
    console.error('\n❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
});
