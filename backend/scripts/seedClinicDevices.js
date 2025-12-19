/**
 * Seed Clinic Network Devices
 *
 * Based on network scan of the Kinshasa clinic
 * Registers all discovered medical imaging devices and file shares
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Device = require('../models/Device');
const Clinic = require('../models/Clinic');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medflow?replicaSet=rs0';

// Discovered devices from network scan
// Updated to match Device model schema enum values
const discoveredDevices = [
  // =====================================================
  // SERVERLV - Main File Server
  // =====================================================
  {
    deviceId: 'SERVERLV_ARCHIVES',
    name: 'Archives Patients (ServeurLV)',
    type: 'other',
    manufacturer: 'Windows Server',
    model: 'File Share',
    category: 'diagnostic',
    connection: {
      type: 'network',
      protocol: 'file-based',
      settings: {
        shareProtocol: 'smb',
        host: 'serverlv',
        shareName: 'Archives',
        sharePath: '//serverlv/Archives',
        credentials: { username: 'guest', domain: '' }
      }
    },
    capabilities: {
      features: ['patient_documents', 'approval_scans', 'medical_reports'],
      exportFormats: ['jpg', 'png', 'pdf']
    },
    integration: {
      status: 'pending',
      method: 'folder-sync',
      folderSync: {
        enabled: true,
        sharedFolderPath: '/Volumes/Archives',
        filePattern: '*',
        syncSchedule: '*/15 * * * *'
      }
    },
    location: {
      facility: 'Kinshasa',
      department: 'Archive',
      room: 'Server Room'
    }
  },
  {
    deviceId: 'SERVERLV_BACKUPS',
    name: 'Sauvegardes DMI (ServeurLV)',
    type: 'other',
    manufacturer: 'Windows Server',
    model: 'Database Backups',
    category: 'diagnostic',
    connection: {
      type: 'network',
      protocol: 'file-based',
      settings: {
        shareProtocol: 'smb',
        host: 'serverlv',
        shareName: 'SauvegardesDMI',
        sharePath: '//serverlv/SauvegardesDMI'
      }
    },
    capabilities: {
      features: ['database_backup'],
      exportFormats: ['bak']
    },
    integration: {
      status: 'pending',
      method: 'manual'
    },
    location: {
      facility: 'Kinshasa',
      department: 'IT',
      room: 'Server Room'
    }
  },

  // =====================================================
  // ACQUISITION - NIDEK Specular Microscopy
  // =====================================================
  {
    deviceId: 'NIDEK_CEM530',
    name: 'NIDEK CEM-530 Specular Microscope',
    type: 'specular-microscope',
    manufacturer: 'NIDEK',
    model: 'CEM-530',
    serialNumber: '033B0C',
    category: 'imaging',
    connection: {
      type: 'network',
      protocol: 'file-based',
      settings: {
        shareProtocol: 'smb',
        host: 'acquisition',
        shareName: 'EXAMEN',
        sharePath: '//acquisition/EXAMEN',
        filePattern: '{id}_{date}_{time}_NIDEK-CEM530_{serial}.xml'
      }
    },
    dataMapping: {
      fields: [
        { deviceField: 'CD', systemField: 'cellDensity', dataType: 'number', unit: 'cells/mm²' },
        { deviceField: 'CV', systemField: 'coefficientOfVariation', dataType: 'number', unit: '%' },
        { deviceField: 'HEX', systemField: 'hexagonality', dataType: 'number', unit: '%' },
        { deviceField: 'CCT', systemField: 'centralCornealThickness', dataType: 'number', unit: 'µm' }
      ]
    },
    capabilities: {
      measurements: [
        { name: 'Cell Density', code: 'CD', unit: 'cells/mm²', range: { min: 500, max: 4000 } },
        { name: 'Coefficient of Variation', code: 'CV', unit: '%', range: { min: 0, max: 100 } },
        { name: 'Hexagonality', code: 'HEX', unit: '%', range: { min: 0, max: 100 } },
        { name: 'Central Corneal Thickness', code: 'CCT', unit: 'µm', range: { min: 400, max: 700 } }
      ],
      features: ['corneal_endothelium', 'cell_density', 'cell_morphology', 'pachymetry'],
      exportFormats: ['xml', 'jpg', 'bmp']
    },
    integration: {
      status: 'pending',
      method: 'folder-sync',
      folderSync: {
        enabled: true,
        sharedFolderPath: '/Volumes/EXAMEN',
        filePattern: '*.xml',
        fileFormat: 'xml',
        syncSchedule: '*/5 * * * *'
      }
    },
    location: {
      facility: 'Kinshasa',
      department: 'Ophthalmology',
      room: 'Exam Room 1'
    }
  },
  {
    deviceId: 'NIDEK_MICROSCOPE',
    name: 'NIDEK Surgical Microscope',
    type: 'other',
    manufacturer: 'NIDEK',
    model: 'Surgical Microscope',
    category: 'surgical',
    connection: {
      type: 'network',
      protocol: 'file-based',
      settings: {
        shareProtocol: 'smb',
        host: 'acquisition',
        shareName: 'MICROSCOPE',
        sharePath: '//acquisition/MICROSCOPE'
      }
    },
    capabilities: {
      features: ['surgical_video', 'surgical_photos'],
      exportFormats: ['jpg', 'bmp', 'mp4']
    },
    integration: {
      status: 'pending',
      method: 'folder-sync',
      folderSync: {
        enabled: true,
        sharedFolderPath: '/Volumes/MICROSCOPE'
      }
    },
    location: {
      facility: 'Kinshasa',
      department: 'Surgery',
      room: 'OR 1'
    }
  },

  // =====================================================
  // BIOMETRIE - IOL Biometry Reports
  // =====================================================
  {
    deviceId: 'BIOMETRIE_REPORTS',
    name: 'Biometry Reports (PDF)',
    type: 'biometer',
    manufacturer: 'Various',
    model: 'PDF Reports',
    category: 'measurement',
    connection: {
      type: 'network',
      protocol: 'file-based',
      settings: {
        shareProtocol: 'smb',
        host: 'acquisition',
        shareName: 'biometrie',
        sharePath: '//acquisition/biometrie'
      }
    },
    capabilities: {
      features: ['iol_calculation', 'axial_length', 'keratometry'],
      exportFormats: ['pdf']
    },
    integration: {
      status: 'pending',
      method: 'folder-sync',
      folderSync: {
        enabled: true,
        sharedFolderPath: '/Volumes/biometrie',
        syncSchedule: '0 */1 * * *'
      }
    },
    location: {
      facility: 'Kinshasa',
      department: 'Ophthalmology',
      room: 'Biometry Room'
    }
  },

  // =====================================================
  // IOLMASTER700 - Zeiss IOL Master (Currently Offline)
  // =====================================================
  {
    deviceId: 'ZEISS_IOLMASTER700',
    name: 'Zeiss IOL Master 700',
    type: 'iol-master',
    manufacturer: 'Carl Zeiss Meditec',
    model: 'IOL Master 700',
    category: 'measurement',
    connection: {
      type: 'network',
      protocol: 'dicom',
      settings: {
        shareProtocol: 'smb',
        hostname: 'iolmaster700',
        shareName: 'Export',
        sharePath: '//iolmaster700/Export',
        dicomSupport: true
      }
    },
    capabilities: {
      measurements: [
        { name: 'Axial Length', code: 'AL', unit: 'mm', range: { min: 20, max: 35 } },
        { name: 'Keratometry', code: 'K', unit: 'D', range: { min: 35, max: 52 } },
        { name: 'Anterior Chamber Depth', code: 'ACD', unit: 'mm', range: { min: 1.5, max: 5 } },
        { name: 'White to White', code: 'WTW', unit: 'mm', range: { min: 10, max: 14 } }
      ],
      features: ['biometry', 'iol_calculation', 'swept_source_oct', 'keratometry', 'pupillometry', 'white_to_white'],
      exportFormats: ['xml', 'jpg', 'png', 'dicom']
    },
    integration: {
      status: 'disconnected',
      method: 'folder-sync',
      folderSync: {
        enabled: true,
        sharedFolderPath: '/Volumes/Export',
        syncSchedule: '*/10 * * * *'
      }
    },
    location: {
      facility: 'Kinshasa',
      department: 'Ophthalmology',
      room: 'Biometry Room'
    }
  },

  // =====================================================
  // OPTIQUE - Convention/Approval Documents
  // =====================================================
  {
    deviceId: 'OPTIQUE_CONVENTIONS',
    name: 'Dossiers Conventions (Optique)',
    type: 'other',
    manufacturer: 'Windows PC',
    model: 'File Share',
    category: 'diagnostic',
    connection: {
      type: 'network',
      protocol: 'file-based',
      settings: {
        shareProtocol: 'smb',
        host: 'optique',
        shareName: 'CONVENTIONS',
        sharePath: '//optique/CONVENTIONS'
      }
    },
    capabilities: {
      features: ['approval_documents', 'convention_invoices'],
      exportFormats: ['pdf', 'xlsx', 'docx', 'jpg']
    },
    integration: {
      status: 'pending',
      method: 'folder-sync',
      folderSync: {
        enabled: true,
        sharedFolderPath: '/Volumes/CONVENTIONS',
        syncSchedule: '0 */2 * * *'
      }
    },
    location: {
      facility: 'Kinshasa',
      department: 'Optical',
      room: 'Optique Office'
    }
  },

  // =====================================================
  // OCT - (Mount Failed - Needs Investigation)
  // =====================================================
  {
    deviceId: 'OCT_SHARE',
    name: 'OCT Images Share',
    type: 'oct',
    manufacturer: 'Unknown',
    model: 'OCT Device',
    category: 'imaging',
    connection: {
      type: 'network',
      protocol: 'file-based',
      settings: {
        shareProtocol: 'smb',
        host: 'acquisition',
        shareName: 'OCT',
        sharePath: '//acquisition/OCT'
      }
    },
    capabilities: {
      features: ['oct_scan', 'retinal_imaging'],
      exportFormats: ['jpg', 'png', 'dcm']
    },
    integration: {
      status: 'error',
      method: 'folder-sync',
      folderSync: {
        enabled: false,
        sharedFolderPath: '/Volumes/OCT'
      }
    },
    location: {
      facility: 'Kinshasa',
      department: 'Ophthalmology',
      room: 'Imaging Room'
    }
  }
];

