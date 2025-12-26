/**
 * Optical Lens Inventory Controller
 *
 * Type-specific extension for optical lens (spectacle) inventory management.
 * Extends InventoryControllerFactory with glasses order workflow and specs matching.
 */

const mongoose = require('mongoose');
const { OpticalLensInventory } = require('../../models/Inventory');
const InventoryControllerFactory = require('./InventoryControllerFactory');

const { createContextLogger } = require('../../utils/structuredLogger');
const log = createContextLogger('OpticalLensInventory');

// Create factory instance with optical lens-specific config
const factory = new InventoryControllerFactory({
  Model: OpticalLensInventory,
  entityName: 'optical lens',
  entityNamePlural: 'optical lenses',
  searchFields: ['brand', 'productLine', 'sku', 'manufacturer'],
  defaultSort: 'brand',
  activeField: 'active',
  selectExclude: '-batches -alerts -usage'
});

// Override buildCustomFilters for optical lens-specific filters
factory.buildCustomFilters = (filters) => {
  const query = {};
  if (filters.clinic) query.clinic = filters.clinic;
  if (filters.brand) query.brand = { $regex: filters.brand, $options: 'i' };
  if (filters.material) query.material = filters.material;
  if (filters.design) query.design = filters.design;
  if (filters.category) query.category = filters.category;
  if (filters.lensType) query.lensType = filters.lensType;
  if (filters.isPhotochromic === 'true') query.isPhotochromic = true;
  if (filters.isPolarized === 'true') query.isPolarized = true;
  if (filters.inStockOnly === 'true') query['inventory.currentStock'] = { $gt: 0 };
  return query;
};

// Get base handlers
const handlers = factory.getHandlers();

// ============================================
// TYPE-SPECIFIC: GLASSES ORDER WORKFLOW
// ============================================

/**
 * Reserve stock for glasses order
 */
const reserveForOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const lens = await OpticalLensInventory.findById(req.params.id).session(session);

    if (!lens) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Optical lens not found'
      });
    }

    const { orderId, quantity = 1 } = req.body;

    if (!orderId) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Use model's reserveStock method
    const result = await lens.reserveStock(parseInt(quantity), orderId);

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Stock reserved successfully',
      data: {
        reserved: result.reserved,
        available: lens.availableStock,
        currentStock: lens.inventory.currentStock
      }
    });
  } catch (error) {
    await session.abortTransaction();
    log.error('Error reserving optical lens stock:', { error: error });
    res.status(500).json({
      success: false,
      message: error.message || 'Error reserving stock'
    });
  } finally {
    session.endSession();
  }
};

/**
 * Release reservation
 */
const releaseReservation = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const lens = await OpticalLensInventory.findById(req.params.id).session(session);

    if (!lens) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Optical lens not found'
      });
    }

    const { quantity = 1 } = req.body;

    const result = await lens.releaseReservation(parseInt(quantity));

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Reservation released successfully',
      data: result
    });
  } catch (error) {
    await session.abortTransaction();
    log.error('Error releasing optical lens reservation:', { error: error });
    res.status(500).json({
      success: false,
      message: error.message || 'Error releasing reservation'
    });
  } finally {
    session.endSession();
  }
};

/**
 * Fulfill reservation (complete sale)
 */
const fulfillReservation = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const lens = await OpticalLensInventory.findById(req.params.id).session(session);

    if (!lens) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Optical lens not found'
      });
    }

    const { quantity = 1 } = req.body;

    const result = await lens.fulfillReservation(parseInt(quantity));

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Sale completed successfully',
      data: result
    });
  } catch (error) {
    await session.abortTransaction();
    log.error('Error fulfilling optical lens reservation:', { error: error });
    res.status(500).json({
      success: false,
      message: error.message || 'Error completing sale'
    });
  } finally {
    session.endSession();
  }
};

// ============================================
// TYPE-SPECIFIC: SPECS MATCHING
// ============================================

/**
 * Find lenses by specifications (for glasses order)
 */
const findBySpecs = async (req, res) => {
  try {
    const { clinic, material, design, isPhotochromic, isPolarized, coatings } = req.query;

    if (!clinic) {
      return res.status(400).json({
        success: false,
        message: 'Clinic ID is required'
      });
    }

    const specs = {};
    if (material) specs.material = material;
    if (design) specs.design = design;
    if (isPhotochromic === 'true') specs.isPhotochromic = true;
    if (isPolarized === 'true') specs.isPolarized = true;
    if (coatings) specs.coatings = coatings.split(',');

    const lenses = await OpticalLensInventory.findBySpecs(clinic, specs);

    res.json({
      success: true,
      data: lenses,
      count: lenses.length
    });
  } catch (error) {
    log.error('Error finding optical lenses by specs:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Error finding lenses',
      error: error.message
    });
  }
};

/**
 * Get lenses by material
 */
const getByMaterial = async (req, res) => {
  try {
    const { material } = req.params;
    const { clinic } = req.query;

    const query = { active: true, material };
    if (clinic) query.clinic = clinic;

    const lenses = await OpticalLensInventory.find(query)
      .populate('clinic', 'name shortName')
      .select('sku brand productLine design coatings pricing inventory')
      .lean();

    res.json({
      success: true,
      data: lenses,
      count: lenses.length
    });
  } catch (error) {
    log.error('Error getting optical lenses by material:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Error retrieving lenses',
      error: error.message
    });
  }
};

/**
 * Acknowledge alert (optical lens uses 'acknowledged' not 'resolved')
 */
const acknowledgeAlert = async (req, res) => {
  try {
    const lens = await OpticalLensInventory.findById(req.params.id);

    if (!lens) {
      return res.status(404).json({
        success: false,
        message: 'Optical lens not found'
      });
    }

    const alert = lens.alerts.id(req.params.alertId);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = req.user.id;

    await lens.save();

    res.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });
  } catch (error) {
    log.error('Error acknowledging optical lens alert:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Error acknowledging alert',
      error: error.message
    });
  }
};

// Export all handlers - base + type-specific
module.exports = {
  // Base CRUD
  getLenses: handlers.getAll,
  getLens: handlers.getOne,
  createLens: handlers.create,
  updateLens: handlers.update,
  deleteLens: handlers.delete,

  // Base stock operations
  addStock: handlers.addStock,
  adjustStock: handlers.adjustStock,

  // Base reporting
  getStats: handlers.getStats,
  getLowStock: handlers.getLowStock,

  // Base search/filter
  searchLenses: handlers.search,
  getBrands: handlers.getBrands,
  getAlerts: handlers.getAlerts,
  acknowledgeAlert,
  checkAvailability: handlers.checkAvailability,

  // Type-specific: glasses order workflow
  reserveForOrder,
  releaseReservation,
  fulfillReservation,

  // Type-specific: specs matching
  findBySpecs,
  getByMaterial
};
