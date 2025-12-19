const promClient = require('prom-client');
const logger = require('../config/logger');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('Metrics');

/**
 * Prometheus Metrics Middleware
 *
 * Provides comprehensive application metrics for monitoring:
 * - HTTP request metrics (duration, count by route/status)
 * - Active connections
 * - Database query metrics
 * - Business metrics (patients, invoices, etc.)
 * - Default Node.js metrics (memory, CPU, etc.)
 */

// Create a Registry
const register = new promClient.Registry();

// Add default Node.js metrics (memory, CPU, event loop, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'medflow_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
});

// =========================================
// HTTP Metrics
// =========================================

const httpRequestDuration = new promClient.Histogram({
  name: 'medflow_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10] // 10ms to 10s
});

const httpRequestTotal = new promClient.Counter({
  name: 'medflow_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestSizeBytes = new promClient.Histogram({
  name: 'medflow_http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000] // 100B to 1MB
});

const httpResponseSizeBytes = new promClient.Histogram({
  name: 'medflow_http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000]
});

// =========================================
// Connection Metrics
// =========================================

const activeConnections = new promClient.Gauge({
  name: 'medflow_active_connections',
  help: 'Number of active HTTP connections'
});

const websocketConnections = new promClient.Gauge({
  name: 'medflow_websocket_connections',
  help: 'Number of active WebSocket connections'
});

// =========================================
// Database Metrics
// =========================================

const dbQueryDuration = new promClient.Histogram({
  name: 'medflow_db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'collection'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2] // 1ms to 2s
});

const dbQueryTotal = new promClient.Counter({
  name: 'medflow_db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'collection', 'status']
});

const dbConnectionPoolSize = new promClient.Gauge({
  name: 'medflow_db_connection_pool_size',
  help: 'Current database connection pool size'
});

// =========================================
// Business Metrics
// =========================================

const patientsTotal = new promClient.Gauge({
  name: 'medflow_patients_total',
  help: 'Total number of patients in the system'
});

const appointmentsToday = new promClient.Gauge({
  name: 'medflow_appointments_today',
  help: 'Number of appointments scheduled for today'
});

const queueLength = new promClient.Gauge({
  name: 'medflow_queue_length',
  help: 'Number of patients in queue',
  labelNames: ['department', 'status']
});

const invoicesUnpaid = new promClient.Gauge({
  name: 'medflow_invoices_unpaid',
  help: 'Number of unpaid invoices'
});

const prescriptionsDispensed = new promClient.Counter({
  name: 'medflow_prescriptions_dispensed_total',
  help: 'Total number of prescriptions dispensed',
  labelNames: ['type']
});

// =========================================
// Cache Metrics
// =========================================

const cacheHits = new promClient.Counter({
  name: 'medflow_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_name']
});

const cacheMisses = new promClient.Counter({
  name: 'medflow_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_name']
});

// =========================================
// Error Metrics
// =========================================

const errors = new promClient.Counter({
  name: 'medflow_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'severity']
});

const httpErrors = new promClient.Counter({
  name: 'medflow_http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'status_code']
});

// =========================================
// Register all metrics
// =========================================

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(httpRequestSizeBytes);
register.registerMetric(httpResponseSizeBytes);
register.registerMetric(activeConnections);
register.registerMetric(websocketConnections);
register.registerMetric(dbQueryDuration);
register.registerMetric(dbQueryTotal);
register.registerMetric(dbConnectionPoolSize);
register.registerMetric(patientsTotal);
register.registerMetric(appointmentsToday);
register.registerMetric(queueLength);
register.registerMetric(invoicesUnpaid);
register.registerMetric(prescriptionsDispensed);
register.registerMetric(cacheHits);
register.registerMetric(cacheMisses);
register.registerMetric(errors);
register.registerMetric(httpErrors);

// =========================================
// Middleware Functions
// =========================================

/**
 * HTTP Metrics Middleware
 */
