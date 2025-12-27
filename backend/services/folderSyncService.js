/**
 * Folder Sync Service
 * Monitors network shares for new files from medical imaging devices
 * and queues them for processing/patient matching
 */

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const cron = require('node-cron');
const Device = require('../models/Device');
const Document = require('../models/Document');
const Patient = require('../models/Patient');
const websocketService = require('./websocketService');
const { universalFileProcessor, DEVICE_PATTERNS } = require('./universalFileProcessor');
const patientFolderIndexer = require('./patientFolderIndexer');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('FolderSync');

class FolderSyncService {
  constructor() {
    this.watchers = new Map(); // deviceId -> watcher instance
    this.syncJobs = new Map(); // deviceId -> cron job
    this.processingQueue = [];
    this.isProcessing = false;
    this.stats = {
      filesDiscovered: 0,
      filesProcessed: 0,
      filesFailed: 0,
      patientsMatched: 0
    };
  }

  /**
   * Initialize folder sync for all configured devices
   */
  async initialize() {
    log.info('Initializing folder sync service...');

    try {
      // Get all devices with folder sync enabled (support both old and new schema)
      const devices = await Device.find({
        $or: [
          // Old schema: integration.method + integration.folderSync.enabled
          {
            active: true,
            'integration.method': 'folder-sync',
            'integration.folderSync.enabled': true
          },
          // New schema: autoSync + sharedFolderPath at root level
          {
            autoSync: true,
            sharedFolderPath: { $exists: true, $ne: '' }
          }
        ]
      });

      log.info(`Found ${devices.length} devices with folder sync enabled`);

      for (const device of devices) {
        await this.startWatchingDevice(device);
      }

      // Start queue processor
      this.startQueueProcessor();

      log.info('Folder sync service initialized');
    } catch (error) {
      log.error('[FolderSync] Initialization error:', { error: error });
    }
  }

