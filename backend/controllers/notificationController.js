const Notification = require('../models/Notification');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Get user's notifications
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    unreadOnly = false,
    type
  } = req.query;

  const query = { recipient: req.user.id };

  if (unreadOnly === 'true') {
    query.read = false;
  }

  if (type) {
    query.type = type;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit)),
    Notification.countDocuments(query),
    Notification.getUnreadCount(req.user.id)
  ]);

  res.status(200).json({
    success: true,
    count: notifications.length,
    total,
    unreadCount,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: notifications
  });
});

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.getUnreadCount(req.user.id);

  res.status(200).json({
    success: true,
    data: { count }
  });
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipient: req.user.id
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      error: 'Notification not found'
    });
  }

  await notification.markAsRead();

  res.status(200).json({
    success: true,
    message: 'Notification marked as read'
  });
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
exports.markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user.id, read: false },
    { read: true, readAt: new Date() }
  );

  res.status(200).json({
    success: true,
    message: 'All notifications marked as read'
  });
});

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    recipient: req.user.id
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      error: 'Notification not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Notification deleted'
  });
});

// @desc    Clear all notifications
// @route   DELETE /api/notifications/clear-all
// @access  Private
exports.clearAllNotifications = asyncHandler(async (req, res) => {
  await Notification.deleteMany({ recipient: req.user.id });

  res.status(200).json({
    success: true,
    message: 'All notifications cleared'
  });
});

// @desc    Create notification (admin/system)
// @route   POST /api/notifications
// @access  Private (Admin)
exports.createNotification = asyncHandler(async (req, res) => {
  const { recipientId, recipientIds, type, title, message, link, priority, entityType, entityId } = req.body;

  if (!type || !title || !message) {
    return res.status(400).json({
      success: false,
      error: 'Type, title, and message are required'
    });
  }

  let result;

  if (recipientIds && recipientIds.length > 0) {
    // Notify multiple users
    result = await Notification.notifyMany(recipientIds, {
      type,
      title,
      message,
      link,
      priority,
      entityType,
      entityId
    });

    res.status(201).json({
      success: true,
      message: `Notification sent to ${result.length} users`,
      data: result
    });
  } else if (recipientId) {
    // Notify single user
    result = await Notification.notify(recipientId, {
      type,
      title,
      message,
      link,
      priority,
      entityType,
      entityId
    });

    res.status(201).json({
      success: true,
      message: 'Notification created',
      data: result
    });
  } else {
    return res.status(400).json({
      success: false,
      error: 'recipientId or recipientIds is required'
    });
  }
});

// @desc    Send broadcast notification to all users or by role
// @route   POST /api/notifications/broadcast
// @access  Private (Admin)
exports.broadcastNotification = asyncHandler(async (req, res) => {
  const { type, title, message, link, priority, roles } = req.body;

  if (!type || !title || !message) {
    return res.status(400).json({
      success: false,
      error: 'Type, title, and message are required'
    });
  }

  // Get target users
  const query = { isActive: true };
  if (roles && roles.length > 0) {
    query.role = { $in: roles };
  }

  const users = await User.find(query).select('_id');
  const userIds = users.map(u => u._id);

  if (userIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No users found matching criteria'
    });
  }

  const result = await Notification.notifyMany(userIds, {
    type: type || 'system_announcement',
    title,
    message,
    link,
    priority,
    entityType: 'system'
  });

  res.status(201).json({
    success: true,
    message: `Broadcast sent to ${result.length} users`,
    data: { count: result.length }
  });
});

// @desc    Get notification preferences
// @route   GET /api/notifications/preferences
// @access  Private
exports.getPreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('preferences');

  const defaultPreferences = {
    email: true,
    sms: false,
    push: false,
    appointmentReminders: true,
    prescriptionAlerts: true,
    invoiceAlerts: true,
    systemAnnouncements: true
  };

  res.status(200).json({
    success: true,
    data: user.preferences?.notifications || defaultPreferences
  });
});

// @desc    Update notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
exports.updatePreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user.preferences) {
    user.preferences = {};
  }

  user.preferences.notifications = {
    ...user.preferences.notifications,
    ...req.body
  };

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Notification preferences updated',
    data: user.preferences.notifications
  });
});
