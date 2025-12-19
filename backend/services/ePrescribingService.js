/**
 * E-Prescribing Service
 * Handles electronic prescription transmission using NCPDP SCRIPT standard
 *
 * NCPDP SCRIPT is the standard for electronic prescribing in the US
 * This service supports:
 * - NewRx (new prescription)
 * - CancelRx (cancel prescription)
 * - RxChangeRequest (pharmacy request for change)
 * - RxChangeResponse (prescriber response)
 * - RefillRequest (pharmacy refill request)
 * - RefillResponse (prescriber response)
 * - RxFill (fill notification)
 * - Status (message status)
 */

const crypto = require('crypto');

// E-Prescribing configuration
const EPRESCRIBING_CONFIG = {
  enabled: process.env.EPRESCRIBING_ENABLED === 'true',
  testMode: process.env.EPRESCRIBING_TEST_MODE === 'true', // Must explicitly enable test mode
  provider: process.env.EPRESCRIBING_PROVIDER || 'surescripts', // surescripts, rcopia, drfirst
  credentials: {
    senderId: process.env.EPRESCRIBING_SENDER_ID || '',
    senderPassword: process.env.EPRESCRIBING_PASSWORD || '',
    senderQualifier: process.env.EPRESCRIBING_QUALIFIER || 'D',
    certificatePath: process.env.EPRESCRIBING_CERT_PATH || ''
  },
  endpoints: {
    surescripts: {
      production: 'https://ws.surescripts.net/messaging/Messaging.svc',
      test: 'https://cert.surescripts.net/messaging/Messaging.svc'
    },
    rcopia: {
      production: 'https://api.rcopia.com/v1',
      test: 'https://stage-api.rcopia.com/v1'
    },
    drfirst: {
      production: 'https://api.drfirst.com/erx/v1',
      test: 'https://staging-api.drfirst.com/erx/v1'
    }
  },
  retryAttempts: 3,
  timeout: 30000 // 30 seconds
};

// Message types
const MESSAGE_TYPES = {
  NEW_RX: 'NewRx',
  CANCEL_RX: 'CancelRx',
  RX_CHANGE_REQUEST: 'RxChangeRequest',
  RX_CHANGE_RESPONSE: 'RxChangeResponse',
  REFILL_REQUEST: 'RefillRequest',
  REFILL_RESPONSE: 'RefillResponse',
  RX_FILL: 'RxFill',
  STATUS: 'Status',
  ERROR: 'Error',
  VERIFY: 'Verify'
};

// Transmission status
const TRANSMISSION_STATUS = {
  PENDING: 'pending',
  QUEUED: 'queued',
  TRANSMITTED: 'transmitted',
  RECEIVED: 'received',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  ERROR: 'error',
  CANCELLED: 'cancelled'
};

/**
 * Generate unique message ID
 */
function generateMessageId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `MSG-${timestamp}-${random}`.toUpperCase();
}

/**
 * Generate NCPDP SCRIPT XML message
 */
function generateNCPDPMessage(messageType, prescription, pharmacy, prescriber) {
  const messageId = generateMessageId();
  const timestamp = new Date().toISOString();

  // Basic NCPDP SCRIPT message structure
  const message = {
    header: {
      messageId,
      sentTime: timestamp,
      messageType,
      senderId: EPRESCRIBING_CONFIG.credentials.senderId,
      senderQualifier: EPRESCRIBING_CONFIG.credentials.senderQualifier,
      receiverId: pharmacy.ncpdpId || pharmacy.id,
      receiverQualifier: 'P' // P = Pharmacy
    },
    body: {}
  };

  switch (messageType) {
    case MESSAGE_TYPES.NEW_RX:
      message.body = buildNewRxBody(prescription, pharmacy, prescriber);
      break;
    case MESSAGE_TYPES.CANCEL_RX:
      message.body = buildCancelRxBody(prescription, pharmacy, prescriber);
      break;
    case MESSAGE_TYPES.REFILL_RESPONSE:
      message.body = buildRefillResponseBody(prescription, pharmacy, prescriber);
      break;
    default:
      message.body = { prescriptionId: prescription._id || prescription.id };
  }

  return {
    messageId,
    xml: convertToXML(message),
    json: message
  };
}

/**
 * Build NewRx message body
 */
