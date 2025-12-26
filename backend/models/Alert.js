const mongoose = require('mongoose');
const Counter = require('./Counter');

/**
 * Alert Model
 * Handles notifications, reminders, and alerts for users
 */

const alertSchema = new mongoose.Schema({
  alertId: {
    type: String,
    unique: true,
    sparse: true
  },

  // Multi-clinic support
  clinic: {
    type: mongoose.Schema.ObjectId,
    ref: 'Clinic',
    index: true
  },

  // Alert targeting
  targetUser: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  targetRole: {
    type: String,
    enum: ['doctor', 'nurse', 'receptionist', 'admin', 'pharmacist', 'ophthalmologist', 'orthoptist', 'all'],
    index: true
  },

  // Alert content
  title: {
    type: String,
    required: true
  },

  message: {
    type: String,
    required: true
  },

  type: {
    type: String,
    required: true,
    enum: [
      'appointment_reminder',
      'follow_up_reminder',
      'medication_reminder',
      'prescription_expiry',
      'lab_result_ready',
      'patient_waiting',
      'inventory_low',
      'system_notification',
      'task_reminder',
      'birthday_reminder',
      'custom'
    ],
    index: true
  },

  category: {
    type: String,
    enum: ['urgent', 'important', 'info', 'reminder'],
    default: 'info',
    index: true
  },

  priority: {
    type: Number,
    min: 1,
    max: 5,
    default: 3,
    index: true
  },

  // Related entities
  relatedPatient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Patient'
  },

  relatedAppointment: {
    type: mongoose.Schema.ObjectId,
    ref: 'Appointment'
  },

  relatedVisit: {
    type: mongoose.Schema.ObjectId,
    ref: 'Visit'
  },

  relatedPrescription: {
    type: mongoose.Schema.ObjectId,
    ref: 'Prescription'
  },

  // Scheduling
  scheduledFor: {
    type: Date,
    index: true
  },

  deliveredAt: Date,

  // Status
  status: {
    type: String,
    enum: ['scheduled', 'delivered', 'read', 'dismissed', 'expired'],
    default: 'scheduled',
    index: true
  },

  isRead: {
    type: Boolean,
    default: false,
    index: true
  },

  readAt: Date,

  isDismissed: {
    type: Boolean,
    default: false
  },

  dismissedAt: Date,

  // Action
  actionRequired: {
    type: Boolean,
    default: false
  },

  actionUrl: String,

  actionLabel: String,

  actionCompleted: {
    type: Boolean,
    default: false
  },

  actionCompletedAt: Date,

  // Recurrence for recurring alerts
  isRecurring: {
    type: Boolean,
    default: false
  },

  recurrencePattern: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly']
    },
    interval: Number, // every X days/weeks/months
    daysOfWeek: [Number], // 0-6 for Sunday-Saturday
    dayOfMonth: Number, // 1-31
    endDate: Date
  },

  // Metadata
  icon: String,
  color: String,

  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },

  // Delivery tracking
  deliveryAttempts: {
    type: Number,
    default: 0
  },

  lastDeliveryAttempt: Date,

  // Creator
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  expiresAt: {
    type: Date,
    index: true
  }

}, {
  timestamps: true
});

// Indexes
alertSchema.index({ targetUser: 1, status: 1, isRead: 1 });
alertSchema.index({ targetUser: 1, createdAt: -1 });
alertSchema.index({ scheduledFor: 1, status: 1 });
alertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
// Multi-clinic compound indexes
alertSchema.index({ clinic: 1, targetUser: 1, status: 1 });
alertSchema.index({ clinic: 1, type: 1, createdAt: -1 });
alertSchema.index({ clinic: 1, category: 1, isRead: 1 });

// Generate alert ID
alertSchema.pre('save', async function(next) {
  if (!this.alertId) {
    const counterId = Counter.getDailyCounterId('alert');
    const sequence = await Counter.getNextSequence(counterId);
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    this.alertId = `ALERT-${dateStr}-${String(sequence).padStart(6, '0')}`;
  }
  next();
});

// Static method to get unread alerts for user
alertSchema.statics.getUnreadForUser = async function(userId, limit = 50) {
  return await this.find({
    targetUser: userId,
    status: { $in: ['delivered', 'scheduled'] },
    isRead: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  })
    .populate('relatedPatient', 'firstName lastName patientId')
    .populate('relatedAppointment')
    .sort({ priority: -1, createdAt: -1 })
    .limit(limit);
};

// Static method to get alerts by category
alertSchema.statics.getByCategory = async function(userId, category, limit = 20) {
  return await this.find({
    targetUser: userId,
    category: category,
    status: { $in: ['delivered', 'scheduled'] },
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  })
    .populate('relatedPatient', 'firstName lastName patientId')
    .populate('relatedAppointment')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get scheduled alerts ready for delivery
alertSchema.statics.getScheduledForDelivery = async function() {
  return await this.find({
    status: 'scheduled',
    scheduledFor: { $lte: new Date() },
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  })
    .populate('targetUser', 'firstName lastName email')
    .populate('relatedPatient', 'firstName lastName patientId')
    .sort({ priority: -1, scheduledFor: 1 });
};

// Instance method to mark as read
alertSchema.methods.markAsRead = async function() {
  this.isRead = true;
  this.readAt = new Date();
  if (this.status === 'delivered') {
    this.status = 'read';
  }
  return await this.save();
};

// Instance method to dismiss
alertSchema.methods.dismiss = async function() {
  this.isDismissed = true;
  this.dismissedAt = new Date();
  this.status = 'dismissed';
  return await this.save();
};

// Instance method to mark action as completed
alertSchema.methods.completeAction = async function() {
  this.actionCompleted = true;
  this.actionCompletedAt = new Date();
  return await this.save();
};

// Instance method to deliver alert
alertSchema.methods.deliver = async function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  this.deliveryAttempts += 1;
  this.lastDeliveryAttempt = new Date();
  return await this.save();
};

// Static method to get alert count for user
alertSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({
    targetUser: userId,
    status: { $in: ['delivered', 'scheduled'] },
    isRead: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

// Static method to mark multiple as read
alertSchema.statics.markMultipleAsRead = async function(alertIds, userId) {
  return await this.updateMany(
    {
      _id: { $in: alertIds },
      targetUser: userId
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
        status: 'read'
      }
    }
  );
};

module.exports = mongoose.model('Alert', alertSchema);
