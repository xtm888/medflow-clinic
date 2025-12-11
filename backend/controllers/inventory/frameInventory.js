/**
 * Frame Inventory Controller
 *
 * Type-specific extension for frame inventory management.
 * Extends InventoryControllerFactory with glasses order reservation workflow.
 */

const mongoose = require('mongoose');
const FrameInventory = require('../../models/FrameInventory');
const InventoryControllerFactory = require('./InventoryControllerFactory');
const { verifyClinicAccess } = require('../../utils/clinicFilter');
const { sanitizeNumber, sanitizePrice } = require('../../utils/sanitize');

// Create factory instance with frame-specific config
const factory = new InventoryControllerFactory({
  Model: FrameInventory,
  entityName: 'frame',
  entityNamePlural: 'frames',
  searchFields: ['brand', 'model', 'sku', 'barcode', 'color'],
  defaultSort: 'brand',
  activeField: 'active',
  selectExclude: '-transactions -usage.salesHistory -reservations'
});

// Override buildCustomFilters for frame-specific filters
factory.buildCustomFilters = (filters) => {
  const query = {};
  if (filters.brand) query.brand = { $regex: filters.brand, $options: 'i' };
  if (filters.category) query.category = filters.category;
  if (filters.material) query.material = filters.material;
  if (filters.frameType) query.frameType = filters.frameType;
  if (filters.gender) query.gender = filters.gender;
  if (filters.inStockOnly === 'true') query['inventory.currentStock'] = { $gt: 0 };
  return query;
};

// Get base handlers
const handlers = factory.getHandlers();

// ============================================
// TYPE-SPECIFIC: GLASSES ORDER RESERVATION
// ============================================

/**
 * Reserve stock for glasses order
 */
const reserveForOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const frame = await FrameInventory.findById(req.params.id).session(session);

    if (!frame) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Frame not found'
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

    const reservation = await frame.reserveStock(quantity, orderId, req.user.id, session);

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Stock reserved successfully',
      data: reservation
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error reserving frame stock:', error);
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
    const frame = await FrameInventory.findById(req.params.id).session(session);

    if (!frame) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Frame not found'
      });
    }

    const { reservationId } = req.params;

    const result = await frame.releaseReservation(reservationId, session);

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Reservation released successfully',
      data: result
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error releasing frame reservation:', error);
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
    const frame = await FrameInventory.findById(req.params.id).session(session);

    if (!frame) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Frame not found'
      });
    }

    const { reservationId } = req.params;
    const { patientId, salePrice } = req.body;

    // Validate sale price if provided
    if (salePrice !== undefined && salePrice !== null) {
      const validatedSalePrice = sanitizePrice(salePrice);
      if (validatedSalePrice === null || validatedSalePrice <= 0) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, error: 'Sale price must be a positive number' });
      }
    }

    const result = await frame.fulfillReservation(
      reservationId,
      patientId,
      req.user.id,
      salePrice || frame.pricing.sellingPrice,
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
    console.error('Error fulfilling frame reservation:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error completing sale'
    });
  } finally {
    session.endSession();
  }
};

/**
 * Get frames by category
 */
const getByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const frames = await FrameInventory.getByCategory(category);

    res.json({
      success: true,
      data: frames,
      count: frames.length
    });
  } catch (error) {
    console.error('Error getting frames by category:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving frames',
      error: error.message
    });
  }
};

// Export all handlers - base + type-specific
module.exports = {
  // Base CRUD
  getFrames: handlers.getAll,
  getFrame: handlers.getOne,
  createFrame: handlers.create,
  updateFrame: handlers.update,
  deleteFrame: handlers.delete,

  // Base stock operations
  addStock: handlers.addStock,
  adjustStock: handlers.adjustStock,

  // Base reporting
  getStats: handlers.getStats,
  getLowStock: handlers.getLowStock,
  getInventoryValue: handlers.getInventoryValue,

  // Base search/filter
  searchFrames: handlers.search,
  getBrands: handlers.getBrands,
  getAlerts: handlers.getAlerts,
  resolveAlert: handlers.resolveAlert,
  getTransactions: handlers.getTransactions,
  checkAvailability: handlers.checkAvailability,

  // Type-specific: glasses order reservation workflow
  reserveForOrder,
  releaseReservation,
  fulfillReservation,
  getByCategory
};
