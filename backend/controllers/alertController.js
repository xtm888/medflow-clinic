const Alert = require('../models/Alert');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Get unread alerts for logged-in user
 */
exports.getUnreadAlerts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;

  const alerts = await Alert.getUnreadForUser(req.user._id, limit);
  const unreadCount = await Alert.getUnreadCount(req.user._id);

  res.json({
    success: true,
    count: alerts.length,
    unreadCount,
    data: alerts
  });
});

/**
 * Get all alerts for logged-in user
 */
exports.getAllAlerts = asyncHandler(async (req, res) => {
  const { category, type, status, page = 1, limit = 20 } = req.query;

  const query = { targetUser: req.user._id };

  if (category) query.category = category;
  if (type) query.type = type;
  if (status) query.status = status;

  // Exclude expired alerts
  query.$or = [
    { expiresAt: { $exists: false } },
    { expiresAt: { $gt: new Date() } }
  ];

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const alerts = await Alert.find(query)
    .populate('relatedPatient', 'firstName lastName patientId')
    .populate('relatedAppointment')
    .populate('createdBy', 'firstName lastName')
    .sort({ priority: -1, createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await Alert.countDocuments(query);

  res.json({
    success: true,
    count: alerts.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data: alerts
  });
});

/**
 * Get alerts by category
 */
exports.getAlertsByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const limit = parseInt(req.query.limit) || 20;

  const alerts = await Alert.getByCategory(req.user._id, category, limit);

  res.json({
    success: true,
    category,
    count: alerts.length,
    data: alerts
  });
});

/**
 * Get single alert by ID
 */
exports.getAlertById = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id)
    .populate('relatedPatient', 'firstName lastName patientId')
    .populate('relatedAppointment')
    .populate('createdBy', 'firstName lastName');

  if (!alert) {
    return res.status(404).json({
      success: false,
      error: 'Alert not found'
    });
  }

  // Check if user has permission to view this alert
  if (alert.targetUser.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'You do not have permission to view this alert'
    });
  }

  res.json({
    success: true,
    data: alert
  });
});

/**
 * Create new alert
 */
exports.createAlert = asyncHandler(async (req, res) => {
  const alertData = {
    ...req.body,
    createdBy: req.user._id
  };

  // If no scheduledFor date, deliver immediately
  if (!alertData.scheduledFor) {
    alertData.scheduledFor = new Date();
  }

  const alert = new Alert(alertData);
  await alert.save();

  // If scheduled for now or past, deliver immediately
  if (new Date(alertData.scheduledFor) <= new Date()) {
    await alert.deliver();
  }

  await alert.populate('relatedPatient', 'firstName lastName patientId');
  await alert.populate('targetUser', 'firstName lastName');

  res.status(201).json({
    success: true,
    message: 'Alert created successfully',
    data: alert
  });
});

/**
 * Mark alert as read
 */
exports.markAsRead = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id);

  if (!alert) {
    return res.status(404).json({
      success: false,
      error: 'Alert not found'
    });
  }

  // Check permission
  if (alert.targetUser.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      error: 'You do not have permission to mark this alert as read'
    });
  }

  await alert.markAsRead();

  res.json({
    success: true,
    message: 'Alert marked as read',
    data: alert
  });
});

/**
 * Mark multiple alerts as read
 */
exports.markMultipleAsRead = asyncHandler(async (req, res) => {
  const { alertIds } = req.body;

  if (!Array.isArray(alertIds) || alertIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Please provide an array of alert IDs'
    });
  }

  const result = await Alert.markMultipleAsRead(alertIds, req.user._id);

  res.json({
    success: true,
    message: `${result.modifiedCount} alert(s) marked as read`,
    modifiedCount: result.modifiedCount
  });
});

/**
 * Dismiss alert
 */
exports.dismissAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id);

  if (!alert) {
    return res.status(404).json({
      success: false,
      error: 'Alert not found'
    });
  }

  // Check permission
  if (alert.targetUser.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      error: 'You do not have permission to dismiss this alert'
    });
  }

  await alert.dismiss();

  res.json({
    success: true,
    message: 'Alert dismissed',
    data: alert
  });
});

/**
 * Complete alert action
 */
exports.completeAction = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id);

  if (!alert) {
    return res.status(404).json({
      success: false,
      error: 'Alert not found'
    });
  }

  // Check permission
  if (alert.targetUser.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      error: 'You do not have permission to complete this action'
    });
  }

  if (!alert.actionRequired) {
    return res.status(400).json({
      success: false,
      error: 'This alert does not require an action'
    });
  }

  await alert.completeAction();

  res.json({
    success: true,
    message: 'Action completed',
    data: alert
  });
});

/**
 * Delete alert
 */
exports.deleteAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id);

  if (!alert) {
    return res.status(404).json({
      success: false,
      error: 'Alert not found'
    });
  }

  // Check permission (only creator or admin can delete)
  if (alert.createdBy?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'You do not have permission to delete this alert'
    });
  }

  await alert.deleteOne();

  res.json({
    success: true,
    message: 'Alert deleted successfully'
  });
});

/**
 * Get unread count
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Alert.getUnreadCount(req.user._id);

  res.json({
    success: true,
    unreadCount: count
  });
});
