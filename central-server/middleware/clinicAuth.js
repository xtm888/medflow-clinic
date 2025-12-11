const ClinicRegistry = require('../models/ClinicRegistry');

/**
 * Middleware to authenticate clinic connections via sync token
 */
const clinicAuth = async (req, res, next) => {
  try {
    const clinicId = req.headers['x-clinic-id'];
    const syncToken = req.headers['x-sync-token'];

    if (!clinicId || !syncToken) {
      return res.status(401).json({
        success: false,
        error: 'Missing clinic credentials',
        message: 'X-Clinic-ID and X-Sync-Token headers are required'
      });
    }

    // Verify the sync token
    const clinic = await ClinicRegistry.verifySyncToken(clinicId, syncToken);

    if (!clinic) {
      return res.status(403).json({
        success: false,
        error: 'Invalid clinic credentials',
        message: 'Clinic ID or sync token is invalid or clinic is not active'
      });
    }

    // Check if sync is enabled for this clinic
    if (!clinic.syncConfig.syncEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Sync disabled',
        message: 'Sync is disabled for this clinic'
      });
    }

    // Update connection info
    await clinic.updateConnection(
      req.ip || req.connection.remoteAddress,
      req.headers['user-agent']
    );

    // Attach clinic to request
    req.clinic = clinic;
    req.clinicId = clinic.clinicId;

    next();
  } catch (error) {
    console.error('[ClinicAuth] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: error.message
    });
  }
};

/**
 * Middleware to check if clinic can sync a specific collection
 */
const canSyncCollection = (collection) => {
  return (req, res, next) => {
    if (!req.clinic) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    if (!req.clinic.canSync(collection)) {
      return res.status(403).json({
        success: false,
        error: 'Sync not allowed',
        message: `This clinic is not authorized to sync ${collection}`
      });
    }

    next();
  };
};

/**
 * Middleware for master token authentication (admin operations)
 */
const masterAuth = (req, res, next) => {
  const masterToken = req.headers['x-master-token'];

  if (!masterToken || masterToken !== process.env.MASTER_SYNC_TOKEN) {
    return res.status(403).json({
      success: false,
      error: 'Unauthorized',
      message: 'Valid master token required'
    });
  }

  next();
};

module.exports = {
  clinicAuth,
  canSyncCollection,
  masterAuth
};
