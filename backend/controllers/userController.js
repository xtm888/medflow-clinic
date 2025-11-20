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
  const tempPassword = Math.random().toString(36).slice(-8) + 'Aa1!';

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