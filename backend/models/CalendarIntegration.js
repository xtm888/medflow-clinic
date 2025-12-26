const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Calendar Integration Model
 * Stores OAuth tokens and sync settings for external calendar providers
 * Supports Google Calendar and Microsoft Outlook/365
 */
const calendarIntegrationSchema = new mongoose.Schema({
  // User who owns this integration
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },

  // Provider type
  provider: {
    type: String,
    enum: ['google', 'outlook', 'apple', 'ical'],
    required: true
  },

  // Provider account email/identifier
  providerAccountId: {
    type: String,
    required: true
  },

  providerAccountEmail: {
    type: String,
    trim: true,
    lowercase: true
  },

  // OAuth tokens (encrypted at rest)
  accessToken: {
    type: String,
    required: true
  },

  refreshToken: {
    type: String
  },

  tokenExpiresAt: {
    type: Date
  },

  // Scope granted
  scope: {
    type: String
  },

  // Calendar IDs to sync
  calendars: [{
    calendarId: String,
    name: String,
    primary: Boolean,
    syncEnabled: {
      type: Boolean,
      default: true
    },
    color: String,
    // Sync direction
    syncDirection: {
      type: String,
      enum: ['bidirectional', 'push_only', 'pull_only'],
      default: 'bidirectional'
    }
  }],

  // Default calendar for new events
  defaultCalendarId: {
    type: String
  },

  // Sync settings
  syncSettings: {
    // Auto-sync enabled
    enabled: {
      type: Boolean,
      default: true
    },

    // Sync interval in minutes
    syncInterval: {
      type: Number,
      default: 15,
      min: 5,
      max: 60
    },

    // What to sync
    syncAppointments: {
      type: Boolean,
      default: true
    },

    syncReminders: {
      type: Boolean,
      default: true
    },

    // Include patient names in external calendar
    includePatientNames: {
      type: Boolean,
      default: false // Privacy setting - default to anonymous
    },

    // Include appointment details
    includeDetails: {
      type: Boolean,
      default: false
    },

    // Prefix for synced events
    eventPrefix: {
      type: String,
      default: '[MedFlow]'
    },

    // Days to sync (past and future)
    syncPastDays: {
      type: Number,
      default: 7
    },

    syncFutureDays: {
      type: Number,
      default: 90
    }
  },

  // Sync state
  syncState: {
    lastSyncAt: Date,
    lastSyncStatus: {
      type: String,
      enum: ['success', 'partial', 'failed', 'pending'],
      default: 'pending'
    },
    lastSyncError: String,
    syncToken: String, // For incremental sync (Google)
    deltaLink: String, // For incremental sync (Outlook)
    eventsCreated: Number,
    eventsUpdated: Number,
    eventsDeleted: Number
  },

  // Event mapping (MedFlow appointment ID -> External event ID)
  eventMappings: [{
    appointmentId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Appointment'
    },
    externalEventId: String,
    calendarId: String,
    lastSyncAt: Date,
    syncStatus: {
      type: String,
      enum: ['synced', 'pending', 'conflict', 'error'],
      default: 'pending'
    }
  }],

  // Connection status
  status: {
    type: String,
    enum: ['active', 'expired', 'revoked', 'error'],
    default: 'active'
  },

  // Metadata
  connectedAt: {
    type: Date,
    default: Date.now
  },

  lastActivityAt: {
    type: Date,
    default: Date.now
  }
,

  // Soft delete support
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date,

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
calendarIntegrationSchema.index({ user: 1, provider: 1 }, { unique: true });
calendarIntegrationSchema.index({ 'syncState.lastSyncAt': 1 });
calendarIntegrationSchema.index({ status: 1 });
calendarIntegrationSchema.index({ 'eventMappings.appointmentId': 1 });
calendarIntegrationSchema.index({ 'eventMappings.externalEventId': 1 });

// Encryption key from environment (required in production)
const ENCRYPTION_KEY = (() => {
  if (process.env.CALENDAR_ENCRYPTION_KEY) {
    return process.env.CALENDAR_ENCRYPTION_KEY;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL: CALENDAR_ENCRYPTION_KEY must be set in production');
  }
  console.warn('⚠️  CALENDAR_ENCRYPTION_KEY not set - using development fallback (NOT FOR PRODUCTION)');
  return 'dev-only-calendar-key-not-for-production';
})();

