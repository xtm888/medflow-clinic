const express = require('express');
const router = express.Router();
const { clinicAuth } = require('../middleware/clinicAuth');
const patientController = require('../controllers/patientController');

/**
 * Patient Routes
 * Cross-clinic patient search and lookup
 */

// Search patients across all clinics
router.get('/search', clinicAuth, patientController.searchAcrossClinics);

// Check if patient exists in other clinics
router.get('/check-exists', clinicAuth, patientController.checkPatientExists);

// Get patient statistics
router.get('/stats', clinicAuth, patientController.getPatientStats);

// Get patient visit history across clinics
router.get('/:id/history', clinicAuth, patientController.getPatientHistory);

// Get full patient details with history from source clinic
router.get('/:id/full', clinicAuth, patientController.getFullPatient);

// Get patient records from all clinics
router.get('/:id/all-clinics', clinicAuth, patientController.getPatientAllClinics);

module.exports = router;
