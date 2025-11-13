const express = require('express');
const router = express.Router();

// Placeholder controller
const settingsController = {
  getSettings: (req, res) => res.json({ success: true, data: {} }),
  updateSettings: (req, res) => res.json({ success: true, data: {} })
};

const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Routes
router
  .route('/')
  .get(settingsController.getSettings)
  .put(authorize('admin'), settingsController.updateSettings);

module.exports = router;