const mongoose = require('mongoose');
const Counter = require('./Counter');

/**
 * Enhanced medication in protocol schema
 * StudioVision Parity - supports tapering schedules, timing, and frequency codes
 */
const medicationInProtocolSchema = new mongoose.Schema({
  medicationTemplate: {
    type: mongoose.Schema.ObjectId,
    ref: 'Drug'
  },

  // Drug identification (stored for display even without reference)
  drugName: {
    type: String,
    required: true
  },
  genericName: String,
  drugClass: String,

  // Enhanced dosage configuration
  dosage: {
    eye: {
      type: String,
      enum: ['OD', 'OS', 'OU'],
      default: 'OU'
    },
    frequency: String,
    frequencyCode: {
      type: String,
      enum: ['QD', 'BID', 'TID', 'QID', 'Q1H', 'Q2H', 'Q4H', 'Q6H', 'QHS', 'PRN', 'QOD', 'QW', 'STAT']
    },
    timing: [{
      type: String,
      enum: ['morning', 'noon', 'afternoon', 'evening', 'bedtime', 'with_meals']
    }],
    duration: {
      value: Number,
      unit: {
        type: String,
        enum: ['hours', 'days', 'weeks', 'months', 'continuous', 'until_follow_up']
      }
    },
    drops: {
      type: Number,
      default: 1
    }
  },

  // Tapering schedule for steroids
  taper: {
    enabled: {
      type: Boolean,
      default: false
    },
    schedule: [{
      week: Number,
      day: Number,
      frequency: String,
      frequencyCode: String,
      instructions: String,
      instructionsFr: String
    }]
  },

  // Legacy fields for backward compatibility
  dose: {
    value: String,
    label: String,
    text: String
  },
  posologie: {
    value: String,
    label: String,
    text: String
  },
  details: [{
    value: String,
    label: String,
    text: String
  }],
  duration: {
    value: String,
    label: String,
    text: String
  },

  quantity: Number,
  unit: String,
  refills: {
    type: Number,
    default: 0
  },

  instructions: String,
  instructionsFr: String,

  order: {
    type: Number,
    default: 0
  },

  // Wait time before next medication (minutes)
  waitTimeAfter: {
    type: Number,
    default: 5
  },

  isOptional: {
    type: Boolean,
    default: false
  },

  warnings: [String],

  // Soft delete support
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date
}, { _id: false });

