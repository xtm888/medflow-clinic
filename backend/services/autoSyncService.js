/**
 * Auto Sync Service
 *
 * Main orchestrator for automatic device synchronization:
 * - Scheduled polling of SMB shares
 * - Event-driven file processing via webhooks
 * - WebSocket notifications for real-time updates
 * - Integration with DeviceSyncQueue for background jobs
 */

const EventEmitter = require('events');
const cron = require('node-cron');
const chokidar = require('chokidar');
const path = require('path');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('AutoSync');

class AutoSyncService extends EventEmitter {
  constructor() {
    super();
    this.smb2Client = null;
    this.syncQueue = null;
    this.websocket = null;

    this.watchers = new Map();        // File watchers for mounted paths
    this.pollJobs = new Map();        // Polling jobs for SMB shares
    this.deviceStatus = new Map();    // Track device sync status

    this.config = {
      pollIntervalMinutes: 5,         // Default polling interval
      enableAutoSync: true,
      maxConcurrentSyncs: 3,
      syncOnStartup: true,
      watchMountedPaths: true
    };

    this.stats = {
      startedAt: null,
      lastFullSync: null,
      syncCount: 0,
      filesProcessed: 0,
      errors: []
    };

    // CRITICAL: Setup error handler to prevent process crash
    this._setupErrorHandling();
  }

