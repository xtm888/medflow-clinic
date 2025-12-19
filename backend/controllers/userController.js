const User = require('../models/User');
const Counter = require('../models/Counter');
const { asyncHandler } = require('../middleware/errorHandler');
const { escapeRegex } = require('../utils/sanitize');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    role,
    department,
    isActive,
    search,
    sort = '-createdAt'
  } = req.query;

  const query = {};

  if (role) query.role = role;
  if (department) query.department = department;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  if (search) {
    const sanitizedSearch = escapeRegex(search);
    query.$or = [
      { firstName: { $regex: sanitizedSearch, $options: 'i' } },
      { lastName: { $regex: sanitizedSearch, $options: 'i' } },
      { email: { $regex: sanitizedSearch, $options: 'i' } },
      { username: { $regex: sanitizedSearch, $options: 'i' } },
      { employeeId: { $regex: sanitizedSearch, $options: 'i' } }
    ];
  }

  const users = await User.find(query)
    .select('-password -sessions -twoFactorSecret')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort(sort);

  const count = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    count: users.length,
    total: count,
    pages: Math.ceil(count / limit),
    currentPage: parseInt(page),
    data: users
  });
});

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .select('-password -twoFactorSecret')
    .populate('createdBy updatedBy', 'firstName lastName');

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Create user
// @route   POST /api/users
// @access  Private/Admin
exports.createUser = asyncHandler(async (req, res, next) => {
  req.body.createdBy = req.user.id;

  // Generate employee ID using Counter (atomic)
  const year = new Date().getFullYear();
  const empCounterId = `employee-${year}`;
  const sequence = await Counter.getNextSequence(empCounterId);
  req.body.employeeId = `EMP${year}${String(sequence).padStart(5, '0')}`;

  const user = await User.create(req.body);

  // Remove sensitive fields from response
  user.password = undefined;
  user.twoFactorSecret = undefined;

  res.status(201).json({
    success: true,
    data: user
  });
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = asyncHandler(async (req, res, next) => {
  req.body.updatedBy = req.user.id;

  // Prevent updating certain fields
  delete req.body.password;
  delete req.body.employeeId;
  delete req.body.createdAt;
  delete req.body.createdBy;

  const user = await User.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  ).select('-password -twoFactorSecret');

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Delete user (soft delete)
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Prevent deleting the last admin
  if (user.role === 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
    if (adminCount <= 1) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the last admin user'
      });
    }
  }

  // Soft delete - deactivate user
  user.isActive = false;
  user.updatedBy = req.user.id;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'User deactivated successfully'
  });
});

// @desc    Update user role
// @route   PUT /api/users/:id/role
// @access  Private/Admin
exports.updateUserRole = asyncHandler(async (req, res, next) => {
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({
      success: false,
      error: 'Role is required'
    });
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Prevent removing the last admin
  if (user.role === 'admin' && role !== 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
    if (adminCount <= 1) {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove admin role from the last admin user'
      });
    }
  }

  user.role = role;
  user.updatedBy = req.user.id;

  // Clear specialized fields if role changes
  if (role !== 'doctor' && role !== 'ophthalmologist') {
    user.specialization = undefined;
    user.licenseNumber = undefined;
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'User role updated successfully',
    data: user
  });
});

// @desc    Activate user
// @route   PUT /api/users/:id/activate
// @access  Private/Admin
exports.activateUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  user.isActive = true;
  user.updatedBy = req.user.id;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'User activated successfully'
  });
});

// @desc    Deactivate user
// @route   PUT /api/users/:id/deactivate
// @access  Private/Admin
exports.deactivateUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Prevent deactivating self
  if (user._id.toString() === req.user.id) {
    return res.status(400).json({
      success: false,
      error: 'Cannot deactivate your own account'
    });
  }

  user.isActive = false;
  user.updatedBy = req.user.id;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'User deactivated successfully'
  });
});

