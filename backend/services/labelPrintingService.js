/**
 * Label Printing Service
 * Generates labels for pharmacy, laboratory, optical shop, and patient identification
 */

/**
 * Label templates configuration
 */
const LABEL_TEMPLATES = {
  // Pharmacy Labels
  prescription: {
    name: 'Prescription Label',
    size: { width: 4, height: 2, unit: 'inches' },
    fields: [
      'pharmacyName', 'pharmacyAddress', 'pharmacyPhone',
      'patientName', 'patientDOB', 'prescriptionNumber',
      'medicationName', 'strength', 'quantity', 'directions',
      'refillsRemaining', 'prescribedBy', 'dispensedDate', 'expiryDate',
      'warnings', 'barcode'
    ],
    format: 'prescription_standard'
  },
  medication_auxiliary: {
    name: 'Auxiliary Warning Label',
    size: { width: 1.5, height: 0.75, unit: 'inches' },
    fields: ['warningText', 'warningCode', 'icon'],
    format: 'auxiliary_small'
  },
  controlled_substance: {
    name: 'Controlled Substance Label',
    size: { width: 4, height: 2.5, unit: 'inches' },
    fields: [
      'pharmacyName', 'deaNumber', 'patientName', 'patientAddress',
      'prescriptionNumber', 'medicationName', 'strength', 'quantity',
      'directions', 'prescribedBy', 'prescriberDEA', 'dispensedDate',
      'controlledSchedule', 'warnings', 'barcode'
    ],
    format: 'controlled_standard'
  },

  // Laboratory Labels
  specimen: {
    name: 'Specimen Label',
    size: { width: 2, height: 1, unit: 'inches' },
    fields: [
      'patientName', 'patientDOB', 'mrn', 'accessionNumber',
      'specimenType', 'collectionDateTime', 'collectedBy', 'barcode'
    ],
    format: 'specimen_standard'
  },
  blood_tube: {
    name: 'Blood Tube Label',
    size: { width: 1.75, height: 0.5, unit: 'inches' },
    fields: ['patientName', 'mrn', 'collectionTime', 'barcode'],
    format: 'tube_small'
  },
  slide: {
    name: 'Microscopy Slide Label',
    size: { width: 1, height: 0.375, unit: 'inches' },
    fields: ['patientInitials', 'mrn', 'caseNumber', 'slideNumber'],
    format: 'slide_standard'
  },

  // Optical Labels
  glasses_envelope: {
    name: 'Glasses Envelope Label',
    size: { width: 3, height: 2, unit: 'inches' },
    fields: [
      'patientName', 'phone', 'orderNumber', 'orderDate',
      'frameDescription', 'lensType', 'readyDate', 'barcode'
    ],
    format: 'envelope_standard'
  },
  frame_tag: {
    name: 'Frame Price Tag',
    size: { width: 2, height: 1.25, unit: 'inches' },
    fields: ['brand', 'model', 'color', 'size', 'price', 'sku', 'barcode'],
    format: 'price_tag'
  },
  contact_lens: {
    name: 'Contact Lens Label',
    size: { width: 2.5, height: 1.5, unit: 'inches' },
    fields: [
      'patientName', 'brand', 'power', 'bc', 'dia',
      'cylinder', 'axis', 'eye', 'quantity', 'expiryDate', 'barcode'
    ],
    format: 'contact_standard'
  },

  // Patient Identification
  patient_wristband: {
    name: 'Patient Wristband',
    size: { width: 6, height: 1, unit: 'inches' },
    fields: [
      'patientName', 'dob', 'mrn', 'gender',
      'allergies', 'barcode', 'qrcode'
    ],
    format: 'wristband_standard'
  },
  patient_id_card: {
    name: 'Patient ID Card',
    size: { width: 3.375, height: 2.125, unit: 'inches' },
    fields: [
      'clinicLogo', 'clinicName', 'patientName', 'mrn',
      'dob', 'phone', 'emergencyContact', 'photo', 'barcode'
    ],
    format: 'id_card_standard'
  },

  // Inventory Labels
  inventory_shelf: {
    name: 'Shelf Label',
    size: { width: 2, height: 0.75, unit: 'inches' },
    fields: ['itemName', 'sku', 'location', 'barcode'],
    format: 'shelf_small'
  },
  inventory_bin: {
    name: 'Bin Label',
    size: { width: 3, height: 1, unit: 'inches' },
    fields: ['itemName', 'itemCode', 'reorderPoint', 'supplier', 'barcode'],
    format: 'bin_standard'
  },

  // Equipment Labels
  equipment_asset: {
    name: 'Asset Tag',
    size: { width: 2, height: 1, unit: 'inches' },
    fields: ['assetNumber', 'description', 'location', 'barcode', 'qrcode'],
    format: 'asset_standard'
  },
  calibration: {
    name: 'Calibration Label',
    size: { width: 2, height: 1, unit: 'inches' },
    fields: ['equipmentName', 'assetNumber', 'calibrationDate', 'nextDueDate', 'calibratedBy'],
    format: 'calibration_standard'
  }
};

