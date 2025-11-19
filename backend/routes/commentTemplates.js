const express = require('express');
const router = express.Router();
const {
  getCommentTemplates,
  getCommentTemplatesByCategory,
  getMostUsedTemplates,
  incrementTemplateUsage,
  createCommentTemplate,
  updateCommentTemplate,
  deleteCommentTemplate
} = require('../controllers/commentTemplateController');

const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Public routes (all authenticated users)
router.get('/', getCommentTemplates);
router.get('/most-used', getMostUsedTemplates);
router.get('/category/:category', getCommentTemplatesByCategory);
router.put('/:id/use', incrementTemplateUsage);

// Admin/Doctor only routes
router.post('/', authorize('admin', 'doctor', 'ophthalmologist'), createCommentTemplate);
router.put('/:id', authorize('admin', 'doctor', 'ophthalmologist'), updateCommentTemplate);
router.delete('/:id', authorize('admin'), deleteCommentTemplate);

module.exports = router;
