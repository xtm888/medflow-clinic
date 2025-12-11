/**
 * Surgical Supply Inventory Controller
 *
 * Type-specific extension for surgical supply inventory management.
 * Extends InventoryControllerFactory with surgery workflow, IOL power matching, and batch recalls.
 */

const mongoose = require('mongoose');
const SurgicalSupplyInventory = require('../../models/SurgicalSupplyInventory');
const InventoryControllerFactory = require('./InventoryControllerFactory');

// Create factory instance with surgical supply-specific config
const factory = new InventoryControllerFactory({
  Model: SurgicalSupplyInventory,
  entityName: 'surgical supply',
  entityNamePlural: 'surgical supplies',
  searchFields: ['productName', 'brand', 'sku', 'manufacturer', 'model'],
  defaultSort: '-createdAt',
  activeField: 'active',
  selectExclude: ''
});

// Override buildCustomFilters for surgical supply-specific filters
factory.buildCustomFilters = (filters) => {
  const query = {};
  if (filters.clinic) query.clinic = filters.clinic;
  if (filters.category) query.category = filters.category;
  if (filters.brand) query.brand = { $regex: filters.brand, $options: 'i' };
  if (filters.iolType) {
    query.category = 'iol';
    query['iol.type'] = filters.iolType;
  }
  if (filters.iolPower) {
    query.category = 'iol';
    query['iol.power'] = parseFloat(filters.iolPower);
  }
  if (filters.expiringWithinDays) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(filters.expiringWithinDays));
    query['inventory.nearestExpiry'] = { $lte: futureDate, $gt: new Date() };
  }
  return query;
};

// Get base handlers
const handlers = factory.getHandlers();

// ============================================
// TYPE-SPECIFIC: SURGERY WORKFLOW
// ============================================

/**
 * Reserve for surgery
 */
