const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  // There should only be one settings document per clinic
  type: {
    type: String,
    enum: ['clinic'],
    default: 'clinic',
    unique: true
  },

  // Clinic Information
  clinic: {
    name: {
      type: String,
      default: 'MedFlow Clinic'
    },
    address: {
      type: String,
      default: ''
    },
    phone: {
      type: String,
      default: ''
    },
    email: {
      type: String,
      default: ''
    },
    logo: {
      type: String,
      default: ''
    },
    website: {
      type: String,
      default: ''
    },
    taxId: {
      type: String,
      default: ''
    }
  },

  // Notification Preferences (global defaults)
  notifications: {
    appointmentReminders: {
      type: Boolean,
      default: true
    },
    stockAlerts: {
      type: Boolean,
      default: true
    },
    financialReports: {
      type: Boolean,
      default: false
    },
    followUpReminders: {
      type: Boolean,
      default: false
    },
    reminderLeadTime: {
      type: Number,
      default: 24 // hours before appointment
    },
    lowStockThreshold: {
      type: Number,
      default: 10
    }
  },

  // Twilio Configuration
  twilio: {
    accountSid: {
      type: String,
      default: ''
    },
    authToken: {
      type: String,
      default: ''
    },
    smsNumber: {
      type: String,
      default: ''
    },
    whatsappNumber: {
      type: String,
      default: ''
    },
    enabled: {
      type: Boolean,
      default: false
    }
  },

  // Regional Settings
  regional: {
    language: {
      type: String,
      enum: ['fr', 'en', 'sw'],
      default: 'fr'
    },
    timezone: {
      type: String,
      default: 'Africa/Kinshasa'
    },
    currency: {
      type: String,
      default: 'USD'
    },
    dateFormat: {
      type: String,
      default: 'DD/MM/YYYY'
    },
    timeFormat: {
      type: String,
      enum: ['12h', '24h'],
      default: '24h'
    }
  },

  // Appearance Settings
  appearance: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'light'
    },
    primaryColor: {
      type: String,
      default: '#2563eb'
    },
    compactMode: {
      type: Boolean,
      default: false
    }
  },

  // Appointment Settings
  appointments: {
    defaultDuration: {
      type: Number,
      default: 30 // minutes
    },
    bufferTime: {
      type: Number,
      default: 5 // minutes between appointments
    },
    workingHours: {
      start: {
        type: String,
        default: '08:00'
      },
      end: {
        type: String,
        default: '18:00'
      }
    },
    workingDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5] // Monday to Friday
    }
  },

  // Prescription Settings
  prescriptions: {
    defaultValidity: {
      type: Number,
      default: 30 // days
    },
    requireSignature: {
      type: Boolean,
      default: true
    },
    autoNumber: {
      type: Boolean,
      default: true
    }
  },

  // Audit
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
SettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne({ type: 'clinic' });
  if (!settings) {
    settings = await this.create({ type: 'clinic' });
  }
  return settings;
};

module.exports = mongoose.model('Settings', SettingsSchema);
