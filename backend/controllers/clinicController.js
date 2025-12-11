const { asyncHandler } = require('../middleware/errorHandler');
const Clinic = require('../models/Clinic');
const User = require('../models/User');

// ============================================
// CLINIC CRUD
// ============================================

// @desc    Get all clinics
// @route   GET /api/clinics
// @access  Private
exports.getClinics = asyncHandler(async (req, res) => {
  const { status, type, city } = req.query;
  const query = {};

  if (status) query.status = status;
  if (type) query.type = type;
  if (city) query['address.city'] = { $regex: city, $options: 'i' };

  const clinics = await Clinic.find(query)
    .populate('parentClinic', 'name clinicId')
    .sort({ type: 1, name: 1 })
    .lean();

  res.status(200).json({
    success: true,
    count: clinics.length,
    data: clinics
  });
});

// @desc    Get clinics for dropdown (minimal data)
// @route   GET /api/clinics/dropdown
// @access  Private
exports.getClinicsForDropdown = asyncHandler(async (req, res) => {
  const clinics = await Clinic.getForDropdown();

  res.status(200).json({
    success: true,
    data: clinics
  });
});

// @desc    Get user's accessible clinics
// @route   GET /api/clinics/my-clinics
// @access  Private
exports.getMyClinics = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
    .populate('clinics', 'clinicId name shortName address.city type status')
    .populate('primaryClinic', 'clinicId name shortName address.city')
    .lean();

  let clinics = [];

  if (user.accessAllClinics) {
    // Admin/manager - get all active clinics
    clinics = await Clinic.find({ status: 'active' })
      .select('clinicId name shortName address.city type')
      .sort({ name: 1 })
      .lean();
  } else {
    // Regular user - only assigned clinics
    clinics = user.clinics || [];
  }

  res.status(200).json({
    success: true,
    data: {
      clinics,
      primaryClinic: user.primaryClinic,
      accessAllClinics: user.accessAllClinics
    }
  });
});

// @desc    Get single clinic
// @route   GET /api/clinics/:id
// @access  Private
exports.getClinic = asyncHandler(async (req, res) => {
  const clinic = await Clinic.findById(req.params.id)
    .populate('parentClinic', 'name clinicId')
    .populate('createdBy', 'firstName lastName')
    .lean();

  if (!clinic) {
    return res.status(404).json({
      success: false,
      error: 'Clinic not found'
    });
  }

  res.status(200).json({
    success: true,
    data: clinic
  });
});

// @desc    Create clinic
// @route   POST /api/clinics
// @access  Private (Admin)
exports.createClinic = asyncHandler(async (req, res) => {
  const clinicData = {
    ...req.body,
    createdBy: req.user.id
  };

  const clinic = await Clinic.create(clinicData);

  res.status(201).json({
    success: true,
    data: clinic
  });
});

// @desc    Update clinic
// @route   PUT /api/clinics/:id
// @access  Private (Admin)
exports.updateClinic = asyncHandler(async (req, res) => {
  let clinic = await Clinic.findById(req.params.id);

  if (!clinic) {
    return res.status(404).json({
      success: false,
      error: 'Clinic not found'
    });
  }

  clinic = await Clinic.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedBy: req.user.id },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    data: clinic
  });
});

// @desc    Delete clinic
// @route   DELETE /api/clinics/:id
// @access  Private (Admin)
exports.deleteClinic = asyncHandler(async (req, res) => {
  const clinic = await Clinic.findById(req.params.id);

  if (!clinic) {
    return res.status(404).json({
      success: false,
      error: 'Clinic not found'
    });
  }

  // Check if any users are assigned to this clinic
  const usersCount = await User.countDocuments({ clinics: clinic._id });
  if (usersCount > 0) {
    return res.status(400).json({
      success: false,
      error: `Cannot delete clinic with ${usersCount} assigned users`
    });
  }

  await clinic.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// ============================================
// CLINIC STAFF
// ============================================

// @desc    Get staff for a clinic
// @route   GET /api/clinics/:id/staff
// @access  Private
exports.getClinicStaff = asyncHandler(async (req, res) => {
  const staff = await User.find({ clinics: req.params.id, isActive: true })
    .select('firstName lastName role email phoneNumber department')
    .sort({ role: 1, lastName: 1 })
    .lean();

  res.status(200).json({
    success: true,
    count: staff.length,
    data: staff
  });
});

// @desc    Assign user to clinic
// @route   POST /api/clinics/:id/staff/:userId
// @access  Private (Admin)
exports.assignUserToClinic = asyncHandler(async (req, res) => {
  const clinic = await Clinic.findById(req.params.id);
  if (!clinic) {
    return res.status(404).json({
      success: false,
      error: 'Clinic not found'
    });
  }

  const user = await User.findById(req.params.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Add clinic if not already assigned
  if (!user.clinics.includes(clinic._id)) {
    user.clinics.push(clinic._id);

    // Set as primary if first clinic
    if (!user.primaryClinic) {
      user.primaryClinic = clinic._id;
    }

    await user.save();
  }

  res.status(200).json({
    success: true,
    message: `User assigned to ${clinic.name}`
  });
});

// @desc    Remove user from clinic
// @route   DELETE /api/clinics/:id/staff/:userId
// @access  Private (Admin)
exports.removeUserFromClinic = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  user.clinics = user.clinics.filter(c => c.toString() !== req.params.id);

  // Update primary clinic if removed
  if (user.primaryClinic?.toString() === req.params.id) {
    user.primaryClinic = user.clinics[0] || null;
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'User removed from clinic'
  });
});

// ============================================
// CLINIC STATS
// ============================================

// @desc    Get clinic statistics
// @route   GET /api/clinics/:id/stats
// @access  Private
exports.getClinicStats = asyncHandler(async (req, res) => {
  const clinic = await Clinic.findById(req.params.id);

  if (!clinic) {
    return res.status(404).json({
      success: false,
      error: 'Clinic not found'
    });
  }

  await clinic.updateStats();

  res.status(200).json({
    success: true,
    data: clinic.stats
  });
});

// @desc    Get all clinics summary stats
// @route   GET /api/clinics/stats/summary
// @access  Private (Admin/Manager)
exports.getAllClinicsStats = asyncHandler(async (req, res) => {
  const clinics = await Clinic.find({ status: 'active' })
    .select('clinicId name shortName address.city stats')
    .lean();

  const summary = {
    totalClinics: clinics.length,
    totalPatients: clinics.reduce((sum, c) => sum + (c.stats?.totalPatients || 0), 0),
    totalVisitsThisMonth: clinics.reduce((sum, c) => sum + (c.stats?.totalVisitsThisMonth || 0), 0),
    clinics: clinics.map(c => ({
      clinicId: c.clinicId,
      name: c.name,
      city: c.address?.city,
      ...c.stats
    }))
  };

  res.status(200).json({
    success: true,
    data: summary
  });
});

module.exports = exports;
