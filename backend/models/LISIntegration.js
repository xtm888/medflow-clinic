const mongoose = require('mongoose');
const crypto = require('crypto');

// Encryption key for sensitive data (required in production)
// SECURITY: Use environment-specific salt derived from the key itself
// This prevents rainbow table attacks and ensures unique derived keys per installation
const ENCRYPTION_KEY = (() => {
  if (process.env.LIS_ENCRYPTION_KEY) {
    // If provided as hex string (64 chars = 32 bytes), use directly
    const key = process.env.LIS_ENCRYPTION_KEY;
    if (key.length === 64) {
      return Buffer.from(key, 'hex');
    }
    // For passphrase-based keys, derive using a proper salt
    // Use first 16 bytes of SHA256 hash of the key as salt (deterministic but unique per key)
    const saltSource = process.env.LIS_ENCRYPTION_SALT || crypto.createHash('sha256').update(key).digest().slice(0, 16);
    const salt = typeof saltSource === 'string' ? Buffer.from(saltSource, 'hex') : saltSource;
    return crypto.scryptSync(key, salt, 32);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL: LIS_ENCRYPTION_KEY must be set in production');
  }
  console.warn('⚠️  LIS_ENCRYPTION_KEY not set - using development fallback (NOT FOR PRODUCTION)');
  // Development only: use a deterministic but unique salt
  const devSalt = crypto.createHash('sha256').update('dev-salt-not-for-production').digest().slice(0, 16);
  return crypto.scryptSync('dev-fallback-not-for-production', devSalt, 32);
})();
const IV_LENGTH = 16;

/**
 * LIS Integration Schema
 * Stores configuration for external Laboratory Information System connections
 */
const lisIntegrationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  // Connection type
  type: {
    type: String,
    enum: ['hl7-mllp', 'hl7-http', 'fhir-rest', 'file-based', 'custom-api'],
    required: true
  },
  // Connection status
  status: {
    type: String,
    enum: ['active', 'inactive', 'testing', 'error'],
    default: 'inactive'
  },
  // HL7 specific settings
  hl7Settings: {
    version: {
      type: String,
      enum: ['2.3', '2.3.1', '2.4', '2.5', '2.5.1', '2.6', '2.7'],
      default: '2.5.1'
    },
    sendingApplication: {
      type: String,
      default: 'MEDFLOW'
    },
    sendingFacility: {
      type: String,
      default: 'CLINIC'
    },
    receivingApplication: String,
    receivingFacility: String,
    // Message types to handle
    supportedMessages: [{
      type: String,
      enum: ['ORM', 'ORU', 'ADT', 'ACK', 'QRY', 'QBP', 'RSP']
    }],
    // Character encoding
    characterEncoding: {
      type: String,
      default: 'UTF-8'
    },
    // Acknowledgment settings
    requireAck: {
      type: Boolean,
      default: true
    },
    ackTimeout: {
      type: Number,
      default: 30000 // 30 seconds
    }
  },
  // FHIR specific settings
  fhirSettings: {
    version: {
      type: String,
      enum: ['DSTU2', 'STU3', 'R4', 'R4B', 'R5'],
      default: 'R4'
    },
    baseUrl: String,
    supportedResources: [{
      type: String,
      enum: ['Patient', 'Observation', 'DiagnosticReport', 'ServiceRequest', 'Specimen', 'Task']
    }],
    // OAuth2 settings
    oauth2: {
      enabled: Boolean,
      tokenUrl: String,
      clientId: String,
      clientSecretEncrypted: String,
      scope: String
    },
    // Subscription for push notifications
    subscription: {
      enabled: Boolean,
      webhookUrl: String,
      channels: [String]
    }
  },
  // Connection settings
  connection: {
    // For MLLP/TCP
    host: String,
    port: Number,
    // For HTTP/REST
    baseUrl: String,
    // Authentication
    authType: {
      type: String,
      enum: ['none', 'basic', 'bearer', 'api-key', 'oauth2', 'certificate'],
      default: 'none'
    },
    // Encrypted credentials
    credentialsEncrypted: String,
    // API key header name (for api-key auth)
    apiKeyHeader: {
      type: String,
      default: 'X-API-Key'
    },
    // SSL/TLS settings
    useTLS: {
      type: Boolean,
      default: false
    },
    tlsOptions: {
      rejectUnauthorized: {
        type: Boolean,
        default: true
      },
      ca: String, // CA certificate
      cert: String, // Client certificate
      key: String // Client key (encrypted)
    },
    // Connection timeouts
    connectionTimeout: {
      type: Number,
      default: 10000
    },
    requestTimeout: {
      type: Number,
      default: 30000
    },
    // Retry settings
    retryEnabled: {
      type: Boolean,
      default: true
    },
    maxRetries: {
      type: Number,
      default: 3
    },
    retryDelay: {
      type: Number,
      default: 5000
    }
  },
  // Webhook authentication for inbound messages
  webhookAuth: {
    // Enable webhook authentication (recommended for production)
    enabled: {
      type: Boolean,
      default: true
    },
    // API key for authenticating incoming webhook requests
    apiKeyEncrypted: String,
    // Header name for API key
    apiKeyHeader: {
      type: String,
      default: 'X-LIS-API-Key'
    },
    // HMAC secret for signature verification (optional)
    hmacSecretEncrypted: String,
    // Signature header name
    signatureHeader: {
      type: String,
      default: 'X-LIS-Signature'
    },
    // Allowed IP addresses (optional, leave empty to allow all)
    allowedIPs: [String],
    // Rate limiting
    rateLimit: {
      enabled: {
        type: Boolean,
        default: true
      },
      maxRequests: {
        type: Number,
        default: 100  // per window
      },
      windowMs: {
        type: Number,
        default: 60000  // 1 minute
      }
    }
  },
  // File-based integration settings
  fileSettings: {
    inputDirectory: String,
    outputDirectory: String,
    archiveDirectory: String,
    filePattern: {
      type: String,
      default: '*.hl7'
    },
    pollInterval: {
      type: Number,
      default: 30000 // 30 seconds
    },
    encoding: {
      type: String,
      default: 'UTF-8'
    }
  },
  // Mapping configuration
  mapping: {
    // Patient ID field mapping
    patientIdField: {
      type: String,
      default: 'PID-3'
    },
    // External patient ID system
    externalIdSystem: String,
    // Test code mapping (internal code -> external code)
    testCodeMap: [{
      internalCode: String,
      externalCode: String,
      externalName: String,
      codingSystem: String
    }],
    // Custom field mappings
    customMappings: mongoose.Schema.Types.Mixed
  },
  // Auto-import settings
  autoImport: {
    enabled: {
      type: Boolean,
      default: true
    },
    // Auto-create patients if not found
    createPatients: {
      type: Boolean,
      default: false
    },
    // Auto-match patients
    patientMatching: {
      type: String,
      enum: ['exact', 'fuzzy', 'manual'],
      default: 'exact'
    },
    // Fields to match on
    matchFields: [{
      type: String,
      enum: ['patientId', 'name', 'dateOfBirth', 'ssn', 'phone', 'email']
    }],
    // Auto-complete orders when results received
    autoCompleteOrders: {
      type: Boolean,
      default: true
    }
  },
  // Sync state
  syncState: {
    lastSyncAt: Date,
    lastSuccessfulSyncAt: Date,
    lastError: String,
    lastErrorAt: Date,
    messagesReceived: {
      type: Number,
      default: 0
    },
    messagesSent: {
      type: Number,
      default: 0
    },
    messagesErrored: {
      type: Number,
      default: 0
    }
  },
  // Created by user
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Last modified by
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Encryption/Decryption methods
lisIntegrationSchema.methods.encryptData = function(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

lisIntegrationSchema.methods.decryptData = function(encryptedText) {
  if (!encryptedText) return null;
  try {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    return null;
  }
};

// Set credentials (encrypts before storing)
lisIntegrationSchema.methods.setCredentials = function(credentials) {
  this.connection.credentialsEncrypted = this.encryptData(JSON.stringify(credentials));
};

// Get credentials (decrypts)
lisIntegrationSchema.methods.getCredentials = function() {
  const decrypted = this.decryptData(this.connection.credentialsEncrypted);
  return decrypted ? JSON.parse(decrypted) : null;
};

// Set OAuth client secret
lisIntegrationSchema.methods.setOAuthSecret = function(secret) {
  if (this.fhirSettings && this.fhirSettings.oauth2) {
    this.fhirSettings.oauth2.clientSecretEncrypted = this.encryptData(secret);
  }
};

// Get OAuth client secret
lisIntegrationSchema.methods.getOAuthSecret = function() {
  if (this.fhirSettings?.oauth2?.clientSecretEncrypted) {
    return this.decryptData(this.fhirSettings.oauth2.clientSecretEncrypted);
  }
  return null;
};

// Set webhook API key (encrypts before storing)
lisIntegrationSchema.methods.setWebhookApiKey = function(apiKey) {
  if (!this.webhookAuth) this.webhookAuth = {};
  this.webhookAuth.apiKeyEncrypted = this.encryptData(apiKey);
};

// Get webhook API key (decrypts)
lisIntegrationSchema.methods.getWebhookApiKey = function() {
  return this.decryptData(this.webhookAuth?.apiKeyEncrypted);
};

// Set webhook HMAC secret (encrypts before storing)
lisIntegrationSchema.methods.setWebhookHmacSecret = function(secret) {
  if (!this.webhookAuth) this.webhookAuth = {};
  this.webhookAuth.hmacSecretEncrypted = this.encryptData(secret);
};

// Get webhook HMAC secret (decrypts)
lisIntegrationSchema.methods.getWebhookHmacSecret = function() {
  return this.decryptData(this.webhookAuth?.hmacSecretEncrypted);
};

// Generate new webhook API key and HMAC secret
lisIntegrationSchema.methods.generateWebhookCredentials = function() {
  const apiKey = crypto.randomBytes(32).toString('hex');
  const hmacSecret = crypto.randomBytes(32).toString('hex');
  this.setWebhookApiKey(apiKey);
  this.setWebhookHmacSecret(hmacSecret);
  return { apiKey, hmacSecret };
};

// Validate webhook request
lisIntegrationSchema.methods.validateWebhookRequest = function(headers, body, sourceIp) {
  // Check if webhook auth is enabled
  if (!this.webhookAuth?.enabled) {
    return { valid: true, reason: 'auth_disabled' };
  }

  // Check IP allowlist (if configured)
  if (this.webhookAuth.allowedIPs?.length > 0) {
    if (!this.webhookAuth.allowedIPs.includes(sourceIp)) {
      return { valid: false, reason: 'ip_not_allowed' };
    }
  }

  // Check API key
  const apiKeyHeader = this.webhookAuth.apiKeyHeader || 'X-LIS-API-Key';
  const providedApiKey = headers[apiKeyHeader.toLowerCase()];
  const expectedApiKey = this.getWebhookApiKey();

  if (expectedApiKey) {
    if (!providedApiKey) {
      return { valid: false, reason: 'missing_api_key' };
    }
    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(providedApiKey), Buffer.from(expectedApiKey))) {
      return { valid: false, reason: 'invalid_api_key' };
    }
  }

  // Check HMAC signature (if configured)
  const hmacSecret = this.getWebhookHmacSecret();
  if (hmacSecret) {
    const signatureHeader = this.webhookAuth.signatureHeader || 'X-LIS-Signature';
    const providedSignature = headers[signatureHeader.toLowerCase()];

    if (!providedSignature) {
      return { valid: false, reason: 'missing_signature' };
    }

    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const expectedSignature = crypto.createHmac('sha256', hmacSecret)
      .update(bodyString)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))) {
      return { valid: false, reason: 'invalid_signature' };
    }
  }

  return { valid: true, reason: 'authenticated' };
};

