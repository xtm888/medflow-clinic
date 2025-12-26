/**
 * SMB2 Client Service
 *
 * Pure JavaScript SMB2 client for programmatic access to Windows shares
 * without requiring manual mounting. Cross-platform compatible.
 */

const SMB2 = require('@marsaud/smb2');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const EventEmitter = require('events');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('Smb2Client');

class SMB2ClientService extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map();  // Cache active connections
    this.connectionTimeout = 30000;  // 30 second timeout
    this.maxRetries = 3;
    this.tempDir = path.join(os.tmpdir(), 'medflow_smb2_cache');
    this.fileCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000;  // 5 minute cache

    // Auto-reconnect settings
    this.reconnectConfig = {
      enabled: true,
      maxAttempts: 5,
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      backoffMultiplier: 2
    };
    this.reconnectAttempts = new Map();
    this.reconnectTimers = new Map();
    this.connectionHealth = new Map();

    // CRITICAL: Setup error handler to prevent process crash
    this._setupErrorHandling();
  }

  /**
   * Setup error handling for EventEmitter
   * Prevents unhandled 'error' events from crashing the process
   */
  _setupErrorHandling() {
    this.on('error', (error) => {
      log.error('SMB2ClientService error:', {
        error: error.message,
        stack: error.stack,
        connectionCount: this.connections.size,
        timestamp: new Date().toISOString()
      });
    });

    // Handle connection-specific errors
    this.on('connectionError', ({ deviceId, error }) => {
      log.error('SMB2 connection failed:', { deviceId, error });
    });

    this.on('watchError', ({ deviceId, error }) => {
      log.error('SMB2 watch error:', { deviceId, error });
    });
  }

  async init() {
    await fs.mkdir(this.tempDir, { recursive: true });
    log.info('SMB2 Client Service initialized');
    return this;
  }

  /**
   * Create SMB2 connection config from device
   */
  getConnectionConfig(device) {
    const settings = device.connection?.settings || {};
    const credentials = settings.credentials || {};

    return {
      share: `\\\\${device.connection?.ipAddress || settings.host}\\${settings.shareName || 'share'}`,
      domain: credentials.domain || 'WORKGROUP',
      username: credentials.username || 'guest',
      password: credentials.password || '',
      autoCloseTimeout: this.connectionTimeout
    };
  }

  /**
   * Get or create a connection to a device
   */
  async getConnection(device, options = {}) {
    const deviceId = device._id?.toString() || device.deviceId;
    const { forceNew = false, skipRetry = false } = options;

    // Check for existing valid connection
    if (!forceNew) {
      const existing = this.connections.get(deviceId);
      if (existing && existing.client) {
        // Verify connection is still healthy
        const health = this.connectionHealth.get(deviceId);
        if (!health || health.healthy !== false) {
          return existing.client;
        }
        // Connection marked unhealthy, close and reconnect
        await this.closeConnection(device);
      }
    }

    const config = this.getConnectionConfig(device);

    try {
      const client = new SMB2(config);

      this.connections.set(deviceId, {
        client,
        device,
        config,
        connectedAt: new Date()
      });

      // Mark connection as healthy
      this.connectionHealth.set(deviceId, {
        healthy: true,
        lastCheck: new Date(),
        consecutiveFailures: 0
      });

      // Reset reconnect attempts on success
      this.reconnectAttempts.set(deviceId, 0);

      this.emit('connected', { deviceId, device: device.name });
      return client;
    } catch (error) {
      this.emit('connectionError', { deviceId, error: error.message });

      // Mark connection as unhealthy
      this.connectionHealth.set(deviceId, {
        healthy: false,
        lastCheck: new Date(),
        lastError: error.message,
        consecutiveFailures: (this.connectionHealth.get(deviceId)?.consecutiveFailures || 0) + 1
      });

      // Attempt auto-reconnect if enabled and not skipped
      if (this.reconnectConfig.enabled && !skipRetry) {
        return this._attemptReconnect(device, error);
      }

      throw new Error(`SMB2 connection failed: ${error.message}`);
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  async _attemptReconnect(device, originalError) {
    const deviceId = device._id?.toString() || device.deviceId;
    const attempts = (this.reconnectAttempts.get(deviceId) || 0) + 1;
    this.reconnectAttempts.set(deviceId, attempts);

    if (attempts > this.reconnectConfig.maxAttempts) {
      log.error(`[SMB2] Max reconnect attempts (${this.reconnectConfig.maxAttempts}) reached for ${deviceId}`);
      this.emit('reconnectFailed', {
        deviceId,
        deviceName: device.name,
        error: originalError.message,
        attempts,
        permanent: true
      });
      throw new Error(`SMB2 connection failed after ${attempts} attempts: ${originalError.message}`);
    }

    // Calculate exponential backoff delay
    const { baseDelayMs, maxDelayMs, backoffMultiplier } = this.reconnectConfig;
    const delay = Math.min(
      baseDelayMs * Math.pow(backoffMultiplier, attempts - 1),
      maxDelayMs
    );

    log.info(`[SMB2] Reconnecting to ${deviceId} in ${delay}ms (attempt ${attempts}/${this.reconnectConfig.maxAttempts})`);

    this.emit('reconnecting', {
      deviceId,
      deviceName: device.name,
      attempt: attempts,
      maxAttempts: this.reconnectConfig.maxAttempts,
      delayMs: delay
    });

    // Wait for backoff delay
    await new Promise(resolve => setTimeout(resolve, delay));

    // Try again with forceNew and skipRetry to avoid infinite recursion
    try {
      const client = await this.getConnection(device, { forceNew: true, skipRetry: true });

      log.info(`[SMB2] Reconnected successfully to ${deviceId} on attempt ${attempts}`);
      this.emit('reconnected', {
        deviceId,
        deviceName: device.name,
        attempts
      });

      return client;
    } catch (retryError) {
      // Recursive retry with updated attempt count
      return this._attemptReconnect(device, retryError);
    }
  }

  /**
   * Check if a connection is healthy
   */
  async checkConnectionHealth(device) {
    const deviceId = device._id?.toString() || device.deviceId;

    try {
      const result = await this.testConnection(device);

      this.connectionHealth.set(deviceId, {
        healthy: result.accessible,
        lastCheck: new Date(),
        lastError: result.error || null,
        consecutiveFailures: result.accessible ? 0 : (this.connectionHealth.get(deviceId)?.consecutiveFailures || 0) + 1
      });

      return result;
    } catch (error) {
      this.connectionHealth.set(deviceId, {
        healthy: false,
        lastCheck: new Date(),
        lastError: error.message,
        consecutiveFailures: (this.connectionHealth.get(deviceId)?.consecutiveFailures || 0) + 1
      });

      return { accessible: false, error: error.message };
    }
  }

  /**
   * Close a device connection
   */
  async closeConnection(device) {
    const deviceId = device._id?.toString() || device.deviceId;
    const existing = this.connections.get(deviceId);

    if (existing?.client) {
      try {
        await new Promise((resolve) => {
          existing.client.close((err) => {
            if (err) log.warn(`SMB2 close warning: ${err.message}`);
            resolve();
          });
        });
      } catch (e) {
      log.debug('Suppressed error', { error: e.message });
    }
      this.connections.delete(deviceId);
      this.emit('disconnected', { deviceId });
    }
  }

  /**
   * Test if a device is accessible
   */
  async testConnection(device) {
    try {
      const client = await this.getConnection(device);

      // Try to list root directory
      const files = await new Promise((resolve, reject) => {
        client.readdir('', (err, files) => {
          if (err) reject(err);
          else resolve(files);
        });
      });

      return {
        accessible: true,
        fileCount: files.length,
        share: this.getConnectionConfig(device).share
      };
    } catch (error) {
      return {
        accessible: false,
        error: error.message
      };
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(device, subpath = '') {
    const client = await this.getConnection(device);
    const normalizedPath = subpath.replace(/\//g, '\\').replace(/^\\+/, '');

    return new Promise((resolve, reject) => {
      client.readdir(normalizedPath, (err, rawFiles) => {
        if (err) {
          return reject(new Error(`Failed to list directory: ${err.message}`));
        }

        const directories = [];
        const files = [];

        // Process each entry
        const processEntries = async () => {
          for (const filename of rawFiles) {
            if (filename === '.' || filename === '..') continue;

            const fullPath = normalizedPath ? `${normalizedPath}\\${filename}` : filename;

            try {
              // Get file stats
              const stats = await this.getFileStats(client, fullPath);
              const entry = {
                name: filename,
                path: fullPath.replace(/\\/g, '/'),
                size: stats.size || 0,
                modified: stats.mtime || new Date(),
                created: stats.birthtime || stats.mtime || new Date()
              };

              if (stats.isDirectory) {
                directories.push({ ...entry, type: 'directory' });
              } else {
                const ext = path.extname(filename).toLowerCase();
                files.push({
                  ...entry,
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
              log.warn(`Could not stat ${fullPath}: ${statErr.message}`);
            }
          }

          resolve({
            currentPath: subpath || '/',
            parentPath: subpath ? path.dirname(subpath).replace(/\\/g, '/') : null,
            directories: directories.sort((a, b) => a.name.localeCompare(b.name)),
            files: files.sort((a, b) => new Date(b.modified) - new Date(a.modified)),
            totalEntries: directories.length + files.length
          });
        };

        processEntries().catch(reject);
      });
    });
  }

  /**
   * Get file statistics
   */
  async getFileStats(client, filepath) {
    return new Promise((resolve, reject) => {
      // SMB2 doesn't have a direct stat method, so we use exists + readdir to determine type
      client.exists(filepath, (err, exists) => {
        if (err || !exists) {
          return resolve({ size: 0, isDirectory: false });
        }

        // Try to read as directory to determine type
        client.readdir(filepath, (dirErr, files) => {
          if (!dirErr) {
            // It's a directory
            resolve({
              size: 0,
              isDirectory: true,
              mtime: new Date(),
              files: files?.length || 0
            });
          } else {
            // It's a file - try to get size
            resolve({
              size: 0, // SMB2 lib doesn't expose file size easily
              isDirectory: false,
              mtime: new Date()
            });
          }
        });
      });
    });
  }

  /**
   * Read a file from SMB share
   */
  async readFile(device, filepath) {
    const client = await this.getConnection(device);
    const normalizedPath = filepath.replace(/\//g, '\\').replace(/^\\+/, '');

    // Check cache first
    const cacheKey = `${device._id || device.deviceId}:${normalizedPath}`;
    const cached = this.fileCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      const stats = await fs.stat(cached.localPath).catch(() => null);
      if (stats) {
        return {
          localPath: cached.localPath,
          size: stats.size,
          fromCache: true
        };
      }
    }

    return new Promise((resolve, reject) => {
      client.readFile(normalizedPath, (err, data) => {
        if (err) {
          return reject(new Error(`Failed to read file: ${err.message}`));
        }

        // Save to temp file
        const tempFile = path.join(
          this.tempDir,
          `smb2_${Date.now()}_${path.basename(filepath)}`
        );

        fs.writeFile(tempFile, data)
          .then(() => {
            // Cache the file
            this.fileCache.set(cacheKey, {
              localPath: tempFile,
              timestamp: Date.now()
            });

            // Schedule cleanup
            setTimeout(() => {
              fs.unlink(tempFile).catch(err => log.debug('Promise error suppressed', { error: err?.message }));
              this.fileCache.delete(cacheKey);
            }, this.cacheTimeout);

            resolve({
              localPath: tempFile,
              size: data.length,
              fromCache: false,
              buffer: data
            });
          })
          .catch(reject);
      });
    });
  }

  /**
   * Write a file to SMB share
   */
  async writeFile(device, filepath, data) {
    const client = await this.getConnection(device);
    const normalizedPath = filepath.replace(/\//g, '\\').replace(/^\\+/, '');

    return new Promise((resolve, reject) => {
      client.writeFile(normalizedPath, data, (err) => {
        if (err) {
          return reject(new Error(`Failed to write file: ${err.message}`));
        }
        resolve({ success: true, path: filepath });
      });
    });
  }

  /**
   * Check if file exists
   */
  async fileExists(device, filepath) {
    const client = await this.getConnection(device);
    const normalizedPath = filepath.replace(/\//g, '\\').replace(/^\\+/, '');

    return new Promise((resolve) => {
      client.exists(normalizedPath, (err, exists) => {
        resolve(!err && exists);
      });
    });
  }

  /**
   * Create directory on SMB share
   */
  async createDirectory(device, dirpath) {
    const client = await this.getConnection(device);
    const normalizedPath = dirpath.replace(/\//g, '\\').replace(/^\\+/, '');

    return new Promise((resolve, reject) => {
      client.mkdir(normalizedPath, (err) => {
        if (err) {
          return reject(new Error(`Failed to create directory: ${err.message}`));
        }
        resolve({ success: true, path: dirpath });
      });
    });
  }

  /**
   * Delete a file from SMB share
   */
  async deleteFile(device, filepath) {
    const client = await this.getConnection(device);
    const normalizedPath = filepath.replace(/\//g, '\\').replace(/^\\+/, '');

    return new Promise((resolve, reject) => {
      client.unlink(normalizedPath, (err) => {
        if (err) {
          return reject(new Error(`Failed to delete file: ${err.message}`));
        }
        resolve({ success: true, path: filepath });
      });
    });
  }

  /**
   * Scan directory recursively for files
   */
  async scanDirectoryRecursive(device, basePath = '', options = {}) {
    const {
      maxDepth = 10,
      maxFiles = 5000,
      filePattern = null,  // Regex pattern for filename
      extensions = null,   // Array of extensions to include
      modifiedAfter = null // Only files modified after this date
    } = options;

    const results = {
      files: [],
      directories: [],
      scannedPaths: 0,
      truncated: false
    };

    const scanPath = async (currentPath, depth) => {
      if (depth > maxDepth || results.files.length >= maxFiles) {
        results.truncated = true;
        return;
      }

      try {
        const listing = await this.listDirectory(device, currentPath);
        results.scannedPaths++;

        for (const dir of listing.directories) {
          results.directories.push(dir);
          await scanPath(dir.path, depth + 1);
        }

        for (const file of listing.files) {
          // Apply filters
          if (filePattern && !new RegExp(filePattern).test(file.name)) continue;
          if (extensions && !extensions.includes(file.extension)) continue;
          if (modifiedAfter && new Date(file.modified) < modifiedAfter) continue;

          results.files.push(file);

          if (results.files.length >= maxFiles) {
            results.truncated = true;
            return;
          }
        }
      } catch (error) {
        log.warn(`Error scanning ${currentPath}: ${error.message}`);
      }
    };

    await scanPath(basePath, 0);
    return results;
  }

  /**
   * Find new files since last scan
   */
  async findNewFiles(device, basePath = '', lastScanDate) {
    return this.scanDirectoryRecursive(device, basePath, {
      modifiedAfter: lastScanDate
    });
  }

  /**
   * Watch for changes (polling-based since SMB doesn't support inotify)
   */
  startWatching(device, basePath = '', intervalMs = 30000) {
    const deviceId = device._id?.toString() || device.deviceId;
    let lastScan = new Date();
    let knownFiles = new Set();

    const pollForChanges = async () => {
      try {
        const result = await this.scanDirectoryRecursive(device, basePath, {
          maxDepth: 5,
          maxFiles: 1000
        });

        const currentFiles = new Set(result.files.map(f => f.path));

        // Find new files
        for (const file of result.files) {
          if (!knownFiles.has(file.path)) {
            this.emit('fileAdded', { deviceId, file });
          }
        }

        // Find deleted files
        for (const knownPath of knownFiles) {
          if (!currentFiles.has(knownPath)) {
            this.emit('fileRemoved', { deviceId, path: knownPath });
          }
        }

        knownFiles = currentFiles;
        lastScan = new Date();

      } catch (error) {
        this.emit('watchError', { deviceId, error: error.message });
      }
    };

    // Initial scan
    pollForChanges();

    // Set up interval
    const intervalId = setInterval(pollForChanges, intervalMs);

    return {
      stop: () => clearInterval(intervalId),
      getLastScan: () => lastScan,
      getFileCount: () => knownFiles.size
    };
  }

  /**
   * Clear file cache
   */
  async clearCache() {
    for (const [key, value] of this.fileCache) {
      try {
        await fs.unlink(value.localPath);
      } catch (cleanupError) {
      log.debug('Suppressed error', { error: cleanupError.message });
    }
    }
    this.fileCache.clear();
  }

  /**
   * Close all connections
   */
  async closeAll() {
    for (const [deviceId, conn] of this.connections) {
      try {
        if (conn.client) {
          await new Promise((resolve) => {
            conn.client.close(() => resolve());
          });
        }
      } catch (closeError) {
      log.debug('Suppressed error', { error: closeError.message });
    }
    }
    this.connections.clear();
    await this.clearCache();
  }

  /**
   * Get connection stats
   */
  getStats() {
    return {
      activeConnections: this.connections.size,
      cachedFiles: this.fileCache.size,
      reconnectConfig: this.reconnectConfig,
      connections: Array.from(this.connections.entries()).map(([id, conn]) => {
        const health = this.connectionHealth.get(id) || {};
        const reconnectAttempts = this.reconnectAttempts.get(id) || 0;

        return {
          deviceId: id,
          deviceName: conn.device?.name,
          connectedAt: conn.connectedAt,
          share: conn.config?.share,
          health: {
            healthy: health.healthy !== false,
            lastCheck: health.lastCheck,
            consecutiveFailures: health.consecutiveFailures || 0,
            lastError: health.lastError
          },
          reconnectAttempts
        };
      }),
      healthSummary: {
        total: this.connections.size,
        healthy: Array.from(this.connectionHealth.values()).filter(h => h.healthy !== false).length,
        unhealthy: Array.from(this.connectionHealth.values()).filter(h => h.healthy === false).length
      }
    };
  }

  /**
   * Update reconnect configuration
   */
  updateReconnectConfig(config) {
    Object.assign(this.reconnectConfig, config);
    return this.reconnectConfig;
  }

  /**
   * Force reconnect for a specific device
   */
  async forceReconnect(device) {
    const deviceId = device._id?.toString() || device.deviceId;

    // Reset attempts
    this.reconnectAttempts.set(deviceId, 0);

    // Close existing connection
    await this.closeConnection(device);

    // Reconnect
    return this.getConnection(device, { forceNew: true });
  }
}

// Export singleton instance
const instance = new SMB2ClientService();
module.exports = instance;
