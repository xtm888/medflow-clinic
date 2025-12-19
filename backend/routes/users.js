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
  getUserPrescriptions,
  // Current user / preferences
  getCurrentUser,
  updatePreferences,
  getFavoriteMedications,
  addFavoriteMedication,
  removeFavoriteMedication,
  reorderFavoriteMedications,
  updateFavoriteMedicationDosage,
  recordFavoriteUsage,
  getRecentPatients,
  addRecentPatient,
  getFavoriteProtocols,
  toggleFavoriteProtocol
} = require('../controllers/userController');

const { protect, authorize } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');

// Protect all routes
router.use(protect);

// ========================================
// Current User Routes (any authenticated user)
// ========================================

// Current user profile
router.get('/me', getCurrentUser);
router.put('/me/preferences', updatePreferences);

// Favorite medications
router.get('/me/favorites/medications', getFavoriteMedications);
router.post('/me/favorites/medications', addFavoriteMedication);
router.delete('/me/favorites/medications/:medicationId', removeFavoriteMedication);
router.put('/me/favorites/medications/reorder', reorderFavoriteMedications);
router.put('/me/favorites/medications/:medicationId/dosage', updateFavoriteMedicationDosage);
router.post('/me/favorites/medications/:medicationId/usage', recordFavoriteUsage);

// Favorite protocols
router.get('/me/favorites/protocols', getFavoriteProtocols);
router.post('/me/favorites/protocols/:protocolId', toggleFavoriteProtocol);

// Recent patients
router.get('/me/recent-patients', getRecentPatients);
router.post('/me/recent-patients', addRecentPatient);

// ========================================
// Admin Routes (admin role required)
// ========================================
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
