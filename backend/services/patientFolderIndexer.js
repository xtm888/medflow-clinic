/**
 * Patient Folder Indexer Service
 *
 * Deep scans device shares to:
 * 1. Index patient folders (identify which folders contain patient data)
 * 2. Match folder names to existing patients
 * 3. Link folders to patients via folderIds field
 * 4. Track all files within patient folders
 * 5. Handle legacy DMI IDs, folder-based names, etc.
 */

const fs = require('fs');
const path = require('path');
const Patient = require('../models/Patient');
const Device = require('../models/Device');
const Document = require('../models/Document');
const websocketService = require('./websocketService');
const { validateMountPath } = require('../utils/shellSecurity');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('PatientFolderIndexer');

// Allowed base directories for folder indexing (prevent arbitrary filesystem access)
const ALLOWED_BASE_PATHS = [
  '/Volumes',
  '/tmp/medflow_mounts',
  '/mnt',
  '/Users' // For development
];

/**
 * Validate that a path is safe for indexing (no traversal, within allowed dirs)
 * @param {string} folderPath - Path to validate
 * @returns {string} - Validated and normalized path
 * @throws {Error} - If path is unsafe
 */
function validateFolderPath(folderPath) {
  if (!folderPath || typeof folderPath !== 'string') {
    throw new Error('Invalid folder path');
  }

  // Normalize the path to resolve . and ..
  const normalizedPath = path.normalize(folderPath);

  // Check for path traversal attempts
  if (normalizedPath.includes('..') || folderPath.includes('..')) {
    throw new Error('Path traversal detected - ".." not allowed');
  }

  // Ensure path is absolute
  if (!path.isAbsolute(normalizedPath)) {
    throw new Error('Path must be absolute');
  }

  // Check if path starts with an allowed base directory
  const isAllowed = ALLOWED_BASE_PATHS.some(base =>
    normalizedPath.startsWith(base + '/') || normalizedPath === base
  );

  if (!isAllowed) {
    throw new Error(`Path not in allowed directories: ${ALLOWED_BASE_PATHS.join(', ')}`);
  }

  // Additional security: prevent access to sensitive system paths
  const BLOCKED_PATHS = [
    '/etc', '/var', '/usr', '/bin', '/sbin', '/lib', '/root',
    '/private/etc', '/private/var', '/System'
  ];

  for (const blocked of BLOCKED_PATHS) {
    if (normalizedPath.startsWith(blocked + '/') || normalizedPath === blocked) {
      throw new Error('Access to system directories not allowed');
    }
  }

  return normalizedPath;
}

// Common patterns for identifying patient folders
const PATIENT_FOLDER_PATTERNS = {
  // DMI legacy format: 10001A01, 20045B12, etc.
  dmiId: /^(\d{5}[A-Z]\d{2})$/i,
  // Name format: LASTNAME_FIRSTNAME or LASTNAME FIRSTNAME
  nameSeparated: /^([A-Z]+)[_\s]([A-Z]+)$/i,
  // Name with ID: LASTNAME_FIRSTNAME_12345
  nameWithId: /^([A-Z]+)[_\s]([A-Z]+)[_\s](\d+)$/i,
  // Date-based: 2024-01-15_LASTNAME_FIRSTNAME
  dateBased: /^(\d{4}-\d{2}-\d{2})[_\s](.+)$/,
  // ID only: numeric patient ID
  idOnly: /^(\d{4,10})$/,
  // Zeiss format: LASTNAME_FIRSTNAME_DOB_GENDER
  zeissFormat: /^([A-Z]+)_([A-Z]+)_(\d{8})_/i
};

class PatientFolderIndexer {
  constructor() {
    this.indexing = false;
    this.stats = {
      foldersScanned: 0,
      patientFoldersFound: 0,
      patientsMatched: 0,
      patientsLinked: 0,
      unmatchedFolders: [],
      filesIndexed: 0,
      lastIndexTime: null
    };
    this.indexedFolders = new Map(); // path -> patientId
    this.unmatchedQueue = []; // Folders that couldn't be auto-matched
  }

