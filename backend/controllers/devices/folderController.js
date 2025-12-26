/**
 * Device Folder Controller
 *
 * Handles folder sync, mounting, file browsing, and legacy mapping operations.
 */

const {
  Device,
  DeviceIntegrationLog,
  Patient,
  AuditLog,
  asyncHandler,
  fs,
  path,
  success,
  error,
  notFound,
  deviceLogger,
  DEVICE,
  isMounted,
  mountSmbShare,
  unmountPath,
  validateMountPath,
  validateHost,
  sanitizeForFilesystem
} = require('./shared');

// @desc    Sync device folder
// @route   POST /api/devices/:id/sync
// @access  Private
exports.syncDeviceFolder = asyncHandler(async (req, res, next) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  if (device.integration?.method !== 'folder_sync') {
    return error(res, 'Device is not configured for folder sync', 400);
  }

  const folderPath = device.integration.folderSync?.sharedFolderPath;

  if (!folderPath) {
    return error(res, 'No shared folder path configured', 400);
  }

  try {
    // Check if folder exists
    await fs.access(folderPath);

    // Update last sync time
    await Device.findByIdAndUpdate(device._id, {
      'integration.status': 'connected',
      'integration.lastConnection': new Date()
    });

    return success(res, {
      data: {
        synced: true,
        path: folderPath
      },
      message: 'Folder sync completed'
    });

  } catch (err) {
    await Device.findByIdAndUpdate(device._id, {
      'integration.status': 'disconnected'
    });

    return error(res, `Folder sync failed: ${err.message}`, 500);
  }
});

// @desc    Start folder watcher
// @route   POST /api/devices/:id/watcher/start
// @access  Private (admin)
exports.startFolderWatcher = asyncHandler(async (req, res, next) => {
  const folderWatcherService = require('../../services/folderWatcherService');

  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  if (device.integration?.method !== 'folder_sync') {
    return error(res, 'Device is not configured for folder sync', 400);
  }

  await folderWatcherService.startWatching(device);

  return success(res, {
    data: { watching: true },
    message: 'Folder watcher started'
  });
});

// @desc    Stop folder watcher
// @route   POST /api/devices/:id/watcher/stop
// @access  Private (admin)
exports.stopFolderWatcher = asyncHandler(async (req, res, next) => {
  const folderWatcherService = require('../../services/folderWatcherService');

  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  await folderWatcherService.stopWatching(device._id);

  return success(res, {
    data: { watching: false },
    message: 'Folder watcher stopped'
  });
});

// @desc    Get folder sync stats
// @route   GET /api/devices/:id/sync/stats
// @access  Private
exports.getFolderSyncStats = asyncHandler(async (req, res, next) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  const folderPath = device.integration?.folderSync?.sharedFolderPath;

  if (!folderPath) {
    return success(res, {
      data: {
        configured: false,
        message: 'No folder path configured'
      }
    });
  }

  try {
    const files = await fs.readdir(folderPath);
    const stats = await fs.stat(folderPath);

    // Get file type counts
    const typeCounts = {};
    for (const file of files) {
      const ext = path.extname(file).toLowerCase() || 'no-extension';
      typeCounts[ext] = (typeCounts[ext] || 0) + 1;
    }

    return success(res, {
      data: {
        configured: true,
        path: folderPath,
        accessible: true,
        fileCount: files.length,
        typeCounts,
        lastModified: stats.mtime
      }
    });

  } catch (err) {
    return success(res, {
      data: {
        configured: true,
        path: folderPath,
        accessible: false,
        error: err.message
      }
    });
  }
});

// @desc    Trigger full folder sync
// @route   POST /api/devices/:id/sync/full
// @access  Private (admin)
exports.triggerFullSync = asyncHandler(async (req, res, next) => {
  const folderWatcherService = require('../../services/folderWatcherService');

  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  const result = await folderWatcherService.triggerFullSync(device);

  return success(res, {
    data: result,
    message: 'Full sync triggered'
  });
});

