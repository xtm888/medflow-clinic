/**
 * Migration Routes - API endpoints for legacy patient migration management
 *
 * Provides endpoints for:
 * - Viewing migration status and statistics
 * - Managing pending review queue
 * - Manual patient linking
 * - Bulk operations
 */

const express = require('express');
const router = express.Router();
const { protect, authorize, requirePermission } = require('../middleware/auth');
const { logAction } = require('../middleware/auditLogger');

const Patient = require('../models/Patient');
const LegacyMapping = require('../models/LegacyMapping');

// Protect all routes - admin only
router.use(protect);
router.use(requirePermission('manage_patients'));

/**
 * GET /api/migration/status
 * Get overall migration status
 */
router.get('/status', async (req, res) => {
  try {
    const stats = await LegacyMapping.getMigrationStats();

    // Add additional context
    const totalPatients = await Patient.countDocuments();
    const patientsWithLegacyId = await Patient.countDocuments({ legacyId: { $exists: true, $ne: null } });
    const patientsWithFolders = await Patient.countDocuments({ 'folderIds.0': { $exists: true } });

    res.json({
      success: true,
      migration: stats,
      patients: {
        total: totalPatients,
        withLegacyId: patientsWithLegacyId,
        withLinkedFolders: patientsWithFolders
      }
    });
  } catch (error) {
    console.error('Migration status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/migration/stats
 * Get detailed migration statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await LegacyMapping.getMigrationStats();

    // Get breakdown by match method
    const byMethod = await LegacyMapping.aggregate([
      { $match: { status: { $in: ['matched', 'created'] } } },
      { $group: { _id: '$matchMethod', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get recent activity
    const recentActivity = await LegacyMapping.find()
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('legacyId status matchMethod updatedAt')
      .lean();

    // Get error summary
    const errorSummary = await LegacyMapping.aggregate([
      { $match: { status: 'error' } },
      { $group: { _id: '$errorDetails.code', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      overview: stats,
      byMatchMethod: byMethod,
      recentActivity,
      errors: errorSummary
    });
  } catch (error) {
    console.error('Migration stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/migration/pending
 * Get pending review queue
 */
router.get('/pending', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      minConfidence = 0,
      maxConfidence = 100
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      needsReview: true,
      matchConfidence: {
        $gte: parseFloat(minConfidence) / 100,
        $lte: parseFloat(maxConfidence) / 100
      }
    };

    const [pending, total] = await Promise.all([
      LegacyMapping.find(query)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('medflowPatientId', 'firstName lastName dateOfBirth patientId')
        .lean(),
      LegacyMapping.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: pending,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Pending queue error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/migration/review-queue
 * Get items needing manual review with potential matches
 */
router.get('/review-queue', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const queue = await LegacyMapping.getReviewQueue(parseInt(page), parseInt(limit));

    // For each item, find potential matches
    const enrichedQueue = await Promise.all(queue.map(async (item) => {
      const legacyData = item.importedData?.demographics || {};
      let potentialMatches = [];

      // Search for potential matches
      if (legacyData.firstName || legacyData.lastName) {
        const searchQuery = {
          $or: []
        };

        if (legacyData.firstName && legacyData.lastName) {
          searchQuery.$or.push({
            firstName: new RegExp(legacyData.firstName, 'i'),
            lastName: new RegExp(legacyData.lastName, 'i')
          });
        }

        if (legacyData.dateOfBirth) {
          const dob = new Date(legacyData.dateOfBirth);
          searchQuery.$or.push({ dateOfBirth: dob });
        }

        if (searchQuery.$or.length > 0) {
          potentialMatches = await Patient.find(searchQuery)
            .select('firstName lastName dateOfBirth patientId gender phoneNumber')
            .limit(5)
            .lean();
        }
      }

      return {
        ...item,
        potentialMatches
      };
    }));

    const total = await LegacyMapping.countDocuments({ needsReview: true });

    res.json({
      success: true,
      data: enrichedQueue,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Review queue error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/migration/link
 * Manually link a legacy record to an existing patient
 */
router.post('/link', logAction('MIGRATION_LINK'), async (req, res) => {
  try {
    const { legacyMappingId, patientId, notes } = req.body;

    if (!legacyMappingId || !patientId) {
      return res.status(400).json({
        success: false,
        message: 'legacyMappingId and patientId are required'
      });
    }

    // Verify patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Get legacy mapping
    const mapping = await LegacyMapping.findById(legacyMappingId);
    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Legacy mapping not found'
      });
    }

    // Update patient with legacy info
    const updateData = {
      legacyId: mapping.legacyId
    };

    // Add folder link if present
    if (mapping.importedData?.folderPath) {
      const folderData = {
        deviceType: mapping.importedData?.deviceType || 'other',
        folderId: mapping.legacyId,
        path: mapping.importedData.folderPath,
        linkedAt: new Date(),
        linkedBy: req.user._id
      };

      await Patient.findByIdAndUpdate(patientId, {
        $set: updateData,
        $push: { folderIds: folderData }
      });
    } else {
      await Patient.findByIdAndUpdate(patientId, { $set: updateData });
    }

    // Update legacy mapping
    await LegacyMapping.markMatched(
      mapping.legacyId,
      mapping.legacySystem,
      patientId,
      1.0, // Manual link = 100% confidence
      'manual'
    );

    // Add notes if provided
    if (notes) {
      await LegacyMapping.findByIdAndUpdate(legacyMappingId, {
        $set: { notes }
      });
    }

    res.json({
      success: true,
      message: 'Patient linked successfully',
      patient: {
        _id: patient._id,
        patientId: patient.patientId,
        firstName: patient.firstName,
        lastName: patient.lastName
      }
    });
  } catch (error) {
    console.error('Link error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/migration/create
 * Create a new patient from legacy record
 */
router.post('/create', logAction('MIGRATION_CREATE'), async (req, res) => {
  try {
    const { legacyMappingId, patientData, notes } = req.body;

    if (!legacyMappingId) {
      return res.status(400).json({
        success: false,
        message: 'legacyMappingId is required'
      });
    }

    // Get legacy mapping
    const mapping = await LegacyMapping.findById(legacyMappingId);
    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Legacy mapping not found'
      });
    }

    // Merge legacy data with provided patient data
    const legacyData = mapping.importedData?.demographics || {};
    const mergedData = {
      firstName: patientData?.firstName || legacyData.firstName || 'Unknown',
      lastName: patientData?.lastName || legacyData.lastName || 'Unknown',
      dateOfBirth: patientData?.dateOfBirth || legacyData.dateOfBirth,
      gender: patientData?.gender || legacyData.gender || 'other',
      phoneNumber: patientData?.phoneNumber || legacyData.phone || '',
      email: patientData?.email || legacyData.email || '',
      address: patientData?.address || legacyData.address || {},
      legacyId: mapping.legacyId,
      status: 'active',
      medicalHistory: {
        notes: `Migrated from legacy system on ${new Date().toISOString()}`
      }
    };

    // Add folder link if present
    if (mapping.importedData?.folderPath) {
      mergedData.folderIds = [{
        deviceType: mapping.importedData?.deviceType || 'other',
        folderId: mapping.legacyId,
        path: mapping.importedData.folderPath,
        linkedAt: new Date(),
        linkedBy: req.user._id
      }];
    }

    // Generate patient ID
    const lastPatient = await Patient.findOne().sort({ patientId: -1 });
    const lastNum = lastPatient?.patientId?.match(/\d+/)?.[0] || '0';
    mergedData.patientId = `MF${String(parseInt(lastNum) + 1).padStart(6, '0')}`;

    // Create patient
    const patient = new Patient(mergedData);
    await patient.save();

    // Update legacy mapping
    mapping.medflowPatientId = patient._id;
    mapping.status = 'created';
    mapping.matchConfidence = 1.0;
    mapping.matchMethod = 'manual_create';
    mapping.needsReview = false;
    mapping.migratedAt = new Date();
    mapping.migratedBy = req.user._id;
    if (notes) mapping.notes = notes;
    await mapping.save();

    res.json({
      success: true,
      message: 'Patient created successfully',
      patient: {
        _id: patient._id,
        patientId: patient.patientId,
        firstName: patient.firstName,
        lastName: patient.lastName
      }
    });
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/migration/skip
 * Skip a legacy record (mark as not migrating)
 */
router.post('/skip', logAction('MIGRATION_SKIP'), async (req, res) => {
  try {
    const { legacyMappingId, reason } = req.body;

    if (!legacyMappingId) {
      return res.status(400).json({
        success: false,
        message: 'legacyMappingId is required'
      });
    }

    const mapping = await LegacyMapping.findByIdAndUpdate(
      legacyMappingId,
      {
        $set: {
          status: 'skipped',
          needsReview: false,
          notes: reason || 'Skipped by admin',
          migratedAt: new Date(),
          migratedBy: req.user._id
        }
      },
      { new: true }
    );

    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Legacy mapping not found'
      });
    }

    res.json({
      success: true,
      message: 'Record skipped successfully'
    });
  } catch (error) {
    console.error('Skip error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/migration/bulk-skip
 * Skip multiple legacy records
 */
router.post('/bulk-skip', logAction('MIGRATION_BULK_SKIP'), async (req, res) => {
  try {
    const { ids, reason } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ids array is required'
      });
    }

    const result = await LegacyMapping.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: 'skipped',
          needsReview: false,
          notes: reason || 'Bulk skipped by admin',
          migratedAt: new Date(),
          migratedBy: req.user._id
        }
      }
    );

    res.json({
      success: true,
      message: `Skipped ${result.modifiedCount} records`
    });
  } catch (error) {
    console.error('Bulk skip error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/migration/errors
 * Get records with errors
 */
router.get('/errors', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [errors, total] = await Promise.all([
      LegacyMapping.find({ status: 'error' })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      LegacyMapping.countDocuments({ status: 'error' })
    ]);

    res.json({
      success: true,
      data: errors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Errors fetch error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/migration/retry
 * Retry a failed migration
 */
router.post('/retry/:id', logAction('MIGRATION_RETRY'), async (req, res) => {
  try {
    const mapping = await LegacyMapping.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: 'pending',
          errorDetails: null,
          retryCount: 0
        }
      },
      { new: true }
    );

    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Legacy mapping not found'
      });
    }

    res.json({
      success: true,
      message: 'Record queued for retry'
    });
  } catch (error) {
    console.error('Retry error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/migration/search
 * Search legacy mappings
 */
router.get('/search', async (req, res) => {
  try {
    const { q, status, page = 1, limit = 20 } = req.query;

    const query = {};

    if (q) {
      query.$or = [
        { legacyId: new RegExp(q, 'i') },
        { 'importedData.demographics.firstName': new RegExp(q, 'i') },
        { 'importedData.demographics.lastName': new RegExp(q, 'i') }
      ];
    }

    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [results, total] = await Promise.all([
      LegacyMapping.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('medflowPatientId', 'firstName lastName patientId')
        .lean(),
      LegacyMapping.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/migration/:id
 * Get single legacy mapping details
 */
router.get('/:id', async (req, res) => {
  try {
    const mapping = await LegacyMapping.findById(req.params.id)
      .populate('medflowPatientId', 'firstName lastName dateOfBirth patientId gender phoneNumber email')
      .populate('migratedBy', 'firstName lastName')
      .lean();

    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Legacy mapping not found'
      });
    }

    res.json({
      success: true,
      data: mapping
    });
  } catch (error) {
    console.error('Get mapping error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
