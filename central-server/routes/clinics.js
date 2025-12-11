const express = require('express');
const router = express.Router();
const { masterAuth, clinicAuth } = require('../middleware/clinicAuth');
const { asyncHandler } = require('../middleware/errorHandler');
const ClinicRegistry = require('../models/ClinicRegistry');

/**
 * Clinic Management Routes
 */

// Get all clinics (public list)
router.get('/', clinicAuth, asyncHandler(async (req, res) => {
  const clinics = await ClinicRegistry.find({ status: 'active' })
    .select('clinicId name shortName location type services connection.lastSeenAt stats')
    .sort({ name: 1 })
    .lean();

  res.json({
    success: true,
    clinics: clinics.map(c => ({
      ...c,
      isOnline: c.connection?.lastSeenAt
        ? (new Date() - new Date(c.connection.lastSeenAt)) < 5 * 60 * 1000
        : false
    }))
  });
}));

// Register a new clinic (requires master token)
router.post('/register', masterAuth, asyncHandler(async (req, res) => {
  const { clinicId, name, shortName, location, contact, type, services, syncToken } = req.body;

  if (!clinicId || !name || !syncToken) {
    return res.status(400).json({
      success: false,
      error: 'clinicId, name, and syncToken are required'
    });
  }

  // Check if clinic already exists
  const existing = await ClinicRegistry.findOne({ clinicId });
  if (existing) {
    return res.status(400).json({
      success: false,
      error: 'Clinic with this ID already exists'
    });
  }

  const clinic = await ClinicRegistry.registerClinic({
    clinicId,
    name,
    shortName,
    location,
    contact,
    type: type || 'satellite',
    services: services || ['consultation', 'ophthalmology', 'pharmacy']
  }, syncToken);

  res.status(201).json({
    success: true,
    clinic: {
      clinicId: clinic.clinicId,
      name: clinic.name,
      apiKey: clinic.apiKey,
      status: clinic.status
    },
    message: 'Clinic registered. Awaiting approval.'
  });
}));

// Approve a clinic (requires master token)
router.post('/:clinicId/approve', masterAuth, asyncHandler(async (req, res) => {
  const { clinicId } = req.params;
  const { approvedBy } = req.body;

  const clinic = await ClinicRegistry.findOne({ clinicId });
  if (!clinic) {
    return res.status(404).json({
      success: false,
      error: 'Clinic not found'
    });
  }

  clinic.status = 'active';
  clinic.approvedAt = new Date();
  clinic.approvedBy = approvedBy || 'system';
  await clinic.save();

  res.json({
    success: true,
    message: 'Clinic approved and activated',
    clinic: {
      clinicId: clinic.clinicId,
      name: clinic.name,
      status: clinic.status
    }
  });
}));

// Suspend a clinic (requires master token)
router.post('/:clinicId/suspend', masterAuth, asyncHandler(async (req, res) => {
  const { clinicId } = req.params;
  const { reason } = req.body;

  const clinic = await ClinicRegistry.findOne({ clinicId });
  if (!clinic) {
    return res.status(404).json({
      success: false,
      error: 'Clinic not found'
    });
  }

  clinic.status = 'suspended';
  clinic.suspendedAt = new Date();
  clinic.suspendedReason = reason;
  await clinic.save();

  res.json({
    success: true,
    message: 'Clinic suspended',
    clinic: {
      clinicId: clinic.clinicId,
      name: clinic.name,
      status: clinic.status
    }
  });
}));

// Update clinic sync configuration
router.put('/:clinicId/sync-config', masterAuth, asyncHandler(async (req, res) => {
  const { clinicId } = req.params;
  const { syncEnabled, allowedCollections, syncInterval } = req.body;

  const clinic = await ClinicRegistry.findOne({ clinicId });
  if (!clinic) {
    return res.status(404).json({
      success: false,
      error: 'Clinic not found'
    });
  }

  if (typeof syncEnabled === 'boolean') {
    clinic.syncConfig.syncEnabled = syncEnabled;
  }
  if (allowedCollections) {
    clinic.syncConfig.allowedCollections = allowedCollections;
  }
  if (syncInterval) {
    clinic.syncConfig.syncInterval = syncInterval;
  }

  await clinic.save();

  res.json({
    success: true,
    clinic: {
      clinicId: clinic.clinicId,
      syncConfig: clinic.syncConfig
    }
  });
}));

// Get clinic details
router.get('/:clinicId', clinicAuth, asyncHandler(async (req, res) => {
  const clinic = await ClinicRegistry.findOne({ clinicId: req.params.clinicId })
    .select('-syncTokenHash')
    .lean();

  if (!clinic) {
    return res.status(404).json({
      success: false,
      error: 'Clinic not found'
    });
  }

  res.json({
    success: true,
    clinic: {
      ...clinic,
      isOnline: clinic.connection?.lastSeenAt
        ? (new Date() - new Date(clinic.connection.lastSeenAt)) < 5 * 60 * 1000
        : false
    }
  });
}));

// Reset sync token (requires master token)
router.post('/:clinicId/reset-token', masterAuth, asyncHandler(async (req, res) => {
  const { clinicId } = req.params;
  const { newSyncToken } = req.body;

  if (!newSyncToken) {
    return res.status(400).json({
      success: false,
      error: 'newSyncToken is required'
    });
  }

  const clinic = await ClinicRegistry.findOne({ clinicId });
  if (!clinic) {
    return res.status(404).json({
      success: false,
      error: 'Clinic not found'
    });
  }

  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  clinic.syncTokenHash = await bcrypt.hash(newSyncToken, salt);
  await clinic.save();

  res.json({
    success: true,
    message: 'Sync token updated'
  });
}));

module.exports = router;
