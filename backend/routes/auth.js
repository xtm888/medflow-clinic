const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  getMe,
  updateDetails,
  updatePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  enableTwoFactor,
  verifyTwoFactorSetup,
  disableTwoFactor,
  verifyTwoFactorLogin,
  regenerateBackupCodes,
  refreshToken
} = require('../controllers/authController');

const { protect, authRateLimit, optionalProtect } = require('../middleware/auth');
const { logAction } = require('../middleware/auditLogger');
const { validateLogin, validateRegister, validatePasswordChange } = require('../middleware/validation');

// Public routes
router.post('/register', authRateLimit(), validateRegister, optionalProtect, register); // Allows first user or admin
router.post('/login', authRateLimit(), validateLogin, login);
router.post('/refresh', authRateLimit(), refreshToken); // Refresh token endpoint
router.post('/forgotpassword', authRateLimit(), forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);
router.get('/verifyemail/:token', verifyEmail);

// 2FA verification during login (public, rate limited)
router.post('/verify-2fa', authRateLimit(), verifyTwoFactorLogin);

// Protected routes
router.use(protect); // All routes below this are protected

router.get('/me', getMe);
router.post('/logout', logAction('LOGOUT'), logout);
router.put('/updatedetails', logAction('USER_UPDATE'), updateDetails);
router.put('/updatepassword', validatePasswordChange, logAction('PASSWORD_CHANGE'), updatePassword);

// 2FA management (protected)
router.post('/enable-2fa', logAction('TWO_FACTOR_SETUP_START'), enableTwoFactor);
router.post('/verify-2fa-setup', logAction('TWO_FACTOR_ENABLE'), verifyTwoFactorSetup);
router.post('/disable-2fa', logAction('TWO_FACTOR_DISABLE'), disableTwoFactor);
router.post('/regenerate-backup-codes', logAction('BACKUP_CODES_REGENERATE'), regenerateBackupCodes);

module.exports = router;
