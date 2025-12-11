const express = require('express');
const router = express.Router();
const ConsultationTemplate = require('../models/ConsultationTemplate');
const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

/**
 * @route   GET /api/consultation-templates
 * @desc    Get all consultation templates (system + clinic-specific)
 * @access  Private (doctors, ophthalmologists)
 */
router.get('/', authorize('ophthalmologist', 'doctor', 'admin'), async (req, res) => {
  try {
    // Get system templates and clinic-specific templates
    const templates = await ConsultationTemplate.find({
      isActive: true,
      $or: [
        { isSystemTemplate: true },
        { clinic: req.user.clinic }
      ]
    }).sort({ order: 1, name: 1 });

    res.json({
      success: true,
      count: templates.length,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des modèles',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/consultation-templates/:id
 * @desc    Get single template by ID
 * @access  Private
 */
router.get('/:id', authorize('ophthalmologist', 'doctor', 'admin'), async (req, res) => {
  try {
    const template = await ConsultationTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Modèle non trouvé'
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
      message: 'Erreur lors de la récupération du modèle',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/consultation-templates
 * @desc    Create a new custom template
 * @access  Private (admin only for clinic-wide templates)
 */
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      category,
      icon,
      color,
      prefillData,
      order
    } = req.body;

    const template = await ConsultationTemplate.create({
      name,
      description,
      type: type || 'custom',
      category: category || 'other',
      icon: icon || 'file-text',
      color: color || 'blue',
      prefillData: prefillData || {},
      order: order || 100,
      isSystemTemplate: false,
      createdBy: req.user._id,
      clinic: req.user.clinic
    });

    res.status(201).json({
      success: true,
      message: 'Modèle créé avec succès',
      data: template
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du modèle',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/consultation-templates/:id
 * @desc    Update a template
 * @access  Private (admin only, cannot edit system templates)
 */
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const template = await ConsultationTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Modèle non trouvé'
      });
    }

    // Cannot edit system templates
    if (template.isSystemTemplate) {
      return res.status(403).json({
        success: false,
        message: 'Les modèles système ne peuvent pas être modifiés'
      });
    }

    // Can only edit templates from own clinic
    if (template.clinic && template.clinic.toString() !== req.user.clinic?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à modifier ce modèle'
      });
    }

    const {
      name,
      description,
      type,
      category,
      icon,
      color,
      prefillData,
      order,
      isActive
    } = req.body;

    // Update fields
    if (name) template.name = name;
    if (description !== undefined) template.description = description;
    if (type) template.type = type;
    if (category) template.category = category;
    if (icon) template.icon = icon;
    if (color) template.color = color;
    if (prefillData) template.prefillData = prefillData;
    if (order !== undefined) template.order = order;
    if (isActive !== undefined) template.isActive = isActive;

    await template.save();

    res.json({
      success: true,
      message: 'Modèle mis à jour avec succès',
      data: template
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du modèle',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/consultation-templates/:id
 * @desc    Delete a template (soft delete for system templates)
 * @access  Private (admin only)
 */
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const template = await ConsultationTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Modèle non trouvé'
      });
    }

    // Cannot delete system templates, only deactivate
    if (template.isSystemTemplate) {
      template.isActive = false;
      await template.save();
      return res.json({
        success: true,
        message: 'Modèle système désactivé'
      });
    }

    // Can only delete templates from own clinic
    if (template.clinic && template.clinic.toString() !== req.user.clinic?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à supprimer ce modèle'
      });
    }

    await ConsultationTemplate.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Modèle supprimé avec succès'
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du modèle',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/consultation-templates/:id/use
 * @desc    Record template usage (for statistics)
 * @access  Private
 */
router.post('/:id/use', authorize('ophthalmologist', 'doctor', 'admin'), async (req, res) => {
  try {
    const template = await ConsultationTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Modèle non trouvé'
      });
    }

    await template.recordUsage();

    res.json({
      success: true,
      message: 'Usage enregistré',
      data: {
        usageCount: template.usageCount,
        lastUsedAt: template.lastUsedAt
      }
    });
  } catch (error) {
    console.error('Error recording template usage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement de l\'usage',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/consultation-templates/:id/clone
 * @desc    Clone a template
 * @access  Private (admin)
 */
router.post('/:id/clone', authorize('admin'), async (req, res) => {
  try {
    const template = await ConsultationTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Modèle non trouvé'
      });
    }

    // Create a copy
    const clone = new ConsultationTemplate({
      name: `${template.name} (copie)`,
      description: template.description,
      type: template.type,
      category: template.category,
      icon: template.icon,
      color: template.color,
      prefillData: template.prefillData,
      order: template.order + 1,
      isSystemTemplate: false,
      isActive: true,
      createdBy: req.user._id,
      clinic: req.user.clinic
    });

    await clone.save();

    res.status(201).json({
      success: true,
      message: 'Modèle cloné avec succès',
      data: clone
    });
  } catch (error) {
    console.error('Error cloning template:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du clonage du modèle',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/consultation-templates/:id/pin
 * @desc    Toggle pin status of a template
 * @access  Private
 */
router.put('/:id/pin', authorize('ophthalmologist', 'doctor', 'admin'), async (req, res) => {
  try {
    const template = await ConsultationTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Modèle non trouvé'
      });
    }

    // Toggle pinned status (add field if doesn't exist)
    template.isPinned = !template.isPinned;
    await template.save();

    res.json({
      success: true,
      message: template.isPinned ? 'Modèle épinglé' : 'Modèle désépinglé',
      data: template
    });
  } catch (error) {
    console.error('Error pinning template:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'épinglage du modèle',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/consultation-templates/:id/apply
 * @desc    Apply a template (get prefilled data for use)
 * @access  Private
 */
router.post('/:id/apply', authorize('ophthalmologist', 'doctor', 'admin'), async (req, res) => {
  try {
    const template = await ConsultationTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Modèle non trouvé'
      });
    }

    // Record usage
    await template.recordUsage();

    // Apply context variables if provided
    const { context } = req.body;
    let appliedData = { ...template.prefillData };

    if (context) {
      // Replace placeholders like {{patientName}}, {{date}}, etc.
      const processValue = (value) => {
        if (typeof value === 'string') {
          return value.replace(/\{\{(\w+)\}\}/g, (match, key) => context[key] || match);
        }
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            return value.map(processValue);
          }
          const processed = {};
          for (const [k, v] of Object.entries(value)) {
            processed[k] = processValue(v);
          }
          return processed;
        }
        return value;
      };

      appliedData = processValue(appliedData);
    }

    res.json({
      success: true,
      message: 'Modèle appliqué',
      data: {
        template: template,
        appliedData: appliedData
      }
    });
  } catch (error) {
    console.error('Error applying template:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'application du modèle',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/consultation-templates/by-type/:type
 * @desc    Get templates by type
 * @access  Private
 */
router.get('/by-type/:type', authorize('ophthalmologist', 'doctor', 'admin'), async (req, res) => {
  try {
    const templates = await ConsultationTemplate.find({
      type: req.params.type,
      isActive: true,
      $or: [
        { isSystemTemplate: true },
        { clinic: req.user.clinic }
      ]
    }).sort({ order: 1, name: 1 });

    res.json({
      success: true,
      count: templates.length,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching templates by type:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des modèles',
      error: error.message
    });
  }
});

module.exports = router;
