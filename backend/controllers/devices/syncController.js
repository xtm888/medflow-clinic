/**
 * Device Sync Controller
 *
 * Handles auto-sync, sync queue, streaming SMB, and SMB2 direct access.
 */

const {
  Device,
  asyncHandler,
  path,
  success,
  error,
  notFound,
  createContextLogger
} = require('./shared');

// =====================================================
// STREAMING SMB ACCESS (No permanent mounting required)
// =====================================================

// @desc    Browse files via streaming (temp mount)
// @route   GET /api/devices/:id/stream/browse
// @access  Private
exports.streamBrowseFiles = asyncHandler(async (req, res, next) => {
  const { subpath = '' } = req.query;
  const smbService = require('../../services/smbStreamService');

  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  // Check if device has SMB configuration
  if (device.connection?.settings?.shareProtocol !== 'smb') {
    return error(res, 'Device is not configured for SMB access');
  }

  try {
    await smbService.init();
    const listing = await smbService.listDirectory(device, subpath);

    return success(res, {
      ...listing,
      device: {
        id: device._id,
        name: device.name,
        type: device.type,
        ip: device.connection?.ipAddress
      },
      accessMethod: 'streaming'
    });

  } catch (err) {
    return error(res, 'Failed to browse files', 500);
  }
});

// @desc    Stream file from SMB share (temp access)
// @route   GET /api/devices/:id/stream/file/*
// @access  Private
exports.streamGetFile = asyncHandler(async (req, res, next) => {
  const smbService = require('../../services/smbStreamService');

  // Get filepath from wildcard
  const filepath = req.params[0] || '';

  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  if (device.connection?.settings?.shareProtocol !== 'smb') {
    return error(res, 'Device is not configured for SMB access');
  }

  // Sanitize path
  const sanitizedPath = filepath.replace(/\.\./g, '').replace(/^\/+/, '');

  try {
    await smbService.init();
    const fileInfo = await smbService.streamFile(device, sanitizedPath);

    // Get file extension for content type
    const ext = path.extname(sanitizedPath).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.pdf': 'application/pdf',
      '.xml': 'application/xml',
      '.dcm': 'application/dicom',
      '.dicom': 'application/dicom',
      '.txt': 'text/plain'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', fileInfo.size);
    res.setHeader('X-From-Cache', fileInfo.fromCache ? 'true' : 'false');

    // Inline display for viewable files
    const filename = path.basename(sanitizedPath);
    if (['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext)) {
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    // Stream the file
    const fileStream = require('fs').createReadStream(fileInfo.localPath);
    fileStream.pipe(res);

  } catch (err) {
    return error(res, 'Failed to stream file', 500);
  }
});

// @desc    Check SMB share accessibility
// @route   GET /api/devices/:id/stream/check
// @access  Private
exports.streamCheckAccess = asyncHandler(async (req, res, next) => {
  const smbService = require('../../services/smbStreamService');

  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  if (device.connection?.settings?.shareProtocol !== 'smb') {
    return success(res, {
      accessible: false,
      reason: 'Not an SMB device'
    });
  }

  try {
    await smbService.init();
    const accessible = await smbService.checkAccess(device);
    const connectionInfo = smbService.getConnectionInfo(device);

    // Update device status
    if (accessible) {
      await Device.findByIdAndUpdate(device._id, {
        'integration.status': 'connected',
        'integration.lastConnection': new Date()
      });
    }

    return success(res, {
      accessible,
      device: {
        id: device._id,
        name: device.name,
        type: device.type
      },
      connection: {
        host: connectionInfo.host,
        shareName: connectionInfo.shareName,
        username: connectionInfo.credentials.username
      }
    });

  } catch (err) {
    return success(res, {
      accessible: false,
      error: err.message
    });
  }
});

// @desc    Check all device connections (batch)
// @route   GET /api/devices/stream/check-all
// @access  Private
exports.streamCheckAllDevices = asyncHandler(async (req, res, next) => {
  const smbService = require('../../services/smbStreamService');
  const net = require('net');

  // Find all SMB devices
  const devices = await Device.find({
    active: true,
    'connection.settings.shareProtocol': 'smb'
  });

  const results = [];
  await smbService.init();

  for (const device of devices) {
    const connectionInfo = smbService.getConnectionInfo(device);
    const ip = device.connection?.ipAddress || connectionInfo.host;

    // Quick TCP check first
    let tcpReachable = false;
    try {
      await new Promise((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);
        socket.connect(445, ip, () => {
          socket.destroy();
          tcpReachable = true;
          resolve();
        });
        socket.on('error', () => {
          socket.destroy();
          reject(new Error('Connection failed'));
        });
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('Timeout'));
        });
      });
    } catch (e) {
      tcpReachable = false;
    }

    results.push({
      device: {
        id: device._id,
        deviceId: device.deviceId,
        name: device.name,
        type: device.type
      },
      connection: {
        ip,
        host: connectionInfo.host,
        shareName: connectionInfo.shareName
      },
      status: {
        tcpReachable,
        smbPort: tcpReachable ? 'open' : 'closed'
      }
    });
  }

  const reachable = results.filter(r => r.status.tcpReachable).length;

  return success(res, {
    summary: {
      total: results.length,
      reachable,
      unreachable: results.length - reachable
    },
    results
  });
});

