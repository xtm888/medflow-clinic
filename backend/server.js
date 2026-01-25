const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Redis and rate limiting
const { initializeRedis, closeConnection: closeRedis } = require('./config/redis');
const {
  apiLimiter,
  authLimiter,
  sensitiveLimiter,
  uploadLimiter,
  reportLimiter,
  searchLimiter,
  passwordResetLimiter
} = require('./middleware/rateLimiter');
const { checkTransactionSupport } = require('./utils/transactions');

// =====================================================
// ENVIRONMENT VARIABLE VALIDATION
// =====================================================
const { validateProductionEnv } = require('./utils/envValidator');

try {
  validateProductionEnv();
  console.log('✅ Environment security validation passed');
} catch (error) {
  console.error('❌ CRITICAL: Server cannot start with insecure configuration');
  console.error(error.message);
  console.error('\nTo fix, set secure values in your .env file or environment:');
  console.error('  - JWT_SECRET: At least 32 random characters');
  console.error('  - CALENDAR_ENCRYPTION_KEY: At least 32 random characters');
  console.error('  - BACKUP_ENCRYPTION_KEY: At least 32 random characters');
  console.error('\nGenerate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

// Warn about missing optional but important configs
const optionalWarnings = [];
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  optionalWarnings.push('Email (EMAIL_USER, EMAIL_PASS) - notifications will not be sent');
}
if (!process.env.FRONTEND_URL) {
  optionalWarnings.push('FRONTEND_URL - CORS may not work correctly');
}
if (optionalWarnings.length > 0) {
  console.warn('⚠️  Optional configurations missing:');
  optionalWarnings.forEach(warning => console.warn(`   - ${warning}`));
}

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const patientRoutes = require('./routes/patients');
const patientHistoryRoutes = require('./routes/patientHistory');
const appointmentRoutes = require('./routes/appointments');
const queueRoutes = require('./routes/queue');
const prescriptionRoutes = require('./routes/prescriptions');
const pharmacyRoutes = require('./routes/pharmacy');
const invoiceRoutes = require('./routes/invoices');
const ophthalmologyRoutes = require('./routes/ophthalmology');
const orthopticRoutes = require('./routes/orthoptic');
const ivtRoutes = require('./routes/ivt');
const auditRoutes = require('./routes/audit');
const settingsRoutes = require('./routes/settings');
const templateCatalogRoutes = require('./routes/templateCatalog');
const treatmentProtocolRoutes = require('./routes/treatmentProtocols');
const alertRoutes = require('./routes/alerts');
const deviceRoutes = require('./routes/devices');
const documentGenerationRoutes = require('./routes/documentGeneration');
const dashboardRoutes = require('./routes/dashboard');
const billingRoutes = require('./routes/billing');
const fiscalYearRoutes = require('./routes/fiscalYear');
const portalRoutes = require('./routes/portal');
const notificationRoutes = require('./routes/notifications');
const roomRoutes = require('./routes/rooms');
const calendarRoutes = require('./routes/calendar');
const lisRoutes = require('./routes/lis');
const clinicalAlertRoutes = require('./routes/clinicalAlerts');
const clinicalTrendRoutes = require('./routes/clinicalTrends');
const faceRecognitionRoutes = require('./routes/faceRecognition');
const imagingRoutes = require('./routes/imaging');
const labOrderRoutes = require('./routes/labOrders');
const labResultRoutes = require('./routes/labResults');
const rolePermissionRoutes = require('./routes/rolePermissions');
const consultationTemplateRoutes = require('./routes/consultationTemplates');
const referrerRoutes = require('./routes/referrers');
const companyRoutes = require('./routes/companies');
const approvalRoutes = require('./routes/approvals');
const migrationRoutes = require('./routes/migration');
const clinicRoutes = require('./routes/clinics');
const backupRoutes = require('./routes/backup');
const healthRoutes = require('./routes/health');

// New feature routes
const purchaseOrderRoutes = require('./routes/purchaseOrders');
const stockReconciliationRoutes = require('./routes/stockReconciliations');
const ivtVialRoutes = require('./routes/ivtVials');
const warrantyRoutes = require('./routes/warranties');
const repairRoutes = require('./routes/repairs');
const clinicalDecisionSupportRoutes = require('./routes/clinicalDecisionSupport');
const drugSafetyRoutes = require('./routes/drugSafety');
const labQCRoutes = require('./routes/labQC');

const { errorHandler } = require('./middleware/errorHandler');
const { metricsMiddleware, metricsEndpoint } = require('./middleware/metrics');
const logger = require('./config/logger');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { auditLogger } = require('./middleware/auditLogger');
const { incomingLogger: interServiceLogger } = require('./middleware/interServiceLogger');
const { attachToResponse } = require('./utils/apiResponse');
const alertScheduler = require('./services/alertScheduler');
const deviceSyncScheduler = require('./services/deviceSyncScheduler');
const backupScheduler = require('./services/backupScheduler');
const reservationCleanupScheduler = require('./services/reservationCleanupScheduler');
const reminderScheduler = require('./services/reminderScheduler');
const invoiceReminderScheduler = require('./services/invoiceReminderScheduler');
const paymentPlanAutoChargeService = require('./services/paymentPlanAutoChargeService');
const calendarSyncScheduler = require('./services/calendarSyncScheduler');
const visitCleanupScheduler = require('./services/visitCleanupScheduler');
const emailQueueService = require('./services/emailQueueService');
const websocketService = require('./services/websocketService');
const folderSyncService = require('./services/folderSyncService');
const Counter = require('./models/Counter');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy (required for Railway and other cloud platforms)
app.set('trust proxy', 1);

// Security middleware with relaxed CSP and CORP for images
// Only include localhost in CSP during development
const cspImgSrc = ["'self'", 'data:'];
if (process.env.NODE_ENV !== 'production') {
  cspImgSrc.push('http://localhost:5001', 'http://localhost:5173');
}

// Check if we're running with HTTPS (for HSTS and upgrade-insecure-requests)
const useHttps = process.env.FORCE_HTTPS === 'true' || process.env.USE_HTTPS === 'true';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'img-src': cspImgSrc,
      // Only upgrade insecure requests if HTTPS is enabled
      'upgrade-insecure-requests': useHttps ? [] : null
    }
  },
  // Disable HSTS for HTTP-only deployments
  hsts: useHttps ? { maxAge: 15552000, includeSubDomains: true } : false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS configuration - secured for production
