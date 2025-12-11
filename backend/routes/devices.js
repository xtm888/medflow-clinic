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

// GET /api/devices/folder-sync/stats - Get folder sync service statistics
router.get('/folder-sync/stats',
  deviceController.getFolderSyncStats
);

// GET /api/devices/processor/stats - Get universal processor statistics
router.get('/processor/stats',
  deviceController.getProcessorStats
);

// GET /api/devices/ocr/status - Check OCR service status
router.get('/ocr/status',
  deviceController.getOCRStatus
);

// GET /api/devices - Get all devices
router.get('/',
  deviceController.getDevices
);

// =====================================================
// PATIENT FOLDER INDEXING ROUTES (before /:id)
// =====================================================

// POST /api/devices/index-folders - Index all device folders for patient matching
router.post('/index-folders',
  authorize(['admin']),
  deviceController.indexAllFolders
);

// GET /api/devices/index-folders/stats - Get folder indexer statistics
router.get('/index-folders/stats',
  deviceController.getFolderIndexStats
);

// GET /api/devices/index-folders/unmatched - Get unmatched folders
router.get('/index-folders/unmatched',
  deviceController.getUnmatchedFolders
);

// POST /api/devices/index-folders/link - Manually link folder to patient
router.post('/index-folders/link',
  authorize(['admin']),
  deviceController.manualLinkFolder
);

// =====================================================
// SMB2 GLOBAL ROUTES (before /:id)
// =====================================================

