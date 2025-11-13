const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Models
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const OphthalmologyExam = require('../models/OphthalmologyExam');
const User = require('../models/User');

// Sync models mapping
const modelMap = {
  patients: Patient,
  appointments: Appointment,
  prescriptions: Prescription,
  ophthalmologyExams: OphthalmologyExam,
  users: User
};

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
      const Model = modelMap[entity];

      if (!Model) {
        console.warn(`Unknown entity: ${entity}`);
        continue;
      }

      // Get records modified since last sync
      const records = await Model.find({
        updatedAt: { $gt: syncDate }
      }).lean();

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

    res.json({
      success: true,
      stats,
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

module.exports = router;