const ExternalFacility = require('../models/ExternalFacility');
const { apiResponse } = require('../utils/apiResponse');

/**
 * External Facility Controller
 * Manages external providers (pharmacies, labs, surgical centers, etc.)
 */

// @desc    Get all external facilities
// @route   GET /api/external-facilities
// @access  Private
exports.getExternalFacilities = async (req, res) => {
  try {
    const {
      type,
      city,
      search,
      isActive = 'true',
      page = 1,
      limit = 50,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const query = {};

    // Filter by type
    if (type) {
      query.type = type;
    }

    // Filter by city
    if (city) {
      query['contact.address.city'] = new RegExp(city, 'i');
    }

    // Filter by active status
    if (isActive !== 'all') {
      query.isActive = isActive === 'true';
    }

    // Search by name
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { 'contact.address.city': new RegExp(search, 'i') },
        { subType: new RegExp(search, 'i') }
      ];
    }

    // Clinic filter for multi-clinic
    if (req.query.clinic) {
      query.$or = query.$or || [];
      query.$or.push(
        { clinic: req.query.clinic },
        { clinic: { $exists: false } },
        { clinic: null }
      );
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [facilities, total] = await Promise.all([
      ExternalFacility.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'firstName lastName')
        .lean(),
      ExternalFacility.countDocuments(query)
    ]);

    res.json(apiResponse(true, 'External facilities retrieved', {
      facilities,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    }));
  } catch (error) {
    console.error('Error fetching external facilities:', error);
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Get external facility by ID
// @route   GET /api/external-facilities/:id
// @access  Private
exports.getExternalFacility = async (req, res) => {
  try {
    const facility = await ExternalFacility.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!facility) {
      return res.status(404).json(apiResponse(false, 'External facility not found'));
    }

    res.json(apiResponse(true, 'External facility retrieved', facility));
  } catch (error) {
    console.error('Error fetching external facility:', error);
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Create external facility
// @route   POST /api/external-facilities
// @access  Private/Admin
exports.createExternalFacility = async (req, res) => {
  try {
    const facilityData = {
      ...req.body,
      createdBy: req.user._id
    };

    const facility = await ExternalFacility.create(facilityData);

    res.status(201).json(apiResponse(true, 'External facility created', facility));
  } catch (error) {
    console.error('Error creating external facility:', error);
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Update external facility
// @route   PUT /api/external-facilities/:id
// @access  Private/Admin
exports.updateExternalFacility = async (req, res) => {
  try {
    const facility = await ExternalFacility.findById(req.params.id);

    if (!facility) {
      return res.status(404).json(apiResponse(false, 'External facility not found'));
    }

    // Update fields
    Object.assign(facility, req.body);
    facility.updatedBy = req.user._id;

    await facility.save();

    res.json(apiResponse(true, 'External facility updated', facility));
  } catch (error) {
    console.error('Error updating external facility:', error);
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Delete external facility
// @route   DELETE /api/external-facilities/:id
// @access  Private/Admin
exports.deleteExternalFacility = async (req, res) => {
  try {
    const facility = await ExternalFacility.findById(req.params.id);

    if (!facility) {
      return res.status(404).json(apiResponse(false, 'External facility not found'));
    }

    // Soft delete by setting isActive to false
    facility.isActive = false;
    facility.updatedBy = req.user._id;
    await facility.save();

    res.json(apiResponse(true, 'External facility deactivated'));
  } catch (error) {
    console.error('Error deleting external facility:', error);
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Get facilities by type
// @route   GET /api/external-facilities/by-type/:type
// @access  Private
exports.getFacilitiesByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { city, activeOnly = 'true' } = req.query;

    const options = {};
    if (city) options.city = city;
    if (req.query.clinic) options.clinic = req.query.clinic;

    let facilities;
    if (activeOnly === 'true') {
      facilities = await ExternalFacility.findByType(type, options);
    } else {
      const query = { type };
      if (city) query['contact.address.city'] = city;
      facilities = await ExternalFacility.find(query).sort({ name: 1 });
    }

    res.json(apiResponse(true, `${type} facilities retrieved`, facilities));
  } catch (error) {
    console.error('Error fetching facilities by type:', error);
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Get preferred facilities for a service
// @route   GET /api/external-facilities/preferred/:serviceCode
// @access  Private
exports.getPreferredForService = async (req, res) => {
  try {
    const { serviceCode } = req.params;

    const facilities = await ExternalFacility.findPreferredForService(serviceCode);

    res.json(apiResponse(true, 'Preferred facilities retrieved', facilities));
  } catch (error) {
    console.error('Error fetching preferred facilities:', error);
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Record a referral to external facility
// @route   POST /api/external-facilities/:id/record-referral
// @access  Private
exports.recordReferral = async (req, res) => {
  try {
    const facility = await ExternalFacility.findById(req.params.id);

    if (!facility) {
      return res.status(404).json(apiResponse(false, 'External facility not found'));
    }

    const { completed = false } = req.body;

    await facility.recordReferral(completed);

    res.json(apiResponse(true, 'Referral recorded', {
      totalReferrals: facility.performance.totalReferrals,
      completedReferrals: facility.performance.completedReferrals
    }));
  } catch (error) {
    console.error('Error recording referral:', error);
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Get facility performance stats
// @route   GET /api/external-facilities/:id/stats
// @access  Private
exports.getFacilityStats = async (req, res) => {
  try {
    const facility = await ExternalFacility.findById(req.params.id)
      .select('name type performance');

    if (!facility) {
      return res.status(404).json(apiResponse(false, 'External facility not found'));
    }

    // Get FulfillmentDispatch stats for this facility
    const FulfillmentDispatch = require('../models/FulfillmentDispatch');
    const dispatchStats = await FulfillmentDispatch.aggregate([
      { $match: { externalFacility: facility._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      facility: {
        name: facility.name,
        type: facility.type
      },
      performance: facility.performance,
      dispatches: dispatchStats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {})
    };

    res.json(apiResponse(true, 'Facility stats retrieved', stats));
  } catch (error) {
    console.error('Error fetching facility stats:', error);
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Check if facility is open now
// @route   GET /api/external-facilities/:id/is-open
// @access  Private
exports.checkIfOpen = async (req, res) => {
  try {
    const facility = await ExternalFacility.findById(req.params.id);

    if (!facility) {
      return res.status(404).json(apiResponse(false, 'External facility not found'));
    }

    const isOpen = facility.isOpenNow();

    res.json(apiResponse(true, 'Open status checked', {
      facilityId: facility._id,
      name: facility.name,
      isOpen,
      operatingHours: facility.operatingHours
    }));
  } catch (error) {
    console.error('Error checking if open:', error);
    res.status(500).json(apiResponse(false, error.message));
  }
};

// @desc    Get summary of all external facilities
// @route   GET /api/external-facilities/summary
// @access  Private
exports.getFacilitySummary = async (req, res) => {
  try {
    const summary = await ExternalFacility.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalReferrals: { $sum: '$performance.totalReferrals' },
          completedReferrals: { $sum: '$performance.completedReferrals' }
        }
      },
      {
        $project: {
          type: '$_id',
          count: 1,
          totalReferrals: 1,
          completedReferrals: 1,
          completionRate: {
            $cond: [
              { $gt: ['$totalReferrals', 0] },
              { $multiply: [{ $divide: ['$completedReferrals', '$totalReferrals'] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const total = await ExternalFacility.countDocuments({ isActive: true });

    res.json(apiResponse(true, 'Facility summary retrieved', {
      total,
      byType: summary
    }));
  } catch (error) {
    console.error('Error fetching facility summary:', error);
    res.status(500).json(apiResponse(false, error.message));
  }
};