// GET /api/devices/smb2/stats - Get SMB2 client statistics
router.get('/smb2/stats',
  deviceController.getSmb2Stats
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

// POST /api/devices/:id/watcher/start - Start folder watcher for device
router.post('/:id/watcher/start',
  authorize(['admin']),
  deviceController.startFolderWatcher
);

// POST /api/devices/:id/watcher/stop - Stop folder watcher for device
router.post('/:id/watcher/stop',
  authorize(['admin']),
  deviceController.stopFolderWatcher
);

// POST /api/devices/:id/watcher/sync - Trigger full sync for device
router.post('/:id/watcher/sync',
  authorize(['admin', 'doctor', 'nurse', 'technician']),
  deviceController.triggerFullSync
);

// SMB Share mounting routes
// POST /api/devices/mount-all - Mount all configured shares
router.post('/mount-all',
  authorize(['admin']),
  deviceController.mountAllShares
);

// GET /api/devices/:id/mount-status - Get mount status
router.get('/:id/mount-status',
  deviceController.getMountStatus
);

// POST /api/devices/:id/mount - Mount device SMB share
router.post('/:id/mount',
  authorize(['admin']),
  deviceController.mountShare
);

// POST /api/devices/:id/unmount - Unmount device SMB share
router.post('/:id/unmount',
  authorize(['admin']),
  deviceController.unmountShare
);

// =====================================================
// FILE BROWSING ROUTES
// =====================================================

// GET /api/devices/:id/browse - Browse files in device share
router.get('/:id/browse',
  deviceController.browseDeviceFiles
);

// GET /api/devices/:id/files/* - Serve file from device share
router.get('/:id/files/*',
  (req, res, next) => {
    req.params.filepath = req.params[0];
    next();
  },
  deviceController.getDeviceFile
);

// POST /api/devices/:id/scan-archive - Scan archive folder for mapping
router.post('/:id/scan-archive',
  deviceController.scanArchiveFolder
);

// =====================================================
// STREAMING SMB ACCESS ROUTES (No permanent mount)
// =====================================================

// GET /api/devices/stream/check-all - Check all device connections
router.get('/stream/check-all',
  deviceController.streamCheckAllDevices
);

// POST /api/devices/stream/clear-cache - Clear SMB file cache
router.post('/stream/clear-cache',
  authorize(['admin']),
  deviceController.streamClearCache
);

// GET /api/devices/:id/stream/check - Check device accessibility
router.get('/:id/stream/check',
  deviceController.streamCheckAccess
);

// GET /api/devices/:id/stream/browse - Browse files (temp mount)
router.get('/:id/stream/browse',
  deviceController.streamBrowseFiles
);

// GET /api/devices/:id/stream/file/* - Stream file (temp access)
router.get('/:id/stream/file/*',
  deviceController.streamGetFile
);

// =====================================================
// LEGACY PATIENT MAPPING ROUTES
// =====================================================

// GET /api/devices/legacy/patients/:dmiId - Find patient by legacy DMI ID
router.get('/legacy/patients/:dmiId',
  deviceController.findPatientByLegacyId
);

// GET /api/devices/legacy/patients/:dmiId/files - Get patient archive files
router.get('/legacy/patients/:dmiId/files',
  deviceController.getPatientArchiveFiles
);

// POST /api/devices/legacy/patients/:patientId/map - Create legacy mapping
router.post('/legacy/patients/:patientId/map',
  deviceController.createLegacyMapping
);

// POST /api/devices/legacy/patients/bulk-import - Bulk import mappings
router.post('/legacy/patients/bulk-import',
  authorize(['admin']),
  deviceController.bulkImportLegacyMappings
);

// =====================================================
// NETWORK DISCOVERY ROUTES
// =====================================================

// POST /api/devices/discover-network - Discover SMB shares on network
router.post('/discover-network',
  authorize(['admin']),
  deviceController.discoverNetwork
);

// GET /api/devices/discovery/network-info - Get current network info (auto-detect)
router.get('/discovery/network-info',
  deviceController.getNetworkInfo
);

// GET /api/devices/discovery/status - Get last discovery results
router.get('/discovery/status',
  deviceController.getDiscoveryStatus
);

// POST /api/devices/discovery/quick-scan - Quick scan known devices
router.post('/discovery/quick-scan',
  authorize(['admin']),
  deviceController.quickScanDevices
);

// POST /api/devices/discovery/create-devices - Create devices from discovered shares
router.post('/discovery/create-devices',
  authorize(['admin']),
  deviceController.createDevicesFromDiscovery
);

// POST /api/devices/discovery/probe-share - Probe a specific share structure
router.post('/discovery/probe-share',
  authorize(['admin']),
  deviceController.probeShareStructure
);

// =====================================================
// UNIVERSAL FILE PROCESSOR ROUTES
// =====================================================

// POST /api/devices/process-file - Process single file with universal processor
router.post('/process-file',
  authorize(['admin', 'doctor', 'nurse', 'technician']),
  deviceController.processFileUniversal
);

// POST /api/devices/process-batch - Process multiple files
router.post('/process-batch',
  authorize(['admin', 'doctor', 'nurse', 'technician']),
  deviceController.processBatchUniversal
);

// POST /api/devices/:id/index-folders - Index specific device folders
router.post('/:id/index-folders',
  authorize(['admin']),
  deviceController.indexDeviceFolders
);

// =====================================================
// AUTO-SYNC SERVICE ROUTES (before /:id)
// =====================================================

// GET /api/devices/auto-sync/status - Get auto-sync service status
router.get('/auto-sync/status',
  deviceController.getAutoSyncStatus
);

// POST /api/devices/auto-sync/start - Start auto-sync service
router.post('/auto-sync/start',
  authorize(['admin']),
  deviceController.startAutoSync
);

// POST /api/devices/auto-sync/stop - Stop auto-sync service
router.post('/auto-sync/stop',
  authorize(['admin']),
  deviceController.stopAutoSync
);

// POST /api/devices/auto-sync/sync-all - Trigger sync for all devices
router.post('/auto-sync/sync-all',
  authorize(['admin']),
  deviceController.triggerSyncAll
);

// PUT /api/devices/auto-sync/config - Update auto-sync configuration
router.put('/auto-sync/config',
  authorize(['admin']),
  deviceController.updateAutoSyncConfig
);

// POST /api/devices/:id/auto-sync/trigger - Trigger sync for single device
router.post('/:id/auto-sync/trigger',
  authorize(['admin', 'doctor', 'nurse', 'technician']),
  deviceController.triggerDeviceSync
);

// =====================================================
// SYNC QUEUE ROUTES
// =====================================================

// GET /api/devices/sync-queue/status - Get sync queue status
router.get('/sync-queue/status',
  deviceController.getSyncQueueStatus
);

// POST /api/devices/sync-queue/jobs - Add job to queue
router.post('/sync-queue/jobs',
  authorize(['admin', 'doctor', 'nurse', 'technician']),
  deviceController.addSyncJob
);

// GET /api/devices/sync-queue/jobs/:jobId - Get job status
router.get('/sync-queue/jobs/:jobId',
  deviceController.getSyncJob
);

// POST /api/devices/sync-queue/retry-failed - Retry all failed jobs
router.post('/sync-queue/retry-failed',
  authorize(['admin']),
  deviceController.retryFailedJobs
);

// DELETE /api/devices/sync-queue/failed - Clear failed jobs
router.delete('/sync-queue/failed',
  authorize(['admin']),
  deviceController.clearFailedJobs
);

// =====================================================
// SMB2 DEVICE-SPECIFIC ROUTES (No mounting required)
// =====================================================

// GET /api/devices/:id/smb2/test - Test SMB2 connection
router.get('/:id/smb2/test',
  deviceController.smb2TestConnection
);

// GET /api/devices/:id/smb2/browse - Browse files using SMB2
router.get('/:id/smb2/browse',
  deviceController.smb2BrowseFiles
);

// GET /api/devices/:id/smb2/file/* - Read file using SMB2
router.get('/:id/smb2/file/*',
  deviceController.smb2ReadFile
);

// POST /api/devices/:id/smb2/scan - Scan device folders recursively
router.post('/:id/smb2/scan',
  authorize(['admin', 'doctor', 'nurse', 'technician']),
  deviceController.smb2ScanDevice
);

module.exports = router;
