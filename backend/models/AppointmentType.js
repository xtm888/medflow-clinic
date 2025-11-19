const mongoose = require('mongoose');

const appointmentTypeSchema = new mongoose.Schema({
  typeId: {
    type: String,
    unique: true,
    required: true
  },

  name: {
    type: String,
    required: true
  },

  nameFr: {
    type: String,
    required: true,
    index: true
  },

  category: {
    type: String,
    enum: ['consultation', 'diagnostic', 'imaging', 'surgical', 'laser', 'injection', 'therapy', 'follow-up', 'emergency'],
    required: true
  },

  subcategory: String,

  description: String,

  descriptionFr: String,

  // Duration information
  duration: {
    estimated: {
      type: Number, // in minutes
      required: true,
      default: 30
    },
    preparation: Number, // prep time before appointment
    recovery: Number, // recovery time after procedure
    total: Number // total time including prep and recovery
  },

  // Staff requirements
  requiredStaff: [{
    role: {
      type: String,
      enum: ['doctor', 'ophthalmologist', 'nurse', 'receptionist', 'lab_technician', 'anesthetist', 'assistant']
    },
    quantity: {
      type: Number,
      default: 1
    },
    required: {
      type: Boolean,
      default: true
    }
  }],

  // Equipment and room requirements
  requiredEquipment: [{
    name: String,
    nameFr: String,
    required: Boolean,
    alternatives: [String]
  }],

  roomRequirements: {
    type: {
      type: String,
      enum: ['exam_room', 'procedure_room', 'operating_room', 'imaging_room', 'consultation_room', 'any']
    },
    features: [String], // e.g., ['sterile', 'darkroom', 'slit_lamp']
    minSize: Number // in square meters
  },

  // Prerequisites and preparation
  prerequisites: [{
    type: String,
    description: String,
    required: Boolean
  }],

  patientPreparation: {
    before: [{
      instruction: String,
      instructionFr: String,
      timing: String, // e.g., "24 hours before", "morning of"
      required: Boolean
    }],
    during: [{
      instruction: String,
      instructionFr: String
    }],
    after: [{
      instruction: String,
      instructionFr: String,
      duration: String // e.g., "for 24 hours"
    }]
  },

  // Restrictions and contraindications
  restrictions: {
    minAge: Number,
    maxAge: Number,
    contraindications: [String],
    warnings: [String]
  },

  // Scheduling rules
  schedulingRules: {
    allowOnline: {
      type: Boolean,
      default: false
    },
    requiresApproval: {
      type: Boolean,
      default: false
    },
    minAdvanceBooking: Number, // hours
    maxAdvanceBooking: Number, // days
    allowedDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    allowedTimeSlots: [{
      start: String, // e.g., "08:00"
      end: String    // e.g., "12:00"
    }],
    maxPerDay: Number, // maximum number of this type per day
    bufferBefore: Number, // minutes of buffer before
    bufferAfter: Number // minutes of buffer after
  },

  // Clinical information
  clinicalAct: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClinicalAct'
  },

  anesthesiaRequired: {
    type: String,
    enum: ['none', 'local', 'topical', 'general', 'sedation', 'optional'],
    default: 'none'
  },

  // Ophthalmic-specific
  ophthalmicDetails: {
    requiresDilation: Boolean,
    dilationTime: Number, // minutes to wait after dilation
    affectsVision: Boolean, // if patient shouldn't drive after
    requiresPressureCheck: Boolean,
    canBeBilateral: Boolean, // can be done on both eyes same day
    eye: {
      type: String,
      enum: ['OD', 'OS', 'OU', 'NA']
    }
  },

  // Follow-up requirements
  followUp: {
    required: Boolean,
    defaultTiming: String, // e.g., "1 week", "1 month"
    appointmentType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AppointmentType'
    }
  },

  // Billing information
  billing: {
    basePrice: Number,
    cptCode: String,
    icdCodes: [String],
    insuranceCoverage: {
      type: String,
      enum: ['full', 'partial', 'none', 'varies']
    },
    estimatedCost: {
      min: Number,
      max: Number,
      currency: {
        type: String,
        default: 'EUR'
      }
    }
  },

  // Documentation requirements
  documentation: {
    consentFormRequired: Boolean,
    consentFormTemplate: String,
    photographsAllowed: Boolean,
    recordingAllowed: Boolean,
    customForms: [{
      name: String,
      nameFr: String,
      template: String,
      required: Boolean
    }]
  },

  // Status and metadata
  active: {
    type: Boolean,
    default: true
  },

  department: {
    type: String,
    enum: ['ophthalmology', 'general_medicine', 'pediatrics', 'cardiology', 'radiology'],
    default: 'ophthalmology'
  },

  priority: {
    type: Number,
    default: 0, // higher number = higher priority in lists
    min: 0,
    max: 10
  },

  tags: [String], // for filtering and searching

  notes: String,

  // Statistics (for analytics)
  stats: {
    totalScheduled: {
      type: Number,
      default: 0
    },
    totalCompleted: {
      type: Number,
      default: 0
    },
    averageDuration: Number,
    cancellationRate: Number
  }
}, {
  timestamps: true
});

