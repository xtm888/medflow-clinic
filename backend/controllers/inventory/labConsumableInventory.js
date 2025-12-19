/**
 * Lab Consumable Inventory Controller
 *
 * Type-specific extension for laboratory consumable inventory management.
 * Extends InventoryControllerFactory with department consumption and tube statistics.
 */

const { LabConsumableInventory } = require('../../models/Inventory');
const InventoryControllerFactory = require('./InventoryControllerFactory');

// Create factory instance with lab consumable-specific config
const factory = new InventoryControllerFactory({
  Model: LabConsumableInventory,
  entityName: 'consumable',
  entityNamePlural: 'consumables',
  searchFields: ['name', 'manufacturer', 'sku'],
  defaultSort: '-updatedAt',
  activeField: 'isActive',
  selectExclude: '-transactions -usage.usageHistory'
});

// Override buildCustomFilters for lab consumable-specific filters
factory.buildCustomFilters = (filters) => {
  const query = {};
  if (filters.category) query.category = filters.category;
  if (filters.tubeType) query.tubeType = filters.tubeType;
  if (filters.manufacturer) query.manufacturer = filters.manufacturer;
  return query;
};

// Get base handlers
const handlers = factory.getHandlers();

// ============================================
// TYPE-SPECIFIC: BATCH OPERATIONS
// ============================================

/**
 * Add batch (receive stock)
 */
