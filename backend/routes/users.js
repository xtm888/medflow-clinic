const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  updateUserRole,
  activateUser,
  deactivateUser,
  resetUserPassword,
  getUserPrescriptions
} = require('../controllers/userController');

const { protect, authorize } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');

// Protect all routes and require admin role
router.use(protect);
router.use(authorize('admin'));

// Routes
router
  .route('/')
  .get(getUsers)
  .post(logAction('USER_CREATE'), createUser);

router
  .route('/:id')
  .get(getUser)
  .put(logAction('USER_UPDATE'), updateUser)
  .delete(logCriticalOperation('USER_DELETE'), deleteUser);

router.put('/:id/role', logCriticalOperation('USER_ROLE_CHANGE'), updateUserRole);
router.put('/:id/activate', logAction('USER_ACTIVATE'), activateUser);
router.put('/:id/deactivate', logAction('USER_DEACTIVATE'), deactivateUser);
router.post('/:id/reset-password', logAction('PASSWORD_RESET'), resetUserPassword);
router.get('/:id/prescriptions', getUserPrescriptions);

module.exports = router;