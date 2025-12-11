const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getMedicationTemplates,
  getMedicationCategories,
  searchMedications,
  getExaminationTemplates,
  getExaminationCategories,
  getPathologyTemplates,
  getPathologyCategories,
  getPathologySubcategories,
  getLaboratoryTemplates,
  getLaboratoryCategories,
  getLaboratoryProfiles,
  getClinicalTemplates,
  getClinicalCategories,
  getCommentTemplates,
  getCommentCategories,
  getDoseTemplates,
  getDoseForms,
  getDoseByForm,
  getLetterTemplates,
  getLetterCategories,
  getLetterTemplateById,
  getEquipmentCatalog,
  getEquipmentCategories,
  getEquipmentSites,
  getEquipmentById,
  getTemplateCatalogStats
} = require('../controllers/templateCatalogController');

// ===== MEDICATION TEMPLATE ROUTES =====
router.get('/medications', protect, getMedicationTemplates);
router.get('/medications/categories', protect, getMedicationCategories);
router.get('/medications/search', protect, searchMedications);

// ===== EXAMINATION TEMPLATE ROUTES =====
router.get('/examinations', protect, getExaminationTemplates);
router.get('/examinations/categories', protect, getExaminationCategories);

// ===== PATHOLOGY TEMPLATE ROUTES =====
router.get('/pathologies', protect, getPathologyTemplates);
router.get('/pathologies/categories', protect, getPathologyCategories);
router.get('/pathologies/subcategories', protect, getPathologySubcategories);

// ===== LABORATORY TEMPLATE ROUTES =====
router.get('/laboratories', protect, getLaboratoryTemplates);
router.get('/laboratories/categories', protect, getLaboratoryCategories);
router.get('/laboratories/profiles', protect, getLaboratoryProfiles);

// ===== CLINICAL TEMPLATE ROUTES =====
router.get('/clinical', protect, getClinicalTemplates);
router.get('/clinical/categories', protect, getClinicalCategories);

// ===== COMMENT TEMPLATE ROUTES =====
router.get('/comments', protect, getCommentTemplates);
router.get('/comments/categories', protect, getCommentCategories);

// ===== DOSE TEMPLATE ROUTES =====
router.get('/doses', protect, getDoseTemplates);
router.get('/doses/forms', protect, getDoseForms);
router.get('/doses/by-form/:form', protect, getDoseByForm);

// ===== LETTER TEMPLATE ROUTES =====
router.get('/letters', protect, getLetterTemplates);
router.get('/letters/categories', protect, getLetterCategories);
router.get('/letters/:id', protect, getLetterTemplateById);

// ===== EQUIPMENT CATALOG ROUTES =====
router.get('/equipment', protect, getEquipmentCatalog);
router.get('/equipment/categories', protect, getEquipmentCategories);
router.get('/equipment/sites', protect, getEquipmentSites);
router.get('/equipment/:id', protect, getEquipmentById);

// ===== STATS =====
router.get('/stats', protect, getTemplateCatalogStats);

module.exports = router;
