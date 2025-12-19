const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const defaults = require('../config/defaults');

async function fixAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('Connected to MongoDB');

    // Delete existing admin
    await User.deleteOne({ email: defaults.admin.email });
    console.log('Deleted old admin user');

    // Create new admin with PLAIN TEXT password (let pre-save hook hash it)
    const adminUser = new User({
      username: 'admin',
      email: defaults.admin.email,
      password: defaults.admin.password,  // Plain text - pre-save hook will hash it
      firstName: defaults.admin.firstName,
      lastName: defaults.admin.lastName,
      role: defaults.admin.role,
      employeeId: 'EMP001',
      phoneNumber: '+243 123456789',
      specialty: 'Administration',
      isActive: true,
      isEmailVerified: true,
      permissions: []
    });

    await adminUser.save();
    console.log('✅ Admin user created successfully!');
    console.log(`📧 Email: ${defaults.admin.email}`);
    console.log(`🔑 Password: ${defaults.admin.password}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixAdmin();
