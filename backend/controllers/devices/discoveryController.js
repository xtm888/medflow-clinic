/**
 * Device Discovery Controller
 *
 * Handles network discovery, file processing, and patient folder indexing.
 */

const {
  Device,
  asyncHandler,
  path,
  success,
  error,
  notFound,
  DEVICE
} = require('./shared');

// =====================================================
// NETWORK DISCOVERY METHODS
// =====================================================

// @desc    Discover SMB shares on network
// @route   POST /api/devices/discover-network
// @access  Private (admin)
exports.discoverNetwork = asyncHandler(async (req, res, next) => {
  const networkDiscoveryService = require('../../services/networkDiscoveryService');

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
  const networkDiscoveryService = require('../../services/networkDiscoveryService');

  const result = networkDiscoveryService.getLastDiscoveryResults();

  return success(res, { data: result });
});

// @desc    Quick scan known devices
// @route   POST /api/devices/discovery/quick-scan
// @access  Private (admin)
exports.quickScanDevices = asyncHandler(async (req, res, next) => {
  const networkDiscoveryService = require('../../services/networkDiscoveryService');

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
  const networkDiscoveryService = require('../../services/networkDiscoveryService');

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
  const networkDiscoveryService = require('../../services/networkDiscoveryService');

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
  const { universalFileProcessor } = require('../../services/universalFileProcessor');

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
  const { universalFileProcessor } = require('../../services/universalFileProcessor');

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
  const { universalFileProcessor } = require('../../services/universalFileProcessor');

  const stats = universalFileProcessor.getStats();

  return success(res, { data: stats });
});

// @desc    Check OCR service status
// @route   GET /api/devices/ocr/status
// @access  Private
exports.getOCRStatus = asyncHandler(async (req, res, next) => {
  const { universalFileProcessor } = require('../../services/universalFileProcessor');

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
  const patientFolderIndexer = require('../../services/patientFolderIndexer');

  const { maxDepth = 10 } = req.body;

  const result = await patientFolderIndexer.indexAllDevices({ maxDepth });

  return success(res, { data: result });
});

// @desc    Index a single device's folders
// @route   POST /api/devices/:id/index-folders
// @access  Private (admin)
exports.indexDeviceFolders = asyncHandler(async (req, res, next) => {
  const patientFolderIndexer = require('../../services/patientFolderIndexer');

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
  const patientFolderIndexer = require('../../services/patientFolderIndexer');

  const stats = patientFolderIndexer.getStats();

  return success(res, { data: stats });
});

// @desc    Get unmatched folders for manual review
// @route   GET /api/devices/index-folders/unmatched
// @access  Private
exports.getUnmatchedFolders = asyncHandler(async (req, res, next) => {
  const patientFolderIndexer = require('../../services/patientFolderIndexer');

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
  const patientFolderIndexer = require('../../services/patientFolderIndexer');

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
