const MedicationTemplate = require('../models/MedicationTemplate');
const ExaminationTemplate = require('../models/ExaminationTemplate');
const PathologyTemplate = require('../models/PathologyTemplate');
const LaboratoryTemplate = require('../models/LaboratoryTemplate');
const ClinicalTemplate = require('../models/ClinicalTemplate');

// ===== MEDICATION TEMPLATES =====

// @desc    Get all medication templates with search/filter
// @route   GET /api/template-catalog/medications
// @access  Private
exports.getMedicationTemplates = async (req, res) => {
  try {
    const { category, search, limit = 100 } = req.query;

    const query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { searchTerms: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const medications = await MedicationTemplate.find(query)
      .limit(parseInt(limit))
      .sort({ category: 1, name: 1 });

    res.json({
      success: true,
      count: medications.length,
      data: medications
    });
  } catch (error) {
    console.error('Error fetching medication templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get medication categories
// @route   GET /api/template-catalog/medications/categories
// @access  Private
exports.getMedicationCategories = async (req, res) => {
  try {
    const categories = await MedicationTemplate.distinct('category', { isActive: true });

    res.json({
      success: true,
      data: categories.sort()
    });
  } catch (error) {
    console.error('Error fetching medication categories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Search medications by name
// @route   GET /api/template-catalog/medications/search
// @access  Private
exports.searchMedications = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) is required'
      });
    }

    const medications = await MedicationTemplate.find({
      isActive: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { searchTerms: { $in: [new RegExp(q, 'i')] } }
      ]
    })
      .limit(parseInt(limit))
      .select('name category form dosage packaging')
      .sort({ name: 1 });

    res.json({
      success: true,
      count: medications.length,
      data: medications
    });
  } catch (error) {
    console.error('Error searching medications:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ===== EXAMINATION TEMPLATES =====

// @desc    Get all examination templates
// @route   GET /api/template-catalog/examinations
// @access  Private
exports.getExaminationTemplates = async (req, res) => {
  try {
    const { category, search, limit = 100 } = req.query;

    const query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const examinations = await ExaminationTemplate.find(query)
      .limit(parseInt(limit))
      .sort({ category: 1, name: 1 });

    res.json({
      success: true,
      count: examinations.length,
      data: examinations
    });
  } catch (error) {
    console.error('Error fetching examination templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get examination categories
// @route   GET /api/template-catalog/examinations/categories
// @access  Private
exports.getExaminationCategories = async (req, res) => {
  try {
    const categories = await ExaminationTemplate.distinct('category', { isActive: true });

    res.json({
      success: true,
      data: categories.sort()
    });
  } catch (error) {
    console.error('Error fetching examination categories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ===== PATHOLOGY TEMPLATES =====

// @desc    Get all pathology templates
// @route   GET /api/template-catalog/pathologies
// @access  Private
exports.getPathologyTemplates = async (req, res) => {
  try {
    const { category, subcategory, type, search, limit = 200 } = req.query;

    const query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (subcategory) {
      query.subcategory = subcategory;
    }

    if (type) {
      query.type = type;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { value: { $regex: search, $options: 'i' } }
      ];
    }

    const pathologies = await PathologyTemplate.find(query)
      .limit(parseInt(limit))
      .sort({ category: 1, subcategory: 1, type: 1, name: 1 });

    res.json({
      success: true,
      count: pathologies.length,
      data: pathologies
    });
  } catch (error) {
    console.error('Error fetching pathology templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get pathology categories
// @route   GET /api/template-catalog/pathologies/categories
// @access  Private
exports.getPathologyCategories = async (req, res) => {
  try {
    const categories = await PathologyTemplate.distinct('category', { isActive: true });

    res.json({
      success: true,
      data: categories.sort()
    });
  } catch (error) {
    console.error('Error fetching pathology categories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get pathology subcategories by category
// @route   GET /api/template-catalog/pathologies/subcategories
// @access  Private
exports.getPathologySubcategories = async (req, res) => {
  try {
    const { category } = req.query;

    const query = { isActive: true };
    if (category) {
      query.category = category;
    }

    const subcategories = await PathologyTemplate.distinct('subcategory', query);

    res.json({
      success: true,
      data: subcategories.filter(s => s).sort() // Filter out null/empty
    });
  } catch (error) {
    console.error('Error fetching pathology subcategories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ===== LABORATORY TEMPLATES =====

// @desc    Get all laboratory templates
// @route   GET /api/template-catalog/laboratories
// @access  Private
exports.getLaboratoryTemplates = async (req, res) => {
  try {
    const { category, search, isProfile, limit = 100 } = req.query;

    const query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (isProfile !== undefined) {
      query.isProfile = isProfile === 'true';
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const laboratories = await LaboratoryTemplate.find(query)
      .populate('profileTests', 'name code')
      .limit(parseInt(limit))
      .sort({ category: 1, name: 1 });

    res.json({
      success: true,
      count: laboratories.length,
      data: laboratories
    });
  } catch (error) {
    console.error('Error fetching laboratory templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get laboratory categories
// @route   GET /api/template-catalog/laboratories/categories
// @access  Private
exports.getLaboratoryCategories = async (req, res) => {
  try {
    const categories = await LaboratoryTemplate.distinct('category', { isActive: true });

    res.json({
      success: true,
      data: categories.sort()
    });
  } catch (error) {
    console.error('Error fetching laboratory categories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get laboratory profiles (collections of tests)
// @route   GET /api/template-catalog/laboratories/profiles
// @access  Private
exports.getLaboratoryProfiles = async (req, res) => {
  try {
    const profiles = await LaboratoryTemplate.find({
      isActive: true,
      isProfile: true
    })
      .populate('profileTests', 'name code unit normalRange')
      .sort({ category: 1, name: 1 });

    res.json({
      success: true,
      count: profiles.length,
      data: profiles
    });
  } catch (error) {
    console.error('Error fetching laboratory profiles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ===== CLINICAL TEMPLATES =====

// @desc    Get all clinical templates
// @route   GET /api/template-catalog/clinical
// @access  Private
exports.getClinicalTemplates = async (req, res) => {
  try {
    const { category, search, limit = 100 } = req.query;

    const query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { value: { $regex: search, $options: 'i' } }
      ];
    }

    const clinical = await ClinicalTemplate.find(query)
      .limit(parseInt(limit))
      .sort({ category: 1, name: 1 });

    res.json({
      success: true,
      count: clinical.length,
      data: clinical
    });
  } catch (error) {
    console.error('Error fetching clinical templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get clinical categories
// @route   GET /api/template-catalog/clinical/categories
// @access  Private
exports.getClinicalCategories = async (req, res) => {
  try {
    const categories = await ClinicalTemplate.distinct('category', { isActive: true });

    res.json({
      success: true,
      data: categories.sort()
    });
  } catch (error) {
    console.error('Error fetching clinical categories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ===== UTILITY ENDPOINTS =====

// @desc    Get all template catalog stats
// @route   GET /api/template-catalog/stats
// @access  Private
exports.getTemplateCatalogStats = async (req, res) => {
  try {
    const [
      medicationCount,
      examinationCount,
      pathologyCount,
      laboratoryCount,
      clinicalCount
    ] = await Promise.all([
      MedicationTemplate.countDocuments({ isActive: true }),
      ExaminationTemplate.countDocuments({ isActive: true }),
      PathologyTemplate.countDocuments({ isActive: true }),
      LaboratoryTemplate.countDocuments({ isActive: true }),
      ClinicalTemplate.countDocuments({ isActive: true })
    ]);

    res.json({
      success: true,
      data: {
        medications: medicationCount,
        examinations: examinationCount,
        pathologies: pathologyCount,
        laboratories: laboratoryCount,
        clinical: clinicalCount,
        total: medicationCount + examinationCount + pathologyCount + laboratoryCount + clinicalCount
      }
    });
  } catch (error) {
    console.error('Error fetching template catalog stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
