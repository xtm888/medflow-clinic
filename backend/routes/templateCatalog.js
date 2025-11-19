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

// ===== STATS =====
router.get('/stats', protect, getTemplateCatalogStats);

module.exports = router;
