const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  // Basic Information
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    lowercase: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },

  // Personal Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    match: [/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, 'Please provide a valid phone number']
  },
  dateOfBirth: Date,
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },

  // Professional Information
  role: {
    type: String,
    enum: ['admin', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'lab_technician', 'ophthalmologist'],
    required: true,
    default: 'receptionist'
  },
  specialization: {
    type: String,
    required: function() { return this.role === 'doctor' || this.role === 'ophthalmologist'; }
  },
  licenseNumber: {
    type: String,
    required: function() { return this.role === 'doctor' || this.role === 'pharmacist' || this.role === 'ophthalmologist'; }
  },
  department: {
    type: String,
    enum: ['general', 'ophthalmology', 'pediatrics', 'cardiology', 'orthopedics', 'pharmacy', 'laboratory', 'radiology', 'emergency']
  },

  // Employment Information
  employeeId: {
    type: String,
    unique: true,
    required: true
  },
  hireDate: {
    type: Date,
    default: Date.now
  },
  shift: {
    type: String,
    enum: ['morning', 'afternoon', 'night', 'flexible'],
    default: 'morning'
  },

  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpire: Date,

  // Security
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: String,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,

  // Password Reset
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  passwordChangedAt: Date,
  passwordHistory: [{
    password: String,
    changedAt: Date
  }],

  // Permissions
  permissions: [{
    module: String,
    actions: [String]
  }],

  // Notifications
  notificationPreferences: {
    email: {
      appointments: { type: Boolean, default: true },
      prescriptions: { type: Boolean, default: true },
      systemAlerts: { type: Boolean, default: true }
    },
    sms: {
      appointments: { type: Boolean, default: false },
      prescriptions: { type: Boolean, default: false },
      systemAlerts: { type: Boolean, default: false }
    },
    push: {
      appointments: { type: Boolean, default: true },
      prescriptions: { type: Boolean, default: true },
      systemAlerts: { type: Boolean, default: true }
    }
  },

  // Session Management
  sessions: [{
    token: String,
    device: String,
    ip: String,
    userAgent: String,
    createdAt: Date,
    lastActivity: Date
  }],

  // Audit
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  lastLogin: Date,
  lastActivity: Date,

  // Profile
  avatar: String,
  signature: String,
  bio: String,
  languages: [String],

  // Settings
  settings: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    language: {
      type: String,
      default: 'fr'
    },
    timezone: {
      type: String,
      default: 'Africa/Casablanca'
    },
    dateFormat: {
      type: String,
      default: 'DD/MM/YYYY'
    },
    timeFormat: {
      type: String,
      enum: ['12h', '24h'],
      default: '24h'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Indexes for performance
userSchema.index({ email: 1, username: 1 });
userSchema.index({ role: 1, department: 1 });
userSchema.index({ createdAt: -1 });

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  // Add to password history
  if (!this.passwordHistory) {
    this.passwordHistory = [];
  }
  this.passwordHistory.push({
    password: this.password,
    changedAt: new Date()
  });

  // Keep only last 5 passwords
  if (this.passwordHistory.length > 5) {
    this.passwordHistory = this.passwordHistory.slice(-5);
  }

  this.passwordChangedAt = Date.now();
  next();
});

// Match user password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if password was used before
userSchema.methods.isPasswordUsedBefore = async function(password) {
  for (const oldPassword of this.passwordHistory || []) {
    const match = await bcrypt.compare(password, oldPassword.password);
    if (match) return true;
  }
  return false;
};

// Sign JWT
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    {
      id: this._id,
      role: this.role,
      permissions: this.permissions
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE
    }
  );
};

// Generate and hash password token
userSchema.methods.getResetPasswordToken = function() {
  const resetToken = crypto.randomBytes(20).toString('hex');

  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Generate email verification token
userSchema.methods.getEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(20).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verificationToken;
};

// Handle failed login attempts
userSchema.methods.incLoginAttempts = function() {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours

  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }

  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

// Virtual to check if account is locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Check if user has permission
userSchema.methods.hasPermission = function(module, action) {
  if (this.role === 'admin') return true;

  const permission = this.permissions.find(p => p.module === module);
  return permission && permission.actions.includes(action);
};

module.exports = mongoose.model('User', userSchema);