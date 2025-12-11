const mongoose = require('mongoose');

const feeItemSchema = new mongoose.Schema({
  // Clinic reference - null means template/central definition
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    default: null,
    index: true
  },
  // Flag to identify template entries (clinic: null)
  isTemplate: {
    type: Boolean,
    default: false
  },
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['consultation', 'procedure', 'medication', 'imaging', 'laboratory', 'therapy', 'device', 'surgery', 'examination', 'optical', 'other'],
    required: true
  },
  subcategory: String,
  displayCategory: String, // For UI display (e.g., "Consultation", "Examen", "Imagerie")
  department: String, // Department/Specialty (e.g., "Ophtalmologie", "Général")
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: process.env.BASE_CURRENCY || 'CDF'
  },
  unit: {
    type: String,
    default: 'unit'
  },
  taxable: {
    type: Boolean,
    default: true
  },
  taxRate: {
    type: Number,
    default: 0
  },
  insuranceClaimable: {
    type: Boolean,
    default: true
  },
  cptCode: String,
  icdCode: String,
  active: {
    type: Boolean,
    default: true
  },
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  effectiveTo: Date,
  minPrice: Number,
  maxPrice: Number,
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Unique index: same code can exist for different clinics
feeItemSchema.index({ code: 1, clinic: 1 }, { unique: true });
// Prevent duplicate template fee schedules (where clinic is null)
feeItemSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { clinic: null } });
feeItemSchema.index({ clinic: 1, category: 1, active: 1 });
feeItemSchema.index({ category: 1, active: 1 });
feeItemSchema.index({ name: 'text', description: 'text' });
feeItemSchema.index({ effectiveFrom: 1, effectiveTo: 1 });
feeItemSchema.index({ isTemplate: 1 });

// Virtual to check if fee is currently effective
feeItemSchema.virtual('isCurrentlyEffective').get(function() {
  const now = new Date();
  const isAfterStart = !this.effectiveFrom || new Date(this.effectiveFrom) <= now;
  const isBeforeEnd = !this.effectiveTo || new Date(this.effectiveTo) >= now;
  return this.active && isAfterStart && isBeforeEnd;
});

// Get fees by category (filters by effective date)
feeItemSchema.statics.getByCategory = function(category, options = {}) {
  const { includeExpired = false, effectiveDate = new Date() } = options;

  let query = { category, active: true };

  if (!includeExpired) {
    query.$and = [
      {
        $or: [
          { effectiveFrom: { $exists: false } },
          { effectiveFrom: null },
          { effectiveFrom: { $lte: effectiveDate } }
        ]
      },
      {
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: effectiveDate } }
        ]
      }
    ];
  }

  return this.find(query).sort('name');
};

// Search with date filtering
feeItemSchema.statics.search = function(query, options = {}) {
  const { includeExpired = false, effectiveDate = new Date() } = options;

  let searchQuery = {
    active: true,
    $or: [
      { code: new RegExp(query, 'i') },
      { name: new RegExp(query, 'i') },
      { description: new RegExp(query, 'i') }
    ]
  };

  if (!includeExpired) {
    searchQuery.$and = [
      {
        $or: [
          { effectiveFrom: { $exists: false } },
          { effectiveFrom: null },
          { effectiveFrom: { $lte: effectiveDate } }
        ]
      },
      {
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: effectiveDate } }
        ]
      }
    ];
  }

  return this.find(searchQuery).limit(20);
};

