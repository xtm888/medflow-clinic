const mongoose = require('mongoose');

const externalFacilitySchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Facility name is required'],
    trim: true
  },

  type: {
    type: String,
    enum: ['pharmacy', 'laboratory', 'imaging-center', 'surgical-facility', 'optical-shop', 'specialist-clinic', 'hospital', 'therapy-center', 'other'],
    required: [true, 'Facility type is required']
  },

  subType: {
    type: String,
    trim: true
    // e.g., 'ophthalmology-surgery', 'retina-specialist', 'compounding-pharmacy'
  },

  // Contact Information
  contact: {
    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: { type: String, default: 'RDC' }
    },
    phone: String,
    alternatePhone: String,
    fax: String,
    email: String,
    website: String
  },

  // Primary Contact Person
  primaryContact: {
    name: String,
    role: String,
    phone: String,
    email: String
  },

  // Operating Hours
  operatingHours: {
    monday: { open: String, close: String, closed: Boolean },
    tuesday: { open: String, close: String, closed: Boolean },
    wednesday: { open: String, close: String, closed: Boolean },
    thursday: { open: String, close: String, closed: Boolean },
    friday: { open: String, close: String, closed: Boolean },
    saturday: { open: String, close: String, closed: Boolean },
    sunday: { open: String, close: String, closed: Boolean }
  },

  // Integration Settings
  integration: {
    type: {
      type: String,
      enum: ['none', 'email', 'fax', 'api', 'hl7', 'fhir'],
      default: 'none'
    },
    apiEndpoint: String,
    apiKey: String, // Encrypted
    username: String,
    password: String, // Encrypted
    fhirBaseUrl: String,
    hl7Version: String,

    // Document formats they accept
    acceptedFormats: [{
      type: String,
      enum: ['pdf', 'json', 'xml', 'hl7', 'fhir', 'csv', 'text']
    }],

    // Auto-dispatch settings
    autoDispatch: {
      enabled: { type: Boolean, default: false },
      method: { type: String, enum: ['email', 'api', 'fax'] },
      confirmationRequired: { type: Boolean, default: true }
    }
  },

  // Service Capabilities
  capabilities: {
    // For pharmacies
    pharmacy: {
      compounding: Boolean,
      specialtyMedications: Boolean,
      delivery: Boolean,
      insuranceProcessing: Boolean,
      controlledSubstances: Boolean
    },

    // For labs
    laboratory: {
      urgentProcessing: Boolean,
      specialtyTests: [String],
      averageTurnaroundHours: Number,
      homeCollection: Boolean
    },

    // For imaging
    imaging: {
      modalities: [{
        type: String,
        enum: ['xray', 'ct', 'mri', 'ultrasound', 'oct', 'fundus', 'angiography', 'petct', 'mammography', 'dexa']
      }],
      contrastAvailable: Boolean,
      sedationAvailable: Boolean,
      averageWaitDays: Number
    },

    // For surgical facilities
    surgical: {
      procedures: [String],
      surgeons: [{
        name: String,
        specialty: String,
        phone: String,
        email: String
      }],
      operatingRooms: Number,
      emergencyCapable: Boolean,
      overnightStay: Boolean
    },

    // For optical shops
    optical: {
      inHouseLab: Boolean,
      frameBrands: [String],
      contactLenses: Boolean,
      sameDay: Boolean,
      averageTurnaroundDays: Number
    }
  },

  // Financial
  financial: {
    acceptedPaymentMethods: [String],
    acceptedInsurance: [String],
    priceAgreement: {
      hasAgreement: Boolean,
      discountPercentage: Number,
      validUntil: Date,
      terms: String
    },
    bankDetails: {
      bankName: String,
      accountNumber: String,
      accountName: String
    }
  },

  // Performance Tracking
  performance: {
    totalReferrals: { type: Number, default: 0 },
    completedReferrals: { type: Number, default: 0 },
    averageCompletionDays: Number,
    rating: { type: Number, min: 1, max: 5 },
    lastReferralDate: Date,
    issues: [{
      date: Date,
      description: String,
      resolved: Boolean,
      resolvedDate: Date
    }]
  },

  // Documents & Credentials
  documents: [{
    type: { type: String }, // 'license', 'contract', 'insurance', 'certification'
    name: String,
    fileUrl: String,
    expiryDate: Date,
    uploadedAt: Date,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  // Preferred for specific services
  preferredFor: [{
    serviceCode: String,
    serviceName: String,
    reason: String
  }],

  // Notes
  notes: String,
  internalNotes: String, // For staff only

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  // Clinic association (for multi-clinic setups)
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic'
  },

  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
externalFacilitySchema.index({ name: 1 });
externalFacilitySchema.index({ type: 1 });
externalFacilitySchema.index({ isActive: 1 });
externalFacilitySchema.index({ 'contact.address.city': 1 });
externalFacilitySchema.index({ clinic: 1 });
externalFacilitySchema.index({ 'preferredFor.serviceCode': 1 });
// Compound indexes for common query patterns
externalFacilitySchema.index({ isActive: 1, type: 1, name: 1 });
externalFacilitySchema.index({ clinic: 1, isActive: 1 });

// Text search
externalFacilitySchema.index({
  name: 'text',
  'contact.address.city': 'text',
  'capabilities.surgical.procedures': 'text'
});

// Virtual for full address
externalFacilitySchema.virtual('fullAddress').get(function() {
  const addr = this.contact?.address;
  if (!addr) return '';
  return [addr.street, addr.city, addr.state, addr.postalCode, addr.country]
    .filter(Boolean)
    .join(', ');
});

// Instance method to check if open now
externalFacilitySchema.methods.isOpenNow = function() {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const now = new Date();
  const dayName = days[now.getDay()];
  const hours = this.operatingHours?.[dayName];

  if (!hours || hours.closed) return false;

  const currentTime = now.toTimeString().slice(0, 5);
  return hours.open <= currentTime && currentTime <= hours.close;
};

// Instance method to increment referral count
externalFacilitySchema.methods.recordReferral = async function(completed = false) {
  this.performance.totalReferrals += 1;
  if (completed) {
    this.performance.completedReferrals += 1;
  }
  this.performance.lastReferralDate = new Date();
  await this.save();
};

// Static method to find by type
externalFacilitySchema.statics.findByType = function(type, options = {}) {
  const query = { type, isActive: true };
  if (options.city) query['contact.address.city'] = options.city;
  if (options.clinic) query.clinic = options.clinic;
  return this.find(query).sort({ 'performance.rating': -1, name: 1 });
};

// Static method to find preferred for a service
externalFacilitySchema.statics.findPreferredForService = function(serviceCode) {
  return this.find({
    'preferredFor.serviceCode': serviceCode,
    isActive: true
  }).sort({ 'performance.rating': -1 });
};

module.exports = mongoose.model('ExternalFacility', externalFacilitySchema);
