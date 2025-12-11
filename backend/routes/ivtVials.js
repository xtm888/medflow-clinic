const express = require('express');
const router = express.Router();
const ivtVialController = require('../controllers/ivtVialController');
const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logAction, logCriticalOperation } = require('../middleware/auditLogger');
const { optionalClinic } = require('../middleware/clinicAuth');

// Protect all routes
router.use(protect);
router.use(optionalClinic);

// Statistics and monitoring
router.get('/stats', requirePermission('view_ivt', 'manage_ivt'), logAction('VIAL_STATS_VIEW'), ivtVialController.getStats);
router.get('/expiring', requirePermission('view_ivt', 'manage_ivt'), logAction('VIAL_EXPIRING_VIEW'), ivtVialController.getExpiringVials);
router.get('/temperature-excursions', requirePermission('manage_ivt'), logAction('VIAL_TEMP_EXCURSION_VIEW'), ivtVialController.getTemperatureExcursions);

// Get usable vials by medication
router.get('/usable/:medication', requirePermission('view_ivt', 'manage_ivt'), logAction('VIAL_USABLE_VIEW'), ivtVialController.getUsableVials);

// CRUD operations
router.get('/', requirePermission('view_ivt', 'manage_ivt'), logAction('VIAL_LIST_VIEW'), ivtVialController.getVials);
router.post('/', requirePermission('manage_ivt'), logAction('VIAL_CREATE'), ivtVialController.createVial);
router.get('/:id', requirePermission('view_ivt', 'manage_ivt'), logAction('VIAL_VIEW'), ivtVialController.getVial);

// Vial operations
router.post('/:id/open', requirePermission('manage_ivt'), logCriticalOperation('VIAL_OPEN'), ivtVialController.openVial);
router.post('/:id/dose', requirePermission('manage_ivt'), logCriticalOperation('VIAL_DOSE'), ivtVialController.recordDose);
router.post('/:id/temperature', requirePermission('manage_ivt'), logAction('VIAL_TEMP_RECORD'), ivtVialController.recordTemperature);
router.post('/:id/dispose', requirePermission('manage_ivt'), logCriticalOperation('VIAL_DISPOSE'), ivtVialController.disposeVial);

module.exports = router;
