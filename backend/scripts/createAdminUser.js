const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

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
    const existingAdmin = await User.findOne({ email: 'admin@medflow.com' });
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const adminUser = await User.create({
      username: 'admin',
      email: 'admin@medflow.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      employeeId: 'EMP001',
      phoneNumber: '+243 123456789',
      specialty: 'Administration',
      isActive: true,
      permissions: []  // Permissions are managed by role in this system
    });

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@medflow.com');
    console.log('🔑 Password: admin123');
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