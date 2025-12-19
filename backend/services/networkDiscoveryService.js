/**
 * Network Discovery Service
 *
 * Discovers medical devices on the network by:
 * 1. Scanning for SMB shares
 * 2. Detecting device types from share names and structure
 * 3. Auto-configuring Device records
 * 4. Testing connectivity and access
 */

const { exec, spawn, execFile } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const Device = require('../models/Device');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('NetworkDiscovery');
const {
  validateHost,
  validateShareName,
  validateShellSafe,
  sanitizeForFilesystem
} = require('../utils/shellSecurity');

const execAsync = util.promisify(exec);
const execFileAsync = util.promisify(execFile);

/**
 * Device detection patterns for share names
 */
const SHARE_DEVICE_PATTERNS = {
  // Zeiss devices
  zeiss: {
    patterns: ['zeiss', 'clarus', 'cirrus', 'humphrey', 'visucam', 'forum'],
    type: 'fundus-camera',
    manufacturer: 'Carl Zeiss Meditec'
  },
  // Optovue/Solix
  solix: {
    patterns: ['solix', 'optovue', 'avanti', 'angiovue'],
    type: 'oct',
    manufacturer: 'Optovue'
  },
  // TOMEY
  tomey: {
    patterns: ['tomey', 'casia', 'tms-4', 'tms-5'],
    type: 'topographer',
    manufacturer: 'Tomey'
  },
  // NIDEK
  nidek: {
    patterns: ['nidek', 'nt-', 'ark-', 'opd-', 'al-scan', 'rs-3000'],
    type: 'auto-refractor',
    manufacturer: 'NIDEK'
  },
  // Topcon
  topcon: {
    patterns: ['topcon', 'triton', 'maestro', '3d oct'],
    type: 'oct',
    manufacturer: 'Topcon'
  },
  // Heidelberg
  heidelberg: {
    patterns: ['heidelberg', 'spectralis', 'hrt', 'heyex'],
    type: 'oct',
    manufacturer: 'Heidelberg Engineering'
  },
  // Quantel
  quantel: {
    patterns: ['quantel', 'aviso', 'bscan'],
    type: 'ultrasound',
    manufacturer: 'Quantel Medical'
  },
  // Canon
  canon: {
    patterns: ['canon', 'cr-2', 'retinal'],
    type: 'fundus-camera',
    manufacturer: 'Canon'
  },
  // iCare / Revenio
  icare: {
    patterns: ['icare', 'revenio', 'tonocare'],
    type: 'tonometer',
    manufacturer: 'iCare'
  },
  // Haag-Streit
  haagstreit: {
    patterns: ['haag', 'lenstar', 'biometer'],
    type: 'biometer',
    manufacturer: 'Haag-Streit'
  }
};

/**
 * Common medical imaging folder patterns
 */
const MEDICAL_FOLDER_PATTERNS = [
  'export', 'images', 'data', 'patient', 'exam', 'study',
  'dicom', 'archive', 'backup', 'results', 'reports'
];

class NetworkDiscoveryService {
  constructor() {
    this.discoveryInProgress = false;
    this.lastDiscovery = null;
    this.discoveredShares = [];
  }