/**
 * Warning labels for medications
 */
const MEDICATION_WARNINGS = {
  'TAKE_WITH_FOOD': { text: 'Take with food', color: '#FFA500', icon: 'food' },
  'AVOID_SUNLIGHT': { text: 'Avoid sunlight', color: '#FFD700', icon: 'sun' },
  'MAY_CAUSE_DROWSINESS': { text: 'May cause drowsiness', color: '#FF6B6B', icon: 'sleep' },
  'DO_NOT_CRUSH': { text: 'Do not crush or chew', color: '#FF4444', icon: 'no-crush' },
  'REFRIGERATE': { text: 'Keep refrigerated', color: '#4FC3F7', icon: 'cold' },
  'SHAKE_WELL': { text: 'Shake well before use', color: '#81C784', icon: 'shake' },
  'AVOID_ALCOHOL': { text: 'Avoid alcohol', color: '#E57373', icon: 'no-alcohol' },
  'TAKE_ON_EMPTY': { text: 'Take on empty stomach', color: '#FFB74D', icon: 'empty-stomach' },
  'EXTERNAL_USE': { text: 'For external use only', color: '#CE93D8', icon: 'external' },
  'FINISH_ALL': { text: 'Finish all medication', color: '#90CAF9', icon: 'complete' }
};

/**
 * Generate label data for a prescription
 * @param {Object} prescription - Prescription data
 * @param {Object} pharmacy - Pharmacy info
 * @returns {Object} Label data
 */
function generatePrescriptionLabel(prescription, pharmacy) {
  const medication = prescription.medications?.[0] || prescription;

  return {
    templateId: 'prescription',
    data: {
      pharmacyName: pharmacy.name,
      pharmacyAddress: pharmacy.address,
      pharmacyPhone: pharmacy.phone,
      patientName: prescription.patientName,
      patientDOB: formatDate(prescription.patientDOB),
      prescriptionNumber: prescription.prescriptionNumber || prescription.rxNumber,
      medicationName: medication.name,
      strength: medication.strength,
      quantity: medication.quantity,
      directions: medication.sigCode || medication.directions,
      refillsRemaining: medication.refillsRemaining || 0,
      prescribedBy: prescription.prescriberName,
      dispensedDate: formatDate(new Date()),
      expiryDate: formatDate(calculateExpiryDate(medication)),
      warnings: getWarningsForMedication(medication.name),
      barcode: prescription.prescriptionNumber || prescription.rxNumber
    },
    copies: 1
  };
}

/**
 * Generate label data for a specimen
 * @param {Object} specimen - Specimen data
 * @param {Object} patient - Patient info
 * @returns {Object} Label data
 */
function generateSpecimenLabel(specimen, patient) {
  return {
    templateId: 'specimen',
    data: {
      patientName: `${patient.lastName}, ${patient.firstName}`,
      patientDOB: formatDate(patient.dateOfBirth),
      mrn: patient.medicalRecordNumber,
      accessionNumber: specimen.accessionNumber,
      specimenType: specimen.specimenType,
      collectionDateTime: formatDateTime(specimen.collectionTime || new Date()),
      collectedBy: specimen.collectedBy,
      barcode: specimen.accessionNumber
    },
    copies: specimen.tubeCount || 1
  };
}

/**
 * Generate label data for glasses order
 * @param {Object} order - Glasses order data
 * @param {Object} patient - Patient info
 * @returns {Object} Label data
 */
