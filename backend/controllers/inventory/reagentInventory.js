/**
 * Reagent Inventory Controller
 *
 * Type-specific extension for laboratory reagent inventory management.
 * Extends InventoryControllerFactory with QC workflow and lab template linking.
 */

const { ReagentInventory } = require('../../models/Inventory');
const LaboratoryTemplate = require('../../models/LaboratoryTemplate');
const InventoryControllerFactory = require('./InventoryControllerFactory');

// Create factory instance with reagent-specific config
const factory = new InventoryControllerFactory({
  Model: ReagentInventory,
  entityName: 'reagent',
  entityNamePlural: 'reagents',
  searchFields: ['name', 'manufacturer', 'sku', 'catalogNumber'],
  defaultSort: '-updatedAt',
  activeField: 'isActive',
  selectExclude: '-transactions -usage.usageHistory'
});

// Override buildCustomFilters for reagent-specific filters
factory.buildCustomFilters = (filters) => {
  const query = {};
  if (filters.category) query.category = filters.category;
  if (filters.labSection) query.labSection = filters.labSection;
  if (filters.manufacturer) query.manufacturer = filters.manufacturer;
  return query;
};

// Get base handlers
const handlers = factory.getHandlers();

// ============================================
// TYPE-SPECIFIC: LABORATORY OPERATIONS
// ============================================

/**
 * Add batch (receive stock)
 */
