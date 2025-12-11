const Device = require('../models/Device');
const DeviceMeasurement = require('../models/DeviceMeasurement');
const DeviceImage = require('../models/DeviceImage');
const DeviceIntegrationLog = require('../models/DeviceIntegrationLog');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const Patient = require('../models/Patient');
const Alert = require('../models/Alert');
const AuditLog = require('../models/AuditLog');
const { asyncHandler } = require('../middleware/errorHandler');
const AdapterFactory = require('../services/adapters/AdapterFactory');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { success, error, notFound, paginated } = require('../utils/apiResponse');
const { device: deviceLogger } = require('../utils/structuredLogger');
const { DEVICE, PAGINATION } = require('../config/constants');
// SECURITY: Use secure shell utilities to prevent command injection
const {
  isMounted,
  mountSmbShare,
  unmountPath,
  validateMountPath,
  validateHost,
  sanitizeForFilesystem
} = require('../utils/shellSecurity');

// @desc    Get all devices
// @route   GET /api/devices
// @access  Private
exports.getDevices = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 20,
    type,
    status,
    integrationMethod,
    location
  } = req.query;

  const query = { active: true };

  if (type) query.type = type;
  if (status) query['integration.status'] = status;
  if (integrationMethod) query['integration.method'] = integrationMethod;
  if (location) query['location.facility'] = location;

  const devices = await Device.find(query)
    .populate('assignedTo', 'firstName lastName')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort('-createdAt');

  const count = await Device.countDocuments(query);

  res.status(200).json({
    success: true,
    count: devices.length,
    total: count,
    page: parseInt(page),
    pages: Math.ceil(count / limit),
    data: devices
  });
});

// @desc    Get single device
// @route   GET /api/devices/:id
// @access  Private
exports.getDeviceById = asyncHandler(async (req, res, next) => {
  const device = await Device.findById(req.params.id)
    .populate('assignedTo', 'firstName lastName role');

  if (!device) {
    return notFound(res, 'Device');
  }

  return success(res, { data: device });
});

// @desc    Create new device
// @route   POST /api/devices
// @access  Private (admin only)
exports.createDevice = asyncHandler(async (req, res, next) => {
  const device = await Device.create({
    ...req.body,
    createdBy: req.user.id
  });

  return success(res, { data: device });
});

// @desc    Update device
// @route   PUT /api/devices/:id
// @access  Private (admin only)
exports.updateDevice = asyncHandler(async (req, res, next) => {
  let device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  device = await Device.findByIdAndUpdate(
    req.params.id,
    {
      ...req.body,
      updatedBy: req.user.id
    },
    {
      new: true,
      runValidators: true
    }
  );

  return success(res, { data: device });
});

// @desc    Delete device (soft delete)
// @route   DELETE /api/devices/:id
// @access  Private (admin only)
exports.deleteDevice = asyncHandler(async (req, res, next) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  device.active = false;
  device.updatedBy = req.user.id;
  await device.save();

  return success(res, { data: { message: 'Device deleted successfully' }, message: 'Device deleted successfully' });
});

// @desc    Handle webhook from device
// @route   POST /api/devices/webhook/:deviceId
// @access  Public (verified by signature)
exports.handleWebhook = asyncHandler(async (req, res, next) => {
  const { deviceId } = req.params;
  const startTime = Date.now();

  // 1. Find device
  const device = await Device.findOne({ deviceId: deviceId });

  if (!device) {
    return notFound(res, 'Device');
  }

  // 2. Verify webhook signature
  const signature = req.headers['x-device-signature'];
  const isValid = verifyWebhookSignature(
    req.body,
    signature,
    device.integration.webhook.secret
  );

  if (!isValid) {
    await DeviceIntegrationLog.create({
      device: device._id,
      deviceType: device.type,
      eventType: 'WEBHOOK_RECEIVED',
      status: 'FAILED',
      integrationMethod: 'webhook',
      initiatedBy: 'DEVICE',
      errorDetails: {
        code: 'INVALID_SIGNATURE',
        message: 'Webhook signature verification failed',
        severity: 'HIGH'
      }
    });

    return error(res, 'Invalid webhook signature', 401);
  }

  // 3. Log webhook receipt
  const log = await DeviceIntegrationLog.create({
    device: device._id,
    deviceType: device.type,
    eventType: 'WEBHOOK_RECEIVED',
    status: 'PROCESSING',
    integrationMethod: 'webhook',
    initiatedBy: 'DEVICE',
    startedAt: new Date(),
    source: {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    },
    webhook: {
      signature: signature,
      signatureVerified: true,
      headers: req.headers,
      payload: req.body
    }
  });

  try {
    const { patientId, examId, imageType, eye, metadata } = req.body;
    const file = req.file;

    // 4. Get appropriate adapter
    const adapter = AdapterFactory.getAdapter(device);

    // 5. Process data through adapter
    const result = await adapter.process(
      {
        ...metadata,
        dicomFile: file ? file.buffer : undefined,
        imageFile: file ? file.buffer : undefined,
        eye,
        imageType,
        source: 'webhook'
      },
      patientId,
      examId
    );

    if (!result.success) {
      log.status = 'FAILED';
      log.errorDetails = {
        code: 'PROCESSING_FAILED',
        message: result.error.message,
        severity: 'HIGH'
      };
      log.completedAt = new Date();
      await log.save();

      // Update device error count
      await Device.findByIdAndUpdate(device._id, {
        $inc: { 'integration.consecutiveErrors': 1 },
        'integration.lastSyncStatus': 'failed'
      });

      return error(res, result.error.message);
    }

    // 6. Update device status
    await Device.findByIdAndUpdate(device._id, {
      'integration.status': 'connected',
      'integration.lastSync': new Date(),
      'integration.lastSyncStatus': 'success',
      'integration.webhook.lastWebhookReceived': new Date(),
      'integration.consecutiveErrors': 0,
      $inc: { 'integration.webhook.webhookCount': 1 }
    });

    // 7. Emit WebSocket alert
    const io = req.app.get('socketio');
    if (io && examId) {
      io.to(`room-exam-${examId}`).emit('device-data-received', {
        examId,
        deviceId: device._id,
        deviceType: device.type,
        dataType: imageType || 'measurement',
        timestamp: new Date()
      });
    }

    // 8. Create alert for staff
    if (examId) {
      await Alert.create({
        category: 'device',
        priority: 'low',
        title: `Données ${device.type} reçues`,
        message: `Nouvelles données de ${device.name} pour l'examen`,
        relatedModel: 'OphthalmologyExam',
        relatedId: examId,
        auto: true
      });
    }

    // 9. Update log
    log.status = 'SUCCESS';
    log.completedAt = new Date();
    log.processing.recordsProcessed = 1;
    log.processingTime = Date.now() - startTime;
    await log.save();

    return success(res, { data: result.data, message: 'Webhook processed successfully' });

  } catch (err) {
    log.status = 'FAILED';
    log.errorDetails = {
      code: 'WEBHOOK_PROCESSING_ERROR',
      message: err.message,
      stack: err.stack,
      severity: 'HIGH'
    };
    log.completedAt = new Date();
    await log.save();

    throw err;
  }
});