// @desc    Reset user password
// @route   POST /api/users/:id/reset-password
// @access  Private/Admin
exports.resetUserPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('+password');

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Generate temporary password
  const tempPassword = `${Math.random().toString(36).slice(-8)}Aa1!`;

  user.password = tempPassword;
  user.passwordChangedAt = Date.now();
  await user.save();

  // In production, send email with temporary password
  // await sendEmail({
  //   to: user.email,
  //   subject: 'Password Reset - MedFlow',
  //   text: `Your password has been reset. Temporary password: ${tempPassword}`
  // });

  res.status(200).json({
    success: true,
    message: 'Password reset successfully',
    temporaryPassword: tempPassword // Remove this in production
  });
});

// @desc    Get user's prescriptions (for providers)
// @route   GET /api/users/:id/prescriptions
// @access  Private
exports.getUserPrescriptions = asyncHandler(async (req, res, next) => {
  const Prescription = require('../models/Prescription');

  const { page = 1, limit = 50, status } = req.query;

  const query = { prescriber: req.params.id };
  if (status) query.status = status;

  const [prescriptions, total] = await Promise.all([
    Prescription.find(query)
      .populate('patient', 'firstName lastName patientId')
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean(),
    Prescription.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    count: prescriptions.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data: prescriptions
  });
});

// ========================================
// Current User / Preferences Management
// ========================================

// @desc    Get current user profile and preferences
// @route   GET /api/users/me
// @access  Private
exports.getCurrentUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id)
    .select('-password -twoFactorSecret -sessions');

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Update current user preferences
// @route   PUT /api/users/me/preferences
// @access  Private
exports.updatePreferences = asyncHandler(async (req, res, next) => {
  const allowedFields = [
    'viewPreference',
    'dashboardLayout',
    'prescriptionDefaults',
    'examDefaults',
    'maxFavoriteMedications'
  ];

  const updates = {};
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[`preferences.${field}`] = req.body[field];
    }
  });

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: updates },
    { new: true, runValidators: true }
  ).select('preferences');

  res.status(200).json({
    success: true,
    data: user.preferences
  });
});

// @desc    Get favorite medications
// @route   GET /api/users/me/favorites/medications
// @access  Private
exports.getFavoriteMedications = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id)
    .select('preferences.favoriteMedications preferences.maxFavoriteMedications');

  const favorites = user?.preferences?.favoriteMedications || [];

  // Sort by position if set, otherwise by usage count
  favorites.sort((a, b) => {
    if (a.position !== undefined && b.position !== undefined) {
      return a.position - b.position;
    }
    return (b.usageCount || 0) - (a.usageCount || 0);
  });

  res.status(200).json({
    success: true,
    count: favorites.length,
    maxAllowed: user?.preferences?.maxFavoriteMedications || 15,
    data: favorites
  });
});