function generateGlassesLabel(order, patient) {
  return {
    templateId: 'glasses_envelope',
    data: {
      patientName: `${patient.firstName} ${patient.lastName}`,
      phone: patient.phone,
      orderNumber: order.orderNumber,
      orderDate: formatDate(order.orderDate),
      frameDescription: `${order.frame?.brand || ''} ${order.frame?.model || ''}`.trim(),
      lensType: order.lenses?.type || 'Standard',
      readyDate: formatDate(order.estimatedCompletionDate),
      barcode: order.orderNumber
    },
    copies: 1
  };
}

/**
 * Generate patient wristband label
 * @param {Object} patient - Patient info
 * @returns {Object} Label data
 */
function generateWristbandLabel(patient) {
  return {
    templateId: 'patient_wristband',
    data: {
      patientName: `${patient.lastName}, ${patient.firstName}`,
      dob: formatDate(patient.dateOfBirth),
      mrn: patient.medicalRecordNumber,
      gender: patient.gender?.charAt(0).toUpperCase() || '',
      allergies: patient.allergies?.length > 0
        ? patient.allergies.slice(0, 3).join(', ')
        : 'NKDA',
      barcode: patient.medicalRecordNumber,
      qrcode: JSON.stringify({
        mrn: patient.medicalRecordNumber,
        name: patient.lastName,
        dob: patient.dateOfBirth
      })
    },
    copies: 1
  };
}

/**
 * Generate contact lens label
 * @param {Object} order - Contact lens order
 * @param {Object} patient - Patient info
 * @param {String} eye - 'OD' or 'OS'
 * @returns {Object} Label data
 */
function generateContactLensLabel(order, patient, eye) {
  const lensData = eye === 'OD' ? order.rightEye : order.leftEye;

  return {
    templateId: 'contact_lens',
    data: {
      patientName: `${patient.lastName}, ${patient.firstName}`,
      brand: order.brand,
      power: lensData?.power || 'N/A',
      bc: lensData?.baseCurve || 'N/A',
      dia: lensData?.diameter || 'N/A',
      cylinder: lensData?.cylinder || '',
      axis: lensData?.axis || '',
      eye: eye,
      quantity: lensData?.quantity || 1,
      expiryDate: formatDate(order.expirationDate),
      barcode: `${order.orderNumber}-${eye}`
    },
    copies: 1
  };
}

/**
 * Generate inventory shelf label
 * @param {Object} item - Inventory item
 * @returns {Object} Label data
 */
function generateShelfLabel(item) {
  return {
    templateId: 'inventory_shelf',
    data: {
      itemName: item.name,
      sku: item.sku || item.itemCode,
      location: item.location || item.binLocation,
      barcode: item.sku || item.itemCode
    },
    copies: 1
  };
}

/**
 * Generate frame price tag
 * @param {Object} frame - Frame inventory item
 * @returns {Object} Label data
 */
function generateFramePriceTag(frame) {
  return {
    templateId: 'frame_tag',
    data: {
      brand: frame.brand,
      model: frame.modelName,
      color: frame.color,
      size: frame.size,
      price: formatCurrency(frame.retailPrice),
      sku: frame.sku,
      barcode: frame.sku
    },
    copies: 1
  };
}

/**
 * Generate ZPL (Zebra Programming Language) for label
 * @param {Object} labelData - Label data
 * @returns {String} ZPL code
 */
function generateZPL(labelData) {
  const template = LABEL_TEMPLATES[labelData.templateId];
  if (!template) {
    throw new Error(`Unknown label template: ${labelData.templateId}`);
  }

  let zpl = '^XA\n'; // Start ZPL

  // Set label size (assuming 203 DPI)
  const widthDots = Math.round(template.size.width * 203);
  const heightDots = Math.round(template.size.height * 203);
  zpl += `^PW${widthDots}\n`;
  zpl += `^LL${heightDots}\n`;

  // Generate content based on template format
  switch (template.format) {
    case 'prescription_standard':
      zpl += generatePrescriptionZPL(labelData.data, template);
      break;
    case 'specimen_standard':
      zpl += generateSpecimenZPL(labelData.data, template);
      break;
    case 'wristband_standard':
      zpl += generateWristbandZPL(labelData.data, template);
      break;
    default:
      zpl += generateGenericZPL(labelData.data, template);
  }

  zpl += '^XZ\n'; // End ZPL
  return zpl;
}

/**
 * Generate prescription ZPL
 */
