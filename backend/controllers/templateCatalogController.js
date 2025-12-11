const MedicationTemplate = require('../models/MedicationTemplate');
const ExaminationTemplate = require('../models/ExaminationTemplate');
const PathologyTemplate = require('../models/PathologyTemplate');
const LaboratoryTemplate = require('../models/LaboratoryTemplate');
const ClinicalTemplate = require('../models/ClinicalTemplate');
const CommentTemplate = require('../models/CommentTemplate');
const DoseTemplate = require('../models/DoseTemplate');
const LetterTemplate = require('../models/LetterTemplate');
const EquipmentCatalog = require('../models/EquipmentCatalog');

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
      // Escape special regex characters to prevent ReDoS/injection attacks
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { searchTerms: { $in: [new RegExp(escapedSearch, 'i')] } }
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

    // Escape special regex characters to prevent ReDoS/injection attacks
    const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const medications = await MedicationTemplate.find({
      isActive: true,
      $or: [
        { name: { $regex: escapedQ, $options: 'i' } },
        { searchTerms: { $in: [new RegExp(escapedQ, 'i')] } }
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

// ===== COMMENT TEMPLATES =====

// @desc    Get all comment templates
// @route   GET /api/template-catalog/comments
// @access  Private
exports.getCommentTemplates = async (req, res) => {
  try {
    const { category, search, limit = 100 } = req.query;

    const query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { text: { $regex: search, $options: 'i' } },
        { label: { $regex: search, $options: 'i' } }
      ];
    }

    const comments = await CommentTemplate.find(query)
      .limit(parseInt(limit))
      .sort({ category: 1, order: 1, label: 1 });

    res.json({
      success: true,
      count: comments.length,
      data: comments
    });
  } catch (error) {
    console.error('Error fetching comment templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get comment categories
// @route   GET /api/template-catalog/comments/categories
// @access  Private
exports.getCommentCategories = async (req, res) => {
  try {
    const categories = await CommentTemplate.distinct('category', { isActive: true });

    res.json({
      success: true,
      data: categories.sort()
    });
  } catch (error) {
    console.error('Error fetching comment categories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ===== DOSE TEMPLATES =====

// @desc    Get all dose templates
// @route   GET /api/template-catalog/doses
// @access  Private
exports.getDoseTemplates = async (req, res) => {
  try {
    const { form, search, limit = 100 } = req.query;

    const query = { isActive: true };

    if (form) {
      query.form = form;
    }

    if (search) {
      query.$or = [
        { form: { $regex: search, $options: 'i' } },
        { 'doses.value': { $regex: search, $options: 'i' } },
        { 'posologies.value': { $regex: search, $options: 'i' } }
      ];
    }

    const doses = await DoseTemplate.find(query)
      .limit(parseInt(limit))
      .sort({ form: 1 });

    res.json({
      success: true,
      count: doses.length,
      data: doses
    });
  } catch (error) {
    console.error('Error fetching dose templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get dose forms
// @route   GET /api/template-catalog/doses/forms
// @access  Private
exports.getDoseForms = async (req, res) => {
  try {
    const forms = await DoseTemplate.distinct('form', { isActive: true });

    res.json({
      success: true,
      data: forms.sort()
    });
  } catch (error) {
    console.error('Error fetching dose forms:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get dose template by form
// @route   GET /api/template-catalog/doses/by-form/:form
// @access  Private
exports.getDoseByForm = async (req, res) => {
  try {
    const dose = await DoseTemplate.findOne({
      form: req.params.form,
      isActive: true
    });

    if (!dose) {
      return res.status(404).json({
        success: false,
        error: 'Dose template not found for this form'
      });
    }

    res.json({
      success: true,
      data: dose
    });
  } catch (error) {
    console.error('Error fetching dose by form:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ===== LETTER TEMPLATES =====

// @desc    Get all letter templates
// @route   GET /api/template-catalog/letters
// @access  Private
exports.getLetterTemplates = async (req, res) => {
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

    const letters = await LetterTemplate.find(query)
      .limit(parseInt(limit))
      .sort({ category: 1, name: 1 });

    res.json({
      success: true,
      count: letters.length,
      data: letters
    });
  } catch (error) {
    console.error('Error fetching letter templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get letter categories
// @route   GET /api/template-catalog/letters/categories
// @access  Private
exports.getLetterCategories = async (req, res) => {
  try {
    const categories = await LetterTemplate.distinct('category', { isActive: true });

    res.json({
      success: true,
      data: categories.sort()
    });
  } catch (error) {
    console.error('Error fetching letter categories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get letter template by ID
// @route   GET /api/template-catalog/letters/:id
// @access  Private
exports.getLetterTemplateById = async (req, res) => {
  try {
    const letter = await LetterTemplate.findById(req.params.id);

    if (!letter) {
      return res.status(404).json({
        success: false,
        error: 'Letter template not found'
      });
    }

    res.json({
      success: true,
      data: letter
    });
  } catch (error) {
    console.error('Error fetching letter template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ===== EQUIPMENT CATALOG =====

// @desc    Get all equipment
// @route   GET /api/template-catalog/equipment
// @access  Private
exports.getEquipmentCatalog = async (req, res) => {
  try {
    const { category, site, manufacturer, search, limit = 100 } = req.query;

    const query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (site) {
      query.site = site;
    }

    if (manufacturer) {
      query.manufacturer = manufacturer;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } }
      ];
    }

    const equipment = await EquipmentCatalog.find(query)
      .limit(parseInt(limit))
      .sort({ category: 1, name: 1 });

    res.json({
      success: true,
      count: equipment.length,
      data: equipment
    });
  } catch (error) {
    console.error('Error fetching equipment catalog:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get equipment categories
// @route   GET /api/template-catalog/equipment/categories
// @access  Private
exports.getEquipmentCategories = async (req, res) => {
  try {
    const categories = await EquipmentCatalog.distinct('category', { isActive: true });

    res.json({
      success: true,
      data: categories.sort()
    });
  } catch (error) {
    console.error('Error fetching equipment categories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get equipment sites
// @route   GET /api/template-catalog/equipment/sites
// @access  Private
exports.getEquipmentSites = async (req, res) => {
  try {
    const sites = await EquipmentCatalog.distinct('site', { isActive: true });

    res.json({
      success: true,
      data: sites.filter(s => s).sort()
    });
  } catch (error) {
    console.error('Error fetching equipment sites:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Get equipment by ID
// @route   GET /api/template-catalog/equipment/:id
// @access  Private
exports.getEquipmentById = async (req, res) => {
  try {
    const equipment = await EquipmentCatalog.findById(req.params.id);

    if (!equipment) {
      return res.status(404).json({
        success: false,
        error: 'Equipment not found'
      });
    }

    res.json({
      success: true,
      data: equipment
    });
  } catch (error) {
    console.error('Error fetching equipment:', error);
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
      clinicalCount,
      commentCount,
      doseCount,
      letterCount,
      equipmentCount
    ] = await Promise.all([
      MedicationTemplate.countDocuments({ isActive: true }),
      ExaminationTemplate.countDocuments({ isActive: true }),
      PathologyTemplate.countDocuments({ isActive: true }),
      LaboratoryTemplate.countDocuments({ isActive: true }),
      ClinicalTemplate.countDocuments({ isActive: true }),
      CommentTemplate.countDocuments({ isActive: true }),
      DoseTemplate.countDocuments({ isActive: true }),
      LetterTemplate.countDocuments({ isActive: true }),
      EquipmentCatalog.countDocuments({ isActive: true })
    ]);

    res.json({
      success: true,
      data: {
        medications: medicationCount,
        examinations: examinationCount,
        pathologies: pathologyCount,
        laboratories: laboratoryCount,
        clinical: clinicalCount,
        comments: commentCount,
        doses: doseCount,
        letters: letterCount,
        equipment: equipmentCount,
        total: medicationCount + examinationCount + pathologyCount + laboratoryCount + clinicalCount + commentCount + doseCount + letterCount + equipmentCount
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
