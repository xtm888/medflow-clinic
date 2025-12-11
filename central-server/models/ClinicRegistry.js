const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/**
 * ClinicRegistry Model
 * Manages registered clinics that can sync with the central server
 */
const clinicRegistrySchema = new mongoose.Schema({
  // Unique clinic identifier (e.g., "KINSHASA_MAIN", "LUBUMBASHI_01")
  clinicId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },

  // Human-readable name
  name: {
    type: String,
    required: true,
    trim: true
  },

  shortName: {
    type: String,
    trim: true,
    maxlength: 10
  },

  // Sync authentication token (hashed)
  syncTokenHash: {
    type: String,
    required: true
  },

  // API key for additional operations
  apiKey: {
    type: String,
    unique: true,
    sparse: true
  },

  // Location
  location: {
    city: String,
    province: String,
    country: { type: String, default: 'RDC' },
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },

  // Contact
  contact: {
    phone: String,
    email: String,
    adminName: String
  },

  // Clinic type
  type: {
    type: String,
    enum: ['main', 'satellite', 'depot', 'mobile', 'partner'],
    default: 'satellite'
  },

  // Parent clinic (for satellites)
  parentClinic: {
    type: String,
    ref: 'ClinicRegistry'
  },

  // Services offered
  services: [{
    type: String,
    enum: [
      'consultation', 'ophthalmology', 'optometry', 'pharmacy',
      'laboratory', 'optical_shop', 'surgery', 'ivt_injections'
    ]
  }],

  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending_approval'],
    default: 'pending_approval',
    index: true
  },

  // Sync configuration
  syncConfig: {
    // What data this clinic can sync
    allowedCollections: [{
      type: String,
      enum: ['patients', 'visits', 'appointments', 'invoices', 'prescriptions',
             'ophthalmologyExams', 'inventory', 'users', 'documents']
    }],
    // Sync frequency preference (in seconds)
    syncInterval: { type: Number, default: 300 },
    // Last successful sync
    lastSyncAt: Date,
    // Last pull from central
    lastPullAt: Date,
    // Last push to central
    lastPushAt: Date,
    // Sync enabled
    syncEnabled: { type: Boolean, default: true }
  },

  // Connection tracking
  connection: {
    lastSeenAt: Date,
    lastIP: String,
    lastUserAgent: String,
    onlineStatus: {
      type: String,
      enum: ['online', 'offline', 'unknown'],
      default: 'unknown'
    }
  },

  // Statistics
  stats: {
    totalPatients: { type: Number, default: 0 },
    totalVisits: { type: Number, default: 0 },
    totalInvoices: { type: Number, default: 0 },
    totalSyncedRecords: { type: Number, default: 0 },
    lastStatsUpdate: Date
  },

  // Audit
  registeredAt: {
    type: Date,
    default: Date.now
  },
  registeredBy: String,
  approvedAt: Date,
  approvedBy: String,
  suspendedAt: Date,
  suspendedReason: String,

  notes: String

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
clinicRegistrySchema.index({ clinicId: 1 }, { unique: true });
clinicRegistrySchema.index({ status: 1 });
clinicRegistrySchema.index({ 'location.city': 1 });
clinicRegistrySchema.index({ 'connection.lastSeenAt': -1 });

// Virtual: Is online (seen in last 5 minutes)
clinicRegistrySchema.virtual('isOnline').get(function() {
  if (!this.connection?.lastSeenAt) return false;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.connection.lastSeenAt > fiveMinutesAgo;
});

// Pre-save: Generate API key if not present
clinicRegistrySchema.pre('save', async function(next) {
  if (this.isNew && !this.apiKey) {
    this.apiKey = `MF-${this.clinicId}-${uuidv4().substring(0, 8).toUpperCase()}`;
  }
  next();
});

// Static: Register new clinic
clinicRegistrySchema.statics.registerClinic = async function(clinicData, syncToken) {
  // Hash the sync token
  const salt = await bcrypt.genSalt(10);
  const syncTokenHash = await bcrypt.hash(syncToken, salt);

  const clinic = await this.create({
    ...clinicData,
    syncTokenHash,
    status: 'pending_approval',
    registeredAt: new Date(),
    syncConfig: {
      allowedCollections: ['patients', 'visits', 'appointments', 'invoices',
                          'prescriptions', 'ophthalmologyExams', 'inventory'],
      syncInterval: 300,
      syncEnabled: true
    }
  });

  return clinic;
};

// Static: Verify sync token
clinicRegistrySchema.statics.verifySyncToken = async function(clinicId, token) {
  const clinic = await this.findOne({ clinicId, status: 'active' });
  if (!clinic) return null;

  const isValid = await bcrypt.compare(token, clinic.syncTokenHash);
  if (!isValid) return null;

  // Update last seen
  clinic.connection.lastSeenAt = new Date();
  clinic.connection.onlineStatus = 'online';
  await clinic.save();

  return clinic;
};

// Static: Get active clinics
clinicRegistrySchema.statics.getActiveClinics = async function() {
  return this.find({ status: 'active' })
    .select('clinicId name shortName location.city type services stats connection.lastSeenAt')
    .sort({ name: 1 })
    .lean();
};

// Static: Get clinic for sync
clinicRegistrySchema.statics.getForSync = async function(clinicId) {
  return this.findOne({
    clinicId,
    status: 'active',
    'syncConfig.syncEnabled': true
  });
};

// Method: Update sync timestamp
clinicRegistrySchema.methods.updateSyncTimestamp = async function(type = 'both') {
  const now = new Date();

  if (type === 'push' || type === 'both') {
    this.syncConfig.lastPushAt = now;
  }
  if (type === 'pull' || type === 'both') {
    this.syncConfig.lastPullAt = now;
  }
  this.syncConfig.lastSyncAt = now;

  return this.save();
};

// Method: Update connection info
clinicRegistrySchema.methods.updateConnection = async function(ip, userAgent) {
  this.connection.lastSeenAt = new Date();
  this.connection.lastIP = ip;
  this.connection.lastUserAgent = userAgent;
  this.connection.onlineStatus = 'online';
  return this.save();
};

// Method: Check if collection is allowed for sync
clinicRegistrySchema.methods.canSync = function(collection) {
  if (!this.syncConfig.syncEnabled) return false;
  return this.syncConfig.allowedCollections.includes(collection);
};

module.exports = mongoose.model('ClinicRegistry', clinicRegistrySchema);
