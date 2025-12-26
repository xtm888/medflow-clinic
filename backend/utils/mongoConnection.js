/**
 * MongoDB Connection Utility with Retry Logic
 *
 * Provides robust MongoDB connection with:
 * - Exponential backoff retries for initial connection
 * - Automatic reconnection on disconnect
 * - Connection health monitoring
 * - Graceful degradation for offline-first scenarios
 */

const mongoose = require('mongoose');
const { createContextLogger } = require('./structuredLogger');
const log = createContextLogger('MongoConnection');

/**
 * Default connection options
 */
const DEFAULT_OPTIONS = {
  maxRetries: 10,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterMs: 500
};

/**
 * Connection state tracking
 */
let connectionState = {
  isConnected: false,
  lastConnectedAt: null,
  lastErrorAt: null,
  lastError: null,
  retryCount: 0,
  reconnectAttempts: 0
};

/**
 * Calculate delay with exponential backoff and jitter
 * @param {number} attempt - Current attempt number (0-based)
 * @param {Object} options - Retry options
 * @returns {number} - Delay in milliseconds
 */
function calculateDelay(attempt, options) {
  const { initialDelayMs, maxDelayMs, backoffMultiplier, jitterMs } = options;

  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  const baseDelay = Math.min(
    initialDelayMs * Math.pow(backoffMultiplier, attempt),
    maxDelayMs
  );

  // Add random jitter to prevent thundering herd
  const jitter = Math.random() * jitterMs;

  return Math.floor(baseDelay + jitter);
}

/**
 * Wait for specified milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Connect to MongoDB with retry logic
 *
 * @param {string} uri - MongoDB connection URI
 * @param {Object} mongooseOptions - Mongoose connection options
 * @param {Object} retryOptions - Retry configuration options
 * @returns {Promise<mongoose.Connection>} - Mongoose connection
 * @throws {Error} - If all retries exhausted
 */
async function connectWithRetry(uri, mongooseOptions = {}, retryOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...retryOptions };
  const { maxRetries } = options;

  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      connectionState.retryCount = attempt;

      if (attempt > 0) {
        const delay = calculateDelay(attempt - 1, options);
        log.info(`Retry attempt ${attempt}/${maxRetries - 1}, waiting ${delay}ms...`);
        await sleep(delay);
      }

      log.info(`Connecting to MongoDB (attempt ${attempt + 1}/${maxRetries})...`);

      await mongoose.connect(uri, mongooseOptions);

      connectionState.isConnected = true;
      connectionState.lastConnectedAt = new Date();
      connectionState.retryCount = 0;
      connectionState.lastError = null;

      log.info('MongoDB connection established successfully');

      // Set up connection event handlers
      setupConnectionHandlers(uri, mongooseOptions, options);

      return mongoose.connection;

    } catch (error) {
      lastError = error;
      connectionState.lastError = error.message;
      connectionState.lastErrorAt = new Date();

      log.error(`MongoDB connection attempt ${attempt + 1} failed: ${error.message}`);

      // Don't retry on authentication errors - they won't resolve
      if (error.message.includes('Authentication failed') ||
          error.message.includes('AuthenticationFailed')) {
        log.error('Authentication error - not retrying');
        throw error;
      }

      // Don't retry on invalid URI errors
      if (error.message.includes('Invalid connection string') ||
          error.message.includes('Invalid mongodb uri')) {
        log.error('Invalid URI - not retrying');
        throw error;
      }
    }
  }

  // All retries exhausted
  const exhaustedError = new Error(
    `MongoDB connection failed after ${maxRetries} attempts. Last error: ${lastError?.message}`
  );
  exhaustedError.cause = lastError;
  throw exhaustedError;
}

/**
 * Set up connection event handlers for reconnection
 * @param {string} uri - MongoDB URI
 * @param {Object} mongooseOptions - Mongoose options
 * @param {Object} retryOptions - Retry options
 */
function setupConnectionHandlers(uri, mongooseOptions, retryOptions) {
  const connection = mongoose.connection;

  // Remove existing listeners to prevent duplicates
  connection.removeAllListeners('disconnected');
  connection.removeAllListeners('error');
  connection.removeAllListeners('reconnected');

  // Handle disconnection
  connection.on('disconnected', () => {
    connectionState.isConnected = false;
    log.warn('MongoDB disconnected');

    // Mongoose will attempt to reconnect automatically with the configured options
    // But we log the event for monitoring
  });

  // Handle connection errors
  connection.on('error', (err) => {
    connectionState.lastError = err.message;
    connectionState.lastErrorAt = new Date();
    log.error(`MongoDB connection error: ${err.message}`);
  });

  // Handle successful reconnection
  connection.on('reconnected', () => {
    connectionState.isConnected = true;
    connectionState.lastConnectedAt = new Date();
    connectionState.reconnectAttempts++;
    log.info('MongoDB reconnected');
  });

  // Handle reconnection failures
  connection.on('reconnectFailed', () => {
    log.error('MongoDB reconnection failed after max attempts');
    // In production, you might want to alert or restart
  });
}

/**
 * Get current connection state
 * @returns {Object} - Connection state
 */
function getConnectionState() {
  return {
    ...connectionState,
    mongooseState: mongoose.connection.readyState,
    mongooseStateName: getReadyStateName(mongoose.connection.readyState)
  };
}

/**
 * Convert mongoose ready state to name
 * @param {number} state - Mongoose ready state
 * @returns {string} - State name
 */
function getReadyStateName(state) {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return states[state] || 'unknown';
}

/**
 * Check if database is connected and healthy
 * @returns {Promise<boolean>}
 */
async function isHealthy() {
  try {
    if (mongoose.connection.readyState !== 1) {
      return false;
    }

    // Run a simple command to verify connection
    await mongoose.connection.db.admin().ping();
    return true;

  } catch (error) {
    log.error(`Health check failed: ${error.message}`);
    return false;
  }
}

/**
 * Gracefully close the MongoDB connection
 * @returns {Promise<void>}
 */
async function closeConnection() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      connectionState.isConnected = false;
      log.info('MongoDB connection closed');
    }
  } catch (error) {
    log.error(`Error closing MongoDB connection: ${error.message}`);
    throw error;
  }
}

module.exports = {
  connectWithRetry,
  getConnectionState,
  isHealthy,
  closeConnection,
  DEFAULT_OPTIONS
};
