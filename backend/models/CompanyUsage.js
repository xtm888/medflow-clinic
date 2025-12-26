/**
 * CompanyUsage Model
 *
 * Tracks cumulative convention/insurance usage per patient per company per fiscal year.
 * Provides fast lookup for annual cap/plafond calculations instead of aggregating
 * all invoices at billing time.
 *
 * Updated atomically when:
 * - Invoice with convention billing is finalized
 * - Invoice is cancelled/refunded
 * - Manual adjustment by admin
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const categoryUsageSchema = new Schema({
  category: {
    type: String,
    required: true,
    enum: ['consultation', 'procedure', 'medication', 'imaging', 'laboratory', 'therapy', 'device', 'surgery', 'examination', 'optical', 'other']
  },
  totalBilled: {
    type: Number,
    default: 0,
    min: 0
  },
  totalCovered: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPatientShare: {
    type: Number,
    default: 0,
    min: 0
  },
  itemCount: {
    type: Number,
    default: 0,
    min: 0
  },
  invoiceCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

const companyUsageSchema = new Schema({
  // Primary key: patient + company + fiscal year
  patient: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },

  company: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },

  // Multi-clinic support
  clinic: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    index: true
  },

  fiscalYear: {
    type: Number,
    required: true,
    index: true
  },

  // Usage breakdown by category (for category-specific caps)
  categories: [categoryUsageSchema],

  // Global totals (for overall annual cap)
  totals: {
    totalBilled: {
      type: Number,
      default: 0,
      min: 0
    },
    totalCovered: {
      type: Number,
      default: 0,
      min: 0
    },
    totalPatientShare: {
      type: Number,
      default: 0,
      min: 0
    },
    visitCount: {
      type: Number,
      default: 0,
      min: 0
    },
    invoiceCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // Tracking
  lastInvoice: {
    type: Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },

  // Audit trail for adjustments
  adjustments: [{
    date: { type: Date, default: Date.now },
    adjustedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    category: String,
    amountChange: Number,
    previousTotal: Number,
    newTotal: Number
  }]
}, {
  timestamps: true
});

// Compound unique index for fast lookup
companyUsageSchema.index(
  { patient: 1, company: 1, fiscalYear: 1 },
  { unique: true }
);

// Index for company-wide reporting
companyUsageSchema.index({ company: 1, fiscalYear: 1 });

// Multi-clinic compound indexes
companyUsageSchema.index({ clinic: 1, company: 1, fiscalYear: 1 });
companyUsageSchema.index({ clinic: 1, patient: 1, fiscalYear: 1 });

/**
 * Get or create usage record for a patient/company/year
 */
companyUsageSchema.statics.getOrCreate = async function(patientId, companyId, fiscalYear = new Date().getFullYear()) {
  let usage = await this.findOne({
    patient: patientId,
    company: companyId,
    fiscalYear
  });

  if (!usage) {
    usage = await this.create({
      patient: patientId,
      company: companyId,
      fiscalYear,
      categories: [],
      totals: {
        totalBilled: 0,
        totalCovered: 0,
        totalPatientShare: 0,
        visitCount: 0,
        invoiceCount: 0
      }
    });
  }

  return usage;
};

/**
 * Record usage from an invoice (called after invoice is finalized)
 * Uses atomic operations to prevent race conditions
 */