// @desc    Sync device folder (scheduled or manual)
// @route   POST /api/devices/:id/sync-folder
// @access  Private
exports.syncDeviceFolder = asyncHandler(async (req, res, next) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  if (!device.integration.folderSync.enabled) {
    return error(res, 'Folder sync not enabled for this device');
  }

  const folderPath = device.integration.folderSync.sharedFolderPath;
  const filePattern = device.integration.folderSync.filePattern || '*';
  const fileFormat = device.integration.folderSync.fileFormat;

  // Log sync start
  const log = await DeviceIntegrationLog.create({
    device: device._id,
    deviceType: device.type,
    eventType: 'FOLDER_SCAN',
    status: 'PROCESSING',
    integrationMethod: 'folder-sync',
    initiatedBy: req.user ? 'MANUAL' : 'SCHEDULED',
    operator: req.user?.id,
    startedAt: new Date(),
    folderSync: {
      folderPath: folderPath
    }
  });

  try {
    // Read folder
    const files = await fs.readdir(folderPath);

    // Filter files by pattern
    const matchingFiles = files.filter(file => {
      if (filePattern === '*') return true;
      const regex = new RegExp(filePattern.replace('*', '.*'));
      return regex.test(file);
    });

    log.folderSync.filesScanned = files.length;
    log.folderSync.filesNew = matchingFiles.length;
    await log.save();

    const processedFolder = device.integration.folderSync.processedFolder || path.join(folderPath, 'processed');
    const errorFolder = device.integration.folderSync.errorFolder || path.join(folderPath, 'errors');

    // Ensure folders exist
    await fs.mkdir(processedFolder, { recursive: true });
    await fs.mkdir(errorFolder, { recursive: true });

    let recordsProcessed = 0;
    let recordsFailed = 0;
    const errors = [];
    const adapter = AdapterFactory.getAdapter(device);

    // Process each file
    for (const file of matchingFiles) {
      const filePath = path.join(folderPath, file);

      try {
        // Check if already processed
        const alreadyProcessed = await DeviceIntegrationLog.findOne({
          device: device._id,
          'folderSync.filesProcessed.fileName': file,
          status: 'SUCCESS'
        });

        if (alreadyProcessed) {
          continue; // Skip already processed files
        }

        // Read file
        const content = await fs.readFile(filePath);

        // Parse file
        const parsedData = await adapter.parseFile(content, fileFormat);

        // Process each measurement
        for (const data of parsedData) {
          const result = await adapter.process(
            { ...data, source: 'folder-sync' },
            data.patientId,
            data.examId
          );

          if (result.success) {
            recordsProcessed++;
          } else {
            recordsFailed++;
            errors.push({ file, error: result.error.message });
          }
        }

        // Move file to processed folder
        await fs.rename(filePath, path.join(processedFolder, file));

        log.folderSync.filesProcessed.push({
          fileName: file,
          fileSize: (await fs.stat(path.join(processedFolder, file))).size,
          processedAt: new Date(),
          status: 'SUCCESS'
        });

      } catch (err) {
        recordsFailed++;
        errors.push({ file, error: err.message });

        // Move to error folder
        try {
          await fs.rename(filePath, path.join(errorFolder, file));
        } catch (moveError) {
          deviceLogger.error('Failed to move error file', { file, error: moveError.message });
        }

        log.folderSync.filesProcessed.push({
          fileName: file,
          processedAt: new Date(),
          status: 'FAILED',
          error: err.message
        });
      }
    }

    // Update log
    log.status = recordsFailed === 0 ? 'SUCCESS' : 'PARTIAL';
    log.processing.recordsProcessed = recordsProcessed;
    log.processing.recordsFailed = recordsFailed;
    log.completedAt = new Date();
    if (errors.length > 0) {
      log.errorDetails = {
        code: 'PARTIAL_FAILURE',
        message: `${recordsFailed} files failed to process`,
        severity: 'MEDIUM'
      };
    }
    await log.save();

    // Update device status
    await Device.findByIdAndUpdate(device._id, {
      'integration.status': recordsFailed === 0 ? 'connected' : 'error',
      'integration.lastSync': new Date(),
      'integration.lastSyncStatus': recordsFailed === 0 ? 'success' : 'partial',
      'integration.folderSync.lastFolderSync': new Date(),
      $inc: {
        'integration.folderSync.filesProcessed': recordsProcessed,
        'integration.folderSync.filesFailed': recordsFailed
      }
    });

    return success(res, {
      recordsProcessed,
      recordsFailed,
      errors
    }, `Synchronisation terminée: ${recordsProcessed} traités, ${recordsFailed} échoués`);

  } catch (err) {
    log.status = 'FAILED';
    log.errorDetails = {
      code: 'FOLDER_SYNC_ERROR',
      message: err.message,
      stack: err.stack,
      severity: 'HIGH'
    };
    log.completedAt = new Date();
    await log.save();

    throw err;
  }
});

