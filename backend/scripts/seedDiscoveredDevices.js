/**
 * Seed script for discovered network devices
 * Run: node scripts/seedDiscoveredDevices.js
 *
 * Devices discovered via network scan on 2025-11-30:
 * - Zeiss CLARUS 700 (192.168.4.29)
 * - Optovue Solix OCT (192.168.4.56)
 * - Quantel Medical B-scan (via Archives - 192.168.4.8)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Device = require('../models/Device');

const devices = [
  // Zeiss CLARUS 700 Ultra-Widefield Fundus Camera
  {
    name: 'Zeiss CLARUS 700',
    manufacturer: 'Carl Zeiss Meditec',
    model: 'CLARUS 700',
    serialNumber: 'CZM-CLARUS-001',
    type: 'fundus-camera',
    category: 'imaging',
    connection: {
      type: 'network',
      protocol: 'file-based',
      ipAddress: '192.168.4.29',
      port: 445,
      settings: {
        hostname: 'zeiss-clarus',
        shareName: 'ZEISS RETINO',
        shareProtocol: 'smb'
      }
    },
    integration: {
      status: 'connected',
      method: 'folder-sync',
      folderSync: {
        enabled: true,
        sharedFolderPath: '//192.168.4.29/ZEISS RETINO',
        filePattern: '*.jpg,*.JPG,*.pdf',
        fileFormat: 'proprietary',
        syncSchedule: '*/15 * * * *', // Every 15 minutes
        processedFolder: '/processed',
        errorFolder: '/errors'
      },
      autoSync: true,
      syncFrequency: 'realtime'
    },
    dataMapping: {
      fields: [
        { deviceField: 'PatientName', systemField: 'patient.fullName', dataType: 'string' },
        { deviceField: 'PatientID', systemField: 'patient.patientId', dataType: 'string' },
        { deviceField: 'DOB', systemField: 'patient.dateOfBirth', dataType: 'date', transformation: 'parseDate(value, "DD-MM-YYYY")' },
        { deviceField: 'Gender', systemField: 'patient.gender', dataType: 'string' },
        { deviceField: 'ExamDate', systemField: 'exam.examDate', dataType: 'datetime' },
        { deviceField: 'Eye', systemField: 'exam.laterality', dataType: 'string' }
      ],
      dateFormat: 'DD-MM-YYYY',
      encoding: 'UTF-8'
    },
    capabilities: {
      measurements: [],
      features: [
        'Ultra-Widefield Imaging',
        'Color Fundus Photography',
        'Red-Free Imaging',
        'Auto-Montage',
        'Stereoscopic Imaging'
      ],
      exportFormats: ['JPG', 'PDF', 'DICOM'],
      autoCapture: true,
      batchMode: true,
      remoteControl: false
    },
    configurations: {
      fundusCamera: {
        fieldOfView: 200, // degrees - ultra-widefield
        filterOptions: ['Color', 'Red-Free', 'FAF', 'IR'],
        mydriatic: false, // Non-mydriatic capable
        stereoscopic: true,
        autoFocus: true,
        flashIntensity: 50
      }
    },
    location: {
      facility: 'LAEL Vision / Cabinet Dr NZOLANTIMA',
      department: 'Ophthalmology',
      room: 'Imaging Room 1',
      station: 'Fundus Station'
    },
    calibration: {
      required: true,
      frequency: 'monthly'
    },
    status: {
      operational: true,
      currentStatus: 'available'
    },
    dataStorage: {
      storeRawData: true,
      storageLocation: 'local',
      retentionPeriod: 3650, // 10 years
      compressionEnabled: false,
      encryptionEnabled: false
    },
    compliance: {
      regulatoryApproval: {
        fda: true,
        ce: true
      }
    },
    documentation: {
      manual: 'https://www.zeiss.com/meditec/clarus-700-manual'
    },
    active: true
  },

  // Optovue Solix OCT
  {
    name: 'Optovue Solix OCT',
    manufacturer: 'Optovue (Visionix)',
    model: 'Solix',
    serialNumber: 'SOLIX-74003-026',
    type: 'oct',
    category: 'imaging',
    connection: {
      type: 'network',
      protocol: 'file-based',
      ipAddress: '192.168.4.56',
      port: 445,
      settings: {
        hostname: 'solix-74003-026',
        shareName: 'Export Solix OCT',
        shareProtocol: 'smb'
      }
    },
    integration: {
      status: 'connected',
      method: 'folder-sync',
      folderSync: {
        enabled: true,
        sharedFolderPath: '//192.168.4.56/Export Solix OCT',
        filePattern: '*.pdf,*.JPG,*.jpg',
        fileFormat: 'proprietary',
        syncSchedule: '*/15 * * * *', // Every 15 minutes
        processedFolder: '/processed',
        errorFolder: '/errors'
      },
      autoSync: true,
      syncFrequency: 'realtime'
    },
    dataMapping: {
      fields: [
        { deviceField: 'Patient', systemField: 'patient.fullName', dataType: 'string' },
        { deviceField: 'DOB(age)', systemField: 'patient.dateOfBirth', dataType: 'date', transformation: 'parseDate(value.split(" ")[0], "MM/DD/YYYY")' },
        { deviceField: 'Gender', systemField: 'patient.gender', dataType: 'string' },
        { deviceField: 'Ethnicity', systemField: 'patient.ethnicity', dataType: 'string' },
        { deviceField: 'Exam Date', systemField: 'exam.examDate', dataType: 'date' },
        { deviceField: 'Eye', systemField: 'exam.laterality', dataType: 'string' },
        // OCT Measurements
        { deviceField: 'ACD(mm)', systemField: 'measurements.anteriorChamberDepth', dataType: 'number', unit: 'mm' },
        { deviceField: 'AOD(mm)', systemField: 'measurements.angleOpeningDistance', dataType: 'number', unit: 'mm' },
        { deviceField: 'CT(mm)', systemField: 'measurements.cornealThickness', dataType: 'number', unit: 'mm' },
        { deviceField: 'Angle L', systemField: 'measurements.angleLeft', dataType: 'number', unit: 'degrees' },
        { deviceField: 'Angle R', systemField: 'measurements.angleRight', dataType: 'number', unit: 'degrees' },
        { deviceField: 'WTW(mm)', systemField: 'measurements.whiteToWhite', dataType: 'number', unit: 'mm' },
        { deviceField: 'Pupil Size(mm)', systemField: 'measurements.pupilSize', dataType: 'number', unit: 'mm' }
      ],
      dateFormat: 'MM/DD/YYYY',
      encoding: 'UTF-8'
    },
    capabilities: {
      measurements: [
        { name: 'Anterior Chamber Depth', code: 'ACD', unit: 'mm', range: { min: 1.5, max: 5.0 }, precision: 2 },
        { name: 'Angle Opening Distance', code: 'AOD', unit: 'mm', range: { min: 0, max: 2.0 }, precision: 2 },
        { name: 'Corneal Thickness', code: 'CT', unit: 'mm', range: { min: 0.4, max: 0.7 }, precision: 2 },
        { name: 'Anterior Trabecular Angle', code: 'ATA', unit: 'degrees', range: { min: 0, max: 90 }, precision: 1 },
        { name: 'Chamber Angle Left', code: 'ANGLE_L', unit: 'degrees', range: { min: 0, max: 90 }, precision: 2 },
        { name: 'Chamber Angle Right', code: 'ANGLE_R', unit: 'degrees', range: { min: 0, max: 90 }, precision: 2 },
        { name: 'White to White', code: 'WTW', unit: 'mm', range: { min: 10, max: 14 }, precision: 2 },
        { name: 'Pupil Size', code: 'PUPIL', unit: 'mm', range: { min: 2, max: 9 }, precision: 2 },
        { name: 'RNFL Thickness', code: 'RNFL', unit: 'um', range: { min: 40, max: 150 }, precision: 0 },
        { name: 'Ganglion Cell Complex', code: 'GCC', unit: 'um', range: { min: 50, max: 150 }, precision: 0 },
        { name: 'Macular Thickness', code: 'MAC', unit: 'um', range: { min: 200, max: 400 }, precision: 0 }
      ],
      features: [
        'Anterior Segment OCT',
        'Posterior Segment OCT',
        'FullRange AC Imaging',
        'Angle Analysis',
        'RNFL Analysis',
        'GCC Analysis',
        'Macular Analysis',
        'Progression Analysis',
        'OCTA (Angiography)'
      ],
      exportFormats: ['PDF', 'JPG', 'DICOM'],
      autoCapture: true,
      batchMode: true,
      remoteControl: false
    },
    configurations: {
      oct: {
        scanProtocols: [
          'FullRange AC',
          'Angle HD',
          'Retina HD',
          'RNFL',
          'ONH',
          'Macula 3D',
          'GCC',
          'Angio Retina',
          'Angio Disc'
        ],
        resolution: 'HD',
        scanSpeed: 80000, // A-scans per second
        averageScans: 4,
        followUpMode: true,
        analysisModules: ['Glaucoma', 'Retina', 'Anterior Segment']
      }
    },
    location: {
      facility: 'LAEL Vision / Cabinet Dr NZOLANTIMA',
      department: 'Ophthalmology',
      room: 'Imaging Room 1',
      station: 'OCT Station'
    },
    calibration: {
      required: true,
      frequency: 'monthly'
    },
    status: {
      operational: true,
      currentStatus: 'available'
    },
    dataStorage: {
      storeRawData: true,
      storageLocation: 'local',
      retentionPeriod: 3650, // 10 years
      compressionEnabled: false,
      encryptionEnabled: false
    },
    compliance: {
      regulatoryApproval: {
        fda: true,
        ce: true
      }
    },
    documentation: {
      manual: 'https://www.optovue.com/solix-manual'
    },
    statistics: {
      totalMeasurements: 9415 // 4787 PDFs + 4628 JPGs discovered
    },
    active: true
  },

  // Quantel Medical B-scan Ultrasound
  {
    name: 'Quantel Medical Compact Touch',
    manufacturer: 'Quantel Medical',
    model: 'Compact Touch',
    serialNumber: 'QM-CT-V400',
    type: 'ultrasound',
    category: 'imaging',
    connection: {
      type: 'network',
      protocol: 'file-based',
      ipAddress: '192.168.4.8',
      port: 445,
      settings: {
        hostname: 'serveur',
        shareName: 'Archives',
        shareProtocol: 'smb',
        subPath: '/Ophtalmologie'
      }
    },
    integration: {
      status: 'connected',
      method: 'folder-sync',
      folderSync: {
        enabled: true,
        sharedFolderPath: '//192.168.4.8/Archives/Ophtalmologie',
        filePattern: '*.pdf,*.jpg',
        fileFormat: 'proprietary',
        syncSchedule: '0 */2 * * *', // Every 2 hours
        processedFolder: '/processed',
        errorFolder: '/errors'
      },
      autoSync: true,
      syncFrequency: 'hourly'
    },
    dataMapping: {
      fields: [
        { deviceField: 'Patient', systemField: 'patient.fullName', dataType: 'string' },
        { deviceField: 'Date de naissance', systemField: 'patient.dateOfBirth', dataType: 'date', transformation: 'parseDate(value, "DD MMM. YYYY", "fr")' },
        { deviceField: 'Sexe', systemField: 'patient.gender', dataType: 'string' },
        { deviceField: "Date d'examen", systemField: 'exam.examDate', dataType: 'date' },
        { deviceField: 'Oeil', systemField: 'exam.laterality', dataType: 'string', transformation: 'value === "OD" ? "right" : value === "OS" ? "left" : "both"' },
        { deviceField: 'Gain', systemField: 'measurements.gain', dataType: 'number', unit: 'dB' },
        { deviceField: 'Dyn', systemField: 'measurements.dynamicRange', dataType: 'number', unit: 'dB' }
      ],
      dateFormat: 'DD MMM. YYYY',
      encoding: 'UTF-8'
    },
    capabilities: {
      measurements: [
        { name: 'Axial Length', code: 'AL', unit: 'mm', range: { min: 18, max: 35 }, precision: 2 },
        { name: 'Vitreous Length', code: 'VIT', unit: 'mm', range: { min: 10, max: 25 }, precision: 2 }
      ],
      features: [
        'B-scan Ultrasound',
        'A-scan Biometry',
        'UBM (Ultrasound Biomicroscopy)',
        'Standardized Echography',
        'Contact/Immersion modes'
      ],
      exportFormats: ['PDF', 'JPG'],
      autoCapture: false,
      batchMode: false,
      remoteControl: false
    },
    configurations: {
      // Ultrasound-specific settings
    },
    location: {
      facility: 'LAEL Vision / Cabinet Dr NZOLANTIMA',
      department: 'Ophthalmology',
      room: 'Exam Room',
      station: 'Ultrasound Station'
    },
    calibration: {
      required: true,
      frequency: 'quarterly'
    },
    status: {
      operational: true,
      currentStatus: 'available'
    },
    dataStorage: {
      storeRawData: true,
      storageLocation: 'local',
      retentionPeriod: 3650,
      compressionEnabled: false,
      encryptionEnabled: false
    },
    compliance: {
      regulatoryApproval: {
        ce: true
      }
    },
    documentation: {
      manual: 'https://www.quantel-medical.com/compact-touch'
    },
    active: true
  },

  // Archive Server (for historical data access)
  {
    name: 'Archive Server',
    manufacturer: 'ASUS',
    model: 'Workstation',
    serialNumber: 'SERVEUR-001',
    type: 'other',
    category: 'diagnostic',
    connection: {
      type: 'network',
      protocol: 'file-based',
      ipAddress: '192.168.4.8',
      port: 445,
      settings: {
        hostname: 'serveur',
        shareName: 'Archives',
        shareProtocol: 'smb'
      }
    },
    integration: {
      status: 'connected',
      method: 'folder-sync',
      folderSync: {
        enabled: true,
        sharedFolderPath: '//192.168.4.8/Archives',
        filePattern: '*.pdf,*.jpg,*.docx',
        fileFormat: 'proprietary',
        syncSchedule: '0 0 * * *', // Daily at midnight
        processedFolder: null,
        errorFolder: null
      },
      autoSync: false, // Manual sync for archive
      syncFrequency: 'daily'
    },
    capabilities: {
      measurements: [],
      features: [
        'Patient Archives',
        'Imaging Archives',
        'Laboratory Results',
        'Document Storage'
      ],
      exportFormats: ['PDF', 'JPG', 'DOCX'],
      autoCapture: false,
      batchMode: true,
      remoteControl: false
    },
    location: {
      facility: 'LAEL Vision / Cabinet Dr NZOLANTIMA',
      department: 'IT',
      room: 'Server Room',
      station: 'Archive Server'
    },
    status: {
      operational: true,
      currentStatus: 'available'
    },
    dataStorage: {
      storeRawData: true,
      storageLocation: 'local',
      retentionPeriod: 7300, // 20 years
      compressionEnabled: false,
      encryptionEnabled: false
    },
    active: true
  }
];

