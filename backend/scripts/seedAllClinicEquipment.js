const mongoose = require('mongoose');
const EquipmentCatalog = require('../models/EquipmentCatalog');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI);

// ALL equipment from clinic PDF - INCLUDING LAB EQUIPMENT
const clinicEquipment = [
  // SITE MATRIX - Ophthalmology Equipment
  {
    equipmentId: 'MATRIX-001',
    name: '3D OCT1 MAESTRO Topcon',
    manufacturer: 'Topcon',
    category: 'OCT',
    site: 'MATRIX',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['oct_macula', 'oct_nerve'],
    integrationAdapter: 'TopconAdapter'
  },
  {
    equipmentId: 'MATRIX-002',
    name: 'LAMPE A FENTE DIGITAL',
    manufacturer: 'Other',
    category: 'Slit Lamp',
    site: 'MATRIX',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['slit_lamp_photo'],
    integrationAdapter: 'GenericFileAdapter'
  },
  {
    equipmentId: 'MATRIX-003',
    name: 'TONOREF III NIDEK',
    manufacturer: 'Nidek',
    category: 'Autorefractor',
    site: 'MATRIX',
    connectionType: 'Not Connected',
    connectionStatus: 'Not Connected',
    dataExportMethod: 'Manual entry',
    supportedMeasurements: ['refraction', 'keratometry', 'tonometry'],
    integrationAdapter: 'ManualAdapter'
  },
  {
    equipmentId: 'MATRIX-004',
    name: 'TAR Plusoptix S04',
    manufacturer: 'Plusoptix',
    category: 'Other Diagnostic',
    site: 'MATRIX',
    connectionType: 'Not Connected',
    connectionStatus: 'Not Connected',
    dataExportMethod: 'Manual entry',
    supportedMeasurements: ['refraction'],
    integrationAdapter: 'ManualAdapter'
  },
  {
    equipmentId: 'MATRIX-005',
    name: 'OPTOVUE SOLIX visionix',
    manufacturer: 'Optovue',
    category: 'OCT',
    site: 'MATRIX',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['oct_macula', 'oct_nerve'],
    integrationAdapter: 'GenericFileAdapter'
  },
  {
    equipmentId: 'MATRIX-006',
    name: 'CLARUS 700 zeiss',
    manufacturer: 'Zeiss',
    category: 'Fundus Camera',
    site: 'MATRIX',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['fundus_photo'],
    integrationAdapter: 'ZeissAdapter'
  },
  {
    equipmentId: 'MATRIX-007',
    name: 'TOMEY MR 6000',
    manufacturer: 'Tomey',
    category: 'Autorefractor',
    site: 'MATRIX',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['refraction', 'keratometry'],
    integrationAdapter: 'GenericFileAdapter'
  },
  {
    equipmentId: 'MATRIX-008',
    name: 'LAMPE A FENTE DIGITAL',
    manufacturer: 'Other',
    category: 'Slit Lamp',
    site: 'MATRIX',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['slit_lamp_photo'],
    integrationAdapter: 'GenericFileAdapter'
  },
  {
    equipmentId: 'MATRIX-009',
    name: 'Aurolab Slitlamp with Teleophthal Imaging System',
    manufacturer: 'Aurolab',
    category: 'Slit Lamp',
    site: 'MATRIX',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['slit_lamp_photo'],
    integrationAdapter: 'GenericFileAdapter'
  },
  {
    equipmentId: 'MATRIX-010',
    name: 'Champ visuel Humphrey Field Analyzer 3',
    manufacturer: 'Humphrey',
    category: 'Visual Field',
    site: 'MATRIX',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['visual_field'],
    integrationAdapter: 'GenericFileAdapter'
  },
  {
    equipmentId: 'MATRIX-011',
    name: 'ECHOGRAPHIE MINDRAY DC-30',
    manufacturer: 'Mindray',
    category: 'Ultrasound',
    site: 'MATRIX',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['ultrasound'],
    integrationAdapter: 'GenericFileAdapter'
  },
  {
    equipmentId: 'MATRIX-012',
    name: 'SYSEYE',
    manufacturer: 'Other',
    category: 'Other Diagnostic',
    site: 'MATRIX',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['visual_acuity', 'refraction'],
    integrationAdapter: 'GenericFileAdapter'
  },
  {
    equipmentId: 'MATRIX-013',
    name: 'Digital Lensometer TL 6800',
    manufacturer: 'Other',
    category: 'Lensometer',
    site: 'MATRIX',
    connectionType: 'Not Connected',
    connectionStatus: 'Not Connected',
    dataExportMethod: 'Manual entry',
    supportedMeasurements: ['lens_power'],
    integrationAdapter: 'ManualAdapter'
  },
  {
    equipmentId: 'MATRIX-014',
    name: 'Elisar Portable champ visuel',
    manufacturer: 'Other',
    category: 'Visual Field',
    site: 'MATRIX',
    connectionType: 'WiFi',
    connectionStatus: 'Pending Setup',
    dataExportMethod: 'WiFi/Bluetooth transfer',
    supportedMeasurements: ['visual_field'],
    integrationAdapter: 'GenericFileAdapter'
  },
  {
    equipmentId: 'MATRIX-015',
    name: 'Réfractometre automatique portable (Baxter)',
    manufacturer: 'Other',
    category: 'Autorefractor',
    site: 'MATRIX',
    connectionType: 'Bluetooth',
    connectionStatus: 'Pending Setup',
    dataExportMethod: 'WiFi/Bluetooth transfer',
    supportedMeasurements: ['refraction'],
    integrationAdapter: 'GenericFileAdapter'
  },

  // SITE TOMBALBAYE - Including ALL equipment
  {
    equipmentId: 'TOMB-001',
    name: 'Aurolab Slitlamp with Teleophthal Imaging System',
    manufacturer: 'Aurolab',
    category: 'Slit Lamp',
    site: 'TOMBALBAYE',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['slit_lamp_photo'],
    integrationAdapter: 'GenericFileAdapter'
  },
  {
    equipmentId: 'TOMB-002',
    name: 'SYSEYE',
    manufacturer: 'Other',
    category: 'Other Diagnostic',
    site: 'TOMBALBAYE',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['visual_acuity', 'refraction'],
    integrationAdapter: 'GenericFileAdapter'
  },
  {
    equipmentId: 'TOMB-003',
    name: 'Topcon CT-1P (Tono, Pachy)',
    manufacturer: 'Topcon',
    category: 'Tonometer',
    site: 'TOMBALBAYE',
    connectionType: 'Not Connected',
    connectionStatus: 'Not Connected',
    dataExportMethod: 'Manual entry',
    supportedMeasurements: ['tonometry', 'pachymetry'],
    integrationAdapter: 'ManualAdapter'
  },
  {
    equipmentId: 'TOMB-004',
    name: 'Zeiss Iol Master 700',
    manufacturer: 'Zeiss',
    category: 'IOL Master',
    site: 'TOMBALBAYE',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['biometry'],
    integrationAdapter: 'ZeissAdapter'
  },
  {
    equipmentId: 'TOMB-005',
    name: 'Nidek Specular Microscope',
    manufacturer: 'Nidek',
    category: 'Specular Microscope',
    site: 'TOMBALBAYE',
    connectionType: 'Not Connected',
    connectionStatus: 'Not Connected',
    dataExportMethod: 'Manual entry',
    supportedMeasurements: ['specular_count'],
    integrationAdapter: 'ManualAdapter'
  },
  {
    equipmentId: 'TOMB-006',
    name: 'Quantal Medical AB Scan',
    manufacturer: 'Quantal',
    category: 'Ultrasound',
    site: 'TOMBALBAYE',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['ultrasound', 'biometry'],
    integrationAdapter: 'GenericFileAdapter'
  },
  {
    equipmentId: 'TOMB-007',
    name: '3D OCT1 MAESTRO Topcon',
    manufacturer: 'Topcon',
    category: 'OCT',
    site: 'TOMBALBAYE',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['oct_macula', 'oct_nerve'],
    integrationAdapter: 'TopconAdapter'
  },

  // LABORATORY EQUIPMENT AT TOMBALBAYE - IMPORTANT FOR COMPLETE CLINIC SERVICE!
  {
    equipmentId: 'TOMB-LAB-001',
    name: 'BC 5150 HEMATOLOGIE MINDRAY',
    manufacturer: 'Mindray',
    category: 'Laboratory - Hematology',
    site: 'TOMBALBAYE',
    connectionType: 'Not Connected',
    connectionStatus: 'Not Connected',
    dataExportMethod: 'Manual entry',
    supportedMeasurements: ['complete_blood_count'],
    integrationAdapter: 'ManualAdapter'
  },
  {
    equipmentId: 'TOMB-LAB-002',
    name: 'BS-240 MINDRAY BIOCHIMIE',
    manufacturer: 'Mindray',
    category: 'Laboratory - Biochemistry',
    site: 'TOMBALBAYE',
    connectionType: 'Not Connected',
    connectionStatus: 'Not Connected',
    dataExportMethod: 'Manual entry',
    supportedMeasurements: ['biochemistry_panel', 'glucose', 'cholesterol', 'liver_function', 'kidney_function'],
    integrationAdapter: 'ManualAdapter'
  },
  {
    equipmentId: 'TOMB-LAB-003',
    name: 'ICHROMA II HOMONOLOGIE',
    manufacturer: 'Other',
    category: 'Laboratory - Hormones',
    site: 'TOMBALBAYE',
    connectionType: 'Not Connected',
    connectionStatus: 'Not Connected',
    dataExportMethod: 'Manual entry',
    supportedMeasurements: ['hormone_tests'],
    integrationAdapter: 'ManualAdapter'
  },
  {
    equipmentId: 'TOMB-LAB-004',
    name: 'FLUOCARE HOMONOLOGIE',
    manufacturer: 'Other',
    category: 'Laboratory - Immunology',
    site: 'TOMBALBAYE',
    connectionType: 'Not Connected',
    connectionStatus: 'Not Connected',
    dataExportMethod: 'Manual entry',
    supportedMeasurements: ['immunoassay'],
    integrationAdapter: 'ManualAdapter'
  },

  // More TOMBALBAYE equipment
  {
    equipmentId: 'TOMB-011',
    name: 'Indirect Ophthalmoscope (Wireless) Keeler',
    manufacturer: 'Keeler',
    category: 'Other Diagnostic',
    site: 'TOMBALBAYE',
    connectionType: 'WiFi',
    connectionStatus: 'Pending Setup',
    dataExportMethod: 'Manual entry',
    supportedMeasurements: ['fundus_exam'],
    integrationAdapter: 'ManualAdapter'
  },
  {
    equipmentId: 'TOMB-012',
    name: 'Shin Nippon Tono',
    manufacturer: 'Other',
    category: 'Tonometer',
    site: 'TOMBALBAYE',
    connectionType: 'Not Connected',
    connectionStatus: 'Not Connected',
    dataExportMethod: 'Manual entry',
    supportedMeasurements: ['tonometry'],
    integrationAdapter: 'ManualAdapter'
  },
  {
    equipmentId: 'TOMB-013',
    name: 'Digital Lensometer TL 6800',
    manufacturer: 'Other',
    category: 'Lensometer',
    site: 'TOMBALBAYE',
    connectionType: 'Not Connected',
    connectionStatus: 'Not Connected',
    dataExportMethod: 'Manual entry',
    supportedMeasurements: ['lens_power'],
    integrationAdapter: 'ManualAdapter'
  },
  {
    equipmentId: 'TOMB-014',
    name: 'WAM 700 Esilor',
    manufacturer: 'Esilor',
    category: 'Autorefractor',
    site: 'TOMBALBAYE',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['refraction', 'aberrometry'],
    integrationAdapter: 'GenericFileAdapter'
  },

  // SITE MATADI
  {
    equipmentId: 'MATADI-001',
    name: 'SYSEYE',
    manufacturer: 'Other',
    category: 'Other Diagnostic',
    site: 'MATADI',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['visual_acuity', 'refraction'],
    integrationAdapter: 'GenericFileAdapter'
  },
  {
    equipmentId: 'MATADI-002',
    name: 'Shin Nippon Tono',
    manufacturer: 'Other',
    category: 'Tonometer',
    site: 'MATADI',
    connectionType: 'Not Connected',
    connectionStatus: 'Not Connected',
    dataExportMethod: 'Manual entry',
    supportedMeasurements: ['tonometry'],
    integrationAdapter: 'ManualAdapter'
  },
  {
    equipmentId: 'MATADI-003',
    name: 'Octopus HFA (Haag streit)',
    manufacturer: 'Haag-Streit',
    category: 'Visual Field',
    site: 'MATADI',
    connectionType: 'Network',
    connectionStatus: 'Connected',
    dataExportMethod: 'Export to shared folder',
    supportedMeasurements: ['visual_field'],
    integrationAdapter: 'GenericFileAdapter'
  },
  {
    equipmentId: 'MATADI-004',
    name: 'Digital Lensometer TL 6800',
    manufacturer: 'Other',
    category: 'Lensometer',
    site: 'MATADI',
    connectionType: 'Not Connected',
    connectionStatus: 'Not Connected',
    dataExportMethod: 'Manual entry',
    supportedMeasurements: ['lens_power'],
    integrationAdapter: 'ManualAdapter'
  },
  {
    equipmentId: 'MATADI-005',
    name: 'Elisar Portable champ visuel',
    manufacturer: 'Other',
    category: 'Visual Field',
    site: 'MATADI',
    connectionType: 'WiFi',
    connectionStatus: 'Pending Setup',
    dataExportMethod: 'WiFi/Bluetooth transfer',
    supportedMeasurements: ['visual_field'],
    integrationAdapter: 'GenericFileAdapter'
  }
];