companyUsageSchema.statics.recordInvoiceUsage = async function(invoice, session = null) {
  if (!invoice.isConventionInvoice || !invoice.companyBilling?.company) {
    return null;
  }

  const fiscalYear = invoice.dateIssued.getFullYear();
  const patientId = invoice.patient;
  const companyId = invoice.companyBilling.company;

  // Aggregate items by category
  const categoryTotals = {};
  let totalBilled = 0;
  let totalCovered = 0;
  let totalPatientShare = 0;

  for (const item of invoice.items) {
    const cat = item.category || 'other';
    const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
    const companyShare = item.companyShare || 0;
    const patientShare = item.patientShare || itemTotal;

    if (!categoryTotals[cat]) {
      categoryTotals[cat] = {
        totalBilled: 0,
        totalCovered: 0,
        totalPatientShare: 0,
        itemCount: 0
      };
    }

    categoryTotals[cat].totalBilled += itemTotal;
    categoryTotals[cat].totalCovered += companyShare;
    categoryTotals[cat].totalPatientShare += patientShare;
    categoryTotals[cat].itemCount += 1;

    totalBilled += itemTotal;
    totalCovered += companyShare;
    totalPatientShare += patientShare;
  }

  // Build atomic update operations
  const updateOps = {
    $inc: {
      'totals.totalBilled': totalBilled,
      'totals.totalCovered': totalCovered,
      'totals.totalPatientShare': totalPatientShare,
      'totals.invoiceCount': 1
    },
    $set: {
      lastInvoice: invoice._id,
      lastUpdated: new Date()
    }
  };

  // Get existing record to update categories properly
  const existingUsage = await this.findOne({
    patient: patientId,
    company: companyId,
    fiscalYear
  }).session(session);

  let categoryUpdates = existingUsage?.categories || [];

  // Update or add each category
  for (const [cat, totals] of Object.entries(categoryTotals)) {
    const existingCat = categoryUpdates.find(c => c.category === cat);
    if (existingCat) {
      existingCat.totalBilled += totals.totalBilled;
      existingCat.totalCovered += totals.totalCovered;
      existingCat.totalPatientShare += totals.totalPatientShare;
      existingCat.itemCount += totals.itemCount;
      existingCat.invoiceCount += 1;
    } else {
      categoryUpdates.push({
        category: cat,
        totalBilled: totals.totalBilled,
        totalCovered: totals.totalCovered,
        totalPatientShare: totals.totalPatientShare,
        itemCount: totals.itemCount,
        invoiceCount: 1
      });
    }
  }

  updateOps.$set.categories = categoryUpdates;

  // Upsert with atomic increments
  const opts = session ? { session, upsert: true, new: true } : { upsert: true, new: true };

  const result = await this.findOneAndUpdate(
    { patient: patientId, company: companyId, fiscalYear },
    updateOps,
    opts
  );

  return result;
};

/**
 * Reverse usage from a cancelled/refunded invoice
 */
companyUsageSchema.statics.reverseInvoiceUsage = async function(invoice, userId, reason = 'Invoice cancelled', session = null) {
  if (!invoice.isConventionInvoice || !invoice.companyBilling?.company) {
    return null;
  }

  const fiscalYear = invoice.dateIssued.getFullYear();
  const patientId = invoice.patient;
  const companyId = invoice.companyBilling.company;

  // Calculate totals to subtract
  let totalBilled = 0;
  let totalCovered = 0;
  let totalPatientShare = 0;

  for (const item of invoice.items) {
    const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
    totalBilled += itemTotal;
    totalCovered += item.companyShare || 0;
    totalPatientShare += item.patientShare || itemTotal;
  }

  const usage = await this.findOne({
    patient: patientId,
    company: companyId,
    fiscalYear
  }).session(session);

  if (!usage) {
    return null; // No usage record to reverse
  }

  // Record adjustment for audit trail
  usage.adjustments.push({
    date: new Date(),
    adjustedBy: userId,
    reason,
    category: 'all',
    amountChange: -totalCovered,
    previousTotal: usage.totals.totalCovered,
    newTotal: usage.totals.totalCovered - totalCovered
  });

  // Update totals (ensure non-negative)
  usage.totals.totalBilled = Math.max(0, usage.totals.totalBilled - totalBilled);
  usage.totals.totalCovered = Math.max(0, usage.totals.totalCovered - totalCovered);
  usage.totals.totalPatientShare = Math.max(0, usage.totals.totalPatientShare - totalPatientShare);
  usage.totals.invoiceCount = Math.max(0, usage.totals.invoiceCount - 1);

  // Update category totals
  for (const item of invoice.items) {
    const cat = item.category || 'other';
    const catUsage = usage.categories.find(c => c.category === cat);
    if (catUsage) {
      const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
      catUsage.totalBilled = Math.max(0, catUsage.totalBilled - itemTotal);
      catUsage.totalCovered = Math.max(0, catUsage.totalCovered - (item.companyShare || 0));
      catUsage.totalPatientShare = Math.max(0, catUsage.totalPatientShare - (item.patientShare || itemTotal));
      catUsage.itemCount = Math.max(0, catUsage.itemCount - 1);
      catUsage.invoiceCount = Math.max(0, catUsage.invoiceCount - 1);
    }
  }

  usage.lastUpdated = new Date();

  if (session) {
    await usage.save({ session });
  } else {
    await usage.save();
  }

  return usage;
};

/**
 * Get category usage as a map (compatible with existing Invoice.getPatientYTDCategoryUsage format)
 */
companyUsageSchema.methods.getCategoryUsageMap = function() {
  const usageMap = {};

  for (const cat of this.categories) {
    usageMap[cat.category] = {
      totalCompanyShare: cat.totalCovered,
      totalPatientShare: cat.totalPatientShare,
      totalAmount: cat.totalBilled,
      itemCount: cat.itemCount
    };
  }

  return usageMap;
};

