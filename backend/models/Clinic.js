const mongoose = require('mongoose');

/**
 * Clinic Model
 * Represents a physical clinic/location in the MedFlow network
 */
const clinicSchema = new mongoose.Schema({
  clinicId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },

  name: {
    type: String,
    required: [true, 'Clinic name is required'],
    trim: true
  },

  shortName: {
    type: String,
    trim: true,
    maxlength: 10
  },

  // Location details
  address: {
    street: String,
    city: String,
    province: String,
    country: { type: String, default: 'RDC' },
    postalCode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },

  // Contact info
  contact: {
    phone: String,
    alternatePhone: String,
    email: String,
    fax: String
  },

  // Operating hours
  operatingHours: {
    monday: { open: String, close: String, closed: Boolean },
    tuesday: { open: String, close: String, closed: Boolean },
    wednesday: { open: String, close: String, closed: Boolean },
    thursday: { open: String, close: String, closed: Boolean },
    friday: { open: String, close: String, closed: Boolean },
    saturday: { open: String, close: String, closed: Boolean },
    sunday: { open: String, close: String, closed: Boolean }
  },

  // Timezone
  timezone: {
    type: String,
    default: 'Africa/Kinshasa'
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'temporarily_closed'],
    default: 'active'
  },

  // Clinic type
  type: {
    type: String,
    enum: ['main', 'satellite', 'mobile', 'partner', 'depot'],
    default: 'satellite'
  },

  // Parent clinic (for satellite locations)
  parentClinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic'
  },

  // Services offered at this clinic
  services: [{
    type: String,
    enum: [
      'consultation',
      'ophthalmology',
      'optometry',
      'refraction',
      'oct',
      'visual_field',
      'fundus_photography',
      'surgery',
      'ivt_injections',
      'laser',
      'pharmacy',
      'laboratory',
      'optical_shop',
      'warehouse',
      'inventory_management'
    ]
  }],

  // Pricing modifiers for inventory (percentage adjustment from base/depot price)
  pricingModifiers: {
    optical: {
      type: Number,
      default: 0,  // 0 = no change, 30 = +30%, -25 = -25%
      min: -100,
      max: 500
    },
    pharmacy: {
      type: Number,
      default: 0,
      min: -100,
      max: 500
    }
  },

  // Network share paths for this clinic's devices
  networkShares: [{
    name: String,
    path: String,
    deviceType: String,
    modality: String,
    isActive: { type: Boolean, default: true }
  }],

  // Billing settings
  billing: {
    taxId: String,
    bankAccount: String,
    defaultCurrency: { type: String, default: 'CDF' },
    invoicePrefix: String,
    // Different fee schedules per clinic
    useCentralFeeSchedule: { type: Boolean, default: true }
  },

  // Branding
  branding: {
    logo: String,
    primaryColor: String,
    secondaryColor: String
  },

  // Statistics cache (updated periodically)
  stats: {
    totalPatients: { type: Number, default: 0 },
    totalVisitsThisMonth: { type: Number, default: 0 },
    activeStaff: { type: Number, default: 0 },
    lastUpdated: Date
  },

  notes: String,

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
clinicSchema.index({ clinicId: 1 }, { unique: true });
clinicSchema.index({ status: 1 });
clinicSchema.index({ 'address.city': 1 });
clinicSchema.index({ type: 1 });

// Virtual for full address
clinicSchema.virtual('fullAddress').get(function() {
  const parts = [
    this.address?.street,
    this.address?.city,
    this.address?.province,
    this.address?.country
  ].filter(Boolean);
  return parts.join(', ');
});

// Virtual for staff count
clinicSchema.virtual('staffCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'clinics',
  count: true
});

// Static: Get active clinics
clinicSchema.statics.getActive = async function() {
  return this.find({ status: 'active' })
    .select('clinicId name shortName address.city type services')
    .sort({ type: 1, name: 1 })
    .lean();
};

// Static: Get clinic by ID
clinicSchema.statics.getByClinicId = async function(clinicId) {
  return this.findOne({ clinicId: clinicId.toUpperCase() });
};

// Static: Get all clinics for dropdown
clinicSchema.statics.getForDropdown = async function() {
  return this.find({ status: 'active' })
    .select('clinicId name shortName address.city')
    .sort({ name: 1 })
    .lean();
};

// Method: Check if clinic offers a service
clinicSchema.methods.offersService = function(service) {
  return this.services.includes(service);
};

// Method: Update stats
clinicSchema.methods.updateStats = async function() {
  const Patient = mongoose.model('Patient');
  const Visit = mongoose.model('Visit');
  const User = mongoose.model('User');

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [patientCount, visitCount, staffCount] = await Promise.all([
    Patient.countDocuments({ clinic: this._id }),
    Visit.countDocuments({
      clinic: this._id,
      createdAt: { $gte: startOfMonth }
    }),
    User.countDocuments({
      clinics: this._id,
      status: 'active'
    })
  ]);

  this.stats = {
    totalPatients: patientCount,
    totalVisitsThisMonth: visitCount,
    activeStaff: staffCount,
    lastUpdated: new Date()
  };

  return this.save();
};

module.exports = mongoose.model('Clinic', clinicSchema);
