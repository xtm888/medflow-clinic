const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { errorHandler } = require('./middleware/errorHandler');

// Import routes
const syncRoutes = require('./routes/sync');
const clinicRoutes = require('./routes/clinics');
const patientRoutes = require('./routes/patients');
const inventoryRoutes = require('./routes/inventory');
const reportRoutes = require('./routes/reports');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Clinic-ID', 'X-Sync-Token', 'X-Master-Token']
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'central-server',
    version: '1.0.0',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// API Routes
app.use('/api/sync', syncRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportRoutes);

// Dashboard summary endpoint (combines multiple reports)
app.get('/api/dashboard', async (req, res) => {
  try {
    const ClinicRegistry = require('./models/ClinicRegistry');
    const CentralPatient = require('./models/CentralPatient');
    const CentralInventory = require('./models/CentralInventory');
    const CentralInvoice = require('./models/CentralInvoice');

    const [
      clinics,
      patientStats,
      inventoryAlerts,
      transferRecommendations,
      financialSummary
    ] = await Promise.all([
      ClinicRegistry.find({ status: 'active' })
        .select('clinicId name shortName connection.lastSeenAt stats')
        .lean(),
      CentralPatient.aggregate([
        { $group: { _id: null, total: { $sum: 1 } } }
      ]),
      CentralInventory.find({
        $or: [
          { status: 'out-of-stock' },
          { status: 'low-stock' }
        ]
      }).limit(10).lean(),
      CentralInventory.getTransferRecommendations(5),
      CentralInvoice.aggregate([
        {
          $match: {
            'invoiceDate': {
              $gte: new Date(new Date().setDate(new Date().getDate() - 30))
            }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total.grandTotal' },
            totalPaid: { $sum: '$payment.amountPaid' },
            invoiceCount: { $sum: 1 }
          }
        }
      ])
    ]);

    // Calculate clinic online status
    const clinicsWithStatus = clinics.map(c => ({
      ...c,
      isOnline: c.connection?.lastSeenAt
        ? (new Date() - new Date(c.connection.lastSeenAt)) < 5 * 60 * 1000
        : false
    }));

    res.json({
      success: true,
      dashboard: {
        clinics: {
          total: clinicsWithStatus.length,
          online: clinicsWithStatus.filter(c => c.isOnline).length,
          list: clinicsWithStatus
        },
        patients: {
          total: patientStats[0]?.total || 0
        },
        inventory: {
          alerts: inventoryAlerts.length,
          alertItems: inventoryAlerts,
          transferRecommendations
        },
        financial: financialSummary[0] || {
          totalRevenue: 0,
          totalPaid: 0,
          invoiceCount: 0
        }
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Error handler
app.use(errorHandler);

// MongoDB connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Create indexes on startup
    const ClinicRegistry = require('./models/ClinicRegistry');
    const CentralPatient = require('./models/CentralPatient');
    const CentralInventory = require('./models/CentralInventory');
    const CentralInvoice = require('./models/CentralInvoice');
    const CentralVisit = require('./models/CentralVisit');

    await Promise.all([
      ClinicRegistry.createIndexes(),
      CentralPatient.createIndexes(),
      CentralInventory.createIndexes(),
      CentralInvoice.createIndexes(),
      CentralVisit.createIndexes()
    ]);

    console.log('Database indexes created');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const PORT = process.env.PORT || 5002;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  CENTRAL SYNC SERVER                          ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:    Running                                           ║
║  Port:      ${PORT}                                              ║
║  Mode:      ${process.env.NODE_ENV || 'development'}                                    ║
╠═══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                   ║
║    /api/sync       - Data synchronization                     ║
║    /api/clinics    - Clinic management                        ║
║    /api/patients   - Cross-clinic patient search              ║
║    /api/inventory  - Consolidated inventory                   ║
║    /api/reports    - Financial reports                        ║
║    /api/dashboard  - Combined dashboard data                  ║
║    /health         - Health check                             ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  });
});

module.exports = app;
