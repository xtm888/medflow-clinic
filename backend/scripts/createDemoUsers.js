const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Counter = require('../models/Counter');
require('dotenv').config({ path: '../.env' });

const { requireNonProduction } = require('./_guards');
requireNonProduction('createDemoUsers.js');

const createDemoUsers = async () => {
  try {
    // Connect to MongoDB with replica set
    const mongoUri = process.env.MONGODB_URI?.replace('localhost', '127.0.0.1') || 'mongodb://127.0.0.1:27017/medflow?replicaSet=rs0';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      family: 4
    });
    console.log('✅ Connected to MongoDB');

    // Demo users data
    const demoUsers = [
      {
        username: 'admin',
        email: 'admin@carevision.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'System',
        role: 'admin',
        phoneNumber: '+243900000001',
        department: 'general',
        employeeId: 'EMP001'
      },
      {
        username: 'doctor',
        email: 'doctor@carevision.com',
        password: 'doctor123',
        firstName: 'Dr. Jean',
        lastName: 'Mukendi',
        role: 'doctor',
        phoneNumber: '+243900000002',
        specialization: 'General Medicine',
        licenseNumber: 'DOC001',
        department: 'general',
        employeeId: 'EMP002'
      },
      {
        username: 'ophthalmologist',
        email: 'ophthalmologist@carevision.com',
        password: 'ophthal123',
        firstName: 'Dr. Marie',
        lastName: 'Kabanga',
        role: 'ophthalmologist',
        phoneNumber: '+243900000003',
        specialization: 'Ophthalmology',
        licenseNumber: 'OPH001',
        department: 'ophthalmology',
        employeeId: 'EMP003'
      },
      {
        username: 'nurse',
        email: 'nurse@carevision.com',
        password: 'nurse123',
        firstName: 'Sarah',
        lastName: 'Mwamba',
        role: 'nurse',
        phoneNumber: '+243900000004',
        department: 'general',
        employeeId: 'EMP004'
      },
      {
        username: 'receptionist',
        email: 'receptionist@carevision.com',
        password: 'reception123',
        firstName: 'Alice',
        lastName: 'Tshisekedi',
        role: 'receptionist',
        phoneNumber: '+243900000005',
        department: 'general',
        employeeId: 'EMP005'
      },
      {
        username: 'pharmacist',
        email: 'pharmacist@carevision.com',
        password: 'pharma123',
        firstName: 'Pierre',
        lastName: 'Kalala',
        role: 'pharmacist',
        phoneNumber: '+243900000006',
        specialization: 'Pharmacy',
        licenseNumber: 'PHA001',
        department: 'pharmacy',
        employeeId: 'EMP006'
      }
    ];

    // Create users
    for (const userData of demoUsers) {
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email: userData.email },
          { username: userData.username }
        ]
      });
      if (existingUser) {
        console.log(`User ${userData.email} already exists, skipping...`);
        continue;
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      userData.password = await bcrypt.hash(userData.password, salt);

      // Create user
      const user = await User.create(userData);
      console.log(`Created user: ${user.email} (${user.role})`);
    }

    console.log('\nDemo users created successfully!');
    console.log('\nLogin credentials:');
    console.log('==================');
    console.log('Admin: admin@carevision.com / admin123');
    console.log('Doctor: doctor@carevision.com / doctor123');
    console.log('Ophthalmologist: ophthalmologist@carevision.com / ophthal123');
    console.log('Nurse: nurse@carevision.com / nurse123');
    console.log('Receptionist: receptionist@carevision.com / reception123');
    console.log('Pharmacist: pharmacist@carevision.com / pharma123');

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error creating demo users:', error);
    process.exit(1);
  }
};

createDemoUsers();
