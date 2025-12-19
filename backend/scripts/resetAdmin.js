const mongoose = require('mongoose');
require('dotenv').config();
require('../models/User');
const defaults = require('../config/defaults');

async function resetAdmin() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
  const User = mongoose.model('User');

  const admin = await User.findOne({ email: defaults.admin.email });
  if (admin) {
    // Set PLAIN TEXT password - pre-save hook will hash it
    admin.password = defaults.admin.password;
    await admin.save();
    console.log('Admin password reset successfully');
    console.log(`📧 Email: ${defaults.admin.email}`);
    console.log(`🔑 Password: ${defaults.admin.password}`);
  } else {
    console.log('Admin user not found, creating...');
    // Set PLAIN TEXT password - pre-save hook will hash it
    const newAdmin = new User({
      username: 'admin',
      email: defaults.admin.email,
      password: defaults.admin.password,
      firstName: defaults.admin.firstName,
      lastName: defaults.admin.lastName,
      role: defaults.admin.role,
      employeeId: 'ADM-001',
      phoneNumber: '+243000000000',
      isActive: true,
      isEmailVerified: true
    });
    await newAdmin.save();
    console.log('Admin created');
    console.log(`📧 Email: ${defaults.admin.email}`);
    console.log(`🔑 Password: ${defaults.admin.password}`);
  }
  await mongoose.disconnect();
}
resetAdmin();
