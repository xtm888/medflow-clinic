/**
 * MedFlow Windows Agent
 *
 * Lightweight file watcher agent for Windows PCs connected to medical devices.
 * Monitors specified folders and pushes new/changed files to MedFlow API.
 *
 * Installation:
 * 1. Install Node.js on the Windows PC
 * 2. Copy this folder to the PC
 * 3. Run: npm install
 * 4. Edit config.json with your settings
 * 5. Run: node medflow-agent.js
 * 6. (Optional) Install as Windows service using node-windows
 *
 * Usage:
 * node medflow-agent.js [--config path/to/config.json] [--install-service]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { watch } = require('fs');

// =====================================================
// CONFIGURATION
// =====================================================

const DEFAULT_CONFIG = {
  // MedFlow API settings
  apiUrl: 'http://192.168.4.1:5001',  // Your MedFlow server
  deviceId: '',                        // Get from MedFlow device settings
  apiKey: '',                          // Device API key (webhook secret)

  // Folders to watch
  watchFolders: [
    // Add your device export folders here
    // 'C:\\DeviceExports\\Zeiss',
    // 'D:\\NIDEK\\Export',
  ],

  // Watch settings
  recursive: true,
  pollInterval: 5000,  // ms between checks
  stabilityDelay: 2000, // Wait for file to finish writing

  // File filters
  extensions: ['.xml', '.jpg', '.jpeg', '.png', '.bmp', '.dcm', '.dicom', '.pdf', '.csv'],
  ignorePatterns: ['temp', 'tmp', '.lock', 'thumbs.db'],

  // Upload settings
  batchSize: 10,
  retryAttempts: 3,
  retryDelay: 5000,

  // Logging
  logFile: 'medflow-agent.log',
  logLevel: 'info'  // debug, info, warn, error
};

let config = { ...DEFAULT_CONFIG };

// =====================================================
// LOGGING
// =====================================================

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function log(level, message, data = null) {
  if (LOG_LEVELS[level] < LOG_LEVELS[config.logLevel]) return;

  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  console.log(logMessage, data || '');

  // Write to log file
  if (config.logFile) {
    const logLine = data
      ? `${logMessage} ${JSON.stringify(data)}\n`
      : `${logMessage}\n`;

    fs.appendFileSync(config.logFile, logLine);
  }
}

// =====================================================
// FILE TRACKING
// =====================================================

const processedFiles = new Map();  // Track processed files
const pendingFiles = new Map();    // Files waiting to be uploaded
let isUploading = false;

function loadProcessedFiles() {
  const stateFile = 'processed-files.json';
  try {
    if (fs.existsSync(stateFile)) {
      const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      for (const [key, value] of Object.entries(data)) {
        processedFiles.set(key, value);
      }
      log('info', `Loaded ${processedFiles.size} processed file records`);
    }
  } catch (err) {
    log('warn', 'Could not load processed files state', { error: err.message });
  }
}

function saveProcessedFiles() {
  const stateFile = 'processed-files.json';
  const data = Object.fromEntries(processedFiles);
  fs.writeFileSync(stateFile, JSON.stringify(data, null, 2));
}

function getFileKey(filePath) {
  const stats = fs.statSync(filePath);
  return `${filePath}|${stats.size}|${stats.mtimeMs}`;
}

function shouldProcessFile(filePath) {
  // Check extension
  const ext = path.extname(filePath).toLowerCase();
  if (!config.extensions.includes(ext)) return false;

  // Check ignore patterns
  const lowerPath = filePath.toLowerCase();
  for (const pattern of config.ignorePatterns) {
    if (lowerPath.includes(pattern.toLowerCase())) return false;
  }

  // Check if already processed
  const fileKey = getFileKey(filePath);
  if (processedFiles.has(fileKey)) return false;

  return true;
}

// =====================================================
// API COMMUNICATION
// =====================================================

async function sendWebhook(eventType, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/api/devices/webhook/${config.deviceId}`, config.apiUrl);
    const isHttps = url.protocol === 'https:';

    const payload = JSON.stringify({
      eventType,
      timestamp: new Date().toISOString(),
      ...data
    });

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-Device-Key': config.apiKey,
        'X-Device-Id': config.deviceId
      }
    };

    const req = (isHttps ? https : http).request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body || '{}'));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function uploadFile(filePath) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/api/devices/webhook/${config.deviceId}`, config.apiUrl);
    const isHttps = url.protocol === 'https:';
    const boundary = `----MedFlowBoundary${Date.now()}`;

    const filename = path.basename(filePath);
    const relativePath = getRelativePath(filePath);
    const fileContent = fs.readFileSync(filePath);

    // Build multipart form data
    const prefix = `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      'Content-Type: application/octet-stream\r\n\r\n';

    const metadata = `\r\n--${boundary}\r\n` +
      'Content-Disposition: form-data; name="metadata"\r\n' +
      `Content-Type: application/json\r\n\r\n${
        JSON.stringify({
          eventType: 'file_created',
          filePath: relativePath,
          originalPath: filePath,
          timestamp: new Date().toISOString()
        })}`;

    const suffix = `\r\n--${boundary}--\r\n`;

    const body = Buffer.concat([
      Buffer.from(prefix),
      fileContent,
      Buffer.from(metadata),
      Buffer.from(suffix)
    ]);

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'X-Device-Key': config.apiKey,
        'X-Device-Id': config.deviceId
      }
    };

    const req = (isHttps ? https : http).request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, response: responseBody });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getRelativePath(filePath) {
  for (const folder of config.watchFolders) {
    if (filePath.startsWith(folder)) {
      return filePath.substring(folder.length).replace(/^[\\\/]/, '');
    }
  }
  return path.basename(filePath);
}

// =====================================================
// FILE PROCESSING
// =====================================================

async function processFile(filePath) {
  const fileKey = getFileKey(filePath);

  try {
    log('info', `Processing file: ${filePath}`);

    // Upload with retry
    let lastError;
    for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
      try {
        await uploadFile(filePath);
        log('info', `Uploaded successfully: ${filePath}`);

        // Mark as processed
        processedFiles.set(fileKey, {
          path: filePath,
          uploadedAt: new Date().toISOString()
        });
        saveProcessedFiles();

        return { success: true };
      } catch (err) {
        lastError = err;
        log('warn', `Upload attempt ${attempt} failed`, { error: err.message });
        if (attempt < config.retryAttempts) {
          await sleep(config.retryDelay);
        }
      }
    }

    throw lastError;
  } catch (error) {
    log('error', `Failed to process file: ${filePath}`, { error: error.message });
    return { success: false, error: error.message };
  }
}

async function processPendingFiles() {
  if (isUploading || pendingFiles.size === 0) return;

  isUploading = true;

  try {
    const files = Array.from(pendingFiles.keys()).slice(0, config.batchSize);

    for (const filePath of files) {
      await processFile(filePath);
      pendingFiles.delete(filePath);
    }
  } finally {
    isUploading = false;
  }
}

// =====================================================
// FILE WATCHING
// =====================================================

function scanFolder(folder) {
  if (!fs.existsSync(folder)) {
    log('warn', `Folder does not exist: ${folder}`);
    return;
  }

  const entries = fs.readdirSync(folder, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(folder, entry.name);

    if (entry.isDirectory() && config.recursive) {
      scanFolder(fullPath);
    } else if (entry.isFile()) {
      if (shouldProcessFile(fullPath)) {
        pendingFiles.set(fullPath, { addedAt: new Date() });
        log('debug', `Queued file: ${fullPath}`);
      }
    }
  }
}

function startWatching() {
  log('info', 'Starting file watchers...');

  const watchers = [];

  for (const folder of config.watchFolders) {
    if (!fs.existsSync(folder)) {
      log('warn', `Watch folder does not exist, skipping: ${folder}`);
      continue;
    }

    // Initial scan
    log('info', `Initial scan of: ${folder}`);
    scanFolder(folder);

    // Set up watcher
    const watcher = watch(folder, { recursive: config.recursive }, (eventType, filename) => {
      if (!filename) return;

      const fullPath = path.join(folder, filename);

      // Wait for file to stabilize
      setTimeout(() => {
        try {
          if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            if (shouldProcessFile(fullPath)) {
              pendingFiles.set(fullPath, { addedAt: new Date() });
              log('info', `New file detected: ${fullPath}`);
            }
          }
        } catch (err) {
          // File might have been deleted or is still being written
        }
      }, config.stabilityDelay);
    });

    watchers.push(watcher);
    log('info', `Watching folder: ${folder}`);
  }

  // Start processing loop
  setInterval(processPendingFiles, config.pollInterval);

  log('info', `Agent started. Watching ${watchers.length} folders.`);

  return watchers;
}

// =====================================================
// UTILITY
// =====================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadConfig() {
  // Check command line for config path
  const configArg = process.argv.find(arg => arg.startsWith('--config='));
  const configPath = configArg
    ? configArg.split('=')[1]
    : 'config.json';

  try {
    if (fs.existsSync(configPath)) {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config = { ...DEFAULT_CONFIG, ...fileConfig };
      log('info', `Loaded config from: ${configPath}`);
    } else {
      // Create default config file
      fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
      log('info', `Created default config file: ${configPath}`);
      log('warn', 'Please edit config.json with your settings and restart');
      process.exit(1);
    }
  } catch (err) {
    log('error', 'Failed to load config', { error: err.message });
    process.exit(1);
  }
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log('========================================');
  console.log('  MedFlow Windows Agent');
  console.log('========================================\n');

  loadConfig();
  loadProcessedFiles();

  // Validate config
  if (!config.deviceId) {
    log('error', 'deviceId is required in config.json');
    process.exit(1);
  }

  if (config.watchFolders.length === 0) {
    log('error', 'At least one watchFolder is required in config.json');
    process.exit(1);
  }

  // Test API connection
  log('info', 'Testing API connection...');
  try {
    await sendWebhook('agent_started', {
      hostname: require('os').hostname(),
      platform: process.platform,
      nodeVersion: process.version
    });
    log('info', 'API connection successful');
  } catch (err) {
    log('warn', 'Could not connect to API (will retry later)', { error: err.message });
  }

  // Start watching
  const watchers = startWatching();

  // Handle shutdown
  process.on('SIGINT', () => {
    log('info', 'Shutting down...');
    for (const watcher of watchers) {
      watcher.close();
    }
    saveProcessedFiles();
    process.exit(0);
  });

  log('info', 'Agent running. Press Ctrl+C to stop.');
  log('info', `Pending files: ${pendingFiles.size}`);
}

main().catch(err => {
  log('error', 'Fatal error', { error: err.message });
  process.exit(1);
});
