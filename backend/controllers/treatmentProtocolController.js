const TreatmentProtocol = require('../models/TreatmentProtocol');
// Import Drug model to ensure it's registered for population
require('../models/Drug');
const { asyncHandler } = require('../middleware/errorHandler');
const { createContextLogger } = require('../utils/structuredLogger');
const logger = createContextLogger('TreatmentProtocolController');

/**
 * Get user's treatment protocols (personal + system-wide)
 */
exports.getTreatmentProtocols = async (req, res) => {
  try {
    const { category, search, type } = req.query;

    const options = {};
    if (category) options.category = category;

    const protocols = await TreatmentProtocol.getUserProtocols(req.user._id, options);

    // Apply search filter if provided
    let filteredProtocols = protocols;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredProtocols = protocols.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.description?.toLowerCase().includes(searchLower) ||
        p.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Apply type filter if provided
    if (type) {
      filteredProtocols = filteredProtocols.filter(p => p.type === type);
    }

    res.json({
      success: true,
      count: filteredProtocols.length,
      data: filteredProtocols
    });
  } catch (error) {
    logger.error('Error getting treatment protocols', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error retrieving treatment protocols',
      error: error.message
    });
  }
};

/**
 * Get popular treatment protocols
 */
exports.getPopularProtocols = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const protocols = await TreatmentProtocol.getPopular(limit);

    res.json({
      success: true,
      count: protocols.length,
      data: protocols
    });
  } catch (error) {
    logger.error('Error getting popular protocols', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error retrieving popular protocols',
      error: error.message
    });
  }
};

/**
 * Get user's favorite protocols
 */
exports.getFavoriteProtocols = async (req, res) => {
  try {
    const protocols = await TreatmentProtocol.find({
      createdBy: req.user._id,
      type: 'favorite',
      isActive: true
    })
      .populate('medications.medicationTemplate')
      .populate('createdBy', 'firstName lastName')
      .sort({ usageCount: -1, createdAt: -1 });

    res.json({
      success: true,
      count: protocols.length,
      data: protocols
    });
  } catch (error) {
    logger.error('Error getting favorite protocols', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error retrieving favorite protocols',
      error: error.message
    });
  }
};

/**
 * Get single treatment protocol by ID
 */
exports.getTreatmentProtocolById = async (req, res) => {
  try {
    const protocol = await TreatmentProtocol.findById(req.params.id)
      .populate('medications.medicationTemplate')
      .populate('createdBy', 'firstName lastName');

    if (!protocol) {
      return res.status(404).json({
        success: false,
        message: 'Treatment protocol not found'
      });
    }

    // Check access (owner or system-wide)
    if (!protocol.isSystemWide && protocol.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this protocol'
      });
    }

    res.json({
      success: true,
      data: protocol
    });
  } catch (error) {
    logger.error('Error getting treatment protocol', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error retrieving treatment protocol',
      error: error.message
    });
  }
};

/**
 * Create new treatment protocol
 */
exports.createTreatmentProtocol = async (req, res) => {
  try {
    const protocolData = {
      ...req.body,
      createdBy: req.user._id
    };

    // Only admins can create system-wide protocols
    if (protocolData.isSystemWide && req.user.role !== 'admin') {
      protocolData.isSystemWide = false;
    }

    const protocol = new TreatmentProtocol(protocolData);
    await protocol.save();

    // Populate references
    await protocol.populate('medications.medicationTemplate');
    await protocol.populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Treatment protocol created successfully',
      data: protocol
    });
  } catch (error) {
    logger.error('Error creating treatment protocol', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error creating treatment protocol',
      error: error.message
    });
  }
};

/**
 * Update treatment protocol
 */
exports.updateTreatmentProtocol = async (req, res) => {
  try {
    const protocol = await TreatmentProtocol.findById(req.params.id);

    if (!protocol) {
      return res.status(404).json({
        success: false,
        message: 'Treatment protocol not found'
      });
    }

    // Check ownership (unless admin)
    if (req.user.role !== 'admin' && protocol.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this protocol'
      });
    }

    // Update fields (whitelist to prevent field injection)
    const allowedFields = [
      'name', 'description', 'medications', 'category',
      'tags', 'notes', 'dosageInstructions', 'duration',
      'frequency', 'indications', 'contraindications'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        protocol[field] = req.body[field];
      }
    });

    // Only admins can change isSystemWide
    if (req.body.isSystemWide !== undefined && req.user.role === 'admin') {
      protocol.isSystemWide = req.body.isSystemWide;
    }

    await protocol.save();

    // Populate references
    await protocol.populate('medications.medicationTemplate');
    await protocol.populate('createdBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Treatment protocol updated successfully',
      data: protocol
    });
  } catch (error) {
    logger.error('Error updating treatment protocol', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error updating treatment protocol',
      error: error.message
    });
  }
};

