const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  // Identification
  appointmentId: {
    type: String,
    unique: true,
    required: true
  },

  // Patient Information
  patient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Patient',
    required: true
  },

  // Provider Information
  provider: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  requestedProvider: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  // Scheduling Details
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  duration: {
    type: Number, // in minutes
    default: 30
  },

  // Appointment Type
  type: {
    type: String,
    enum: [
      'consultation',
      'follow-up',
      'emergency',
      'routine-checkup',
      'vaccination',
      'lab-test',
      'imaging',
      'procedure',
      'surgery',
      'ophthalmology',
      'refraction',
      'telemedicine'
    ],
    required: true
  },
  subType: String, // For more specific categorization

  // Department and Service
  department: {
    type: String,
    enum: ['general', 'ophthalmology', 'pediatrics', 'cardiology', 'orthopedics', 'emergency', 'laboratory', 'radiology'],
    required: true
  },
  service: {
    type: mongoose.Schema.ObjectId,
    ref: 'Service'
  },

  // Status
  status: {
    type: String,
    enum: [
      'scheduled',
      'confirmed',
      'checked-in',
      'in-progress',
      'completed',
      'cancelled',
      'no-show',
      'rescheduled'
    ],
    default: 'scheduled'
  },

  // Priority
  priority: {
    type: String,
    enum: ['normal', 'high', 'urgent', 'emergency', 'vip', 'pregnant', 'elderly'],
    default: 'normal'
  },

  // Reason and Notes
  reason: {
    type: String,
    required: true
  },
  symptoms: [String],
  chiefComplaint: String,
  notes: String,
  internalNotes: String, // Staff-only notes

  // Location
  location: {
    room: String,
    floor: String,
    building: String,
    address: String,
    isVirtual: {
      type: Boolean,
      default: false
    },
    virtualLink: String
  },

  // Queue Management
  queueNumber: Number,
  checkInTime: Date,
  waitingTime: Number, // in minutes
  consultationStartTime: Date,
  consultationEndTime: Date,

  // Reminders
  reminders: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'push', 'call']
    },
    scheduledFor: Date,
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: Date,
    status: String,
    error: String
  }],

  // Recurring Appointment
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrence: {
    pattern: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'yearly']
    },
    interval: Number,
    daysOfWeek: [Number], // 0-6 (Sunday-Saturday)
    dayOfMonth: Number,
    endDate: Date,
    occurrences: Number,
    parentAppointment: {
      type: mongoose.Schema.ObjectId,
      ref: 'Appointment'
    }
  },

  // Preparation Instructions
  preparation: {
    instructions: String,
    fasting: {
      required: Boolean,
      hours: Number
    },
    medications: {
      stop: [String],
      continue: [String]
    },
    documents: [String]
  },

  // Results and Follow-up
  outcome: {
    diagnosis: [String],
    procedures: [String],
    prescriptions: [{
      type: mongoose.Schema.ObjectId,
      ref: 'Prescription'
    }],
    labOrders: [{
      type: mongoose.Schema.ObjectId,
      ref: 'LabOrder'
    }],
    imagingOrders: [{
      type: mongoose.Schema.ObjectId,
      ref: 'ImagingOrder'
    }],
    followUpRequired: Boolean,
    followUpScheduled: Boolean,
    followUpDate: Date,
    referrals: [{
      to: String,
      reason: String,
      urgency: String,
      date: Date
    }]
  },

  // Documents
  attachments: [{
    name: String,
    type: String,
    url: String,
    uploadedAt: Date,
    uploadedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  }],

  // Billing
  billing: {
    status: {
      type: String,
      enum: ['pending', 'processed', 'paid', 'cancelled'],
      default: 'pending'
    },
    invoice: {
      type: mongoose.Schema.ObjectId,
      ref: 'Invoice'
    },
    services: [{
      service: {
        type: mongoose.Schema.ObjectId,
        ref: 'Service'
      },
      quantity: Number,
      price: Number
    }],
    totalAmount: Number,
    insuranceClaim: {
      type: mongoose.Schema.ObjectId,
      ref: 'InsuranceClaim'
    }
  },

  // Cancellation/Rescheduling
  cancellation: {
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    reason: String,
    fee: Number
  },
  rescheduled: {
    from: Date,
    to: Date,
    by: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    reason: String,
    count: {
      type: Number,
      default: 0
    }
  },

  // Confirmation
  confirmation: {
    required: {
      type: Boolean,
      default: true
    },
    confirmed: {
      type: Boolean,
      default: false
    },
    confirmedAt: Date,
    confirmedBy: String, // 'patient', 'staff', 'system'
    method: String // 'phone', 'sms', 'email', 'in-person'
  },

  // Rating and Feedback
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    submittedAt: Date,
    categories: {
      waitTime: Number,
      staffCourtesy: Number,
      cleanliness: Number,
      overallExperience: Number
    }
  },

  // Integration
  externalId: String, // ID from external system
  source: {
    type: String,
    enum: ['web', 'mobile', 'phone', 'walk-in', 'referral', 'recurring'],
    default: 'web'
  },

  // Audit
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  statusHistory: [{
    status: String,
    changedAt: Date,
    changedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    reason: String
  }],

  // Optimistic locking - prevents lost updates from concurrent modifications
  version: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  optimisticConcurrency: true,
  versionKey: 'version'
});

