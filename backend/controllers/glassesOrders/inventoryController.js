/**
 * Glasses Order Inventory Controller
 *
 * Handles inventory operations:
 * - Availability checking
 * - Stock reservation
 * - Stock release
 * - Stock fulfillment
 * - Inventory search
 */

const {
  GlassesOrder,
  FrameInventory,
  ContactLensInventory,
  OpticalLensInventory,
  mongoose,
  asyncHandler,
  log
} = require('./shared');

// @desc    Check inventory availability for order items
// @route   POST /api/glasses-orders/check-inventory
// @access  Private
exports.checkInventoryAvailability = asyncHandler(async (req, res) => {
  const { frameId, contactLensOdId, contactLensOsId } = req.body;

  const availability = {
    frame: null,
    contactLensOd: null,
    contactLensOs: null,
    allAvailable: true
  };

  // Check frame availability
  if (frameId) {
    const frame = await FrameInventory.findById(frameId);
    if (frame) {
      const available = frame.inventory.currentStock - frame.inventory.reserved;
      availability.frame = {
        id: frame._id,
        sku: frame.sku,
        brand: frame.brand,
        model: frame.model,
        color: frame.color,
        currentStock: frame.inventory.currentStock,
        reserved: frame.inventory.reserved,
        available,
        status: frame.inventory.status,
        price: frame.pricing.sellingPrice,
        costPrice: frame.pricing.costPrice,
        isAvailable: available >= 1
      };
      if (available < 1) availability.allAvailable = false;
    } else {
      availability.frame = { error: 'Frame not found', isAvailable: false };
      availability.allAvailable = false;
    }
  }

  // Check contact lens OD availability
  if (contactLensOdId) {
    const lens = await ContactLensInventory.findById(contactLensOdId);
    if (lens) {
      const available = lens.inventory.currentStock - lens.inventory.reserved;
      availability.contactLensOd = {
        id: lens._id,
        sku: lens.sku,
        brand: lens.brand,
        productLine: lens.productLine,
        parameters: lens.parameters,
        currentStock: lens.inventory.currentStock,
        reserved: lens.inventory.reserved,
        available,
        status: lens.inventory.status,
        price: lens.pricing.sellingPrice,
        costPrice: lens.pricing.costPrice,
        packSize: lens.packSize,
        isAvailable: available >= 1
      };
      if (available < 1) availability.allAvailable = false;
    } else {
      availability.contactLensOd = { error: 'Contact lens not found', isAvailable: false };
      availability.allAvailable = false;
    }
  }

  // Check contact lens OS availability
  if (contactLensOsId) {
    const lens = await ContactLensInventory.findById(contactLensOsId);
    if (lens) {
      const available = lens.inventory.currentStock - lens.inventory.reserved;
      availability.contactLensOs = {
        id: lens._id,
        sku: lens.sku,
        brand: lens.brand,
        productLine: lens.productLine,
        parameters: lens.parameters,
        currentStock: lens.inventory.currentStock,
        reserved: lens.inventory.reserved,
        available,
        status: lens.inventory.status,
        price: lens.pricing.sellingPrice,
        costPrice: lens.pricing.costPrice,
        packSize: lens.packSize,
        isAvailable: available >= 1
      };
      if (available < 1) availability.allAvailable = false;
    } else {
      availability.contactLensOs = { error: 'Contact lens not found', isAvailable: false };
      availability.allAvailable = false;
    }
  }

  res.status(200).json({
    success: true,
    data: availability
  });
});

