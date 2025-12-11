/**
 * Reset Admin Password Script
 * Uses centralized password from config/defaults.js
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const defaults = require('../config/defaults');
require('dotenv').config();

const resetAdminPassword = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('Connected to MongoDB');

    // Find admin user
    const adminUser = await User.findOne({ role: 'admin' });

    if (!adminUser) {
      console.log('Admin user not found!');
      process.exit(1);
    }

    // Hash new password using centralized default
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(defaults.admin.password, salt);

    // Update password
    adminUser.password = hashedPassword;
    await adminUser.save();

    console.log('Admin password reset successfully!');
    console.log('New login credentials:');
    console.log('Email:', adminUser.email);
    console.log('Password:', defaults.admin.password);

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
};

resetAdminPassword();