/**
 * Delete treatment protocol
 */
exports.deleteTreatmentProtocol = async (req, res) => {
  try {
    const protocol = await TreatmentProtocol.findById(req.params.id);

    if (!protocol) {
      return res.status(404).json({
        success: false,
        message: 'Treatment protocol not found'
      });
    }

    // Check ownership (unless admin)
    if (req.user.role !== 'admin' && protocol.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this protocol'
      });
    }

    // Soft delete by setting isActive to false
    protocol.isActive = false;
    await protocol.save();

    res.json({
      success: true,
      message: 'Treatment protocol deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting treatment protocol', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error deleting treatment protocol',
      error: error.message
    });
  }
};

/**
 * Increment usage count
 */
exports.incrementUsage = async (req, res) => {
  try {
    const protocol = await TreatmentProtocol.findById(req.params.id);

    if (!protocol) {
      return res.status(404).json({
        success: false,
        message: 'Treatment protocol not found'
      });
    }

    await protocol.incrementUsage();

    res.json({
      success: true,
      message: 'Usage count updated',
      data: {
        protocolId: protocol._id,
        usageCount: protocol.usageCount
      }
    });
  } catch (error) {
    logger.error('Error incrementing usage', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error updating usage count',
      error: error.message
    });
  }
};

/**
 * Toggle favorite status
 */
exports.toggleFavorite = async (req, res) => {
  try {
    const protocol = await TreatmentProtocol.findById(req.params.id);

    if (!protocol) {
      return res.status(404).json({
        success: false,
        message: 'Treatment protocol not found'
      });
    }

    // Only owner can favorite their own protocols
    if (protocol.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only favorite your own protocols'
      });
    }

    // Toggle between 'personal' and 'favorite'
    protocol.type = protocol.type === 'favorite' ? 'personal' : 'favorite';
    await protocol.save();

    res.json({
      success: true,
      message: `Protocol ${protocol.type === 'favorite' ? 'added to' : 'removed from'} favorites`,
      data: {
        protocolId: protocol._id,
        isFavorite: protocol.type === 'favorite'
      }
    });
  } catch (error) {
    logger.error('Error toggling favorite', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error updating favorite status',
      error: error.message
    });
  }
};

// =====================================================
// STUDIOVISION PARITY - ENHANCED ENDPOINTS
// =====================================================

/**
 * Apply protocol - Get prescription-ready medications
 * StudioVision Parity: "2-Click" prescription workflow
 */
exports.applyProtocol = async (req, res) => {
  try {
    const { id } = req.params;
    const { eye, patientId } = req.body; // Optional overrides

    const protocol = await TreatmentProtocol.findById(id)
      .populate('medications.medicationTemplate');

    if (!protocol) {
      return res.status(404).json({
        success: false,
        message: 'Treatment protocol not found'
      });
    }

    // Record usage with enhanced tracking
    await protocol.incrementUsage(req.user._id, patientId);

    // Generate prescription-ready medications
    const prescriptionMedications = protocol.toPrescriptionMedications({ eye });

    res.json({
      success: true,
      message: `Protocol "${protocol.name}" applied`,
      data: {
        protocol: {
          id: protocol._id,
          name: protocol.name,
          nameFr: protocol.nameFr,
          category: protocol.category,
          description: protocol.description
        },
        medications: prescriptionMedications,
        expectedDuration: protocol.expectedDuration,
        contraindications: protocol.contraindications
      }
    });
  } catch (error) {
    logger.error('Error applying protocol', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error applying treatment protocol',
      error: error.message
    });
  }
};

/**
 * Get protocols by category with enhanced filtering
 * StudioVision Parity: Category-organized protocol selection
 */
exports.getProtocolsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { includePersonal = 'true' } = req.query;

    // Build query
    const query = {
      category,
      isActive: true,
      $or: [
        { visibility: 'system' },
        { isSystemWide: true }
      ]
    };

    // Include personal protocols if requested
    if (includePersonal === 'true') {
      query.$or.push(
        { visibility: 'personal', createdBy: req.user._id },
        { visibility: 'clinic', clinic: req.user.clinic }
      );
    }

    const protocols = await TreatmentProtocol.find(query)
      .select('-usageHistory')
      .populate('medications.medicationTemplate', 'name genericName')
      .sort({ displayOrder: 1, usageCount: -1 });

    // Group by subcategory if available
    const grouped = protocols.reduce((acc, protocol) => {
      const key = protocol.subcategory || 'general';
      if (!acc[key]) acc[key] = [];
      acc[key].push(protocol);
      return acc;
    }, {});

    res.json({
      success: true,
      category,
      count: protocols.length,
      data: protocols,
      grouped
    });
  } catch (error) {
    logger.error('Error getting protocols by category', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error retrieving protocols by category',
      error: error.message
    });
  }
};