// @desc    Add medication to favorites
// @route   POST /api/users/me/favorites/medications
// @access  Private
exports.addFavoriteMedication = asyncHandler(async (req, res, next) => {
  const { drugId, drugName, genericName, icon, defaultDosage, color } = req.body;

  if (!drugName) {
    return res.status(400).json({
      success: false,
      error: 'Drug name is required'
    });
  }

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  try {
    await user.addFavoriteMedication({
      drugId,
      drugName,
      genericName,
      icon: icon || '💧',
      defaultDosage: defaultDosage || { eye: 'OU', frequencyCode: 'BID' },
      color
    });

    res.status(201).json({
      success: true,
      message: 'Medication added to favorites',
      data: user.preferences.favoriteMedications
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Remove medication from favorites
// @route   DELETE /api/users/me/favorites/medications/:medicationId
// @access  Private
exports.removeFavoriteMedication = asyncHandler(async (req, res, next) => {
  const { medicationId } = req.params;

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  try {
    await user.removeFavoriteMedication(medicationId);

    res.status(200).json({
      success: true,
      message: 'Medication removed from favorites',
      data: user.preferences.favoriteMedications
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Reorder favorite medications
// @route   PUT /api/users/me/favorites/medications/reorder
// @access  Private
exports.reorderFavoriteMedications = asyncHandler(async (req, res, next) => {
  const { orderedIds } = req.body;

  if (!orderedIds || !Array.isArray(orderedIds)) {
    return res.status(400).json({
      success: false,
      error: 'orderedIds array is required'
    });
  }

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  try {
    await user.reorderFavoriteMedications(orderedIds);

    res.status(200).json({
      success: true,
      message: 'Favorites reordered successfully',
      data: user.preferences.favoriteMedications
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Update favorite medication dosage
// @route   PUT /api/users/me/favorites/medications/:medicationId/dosage
// @access  Private
exports.updateFavoriteMedicationDosage = asyncHandler(async (req, res, next) => {
  const { medicationId } = req.params;
  const { dosage } = req.body;

  if (!dosage) {
    return res.status(400).json({
      success: false,
      error: 'Dosage object is required'
    });
  }

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  try {
    await user.updateFavoriteDosage(medicationId, dosage);

    res.status(200).json({
      success: true,
      message: 'Dosage updated successfully',
      data: user.preferences.favoriteMedications
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Record favorite medication usage
// @route   POST /api/users/me/favorites/medications/:medicationId/usage
// @access  Private
exports.recordFavoriteUsage = asyncHandler(async (req, res, next) => {
  const { medicationId } = req.params;

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  try {
    await user.recordFavoriteUsage(medicationId);

    res.status(200).json({
      success: true,
      message: 'Usage recorded'
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get recent patients
// @route   GET /api/users/me/recent-patients
// @access  Private
exports.getRecentPatients = asyncHandler(async (req, res, next) => {
  const { limit = 10 } = req.query;

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  const recentPatients = await user.getRecentPatients(parseInt(limit));

  res.status(200).json({
    success: true,
    count: recentPatients.length,
    data: recentPatients
  });
});

// @desc    Add patient to recent list
// @route   POST /api/users/me/recent-patients
// @access  Private
exports.addRecentPatient = asyncHandler(async (req, res, next) => {
  const { patientId } = req.body;

  if (!patientId) {
    return res.status(400).json({
      success: false,
      error: 'Patient ID is required'
    });
  }

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  await user.addRecentPatient(patientId);

  res.status(200).json({
    success: true,
    message: 'Patient added to recent list'
  });
});

// @desc    Get favorite protocols
// @route   GET /api/users/me/favorites/protocols
// @access  Private
exports.getFavoriteProtocols = asyncHandler(async (req, res, next) => {
  const TreatmentProtocol = require('../models/TreatmentProtocol');

  const user = await User.findById(req.user.id)
    .select('preferences.favoriteProtocols');

  const protocolIds = user?.preferences?.favoriteProtocols || [];

  const protocols = await TreatmentProtocol.find({
    _id: { $in: protocolIds },
    isActive: true
  }).sort('displayOrder name');

  res.status(200).json({
    success: true,
    count: protocols.length,
    data: protocols
  });
});

// @desc    Toggle protocol favorite status
// @route   POST /api/users/me/favorites/protocols/:protocolId
// @access  Private
exports.toggleFavoriteProtocol = asyncHandler(async (req, res, next) => {
  const { protocolId } = req.params;

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Initialize if not exists
  if (!user.preferences) {
    user.preferences = {};
  }
  if (!user.preferences.favoriteProtocols) {
    user.preferences.favoriteProtocols = [];
  }

  const index = user.preferences.favoriteProtocols.findIndex(
    id => id.toString() === protocolId
  );

  let isFavorite;
  if (index === -1) {
    user.preferences.favoriteProtocols.push(protocolId);
    isFavorite = true;
  } else {
    user.preferences.favoriteProtocols.splice(index, 1);
    isFavorite = false;
  }

  await user.save();

  res.status(200).json({
    success: true,
    isFavorite,
    data: user.preferences.favoriteProtocols
  });
});
