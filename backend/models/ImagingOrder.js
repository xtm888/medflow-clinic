const mongoose = require('mongoose');
const Counter = require('./Counter');

/**
 * Imaging Order Model
 * Manages medical imaging orders (X-ray, CT, MRI, OCT, etc.)
 */
const imagingOrderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true
  },

  patient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient is required']
  },

  clinic: {
    type: mongoose.Schema.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic is required for multi-tenant isolation'],
    index: true
  },

  visit: {
    type: mongoose.Schema.ObjectId,
    ref: 'Visit'
  },

  appointment: {
    type: mongoose.Schema.ObjectId,
    ref: 'Appointment'
  },

  orderedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Ordering provider is required']
  },

  orderDate: {
    type: Date,
    default: Date.now
  },

  priority: {
    type: String,
    enum: ['routine', 'urgent', 'stat', 'asap'],
    default: 'routine'
  },

  status: {
    type: String,
    enum: ['ordered', 'scheduled', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'ordered'
  },

  modality: {
    type: String,
    enum: [
      'xray', 'ct', 'mri', 'ultrasound', 'mammography',
      'oct', 'fundus', 'fluorescein', 'icg', 'visual_field',
      'topography', 'biometry', 'specular_microscopy',
      'pet', 'nuclear', 'dexa', 'other'
    ],
    required: [true, 'Imaging modality is required']
  },

  examType: {
    code: String,
    name: {
      type: String,
      required: [true, 'Exam type name is required']
    },
    description: String
  },

  bodyPart: {
    type: String,
    required: function() {
      return !['oct', 'fundus', 'fluorescein', 'icg', 'visual_field', 'topography', 'biometry', 'specular_microscopy'].includes(this.modality);
    }
  },

  laterality: {
    type: String,
    enum: ['left', 'right', 'bilateral', 'na'],
    default: 'na'
  },

  // Clinical information
  clinicalIndication: {
    type: String,
    required: [true, 'Clinical indication is required']
  },
  clinicalHistory: String,
  diagnosis: String,
  icdCode: String,

  // Contrast
  contrast: {
    required: {
      type: Boolean,
      default: false
    },
    type: String,
    dose: String,
    route: String,
    allergies: String,
    egfrValue: Number,
    egfrDate: Date,
    creatinine: Number,
    creatinineDate: Date
  },

  // Patient preparation
  preparation: {
    fasting: {
      required: Boolean,
      hours: Number,
      confirmed: Boolean
    },
    instructions: String,
    specialRequirements: [String]
  },

  // Scheduling
  scheduledDate: Date,
  scheduledTime: String,
  estimatedDuration: Number,
  scheduledRoom: {
    type: mongoose.Schema.ObjectId,
    ref: 'Room'
  },
  scheduledEquipment: {
    type: mongoose.Schema.ObjectId,
    ref: 'Device'
  },

  // Execution
  actualStartTime: Date,
  actualEndTime: Date,
  performedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  technician: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  // Link to study
  study: {
    type: mongoose.Schema.ObjectId,
    ref: 'ImagingStudy'
  },

  // Status history
  statusHistory: [{
    status: String,
    changedAt: {
      type: Date,
      default: Date.now
    },
    changedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    notes: String
  }],

  // Special instructions
  specialInstructions: String,
  transportMode: {
    type: String,
    enum: ['ambulatory', 'wheelchair', 'stretcher', 'portable'],
    default: 'ambulatory'
  },
  isolationRequired: Boolean,
  oxygenRequired: Boolean,
  ivRequired: Boolean,

  // Billing
  billing: {
    billable: {
      type: Boolean,
      default: true
    },
    invoice: {
      type: mongoose.Schema.ObjectId,
      ref: 'Invoice'
    },
    estimatedCost: Number,
    insurancePreAuth: String,
    preAuthStatus: {
      type: String,
      enum: ['not-required', 'pending', 'approved', 'denied'],
      default: 'not-required'
    }
  },

  // External referral
  externalReferral: {
    referred: Boolean,
    facilityName: String,
    facilityAddress: String,
    referenceNumber: String,
    sentAt: Date
  },

  // Notes and attachments
  notes: String,
  attachments: [{
    filename: String,
    url: String,
    type: String,
    uploadedAt: Date,
    uploadedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  }],

  cancellation: {
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    reason: String
  },

  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
imagingOrderSchema.index({ patient: 1, orderDate: -1 });
imagingOrderSchema.index({ clinic: 1, status: 1, orderDate: -1 });
imagingOrderSchema.index({ clinic: 1, patient: 1, orderDate: -1 });
imagingOrderSchema.index({ status: 1, modality: 1 });
imagingOrderSchema.index({ orderId: 1 }, { unique: true });
imagingOrderSchema.index({ scheduledDate: 1, scheduledTime: 1 });
imagingOrderSchema.index({ orderedBy: 1, orderDate: -1 });
imagingOrderSchema.index({ priority: 1, orderDate: 1 });
imagingOrderSchema.index({ createdAt: -1 });

// Virtual for display name
imagingOrderSchema.virtual('displayName').get(function() {
  const lateralityStr = this.laterality && this.laterality !== 'na' ? ` (${this.laterality})` : '';
  return `${this.examType?.name || this.modality}${lateralityStr}`;
});

// Generate order ID before saving
imagingOrderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderId) {
    const counterId = Counter.getYearlyCounterId('imagingOrder');
    const sequence = await Counter.getNextSequence(counterId);
    const year = new Date().getFullYear();
    this.orderId = `IMG${year}${String(sequence).padStart(6, '0')}`;
  }

  // Track status changes
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date(),
      changedBy: this.updatedBy
    });
  }

  next();
});

