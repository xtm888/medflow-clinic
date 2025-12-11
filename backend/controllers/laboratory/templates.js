const { asyncHandler } = require('../../middleware/errorHandler');
const LaboratoryTemplate = require('../../models/LaboratoryTemplate');

// @desc    Get laboratory templates
// @route   GET /api/laboratory/templates
// @access  Private
exports.getTemplates = asyncHandler(async (req, res) => {
  const templates = await LaboratoryTemplate.find({ isActive: true })
    .sort('category testName')
    .lean();

  res.status(200).json({
    success: true,
    count: templates.length,
    data: templates
  });
});

// @desc    Create laboratory template
// @route   POST /api/laboratory/templates
// @access  Private (Admin)
exports.createTemplate = asyncHandler(async (req, res) => {
  const template = await LaboratoryTemplate.create({
    ...req.body,
    createdBy: req.user.id
  });

  res.status(201).json({
    success: true,
    data: template
  });
});

// @desc    Get single template
// @route   GET /api/laboratory/templates/:id
// @access  Private
exports.getTemplate = asyncHandler(async (req, res) => {
  const template = await LaboratoryTemplate.findById(req.params.id)
    .populate('profileTests')
    .lean();

  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }

  res.status(200).json({
    success: true,
    data: template
  });
});

// @desc    Update template
// @route   PUT /api/laboratory/templates/:id
// @access  Private (Admin, Lab Tech)
exports.updateTemplate = asyncHandler(async (req, res) => {
  const template = await LaboratoryTemplate.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }

  res.status(200).json({
    success: true,
    data: template
  });
});

// @desc    Delete template
// @route   DELETE /api/laboratory/templates/:id
// @access  Private (Admin)
exports.deleteTemplate = asyncHandler(async (req, res) => {
  const template = await LaboratoryTemplate.findById(req.params.id);

  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }

  // Soft delete by marking as inactive
  template.isActive = false;
  template.deletedAt = new Date();
  template.deletedBy = req.user.id;
  await template.save();

  res.status(200).json({
    success: true,
    message: 'Template deleted successfully',
    data: {}
  });
});

module.exports = exports;
