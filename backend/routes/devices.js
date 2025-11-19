const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { protect, authorize } = require('../middleware/auth');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store in memory for processing
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for DICOM files
  }
});

// Public routes (webhook - verified by signature)
router.post('/webhook/:deviceId',
  upload.single('file'),
  deviceController.handleWebhook
);

// All other routes require authentication
router.use(protect);

// GET /api/devices - Get all devices
router.get('/',
  deviceController.getDevices
);

// GET /api/devices/:id - Get single device
router.get('/:id',
  deviceController.getDeviceById
);

// POST /api/devices - Create new device (admin only)
router.post('/',
  authorize(['admin']),
  deviceController.createDevice
);

// PUT /api/devices/:id - Update device (admin only)
router.put('/:id',
  authorize(['admin']),
  deviceController.updateDevice
);

// DELETE /api/devices/:id - Delete device (admin only)
router.delete('/:id',
  authorize(['admin']),
  deviceController.deleteDevice
);

// POST /api/devices/:id/sync-folder - Sync device folder
router.post('/:id/sync-folder',
  authorize(['admin', 'doctor', 'nurse', 'technician']),
  deviceController.syncDeviceFolder
);

// POST /api/devices/:id/import-measurements - Import measurements manually
router.post('/:id/import-measurements',
  authorize(['admin', 'doctor', 'nurse', 'technician']),
  deviceController.importMeasurements
);

// GET /api/devices/:id/stats - Get device statistics
router.get('/:id/stats',
  authorize(['admin', 'doctor', 'ophthalmologist']),
  deviceController.getDeviceStats
);

// GET /api/devices/:id/logs - Get device integration logs
router.get('/:id/logs',
  authorize(['admin', 'doctor', 'ophthalmologist']),
  deviceController.getDeviceLogs
);

module.exports = router;
