const InventoryTransfer = require('../models/InventoryTransfer');
const {
  Inventory,
  PharmacyInventory,
  FrameInventory,
  ContactLensInventory,
  LabConsumableInventory,
  ReagentInventory
} = require('../models/Inventory');
const Clinic = require('../models/Clinic');
const { asyncHandler } = require('../middleware/errorHandler');

// Map inventory type to model
const INVENTORY_MODELS = {
  pharmacy: PharmacyInventory,
  frame: FrameInventory,
  contactLens: ContactLensInventory,
  labConsumable: LabConsumableInventory,
  reagent: ReagentInventory
};

const MODEL_NAMES = {
  pharmacy: 'PharmacyInventory',
  frame: 'FrameInventory',
  contactLens: 'ContactLensInventory',
  labConsumable: 'LabConsumableInventory',
  reagent: 'ReagentInventory'
};

// Helper: Check if user can access all clinics
const canAccessAllClinics = (user) => {
  return ['admin', 'manager', 'depot_manager'].includes(user.role);
};

// Helper: Get user's accessible clinic IDs
const getUserClinicIds = (user) => {
  if (canAccessAllClinics(user)) return null; // null means all
  return user.clinics || (user.assignedClinic ? [user.assignedClinic] : []);
};

/**
 * @desc    Get all transfers (filtered by user's access)
 * @route   GET /api/inventory-transfers
 * @access  Private
 */
