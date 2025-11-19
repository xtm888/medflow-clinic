const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  // Target user(s)
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Notification type
  type: {
    type: String,
    enum: [
      'appointment_reminder',
      'appointment_confirmed',
      'appointment_cancelled',
      'prescription_ready',
      'prescription_expiring',
      'invoice_due',
      'invoice_paid',
      'result_available',
      'message_received',
      'stock_alert',
      'system_announcement',
      'task_assigned',
      'followup_due'
    ],
    required: true
  },

  // Notification content
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },

  // Associated entity
  entityType: {
    type: String,
    enum: ['appointment', 'prescription', 'invoice', 'patient', 'message', 'task', 'system']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId
  },

  // Link to navigate to
  link: {
    type: String
  },

  // Priority level
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },

  // Status
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },

  // Delivery channels
  channels: {
    inApp: {
      type: Boolean,
      default: true
    },
    email: {
      type: Boolean,
      default: false
    },
    sms: {
      type: Boolean,
      default: false
    },
    push: {
      type: Boolean,
      default: false
    }
  },

  // Delivery status
  deliveryStatus: {
    email: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      error: String
    },
    sms: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      error: String
    }
  },

  // Expiration
  expiresAt: {
    type: Date
  },

  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, type: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to create notification for user
NotificationSchema.statics.notify = async function(recipientId, data) {
  return this.create({
    recipient: recipientId,
    type: data.type,
    title: data.title,
    message: data.message,
    entityType: data.entityType,
    entityId: data.entityId,
    link: data.link,
    priority: data.priority || 'normal',
    channels: data.channels || { inApp: true },
    metadata: data.metadata,
    expiresAt: data.expiresAt
  });
};

// Static method to notify multiple users
NotificationSchema.statics.notifyMany = async function(recipientIds, data) {
  const notifications = recipientIds.map(recipientId => ({
    recipient: recipientId,
    type: data.type,
    title: data.title,
    message: data.message,
    entityType: data.entityType,
    entityId: data.entityId,
    link: data.link,
    priority: data.priority || 'normal',
    channels: data.channels || { inApp: true },
    metadata: data.metadata,
    expiresAt: data.expiresAt
  }));

  return this.insertMany(notifications);
};

// Static method to get unread count for user
NotificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({ recipient: userId, read: false });
};

// Instance method to mark as read
NotificationSchema.methods.markAsRead = async function() {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Notification', NotificationSchema);
