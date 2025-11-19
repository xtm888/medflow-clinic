const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

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
const doseTemplateRoutes = require('./routes/doseTemplates');
const treatmentProtocolRoutes = require('./routes/treatmentProtocols');
const consultationSessionRoutes = require('./routes/consultationSessions');
const alertRoutes = require('./routes/alerts');
const commentTemplateRoutes = require('./routes/commentTemplates');
const deviceRoutes = require('./routes/devices');
const documentGenerationRoutes = require('./routes/documentGeneration');
const dashboardRoutes = require('./routes/dashboard');
const billingRoutes = require('./routes/billing');
const portalRoutes = require('./routes/portal');
const notificationRoutes = require('./routes/notifications');

const { errorHandler } = require('./middleware/errorHandler');
const { auditLogger } = require('./middleware/auditLogger');
const alertScheduler = require('./services/alertScheduler');
const deviceSyncScheduler = require('./services/deviceSyncScheduler');
const reservationCleanupScheduler = require('./services/reservationCleanupScheduler');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy (required for Railway and other cloud platforms)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration - allow multiple origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://medflow-clinic.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting - more permissive for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 1000 requests in dev, 100 in prod
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Request logging
app.use(morgan('combined'));

// Body parsing and compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// Audit logging for all requests
app.use(auditLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    corsOrigins: allowedOrigins
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/patients', patientHistoryRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/ophthalmology', ophthalmologyRoutes);
app.use('/api/glasses-orders', require('./routes/glassesOrders'));
app.use('/api/orthoptic', orthopticRoutes);
app.use('/api/ivt', ivtRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/template-catalog', templateCatalogRoutes);
app.use('/api/dose-templates', doseTemplateRoutes);
app.use('/api/treatment-protocols', treatmentProtocolRoutes);
app.use('/api/consultation-sessions', consultationSessionRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/comment-templates', commentTemplateRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/document-generation', documentGenerationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/sync', require('./routes/sync'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/correspondence', require('./routes/correspondence'));
app.use('/api/documents', require('./routes/documents'));

// Error handling middleware
app.use(errorHandler);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB');

  // Start alert scheduler
  alertScheduler.start();

  // Start device sync scheduler
  deviceSyncScheduler.start();

  // Start reservation cleanup scheduler (CRITICAL: prevents stock lockup)
  reservationCleanupScheduler.start();

  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 API available at http://localhost:${PORT}/api`);
  });
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  alertScheduler.stop();
  deviceSyncScheduler.stop();
  reservationCleanupScheduler.stop();
  await mongoose.connection.close();
  process.exit(0);
});

module.exports = app;