const addBatch = async (req, res) => {
  try {
    const reagent = await ReagentInventory.findById(req.params.id);

    if (!reagent) {
      return res.status(404).json({
        success: false,
        error: 'Réactif non trouvé'
      });
    }

    const userId = req.user._id || req.user.id;
    await reagent.addBatch(req.body, userId);

    res.status(200).json({
      success: true,
      data: reagent,
      message: `Lot ${req.body.lotNumber} ajouté avec succès`
    });
  } catch (error) {
    console.error('Error adding reagent batch:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Consume reagent for test processing
 */
const consumeReagent = async (req, res) => {
  try {
    const reagent = await ReagentInventory.findById(req.params.id);

    if (!reagent) {
      return res.status(404).json({
        success: false,
        error: 'Réactif non trouvé'
      });
    }

    const { quantity, labOrderId, templateId, instrument, notes } = req.body;
    const userId = req.user._id || req.user.id;

    await reagent.consumeReagent(quantity, {
      labOrderId,
      templateId,
      instrument,
      notes
    }, userId);

    res.status(200).json({
      success: true,
      data: reagent,
      message: `${quantity} unité(s) consommée(s)`
    });
  } catch (error) {
    console.error('Error consuming reagent:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Consume for QC (quality control)
 */
const consumeForQC = async (req, res) => {
  try {
    const reagent = await ReagentInventory.findById(req.params.id);

    if (!reagent) {
      return res.status(404).json({
        success: false,
        error: 'Réactif non trouvé'
      });
    }

    const { quantity, lotNumber, level, expectedValue, actualValue, unit, acceptable, instrument, notes } = req.body;
    const userId = req.user._id || req.user.id;

    await reagent.consumeForQC(quantity, {
      lotNumber,
      level,
      expectedValue,
      actualValue,
      unit,
      acceptable,
      instrument,
      notes
    }, userId);

    res.status(200).json({
      success: true,
      data: reagent,
      message: 'Consommation QC enregistrée'
    });
  } catch (error) {
    console.error('Error consuming reagent for QC:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Mark batch as expired
 */
const expireBatch = async (req, res) => {
  try {
    const reagent = await ReagentInventory.findById(req.params.id);

    if (!reagent) {
      return res.status(404).json({
        success: false,
        error: 'Réactif non trouvé'
      });
    }

    const { lotNumber } = req.body;
    const userId = req.user._id || req.user.id;

    await reagent.markBatchExpired(lotNumber, userId);

    res.status(200).json({
      success: true,
      data: reagent,
      message: `Lot ${lotNumber} marqué comme expiré`
    });
  } catch (error) {
    console.error('Error expiring reagent batch:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Dispose reagent
 */
const disposeReagent = async (req, res) => {
  try {
    const reagent = await ReagentInventory.findById(req.params.id);

    if (!reagent) {
      return res.status(404).json({
        success: false,
        error: 'Réactif non trouvé'
      });
    }

    const { lotNumber, quantity, reason } = req.body;
    const userId = req.user._id || req.user.id;

    await reagent.disposeReagent(lotNumber, quantity, reason, userId);

    res.status(200).json({
      success: true,
      data: reagent,
      message: 'Réactif éliminé'
    });
  } catch (error) {
    console.error('Error disposing reagent:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get expiring items
 */
const getExpiring = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const items = await ReagentInventory.getExpiringItems(parseInt(days));

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error('Error getting expiring reagents:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get items by lab section
 */
const getBySection = async (req, res) => {
  try {
    const items = await ReagentInventory.getByLabSection(req.params.section);

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error('Error getting reagents by section:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get QC history
 */
const getQCHistory = async (req, res) => {
  try {
    const reagent = await ReagentInventory.findById(req.params.id)
      .select('qc name sku')
      .populate('qc.qcResults.performedBy', 'firstName lastName');

    if (!reagent) {
      return res.status(404).json({
        success: false,
        error: 'Réactif non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        reagent: { name: reagent.name, sku: reagent.sku },
        qcSettings: {
          requiresQC: reagent.qc.requiresQC,
          qcFrequency: reagent.qc.qcFrequency,
          lastQCDate: reagent.qc.lastQCDate
        },
        qcResults: reagent.qc.qcResults.sort((a, b) => new Date(b.date) - new Date(a.date))
      }
    });
  } catch (error) {
    console.error('Error getting reagent QC history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Link reagent to laboratory template
 */
const linkTemplate = async (req, res) => {
  try {
    const reagent = await ReagentInventory.findById(req.params.id);

    if (!reagent) {
      return res.status(404).json({
        success: false,
        error: 'Réactif non trouvé'
      });
    }

    const { templateId } = req.body;

    // Verify template exists
    const template = await LaboratoryTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template non trouvé'
      });
    }

    // Add if not already linked
    if (!reagent.compatibility.linkedTemplates.includes(templateId)) {
      reagent.compatibility.linkedTemplates.push(templateId);
      reagent.updatedBy = req.user._id || req.user.id;
      await reagent.save();
    }

    res.status(200).json({
      success: true,
      message: `Réactif lié au template ${template.name}`,
      data: reagent
    });
  } catch (error) {
    console.error('Error linking reagent to template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get manufacturers list
 */
const getManufacturers = async (req, res) => {
  try {
    const manufacturers = await ReagentInventory.distinct('manufacturer', { isActive: true });

    res.status(200).json({
      success: true,
      data: manufacturers.filter(m => m).sort()
    });
  } catch (error) {
    console.error('Error getting reagent manufacturers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Export all handlers - base + type-specific
module.exports = {
  // Base CRUD
  getReagents: handlers.getAll,
  getReagent: handlers.getOne,
  createReagent: handlers.create,
  updateReagent: handlers.update,
  deleteReagent: handlers.delete,

  // Base reporting
  getStats: handlers.getStats,
  getLowStock: handlers.getLowStock,
  getInventoryValue: handlers.getInventoryValue,

  // Base search/filter
  searchReagents: handlers.search,
  getAlerts: handlers.getAlerts,
  resolveAlert: handlers.resolveAlert,
  getTransactions: handlers.getTransactions,

  // Type-specific: batch and stock operations
  addBatch,
  adjustStock: handlers.adjustStock,

  // Type-specific: consumption workflow
  consumeReagent,
  consumeForQC,
  expireBatch,
  disposeReagent,

  // Type-specific: lab organization
  getExpiring,
  getBySection,
  getQCHistory,
  linkTemplate,
  getManufacturers
};
