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
  enableTwoFactor
} = require('../controllers/authController');

const { protect, authRateLimit } = require('../middleware/auth');
const { logAction } = require('../middleware/auditLogger');

// Public routes
router.post('/register', authRateLimit(), register);
router.post('/login', authRateLimit(), login);
router.post('/forgotpassword', authRateLimit(), forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);
router.get('/verifyemail/:token', verifyEmail);

// Protected routes
router.use(protect); // All routes below this are protected

router.get('/me', getMe);
router.post('/logout', logAction('LOGOUT'), logout);
router.put('/updatedetails', logAction('USER_UPDATE'), updateDetails);
router.put('/updatepassword', logAction('PASSWORD_CHANGE'), updatePassword);
router.post('/enable-2fa', logAction('TWO_FACTOR_ENABLE'), enableTwoFactor);

module.exports = router;