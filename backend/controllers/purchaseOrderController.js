const PurchaseOrder = require('../models/PurchaseOrder');
const { escapeRegex } = require('../utils/sanitize');
const { createContextLogger } = require('../utils/structuredLogger');
const logger = createContextLogger('PurchaseOrderController');

// Get all purchase orders with filtering and pagination
exports.getPurchaseOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      supplier,
      inventoryType,
      startDate,
      endDate
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    if (req.clinicId) {
      query.clinic = req.clinicId;
    }

    if (search) {
      const sanitizedSearch = escapeRegex(search);
      query.$or = [
        { poNumber: { $regex: sanitizedSearch, $options: 'i' } },
        { 'supplier.name': { $regex: sanitizedSearch, $options: 'i' } }
      ];
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (supplier) {
      query['supplier.id'] = supplier;
    }

    if (inventoryType && inventoryType !== 'all') {
      query.inventoryType = inventoryType;
    }

    if (startDate || endDate) {
      query.orderDate = {};
      if (startDate) query.orderDate.$gte = new Date(startDate);
      if (endDate) query.orderDate.$lte = new Date(endDate);
    }

    const [purchaseOrders, total] = await Promise.all([
      PurchaseOrder.find(query)
        .populate('createdBy', 'firstName lastName')
        .populate('approvedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      PurchaseOrder.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: purchaseOrders,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    logger.error('Error fetching purchase orders', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get single purchase order
exports.getPurchaseOrder = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .populate('items.item');

    if (!purchaseOrder) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    res.json({ success: true, data: purchaseOrder });
  } catch (error) {
    logger.error('Error fetching purchase order', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create purchase order
exports.createPurchaseOrder = async (req, res) => {
  try {
    const purchaseOrder = new PurchaseOrder({
      ...req.body,
      createdBy: req.user._id,
      clinic: req.clinicId || req.body.clinic
    });

    await purchaseOrder.save();

    res.status(201).json({ success: true, data: purchaseOrder });
  } catch (error) {
    logger.error('Error creating purchase order', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update purchase order
exports.updatePurchaseOrder = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    if (purchaseOrder.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: 'Only draft purchase orders can be edited'
      });
    }

    Object.assign(purchaseOrder, req.body);
    await purchaseOrder.save();

    res.json({ success: true, data: purchaseOrder });
  } catch (error) {
    logger.error('Error updating purchase order', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Submit for approval
exports.submitForApproval = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    await purchaseOrder.submitForApproval();

    res.json({ success: true, data: purchaseOrder });
  } catch (error) {
    logger.error('Error submitting for approval', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Approve purchase order
exports.approvePurchaseOrder = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    await purchaseOrder.approve(req.user._id, req.body.notes);

    res.json({ success: true, data: purchaseOrder });
  } catch (error) {
    logger.error('Error approving purchase order', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Reject purchase order
exports.rejectPurchaseOrder = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    if (!req.body.reason) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required' });
    }

    await purchaseOrder.reject(req.user._id, req.body.reason);

    res.json({ success: true, data: purchaseOrder });
  } catch (error) {
    logger.error('Error rejecting purchase order', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Mark as sent
exports.markAsSent = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    await purchaseOrder.markSent();

    res.json({ success: true, data: purchaseOrder });
  } catch (error) {
    logger.error('Error marking as sent', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Receive items
exports.receiveItems = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    const { receivedItems, receivedBy } = req.body;

    if (!receivedItems || !Array.isArray(receivedItems)) {
      return res.status(400).json({ success: false, error: 'Received items are required' });
    }

    await purchaseOrder.receiveItems(receivedItems, receivedBy || req.user._id);

    res.json({ success: true, data: purchaseOrder });
  } catch (error) {
    logger.error('Error receiving items', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Close purchase order
exports.closePurchaseOrder = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    await purchaseOrder.close();

    res.json({ success: true, data: purchaseOrder });
  } catch (error) {
    logger.error('Error closing purchase order', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Cancel purchase order
exports.cancelPurchaseOrder = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }

    purchaseOrder.status = 'cancelled';
    purchaseOrder.cancellationReason = req.body.reason;
    purchaseOrder.cancelledBy = req.user._id;
    purchaseOrder.cancelledAt = new Date();
    await purchaseOrder.save();

    res.json({ success: true, data: purchaseOrder });
  } catch (error) {
    logger.error('Error cancelling purchase order', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get pending approvals
exports.getPendingApprovals = async (req, res) => {
  try {
    const query = { status: 'pending_approval' };

    if (req.clinicId) {
      query.clinic = req.clinicId;
    }

    const pendingOrders = await PurchaseOrder.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ submittedAt: 1 })
      .lean();

    res.json({ success: true, data: pendingOrders });
  } catch (error) {
    logger.error('Error fetching pending approvals', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get statistics
exports.getStats = async (req, res) => {
  try {
    const query = {};
    if (req.clinicId) {
      query.clinic = req.clinicId;
    }

    const [
      totalOrders,
      pendingApproval,
      awaitingDelivery,
      totalSpent
    ] = await Promise.all([
      PurchaseOrder.countDocuments(query),
      PurchaseOrder.countDocuments({ ...query, status: 'pending_approval' }),
      PurchaseOrder.countDocuments({ ...query, status: { $in: ['approved', 'sent', 'partial_received'] } }),
      PurchaseOrder.aggregate([
        { $match: { ...query, status: { $in: ['received', 'closed'] } } },
        { $group: { _id: null, total: { $sum: '$totals.grandTotal' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totalOrders,
        pendingApproval,
        awaitingDelivery,
        totalSpent: totalSpent[0]?.total || 0
      }
    });
  } catch (error) {
    logger.error('Error fetching stats', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
};
