const express = require('express');
const router = express.Router();
const { clinicAuth } = require('../middleware/clinicAuth');
const syncController = require('../controllers/syncController');

/**
 * Sync Routes
 * All routes require clinic authentication
 */

// Push changes from clinic to central
router.post('/push', clinicAuth, syncController.receivePush);

// Pull changes from central to clinic
router.get('/pull', clinicAuth, syncController.sendPull);

// Get sync status for clinic
router.get('/status', clinicAuth, syncController.getStatus);

// Get all registered clinics
router.get('/clinics', clinicAuth, syncController.getClinics);

// Full sync a collection
router.post('/full-sync', clinicAuth, syncController.fullSync);

module.exports = router;