async function seedDevices() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/medflow';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    let created = 0;
    let updated = 0;
    const skipped = 0;

    for (const deviceData of devices) {
      // Check if device already exists by serial number or IP
      const existingDevice = await Device.findOne({
        $or: [
          { serialNumber: deviceData.serialNumber },
          { 'connection.ipAddress': deviceData.connection.ipAddress, name: deviceData.name }
        ]
      });

      if (existingDevice) {
        // Update existing device
        Object.assign(existingDevice, deviceData);
        await existingDevice.save();
        console.log(`Updated: ${deviceData.name} (${deviceData.connection.ipAddress})`);
        updated++;
      } else {
        // Create new device
        const device = new Device(deviceData);
        await device.save();
        console.log(`Created: ${deviceData.name} (${deviceData.connection.ipAddress}) - ID: ${device.deviceId}`);
        created++;
      }
    }

    console.log('\n=== Seed Summary ===');
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Total: ${devices.length}`);

    // List all devices
    console.log('\n=== All Devices ===');
    const allDevices = await Device.find({ active: true }).select('deviceId name type connection.ipAddress integration.status');
    allDevices.forEach(d => {
      console.log(`  ${d.deviceId}: ${d.name} (${d.type}) - ${d.connection?.ipAddress || 'N/A'} - ${d.integration?.status}`);
    });

  } catch (error) {
    console.error('Error seeding devices:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the seed
seedDevices();