// @desc    Import measurements manually
// @route   POST /api/devices/:id/import-measurements
// @access  Private
exports.importMeasurements = asyncHandler(async (req, res, next) => {
  const { patientId, examId, measurements } = req.body;
  const userId = req.user.id;

  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  if (!Array.isArray(measurements) || measurements.length === 0) {
    return error(res, 'No measurements provided');
  }

  // Log import start
  const log = await DeviceIntegrationLog.create({
    device: device._id,
    deviceType: device.type,
    eventType: 'MEASUREMENT_IMPORT',
    status: 'PROCESSING',
    integrationMethod: 'manual',
    initiatedBy: 'MANUAL',
    operator: userId,
    startedAt: new Date()
  });

  try {
    const adapter = AdapterFactory.getAdapter(device);
    const savedMeasurements = [];
    const errors = [];

    for (const measurement of measurements) {
      try {
        const result = await adapter.process(
          { ...measurement, source: 'manual' },
          patientId,
          examId
        );

        if (result.success) {
          savedMeasurements.push(result.data.measurementId);
        } else {
          errors.push({
            measurement,
            error: result.error.message
          });
        }
      } catch (err) {
        errors.push({
          measurement,
          error: err.message
        });
      }
    }

    // Update log
    log.status = errors.length === 0 ? 'SUCCESS' : 'PARTIAL';
    log.processing.recordsProcessed = savedMeasurements.length;
    log.processing.recordsFailed = errors.length;
    log.completedAt = new Date();
    log.createdRecords = {
      deviceMeasurements: savedMeasurements,
      count: savedMeasurements.length
    };
    await log.save();

    return success(res, {
      imported: savedMeasurements.length,
      failed: errors.length,
      measurementIds: savedMeasurements,
      errors
    });

  } catch (err) {
    log.status = 'FAILED';
    log.errorDetails = {
      code: 'IMPORT_ERROR',
      message: err.message,
      severity: 'HIGH'
    };
    log.completedAt = new Date();
    await log.save();

    throw err;
  }
});

// @desc    Get device statistics
// @route   GET /api/devices/:id/stats
// @access  Private
exports.getDeviceStats = asyncHandler(async (req, res, next) => {
  const { days = 30 } = req.query;
  const deviceId = req.params.id;

  const device = await Device.findById(deviceId);

  if (!device) {
    return notFound(res, 'Device');
  }

  // Get event statistics
  const eventStats = await DeviceIntegrationLog.getEventStats(deviceId, days);

  // Get error summary
  const errorSummary = await DeviceIntegrationLog.getErrorSummary(deviceId, days);

  // Get total measurements
  const totalMeasurements = await DeviceMeasurement.countDocuments({ device: deviceId });

  // Get total images
  const totalImages = await DeviceImage.countDocuments({ device: deviceId });

  return success(res, {
    device: {
      id: device._id,
      name: device.name,
      type: device.type,
      status: device.integration.status
    },
    statistics: {
      totalMeasurements,
      totalImages,
      eventStats,
      errorSummary
    }
  });
});

// @desc    Get device integration logs
// @route   GET /api/devices/:id/logs
// @access  Private
exports.getDeviceLogs = asyncHandler(async (req, res, next) => {
  const { limit = 50 } = req.query;

  const logs = await DeviceIntegrationLog.getDeviceLogs(req.params.id, limit);

  res.status(200).json({
    success: true,
    count: logs.length,
    data: logs
  });
});

// @desc    Start folder watcher for a device
// @route   POST /api/devices/:id/watcher/start
// @access  Private (admin)
exports.startFolderWatcher = asyncHandler(async (req, res, next) => {
  const folderSyncService = require('../services/folderSyncService');

  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  if (device.integration?.method !== 'folder-sync') {
    return error(res, 'Device is not configured for folder sync');
  }

  await folderSyncService.startWatchingDevice(device);

  return success(res, { deviceId: device._id, deviceName: device.name }, `File watcher started for ${device.name}`);
});

// @desc    Stop folder watcher for a device
// @route   POST /api/devices/:id/watcher/stop
// @access  Private (admin)
exports.stopFolderWatcher = asyncHandler(async (req, res, next) => {
  const folderSyncService = require('../services/folderSyncService');

  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  await folderSyncService.stopWatchingDevice(req.params.id);

  return success(res, { data: { deviceId: device._id, deviceName: device.name }, message: `File watcher stopped for ${device.name}` });
});

// @desc    Get folder sync service statistics
// @route   GET /api/devices/folder-sync/stats
// @access  Private
exports.getFolderSyncStats = asyncHandler(async (req, res, next) => {
  const folderSyncService = require('../services/folderSyncService');

  const stats = folderSyncService.getStats();

  return success(res, { data: stats });
});

// @desc    Trigger full sync for a device
// @route   POST /api/devices/:id/watcher/sync
// @access  Private
exports.triggerFullSync = asyncHandler(async (req, res, next) => {
  const folderSyncService = require('../services/folderSyncService');

  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  const result = await folderSyncService.triggerSync(req.params.id);

  return success(res, { data: { deviceName: result.device }, message: result.message });
});

