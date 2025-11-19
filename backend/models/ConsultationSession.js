const mongoose = require('mongoose');

/**
 * ConsultationSession Model
 * Stores consultation data with auto-save functionality
 * Supports refraction, contact lens, and orthoptic tabs
 */

// Refraction data schema
const refractionDataSchema = new mongoose.Schema({
  eye: {
    type: String,
    enum: ['OD', 'OG'],
    required: true
  },
  sphere: Number,
  cylinder: Number,
  axis: Number,
  addition: Number,
  visualAcuity: String,
  notes: String
}, { _id: false });

// Contact lens data schema
const contactLensDataSchema = new mongoose.Schema({
  eye: {
    type: String,
    enum: ['OD', 'OG'],
    required: true
  },
  brand: String,
  type: {
    type: String,
    enum: ['soft', 'rigid', 'hybrid', 'scleral']
  },
  baseCurve: Number,
  diameter: Number,
  power: Number,
  cylinder: Number,
  axis: Number,
  addition: Number,
  color: String,
  replacementSchedule: String,
  trialResult: String,
  notes: String
}, { _id: false });

// Orthoptic exam data schema
const orthopticDataSchema = new mongoose.Schema({
  // Visual acuity
  visualAcuity: {
    farOD: String,
    farOG: String,
    farBinocular: String,
    nearOD: String,
    nearOG: String,
    nearBinocular: String
  },

  // Ocular motility
  ocularMotility: {
    versions: String,
    ductions: String,
    nystagmus: String,
    notes: String
  },

  // Cover test
  coverTest: {
    farWithCorrection: String,
    farWithoutCorrection: String,
    nearWithCorrection: String,
    nearWithoutCorrection: String
  },

  // Convergence
  convergence: {
    nearPointOfConvergence: String,
    fusionalReserves: String,
    accommodativeAmplitude: String
  },

  // Binocular vision tests
  binocularVision: {
    worthTest: String,
    stereoTest: String,
    stereoacuity: String,
    bagoliniTest: String
  },

  // Measurements
  measurements: {
    interpupillaryDistance: Number,
    pupilSizeOD: Number,
    pupilSizeOG: Number,
    dominantEye: {
      type: String,
      enum: ['OD', 'OG']
    }
  },

  // Additional findings
  diagnosis: String,
  treatment: String,
  exercises: String,
  followUp: String,
  notes: String
}, { _id: false });

const consultationSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    unique: true,
    sparse: true
  },

  patient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },

  visit: {
    type: mongoose.Schema.ObjectId,
    ref: 'Visit'
  },

  doctor: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },

  // Session metadata
  sessionDate: {
    type: Date,
    default: Date.now,
    index: true
  },

  sessionType: {
    type: String,
    enum: ['refraction', 'contact_lens', 'orthoptic', 'comprehensive'],
    default: 'comprehensive'
  },

  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned'],
    default: 'active',
    index: true
  },

  // Tab data
  refractionData: {
    OD: refractionDataSchema,
    OG: refractionDataSchema,
    prescription: String,
    notes: String
  },

  contactLensData: {
    OD: contactLensDataSchema,
    OG: contactLensDataSchema,
    prescription: String,
    trialDate: Date,
    followUpDate: Date,
    notes: String
  },

  orthopticData: orthopticDataSchema,

  // Auto-save tracking
  lastAutoSave: Date,
  autoSaveCount: {
    type: Number,
    default: 0
  },

  // Manual save tracking
  lastManualSave: Date,
  lastSavedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  // Version control for conflict resolution
  version: {
    type: Number,
    default: 1
  },

  // Completion tracking
  completedAt: Date,
  completedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  // Additional metadata
  activeTab: {
    type: String,
    enum: ['refraction', 'contact_lens', 'orthoptic'],
    default: 'refraction'
  },

  duration: Number, // in seconds

  notes: String

}, {
  timestamps: true
});

// Indexes
consultationSessionSchema.index({ patient: 1, sessionDate: -1 });
consultationSessionSchema.index({ doctor: 1, status: 1 });
consultationSessionSchema.index({ createdAt: -1 });

// Generate session ID
consultationSessionSchema.pre('save', async function(next) {
  if (!this.sessionId) {
    const count = await this.constructor.countDocuments();
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    this.sessionId = `CONS-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Static method to get active session for patient
consultationSessionSchema.statics.getActiveSession = async function(patientId, doctorId) {
  return await this.findOne({
    patient: patientId,
    doctor: doctorId,
    status: 'active'
  })
    .populate('patient', 'firstName lastName patientId')
    .populate('doctor', 'firstName lastName')
    .sort({ createdAt: -1 });
};

// Static method to get recent sessions
consultationSessionSchema.statics.getRecentSessions = async function(doctorId, limit = 10) {
  return await this.find({
    doctor: doctorId,
    status: { $in: ['active', 'completed'] }
  })
    .populate('patient', 'firstName lastName patientId')
    .populate('doctor', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Instance method to auto-save
consultationSessionSchema.methods.autoSave = async function() {
  this.lastAutoSave = new Date();
  this.autoSaveCount += 1;
  return await this.save();
};

// Instance method to complete session
consultationSessionSchema.methods.complete = async function(userId) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.completedBy = userId;

  // Calculate duration
  if (this.createdAt) {
    this.duration = Math.floor((this.completedAt - this.createdAt) / 1000);
  }

  return await this.save();
};

// Instance method to abandon session
consultationSessionSchema.methods.abandon = async function() {
  this.status = 'abandoned';
  return await this.save();
};

module.exports = mongoose.model('ConsultationSession', consultationSessionSchema);