  /**
   * Index all configured device shares
   */
  async indexAllDevices(options = {}) {
    if (this.indexing) {
      return { error: 'Indexing already in progress' };
    }

    this.indexing = true;
    this.resetStats();
    const startTime = Date.now();

    try {
      // Get all devices with shared folders
      const devices = await Device.find({
        $or: [
          { sharedFolderPath: { $exists: true, $ne: '' } },
          { 'integration.folderSync.sharedFolderPath': { $exists: true } }
        ],
        active: true
      });

      log.info(`Starting index of ${devices.length} devices`);

      for (const device of devices) {
        await this.indexDeviceFolder(device, options);
        // Yield to prevent blocking
        await new Promise(resolve => setImmediate(resolve));
      }

      this.stats.lastIndexTime = new Date();
      log.info(`Indexing complete in ${Date.now() - startTime}ms`);

      return {
        success: true,
        stats: this.stats,
        duration: Date.now() - startTime
      };

    } catch (error) {
      log.error('[FolderIndexer] Indexing error:', { error: error });
      return { error: error.message };
    } finally {
      this.indexing = false;
    }
  }

  /**
   * Index a single device's shared folder
   */
  async indexDeviceFolder(device, options = {}) {
    const folderPath = device.sharedFolderPath ||
                       device.integration?.folderSync?.sharedFolderPath;

    if (!folderPath) {
      log.info(`No folder path for ${device.name}`);
      return;
    }

    // Convert SMB path to local path if needed
    let localPath = this.smbToLocalPath(folderPath);

    // SECURITY: Validate path to prevent traversal attacks
    try {
      localPath = validateFolderPath(localPath);
    } catch (error) {
      log.error(`[FolderIndexer] Security: Invalid path for ${device.name}: ${error.message}`);
      return;
    }

    if (!fs.existsSync(localPath)) {
      log.info(`Path not accessible: ${localPath}`);
      return;
    }

    log.info(`Indexing ${device.name} at ${localPath}`);

    const deviceType = this.normalizeDeviceType(device.type, device.name);

    // Deep scan with progress reporting
    await this.scanFolderRecursive(localPath, device, deviceType, {
      maxDepth: options.maxDepth || 10,
      currentDepth: 0,
      onProgress: options.onProgress
    });
  }

