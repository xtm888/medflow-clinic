const crypto = require('crypto');
const User = require('../models/User');
const Counter = require('../models/Counter');
const notificationFacade = require('../services/notificationFacade');
const { generateToken, sendTokenResponse, verifyRefreshToken } = require('../utils/tokenUtils');
const { success, error, unauthorized, forbidden } = require('../utils/apiResponse');
const { auth: authLogger } = require('../utils/structuredLogger');
const { AUTH, RATE_LIMIT } = require('../config/constants');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public (first user only) or Admin
exports.register = async (req, res, next) => {
  try {
    const {
      username,
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      role,
      department,
      specialization,
      licenseNumber
    } = req.body;

    // Check if this is the first user (make them admin)
    const userCount = await User.countDocuments();

    // Security: Only allow public registration for the first user
    // All subsequent registrations require an authenticated admin
    if (userCount > 0 && (!req.user || req.user.role !== 'admin')) {
      return forbidden(res, 'Only administrators can register new users');
    }

    const userRole = userCount === 0 ? 'admin' : (role || 'receptionist');

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return error(res, 'User with that email or username already exists');
    }

    // Generate employee ID
    const employeeId = await generateEmployeeId();

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      role: userRole,
      department: department || 'general',
      specialization,
      licenseNumber,
      employeeId,
      createdBy: req.user ? req.user._id : null
    });

    // Generate email verification token
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email
    const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${verificationToken}`;

    await notificationFacade.sendEmail(
      user.email,
      'Email Verification - MedFlow',
      'emailVerification',
      {
        name: user.fullName,
        verificationUrl
      }
    );

    sendTokenResponse(user, 201, res, 'User registered successfully. Please check your email for verification.');
  } catch (err) {
    authLogger.error('Registration error', { error: err.message, stack: err.stack });

    // Handle validation errors (400)
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: Object.values(err.errors).map(e => e.message).join(', ')
      });
    }

    // Handle duplicate key errors (400)
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        success: false,
        error: `User with that ${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      error: err.message || 'Error registering user'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, username, password } = req.body;

    // Validate input
    if ((!email && !username) || !password) {
      return error(res, 'Please provide email/username and password');
    }

    // Find user
    const user = await User.findOne({
      $or: [{ email }, { username }]
    }).select('+password');

    if (!user) {
      return unauthorized(res, 'Invalid credentials');
    }

    // Check if account is locked
    if (user.isLocked) {
      return unauthorized(res, 'Account is locked due to multiple failed login attempts. Please try again later.');
    }

    // Check if account is active
    if (!user.isActive) {
      return unauthorized(res, 'Account has been deactivated. Please contact administrator.');
    }

    // Check password
    const isPasswordMatch = await user.matchPassword(password);

    if (!isPasswordMatch) {
      await user.incLoginAttempts();
      return unauthorized(res, 'Invalid credentials');
    }

    // Check if 2FA is enabled - require verification
    if (user.twoFactorEnabled) {
      return success(res, {
        data: {
          requiresTwoFactor: true,
          userId: user._id
        },
        message: 'Two-factor authentication required'
      });
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    user.lastLogin = Date.now();

    // Generate session
    const token = user.getSignedJwtToken();
    const session = {
      token,
      device: req.headers['user-agent'],
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    // Add session to user
    user.sessions = user.sessions || [];
    user.sessions.push(session);

    // Keep only last 5 sessions
    if (user.sessions.length > 5) {
      user.sessions = user.sessions.slice(-5);
    }

    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res, 'Login successful');
  } catch (err) {
    authLogger.error('Login error', { error: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: err.message || 'Error logging in'
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    return success(res, { data: user });
  } catch (err) {
    authLogger.error('Get me error', { error: err.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error fetching user profile'
    });
  }
};

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = async (req, res, next) => {
  try {
    const fieldsToUpdate = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phoneNumber: req.body.phoneNumber,
      bio: req.body.bio,
      languages: req.body.languages,
      settings: req.body.settings,
      notificationPreferences: req.body.notificationPreferences
    };

    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(key =>
      fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );

    const user = await User.findByIdAndUpdate(
      req.user.id,
      fieldsToUpdate,
      {
        new: true,
        runValidators: true
      }
    );

    return success(res, { data: user });
  } catch (err) {
    authLogger.error('Update details error', { error: err.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: err.message || 'Error updating user details'
    });
  }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return error(res, 'Please provide current and new password');
    }

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isPasswordMatch = await user.matchPassword(currentPassword);

    if (!isPasswordMatch) {
      return unauthorized(res, 'Current password is incorrect');
    }

    // Check if new password was used before
    const isPasswordUsedBefore = await user.isPasswordUsedBefore(newPassword);

    if (isPasswordUsedBefore) {
      return error(res, 'This password has been used before. Please choose a different password.');
    }

    // Update password
    user.password = newPassword;

    // CRITICAL SECURITY FIX: Track password change time for token invalidation
    user.passwordChangedAt = new Date();

    // CRITICAL SECURITY FIX: Invalidate all existing sessions except current
    // This prevents session fixation attacks where attacker retains access after password change
    const currentSessionId = req.sessionId || req.headers['x-session-id'];
    if (user.sessions && user.sessions.length > 0) {
      // Keep only current session, invalidate all others
      user.sessions = user.sessions.filter(s =>
        s.sessionId === currentSessionId && s.expiresAt > new Date()
      );
    }

    // Clear all refresh tokens except current (if tracking refresh tokens)
    if (user.refreshTokens && user.refreshTokens.length > 0) {
      const currentRefreshToken = req.body.currentRefreshToken;
      user.refreshTokens = currentRefreshToken
        ? user.refreshTokens.filter(t => t === currentRefreshToken)
        : [];
    }

    await user.save();

    // Log the password change with security context
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      user: user._id,
      action: 'PASSWORD_CHANGE',
      resource: '/api/auth/updatepassword',
      ipAddress: req.ip,
      metadata: {
        sessionsInvalidated: true,
        previousSessionCount: user.sessions?.length || 0
      }
    });

    sendTokenResponse(user, 200, res, 'Password updated successfully. Other sessions have been logged out.');
  } catch (err) {
    authLogger.error('Update password error', { error: err.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: err.message || 'Error updating password'
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return error(res, 'Please provide an email');
    }

    const user = await User.findOne({ email });

    if (!user) {
      return error(res, 'No user found with that email');
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/resetpassword/${resetToken}`;

    try {
      await notificationFacade.sendEmail(
        user.email,
        'Password Reset Request - MedFlow',
        'passwordReset',
        {
          name: user.fullName,
          resetUrl
        }
      );

      return success(res, { data: null, message: 'Password reset email sent' });
    } catch (err) {
      authLogger.error('Email send error', { error: err.message, email: user.email });
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return error(res, 'Email could not be sent');
    }
  } catch (err) {
    authLogger.error('Forgot password error', { error: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: err.message || 'Error processing password reset'
    });
  }
};

// @desc    Reset password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return error(res, 'Please provide a new password');
    }

    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return error(res, 'Invalid or expired reset token');
    }

    // Check if new password was used before
    const isPasswordUsedBefore = await user.isPasswordUsedBefore(password);

    if (isPasswordUsedBefore) {
      return error(res, 'This password has been used before. Please choose a different password.');
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    sendTokenResponse(user, 200, res, 'Password reset successful');
  } catch (err) {
    authLogger.error('Reset password error', { error: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: err.message || 'Error resetting password'
    });
  }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Public (with valid refresh token)
exports.refreshToken = async (req, res, next) => {
  try {
    // SECURITY: Get refresh token from HttpOnly cookie only (not from body)
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return error(res, 'Please provide a refresh token');
    }

    // SECURITY: Verify the refresh token using separate secret
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      // Log security-relevant errors
      if (err.message === 'Invalid token type - expected refresh token') {
        authLogger.info('[SECURITY] Attempted to use access token as refresh token', { ip: req.ip });
      }
      return unauthorized(res, 'Invalid or expired refresh token');
    }

    // Find the user
    const user = await User.findById(decoded.id);

    if (!user) {
      return unauthorized(res, 'User not found');
    }

    if (!user.isActive) {
      return unauthorized(res, 'Account has been deactivated');
    }

    // Generate new tokens (both access and refresh for rotation)
    const newAccessToken = user.getSignedJwtToken();
    const newRefreshToken = user.getSignedRefreshToken();

    // Update session with new tokens
    const sessionIndex = user.sessions?.findIndex(s => s.token === refreshToken);
    if (sessionIndex >= 0) {
      user.sessions[sessionIndex].token = newRefreshToken;
      user.sessions[sessionIndex].lastActivity = Date.now();
      await user.save({ validateBeforeSave: false });
    }

    // Set new cookies (HttpOnly for XSS protection)
    const accessTokenOptions = {
      expires: new Date(Date.now() + AUTH.ACCESS_TOKEN_EXPIRY_MINUTES * 60 * 1000),
      httpOnly: true,
      sameSite: 'strict'
    };

    const refreshTokenOptions = {
      expires: new Date(Date.now() + AUTH.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      httpOnly: true,
      sameSite: 'strict',
      path: '/api/auth/refresh'
    };

    if (process.env.NODE_ENV === 'production') {
      accessTokenOptions.secure = true;
      refreshTokenOptions.secure = true;
    }

    // SECURITY: Tokens in HttpOnly cookies only, NOT in response body
    res
      .cookie('accessToken', newAccessToken, accessTokenOptions)
      .cookie('refreshToken', newRefreshToken, refreshTokenOptions)
      .status(200)
      .json({
        success: true,
        expiresIn: AUTH.ACCESS_TOKEN_EXPIRY_MINUTES * 60, // in seconds
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          department: user.department
        }
      });
  } catch (err) {
    authLogger.error('Refresh token error', { error: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: 'Error refreshing token'
    });
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    // Remove session from user
    const sessionToken = req.cookies?.accessToken || req.headers.authorization?.split(' ')[1];

    if (sessionToken) {
      const user = await User.findById(req.user.id);
      user.sessions = user.sessions.filter(session => session.token !== sessionToken);
      await user.save({ validateBeforeSave: false });
    }

    // Clear both access and refresh cookies
    const clearCookieOptions = {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
      sameSite: 'strict'
    };

    res
      .cookie('accessToken', 'none', clearCookieOptions)
      .cookie('refreshToken', 'none', { ...clearCookieOptions, path: '/api/auth/refresh' });

    return success(res, { data: null, message: 'Logged out successfully' });
  } catch (err) {
    authLogger.error('Logout error', { error: err.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error logging out'
    });
  }
};

// @desc    Verify email
// @route   GET /api/auth/verifyemail/:token
// @access  Public
exports.verifyEmail = async (req, res, next) => {
  try {
    const emailVerificationToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      emailVerificationToken,
      emailVerificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      return error(res, 'Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });

    return success(res, { data: null, message: 'Email verified successfully' });
  } catch (err) {
    authLogger.error('Email verification error', { error: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: 'Error verifying email'
    });
  }
};

// @desc    Enable two-factor authentication (Step 1: Generate secret)
// @route   POST /api/auth/enable-2fa
// @access  Private
exports.enableTwoFactor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+password');
    const { password } = req.body;

    if (!password) {
      return error(res, 'Please provide your password');
    }

    // Verify password
    const isPasswordMatch = await user.matchPassword(password);

    if (!isPasswordMatch) {
      return unauthorized(res, 'Incorrect password');
    }

    // Check if already enabled
    if (user.twoFactorEnabled) {
      return error(res, 'Two-factor authentication is already enabled');
    }

    // Generate 2FA secret
    const speakeasy = require('speakeasy');
    const qrcode = require('qrcode');

    const secret = speakeasy.generateSecret({
      name: `MedFlow (${user.email})`,
      length: 20
    });

    user.twoFactorSecret = secret.base32;
    await user.save({ validateBeforeSave: false });

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    return success(res, {
      data: {
        secret: secret.base32,
        qrCode: qrCodeUrl
      },
      message: 'Scan the QR code with your authenticator app, then verify with a code'
    });
  } catch (err) {
    authLogger.error('Enable 2FA error', { error: err.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error enabling two-factor authentication'
    });
  }
};

// @desc    Verify two-factor authentication setup (Step 2: Confirm setup)
// @route   POST /api/auth/verify-2fa-setup
// @access  Private
exports.verifyTwoFactorSetup = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return error(res, 'Please provide the verification code from your authenticator app');
    }

    const user = await User.findById(req.user.id);

    if (!user.twoFactorSecret) {
      return error(res, 'Please initiate 2FA setup first');
    }

    if (user.twoFactorEnabled) {
      return error(res, 'Two-factor authentication is already enabled');
    }

    // Verify the token
    const speakeasy = require('speakeasy');
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps tolerance
    });

    if (!verified) {
      return error(res, 'Invalid verification code. Please try again.');
    }

    // Generate backup codes
    const backupCodes = user.generateBackupCodes();

    // Enable 2FA
    user.twoFactorEnabled = true;
    await user.save({ validateBeforeSave: false });

    return success(res, {
      data: {
        backupCodes,
        warning: 'Save these backup codes in a secure place. They will not be shown again.'
      },
      message: 'Two-factor authentication enabled successfully'
    });
  } catch (err) {
    authLogger.error('Verify 2FA setup error', { error: err.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error verifying two-factor authentication'
    });
  }
};

// @desc    Disable two-factor authentication
// @route   POST /api/auth/disable-2fa
// @access  Private
exports.disableTwoFactor = async (req, res, next) => {
  try {
    const { password, token } = req.body;

    if (!password) {
      return error(res, 'Please provide your password');
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user.twoFactorEnabled) {
      return error(res, 'Two-factor authentication is not enabled');
    }

    // Verify password
    const isPasswordMatch = await user.matchPassword(password);

    if (!isPasswordMatch) {
      return unauthorized(res, 'Incorrect password');
    }

    // If 2FA is enabled, require a valid token to disable it
    if (token) {
      const speakeasy = require('speakeasy');
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: token,
        window: 2
      });

      if (!verified) {
        // Check backup codes
        const backupUsed = user.useBackupCode(token);
        if (!backupUsed) {
          return error(res, 'Invalid verification code');
        }
      }
    } else {
      return error(res, 'Please provide a verification code from your authenticator app');
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = [];
    await user.save({ validateBeforeSave: false });

    return success(res, { data: null, message: 'Two-factor authentication disabled successfully' });
  } catch (err) {
    authLogger.error('Disable 2FA error', { error: err.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error disabling two-factor authentication'
    });
  }
};

// @desc    Verify 2FA token during login
// @route   POST /api/auth/verify-2fa
// @access  Public (with pending 2FA session)
exports.verifyTwoFactorLogin = async (req, res, next) => {
  try {
    const { userId, token, isBackupCode } = req.body;

    if (!userId || !token) {
      return error(res, 'Please provide user ID and verification code');
    }

    const user = await User.findById(userId);

    if (!user) {
      return unauthorized(res, 'Invalid credentials');
    }

    if (!user.twoFactorEnabled) {
      return error(res, 'Two-factor authentication is not enabled for this account');
    }

    let verified = false;

    if (isBackupCode) {
      // Try backup code
      verified = user.useBackupCode(token);
      if (verified) {
        await user.save({ validateBeforeSave: false });
      }
    } else {
      // Verify TOTP
      const speakeasy = require('speakeasy');
      verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: token,
        window: 2
      });
    }

    if (!verified) {
      await user.incLoginAttempts();
      return unauthorized(res, 'Invalid verification code');
    }

    // Reset login attempts on successful 2FA
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    user.lastLogin = Date.now();

    // Generate session
    const jwtToken = user.getSignedJwtToken();
    const session = {
      token: jwtToken,
      device: req.headers['user-agent'],
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    user.sessions = user.sessions || [];
    user.sessions.push(session);

    if (user.sessions.length > 5) {
      user.sessions = user.sessions.slice(-5);
    }

    await user.save({ validateBeforeSave: false });

    // Count remaining backup codes
    const remainingBackupCodes = user.twoFactorBackupCodes?.filter(bc => !bc.used).length || 0;

    sendTokenResponse(user, 200, res, 'Login successful', {
      remainingBackupCodes,
      lowBackupCodes: remainingBackupCodes < 3
    });
  } catch (err) {
    authLogger.error('2FA verification error', { error: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: 'Error verifying two-factor authentication'
    });
  }
};

// @desc    Regenerate backup codes
// @route   POST /api/auth/regenerate-backup-codes
// @access  Private
exports.regenerateBackupCodes = async (req, res, next) => {
  try {
    const { password, token } = req.body;

    if (!password || !token) {
      return error(res, 'Please provide your password and a verification code');
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user.twoFactorEnabled) {
      return error(res, 'Two-factor authentication is not enabled');
    }

    // Verify password
    const isPasswordMatch = await user.matchPassword(password);
    if (!isPasswordMatch) {
      return unauthorized(res, 'Incorrect password');
    }

    // Verify TOTP
    const speakeasy = require('speakeasy');
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (!verified) {
      return error(res, 'Invalid verification code');
    }

    // Generate new backup codes
    const backupCodes = user.generateBackupCodes();
    await user.save({ validateBeforeSave: false });

    return success(res, {
      data: {
        backupCodes,
        warning: 'Your old backup codes are now invalid. Save these new codes in a secure place.'
      },
      message: 'Backup codes regenerated successfully'
    });
  } catch (err) {
    authLogger.error('Regenerate backup codes error', { error: err.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: 'Error regenerating backup codes'
    });
  }
};

// Helper function to generate employee ID
// Uses atomic Counter to prevent race conditions
async function generateEmployeeId() {
  const year = new Date().getFullYear();
  const counterId = `employee-${year}`;
  const sequence = await Counter.getNextSequence(counterId);
  return `EMP${year}${String(sequence).padStart(5, '0')}`;
}