exports.getTransfers = asyncHandler(async (req, res) => {
  const {
    status,
    type,
    priority,
    direction, // 'incoming', 'outgoing', 'all'
    clinicId,
    page = 1,
    limit = 20
  } = req.query;

  const query = {};

  // Filter by status
  if (status) {
    query.status = Array.isArray(status) ? { $in: status } : status;
  }

  // Filter by type
  if (type) {
    query.type = type;
  }

  // Filter by priority
  if (priority) {
    query.priority = priority;
  }

  // Clinic-based filtering
  const userClinicIds = getUserClinicIds(req.user);

  if (clinicId) {
    // Specific clinic requested
    if (direction === 'incoming') {
      query['destination.clinic'] = clinicId;
    } else if (direction === 'outgoing') {
      query['source.clinic'] = clinicId;
    } else {
      query.$or = [
        { 'destination.clinic': clinicId },
        { 'source.clinic': clinicId }
      ];
    }
  } else if (userClinicIds) {
    // Filter by user's accessible clinics
    query.$or = [
      { 'destination.clinic': { $in: userClinicIds } },
      { 'source.clinic': { $in: userClinicIds } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [transfers, total] = await Promise.all([
    InventoryTransfer.find(query)
      .sort({ 'dates.requested': -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('requestedBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .populate('source.clinic', 'name shortName clinicId')
      .populate('destination.clinic', 'name shortName clinicId')
      .lean(),
    InventoryTransfer.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: transfers,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

/**
 * @desc    Get single transfer by ID
 * @route   GET /api/inventory-transfers/:id
 * @access  Private
 */
exports.getTransfer = asyncHandler(async (req, res) => {
  const transfer = await InventoryTransfer.findById(req.params.id)
    .populate('requestedBy', 'firstName lastName email')
    .populate('approvedBy', 'firstName lastName')
    .populate('shippedBy', 'firstName lastName')
    .populate('receivedBy', 'firstName lastName')
    .populate('source.clinic', 'name shortName clinicId address')
    .populate('destination.clinic', 'name shortName clinicId address')
    .populate('approvalHistory.performedBy', 'firstName lastName');

  if (!transfer) {
    return res.status(404).json({
      success: false,
      error: 'Transfer not found'
    });
  }

  // Check access (unless admin)
  const userClinicIds = getUserClinicIds(req.user);
  if (userClinicIds) {
    const hasAccess = userClinicIds.some(id =>
      id.toString() === transfer.source.clinic?._id?.toString() ||
      id.toString() === transfer.destination.clinic?._id?.toString()
    );
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this transfer'
      });
    }
  }

  res.status(200).json({
    success: true,
    data: transfer
  });
});

/**
 * @desc    Create new transfer request
 * @route   POST /api/inventory-transfers
 * @access  Private
 */
exports.createTransfer = asyncHandler(async (req, res) => {
  const {
    type,
    sourceClinicId,
    destinationClinicId,
    items,
    priority,
    reason,
    reasonNotes,
    notes
  } = req.body;

  // Validate clinics
  const [sourceClinic, destinationClinic] = await Promise.all([
    sourceClinicId ? Clinic.findById(sourceClinicId) : null,
    Clinic.findById(destinationClinicId)
  ]);

  if (!destinationClinic) {
    return res.status(400).json({
      success: false,
      error: 'Destination clinic not found'
    });
  }

  // Check user has access to request from their clinic
  const userClinicIds = getUserClinicIds(req.user);
  if (userClinicIds && !userClinicIds.some(id => id.toString() === destinationClinicId)) {
    return res.status(403).json({
      success: false,
      error: 'You can only request transfers to your assigned clinic'
    });
  }

  // Validate and enrich items
  const enrichedItems = [];
  for (const item of items) {
    const Model = INVENTORY_MODELS[item.inventoryType];
    if (!Model) {
      return res.status(400).json({
        success: false,
        error: `Invalid inventory type: ${item.inventoryType}`
      });
    }

    const inventoryItem = await Model.findById(item.inventoryId);
    if (!inventoryItem) {
      return res.status(400).json({
        success: false,
        error: `Inventory item not found: ${item.inventoryId}`
      });
    }

    // Get product name based on inventory type
    let productName, productSku, productDetails;
    switch (item.inventoryType) {
      case 'pharmacy':
        productName = inventoryItem.medication?.genericName || inventoryItem.medication?.brandName;
        productDetails = `${inventoryItem.medication?.brandName || ''} ${inventoryItem.medication?.strength || ''}`.trim();
        break;
      case 'frame':
        productName = `${inventoryItem.brand} ${inventoryItem.model}`;
        productSku = inventoryItem.sku;
        productDetails = `${inventoryItem.color} - ${inventoryItem.size}`;
        break;
      case 'contactLens':
        productName = `${inventoryItem.brand} ${inventoryItem.productLine}`;
        productSku = inventoryItem.sku;
        productDetails = `BC:${inventoryItem.parameters?.baseCurve} D:${inventoryItem.parameters?.diameter}`;
        break;
      default:
        productName = inventoryItem.name || inventoryItem.sku;
        productSku = inventoryItem.sku;
    }

    enrichedItems.push({
      inventoryType: item.inventoryType,
      inventoryId: item.inventoryId,
      inventoryModel: MODEL_NAMES[item.inventoryType],
      productName,
      productSku,
      productDetails,
      requestedQuantity: item.quantity,
      lotNumber: item.lotNumber,
      status: 'pending'
    });
  }

  // Create transfer
  const transfer = await InventoryTransfer.create({
    type: type || (sourceClinicId ? 'clinic-to-clinic' : 'depot-to-clinic'),
    source: {
      clinic: sourceClinicId || null,
      isDepot: !sourceClinicId,
      name: sourceClinic?.name || 'Dépôt Central'
    },
    destination: {
      clinic: destinationClinicId,
      name: destinationClinic.name
    },
    items: enrichedItems,
    priority: priority || 'normal',
    reason: reason || 'replenishment',
    reasonNotes,
    notes,
    requestedBy: req.user.id,
    status: 'draft',
    approvalHistory: [{
      action: 'created',
      performedBy: req.user.id,
      newStatus: 'draft'
    }]
  });

  res.status(201).json({
    success: true,
    data: transfer
  });
});

/**
 * @desc    Submit transfer for approval
 * @route   POST /api/inventory-transfers/:id/submit
 * @access  Private
 */
exports.submitTransfer = asyncHandler(async (req, res) => {
  const transfer = await InventoryTransfer.findById(req.params.id);

  if (!transfer) {
    return res.status(404).json({
      success: false,
      error: 'Transfer not found'
    });
  }

  await transfer.submit(req.user.id);

  res.status(200).json({
    success: true,
    data: transfer,
    message: 'Transfer submitted for approval'
  });
});

/**
 * @desc    Approve transfer
 * @route   POST /api/inventory-transfers/:id/approve
 * @access  Private (admin, manager, depot_manager, pharmacist)
 */
exports.approveTransfer = asyncHandler(async (req, res) => {
  const { approvedItems, notes } = req.body;

  const transfer = await InventoryTransfer.findById(req.params.id);

  if (!transfer) {
    return res.status(404).json({
      success: false,
      error: 'Transfer not found'
    });
  }

  // Check user can approve (must have access to source clinic or be admin)
  if (!canAccessAllClinics(req.user)) {
    const userClinicIds = getUserClinicIds(req.user);
    const sourceClinicId = transfer.source.clinic?.toString();
    if (sourceClinicId && !userClinicIds.some(id => id.toString() === sourceClinicId)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to approve this transfer'
      });
    }
  }

  await transfer.approve(req.user.id, approvedItems);

  if (notes) {
    transfer.internalNotes = notes;
    await transfer.save();
  }

  res.status(200).json({
    success: true,
    data: transfer,
    message: 'Transfer approved'
  });
});

/**
 * @desc    Reject transfer
 * @route   POST /api/inventory-transfers/:id/reject
 * @access  Private (admin, manager, depot_manager)
 */
exports.rejectTransfer = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const transfer = await InventoryTransfer.findById(req.params.id);

  if (!transfer) {
    return res.status(404).json({
      success: false,
      error: 'Transfer not found'
    });
  }

  transfer.status = 'rejected';
  transfer.rejectedBy = req.user.id;
  transfer.dates.rejected = new Date();
  transfer.notes = reason || transfer.notes;

  // Mark all items as rejected
  transfer.items.forEach(item => {
    item.status = 'rejected';
    item.rejectionReason = reason;
  });

  transfer.approvalHistory.push({
    action: 'rejected',
    performedBy: req.user.id,
    previousStatus: transfer.status,
    newStatus: 'rejected',
    notes: reason
  });

  await transfer.save();

  res.status(200).json({
    success: true,
    data: transfer,
    message: 'Transfer rejected'
  });
});

/**
 * @desc    Ship transfer (mark as in-transit)
 * @route   POST /api/inventory-transfers/:id/ship
 * @access  Private
 */
exports.shipTransfer = asyncHandler(async (req, res) => {
  const { method, trackingNumber, carrier, expectedDelivery, notes } = req.body;

  const transfer = await InventoryTransfer.findById(req.params.id);

  if (!transfer) {
    return res.status(404).json({
      success: false,
      error: 'Transfer not found'
    });
  }

  await transfer.ship(req.user.id, {
    method,
    trackingNumber,
    carrier,
    expectedDelivery,
    notes
  });

  // Deduct stock from source inventory
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    for (const item of transfer.items) {
      if (item.status !== 'approved' && item.status !== 'shipped') continue;

      const Model = INVENTORY_MODELS[item.inventoryType];
      if (!Model) continue;

      const inventoryItem = await Model.findById(item.inventoryId).session(session);
      if (!inventoryItem) continue;

      const quantityToDeduct = item.approvedQuantity || item.requestedQuantity;

      // Deduct from current stock
      if (inventoryItem.inventory) {
        inventoryItem.inventory.currentStock = Math.max(0,
          (inventoryItem.inventory.currentStock || 0) - quantityToDeduct
        );

        // Update stock status
        if (inventoryItem.inventory.currentStock <= 0) {
          inventoryItem.inventory.status = 'out-of-stock';
        } else if (inventoryItem.inventory.currentStock <= (inventoryItem.inventory.minimumStock || 0)) {
          inventoryItem.inventory.status = 'low-stock';
        }

        // Add to transaction history
        if (!inventoryItem.transactions) inventoryItem.transactions = [];
        inventoryItem.transactions.push({
          type: 'transfer-out',
          quantity: quantityToDeduct,
          date: new Date(),
          performedBy: req.user.id,
          reference: `Transfer ${transfer.transferNumber}`,
          transferId: transfer._id,
          notes: `Shipped to ${transfer.destination.name}`
        });

        await inventoryItem.save({ session });
      }

      // Update item status
      item.status = 'shipped';
    }

    await transfer.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.error('Error deducting stock during ship:', error);
    // Transfer is already marked as shipped, log error but don't fail
  } finally {
    session.endSession();
  }

  res.status(200).json({
    success: true,
    data: transfer,
    message: 'Transfer marked as shipped'
  });
});

/**
 * @desc    Receive transfer items
 * @route   POST /api/inventory-transfers/:id/receive
 * @access  Private
 */
exports.receiveTransfer = asyncHandler(async (req, res) => {
  const { receivedItems, notes } = req.body;

  const transfer = await InventoryTransfer.findById(req.params.id);

  if (!transfer) {
    return res.status(404).json({
      success: false,
      error: 'Transfer not found'
    });
  }

  // Check user has access to destination clinic
  const userClinicIds = getUserClinicIds(req.user);
  if (userClinicIds) {
    const destClinicId = transfer.destination.clinic?.toString();
    if (!userClinicIds.some(id => id.toString() === destClinicId)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to receive this transfer'
      });
    }
  }

  await transfer.receive(req.user.id, receivedItems);

  if (notes) {
    transfer.notes = notes;
    await transfer.save();
  }

  // Add stock to destination inventory
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const destinationClinicId = transfer.destination.clinic;

    for (const item of transfer.items) {
      // Only process items that were actually received
      if (item.status !== 'received' && item.status !== 'partial') continue;

      const receivedQty = item.receivedQuantity || item.approvedQuantity || item.requestedQuantity;
      if (!receivedQty || receivedQty <= 0) continue;

      const Model = INVENTORY_MODELS[item.inventoryType];
      if (!Model) continue;

      // Find or create inventory item at destination clinic
      let destInventoryItem;

      // Try to find existing inventory at destination by matching product
      const sourceItem = await Model.findById(item.inventoryId).lean();
      if (!sourceItem) continue;

      // Build query to find matching item at destination
      const matchQuery = { clinic: destinationClinicId };

      switch (item.inventoryType) {
        case 'pharmacy':
          if (sourceItem.drug) {
            matchQuery.drug = sourceItem.drug;
          } else if (sourceItem.medication?.genericName) {
            matchQuery['medication.genericName'] = sourceItem.medication.genericName;
          }
          break;
        case 'frame':
          matchQuery.sku = sourceItem.sku;
          break;
        case 'contactLens':
          matchQuery.sku = sourceItem.sku;
          break;
        default:
          matchQuery.sku = sourceItem.sku || sourceItem.name;
      }

      destInventoryItem = await Model.findOne(matchQuery).session(session);

      if (destInventoryItem) {
        // Add to existing inventory
        destInventoryItem.inventory.currentStock =
          (destInventoryItem.inventory.currentStock || 0) + receivedQty;

        // Update stock status
        if (destInventoryItem.inventory.currentStock > (destInventoryItem.inventory.minimumStock || 0)) {
          destInventoryItem.inventory.status = 'in-stock';
        }
      } else {
        // Create new inventory item at destination (copy from source)
        const newItemData = { ...sourceItem };
        delete newItemData._id;
        delete newItemData.createdAt;
        delete newItemData.updatedAt;

        newItemData.clinic = destinationClinicId;
        newItemData.inventory = {
          currentStock: receivedQty,
          minimumStock: sourceItem.inventory?.minimumStock || 5,
          optimalStock: sourceItem.inventory?.optimalStock || 20,
          status: 'in-stock',
          lastRestocked: new Date()
        };
        newItemData.transactions = [];

        destInventoryItem = new Model(newItemData);
      }

      // Add transaction history
      if (!destInventoryItem.transactions) destInventoryItem.transactions = [];
      destInventoryItem.transactions.push({
        type: 'transfer-in',
        quantity: receivedQty,
        date: new Date(),
        performedBy: req.user.id,
        reference: `Transfer ${transfer.transferNumber}`,
        transferId: transfer._id,
        notes: `Received from ${transfer.source.name}`
      });

      await destInventoryItem.save({ session });
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.error('Error adding stock during receive:', error);
    // Transfer already marked as received, log error but don't fail
  } finally {
    session.endSession();
  }

  res.status(200).json({
    success: true,
    data: transfer,
    message: 'Transfer received'
  });
});