// Indexes
appointmentSchema.index({ patient: 1, date: -1 });
appointmentSchema.index({ provider: 1, date: 1, status: 1 });
appointmentSchema.index({ date: 1, startTime: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ type: 1, department: 1 });
appointmentSchema.index({ appointmentId: 1 });

// Virtual for isToday
appointmentSchema.virtual('isToday').get(function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const appointmentDate = new Date(this.date);
  appointmentDate.setHours(0, 0, 0, 0);
  return today.getTime() === appointmentDate.getTime();
});

// Virtual for isPast
appointmentSchema.virtual('isPast').get(function() {
  return new Date(this.date) < new Date();
});

// Virtual for isFuture
appointmentSchema.virtual('isFuture').get(function() {
  return new Date(this.date) > new Date();
});

// CRITICAL: Validate dates to prevent inappropriate future dates
appointmentSchema.pre('save', function(next) {
  const now = new Date();

  // Check-in time should not be in the future (can't check in before it happens)
  if (this.checkInTime && new Date(this.checkInTime) > now) {
    const error = new Error('Check-in time cannot be in the future');
    error.name = 'ValidationError';
    error.statusCode = 400;
    return next(error);
  }

  // Cancellation time should not be in the future
  if (this.cancellation?.cancelledAt && new Date(this.cancellation.cancelledAt) > now) {
    const error = new Error('Cancellation time cannot be in the future');
    error.name = 'ValidationError';
    error.statusCode = 400;
    return next(error);
  }

  // Completion time should not be in the future
  if (this.completedAt && new Date(this.completedAt) > now) {
    const error = new Error('Completion time cannot be in the future');
    error.name = 'ValidationError';
    error.statusCode = 400;
    return next(error);
  }

  next();
});

// Generate appointment ID
appointmentSchema.pre('save', async function(next) {
  if (!this.appointmentId) {
    const date = new Date(this.date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const count = await this.constructor.countDocuments({
      date: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      }
    });
    this.appointmentId = `APT${year}${month}${day}${String(count + 1).padStart(4, '0')}`;
  }

  // Add to status history
  if (this.isModified('status')) {
    if (!this.statusHistory) {
      this.statusHistory = [];
    }
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date(),
      changedBy: this.updatedBy
    });
  }

  next();
});

// Check for conflicts
appointmentSchema.methods.hasConflict = async function() {
  const Appointment = this.constructor;
  const startTime = new Date(`${this.date} ${this.startTime}`);
  const endTime = new Date(`${this.date} ${this.endTime}`);

  const conflict = await Appointment.findOne({
    _id: { $ne: this._id },
    provider: this.provider,
    date: this.date,
    status: { $nin: ['cancelled', 'no-show'] },
    $or: [
      {
        startTime: { $gte: this.startTime, $lt: this.endTime }
      },
      {
        endTime: { $gt: this.startTime, $lte: this.endTime }
      },
      {
        startTime: { $lte: this.startTime },
        endTime: { $gte: this.endTime }
      }
    ]
  });

  return !!conflict;
};

// Send reminder
appointmentSchema.methods.sendReminder = async function(type) {
  // Implementation would depend on notification service
  // This is a placeholder for the actual implementation
  const reminder = {
    type,
    scheduledFor: new Date(),
    sent: false
  };

  this.reminders.push(reminder);
  await this.save();

  // Actual sending logic would go here
  return reminder;
};

// Calculate waiting time
appointmentSchema.methods.calculateWaitingTime = function() {
  if (this.checkInTime && this.consultationStartTime) {
    const waitTime = (this.consultationStartTime - this.checkInTime) / (1000 * 60); // in minutes
    this.waitingTime = Math.round(waitTime);
    return this.waitingTime;
  }
  return null;
};

module.exports = mongoose.model('Appointment', appointmentSchema);