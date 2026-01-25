const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const logger = require('../config/logger');

// Models
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const User = require('../models/User');
const SyncQueue = require('../models/SyncQueue');
const Visit = require('../models/Visit');
const Invoice = require('../models/Invoice');
const Document = require('../models/Document');
const Inventory = require('../models/Inventory');
// Clinical workflow models for sync
const SurgeryCase = require('../models/SurgeryCase');
const SurgeryReport = require('../models/SurgeryReport');
const GlassesOrder = require('../models/GlassesOrder');
const LabOrder = require('../models/LabOrder');
const IVTInjection = require('../models/IVTInjection');
const LabResult = require('../models/LabResult');
const DeviceImage = require('../models/DeviceImage');
// Additional models for frontend sync compatibility
const OrthopticExam = require('../models/OrthopticExam');
const Clinic = require('../models/Clinic');
const Approval = require('../models/Approval');
const StockReconciliation = require('../models/StockReconciliation');
const TreatmentProtocol = require('../models/TreatmentProtocol');
const IVTVial = require('../models/IVTVial');
const Device = require('../models/Device');

// Sync models mapping - matches SyncQueue.collection enum
const modelMap = {
  patients: Patient,
  appointments: Appointment,
  prescriptions: Prescription,
  ophthalmologyExams: OphthalmologyExam,
  users: User,
  visits: Visit,
  invoices: Invoice,
  documents: Document,
  inventories: Inventory,
  // Clinical workflow entities
  surgeryCases: SurgeryCase,
  surgeryReports: SurgeryReport,
  glassesOrders: GlassesOrder,
  labOrders: LabOrder,
  ivtInjections: IVTInjection,
  laboratoryResults: LabResult,
  imagingStudies: DeviceImage,
  // Additional entities for frontend sync compatibility
  labResults: LabResult, // Alias for laboratoryResults
  orthopticExams: OrthopticExam,
  clinics: Clinic,
  approvals: Approval,
  stockReconciliations: StockReconciliation,
  treatmentProtocols: TreatmentProtocol,
  ivtVials: IVTVial,
  devices: Device,
  // Inventory subtypes - filtered queries (use inventories model with type filter)
  pharmacyInventory: Inventory,
  frameInventory: Inventory,
  contactLensInventory: Inventory
};

// Entities that should be silently skipped (virtual/calculated, not real models)
const skippedEntities = new Set(['queue']);

// Inventory type mapping for subtype filtering
const inventoryTypeMap = {
  pharmacyInventory: ['medication', 'drug', 'pharmaceutical'],
  frameInventory: ['frame', 'eyewear'],
  contactLensInventory: ['contact_lens', 'lens']
};

// Clinic ID from environment
const CLINIC_ID = process.env.CLINIC_ID || 'LOCAL';

