const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  // Multi-Clinic: Which clinic this room belongs to
  clinic: {
    type: mongoose.Schema.ObjectId,
    ref: 'Clinic',
    required: true,
    index: true
  },

  // Room identification
  roomNumber: {
    type: String,
    required: true,
    trim: true
  },

  name: {
    type: String,
    required: true,
    trim: true
  },

  // Room type/department
  type: {
    type: String,
    enum: [
      'consultation',
      'examination',
      'procedure',
      'surgery',
      'waiting',
      'triage',
      'laboratory',
      'imaging',
      'pharmacy',
      'reception',
      'ophthalmology',
      'orthoptic',
      'emergency'
    ],
    required: true
  },

  department: {
    type: String,
    enum: ['general', 'ophthalmology', 'pediatrics', 'cardiology', 'orthopedics', 'emergency', 'laboratory', 'radiology'],
    default: 'general'
  },

  // Location details
  floor: {
    type: Number,
    default: 0
  },

  building: {
    type: String,
    default: 'Main'
  },

  // Room capacity
  capacity: {
    type: Number,
    default: 1
  },

  // Current status
  status: {
    type: String,
    enum: ['available', 'occupied', 'cleaning', 'maintenance', 'reserved', 'closed'],
    default: 'available'
  },

  // Current occupancy
  currentPatient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Patient'
  },

  currentAppointment: {
    type: mongoose.Schema.ObjectId,
    ref: 'Appointment'
  },

  currentProvider: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  occupiedAt: Date,

  // Queue display settings
  displaySettings: {
    showOnDisplayBoard: {
      type: Boolean,
      default: true
    },
    displayOrder: {
      type: Number,
      default: 0
    },
    displayColor: {
      type: String,
      default: '#3B82F6' // Blue
    }
  },

  // Equipment/features in the room
  equipment: [{
    name: String,
    type: String,
    status: {
      type: String,
      enum: ['working', 'maintenance', 'broken'],
      default: 'working'
    }
  }],

  features: [{
    type: String,
    enum: [
      'wheelchair_accessible',
      'oxygen_supply',
      'monitor',
      'slit_lamp',
      'autorefractor',
      'tonometer',
      'oct',
      'perimeter',
      'exam_chair',
      'surgical_table',
      'air_conditioning',
      'private',
      'pediatric_friendly'
    ]
  }],

  // Audio announcement settings
  audioSettings: {
    enabled: {
      type: Boolean,
      default: true
    },
    volume: {
      type: Number,
      min: 0,
      max: 100,
      default: 70
    },
    language: {
      type: String,
      enum: ['fr', 'en', 'sw', 'ln'],
      default: 'fr'
    }
  },

  // Assigned providers (who can use this room)
  assignedProviders: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }],

  // Operating hours
  operatingHours: {
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String }
  },

  // Statistics tracking
  stats: {
    totalPatientsToday: {
      type: Number,
      default: 0
    },
    averageConsultationTime: {
      type: Number,
      default: 0
    },
    lastResetDate: Date
  },

  // Active status
  isActive: {
    type: Boolean,
    default: true
  },

  notes: String
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
roomSchema.index({ clinic: 1, roomNumber: 1 }, { unique: true }); // Compound unique: same room number allowed in different clinics
roomSchema.index({ clinic: 1, status: 1 });
roomSchema.index({ clinic: 1, department: 1, status: 1 });
roomSchema.index({ clinic: 1, type: 1, status: 1 });
roomSchema.index({ 'displaySettings.showOnDisplayBoard': 1, clinic: 1 });

// Virtual for display name
roomSchema.virtual('displayName').get(function() {
  return `${this.name} (${this.roomNumber})`;
});

// Check if room is currently available
roomSchema.methods.isAvailable = function() {
  return this.status === 'available' && this.isActive;
};

// Occupy room with patient
roomSchema.methods.occupy = async function(patientId, appointmentId, providerId) {
  this.status = 'occupied';
  this.currentPatient = patientId;
  this.currentAppointment = appointmentId;
  this.currentProvider = providerId;
  this.occupiedAt = new Date();
  this.stats.totalPatientsToday = (this.stats.totalPatientsToday || 0) + 1;
  return this.save();
};

// Release room
roomSchema.methods.release = async function(updateStats = true) {
  if (updateStats && this.occupiedAt) {
    const duration = (new Date() - this.occupiedAt) / (1000 * 60); // minutes
    const totalPatients = this.stats.totalPatientsToday || 1;
    const currentAvg = this.stats.averageConsultationTime || 0;
    // Running average
    this.stats.averageConsultationTime = Math.round(
      ((currentAvg * (totalPatients - 1)) + duration) / totalPatients
    );
  }

  this.status = 'available';
  this.currentPatient = null;
  this.currentAppointment = null;
  this.currentProvider = null;
  this.occupiedAt = null;
  return this.save();
};

// Mark for cleaning
roomSchema.methods.markForCleaning = async function() {
  this.status = 'cleaning';
  return this.save();
};

// Static: Get available rooms for department (filtered by clinic)
roomSchema.statics.getAvailableRooms = async function(clinicId, department = null, type = null) {
  const query = {
    status: 'available',
    isActive: true
  };

  // MULTI-CLINIC: Filter by clinic
  if (clinicId) query.clinic = clinicId;

  if (department) query.department = department;
  if (type) query.type = type;

  return this.find(query)
    .populate('clinic', 'clinicId name shortName')
    .sort('displaySettings.displayOrder roomNumber')
    .select('roomNumber name type department floor features clinic');
};

// Static: Get room status for display board (filtered by clinic)
roomSchema.statics.getDisplayBoardData = async function(clinicId, department = null) {
  const query = {
    'displaySettings.showOnDisplayBoard': true,
    isActive: true
  };

  // MULTI-CLINIC: Filter by clinic
  if (clinicId) query.clinic = clinicId;

  if (department) query.department = department;

  return this.find(query)
    .populate('clinic', 'clinicId name shortName')
    .populate('currentPatient', 'firstName lastName patientId')
    .populate('currentProvider', 'firstName lastName')
    .populate('currentAppointment', 'queueNumber')
    .sort('displaySettings.displayOrder roomNumber');
};

// Static: Reset daily stats
roomSchema.statics.resetDailyStats = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await this.updateMany(
    {
      $or: [
        { 'stats.lastResetDate': { $lt: today } },
        { 'stats.lastResetDate': null }
      ]
    },
    {
      $set: {
        'stats.totalPatientsToday': 0,
        'stats.lastResetDate': today
      }
    }
  );
};

// Pre-save middleware
roomSchema.pre('save', function(next) {
  // Normalize room number to uppercase
  if (this.roomNumber) {
    this.roomNumber = this.roomNumber.toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Room', roomSchema);