// @desc    Mount SMB share for a device
// @route   POST /api/devices/:id/mount
// @access  Private (admin)
exports.mountShare = asyncHandler(async (req, res, next) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  // Check if device has SMB connection settings
  const settings = device.connection?.settings;
  const ip = device.connection?.ipAddress;

  if (!settings?.shareName || !ip) {
    return error(res, 'Device does not have SMB share configuration');
  }

  const shareName = settings.shareName;
  const hostname = settings.hostname || ip;

  // SECURITY: Validate inputs before shell operations
  try {
    validateHost(hostname);
    if (ip && ip !== hostname) {
      validateHost(ip);
    }
  } catch (validationErr) {
    deviceLogger.warn('Invalid host configuration', { error: validationErr.message, device: device.name });
    return error(res, 'Invalid device network configuration');
  }

  // Use user-writable mount location to avoid permission issues
  // SECURITY: Use sanitizeForFilesystem to prevent injection via shareName
  const sanitizedName = sanitizeForFilesystem(shareName);
  const mountPoint = `/tmp/medflow_mounts/${sanitizedName}`;
  const configuredPath = device.integration?.folderSync?.sharedFolderPath;

  // SECURITY: Validate configured path if it exists
  if (configuredPath) {
    try {
      const validConfiguredPath = validateMountPath(configuredPath);
      if (await isMounted(validConfiguredPath)) {
        return success(res, { mountPoint: validConfiguredPath, alreadyMounted: true }, 'Share already mounted');
      }
    } catch (err) {
      // Invalid path or check failed - continue to our mount point
      deviceLogger.debug('Configured path check skipped', { error: err.message });
    }
  }

  // Check if already mounted at our mount point
  try {
    if (await isMounted(mountPoint)) {
      return success(res, { mountPoint, alreadyMounted: true }, 'Share already mounted');
    }
  } catch (err) {
    // Continue to mount
  }

  try {
    // Create mount point directory
    await fs.mkdir(mountPoint, { recursive: true });

    // SECURITY: Use secure mount function (no shell interpolation)
    deviceLogger.info('Mounting share', { hostname, shareName, mountPoint, device: device.name });

    await mountSmbShare({ hostname, shareName, mountPoint });

    // Update device with actual mount path and status
    await Device.findByIdAndUpdate(device._id, {
      'integration.status': 'connected',
      'integration.lastConnection': new Date(),
      'integration.folderSync.sharedFolderPath': mountPoint
    });

    return success(res, { mountPoint, shareName, hostname }, `Share mounted successfully at ${mountPoint}`);

  } catch (err) {
    deviceLogger.error('Mount error', { error: err.message, device: device.name });

    // Try with IP instead of hostname
    if (ip && hostname !== ip) {
      try {
        // SECURITY: Use secure mount function (no shell interpolation)
        await mountSmbShare({ hostname: ip, shareName, mountPoint });

        await Device.findByIdAndUpdate(device._id, {
          'integration.status': 'connected',
          'integration.lastConnection': new Date(),
          'integration.folderSync.sharedFolderPath': mountPoint
        });

        return success(res, { mountPoint, shareName, ip }, `Share mounted successfully at ${mountPoint} (via IP)`);
      } catch (altError) {
        // Continue to error
      }
    }

    return error(res, 'Failed to mount share', 500);
  }
});

// @desc    Unmount SMB share for a device
// @route   POST /api/devices/:id/unmount
// @access  Private (admin)
exports.unmountShare = asyncHandler(async (req, res, next) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  const shareName = device.connection?.settings?.shareName;
  let mountPoint = device.integration?.folderSync?.sharedFolderPath;

  // Fallback to /Volumes path but sanitize the share name
  if (!mountPoint && shareName) {
    const sanitizedName = sanitizeForFilesystem(shareName);
    mountPoint = `/Volumes/${sanitizedName}`;
  }

  if (!mountPoint) {
    return error(res, 'No mount point configured for this device');
  }

  // SECURITY: Validate mount path before shell operations
  let validMountPoint;
  try {
    validMountPoint = validateMountPath(mountPoint);
  } catch (validationErr) {
    deviceLogger.warn('Invalid mount path', { mountPoint, error: validationErr.message });
    return error(res, 'Invalid mount point path');
  }

  try {
    // SECURITY: Use secure isMounted check (no shell interpolation)
    if (!(await isMounted(validMountPoint))) {
      return success(res, { mountPoint: validMountPoint, wasNotMounted: true }, 'Share is not mounted');
    }

    // SECURITY: Use secure unmount function (no shell interpolation)
    await unmountPath(validMountPoint);

    // Update device status
    await Device.findByIdAndUpdate(device._id, {
      'integration.status': 'disconnected'
    });

    return success(res, { mountPoint: validMountPoint }, `Share unmounted from ${validMountPoint}`);

  } catch (err) {
    // Try force unmount
    try {
      // SECURITY: Use secure unmount with force flag
      await unmountPath(validMountPoint, true);
      return success(res, { mountPoint: validMountPoint, forced: true }, `Share force unmounted from ${validMountPoint}`);
    } catch (forceError) {
      return error(res, 'Failed to unmount share', 500);
    }
  }
});

// @desc    Get mount status for a device
// @route   GET /api/devices/:id/mount-status
// @access  Private
exports.getMountStatus = asyncHandler(async (req, res, next) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  const shareName = device.connection?.settings?.shareName;
  let mountPointRaw = device.integration?.folderSync?.sharedFolderPath;

  // Fallback to /Volumes path but sanitize the share name
  if (!mountPointRaw && shareName) {
    const sanitizedName = sanitizeForFilesystem(shareName);
    mountPointRaw = `/Volumes/${sanitizedName}`;
  }

  if (!mountPointRaw) {
    return success(res, {
      configured: false,
      mounted: false,
      message: 'No SMB share configured'
    });
  }

  // SECURITY: Validate mount path
  let mountPoint;
  try {
    mountPoint = validateMountPath(mountPointRaw);
  } catch (validationErr) {
    return success(res, {
      configured: true,
      mounted: false,
      mountPoint: mountPointRaw,
      shareName,
      ip: device.connection?.ipAddress,
      hostname: device.connection?.settings?.hostname,
      error: 'Invalid mount point path'
    });
  }

  try {
    // Check if directory exists and is accessible
    await fs.access(mountPoint);

    // SECURITY: Use secure isMounted check (no shell interpolation)
    const mounted = await isMounted(mountPoint);

    // If mounted, get some stats
    let fileCount = 0;
    if (mounted) {
      try {
        const files = await fs.readdir(mountPoint);
        fileCount = files.length;
      } catch (e) {
        // Ignore read errors
      }
    }

    return success(res, {
      configured: true,
      mounted,
      mountPoint,
      shareName,
      ip: device.connection?.ipAddress,
      hostname: device.connection?.settings?.hostname,
      fileCount: mounted ? fileCount : null
    });

  } catch (err) {
    return success(res, {
      configured: true,
      mounted: false,
      mountPoint,
      shareName,
      ip: device.connection?.ipAddress,
      hostname: device.connection?.settings?.hostname,
      error: 'Mount point not accessible'
    });
  }
});

