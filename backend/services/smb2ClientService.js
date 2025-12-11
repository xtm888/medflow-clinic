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

class SMB2ClientService extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map();  // Cache active connections
    this.connectionTimeout = 30000;  // 30 second timeout
    this.maxRetries = 3;
    this.tempDir = path.join(os.tmpdir(), 'medflow_smb2_cache');
    this.fileCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000;  // 5 minute cache
  }

  async init() {
    await fs.mkdir(this.tempDir, { recursive: true });
    console.log('SMB2 Client Service initialized');
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
  async getConnection(device) {
    const deviceId = device._id?.toString() || device.deviceId;

    // Check for existing valid connection
    const existing = this.connections.get(deviceId);
    if (existing && existing.client) {
      return existing.client;
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

      this.emit('connected', { deviceId, device: device.name });
      return client;
    } catch (error) {
      this.emit('connectionError', { deviceId, error: error.message });
      throw new Error(`SMB2 connection failed: ${error.message}`);
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
            if (err) console.warn(`SMB2 close warning: ${err.message}`);
            resolve();
          });
        });
      } catch (e) {
        // Ignore close errors
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
              console.warn(`Could not stat ${fullPath}: ${statErr.message}`);
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
              fs.unlink(tempFile).catch(() => {});
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
        console.warn(`Error scanning ${currentPath}: ${error.message}`);
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
        // Ignore file deletion errors during cache cleanup
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
        // Ignore connection close errors during shutdown
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
      connections: Array.from(this.connections.entries()).map(([id, conn]) => ({
        deviceId: id,
        deviceName: conn.device?.name,
        connectedAt: conn.connectedAt,
        share: conn.config?.share
      }))
    };
  }
}

// Export singleton instance
const instance = new SMB2ClientService();
module.exports = instance;