// @desc    Pull changes from server
// @route   POST /api/sync/pull
// @access  Private
router.post('/pull', protect, async (req, res) => {
  try {
    const { lastSync, entities } = req.body;

    if (!lastSync || !entities) {
      return res.status(400).json({
        success: false,
        error: 'Please provide lastSync timestamp and entities'
      });
    }

    const syncDate = new Date(lastSync);
    const changes = {};

    // Get changes for each requested entity
    for (const entity of entities) {
      // Skip known virtual entities silently
      if (skippedEntities.has(entity)) {
        continue;
      }

      const Model = modelMap[entity];

      if (!Model) {
        // Log at debug level to reduce noise - this is expected for deprecated entities
        logger.debug(`[Sync] Unknown entity requested: ${entity} - skipping`);
        continue;
      }

      // Build query with optional inventory type filter
      const query = { updatedAt: { $gt: syncDate } };

      if (inventoryTypeMap[entity]) {
        query.type = { $in: inventoryTypeMap[entity] };
      }

      // Get records modified since last sync
      const records = await Model.find(query).lean();

      if (records.length > 0) {
        changes[entity] = records.map(record => ({
          ...record,
          id: record._id.toString(),
          lastModified: record.updatedAt
        }));
      }
    }

    res.json({
      success: true,
      changes,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sync pull error:', error);
    res.status(500).json({
      success: false,
      error: 'Error syncing data'
    });
  }
});

// @desc    Push changes to server
// @route   POST /api/sync/push
// @access  Private
router.post('/push', protect, async (req, res) => {
  try {
    const { changes } = req.body;

    if (!changes || !Array.isArray(changes)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide changes array'
      });
    }

    const results = [];
    const conflicts = [];

    for (const change of changes) {
      const { operation, entity, entityId, data, timestamp } = change;
      const Model = modelMap[entity];

      if (!Model) {
        results.push({
          id: entityId,
          status: 'error',
          error: 'Unknown entity'
        });
        continue;
      }

      try {
        let result;

        switch (operation) {
          case 'CREATE':
            // Create new record
            const newRecord = await Model.create({
              ...data,
              createdBy: req.user._id,
              updatedBy: req.user._id
            });

            results.push({
              id: entityId,
              newId: newRecord._id.toString(),
              status: 'success'
            });
            break;

          case 'UPDATE':
            // Check for conflicts
            const existing = await Model.findById(entityId);

            if (!existing) {
              results.push({
                id: entityId,
                status: 'error',
                error: 'Record not found'
              });
              continue;
            }

            // Check if server version is newer
            if (existing.updatedAt > new Date(timestamp)) {
              conflicts.push({
                id: entityId,
                entity,
                clientData: data,
                serverData: existing.toObject(),
                serverTimestamp: existing.updatedAt,
                clientTimestamp: timestamp
              });

              results.push({
                id: entityId,
                status: 'conflict'
              });
              continue;
            }

            // Update record
            await Model.findByIdAndUpdate(
              entityId,
              {
                ...data,
                updatedBy: req.user._id
              },
              { new: true }
            );

            results.push({
              id: entityId,
              status: 'success'
            });
            break;

          case 'DELETE':
            // Soft delete if supported, otherwise hard delete
            if (Model.schema.paths.isDeleted) {
              await Model.findByIdAndUpdate(entityId, {
                isDeleted: true,
                deletedBy: req.user._id,
                deletedAt: new Date()
              });
            } else {
              await Model.findByIdAndDelete(entityId);
            }

            results.push({
              id: entityId,
              status: 'success'
            });
            break;

          default:
            results.push({
              id: entityId,
              status: 'error',
              error: 'Unknown operation'
            });
        }
      } catch (error) {
        results.push({
          id: entityId,
          status: 'error',
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      results,
      conflicts,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sync push error:', error);
    res.status(500).json({
      success: false,
      error: 'Error pushing changes'
    });
  }
});

// @desc    Resolve conflict
// @route   POST /api/sync/resolve
// @access  Private
router.post('/resolve', protect, async (req, res) => {
  try {
    const { entity, entityId, resolution, resolvedData } = req.body;

    const Model = modelMap[entity];

    if (!Model) {
      return res.status(400).json({
        success: false,
        error: 'Unknown entity'
      });
    }

    // Apply resolution
    await Model.findByIdAndUpdate(
      entityId,
      {
        ...resolvedData,
        updatedBy: req.user._id,
        conflictResolved: true,
        conflictResolvedAt: new Date()
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Conflict resolved successfully'
    });
  } catch (error) {
    console.error('Conflict resolution error:', error);
    res.status(500).json({
      success: false,
      error: 'Error resolving conflict'
    });
  }
});

// @desc    Get sync status
// @route   GET /api/sync/status
// @access  Private
router.get('/status', protect, async (req, res) => {
  try {
    const stats = {};

    // Get count for each entity
    for (const [entity, Model] of Object.entries(modelMap)) {
      stats[entity] = await Model.countDocuments();
    }

    // Get sync queue stats
    const queueStats = await SyncQueue.getStats(CLINIC_ID);

    // Get last sync timestamp from metadata
    const mongoose = require('mongoose');
    const SyncMeta = mongoose.connection.collection('sync_metadata');
    const lastPullMeta = await SyncMeta.findOne({ key: 'lastPullTimestamp' });

    res.json({
      success: true,
      clinicId: CLINIC_ID,
      syncEnabled: process.env.SYNC_ENABLED === 'true',
      centralUrl: process.env.CENTRAL_SYNC_URL || null,
      stats,
      queue: queueStats,
      lastPullTimestamp: lastPullMeta?.value || null,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({
      success: false,
      error: 'Error getting sync status'
    });
  }
});

// @desc    Get clinic sync queue
// @route   GET /api/sync/queue
// @access  Private
router.get('/queue', protect, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;

    const query = { clinicId: CLINIC_ID };
    if (status) {
      query.status = status;
    }

    const items = await SyncQueue.find(query)
      .sort({ priority: 1, createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      items,
      count: items.length
    });
  } catch (error) {
    console.error('Sync queue error:', error);
    res.status(500).json({
      success: false,
      error: 'Error getting sync queue'
    });
  }
});

// @desc    Get unresolved conflicts
// @route   GET /api/sync/conflicts
// @access  Private
router.get('/conflicts', protect, async (req, res) => {
  try {
    const conflicts = await SyncQueue.find({
      clinicId: CLINIC_ID,
      status: 'conflict',
      'conflict.resolution': 'pending'
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      conflicts,
      count: conflicts.length
    });
  } catch (error) {
    console.error('Sync conflicts error:', error);
    res.status(500).json({
      success: false,
      error: 'Error getting sync conflicts'
    });
  }
});

// @desc    Resolve a conflict manually
// @route   POST /api/sync/conflicts/:syncId/resolve
// @access  Private
router.post('/conflicts/:syncId/resolve', protect, async (req, res) => {
  try {
    const { syncId } = req.params;
    const { resolution, resolvedData } = req.body;

    if (!['local_wins', 'central_wins', 'merged'].includes(resolution)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid resolution type'
      });
    }

    const conflict = await SyncQueue.findOne({ syncId, status: 'conflict' });
    if (!conflict) {
      return res.status(404).json({
        success: false,
        error: 'Conflict not found'
      });
    }

    // Apply resolution
    conflict.conflict.resolution = resolution;
    conflict.conflict.resolvedAt = new Date();
    conflict.conflict.resolvedBy = req.user._id;
    conflict.status = resolution === 'local_wins' ? 'pending' : 'synced';

    if (resolution === 'merged' && resolvedData) {
      conflict.data = resolvedData;
    }

    await conflict.save();

    res.json({
      success: true,
      message: 'Conflict resolved',
      conflict
    });
  } catch (error) {
    console.error('Conflict resolution error:', error);
    res.status(500).json({
      success: false,
      error: 'Error resolving conflict'
    });
  }
});

// @desc    Force manual sync
// @route   POST /api/sync/force
// @access  Private (admin only)
router.post('/force', protect, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    // Check if sync is enabled
    if (process.env.SYNC_ENABLED !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Sync is not enabled on this server'
      });
    }

    // Import and trigger sync
    const dataSyncService = require('../services/dataSyncService');
    await dataSyncService.forceSync();

    res.json({
      success: true,
      message: 'Sync initiated'
    });
  } catch (error) {
    console.error('Force sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Error forcing sync'
    });
  }
});

