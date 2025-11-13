const express = require('express');
const router = express.Router();

// Placeholder controller
const pharmacyController = {
  getInventory: (req, res) => res.json({ success: true, data: [] }),
  getMedication: (req, res) => res.json({ success: true, data: {} }),
  updateStock: (req, res) => res.json({ success: true, message: 'Stock updated' }),
  createMedication: (req, res) => res.status(201).json({ success: true, data: {} }),
  getLowStock: (req, res) => res.json({ success: true, data: [] })
};

const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Routes
router.get('/inventory', pharmacyController.getInventory);
router.get('/low-stock', authorize('pharmacist', 'admin'), pharmacyController.getLowStock);
router.post('/medications', authorize('pharmacist', 'admin'), pharmacyController.createMedication);
router.get('/medications/:id', pharmacyController.getMedication);
router.put('/medications/:id/stock', authorize('pharmacist', 'admin'), pharmacyController.updateStock);

module.exports = router;