const CommentTemplate = require('../models/CommentTemplate');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Get all comment templates
// @route   GET /api/comment-templates
// @access  Private
exports.getCommentTemplates = asyncHandler(async (req, res, next) => {
  const { category } = req.query;

  const query = { isActive: true };
  if (category) query.category = category;

  const templates = await CommentTemplate.find(query)
    .sort({ category: 1, sortOrder: 1, usageCount: -1 })
    .select('category title text usageCount');

  res.status(200).json({
    success: true,
    count: templates.length,
    data: templates
  });
});

// @desc    Get comment templates by category
// @route   GET /api/comment-templates/category/:category
// @access  Private
exports.getCommentTemplatesByCategory = asyncHandler(async (req, res, next) => {
  const templates = await CommentTemplate.getByCategory(req.params.category);

  res.status(200).json({
    success: true,
    count: templates.length,
    data: templates
  });
});

// @desc    Get most used comment templates
// @route   GET /api/comment-templates/most-used
// @access  Private
exports.getMostUsedTemplates = asyncHandler(async (req, res, next) => {
  const { limit = 10 } = req.query;

  const templates = await CommentTemplate.getMostUsed(parseInt(limit));

  res.status(200).json({
    success: true,
    count: templates.length,
    data: templates
  });
});

// @desc    Increment template usage count
// @route   PUT /api/comment-templates/:id/use
// @access  Private
exports.incrementTemplateUsage = asyncHandler(async (req, res, next) => {
  const template = await CommentTemplate.findById(req.params.id);

  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }

  await template.incrementUsage();

  res.status(200).json({
    success: true,
    message: 'Template usage incremented',
    data: template
  });
});

// @desc    Create comment template
// @route   POST /api/comment-templates
// @access  Private (Admin, Doctor)
exports.createCommentTemplate = asyncHandler(async (req, res, next) => {
  req.body.createdBy = req.user.id;

  const template = await CommentTemplate.create(req.body);

  res.status(201).json({
    success: true,
    message: 'Comment template created successfully',
    data: template
  });
});

// @desc    Update comment template
// @route   PUT /api/comment-templates/:id
// @access  Private (Admin, Doctor)
exports.updateCommentTemplate = asyncHandler(async (req, res, next) => {
  const template = await CommentTemplate.findById(req.params.id);

  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }

  // Prevent updating certain fields
  delete req.body.usageCount;
  delete req.body.createdBy;

  Object.assign(template, req.body);
  await template.save();

  res.status(200).json({
    success: true,
    message: 'Comment template updated successfully',
    data: template
  });
});

// @desc    Delete comment template
// @route   DELETE /api/comment-templates/:id
// @access  Private (Admin)
exports.deleteCommentTemplate = asyncHandler(async (req, res, next) => {
  const template = await CommentTemplate.findById(req.params.id);

  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }

  // Soft delete - just mark as inactive
  template.isActive = false;
  await template.save();

  res.status(200).json({
    success: true,
    message: 'Comment template deactivated successfully'
  });
});
