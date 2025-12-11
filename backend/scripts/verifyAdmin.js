const mongoose = require('mongoose');
const User = require('../models/User');

async function verifyAdmin() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/medflow');
    console.log('Connected to MongoDB\n');

    const admin = await User.findOne({ email: 'admin@medflow.com' });

    if (!admin) {
      console.log('❌ Admin user NOT found');
    } else {
      console.log('✅ Admin user found');
      console.log('Email:', admin.email);
      console.log('Role:', admin.role);
      console.log('Has password:', !!admin.password);
      console.log('Password length:', admin.password?.length || 0);
      console.log('Is Active:', admin.isActive);
      console.log('Username:', admin.username);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

verifyAdmin();