// @desc    Mount all configured device shares
// @route   POST /api/devices/mount-all
// @access  Private (admin)
exports.mountAllShares = asyncHandler(async (req, res, next) => {
  // Find all devices with SMB configuration
  const devices = await Device.find({
    active: true,
    'connection.settings.shareName': { $exists: true },
    'connection.settings.shareProtocol': 'smb'
  });

  const results = [];

  // Create base mount directory
  await fs.mkdir('/tmp/medflow_mounts', { recursive: true });

  for (const device of devices) {
    const settings = device.connection?.settings;
    const ip = device.connection?.ipAddress;
    const shareName = settings?.shareName;
    const hostname = settings?.hostname || ip;

    // SECURITY: Validate host before any shell operations
    try {
      validateHost(hostname);
      if (ip && ip !== hostname) {
        validateHost(ip);
      }
    } catch (validationErr) {
      results.push({
        device: device.name,
        status: 'failed',
        error: 'Invalid host configuration'
      });
      continue;
    }

    // SECURITY: Use sanitizeForFilesystem to prevent injection
    const sanitizedName = sanitizeForFilesystem(shareName);
    const mountPoint = `/tmp/medflow_mounts/${sanitizedName}`;
    const configuredPath = device.integration?.folderSync?.sharedFolderPath;

    try {
      // SECURITY: Check if already mounted at configured path (with validation)
      if (configuredPath) {
        try {
          const validConfiguredPath = validateMountPath(configuredPath);
          if (await isMounted(validConfiguredPath)) {
            results.push({
              device: device.name,
              status: 'already_mounted',
              mountPoint: validConfiguredPath
            });
            continue;
          }
        } catch (pathErr) {
          // Invalid path, continue to try our mount point
        }
      }

      // SECURITY: Check if already mounted at our mount point
      if (await isMounted(mountPoint)) {
        results.push({
          device: device.name,
          status: 'already_mounted',
          mountPoint
        });
        continue;
      }

      // Create mount point
      await fs.mkdir(mountPoint, { recursive: true });

      // SECURITY: Mount using secure function (no shell interpolation)
      let mounted = false;
      try {
        await mountSmbShare({ hostname, shareName, mountPoint });
        mounted = true;
      } catch (e) {
        // Try IP if hostname failed
        if (ip && hostname !== ip) {
          await mountSmbShare({ hostname: ip, shareName, mountPoint });
          mounted = true;
        }
      }

      if (mounted) {
        await Device.findByIdAndUpdate(device._id, {
          'integration.status': 'connected',
          'integration.lastConnection': new Date(),
          'integration.folderSync.sharedFolderPath': mountPoint
        });

        results.push({
          device: device.name,
          status: 'mounted',
          mountPoint
        });
      }

    } catch (err) {
      results.push({
        device: device.name,
        status: 'failed',
        error: err.message,
        mountPoint
      });
    }
  }

  const mountedCount = results.filter(r => r.status === 'mounted').length;
  const alreadyMountedCount = results.filter(r => r.status === 'already_mounted').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  return success(res, { data: results, message: `Mounted: ${mountedCount}, Already mounted: ${alreadyMountedCount}, Failed: ${failedCount}` });
});

// @desc    Browse files in a device share
// @route   GET /api/devices/:id/browse
// @access  Private
exports.browseDeviceFiles = asyncHandler(async (req, res, next) => {
  const { subpath = '', limit = 100 } = req.query;

  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  const basePath = device.integration?.folderSync?.sharedFolderPath;

  if (!basePath) {
    return error(res, 'Device share not mounted');
  }

  // Sanitize subpath to prevent directory traversal
  const sanitizedSubpath = subpath.replace(/\.\./g, '').replace(/^\/+/, '');
  const fullPath = path.join(basePath, sanitizedSubpath);

  // Security check: ensure path is within base path
  if (!fullPath.startsWith(basePath)) {
    return error(res, 'Access denied', 403);
  }

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    const files = [];
    const directories = [];

    for (const entry of entries.slice(0, limit)) {
      const entryPath = path.join(fullPath, entry.name);

      try {
        const stats = await fs.stat(entryPath);

        const item = {
          name: entry.name,
          path: path.join(sanitizedSubpath, entry.name),
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime
        };

        if (entry.isDirectory()) {
          directories.push({ ...item, type: 'directory' });
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          files.push({
            ...item,
            type: 'file',
            extension: ext,
            isImage: ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff'].includes(ext),
            isPdf: ext === '.pdf',
            isXml: ext === '.xml',
            isDicom: ['.dcm', '.dicom'].includes(ext)
          });
        }
      } catch (statErr) {
        // Skip files we can't stat
      }
    }

    // Sort: directories first, then files by modified date
    directories.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => new Date(b.modified) - new Date(a.modified));

    return success(res, {
      currentPath: sanitizedSubpath || '/',
      parentPath: sanitizedSubpath ? path.dirname(sanitizedSubpath) : null,
      device: {
        id: device._id,
        name: device.name,
        type: device.type
      },
      directories,
      files,
      totalEntries: entries.length,
      displayedEntries: directories.length + files.length
    });

  } catch (err) {
    if (err.code === 'ENOENT') {
      return notFound(res, 'Directory');
    }
    throw err;
  }
});

// @desc    Get file content or serve file
// @route   GET /api/devices/:id/files/:filepath
// @access  Private
exports.getDeviceFile = asyncHandler(async (req, res, next) => {
  const { filepath } = req.params;

  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  const basePath = device.integration?.folderSync?.sharedFolderPath;

  if (!basePath) {
    return error(res, 'Device share not mounted');
  }

  // Decode and sanitize filepath
  const decodedPath = decodeURIComponent(filepath).replace(/\.\./g, '');
  const fullPath = path.join(basePath, decodedPath);

  // Security check
  if (!fullPath.startsWith(basePath)) {
    // Log security violation for path traversal attempt
    await AuditLog.create({
      user: req.user?._id || null,
      action: 'DEVICE_FILE_ACCESS_DENIED',
      resource: req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        deviceId: device._id,
        deviceName: device.name,
        attemptedPath: filepath,
        resolvedPath: fullPath,
        basePath,
        securityViolation: 'PATH_TRAVERSAL_ATTEMPT',
        severity: 'HIGH'
      },
      responseStatus: 403
    }).catch(err => deviceLogger.error('Audit log error', { error: err.message }));

    return error(res, 'Access denied', 403);
  }

  try {
    await fs.access(fullPath);
    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      return error(res, 'Cannot serve directory');
    }

    const ext = path.extname(fullPath).toLowerCase();

    // Set appropriate content type
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.pdf': 'application/pdf',
      '.xml': 'application/xml',
      '.dcm': 'application/dicom',
      '.dicom': 'application/dicom',
      '.txt': 'text/plain'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);

    // For PDFs and images, allow inline display
    if (['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext)) {
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(fullPath)}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fullPath)}"`);
    }

    // Log successful file access for audit trail
    AuditLog.create({
      user: req.user._id,
      action: 'DEVICE_FILE_ACCESS',
      resource: req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        deviceId: device._id,
        deviceName: device.name,
        deviceType: device.type,
        filePath: filepath,
        fileName: path.basename(fullPath),
        fileSize: stats.size,
        fileExtension: ext,
        contentType,
        accessPurpose: req.query.reason || 'not_specified'
      },
      responseStatus: 200
    }).catch(err => deviceLogger.error('Audit log error', { error: err.message }));

    // Stream the file
    const fileStream = require('fs').createReadStream(fullPath);
    fileStream.pipe(res);

  } catch (err) {
    if (err.code === 'ENOENT') {
      return notFound(res, 'File');
    }
    throw err;
  }
});

