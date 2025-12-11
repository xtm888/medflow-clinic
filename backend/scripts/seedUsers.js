/**
 * Seed Users Script
 *
 * Creates default users for the MedFlow system
 * Uses centralized password from config/defaults.js for consistency
 *
 * Run with: node scripts/seedUsers.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const defaults = require('../config/defaults');
require('dotenv').config();

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('Connected to MongoDB');

    // Get clinics for assignment
    const clinics = await Clinic.find({ isActive: true });
    const clinicIds = clinics.map(c => c._id);

    // Clear existing users
    await User.deleteMany({});
    console.log('Cleared existing users');

    // Use centralized password from config/defaults.js for consistency
    const defaultPassword = defaults.testUsers.password;
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    console.log(`Using password: ${defaultPassword}`);

    // Create users with proper schema fields
    const users = [
      {
        username: 'admin',
        firstName: 'Admin',
        lastName: 'System',
        email: 'admin@medflow.com',
        password: hashedPassword,
        phoneNumber: '+243810000001',
        role: 'admin',
        employeeId: 'EMP-001',
        department: 'general',
        shift: 'flexible',
        isActive: true,
        clinics: clinicIds
      },
      {
        username: 'dr.kabila',
        firstName: 'Joseph',
        lastName: 'Kabila',
        email: 'dr.kabila@medflow.com',
        password: hashedPassword,
        phoneNumber: '+243810000002',
        role: 'ophthalmologist',
        employeeId: 'EMP-002',
        department: 'ophthalmology',
        shift: 'morning',
        isActive: true,
        clinics: clinicIds.slice(0, 2),
        specialization: 'Cataract Surgery, Glaucoma, Retina',
        licenseNumber: 'ORD-RDC-2024-001'
      },
      {
        username: 'dr.tshisekedi',
        firstName: 'Félix',
        lastName: 'Tshisekedi',
        email: 'dr.tshisekedi@medflow.com',
        password: hashedPassword,
        phoneNumber: '+243810000003',
        role: 'ophthalmologist',
        employeeId: 'EMP-003',
        department: 'ophthalmology',
        shift: 'afternoon',
        isActive: true,
        clinics: clinicIds.slice(1, 3),
        specialization: 'Pediatric Ophthalmology, Strabismus',
        licenseNumber: 'ORD-RDC-2024-002'
      },
      {
        username: 'dr.lumumba',
        firstName: 'Patrice',
        lastName: 'Lumumba',
        email: 'dr.lumumba@medflow.com',
        password: hashedPassword,
        phoneNumber: '+243810000004',
        role: 'doctor',
        employeeId: 'EMP-004',
        department: 'general',
        shift: 'morning',
        isActive: true,
        clinics: clinicIds.slice(0, 1),
        specialization: 'General Medicine',
        licenseNumber: 'MED-RDC-2024-001'
      },
      {
        username: 'nurse.marie',
        firstName: 'Marie',
        lastName: 'Lukusa',
        email: 'nurse.marie@medflow.com',
        password: hashedPassword,
        phoneNumber: '+243810000005',
        role: 'nurse',
        employeeId: 'EMP-005',
        department: 'ophthalmology',
        shift: 'morning',
        isActive: true,
        clinics: clinicIds.slice(0, 2)
      },
      {
        username: 'tech.jean',
        firstName: 'Jean',
        lastName: 'Ilunga',
        email: 'tech.jean@medflow.com',
        password: hashedPassword,
        phoneNumber: '+243810000006',
        role: 'technician',
        employeeId: 'EMP-006',
        department: 'ophthalmology',
        shift: 'morning',
        isActive: true,
        clinics: clinicIds.slice(0, 2)
      },
      {
        username: 'reception.nkulu',
        firstName: 'Nkulu',
        lastName: 'Mwamba',
        email: 'reception@medflow.com',
        password: hashedPassword,
        phoneNumber: '+243810000007',
        role: 'receptionist',
        employeeId: 'EMP-007',
        department: 'general',
        shift: 'morning',
        isActive: true,
        clinics: clinicIds.slice(0, 1)
      },
      {
        username: 'pharma.tshala',
        firstName: 'Tshala',
        lastName: 'Muana',
        email: 'pharmacy@medflow.com',
        password: hashedPassword,
        phoneNumber: '+243810000008',
        role: 'pharmacist',
        employeeId: 'EMP-008',
        department: 'pharmacy',
        shift: 'morning',
        isActive: true,
        clinics: clinicIds,
        licenseNumber: 'PHARM-RDC-2024-001'
      },
      {
        username: 'lab.kasongo',
        firstName: 'Kasongo',
        lastName: 'Mutombo',
        email: 'lab@medflow.com',
        password: hashedPassword,
        phoneNumber: '+243810000009',
        role: 'lab_technician',
        employeeId: 'EMP-009',
        department: 'laboratory',
        shift: 'morning',
        isActive: true,
        clinics: clinicIds.slice(1, 3)
      },
      {
        username: 'orthoptist.grace',
        firstName: 'Grace',
        lastName: 'Mbombo',
        email: 'orthoptist@medflow.com',
        password: hashedPassword,
        phoneNumber: '+243810000010',
        role: 'orthoptist',
        employeeId: 'EMP-010',
        department: 'ophthalmology',
        shift: 'morning',
        isActive: true,
        clinics: clinicIds.slice(0, 2)
      },
      {
        username: 'optometrist.paul',
        firstName: 'Paul',
        lastName: 'Kambale',
        email: 'optometrist@medflow.com',
        password: hashedPassword,
        phoneNumber: '+243810000011',
        role: 'optometrist',
        employeeId: 'EMP-011',
        department: 'ophthalmology',
        shift: 'afternoon',
        isActive: true,
        clinics: clinicIds.slice(0, 1)
      },
      {
        username: 'accountant.jose',
        firstName: 'José',
        lastName: 'Makila',
        email: 'accountant@medflow.com',
        password: hashedPassword,
        phoneNumber: '+243810000012',
        role: 'accountant',
        employeeId: 'EMP-012',
        department: 'general',
        shift: 'morning',
        isActive: true,
        clinics: clinicIds
      },
      {
        username: 'manager.sarah',
        firstName: 'Sarah',
        lastName: 'Kimba',
        email: 'manager@medflow.com',
        password: hashedPassword,
        phoneNumber: '+243810000013',
        role: 'manager',
        employeeId: 'EMP-013',
        department: 'general',
        shift: 'flexible',
        isActive: true,
        clinics: clinicIds
      }
    ];

    // Create users
    const createdUsers = await User.insertMany(users);
    console.log(`\n✅ Created ${createdUsers.length} users\n`);

    // Display login credentials
    console.log('═'.repeat(60));
    console.log('LOGIN CREDENTIALS');
    console.log('═'.repeat(60));
    console.log(`Password for all users: ${defaultPassword}\n`);

    // Group by role
    const byRole = {};
    users.forEach(user => {
      if (!byRole[user.role]) byRole[user.role] = [];
      byRole[user.role].push(user);
    });

    Object.entries(byRole).forEach(([role, users]) => {
      console.log(`${role.toUpperCase()}:`);
      users.forEach(user => {
        console.log(`  ${user.username} (${user.email})`);
      });
      console.log('');
    });

    console.log('═'.repeat(60));
    console.log('✅ User seeding completed successfully!');
    console.log('═'.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedUsers();
