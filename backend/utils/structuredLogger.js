/**
 * Structured Logger Utility
 *
 * Provides consistent, structured logging to replace 5000+ console.log statements.
 * Uses Winston for proper log levels, timestamps, and output formatting.
 */

const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
    const ctx = context ? `[${context}]` : '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level.toUpperCase()} ${ctx} ${message}${metaStr}`;
  })
);

// JSON format for production
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create base logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? jsonFormat : logFormat,
  defaultMeta: { service: 'medflow-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        logFormat
      )
    })
  ]
});

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  const logsDir = process.env.LOG_DIR || path.join(__dirname, '../../logs');

  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: jsonFormat
  }));

  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: jsonFormat
  }));
}

/**
 * Create a context-aware logger
 * @param {string} context - Logger context (e.g., 'Invoice', 'Patient', 'Auth')
 * @returns {Object} - Logger with context
 *
 * @example
 * const log = createContextLogger('Invoice');
 * log.info('Created invoice', { invoiceId: '123' });
 * // Output: 2024-01-01 12:00:00 INFO [Invoice] Created invoice {"invoiceId":"123"}
 */
const createContextLogger = (context) => ({
  info: (message, meta = {}) => logger.info(message, { context, ...meta }),
  warn: (message, meta = {}) => logger.warn(message, { context, ...meta }),
  error: (message, meta = {}) => logger.error(message, { context, ...meta }),
  debug: (message, meta = {}) => logger.debug(message, { context, ...meta }),
  verbose: (message, meta = {}) => logger.verbose(message, { context, ...meta })
});

// Pre-defined context loggers for common modules
const loggers = {
  auth: createContextLogger('Auth'),
  patient: createContextLogger('Patient'),
  invoice: createContextLogger('Invoice'),
  appointment: createContextLogger('Appointment'),
  queue: createContextLogger('Queue'),
  prescription: createContextLogger('Prescription'),
  pharmacy: createContextLogger('Pharmacy'),
  device: createContextLogger('Device'),
  sync: createContextLogger('Sync'),
  api: createContextLogger('API')
};

module.exports = {
  logger,
  createContextLogger,
  ...loggers
};