// Update sync state
lisIntegrationSchema.methods.updateSyncState = function(success, error = null) {
  this.syncState.lastSyncAt = new Date();
  if (success) {
    this.syncState.lastSuccessfulSyncAt = new Date();
    this.syncState.lastError = null;
    this.syncState.lastErrorAt = null;
  } else {
    this.syncState.lastError = error;
    this.syncState.lastErrorAt = new Date();
  }
};

// Increment message counters
lisIntegrationSchema.methods.incrementCounter = function(type) {
  switch (type) {
    case 'received':
      this.syncState.messagesReceived = (this.syncState.messagesReceived || 0) + 1;
      break;
    case 'sent':
      this.syncState.messagesSent = (this.syncState.messagesSent || 0) + 1;
      break;
    case 'error':
      this.syncState.messagesErrored = (this.syncState.messagesErrored || 0) + 1;
      break;
  }
};

// Get connection URL for display (masks sensitive parts)
lisIntegrationSchema.methods.getDisplayUrl = function() {
  if (this.type === 'hl7-mllp') {
    return `mllp://${this.connection.host}:${this.connection.port}`;
  }
  if (this.connection.baseUrl) {
    try {
      const url = new URL(this.connection.baseUrl);
      if (url.password) {
        url.password = '****';
      }
      return url.toString();
    } catch {
      return this.connection.baseUrl;
    }
  }
  return 'N/A';
};