function buildNewRxBody(prescription, pharmacy, prescriber) {
  const patient = prescription.patient;
  const medications = prescription.medications || [];

  return {
    patient: {
      name: {
        lastName: patient.lastName,
        firstName: patient.firstName,
        middleName: patient.middleName || ''
      },
      dateOfBirth: patient.dateOfBirth,
      gender: mapGender(patient.gender),
      address: {
        line1: patient.address?.street || patient.address?.line1 || '',
        city: patient.address?.city || '',
        state: patient.address?.state || '',
        postalCode: patient.address?.postalCode || patient.address?.zipCode || '',
        country: patient.address?.country || 'US'
      },
      phone: patient.phoneNumber || patient.phone || '',
      identification: {
        type: 'PatientID',
        value: patient.patientId || patient._id
      }
    },
    prescriber: {
      name: {
        lastName: prescriber.lastName,
        firstName: prescriber.firstName,
        suffix: prescriber.suffix || ''
      },
      npi: prescriber.npi || prescriber.licenseNumber,
      dea: prescriber.deaNumber || '',
      specialty: prescriber.specialty || 'Ophthalmology',
      address: {
        line1: prescriber.address?.street || '',
        city: prescriber.address?.city || '',
        state: prescriber.address?.state || '',
        postalCode: prescriber.address?.postalCode || ''
      },
      phone: prescriber.phone || '',
      fax: prescriber.fax || ''
    },
    pharmacy: {
      ncpdpId: pharmacy.ncpdpId || '',
      npi: pharmacy.npi || '',
      name: pharmacy.name,
      address: {
        line1: pharmacy.address?.street || pharmacy.address || '',
        city: pharmacy.address?.city || '',
        state: pharmacy.address?.state || '',
        postalCode: pharmacy.address?.postalCode || ''
      },
      phone: pharmacy.phone || ''
    },
    medications: medications.map(med => ({
      drugDescription: med.name,
      drugCode: med.ndc || med.code || '',
      drugCodeQualifier: med.ndc ? 'ND' : 'MC', // ND = NDC, MC = Miscellaneous
      quantity: {
        value: med.quantity,
        unit: med.unit || 'EA',
        codeListQualifier: 'UN' // UN = Unit
      },
      daysSupply: med.daysSupply || calculateDaysSupply(med),
      directions: formatDirections(med),
      note: med.instructions || '',
      refills: {
        qualifier: 'R', // R = Refills
        value: med.refills?.allowed || 0
      },
      substitutionAllowed: med.substitutionAllowed !== false,
      writtenDate: prescription.dateIssued,
      effectiveDate: prescription.dateIssued,
      diagnosis: prescription.diagnosis?.map(d => ({
        code: d.code,
        qualifier: 'ICD10'
      })) || []
    })),
    messageRequestCode: 'NewPrescription',
    prescriptionId: prescription.prescriptionId || prescription._id
  };
}

/**
 * Build CancelRx message body
 */
function buildCancelRxBody(prescription, pharmacy, prescriber) {
  return {
    prescriptionId: prescription.prescriptionId || prescription._id,
    originalMessageId: prescription.ePrescription?.transmissionId,
    cancelReason: prescription.cancellation?.reason || 'Cancelled by prescriber',
    prescriber: {
      name: {
        lastName: prescriber.lastName,
        firstName: prescriber.firstName
      },
      npi: prescriber.npi || prescriber.licenseNumber
    },
    pharmacy: {
      ncpdpId: pharmacy.ncpdpId || '',
      name: pharmacy.name
    }
  };
}

/**
 * Build RefillResponse message body
 */
function buildRefillResponseBody(prescription, pharmacy, prescriber, approved = true) {
  return {
    prescriptionId: prescription.prescriptionId || prescription._id,
    originalMessageId: prescription.refillRequest?.messageId,
    response: approved ? 'A' : 'D', // A = Approved, D = Denied
    responseReason: approved ? 'Approved' : 'Denied by prescriber',
    prescriber: {
      name: {
        lastName: prescriber.lastName,
        firstName: prescriber.firstName
      },
      npi: prescriber.npi || prescriber.licenseNumber
    }
  };
}

/**
 * Convert message object to XML
 */