// @desc    Mount SMB share
// @route   POST /api/devices/:id/mount
// @access  Private (admin)
exports.mountShare = asyncHandler(async (req, res, next) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  // Get share details from device config
  const shareHost = device.connection?.ipAddress || device.connection?.hostname;
  const shareName = device.connection?.settings?.shareName;
  const username = device.connection?.credentials?.username || 'guest';
  const password = device.connection?.credentials?.password || '';

  if (!shareHost || !shareName) {
    return error(res, 'Device share configuration incomplete', 400);
  }

  // Validate host
  if (!validateHost(shareHost)) {
    return error(res, 'Invalid host configuration', 400);
  }

  // Create mount point
  const safeDeviceName = sanitizeForFilesystem(device.deviceId);
  const mountPoint = `/tmp/${safeDeviceName}_mount`;

  // Validate mount path
  if (!validateMountPath(mountPoint)) {
    return error(res, 'Invalid mount path', 400);
  }

  try {
    // Check if already mounted
    if (await isMounted(mountPoint)) {
      return success(res, {
        data: {
          mounted: true,
          mountPoint,
          alreadyMounted: true
        },
        message: 'Share already mounted'
      });
    }

    // Create mount point directory
    await fs.mkdir(mountPoint, { recursive: true });

    // Mount the share
    const sharePath = `//${shareHost}/${shareName}`;
    await mountSmbShare(sharePath, mountPoint, { username, password });

    // Update device with mount info
    await Device.findByIdAndUpdate(device._id, {
      'integration.folderSync.sharedFolderPath': mountPoint,
      'integration.folderSync.isMounted': true,
      'integration.folderSync.mountedAt': new Date(),
      'integration.status': 'connected',
      'integration.lastConnection': new Date()
    });

    deviceLogger.info('SMB share mounted', {
      deviceId: device.deviceId,
      mountPoint,
      host: shareHost
    });

    return success(res, {
      data: {
        mounted: true,
        mountPoint
      },
      message: 'Share mounted successfully'
    });

  } catch (err) {
    deviceLogger.error('Mount failed', {
      deviceId: device.deviceId,
      error: err.message
    });

    return error(res, `Failed to mount share: ${err.message}`, 500);
  }
});

// @desc    Unmount SMB share
// @route   POST /api/devices/:id/unmount
// @access  Private (admin)
exports.unmountShare = asyncHandler(async (req, res, next) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  const mountPoint = device.integration?.folderSync?.sharedFolderPath;

  if (!mountPoint) {
    return error(res, 'No mount point configured', 400);
  }

  try {
    // Check if mounted
    if (!(await isMounted(mountPoint))) {
      await Device.findByIdAndUpdate(device._id, {
        'integration.folderSync.isMounted': false
      });

      return success(res, {
        data: { unmounted: true, wasNotMounted: true },
        message: 'Share was not mounted'
      });
    }

    // Unmount
    await unmountPath(mountPoint);

    // Update device
    await Device.findByIdAndUpdate(device._id, {
      'integration.folderSync.isMounted': false,
      'integration.status': 'disconnected'
    });

    deviceLogger.info('SMB share unmounted', {
      deviceId: device.deviceId,
      mountPoint
    });

    return success(res, {
      data: { unmounted: true },
      message: 'Share unmounted successfully'
    });

  } catch (err) {
    deviceLogger.error('Unmount failed', {
      deviceId: device.deviceId,
      error: err.message
    });

    return error(res, `Failed to unmount share: ${err.message}`, 500);
  }
});

// @desc    Get mount status
// @route   GET /api/devices/:id/mount/status
// @access  Private
exports.getMountStatus = asyncHandler(async (req, res, next) => {
  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  const mountPoint = device.integration?.folderSync?.sharedFolderPath;

  if (!mountPoint) {
    return success(res, {
      data: {
        configured: false,
        mounted: false
      }
    });
  }

  const mounted = await isMounted(mountPoint);

  return success(res, {
    data: {
      configured: true,
      mountPoint,
      mounted,
      mountedAt: device.integration?.folderSync?.mountedAt
    }
  });
});

