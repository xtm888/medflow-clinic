const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validatePassword } = require('../utils/passwordValidator');
const CONSTANTS = require('../config/constants');
const { encrypt, decrypt, isEncrypted } = require('../utils/phiEncryption');

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
  },

  // StudioVision Parity: User Preferences for Enhanced Workflow
  preferences: {
    // Dashboard view preference (compact vs expanded)
    viewPreference: {
      type: String,
      enum: ['compact', 'expanded', 'clinical'],
      default: 'expanded'
    },

    // Default dashboard layout
    dashboardLayout: {
      type: String,
      enum: ['three_column', 'two_column', 'single'],
      default: 'three_column'
    },

    // Favorite medications for quick prescription
    favoriteMedications: [{
      drugId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Drug'
      },
      drugName: {
        type: String,
        required: true
      },
      genericName: String,
      icon: {
        type: String,
        default: '💧'
      },
      // Default dosage when adding via favorite
      defaultDosage: {
        eye: {
          type: String,
          enum: ['OD', 'OS', 'OU'],
          default: 'OU'
        },
        frequency: String,
        frequencyCode: {
          type: String,
          enum: ['QD', 'BID', 'TID', 'QID', 'Q1H', 'Q2H', 'Q4H', 'Q6H', 'QHS', 'PRN', 'QOD']
        },
        duration: {
          value: Number,
          unit: {
            type: String,
            enum: ['days', 'weeks', 'months', 'continuous']
          }
        },
        instructions: String
      },
      position: {
        type: Number,
        default: 0
      },
      color: String,
      addedAt: {
        type: Date,
        default: Date.now
      },
      usageCount: {
        type: Number,
        default: 0
      }
    }],

    // Maximum favorites allowed (for UI)
    maxFavoriteMedications: {
      type: Number,
      default: 15
    },

    // Favorite treatment protocols
    favoriteProtocols: [{
      type: mongoose.Schema.ObjectId,
      ref: 'TreatmentProtocol'
    }],

    // Default prescription settings
    prescriptionDefaults: {
      defaultEye: {
        type: String,
        enum: ['OD', 'OS', 'OU'],
        default: 'OU'
      },
      defaultRefills: {
        type: Number,
        default: 0
      },
      autoSaveDraft: {
        type: Boolean,
        default: true
      }
    },

    // Exam workflow preferences
    examDefaults: {
      autoImportFromDevices: {
        type: Boolean,
        default: true
      },
      showRefractionSummary: {
        type: Boolean,
        default: true
      },
      defaultExamType: {
        type: String,
        default: 'comprehensive'
      }
    },

    // Recent patients for quick access
    recentPatients: [{
      patientId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Patient'
      },
      viewedAt: Date
    }]
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
      expiresIn: process.env.REFRESH_TOKEN_EXPIRE || `${CONSTANTS.AUTH.REFRESH_TOKEN_EXPIRY_DAYS}d`
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

// =====================================================
// TWO-FACTOR SECRET ENCRYPTION
// Security: Encrypt TOTP secret at rest using PHI encryption
// =====================================================

/**
 * Set 2FA secret with encryption
 * @param {string} secret - The plain TOTP secret from speakeasy
 */
userSchema.methods.setTwoFactorSecret = function(secret) {
  if (!secret) {
    this.twoFactorSecret = null;
    return;
  }
  this.twoFactorSecret = encrypt(secret);
};

/**
 * Get decrypted 2FA secret for TOTP verification
 * @returns {string|null} - The decrypted TOTP secret or null
 */
userSchema.methods.getTwoFactorSecret = function() {
  if (!this.twoFactorSecret) {
    return null;
  }
  // Handle legacy unencrypted secrets (base32 strings)
  if (!isEncrypted(this.twoFactorSecret)) {
    return this.twoFactorSecret;
  }
  return decrypt(this.twoFactorSecret);
};

/**
 * Check if 2FA secret needs migration (unencrypted legacy data)
 * @returns {boolean}
 */
userSchema.methods.needsTwoFactorSecretMigration = function() {
  return this.twoFactorSecret && !isEncrypted(this.twoFactorSecret);
};

/**
 * Migrate legacy unencrypted 2FA secret to encrypted format
 * @returns {boolean} - True if migration was performed
 */
userSchema.methods.migrateTwoFactorSecret = function() {
  if (this.needsTwoFactorSecretMigration()) {
    const plainSecret = this.twoFactorSecret;
    this.twoFactorSecret = encrypt(plainSecret);
    return true;
  }
  return false;
};

// =====================================================
// FAVORITE MEDICATIONS MANAGEMENT
// StudioVision Parity: Quick prescription from favorites
// =====================================================

