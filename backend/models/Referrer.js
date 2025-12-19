const mongoose = require('mongoose');

/**
 * Referrer Model
 * Tracks doctors who refer patients (external or internal)
 * Used for commission/honoraires calculation
 */
const referrerSchema = new mongoose.Schema({
  // Basic Info
  name: {
    type: String,
    required: [true, 'Le nom du médecin est requis'],
    trim: true
  },

  // Type: internal (works at clinic) or external (refers patients)
  type: {
    type: String,
    enum: ['internal', 'external'],
    required: true,
    default: 'external'
  },

  // Link to User if internal doctor
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  // Contact Info
  phone: String,
  email: String,
  clinic: String, // Clinic/hospital name for external
  address: String,

  // Commission Settings
  commissionType: {
    type: String,
    enum: ['percentage', 'fixed', 'per_act'],
    default: 'percentage'
  },

  // Default commission rate (percentage 0-100)
  defaultCommissionRate: {
    type: Number,
    default: 10,
    min: 0,
    max: 100
  },

  // Fixed amount per referral (if commissionType is 'fixed')
  fixedAmount: {
    type: Number,
    default: 0
  },

  // Per-act rates (if commissionType is 'per_act')
  perActRates: [{
    actCode: String,
    actName: String,
    rate: Number, // percentage or fixed
    rateType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' }
  }],

  // Specialty
  specialty: String,

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  // Statistics
  stats: {
    totalReferrals: { type: Number, default: 0 },
    totalCommissionEarned: { type: Number, default: 0 },
    lastReferralDate: Date
  },

  // Notes
  notes: String

}, {
  timestamps: true
});

// Index for quick lookups
referrerSchema.index({ name: 1 });
referrerSchema.index({ type: 1, isActive: 1 });
referrerSchema.index({ user: 1 });

// Virtual for display name
referrerSchema.virtual('displayName').get(function() {
  return this.type === 'external'
    ? `Dr. ${this.name} (Externe${this.clinic ? ` - ${this.clinic}` : ''})`
    : `Dr. ${this.name} (Interne)`;
});

// Method to calculate commission for an amount
referrerSchema.methods.calculateCommission = function(amount, actCode = null) {
  if (this.commissionType === 'fixed') {
    return this.fixedAmount;
  }

  if (this.commissionType === 'per_act' && actCode) {
    const actRate = this.perActRates.find(r => r.actCode === actCode);
    if (actRate) {
      return actRate.rateType === 'fixed'
        ? actRate.rate
        : (amount * actRate.rate / 100);
    }
  }

  // Default: percentage
  return amount * this.defaultCommissionRate / 100;
};

module.exports = mongoose.model('Referrer', referrerSchema);
