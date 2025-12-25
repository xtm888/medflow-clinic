const StockReconciliation = require('../models/StockReconciliation');
const { escapeRegex } = require('../utils/sanitize');
const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('StockReconciliationController');

// Get all reconciliations with filtering
exports.getReconciliations = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      inventoryType,
      startDate,
      endDate
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    if (req.clinicId) {
      query.clinic = req.clinicId;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (inventoryType && inventoryType !== 'all') {
      query.inventoryType = inventoryType;
    }

    if (startDate || endDate) {
      query.reconciliationDate = {};
      if (startDate) query.reconciliationDate.$gte = new Date(startDate);
      if (endDate) query.reconciliationDate.$lte = new Date(endDate);
    }

    const [reconciliations, total] = await Promise.all([
      StockReconciliation.find(query)
        .populate('initiatedBy', 'firstName lastName')
        .populate('completedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockReconciliation.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: reconciliations,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    log.error('Error fetching reconciliations', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get single reconciliation
exports.getReconciliation = async (req, res) => {
  try {
    const reconciliation = await StockReconciliation.findById(req.params.id)
      .populate('initiatedBy', 'firstName lastName')
      .populate('completedBy', 'firstName lastName')
      .populate('items.item');

    if (!reconciliation) {
      return res.status(404).json({ success: false, error: 'Reconciliation not found' });
    }

    res.json({ success: true, data: reconciliation });
  } catch (error) {
    log.error('Error fetching reconciliation', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create new reconciliation
exports.createReconciliation = async (req, res) => {
  try {
    const reconciliation = new StockReconciliation({
      ...req.body,
      initiatedBy: req.user._id,
      clinic: req.clinicId || req.body.clinic
    });

    await reconciliation.save();

    res.status(201).json({ success: true, data: reconciliation });
  } catch (error) {
    log.error('Error creating reconciliation', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Start reconciliation (change status to in_progress)
exports.startReconciliation = async (req, res) => {
  try {
    const reconciliation = await StockReconciliation.findById(req.params.id);

    if (!reconciliation) {
      return res.status(404).json({ success: false, error: 'Reconciliation not found' });
    }

    await reconciliation.start();

    res.json({ success: true, data: reconciliation });
  } catch (error) {
    log.error('Error starting reconciliation', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add count for an item
exports.addCount = async (req, res) => {
  try {
    const reconciliation = await StockReconciliation.findById(req.params.id);

    if (!reconciliation) {
      return res.status(404).json({ success: false, error: 'Reconciliation not found' });
    }

    const { itemId, physicalCount, countedBy, notes, location, batchNumber } = req.body;

    await reconciliation.addCount(
      itemId,
      physicalCount,
      countedBy || req.user._id,
      notes,
      location,
      batchNumber
    );

    res.json({ success: true, data: reconciliation });
  } catch (error) {
    log.error('Error adding count', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Bulk add counts
exports.bulkAddCounts = async (req, res) => {
  try {
    const reconciliation = await StockReconciliation.findById(req.params.id);

    if (!reconciliation) {
      return res.status(404).json({ success: false, error: 'Reconciliation not found' });
    }

    const { counts } = req.body;

    if (!counts || !Array.isArray(counts)) {
      return res.status(400).json({ success: false, error: 'Counts array is required' });
    }

    for (const count of counts) {
      await reconciliation.addCount(
        count.itemId,
        count.physicalCount,
        count.countedBy || req.user._id,
        count.notes,
        count.location,
        count.batchNumber
      );
    }

    res.json({ success: true, data: reconciliation });
  } catch (error) {
    log.error('Error bulk adding counts', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Submit for review
exports.submitForReview = async (req, res) => {
  try {
    const reconciliation = await StockReconciliation.findById(req.params.id);

    if (!reconciliation) {
      return res.status(404).json({ success: false, error: 'Reconciliation not found' });
    }

    await reconciliation.submitForReview();

    res.json({ success: true, data: reconciliation });
  } catch (error) {
    log.error('Error submitting for review', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Apply adjustments
exports.applyAdjustments = async (req, res) => {
  try {
    const reconciliation = await StockReconciliation.findById(req.params.id);

    if (!reconciliation) {
      return res.status(404).json({ success: false, error: 'Reconciliation not found' });
    }

    const { approvedBy, adjustmentNotes } = req.body;

    await reconciliation.applyAdjustments(
      approvedBy || req.user._id,
      adjustmentNotes
    );

    res.json({ success: true, data: reconciliation });
  } catch (error) {
    log.error('Error applying adjustments', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Complete reconciliation
exports.completeReconciliation = async (req, res) => {
  try {
    const reconciliation = await StockReconciliation.findById(req.params.id);

    if (!reconciliation) {
      return res.status(404).json({ success: false, error: 'Reconciliation not found' });
    }

    await reconciliation.complete(req.user._id);

    res.json({ success: true, data: reconciliation });
  } catch (error) {
    log.error('Error completing reconciliation', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Cancel reconciliation
exports.cancelReconciliation = async (req, res) => {
  try {
    const reconciliation = await StockReconciliation.findById(req.params.id);

    if (!reconciliation) {
      return res.status(404).json({ success: false, error: 'Reconciliation not found' });
    }

    reconciliation.status = 'cancelled';
    reconciliation.cancellationReason = req.body.reason;
    await reconciliation.save();

    res.json({ success: true, data: reconciliation });
  } catch (error) {
    log.error('Error cancelling reconciliation', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get variance report
exports.getVarianceReport = async (req, res) => {
  try {
    const reconciliation = await StockReconciliation.findById(req.params.id)
      .populate('items.item');

    if (!reconciliation) {
      return res.status(404).json({ success: false, error: 'Reconciliation not found' });
    }

    const varianceItems = reconciliation.items
      .filter(item => item.variance !== 0)
      .map(item => ({
        item: item.item,
        itemName: item.itemName,
        systemQuantity: item.systemQuantity,
        physicalCount: item.physicalCount,
        variance: item.variance,
        varianceValue: item.varianceValue,
        variancePercentage: item.variancePercentage,
        varianceReason: item.varianceReason
      }));

    res.json({
      success: true,
      data: {
        reconciliationId: reconciliation._id,
        reconciliationNumber: reconciliation.reconciliationNumber,
        totalOverage: reconciliation.summary.totalOverage,
        totalShortage: reconciliation.summary.totalShortage,
        netVariance: reconciliation.summary.netVariance,
        accuracyRate: reconciliation.summary.accuracyRate,
        varianceItems
      }
    });
  } catch (error) {
    log.error('Error fetching variance report', { error: error.message, stack: error.stack });
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
      totalReconciliations,
      inProgress,
      pendingReview,
      recentCompleted
    ] = await Promise.all([
      StockReconciliation.countDocuments(query),
      StockReconciliation.countDocuments({ ...query, status: 'in_progress' }),
      StockReconciliation.countDocuments({ ...query, status: 'pending_review' }),
      StockReconciliation.find({ ...query, status: 'completed' })
        .sort({ completedAt: -1 })
        .limit(5)
        .select('reconciliationNumber summary.accuracyRate completedAt')
        .lean()
    ]);

    const avgAccuracy = recentCompleted.length > 0
      ? recentCompleted.reduce((acc, r) => acc + (r.summary?.accuracyRate || 0), 0) / recentCompleted.length
      : 100;

    res.json({
      success: true,
      data: {
        totalReconciliations,
        inProgress,
        pendingReview,
        averageAccuracy: avgAccuracy.toFixed(2),
        recentCompleted
      }
    });
  } catch (error) {
    log.error('Error fetching stats', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
};
