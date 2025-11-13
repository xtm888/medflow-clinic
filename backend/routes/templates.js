const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Template = require('../models/Template');

// @desc    Create new template
// @route   POST /api/templates
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const template = await Template.create({
      ...req.body,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get templates by category
// @route   GET /api/templates
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { category, search, tags, isGlobal } = req.query;

    // Build query
    const query = { isActive: true };

    // Category filter
    if (category) {
      query.category = category;
    }

    // Search in name and tags
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Tags filter
    if (tags) {
      const tagArray = tags.split(',');
      query.tags = { $in: tagArray };
    }

    // Permission filter
    if (!isGlobal) {
      query.$or = [
        { isGlobal: true },
        { createdBy: req.user._id },
        { 'sharedWith.user': req.user._id },
        { 'permissions.roles': req.user.role }
      ];
    }

    const templates = await Template.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ usageCount: -1, name: 1 })
      .select('-previousVersions');

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get template by ID
// @route   GET /api/templates/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('modifiedBy', 'firstName lastName');

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Check permissions
    const hasAccess = template.isGlobal ||
      template.createdBy._id.toString() === req.user._id.toString() ||
      template.sharedWith.some(share => share.user.toString() === req.user._id.toString()) ||
      template.permissions.roles.includes(req.user.role);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this template'
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Update template
// @route   PUT /api/templates/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Check edit permissions
    const canEdit = template.createdBy.toString() === req.user._id.toString() ||
      template.sharedWith.some(share =>
        share.user.toString() === req.user._id.toString() && share.canEdit
      ) ||
      req.user.role === 'admin';

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to edit this template'
      });
    }

    // Update template
    Object.assign(template, req.body);
    template.modifiedBy = req.user._id;
    await template.save();

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Delete template
// @route   DELETE /api/templates/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Check delete permissions
    const canDelete = template.createdBy.toString() === req.user._id.toString() ||
      req.user.role === 'admin';

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to delete this template'
      });
    }

    // Soft delete by marking inactive
    template.isActive = false;
    await template.save();

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Apply template
// @route   POST /api/templates/:id/apply
// @access  Private
router.post('/:id/apply', protect, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Apply template with context variables
    const result = template.applyTemplate(req.body.context || {});

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error applying template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Clone template
// @route   POST /api/templates/:id/clone
// @access  Private
router.post('/:id/clone', protect, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Clone template
    const cloned = template.cloneTemplate(req.user._id, req.body);
    await cloned.save();

    res.status(201).json({
      success: true,
      data: cloned
    });
  } catch (error) {
    console.error('Error cloning template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Share template
// @route   POST /api/templates/:id/share
// @access  Private
router.post('/:id/share', protect, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Check if user can share
    if (template.createdBy.toString() !== req.user._id.toString() &&
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only the creator can share this template'
      });
    }

    // Add to shared list
    const { userId, canEdit = false } = req.body;

    // Check if already shared
    const existing = template.sharedWith.find(share =>
      share.user.toString() === userId
    );

    if (existing) {
      existing.canEdit = canEdit;
    } else {
      template.sharedWith.push({
        user: userId,
        canEdit,
        sharedAt: new Date()
      });
    }

    await template.save();

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error sharing template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get favorite templates
// @route   GET /api/templates/favorites
// @access  Private
router.get('/favorites', protect, async (req, res) => {
  try {
    const favorites = await Template.getFavorites(req.user._id, req.query.limit);

    res.json({
      success: true,
      data: favorites
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Pin/unpin template
// @route   PUT /api/templates/:id/pin
// @access  Private
router.put('/:id/pin', protect, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Toggle pin status
    template.quickAccess.isPinned = !template.quickAccess.isPinned;
    await template.save();

    res.json({
      success: true,
      data: {
        isPinned: template.quickAccess.isPinned
      }
    });
  } catch (error) {
    console.error('Error pinning template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get templates by category for user
// @route   GET /api/templates/category/:category
// @access  Private
router.get('/category/:category', protect, async (req, res) => {
  try {
    const templates = await Template.getTemplatesByCategory(
      req.params.category,
      req.user._id,
      req.user.role
    );

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching category templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Validate template (for admin/clinical leads)
// @route   PUT /api/templates/:id/validate
// @access  Private
router.put('/:id/validate', protect, authorize('admin', 'doctor'), async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Validate template
    template.clinicalValidation = {
      isValidated: true,
      validatedBy: req.user._id,
      validatedAt: new Date(),
      validationNotes: req.body.notes,
      expiryDate: req.body.expiryDate
    };

    await template.save();

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error validating template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;