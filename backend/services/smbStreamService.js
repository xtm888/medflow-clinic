/**
 * SMB Stream Service
 *
 * Provides direct streaming access to SMB shares without mounting.
 * Uses child process to run smbclient for file access.
 */

const { spawn, execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('SmbStream');
const {
  validateHost,
  validateShareName,
  validateMountPath,
  sanitizeForFilesystem
} = require('../utils/shellSecurity');

class SMBStreamService {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'medflow_smb_cache');
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
    this.fileCache = new Map();
  }

  async init() {
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  /**
   * List files in an SMB share directory
   * @param {Object} device - Device configuration
   * @param {string} subpath - Subdirectory path
   * @returns {Promise<Object>} Directory listing
   */
  async listDirectory(device, subpath = '') {
    const { host, shareName, credentials } = this.getConnectionInfo(device);

    // Validate inputs to prevent command injection
    const validHost = validateHost(host);
    const validShare = validateShareName(shareName);
    const sharePath = subpath ? subpath.replace(/\//g, '\\\\') : '';

    try {
      // Build argument array for execFile (prevents shell injection)
      const args = [];
      args.push(`//${validHost}/${validShare}`);

      if (credentials.username === 'guest') {
        args.push('-N'); // No password
      } else {
        args.push('-U', `${credentials.username}%${credentials.password || ''}`);
      }

      // Build smbclient command string for -c argument
      const smbCommand = sharePath ? `cd ${sharePath}; ls` : 'ls';
      args.push('-c', smbCommand);

      // Use execFile with argument array - no shell interpolation
      const { stdout } = await execFilePromise('/usr/bin/smbclient', args, {
        timeout: 10000,
        env: { ...process.env, SMB_NO_LOG: '1' }
      });

      return this.parseSmbListing(stdout, subpath);
    } catch (error) {
      // Fallback: try using mount_smbfs temporarily
      return this.listViaTemporaryMount(device, subpath);
    }
  }

  /**
   * List directory using temporary mount (macOS)
   */
  async listViaTemporaryMount(device, subpath = '') {
    const { host, shareName, credentials } = this.getConnectionInfo(device);

    // Validate inputs
    const validHost = validateHost(host);
    const validShare = validateShareName(shareName);
    const safeMountName = sanitizeForFilesystem(`mount_${validShare}_${Date.now()}`);
    const mountPoint = path.join(this.tempDir, safeMountName);

    try {
      await fs.mkdir(mountPoint, { recursive: true });

      // Mount temporarily using execFile with argument array
      const user = credentials.username || 'guest';
      const encodedShare = encodeURIComponent(validShare);
      const smbUrl = credentials.password
        ? `//${user}:${credentials.password}@${validHost}/${encodedShare}`
        : `//${user}@${validHost}/${encodedShare}`;

      await execFilePromise('/sbin/mount_smbfs', ['-N', smbUrl, mountPoint], { timeout: 15000 });

      // List directory
      const targetPath = path.join(mountPoint, subpath);
      const entries = await fs.readdir(targetPath, { withFileTypes: true });

      const directories = [];
      const files = [];

      for (const entry of entries) {
        const entryPath = path.join(targetPath, entry.name);
        try {
          const stats = await fs.stat(entryPath);
          const item = {
            name: entry.name,
            path: path.join(subpath, entry.name),
            size: stats.size,
            modified: stats.mtime,
            created: stats.birthtime
          };

          if (entry.isDirectory()) {
            directories.push({ ...item, type: 'directory' });
          } else {
            const ext = path.extname(entry.name).toLowerCase();
            files.push({
              ...item,
              type: 'file',
              extension: ext,
              isImage: ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff'].includes(ext),
              isPdf: ext === '.pdf',
              isXml: ext === '.xml'
            });
          }
        } catch (e) {
      log.debug('Suppressed error', { error: e.message });
    }
      }

      // Unmount using execFile
      try {
        await execFilePromise('/sbin/umount', [mountPoint], { timeout: 5000 });
        await fs.rmdir(mountPoint);
      } catch (e) {
      log.debug('Suppressed error', { error: e.message });
    }

      return {
        currentPath: subpath || '/',
        parentPath: subpath ? path.dirname(subpath) : null,
        directories: directories.sort((a, b) => a.name.localeCompare(b.name)),
        files: files.sort((a, b) => new Date(b.modified) - new Date(a.modified)),
        totalEntries: directories.length + files.length
      };

    } catch (error) {
      // Cleanup on error using execFile
      try {
        await execFilePromise('/sbin/umount', ['-f', mountPoint], { timeout: 5000 }).catch(err => log.debug('Promise error suppressed', { error: err?.message }));
        await fs.rmdir(mountPoint).catch(err => log.debug('Promise error suppressed', { error: err?.message }));
      } catch (cleanupError) {
      log.debug('Suppressed error', { error: cleanupError.message });
    }

      throw new Error(`Failed to list directory: ${error.message}`);
    }
  }

  /**
   * Stream a file from SMB share
   * @param {Object} device - Device configuration
   * @param {string} filePath - Path to file within share
   * @returns {Promise<Object>} File info and read stream
   */
  async streamFile(device, filePath) {
    const { host, shareName, credentials } = this.getConnectionInfo(device);

    // Validate inputs to prevent injection
    const validHost = validateHost(host);
    const validShare = validateShareName(shareName);

    // Check cache first
    const cacheKey = `${validHost}/${validShare}/${filePath}`;
    const cached = this.fileCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      const stats = await fs.stat(cached.localPath);
      return {
        localPath: cached.localPath,
        size: stats.size,
        fromCache: true
      };
    }

    // Download to temp location - sanitize names for filesystem
    const safeFileName = sanitizeForFilesystem(`file_${Date.now()}_${path.basename(filePath)}`);
    const safeMountName = sanitizeForFilesystem(`stream_mount_${Date.now()}`);
    const tempFile = path.join(this.tempDir, safeFileName);
    const mountPoint = path.join(this.tempDir, safeMountName);

    try {
      await fs.mkdir(mountPoint, { recursive: true });

      // Mount temporarily using execFile with argument array
      const user = credentials.username || 'guest';
      const encodedShare = encodeURIComponent(validShare);
      const smbUrl = `//${user}@${validHost}/${encodedShare}`;

      await execFilePromise('/sbin/mount_smbfs', ['-N', smbUrl, mountPoint], { timeout: 15000 });

      // Copy file to temp
      const sourcePath = path.join(mountPoint, filePath);
      await fs.copyFile(sourcePath, tempFile);

      const stats = await fs.stat(tempFile);

      // Unmount using execFile
      try {
        await execFilePromise('/sbin/umount', [mountPoint], { timeout: 5000 });
        await fs.rmdir(mountPoint);
      } catch (e) {
        // Cleanup failure is non-critical, but log for debugging
        log.warn('Failed to unmount or cleanup mount point:', e.message);
      }

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

      return {
        localPath: tempFile,
        size: stats.size,
        fromCache: false
      };

    } catch (error) {
      // Cleanup on error using execFile
      try {
        await execFilePromise('/sbin/umount', ['-f', mountPoint], { timeout: 5000 }).catch(err => log.debug('Promise error suppressed', { error: err?.message }));
        await fs.rmdir(mountPoint).catch(err => log.debug('Promise error suppressed', { error: err?.message }));
        await fs.unlink(tempFile).catch(err => log.debug('Promise error suppressed', { error: err?.message }));
      } catch (e) {
        // Best effort cleanup - log failure for debugging
        log.warn('Failed to cleanup after stream error:', e.message);
      }

      throw new Error(`Failed to stream file: ${error.message}`);
    }
  }

  /**
   * Check if share is accessible
   * @param {Object} device - Device configuration
   * @returns {Promise<boolean>}
   */
  async checkAccess(device) {
    const { host, shareName, credentials } = this.getConnectionInfo(device);

    try {
      // Quick TCP check first
      const net = require('net');
      const socket = new net.Socket();

      const tcpCheck = new Promise((resolve, reject) => {
        socket.setTimeout(3000);
        socket.connect(445, host, () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('error', () => {
          socket.destroy();
          reject(new Error('Connection failed'));
        });
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('Connection timeout'));
        });
      });

      await tcpCheck;

      // Try to list root
      await this.listDirectory(device, '');

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract connection info from device
   */
  getConnectionInfo(device) {
    const settings = device.connection?.settings || {};
    return {
      host: device.connection?.ipAddress || settings.host || settings.hostname,
      shareName: settings.shareName || 'share',
      credentials: {
        username: settings.credentials?.username || 'guest',
        password: settings.credentials?.password || '',
        domain: settings.credentials?.domain || ''
      }
    };
  }

  /**
   * Parse smbclient ls output
   */
  parseSmbListing(output, subpath) {
    const lines = output.split('\n').filter(line => line.trim());
    const directories = [];
    const files = [];

    for (const line of lines) {
      // smbclient format: "  filename                          D        0  Mon Dec  2 10:30:00 2024"
      const match = line.match(/^\s+(.+?)\s+([DAHSR]*)\s+(\d+)\s+(.+)$/);
      if (match) {
        const [, name, attrs, size, dateStr] = match;
        const trimmedName = name.trim();

        if (trimmedName === '.' || trimmedName === '..') continue;

        const isDir = attrs.includes('D');
        const item = {
          name: trimmedName,
          path: path.join(subpath, trimmedName),
          size: parseInt(size),
          modified: new Date(dateStr)
        };

        if (isDir) {
          directories.push({ ...item, type: 'directory' });
        } else {
          const ext = path.extname(trimmedName).toLowerCase();
          files.push({
            ...item,
            type: 'file',
            extension: ext,
            isImage: ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff'].includes(ext),
            isPdf: ext === '.pdf',
            isXml: ext === '.xml'
          });
        }
      }
    }

    return {
      currentPath: subpath || '/',
      parentPath: subpath ? path.dirname(subpath) : null,
      directories: directories.sort((a, b) => a.name.localeCompare(b.name)),
      files: files.sort((a, b) => new Date(b.modified) - new Date(a.modified)),
      totalEntries: directories.length + files.length
    };
  }

  /**
   * Clear all cached files
   */
  async clearCache() {
    for (const [key, value] of this.fileCache) {
      try {
        await fs.unlink(value.localPath);
      } catch (e) {
        // File may already be deleted - log for debugging
        log.warn(`Failed to delete cached file ${value.localPath}:`, e.message);
      }
    }
    this.fileCache.clear();
  }
}

module.exports = new SMBStreamService();