const allowedOrigins = [
  'http://localhost:5173',  // Tombalbaye frontend
  'http://localhost:5174',  // Matrix frontend
  'http://localhost:5175',  // Matadi frontend
  'http://localhost:3000',
  'http://localhost:4173',  // Vite preview
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:4173',  // Vite preview
  'https://medflow-clinic.vercel.app',
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_LAN  // LAN preview for clinic testing
].filter(Boolean);

// Allow local network access for development only (192.168.x.x, 10.x.x.x)
const isLocalNetworkOrigin = (origin) => {
  if (!origin) return false;
  if (process.env.NODE_ENV === 'production') return false; // Disable in production
  return /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):\d+$/.test(origin);
};

app.use(cors({
  origin: function (origin, callback) {
    // In production, require Origin header
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        // Allow server-to-server requests with API key
        // But block browser requests without origin
        return callback(null, false);
      }
      // In development, allow requests with no origin (curl, mobile apps)
      return callback(null, true);
    }

    // In production, only allow configured FRONTEND_URL (supports comma-separated list)
    if (process.env.NODE_ENV === 'production') {
      const prodOrigins = (process.env.FRONTEND_URL || '').split(',').map(u => u.trim()).filter(Boolean);
      if (prodOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.warn(`CORS blocked origin: ${origin}`);
      return callback(new Error('Origin not allowed'), false);
    }

    // In development, allow whitelisted origins or local network IPs
    if (allowedOrigins.indexOf(origin) !== -1 || isLocalNetworkOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-XSRF-TOKEN', 'X-Requested-With', 'X-API-Key', 'X-Clinic-Id']
}));

// Cookie parser - required for HttpOnly auth cookies and CSRF
app.use(cookieParser());

// Rate limiting - Redis-backed for production scalability
// Uses Redis store for distributed rate limiting across multiple instances
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Request logging with Winston
app.use(morgan('combined', { stream: logger.stream }));

// Prometheus metrics collection
app.use(metricsMiddleware);

// Body parsing with size limits
// Default limit for most API endpoints (1MB)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Compression
app.use(compression());

// NoSQL Injection Protection - sanitizes req.body, req.query, req.params
const { noSqlInjectionProtection } = require('./middleware/noSqlInjectionProtection');
app.use(noSqlInjectionProtection({
  logBlocked: true,
  strict: process.env.NODE_ENV === 'production',
  excludePaths: ['/api/lis/webhook']  // LIS webhooks have their own auth
}));

// Payload too large error handler
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Payload too large',
      message: 'La taille de la requête dépasse la limite autorisée',
      maxSize: err.limit
    });
  }
  next(err);
});