function convertToXML(message) {
  // Simplified XML generation - in production, use a proper XML library
  const header = '<?xml version="1.0" encoding="UTF-8"?>';
  const namespace = 'xmlns="http://www.ncpdp.org/schema/SCRIPT"';

  let xml = `${header}\n<Message ${namespace}>\n`;
  xml += '  <Header>\n';
  xml += `    <MessageID>${message.header.messageId}</MessageID>\n`;
  xml += `    <SentTime>${message.header.sentTime}</SentTime>\n`;
  xml += `    <MessageType>${message.header.messageType}</MessageType>\n`;
  xml += '    <From>\n';
  xml += `      <Identification>${message.header.senderId}</Identification>\n`;
  xml += `      <Qualifier>${message.header.senderQualifier}</Qualifier>\n`;
  xml += '    </From>\n';
  xml += '    <To>\n';
  xml += `      <Identification>${message.header.receiverId}</Identification>\n`;
  xml += `      <Qualifier>${message.header.receiverQualifier}</Qualifier>\n`;
  xml += '    </To>\n';
  xml += '  </Header>\n';
  xml += '  <Body>\n';
  xml += objectToXML(message.body, 4);
  xml += '  </Body>\n';
  xml += '</Message>';

  return xml;
}

/**
 * Convert object to XML string
 */
function objectToXML(obj, indent = 0) {
  let xml = '';
  const spaces = ' '.repeat(indent);

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;

    const tagName = key.charAt(0).toUpperCase() + key.slice(1);

    if (Array.isArray(value)) {
      value.forEach(item => {
        if (typeof item === 'object') {
          xml += `${spaces}<${tagName}>\n`;
          xml += objectToXML(item, indent + 2);
          xml += `${spaces}</${tagName}>\n`;
        } else {
          xml += `${spaces}<${tagName}>${escapeXML(item)}</${tagName}>\n`;
        }
      });
    } else if (typeof value === 'object') {
      xml += `${spaces}<${tagName}>\n`;
      xml += objectToXML(value, indent + 2);
      xml += `${spaces}</${tagName}>\n`;
    } else {
      xml += `${spaces}<${tagName}>${escapeXML(value)}</${tagName}>\n`;
    }
  }

  return xml;
}

/**
 * Escape XML special characters
 */
