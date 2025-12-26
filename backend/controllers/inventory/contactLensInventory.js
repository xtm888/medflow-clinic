/**
 * Contact Lens Inventory Controller
 *
 * Type-specific extension for contact lens inventory management.
 * Extends InventoryControllerFactory with prescription matching and expiration tracking.
 */

const mongoose = require('mongoose');
const { ContactLensInventory } = require('../../models/Inventory');
const InventoryControllerFactory = require('./InventoryControllerFactory');

const { createContextLogger } = require('../../utils/structuredLogger');
const log = createContextLogger('ContactLensInventory');

// Create factory instance with contact lens-specific config
const factory = new InventoryControllerFactory({
  Model: ContactLensInventory,
  entityName: 'contact lens',
  entityNamePlural: 'contact lenses',
  searchFields: ['brand', 'productLine', 'sku', 'barcode'],
  defaultSort: 'brand',
  activeField: 'active',
  selectExclude: '-transactions -usage.salesHistory -reservations'
});

// Override buildCustomFilters for contact lens-specific filters
factory.buildCustomFilters = (filters) => {
  const query = {};
  if (filters.brand) query.brand = { $regex: filters.brand, $options: 'i' };
  if (filters.lensType) query.lensType = filters.lensType;
  if (filters.wearSchedule) query.wearSchedule = filters.wearSchedule;
  if (filters.stockingType) query.stockingType = filters.stockingType;
  if (filters.baseCurve) query['parameters.baseCurve'] = parseFloat(filters.baseCurve);
  if (filters.diameter) query['parameters.diameter'] = parseFloat(filters.diameter);
  if (filters.inStockOnly === 'true') query['inventory.currentStock'] = { $gt: 0 };
  return query;
};

// Override postProcessItems to add expiration info
factory.postProcessItems = (items) => {
  return items.map(lens => {
    const activeBatches = lens.batches?.filter(b => b.status === 'active' && b.quantity > 0) || [];
    const earliestExpiry = activeBatches.length > 0
      ? activeBatches.sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate))[0]
      : null;

    let daysToExpiry = null;
    if (earliestExpiry) {
      const diff = new Date(earliestExpiry.expirationDate) - new Date();
      daysToExpiry = Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    return {
      ...lens,
      inventory: {
        ...lens.inventory,
        available: (lens.inventory?.currentStock || 0) - (lens.inventory?.reserved || 0)
      },
      daysToExpiry
    };
  });
};

// Get base handlers
const handlers = factory.getHandlers();

// ============================================
// TYPE-SPECIFIC: CONTACT LENS OPERATIONS
// ============================================

/**
 * Reserve stock for contact lens order (includes eye specification)
 */
const reserveForOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const lens = await ContactLensInventory.findById(req.params.id).session(session);

    if (!lens) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Contact lens not found'
      });
    }

    const { orderId, eye, quantity = 1 } = req.body;

    if (!orderId || !eye) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Order ID and eye (od/os/both) are required'
      });
    }

    const reservation = await lens.reserveStock(quantity, orderId, eye, req.user.id, session);

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Stock reserved successfully',
      data: reservation
    });
  } catch (error) {
    await session.abortTransaction();
    log.error('Error reserving contact lens stock:', { error: error });
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
    const lens = await ContactLensInventory.findById(req.params.id).session(session);

    if (!lens) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Contact lens not found'
      });
    }

    const result = await lens.releaseReservation(req.params.reservationId, session);

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Reservation released successfully',
      data: result
    });
  } catch (error) {
    await session.abortTransaction();
    log.error('Error releasing contact lens reservation:', { error: error });
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
    const lens = await ContactLensInventory.findById(req.params.id).session(session);

    if (!lens) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Contact lens not found'
      });
    }

    const { patientId, salePrice } = req.body;

    const result = await lens.fulfillReservation(
      req.params.reservationId,
      patientId,
      req.user.id,
      salePrice || lens.pricing.sellingPrice,
      session
    );

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Sale completed successfully',
      data: result
    });
  } catch (error) {
    await session.abortTransaction();
    log.error('Error fulfilling contact lens reservation:', { error: error });
    res.status(500).json({
      success: false,
      message: error.message || 'Error completing sale'
    });
  } finally {
    session.endSession();
  }
};

/**
 * Get expiring items
 */
const getExpiring = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const expiring = await ContactLensInventory.getExpiringItems(days);

    res.json({
      success: true,
      data: expiring,
      count: expiring.length
    });
  } catch (error) {
    log.error('Error getting expiring contact lenses:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Error retrieving expiring items',
      error: error.message
    });
  }
};

/**
 * Mark batch as expired
 */
const markBatchExpired = async (req, res) => {
  try {
    const lens = await ContactLensInventory.findById(req.params.id);

    if (!lens) {
      return res.status(404).json({
        success: false,
        message: 'Contact lens not found'
      });
    }

    const { lotNumber } = req.params;

    await lens.markBatchExpired(lotNumber, req.user.id);

    res.json({
      success: true,
      message: 'Batch marked as expired',
      data: {
        currentStock: lens.inventory.currentStock,
        status: lens.inventory.status
      }
    });
  } catch (error) {
    log.error('Error marking contact lens batch expired:', { error: error });
    res.status(500).json({
      success: false,
      message: error.message || 'Error marking batch as expired'
    });
  }
};

/**
 * Find matching lens for prescription parameters
 */
const findMatchingLens = async (req, res) => {
  try {
    const { brand, baseCurve, diameter, power, cylinder, axis, wearSchedule, color } = req.query;

    const matches = await ContactLensInventory.findMatchingLens({
      brand,
      baseCurve: baseCurve ? parseFloat(baseCurve) : undefined,
      diameter: diameter ? parseFloat(diameter) : undefined,
      power: power ? parseFloat(power) : undefined,
      cylinder: cylinder ? parseFloat(cylinder) : undefined,
      axis: axis ? parseFloat(axis) : undefined,
      wearSchedule,
      color
    });

    res.json({
      success: true,
      data: matches,
      count: matches.length
    });
  } catch (error) {
    log.error('Error finding matching contact lens:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Error finding matching contact lens',
      error: error.message
    });
  }
};

/**
 * Get product lines (optionally filtered by brand)
 */
const getProductLines = async (req, res) => {
  try {
    const productLines = await ContactLensInventory.getProductLines(req.query.brand);

    res.json({
      success: true,
      data: productLines
    });
  } catch (error) {
    log.error('Error getting contact lens product lines:', { error: error });
    res.status(500).json({
      success: false,
      message: 'Error retrieving product lines',
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
  getInventoryValue: handlers.getInventoryValue,

  // Base search/filter
  searchLenses: handlers.search,
  getBrands: handlers.getBrands,
  getAlerts: handlers.getAlerts,
  resolveAlert: handlers.resolveAlert,
  getTransactions: handlers.getTransactions,
  checkAvailability: handlers.checkAvailability,

  // Type-specific: reservation workflow with eye
  reserveForOrder,
  releaseReservation,
  fulfillReservation,

  // Type-specific: expiration management
  getExpiring,
  markBatchExpired,

  // Type-specific: prescription matching
  findMatchingLens,
  getProductLines
};