// Route-specific body size limits middleware
const largePayloadLimit = express.json({ limit: '10mb' });
const xlPayloadLimit = express.json({ limit: '50mb' });

// Audit logging for all requests
app.use(auditLogger);

// Inter-service communication logging (for multi-clinic setup)
// Enable with LOG_INTER_SERVICE=true in environment
app.use(interServiceLogger);

// CSRF protection - validates tokens on state-changing requests
const { csrfProtection, getCsrfToken } = require('./middleware/csrf');
app.use(csrfProtection);

// CSRF token endpoint - call after login to get token cookie
app.get('/api/csrf-token', getCsrfToken);

// Standardized API response helper - adds res.api.* methods
app.use(attachToResponse);

// Health check endpoints
app.use('/health', healthRoutes);

// Prometheus metrics endpoint
app.get('/metrics', metricsEndpoint);

// Swagger API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'MedFlow API Documentation',
  customfavIcon: '/favicon.ico'
}));

// OpenAPI spec JSON endpoint
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/forgot-password', passwordResetLimiter); // Extra protection for password reset
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/patients', patientHistoryRoutes);
app.use('/api/patients/export', reportLimiter); // SECURITY: Rate limit exports to prevent bulk extraction
app.use('/api/patients/advanced-search', searchLimiter); // SECURITY: Rate limit searches
app.use('/api/appointments', appointmentRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/prescriptions', sensitiveLimiter, prescriptionRoutes); // SECURITY: Rate limit prescription operations
app.use('/api/pharmacy', sensitiveLimiter, pharmacyRoutes); // SECURITY: Rate limit pharmacy/dispensing
app.use('/api/invoices', invoiceRoutes);
app.use('/api/ophthalmology', ophthalmologyRoutes);
app.use('/api/glasses-orders', require('./routes/glassesOrders'));
app.use('/api/optical-shop', require('./routes/opticalShop'));
app.use('/api/frame-inventory', require('./routes/frameInventory'));
app.use('/api/contact-lens-inventory', require('./routes/contactLensInventory'));
app.use('/api/contact-lens-fitting', require('./routes/contactLensFitting'));
app.use('/api/optical-lens-inventory', require('./routes/opticalLensInventory'));
app.use('/api/reagent-inventory', require('./routes/reagentInventory'));
app.use('/api/lab-consumable-inventory', require('./routes/labConsumableInventory'));
app.use('/api/surgical-supply-inventory', require('./routes/surgicalSupplyInventory'));
app.use('/api/orthoptic', orthopticRoutes);
app.use('/api/ivt', ivtRoutes);
app.use('/api/surgery', require('./routes/surgery'));
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/template-catalog', templateCatalogRoutes);
app.use('/api/treatment-protocols', treatmentProtocolRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/document-generation', reportLimiter, documentGenerationRoutes); // SECURITY: Rate limit document generation
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/billing', sensitiveLimiter, billingRoutes); // SECURITY: Rate limit billing/payments
app.use('/api/fiscal-years', fiscalYearRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/sync', require('./routes/sync'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/laboratory', require('./routes/laboratory'));
app.use('/api/uploads', uploadLimiter, xlPayloadLimit, require('./routes/uploads')); // SECURITY: Rate limit file uploads
app.use('/api/calendar', calendarRoutes);
app.use('/api/lis', lisRoutes);
app.use('/api/clinical-alerts', clinicalAlertRoutes);
app.use('/api/clinical-trends', clinicalTrendRoutes);
app.use('/api/face-recognition', uploadLimiter, largePayloadLimit, faceRecognitionRoutes); // SECURITY: Rate limit biometric uploads
app.use('/api/correspondence', require('./routes/correspondence'));
app.use('/api/imaging', uploadLimiter, largePayloadLimit, imagingRoutes); // SECURITY: Rate limit imaging uploads
app.use('/api/pacs', require('./routes/pacs')); // Conquest PACS integration
app.use('/api/dicom', require('./routes/dicom')); // DICOM Bridge integration
app.use('/api/device-data', require('./routes/deviceData')); // Non-DICOM device data integration (TOPCON, Solix, Tomey)
app.use('/api/device-import/tomey', require('./routes/tomeyImport')); // Tomey auto-import service
app.use('/api/lab-orders', labOrderRoutes);
app.use('/api/lab-results', labResultRoutes);
app.use('/api/lab-analyzers', require('./routes/labAnalyzers'));
app.use('/api/reagent-lots', require('./routes/reagentLots'));
app.use('/api/unit-conversions', require('./routes/unitConversions'));
app.use('/api/role-permissions', rolePermissionRoutes);
app.use('/api/consultation-templates', consultationTemplateRoutes);
app.use('/api/fee-schedules', require('./routes/feeSchedules'));
app.use('/api/ocr', require('./routes/ocrImport'));
app.use('/api/referrers', referrerRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/external-facilities', require('./routes/externalFacilities'));
app.use('/api/fulfillment-dispatches', require('./routes/fulfillmentDispatches'));
app.use('/api/backups', sensitiveLimiter, backupRoutes); // SECURITY: Rate limit backup operations
app.use('/api/migration', sensitiveLimiter, migrationRoutes); // SECURITY: Rate limit migration operations

// CareVision legacy system integration
app.use('/api/carevision', require('./routes/careVision'));

// Medicare/Bdpharma pharmacy system integration
app.use('/api/medicare', require('./routes/medicare'));

// Multi-clinic inventory management
app.use('/api/inventory-transfers', require('./routes/inventoryTransfers'));
app.use('/api/cross-clinic-inventory', require('./routes/crossClinicInventory'));
app.use('/api/unified-inventory', require('./routes/unifiedInventory'));
app.use('/api/inventory-alerts', require('./routes/inventoryAlerts'));

// Central server proxy routes (cross-clinic data access)
app.use('/api/central', require('./routes/central'));

// ============================================
// NEW FEATURE ROUTES
// ============================================

// Inventory management - Purchase Orders & Stock Reconciliation
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/stock-reconciliations', stockReconciliationRoutes);

// IVT module - Multi-dose vial tracking
app.use('/api/ivt-vials', ivtVialRoutes);

// Optical shop - Warranty & Repair tracking
app.use('/api/warranties', warrantyRoutes);
app.use('/api/repairs', repairRoutes);

// Clinical Decision Support APIs
app.use('/api/clinical-decision-support', clinicalDecisionSupportRoutes);
app.use('/api/drug-safety', drugSafetyRoutes);
app.use('/api/lab-qc', labQCRoutes);

// Static files for imaging with CORS
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || isLocalNetworkOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use('/imaging-static', cors(corsOptions), express.static('public/imaging'));
app.use('/images_ophta', cors(corsOptions), express.static('public/images_ophta'));
app.use('/datasets', cors(corsOptions), express.static('public/datasets'));

// Production: Serve frontend static files
const frontendPath = process.env.FRONTEND_PATH || path.join(__dirname, '../matrix-frontend/dist');
if (fs.existsSync(frontendPath)) {
  console.log(`📁 Serving frontend from: ${frontendPath}`);
  app.use(express.static(frontendPath));

  // SPA catch-all: redirect all non-API routes to index.html
  app.get('*', (req, res, next) => {
    // Skip API routes and static file requests
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') ||
        req.path.startsWith('/imaging-static') || req.path.startsWith('/images_ophta') ||
        req.path.startsWith('/datasets')) {
      return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else if (process.env.NODE_ENV === 'production') {
  console.warn(`⚠️  Frontend path not found: ${frontendPath}`);
  console.warn('   Set FRONTEND_PATH environment variable to serve frontend');
}

// Error handling middleware
app.use(errorHandler);

// MongoDB connection - Force IPv4 and replica set with retry logic
const CONSTANTS = require('./config/constants');
const { connectWithRetry } = require('./utils/mongoConnection');
const mongoUri = process.env.MONGODB_URI?.replace('localhost', '127.0.0.1') || 'mongodb://127.0.0.1:27017/medflow?replicaSet=rs0';

// MongoDB connection options
const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  family: 4, // Force IPv4

  // Connection pooling for better performance
  minPoolSize: CONSTANTS.DATABASE.MIN_POOL_SIZE,
  maxPoolSize: CONSTANTS.DATABASE.MAX_POOL_SIZE,

  // Timeouts
  socketTimeoutMS: CONSTANTS.DATABASE.SOCKET_TIMEOUT_MS,
  serverSelectionTimeoutMS: CONSTANTS.DATABASE.SERVER_SELECTION_TIMEOUT_MS,
  connectTimeoutMS: CONSTANTS.DATABASE.CONNECT_TIMEOUT_MS,

  // Auto-reconnection
  retryWrites: true,
  retryReads: true
};

// Retry options for initial connection
const retryOptions = {
  maxRetries: parseInt(process.env.MONGO_MAX_RETRIES) || 10,
  initialDelayMs: parseInt(process.env.MONGO_INITIAL_DELAY_MS) || 1000,
  maxDelayMs: parseInt(process.env.MONGO_MAX_DELAY_MS) || 30000
};

connectWithRetry(mongoUri, mongoOptions, retryOptions)
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    // Initialize Redis for rate limiting and sessions
    try {
      await initializeRedis();
    } catch (err) {
      console.warn('⚠️  Redis initialization failed, using in-memory fallback:', err.message);
    }

    // Warm cache with frequently accessed data (skip in test mode)
    if (process.env.DISABLE_CACHE_WARMING !== 'true') {
      try {
        const cacheService = require('./services/cacheService');
        await cacheService.warmCache();
      } catch (err) {
        console.warn('⚠️  Cache warming failed:', err.message);
      }
    }

    // Check MongoDB transaction support
    const hasTransactions = await checkTransactionSupport();
    if (hasTransactions) {
      console.log('✅ MongoDB transactions supported');
    }

    // Start schedulers (skip in test mode)
    if (process.env.DISABLE_SCHEDULERS !== 'true') {
      alertScheduler.start();
      deviceSyncScheduler.start();
      reservationCleanupScheduler.start();
      reminderScheduler.startScheduler();
      invoiceReminderScheduler.startScheduler();
      paymentPlanAutoChargeService.startScheduler();
      calendarSyncScheduler.start();
    } else {
      console.log('⚠️ Schedulers disabled (test mode)');
    }

    // Start additional schedulers (skip in test mode)
    if (process.env.DISABLE_SCHEDULERS !== 'true') {
      visitCleanupScheduler.start();

      if (process.env.BACKUP_ENABLED !== 'false') {
        backupScheduler.start();
      }

      await emailQueueService.init();
      emailQueueService.start(30000);

      try {
        await folderSyncService.initialize();
        console.log('✅ Folder sync service initialized');
      } catch (err) {
        console.warn('⚠️  Folder sync initialization failed:', err.message);
      }

      // Initialize device data integration service for non-DICOM device monitoring
      if (process.env.DEVICE_MONITORING_ENABLED !== 'false') {
        try {
          const deviceDataIntegrationService = require('./services/deviceDataIntegrationService');
          await deviceDataIntegrationService.initialize({
            // NIDEK TONOREF III export folder (autorefractor/keratometer/tonometer)
            // Device pushes XML data to: C:\tonoref\RKT\TXT\*.xml
            tonorefPath: process.env.TONOREF_EXPORT_PATH || 'C:/tonoref',
            // TOMEY MR-6000 export folder (corneal topographer - different device!)
            tomeyPath: process.env.TOMEY_EXPORT_PATH || null,
            // TOPCON ACQUISITION folder (if configured)
            acquisitionPath: process.env.ACQUISITION_EXPORT_PATH || null,
            // SOLIX OCT folder (if configured)
            solixPath: process.env.SOLIX_EXPORT_PATH || null,
            // Default clinic ID for imports (MedFlow Clinique Principale)
            defaultClinicId: process.env.DEFAULT_CLINIC_ID || '69707e025b3cbd1d545239ef',
            // File storage path
            storagePath: process.env.DEVICE_STORAGE_PATH || 'E:/MedFlow/device-imports',
            // Auto-match patients by name/ID
            autoMatchPatients: true,
            // Polling interval for checking folders (30 seconds)
            pollInterval: 30000
          });
          await deviceDataIntegrationService.startMonitoring();
          global.deviceDataIntegrationService = deviceDataIntegrationService;
          console.log('✅ Device data integration service started');
          console.log('   TONOREF III path:', process.env.TONOREF_EXPORT_PATH || 'C:/tonoref');
        } catch (err) {
          console.warn('⚠️  Device data integration initialization failed:', err.message);
          console.warn('   Non-DICOM device data import will not be available');
        }
      }
    }

    // Initialize data sync service for multi-clinic sync (if enabled)
    if (process.env.SYNC_ENABLED === 'true') {
      try {
        const dataSyncService = require('./services/dataSyncService');
        await dataSyncService.initialize();
        console.log(`✅ Data sync service initialized for clinic: ${process.env.CLINIC_ID || 'LOCAL'}`);
        console.log(`   Central server: ${process.env.CENTRAL_SYNC_URL || 'Not configured'}`);

        // Store reference for graceful shutdown
        global.dataSyncService = dataSyncService;
      } catch (err) {
        console.warn('⚠️  Data sync initialization failed:', err.message);
        console.warn('   Multi-clinic sync will not be available');
      }
    } else {
      console.log('ℹ️  Data sync disabled (SYNC_ENABLED not set to true)');
    }

    // Schedule counter cleanup job (runs weekly to remove old counters)
    const counterCleanupInterval = setInterval(async () => {
      try {
        const deletedCount = await Counter.cleanupOldCounters(90);
        console.log(`✅ Counter cleanup: Removed ${deletedCount} old counter records`);
      } catch (error) {
        console.error('❌ Counter cleanup error:', error);
      }
    }, 7 * 24 * 60 * 60 * 1000); // Weekly (7 days)

    // Store cleanup interval for graceful shutdown
    global.counterCleanupInterval = counterCleanupInterval;

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize WebSocket (async for Redis adapter setup)
    // Use function-based origin check to support LAN IPs in development
    await websocketService.initialize(server, {
      origin: function (origin, callback) {
        // Allow requests with no origin (server-to-server, mobile apps)
        if (!origin) {
          return callback(null, true);
        }
        // Check static allowed origins
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        // In development, allow local network IPs (192.168.x.x, 10.x.x.x, etc.)
        if (process.env.NODE_ENV !== 'production' && isLocalNetworkOrigin(origin)) {
          return callback(null, true);
        }
        // Reject other origins
        console.warn(`WebSocket CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'), false);
      },
      credentials: true
    });

    // Start Inventory Alert monitoring job (cross-clinic low-stock detection)
    const { startInventoryAlertJob } = require('./jobs/inventoryAlertJob');
    const io = websocketService.getIO();
    if (process.env.INVENTORY_ALERTS_ENABLED !== 'false') {
      startInventoryAlertJob(io);
      console.log('📦 Inventory alert monitoring started');
    }

    // Start Scheduled Notification job (appointment reminders, payment reminders, etc.)
    const { startScheduledNotificationJob } = require('./jobs/scheduledNotificationJob');
    if (process.env.SCHEDULED_NOTIFICATIONS_ENABLED !== 'false') {
      startScheduledNotificationJob();
      console.log('📬 Scheduled notification processing started');
    }

    // Start Lab Penalty Check job (checks for overdue lab penalties daily)
    const { startLabPenaltyCheckJob } = require('./jobs/labPenaltyCheckJob');
    if (process.env.LAB_PENALTY_CHECK_ENABLED !== 'false') {
      startLabPenaltyCheckJob();
      console.log('💰 Lab penalty check job started');
    }

    // Start PDF Queue processor (background PDF generation)
    if (process.env.PDF_QUEUE_ENABLED !== 'false') {
      try {
        const pdfQueue = require('./jobs/pdfQueue');
        // Schedule periodic cleanup of old PDF files
        const pdfCleanupInterval = setInterval(async () => {
          try {
            await pdfQueue.cleanupOldFiles();
          } catch (err) {
            console.warn('PDF cleanup error:', err.message);
          }
        }, 60 * 60 * 1000); // Every hour
        global.pdfCleanupInterval = pdfCleanupInterval;
        global.pdfQueue = pdfQueue;
        console.log('📄 PDF queue processor started');
      } catch (err) {
        console.warn('⚠️  PDF queue initialization failed:', err.message);
        console.warn('   PDF generation will fall back to synchronous mode');
      }
    }

    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📡 API available at http://localhost:${PORT}/api`);
      console.log(`🔌 WebSocket available at ws://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Graceful shutdown helper function
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

  // Stop all schedulers
  alertScheduler.stop();
  deviceSyncScheduler.stop();
  reservationCleanupScheduler.stop();
  reminderScheduler.stopScheduler();
  invoiceReminderScheduler.stopScheduler();
  paymentPlanAutoChargeService.stopScheduler();
  calendarSyncScheduler.stop();
  backupScheduler.stop();
  emailQueueService.stop();
  await folderSyncService.shutdown();

  // Stop data sync service
  if (global.dataSyncService) {
    global.dataSyncService.stopSync();
    console.log('✅ Data sync service stopped');
  }

  // Stop counter cleanup interval
  if (global.counterCleanupInterval) {
    clearInterval(global.counterCleanupInterval);
  }

  // Stop PDF queue cleanup interval and close queue
  if (global.pdfCleanupInterval) {
    clearInterval(global.pdfCleanupInterval);
  }
  if (global.pdfQueue) {
    try {
      await global.pdfQueue.close();
      console.log('✅ PDF queue closed');
    } catch (err) {
      console.warn('PDF queue close error:', err.message);
    }
  }

  // Close Redis connection
  await closeRedis();

  // Close MongoDB connection
  await mongoose.connection.close();
  console.log('✅ All connections closed');
  process.exit(0);
};

// Handle SIGINT (Ctrl+C in terminal)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle SIGTERM (Docker/Kubernetes container stop signal)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// =====================================================
// PROCESS ERROR HANDLERS
// CRITICAL: Catch unhandled errors to prevent silent crashes
// =====================================================

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, _promise) => {
  logger.error('Unhandled Promise Rejection:', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined
  });
  // In production, you might want to exit to allow process manager to restart
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Unhandled rejection in production - exiting for restart');
    process.exit(1);
  }
});

// Handle uncaught exceptions - ALWAYS exit after these
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    message: error.message,
    stack: error.stack
  });
  console.error('❌ Uncaught exception - exiting immediately');
  // Must exit - process state is undefined after uncaught exception
  process.exit(1);
});

module.exports = app;
