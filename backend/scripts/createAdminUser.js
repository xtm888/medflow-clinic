const mongoose = require('mongoose');
const User = require('../models/User');
const defaults = require('../config/defaults');
require('dotenv').config();

const { requireNonProduction } = require('./_guards');
requireNonProduction('createAdminUser.js');

async function createAdminUser() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI?.replace('localhost', '127.0.0.1') || 'mongodb://127.0.0.1:27017/medflow?replicaSet=rs0';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      family: 4
    });
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: defaults.admin.email });
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      return;
    }

    // Create admin user - PLAIN TEXT password, pre-save hook will hash it
    const adminUser = await User.create({
      username: 'admin',
      email: defaults.admin.email,
      password: defaults.admin.password,
      firstName: defaults.admin.firstName,
      lastName: defaults.admin.lastName,
      role: defaults.admin.role,
      employeeId: 'EMP001',
      phoneNumber: '+243 123456789',
      specialty: 'Administration',
      isActive: true,
      permissions: []  // Permissions are managed by role in this system
    });

    console.log('✅ Admin user created successfully!');
    console.log(`📧 Email: ${defaults.admin.email}`);
    console.log(`🔑 Password: ${defaults.admin.password}`);
    console.log('');
    console.log('You can now login with these credentials!');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

createAdminUser();