// Get effective price for a specific date
feeItemSchema.statics.getEffectivePriceForDate = async function(code, serviceDate) {
  const targetDate = new Date(serviceDate);

  // First try to find exact code with matching date range
  let feeItem = await this.findOne({
    code: code.toUpperCase(),
    active: true,
    $and: [
      {
        $or: [
          { effectiveFrom: { $exists: false } },
          { effectiveFrom: null },
          { effectiveFrom: { $lte: targetDate } }
        ]
      },
      {
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: targetDate } }
        ]
      }
    ]
  });

  if (feeItem) {
    return {
      found: true,
      price: feeItem.price,
      currency: feeItem.currency,
      code: feeItem.code,
      name: feeItem.name,
      effectiveFrom: feeItem.effectiveFrom,
      effectiveTo: feeItem.effectiveTo,
      isCurrentlyEffective: feeItem.isCurrentlyEffective,
      minPrice: feeItem.minPrice,
      maxPrice: feeItem.maxPrice
    };
  }

  // If no effective item found, check if there's any version of this code
  const anyVersion = await this.findOne({ code: code.toUpperCase() });

  if (anyVersion) {
    return {
      found: false,
      error: 'Fee schedule exists but is not effective for the specified date',
      code: code,
      availableFrom: anyVersion.effectiveFrom,
      availableTo: anyVersion.effectiveTo
    };
  }

  return {
    found: false,
    error: 'Fee schedule code not found',
    code: code
  };
};

// Validate a price against the fee schedule for a given date
feeItemSchema.statics.validatePriceForDate = async function(code, price, serviceDate, options = {}) {
  const { tolerance = 0.01, allowPriceOverride = true } = options;

  const effectivePrice = await this.getEffectivePriceForDate(code, serviceDate);

  if (!effectivePrice.found) {
    return {
      valid: false,
      error: effectivePrice.error,
      code,
      expectedPrice: null,
      actualPrice: price
    };
  }

  const priceDifference = Math.abs(effectivePrice.price - price);
  const percentDifference = effectivePrice.price > 0
    ? priceDifference / effectivePrice.price
    : priceDifference;

  // Check if within tolerance
  if (percentDifference <= tolerance) {
    return {
      valid: true,
      code,
      expectedPrice: effectivePrice.price,
      actualPrice: price,
      difference: priceDifference
    };
  }

  // Check min/max bounds if set
  if (effectivePrice.minPrice !== undefined && price < effectivePrice.minPrice) {
    return {
      valid: false,
      error: 'Price is below minimum allowed',
      code,
      expectedPrice: effectivePrice.price,
      actualPrice: price,
      minPrice: effectivePrice.minPrice,
      maxPrice: effectivePrice.maxPrice
    };
  }

  if (effectivePrice.maxPrice !== undefined && price > effectivePrice.maxPrice) {
    return {
      valid: false,
      error: 'Price exceeds maximum allowed',
      code,
      expectedPrice: effectivePrice.price,
      actualPrice: price,
      minPrice: effectivePrice.minPrice,
      maxPrice: effectivePrice.maxPrice
    };
  }

  // Price override allowed?
  if (allowPriceOverride) {
    return {
      valid: true,
      warning: 'Price differs from fee schedule',
      code,
      expectedPrice: effectivePrice.price,
      actualPrice: price,
      difference: priceDifference,
      percentDifference: Math.round(percentDifference * 100)
    };
  }

  return {
    valid: false,
    error: 'Price does not match fee schedule',
    code,
    expectedPrice: effectivePrice.price,
    actualPrice: price,
    difference: priceDifference
  };
};

// Get historical prices for a code
feeItemSchema.statics.getPriceHistory = async function(code) {
  // Note: This requires storing historical versions or using a separate history collection
  // For now, we return the current item with effective dates
  const items = await this.find({
    code: code.toUpperCase()
  }).sort({ effectiveFrom: -1 });

  return items.map(item => ({
    price: item.price,
    currency: item.currency,
    effectiveFrom: item.effectiveFrom,
    effectiveTo: item.effectiveTo,
    active: item.active,
    updatedAt: item.updatedAt
  }));
};

// Create a new version of a fee item (for price changes)
feeItemSchema.statics.createNewVersion = async function(code, newData, userId) {
  const currentItem = await this.findOne({ code: code.toUpperCase(), active: true });

  if (!currentItem) {
    throw new Error('Fee item not found');
  }

  const now = new Date();
  const effectiveDate = newData.effectiveFrom ? new Date(newData.effectiveFrom) : now;

  // End the current version
  if (!currentItem.effectiveTo || new Date(currentItem.effectiveTo) > effectiveDate) {
    currentItem.effectiveTo = new Date(effectiveDate.getTime() - 1); // End just before new version
    currentItem.updatedBy = userId;
    await currentItem.save();
  }

  // Create new version
  const newItem = new this({
    ...currentItem.toObject(),
    _id: undefined,
    price: newData.price !== undefined ? newData.price : currentItem.price,
    effectiveFrom: effectiveDate,
    effectiveTo: newData.effectiveTo || null,
    minPrice: newData.minPrice !== undefined ? newData.minPrice : currentItem.minPrice,
    maxPrice: newData.maxPrice !== undefined ? newData.maxPrice : currentItem.maxPrice,
    notes: newData.notes || `Price updated from ${currentItem.price} to ${newData.price}`,
    createdBy: userId,
    updatedBy: userId,
    createdAt: undefined,
    updatedAt: undefined
  });

  // Generate new code with version suffix if code is unique constraint
  // For simplicity, we update the existing record if only changing effective dates

  await newItem.save();

  return newItem;
};

// Get all active fees effective on a specific date
feeItemSchema.statics.getAllEffectiveForDate = async function(targetDate, category = null) {
  const date = new Date(targetDate);

  let query = {
    active: true,
    $and: [
      {
        $or: [
          { effectiveFrom: { $exists: false } },
          { effectiveFrom: null },
          { effectiveFrom: { $lte: date } }
        ]
      },
      {
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: date } }
        ]
      }
    ]
  };

  if (category) {
    query.category = category;
  }

  return this.find(query).sort('category name');
};

// Check for expired fee items
feeItemSchema.statics.getExpiredItems = async function() {
  const now = new Date();

  return this.find({
    active: true,
    effectiveTo: { $lt: now }
  }).sort('effectiveTo');
};

// Check for upcoming fee changes
feeItemSchema.statics.getUpcomingChanges = async function(daysAhead = 30) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));

  return this.find({
    active: true,
    effectiveFrom: {
      $gt: now,
      $lte: futureDate
    }
  }).sort('effectiveFrom');
};

// ==========================================
// MULTI-CLINIC OPERATIONS
// ==========================================

// Get all templates (clinic: null, isTemplate: true)
feeItemSchema.statics.getTemplates = async function(options = {}) {
  const { category, search, includeInactive = false } = options;

  let query = { isTemplate: true };
  if (!includeInactive) query.active = true;
  if (category) query.category = category;

  if (search) {
    query.$or = [
      { code: new RegExp(search, 'i') },
      { name: new RegExp(search, 'i') }
    ];
  }

  return this.find(query).sort('category name').lean();
};

// Get fee schedules for a specific clinic
feeItemSchema.statics.getForClinic = async function(clinicId, options = {}) {
  const { category, search, includeInactive = false } = options;

  let query = { clinic: clinicId, isTemplate: false };
  if (!includeInactive) query.active = true;
  if (category) query.category = category;

  if (search) {
    query.$or = [
      { code: new RegExp(search, 'i') },
      { name: new RegExp(search, 'i') }
    ];
  }

  return this.find(query)
    .populate('clinic', 'clinicId name shortName')
    .sort('category name')
    .lean();
};

