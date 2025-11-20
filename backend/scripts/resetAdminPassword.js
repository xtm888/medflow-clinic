const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' });

const resetAdminPassword = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('Connected to MongoDB');

    // Find admin user
    const adminUser = await User.findOne({ email: 'admin@carevision.com' });

    if (!adminUser) {
      console.log('Admin user not found!');
      process.exit(1);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    // Update password
    adminUser.password = hashedPassword;
    await adminUser.save();

    console.log('Admin password reset successfully!');
    console.log('New login credentials:');
    console.log('Email: admin@carevision.com');
    console.log('Password: admin123');

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
};

resetAdminPassword();