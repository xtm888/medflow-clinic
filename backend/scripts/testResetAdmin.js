require('dotenv').config();
const { requireNonProduction } = require('./_guards');
requireNonProduction('testResetAdmin.js');

const mongoose = require('mongoose');

async function resetAdmin() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
  const User = require('../models/User');

  // Find admin user
  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    console.log('No admin user found');
    process.exit(1);
  }

  console.log('Found admin:', admin.email);

  // Update password directly
  admin.password = 'Admin123';
  await admin.save();

  console.log('Password reset to: Admin123');

  await mongoose.disconnect();
}

resetAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});