// @desc    Find patient by legacy DMI ID
// @route   GET /api/devices/legacy/patients/:dmiId
// @access  Private
exports.findPatientByLegacyId = asyncHandler(async (req, res, next) => {
  const { dmiId } = req.params;
  const legacyMapper = require('../services/legacyPatientMapper');

  const patient = await legacyMapper.findPatientByDmiId(dmiId);

  if (!patient) {
    // Try to extract patient name from known patterns
    const parsed = legacyMapper.parseDmiId(dmiId);

    return success(res, {
      dmiId,
      parsed,
      message: 'No patient mapping found for this DMI ID',
      found: false
    });
  }

  return success(res, {
    patient,
    dmiId,
    found: true
  });
});

// @desc    Create legacy ID mapping for patient
// @route   POST /api/devices/legacy/patients/:patientId/map
// @access  Private
exports.createLegacyMapping = asyncHandler(async (req, res, next) => {
  const { patientId } = req.params;
  const { dmiId, deviceType = 'archives', folderId, folderPath } = req.body;
  const legacyMapper = require('../services/legacyPatientMapper');

  // Validate input
  if (!dmiId && !folderId) {
    return error(res, 'Either dmiId or folderId is required');
  }

  const patient = await Patient.findById(patientId);

  if (!patient) {
    return notFound(res, 'Patient');
  }

  // Add legacy ID mapping
  if (dmiId) {
    const result = await legacyMapper.createMapping(dmiId, patientId);

    return success(res, {
      patientId: result.patientId,
      legacyId: result.legacyId,
      legacyIds: result.legacyIds
    }, 'Legacy ID mapping created');
  }

  // Add folder mapping
  if (folderId) {
    const folderMapping = {
      deviceType,
      folderId,
      path: folderPath,
      linkedAt: new Date(),
      linkedBy: req.user.id
    };

    // Check if already linked
    const existing = patient.folderIds?.find(
      f => f.deviceType === deviceType && f.folderId === folderId
    );

    if (existing) {
      return error(res, 'Folder already linked to this patient');
    }

    if (!patient.folderIds) {
      patient.folderIds = [];
    }
    patient.folderIds.push(folderMapping);
    await patient.save();

    return success(res, {
      patientId: patient.patientId,
      folderIds: patient.folderIds
    }, 'Folder mapping created');
  }
});

// @desc    Bulk import legacy patient mappings
// @route   POST /api/devices/legacy/patients/bulk-import
// @access  Private (admin only)
exports.bulkImportLegacyMappings = asyncHandler(async (req, res, next) => {
  const { mappings } = req.body;
  const legacyMapper = require('../services/legacyPatientMapper');

  if (!Array.isArray(mappings) || mappings.length === 0) {
    return error(res, 'Mappings array is required');
  }

  const stats = await legacyMapper.bulkImportMappings(mappings);

  return success(res, { data: stats, message: `Import completed: ${stats.matched} matched, ${stats.created} created, ${stats.failed} failed` });
});

// @desc    Scan archive folder and attempt auto-mapping
// @route   POST /api/devices/:id/scan-archive
// @access  Private
exports.scanArchiveFolder = asyncHandler(async (req, res, next) => {
  const { folderId } = req.body;
  const legacyMapper = require('../services/legacyPatientMapper');

  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  const basePath = device.integration?.folderSync?.sharedFolderPath;

  if (!basePath) {
    return error(res, 'Device share not mounted');
  }

  const folderPath = path.join(basePath, folderId);

  try {
    const files = await fs.readdir(folderPath);
    const result = await legacyMapper.scanAndMapFolder(folderId, files);

    return success(res, {
      ...result,
      folderPath,
      fileCount: files.length
    });

  } catch (err) {
    if (err.code === 'ENOENT') {
      return notFound(res, 'Folder');
    }
    throw err;
  }
});

// @desc    Get patient's archive files from legacy system
// @route   GET /api/devices/legacy/patients/:dmiId/files
// @access  Private
exports.getPatientArchiveFiles = asyncHandler(async (req, res, next) => {
  const { dmiId } = req.params;
  const legacyMapper = require('../services/legacyPatientMapper');

  // Find archive device
  const archiveDevice = await Device.findOne({
    deviceId: 'SERVERLV_ARCHIVES',
    active: true
  });

  if (!archiveDevice || !archiveDevice.integration?.folderSync?.sharedFolderPath) {
    return error(res, 'Archive device not configured or mounted');
  }

  const basePath = archiveDevice.integration.folderSync.sharedFolderPath;
  const patientFolder = path.join(basePath, 'ArchivesPatients', dmiId);

  try {
    const files = await fs.readdir(patientFolder);

    const fileDetails = await Promise.all(
      files.map(async (file) => {
        try {
          const filePath = path.join(patientFolder, file);
          const stats = await fs.stat(filePath);
          const ext = path.extname(file).toLowerCase();

          return {
            name: file,
            path: `ArchivesPatients/${dmiId}/${file}`,
            size: stats.size,
            modified: stats.mtime,
            extension: ext,
            type: ['.jpg', '.jpeg', '.png', '.bmp'].includes(ext) ? 'image' :
                  ext === '.pdf' ? 'document' : 'other'
          };
        } catch (e) {
          return null;
        }
      })
    );

    const validFiles = fileDetails.filter(f => f !== null);
    const patientInfo = await legacyMapper.findPatientByDmiId(dmiId);

    return success(res, {
      dmiId,
      patient: patientInfo,
      isMapped: !!patientInfo,
      folderPath: patientFolder,
      files: validFiles,
      counts: {
        total: validFiles.length,
        images: validFiles.filter(f => f.type === 'image').length,
        documents: validFiles.filter(f => f.type === 'document').length
      }
    });

  } catch (err) {
    if (err.code === 'ENOENT') {
      return notFound(res, 'Patient archive folder');
    }
    throw err;
  }
});