// Encrypt sensitive data before saving
calendarIntegrationSchema.pre('save', function(next) {
  // Only encrypt if token is modified and not already encrypted
  if (this.isModified('accessToken') && this.accessToken && !this.accessToken.startsWith('enc:')) {
    this.accessToken = encryptToken(this.accessToken);
  }
  if (this.isModified('refreshToken') && this.refreshToken && !this.refreshToken.startsWith('enc:')) {
    this.refreshToken = encryptToken(this.refreshToken);
  }
  next();
});

// Methods to get decrypted tokens
calendarIntegrationSchema.methods.getAccessToken = function() {
  if (!this.accessToken) return null;
  return this.accessToken.startsWith('enc:')
    ? decryptToken(this.accessToken)
    : this.accessToken;
};

calendarIntegrationSchema.methods.getRefreshToken = function() {
  if (!this.refreshToken) return null;
  return this.refreshToken.startsWith('enc:')
    ? decryptToken(this.refreshToken)
    : this.refreshToken;
};

// Check if token is expired
calendarIntegrationSchema.methods.isTokenExpired = function() {
  if (!this.tokenExpiresAt) return true;
  // Consider expired if within 5 minutes of expiry
  return new Date() >= new Date(this.tokenExpiresAt.getTime() - 5 * 60 * 1000);
};

// Update tokens after refresh
calendarIntegrationSchema.methods.updateTokens = async function(accessToken, refreshToken, expiresIn) {
  this.accessToken = accessToken;
  if (refreshToken) {
    this.refreshToken = refreshToken;
  }
  if (expiresIn) {
    this.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
  }
  this.status = 'active';
  this.lastActivityAt = new Date();
  return this.save();
};

// Get event mapping for an appointment
calendarIntegrationSchema.methods.getEventMapping = function(appointmentId) {
  return this.eventMappings.find(
    m => m.appointmentId.toString() === appointmentId.toString()
  );
};

// Add or update event mapping
calendarIntegrationSchema.methods.upsertEventMapping = function(appointmentId, externalEventId, calendarId) {
  const existing = this.eventMappings.find(
    m => m.appointmentId.toString() === appointmentId.toString()
  );

  if (existing) {
    existing.externalEventId = externalEventId;
    existing.calendarId = calendarId;
    existing.lastSyncAt = new Date();
    existing.syncStatus = 'synced';
  } else {
    this.eventMappings.push({
      appointmentId,
      externalEventId,
      calendarId,
      lastSyncAt: new Date(),
      syncStatus: 'synced'
    });
  }
};

// Remove event mapping
calendarIntegrationSchema.methods.removeEventMapping = function(appointmentId) {
  this.eventMappings = this.eventMappings.filter(
    m => m.appointmentId.toString() !== appointmentId.toString()
  );
};

// Update sync state
calendarIntegrationSchema.methods.updateSyncState = function(status, error = null, stats = {}) {
  this.syncState.lastSyncAt = new Date();
  this.syncState.lastSyncStatus = status;
  this.syncState.lastSyncError = error;
  if (stats.created !== undefined) this.syncState.eventsCreated = stats.created;
  if (stats.updated !== undefined) this.syncState.eventsUpdated = stats.updated;
  if (stats.deleted !== undefined) this.syncState.eventsDeleted = stats.deleted;
  if (stats.syncToken) this.syncState.syncToken = stats.syncToken;
  if (stats.deltaLink) this.syncState.deltaLink = stats.deltaLink;
};

// Static: Get all active integrations needing sync
calendarIntegrationSchema.statics.getIntegrationsToSync = async function() {
  const now = new Date();

  return this.find({
    status: 'active',
    'syncSettings.enabled': true,
    $or: [
      { 'syncState.lastSyncAt': null },
      {
        $expr: {
          $lte: [
            '$syncState.lastSyncAt',
            new Date(now.getTime() - '$syncSettings.syncInterval' * 60 * 1000)
          ]
        }
      }
    ]
  }).populate('user', 'firstName lastName email');
};

// Static: Get integration for user and provider
calendarIntegrationSchema.statics.getForUser = async function(userId, provider) {
  return this.findOne({ user: userId, provider });
};

// Encryption helpers
function encryptToken(text) {
  try {
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `enc:${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Token encryption error:', error);
    return text; // Return unencrypted on error (dev mode)
  }
}

function decryptToken(encryptedText) {
  try {
    if (!encryptedText.startsWith('enc:')) return encryptedText;
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Token decryption error:', error);
    return null;
  }
}

module.exports = mongoose.model('CalendarIntegration', calendarIntegrationSchema);