// @desc    Reserve inventory for glasses order
// @route   POST /api/glasses-orders/:id/reserve-inventory
// @access  Private
exports.reserveInventory = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await GlassesOrder.findById(req.params.id).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const reservations = {
      frame: null,
      contactLensOd: null,
      contactLensOs: null
    };

    // Reserve frame
    if (order.glasses?.frame?.inventoryItem) {
      const frame = await FrameInventory.findById(order.glasses.frame.inventoryItem).session(session);
      if (frame) {
        const reservation = await frame.reserveStock(
          1,
          order._id,
          req.user._id || req.user.id,
          session
        );
        reservations.frame = reservation;

        order.glasses.frame.reservationId = reservation.reservationId;
        order.glasses.frame.costPrice = frame.pricing.costPrice;
        order.glasses.frame.sellingPrice = frame.pricing.sellingPrice;
      }
    }

    // Reserve contact lens OD
    if (order.contactLenses?.od?.inventoryItem) {
      const lens = await ContactLensInventory.findById(order.contactLenses.od.inventoryItem).session(session);
      if (lens) {
        const reservation = await lens.reserveStock(
          order.contactLenses.od.quantity || 1,
          order._id,
          req.user._id || req.user.id,
          session
        );
        reservations.contactLensOd = reservation;

        order.contactLenses.od.reservationId = reservation.reservationId;
        order.contactLenses.od.costPrice = lens.pricing.costPrice;
        order.contactLenses.od.sellingPrice = lens.pricing.sellingPrice;
      }
    }

    // Reserve contact lens OS
    if (order.contactLenses?.os?.inventoryItem) {
      const lens = await ContactLensInventory.findById(order.contactLenses.os.inventoryItem).session(session);
      if (lens) {
        const reservation = await lens.reserveStock(
          order.contactLenses.os.quantity || 1,
          order._id,
          req.user._id || req.user.id,
          session
        );
        reservations.contactLensOs = reservation;

        order.contactLenses.os.reservationId = reservation.reservationId;
        order.contactLenses.os.costPrice = lens.pricing.costPrice;
        order.contactLenses.os.sellingPrice = lens.pricing.sellingPrice;
      }
    }

    // Update inventory status
    order.inventoryStatus = {
      frameReserved: !!reservations.frame,
      contactsOdReserved: !!reservations.contactLensOd,
      contactsOsReserved: !!reservations.contactLensOs,
      allReserved: true,
      reservedAt: new Date()
    };

    await order.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Inventory reserved successfully',
      data: {
        orderId: order._id,
        reservations
      }
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// @desc    Release inventory reservations for glasses order
// @route   POST /api/glasses-orders/:id/release-inventory
// @access  Private
exports.releaseInventory = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await GlassesOrder.findById(req.params.id).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const released = {
      frame: false,
      contactLensOd: false,
      contactLensOs: false
    };

    // Release frame reservation
    if (order.glasses?.frame?.inventoryItem && order.glasses?.frame?.reservationId) {
      const frame = await FrameInventory.findById(order.glasses.frame.inventoryItem).session(session);
      if (frame) {
        await frame.releaseReservation(order.glasses.frame.reservationId, session);
        released.frame = true;
        order.glasses.frame.reservationId = undefined;
      }
    }

    // Release contact lens OD reservation
    if (order.contactLenses?.od?.inventoryItem && order.contactLenses?.od?.reservationId) {
      const lens = await ContactLensInventory.findById(order.contactLenses.od.inventoryItem).session(session);
      if (lens) {
        await lens.releaseReservation(order.contactLenses.od.reservationId, session);
        released.contactLensOd = true;
        order.contactLenses.od.reservationId = undefined;
      }
    }

    // Release contact lens OS reservation
    if (order.contactLenses?.os?.inventoryItem && order.contactLenses?.os?.reservationId) {
      const lens = await ContactLensInventory.findById(order.contactLenses.os.inventoryItem).session(session);
      if (lens) {
        await lens.releaseReservation(order.contactLenses.os.reservationId, session);
        released.contactLensOs = true;
        order.contactLenses.os.reservationId = undefined;
      }
    }

    // Update inventory status
    order.inventoryStatus = {
      frameReserved: false,
      contactsOdReserved: false,
      contactsOsReserved: false,
      allReserved: false,
      reservedAt: null
    };

    await order.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Inventory reservations released',
      data: {
        orderId: order._id,
        released
      }
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// @desc    Fulfill inventory (convert reservations to sales) on delivery
// @route   POST /api/glasses-orders/:id/fulfill-inventory
// @access  Private
exports.fulfillInventory = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await GlassesOrder.findById(req.params.id)
      .populate('patient', 'firstName lastName')
      .session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const fulfilled = {
      frame: false,
      contactLensOd: false,
      contactLensOs: false
    };

    let totalCost = 0;
    let totalRevenue = 0;

    // Fulfill frame
    if (order.glasses?.frame?.inventoryItem && order.glasses?.frame?.reservationId) {
      const frame = await FrameInventory.findById(order.glasses.frame.inventoryItem).session(session);
      if (frame) {
        await frame.fulfillReservation(
          order.glasses.frame.reservationId,
          order.patient._id,
          req.user._id || req.user.id,
          session
        );
        fulfilled.frame = true;

        totalCost += frame.pricing.costPrice || 0;
        totalRevenue += order.glasses.frame.sellingPrice || frame.pricing.sellingPrice || 0;
      }
    }

    // Fulfill contact lens OD
    if (order.contactLenses?.od?.inventoryItem && order.contactLenses?.od?.reservationId) {
      const lens = await ContactLensInventory.findById(order.contactLenses.od.inventoryItem).session(session);
      if (lens) {
        await lens.fulfillReservation(
          order.contactLenses.od.reservationId,
          order.patient._id,
          req.user._id || req.user.id,
          session
        );
        fulfilled.contactLensOd = true;

        const qty = order.contactLenses.od.quantity || 1;
        totalCost += (lens.pricing.costPrice || 0) * qty;
        totalRevenue += (order.contactLenses.od.sellingPrice || lens.pricing.sellingPrice || 0) * qty;
      }
    }

    // Fulfill contact lens OS
    if (order.contactLenses?.os?.inventoryItem && order.contactLenses?.os?.reservationId) {
      const lens = await ContactLensInventory.findById(order.contactLenses.os.inventoryItem).session(session);
      if (lens) {
        await lens.fulfillReservation(
          order.contactLenses.os.reservationId,
          order.patient._id,
          req.user._id || req.user.id,
          session
        );
        fulfilled.contactLensOs = true;

        const qty = order.contactLenses.os.quantity || 1;
        totalCost += (lens.pricing.costPrice || 0) * qty;
        totalRevenue += (order.contactLenses.os.sellingPrice || lens.pricing.sellingPrice || 0) * qty;
      }
    }

    // Update cost tracking on order
    order.costTracking = {
      frameCost: order.glasses?.frame?.costPrice || 0,
      contactsOdCost: (order.contactLenses?.od?.costPrice || 0) * (order.contactLenses?.od?.quantity || 1),
      contactsOsCost: (order.contactLenses?.os?.costPrice || 0) * (order.contactLenses?.os?.quantity || 1),
      lensCost: 0,
      totalCost,
      totalRevenue,
      margin: totalRevenue - totalCost,
      marginPercent: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100) : 0
    };

    await order.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Inventory fulfilled successfully',
      data: {
        orderId: order._id,
        fulfilled,
        costTracking: order.costTracking
      }
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// @desc    Search frames for order (autocomplete)
// @route   GET /api/glasses-orders/search-frames
// @access  Private
exports.searchFrames = asyncHandler(async (req, res) => {
  const { query, category, status = 'in-stock' } = req.query;

  const searchQuery = {
    isActive: true,
    'inventory.status': { $in: status === 'all' ? ['in-stock', 'low-stock', 'out-of-stock'] : [status, 'low-stock'] }
  };

  if (query) {
    searchQuery.$or = [
      { brand: { $regex: query, $options: 'i' } },
      { model: { $regex: query, $options: 'i' } },
      { sku: { $regex: query, $options: 'i' } },
      { barcode: { $regex: query, $options: 'i' } }
    ];
  }

  if (category) {
    searchQuery.category = category;
  }

  const frames = await FrameInventory.find(searchQuery)
    .select('sku brand model color size category frameType pricing inventory')
    .limit(20)
    .sort('brand model');

  res.status(200).json({
    success: true,
    data: frames.map(frame => ({
      id: frame._id,
      sku: frame.sku,
      brand: frame.brand,
      model: frame.model,
      color: frame.color,
      size: frame.size,
      category: frame.category,
      frameType: frame.frameType,
      price: frame.pricing.sellingPrice,
      costPrice: frame.pricing.costPrice,
      available: frame.inventory.currentStock - frame.inventory.reserved,
      status: frame.inventory.status
    }))
  });
});

