const Alert = require('../models/Alert');

/**
 * Get unread alerts for logged-in user
 */
exports.getUnreadAlerts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    const alerts = await Alert.getUnreadForUser(req.user._id, limit);
    const unreadCount = await Alert.getUnreadCount(req.user._id);

    res.json({
      success: true,
      count: alerts.length,
      unreadCount,
      data: alerts
    });
  } catch (error) {
    console.error('Error getting unread alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving unread alerts',
      error: error.message
    });
  }
};

/**
 * Get all alerts for logged-in user
 */
exports.getAllAlerts = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error getting alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving alerts',
      error: error.message
    });
  }
};

/**
 * Get alerts by category
 */
exports.getAlertsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    const alerts = await Alert.getByCategory(req.user._id, category, limit);

    res.json({
      success: true,
      category,
      count: alerts.length,
      data: alerts
    });
  } catch (error) {
    console.error('Error getting alerts by category:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving alerts by category',
      error: error.message
    });
  }
};

/**
 * Get single alert by ID
 */
exports.getAlertById = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate('relatedPatient', 'firstName lastName patientId')
      .populate('relatedAppointment')
      .populate('createdBy', 'firstName lastName');

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Check if user has permission to view this alert
    if (alert.targetUser.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this alert'
      });
    }

    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    console.error('Error getting alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving alert',
      error: error.message
    });
  }
};

/**
 * Create new alert
 */
exports.createAlert = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating alert',
      error: error.message
    });
  }
};

/**
 * Mark alert as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Check permission
    if (alert.targetUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to mark this alert as read'
      });
    }

    await alert.markAsRead();

    res.json({
      success: true,
      message: 'Alert marked as read',
      data: alert
    });
  } catch (error) {
    console.error('Error marking alert as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking alert as read',
      error: error.message
    });
  }
};

/**
 * Mark multiple alerts as read
 */
exports.markMultipleAsRead = async (req, res) => {
  try {
    const { alertIds } = req.body;

    if (!Array.isArray(alertIds) || alertIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of alert IDs'
      });
    }

    const result = await Alert.markMultipleAsRead(alertIds, req.user._id);

    res.json({
      success: true,
      message: `${result.modifiedCount} alert(s) marked as read`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking multiple alerts as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking alerts as read',
      error: error.message
    });
  }
};

/**
 * Dismiss alert
 */
exports.dismissAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Check permission
    if (alert.targetUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to dismiss this alert'
      });
    }

    await alert.dismiss();

    res.json({
      success: true,
      message: 'Alert dismissed',
      data: alert
    });
  } catch (error) {
    console.error('Error dismissing alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error dismissing alert',
      error: error.message
    });
  }
};

/**
 * Complete alert action
 */
exports.completeAction = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Check permission
    if (alert.targetUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to complete this action'
      });
    }

    if (!alert.actionRequired) {
      return res.status(400).json({
        success: false,
        message: 'This alert does not require an action'
      });
    }

    await alert.completeAction();

    res.json({
      success: true,
      message: 'Action completed',
      data: alert
    });
  } catch (error) {
    console.error('Error completing action:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing action',
      error: error.message
    });
  }
};

/**
 * Delete alert
 */
exports.deleteAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Check permission (only creator or admin can delete)
    if (alert.createdBy?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this alert'
      });
    }

    await alert.deleteOne();

    res.json({
      success: true,
      message: 'Alert deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting alert',
      error: error.message
    });
  }
};

/**
 * Get unread count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Alert.getUnreadCount(req.user._id);

    res.json({
      success: true,
      unreadCount: count
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving unread count',
      error: error.message
    });
  }
};