  /**
   * Get the local network range based on current IP
   * @returns {string} Network range in CIDR notation (e.g., "192.168.3.0/24")
   */
  getLocalNetworkRange() {
    const os = require('os');
    const interfaces = os.networkInterfaces();

    // Find the first non-internal IPv4 address
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          // Parse IP and create /24 range
          const parts = iface.address.split('.');
          if (parts.length === 4) {
            const networkRange = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
            log.info(`Auto-detected network: ${networkRange} (from ${iface.address})`);
            return networkRange;
          }
        }
      }
    }

    // Fallback to common private network
    log.info('Could not detect network, using fallback 192.168.1.0/24');
    return '192.168.1.0/24';
  }

  /**
   * Discover SMB shares on the network
   *
   * @param {string} networkRange - Network range to scan (e.g., "192.168.4.0/24"), or 'auto' to detect
   * @param {Object} options - Discovery options
   * @returns {Promise<Object>} - Discovery results
   */
  async discoverNetwork(networkRange = 'auto', options = {}) {
    // Auto-detect network if not specified or set to 'auto'
    if (!networkRange || networkRange === 'auto') {
      networkRange = this.getLocalNetworkRange();
    }

    if (this.discoveryInProgress) {
      return {
        success: false,
        error: 'Discovery already in progress',
        inProgress: true
      };
    }

    this.discoveryInProgress = true;
    const startTime = Date.now();

    try {
      log.info(`Starting scan of ${networkRange}`);

      // Step 1: Find hosts with SMB (port 445) open
      const hosts = await this.scanForSMBHosts(networkRange, options.timeout || 5000);
      log.info(`Found ${hosts.length} hosts with SMB`);

      // Step 2: Enumerate shares on each host (in parallel, limited concurrency)
      const allShares = [];
      const BATCH_SIZE = 10; // Process 10 hosts at a time for faster scans

      for (let i = 0; i < hosts.length; i += BATCH_SIZE) {
        const batch = hosts.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (host) => {
          try {
            const shares = await this.enumerateShares(host, options.credentials);
            return shares.map(share => ({
              ...share,
              host,
              fullPath: `//${host}/${share.name}`,
              deviceInfo: this.detectDeviceFromShare(share)
            }));
          } catch (error) {
            log.info(`Error enumerating ${host}: ${error.message}`);
            return [];
          }
        });

        const results = await Promise.all(promises);
        for (const shares of results) {
          allShares.push(...shares);
        }
      }

      log.info(`Found ${allShares.length} total shares`);

      // Step 3: Filter for likely medical device shares
      const medicalShares = allShares.filter(share =>
        share.deviceInfo.detected ||
        this.isMedicalFolder(share.name)
      );

      log.info(`Identified ${medicalShares.length} medical device shares`);

      this.discoveredShares = medicalShares;
      this.lastDiscovery = new Date();

      return {
        success: true,
        totalHosts: hosts.length,
        totalShares: allShares.length,
        medicalShares: medicalShares.length,
        shares: medicalShares,
        scanTime: Date.now() - startTime,
        timestamp: this.lastDiscovery
      };

    } catch (error) {
      log.error('[NetworkDiscovery] Discovery error:', { error: error });
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.discoveryInProgress = false;
    }
  }

  /**
   * Scan network for hosts with SMB port open
   */
  async scanForSMBHosts(networkRange, timeout = 5000) {
    const hosts = [];

    try {
      // Use native TCP connection test for each IP
      // Extract base IP and range
      const [baseIP, cidr] = networkRange.split('/');
      const baseOctets = baseIP.split('.').map(Number);

      // For /24 network, scan .1 to .254
      const promises = [];
      for (let i = 1; i <= 254; i++) {
        const ip = `${baseOctets[0]}.${baseOctets[1]}.${baseOctets[2]}.${i}`;
        promises.push(this.checkSMBPort(ip, timeout).then(open => open ? ip : null));
      }

      const results = await Promise.all(promises);
      return results.filter(Boolean);

    } catch (error) {
      log.error('[NetworkDiscovery] Port scan error:', { error: error });
      return hosts;
    }
  }

  /**
   * Check if SMB port (445) is open on host
   */
  async checkSMBPort(host, timeout = 1000) {
    return new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(445, host);
    });
  }

  /**
   * Enumerate SMB shares on a host
   */
  async enumerateShares(host, credentials = null) {
    const shares = [];
    const isMacOS = process.platform === 'darwin';

    try {
      let cmd, stdout;

      if (isMacOS) {
        // macOS: Use smbutil view
        const user = credentials?.username || 'guest';
        cmd = `smbutil view //${user}@${host} 2>/dev/null`;
        try {
          const result = await execAsync(cmd, { timeout: 8000 });
          stdout = result.stdout;
        } catch (e) {
          // Try without guest authentication
          cmd = `smbutil view //${host} 2>/dev/null`;
          const result = await execAsync(cmd, { timeout: 8000 });
          stdout = result.stdout;
        }

        // Parse smbutil output
        // Format: "Share                                                   Type"
        const lines = stdout.split('\n');
        for (const line of lines) {
          // Skip header and separator lines
          if (line.includes('Share') && line.includes('Type')) continue;
          if (line.startsWith('=') || line.startsWith('-')) continue;
          if (line.trim() === '') continue;

          // Parse share line - name is left-aligned, type at the end
          const trimmed = line.trim();
          if (trimmed) {
            // Match share name and type (Disk, Pipe, Print Svc)
            const match = trimmed.match(/^(.+?)\s{2,}(Disk|Pipe|Print)/i);
            if (match) {
              const shareName = match[1].trim();
              const shareType = match[2];
              // Skip system shares and IPC
              if (shareType.toLowerCase() === 'disk' && !shareName.endsWith('$') && shareName !== 'IPC$') {
                shares.push({
                  name: shareName,
                  type: 'Disk',
                  accessible: true
                });
              }
            }
          }
        }
      } else {
        // Linux: Use smbclient with secure argument passing
        try {
          const validHost = validateHost(host);
          const args = ['-L', `//${validHost}`, '-N'];

          if (credentials) {
            // SECURITY: Validate credentials to prevent injection
            validateShellSafe(credentials.username, 'username');
            // Use -U with argument array, password via environment
            args.splice(2, 1); // Remove -N
            args.push('-U', `${credentials.username}%${credentials.password}`);
          }

          const result = await execFileAsync('/usr/bin/smbclient', args, {
            timeout: 10000,
            env: { ...process.env, LC_ALL: 'C' }
          });
          stdout = result.stdout;
        } catch (smbError) {
          // smbclient failed, stdout may still have partial output
          stdout = smbError.stdout || '';
        }

        // Parse smbclient output
        const lines = stdout.split('\n');
        let inShareList = false;

        for (const line of lines) {
          if (line.includes('Sharename')) {
            inShareList = true;
            continue;
          }
          if (line.includes('---')) continue;
          if (line.trim() === '' || line.includes('Reconnecting')) {
            inShareList = false;
            continue;
          }

          if (inShareList) {
            const match = line.match(/^\s*(\S+)\s+(Disk|IPC|Printer)/);
            if (match && match[2] === 'Disk') {
              const shareName = match[1];
              if (!shareName.endsWith('$') && shareName !== 'IPC$') {
                shares.push({
                  name: shareName,
                  type: 'Disk',
                  accessible: true
                });
              }
            }
          }
        }
      }

    } catch (error) {
      // Fallback: probe common medical device share names
      const commonShares = [
        'Export', 'Data', 'Images', 'Patient', 'DICOM', 'Archive',
        'ZEISS', 'Solix', 'TOMEY', 'NIDEK', 'Topcon', 'working',
        'RETINO', 'OCT', 'Biometrie', 'EXAMEN', 'MICROSCOPE'
      ];

      for (const name of commonShares) {
        const accessible = await this.testShareAccess(host, name, credentials);
        if (accessible) {
          shares.push({
            name,
            type: 'Disk',
            accessible: true,
            probed: true
          });
        }
      }
    }

    return shares;
  }

  /**
   * Test if a share is accessible
   */
  async testShareAccess(host, shareName, credentials = null) {
    const isMacOS = process.platform === 'darwin';

    try {
      // SECURITY: Validate inputs to prevent command injection
      const validHost = validateHost(host);
      const validShare = validateShareName(shareName);

      if (isMacOS) {
        // macOS: Try to mount temporarily to test access
        const user = credentials?.username || 'guest';
        if (credentials?.username) {
          validateShellSafe(credentials.username, 'username');
        }

        // SECURITY: Use sanitized mount point name
        const safeMountName = `smb_test_${Date.now()}`;
        const mountPoint = `/tmp/medflow_mounts/${safeMountName}`;

        try {
          // SECURITY: Use execFile with argument arrays
          await execFileAsync('/bin/mkdir', ['-p', mountPoint], { timeout: 2000 });

          // Build SMB URL with encoded share name
          const encodedShare = encodeURIComponent(validShare);
          const smbUrl = `//${user}@${validHost}/${encodedShare}`;

          await execFileAsync('/sbin/mount_smbfs', ['-N', smbUrl, mountPoint], { timeout: 5000 });
          // Unmount immediately
          await execFileAsync('/sbin/umount', [mountPoint], { timeout: 3000 });
          await execFileAsync('/bin/rmdir', [mountPoint], { timeout: 2000 });
          return true;
        } catch {
          await execFileAsync('/bin/rmdir', [mountPoint], { timeout: 2000 }).catch(err => log.debug('Promise error suppressed', { error: err?.message }));
          return false;
        }
      } else {
        // Linux: Use smbclient with secure argument passing
        const args = [`//${validHost}/${validShare}`, '-N', '-c', 'ls'];

        if (credentials) {
          validateShellSafe(credentials.username, 'username');
          args.splice(1, 1); // Remove -N
          args.splice(1, 0, '-U', `${credentials.username}%${credentials.password}`);
        }

        await execFileAsync('/usr/bin/smbclient', args, { timeout: 5000 });
        return true;
      }
    } catch {
      return false;
    }
  }

  /**
   * Detect device type from share information
   */
  detectDeviceFromShare(share) {
    const nameLower = share.name.toLowerCase();

    for (const [deviceKey, config] of Object.entries(SHARE_DEVICE_PATTERNS)) {
      for (const pattern of config.patterns) {
        if (nameLower.includes(pattern)) {
          return {
            detected: true,
            deviceKey,
            type: config.type,
            manufacturer: config.manufacturer,
            confidence: 0.8
          };
        }
      }
    }

    // Check for generic medical patterns
    if (this.isMedicalFolder(share.name)) {
      return {
        detected: true,
        deviceKey: 'generic',
        type: 'imaging',
        manufacturer: 'Unknown',
        confidence: 0.4
      };
    }

    return {
      detected: false,
      deviceKey: null,
      type: null,
      confidence: 0
    };
  }

  /**
   * Check if folder name suggests medical imaging
   */
  isMedicalFolder(name) {
    const nameLower = name.toLowerCase();
    return MEDICAL_FOLDER_PATTERNS.some(pattern => nameLower.includes(pattern));
  }

  /**
   * Auto-create or update Device records for discovered shares
   */
  async createDevicesFromShares(shares, options = {}) {
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    for (const share of shares) {
      try {
        // Skip if no device info detected and not forcing
        if (!share.deviceInfo?.detected && !options.includeAll) {
          results.skipped++;
          continue;
        }

        const deviceData = {
          deviceId: `NET-${share.host.replace(/\./g, '-')}-${share.name}`.toUpperCase(),
          name: this.formatDeviceName(share),
          type: share.deviceInfo?.type || 'imaging',
          manufacturer: share.deviceInfo?.manufacturer || 'Unknown',
          model: share.name,
          connection: {
            type: 'network',
            ipAddress: share.host,
            protocol: 'smb'
          },
          sharedFolderPath: share.fullPath,
          integration: {
            method: 'folder-sync',
            folderSync: {
              enabled: false, // Require manual enable
              sharedFolderPath: share.fullPath,
              filePattern: '*.jpg,*.png,*.pdf,*.dcm'
            }
          },
          status: 'pending',
          active: true
        };

        // Check if device already exists
        const existing = await Device.findOne({
          $or: [
            { deviceId: deviceData.deviceId },
            { sharedFolderPath: share.fullPath }
          ]
        });

        if (existing) {
          if (options.updateExisting) {
            await Device.findByIdAndUpdate(existing._id, {
              $set: {
                name: deviceData.name,
                sharedFolderPath: share.fullPath,
                'connection.ipAddress': share.host,
                'integration.folderSync.sharedFolderPath': share.fullPath
              }
            });
            results.updated++;
          } else {
            results.skipped++;
          }
        } else {
          await Device.create(deviceData);
          results.created++;
        }

      } catch (error) {
        log.error(`[NetworkDiscovery] Error creating device for ${share.name}:`, { error: error });
        results.errors.push({
          share: share.name,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Format device name from share info
   */
  formatDeviceName(share) {
    const deviceInfo = share.deviceInfo;

    if (deviceInfo?.manufacturer && deviceInfo.manufacturer !== 'Unknown') {
      return `${deviceInfo.manufacturer} - ${share.name}`;
    }

    // Clean up share name
    return share.name
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Quick scan - just check known IPs from existing devices
   */
  async quickScan() {
    const devices = await Device.find({
      $or: [
        { 'connection.ipAddress': { $exists: true } },
        { sharedFolderPath: { $regex: /^\/\// } }
      ]
    });

    const results = [];

    for (const device of devices) {
      let ip = device.connection?.ipAddress;

      // Extract IP from share path if not in connection
      if (!ip && device.sharedFolderPath) {
        const match = device.sharedFolderPath.match(/\/\/([^\/]+)/);
        if (match) ip = match[1];
      }

      if (ip) {
        const accessible = await this.checkSMBPort(ip, 2000);
        results.push({
          deviceId: device.deviceId,
          name: device.name,
          ip,
          sharePath: device.sharedFolderPath,
          accessible,
          lastChecked: new Date()
        });

        // Update device status
        await Device.findByIdAndUpdate(device._id, {
          status: accessible ? 'connected' : 'disconnected',
          'integration.lastConnection': new Date()
        });
      }
    }

    return results;
  }

  /**
   * Probe a specific share for file structure
   */
  async probeShareStructure(sharePath, credentials = null, maxDepth = 2) {
    const structure = {
      path: sharePath,
      folders: [],
      fileTypes: {},
      sampleFiles: [],
      totalFiles: 0,
      estimatedPatients: 0
    };

    try {
      // SECURITY: Parse and validate the share path (format: //host/share)
      const shareMatch = sharePath.match(/^\/\/([^/]+)\/(.+)$/);
      if (!shareMatch) {
        throw new Error('Invalid share path format');
      }

      const validHost = validateHost(shareMatch[1]);
      const validShare = validateShareName(shareMatch[2]);
      const validSharePath = `//${validHost}/${validShare}`;

      // Use smbclient with secure argument passing
      const args = [validSharePath, '-N', '-c', 'recurse; ls'];

      if (credentials) {
        validateShellSafe(credentials.username, 'username');
        args.splice(1, 1); // Remove -N
        args.splice(1, 0, '-U', `${credentials.username}%${credentials.password}`);
      }

      const { stdout } = await execFileAsync('/usr/bin/smbclient', args, {
        timeout: 30000,
        maxBuffer: 1024 * 1024 // 1MB limit instead of piping to head
      });

      const lines = stdout.split('\n');
      const folders = new Set();
      const fileTypes = {};

      for (const line of lines) {
        // Parse file/directory entries
        const fileMatch = line.match(/^\s*(.+?)\s+[ADHRS]*\s+(\d+)\s+/);
        if (fileMatch) {
          const name = fileMatch[1].trim();
          const size = parseInt(fileMatch[2]);

          if (size === 0 && !name.includes('.')) {
            // Likely a directory
            folders.add(name);
          } else {
            // File
            const ext = path.extname(name).toLowerCase();
            if (ext) {
              fileTypes[ext] = (fileTypes[ext] || 0) + 1;
              structure.totalFiles++;

              if (structure.sampleFiles.length < 10) {
                structure.sampleFiles.push(name);
              }
            }
          }
        }
      }

      structure.folders = Array.from(folders);
      structure.fileTypes = fileTypes;
      structure.estimatedPatients = folders.size;

    } catch (error) {
      structure.error = error.message;
    }

    return structure;
  }

  /**
   * Get last discovery results
   */
  getLastDiscoveryResults() {
    return {
      shares: this.discoveredShares,
      timestamp: this.lastDiscovery,
      inProgress: this.discoveryInProgress
    };
  }
}

// Singleton instance
const networkDiscoveryService = new NetworkDiscoveryService();

module.exports = networkDiscoveryService;