function metricsMiddleware(req, res, next) {
  const start = Date.now();

  // Increment active connections
  activeConnections.inc();

  // Track request size
  const requestSize = parseInt(req.get('content-length') || 0, 10);
  if (requestSize > 0) {
    const route = req.route ? req.route.path : req.path;
    httpRequestSizeBytes.observe({ method: req.method, route }, requestSize);
  }

  // Track response
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    const route = req.route ? req.route.path : req.path;

    // Record metrics
    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode },
      duration
    );

    httpRequestTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode
    });

    // Track response size
    const responseSize = parseInt(res.get('content-length') || 0, 10);
    if (responseSize > 0) {
      httpResponseSizeBytes.observe(
        { method: req.method, route, status_code: res.statusCode },
        responseSize
      );
    }

    // Track errors
    if (res.statusCode >= 400) {
      httpErrors.inc({
        method: req.method,
        route,
        status_code: res.statusCode
      });

      if (res.statusCode >= 500) {
        errors.inc({ type: 'http_error', severity: 'error' });
      } else {
        errors.inc({ type: 'http_error', severity: 'warning' });
      }
    }

    // Decrement active connections
    activeConnections.dec();

    // Log slow requests
    if (duration > 1) {
      logger.warn('Slow HTTP request', {
        method: req.method,
        route,
        duration: `${duration.toFixed(3)}s`,
        statusCode: res.statusCode
      });
    }
  });

  next();
}

/**
 * Metrics Endpoint
 */
async function metricsEndpoint(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (error) {
    logger.error('Error generating metrics', { error: error.message });
    res.status(500).send('Error generating metrics');
  }
}

/**
 * Update business metrics (called periodically)
 */
async function updateBusinessMetrics() {
  try {
    const mongoose = require('mongoose');

    // Only update if connected
    if (mongoose.connection.readyState !== 1) {
      return;
    }

    const Patient = require('../models/Patient');
    const Appointment = require('../models/Appointment');
    const Invoice = require('../models/Invoice');

    // Total patients
    try {
      const patientCount = await Patient.countDocuments({ isActive: true });
      patientsTotal.set(patientCount);
    } catch (error) {
      logger.debug('Could not update patient count metric', { error: error.message });
    }

    // Today's appointments
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayAppointments = await Appointment.countDocuments({
        appointmentDate: { $gte: today, $lt: tomorrow }
      });
      appointmentsToday.set(todayAppointments);
    } catch (error) {
      logger.debug('Could not update appointments metric', { error: error.message });
    }

    // Unpaid invoices
    try {
      const unpaidInvoices = await Invoice.countDocuments({
        status: { $in: ['unpaid', 'partially_paid'] }
      });
      invoicesUnpaid.set(unpaidInvoices);
    } catch (error) {
      logger.debug('Could not update invoices metric', { error: error.message });
    }

    // DB connection pool size
    try {
      const poolSize = mongoose.connection.db.serverConfig.s.poolSize || 0;
      dbConnectionPoolSize.set(poolSize);
    } catch (error) {
      log.debug('Suppressed error', { error: error.message });
    }

  } catch (error) {
    logger.error('Error updating business metrics', { error: error.message });
  }
}

// Update business metrics every 60 seconds (skip in test mode)
if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_SCHEDULERS !== 'true') {
  setInterval(updateBusinessMetrics, 60000);
}

// =========================================
// Exported Metrics Object
// =========================================

module.exports = {
  metricsMiddleware,
  metricsEndpoint,
  register,
  metrics: {
    httpRequestDuration,
    httpRequestTotal,
    httpRequestSizeBytes,
    httpResponseSizeBytes,
    activeConnections,
    websocketConnections,
    dbQueryDuration,
    dbQueryTotal,
    dbConnectionPoolSize,
    patientsTotal,
    appointmentsToday,
    queueLength,
    invoicesUnpaid,
    prescriptionsDispensed,
    cacheHits,
    cacheMisses,
    errors,
    httpErrors
  },
  updateBusinessMetrics
};
