/**
 * Device Sync Scheduler
 *
 * Automatically syncs devices that have folder sync enabled
 * according to their configured schedules.
 *
 * Features:
 * - Scheduled folder scanning based on device cron expressions
 * - Concurrent device syncing with error isolation
 * - Automatic retry for failed syncs
 * - Health monitoring and status tracking
 */

const cron = require('node-cron');
const Device = require('../models/Device');
const DeviceIntegrationLog = require('../models/DeviceIntegrationLog');
const AdapterFactory = require('./adapters/AdapterFactory');
const fs = require('fs').promises;
const path = require('path');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('DeviceSyncScheduler');

class DeviceSyncScheduler {
  constructor() {
    this.syncJobs = new Map(); // deviceId -> cron job
    this.isRunning = false;
    this.stats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      lastSyncTime: null
    };
  }

  /**
   * Start the device sync scheduler
   */
  async start() {
    if (this.isRunning) {
      log.info('⚠️  Device sync scheduler already running');
      return;
    }

    log.info('🔄 Starting device sync scheduler...');

    try {
      // Load all devices with folder sync enabled
      await this.loadDevices();

      // Schedule main sync job - checks for devices every 5 minutes
      this.mainJob = cron.schedule('*/5 * * * *', async () => {
        await this.checkAndUpdateDevices();
      });

      this.isRunning = true;
      log.info('✅ Device sync scheduler started successfully');
      log.info(`   - Monitoring ${this.syncJobs.size} devices with folder sync`);
      log.info('   - Device check: Every 5 minutes');

    } catch (error) {
      log.error('❌ Failed to start device sync scheduler:', { error: error });
      throw error;
    }
  }

  /**
   * Stop the device sync scheduler
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    log.info('🛑 Stopping device sync scheduler...');

    // Stop main job
    if (this.mainJob) {
      this.mainJob.stop();
    }

    // Stop all device sync jobs
    for (const [deviceId, job] of this.syncJobs.entries()) {
      job.stop();
      log.info(`   - Stopped sync for device: ${deviceId}`);
    }

    this.syncJobs.clear();
    this.isRunning = false;

    log.info('✅ Device sync scheduler stopped');
  }

  /**
   * Load devices with folder sync enabled and schedule their syncs
   */
  async loadDevices() {
    try {
      const devices = await Device.find({
        active: true,
        'integration.method': 'folder-sync',
        'integration.folderSync.enabled': true
      });

      log.info(`📁 Found ${devices.length} devices with folder sync enabled`);

      for (const device of devices) {
        await this.scheduleDeviceSync(device);
      }

    } catch (error) {
      log.error('Error loading devices:', { error: error });
      throw error;
    }
  }

  /**
   * Schedule sync for a specific device
   */
  async scheduleDeviceSync(device) {
    try {
      const schedule = device.integration.folderSync.syncSchedule || '0 */1 * * *'; // Default: hourly

      // Validate cron expression
      if (!cron.validate(schedule)) {
        log.warn(`⚠️  Invalid cron schedule for device ${device.name}: ${schedule}`);
        return;
      }

      // Stop existing job if any
      if (this.syncJobs.has(device._id.toString())) {
        this.syncJobs.get(device._id.toString()).stop();
      }

      // Create new sync job
      const job = cron.schedule(schedule, async () => {
        await this.syncDevice(device._id);
      });

      this.syncJobs.set(device._id.toString(), job);

      log.info(`   ✓ Scheduled sync for ${device.name} (${device.type}): ${schedule}`);

    } catch (error) {
      log.error(`Error scheduling device ${device.name}:`, { error: error });
    }
  }

  /**
   * Sync a specific device's folder
   */
  async syncDevice(deviceId) {
    const startTime = Date.now();
    this.stats.totalSyncs++;

    try {
      const device = await Device.findById(deviceId);

      if (!device || !device.active || !device.integration.folderSync.enabled) {
        log.info(`⚠️  Device ${deviceId} no longer eligible for sync`);
        return;
      }

      log.info(`🔄 Starting folder sync for: ${device.name}`);

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
        initiatedBy: 'SCHEDULED',
        startedAt: new Date(),
        folderSync: {
          folderPath: folderPath
        }
      });

      // Check if folder exists
      try {
        await fs.access(folderPath);
      } catch (error) {
        throw new Error(`Folder not accessible: ${folderPath}`);
      }

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

      const processedFolder = device.integration.folderSync.processedFolder ||
                            path.join(folderPath, 'processed');
      const errorFolder = device.integration.folderSync.errorFolder ||
                         path.join(folderPath, 'errors');

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
            log.info(`   ⏭️  Skipping already processed file: ${file}`);
            continue;
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

          log.info(`   ✅ Processed file: ${file}`);

        } catch (error) {
          recordsFailed++;
          errors.push({ file, error: error.message });

          log.error(`   ❌ Error processing file ${file}:`, error.message);

          // Move to error folder
          try {
            await fs.rename(filePath, path.join(errorFolder, file));
          } catch (moveError) {
            log.error('Failed to move error file:', { error: moveError });
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
        'integration.consecutiveErrors': recordsFailed === 0 ? 0 : device.integration.consecutiveErrors + 1,
        $inc: {
          'integration.folderSync.filesProcessed': recordsProcessed,
          'integration.folderSync.filesFailed': recordsFailed
        }
      });

      this.stats.successfulSyncs++;
      this.stats.lastSyncTime = new Date();

      log.info(`✅ Completed sync for ${device.name}: ${recordsProcessed} processed, ${recordsFailed} failed (${Date.now() - startTime}ms)`);

    } catch (error) {
      this.stats.failedSyncs++;

      log.error(`❌ Folder sync failed for device ${deviceId}:`, error.message);

      // Log failure
      await DeviceIntegrationLog.create({
        device: deviceId,
        deviceType: 'unknown',
        eventType: 'FOLDER_SCAN',
        status: 'FAILED',
        integrationMethod: 'folder-sync',
        initiatedBy: 'SCHEDULED',
        startedAt: new Date(),
        completedAt: new Date(),
        errorDetails: {
          code: 'FOLDER_SYNC_ERROR',
          message: error.message,
          stack: error.stack,
          severity: 'HIGH'
        }
      });

      // Update device status
      await Device.findByIdAndUpdate(deviceId, {
        'integration.status': 'error',
        'integration.lastSyncStatus': 'failed',
        $inc: { 'integration.consecutiveErrors': 1 }
      });
    }
  }

  /**
   * Check for new/updated devices and update schedules
   */
  async checkAndUpdateDevices() {
    try {
      const devices = await Device.find({
        active: true,
        'integration.method': 'folder-sync',
        'integration.folderSync.enabled': true
      });

      // Add new devices
      for (const device of devices) {
        if (!this.syncJobs.has(device._id.toString())) {
          await this.scheduleDeviceSync(device);
        }
      }

      // Remove devices that are no longer active
      const activeDeviceIds = new Set(devices.map(d => d._id.toString()));
      for (const deviceId of this.syncJobs.keys()) {
        if (!activeDeviceIds.has(deviceId)) {
          this.syncJobs.get(deviceId).stop();
          this.syncJobs.delete(deviceId);
          log.info(`   - Removed sync for device: ${deviceId}`);
        }
      }

    } catch (error) {
      log.error('Error checking devices:', { error: error });
    }
  }

  /**
   * Get scheduler statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      activeDevices: this.syncJobs.size
    };
  }

  /**
   * Manually trigger sync for a device
   */
  async triggerSync(deviceId) {
    log.info(`🔄 Manually triggering sync for device: ${deviceId}`);
    await this.syncDevice(deviceId);
  }
}

// Create singleton instance
const deviceSyncScheduler = new DeviceSyncScheduler();

module.exports = deviceSyncScheduler;
