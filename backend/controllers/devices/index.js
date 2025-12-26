/**
 * Device Controllers Index
 *
 * Re-exports all device controller functions for backward compatibility.
 * The original deviceController.js (2,327 lines) has been split into:
 *
 * - coreController.js: CRUD operations, webhook, stats, logs
 * - folderController.js: Folder sync, mount/unmount, file browse, legacy mapping
 * - discoveryController.js: Network discovery, file processing, folder indexing
 * - syncController.js: Auto-sync, sync queue, streaming SMB, SMB2 direct
 */

const coreController = require('./coreController');
const folderController = require('./folderController');
const discoveryController = require('./discoveryController');
const syncController = require('./syncController');

// Re-export all functions maintaining backward compatibility
module.exports = {
  // =====================================================
  // Core Controller Functions
  // =====================================================
  // CRUD Operations
  getDevices: coreController.getDevices,
  getDeviceById: coreController.getDeviceById,
  createDevice: coreController.createDevice,
  updateDevice: coreController.updateDevice,
  deleteDevice: coreController.deleteDevice,

  // Webhook
  handleWebhook: coreController.handleWebhook,

  // Stats & Logs
  getDeviceStats: coreController.getDeviceStats,
  getDeviceLogs: coreController.getDeviceLogs,

  // =====================================================
  // Folder Controller Functions
  // =====================================================
  // Folder Sync
  syncDeviceFolder: folderController.syncDeviceFolder,
  startFolderWatcher: folderController.startFolderWatcher,
  stopFolderWatcher: folderController.stopFolderWatcher,
  getFolderSyncStats: folderController.getFolderSyncStats,
  triggerFullSync: folderController.triggerFullSync,

  // Mount Operations
  mountShare: folderController.mountShare,
  unmountShare: folderController.unmountShare,
  getMountStatus: folderController.getMountStatus,
  mountAllShares: folderController.mountAllShares,

  // File Operations
  browseDeviceFiles: folderController.browseDeviceFiles,
  getDeviceFile: folderController.getDeviceFile,

  // Legacy Mapping
  findPatientByLegacyId: folderController.findPatientByLegacyId,
  createLegacyMapping: folderController.createLegacyMapping,
  bulkImportLegacyMappings: folderController.bulkImportLegacyMappings,
  scanArchiveFolder: folderController.scanArchiveFolder,
  getPatientArchiveFiles: folderController.getPatientArchiveFiles,

  // =====================================================
  // Discovery Controller Functions
  // =====================================================
  // Network Discovery
  discoverNetwork: discoveryController.discoverNetwork,
  getNetworkInfo: discoveryController.getNetworkInfo,
  getDiscoveryStatus: discoveryController.getDiscoveryStatus,
  quickScanDevices: discoveryController.quickScanDevices,
  createDevicesFromDiscovery: discoveryController.createDevicesFromDiscovery,
  probeShareStructure: discoveryController.probeShareStructure,

  // File Processing
  processFileUniversal: discoveryController.processFileUniversal,
  processBatchUniversal: discoveryController.processBatchUniversal,
  getProcessorStats: discoveryController.getProcessorStats,
  getOCRStatus: discoveryController.getOCRStatus,

  // Patient Folder Indexing
  indexAllFolders: discoveryController.indexAllFolders,
  indexDeviceFolders: discoveryController.indexDeviceFolders,
  getFolderIndexStats: discoveryController.getFolderIndexStats,
  getUnmatchedFolders: discoveryController.getUnmatchedFolders,
  manualLinkFolder: discoveryController.manualLinkFolder,

  // =====================================================
  // Sync Controller Functions
  // =====================================================
  // Streaming SMB
  streamBrowseFiles: syncController.streamBrowseFiles,
  streamGetFile: syncController.streamGetFile,
  streamCheckAccess: syncController.streamCheckAccess,
  streamCheckAllDevices: syncController.streamCheckAllDevices,
  streamClearCache: syncController.streamClearCache,

  // Auto-Sync
  getAutoSyncStatus: syncController.getAutoSyncStatus,
  startAutoSync: syncController.startAutoSync,
  stopAutoSync: syncController.stopAutoSync,
  triggerSyncAll: syncController.triggerSyncAll,
  triggerDeviceSync: syncController.triggerDeviceSync,
  updateAutoSyncConfig: syncController.updateAutoSyncConfig,

  // Sync Queue
  getSyncQueueStatus: syncController.getSyncQueueStatus,
  addSyncJob: syncController.addSyncJob,
  getSyncJob: syncController.getSyncJob,
  retryFailedJobs: syncController.retryFailedJobs,
  clearFailedJobs: syncController.clearFailedJobs,

  // SMB2 Direct
  smb2BrowseFiles: syncController.smb2BrowseFiles,
  smb2ReadFile: syncController.smb2ReadFile,
  smb2TestConnection: syncController.smb2TestConnection,
  smb2ScanDevice: syncController.smb2ScanDevice,
  getSmb2Stats: syncController.getSmb2Stats
};
