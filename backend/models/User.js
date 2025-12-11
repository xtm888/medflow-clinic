const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validatePassword } = require('../utils/passwordValidator');

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
    minlength: [12, 'Password must be at least 12 characters'],
    select: false,
    validate: {
      validator: function(v) {
        // Skip validation for existing hashed passwords
        if (v && v.startsWith('$2')) return true;
        const result = validatePassword(v);
        return result.valid;
      },
      message: function(props) {
        const result = validatePassword(props.value);
        return result.errors.join('. ');
      }
    }
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
    enum: ['admin', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'lab_technician', 'ophthalmologist', 'manager', 'technician', 'orthoptist', 'optometrist', 'radiologist', 'accountant'],
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
  // DEA Number - Required for prescribing controlled substances in US
  // For DRC/Congo, this can be used for equivalent regulatory numbers
  deaNumber: {
    type: String,
    trim: true,
    uppercase: true,
    match: [/^[A-Z]{2}\d{7}$/, 'DEA number must be 2 letters followed by 7 digits (e.g., AB1234567)']
    // Optional - only validated when prescribed controlled substances
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

  // Multi-Clinic Assignment
  clinics: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic'
  }],
  primaryClinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic'
  },
  // Can access all clinics (for admins/managers)
  accessAllClinics: {
    type: Boolean,
    default: false
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
  twoFactorBackupCodes: [{
    code: String,
    used: { type: Boolean, default: false },
    usedAt: Date
  }],
  tokenVersion: {
    type: Number,
    default: 0
  },
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
userSchema.index({ employeeId: 1 }, { unique: true, sparse: true });

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

// Sign JWT (short-lived access token)
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    {
      id: this._id,
      role: this.role,
      permissions: this.permissions,
      tokenType: 'access'
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '15m'
    }
  );
};

// SECURITY: Generate refresh token with separate secret
// Refresh tokens are long-lived and use a different secret to limit blast radius
userSchema.methods.getSignedRefreshToken = function() {
  // Use a separate secret for refresh tokens - fall back to JWT_SECRET if not set
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;

  // Warn in development if using same secret
  if (process.env.NODE_ENV !== 'production' && refreshSecret === process.env.JWT_SECRET) {
    console.warn('[SECURITY] REFRESH_TOKEN_SECRET not set - using JWT_SECRET as fallback. Set a separate secret in production!');
  }

  return jwt.sign(
    {
      id: this._id,
      tokenType: 'refresh' // Mark token type to prevent misuse
    },
    refreshSecret,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRE || '30d'
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

// Generate 2FA backup codes
userSchema.methods.generateBackupCodes = function() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push({
      code: crypto.createHash('sha256').update(code).digest('hex'),
      used: false
    });
  }
  this.twoFactorBackupCodes = codes;
  // Return plain codes for user to save (only shown once)
  return codes.map((_, i) => {
    const plainCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    this.twoFactorBackupCodes[i].code = crypto.createHash('sha256').update(plainCode).digest('hex');
    return plainCode;
  });
};

// Verify and use backup code
userSchema.methods.useBackupCode = function(code) {
  const hashedCode = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
  const backupCode = this.twoFactorBackupCodes.find(bc => bc.code === hashedCode && !bc.used);

  if (backupCode) {
    backupCode.used = true;
    backupCode.usedAt = new Date();
    return true;
  }
  return false;
};

module.exports = mongoose.model('User', userSchema);