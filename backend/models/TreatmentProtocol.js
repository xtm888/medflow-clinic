const mongoose = require('mongoose');

const medicationInProtocolSchema = new mongoose.Schema({
  medicationTemplate: {
    type: mongoose.Schema.ObjectId,
    ref: 'Drug', // Reference to Drug model
    required: true
  },

  // Prescription details
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

  instructions: String,

  order: {
    type: Number,
    default: 0
  }
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

  description: String,

  category: {
    type: String,
    enum: [
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
      'autre'
    ]
  },

  medications: [medicationInProtocolSchema],

  // Protocol type
  type: {
    type: String,
    enum: ['standard', 'personal', 'favorite'],
    default: 'personal'
  },

  // Visibility
  isSystemWide: {
    type: Boolean,
    default: false
  },

  isActive: {
    type: Boolean,
    default: true
  },

  // Owner (for personal protocols)
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },

  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },

  lastUsed: Date,

  // Tags for searching
  tags: [String],

  // Indication and notes
  indication: String,
  clinicalNotes: String,

  // Expected duration
  expectedDuration: {
    value: Number,
    unit: {
      type: String,
      enum: ['days', 'weeks', 'months']
    }
  }

}, {
  timestamps: true
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
    const count = await this.constructor.countDocuments();
    this.protocolId = `PROT${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Increment usage count
treatmentProtocolSchema.methods.incrementUsage = async function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  await this.save();
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