/**
 * @desc    Cancel transfer
 * @route   POST /api/inventory-transfers/:id/cancel
 * @access  Private
 */
exports.cancelTransfer = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const transfer = await InventoryTransfer.findById(req.params.id);

  if (!transfer) {
    return res.status(404).json({
      success: false,
      error: 'Transfer not found'
    });
  }

  await transfer.cancel(req.user.id, reason);

  res.status(200).json({
    success: true,
    data: transfer,
    message: 'Transfer cancelled'
  });
});

/**
 * @desc    Get transfer statistics
 * @route   GET /api/inventory-transfers/stats
 * @access  Private
 */
exports.getStats = asyncHandler(async (req, res) => {
  const { clinicId } = req.query;
  const userClinicIds = getUserClinicIds(req.user);

  // Build match conditions
  const matchConditions = {};
  if (clinicId) {
    matchConditions.$or = [
      { 'destination.clinic': new mongoose.Types.ObjectId(clinicId) },
      { 'source.clinic': new mongoose.Types.ObjectId(clinicId) }
    ];
  } else if (userClinicIds) {
    matchConditions.$or = [
      { 'destination.clinic': { $in: userClinicIds.map(id => new mongoose.Types.ObjectId(id)) } },
      { 'source.clinic': { $in: userClinicIds.map(id => new mongoose.Types.ObjectId(id)) } }
    ];
  }

  const [statusCounts, recentTransfers, pendingApproval] = await Promise.all([
    // Status counts
    InventoryTransfer.aggregate([
      { $match: matchConditions },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),

    // Recent transfers count (last 30 days)
    InventoryTransfer.countDocuments({
      ...matchConditions,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }),

    // Pending approval count
    InventoryTransfer.countDocuments({
      ...matchConditions,
      status: 'requested'
    })
  ]);

  res.status(200).json({
    success: true,
    data: {
      byStatus: statusCounts.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {}),
      recentTransfers,
      pendingApproval,
      inTransit: statusCounts.find(s => s._id === 'in-transit')?.count || 0
    }
  });
});