// @desc    Clear SMB file cache
// @route   POST /api/devices/stream/clear-cache
// @access  Private (admin)
exports.streamClearCache = asyncHandler(async (req, res, next) => {
  const smbService = require('../../services/smbStreamService');

  await smbService.clearCache();

  return success(res, { data: null, message: 'SMB file cache cleared' });
});

// =====================================================
// AUTO-SYNC SERVICE METHODS
// =====================================================

// @desc    Get auto-sync service status
// @route   GET /api/devices/auto-sync/status
// @access  Private
exports.getAutoSyncStatus = asyncHandler(async (req, res, next) => {
  const autoSyncService = require('../../services/autoSyncService');

  const status = await autoSyncService.getStatus();

  return success(res, { data: status });
});

// @desc    Start auto-sync service
// @route   POST /api/devices/auto-sync/start
// @access  Private (admin)
exports.startAutoSync = asyncHandler(async (req, res, next) => {
  const autoSyncService = require('../../services/autoSyncService');

  const { pollIntervalMinutes = 5 } = req.body;

  await autoSyncService.init({ pollIntervalMinutes });
  autoSyncService.startScheduledPolling();

  res.status(200).json({
    success: true,
    message: 'Auto-sync service started',
    config: autoSyncService.config
  });
});

// @desc    Stop auto-sync service
// @route   POST /api/devices/auto-sync/stop
// @access  Private (admin)
exports.stopAutoSync = asyncHandler(async (req, res, next) => {
  const autoSyncService = require('../../services/autoSyncService');

  autoSyncService.stopScheduledPolling();

  return success(res, { data: null, message: 'Auto-sync service stopped' });
});

// @desc    Trigger immediate sync for all devices
// @route   POST /api/devices/auto-sync/sync-all
// @access  Private (admin)
exports.triggerSyncAll = asyncHandler(async (req, res, next) => {
  const autoSyncService = require('../../services/autoSyncService');

  const results = await autoSyncService.syncAllDevices();

  return success(res, { data: results });
});

// @desc    Trigger immediate sync for single device
// @route   POST /api/devices/:id/auto-sync/trigger
// @access  Private
exports.triggerDeviceSync = asyncHandler(async (req, res, next) => {
  const autoSyncService = require('../../services/autoSyncService');

  const result = await autoSyncService.triggerSync(req.params.id);

  return success(res, { data: result });
});

// @desc    Update auto-sync configuration
// @route   PUT /api/devices/auto-sync/config
// @access  Private (admin)
exports.updateAutoSyncConfig = asyncHandler(async (req, res, next) => {
  const autoSyncService = require('../../services/autoSyncService');

  const config = autoSyncService.updateConfig(req.body);

  return success(res, { data: config });
});

// =====================================================
// SYNC QUEUE METHODS
// =====================================================

// @desc    Get sync queue status
// @route   GET /api/devices/sync-queue/status
// @access  Private
exports.getSyncQueueStatus = asyncHandler(async (req, res, next) => {
  const syncQueue = require('../../services/deviceSyncQueue');

  const stats = await syncQueue.getStats();

  return success(res, { data: stats });
});

// @desc    Add job to sync queue
// @route   POST /api/devices/sync-queue/jobs
// @access  Private
exports.addSyncJob = asyncHandler(async (req, res, next) => {
  const syncQueue = require('../../services/deviceSyncQueue');

  const { jobType, data, options } = req.body;

  if (!jobType || !data) {
    return error(res, 'jobType and data are required');
  }

  const result = await syncQueue.addJob(jobType, data, options);

  return success(res, { data: result });
});

// @desc    Get job by ID
// @route   GET /api/devices/sync-queue/jobs/:jobId
// @access  Private
exports.getSyncJob = asyncHandler(async (req, res, next) => {
  const syncQueue = require('../../services/deviceSyncQueue');

  const job = await syncQueue.getJob(req.params.jobId);

  if (!job) {
    return notFound(res, 'Job');
  }

  return success(res, { data: job });
});

// @desc    Retry all failed jobs
// @route   POST /api/devices/sync-queue/retry-failed
// @access  Private (admin)
exports.retryFailedJobs = asyncHandler(async (req, res, next) => {
  const syncQueue = require('../../services/deviceSyncQueue');

  const result = await syncQueue.retryAllFailed();

  return success(res, { data: result });
});