// @desc    Search contact lenses for order (with parameter matching)
// @route   GET /api/glasses-orders/search-contact-lenses
// @access  Private
exports.searchContactLenses = asyncHandler(async (req, res) => {
  const { query, power, baseCurve, diameter, cylinder, axis, lensType } = req.query;

  const searchQuery = {
    isActive: true,
    'inventory.status': { $in: ['in-stock', 'low-stock'] }
  };

  if (query) {
    searchQuery.$or = [
      { brand: { $regex: query, $options: 'i' } },
      { productLine: { $regex: query, $options: 'i' } },
      { sku: { $regex: query, $options: 'i' } }
    ];
  }

  if (lensType) searchQuery.lensType = lensType;
  if (baseCurve) searchQuery['parameters.baseCurve'] = parseFloat(baseCurve);
  if (diameter) searchQuery['parameters.diameter'] = parseFloat(diameter);

  if (power) {
    const powerVal = parseFloat(power);
    searchQuery.$and = searchQuery.$and || [];
    searchQuery.$and.push({
      $or: [
        { 'parameters.power.from': { $lte: powerVal }, 'parameters.power.to': { $gte: powerVal } },
        { 'parameters.power': powerVal }
      ]
    });
  }

  if (cylinder) searchQuery['parameters.cylinder'] = parseFloat(cylinder);
  if (axis) searchQuery['parameters.axis'] = parseInt(axis);

  const lenses = await ContactLensInventory.find(searchQuery)
    .select('sku brand productLine parameters lensType wearSchedule packSize pricing inventory')
    .limit(20)
    .sort('brand productLine');

  res.status(200).json({
    success: true,
    data: lenses.map(lens => ({
      id: lens._id,
      sku: lens.sku,
      brand: lens.brand,
      productLine: lens.productLine,
      parameters: lens.parameters,
      lensType: lens.lensType,
      wearSchedule: lens.wearSchedule,
      packSize: lens.packSize,
      price: lens.pricing.sellingPrice,
      costPrice: lens.pricing.costPrice,
      available: lens.inventory.currentStock - lens.inventory.reserved,
      status: lens.inventory.status
    }))
  });
});

// @desc    Get order with full inventory details
// @route   GET /api/glasses-orders/:id/with-inventory
// @access  Private
exports.getOrderWithInventory = asyncHandler(async (req, res) => {
  const order = await GlassesOrder.findById(req.params.id)
    .populate('patient', 'firstName lastName dateOfBirth phoneNumber email')
    .populate('exam')
    .populate('orderedBy', 'firstName lastName')
    .populate('invoice')
    .populate('glasses.frame.inventoryItem', 'sku brand model color size pricing inventory')
    .populate('contactLenses.od.inventoryItem', 'sku brand productLine parameters pricing inventory')
    .populate('contactLenses.os.inventoryItem', 'sku brand productLine parameters pricing inventory');

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }

  res.status(200).json({
    success: true,
    data: order
  });
});