  /**
   * Setup error handling for EventEmitter
   * Prevents unhandled 'error' events from crashing the process
   */
  _setupErrorHandling() {
    this.on('error', (error) => {
      log.error('AutoSyncService error:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      this.stats.errors.push({
        error: error.message,
        timestamp: new Date()
      });
      // Keep only last 100 errors
      if (this.stats.errors.length > 100) {
        this.stats.errors = this.stats.errors.slice(-100);
      }
    });
  }

  /**
   * Initialize the auto sync service
   */
  async init(options = {}) {
    Object.assign(this.config, options);

    // Initialize dependencies
    this.smb2Client = require('./smb2ClientService');
    this.syncQueue = require('./deviceSyncQueue');

    await this.smb2Client.init();
    await this.syncQueue.init();

    // Start queue processing
    await this.syncQueue.startProcessing();

    // Subscribe to queue events
    this.setupQueueEvents();

    this.stats.startedAt = new Date();
    log.info('Auto Sync Service initialized');

    // Initial sync on startup
    if (this.config.syncOnStartup) {
      setTimeout(() => this.syncAllDevices(), 5000);
    }

    return this;
  }

  /**
   * Set WebSocket service reference for real-time updates
   */
  setWebSocket(ws) {
    this.websocket = ws;
  }

  /**
   * Setup event handlers for queue events
   */
  setupQueueEvents() {
    this.syncQueue.on('jobCompleted', (data) => {
      this.stats.filesProcessed++;
      this.broadcastUpdate('job_completed', data);
    });

    this.syncQueue.on('jobFailed', (data) => {
      this.stats.errors.push({
        ...data,
        timestamp: new Date()
      });
      // Keep only last 100 errors
      if (this.stats.errors.length > 100) {
        this.stats.errors = this.stats.errors.slice(-100);
      }
      this.broadcastUpdate('job_failed', data);
    });

    this.syncQueue.on('fileProcessed', (data) => {
      this.broadcastUpdate('file_processed', data);
    });

    this.syncQueue.on('patientMatched', (data) => {
      this.broadcastUpdate('patient_matched', data);
    });
  }

  /**
   * Broadcast update via WebSocket
   */
  broadcastUpdate(type, data) {
    if (this.websocket) {
      this.websocket.broadcast('device_sync', {
        type,
        data,
        timestamp: new Date().toISOString()
      });
    }
    this.emit(type, data);
  }

  /**
   * Start scheduled polling for all devices
   */
  startScheduledPolling() {
    const Device = require('../models/Device');

    // Main polling job - runs every N minutes
    const cronExpression = `*/${this.config.pollIntervalMinutes} * * * *`;

    this.mainPollJob = cron.schedule(cronExpression, async () => {
      log.info(`Running scheduled poll at ${new Date().toISOString()}`);
      await this.syncAllDevices();
    });

    log.info(`Auto sync polling started (every ${this.config.pollIntervalMinutes} minutes)`);
  }

  /**
   * Stop scheduled polling
   */
  stopScheduledPolling() {
    if (this.mainPollJob) {
      this.mainPollJob.stop();
      this.mainPollJob = null;
    }

    for (const [deviceId, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();

    log.info('Auto sync polling stopped');
  }

  /**
   * Sync all active devices
   */
  async syncAllDevices() {
    const Device = require('../models/Device');

    try {
      const devices = await Device.find({
        active: true,
        'connection.settings.shareProtocol': 'smb'
      });

      log.info(`Syncing ${devices.length} devices...`);

      const results = [];
      for (const device of devices) {
        try {
          const result = await this.syncDevice(device);
          results.push({ device: device.name, ...result });
        } catch (error) {
          results.push({
            device: device.name,
            success: false,
            error: error.message
          });
        }
      }

      this.stats.lastFullSync = new Date();
      this.stats.syncCount++;

      this.broadcastUpdate('sync_complete', {
        deviceCount: devices.length,
        results
      });

      return results;
    } catch (error) {
      log.error('[AutoSync] Error syncing devices:', { error: error });
      return { error: error.message };
    }
  }

  /**
   * Sync a single device
   */
  async syncDevice(device) {
    const deviceId = device._id.toString();

    // Check if already syncing
    const status = this.deviceStatus.get(deviceId);
    if (status?.syncing) {
      return { skipped: true, reason: 'Already syncing' };
    }

    this.deviceStatus.set(deviceId, {
      syncing: true,
      startedAt: new Date()
    });

    this.broadcastUpdate('device_sync_started', {
      deviceId,
      deviceName: device.name
    });

    try {
      // Test connection
      const connectionTest = await this.smb2Client.testConnection(device);
      if (!connectionTest.accessible) {
        throw new Error(`Device not accessible: ${connectionTest.error}`);
      }

      // Get last sync time
      const lastSync = device.integration?.lastSync;

      // Find new files since last sync
      let scanResult;
      if (lastSync) {
        scanResult = await this.smb2Client.findNewFiles(device, '', new Date(lastSync));
      } else {
        scanResult = await this.smb2Client.scanDirectoryRecursive(device, '', {
          maxDepth: 5,
          maxFiles: 1000
        });
      }

      // Queue files for processing
      const jobs = [];
      for (const file of scanResult.files) {
        const job = await this.syncQueue.addJob('file_process', {
          deviceId,
          filePath: file.path
        }, { priority: 5 });
        jobs.push(job);
      }

      // Queue folder indexing
      if (scanResult.directories.length > 0) {
        await this.syncQueue.addJob('folder_index', {
          deviceId,
          basePath: ''
        }, { priority: 7 });
      }

      // Update device last sync time
      const Device = require('../models/Device');
      await Device.findByIdAndUpdate(deviceId, {
        'integration.lastSync': new Date(),
        'integration.status': 'connected',
        'integration.lastConnection': new Date()
      });

      const result = {
        success: true,
        filesFound: scanResult.files.length,
        foldersFound: scanResult.directories.length,
        jobsQueued: jobs.length
      };

      this.deviceStatus.set(deviceId, {
        syncing: false,
        lastSync: new Date(),
        result
      });

      this.broadcastUpdate('device_sync_completed', {
        deviceId,
        deviceName: device.name,
        ...result
      });

      return result;

    } catch (error) {
      this.deviceStatus.set(deviceId, {
        syncing: false,
        lastError: error.message,
        lastErrorAt: new Date()
      });

      this.broadcastUpdate('device_sync_error', {
        deviceId,
        deviceName: device.name,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Watch a mounted path for changes (for local mounts)
   */
  watchMountedPath(mountPath, device) {
    const deviceId = device._id?.toString() || device.deviceId;

    // Close existing watcher if any
    if (this.watchers.has(deviceId)) {
      this.watchers.get(deviceId).close();
    }

    const watcher = chokidar.watch(mountPath, {
      ignored: /(^|[\/\\])\../,  // Ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    watcher
      .on('add', (filePath) => {
        log.info(`File added: ${filePath}`);
        this.handleFileChange('add', filePath, device);
      })
      .on('change', (filePath) => {
        log.info(`File changed: ${filePath}`);
        this.handleFileChange('change', filePath, device);
      })
      .on('unlink', (filePath) => {
        log.info(`File removed: ${filePath}`);
        this.handleFileChange('unlink', filePath, device);
      })
      .on('addDir', (dirPath) => {
        log.info(`Directory added: ${dirPath}`);
        this.handleFolderChange('add', dirPath, device);
      })
      .on('error', (error) => {
        log.error(`[Watcher] Error for ${deviceId}:`, { error: error });
      });

    this.watchers.set(deviceId, watcher);

    log.info(`Started watching: ${mountPath} for device ${device.name}`);
    return watcher;
  }

  /**
   * Stop watching a device
   */
  stopWatching(device) {
    const deviceId = device._id?.toString() || device.deviceId;
    const watcher = this.watchers.get(deviceId);

    if (watcher) {
      watcher.close();
      this.watchers.delete(deviceId);
      log.info(`Stopped watching device ${device.name}`);
    }
  }

  /**
   * Handle file change from watcher
   */
  async handleFileChange(eventType, filePath, device) {
    const deviceId = device._id?.toString() || device.deviceId;

    if (eventType === 'unlink') {
      this.broadcastUpdate('file_removed', { deviceId, filePath });
      return;
    }

    // Determine file type and priority
    const ext = path.extname(filePath).toLowerCase();
    const isHighPriority = ['.xml', '.dcm', '.dicom'].includes(ext);

    // Queue for processing
    await this.syncQueue.addJob('file_process', {
      deviceId,
      filePath,
      eventType
    }, {
      priority: isHighPriority ? 2 : 5
    });

    this.broadcastUpdate('file_detected', {
      deviceId,
      filePath,
      eventType,
      extension: ext
    });
  }

  /**
   * Handle folder change from watcher
   */
  async handleFolderChange(eventType, dirPath, device) {
    const deviceId = device._id?.toString() || device.deviceId;

    if (eventType === 'add') {
      // New folder - try to match to patient
      const folderName = path.basename(dirPath);

      await this.syncQueue.addJob('patient_match', {
        deviceId,
        folderName,
        folderPath: dirPath,
        deviceType: device.type
      }, { priority: 3 });

      this.broadcastUpdate('folder_detected', {
        deviceId,
        folderName,
        folderPath: dirPath
      });
    }
  }

  /**
   * Handle webhook from device (push notification)
   */
  async handleWebhook(deviceId, payload) {
    const Device = require('../models/Device');
    const device = await Device.findById(deviceId);

    if (!device) {
      throw new Error('Device not found');
    }

    const { eventType, filePath, patientId, metadata } = payload;

    log.info(`Received from ${device.name}: ${eventType}`);

    switch (eventType) {
      case 'file_created':
      case 'file_modified':
        await this.syncQueue.addJob('file_process', {
          deviceId,
          filePath,
          patientId,
          metadata
        }, { priority: 1 });  // Highest priority for push events
        break;

      case 'exam_complete':
        // Trigger immediate sync for the patient folder
        await this.syncQueue.addJob('batch_import', {
          deviceId,
          files: payload.files || [],
          patientId,
          examType: metadata?.examType
        }, { priority: 1 });
        break;

      case 'folder_created':
        await this.syncQueue.addJob('patient_match', {
          deviceId,
          folderName: path.basename(filePath),
          folderPath: filePath,
          deviceType: device.type
        }, { priority: 2 });
        break;

      default:
        log.warn(`Unknown webhook event: ${eventType}`);
    }

    // Update device last activity
    await Device.findByIdAndUpdate(deviceId, {
      'integration.lastWebhook': new Date()
    });

    this.broadcastUpdate('webhook_received', {
      deviceId,
      deviceName: device.name,
      eventType
    });

    return { processed: true, eventType };
  }

  /**
   * Manual trigger to sync a specific device
   */
  async triggerSync(deviceId) {
    const Device = require('../models/Device');
    const device = await Device.findById(deviceId);

    if (!device) {
      throw new Error('Device not found');
    }

    return this.syncDevice(device);
  }

  /**
   * Get sync status for all devices
   */
  async getStatus() {
    const Device = require('../models/Device');

    // Check if services are initialized
    const isInitialized = this.syncQueue !== null && this.smb2Client !== null;

    let queueStats = { pending: 0, processed: 0, failed: 0, message: 'Service not started' };
    let smb2Stats = { activeConnections: 0, cachedFiles: 0, message: 'Service not started' };

    if (isInitialized) {
      try {
        queueStats = await this.syncQueue.getStats();
      } catch (e) {
        queueStats = { error: e.message };
      }
      try {
        smb2Stats = this.smb2Client.getStats();
      } catch (e) {
        smb2Stats = { error: e.message };
      }
    }

    const devices = await Device.find({ active: true });
    const deviceStatuses = [];

    for (const device of devices) {
      const deviceId = device._id.toString();
      const status = this.deviceStatus.get(deviceId) || {};

      deviceStatuses.push({
        deviceId,
        name: device.name,
        type: device.type,
        syncing: status.syncing || false,
        lastSync: status.lastSync || device.integration?.lastSync,
        lastError: status.lastError,
        isWatched: this.watchers.has(deviceId)
      });
    }

    return {
      initialized: isInitialized,
      service: {
        startedAt: this.stats.startedAt,
        syncCount: this.stats.syncCount,
        lastFullSync: this.stats.lastFullSync,
        filesProcessed: this.stats.filesProcessed,
        recentErrors: this.stats.errors.slice(-10)
      },
      queue: queueStats,
      smb2: smb2Stats,
      devices: deviceStatuses,
      watchers: this.watchers.size,
      config: this.config
    };
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);

    // Restart polling if interval changed
    if (newConfig.pollIntervalMinutes && this.mainPollJob) {
      this.stopScheduledPolling();
      this.startScheduledPolling();
    }

    return this.config;
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown() {
    log.info('Shutting down Auto Sync Service...');

    this.stopScheduledPolling();
    this.syncQueue.stopProcessing();
    await this.smb2Client.closeAll();

    log.info('Auto Sync Service stopped');
  }
}

// Export singleton
const instance = new AutoSyncService();
module.exports = instance;
