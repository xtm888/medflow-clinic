/**
 * Update device configurations with discovered network mount paths
 * Run: node scripts/updateDevicePaths.js
 */

require('dotenv').config();
const { requireNonProduction } = require('./_guards');
requireNonProduction('updateDevicePaths.js');

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

// Device path updates based on network discovery
const deviceUpdates = [
  {
    deviceId: 'OCT0001',
    name: 'Optovue Solix OCT',
    updates: {
      sharedFolderPath: '/Volumes/Export Solix OCT',
      connectionType: 'smb',
      ipAddress: '192.168.4.56',
      status: 'online',
      lastSeen: new Date(),
      notes: 'Updated from network discovery - 551 patient folders, 9,781 files (OCT scans, PDFs, JPGs)'
    }
  },
  {
    deviceId: 'OTH0001',
    name: 'Archive Server',
    updates: {
      sharedFolderPath: '/Volumes/Archives',
      connectionType: 'smb',
      ipAddress: '192.168.4.8',
      status: 'online',
      lastSeen: new Date(),
      notes: 'Updated from network discovery - Contains ArchivesPatients, Ophtalmologie, Imagerie, Laboratoire folders'
    }
  },
  {
    deviceId: 'ULT0001',
    name: 'Quantel Medical Compact Touch',
    updates: {
      sharedFolderPath: '/Volumes/Archives/Ophtalmologie',
      connectionType: 'smb',
      ipAddress: '192.168.4.8',
      status: 'online',
      lastSeen: new Date(),
      notes: 'Updated from network discovery - Ultrasound/biometry scans stored in Ophtalmologie folder'
    }
  },
  {
    deviceId: 'FUN0001',
    name: 'Zeiss CLARUS 700',
    updates: {
      sharedFolderPath: '//192.168.4.29/ZEISS RETINO',
      connectionType: 'smb',
      ipAddress: '192.168.4.29',
      status: 'online',
      lastSeen: new Date(),
      notes: 'Zeiss fundus camera - requires manual SMB mount or direct network access'
    }
  }
];

// New device to add: TOMEY (topography/keratometry)
const newDevice = {
  name: 'TOMEY Topographer',
  deviceId: 'TOP0001',
  deviceType: 'topographer',
  manufacturer: 'TOMEY',
  model: 'Unknown',
  sharedFolderPath: '/Volumes/TOMEY DATA',
  connectionType: 'smb',
  ipAddress: '192.168.4.0', // Need to identify correct IP
  status: 'online',
  lastSeen: new Date(),
  notes: 'Added from network discovery - 587 files (topography/keratometry sheets)',
  autoSync: true,
  syncInterval: 300000, // 5 minutes
  filePatterns: ['*.pdf', '*.jpg', '*.jpeg', '*.png'],
  patientIdPattern: '([A-Z]+)\\s+([A-Z]+)',
  createdBy: null // Will be set to admin
};

async function updateDevices() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the Device model
    const Device = mongoose.model('Device', new mongoose.Schema({}, { strict: false }), 'devices');

    // Get admin user for createdBy field
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const admin = await User.findOne({ role: 'admin' });

    console.log('\n=== Updating existing devices ===\n');

    for (const device of deviceUpdates) {
      const result = await Device.findOneAndUpdate(
        { deviceId: device.deviceId },
        { $set: device.updates },
        { new: true }
      );

      if (result) {
        console.log(`✓ Updated ${device.name} (${device.deviceId})`);
        console.log(`  Path: ${device.updates.sharedFolderPath}`);
      } else {
        console.log(`✗ Device not found: ${device.name} (${device.deviceId})`);
      }
    }

    console.log('\n=== Adding new device: TOMEY Topographer ===\n');

    // Check if TOMEY device already exists
    const existingTomey = await Device.findOne({ deviceId: 'TOP0001' });

    if (existingTomey) {
      // Update existing
      await Device.findOneAndUpdate(
        { deviceId: 'TOP0001' },
        { $set: { ...newDevice, createdBy: admin?._id } }
      );
      console.log('✓ Updated existing TOMEY Topographer');
    } else {
      // Create new
      await Device.create({ ...newDevice, createdBy: admin?._id });
      console.log('✓ Created new TOMEY Topographer device');
    }
    console.log(`  Path: ${newDevice.sharedFolderPath}`);

    // Show final device list
    console.log('\n=== Final Device Configuration ===\n');
    const allDevices = await Device.find({}).select('name deviceId sharedFolderPath status');

    for (const d of allDevices) {
      console.log(`${d.name}`);
      console.log(`  ID: ${d.deviceId}`);
      console.log(`  Path: ${d.sharedFolderPath}`);
      console.log(`  Status: ${d.status}`);
      console.log('');
    }

    console.log('✓ All device configurations updated successfully!');

  } catch (error) {
    console.error('Error updating devices:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

updateDevices();