function generatePrescriptionZPL(data, template) {
  let zpl = '';
  let y = 30;

  // Pharmacy name
  zpl += `^FO20,${y}^A0N,30,30^FD${data.pharmacyName}^FS\n`;
  y += 35;

  // Patient name
  zpl += `^FO20,${y}^A0N,25,25^FD${data.patientName}^FS\n`;
  y += 30;

  // Rx number
  zpl += `^FO20,${y}^A0N,20,20^FDRx: ${data.prescriptionNumber}^FS\n`;
  y += 30;

  // Medication name (bold)
  zpl += `^FO20,${y}^A0N,35,35^FD${data.medicationName} ${data.strength}^FS\n`;
  y += 45;

  // Directions
  zpl += `^FO20,${y}^A0N,22,22^FB780,4,0,L^FD${data.directions}^FS\n`;
  y += 90;

  // Qty and refills
  zpl += `^FO20,${y}^A0N,18,18^FDQty: ${data.quantity}  Refills: ${data.refillsRemaining}^FS\n`;
  y += 25;

  // Prescriber
  zpl += `^FO20,${y}^A0N,18,18^FDPrescribed by: ${data.prescribedBy}^FS\n`;
  y += 25;

  // Dispensed date
  zpl += `^FO20,${y}^A0N,18,18^FDDispensed: ${data.dispensedDate}^FS\n`;

  // Barcode
  zpl += `^FO550,30^BCN,60,N,N,N^FD${data.barcode}^FS\n`;

  return zpl;
}

/**
 * Generate specimen ZPL
 */
function generateSpecimenZPL(data, template) {
  let zpl = '';

  zpl += `^FO20,20^A0N,28,28^FD${data.patientName}^FS\n`;
  zpl += `^FO20,55^A0N,20,20^FDMRN: ${data.mrn}  DOB: ${data.patientDOB}^FS\n`;
  zpl += `^FO20,85^A0N,20,20^FD${data.specimenType}^FS\n`;
  zpl += `^FO20,115^A0N,18,18^FD${data.collectionDateTime}^FS\n`;

  // Barcode
  zpl += `^FO280,20^BCN,80,N,N,N^FD${data.barcode}^FS\n`;

  return zpl;
}

/**
 * Generate wristband ZPL
 */
function generateWristbandZPL(data, template) {
  let zpl = '';

  zpl += `^FO20,10^A0N,35,35^FD${data.patientName}^FS\n`;
  zpl += `^FO20,55^A0N,25,25^FDDOB: ${data.dob}  MRN: ${data.mrn}  ${data.gender}^FS\n`;
  zpl += `^FO20,90^A0N,22,22^FDAllergies: ${data.allergies}^FS\n`;

  // Barcode
  zpl += `^FO750,10^BCN,80,N,N,N^FD${data.barcode}^FS\n`;

  // QR Code
  zpl += `^FO950,10^BQN,2,4^FDMA,${data.qrcode}^FS\n`;

  return zpl;
}

/**
 * Generate generic ZPL
 */
function generateGenericZPL(data, template) {
  let zpl = '';
  let y = 20;

  for (const field of template.fields) {
    if (data[field] && field !== 'barcode' && field !== 'qrcode') {
      zpl += `^FO20,${y}^A0N,22,22^FD${data[field]}^FS\n`;
      y += 30;
    }
  }

  if (data.barcode) {
    zpl += `^FO20,${y}^BCN,50,N,N,N^FD${data.barcode}^FS\n`;
  }

  return zpl;
}

/**
 * Helper functions
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${formatDate(d)} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatCurrency(amount) {
  if (amount === undefined || amount === null) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function calculateExpiryDate(medication) {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1); // Default 1 year
  return date;
}

function getWarningsForMedication(medicationName) {
  // This would normally look up warnings from a database
  return '';
}

/**
 * Get all label templates
 */
function getLabelTemplates() {
  return LABEL_TEMPLATES;
}

/**
 * Get warning labels
 */
function getWarningLabels() {
  return MEDICATION_WARNINGS;
}

module.exports = {
  generatePrescriptionLabel,
  generateSpecimenLabel,
  generateGlassesLabel,
  generateWristbandLabel,
  generateContactLensLabel,
  generateShelfLabel,
  generateFramePriceTag,
  generateZPL,
  getLabelTemplates,
  getWarningLabels,
  LABEL_TEMPLATES,
  MEDICATION_WARNINGS
};
