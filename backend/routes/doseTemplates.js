const express = require('express');
const router = express.Router();
const doseTemplateController = require('../controllers/doseTemplateController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// GET /api/dose-templates - Get all dose templates
router.get('/',
  doseTemplateController.getDoseTemplates
);

// GET /api/dose-templates/by-form/:form - Get template by medication form
router.get('/by-form/:form',
  doseTemplateController.getByForm
);

// GET /api/dose-templates/:id - Get single dose template
router.get('/:id',
  doseTemplateController.getDoseTemplateById
);

// POST /api/dose-templates - Create dose template (admin only)
router.post('/',
  authorize(['admin']),
  doseTemplateController.createDoseTemplate
);

// PUT /api/dose-templates/:id - Update dose template (admin only)
router.put('/:id',
  authorize(['admin']),
  doseTemplateController.updateDoseTemplate
);

// DELETE /api/dose-templates/:id - Delete dose template (admin only)
router.delete('/:id',
  authorize(['admin']),
  doseTemplateController.deleteDoseTemplate
);

module.exports = router;