/**
 * Get all categories with protocol counts
 * StudioVision Parity: Quick category overview
 */
exports.getCategories = async (req, res) => {
  try {
    const categories = await TreatmentProtocol.aggregate([
      {
        $match: {
          isActive: true,
          $or: [
            { visibility: 'system' },
            { isSystemWide: true },
            { createdBy: req.user._id }
          ]
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalUsage: { $sum: '$usageCount' },
          icons: { $addToSet: '$icon' },
          colors: { $addToSet: '$color' }
        }
      },
      { $sort: { totalUsage: -1 } }
    ]);

    // Add category metadata
    const categoryLabels = {
      'post_operatoire': 'Post-opératoire',
      'post_surgical': 'Post-Surgical',
      'glaucome': 'Glaucome',
      'glaucoma': 'Glaucoma',
      'infection': 'Infection',
      'inflammation': 'Inflammation',
      'uveite': 'Uvéite',
      'allergie': 'Allergie',
      'allergy': 'Allergy',
      'secheresse_oculaire': 'Sécheresse Oculaire',
      'dry_eye': 'Dry Eye',
      'cataracte': 'Cataracte',
      'dmla': 'DMLA',
      'retinopathie_diabetique': 'Rétinopathie Diabétique',
      'injection': 'Injections',
      'prophylaxie': 'Prophylaxie',
      'pediatric': 'Pédiatrique',
      'emergency': 'Urgence'
    };

    const enrichedCategories = categories.map(cat => ({
      category: cat._id,
      label: categoryLabels[cat._id] || cat._id,
      count: cat.count,
      totalUsage: cat.totalUsage,
      icon: cat.icons[0] || '💊',
      color: cat.colors[0] || '#6B7280'
    }));

    res.json({
      success: true,
      count: enrichedCategories.length,
      data: enrichedCategories
    });
  } catch (error) {
    logger.error('Error getting categories', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error retrieving protocol categories',
      error: error.message
    });
  }
};

/**
 * Get protocols for a specific diagnosis (ICD code)
 * StudioVision Parity: Smart protocol suggestions
 */
exports.getProtocolsForDiagnosis = async (req, res) => {
  try {
    const { icdCode } = req.params;

    const protocols = await TreatmentProtocol.find({
      isActive: true,
      $or: [
        { 'indications.icdCode': icdCode },
        { 'indications.icdCode': new RegExp(`^${icdCode.split('.')[0]}`, 'i') }
      ],
      $or: [
        { visibility: 'system' },
        { isSystemWide: true },
        { createdBy: req.user._id }
      ]
    })
      .select('-usageHistory')
      .populate('medications.medicationTemplate', 'name genericName')
      .sort({ usageCount: -1 });

    res.json({
      success: true,
      icdCode,
      count: protocols.length,
      data: protocols
    });
  } catch (error) {
    logger.error('Error getting protocols for diagnosis', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error retrieving protocols for diagnosis',
      error: error.message
    });
  }
};

/**
 * Duplicate a protocol for personalization
 * StudioVision Parity: Create personal copy of system protocol
 */
exports.duplicateProtocol = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const originalProtocol = await TreatmentProtocol.findById(id);

    if (!originalProtocol) {
      return res.status(404).json({
        success: false,
        message: 'Treatment protocol not found'
      });
    }

    // Create duplicate
    const duplicateData = originalProtocol.toObject();
    delete duplicateData._id;
    delete duplicateData.protocolId;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;
    delete duplicateData.usageCount;
    delete duplicateData.usageHistory;
    delete duplicateData.lastUsed;

    duplicateData.name = name || `${originalProtocol.name} (Copy)`;
    duplicateData.nameFr = duplicateData.nameFr ? `${duplicateData.nameFr} (Copie)` : null;
    duplicateData.createdBy = req.user._id;
    duplicateData.type = 'personal';
    duplicateData.visibility = 'personal';
    duplicateData.isSystemWide = false;

    const newProtocol = await TreatmentProtocol.create(duplicateData);

    res.status(201).json({
      success: true,
      message: 'Protocol duplicated successfully',
      data: newProtocol
    });
  } catch (error) {
    logger.error('Error duplicating protocol', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error duplicating protocol',
      error: error.message
    });
  }
};
