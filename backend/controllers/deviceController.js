const Device = require('../models/Device');
const DeviceMeasurement = require('../models/DeviceMeasurement');
const DeviceImage = require('../models/DeviceImage');
const DeviceIntegrationLog = require('../models/DeviceIntegrationLog');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const Patient = require('../models/Patient');
const Alert = require('../models/Alert');
const { asyncHandler } = require('../middleware/errorHandler');
const AdapterFactory = require('../services/adapters/AdapterFactory');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

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
    return res.status(404).json({
      success: false,
      error: 'Device not found'
    });
  }

  res.status(200).json({
    success: true,
    data: device
  });
});

// @desc    Create new device
// @route   POST /api/devices
// @access  Private (admin only)
exports.createDevice = asyncHandler(async (req, res, next) => {
  const device = await Device.create({
    ...req.body,
    createdBy: req.user.id
  });

  res.status(201).json({
    success: true,
    data: device
  });
});

// @desc    Update device
// @route   PUT /api/devices/:id
// @access  Private (admin only)
exports.updateDevice = asyncHandler(async (req, res, next) => {
  let device = await Device.findById(req.params.id);

  if (!device) {
    return res.status(404).json({
      success: false,
      error: 'Device not found'
    });
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

  res.status(200).json({
    success: true,
    data: device
  });
});

// @desc    Delete device (soft delete)
// @route   DELETE /api/devices/:id
// @access  Private (admin only)
exports.deleteDevice = asyncHandler(async (req, res, next) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return res.status(404).json({
      success: false,
      error: 'Device not found'
    });
  }

  device.active = false;
  device.updatedBy = req.user.id;
  await device.save();

  res.status(200).json({
    success: true,
    message: 'Device deleted successfully'
  });
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
    return res.status(404).json({
      success: false,
      error: 'Device not found'
    });
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

    return res.status(401).json({
      success: false,
      error: 'Invalid webhook signature'
    });
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

      return res.status(400).json(result);
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

    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      data: result.data
    });

  } catch (error) {
    log.status = 'FAILED';
    log.errorDetails = {
      code: 'WEBHOOK_PROCESSING_ERROR',
      message: error.message,
      stack: error.stack,
      severity: 'HIGH'
    };
    log.completedAt = new Date();
    await log.save();

    throw error;
  }
});

// @desc    Sync device folder (scheduled or manual)
// @route   POST /api/devices/:id/sync-folder
// @access  Private
exports.syncDeviceFolder = asyncHandler(async (req, res, next) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return res.status(404).json({
      success: false,
      error: 'Device not found'
    });
  }

  if (!device.integration.folderSync.enabled) {
    return res.status(400).json({
      success: false,
      error: 'Folder sync not enabled for this device'
    });
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

      } catch (error) {
        recordsFailed++;
        errors.push({ file, error: error.message });

        // Move to error folder
        try {
          await fs.rename(filePath, path.join(errorFolder, file));
        } catch (moveError) {
          console.error('Failed to move error file:', moveError);
        }

        log.folderSync.filesProcessed.push({
          fileName: file,
          processedAt: new Date(),
          status: 'FAILED',
          error: error.message
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

    res.status(200).json({
      success: true,
      recordsProcessed,
      recordsFailed,
      errors,
      message: `Synchronisation terminée: ${recordsProcessed} traités, ${recordsFailed} échoués`
    });

  } catch (error) {
    log.status = 'FAILED';
    log.errorDetails = {
      code: 'FOLDER_SYNC_ERROR',
      message: error.message,
      stack: error.stack,
      severity: 'HIGH'
    };
    log.completedAt = new Date();
    await log.save();

    throw error;
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
    return res.status(404).json({
      success: false,
      error: 'Device not found'
    });
  }

  if (!Array.isArray(measurements) || measurements.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No measurements provided'
    });
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
      } catch (error) {
        errors.push({
          measurement,
          error: error.message
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

    res.status(200).json({
      success: true,
      imported: savedMeasurements.length,
      failed: errors.length,
      measurementIds: savedMeasurements,
      errors
    });

  } catch (error) {
    log.status = 'FAILED';
    log.errorDetails = {
      code: 'IMPORT_ERROR',
      message: error.message,
      severity: 'HIGH'
    };
    log.completedAt = new Date();
    await log.save();

    throw error;
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
    return res.status(404).json({
      success: false,
      error: 'Device not found'
    });
  }

  // Get event statistics
  const eventStats = await DeviceIntegrationLog.getEventStats(deviceId, days);

  // Get error summary
  const errorSummary = await DeviceIntegrationLog.getErrorSummary(deviceId, days);

  // Get total measurements
  const totalMeasurements = await DeviceMeasurement.countDocuments({ device: deviceId });

  // Get total images
  const totalImages = await DeviceImage.countDocuments({ device: deviceId });

  res.status(200).json({
    success: true,
    data: {
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

// Helper function to verify webhook signature
function verifyWebhookSignature(body, signature, secret) {
  if (!signature || !secret) return false;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(body));
  const expectedSignature = hmac.digest('hex');

  return signature === expectedSignature;
}