async function seedEquipment() {
  try {
    console.log('=========================================');
    console.log('Seeding ALL clinic equipment...');
    console.log('Including laboratory equipment from clinics');
    console.log('=========================================\n');

    // Clear existing equipment
    await EquipmentCatalog.deleteMany({});
    console.log('✓ Cleared existing equipment catalog\n');

    // Count by category
    const categoryCounts = {};

    // Insert all equipment
    for (const equipment of clinicEquipment) {
      await EquipmentCatalog.create(equipment);

      // Track category counts
      if (!categoryCounts[equipment.category]) {
        categoryCounts[equipment.category] = 0;
      }
      categoryCounts[equipment.category]++;

      console.log(`✓ Added: ${equipment.name} (${equipment.site}) - ${equipment.category}`);
    }

    console.log('\n=========================================');
    console.log('SUMMARY');
    console.log('=========================================');
    console.log(`Total Equipment: ${clinicEquipment.length}`);
    console.log('\nBy Category:');
    for (const [category, count] of Object.entries(categoryCounts)) {
      console.log(`  ${category}: ${count}`);
    }

    console.log('\nBy Site:');
    console.log(`  MATRIX: ${clinicEquipment.filter(e => e.site === 'MATRIX').length}`);
    console.log(`  TOMBALBAYE: ${clinicEquipment.filter(e => e.site === 'TOMBALBAYE').length}`);
    console.log(`  MATADI: ${clinicEquipment.filter(e => e.site === 'MATADI').length}`);

    console.log('\n✅ Successfully seeded ALL clinic equipment!');
    console.log('   Including laboratory equipment for comprehensive clinic service');

  } catch (error) {
    console.error('❌ Error seeding equipment:', error);
  } finally {
    await mongoose.connection.close();
  }
}

seedEquipment();