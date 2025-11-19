const mongoose = require('mongoose');
require('dotenv').config();

async function dropCollection() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Drop the collection
    await mongoose.connection.db.collection('dosetemplates').drop();
    console.log('✅ Dropped dosetemplates collection');

  } catch (error) {
    if (error.message === 'ns not found') {
      console.log('Collection does not exist, no need to drop');
    } else {
      console.error('Error:', error.message);
    }
  } finally {
    await mongoose.connection.close();
    console.log('Connection closed');
    process.exit(0);
  }
}

dropCollection();
