const MedicationTemplate = require('../models/MedicationTemplate');
const ExaminationTemplate = require('../models/ExaminationTemplate');
const PathologyTemplate = require('../models/PathologyTemplate');
const LaboratoryTemplate = require('../models/LaboratoryTemplate');
const ClinicalTemplate = require('../models/ClinicalTemplate');
const CommentTemplate = require('../models/CommentTemplate');
const DoseTemplate = require('../models/DoseTemplate');
const LetterTemplate = require('../models/LetterTemplate');
const EquipmentCatalog = require('../models/EquipmentCatalog');
const TextSnippet = require('../models/TextSnippet');
const { PharmacyInventory } = require('../models/Inventory');
const { createContextLogger } = require('../utils/structuredLogger');
const { serverError } = require('../utils/apiResponse');

const logger = createContextLogger('TemplateCatalog');

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
    logger.error('Error fetching medication templates', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
      data: categories.sort((a, b) => a.localeCompare(b))
    });
  } catch (error) {
    logger.error('Error fetching medication categories', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
    logger.error('Error searching medications', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
  }
};

// ===== THERAPEUTIC CLASS BROWSER =====

// @desc    Get therapeutic classes with medication counts
// @route   GET /api/template-catalog/therapeutic-classes
// @access  Private
exports.getTherapeuticClasses = async (req, res) => {
  try {
    const { clinicId } = req.query;

    // Get all medication categories with counts from MedicationTemplate
    const categoriesAgg = await MedicationTemplate.aggregate([
      { $match: { isActive: true, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          medications: {
            $push: {
              name: '$name',
              form: '$form',
              dosage: '$dosage',
              packaging: '$packaging'
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Build hierarchical structure with French ophthalmic categories
    const therapeuticClasses = categoriesAgg.map(cat => ({
      id: cat._id,
      name: cat._id,
      medicationCount: cat.count,
      // Group into broader categories for Level 1
      parentCategory: getParentCategory(cat._id)
    }));

    // Group by parent category for hierarchical tree
    const hierarchy = {};
    therapeuticClasses.forEach(tc => {
      const parent = tc.parentCategory;
      if (!hierarchy[parent]) {
        hierarchy[parent] = {
          id: parent,
          name: parent,
          children: [],
          totalCount: 0
        };
      }
      hierarchy[parent].children.push({
        id: tc.id,
        name: tc.name,
        medicationCount: tc.medicationCount
      });
      hierarchy[parent].totalCount += tc.medicationCount;
    });

    res.json({
      success: true,
      data: {
        categories: therapeuticClasses,
        hierarchy: Object.values(hierarchy).sort((a, b) => a.name.localeCompare(b.name))
      }
    });
  } catch (error) {
    logger.error('Error fetching therapeutic classes', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
  }
};

// Helper: Map categories to parent groups for hierarchy
function getParentCategory(category) {
  const mapping = {
    // Anti-inflammatory group
    'A.I.N.S GENERAUX + CORTICOIDES': 'Anti-inflammatoires',
    'A.I.N.S LOCAUX': 'Anti-inflammatoires',
    'CORTICOIDES + ANTIBIOTIQUES': 'Anti-inflammatoires',
    'CORTICOIDES LOCAUX': 'Anti-inflammatoires',

    // Antiglaucoma group
    'ANTI GLAUCOMATEUX': 'Antiglaucomateux',

    // Antibiotics group
    'ANTIBIOTIQUE LOCAUX': 'Antibiotiques',
    'ANTIBIOTIQUE GENERAUX': 'Antibiotiques',

    // Antiallergic group
    'ANTI ALLERGIQUES': 'Antiallergiques',
    'ANTI HISTAMINIQUES GENERAUX': 'Antiallergiques',

    // Lubricants group
    'LARMES ARTIFICIELLES': 'Lubrifants & Larmes',
    'LARMES LOTIONS CONTACTO': 'Lubrifants & Larmes',

    // Mydriatics group
    'MYDRIATIQUES': 'Mydriatiques',

    // Anti-infectives group
    'ANTI VIRAUX': 'Anti-infectieux',
    'ANTI MYCOSIQUES': 'Anti-infectieux',
    'ANTISEPT SANS VASOCONS': 'Anti-infectieux',

    // Cataract group
    'ANTI CATARACTE': 'Cataracte',

    // Others
    'CICATRISANTS': 'Cicatrisants',
    'DECONGESTIONNANT': 'Décongestionnants',
    'DIVERS OPHA': 'Divers Ophtalmologie',
    'VASCULOTROPES': 'Vasculotropes',
    'VITAMINES': 'Vitamines & Suppléments',
    'ANESTHESIE LOCALES': 'Anesthésiques',
    'SEDATIF': 'Sédatifs'
  };

  return mapping[category] || 'Autres';
}

// @desc    Get medications by therapeutic class with stock levels
// @route   GET /api/template-catalog/therapeutic-classes/:classId/medications
// @access  Private
exports.getMedicationsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { clinicId, search, limit = 50 } = req.query;

    if (!classId) {
      return res.status(400).json({
        success: false,
        error: 'Class ID is required'
      });
    }

    // Decode the classId (URL encoded)
    const decodedClassId = decodeURIComponent(classId);

    // Build query for medication templates
    const query = {
      category: decodedClassId,
      isActive: true,
      isDeleted: { $ne: true }
    };

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.name = { $regex: escapedSearch, $options: 'i' };
    }

    // Get medications from template catalog
    const medications = await MedicationTemplate.find(query)
      .limit(parseInt(limit))
      .sort({ name: 1 })
      .lean();

    // Get stock levels from pharmacy inventory (if clinicId provided)
    let stockMap = {};
    if (clinicId) {
      const inventoryItems = await PharmacyInventory.find({
        clinic: clinicId,
        isDeleted: { $ne: true },
        active: true
      })
        .select('name genericName inventory.currentStock inventory.status pricing.sellingPrice')
        .lean();

      // Create a map by medication name (normalized) for quick lookup
      inventoryItems.forEach(item => {
        const normalizedName = (item.genericName || item.name || '').toLowerCase().trim();
        stockMap[normalizedName] = {
          currentStock: item.inventory?.currentStock || 0,
          status: item.inventory?.status || 'unknown',
          price: item.pricing?.sellingPrice || 0,
          inventoryId: item._id
        };
      });
    }

    // Enrich medications with stock info
    const enrichedMedications = medications.map(med => {
      const normalizedName = (med.name || '').toLowerCase().trim();
      const stockInfo = stockMap[normalizedName] || null;

      return {
        _id: med._id,
        name: med.name,
        form: med.form,
        dosage: med.dosage,
        packaging: med.packaging,
        category: med.category,
        stock: stockInfo ? {
          available: stockInfo.currentStock,
          status: stockInfo.status,
          price: stockInfo.price,
          inventoryId: stockInfo.inventoryId
        } : null
      };
    });

    res.json({
      success: true,
      count: enrichedMedications.length,
      category: decodedClassId,
      data: enrichedMedications
    });
  } catch (error) {
    logger.error('Error fetching medications by class', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
  }
};

// @desc    Get therapeutic alternatives for a medication
// @route   GET /api/template-catalog/medications/:medicationId/alternatives
// @access  Private
exports.getMedicationAlternatives = async (req, res) => {
  try {
    const { medicationId } = req.params;
    const { clinicId, limit = 10 } = req.query;

    // Find the original medication
    const originalMed = await MedicationTemplate.findById(medicationId);
    if (!originalMed) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      });
    }

    // Find alternatives in the same category
    const alternatives = await MedicationTemplate.find({
      category: originalMed.category,
      _id: { $ne: medicationId },
      isActive: true,
      isDeleted: { $ne: true }
    })
      .limit(parseInt(limit))
      .sort({ name: 1 })
      .lean();

    // Get stock levels if clinicId provided
    let enrichedAlternatives = alternatives;
    if (clinicId) {
      const inventoryItems = await PharmacyInventory.find({
        clinic: clinicId,
        isDeleted: { $ne: true },
        active: true
      })
        .select('name genericName inventory.currentStock inventory.status pricing.sellingPrice')
        .lean();

      const stockMap = {};
      inventoryItems.forEach(item => {
        const normalizedName = (item.genericName || item.name || '').toLowerCase().trim();
        stockMap[normalizedName] = {
          currentStock: item.inventory?.currentStock || 0,
          status: item.inventory?.status || 'unknown',
          price: item.pricing?.sellingPrice || 0
        };
      });

      enrichedAlternatives = alternatives.map(med => {
        const normalizedName = (med.name || '').toLowerCase().trim();
        const stockInfo = stockMap[normalizedName];
        return {
          ...med,
          stock: stockInfo || null
        };
      });
    }

    res.json({
      success: true,
      original: {
        id: originalMed._id,
        name: originalMed.name,
        category: originalMed.category
      },
      count: enrichedAlternatives.length,
      data: enrichedAlternatives
    });
  } catch (error) {
    logger.error('Error fetching medication alternatives', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
    logger.error('Error fetching examination templates', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
      data: categories.sort((a, b) => a.localeCompare(b))
    });
  } catch (error) {
    logger.error('Error fetching examination categories', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
    logger.error('Error fetching pathology templates', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
      data: categories.sort((a, b) => a.localeCompare(b))
    });
  } catch (error) {
    logger.error('Error fetching pathology categories', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
      data: subcategories.filter(s => s).sort((a, b) => a.localeCompare(b)) // Filter out null/empty
    });
  } catch (error) {
    logger.error('Error fetching pathology subcategories', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
  }
};

// @desc    Get pathology maquettes (templates grouped by type) for a category
// @route   GET /api/template-catalog/maquettes/:category
// @access  Private
exports.getPathologyMaquettes = async (req, res) => {
  try {
    const { category } = req.params;
    const { subcategory, search } = req.query;

    // Base query
    const query = {
      category,
      isActive: true,
      isDeleted: { $ne: true }
    };

    // Optional subcategory filter
    if (subcategory) {
      query.subcategory = subcategory;
    }

    // Optional search filter
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { value: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    // Fetch all templates for this category
    const templates = await PathologyTemplate.find(query)
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    // Group by type
    const symptoms = templates.filter(t => t.type === 'symptom');
    const descriptions = templates.filter(t => t.type === 'description');
    const diagnostics = templates.filter(t => t.type === 'diagnostic');
    const findings = templates.filter(t => t.type === 'finding');

    // Return grouped data
    res.json({
      success: true,
      data: {
        category,
        symptoms: symptoms.map(s => ({
          id: s._id,
          name: s.name,
          value: s.value || s.name,
          subcategory: s.subcategory,
          laterality: s.laterality,
          severity: s.severity
        })),
        descriptions: descriptions.map(d => ({
          id: d._id,
          name: d.name,
          value: d.value || d.name,
          subcategory: d.subcategory
        })),
        diagnostics: diagnostics.map(dx => ({
          id: dx._id,
          name: dx.name,
          code: dx.subcategory, // ICD-10 code stored in subcategory
          value: dx.value || dx.name
        })),
        findings: findings.map(f => ({
          id: f._id,
          name: f.name,
          value: f.value || f.name,
          subcategory: f.subcategory
        })),
        counts: {
          symptoms: symptoms.length,
          descriptions: descriptions.length,
          diagnostics: diagnostics.length,
          findings: findings.length,
          total: templates.length
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching pathology maquettes', { error: error.message, category: req.params.category });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
  }
};

// @desc    Get all maquettes categories with template counts
// @route   GET /api/template-catalog/maquettes
// @access  Private
exports.getMaquettesCategories = async (req, res) => {
  try {
    // Aggregate to get categories with counts by type
    const categoryCounts = await PathologyTemplate.aggregate([
      { $match: { isActive: true, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: { category: '$category', type: '$type' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.category',
          types: {
            $push: {
              type: '$_id.type',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Transform to more usable format
    const categories = categoryCounts.map(cat => {
      const typeCounts = {};
      cat.types.forEach(t => {
        typeCounts[t.type] = t.count;
      });

      return {
        id: cat._id,
        name: cat._id,
        total: cat.total,
        symptoms: typeCounts.symptom || 0,
        descriptions: typeCounts.description || 0,
        diagnostics: typeCounts.diagnostic || 0,
        findings: typeCounts.finding || 0
      };
    });

    res.json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    logger.error('Error fetching maquettes categories', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
    logger.error('Error fetching laboratory templates', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
      data: categories.sort((a, b) => a.localeCompare(b))
    });
  } catch (error) {
    logger.error('Error fetching laboratory categories', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
    logger.error('Error fetching laboratory profiles', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
    logger.error('Error fetching clinical templates', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
      data: categories.sort((a, b) => a.localeCompare(b))
    });
  } catch (error) {
    logger.error('Error fetching clinical categories', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
    logger.error('Error fetching comment templates', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
      data: categories.sort((a, b) => a.localeCompare(b))
    });
  } catch (error) {
    logger.error('Error fetching comment categories', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
    logger.error('Error fetching dose templates', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
      data: forms.sort((a, b) => a.localeCompare(b))
    });
  } catch (error) {
    logger.error('Error fetching dose forms', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
    logger.error('Error fetching dose by form', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
    logger.error('Error fetching letter templates', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
      data: categories.sort((a, b) => a.localeCompare(b))
    });
  } catch (error) {
    logger.error('Error fetching letter categories', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
    logger.error('Error fetching letter template', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
    logger.error('Error fetching equipment catalog', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
      data: categories.sort((a, b) => a.localeCompare(b))
    });
  } catch (error) {
    logger.error('Error fetching equipment categories', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
      data: sites.filter(s => s).sort((a, b) => a.localeCompare(b))
    });
  } catch (error) {
    logger.error('Error fetching equipment sites', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
    logger.error('Error fetching equipment', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
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
    logger.error('Error fetching template catalog stats', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
  }
};

// ===== TEXT SNIPPETS (Click-to-Build) =====

// @desc    Get text snippets by category
// @route   GET /api/template-catalog/snippets
// @access  Private
exports.getTextSnippets = async (req, res) => {
  try {
    const { category, search, limit = 50 } = req.query;
    const userId = req.user._id;
    const clinicId = req.user.currentClinicId;

    const query = {
      isActive: true,
      isDeleted: false,
      $or: [
        { scope: 'global' },
        { scope: 'clinic', clinicId },
        { scope: 'personal', userId }
      ]
    };

    if (category) {
      query.category = category;
    }

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        ...query.$or,
        { title: { $regex: escapedSearch, $options: 'i' } },
        { text: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    const snippets = await TextSnippet.find(query)
      .sort({ sortOrder: 1, usageCount: -1 })
      .limit(parseInt(limit))
      .select('title text shortcut category subcategory variables usageCount scope');

    res.json({
      success: true,
      count: snippets.length,
      data: snippets
    });
  } catch (error) {
    logger.error('Error fetching text snippets', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
  }
};

// @desc    Get snippet categories with counts
// @route   GET /api/template-catalog/snippets/categories
// @access  Private
exports.getSnippetCategories = async (req, res) => {
  try {
    const userId = req.user._id;
    const clinicId = req.user.currentClinicId;

    const categories = await TextSnippet.aggregate([
      {
        $match: {
          isActive: true,
          isDeleted: false,
          $or: [
            { scope: 'global' },
            { scope: 'clinic', clinicId },
            { scope: 'personal', userId }
          ]
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Category labels in French
    const categoryLabels = {
      symptom: 'Symptômes',
      finding: 'Constatations',
      recommendation: 'Recommandations',
      instruction: 'Instructions',
      diagnosis: 'Diagnostics',
      procedure: 'Procédures',
      anterior_segment: 'Segment antérieur',
      posterior_segment: 'Segment postérieur',
      refraction: 'Réfraction',
      iop: 'PIO',
      visual_field: 'Champ visuel',
      oct: 'OCT',
      surgery: 'Chirurgie',
      follow_up: 'Suivi',
      medication: 'Médicaments',
      general: 'Général'
    };

    res.json({
      success: true,
      data: categories.map(cat => ({
        id: cat._id,
        name: categoryLabels[cat._id] || cat._id,
        count: cat.count
      }))
    });
  } catch (error) {
    logger.error('Error fetching snippet categories', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
  }
};

// @desc    Get recent snippets for user
// @route   GET /api/template-catalog/snippets/recent
// @access  Private
exports.getRecentSnippets = async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 10;

    const snippets = await TextSnippet.getRecent(userId, limit);

    res.json({
      success: true,
      data: snippets
    });
  } catch (error) {
    logger.error('Error fetching recent snippets', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
  }
};

// @desc    Get most used snippets
// @route   GET /api/template-catalog/snippets/popular
// @access  Private
exports.getPopularSnippets = async (req, res) => {
  try {
    const userId = req.user._id;
    const clinicId = req.user.currentClinicId;
    const { category, limit = 20 } = req.query;

    const snippets = await TextSnippet.getMostUsed({
      userId,
      clinicId,
      category,
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: snippets
    });
  } catch (error) {
    logger.error('Error fetching popular snippets', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
  }
};

// @desc    Get all shortcuts for expansion
// @route   GET /api/template-catalog/snippets/shortcuts
// @access  Private
exports.getSnippetShortcuts = async (req, res) => {
  try {
    const userId = req.user._id;
    const clinicId = req.user.currentClinicId;

    const shortcuts = await TextSnippet.getAllShortcuts({ userId, clinicId });

    res.json({
      success: true,
      data: shortcuts
    });
  } catch (error) {
    logger.error('Error fetching snippet shortcuts', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
  }
};

// @desc    Expand a shortcut
// @route   GET /api/template-catalog/snippets/expand/:shortcut
// @access  Private
exports.expandSnippetShortcut = async (req, res) => {
  try {
    const { shortcut } = req.params;
    const userId = req.user._id;
    const clinicId = req.user.currentClinicId;

    const snippet = await TextSnippet.findByShortcut(shortcut, { userId, clinicId });

    if (!snippet) {
      return res.status(404).json({
        success: false,
        error: 'Raccourci non trouvé'
      });
    }

    // Increment usage
    await TextSnippet.findByIdAndUpdate(snippet._id, {
      $inc: { usageCount: 1 },
      lastUsedAt: new Date()
    });

    res.json({
      success: true,
      data: {
        title: snippet.title,
        text: snippet.text,
        variables: snippet.variables
      }
    });
  } catch (error) {
    logger.error('Error expanding snippet shortcut', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
  }
};

// @desc    Create a new snippet
// @route   POST /api/template-catalog/snippets
// @access  Private
exports.createTextSnippet = async (req, res) => {
  try {
    const { category, subcategory, title, text, shortcut, variables, scope, tags } = req.body;
    const userId = req.user._id;
    const clinicId = req.user.currentClinicId;

    // Validate required fields
    if (!category || !title || !text) {
      return res.status(400).json({
        success: false,
        error: 'Catégorie, titre et texte sont requis'
      });
    }

    // Check for duplicate shortcut
    if (shortcut) {
      const existing = await TextSnippet.findOne({
        shortcut: shortcut.toLowerCase(),
        isActive: true,
        isDeleted: false
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Ce raccourci est déjà utilisé'
        });
      }
    }

    const snippet = new TextSnippet({
      category,
      subcategory,
      title,
      text,
      shortcut: shortcut?.toLowerCase(),
      variables,
      scope: scope || 'personal',
      userId,
      clinicId: scope === 'clinic' ? clinicId : undefined,
      tags
    });

    await snippet.save();

    res.status(201).json({
      success: true,
      data: snippet
    });
  } catch (error) {
    logger.error('Error creating text snippet', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
  }
};

// @desc    Update a snippet
// @route   PUT /api/template-catalog/snippets/:id
// @access  Private
exports.updateTextSnippet = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const updates = req.body;

    const snippet = await TextSnippet.findById(id);

    if (!snippet) {
      return res.status(404).json({
        success: false,
        error: 'Snippet non trouvé'
      });
    }

    // Check ownership for personal snippets
    if (snippet.scope === 'personal' && snippet.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Vous ne pouvez pas modifier ce snippet'
      });
    }

    // Check for duplicate shortcut if changing
    if (updates.shortcut && updates.shortcut !== snippet.shortcut) {
      const existing = await TextSnippet.findOne({
        shortcut: updates.shortcut.toLowerCase(),
        isActive: true,
        isDeleted: false,
        _id: { $ne: id }
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Ce raccourci est déjà utilisé'
        });
      }
      updates.shortcut = updates.shortcut.toLowerCase();
    }

    Object.assign(snippet, updates);
    await snippet.save();

    res.json({
      success: true,
      data: snippet
    });
  } catch (error) {
    logger.error('Error updating text snippet', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
  }
};

// @desc    Delete a snippet (soft delete)
// @route   DELETE /api/template-catalog/snippets/:id
// @access  Private
exports.deleteTextSnippet = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const snippet = await TextSnippet.findById(id);

    if (!snippet) {
      return res.status(404).json({
        success: false,
        error: 'Snippet non trouvé'
      });
    }

    // Check ownership for personal snippets
    if (snippet.scope === 'personal' && snippet.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Vous ne pouvez pas supprimer ce snippet'
      });
    }

    snippet.isDeleted = true;
    snippet.deletedAt = new Date();
    await snippet.save();

    res.json({
      success: true,
      message: 'Snippet supprimé'
    });
  } catch (error) {
    logger.error('Error deleting text snippet', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
  }
};

// @desc    Record snippet usage
// @route   POST /api/template-catalog/snippets/:id/use
// @access  Private
exports.recordSnippetUsage = async (req, res) => {
  try {
    const { id } = req.params;

    const snippet = await TextSnippet.findByIdAndUpdate(
      id,
      {
        $inc: { usageCount: 1 },
        lastUsedAt: new Date()
      },
      { new: true }
    );

    if (!snippet) {
      return res.status(404).json({
        success: false,
        error: 'Snippet non trouvé'
      });
    }

    res.json({
      success: true,
      data: { usageCount: snippet.usageCount }
    });
  } catch (error) {
    logger.error('Error recording snippet usage', { error: error.message });
    return serverError(res, 'Erreur lors de l\'opération sur le modèle');
  }
};
