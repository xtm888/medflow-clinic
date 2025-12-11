/**
 * Seed Clinics Script
 *
 * Creates initial clinic data for MedFlow multi-clinic setup
 * Updates existing admin users to have access to all clinics
 *
 * Usage: node scripts/seedClinics.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Clinic = require('../models/Clinic');
const User = require('../models/User');

const clinicsData = [
  // =====================================================
  // DÉPÔT CENTRAL - Central Warehouse
  // =====================================================
  {
    clinicId: 'DEPOT_CENTRAL',
    name: 'Dépôt Central',
    shortName: 'Dépôt',
    type: 'depot',
    address: {
      street: 'Avenue du Commerce',
      city: 'Kinshasa',
      province: 'Kinshasa',
      country: 'RDC'
    },
    contact: {
      phone: '+243 XXX XXX XXX',
      email: 'depot@centreophtalmo.cd'
    },
    services: [
      'warehouse',
      'inventory_management'
    ],
    networkShares: [],
    billing: {
      invoicePrefix: 'DEP',
      defaultCurrency: 'CDF'
    },
    pricingModifiers: {
      optical: 0,  // Base prices
      pharmacy: 0
    },
    syncConfig: {
      priority: 0, // Highest priority
      isHub: true,
      isDepot: true,
      syncInterval: 300000,
      offlineCapable: true
    },
    status: 'active',
    isActive: true
  },

  // =====================================================
  // TOMBALBAYE - Main Clinic (Kinshasa)
  // =====================================================
  {
    clinicId: 'TOMBALBAYE_KIN',
    name: 'Centre Ophtalmologique Tombalbaye',
    shortName: 'Tombalbaye',
    type: 'main',
    address: {
      street: 'Avenue Tombalbaye',
      city: 'Kinshasa',
      province: 'Kinshasa',
      country: 'RDC'
    },
    contact: {
      phone: '+243 XXX XXX XXX',
      email: 'tombalbaye@centreophtalmo.cd'
    },
    services: [
      'consultation',
      'ophthalmology',
      'optometry',
      'refraction',
      'oct',
      'visual_field',
      'fundus_photography',
      'surgery',
      'ivt_injections',
      'laser',
      'pharmacy',
      'optical_shop',
      'laboratory'
    ],
    networkShares: [
      {
        name: 'NIDEK CEM-530 Specular',
        path: '//192.168.3.28/EXAMEN',
        deviceType: 'NIDEK',
        modality: 'Specular Microscopy',
        isActive: true
      },
      {
        name: 'OCT MAESTRO',
        path: '//192.168.3.28/OCT MAESTRO',
        deviceType: 'Topcon',
        modality: 'OCT',
        isActive: true
      },
      {
        name: 'Biometry Reports',
        path: '//192.168.3.28/biometrie',
        deviceType: 'Various',
        modality: 'Biometry',
        isActive: true
      },
      {
        name: 'Surgical Microscope',
        path: '//192.168.3.28/MICROSCOPE',
        deviceType: 'NIDEK',
        modality: 'Surgery',
        isActive: true
      }
    ],
    billing: {
      invoicePrefix: 'TBY',
      defaultCurrency: 'CDF'
    },
    syncConfig: {
      priority: 1,
      isHub: true,
      syncInterval: 300000, // 5 minutes
      offlineCapable: true  // ALL sites work offline
    },
    networkConfig: {
      subnet: '192.168.3.0/24',
      gateway: '192.168.3.1'
    },
    status: 'active',
    isActive: true
  },

  // =====================================================
  // MATRIX - Secondary Clinic (Kinshasa)
  // =====================================================
  {
    clinicId: 'MATRIX_KIN',
    name: 'Centre Ophtalmologique Matrix',
    shortName: 'Matrix',
    type: 'satellite',
    address: {
      street: 'Avenue Matrix',
      city: 'Kinshasa',
      province: 'Kinshasa',
      country: 'RDC'
    },
    contact: {
      phone: '+243 XXX XXX XXX',
      email: 'matrix@centreophtalmo.cd'
    },
    services: [
      'consultation',
      'ophthalmology',
      'optometry',
      'refraction',
      'oct',
      'visual_field',
      'laser',
      'pharmacy',
      'optical_shop'
    ],
    networkShares: [],
    billing: {
      invoicePrefix: 'MTX',
      defaultCurrency: 'CDF'
    },
    syncConfig: {
      priority: 2,
      isHub: false,
      hubClinic: 'TOMBALBAYE_KIN',
      syncInterval: 600000, // 10 minutes
      offlineCapable: true  // ALL sites work offline
    },
    status: 'active',
    isActive: true
  },

  // =====================================================
  // MATADI - Regional Clinic (Kongo Central)
  // =====================================================
  {
    clinicId: 'MATADI_KC',
    name: 'Centre Ophtalmologique Matadi',
    shortName: 'Matadi',
    type: 'satellite',
    address: {
      street: 'Avenue principale',
      city: 'Matadi',
      province: 'Kongo Central',
      country: 'RDC'
    },
    contact: {
      phone: '+243 XXX XXX XXX',
      email: 'matadi@centreophtalmo.cd'
    },
    services: [
      'consultation',
      'ophthalmology',
      'optometry',
      'refraction',
      'pharmacy',
      'optical_shop'
    ],
    networkShares: [],
    billing: {
      invoicePrefix: 'MTD',
      defaultCurrency: 'CDF'
    },
    syncConfig: {
      priority: 3,
      isHub: false,
      hubClinic: 'TOMBALBAYE_KIN',
      syncInterval: 1800000, // 30 minutes (slower connection)
      offlineCapable: true
    },
    connectivity: {
      type: 'mobile', // 3G/4G
      reliability: 'intermittent'
    },
    status: 'active',
    isActive: true
  }
];

async function seedClinics() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     SEEDING CLINICS                                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('✓ Connected to MongoDB\n');

    const stats = {
      created: 0,
      existing: 0,
      usersUpdated: 0
    };

    // Create or update clinics
    for (const clinicData of clinicsData) {
      const existing = await Clinic.findOne({ clinicId: clinicData.clinicId });

      if (existing) {
        console.log(`  ⚠️  Clinic ${clinicData.clinicId} already exists`);
        stats.existing++;
      } else {
        const clinic = await Clinic.create(clinicData);
        console.log(`  ✓ Created clinic: ${clinic.name} (${clinic.clinicId})`);
        stats.created++;
      }
    }

    console.log('\n--- Updating Admin Users ---\n');

    // Get the main clinic (Tombalbaye)
    const mainClinic = await Clinic.findOne({ clinicId: 'TOMBALBAYE_KIN' });
    const allClinics = await Clinic.find({});

    // Update admin users to have access to all clinics
    const admins = await User.find({ role: 'admin' });

    for (const admin of admins) {
      admin.accessAllClinics = true;
      admin.primaryClinic = mainClinic?._id;
      admin.clinics = allClinics.map(c => c._id);
      await admin.save();
      console.log(`  ✓ Updated admin: ${admin.username} - access to all ${allClinics.length} clinics`);
      stats.usersUpdated++;
    }

    // Update managers
    const managers = await User.find({ role: 'manager' });
    for (const manager of managers) {
      manager.accessAllClinics = true;
      manager.primaryClinic = mainClinic?._id;
      manager.clinics = allClinics.map(c => c._id);
      await manager.save();
      console.log(`  ✓ Updated manager: ${manager.username} - access to all clinics`);
      stats.usersUpdated++;
    }

    // Update other staff to primary clinic only (if not already assigned)
    const otherStaff = await User.find({
      role: { $nin: ['admin', 'manager'] },
      clinics: { $size: 0 }
    });

    for (const staff of otherStaff) {
      if (mainClinic) {
        staff.primaryClinic = mainClinic._id;
        staff.clinics = [mainClinic._id];
        await staff.save();
        console.log(`  ✓ Assigned ${staff.username} to ${mainClinic.shortName}`);
        stats.usersUpdated++;
      }
    }

    // Print summary
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    SEEDING SUMMARY                            ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Clinics created:        ${String(stats.created).padStart(10)}                    ║`);
    console.log(`║  Clinics existing:       ${String(stats.existing).padStart(10)}                    ║`);
    console.log(`║  Users updated:          ${String(stats.usersUpdated).padStart(10)}                    ║`);
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    console.log('✅ Seeding completed!\n');

  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedClinics().catch(console.error);
