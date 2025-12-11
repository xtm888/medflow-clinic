/**
 * Secure Shell Execution Utilities
 *
 * Prevents command injection vulnerabilities by:
 * 1. Validating all inputs against strict patterns
 * 2. Using execFile with argument arrays instead of shell interpolation
 * 3. Sanitizing paths and hostnames
 */

const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execFilePromise = promisify(execFile);

/**
 * Allowed characters for mount point names
 * Only alphanumeric, underscore, and hyphen
 */
const SAFE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Allowed characters for paths (alphanumeric, slash, underscore, hyphen, dot)
 * No shell metacharacters allowed
 */
const SAFE_PATH_PATTERN = /^[a-zA-Z0-9/_.-]+$/;

/**
 * Valid IP address pattern (IPv4)
 */
const IP_PATTERN = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

/**
 * Valid hostname pattern (RFC 1123)
 */
const HOSTNAME_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Shell metacharacters that could lead to command injection
 */
const SHELL_METACHARACTERS = /[;&|`$(){}[\]<>!#*?~'"\\]/;

/**
 * Validate that a string is safe for shell usage
 * @param {string} value - The value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @throws {Error} If value contains dangerous characters
 */
function validateShellSafe(value, fieldName) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }

  if (value.length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }

  if (value.length > 255) {
    throw new Error(`${fieldName} exceeds maximum length`);
  }

  if (SHELL_METACHARACTERS.test(value)) {
    throw new Error(`${fieldName} contains invalid characters`);
  }

  // Check for null bytes
  if (value.includes('\0')) {
    throw new Error(`${fieldName} contains null bytes`);
  }

  // Check for newlines (could be used to inject commands)
  if (value.includes('\n') || value.includes('\r')) {
    throw new Error(`${fieldName} contains newlines`);
  }
}

/**
 * Validate and sanitize a mount point path
 * @param {string} mountPath - The mount path to validate
 * @returns {string} - The validated path
 * @throws {Error} If path is invalid
 */
function validateMountPath(mountPath) {
  if (!mountPath || typeof mountPath !== 'string') {
    throw new Error('Mount path is required');
  }

  // Normalize and resolve the path
  const normalized = path.normalize(mountPath);

  // Check for path traversal
  if (normalized.includes('..')) {
    throw new Error('Mount path cannot contain path traversal');
  }

  // Must be an absolute path
  if (!path.isAbsolute(normalized)) {
    throw new Error('Mount path must be absolute');
  }

  // Only allow specific base directories
  const allowedBases = ['/tmp/medflow_mounts', '/Volumes'];
  const isAllowed = allowedBases.some(base => normalized.startsWith(base + '/') || normalized === base);

  if (!isAllowed) {
    throw new Error('Mount path must be in allowed directory (/tmp/medflow_mounts or /Volumes)');
  }

  // Validate against safe path pattern
  if (!SAFE_PATH_PATTERN.test(normalized)) {
    throw new Error('Mount path contains invalid characters');
  }

  return normalized;
}

/**
 * Validate hostname or IP address
 * @param {string} host - The hostname or IP to validate
 * @returns {string} - The validated host
 * @throws {Error} If host is invalid
 */
function validateHost(host) {
  if (!host || typeof host !== 'string') {
    throw new Error('Host is required');
  }

  const trimmed = host.trim();

  if (trimmed.length > 253) {
    throw new Error('Hostname too long');
  }

  // Check if it's a valid IP
  if (IP_PATTERN.test(trimmed)) {
    return trimmed;
  }

  // Check if it's a valid hostname
  if (HOSTNAME_PATTERN.test(trimmed)) {
    return trimmed;
  }

  throw new Error('Invalid hostname or IP address');
}

/**
 * Validate SMB share name
 * @param {string} shareName - The share name to validate
 * @returns {string} - The validated share name
 * @throws {Error} If share name is invalid
 */
function validateShareName(shareName) {
  if (!shareName || typeof shareName !== 'string') {
    throw new Error('Share name is required');
  }

  const trimmed = shareName.trim();

  if (trimmed.length === 0 || trimmed.length > 80) {
    throw new Error('Share name must be 1-80 characters');
  }

  // Share names can have spaces but no shell metacharacters
  validateShellSafe(trimmed.replace(/ /g, '_'), 'Share name');

  return trimmed;
}

/**
 * Safely check if a path is mounted using grep
 * @param {string} mountPath - The mount path to check
 * @returns {Promise<boolean>} - True if mounted
 */
async function isMounted(mountPath) {
  const validPath = validateMountPath(mountPath);

  try {
    // Use execFile with argument array - no shell interpolation
    const { stdout } = await execFilePromise('/usr/bin/grep', ['-F', validPath], {
      input: '', // Will be piped from mount
      timeout: 5000
    });

    // Actually need to pipe mount output to grep
    return new Promise((resolve, reject) => {
      const mount = spawn('/sbin/mount', [], { timeout: 5000 });
      const grep = spawn('/usr/bin/grep', ['-F', validPath], { timeout: 5000 });

      mount.stdout.pipe(grep.stdin);

      let output = '';
      grep.stdout.on('data', (data) => {
        output += data.toString();
      });

      grep.on('close', (code) => {
        // grep returns 0 if found, 1 if not found
        resolve(output.trim().length > 0);
      });

      grep.on('error', () => resolve(false));
      mount.on('error', () => resolve(false));

      // Set timeout for cleanup
      setTimeout(() => {
        mount.kill();
        grep.kill();
        resolve(false);
      }, 5000);
    });
  } catch (err) {
    // grep returns exit code 1 if no match - not an error
    return false;
  }
}

/**
 * Safely mount an SMB share
 * @param {object} options - Mount options
 * @param {string} options.hostname - The hostname or IP
 * @param {string} options.shareName - The share name
 * @param {string} options.mountPoint - The mount point path
 * @returns {Promise<void>}
 */
async function mountSmbShare({ hostname, shareName, mountPoint }) {
  const validHost = validateHost(hostname);
  const validShare = validateShareName(shareName);
  const validMountPoint = validateMountPath(mountPoint);

  // Build SMB URL - encode share name for URL safety
  const encodedShare = encodeURIComponent(validShare);
  const smbUrl = `//guest@${validHost}/${encodedShare}`;

  // Use execFile with argument array - prevents shell injection
  await execFilePromise('/sbin/mount_smbfs', ['-N', smbUrl, validMountPoint], {
    timeout: 30000
  });
}

/**
 * Safely unmount a path
 * @param {string} mountPoint - The mount point to unmount
 * @param {boolean} force - Whether to force unmount
 * @returns {Promise<void>}
 */
async function unmountPath(mountPoint, force = false) {
  const validPath = validateMountPath(mountPoint);

  const args = force ? ['-f', validPath] : [validPath];

  await execFilePromise('/sbin/umount', args, {
    timeout: 10000
  });
}

/**
 * Sanitize a share name for use in filesystem paths
 * @param {string} shareName - The share name to sanitize
 * @returns {string} - Sanitized name safe for filesystem
 */
function sanitizeForFilesystem(shareName) {
  if (!shareName || typeof shareName !== 'string') {
    return 'unknown';
  }

  // Replace any non-alphanumeric characters with underscore
  return shareName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 64);
}

module.exports = {
  validateShellSafe,
  validateMountPath,
  validateHost,
  validateShareName,
  isMounted,
  mountSmbShare,
  unmountPath,
  sanitizeForFilesystem,
  // Export patterns for testing
  SAFE_NAME_PATTERN,
  SAFE_PATH_PATTERN,
  IP_PATTERN,
  HOSTNAME_PATTERN
};