// =============================================================================
// STREAMING SMB ACCESS (No permanent mounting required)
// =============================================================================

// @desc    Browse files via streaming (temp mount)
// @route   GET /api/devices/:id/stream/browse
// @access  Private
exports.streamBrowseFiles = asyncHandler(async (req, res, next) => {
  const { subpath = '' } = req.query;
  const smbService = require('../services/smbStreamService');

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
  const smbService = require('../services/smbStreamService');

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
  const smbService = require('../services/smbStreamService');

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
  const smbService = require('../services/smbStreamService');
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
  const smbService = require('../services/smbStreamService');

  await smbService.clearCache();

  return success(res, { data: null, message: 'SMB file cache cleared' });
});

// =====================================================
// NETWORK DISCOVERY METHODS
// =====================================================

// @desc    Discover SMB shares on network
// @route   POST /api/devices/discover-network
// @access  Private (admin)
exports.discoverNetwork = asyncHandler(async (req, res, next) => {
  const networkDiscoveryService = require('../services/networkDiscoveryService');

  const {
    networkRange = '192.168.4.0/24',
    timeout = DEVICE.DISCOVERY_TIMEOUT_MS,
    credentials = null
  } = req.body;

  const result = await networkDiscoveryService.discoverNetwork(networkRange, {
    timeout,
    credentials
  });

  res.status(200).json({
    success: result.success,
    data: result
  });
});