// Indexes
appointmentTypeSchema.index({ name: 'text', nameFr: 'text', description: 'text', descriptionFr: 'text' });
appointmentTypeSchema.index({ category: 1, active: 1 });
appointmentTypeSchema.index({ department: 1, active: 1 });
appointmentTypeSchema.index({ 'schedulingRules.allowOnline': 1 });
appointmentTypeSchema.index({ tags: 1 });

// Virtual for total duration including prep and recovery
appointmentTypeSchema.virtual('totalDuration').get(function() {
  const base = this.duration.estimated || 0;
  const prep = this.duration.preparation || 0;
  const recovery = this.duration.recovery || 0;
  return base + prep + recovery;
});

// Methods
appointmentTypeSchema.methods.canScheduleOnDate = function(date) {
  if (!this.schedulingRules || !this.schedulingRules.allowedDays || this.schedulingRules.allowedDays.length === 0) {
    return true;
  }

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = days[date.getDay()];

  return this.schedulingRules.allowedDays.includes(dayName);
};

appointmentTypeSchema.methods.canScheduleOnline = function() {
  return this.schedulingRules && this.schedulingRules.allowOnline === true;
};

appointmentTypeSchema.methods.requiresDoctorApproval = function() {
  return this.schedulingRules && this.schedulingRules.requiresApproval === true;
};

appointmentTypeSchema.methods.getPreparationInstructions = function(language = 'en') {
  if (!this.patientPreparation) return [];

  const instructions = [];
  const field = language === 'fr' ? 'instructionFr' : 'instruction';

  if (this.patientPreparation.before) {
    this.patientPreparation.before.forEach(prep => {
      if (prep[field]) {
        instructions.push({
          when: 'before',
          instruction: prep[field],
          timing: prep.timing,
          required: prep.required
        });
      }
    });
  }

  return instructions;
};

// Static methods
appointmentTypeSchema.statics.searchTypes = async function(query, filters = {}) {
  const searchCriteria = {
    active: true
  };

  if (query) {
    searchCriteria.$or = [
      { name: new RegExp(query, 'i') },
      { nameFr: new RegExp(query, 'i') },
      { description: new RegExp(query, 'i') }
    ];
  }

  if (filters.category) {
    searchCriteria.category = filters.category;
  }

  if (filters.department) {
    searchCriteria.department = filters.department;
  }

  if (filters.onlineBookable) {
    searchCriteria['schedulingRules.allowOnline'] = true;
  }

  return this.find(searchCriteria)
    .sort({ priority: -1, name: 1 })
    .limit(filters.limit || 50);
};

appointmentTypeSchema.statics.getByCategory = async function(category) {
  return this.find({ category, active: true })
    .sort({ priority: -1, name: 1 });
};

appointmentTypeSchema.statics.getOphthalmologyTypes = async function() {
  return this.find({ department: 'ophthalmology', active: true })
    .sort({ category: 1, name: 1 });
};

// Middleware
appointmentTypeSchema.pre('save', function(next) {
  // Calculate total duration if not set
  if (this.duration && !this.duration.total) {
    this.duration.total = this.totalDuration;
  }

  // Ensure typeId is set
  if (!this.typeId) {
    this.typeId = `APPT${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  }

  next();
});

module.exports = mongoose.model('AppointmentType', appointmentTypeSchema);
