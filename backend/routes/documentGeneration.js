const express = require('express');
const router = express.Router();
const {
  getTemplates,
  getTemplate,
  getTemplateByCode,
  previewTemplate,
  generateDocument,
  getVisitDocuments,
  getPatientDocuments,
  getCategories,
  bulkGenerateDocuments
} = require('../controllers/documentGenerationController');

const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Template management routes
router.get('/templates', getTemplates);
router.get('/templates/:id', getTemplate);
router.get('/templates/code/:templateId', getTemplateByCode);
router.get('/categories', getCategories);

// Document generation routes
router.post('/templates/:id/preview', previewTemplate);
router.post('/generate', authorize('admin', 'doctor', 'ophthalmologist', 'nurse', 'orthoptist'), generateDocument);

// Visit document routes
router.get('/visit/:visitId/documents', getVisitDocuments);
router.post('/visit/:visitId/bulk-generate', authorize('admin', 'doctor', 'ophthalmologist'), bulkGenerateDocuments);

// Patient document routes
router.get('/patient/:patientId/documents', getPatientDocuments);

module.exports = router;
