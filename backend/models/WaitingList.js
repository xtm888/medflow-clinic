const mongoose = require('mongoose');

const waitingListSchema = new mongoose.Schema({
  // Patient information
  patient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Patient',
    required: true
  },

  clinic: {
    type: mongoose.Schema.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic is required for multi-tenant isolation'],
    index: true
  },

  // Requested provider (optional - patient may accept any provider)
  requestedProvider: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  // Appointment type requested
  appointmentType: {
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

  // Department
  department: {
    type: String,
    enum: ['general', 'ophthalmology', 'pediatrics', 'cardiology', 'orthopedics', 'emergency', 'laboratory', 'radiology'],
    required: true
  },

  // Priority
  priority: {
    type: String,
    enum: ['normal', 'high', 'urgent'],
    default: 'normal'
  },

  // Reason for appointment
  reason: {
    type: String,
    required: true
  },

  // Patient preferences
  preferences: {
    preferredDays: [{
      type: Number,
      min: 0,
      max: 6
    }],
    preferredTimeSlots: [{
      type: String,
      enum: ['morning', 'afternoon', 'evening']
    }],
    earliestDate: Date,
    latestDate: Date,
    flexibleProvider: {
      type: Boolean,
      default: true
    }
  },

  // Contact preferences for notification when slot available
  contactPreferences: {
    email: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: false
    },
    phone: {
      type: Boolean,
      default: false
    }
  },

  // Status
  status: {
    type: String,
    enum: ['waiting', 'notified', 'scheduled', 'expired', 'cancelled'],
    default: 'waiting'
  },

  // Position in queue
  position: {
    type: Number
  },

  // Notifications sent
  notifications: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'phone']
    },
    sentAt: Date,
    slotOffered: {
      date: Date,
      startTime: String,
      endTime: String,
      provider: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      }
    },
    response: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired']
    },
    respondedAt: Date,
    expiresAt: Date
  }],

  // If scheduled, link to appointment
  scheduledAppointment: {
    type: mongoose.Schema.ObjectId,
    ref: 'Appointment'
  },

  // Notes
  notes: String,
  internalNotes: String,

  // Expiry
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days default
  },

  // Audit
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

// Indexes
waitingListSchema.index({ patient: 1, status: 1 });
waitingListSchema.index({ clinic: 1, status: 1, priority: -1, createdAt: 1 });
waitingListSchema.index({ clinic: 1, patient: 1, status: 1 });
waitingListSchema.index({ department: 1, status: 1, priority: -1, createdAt: 1 });
waitingListSchema.index({ requestedProvider: 1, status: 1 });
waitingListSchema.index({ expiresAt: 1 });
waitingListSchema.index({ status: 1, priority: -1, position: 1 });

// Virtual for days waiting
waitingListSchema.virtual('daysWaiting').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Pre-save hook to assign position
waitingListSchema.pre('save', async function(next) {
  if (this.isNew && !this.position) {
    // Get the highest position for this department/priority combo
    const WaitingList = this.constructor;
    const lastEntry = await WaitingList.findOne({
      department: this.department,
      status: 'waiting'
    }).sort({ position: -1 });

    this.position = lastEntry ? lastEntry.position + 1 : 1;
  }
  next();
});

// Method to notify patient of available slot
waitingListSchema.methods.notifySlotAvailable = async function(slot, notificationType = 'email') {
  const notification = {
    type: notificationType,
    sentAt: new Date(),
    slotOffered: {
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      provider: slot.provider
    },
    response: 'pending',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours to respond
  };

  this.notifications.push(notification);
  this.status = 'notified';
  await this.save();

  // Actual notification sending would be done here via email/SMS service
  return notification;
};

// Method to respond to slot offer
waitingListSchema.methods.respondToOffer = async function(notificationId, accept) {
  const notification = this.notifications.id(notificationId);

  if (!notification) {
    throw new Error('Notification not found');
  }

  if (notification.response !== 'pending') {
    throw new Error('Already responded to this offer');
  }

  if (new Date() > notification.expiresAt) {
    notification.response = 'expired';
    await this.save();
    throw new Error('Offer has expired');
  }

  notification.response = accept ? 'accepted' : 'declined';
  notification.respondedAt = new Date();

  if (accept) {
    this.status = 'scheduled';
  } else {
    // If declined, put back in waiting status
    this.status = 'waiting';
  }

  await this.save();
  return notification;
};

// Static method to get next in queue
waitingListSchema.statics.getNextInQueue = async function(department, provider = null) {
  const query = {
    department,
    status: 'waiting'
  };

  if (provider) {
    query.$or = [
      { requestedProvider: provider },
      { 'preferences.flexibleProvider': true }
    ];
  }

  return this.findOne(query)
    .sort({ priority: -1, position: 1 })
    .populate('patient', 'firstName lastName patientId phoneNumber email');
};

// Static method to check for matches when a slot becomes available
waitingListSchema.statics.findMatchingPatients = async function(slot) {
  const dayOfWeek = new Date(slot.date).getDay();
  const hour = parseInt(slot.startTime.split(':')[0]);
  let timeSlot;

  if (hour < 12) timeSlot = 'morning';
  else if (hour < 17) timeSlot = 'afternoon';
  else timeSlot = 'evening';

  const query = {
    department: slot.department,
    status: 'waiting',
    $or: [
      { requestedProvider: slot.provider },
      { 'preferences.flexibleProvider': true }
    ],
    $and: [
      {
        $or: [
          { 'preferences.preferredDays': { $size: 0 } },
          { 'preferences.preferredDays': dayOfWeek }
        ]
      },
      {
        $or: [
          { 'preferences.preferredTimeSlots': { $size: 0 } },
          { 'preferences.preferredTimeSlots': timeSlot }
        ]
      },
      {
        $or: [
          { 'preferences.earliestDate': { $exists: false } },
          { 'preferences.earliestDate': { $lte: new Date(slot.date) } }
        ]
      },
      {
        $or: [
          { 'preferences.latestDate': { $exists: false } },
          { 'preferences.latestDate': { $gte: new Date(slot.date) } }
        ]
      }
    ]
  };

  return this.find(query)
    .sort({ priority: -1, position: 1 })
    .limit(5)
    .populate('patient', 'firstName lastName patientId phoneNumber email');
};

module.exports = mongoose.model('WaitingList', waitingListSchema);
