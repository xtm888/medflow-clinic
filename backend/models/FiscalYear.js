/**
 * Fiscal Year Model
 * Manages accounting periods and year-end close procedures
 */

const mongoose = require('mongoose');

const fiscalYearSchema = new mongoose.Schema({
  // Fiscal year identifier (e.g., "FY2024", "FY2025")
  fiscalYearId: {
    type: String,
    unique: true,
    required: true
  },

  // Display name (e.g., "Fiscal Year 2024-2025")
  name: {
    type: String,
    required: true
  },

  // Multi-clinic support
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    index: true
  },

  // Start and end dates
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },

  // Status
  status: {
    type: String,
    enum: ['planning', 'active', 'closing', 'closed', 'archived'],
    default: 'planning',
    index: true
  },

  // Whether this is the current fiscal year
  isCurrent: {
    type: Boolean,
    default: false,
    index: true
  },

  // Closing details
  closingDetails: {
    closedAt: Date,
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closingNotes: String,
    // Financial summary at close
    closingSummary: {
      totalRevenue: Number,
      totalExpenses: Number,
      totalInvoiced: Number,
      totalCollected: Number,
      totalWriteOffs: Number,
      totalRefunds: Number,
      totalOutstanding: Number,
      invoiceCount: Number,
      patientCount: Number
    }
  },

  // Periods within the fiscal year (quarters, months)
  periods: [{
    periodNumber: Number,
    periodType: {
      type: String,
      enum: ['month', 'quarter'],
      default: 'month'
    },
    name: String, // e.g., "Q1 2024", "January 2024"
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ['open', 'soft-closed', 'closed'],
      default: 'open'
    },
    closedAt: Date,
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  // Settings
  settings: {
    // Allow posting to closed periods (with override)
    allowClosedPeriodPosting: { type: Boolean, default: false },
    // Days after period end to allow posting
    gracePeriodDays: { type: Number, default: 5 },
    // Auto-close periods after grace period
    autoClosePeriods: { type: Boolean, default: false },
    // Invoice number prefix for this fiscal year
    invoicePrefix: String,
    // Starting invoice number
    startingInvoiceNumber: { type: Number, default: 1 }
  },

  // Budgets (optional)
  budget: {
    totalBudget: Number,
    revenueTarget: Number,
    categories: [{
      name: String,
      budgeted: Number,
      actual: Number
    }]
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
fiscalYearSchema.index({ startDate: 1, endDate: 1 });
fiscalYearSchema.index({ isCurrent: 1 });
fiscalYearSchema.index({ status: 1 });

// Multi-clinic compound indexes
fiscalYearSchema.index({ clinic: 1, status: 1 });
fiscalYearSchema.index({ clinic: 1, isCurrent: 1 });
fiscalYearSchema.index({ clinic: 1, startDate: 1, endDate: 1 });

// Virtual for fiscal year progress
fiscalYearSchema.virtual('progress').get(function() {
  const now = new Date();
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);

  if (now < start) return 0;
  if (now > end) return 100;

  const total = end - start;
  const elapsed = now - start;
  return Math.round((elapsed / total) * 100);
});

// Virtual for days remaining
fiscalYearSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const end = new Date(this.endDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

// Pre-save: Generate fiscal year ID if not provided
fiscalYearSchema.pre('save', function(next) {
  if (!this.fiscalYearId) {
    const startYear = new Date(this.startDate).getFullYear();
    const endYear = new Date(this.endDate).getFullYear();
    this.fiscalYearId = startYear === endYear ? `FY${startYear}` : `FY${startYear}-${endYear}`;
  }

  // Ensure only one current fiscal year
  if (this.isCurrent && this.isModified('isCurrent')) {
    this.constructor.updateMany(
      { _id: { $ne: this._id }, isCurrent: true },
      { $set: { isCurrent: false } }
    ).exec();
  }

  next();
});

// Static: Get current fiscal year
fiscalYearSchema.statics.getCurrentFiscalYear = async function() {
  // First try to find explicitly marked current
  let current = await this.findOne({ isCurrent: true });

  if (!current) {
    // Fall back to finding by date
    const now = new Date();
    current = await this.findOne({
      startDate: { $lte: now },
      endDate: { $gte: now },
      status: { $in: ['active', 'planning'] }
    });
  }

  return current;
};

// Static: Get fiscal year for a given date
fiscalYearSchema.statics.getFiscalYearForDate = async function(date) {
  const targetDate = new Date(date);
  return this.findOne({
    startDate: { $lte: targetDate },
    endDate: { $gte: targetDate }
  });
};

// Static: Create a new fiscal year with auto-generated periods
fiscalYearSchema.statics.createFiscalYear = async function(data, userId) {
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);

  // Generate monthly periods
  const periods = [];
  let currentDate = new Date(startDate);
  let periodNumber = 1;

  while (currentDate < endDate) {
    const periodStart = new Date(currentDate);
    const periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    // Don't exceed fiscal year end
    if (periodEnd > endDate) {
      periodEnd.setTime(endDate.getTime());
    }

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    periods.push({
      periodNumber,
      periodType: 'month',
      name: `${monthNames[periodStart.getMonth()]} ${periodStart.getFullYear()}`,
      startDate: periodStart,
      endDate: periodEnd,
      status: 'open'
    });

    periodNumber++;
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  }

  const fiscalYear = new this({
    ...data,
    periods,
    createdBy: userId
  });

  return fiscalYear.save();
};

// Method: Activate fiscal year
fiscalYearSchema.methods.activate = async function(userId) {
  if (this.status !== 'planning') {
    throw new Error('Can only activate a fiscal year in planning status');
  }

  // Deactivate any current fiscal year
  await this.constructor.updateMany(
    { isCurrent: true },
    { $set: { isCurrent: false } }
  );

  this.status = 'active';
  this.isCurrent = true;
  this.updatedBy = userId;
  return this.save();
};

// Method: Close a period
fiscalYearSchema.methods.closePeriod = async function(periodNumber, userId, notes) {
  const period = this.periods.find(p => p.periodNumber === periodNumber);
  if (!period) {
    throw new Error('Period not found');
  }

  if (period.status === 'closed') {
    throw new Error('Period is already closed');
  }

  period.status = 'closed';
  period.closedAt = new Date();
  period.closedBy = userId;

  this.updatedBy = userId;
  return this.save();
};

// Method: Soft-close a period (allow corrections with override)
fiscalYearSchema.methods.softClosePeriod = async function(periodNumber, userId) {
  const period = this.periods.find(p => p.periodNumber === periodNumber);
  if (!period) {
    throw new Error('Period not found');
  }

  period.status = 'soft-closed';
  period.closedAt = new Date();
  period.closedBy = userId;

  this.updatedBy = userId;
  return this.save();
};

// Method: Reopen a period (admin only)
fiscalYearSchema.methods.reopenPeriod = async function(periodNumber, userId, reason) {
  const period = this.periods.find(p => p.periodNumber === periodNumber);
  if (!period) {
    throw new Error('Period not found');
  }

  period.status = 'open';
  period.closedAt = null;
  period.closedBy = null;

  this.updatedBy = userId;
  return this.save();
};

// Method: Close fiscal year
fiscalYearSchema.methods.closeFiscalYear = async function(userId, notes) {
  if (this.status !== 'active' && this.status !== 'closing') {
    throw new Error('Can only close an active fiscal year');
  }

  // Calculate closing summary
  const Invoice = require('./Invoice');

  const summary = await Invoice.aggregate([
    {
      $match: {
        dateIssued: {
          $gte: this.startDate,
          $lte: this.endDate
        },
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        totalInvoiced: { $sum: '$summary.total' },
        totalCollected: { $sum: '$summary.amountPaid' },
        totalOutstanding: { $sum: '$summary.amountDue' },
        totalDiscounts: { $sum: '$summary.discountTotal' },
        invoiceCount: { $sum: 1 }
      }
    }
  ]);

  const refunds = await Invoice.aggregate([
    {
      $match: {
        'refunds.date': {
          $gte: this.startDate,
          $lte: this.endDate
        }
      }
    },
    { $unwind: '$refunds' },
    {
      $group: {
        _id: null,
        totalRefunds: { $sum: '$refunds.amount' }
      }
    }
  ]);

  // Close all periods
  this.periods.forEach(period => {
    if (period.status !== 'closed') {
      period.status = 'closed';
      period.closedAt = new Date();
      period.closedBy = userId;
    }
  });

  this.status = 'closed';
  this.isCurrent = false;
  this.closingDetails = {
    closedAt: new Date(),
    closedBy: userId,
    closingNotes: notes,
    closingSummary: {
      totalInvoiced: summary[0]?.totalInvoiced || 0,
      totalCollected: summary[0]?.totalCollected || 0,
      totalOutstanding: summary[0]?.totalOutstanding || 0,
      totalRefunds: refunds[0]?.totalRefunds || 0,
      invoiceCount: summary[0]?.invoiceCount || 0
    }
  };

  this.updatedBy = userId;
  return this.save();
};

// Method: Check if a date can be posted to
fiscalYearSchema.methods.canPostToDate = function(date) {
  const targetDate = new Date(date);

  // Check if date is within fiscal year
  if (targetDate < this.startDate || targetDate > this.endDate) {
    return { allowed: false, reason: 'Date is outside fiscal year' };
  }

  // Find the period for this date
  const period = this.periods.find(p =>
    targetDate >= new Date(p.startDate) && targetDate <= new Date(p.endDate)
  );

  if (!period) {
    return { allowed: false, reason: 'No period found for this date' };
  }

  if (period.status === 'closed' && !this.settings.allowClosedPeriodPosting) {
    return { allowed: false, reason: 'Period is closed', period: period.name };
  }

  if (period.status === 'soft-closed') {
    return { allowed: true, warning: 'Period is soft-closed - requires review', period: period.name };
  }

  return { allowed: true, period: period.name };
};

// Static: Get fiscal year summary
fiscalYearSchema.statics.getFiscalYearSummary = async function(fiscalYearId) {
  const fiscalYear = await this.findOne({
    $or: [
      { _id: fiscalYearId },
      { fiscalYearId: fiscalYearId }
    ]
  });

  if (!fiscalYear) {
    throw new Error('Fiscal year not found');
  }

  const Invoice = require('./Invoice');

  // Get monthly breakdown
  const monthlyData = await Invoice.aggregate([
    {
      $match: {
        dateIssued: {
          $gte: fiscalYear.startDate,
          $lte: fiscalYear.endDate
        },
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$dateIssued' },
          month: { $month: '$dateIssued' }
        },
        revenue: { $sum: '$summary.total' },
        collected: { $sum: '$summary.amountPaid' },
        outstanding: { $sum: '$summary.amountDue' },
        invoiceCount: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  return {
    fiscalYear: {
      id: fiscalYear.fiscalYearId,
      name: fiscalYear.name,
      startDate: fiscalYear.startDate,
      endDate: fiscalYear.endDate,
      status: fiscalYear.status,
      progress: fiscalYear.progress,
      daysRemaining: fiscalYear.daysRemaining
    },
    periods: fiscalYear.periods.map(p => ({
      number: p.periodNumber,
      name: p.name,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate
    })),
    monthlyData,
    closingSummary: fiscalYear.closingDetails?.closingSummary
  };
};

module.exports = mongoose.model('FiscalYear', fiscalYearSchema);
