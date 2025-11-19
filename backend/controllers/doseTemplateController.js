const DoseTemplate = require('../models/DoseTemplate');

/**
 * Get all dose templates
 */
exports.getDoseTemplates = async (req, res) => {
  try {
    const { form, active } = req.query;

    const query = {};
    if (form) query.medicationForm = form;
    if (active !== undefined) query.isActive = active === 'true';

    const templates = await DoseTemplate.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ medicationForm: 1, createdAt: -1 });

    res.json({
      success: true,
      count: templates.length,
      data: templates
    });
  } catch (error) {
    console.error('Error getting dose templates:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving dose templates',
      error: error.message
    });
  }
};

/**
 * Get dose template by medication form
 */
exports.getByForm = async (req, res) => {
  try {
    const { form } = req.params;

    const template = await DoseTemplate.getByForm(form);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: `No template found for medication form: ${form}`
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error getting dose template by form:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving dose template',
      error: error.message
    });
  }
};

/**
 * Get single dose template by ID
 */
exports.getDoseTemplateById = async (req, res) => {
  try {
    const template = await DoseTemplate.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Dose template not found'
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error getting dose template:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving dose template',
      error: error.message
    });
  }
};

/**
 * Create new dose template
 */
exports.createDoseTemplate = async (req, res) => {
  try {
    const templateData = {
      ...req.body,
      createdBy: req.user._id
    };

    const template = new DoseTemplate(templateData);
    await template.save();

    res.status(201).json({
      success: true,
      message: 'Dose template created successfully',
      data: template
    });
  } catch (error) {
    console.error('Error creating dose template:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A template for this medication form already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating dose template',
      error: error.message
    });
  }
};

/**
 * Update dose template
 */
exports.updateDoseTemplate = async (req, res) => {
  try {
    const template = await DoseTemplate.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName');

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Dose template not found'
      });
    }

    res.json({
      success: true,
      message: 'Dose template updated successfully',
      data: template
    });
  } catch (error) {
    console.error('Error updating dose template:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating dose template',
      error: error.message
    });
  }
};

/**
 * Delete dose template
 */
exports.deleteDoseTemplate = async (req, res) => {
  try {
    const template = await DoseTemplate.findByIdAndDelete(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Dose template not found'
      });
    }

    res.json({
      success: true,
      message: 'Dose template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting dose template:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting dose template',
      error: error.message
    });
  }
};
