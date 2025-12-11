const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Winston Logger Configuration
 *
 * Features:
 * - Structured JSON logging
 * - File rotation (10MB max per file, 10 files retained)
 * - Separate error and combined logs
 * - Permanent audit log (never rotates)
 * - Console logging in development
 * - Timestamp and service metadata
 */

// Log format with timestamp and pretty JSON
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development (human-readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, service, ...metadata }) => {
    let msg = `${timestamp} [${service}] ${level}: ${message}`;

    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }

    return msg;
  })
);

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'medflow-backend' },
  transports: [
    //
    // Error logs (only errors)
    //
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    }),

    //
    // Combined logs (all levels)
    //
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    }),

    //
    // Audit logs (critical operations - never delete)
    //
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      // No maxsize or maxFiles - keeps all audit logs forever
      tailable: true
    })
  ],

  // Don't exit on error
  exitOnError: false
});

// Console logging in non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug' // Show debug logs in development
    })
  );
} else {
  // Minimal console output in production
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.simple()),
      level: 'warn' // Only warnings and errors in production console
    })
  );
}

/**
 * Helper methods for structured logging
 */

// Log HTTP request
logger.logRequest = (req, statusCode, duration) => {
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    statusCode,
    duration: `${duration}ms`,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id
  });
};

// Log database operation
logger.logDatabase = (operation, collection, duration, error = null) => {
  if (error) {
    logger.error('Database Error', {
      operation,
      collection,
      duration: `${duration}ms`,
      error: error.message,
      stack: error.stack
    });
  } else {
    logger.debug('Database Operation', {
      operation,
      collection,
      duration: `${duration}ms`
    });
  }
};

// Log authentication event
logger.logAuth = (event, userId, details = {}) => {
  logger.info('Authentication Event', {
    event,
    userId,
    ...details,
    timestamp: new Date().toISOString()
  });
};

// Log security event (audit log)
logger.logSecurity = (event, userId, severity, details = {}) => {
  logger.warn('Security Event', {
    event,
    userId,
    severity,
    ...details,
    timestamp: new Date().toISOString()
  });
};

// Log business event (audit log)
logger.logBusiness = (event, userId, entity, entityId, action, details = {}) => {
  logger.info('Business Event', {
    event,
    userId,
    entity,
    entityId,
    action,
    ...details,
    timestamp: new Date().toISOString()
  });
};

// Log performance metric
logger.logPerformance = (metric, value, unit = 'ms') => {
  logger.debug('Performance Metric', {
    metric,
    value,
    unit,
    timestamp: new Date().toISOString()
  });
};

// Log external API call
logger.logExternalAPI = (service, endpoint, method, statusCode, duration, error = null) => {
  const logData = {
    service,
    endpoint,
    method,
    statusCode,
    duration: `${duration}ms`
  };

  if (error) {
    logger.error('External API Error', {
      ...logData,
      error: error.message
    });
  } else {
    logger.debug('External API Call', logData);
  }
};

// Log system event
logger.logSystem = (event, details = {}) => {
  logger.info('System Event', {
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
};

/**
 * Create child logger with additional context
 */
logger.child = (context) => {
  return logger.child(context);
};

/**
 * Stream for Morgan HTTP logging
 */
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger;