const addBatch = async (req, res) => {
  try {
    const consumable = await LabConsumableInventory.findById(req.params.id);

    if (!consumable) {
      return res.status(404).json({
        success: false,
        error: 'Consommable non trouvé'
      });
    }

    const userId = req.user._id || req.user.id;
    await consumable.addBatch(req.body, userId);

    res.status(200).json({
      success: true,
      data: consumable,
      message: `Lot ${req.body.lotNumber} ajouté avec succès`
    });
  } catch (error) {
    console.error('Error adding lab consumable batch:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ============================================
// TYPE-SPECIFIC: CONSUMPTION OPERATIONS
// ============================================

/**
 * Consume item (with department/purpose tracking)
 */
const consumeItem = async (req, res) => {
  try {
    const consumable = await LabConsumableInventory.findById(req.params.id);

    if (!consumable) {
      return res.status(404).json({
        success: false,
        error: 'Consommable non trouvé'
      });
    }

    const { quantity, department, purpose, reference, notes } = req.body;
    const userId = req.user._id || req.user.id;

    await consumable.consumeItem(quantity, {
      department,
      purpose,
      reference,
      notes
    }, userId);

    res.status(200).json({
      success: true,
      data: consumable,
      message: `${quantity} unité(s) consommée(s)`
    });
  } catch (error) {
    console.error('Error consuming lab consumable:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Mark batch as damaged
 */
const markDamaged = async (req, res) => {
  try {
    const consumable = await LabConsumableInventory.findById(req.params.id);

    if (!consumable) {
      return res.status(404).json({
        success: false,
        error: 'Consommable non trouvé'
      });
    }

    const { lotNumber, quantity, reason } = req.body;
    const userId = req.user._id || req.user.id;

    await consumable.markBatchDamaged(lotNumber, quantity, reason, userId);

    res.status(200).json({
      success: true,
      data: consumable,
      message: 'Stock marqué comme endommagé'
    });
  } catch (error) {
    console.error('Error marking lab consumable as damaged:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ============================================
// TYPE-SPECIFIC: TUBE OPERATIONS
// ============================================

/**
 * Get collection tubes
 */
const getCollectionTubes = async (req, res) => {
  try {
    const tubes = await LabConsumableInventory.getCollectionTubes();

    res.status(200).json({
      success: true,
      count: tubes.length,
      data: tubes
    });
  } catch (error) {
    console.error('Error getting collection tubes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get tube statistics
 */
const getTubeStats = async (req, res) => {
  try {
    const stats = await LabConsumableInventory.getTubeStats();

    // Map tube types to French labels
    const tubeLabels = {
      'edta-purple': 'EDTA (Violet)',
      'heparin-green': 'Héparine (Vert)',
      'sst-gold': 'SST (Or)',
      'citrate-blue': 'Citrate (Bleu)',
      'fluoride-gray': 'Fluorure (Gris)',
      'plain-red': 'Sec (Rouge)',
      'edta-pink': 'EDTA (Rose)',
      'acd-yellow': 'ACD (Jaune)',
      'trace-royal-blue': 'Trace Elements (Bleu Royal)',
      'other': 'Autre'
    };

    const mappedStats = stats.map(s => ({
      tubeType: s._id,
      label: tubeLabels[s._id] || s._id,
      totalStock: s.totalStock,
      itemCount: s.count
    }));

    res.status(200).json({
      success: true,
      data: mappedStats
    });
  } catch (error) {
    console.error('Error getting tube stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get tube types list
 */
const getTubeTypes = async (req, res) => {
  try {
    const tubeTypes = [
      { value: 'edta-purple', label: 'EDTA (Violet)', color: '#8B5CF6', usage: 'Hématologie' },
      { value: 'heparin-green', label: 'Héparine (Vert)', color: '#10B981', usage: 'Chimie plasma' },
      { value: 'sst-gold', label: 'SST (Or/Jaune)', color: '#F59E0B', usage: 'Sérum avec gel' },
      { value: 'citrate-blue', label: 'Citrate (Bleu)', color: '#3B82F6', usage: 'Coagulation' },
      { value: 'fluoride-gray', label: 'Fluorure (Gris)', color: '#6B7280', usage: 'Glucose' },
      { value: 'plain-red', label: 'Sec (Rouge)', color: '#EF4444', usage: 'Sérum' },
      { value: 'edta-pink', label: 'EDTA (Rose)', color: '#EC4899', usage: 'Banque de sang' },
      { value: 'acd-yellow', label: 'ACD (Jaune)', color: '#FCD34D', usage: 'Banque de sang' },
      { value: 'trace-royal-blue', label: 'Trace Elements (Bleu Royal)', color: '#1E40AF', usage: 'Éléments traces' },
      { value: 'other', label: 'Autre', color: '#9CA3AF', usage: 'Divers' }
    ];

    res.status(200).json({
      success: true,
      data: tubeTypes
    });
  } catch (error) {
    console.error('Error getting tube types:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ============================================
// TYPE-SPECIFIC: CATEGORIZATION
// ============================================

/**
 * Get items by category
 */
const getByCategory = async (req, res) => {
  try {
    const items = await LabConsumableInventory.getByCategory(req.params.category);

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error('Error getting lab consumables by category:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get categories list
 */
const getCategories = async (req, res) => {
  try {
    const categories = [
      { value: 'collection-tube', label: 'Tubes de prélèvement' },
      { value: 'needle', label: 'Aiguilles' },
      { value: 'syringe', label: 'Seringues' },
      { value: 'lancet', label: 'Lancettes' },
      { value: 'slide', label: 'Lames' },
      { value: 'coverslip', label: 'Lamelles' },
      { value: 'container', label: 'Conteneurs' },
      { value: 'swab', label: 'Écouvillons' },
      { value: 'pipette-tip', label: 'Embouts de pipette' },
      { value: 'cuvette', label: 'Cuvettes' },
      { value: 'filter', label: 'Filtres' },
      { value: 'glove', label: 'Gants' },
      { value: 'mask', label: 'Masques' },
      { value: 'protective-wear', label: 'Équipement de protection' },
      { value: 'cleaning-supply', label: 'Produits de nettoyage' },
      { value: 'label', label: 'Étiquettes' },
      { value: 'transport-media', label: 'Milieux de transport' },
      { value: 'other', label: 'Autre' }
    ];

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error getting categories:', error);
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
    const manufacturers = await LabConsumableInventory.distinct('manufacturer', { isActive: true });

    res.status(200).json({
      success: true,
      data: manufacturers.filter(m => m).sort()
    });
  } catch (error) {
    console.error('Error getting lab consumable manufacturers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Export all handlers - base + type-specific
module.exports = {
  // Base CRUD
  getConsumables: handlers.getAll,
  getConsumable: handlers.getOne,
  createConsumable: handlers.create,
  updateConsumable: handlers.update,
  deleteConsumable: handlers.delete,

  // Base reporting
  getStats: handlers.getStats,
  getLowStock: handlers.getLowStock,
  getInventoryValue: handlers.getInventoryValue,

  // Base search/filter
  searchConsumables: handlers.search,
  getAlerts: handlers.getAlerts,
  resolveAlert: handlers.resolveAlert,
  getTransactions: handlers.getTransactions,

  // Type-specific: batch operations
  addBatch,
  adjustStock: handlers.adjustStock,

  // Type-specific: consumption
  consumeItem,
  markDamaged,

  // Type-specific: tube operations
  getCollectionTubes,
  getTubeStats,
  getTubeTypes,

  // Type-specific: categorization
  getByCategory,
  getCategories,
  getManufacturers
};