/**
 * @desc    Get transfer recommendations (items that should be transferred)
 * @route   GET /api/inventory-transfers/recommendations
 * @access  Private (admin, manager)
 */
exports.getRecommendations = asyncHandler(async (req, res) => {
  const { inventoryType = 'pharmacy' } = req.query;

  const Model = INVENTORY_MODELS[inventoryType];
  if (!Model) {
    return res.status(400).json({
      success: false,
      error: 'Invalid inventory type'
    });
  }

  // Find items that are out of stock or low stock at any clinic
  const lowStockItems = await Model.aggregate([
    {
      $match: {
        $or: [
          { 'inventory.status': 'out-of-stock' },
          { 'inventory.status': 'low-stock' }
        ]
      }
    },
    {
      $lookup: {
        from: 'clinics',
        localField: 'clinic',
        foreignField: '_id',
        as: 'clinicInfo'
      }
    },
    {
      $unwind: '$clinicInfo'
    },
    {
      $project: {
        _id: 1,
        clinic: 1,
        clinicName: '$clinicInfo.name',
        clinicShortName: '$clinicInfo.shortName',
        productName: {
          $switch: {
            branches: [
              { case: { $eq: [inventoryType, 'pharmacy'] }, then: '$medication.genericName' },
              { case: { $eq: [inventoryType, 'frame'] }, then: { $concat: ['$brand', ' ', '$model'] } },
              { case: { $eq: [inventoryType, 'contactLens'] }, then: { $concat: ['$brand', ' ', '$productLine'] } }
            ],
            default: '$name'
          }
        },
        sku: '$sku',
        currentStock: '$inventory.currentStock',
        minimumStock: '$inventory.minimumStock',
        reorderPoint: '$inventory.reorderPoint',
        status: '$inventory.status',
        drug: 1
      }
    }
  ]);

  // For each low stock item, find clinics with surplus
  const recommendations = [];

  for (const item of lowStockItems) {
    // Find same product at other clinics with surplus
    let surplusQuery;
    if (inventoryType === 'pharmacy') {
      surplusQuery = { drug: item.drug, clinic: { $ne: item.clinic } };
    } else {
      surplusQuery = { sku: item.sku, clinic: { $ne: item.clinic } };
    }

    const surplusItems = await Model.find(surplusQuery)
      .populate('clinic', 'name shortName')
      .select('clinic inventory.currentStock inventory.minimumStock inventory.optimalStock')
      .lean();

    // Filter to only those with actual surplus
    const availableSources = surplusItems
      .filter(s => {
        const available = s.inventory.currentStock - (s.inventory.minimumStock || 0);
        return available > 0;
      })
      .map(s => ({
        clinicId: s.clinic._id,
        clinicName: s.clinic.name,
        clinicShortName: s.clinic.shortName,
        currentStock: s.inventory.currentStock,
        minimumStock: s.inventory.minimumStock || 0,
        availableToTransfer: s.inventory.currentStock - (s.inventory.minimumStock || 0)
      }));

    if (availableSources.length > 0) {
      const needed = (item.reorderPoint || item.minimumStock || 10) - item.currentStock;

      recommendations.push({
        inventoryType,
        inventoryId: item._id,
        productName: item.productName,
        sku: item.sku,
        urgency: item.status === 'out-of-stock' ? 'critical' : 'high',
        needyClinic: {
          id: item.clinic,
          name: item.clinicName,
          shortName: item.clinicShortName,
          currentStock: item.currentStock,
          neededQuantity: needed
        },
        availableSources,
        suggestedTransfer: {
          fromClinic: availableSources[0].clinicId,
          fromClinicName: availableSources[0].clinicName,
          quantity: Math.min(needed, availableSources[0].availableToTransfer)
        }
      });
    }
  }

  // Sort by urgency (critical first)
  recommendations.sort((a, b) => {
    if (a.urgency === 'critical' && b.urgency !== 'critical') return -1;
    if (a.urgency !== 'critical' && b.urgency === 'critical') return 1;
    return 0;
  });

  res.status(200).json({
    success: true,
    data: recommendations,
    count: recommendations.length
  });
});

// Need to import mongoose for ObjectId in stats
const mongoose = require('mongoose');