// @desc    Get current network info (auto-detect)
// @route   GET /api/devices/discovery/network-info
// @access  Private
exports.getNetworkInfo = asyncHandler(async (req, res, next) => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const networks = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.');
        networks.push({
          interface: name,
          ip: iface.address,
          netmask: iface.netmask,
          networkRange: `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
        });
      }
    }
  }

  // Get primary network (first one)
  const primary = networks[0] || null;

  return success(res, {
    primary,
    all: networks,
    defaultRange: primary?.networkRange || '192.168.1.0/24'
  });
});

// @desc    Get last discovery results
// @route   GET /api/devices/discovery/status
// @access  Private
exports.getDiscoveryStatus = asyncHandler(async (req, res, next) => {
  const networkDiscoveryService = require('../services/networkDiscoveryService');

  const result = networkDiscoveryService.getLastDiscoveryResults();

  return success(res, { data: result });
});

// @desc    Quick scan known devices
// @route   POST /api/devices/discovery/quick-scan
// @access  Private (admin)
exports.quickScanDevices = asyncHandler(async (req, res, next) => {
  const networkDiscoveryService = require('../services/networkDiscoveryService');

  const results = await networkDiscoveryService.quickScan();

  const accessible = results.filter(r => r.accessible).length;

  return success(res, {
    data: {
      summary: {
        total: results.length,
        accessible,
        inaccessible: results.length - accessible
      },
      results
    }
  });
});

// @desc    Create devices from discovered shares
// @route   POST /api/devices/discovery/create-devices
// @access  Private (admin)
exports.createDevicesFromDiscovery = asyncHandler(async (req, res, next) => {
  const networkDiscoveryService = require('../services/networkDiscoveryService');

  const {
    shares,
    options = {}
  } = req.body;

  // Use provided shares or last discovery results
  const sharesToProcess = shares || networkDiscoveryService.getLastDiscoveryResults().shares;

  if (!sharesToProcess || sharesToProcess.length === 0) {
    return error(res, 'No shares to process. Run network discovery first.');
  }

  const result = await networkDiscoveryService.createDevicesFromShares(sharesToProcess, options);

  return success(res, { data: result });
});

// @desc    Probe a specific share structure
// @route   POST /api/devices/discovery/probe-share
// @access  Private (admin)
exports.probeShareStructure = asyncHandler(async (req, res, next) => {
  const networkDiscoveryService = require('../services/networkDiscoveryService');

  const {
    sharePath,
    credentials = null,
    maxDepth = 2
  } = req.body;

  if (!sharePath) {
    return error(res, 'sharePath is required');
  }

  const result = await networkDiscoveryService.probeShareStructure(sharePath, credentials, maxDepth);

  return success(res, { data: result });
});

// =====================================================
// UNIVERSAL FILE PROCESSOR METHODS
// =====================================================

// @desc    Process single file with universal processor
// @route   POST /api/devices/process-file
// @access  Private
exports.processFileUniversal = asyncHandler(async (req, res, next) => {
  const { universalFileProcessor } = require('../services/universalFileProcessor');

  const {
    filePath,
    deviceType = null,
    useOCR = true
  } = req.body;

  if (!filePath) {
    return error(res, 'filePath is required');
  }

  const result = await universalFileProcessor.processFile(filePath, deviceType, { useOCR });

  res.status(200).json({
    success: result.success,
    data: result
  });
});

// @desc    Process multiple files
// @route   POST /api/devices/process-batch
// @access  Private
exports.processBatchUniversal = asyncHandler(async (req, res, next) => {
  const { universalFileProcessor } = require('../services/universalFileProcessor');

  const {
    files,
    options = {}
  } = req.body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return error(res, 'files array is required');
  }

  const result = await universalFileProcessor.processBatch(files, options);

  return success(res, { data: result });
});

// @desc    Get universal processor statistics
// @route   GET /api/devices/processor/stats
// @access  Private
exports.getProcessorStats = asyncHandler(async (req, res, next) => {
  const { universalFileProcessor } = require('../services/universalFileProcessor');

  const stats = universalFileProcessor.getStats();

  return success(res, { data: stats });
});

// @desc    Check OCR service status
// @route   GET /api/devices/ocr/status
// @access  Private
exports.getOCRStatus = asyncHandler(async (req, res, next) => {
  const { universalFileProcessor } = require('../services/universalFileProcessor');

  const status = await universalFileProcessor.checkOCRService();

  return success(res, { data: status });
});

// =====================================================
// PATIENT FOLDER INDEXING METHODS
// =====================================================

// @desc    Index all device folders for patient matching
// @route   POST /api/devices/index-folders
// @access  Private (admin)
exports.indexAllFolders = asyncHandler(async (req, res, next) => {
  const patientFolderIndexer = require('../services/patientFolderIndexer');

  const { maxDepth = 10 } = req.body;

  const result = await patientFolderIndexer.indexAllDevices({ maxDepth });

  return success(res, { data: result });
});

// @desc    Index a single device's folders
// @route   POST /api/devices/:id/index-folders
// @access  Private (admin)
exports.indexDeviceFolders = asyncHandler(async (req, res, next) => {
  const patientFolderIndexer = require('../services/patientFolderIndexer');
  const Device = require('../models/Device');

  const device = await Device.findById(req.params.id);
  if (!device) {
    return notFound(res, 'Device');
  }

  await patientFolderIndexer.indexDeviceFolder(device, req.body);

  return success(res, {
    data: {
      device: device.name,
      stats: patientFolderIndexer.getStats()
    }
  });
});

// @desc    Get folder indexer statistics
// @route   GET /api/devices/index-folders/stats
// @access  Private
exports.getFolderIndexStats = asyncHandler(async (req, res, next) => {
  const patientFolderIndexer = require('../services/patientFolderIndexer');

  const stats = patientFolderIndexer.getStats();

  return success(res, { data: stats });
});

// @desc    Get unmatched folders for manual review
// @route   GET /api/devices/index-folders/unmatched
// @access  Private
exports.getUnmatchedFolders = asyncHandler(async (req, res, next) => {
  const patientFolderIndexer = require('../services/patientFolderIndexer');

  const unmatched = patientFolderIndexer.getUnmatchedFolders();

  res.status(200).json({
    success: true,
    count: unmatched.length,
    data: unmatched
  });
});

// @desc    Manually link a folder to a patient
// @route   POST /api/devices/index-folders/link
// @access  Private (admin)
exports.manualLinkFolder = asyncHandler(async (req, res, next) => {
  const patientFolderIndexer = require('../services/patientFolderIndexer');

  const { folderPath, patientId, deviceType } = req.body;

  if (!folderPath || !patientId) {
    return error(res, 'folderPath and patientId are required');
  }

  const result = await patientFolderIndexer.manualLinkFolder(
    folderPath,
    patientId,
    deviceType,
    req.user._id
  );

  return success(res, { data: result });
});

// =====================================================
// AUTO-SYNC SERVICE METHODS
// =====================================================

// @desc    Get auto-sync service status
// @route   GET /api/devices/auto-sync/status
// @access  Private
exports.getAutoSyncStatus = asyncHandler(async (req, res, next) => {
  const autoSyncService = require('../services/autoSyncService');

  const status = await autoSyncService.getStatus();

  return success(res, { data: status });
});

// @desc    Start auto-sync service
// @route   POST /api/devices/auto-sync/start
// @access  Private (admin)
exports.startAutoSync = asyncHandler(async (req, res, next) => {
  const autoSyncService = require('../services/autoSyncService');

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
  const autoSyncService = require('../services/autoSyncService');

  autoSyncService.stopScheduledPolling();

  return success(res, { data: null, message: 'Auto-sync service stopped' });
});

// @desc    Trigger immediate sync for all devices
// @route   POST /api/devices/auto-sync/sync-all
// @access  Private (admin)
exports.triggerSyncAll = asyncHandler(async (req, res, next) => {
  const autoSyncService = require('../services/autoSyncService');

  const results = await autoSyncService.syncAllDevices();

  return success(res, { data: results });
});

// @desc    Trigger immediate sync for single device
// @route   POST /api/devices/:id/auto-sync/trigger
// @access  Private
exports.triggerDeviceSync = asyncHandler(async (req, res, next) => {
  const autoSyncService = require('../services/autoSyncService');

  const result = await autoSyncService.triggerSync(req.params.id);

  return success(res, { data: result });
});

// @desc    Update auto-sync configuration
// @route   PUT /api/devices/auto-sync/config
// @access  Private (admin)
exports.updateAutoSyncConfig = asyncHandler(async (req, res, next) => {
  const autoSyncService = require('../services/autoSyncService');

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
  const syncQueue = require('../services/deviceSyncQueue');

  const stats = await syncQueue.getStats();

  return success(res, { data: stats });
});

// @desc    Add job to sync queue
// @route   POST /api/devices/sync-queue/jobs
// @access  Private
exports.addSyncJob = asyncHandler(async (req, res, next) => {
  const syncQueue = require('../services/deviceSyncQueue');

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
  const syncQueue = require('../services/deviceSyncQueue');

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
  const syncQueue = require('../services/deviceSyncQueue');

  const result = await syncQueue.retryAllFailed();

  return success(res, { data: result });
});

// @desc    Clear failed jobs
// @route   DELETE /api/devices/sync-queue/failed
// @access  Private (admin)
exports.clearFailedJobs = asyncHandler(async (req, res, next) => {
  const syncQueue = require('../services/deviceSyncQueue');

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
  const smb2Client = require('../services/smb2ClientService');
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
});

// @desc    Read file using SMB2 (no mount required)
// @route   GET /api/devices/:id/smb2/file/*
// @access  Private
exports.smb2ReadFile = asyncHandler(async (req, res, next) => {
  const smb2Client = require('../services/smb2ClientService');

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
});

// @desc    Test SMB2 connection
// @route   GET /api/devices/:id/smb2/test
// @access  Private
exports.smb2TestConnection = asyncHandler(async (req, res, next) => {
  const smb2Client = require('../services/smb2ClientService');

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
  const smb2Client = require('../services/smb2ClientService');

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
});

// @desc    Get SMB2 client statistics
// @route   GET /api/devices/smb2/stats
// @access  Private
exports.getSmb2Stats = asyncHandler(async (req, res, next) => {
  const smb2Client = require('../services/smb2ClientService');

  return success(res, { data: smb2Client.getStats() });
});

// Helper function to verify webhook signature
function verifyWebhookSignature(body, signature, secret) {
  if (!signature || !secret) return false;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(body));
  const expectedSignature = hmac.digest('hex');

  return signature === expectedSignature;
}
