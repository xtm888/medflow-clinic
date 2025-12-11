const { asyncHandler } = require('../middleware/errorHandler');
const CentralPatient = require('../models/CentralPatient');
const CentralInventory = require('../models/CentralInventory');
const CentralInvoice = require('../models/CentralInvoice');
const CentralVisit = require('../models/CentralVisit');
const ClinicRegistry = require('../models/ClinicRegistry');

// Map collection names to models and their upsert methods
const COLLECTION_MAP = {
  patients: {
    model: CentralPatient,
    upsert: (clinicId, data) => CentralPatient.upsertFromSync(clinicId, data)
  },
  visits: {
    model: CentralVisit,
    upsert: (clinicId, data) => CentralVisit.upsertFromSync(clinicId, data)
  },
  invoices: {
    model: CentralInvoice,
    upsert: (clinicId, data) => CentralInvoice.upsertFromSync(clinicId, data)
  },
  // Inventory collections
  pharmacyInventory: {
    model: CentralInventory,
    upsert: (clinicId, data) => CentralInventory.upsertFromSync(clinicId, 'pharmacy', data)
  },
  frameInventory: {
    model: CentralInventory,
    upsert: (clinicId, data) => CentralInventory.upsertFromSync(clinicId, 'frame', data)
  },
  contactLensInventory: {
    model: CentralInventory,
    upsert: (clinicId, data) => CentralInventory.upsertFromSync(clinicId, 'contactLens', data)
  },
  reagentInventory: {
    model: CentralInventory,
    upsert: (clinicId, data) => CentralInventory.upsertFromSync(clinicId, 'reagent', data)
  },
  labConsumableInventory: {
    model: CentralInventory,
    upsert: (clinicId, data) => CentralInventory.upsertFromSync(clinicId, 'labConsumable', data)
  }
};

/**
 * @desc    Receive pushed changes from a clinic
 * @route   POST /api/sync/push
 * @access  Private (clinic auth)
 */
exports.receivePush = asyncHandler(async (req, res) => {
  const clinicId = req.clinicId;
  const { changes } = req.body;

  if (!changes || !Array.isArray(changes)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request',
      message: 'Changes array is required'
    });
  }

  console.log(`[Sync] Receiving ${changes.length} changes from ${clinicId}`);

  const results = {
    synced: [],
    conflicts: [],
    failed: []
  };

  for (const change of changes) {
    const { syncId, collection, operation, documentId, data, changedAt } = change;

    try {
      // Get the collection handler
      const handler = COLLECTION_MAP[collection];
      if (!handler) {
        results.failed.push({
          syncId,
          error: `Unknown collection: ${collection}`
        });
        continue;
      }

      // Check if clinic can sync this collection
      if (!req.clinic.canSync(collection.replace('Inventory', '').toLowerCase())) {
        results.failed.push({
          syncId,
          error: `Not authorized to sync ${collection}`
        });
        continue;
      }

      // Handle delete operation
      if (operation === 'delete') {
        await handler.model.findOneAndUpdate(
          { _originalId: documentId, _sourceClinic: clinicId },
          {
            $set: {
              _deleted: true,
              _deletedAt: new Date(changedAt),
              _syncedAt: new Date()
            }
          }
        );
        results.synced.push(syncId);
        continue;
      }

      // Handle create/update
      // Check for conflicts (same record modified by different clinic)
      const existing = await handler.model.findOne({
        _originalId: documentId
      });

      if (existing && existing._sourceClinic !== clinicId) {
        // Conflict - same patient/record exists from different clinic
        // Check if it's actually the same entity (by nationalId or similar)
        const isConflict = await checkForConflict(collection, existing, data);

        if (isConflict) {
          results.conflicts.push({
            syncId,
            documentId,
            collection,
            localVersion: data,
            centralVersion: existing.toObject(),
            conflictType: 'cross-clinic-duplicate'
          });
          continue;
        }
      }

      // Upsert the data
      await handler.upsert(clinicId, { _id: documentId, ...data });
      results.synced.push(syncId);

    } catch (error) {
      console.error(`[Sync] Error processing ${syncId}:`, error.message);
      results.failed.push({
        syncId,
        error: error.message
      });
    }
  }

  // Update clinic's last push timestamp
  await req.clinic.updateSyncTimestamp('push');

  // Update clinic stats
  await updateClinicStats(clinicId);

  console.log(`[Sync] Processed: ${results.synced.length} synced, ${results.conflicts.length} conflicts, ${results.failed.length} failed`);

  res.json({
    success: true,
    ...results,
    timestamp: new Date().toISOString()
  });
});

/**
 * @desc    Send changes to a clinic
 * @route   GET /api/sync/pull
 * @access  Private (clinic auth)
 */