async function seedDevices() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the main Tombalbaye clinic (don't create a new one)
    let clinic = await Clinic.findOne({ clinicId: 'TOMBALBAYE_KIN' });
    if (!clinic) {
      // Fallback: try to find any active clinic
      clinic = await Clinic.findOne({ status: 'active' });
    }

    if (!clinic) {
      console.error('❌ No clinic found. Please run seedClinics.js first.');
      process.exit(1);
    }

    console.log(`\nSeeding devices for clinic: ${clinic.name}`);
    console.log('='.repeat(60));

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const deviceData of discoveredDevices) {
      try {
        // Add clinic reference
        deviceData.clinic = clinic._id;

        const existing = await Device.findOne({ deviceId: deviceData.deviceId });

        if (existing) {
          // Update existing device
          await Device.findByIdAndUpdate(existing._id, deviceData);
          console.log(`✓ Updated: ${deviceData.name}`);
          updated++;
        } else {
          // Create new device
          await Device.create(deviceData);
          console.log(`✓ Created: ${deviceData.name}`);
          created++;
        }
      } catch (err) {
        console.error(`✗ Error with ${deviceData.name}: ${err.message}`);
        errors++;
      }
    }

    // Update clinic with network share references
    const networkShares = discoveredDevices
      .filter(d => d.connection?.sharePath)
      .map(d => ({
        name: d.name,
        path: d.connection.sharePath,
        deviceType: d.type,
        modality: d.category,
        isActive: d.status === 'active'
      }));

    await Clinic.findByIdAndUpdate(clinic._id, {
      $set: { networkShares }
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Summary: ${created} created, ${updated} updated, ${errors} errors`);
    console.log(`Network shares registered: ${networkShares.length}`);

    await mongoose.connection.close();
    console.log('\nDone!');

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

seedDevices();
