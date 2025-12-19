const mongoose = require('mongoose');
require('dotenv').config();
const defaults = require('../config/defaults');

async function unlockAdmin() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
  const User = require('../models/User');

  // Find admin user
  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    console.log('No admin user found');
    process.exit(1);
  }

  console.log('Found admin:', admin.email);
  console.log('Current lockUntil:', admin.lockUntil);
  console.log('Current failedLoginAttempts:', admin.failedLoginAttempts);

  // Unlock
  admin.lockUntil = null;
  admin.failedLoginAttempts = 0;
  admin.password = defaults.admin.password;
  await admin.save();

  console.log(`Admin account unlocked and password reset to: ${defaults.admin.password}`);

  await mongoose.disconnect();
}

unlockAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});