exports.sendPull = asyncHandler(async (req, res) => {
  const clinicId = req.clinicId;
  const { since, collections } = req.query;

  const sinceDate = since ? new Date(since) : new Date(0);
  const requestedCollections = collections
    ? collections.split(',')
    : Object.keys(COLLECTION_MAP);

  console.log(`[Sync] Sending changes to ${clinicId} since ${sinceDate.toISOString()}`);

  const changes = [];

  for (const collectionName of requestedCollections) {
    const handler = COLLECTION_MAP[collectionName];
    if (!handler) continue;

    // Get changes from OTHER clinics (not the requesting clinic)
    const docs = await handler.model.find({
      _sourceClinic: { $ne: clinicId },
      _syncedAt: { $gt: sinceDate }
    })
      .select('-__v')
      .lean();

    for (const doc of docs) {
      changes.push({
        collection: collectionName,
        operation: doc._deleted ? 'delete' : 'update',
        documentId: doc._originalId,
        sourceClinic: doc._sourceClinic,
        data: doc,
        timestamp: doc._syncedAt
      });
    }
  }

  // Update clinic's last pull timestamp
  await req.clinic.updateSyncTimestamp('pull');

  console.log(`[Sync] Sending ${changes.length} changes to ${clinicId}`);

  res.json({
    success: true,
    changes,
    timestamp: new Date().toISOString()
  });
});

/**
 * @desc    Get sync status for a clinic
 * @route   GET /api/sync/status
 * @access  Private (clinic auth)
 */
exports.getStatus = asyncHandler(async (req, res) => {
  const clinic = req.clinic;

  // Count pending changes for this clinic
  const pendingChanges = {};
  for (const [collectionName, handler] of Object.entries(COLLECTION_MAP)) {
    const count = await handler.model.countDocuments({
      _sourceClinic: { $ne: clinic.clinicId },
      _syncedAt: { $gt: clinic.syncConfig.lastPullAt || new Date(0) }
    });
    if (count > 0) {
      pendingChanges[collectionName] = count;
    }
  }

  res.json({
    success: true,
    clinic: {
      clinicId: clinic.clinicId,
      name: clinic.name,
      status: clinic.status,
      isOnline: clinic.isOnline
    },
    sync: {
      enabled: clinic.syncConfig.syncEnabled,
      lastPushAt: clinic.syncConfig.lastPushAt,
      lastPullAt: clinic.syncConfig.lastPullAt,
      lastSyncAt: clinic.syncConfig.lastSyncAt,
      pendingChanges,
      totalPending: Object.values(pendingChanges).reduce((a, b) => a + b, 0)
    },
    stats: clinic.stats,
    serverTime: new Date().toISOString()
  });
});

/**
 * @desc    Get all registered clinics and their status
 * @route   GET /api/sync/clinics
 * @access  Private (clinic auth)
 */
exports.getClinics = asyncHandler(async (req, res) => {
  const clinics = await ClinicRegistry.getActiveClinics();

  res.json({
    success: true,
    clinics: clinics.map(c => ({
      clinicId: c.clinicId,
      name: c.name,
      shortName: c.shortName,
      city: c.location?.city,
      type: c.type,
      services: c.services,
      isOnline: c.connection?.lastSeenAt
        ? (new Date() - new Date(c.connection.lastSeenAt)) < 5 * 60 * 1000
        : false,
      lastSeen: c.connection?.lastSeenAt,
      stats: c.stats
    }))
  });
});

/**
 * @desc    Force full sync for a collection
 * @route   POST /api/sync/full-sync
 * @access  Private (clinic auth)
 */
exports.fullSync = asyncHandler(async (req, res) => {
  const clinicId = req.clinicId;
  const { collection, data } = req.body;

  if (!collection || !data || !Array.isArray(data)) {
    return res.status(400).json({
      success: false,
      error: 'Collection name and data array required'
    });
  }

  const handler = COLLECTION_MAP[collection];
  if (!handler) {
    return res.status(400).json({
      success: false,
      error: `Unknown collection: ${collection}`
    });
  }

  console.log(`[Sync] Full sync of ${collection} from ${clinicId}: ${data.length} records`);

  let synced = 0;
  let failed = 0;

  for (const item of data) {
    try {
      await handler.upsert(clinicId, item);
      synced++;
    } catch (error) {
      console.error(`[Sync] Full sync error:`, error.message);
      failed++;
    }
  }

  await req.clinic.updateSyncTimestamp('push');

  res.json({
    success: true,
    collection,
    synced,
    failed,
    timestamp: new Date().toISOString()
  });
});

// Helper: Check for conflicts
async function checkForConflict(collection, existing, newData) {
  if (collection === 'patients') {
    // If same nationalId, it's likely the same person
    if (existing.nationalId && newData.nationalId &&
        existing.nationalId === newData.nationalId) {
      return true;
    }
    // If same name + DOB, likely the same person
    if (existing.firstName === newData.firstName &&
        existing.lastName === newData.lastName &&
        existing.dateOfBirth?.toDateString() === new Date(newData.dateOfBirth).toDateString()) {
      return true;
    }
  }
  return false;
}

// Helper: Update clinic statistics
async function updateClinicStats(clinicId) {
  const [patients, visits, invoices] = await Promise.all([
    CentralPatient.countDocuments({ _sourceClinic: clinicId, _deleted: { $ne: true } }),
    CentralVisit.countDocuments({ _sourceClinic: clinicId, _deleted: { $ne: true } }),
    CentralInvoice.countDocuments({ _sourceClinic: clinicId, _deleted: { $ne: true } })
  ]);

  await ClinicRegistry.findOneAndUpdate(
    { clinicId },
    {
      $set: {
        'stats.totalPatients': patients,
        'stats.totalVisits': visits,
        'stats.totalInvoices': invoices,
        'stats.lastStatsUpdate': new Date()
      }
    }
  );
}
