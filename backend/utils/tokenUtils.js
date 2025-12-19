const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate JWT Token
exports.generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

// Send token response with HttpOnly cookies (XSS protection)
// SECURITY: Tokens are stored in HttpOnly cookies only, NOT in response body
exports.sendTokenResponse = (user, statusCode, res, message = '', extraData = {}) => {
  const CONSTANTS = require('../config/constants');

  // Generate short-lived access token
  const accessToken = user.getSignedJwtToken();

  // Generate long-lived refresh token with separate secret
  const refreshToken = user.getSignedRefreshToken();

  // Cookie options for access token (short-lived, 15 minutes)
  const accessTokenOptions = {
    expires: new Date(Date.now() + CONSTANTS.AUTH.ACCESS_TOKEN_EXPIRY_MINUTES * 60 * 1000),
    httpOnly: true,
    sameSite: 'strict'
  };

  // Cookie options for refresh token (long-lived, 14 days)
  const refreshTokenOptions = {
    expires: new Date(Date.now() + CONSTANTS.AUTH.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: 'strict',
    path: '/api/auth/refresh' // Only send refresh token to refresh endpoint
  };

  if (process.env.NODE_ENV === 'production') {
    accessTokenOptions.secure = true;
    refreshTokenOptions.secure = true;
  }

  // Remove sensitive data
  const userData = {
    id: user._id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    department: user.department,
    isEmailVerified: user.isEmailVerified,
    avatar: user.avatar,
    twoFactorEnabled: user.twoFactorEnabled || false
  };

  // SECURITY: Set tokens in HttpOnly cookies only - NOT in response body
  // This prevents XSS attacks from stealing tokens via JavaScript
  res
    .status(statusCode)
    .cookie('accessToken', accessToken, accessTokenOptions)
    .cookie('refreshToken', refreshToken, refreshTokenOptions)
    .json({
      success: true,
      message,
      // SECURITY: Tokens removed from response body - use cookies instead
      expiresIn: CONSTANTS.AUTH.ACCESS_TOKEN_EXPIRY_MINUTES * 60, // in seconds
      user: userData,
      ...extraData
    });
};

// Verify JWT Token (access token)
exports.verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// SECURITY: Verify refresh token with separate secret
exports.verifyRefreshToken = (token) => {
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;

  const decoded = jwt.verify(token, refreshSecret);

  // Ensure this is actually a refresh token, not an access token being misused
  if (decoded.tokenType !== 'refresh') {
    throw new Error('Invalid token type - expected refresh token');
  }

  return decoded;
};

// Generate random token
exports.generateRandomToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Hash token
exports.hashToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

// Generate OTP
exports.generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

// Generate secure password
exports.generateSecurePassword = (length = 12) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
  let password = '';

  // Ensure at least one of each required character type
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%^&*()_+'[Math.floor(Math.random() * 12)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};
