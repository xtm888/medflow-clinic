/**
 * Clinic Authorization Middleware
 *
 * Handles multi-clinic access control:
 * - Extracts clinic context from request (header or user's primary clinic)
 * - Validates user has access to the requested clinic
 * - Injects clinic ID into request for controllers to use
 *
 * Usage:
 * - Client sends X-Clinic-ID header to specify which clinic context
 * - If no header, uses user's primaryClinic
 * - Admin users with accessAllClinics=true can access any clinic
 */

const Clinic = require('../models/Clinic');

/**
 * Extract and validate clinic context
 * Adds req.clinicId and req.clinic to the request
 */
const clinicContext = async (req, res, next) => {
  try {
    // User must be authenticated first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required for clinic context'
      });
    }

    // Get clinic ID from header ONLY (not from primaryClinic for admins)
    // This allows admins to explicitly select "All Clinics" by NOT sending the header
    let clinicId = req.headers['x-clinic-id'];

    // For users with accessAllClinics, if no header is sent, show all
    if (!clinicId && req.user.accessAllClinics) {
      // Admin without specific clinic header - proceed without clinic filter (All Clinics mode)
      req.clinicId = null;
      req.clinic = null;
      req.accessAllClinics = true;
      return next();
    }

    // For non-admin users, fall back to primaryClinic or single assigned clinic
    if (!clinicId) {
      clinicId = req.user.primaryClinic;
    }

    // If user has only one clinic assigned, use that
    if (!clinicId && req.user.clinics && req.user.clinics.length === 1) {
      clinicId = req.user.clinics[0];
    }

    if (!clinicId) {
      return res.status(400).json({
        success: false,
        error: 'No clinic context. Set X-Clinic-ID header or assign a primary clinic to user.'
      });
    }

    // Validate clinic ID format (handle both ObjectId and clinicId string)
    let clinic;
    if (clinicId.match(/^[0-9a-fA-F]{24}$/)) {
      // ObjectId format
      clinic = await Clinic.findById(clinicId);
    } else {
      // clinicId string format (e.g., 'CLINIC-A')
      clinic = await Clinic.findOne({ clinicId: clinicId.toUpperCase() });
    }

    if (!clinic) {
      return res.status(404).json({
        success: false,
        error: `Clinic not found: ${clinicId}`
      });
    }

    // Check if user has access to this clinic
    if (!req.user.accessAllClinics) {
      const userClinicIds = (req.user.clinics || []).map(c => c.toString());
      if (!userClinicIds.includes(clinic._id.toString())) {
        return res.status(403).json({
          success: false,
          error: `You do not have access to clinic: ${clinic.name}`
        });
      }
    }

    // Inject clinic context into request
    req.clinicId = clinic._id;
    req.clinic = clinic;
    req.accessAllClinics = req.user.accessAllClinics || false;

    next();
  } catch (error) {
    log.error('Clinic context middleware error:', { error: error });
    return res.status(500).json({
      success: false,
      error: 'Error processing clinic context'
    });
  }
};

/**
 * Require clinic context - fails if no clinic is set
 * Use for routes that require a specific clinic
 */
const requireClinic = async (req, res, next) => {
  // First run clinicContext
  await clinicContext(req, res, () => {
    if (!req.clinicId && !req.accessAllClinics) {
      return res.status(400).json({
        success: false,
        error: 'This operation requires a clinic context. Set X-Clinic-ID header.'
      });
    }
    next();
  });
};

/**
 * Optional clinic context - proceeds even without clinic
 * Use for routes that can work with or without clinic filter
 */
const optionalClinic = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    // Get clinic ID from header ONLY
    let clinicId = req.headers['x-clinic-id'];

    // For users with accessAllClinics, if no header is sent, show all
    if (!clinicId && req.user.accessAllClinics) {
      req.clinicId = null;
      req.clinic = null;
      req.accessAllClinics = true;
      return next();
    }

    // For non-admin users, fall back to primaryClinic or single assigned clinic
    if (!clinicId) {
      clinicId = req.user.primaryClinic;
    }

    if (!clinicId && req.user.clinics && req.user.clinics.length === 1) {
      clinicId = req.user.clinics[0];
    }

    if (!clinicId) {
      req.clinicId = null;
      req.clinic = null;
      req.accessAllClinics = req.user.accessAllClinics || false;
      return next();
    }

    // Validate clinic
    let clinic;
    if (clinicId.match && clinicId.match(/^[0-9a-fA-F]{24}$/)) {
      clinic = await Clinic.findById(clinicId);
    } else if (typeof clinicId === 'string') {
      clinic = await Clinic.findOne({ clinicId: clinicId.toUpperCase() });
    } else {
      clinic = await Clinic.findById(clinicId);
    }

    if (clinic) {
      // Check access
      if (!req.user.accessAllClinics) {
        const userClinicIds = (req.user.clinics || []).map(c => c.toString());
        if (!userClinicIds.includes(clinic._id.toString())) {
          // User doesn't have access, proceed without clinic filter
          req.clinicId = null;
          req.clinic = null;
          return next();
        }
      }
      req.clinicId = clinic._id;
      req.clinic = clinic;
    } else {
      req.clinicId = null;
      req.clinic = null;
    }

    req.accessAllClinics = req.user.accessAllClinics || false;
    next();
  } catch (error) {
    log.error('Optional clinic context error:', { error: error });
    // Don't fail, just proceed without clinic context
    req.clinicId = null;
    req.clinic = null;
    next();
  }
};

/**
 * Validate that the provider (doctor) works at the specified clinic
 * Use for appointment booking to ensure doctor-clinic match
 */
const validateProviderClinic = async (req, res, next) => {
  try {
    const { provider, providerId, doctorId } = req.body;
    const providerToCheck = provider || providerId || doctorId;

    if (!providerToCheck || !req.clinicId) {
      return next();
    }

    const User = require('../models/User');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('ClinicAuth');
    const providerUser = await User.findById(providerToCheck);

    if (!providerUser) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found'
      });
    }

    // Check if provider works at this clinic
    const providerClinicIds = (providerUser.clinics || []).map(c => c.toString());
    if (!providerUser.accessAllClinics && !providerClinicIds.includes(req.clinicId.toString())) {
      return res.status(400).json({
        success: false,
        error: `Dr. ${providerUser.firstName} ${providerUser.lastName} does not work at this clinic`
      });
    }

    next();
  } catch (error) {
    log.error('Provider clinic validation error:', { error: error });
    return res.status(500).json({
      success: false,
      error: 'Error validating provider clinic assignment'
    });
  }
};

/**
 * Helper to build clinic-filtered query
 * Use in controllers: const query = buildClinicQuery(req, baseQuery);
 */
const buildClinicQuery = (req, baseQuery = {}) => {
  if (req.accessAllClinics || !req.clinicId) {
    return baseQuery;
  }
  return { ...baseQuery, clinic: req.clinicId };
};

/**
 * Helper to get clinics user has access to
 * Returns array of clinic IDs or null for all access
 */
const getUserClinicIds = (req) => {
  if (req.user.accessAllClinics) {
    return null; // null means all clinics
  }
  return req.user.clinics || [];
};

module.exports = {
  clinicContext,
  requireClinic,
  optionalClinic,
  validateProviderClinic,
  buildClinicQuery,
  getUserClinicIds
};
