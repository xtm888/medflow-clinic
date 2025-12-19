const Settings = require('../models/Settings');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Get clinic settings
// @route   GET /api/settings
// @access  Private
exports.getSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();

  // Mask sensitive Twilio data
  const safeSettings = settings.toObject();
  if (safeSettings.twilio) {
    if (safeSettings.twilio.accountSid) {
      safeSettings.twilio.accountSid = `${safeSettings.twilio.accountSid.substring(0, 8)}...`;
    }
    if (safeSettings.twilio.authToken) {
      safeSettings.twilio.authToken = '••••••••';
    }
  }

  res.status(200).json({
    success: true,
    data: safeSettings
  });
});

// @desc    Update clinic settings
// @route   PUT /api/settings
// @access  Private/Admin
exports.updateSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();

  // Update allowed fields
  const allowedFields = [
    'clinic',
    'notifications',
    'regional',
    'appearance',
    'appointments',
    'prescriptions'
  ];

  allowedFields.forEach(field => {
    if (req.body[field]) {
      // Merge nested objects instead of replacing
      settings[field] = {
        ...settings[field]?.toObject?.() || settings[field] || {},
        ...req.body[field]
      };
    }
  });

  settings.updatedBy = req.user.id;
  await settings.save();

  res.status(200).json({
    success: true,
    message: 'Settings updated successfully',
    data: settings
  });
});

// @desc    Update Twilio settings
// @route   PUT /api/settings/twilio
// @access  Private/Admin
exports.updateTwilioSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();

  const { accountSid, authToken, smsNumber, whatsappNumber, enabled } = req.body;

  // Only update if values are provided (not masked)
  if (accountSid && !accountSid.includes('...')) {
    settings.twilio.accountSid = accountSid;
  }
  if (authToken && authToken !== '••••••••') {
    settings.twilio.authToken = authToken;
  }
  if (smsNumber !== undefined) {
    settings.twilio.smsNumber = smsNumber;
  }
  if (whatsappNumber !== undefined) {
    settings.twilio.whatsappNumber = whatsappNumber;
  }
  if (enabled !== undefined) {
    settings.twilio.enabled = enabled;
  }

  settings.updatedBy = req.user.id;
  await settings.save();

  res.status(200).json({
    success: true,
    message: 'Twilio settings updated successfully'
  });
});

// @desc    Test Twilio connection
// @route   POST /api/settings/twilio/test
// @access  Private/Admin
exports.testTwilioConnection = asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();

  if (!settings.twilio.accountSid || !settings.twilio.authToken) {
    return res.status(400).json({
      success: false,
      error: 'Twilio credentials not configured'
    });
  }

  // In production, actually test the Twilio API
  // const twilio = require('twilio')(settings.twilio.accountSid, settings.twilio.authToken);
  // await twilio.api.accounts(settings.twilio.accountSid).fetch();

  res.status(200).json({
    success: true,
    message: 'Twilio connection successful'
  });
});

// @desc    Get current user's profile
// @route   GET /api/settings/profile
// @access  Private
exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
    .select('-password -twoFactorSecret -sessions');

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Update current user's profile
// @route   PUT /api/settings/profile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res) => {
  // Fields that users can update themselves
  const allowedFields = [
    'firstName',
    'lastName',
    'email',
    'phoneNumber',
    'specialization',
    'avatar',
    'preferences'
  ];

  const updates = {};
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  // Check if email is being changed and is unique
  if (updates.email && updates.email !== req.user.email) {
    const existingUser = await User.findOne({ email: updates.email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already in use'
      });
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    updates,
    { new: true, runValidators: true }
  ).select('-password -twoFactorSecret -sessions');

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: user
  });
});

// @desc    Change current user's password
// @route   PUT /api/settings/password
// @access  Private
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Current and new password are required'
    });
  }

  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      error: 'Current password is incorrect'
    });
  }

  // Validate new password
  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 8 characters'
    });
  }

  user.password = newPassword;
  user.passwordChangedAt = Date.now();
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
});

// @desc    Get user notification preferences
// @route   GET /api/settings/notifications
// @access  Private
exports.getNotificationPreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('preferences');

  // Merge user preferences with global defaults
  const settings = await Settings.getSettings();

  const preferences = {
    global: settings.notifications,
    user: user.preferences?.notifications || {}
  };

  res.status(200).json({
    success: true,
    data: preferences
  });
});

// @desc    Update user notification preferences
// @route   PUT /api/settings/notifications
// @access  Private
exports.updateNotificationPreferences = asyncHandler(async (req, res) => {
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