// Static method to get pending orders
imagingOrderSchema.statics.getPending = async function(options = {}) {
  const query = { status: { $in: ['ordered', 'scheduled'] } };

  if (options.modality) query.modality = options.modality;
  if (options.priority) query.priority = options.priority;

  return this.find(query)
    .populate('patient', 'firstName lastName patientId dateOfBirth')
    .populate('orderedBy', 'firstName lastName')
    .sort({ priority: -1, orderDate: 1 });
};

// Static method to get scheduled orders for a date
imagingOrderSchema.statics.getScheduledForDate = async function(date, options = {}) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const query = {
    scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['scheduled', 'checked-in', 'in-progress'] }
  };

  if (options.modality) query.modality = options.modality;
  if (options.room) query.scheduledRoom = options.room;

  return this.find(query)
    .populate('patient', 'firstName lastName patientId dateOfBirth phoneNumber')
    .populate('orderedBy', 'firstName lastName')
    .populate('scheduledRoom', 'roomName roomNumber')
    .sort({ scheduledTime: 1 });
};

// Static method to get patient's imaging history
imagingOrderSchema.statics.getPatientHistory = async function(patientId, options = {}) {
  const query = { patient: patientId };

  if (options.modality) query.modality = options.modality;
  if (options.status) query.status = options.status;

  return this.find(query)
    .populate('orderedBy', 'firstName lastName')
    .populate('study')
    .sort({ orderDate: -1 })
    .limit(options.limit || 50);
};

// Instance method to schedule
imagingOrderSchema.methods.schedule = async function(scheduledBy, scheduleData) {
  this.scheduledDate = scheduleData.date;
  this.scheduledTime = scheduleData.time;
  if (scheduleData.room) this.scheduledRoom = scheduleData.room;
  if (scheduleData.equipment) this.scheduledEquipment = scheduleData.equipment;
  if (scheduleData.duration) this.estimatedDuration = scheduleData.duration;
  this.status = 'scheduled';
  this.updatedBy = scheduledBy;
  return this.save();
};

// Instance method to check in
imagingOrderSchema.methods.checkIn = async function(checkedInBy) {
  this.status = 'checked-in';
  this.updatedBy = checkedInBy;
  return this.save();
};

// Instance method to start
imagingOrderSchema.methods.start = async function(startedBy, technicianId) {
  this.status = 'in-progress';
  this.actualStartTime = new Date();
  if (technicianId) this.technician = technicianId;
  this.updatedBy = startedBy;
  return this.save();
};

// Instance method to complete
imagingOrderSchema.methods.complete = async function(completedBy, studyId) {
  this.status = 'completed';
  this.actualEndTime = new Date();
  this.performedBy = completedBy;
  if (studyId) this.study = studyId;
  this.updatedBy = completedBy;
  return this.save();
};

// Instance method to cancel
imagingOrderSchema.methods.cancel = async function(cancelledBy, reason) {
  this.status = 'cancelled';
  this.cancellation = {
    cancelledAt: new Date(),
    cancelledBy,
    reason
  };
  this.updatedBy = cancelledBy;
  return this.save();
};

module.exports = mongoose.model('ImagingOrder', imagingOrderSchema);
