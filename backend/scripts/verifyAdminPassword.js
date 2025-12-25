require('dotenv').config();
const { requireNonProduction } = require('./_guards');
requireNonProduction('verifyAdminPassword.js');

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function verifyAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('Connected to MongoDB\n');

    // Explicitly select password field
    const admin = await User.findOne({ email: 'admin@medflow.com' }).select('+password');

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

      // Test password verification
      if (admin.password) {
        const testPassword = 'admin123';
        const isMatch = await bcrypt.compare(testPassword, admin.password);
        console.log('\n🔑 Password test (admin123):', isMatch ? '✅ CORRECT' : '❌ INCORRECT');
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

verifyAdmin();
