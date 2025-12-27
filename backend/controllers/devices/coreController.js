/**
 * Device Core Controller
 *
 * Handles CRUD operations and webhook processing for devices.
 */

const {
  Device,
  DeviceIntegrationLog,
  asyncHandler,
  AdapterFactory,
  success,
  error,
  notFound,
  deviceLogger,
  verifyWebhookSignature
} = require('./shared');

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

    // 5. Process data with adapter
    let processedData;
    if (file) {
      processedData = await adapter.processImage(file.buffer, {
        patientId,
        examId,
        imageType,
        eye,
        metadata
      });
    } else if (req.body.rawData) {
      processedData = await adapter.parseMeasurement(req.body.rawData);
    } else {
      processedData = req.body;
    }

    // 6. Update device status
    await Device.findByIdAndUpdate(device._id, {
      'integration.status': 'connected',
      'integration.lastConnection': new Date(),
      'integration.lastDataReceived': new Date()
    });

    // 7. Complete log
    const duration = Date.now() - startTime;
    await DeviceIntegrationLog.findByIdAndUpdate(log._id, {
      status: 'SUCCESS',
      completedAt: new Date(),
      processingTimeMs: duration,
      dataStats: {
        recordsProcessed: 1,
        filesSynced: file ? 1 : 0
      }
    });

    return success(res, {
      data: processedData,
      message: 'Webhook processed successfully'
    });

  } catch (err) {
    // Log error
    await DeviceIntegrationLog.findByIdAndUpdate(log._id, {
      status: 'FAILED',
      completedAt: new Date(),
      processingTimeMs: Date.now() - startTime,
      errorDetails: {
        code: err.code || 'PROCESSING_ERROR',
        message: err.message,
        severity: 'HIGH'
      }
    });

    deviceLogger.error('Webhook processing failed', {
      deviceId: device.deviceId,
      error: err.message
    });

    return error(res, `Webhook processing failed: ${err.message}`, 500);
  }
});

// @desc    Get device statistics
// @route   GET /api/devices/:id/stats
// @access  Private
exports.getDeviceStats = asyncHandler(async (req, res, next) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  // Get recent logs
  const recentLogs = await DeviceIntegrationLog.find({
    device: device._id
  })
    .sort('-createdAt')
    .limit(10)
    .lean();

  // Calculate success rate
  const last30DaysLogs = await DeviceIntegrationLog.aggregate([
    {
      $match: {
        device: device._id,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const successCount = last30DaysLogs.find(l => l._id === 'SUCCESS')?.count || 0;
  const totalCount = last30DaysLogs.reduce((sum, l) => sum + l.count, 0);
  const successRate = totalCount > 0 ? (successCount / totalCount * 100).toFixed(1) : 0;

  return success(res, {
    data: {
      device: {
        id: device._id,
        name: device.name,
        type: device.type,
        status: device.integration?.status || 'unknown'
      },
      stats: {
        last30Days: {
          total: totalCount,
          success: successCount,
          successRate: parseFloat(successRate)
        }
      },
      recentLogs
    }
  });
});

// @desc    Get device logs
// @route   GET /api/devices/:id/logs
// @access  Private
exports.getDeviceLogs = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 50, status, eventType } = req.query;

  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  const query = { device: device._id };
  if (status) query.status = status;
  if (eventType) query.eventType = eventType;

  const logs = await DeviceIntegrationLog.find(query)
    .sort('-createdAt')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  const count = await DeviceIntegrationLog.countDocuments(query);

  res.status(200).json({
    success: true,
    count: logs.length,
    total: count,
    page: parseInt(page),
    pages: Math.ceil(count / limit),
    data: logs
  });
});

// @desc    Import measurements manually from device
// @route   POST /api/devices/:id/import-measurements
// @access  Private
exports.importMeasurements = asyncHandler(async (req, res, next) => {
  const { measurements, patientId, visitId } = req.body;

  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  if (!measurements || !Array.isArray(measurements) || measurements.length === 0) {
    return error(res, 'Measurements array is required', 400);
  }

  // Get the appropriate adapter for this device type
  const adapter = AdapterFactory.getAdapter(device.type);

  if (!adapter) {
    return error(res, `No adapter available for device type: ${device.type}`, 400);
  }

  // Log the import attempt
  const importLog = await DeviceIntegrationLog.create({
    device: device._id,
    eventType: 'manual_import',
    status: 'processing',
    rawData: measurements,
    metadata: {
      patientId,
      visitId,
      importedBy: req.user._id,
      measurementCount: measurements.length
    }
  });

  try {
    // Process each measurement through the adapter
    const processedMeasurements = [];
    for (const measurement of measurements) {
      const processed = adapter.processData(measurement);
      processedMeasurements.push(processed);
    }

    // Update log with success
    importLog.status = 'success';
    importLog.processedData = processedMeasurements;
    await importLog.save();

    // Update device last sync time
    device.integration.lastSyncTime = new Date();
    await device.save();

    return success(res, {
      imported: processedMeasurements.length,
      logId: importLog._id,
      measurements: processedMeasurements
    }, 'Measurements imported successfully');
  } catch (importError) {
    // Update log with failure
    importLog.status = 'error';
    importLog.errorMessage = importError.message;
    await importLog.save();

    return error(res, `Import failed: ${importError.message}`, 500);
  }
});
