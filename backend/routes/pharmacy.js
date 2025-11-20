const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacyController');
const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Inventory routes
router.get('/inventory', pharmacyController.getInventory);
router.get('/stats', pharmacyController.getStats);
router.get('/alerts', pharmacyController.getAlerts);
router.get('/low-stock', authorize('pharmacist', 'admin', 'ophthalmologist'), pharmacyController.getLowStock);
router.get('/expiring', authorize('pharmacist', 'admin', 'ophthalmologist'), pharmacyController.getExpiring);

// Medication search for prescribing
router.get('/search', pharmacyController.searchMedications);

// Medication CRUD routes
router.post('/inventory', authorize('pharmacist', 'admin'), pharmacyController.createMedication);
router.get('/inventory/:id', pharmacyController.getMedication);
router.put('/inventory/:id', authorize('pharmacist', 'admin'), pharmacyController.updateMedication);
router.post('/inventory/:id/adjust', authorize('pharmacist', 'admin'), pharmacyController.adjustStock);

// Prescription-integrated dispensing routes
router.post('/reserve', authorize('ophthalmologist', 'admin', 'doctor'), pharmacyController.reserveForPrescription);

module.exports = router;
