const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const seedUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Clear existing users
    await User.deleteMany({});
    console.log('Cleared existing users');

    // Hash passwords
    const hashedPassword = await bcrypt.hash('Admin123!', 10);

    // Create users
    const users = [
      {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@medflow.com',
        password: hashedPassword,
        role: 'administrator',
        phone: '1234567890',
        isActive: true,
        specializations: [],
        licenseNumber: 'ADMIN001',
        permissions: {
          patients: { create: true, read: true, update: true, delete: true },
          appointments: { create: true, read: true, update: true, delete: true },
          medical: { create: true, read: true, update: true, delete: true },
          billing: { create: true, read: true, update: true, delete: true },
          reports: { create: true, read: true, update: true, delete: true },
          admin: { create: true, read: true, update: true, delete: true },
          prescriptions: { create: true, read: true, update: true, delete: true },
          settings: { create: true, read: true, update: true, delete: true }
        }
      },
      {
        firstName: 'Dr. John',
        lastName: 'Smith',
        email: 'doctor@medflow.com',
        password: hashedPassword,
        role: 'doctor',
        phone: '1234567891',
        isActive: true,
        specializations: ['Ophthalmology', 'Retinal Surgery'],
        licenseNumber: 'MD123456',
        permissions: {
          patients: { create: true, read: true, update: true, delete: false },
          appointments: { create: true, read: true, update: true, delete: false },
          medical: { create: true, read: true, update: true, delete: false },
          billing: { create: false, read: true, update: false, delete: false },
          reports: { create: true, read: true, update: false, delete: false },
          admin: { create: false, read: false, update: false, delete: false },
          prescriptions: { create: true, read: true, update: true, delete: true },
          settings: { create: false, read: true, update: false, delete: false }
        }
      },
      {
        firstName: 'Dr. Sarah',
        lastName: 'Johnson',
        email: 'doctor2@medflow.com',
        password: hashedPassword,
        role: 'doctor',
        phone: '1234567892',
        isActive: true,
        specializations: ['Ophthalmology', 'Pediatric Ophthalmology'],
        licenseNumber: 'MD789012',
        permissions: {
          patients: { create: true, read: true, update: true, delete: false },
          appointments: { create: true, read: true, update: true, delete: false },
          medical: { create: true, read: true, update: true, delete: false },
          billing: { create: false, read: true, update: false, delete: false },
          reports: { create: true, read: true, update: false, delete: false },
          admin: { create: false, read: false, update: false, delete: false },
          prescriptions: { create: true, read: true, update: true, delete: true },
          settings: { create: false, read: true, update: false, delete: false }
        }
      },
      {
        firstName: 'Emily',
        lastName: 'Davis',
        email: 'technician@medflow.com',
        password: hashedPassword,
        role: 'technician',
        phone: '1234567893',
        isActive: true,
        specializations: [],
        licenseNumber: 'TECH001',
        permissions: {
          patients: { create: false, read: true, update: true, delete: false },
          appointments: { create: false, read: true, update: true, delete: false },
          medical: { create: false, read: true, update: true, delete: false },
          billing: { create: false, read: false, update: false, delete: false },
          reports: { create: false, read: true, update: false, delete: false },
          admin: { create: false, read: false, update: false, delete: false },
          prescriptions: { create: false, read: true, update: false, delete: false },
          settings: { create: false, read: false, update: false, delete: false }
        }
      },
      {
        firstName: 'Michael',
        lastName: 'Wilson',
        email: 'reception@medflow.com',
        password: hashedPassword,
        role: 'receptionist',
        phone: '1234567894',
        isActive: true,
        specializations: [],
        licenseNumber: 'RECEP001',
        permissions: {
          patients: { create: true, read: true, update: true, delete: false },
          appointments: { create: true, read: true, update: true, delete: true },
          medical: { create: false, read: false, update: false, delete: false },
          billing: { create: true, read: true, update: true, delete: false },
          reports: { create: false, read: true, update: false, delete: false },
          admin: { create: false, read: false, update: false, delete: false },
          prescriptions: { create: false, read: true, update: false, delete: false },
          settings: { create: false, read: false, update: false, delete: false }
        }
      }
    ];

    // Create users
    const createdUsers = await User.insertMany(users);
    console.log(`Created ${createdUsers.length} users`);

    // Display login credentials
    console.log('\n=== Login Credentials ===');
    console.log('All users have the same password: Admin123!\n');
    users.forEach(user => {
      console.log(`${user.role.toUpperCase()}:`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: Admin123!`);
      console.log('');
    });

    console.log('✅ Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedUsers();