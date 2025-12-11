const mongoose = require('mongoose');

/**
 * ConventionFeeSchedule Model
 * Stores company-specific pricing for medical services
 * Allows different prices per company/convention
 */

const conventionFeeItemSchema = new mongoose.Schema({
  // Reference to standard fee schedule code
  feeScheduleCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },

  // Service name (cached for display)
  serviceName: {
    type: String,
    trim: true
  },

  // Category (cached for filtering)
  category: {
    type: String,
    enum: ['consultation', 'procedure', 'medication', 'imaging', 'laboratory', 'therapy', 'device', 'surgery', 'examination', 'optical', 'other']
  },

  // Convention-specific price
  conventionPrice: {
    type: Number,
    required: true,
    min: 0
  },

  // Override coverage percentage for this specific item
  coveragePercentage: {
    type: Number,
    min: 0,
    max: 100
  },

  // Whether this specific item requires pre-approval
  requiresApproval: {
    type: Boolean,
    default: false
  },

  // Maximum quantity allowed per year
  maxQuantityPerYear: {
    type: Number,
    default: null
  },

  // Maximum quantity per visit
  maxQuantityPerVisit: {
    type: Number,
    default: null
  },

  // Whether this service is covered at all
  isCovered: {
    type: Boolean,
    default: true
  },

  // Notes about this pricing
  notes: String

}, { _id: true });

const conventionFeeScheduleSchema = new mongoose.Schema({
  // Reference to company
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },

  // Schedule name
  name: {
    type: String,
    required: true,
    trim: true
  },

  // Description
  description: String,

  // Currency for all prices in this schedule
  currency: {
    type: String,
    enum: ['CDF', 'USD', 'EUR'],
    default: 'CDF'
  },

  // Effective dates
  effectiveFrom: {
    type: Date,
    required: true,
    default: Date.now
  },
  effectiveTo: Date,

  // Fee items
  items: [conventionFeeItemSchema],

  // Default settings for items not specifically listed
  defaults: {
    // Use standard fee schedule prices?
    useStandardPrices: {
      type: Boolean,
      default: true
    },
    // Apply discount to standard prices
    discountPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    // Default coverage percentage
    coveragePercentage: {
      type: Number,
      min: 0,
      max: 100
    }
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }

}, {
  timestamps: true
});

// Indexes
conventionFeeScheduleSchema.index({ company: 1, isActive: 1 });
conventionFeeScheduleSchema.index({ company: 1, effectiveFrom: 1, effectiveTo: 1 });
conventionFeeScheduleSchema.index({ 'items.feeScheduleCode': 1 });

// Virtual to check if currently effective
conventionFeeScheduleSchema.virtual('isCurrentlyEffective').get(function() {
  const now = new Date();
  const isAfterStart = !this.effectiveFrom || new Date(this.effectiveFrom) <= now;
  const isBeforeEnd = !this.effectiveTo || new Date(this.effectiveTo) >= now;
  return this.isActive && isAfterStart && isBeforeEnd;
});

// Method to get price for a specific service code
conventionFeeScheduleSchema.methods.getPriceForCode = async function(code) {
  const item = this.items.find(i => i.feeScheduleCode === code.toUpperCase());

  if (item) {
    return {
      found: true,
      isConventionPrice: true,
      price: item.conventionPrice,
      currency: this.currency,
      coveragePercentage: item.coveragePercentage,
      requiresApproval: item.requiresApproval,
      isCovered: item.isCovered,
      maxQuantityPerYear: item.maxQuantityPerYear,
      maxQuantityPerVisit: item.maxQuantityPerVisit,
      notes: item.notes
    };
  }

  // Item not in convention schedule - use defaults
  if (this.defaults.useStandardPrices) {
    // Look up from standard FeeSchedule
    const FeeSchedule = require('./FeeSchedule');
    const standardFee = await FeeSchedule.findOne({
      code: code.toUpperCase(),
      active: true
    });

    if (standardFee) {
      let price = standardFee.price;

      // Apply discount if configured
      if (this.defaults.discountPercentage > 0) {
        price = price * (1 - this.defaults.discountPercentage / 100);
      }

      return {
        found: true,
        isConventionPrice: false,
        isStandardPrice: true,
        price: Math.round(price),
        originalPrice: standardFee.price,
        discountApplied: this.defaults.discountPercentage,
        currency: standardFee.currency,
        coveragePercentage: this.defaults.coveragePercentage,
        requiresApproval: false,
        isCovered: true
      };
    }
  }

  return {
    found: false,
    error: 'Service code not found in convention or standard fee schedule'
  };
};

// Method to add or update an item
conventionFeeScheduleSchema.methods.setItemPrice = function(code, priceData) {
  const existingIndex = this.items.findIndex(i => i.feeScheduleCode === code.toUpperCase());

  const itemData = {
    feeScheduleCode: code.toUpperCase(),
    serviceName: priceData.serviceName,
    category: priceData.category,
    conventionPrice: priceData.price,
    coveragePercentage: priceData.coveragePercentage,
    requiresApproval: priceData.requiresApproval || false,
    maxQuantityPerYear: priceData.maxQuantityPerYear,
    maxQuantityPerVisit: priceData.maxQuantityPerVisit,
    isCovered: priceData.isCovered !== false,
    notes: priceData.notes
  };

  if (existingIndex >= 0) {
    this.items[existingIndex] = { ...this.items[existingIndex].toObject(), ...itemData };
  } else {
    this.items.push(itemData);
  }

  return this;
};

// Method to remove an item
conventionFeeScheduleSchema.methods.removeItem = function(code) {
  this.items = this.items.filter(i => i.feeScheduleCode !== code.toUpperCase());
  return this;
};

// Static method to get effective schedule for a company (with parent fallback)
conventionFeeScheduleSchema.statics.getEffectiveForCompany = async function(companyId, date = new Date()) {
  // First, try to find a schedule for this specific company
  let schedule = await this.findOne({
    company: companyId,
    isActive: true,
    effectiveFrom: { $lte: date },
    $or: [
      { effectiveTo: null },
      { effectiveTo: { $gte: date } }
    ]
  }).sort({ effectiveFrom: -1 });

  if (schedule) {
    return schedule;
  }

  // No schedule found - check if company has a parent convention
  const Company = require('./Company');
  const company = await Company.findById(companyId).select('parentConvention');

  if (company?.parentConvention) {
    // Try to get parent's fee schedule
    schedule = await this.findOne({
      company: company.parentConvention,
      isActive: true,
      effectiveFrom: { $lte: date },
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gte: date } }
      ]
    }).sort({ effectiveFrom: -1 });

    if (schedule) {
      // Mark as inherited for clarity
      schedule._isInheritedFromParent = true;
    }
  }

  return schedule;
};

// Static method to get price for a company and code
conventionFeeScheduleSchema.statics.getPriceForCompanyAndCode = async function(companyId, code, date = new Date()) {
  const schedule = await this.getEffectiveForCompany(companyId, date);

  if (schedule) {
    return schedule.getPriceForCode(code);
  }

  // No convention schedule - fall back to standard pricing
  const FeeSchedule = require('./FeeSchedule');
  const standardFee = await FeeSchedule.getEffectivePriceForDate(code, date);

  if (standardFee.found) {
    return {
      found: true,
      isConventionPrice: false,
      isStandardPrice: true,
      price: standardFee.price,
      currency: standardFee.currency,
      requiresApproval: false,
      isCovered: true
    };
  }

  return standardFee;
};

// Static method to bulk import prices
conventionFeeScheduleSchema.statics.bulkImportPrices = async function(companyId, items, userId) {
  let schedule = await this.getEffectiveForCompany(companyId);

  if (!schedule) {
    // Create new schedule
    const Company = require('./Company');
    const company = await Company.findById(companyId);

    schedule = new this({
      company: companyId,
      name: `Grille tarifaire ${company?.name || 'Convention'}`,
      currency: 'CDF',
      effectiveFrom: new Date(),
      createdBy: userId,
      items: []
    });
  }

  // Add/update items
  for (const item of items) {
    schedule.setItemPrice(item.code, item);
  }

  schedule.updatedBy = userId;
  await schedule.save();

  return schedule;
};

// Ensure virtuals are included
conventionFeeScheduleSchema.set('toJSON', { virtuals: true });
conventionFeeScheduleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ConventionFeeSchedule', conventionFeeScheduleSchema);
