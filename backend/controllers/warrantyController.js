const WarrantyTracking = require('../models/WarrantyTracking');
const { escapeRegex } = require('../utils/sanitize');

// Get all warranties with filtering
exports.getWarranties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      productType,
      status,
      expiringWithin // days
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    if (req.clinicId) {
      query.clinic = req.clinicId;
    }

    if (search) {
      const sanitizedSearch = escapeRegex(search);
      query.$or = [
        { 'product.name': { $regex: sanitizedSearch, $options: 'i' } },
        { 'product.serialNumber': { $regex: sanitizedSearch, $options: 'i' } },
        { warrantyNumber: { $regex: sanitizedSearch, $options: 'i' } }
      ];
    }

    if (productType && productType !== 'all') {
      query['product.type'] = productType;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (expiringWithin) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + parseInt(expiringWithin));
      query['coverage.endDate'] = { $lte: expiryDate, $gte: new Date() };
      query.status = 'active';
    }

    const [warranties, total] = await Promise.all([
      WarrantyTracking.find(query)
        .populate('customer', 'firstName lastName')
        .populate('registeredBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      WarrantyTracking.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: warranties,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching warranties:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get single warranty
exports.getWarranty = async (req, res) => {
  try {
    const warranty = await WarrantyTracking.findById(req.params.id)
      .populate('customer', 'firstName lastName email phone')
      .populate('registeredBy', 'firstName lastName')
      .populate('claims.processedBy', 'firstName lastName');

    if (!warranty) {
      return res.status(404).json({ success: false, error: 'Warranty not found' });
    }

    res.json({ success: true, data: warranty });
  } catch (error) {
    console.error('Error fetching warranty:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create warranty
exports.createWarranty = async (req, res) => {
  try {
    const warranty = new WarrantyTracking({
      ...req.body,
      registeredBy: req.user._id,
      clinic: req.clinicId || req.body.clinic
    });

    await warranty.save();

    res.status(201).json({ success: true, data: warranty });
  } catch (error) {
    console.error('Error creating warranty:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update warranty
exports.updateWarranty = async (req, res) => {
  try {
    const warranty = await WarrantyTracking.findById(req.params.id);

    if (!warranty) {
      return res.status(404).json({ success: false, error: 'Warranty not found' });
    }

    Object.assign(warranty, req.body);
    await warranty.save();

    res.json({ success: true, data: warranty });
  } catch (error) {
    console.error('Error updating warranty:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// File a claim
exports.fileClaim = async (req, res) => {
  try {
    const warranty = await WarrantyTracking.findById(req.params.id);

    if (!warranty) {
      return res.status(404).json({ success: false, error: 'Warranty not found' });
    }

    const { issueDescription, issueType, photos } = req.body;

    const claim = await warranty.fileClaim(issueDescription, issueType, photos);

    res.json({ success: true, data: { warranty, claim } });
  } catch (error) {
    console.error('Error filing claim:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Approve claim
exports.approveClaim = async (req, res) => {
  try {
    const warranty = await WarrantyTracking.findById(req.params.id);

    if (!warranty) {
      return res.status(404).json({ success: false, error: 'Warranty not found' });
    }

    const { claimId } = req.params;
    const { resolution, notes, repairDetails, replacementDetails, refundAmount } = req.body;

    await warranty.approveClaim(
      claimId,
      req.user._id,
      resolution,
      notes,
      { repairDetails, replacementDetails, refundAmount }
    );

    res.json({ success: true, data: warranty });
  } catch (error) {
    console.error('Error approving claim:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Reject claim
exports.rejectClaim = async (req, res) => {
  try {
    const warranty = await WarrantyTracking.findById(req.params.id);

    if (!warranty) {
      return res.status(404).json({ success: false, error: 'Warranty not found' });
    }

    const { claimId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required' });
    }

    const claim = warranty.claims.id(claimId);
    if (!claim) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    claim.status = 'rejected';
    claim.processedBy = req.user._id;
    claim.processedAt = new Date();
    claim.rejectionReason = reason;
    await warranty.save();

    res.json({ success: true, data: warranty });
  } catch (error) {
    console.error('Error rejecting claim:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Transfer warranty
exports.transferWarranty = async (req, res) => {
  try {
    const warranty = await WarrantyTracking.findById(req.params.id);

    if (!warranty) {
      return res.status(404).json({ success: false, error: 'Warranty not found' });
    }

    const { newCustomerId, reason } = req.body;

    if (!newCustomerId) {
      return res.status(400).json({ success: false, error: 'New customer ID is required' });
    }

    await warranty.transfer(newCustomerId, reason);

    res.json({ success: true, data: warranty });
  } catch (error) {
    console.error('Error transferring warranty:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get customer warranties
exports.getCustomerWarranties = async (req, res) => {
  try {
    const warranties = await WarrantyTracking.find({ customer: req.params.customerId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: warranties });
  } catch (error) {
    console.error('Error fetching customer warranties:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get expiring warranties
exports.getExpiringWarranties = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const query = { status: 'active' };

    if (req.clinicId) {
      query.clinic = req.clinicId;
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(days));

    query['coverage.endDate'] = { $lte: expiryDate, $gte: new Date() };

    const warranties = await WarrantyTracking.find(query)
      .populate('customer', 'firstName lastName phone email')
      .sort({ 'coverage.endDate': 1 })
      .lean();

    res.json({ success: true, data: warranties });
  } catch (error) {
    console.error('Error fetching expiring warranties:', error);
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

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const [
      totalWarranties,
      activeWarranties,
      expiringWarranties,
      pendingClaims,
      approvedClaimsThisMonth
    ] = await Promise.all([
      WarrantyTracking.countDocuments(query),
      WarrantyTracking.countDocuments({ ...query, status: 'active' }),
      WarrantyTracking.countDocuments({
        ...query,
        status: 'active',
        'coverage.endDate': { $lte: thirtyDaysFromNow, $gte: new Date() }
      }),
      WarrantyTracking.aggregate([
        { $match: query },
        { $unwind: '$claims' },
        { $match: { 'claims.status': 'pending' } },
        { $count: 'count' }
      ]),
      WarrantyTracking.aggregate([
        { $match: query },
        { $unwind: '$claims' },
        {
          $match: {
            'claims.status': 'approved',
            'claims.processedAt': {
              $gte: new Date(new Date().setDate(1)) // First of current month
            }
          }
        },
        { $count: 'count' }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totalWarranties,
        activeWarranties,
        expiringWarranties,
        pendingClaims: pendingClaims[0]?.count || 0,
        approvedClaimsThisMonth: approvedClaimsThisMonth[0]?.count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