  /**
   * Start watching a device's shared folder
   */
  async startWatchingDevice(device) {
    // Support both nested (integration.folderSync.sharedFolderPath) and root-level (sharedFolderPath)
    const folderConfig = device.integration?.folderSync;
    const sharedPath = folderConfig?.sharedFolderPath || device.sharedFolderPath;

    if (!sharedPath) {
      log.info(`No folder path configured for ${device.name}`);
      return;
    }

    // Convert SMB path to local mount point (or use directly if already local)
    const localPath = this.getLocalMountPath(sharedPath);

    if (!fs.existsSync(localPath)) {
      log.info(`Mount point not available: ${localPath}`);
      await this.updateDeviceStatus(device._id, 'disconnected', `Mount point not found: ${localPath}`);
      return;
    }

    const isNetworkMount = localPath.startsWith('/Volumes/') && !localPath.includes('/Volumes/Macintosh');

    // IMPORTANT: Skip real-time watchers for network shares - they block the event loop
    // Network shares will only sync via scheduled cron jobs
    if (isNetworkMount) {
      log.info(`${device.name}: Network share detected - using scheduled sync only (no real-time watcher)`);
      await this.updateDeviceStatus(device._id, 'connected', 'Using scheduled sync');

      // Schedule periodic sync if configured
      if (folderConfig?.syncSchedule) {
        this.schedulePeriodicSync(device, folderConfig.syncSchedule);
      }
      return; // Skip chokidar watcher for network shares
    }

    log.info(`Starting watcher for ${device.name} at ${localPath} (local)`);

    // Stop existing watcher if any
    if (this.watchers.has(device._id.toString())) {
      await this.stopWatchingDevice(device._id.toString());
    }

    // File patterns to watch (only for local paths)
    const patterns = (folderConfig.filePattern || '*.jpg,*.pdf')
      .split(',')
      .map(p => path.join(localPath, '**', p.trim()));

    // Create watcher - only used for local directories now
    const watcher = chokidar.watch(patterns, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 500
      },
      depth: 3,
      ignored: [
        /(^|[\/\\])\../, // Ignore dotfiles
        /Thumbs\.db$/,
        /\.DS_Store$/,
        /processed\//,
        /errors\//,
        /\.tmp$/,
        /~$/
      ],
      ignorePermissionErrors: true
    });

    // Event handlers
    watcher
      .on('add', (filePath) => this.handleNewFile(device, filePath))
      .on('change', (filePath) => this.handleFileChange(device, filePath))
      .on('error', (error) => this.handleWatchError(device, error))
      .on('ready', () => {
        log.info(`Watcher ready for ${device.name}`);
        this.updateDeviceStatus(device._id, 'connected');
      });

    this.watchers.set(device._id.toString(), watcher);

    // Schedule periodic sync if configured
    if (folderConfig?.syncSchedule) {
      this.schedulePeriodicSync(device, folderConfig.syncSchedule);
    }
  }

  /**
   * Convert SMB path to local mount point
   */
  getLocalMountPath(smbPath) {
    // If path is already a local path (starts with /), use it directly
    if (smbPath.startsWith('/')) {
      return smbPath;
    }

    // Map SMB paths to local mount points
    const mappings = {
      '//192.168.4.29/ZEISS RETINO': '/Volumes/ZEISS RETINO',
      '//192.168.4.56/Export Solix OCT': '/Volumes/Export Solix OCT',
      '//192.168.4.8/Archives': '/Volumes/Archives',
      '//192.168.4.53/Export': '/Volumes/Export',
      '//192.168.4.0/TOMEY DATA': '/Volumes/TOMEY DATA'
    };

    // Check for direct mapping
    for (const [smb, local] of Object.entries(mappings)) {
      if (smbPath.startsWith(smb)) {
        return smbPath.replace(smb, local);
      }
    }

    // Try to extract share name and use /Volumes
    const match = smbPath.match(/\/\/[^\/]+\/(.+)/);
    if (match) {
      return `/Volumes/${match[1]}`;
    }

    return smbPath;
  }

  /**
   * Handle new file detection
   */
  async handleNewFile(device, filePath) {
    log.info(`New file detected: ${filePath}`);
    this.stats.filesDiscovered++;

    // Check if already processed (use file path and device name in metadata)
    const existingDoc = await Document.findOne({
      'file.path': filePath,
      'metadata.device': device.name
    });

    if (existingDoc) {
      log.info(`File already processed: ${filePath}`);
      return;
    }

    // Add to processing queue
    this.processingQueue.push({
      device,
      filePath,
      timestamp: new Date(),
      retries: 0
    });

    // Notify via websocket
    websocketService.broadcast({
      type: 'DEVICE_FILE_DETECTED',
      data: {
        deviceId: device.deviceId,
        deviceName: device.name,
        fileName: path.basename(filePath),
        timestamp: new Date()
      }
    });
  }

  /**
   * Handle file change
   */
  async handleFileChange(device, filePath) {
    log.info(`File changed: ${filePath}`);
    // Could re-process if needed
  }

  /**
   * Handle watch error
   */
  async handleWatchError(device, error) {
    log.error(`[FolderSync] Watcher error for ${device.name}:`, { error: error });
    await this.updateDeviceStatus(device._id, 'error', error.message);
  }

  /**
   * Process the file queue
   */
  startQueueProcessor() {
    setInterval(async () => {
      if (this.isProcessing || this.processingQueue.length === 0) return;

      this.isProcessing = true;
      const item = this.processingQueue.shift();

      try {
        await this.processFile(item.device, item.filePath);
        this.stats.filesProcessed++;
      } catch (error) {
        log.error('[FolderSync] Processing error:', { error: error });
        this.stats.filesFailed++;

        // Retry logic
        if (item.retries < 3) {
          item.retries++;
          this.processingQueue.push(item);
        }
      }

      this.isProcessing = false;
    }, 1000); // Process every second
  }

  /**
   * Process a single file
   */
  async processFile(device, filePath) {
    log.info(`Processing: ${filePath}`);

    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch (e) {
      log.info(`Cannot stat file: ${filePath}`);
      return null;
    }

    // Use Universal File Processor for enhanced extraction
    let patientInfo = null;
    let processorResult = null;

    try {
      // Determine device type from device model or auto-detect
      const deviceType = this.normalizeDeviceType(device.type) ||
                        universalFileProcessor.detectDeviceType(path.dirname(filePath), fileName);

      processorResult = await universalFileProcessor.processFile(filePath, deviceType, {
        useOCR: true // Enable OCR fallback
      });

      if (processorResult.success && processorResult.patientInfo) {
        patientInfo = processorResult.patientInfo;
        log.info(`Universal processor extracted: ${JSON.stringify(patientInfo)} (method: ${processorResult.method}, confidence: ${processorResult.confidence})`);
      }
    } catch (universalError) {
      log.info(`Universal processor failed, falling back to basic extraction: ${universalError.message}`);
    }

    // Fallback to basic extraction if universal processor didn't work
    if (!patientInfo) {
      patientInfo = this.extractPatientInfo(device, filePath);
    }

    // Try to match patient (with folder path for folder-based matching)
    let matchedPatient = null;
    if (patientInfo) {
      // Add folder name to patient info for matching
      patientInfo.folderName = path.basename(path.dirname(filePath));
      matchedPatient = await this.matchPatient(patientInfo, filePath);
    } else {
      // Try folder-based matching even without extracted patient info
      matchedPatient = await this.matchPatient({ folderName: path.basename(path.dirname(filePath)) }, filePath);
    }

    // Only save to Document model if patient is matched
    if (!matchedPatient) {
      // Store in unmatched queue for later review
      this.stats.unmatchedFiles = (this.stats.unmatchedFiles || 0) + 1;
      log.info(`No patient match for ${fileName} - queued for manual review`);

      // Notify via websocket about unmatched file
      websocketService.broadcast({
        type: 'DEVICE_FILE_UNMATCHED',
        data: {
          deviceName: device.name,
          fileName,
          filePath,
          extractedInfo: patientInfo,
          timestamp: new Date()
        }
      });

      return null;
    }

    // Determine document category based on device type
    const category = this.getDocumentCategory(device.type);
    const subCategory = this.getDocumentSubCategory(device.type, fileName);
    const docType = this.getDocumentType(ext);

    // Get system user for createdBy (or device's assigned user)
    const systemUserId = device.assignedTo || device.createdBy;

    if (!systemUserId) {
      log.info(`No createdBy user available for ${device.name} - skipping document creation`);
      return null;
    }

    // Build document data - only include subCategory if it's defined
    const documentData = {
      title: fileName,
      category: category,
      type: docType,
      mimeType: ext === '.pdf' ? 'application/pdf' : `image/${ext.slice(1).replace('jpg', 'jpeg')}`,
      file: {
        filename: fileName,
        originalName: fileName,
        path: filePath,
        size: stats.size
      },
      patient: matchedPatient._id,
      metadata: {
        source: 'device',
        device: device.name,
        dateCreated: stats.mtime
      },
      tags: ['auto-imported', device.type],
      customFields: {
        deviceId: device.deviceId,
        extractedPatientInfo: patientInfo,
        importedAt: new Date(),
        sourceFolder: path.dirname(filePath)
      },
      createdBy: systemUserId
    };

    // Only add subCategory if it's a valid enum value
    if (subCategory) {
      documentData.subCategory = subCategory;
    }

    // Create document record
    const document = new Document(documentData);

    await document.save();

    // Update device stats
    await Device.findByIdAndUpdate(device._id, {
      $inc: { 'integration.folderSync.filesProcessed': 1 },
      'integration.lastSync': new Date(),
      'integration.lastSyncStatus': 'success'
    });

    // Notify via websocket
    // SECURITY: Do not broadcast patient names - use IDs only to prevent PHI exposure
    websocketService.broadcast({
      type: 'DEVICE_FILE_PROCESSED',
      data: {
        documentId: document._id,
        deviceName: device.name,
        fileName,
        patientMatched: true,
        patientId: matchedPatient._id,
        patientDisplayId: matchedPatient.patientId
      }
    });

    this.stats.patientsMatched++;
    // SECURITY: Log patient ID only, not name (PHI protection)
    log.info(`Matched to patient ID: ${matchedPatient._id} (${matchedPatient.patientId})`);

    return document;
  }

  /**
   * Get document type based on extension
   */
  getDocumentType(ext) {
    const extLower = ext.toLowerCase();
    if (extLower === '.pdf') return 'pdf';
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'].includes(extLower)) return 'image';
    if (['.dcm', '.dicom'].includes(extLower)) return 'dicom';
    if (['.mp3', '.wav', '.m4a'].includes(extLower)) return 'audio';
    if (['.mp4', '.mov', '.avi'].includes(extLower)) return 'video';
    return 'other';
  }

  /**
   * Extract patient information from filename/path
   */
  extractPatientInfo(device, filePath) {
    const fileName = path.basename(filePath);
    const folderName = path.basename(path.dirname(filePath));

    // Device-specific parsing patterns
    if (device.name.includes('Zeiss CLARUS') || device.name.includes('ZEISS')) {
      return this.parseZeissFilename(fileName, folderName);
    } else if (device.name.includes('Solix') || device.name.includes('Optovue')) {
      return this.parseSolixFilename(fileName, folderName);
    } else if (device.name.includes('Quantel')) {
      return this.parseQuantelFilename(fileName, folderName);
    }

    // Generic folder name parsing (patient name from folder)
    return this.parseGenericFolder(folderName);
  }

  /**
   * Parse Zeiss CLARUS filename
   * Format: LastName_FirstName_PatientID_DOB_Gender_Type_Mode_DateTime_Eye_...
   */
  parseZeissFilename(fileName, folderName) {
    // Try to parse from filename first
    const parts = fileName.split('_');
    if (parts.length >= 5) {
      const lastName = parts[0];
      const firstName = parts[1];
      const patientId = parts[2];
      const dobStr = parts[3]; // YYYYMMDD format
      const gender = parts[4]?.toLowerCase();

      // Find eye laterality
      const eyeMatch = fileName.match(/_(OD|OS|OU)_/i);
      const laterality = eyeMatch ? eyeMatch[1].toUpperCase() : null;

      // Parse DOB
      let dob = null;
      if (dobStr && dobStr.length === 8) {
        dob = new Date(
          parseInt(dobStr.substring(0, 4)),
          parseInt(dobStr.substring(4, 6)) - 1,
          parseInt(dobStr.substring(6, 8))
        );
      }

      return {
        lastName,
        firstName,
        patientId,
        dateOfBirth: dob,
        gender: gender === 'male' || gender === 'female' ? gender : null,
        laterality,
        source: 'filename'
      };
    }

    // Fallback to folder name (patient name format)
    return this.parseGenericFolder(folderName);
  }

  /**
   * Parse Optovue Solix folder structure
   * Folder: "LASTNAME FIRSTNAME"
   */
  parseSolixFilename(fileName, folderName) {
    // Solix uses folder names as patient identifiers
    const nameParts = folderName.split(' ');

    if (nameParts.length >= 2) {
      return {
        lastName: nameParts[0],
        firstName: nameParts.slice(1).join(' '),
        source: 'folder'
      };
    }

    return { fullName: folderName, source: 'folder' };
  }

  /**
   * Parse Quantel B-scan filename
   * Folder structure based on patient ID
   */
  parseQuantelFilename(fileName, folderName) {
    // Quantel often uses patient IDs as folder names
    if (/^\d+[A-Z]\d+$/.test(folderName)) {
      return {
        patientId: folderName,
        source: 'folder'
      };
    }

    return this.parseGenericFolder(folderName);
  }

  /**
   * Generic folder name parsing
   */
  parseGenericFolder(folderName) {
    // Split on common delimiters
    const nameParts = folderName.split(/[\s_-]+/).filter(p => p.length > 0);

    if (nameParts.length >= 2) {
      return {
        lastName: nameParts[0],
        firstName: nameParts.slice(1).join(' '),
        fullName: folderName,
        source: 'folder'
      };
    }

    return { fullName: folderName, source: 'folder' };
  }

  /**
   * Match extracted patient info to existing patient
   * Enhanced with folder-based matching, legacy IDs, and DMI IDs
   */
  async matchPatient(patientInfo, filePath = null) {
    const query = { isDeleted: { $ne: true } };

    // 1. Try folder-based matching first (highest priority for device files)
    if (filePath) {
      const byFolder = await patientFolderIndexer.findPatientByFolderPath(filePath);
      if (byFolder) return byFolder;
    }

    // 2. Try DMI ID match (legacy system)
    if (patientInfo.dmiId) {
      const byDmi = await Patient.findOne({
        $or: [
          { 'legacyIds.dmi': patientInfo.dmiId },
          { legacyId: patientInfo.dmiId },
          { 'folderIds.folderId': patientInfo.dmiId }
        ],
        ...query
      });
      if (byDmi) return byDmi;
    }

    // 3. Try exact patient ID match
    if (patientInfo.patientId) {
      const byId = await Patient.findOne({
        $or: [
          { patientId: patientInfo.patientId },
          { legacyPatientNumber: patientInfo.patientId }
        ],
        ...query
      });
      if (byId) return byId;
    }

    // 4. Try folder name match
    if (patientInfo.folderName) {
      const byFolderName = await Patient.findOne({
        'folderIds.folderId': patientInfo.folderName,
        ...query
      });
      if (byFolderName) return byFolderName;
    }

    // 5. Try name + DOB match
    if (patientInfo.lastName && patientInfo.dateOfBirth) {
      const byNameDob = await Patient.findOne({
        lastName: new RegExp(`^${patientInfo.lastName}$`, 'i'),
        dateOfBirth: patientInfo.dateOfBirth,
        ...query
      });
      if (byNameDob) return byNameDob;
    }

    // 6. Try fuzzy name match
    if (patientInfo.lastName && patientInfo.firstName) {
      const byName = await Patient.findOne({
        lastName: new RegExp(`^${patientInfo.lastName}$`, 'i'),
        firstName: new RegExp(`^${patientInfo.firstName}`, 'i'),
        ...query
      });
      if (byName) return byName;
    }

    // 7. Try full name match
    if (patientInfo.fullName) {
      const parts = patientInfo.fullName.split(/[\s_-]+/);
      if (parts.length >= 2) {
        const byFullName = await Patient.findOne({
          $or: [
            { lastName: new RegExp(`^${parts[0]}$`, 'i'), firstName: new RegExp(`^${parts[1]}`, 'i') },
            { lastName: new RegExp(`^${parts[parts.length - 1]}$`, 'i'), firstName: new RegExp(`^${parts[0]}`, 'i') }
          ],
          ...query
        });
        if (byFullName) return byFullName;
      }
    }

    return null;
  }

  /**
   * Get document category based on device type
   */
  getDocumentCategory(deviceType) {
    const mapping = {
      'fundus-camera': 'imaging',
      'oct': 'imaging',
      'ultrasound': 'imaging',
      'perimeter': 'imaging',
      'topographer': 'imaging',
      'retinal-camera': 'imaging'
    };
    return mapping[deviceType] || 'clinical';
  }

  /**
   * Get document sub-category
   * Returns valid enum values: 'fundus-photo', 'oct', 'visual-field', 'topography', 'ultrasound'
   * Returns undefined for unknown types (subCategory is optional)
   */
  getDocumentSubCategory(deviceType, fileName) {
    const fileNameLower = fileName.toLowerCase();

    if (deviceType === 'fundus-camera' || deviceType === 'retinal-camera') {
      return 'fundus-photo';
    } else if (deviceType === 'oct') {
      return 'oct';
    } else if (deviceType === 'ultrasound') {
      return 'ultrasound';
    } else if (deviceType === 'perimeter') {
      return 'visual-field';
    } else if (deviceType === 'topographer') {
      return 'topography';
    }

    // Return undefined for unknown device types - subCategory is optional
    return undefined;
  }

  /**
   * Schedule periodic sync
   */
  schedulePeriodicSync(device, schedule) {
    if (this.syncJobs.has(device._id.toString())) {
      this.syncJobs.get(device._id.toString()).stop();
    }

    const job = cron.schedule(schedule, async () => {
      log.info(`Running scheduled sync for ${device.name}`);
      await this.performFullSync(device);
    });

    this.syncJobs.set(device._id.toString(), job);
  }

  /**
   * Perform full sync of a device folder
   */
  async performFullSync(device) {
    // Support both nested and root-level paths
    const folderConfig = device.integration?.folderSync;
    const sharedPath = folderConfig?.sharedFolderPath || device.sharedFolderPath;

    if (!sharedPath) return;

    const localPath = this.getLocalMountPath(sharedPath);

    if (!fs.existsSync(localPath)) {
      log.info(`Mount not available for sync: ${localPath}`);
      return;
    }

    // Get all files matching pattern (increased limits for proper deep scanning)
    const patterns = (folderConfig.filePattern || '*.jpg,*.jpeg,*.png,*.pdf,*.dcm,*.bmp,*.tiff').split(',');
    const files = await this.findFiles(localPath, patterns, [], 0, 10, 5000);

    log.info(`Full sync found ${files.length} files for ${device.name}`);

    for (const file of files) {
      await this.handleNewFile(device, file);
    }
  }

  /**
   * Find files matching patterns (async, with limits for network shares)
   */
  async findFiles(dir, patterns, results = [], depth = 0, maxDepth = 2, maxFiles = 100) {
    // Limit depth and file count to prevent blocking on large network shares
    if (depth > maxDepth || results.length >= maxFiles) {
      return results;
    }

    let items;
    try {
      items = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (e) {
      // Network share might be temporarily unavailable
      log.info(`Cannot read directory: ${dir}`);
      return results;
    }

    for (const item of items) {
      if (results.length >= maxFiles) break;

      const fullPath = path.join(dir, item.name);

      // Skip hidden files and special directories
      if (item.name.startsWith('.') ||
          item.name === 'Thumbs.db' ||
          item.name === 'processed' ||
          item.name === 'errors') {
        continue;
      }

      if (item.isDirectory()) {
        await this.findFiles(fullPath, patterns, results, depth + 1, maxDepth, maxFiles);
        // Yield to event loop between directories
        await new Promise(resolve => setImmediate(resolve));
      } else {
        const ext = path.extname(item.name).toLowerCase();
        const matchesPattern = patterns.some(p => {
          const patternExt = p.replace('*', '').toLowerCase();
          return ext === patternExt;
        });

        if (matchesPattern) {
          results.push(fullPath);
        }
      }
    }

    return results;
  }

  /**
   * Update device integration status
   */
  async updateDeviceStatus(deviceId, status, message = null) {
    const updateFields = {
      'integration.status': status,
      'integration.lastConnection': new Date()
    };

    // Add status message to a separate field (avoid conflict with status string)
    if (message) {
      updateFields['integration.statusMessage'] = message;
    }

    await Device.findByIdAndUpdate(deviceId, updateFields);
  }

  /**
   * Stop watching a device
   */
  async stopWatchingDevice(deviceId) {
    const watcher = this.watchers.get(deviceId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(deviceId);
    }

    const job = this.syncJobs.get(deviceId);
    if (job) {
      job.stop();
      this.syncJobs.delete(deviceId);
    }
  }

  /**
   * Stop all watchers
   */
  async shutdown() {
    log.info('Shutting down folder sync service...');

    for (const [deviceId] of this.watchers) {
      await this.stopWatchingDevice(deviceId);
    }

    log.info('Folder sync service stopped');
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeWatchers: this.watchers.size,
      queueLength: this.processingQueue.length,
      isProcessing: this.isProcessing,
      processorStats: universalFileProcessor.getStats()
    };
  }

  /**
   * Normalize device type to match universal processor patterns
   */
  normalizeDeviceType(deviceType) {
    if (!deviceType) return null;

    const typeLower = deviceType.toLowerCase();

    // Map device types to universal processor device keys
    const typeMapping = {
      'fundus-camera': 'zeiss',
      'retinal-camera': 'zeiss',
      'oct': 'solix',
      'optical-coherence-tomography': 'solix',
      'topographer': 'tomey',
      'auto-refractor': 'nidek',
      'autorefractor': 'nidek',
      'biometer': 'nidek',
      'tonometer': 'generic',
      'perimeter': 'generic',
      'ultrasound': 'quantel'
    };

    // Check for direct matches in DEVICE_PATTERNS
    for (const [key, config] of Object.entries(DEVICE_PATTERNS.folderPatterns)) {
      for (const pattern of config) {
        if (typeLower.includes(pattern)) {
          return key;
        }
      }
    }

    return typeMapping[typeLower] || null;
  }

  /**
   * Manual sync trigger for a device
   */
  async triggerSync(deviceId) {
    const device = await Device.findById(deviceId);
    if (!device) throw new Error('Device not found');

    await this.performFullSync(device);
    return { message: 'Sync triggered', device: device.name };
  }
}

// Singleton instance
const folderSyncService = new FolderSyncService();

module.exports = folderSyncService;
