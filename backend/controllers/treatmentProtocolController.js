const TreatmentProtocol = require('../models/TreatmentProtocol');
// Import Drug model to ensure it's registered for population
require('../models/Drug');

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
    console.error('Error getting treatment protocols:', error);
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
    console.error('Error getting popular protocols:', error);
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
    console.error('Error getting favorite protocols:', error);
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
    console.error('Error getting treatment protocol:', error);
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
    console.error('Error creating treatment protocol:', error);
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

    // Update fields
    Object.assign(protocol, req.body);

    // Only admins can change isSystemWide
    if (req.body.isSystemWide !== undefined && req.user.role !== 'admin') {
      protocol.isSystemWide = false;
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
    console.error('Error updating treatment protocol:', error);
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
    console.error('Error deleting treatment protocol:', error);
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
    console.error('Error incrementing usage:', error);
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
    console.error('Error toggling favorite:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating favorite status',
      error: error.message
    });
  }
};