const reserveForSurgery = async (req, res) => {
  try {
    const supply = await SurgicalSupplyInventory.findById(req.params.id);
    if (!supply) {
      return res.status(404).json({ success: false, message: 'Supply not found' });
    }

    const { quantity, surgeryId } = req.body;
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Valid quantity required' });
    }

    const result = await supply.reserveForSurgery(quantity, surgeryId, req.user._id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error reserving for surgery:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Consume for surgery (with patient tracking)
 */
const consumeForSurgery = async (req, res) => {
  try {
    const supply = await SurgicalSupplyInventory.findById(req.params.id);
    if (!supply) {
      return res.status(404).json({ success: false, message: 'Supply not found' });
    }

    const { quantity, surgeryId, patientId, serialNumber, lotNumber } = req.body;
    if (!quantity || !surgeryId || !patientId) {
      return res.status(400).json({
        success: false,
        message: 'Quantity, surgery ID, and patient ID are required'
      });
    }

    const result = await supply.useForSurgery(
      quantity,
      surgeryId,
      patientId,
      req.user._id,
      serialNumber,
      lotNumber
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error consuming for surgery:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Release reservation
 */
const releaseReservation = async (req, res) => {
  try {
    const supply = await SurgicalSupplyInventory.findById(req.params.id);
    if (!supply) {
      return res.status(404).json({ success: false, message: 'Supply not found' });
    }

    const { quantity } = req.body;
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Valid quantity required' });
    }

    const result = await supply.releaseReservation(quantity);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error releasing reservation:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// TYPE-SPECIFIC: IOL OPERATIONS
// ============================================

/**
 * Find IOL by power
 */
const findIOLByPower = async (req, res) => {
  try {
    const { power, type, clinic, includeRange } = req.query;

    if (!power) {
      return res.status(400).json({ success: false, message: 'Power is required' });
    }

    const powerValue = parseFloat(power);
    const query = {
      category: 'iol',
      active: true,
      'inventory.available': { $gt: 0 }
    };

    if (clinic) query.clinic = clinic;
    if (type) query['iol.type'] = type;

    // Find exact power matches
    const exactMatches = await SurgicalSupplyInventory.find({
      ...query,
      'iol.power': powerValue
    }).sort({ 'inventory.nearestExpiry': 1 }).lean();

    // Find range matches if requested
    let rangeMatches = [];
    if (includeRange === 'true') {
      rangeMatches = await SurgicalSupplyInventory.find({
        ...query,
        'iol.power': null,
        'iol.powerRange.min': { $lte: powerValue },
        'iol.powerRange.max': { $gte: powerValue }
      }).sort({ 'inventory.nearestExpiry': 1 }).lean();
    }

    res.json({
      success: true,
      data: {
        exactMatches,
        rangeMatches,
        total: exactMatches.length + rangeMatches.length
      }
    });
  } catch (error) {
    console.error('Error finding IOL by power:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get IOL types for dropdown
 */
const getIOLTypes = async (req, res) => {
  try {
    const iolTypes = [
      { value: 'monofocal', label: 'Monofocal' },
      { value: 'multifocal', label: 'Multifocal' },
      { value: 'toric', label: 'Toric' },
      { value: 'toric-multifocal', label: 'Toric Multifocal' },
      { value: 'edof', label: 'Extended Depth of Focus (EDOF)' },
      { value: 'accommodating', label: 'Accommodating' },
      { value: 'phakic', label: 'Phakic ICL' }
    ];

    const iolMaterials = [
      { value: 'hydrophobic-acrylic', label: 'Hydrophobic Acrylic' },
      { value: 'hydrophilic-acrylic', label: 'Hydrophilic Acrylic' },
      { value: 'silicone', label: 'Silicone' },
      { value: 'pmma', label: 'PMMA' },
      { value: 'collamer', label: 'Collamer' }
    ];

    const iolDesigns = [
      { value: '1-piece', label: '1-Piece' },
      { value: '3-piece', label: '3-Piece' },
      { value: 'plate-haptic', label: 'Plate Haptic' }
    ];

    res.json({
      success: true,
      data: { types: iolTypes, materials: iolMaterials, designs: iolDesigns }
    });
  } catch (error) {
    console.error('Error getting IOL types:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// TYPE-SPECIFIC: EXPIRATION & BATCHES
// ============================================

/**
 * Get expiring soon
 */
const getExpiringSoon = async (req, res) => {
  try {
    const { days = 30, clinic, category } = req.query;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const query = {
      active: true,
      'inventory.nearestExpiry': { $lte: futureDate, $gt: new Date() }
    };

    if (clinic) query.clinic = clinic;
    if (category) query.category = category;

    const supplies = await SurgicalSupplyInventory.find(query)
      .sort({ 'inventory.nearestExpiry': 1 })
      .populate('clinic', 'name')
      .lean();

    // Group by expiry urgency
    const now = new Date();
    const sevenDays = new Date();
    sevenDays.setDate(now.getDate() + 7);

    const grouped = {
      critical: supplies.filter(s => s.inventory.nearestExpiry <= sevenDays),
      warning: supplies.filter(s => s.inventory.nearestExpiry > sevenDays)
    };

    res.json({
      success: true,
      data: supplies,
      grouped,
      total: supplies.length
    });
  } catch (error) {
    console.error('Error getting expiring supplies:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get batches
 */
const getBatches = async (req, res) => {
  try {
    const supply = await SurgicalSupplyInventory.findById(req.params.id)
      .select('sku productName brand batches')
      .lean();

    if (!supply) {
      return res.status(404).json({ success: false, message: 'Supply not found' });
    }

    // Sort batches by expiration (FEFO)
    const sortedBatches = supply.batches.sort((a, b) =>
      new Date(a.expirationDate) - new Date(b.expirationDate)
    );

    res.json({
      success: true,
      data: {
        supply: {
          _id: supply._id,
          sku: supply.sku,
          productName: supply.productName,
          brand: supply.brand
        },
        batches: sortedBatches
      }
    });
  } catch (error) {
    console.error('Error getting batches:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update batch
 */
const updateBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const supply = await SurgicalSupplyInventory.findOne({
      'batches._id': batchId
    });

    if (!supply) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const batch = supply.batches.id(batchId);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const allowedUpdates = ['status', 'sterilizationDate', 'sterilizationExpiry'];
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        batch[key] = req.body[key];
      }
    }

    supply.updatedBy = req.user._id;
    await supply.save();

    res.json({ success: true, data: batch });
  } catch (error) {
    console.error('Error updating batch:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Recall batch
 */
const recallBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { reason } = req.body;

    const supply = await SurgicalSupplyInventory.findOne({
      'batches._id': batchId
    });

    if (!supply) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const batch = supply.batches.id(batchId);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    batch.status = 'recalled';
    supply.inventory.currentStock -= batch.quantity;
    supply.inventory.reserved -= batch.reserved;

    supply.alerts.push({
      type: 'recall',
      message: `Batch ${batch.lotNumber} recalled: ${reason || 'No reason specified'}`,
      severity: 'critical'
    });

    supply.updatedBy = req.user._id;
    await supply.save();

    res.json({ success: true, message: 'Batch recalled successfully' });
  } catch (error) {
    console.error('Error recalling batch:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get categories
 */
const getCategories = async (req, res) => {
  try {
    const categories = [
      { value: 'iol', label: 'Intraocular Lenses', icon: 'eye' },
      { value: 'viscoelastic', label: 'Viscoelastic (OVD)', icon: 'droplet' },
      { value: 'suture', label: 'Sutures', icon: 'thread' },
      { value: 'blade-knife', label: 'Blades & Knives', icon: 'knife' },
      { value: 'cannula', label: 'Cannulas', icon: 'syringe' },
      { value: 'phaco-consumable', label: 'Phaco Consumables', icon: 'machine' },
      { value: 'sterile-pack', label: 'Sterile Packs', icon: 'package' },
      { value: 'drape', label: 'Surgical Drapes', icon: 'sheet' },
      { value: 'implant-accessory', label: 'Implant Accessories', icon: 'tool' },
      { value: 'intravitreal', label: 'Intravitreal Supplies', icon: 'injection' },
      { value: 'laser-consumable', label: 'Laser Consumables', icon: 'laser' },
      { value: 'instrument', label: 'Instruments', icon: 'forceps' },
      { value: 'sterilization-supply', label: 'Sterilization Supplies', icon: 'sterile' },
      { value: 'surgical-consumable', label: 'General Consumables', icon: 'supplies' }
    ];

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Export all handlers - base + type-specific
module.exports = {
  // Base CRUD
  getSupplies: handlers.getAll,
  getSupply: handlers.getOne,
  createSupply: handlers.create,
  updateSupply: handlers.update,
  deleteSupply: handlers.delete,

  // Base stock operations
  addStock: handlers.addStock,
  adjustStock: handlers.adjustStock,

  // Base reporting
  getStats: handlers.getStats,
  getLowStock: handlers.getLowStock,

  // Base search/filter
  searchSupplies: handlers.search,
  getBrands: handlers.getBrands,
  getAlerts: handlers.getAlerts,
  acknowledgeAlert: handlers.resolveAlert,

  // Type-specific: surgery workflow
  reserveForSurgery,
  consumeForSurgery,
  releaseReservation,

  // Type-specific: IOL operations
  findIOLByPower,
  getIOLTypes,

  // Type-specific: batch management
  getExpiringSoon,
  getBatches,
  updateBatch,
  recallBatch,

  // Type-specific: enumerations
  getCategories
};