  /**
   * Recursively scan folder structure
   */
  async scanFolderRecursive(folderPath, device, deviceType, context = {}) {
    const { maxDepth = 10, currentDepth = 0 } = context;

    if (currentDepth > maxDepth) return;

    let items;
    try {
      items = await fs.promises.readdir(folderPath, { withFileTypes: true });
    } catch (error) {
      log.info(`Cannot read: ${folderPath}`);
      return;
    }

    this.stats.foldersScanned++;

    // Broadcast progress
    if (this.stats.foldersScanned % 100 === 0) {
      websocketService.broadcast({
        type: 'FOLDER_INDEX_PROGRESS',
        data: {
          foldersScanned: this.stats.foldersScanned,
          patientsMatched: this.stats.patientsMatched,
          device: device.name
        }
      });
    }

    for (const item of items) {
      // Skip hidden and system files
      if (item.name.startsWith('.') ||
          item.name === 'Thumbs.db' ||
          item.name === 'processed' ||
          item.name === '.DS_Store') {
        continue;
      }

      const itemPath = path.join(folderPath, item.name);

      if (item.isDirectory()) {
        // Check if this looks like a patient folder
        const patientInfo = this.parsePatientFolder(item.name, deviceType);

        if (patientInfo) {
          this.stats.patientFoldersFound++;

          // Try to match to existing patient
          const patient = await this.matchPatientFromFolder(patientInfo, itemPath, device);

          if (patient) {
            // Link folder to patient
            await this.linkFolderToPatient(patient, itemPath, deviceType, device);
            this.indexedFolders.set(itemPath, patient._id);

            // Index files in this patient folder
            await this.indexPatientFiles(itemPath, patient, device);
          } else {
            // Add to unmatched queue for manual review
            this.unmatchedQueue.push({
              path: itemPath,
              folderName: item.name,
              parsedInfo: patientInfo,
              device: device.name,
              deviceType
            });
            this.stats.unmatchedFolders.push({
              path: itemPath,
              name: item.name,
              info: patientInfo
            });
          }
        } else {
          // Not a patient folder, continue recursing
          await this.scanFolderRecursive(itemPath, device, deviceType, {
            ...context,
            currentDepth: currentDepth + 1
          });
        }
      }

      // Yield periodically
      if (this.stats.foldersScanned % 50 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
  }

  /**
   * Parse folder name to extract patient info
   */
  parsePatientFolder(folderName, deviceType) {
    // Skip common non-patient folders
    const skipFolders = [
      'export', 'backup', 'archive', 'temp', 'system', 'config',
      'logs', 'reports', 'templates', 'database', 'software'
    ];
    if (skipFolders.includes(folderName.toLowerCase())) {
      return null;
    }

    // Try DMI ID pattern first (legacy format)
    let match = folderName.match(PATIENT_FOLDER_PATTERNS.dmiId);
    if (match) {
      return {
        type: 'dmiId',
        dmiId: match[1].toUpperCase(),
        confidence: 0.95
      };
    }

    // Try Zeiss format: LASTNAME_FIRSTNAME_DOB_GENDER
    match = folderName.match(PATIENT_FOLDER_PATTERNS.zeissFormat);
    if (match) {
      const dobStr = match[3];
      const dob = new Date(
        parseInt(dobStr.substring(0, 4)),
        parseInt(dobStr.substring(4, 6)) - 1,
        parseInt(dobStr.substring(6, 8))
      );
      return {
        type: 'zeiss',
        lastName: match[1].toUpperCase(),
        firstName: match[2].toUpperCase(),
        dateOfBirth: dob,
        confidence: 0.9
      };
    }

    // Try name with ID pattern
    match = folderName.match(PATIENT_FOLDER_PATTERNS.nameWithId);
    if (match) {
      return {
        type: 'nameWithId',
        lastName: match[1].toUpperCase(),
        firstName: match[2].toUpperCase(),
        patientId: match[3],
        confidence: 0.85
      };
    }

    // Try name separated pattern
    match = folderName.match(PATIENT_FOLDER_PATTERNS.nameSeparated);
    if (match && match[1].length >= 2 && match[2].length >= 2) {
      return {
        type: 'name',
        lastName: match[1].toUpperCase(),
        firstName: match[2].toUpperCase(),
        confidence: 0.7
      };
    }

    // Try numeric ID only
    match = folderName.match(PATIENT_FOLDER_PATTERNS.idOnly);
    if (match) {
      return {
        type: 'id',
        patientId: match[1],
        confidence: 0.6
      };
    }

    // Device-specific parsing
    if (deviceType === 'solix' || deviceType === 'optovue') {
      // Solix uses "LASTNAME FIRSTNAME" as folder names
      const parts = folderName.trim().split(/\s+/);
      if (parts.length >= 2 && parts[0].length >= 2) {
        return {
          type: 'solix',
          lastName: parts[0].toUpperCase(),
          firstName: parts.slice(1).join(' ').toUpperCase(),
          confidence: 0.75
        };
      }
    }

    // If folder name looks like it could be a name (2+ chars, mostly letters)
    if (folderName.length >= 4 && /^[A-Za-z\s_-]+$/.test(folderName)) {
      return {
        type: 'unknown',
        fullName: folderName.toUpperCase(),
        confidence: 0.4
      };
    }

    return null;
  }

  /**
   * Match folder info to existing patient
   */
  async matchPatientFromFolder(folderInfo, folderPath, device) {
    const query = { isDeleted: { $ne: true } };

    // 1. Try DMI ID match (highest confidence)
    if (folderInfo.dmiId) {
      const byDmi = await Patient.findOne({
        $or: [
          { 'legacyIds.dmi': folderInfo.dmiId },
          { legacyId: folderInfo.dmiId },
          { 'folderIds.folderId': folderInfo.dmiId }
        ],
        ...query
      });
      if (byDmi) {
        this.stats.patientsMatched++;
        return byDmi;
      }
    }

    // 2. Try patient ID match
    if (folderInfo.patientId) {
      // Escape special regex characters to prevent injection
      const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const safePatientId = escapeRegExp(folderInfo.patientId);

      const byId = await Patient.findOne({
        $or: [
          { patientId: { $regex: new RegExp(safePatientId, 'i') } },
          { legacyPatientNumber: folderInfo.patientId }
        ],
        ...query
      });
      if (byId) {
        this.stats.patientsMatched++;
        return byId;
      }
    }

    // 3. Try folder path match (already linked)
    const byFolder = await Patient.findOne({
      'folderIds.path': folderPath,
      ...query
    });
    if (byFolder) {
      this.stats.patientsMatched++;
      return byFolder;
    }

    // 4. Try folder name match (already linked)
    const folderName = path.basename(folderPath);
    const byFolderName = await Patient.findOne({
      'folderIds.folderId': folderName,
      ...query
    });
    if (byFolderName) {
      this.stats.patientsMatched++;
      return byFolderName;
    }

    // 5. Try name + DOB match
    if (folderInfo.lastName && folderInfo.dateOfBirth) {
      const byNameDob = await Patient.findOne({
        lastName: { $regex: new RegExp(`^${folderInfo.lastName}$`, 'i') },
        dateOfBirth: folderInfo.dateOfBirth,
        ...query
      });
      if (byNameDob) {
        this.stats.patientsMatched++;
        return byNameDob;
      }
    }

    // 6. Try name match (fuzzy)
    if (folderInfo.lastName && folderInfo.firstName) {
      const byName = await Patient.findOne({
        lastName: { $regex: new RegExp(`^${folderInfo.lastName}$`, 'i') },
        firstName: { $regex: new RegExp(`^${folderInfo.firstName}`, 'i') },
        ...query
      });
      if (byName) {
        this.stats.patientsMatched++;
        return byName;
      }
    }

    // 7. Try full name match
    if (folderInfo.fullName) {
      const parts = folderInfo.fullName.split(/[\s_-]+/).filter(p => p.length >= 2);
      if (parts.length >= 2) {
        const byFullName = await Patient.findOne({
          $or: [
            {
              lastName: { $regex: new RegExp(`^${parts[0]}$`, 'i') },
              firstName: { $regex: new RegExp(`^${parts[1]}`, 'i') }
            },
            {
              lastName: { $regex: new RegExp(`^${parts[parts.length - 1]}$`, 'i') },
              firstName: { $regex: new RegExp(`^${parts[0]}`, 'i') }
            }
          ],
          ...query
        });
        if (byFullName) {
          this.stats.patientsMatched++;
          return byFullName;
        }
      }
    }

    return null;
  }

  /**
   * Link a folder to a patient
   */
  async linkFolderToPatient(patient, folderPath, deviceType, device) {
    const folderName = path.basename(folderPath);

    // Check if already linked
    const existingLink = patient.folderIds?.find(f =>
      f.path === folderPath || f.folderId === folderName
    );

    if (existingLink) {
      return; // Already linked
    }

    // Add folder link
    if (!patient.folderIds) {
      patient.folderIds = [];
    }

    patient.folderIds.push({
      deviceType: deviceType,
      folderId: folderName,
      path: folderPath,
      linkedAt: new Date(),
      linkedBy: null // System auto-link
    });

    await patient.save({ validateBeforeSave: false });
    this.stats.patientsLinked++;

    log.info(`Linked ${folderPath} to patient ${patient.patientId}`);
  }

  /**
   * Index files within a patient folder
   */
  async indexPatientFiles(folderPath, patient, device) {
    const files = await this.findAllFiles(folderPath, {
      maxDepth: 5,
      extensions: ['.jpg', '.jpeg', '.png', '.pdf', '.dcm', '.bmp', '.tiff', '.xml']
    });

    this.stats.filesIndexed += files.length;

    // Store file count in indexed folders
    const indexed = this.indexedFolders.get(folderPath);
    if (indexed) {
      this.indexedFolders.set(folderPath, {
        patientId: patient._id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        fileCount: files.length
      });
    }
  }

  /**
   * Find all files in folder recursively
   */
  async findAllFiles(dir, options = {}, results = [], depth = 0) {
    const { maxDepth = 5, extensions = [] } = options;

    if (depth > maxDepth) return results;

    let items;
    try {
      items = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const item of items) {
      if (item.name.startsWith('.')) continue;

      const fullPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        await this.findAllFiles(fullPath, options, results, depth + 1);
      } else {
        const ext = path.extname(item.name).toLowerCase();
        if (extensions.length === 0 || extensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }

    return results;
  }

  /**
   * Convert SMB path to local mount path
   */
  smbToLocalPath(smbPath) {
    if (smbPath.startsWith('/')) return smbPath;

    // Extract share name from SMB path
    const match = smbPath.match(/\/\/[^\/]+\/(.+)/);
    if (match) {
      // Check common mount points
      const shareName = match[1];
      const possiblePaths = [
        `/Volumes/${shareName}`,
        `/tmp/medflow_mounts/${shareName.replace(/\s+/g, '_')}`,
        `/mnt/${shareName}`
      ];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) return p;
      }

      return `/Volumes/${shareName}`;
    }

    return smbPath;
  }

  /**
   * Normalize device type string
   */
  normalizeDeviceType(type, name = '') {
    const combined = `${type || ''} ${name}`.toLowerCase();

    if (combined.includes('zeiss') || combined.includes('clarus')) return 'zeiss';
    if (combined.includes('solix') || combined.includes('optovue')) return 'solix';
    if (combined.includes('topcon') || combined.includes('maestro')) return 'topcon';
    if (combined.includes('nidek')) return 'nidek';
    if (combined.includes('tomey')) return 'tomey';
    if (combined.includes('heidelberg') || combined.includes('spectralis')) return 'heidelberg';
    if (combined.includes('quantel')) return 'quantel';

    return type || 'other';
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      foldersScanned: 0,
      patientFoldersFound: 0,
      patientsMatched: 0,
      patientsLinked: 0,
      unmatchedFolders: [],
      filesIndexed: 0,
      lastIndexTime: null
    };
    this.unmatchedQueue = [];
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      indexing: this.indexing,
      unmatchedCount: this.unmatchedQueue.length
    };
  }

  /**
   * Get unmatched folders for manual review
   */
  getUnmatchedFolders() {
    return this.unmatchedQueue;
  }

  /**
   * Manually link a folder to a patient
   */
  async manualLinkFolder(folderPath, patientId, deviceType, userId) {
    // SECURITY: Validate path to prevent traversal attacks
    let validatedPath;
    try {
      validatedPath = validateFolderPath(folderPath);
    } catch (error) {
      throw new Error(`Invalid folder path: ${error.message}`);
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }

    const folderName = path.basename(validatedPath);

    if (!patient.folderIds) {
      patient.folderIds = [];
    }

    // Check if already linked
    const existing = patient.folderIds.find(f => f.path === validatedPath);
    if (existing) {
      return { message: 'Folder already linked', patient };
    }

    patient.folderIds.push({
      deviceType: deviceType || 'other',
      folderId: folderName,
      path: validatedPath,
      linkedAt: new Date(),
      linkedBy: userId
    });

    await patient.save({ validateBeforeSave: false });

    // Remove from unmatched queue
    this.unmatchedQueue = this.unmatchedQueue.filter(f => f.path !== validatedPath);

    log.info(`Manual link: ${validatedPath} -> ${patient.patientId}`);

    return { message: 'Folder linked successfully', patient };
  }

  /**
   * Find patient by folder path (used during file sync)
   */
  async findPatientByFolderPath(filePath) {
    // SECURITY: Validate path to prevent traversal attacks
    let validatedPath;
    try {
      validatedPath = validateFolderPath(filePath);
    } catch (error) {
      log.error(`[FolderIndexer] Security: Invalid file path: ${error.message}`);
      return null;
    }

    // Traverse up from file to find matching patient folder
    let currentPath = path.dirname(validatedPath);
    let maxDepth = 5;

    while (maxDepth > 0 && currentPath !== '/') {
      // Check cache first
      const cached = this.indexedFolders.get(currentPath);
      if (cached) {
        return await Patient.findById(cached.patientId || cached);
      }

      // Check database
      const patient = await Patient.findOne({
        'folderIds.path': currentPath,
        isDeleted: { $ne: true }
      });

      if (patient) {
        this.indexedFolders.set(currentPath, patient._id);
        return patient;
      }

      // Check by folder name
      const folderName = path.basename(currentPath);
      const byName = await Patient.findOne({
        'folderIds.folderId': folderName,
        isDeleted: { $ne: true }
      });

      if (byName) {
        this.indexedFolders.set(currentPath, byName._id);
        return byName;
      }

      currentPath = path.dirname(currentPath);
      maxDepth--;
    }

    return null;
  }
}

// Singleton instance
const patientFolderIndexer = new PatientFolderIndexer();

module.exports = patientFolderIndexer;