// Copy fee schedules from source to target clinic
feeItemSchema.statics.copyToClinic = async function(sourceClinicId, targetClinicId, options = {}) {
  const { overwrite = false, userId } = options;

  // Get source items (templates if sourceClinicId is null)
  const sourceQuery = sourceClinicId
    ? { clinic: sourceClinicId, isTemplate: false, active: true }
    : { isTemplate: true, active: true };

  const sourceItems = await this.find(sourceQuery).lean();

  if (sourceItems.length === 0) {
    throw new Error('No fee schedules found in source');
  }

  const results = { created: 0, skipped: 0, updated: 0, errors: [] };

  for (const item of sourceItems) {
    try {
      // Check if already exists in target clinic
      const existing = await this.findOne({
        code: item.code,
        clinic: targetClinicId
      });

      if (existing) {
        if (overwrite) {
          // Update existing
          await this.findByIdAndUpdate(existing._id, {
            name: item.name,
            description: item.description,
            category: item.category,
            subcategory: item.subcategory,
            displayCategory: item.displayCategory,
            department: item.department,
            price: item.price,
            currency: item.currency,
            unit: item.unit,
            taxable: item.taxable,
            taxRate: item.taxRate,
            insuranceClaimable: item.insuranceClaimable,
            updatedBy: userId
          });
          results.updated++;
        } else {
          results.skipped++;
        }
      } else {
        // Create new
        await this.create({
          clinic: targetClinicId,
          isTemplate: false,
          code: item.code,
          name: item.name,
          description: item.description,
          category: item.category,
          subcategory: item.subcategory,
          displayCategory: item.displayCategory,
          department: item.department,
          price: item.price,
          currency: item.currency,
          unit: item.unit,
          taxable: item.taxable,
          taxRate: item.taxRate,
          insuranceClaimable: item.insuranceClaimable,
          cptCode: item.cptCode,
          icdCode: item.icdCode,
          minPrice: item.minPrice,
          maxPrice: item.maxPrice,
          createdBy: userId,
          updatedBy: userId
        });
        results.created++;
      }
    } catch (error) {
      results.errors.push({ code: item.code, error: error.message });
    }
  }

  return results;
};

// Get clinic pricing status (completeness check)
feeItemSchema.statics.getClinicPricingStatus = async function(clinicIds = []) {
  const Clinic = require('./Clinic');

  // Get all clinics if not specified
  let clinics;
  if (clinicIds.length > 0) {
    clinics = await Clinic.find({ _id: { $in: clinicIds } }).lean();
  } else {
    clinics = await Clinic.find({ status: 'active' }).lean();
  }

  // Get template count (total services)
  const templateCount = await this.countDocuments({ isTemplate: true, active: true });

  const results = [];

  for (const clinic of clinics) {
    const clinicCount = await this.countDocuments({
      clinic: clinic._id,
      isTemplate: false,
      active: true
    });

    results.push({
      clinicId: clinic._id,
      clinicCode: clinic.clinicId,
      clinicName: clinic.name,
      totalServices: templateCount,
      configuredPrices: clinicCount,
      missingPrices: templateCount - clinicCount,
      completionPercent: templateCount > 0 ? Math.round((clinicCount / templateCount) * 100) : 0,
      isComplete: clinicCount >= templateCount
    });
  }

  return results;
};

// Get price for a specific service at a specific clinic
feeItemSchema.statics.getPriceForClinic = async function(code, clinicId) {
  const item = await this.findOne({
    code: code.toUpperCase(),
    clinic: clinicId,
    active: true
  }).lean();

  if (!item) {
    return { found: false, error: 'Price not configured for this clinic' };
  }

  return {
    found: true,
    price: item.price,
    currency: item.currency,
    name: item.name,
    category: item.category
  };
};

// ==========================================
// CACHE INVALIDATION MIDDLEWARE
// ==========================================
// Automatically invalidate cache when fee schedules are modified

const cacheService = require('../services/cacheService');

// Invalidate cache after save
feeItemSchema.post('save', async function(doc) {
  try {
    await cacheService.feeSchedule.invalidate(doc._id.toString());
  } catch (error) {
    console.error('Fee schedule cache invalidation error:', error.message);
  }
});

// Invalidate cache after update
feeItemSchema.post('findOneAndUpdate', async function(doc) {
  try {
    if (doc) {
      await cacheService.feeSchedule.invalidate(doc._id.toString());
    }
  } catch (error) {
    console.error('Fee schedule cache invalidation error:', error.message);
  }
});

// Invalidate cache after delete
feeItemSchema.post('findOneAndDelete', async function(doc) {
  try {
    if (doc) {
      await cacheService.feeSchedule.invalidate(doc._id.toString());
    }
  } catch (error) {
    console.error('Fee schedule cache invalidation error:', error.message);
  }
});

module.exports = mongoose.model('FeeSchedule', feeItemSchema);