/**
 * Get remaining budget for a category (for annual cap checks)
 */
companyUsageSchema.methods.getRemainingBudget = function(category, annualLimit) {
  if (!annualLimit || annualLimit <= 0) {
    return Infinity; // No limit set
  }

  const catUsage = this.categories.find(c => c.category === category);
  const currentUsage = catUsage?.totalCovered || 0;

  return Math.max(0, annualLimit - currentUsage);
};

/**
 * Check if annual cap is exceeded for a category
 */
companyUsageSchema.methods.isCapExceeded = function(category, annualLimit) {
  return this.getRemainingBudget(category, annualLimit) <= 0;
};

/**
 * Static method to rebuild usage from invoices (for migration or data repair)
 */
companyUsageSchema.statics.rebuildFromInvoices = async function(patientId, companyId, fiscalYear) {
  const Invoice = require('./Invoice');

  const startOfYear = new Date(fiscalYear, 0, 1);
  const endOfYear = new Date(fiscalYear, 11, 31, 23, 59, 59);

  // Get all valid convention invoices for this patient/company/year
  const invoices = await Invoice.find({
    patient: patientId,
    'companyBilling.company': companyId,
    isConventionInvoice: true,
    status: { $nin: ['cancelled', 'voided', 'refunded'] },
    dateIssued: { $gte: startOfYear, $lte: endOfYear }
  });

  // Aggregate totals
  const categoryTotals = {};
  let totalBilled = 0;
  let totalCovered = 0;
  let totalPatientShare = 0;
  const visitIds = new Set();

  for (const invoice of invoices) {
    if (invoice.visit) {
      visitIds.add(invoice.visit.toString());
    }

    for (const item of invoice.items) {
      const cat = item.category || 'other';
      const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
      const companyShare = item.companyShare || 0;
      const patientShare = item.patientShare || itemTotal;

      if (!categoryTotals[cat]) {
        categoryTotals[cat] = {
          category: cat,
          totalBilled: 0,
          totalCovered: 0,
          totalPatientShare: 0,
          itemCount: 0,
          invoiceCount: 0
        };
      }

      categoryTotals[cat].totalBilled += itemTotal;
      categoryTotals[cat].totalCovered += companyShare;
      categoryTotals[cat].totalPatientShare += patientShare;
      categoryTotals[cat].itemCount += 1;

      totalBilled += itemTotal;
      totalCovered += companyShare;
      totalPatientShare += patientShare;
    }
  }

  // Count invoices per category
  for (const invoice of invoices) {
    const categoriesInInvoice = new Set(invoice.items.map(i => i.category || 'other'));
    for (const cat of categoriesInInvoice) {
      if (categoryTotals[cat]) {
        categoryTotals[cat].invoiceCount += 1;
      }
    }
  }

  // Upsert the usage record
  const result = await this.findOneAndUpdate(
    { patient: patientId, company: companyId, fiscalYear },
    {
      $set: {
        categories: Object.values(categoryTotals),
        totals: {
          totalBilled,
          totalCovered,
          totalPatientShare,
          visitCount: visitIds.size,
          invoiceCount: invoices.length
        },
        lastUpdated: new Date(),
        lastInvoice: invoices.length > 0 ? invoices[invoices.length - 1]._id : null
      },
      $push: {
        adjustments: {
          date: new Date(),
          reason: 'Rebuilt from invoices',
          category: 'all',
          amountChange: totalCovered,
          previousTotal: 0,
          newTotal: totalCovered
        }
      }
    },
    { upsert: true, new: true }
  );

  return result;
};

/**
 * Get company-wide usage summary for a fiscal year
 */
companyUsageSchema.statics.getCompanySummary = async function(companyId, fiscalYear = new Date().getFullYear()) {
  const result = await this.aggregate([
    {
      $match: {
        company: new mongoose.Types.ObjectId(companyId),
        fiscalYear
      }
    },
    {
      $group: {
        _id: null,
        totalBilled: { $sum: '$totals.totalBilled' },
        totalCovered: { $sum: '$totals.totalCovered' },
        totalPatientShare: { $sum: '$totals.totalPatientShare' },
        patientCount: { $sum: 1 },
        invoiceCount: { $sum: '$totals.invoiceCount' },
        visitCount: { $sum: '$totals.visitCount' }
      }
    }
  ]);

  return result[0] || {
    totalBilled: 0,
    totalCovered: 0,
    totalPatientShare: 0,
    patientCount: 0,
    invoiceCount: 0,
    visitCount: 0
  };
};

module.exports = mongoose.model('CompanyUsage', companyUsageSchema);
