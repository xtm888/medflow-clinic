const mongoose = require('mongoose');
require('dotenv').config();

async function checkRawDrugs() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    const count = await mongoose.connection.db.collection('drugs').countDocuments();
    console.log(`Total in drugs collection: ${count}`);

    const sample = await mongoose.connection.db.collection('drugs').find().limit(3).toArray();
    console.log('\nSample documents:');
    sample.forEach(doc => {
      console.log('---');
      console.log('Fields:', Object.keys(doc));
      if (doc.name) console.log('name:', doc.name);
      if (doc.genericName) console.log('genericName:', doc.genericName);
      if (doc.brandNames) console.log('brandNames:', doc.brandNames);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

checkRawDrugs();
