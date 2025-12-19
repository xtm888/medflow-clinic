const mongoose = require('mongoose');
const User = require('../models/User');
const defaults = require('../config/defaults');

async function createAdminUser() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/medflow');
    console.log('✅ Connected to MongoDB\n');

    // Delete existing admin if exists
    const existing = await User.findOne({ email: defaults.admin.email });
    if (existing) {
      await User.deleteOne({ email: defaults.admin.email });
      console.log('🗑️  Deleted existing admin user');
    }

    // Create admin user with PLAIN password
    // The pre-save hook will hash it automatically
    const adminUser = new User({
      username: 'admin',
      email: defaults.admin.email,
      password: defaults.admin.password,  // PLAIN password - will be hashed by pre-save hook
      firstName: defaults.admin.firstName,
      lastName: defaults.admin.lastName,
      role: defaults.admin.role,
      employeeId: 'EMP001',
      phoneNumber: '+243 123456789',
      specialty: 'Administration',
      isActive: true,
      permissions: []
    });

    await adminUser.save();

    // Verify password was saved
    const savedUser = await User.findOne({ email: defaults.admin.email }).select('+password');
    console.log('\n✅ Admin user created successfully!');
    console.log(`📧 Email: ${defaults.admin.email}`);
    console.log(`🔑 Password: ${defaults.admin.password}`);
    console.log('✓ Password saved:', !!savedUser.password);
    console.log('✓ Password length:', savedUser.password?.length || 0);
    console.log('\nYou can now login with these credentials!');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createAdminUser();