// @desc    Mount all configured shares
// @route   POST /api/devices/mount-all
// @access  Private (admin)
exports.mountAllShares = asyncHandler(async (req, res, next) => {
  const devices = await Device.find({
    active: true,
    'connection.settings.shareProtocol': 'smb'
  });

  const results = [];

  for (const device of devices) {
    const shareHost = device.connection?.ipAddress || device.connection?.hostname;
    const shareName = device.connection?.settings?.shareName;

    if (!shareHost || !shareName) {
      results.push({
        deviceId: device.deviceId,
        success: false,
        error: 'Configuration incomplete'
      });
      continue;
    }

    try {
      const safeDeviceName = sanitizeForFilesystem(device.deviceId);
      const mountPoint = `/tmp/${safeDeviceName}_mount`;

      if (await isMounted(mountPoint)) {
        results.push({
          deviceId: device.deviceId,
          success: true,
          alreadyMounted: true,
          mountPoint
        });
        continue;
      }

      await fs.mkdir(mountPoint, { recursive: true });

      const username = device.connection?.credentials?.username || 'guest';
      const password = device.connection?.credentials?.password || '';
      const sharePath = `//${shareHost}/${shareName}`;

      await mountSmbShare(sharePath, mountPoint, { username, password });

      await Device.findByIdAndUpdate(device._id, {
        'integration.folderSync.sharedFolderPath': mountPoint,
        'integration.folderSync.isMounted': true,
        'integration.folderSync.mountedAt': new Date(),
        'integration.status': 'connected'
      });

      results.push({
        deviceId: device.deviceId,
        success: true,
        mountPoint
      });

    } catch (err) {
      results.push({
        deviceId: device.deviceId,
        success: false,
        error: err.message
      });
    }
  }

  const successCount = results.filter(r => r.success).length;

  return success(res, {
    data: {
      summary: {
        total: results.length,
        success: successCount,
        failed: results.length - successCount
      },
      results
    }
  });
});

// @desc    Browse device files
// @route   GET /api/devices/:id/files
// @access  Private
exports.browseDeviceFiles = asyncHandler(async (req, res, next) => {
  const { subpath = '', page = 1, limit = 100 } = req.query;

  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  const basePath = device.integration?.folderSync?.sharedFolderPath;

  if (!basePath) {
    return error(res, 'Device share not mounted', 400);
  }

  // Sanitize subpath to prevent directory traversal
  const sanitizedSubpath = subpath.replace(/\.\./g, '').replace(/^\/+/, '');
  const fullPath = path.join(basePath, sanitizedSubpath);

  // Verify path is still under basePath
  if (!fullPath.startsWith(basePath)) {
    return error(res, 'Invalid path', 400);
  }

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    const items = await Promise.all(
      entries.map(async (entry) => {
        try {
          const itemPath = path.join(fullPath, entry.name);
          const stats = await fs.stat(itemPath);

          return {
            name: entry.name,
            path: path.join(sanitizedSubpath, entry.name),
            type: entry.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime,
            extension: entry.isFile() ? path.extname(entry.name).toLowerCase() : null
          };
        } catch (e) {
          return {
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file',
            error: 'Unable to read stats'
          };
        }
      })
    );

    // Sort: directories first, then files by name
    items.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });

    // Paginate
    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + parseInt(limit));

    return success(res, {
      data: {
        path: sanitizedSubpath || '/',
        parentPath: sanitizedSubpath ? path.dirname(sanitizedSubpath) : null,
        items: paginatedItems,
        total: items.length,
        page: parseInt(page),
        pages: Math.ceil(items.length / limit)
      }
    });

  } catch (err) {
    if (err.code === 'ENOENT') {
      return notFound(res, 'Directory');
    }
    throw err;
  }
});

// @desc    Get device file
// @route   GET /api/devices/:id/files/*
// @access  Private
exports.getDeviceFile = asyncHandler(async (req, res, next) => {
  const filepath = req.params[0] || '';

  const device = await Device.findById(req.params.id);

  if (!device) {
    return notFound(res, 'Device');
  }

  const basePath = device.integration?.folderSync?.sharedFolderPath;

  if (!basePath) {
    return error(res, 'Device share not mounted', 400);
  }

  // Sanitize path
  const sanitizedPath = filepath.replace(/\.\./g, '').replace(/^\/+/, '');
  const fullPath = path.join(basePath, sanitizedPath);

  // Verify path is under basePath
  if (!fullPath.startsWith(basePath)) {
    return error(res, 'Invalid path', 400);
  }

  try {
    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      return error(res, 'Cannot download a directory', 400);
    }

    // Get content type
    const ext = path.extname(fullPath).toLowerCase();
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
  const legacyMapper = require('../../services/legacyPatientMapper');

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
  const legacyMapper = require('../../services/legacyPatientMapper');

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
  const legacyMapper = require('../../services/legacyPatientMapper');

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
  const legacyMapper = require('../../services/legacyPatientMapper');

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
  const legacyMapper = require('../../services/legacyPatientMapper');

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