const treatmentProtocolSchema = new mongoose.Schema({
  protocolId: {
    type: String,
    unique: true
  },

  name: {
    type: String,
    required: true,
    trim: true
  },
  // French name for bilingual support
  nameFr: {
    type: String,
    trim: true
  },

  description: String,
  descriptionFr: String,

  // Enhanced category list for StudioVision parity
  category: {
    type: String,
    enum: [
      // Original categories
      'glaucome',
      'cataracte',
      'dmla',
      'retinopathie_diabetique',
      'uveite',
      'secheresse_oculaire',
      'infection',
      'allergie',
      'inflammation',
      'post_operatoire',
      'prophylaxie',
      'autre',
      // English equivalents for compatibility
      'glaucoma',
      'post_surgical',
      'dry_eye',
      'injection',
      'pediatric',
      'emergency',
      'custom'
    ]
  },

  subcategory: String,

  medications: [medicationInProtocolSchema],

  // Protocol type
  type: {
    type: String,
    enum: ['standard', 'personal', 'favorite'],
    default: 'personal'
  },

  // Enhanced visibility settings
  visibility: {
    type: String,
    enum: ['system', 'clinic', 'personal'],
    default: 'personal'
  },
  isSystemWide: {
    type: Boolean,
    default: false
  },

  isActive: {
    type: Boolean,
    default: true
  },

  // Owner and clinic
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  clinic: {
    type: mongoose.Schema.ObjectId,
    ref: 'Clinic'
  },

  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: Date,
  usageHistory: [{
    usedAt: Date,
    usedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    patientId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Patient'
    }
  }],

  // Tags for searching
  tags: [String],

  // Indications (when to use)
  indication: String,
  indications: [{
    icdCode: String,
    description: String,
    descriptionFr: String
  }],

  // Contraindications (when NOT to use)
  contraindications: [{
    description: String,
    descriptionFr: String,
    severity: {
      type: String,
      enum: ['absolute', 'relative', 'caution']
    }
  }],

  clinicalNotes: String,

  // Expected duration
  expectedDuration: {
    value: Number,
    unit: {
      type: String,
      enum: ['days', 'weeks', 'months', 'continuous']
    }
  },

  // UI display settings
  displayOrder: {
    type: Number,
    default: 0
  },
  color: {
    type: String,
    default: '#3B82F6'
  },
  icon: {
    type: String,
    default: '💧'
  },

  // Version control
  version: {
    type: Number,
    default: 1
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
treatmentProtocolSchema.index({ name: 'text', description: 'text', tags: 'text' });
treatmentProtocolSchema.index({ category: 1, isActive: 1 });
treatmentProtocolSchema.index({ createdBy: 1, type: 1 });
treatmentProtocolSchema.index({ isSystemWide: 1, isActive: 1 });
treatmentProtocolSchema.index({ usageCount: -1 });

// Generate protocol ID
treatmentProtocolSchema.pre('save', async function(next) {
  if (!this.protocolId) {
    const sequence = await Counter.getNextSequence('treatmentProtocol');
    this.protocolId = `PROT${String(sequence).padStart(6, '0')}`;
  }
  next();
});

// Increment usage count (enhanced with history tracking)
treatmentProtocolSchema.methods.incrementUsage = async function(userId, patientId) {
  this.usageCount += 1;
  this.lastUsed = new Date();

  // Track usage history (keep last 100)
  if (!this.usageHistory) {
    this.usageHistory = [];
  }
  this.usageHistory.push({
    usedAt: new Date(),
    usedBy: userId,
    patientId
  });
  if (this.usageHistory.length > 100) {
    this.usageHistory = this.usageHistory.slice(-100);
  }

  await this.save();
};

// Virtual for medication count
treatmentProtocolSchema.virtual('medicationCount').get(function() {
  return this.medications?.length || 0;
});

// Convert protocol to prescription medications format
treatmentProtocolSchema.methods.toPrescriptionMedications = function(overrides = {}) {
  return this.medications.map((med, index) => ({
    drugId: med.medicationTemplate,
    name: med.drugName || 'Unknown',
    genericName: med.genericName,
    dosage: med.dosage?.frequency || med.posologie?.text || 'As directed',
    frequency: med.dosage?.frequencyCode || med.dosage?.frequency,
    eye: overrides.eye || med.dosage?.eye || 'OU',
    duration: med.dosage?.duration
      ? `${med.dosage.duration.value} ${med.dosage.duration.unit}`
      : med.duration?.text || 'Until follow-up',
    instructions: med.instructions || '',
    quantity: med.quantity || 1,
    refills: med.refills || 0,
    orderIndex: med.order || index,
    waitTimeAfter: med.waitTimeAfter || 5,
    isFromProtocol: true,
    protocolId: this._id,
    protocolName: this.name,
    taper: med.taper?.enabled ? med.taper : null
  }));
};

// Static method to get user's protocols (personal + system-wide)
treatmentProtocolSchema.statics.getUserProtocols = async function(userId, options = {}) {
  const query = {
    $or: [
      { createdBy: userId, type: { $in: ['personal', 'favorite'] } },
      { isSystemWide: true, type: 'standard' }
    ],
    isActive: true
  };

  if (options.category) {
    query.category = options.category;
  }

  return await this.find(query)
    .populate('medications.medicationTemplate')
    .populate('createdBy', 'firstName lastName')
    .sort({ usageCount: -1, createdAt: -1 });
};

// Static method to get popular protocols
treatmentProtocolSchema.statics.getPopular = async function(limit = 10) {
  return await this.find({
    isSystemWide: true,
    isActive: true
  })
    .populate('medications.medicationTemplate')
    .sort({ usageCount: -1 })
    .limit(limit);
};

module.exports = mongoose.model('TreatmentProtocol', treatmentProtocolSchema);