function escapeXML(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Map gender to NCPDP format
 */
function mapGender(gender) {
  const map = {
    'male': 'M',
    'female': 'F',
    'm': 'M',
    'f': 'F',
    'other': 'U',
    'unknown': 'U'
  };
  return map[gender?.toLowerCase()] || 'U';
}

/**
 * Calculate days supply from medication
 */
function calculateDaysSupply(medication) {
  if (medication.daysSupply) return medication.daysSupply;

  const duration = medication.dosage?.duration || medication.duration;
  if (!duration) return 30; // Default

  const value = duration.value || parseInt(duration);
  const unit = duration.unit || 'days';

  switch (unit.toLowerCase()) {
    case 'days': return value;
    case 'weeks': return value * 7;
    case 'months': return value * 30;
    default: return 30;
  }
}

/**
 * Format directions for NCPDP
 */
function formatDirections(medication) {
  const parts = [];

  if (medication.dosage?.amount) {
    parts.push(`Take ${medication.dosage.amount} ${medication.dosage.unit || ''}`);
  }

  if (medication.dosage?.frequency) {
    const freq = medication.dosage.frequency;
    if (typeof freq === 'object') {
      parts.push(`${freq.times} time(s) per ${freq.period}`);
    } else {
      parts.push(freq);
    }
  }

  if (medication.dosage?.withFood) {
    const foodMap = {
      'before': 'before meals',
      'with': 'with food',
      'after': 'after meals',
      'empty-stomach': 'on an empty stomach'
    };
    parts.push(foodMap[medication.dosage.withFood] || '');
  }

  if (medication.instructions) {
    parts.push(medication.instructions);
  }

  return parts.filter(Boolean).join('. ');
}

/**
 * Transmit prescription electronically
 */
async function transmitPrescription(prescription, pharmacy, prescriber, messageType = MESSAGE_TYPES.NEW_RX) {
  // Check if e-prescribing is enabled
  if (!EPRESCRIBING_CONFIG.enabled) {
    return {
      success: false,
      error: 'E-prescribing is not enabled',
      status: TRANSMISSION_STATUS.ERROR
    };
  }

  // Validate pharmacy has NCPDP ID
  if (!pharmacy.ncpdpId && !EPRESCRIBING_CONFIG.testMode) {
    return {
      success: false,
      error: 'Pharmacy NCPDP ID is required for electronic transmission',
      status: TRANSMISSION_STATUS.ERROR
    };
  }

  try {
    // Generate NCPDP message
    const message = generateNCPDPMessage(messageType, prescription, pharmacy, prescriber);

    // In test mode, simulate transmission
    if (EPRESCRIBING_CONFIG.testMode) {
      return simulateTransmission(message, messageType);
    }

    // Send to appropriate provider
    const result = await sendToProvider(message, pharmacy);

    return {
      success: result.success,
      messageId: message.messageId,
      transmissionId: result.transmissionId,
      status: result.success ? TRANSMISSION_STATUS.TRANSMITTED : TRANSMISSION_STATUS.ERROR,
      response: result.response,
      error: result.error,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: TRANSMISSION_STATUS.ERROR,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Send message to e-prescribing provider
 */
async function sendToProvider(message, pharmacy) {
  const axios = require('axios');
  const provider = EPRESCRIBING_CONFIG.provider;
  const endpoint = EPRESCRIBING_CONFIG.testMode
    ? EPRESCRIBING_CONFIG.endpoints[provider]?.test
    : EPRESCRIBING_CONFIG.endpoints[provider]?.production;

  if (!endpoint) {
    throw new Error(`Unknown e-prescribing provider: ${provider}`);
  }

  try {
    const response = await axios.post(endpoint, message.xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Authorization': `Basic ${Buffer.from(
          `${EPRESCRIBING_CONFIG.credentials.senderId}:${EPRESCRIBING_CONFIG.credentials.senderPassword}`
        ).toString('base64')}`
      },
      timeout: EPRESCRIBING_CONFIG.timeout
    });

    // Parse response
    const transmissionId = parseResponseForId(response.data);

    return {
      success: response.status === 200 || response.status === 201,
      transmissionId,
      response: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

/**
 * Simulate transmission for test mode
 */
function simulateTransmission(message, messageType) {
  const transmissionId = `TEST-${generateMessageId()}`;

  return {
    success: true,
    messageId: message.messageId,
    transmissionId,
    status: TRANSMISSION_STATUS.TRANSMITTED,
    response: {
      status: 'Accepted',
      message: 'Test mode - simulated successful transmission',
      receivedAt: new Date().toISOString()
    },
    testMode: true,
    timestamp: new Date().toISOString()
  };
}

/**
 * Parse response for transmission ID
 */
function parseResponseForId(responseData) {
  // This would parse the XML response - simplified for now
  const match = responseData?.match(/<MessageID>([^<]+)<\/MessageID>/);
  return match ? match[1] : generateMessageId();
}

/**
 * Check transmission status
 */
async function checkTransmissionStatus(transmissionId) {
  if (!EPRESCRIBING_CONFIG.enabled) {
    return { status: TRANSMISSION_STATUS.ERROR, error: 'E-prescribing not enabled' };
  }

  if (EPRESCRIBING_CONFIG.testMode) {
    return {
      transmissionId,
      status: TRANSMISSION_STATUS.RECEIVED,
      receivedAt: new Date().toISOString(),
      testMode: true
    };
  }

  // In production, would query the provider's API for status
  const axios = require('axios');
  const provider = EPRESCRIBING_CONFIG.provider;
  const endpoint = EPRESCRIBING_CONFIG.endpoints[provider]?.production;

  try {
    const response = await axios.get(`${endpoint}/status/${transmissionId}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(
          `${EPRESCRIBING_CONFIG.credentials.senderId}:${EPRESCRIBING_CONFIG.credentials.senderPassword}`
        ).toString('base64')}`
      }
    });

    return {
      transmissionId,
      status: response.data.status,
      receivedAt: response.data.receivedAt,
      pharmacyResponse: response.data.pharmacyResponse
    };
  } catch (error) {
    return {
      transmissionId,
      status: TRANSMISSION_STATUS.ERROR,
      error: error.message
    };
  }
}

/**
 * Cancel transmitted prescription
 */
async function cancelTransmittedPrescription(prescription, pharmacy, prescriber, reason) {
  prescription.cancellation = {
    reason: reason || 'Cancelled by prescriber',
    cancelledAt: new Date()
  };

  return transmitPrescription(prescription, pharmacy, prescriber, MESSAGE_TYPES.CANCEL_RX);
}

/**
 * Respond to refill request
 */
async function respondToRefillRequest(prescription, pharmacy, prescriber, approved, reason) {
  prescription.refillResponse = {
    approved,
    reason,
    respondedAt: new Date()
  };

  const messageType = MESSAGE_TYPES.REFILL_RESPONSE;
  const message = generateNCPDPMessage(messageType, prescription, pharmacy, prescriber);
  message.body.response = approved ? 'A' : 'D';
  message.body.responseReason = reason;

  return transmitPrescription(prescription, pharmacy, prescriber, messageType);
}

/**
 * Search for pharmacies that support e-prescribing
 */
async function searchEPrescribingPharmacies(criteria) {
  // In production, this would query SureScripts or similar directory
  // For now, return mock data
  if (EPRESCRIBING_CONFIG.testMode) {
    return {
      success: true,
      pharmacies: [
        {
          ncpdpId: '1234567',
          npi: '1234567890',
          name: 'Test Pharmacy',
          address: {
            street: '123 Main St',
            city: criteria.city || 'Test City',
            state: criteria.state || 'TC',
            postalCode: criteria.postalCode || '12345'
          },
          phone: '555-123-4567',
          ePrescribingEnabled: true,
          services: ['mail-order', 'retail', 'specialty']
        },
        {
          ncpdpId: '7654321',
          npi: '0987654321',
          name: 'Community Pharmacy',
          address: {
            street: '456 Oak Ave',
            city: criteria.city || 'Test City',
            state: criteria.state || 'TC',
            postalCode: criteria.postalCode || '12345'
          },
          phone: '555-987-6543',
          ePrescribingEnabled: true,
          services: ['retail', '24-hour']
        }
      ],
      testMode: true
    };
  }

  // Production pharmacy search would go here
  const axios = require('axios');
  const endpoint = EPRESCRIBING_CONFIG.endpoints[EPRESCRIBING_CONFIG.provider]?.production;

  try {
    const response = await axios.get(`${endpoint}/pharmacies/search`, {
      params: criteria,
      headers: {
        'Authorization': `Basic ${Buffer.from(
          `${EPRESCRIBING_CONFIG.credentials.senderId}:${EPRESCRIBING_CONFIG.credentials.senderPassword}`
        ).toString('base64')}`
      }
    });

    return {
      success: true,
      pharmacies: response.data.pharmacies || []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      pharmacies: []
    };
  }
}

/**
 * Verify pharmacy can receive e-prescriptions
 */
async function verifyPharmacy(ncpdpId) {
  if (EPRESCRIBING_CONFIG.testMode) {
    return {
      verified: true,
      ncpdpId,
      ePrescribingEnabled: true,
      services: ['NewRx', 'CancelRx', 'RefillRequest'],
      testMode: true
    };
  }

  // Production verification would query provider's directory
  return {
    verified: false,
    error: 'E-prescribing not configured for production'
  };
}

/**
 * Get e-prescribing service status
 */
function getServiceStatus() {
  return {
    enabled: EPRESCRIBING_CONFIG.enabled,
    testMode: EPRESCRIBING_CONFIG.testMode,
    provider: EPRESCRIBING_CONFIG.provider,
    configured: !!EPRESCRIBING_CONFIG.credentials.senderId,
    supportedMessageTypes: Object.values(MESSAGE_TYPES),
    endpoints: {
      test: EPRESCRIBING_CONFIG.endpoints[EPRESCRIBING_CONFIG.provider]?.test,
      production: EPRESCRIBING_CONFIG.endpoints[EPRESCRIBING_CONFIG.provider]?.production
    }
  };
}

/**
 * Configure e-prescribing service
 */
function configureService(config) {
  if (config.enabled !== undefined) {
    EPRESCRIBING_CONFIG.enabled = config.enabled;
  }
  if (config.testMode !== undefined) {
    EPRESCRIBING_CONFIG.testMode = config.testMode;
  }
  if (config.provider) {
    EPRESCRIBING_CONFIG.provider = config.provider;
  }
  if (config.credentials) {
    Object.assign(EPRESCRIBING_CONFIG.credentials, config.credentials);
  }

  return getServiceStatus();
}

module.exports = {
  // Main transmission functions
  transmitPrescription,
  cancelTransmittedPrescription,
  respondToRefillRequest,
  checkTransmissionStatus,

  // Message generation
  generateNCPDPMessage,

  // Pharmacy functions
  searchEPrescribingPharmacies,
  verifyPharmacy,

  // Service management
  getServiceStatus,
  configureService,

  // Constants
  MESSAGE_TYPES,
  TRANSMISSION_STATUS,

  // Internal config (for testing)
  EPRESCRIBING_CONFIG
};