// Indexes
lisIntegrationSchema.index({ status: 1 });
lisIntegrationSchema.index({ type: 1 });
lisIntegrationSchema.index({ 'syncState.lastSyncAt': 1 });

const LISIntegration = mongoose.model('LISIntegration', lisIntegrationSchema);


/**
 * LIS Message Log Schema
 * Stores all HL7/FHIR messages for audit and debugging
 */
const lisMessageLogSchema = new mongoose.Schema({
  integration: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LISIntegration',
    required: true
  },
  // Message direction
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true
  },
  // Message format
  format: {
    type: String,
    enum: ['hl7', 'fhir', 'other'],
    required: true
  },
  // Message type (ORM, ORU, etc for HL7; resourceType for FHIR)
  messageType: String,
  // Message control ID (for HL7) or resource ID (for FHIR)
  messageId: String,
  // Processing status
  status: {
    type: String,
    enum: ['received', 'processing', 'processed', 'acknowledged', 'error', 'rejected'],
    default: 'received'
  },
  // Raw message content
  rawMessage: {
    type: String,
    required: true
  },
  // Parsed message (stored as JSON)
  parsedMessage: mongoose.Schema.Types.Mixed,
  // Response/ACK message
  responseMessage: String,
  // Related entities
  relatedPatient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient'
  },
  relatedOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Visit'
  },
  // Processing details
  processingDetails: {
    startedAt: Date,
    completedAt: Date,
    duration: Number, // milliseconds
    attempts: {
      type: Number,
      default: 1
    }
  },
  // Error information
  error: {
    code: String,
    message: String,
    stack: String
  },
  // Additional metadata
  metadata: {
    sendingApplication: String,
    sendingFacility: String,
    receivingApplication: String,
    receivingFacility: String,
    sourceIp: String,
    userAgent: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
lisMessageLogSchema.index({ integration: 1, createdAt: -1 });
lisMessageLogSchema.index({ direction: 1, status: 1 });
lisMessageLogSchema.index({ messageType: 1 });
lisMessageLogSchema.index({ messageId: 1 });
lisMessageLogSchema.index({ relatedPatient: 1 });
lisMessageLogSchema.index({ relatedOrder: 1 });
lisMessageLogSchema.index({ status: 1, createdAt: -1 });
lisMessageLogSchema.index({ createdAt: -1 });

// TTL index to auto-delete old logs (90 days)
lisMessageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const LISMessageLog = mongoose.model('LISMessageLog', lisMessageLogSchema);


/**
 * LIS Test Mapping Schema
 * Maps internal test codes to external LIS codes
 */
const lisTestMappingSchema = new mongoose.Schema({
  integration: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LISIntegration'
  },
  // Internal test template
  internalTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabTemplate'
  },
  internalCode: {
    type: String,
    required: true
  },
  internalName: String,
  // External LIS code
  externalCode: {
    type: String,
    required: true
  },
  externalName: String,
  // Coding system (LOINC, local, etc)
  codingSystem: {
    type: String,
    default: 'L' // Local
  },
  // Specimen requirements for this test
  specimenRequirements: {
    type: String,
    tube: String,
    volume: String,
    instructions: String
  },
  // Active status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index for unique mapping per integration
lisTestMappingSchema.index({ integration: 1, internalCode: 1 }, { unique: true });
lisTestMappingSchema.index({ integration: 1, externalCode: 1 });

const LISTestMapping = mongoose.model('LISTestMapping', lisTestMappingSchema);


module.exports = {
  LISIntegration,
  LISMessageLog,
  LISTestMapping
};
