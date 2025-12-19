const RepairTracking = require('../models/RepairTracking');
const { escapeRegex } = require('../utils/sanitize');

// Get all repairs with filtering
exports.getRepairs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      priority,
      itemType
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    if (req.clinicId) {
      query.clinic = req.clinicId;
    }

    if (search) {
      const sanitizedSearch = escapeRegex(search);
      query.$or = [
        { repairNumber: { $regex: sanitizedSearch, $options: 'i' } },
        { 'item.description': { $regex: sanitizedSearch, $options: 'i' } },
        { 'customer.name': { $regex: sanitizedSearch, $options: 'i' } }
      ];
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    if (itemType && itemType !== 'all') {
      query['item.type'] = itemType;
    }

    const [repairs, total] = await Promise.all([
      RepairTracking.find(query)
        .populate('customer.patientId', 'firstName lastName')
        .populate('receivedBy', 'firstName lastName')
        .populate('assignedTo', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      RepairTracking.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: repairs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching repairs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get single repair
exports.getRepair = async (req, res) => {
  try {
    const repair = await RepairTracking.findById(req.params.id)
      .populate('customer.patientId', 'firstName lastName email phone')
      .populate('receivedBy', 'firstName lastName')
      .populate('assignedTechnician', 'firstName lastName')
      .populate('statusHistory.changedBy', 'firstName lastName');

    if (!repair) {
      return res.status(404).json({ success: false, error: 'Repair not found' });
    }

    res.json({ success: true, data: repair });
  } catch (error) {
    console.error('Error fetching repair:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create repair order
exports.createRepair = async (req, res) => {
  try {
    const repair = new RepairTracking({
      ...req.body,
      receivedBy: req.user._id,
      clinic: req.clinicId || req.body.clinic
    });

    await repair.save();

    res.status(201).json({ success: true, data: repair });
  } catch (error) {
    console.error('Error creating repair:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update repair
exports.updateRepair = async (req, res) => {
  try {
    const repair = await RepairTracking.findById(req.params.id);

    if (!repair) {
      return res.status(404).json({ success: false, error: 'Repair not found' });
    }

    // Don't allow updating completed/cancelled repairs
    if (['completed', 'cancelled'].includes(repair.status)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify completed or cancelled repairs'
      });
    }

    Object.assign(repair, req.body);
    await repair.save();

    res.json({ success: true, data: repair });
  } catch (error) {
    console.error('Error updating repair:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update status
exports.updateStatus = async (req, res) => {
  try {
    const repair = await RepairTracking.findById(req.params.id);

    if (!repair) {
      return res.status(404).json({ success: false, error: 'Repair not found' });
    }

    const { status, notes } = req.body;

    await repair.updateStatus(status, req.user._id, notes);

    res.json({ success: true, data: repair });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add part
exports.addPart = async (req, res) => {
  try {
    const repair = await RepairTracking.findById(req.params.id);

    if (!repair) {
      return res.status(404).json({ success: false, error: 'Repair not found' });
    }

    const { name, partNumber, quantity, unitCost, supplier } = req.body;

    await repair.addPart(name, partNumber, quantity, unitCost, supplier);

    res.json({ success: true, data: repair });
  } catch (error) {
    console.error('Error adding part:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add labor
exports.addLabor = async (req, res) => {
  try {
    const repair = await RepairTracking.findById(req.params.id);

    if (!repair) {
      return res.status(404).json({ success: false, error: 'Repair not found' });
    }

    const { description, hours, hourlyRate, technician } = req.body;

    await repair.addLabor(
      description,
      hours,
      hourlyRate,
      technician || req.user._id
    );

    res.json({ success: true, data: repair });
  } catch (error) {
    console.error('Error adding labor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Record customer approval
exports.recordCustomerApproval = async (req, res) => {
  try {
    const repair = await RepairTracking.findById(req.params.id);

    if (!repair) {
      return res.status(404).json({ success: false, error: 'Repair not found' });
    }

    const { approved, signature, notes } = req.body;

    await repair.recordCustomerApproval(approved, signature, notes);

    res.json({ success: true, data: repair });
  } catch (error) {
    console.error('Error recording approval:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Perform quality check
exports.performQualityCheck = async (req, res) => {
  try {
    const repair = await RepairTracking.findById(req.params.id);

    if (!repair) {
      return res.status(404).json({ success: false, error: 'Repair not found' });
    }

    const { passed, checkedBy, notes, failureReasons } = req.body;

    await repair.performQualityCheck(
      passed,
      checkedBy || req.user._id,
      notes,
      failureReasons
    );

    res.json({ success: true, data: repair });
  } catch (error) {
    console.error('Error performing QC:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Complete pickup
exports.completePickup = async (req, res) => {
  try {
    const repair = await RepairTracking.findById(req.params.id);

    if (!repair) {
      return res.status(404).json({ success: false, error: 'Repair not found' });
    }

    const { pickedUpBy, signature, paymentReceived } = req.body;

    repair.pickup = {
      pickedUpAt: new Date(),
      pickedUpBy: pickedUpBy || 'Customer',
      signature,
      handedOverBy: req.user._id
    };

    if (paymentReceived) {
      repair.billing.paid = true;
      repair.billing.paidAt = new Date();
    }

    repair.status = 'completed';
    repair.completedAt = new Date();
    await repair.save();

    res.json({ success: true, data: repair });
  } catch (error) {
    console.error('Error completing pickup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Cancel repair
exports.cancelRepair = async (req, res) => {
  try {
    const repair = await RepairTracking.findById(req.params.id);

    if (!repair) {
      return res.status(404).json({ success: false, error: 'Repair not found' });
    }

    const { reason } = req.body;

    repair.status = 'cancelled';
    repair.cancellation = {
      reason,
      cancelledBy: req.user._id,
      cancelledAt: new Date()
    };
    await repair.save();

    res.json({ success: true, data: repair });
  } catch (error) {
    console.error('Error cancelling repair:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get customer repair history
exports.getCustomerRepairs = async (req, res) => {
  try {
    const repairs = await RepairTracking.find({
      'customer.patientId': req.params.customerId
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: repairs });
  } catch (error) {
    console.error('Error fetching customer repairs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get repairs ready for pickup
exports.getReadyForPickup = async (req, res) => {
  try {
    const query = { status: 'ready_pickup' };

    if (req.clinicId) {
      query.clinic = req.clinicId;
    }

    const repairs = await RepairTracking.find(query)
      .populate('customer.patientId', 'firstName lastName phone')
      .sort({ updatedAt: 1 })
      .lean();

    res.json({ success: true, data: repairs });
  } catch (error) {
    console.error('Error fetching ready repairs:', error);
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalRepairs,
      inProgress,
      readyForPickup,
      completedToday,
      avgTurnaround
    ] = await Promise.all([
      RepairTracking.countDocuments(query),
      RepairTracking.countDocuments({
        ...query,
        status: { $in: ['received', 'inspecting', 'waiting_approval', 'in_repair', 'quality_check'] }
      }),
      RepairTracking.countDocuments({ ...query, status: 'ready_pickup' }),
      RepairTracking.countDocuments({
        ...query,
        status: 'completed',
        completedAt: { $gte: today }
      }),
      RepairTracking.aggregate([
        {
          $match: {
            ...query,
            status: 'completed',
            completedAt: { $exists: true }
          }
        },
        {
          $project: {
            turnaround: { $subtract: ['$completedAt', '$createdAt'] }
          }
        },
        {
          $group: {
            _id: null,
            avgTurnaround: { $avg: '$turnaround' }
          }
        }
      ])
    ]);

    // Convert to days
    const avgDays = avgTurnaround[0]?.avgTurnaround
      ? (avgTurnaround[0].avgTurnaround / (1000 * 60 * 60 * 24)).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        totalRepairs,
        inProgress,
        readyForPickup,
        completedToday,
        averageTurnaroundDays: avgDays
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