// @desc    Clear failed jobs
// @route   DELETE /api/devices/sync-queue/failed
// @access  Private (admin)
exports.clearFailedJobs = asyncHandler(async (req, res, next) => {
  const syncQueue = require('../../services/deviceSyncQueue');

  const result = await syncQueue.clearFailedJobs();

  return success(res, { data: result });
});

// =====================================================
// SMB2 DIRECT ACCESS METHODS
// =====================================================

// @desc    List directory using SMB2 (no mount required)
// @route   GET /api/devices/:id/smb2/browse
// @access  Private
exports.smb2BrowseFiles = asyncHandler(async (req, res, next) => {
  try {
    const smb2Client = require('../../services/smb2ClientService');
    const { subpath = '' } = req.query;

    const device = await Device.findById(req.params.id);
    if (!device) {
      return notFound(res, 'Device');
    }

    await smb2Client.init();
    const listing = await smb2Client.listDirectory(device, subpath);

    return success(res, {
      ...listing,
      device: {
        id: device._id,
        name: device.name,
        type: device.type
      },
      accessMethod: 'smb2-direct'
    });
  } catch (err) {
    const log = createContextLogger('DeviceController');
    log.error('SMB2 operation failed', { operation: 'browse', error: err.message });
    return error(res, `SMB2 operation failed: ${err.message}`, 500);
  }
});

// @desc    Read file using SMB2 (no mount required)
// @route   GET /api/devices/:id/smb2/file/*
// @access  Private
exports.smb2ReadFile = asyncHandler(async (req, res, next) => {
  try {
    const smb2Client = require('../../services/smb2ClientService');

    const filepath = req.params[0] || '';
    const device = await Device.findById(req.params.id);

    if (!device) {
      return notFound(res, 'Device');
    }

    await smb2Client.init();
    const fileInfo = await smb2Client.readFile(device, filepath);

    // Get file extension for content type
    const ext = path.extname(filepath).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      '.pdf': 'application/pdf',
      '.xml': 'application/xml',
      '.dcm': 'application/dicom',
      '.dicom': 'application/dicom',
      '.txt': 'text/plain',
      '.csv': 'text/csv'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', fileInfo.size);
    res.setHeader('X-From-Cache', fileInfo.fromCache ? 'true' : 'false');

    // Stream the file
    const fs = require('fs');
    const fileStream = fs.createReadStream(fileInfo.localPath);
    fileStream.pipe(res);
  } catch (err) {
    const log = createContextLogger('DeviceController');
    log.error('SMB2 operation failed', { operation: 'read', error: err.message });
    return error(res, `SMB2 operation failed: ${err.message}`, 500);
  }
});

// @desc    Test SMB2 connection
// @route   GET /api/devices/:id/smb2/test
// @access  Private
exports.smb2TestConnection = asyncHandler(async (req, res, next) => {
  const smb2Client = require('../../services/smb2ClientService');

  const device = await Device.findById(req.params.id);
  if (!device) {
    return notFound(res, 'Device');
  }

  await smb2Client.init();
  const result = await smb2Client.testConnection(device);

  // Update device status if connected
  if (result.accessible) {
    await Device.findByIdAndUpdate(device._id, {
      'integration.status': 'connected',
      'integration.lastConnection': new Date()
    });
  }

  return success(res, {
    ...result,
    device: {
      id: device._id,
      name: device.name,
      type: device.type
    }
  });
});

// @desc    Scan device folders recursively using SMB2
// @route   POST /api/devices/:id/smb2/scan
// @access  Private
exports.smb2ScanDevice = asyncHandler(async (req, res, next) => {
  try {
    const smb2Client = require('../../services/smb2ClientService');

    const device = await Device.findById(req.params.id);
    if (!device) {
      return notFound(res, 'Device');
    }

    const {
      basePath = '',
      maxDepth = 5,
      maxFiles = 1000,
      extensions = null
    } = req.body;

    await smb2Client.init();
    const result = await smb2Client.scanDirectoryRecursive(device, basePath, {
      maxDepth,
      maxFiles,
      extensions
    });

    return success(res, {
      data: {
        ...result,
        device: {
          id: device._id,
          name: device.name
        }
      }
    });
  } catch (err) {
    const log = createContextLogger('DeviceController');
    log.error('SMB2 operation failed', { operation: 'scan', error: err.message });
    return error(res, `SMB2 operation failed: ${err.message}`, 500);
  }
});

// @desc    Get SMB2 client statistics
// @route   GET /api/devices/smb2/stats
// @access  Private
exports.getSmb2Stats = asyncHandler(async (req, res, next) => {
  const smb2Client = require('../../services/smb2ClientService');

  return success(res, { data: smb2Client.getStats() });
});
