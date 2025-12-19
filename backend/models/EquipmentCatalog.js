const mongoose = require('mongoose');

// Based on equipment PDF - complete device catalog
const equipmentCatalogSchema = new mongoose.Schema({
  equipmentId: {
    type: String,
    unique: true,
    required: true
  },
  name: {
    type: String,
    required: true
    // Removed enum to allow ALL equipment including laboratory devices
  },
  manufacturer: {
    type: String,
    enum: ['Topcon', 'Nidek', 'Zeiss', 'Haag-Streit', 'Humphrey', 'Optovue', 'Tomey', 'Aurolab', 'Plusoptix', 'Esilor', 'Keeler', 'Quantal', 'Mindray', 'Boditech', 'Fluocare', 'Human', 'Awareness', 'Other']
  },
  category: {
    type: String,
    enum: [
      // Ophthalmology Equipment
      'OCT',
      'Slit Lamp',
      'Autorefractor',
      'Keratometer',
      'Visual Field',
      'Fundus Camera',
      'Tonometer',
      'Pachymeter',
      'IOL Master',
      'Specular Microscope',
      'Ultrasound',
      'Lensometer',

      // Laboratory Equipment - ALL INCLUDED AS REQUESTED
      'Laboratory - Hematology',
      'Laboratory - Biochemistry',
      'Laboratory - Immunology',
      'Laboratory - Hormones',

      'Other Diagnostic'
    ],
    required: true
  },
  site: {
    type: String,
    enum: ['MATRIX', 'TOMBALBAYE', 'MATADI'],
    required: true
  },
  connectionType: {
    type: String,
    enum: ['Network', 'WiFi', 'Bluetooth', 'USB', 'Manual', 'Not Connected'],
    required: true
  },
  connectionStatus: {
    type: String,
    enum: ['Connected', 'Not Connected', 'Pending Setup'],
    default: 'Not Connected'
  },
  networkConfig: {
    ipAddress: String,
    port: Number,
    protocol: {
      type: String,
      enum: ['HTTP', 'TCP', 'DICOM', 'HL7', 'Custom']
    },
    sharedFolder: String  // For file-based integration
  },
  dataExportMethod: {
    type: String,
    enum: [
      'Export to shared folder',
      'Direct API',
      'Manual entry',
      'Thermal printer',
      'WiFi/Bluetooth transfer',
      'DICOM export'
    ]
  },
  supportedMeasurements: [{
    type: String,
    enum: [
      // Ophthalmology measurements
      'visual_acuity',
      'refraction',
      'keratometry',
      'tonometry',
      'pachymetry',
      'visual_field',
      'oct_macula',
      'oct_nerve',
      'fundus_photo',
      'slit_lamp_photo',
      'biometry',
      'specular_count',
      'topography',
      'fundus_exam',
      'aberrometry',
      'lens_power',
      'ultrasound',

      // Laboratory measurements - ALL INCLUDED
      'complete_blood_count',
      'biochemistry_panel',
      'hormone_tests',
      'immunoassay',
      'glucose',
      'cholesterol',
      'liver_function',
      'kidney_function'
    ]
  }],
  integrationAdapter: {
    type: String,
    enum: ['TopconAdapter', 'NidekAdapter', 'ZeissAdapter', 'GenericFileAdapter', 'ManualAdapter']
  },
  lastSync: Date,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Add index for quick lookups
equipmentCatalogSchema.index({ site: 1, category: 1 });
equipmentCatalogSchema.index({ connectionStatus: 1 });

module.exports = mongoose.model('EquipmentCatalog', equipmentCatalogSchema);