// @desc    Bulk sync operation
// @route   POST /api/sync/bulk
// @access  Private
router.post('/bulk', protect, async (req, res) => {
  try {
    const { operations, lastSync } = req.body;

    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide operations array'
      });
    }

    // Process push operations
    const pushResults = [];
    const conflicts = [];

    for (const op of operations) {
      // Process each operation as in /push endpoint
      // ... (similar logic to push endpoint)
    }

    // Get pull changes
    const syncDate = new Date(lastSync || '1970-01-01');
    const pullChanges = {};

    for (const [entity, Model] of Object.entries(modelMap)) {
      const records = await Model.find({
        updatedAt: { $gt: syncDate }
      }).lean();

      if (records.length > 0) {
        pullChanges[entity] = records;
      }
    }

    res.json({
      success: true,
      push: {
        results: pushResults,
        conflicts
      },
      pull: {
        changes: pullChanges
      },
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Bulk sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Error in bulk sync'
    });
  }
});

// ===========================================================================
// CLOUD SYNC & CROSS-CLINIC PATIENT LOOKUP
// ===========================================================================

const cloudSyncService = require('../services/cloudSyncService');

// @desc    Get cloud sync status
// @route   GET /api/sync/cloud/status
// @access  Private
router.get('/cloud/status', protect, async (req, res) => {
  try {
    const status = await cloudSyncService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Force cloud sync
// @route   POST /api/sync/cloud/force
// @access  Private (admin)
router.post('/cloud/force', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin required' });
    }
    const result = await cloudSyncService.forceSync();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Search patients across all clinics
// @route   GET /api/sync/patients/cross-clinic
// @access  Private
router.get('/patients/cross-clinic', protect, async (req, res) => {
  try {
    const { name, dob, phone, patientId, legacyId } = req.query;

    const results = await cloudSyncService.searchPatientAcrossClinics({
      name, dob, phone, patientId, legacyId
    });

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Fetch full patient from remote clinic
// @route   GET /api/sync/patients/:patientId/remote
// @access  Private
router.get('/patients/:patientId/remote', protect, async (req, res) => {
  try {
    const { sourceClinic } = req.query;

    if (!sourceClinic) {
      return res.status(400).json({
        success: false,
        error: 'sourceClinic is required'
      });
    }

    const patientData = await cloudSyncService.fetchRemotePatient(
      req.params.patientId,
      sourceClinic
    );

    res.json({ success: true, data: patientData });
  } catch (error) {
    const status = error.message.includes('offline') ? 503 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// @desc    Fetch remote image on-demand
// @route   GET /api/sync/files/images/:imageId
// @access  Private
router.get('/files/images/:imageId', protect, async (req, res) => {
  try {
    const { sourceClinic } = req.query;

    if (!sourceClinic) {
      return res.status(400).json({
        success: false,
        error: 'sourceClinic is required'
      });
    }

    const fileInfo = await cloudSyncService.fetchRemoteImage(
      req.params.imageId,
      sourceClinic
    );

    res.setHeader('Content-Type', fileInfo.contentType);
    res.send(fileInfo.data);
  } catch (error) {
    const status = error.message.includes('offline') ? 503 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// @desc    Receive incoming sync from cloud (webhook)
// @route   POST /api/sync/incoming
// @access  Public (verified by token)
router.post('/incoming', async (req, res) => {
  try {
    const syncToken = req.headers['x-sync-token'];

    if (syncToken !== process.env.CLOUD_SYNC_TOKEN) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    const { changes } = req.body;
    if (!Array.isArray(changes)) {
      return res.status(400).json({ success: false, error: 'changes array required' });
    }

    let applied = 0, failed = 0;
    for (const change of changes) {
      try {
        await cloudSyncService.applyRemoteChange(change);
        applied++;
      } catch (error) {
        console.error('[Sync] Failed to apply:', error.message);
        failed++;
      }
    }

    res.json({ success: true, applied, failed });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================================================
// DEAD LETTER QUEUE MANAGEMENT
// ===========================================================================

const dataSyncService = require('../services/dataSyncService');

// @desc    Get dead letter queue items (permanently failed syncs)
// @route   GET /api/sync/dead-letter
// @access  Private (admin)
router.get('/dead-letter', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { limit = 100 } = req.query;
    const items = await dataSyncService.getDeadLetterQueue(parseInt(limit));

    res.json({
      success: true,
      items,
      count: items.length
    });
  } catch (error) {
    console.error('Dead letter queue error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Retry a specific dead letter item
// @route   POST /api/sync/dead-letter/:syncId/retry
// @access  Private (admin)
router.post('/dead-letter/:syncId/retry', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const item = await dataSyncService.retryDeadLetterItem(req.params.syncId);

    res.json({
      success: true,
      message: 'Item moved back to pending queue',
      item
    });
  } catch (error) {
    console.error('Dead letter retry error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Retry all dead letter items
// @route   POST /api/sync/dead-letter/retry-all
// @access  Private (admin)
router.post('/dead-letter/retry-all', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const result = await dataSyncService.retryAllDeadLetter();

    res.json({
      success: true,
      message: `${result.retried} items moved back to pending queue`,
      ...result
    });
  } catch (error) {
    console.error('Dead letter retry-all error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Clear (delete) specific dead letter items
// @route   DELETE /api/sync/dead-letter
// @access  Private (admin)
router.delete('/dead-letter', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { syncIds } = req.body;
    if (!Array.isArray(syncIds) || syncIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide syncIds array'
      });
    }

    const result = await dataSyncService.clearDeadLetterItems(syncIds);

    res.json({
      success: true,
      message: `${result.deleted} items deleted from dead letter queue`,
      ...result
    });
  } catch (error) {
    console.error('Dead letter clear error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