// Add a medication to favorites
userSchema.methods.addFavoriteMedication = async function(medicationData) {
  if (!this.preferences) {
    this.preferences = {};
  }
  if (!this.preferences.favoriteMedications) {
    this.preferences.favoriteMedications = [];
  }

  const maxFavorites = this.preferences.maxFavoriteMedications || 15;

  if (this.preferences.favoriteMedications.length >= maxFavorites) {
    throw new Error(`Maximum of ${maxFavorites} favorite medications allowed`);
  }

  // Check if already exists
  const existing = this.preferences.favoriteMedications.find(
    f => f.drugId?.toString() === medicationData.drugId?.toString() ||
         f.drugName === medicationData.drugName
  );

  if (existing) {
    throw new Error('Medication is already in favorites');
  }

  // Get next position
  const maxPosition = Math.max(
    0,
    ...this.preferences.favoriteMedications.map(f => f.position || 0)
  );

  this.preferences.favoriteMedications.push({
    drugId: medicationData.drugId,
    drugName: medicationData.drugName,
    genericName: medicationData.genericName,
    icon: medicationData.icon || '💧',
    defaultDosage: medicationData.defaultDosage || {
      eye: 'OU',
      frequencyCode: 'BID'
    },
    position: maxPosition + 1,
    color: medicationData.color,
    addedAt: new Date(),
    usageCount: 0
  });

  await this.save({ validateBeforeSave: false });
  return this.preferences.favoriteMedications;
};

// Remove a medication from favorites
userSchema.methods.removeFavoriteMedication = async function(medicationIdOrName) {
  if (!this.preferences?.favoriteMedications) {
    return [];
  }

  const index = this.preferences.favoriteMedications.findIndex(
    f => f._id?.toString() === medicationIdOrName ||
         f.drugId?.toString() === medicationIdOrName ||
         f.drugName === medicationIdOrName
  );

  if (index === -1) {
    throw new Error('Medication not found in favorites');
  }

  this.preferences.favoriteMedications.splice(index, 1);
  await this.save({ validateBeforeSave: false });
  return this.preferences.favoriteMedications;
};

// Reorder favorite medications
userSchema.methods.reorderFavoriteMedications = async function(orderedIds) {
  if (!this.preferences?.favoriteMedications) {
    return [];
  }

  orderedIds.forEach((id, index) => {
    const fav = this.preferences.favoriteMedications.find(
      f => f._id?.toString() === id || f.drugId?.toString() === id
    );
    if (fav) {
      fav.position = index;
    }
  });

  await this.save({ validateBeforeSave: false });
  return this.preferences.favoriteMedications.sort((a, b) => a.position - b.position);
};

// Record usage of a favorite medication
userSchema.methods.recordFavoriteUsage = async function(medicationIdOrName) {
  if (!this.preferences?.favoriteMedications) {
    return;
  }

  const fav = this.preferences.favoriteMedications.find(
    f => f._id?.toString() === medicationIdOrName ||
         f.drugId?.toString() === medicationIdOrName ||
         f.drugName === medicationIdOrName
  );

  if (fav) {
    fav.usageCount = (fav.usageCount || 0) + 1;
    await this.save({ validateBeforeSave: false });
  }
};

// Update default dosage for a favorite
userSchema.methods.updateFavoriteDosage = async function(medicationIdOrName, newDosage) {
  if (!this.preferences?.favoriteMedications) {
    throw new Error('No favorites found');
  }

  const fav = this.preferences.favoriteMedications.find(
    f => f._id?.toString() === medicationIdOrName ||
         f.drugId?.toString() === medicationIdOrName ||
         f.drugName === medicationIdOrName
  );

  if (!fav) {
    throw new Error('Medication not found in favorites');
  }

  fav.defaultDosage = { ...fav.defaultDosage, ...newDosage };
  await this.save({ validateBeforeSave: false });
  return fav;
};

// =====================================================
// RECENT PATIENTS TRACKING
// StudioVision Parity: Quick patient switching
// =====================================================

// Add patient to recent list
userSchema.methods.addRecentPatient = async function(patientId) {
  if (!this.preferences) {
    this.preferences = {};
  }
  if (!this.preferences.recentPatients) {
    this.preferences.recentPatients = [];
  }

  // Remove if already in list
  this.preferences.recentPatients = this.preferences.recentPatients.filter(
    rp => rp.patientId?.toString() !== patientId.toString()
  );

  // Add to front
  this.preferences.recentPatients.unshift({
    patientId,
    viewedAt: new Date()
  });

  // Keep only last 10
  if (this.preferences.recentPatients.length > 10) {
    this.preferences.recentPatients = this.preferences.recentPatients.slice(0, 10);
  }

  await this.save({ validateBeforeSave: false });
  return this.preferences.recentPatients;
};

// Get recent patients populated
userSchema.methods.getRecentPatients = async function() {
  await this.populate({
    path: 'preferences.recentPatients.patientId',
    select: 'patientId firstName lastName dateOfBirth photoUrl'
  });
  return this.preferences?.recentPatients || [];
};

module.exports = mongoose.model('User', userSchema);
