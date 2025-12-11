const mongoose = require('mongoose');

/**
 * CentralInvoice Model
 * Aggregated invoice data from all clinics for consolidated financial reporting
 */
const centralInvoiceSchema = new mongoose.Schema({
  // Original ID from source clinic
  _originalId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },

  // Source clinic
  _sourceClinic: {
    type: String,
    required: true,
    index: true
  },

  // Sync metadata
  _syncedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  _lastModified: Date,
  _deleted: {
    type: Boolean,
    default: false
  },
  _version: {
    type: Number,
    default: 1
  },

  // Invoice identification
  invoiceNumber: {
    type: String,
    required: true,
    index: true
  },

  // Patient reference
  patient: {
    _id: mongoose.Schema.Types.ObjectId,
    patientId: String,
    name: String
  },

  // Visit reference
  visit: {
    _id: mongoose.Schema.Types.ObjectId,
    visitNumber: String
  },

  // Invoice date
  invoiceDate: {
    type: Date,
    required: true,
    index: true
  },
  dueDate: Date,

  // Status
  status: {
    type: String,
    enum: ['draft', 'pending', 'partial', 'paid', 'overdue', 'cancelled', 'refunded'],
    default: 'pending',
    index: true
  },

  // Category for reporting
  category: {
    type: String,
    enum: ['consultation', 'procedure', 'pharmacy', 'optical', 'laboratory', 'imaging', 'other'],
    index: true
  },

  // Amounts
  subtotal: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  total: {
    type: Number,
    required: true,
    index: true
  },
  paidAmount: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },

  // Currency
  currency: {
    type: String,
    default: 'CDF'
  },

  // Payment info
  payments: [{
    method: {
      type: String,
      enum: ['cash', 'card', 'mobile_money', 'bank_transfer', 'insurance', 'convention', 'other']
    },
    amount: Number,
    date: Date,
    reference: String
  }],

  // Insurance/Convention
  insurance: {
    hasInsurance: Boolean,
    provider: String,
    policyNumber: String,
    coveragePercent: Number,
    coveredAmount: Number,
    patientResponsibility: Number,
    claimStatus: {
      type: String,
      enum: ['pending', 'submitted', 'approved', 'rejected', 'paid']
    }
  },

  // Convention (company pays)
  convention: {
    hasConvention: Boolean,
    company: {
      _id: mongoose.Schema.Types.ObjectId,
      name: String
    },
    coveragePercent: Number,
    coveredAmount: Number
  },

  // Line items summary
  itemsSummary: {
    totalItems: Number,
    byCategory: mongoose.Schema.Types.Mixed // { consultation: 2, pharmacy: 5 }
  },

  // Fiscal year
  fiscalYear: String,

  // Created by
  createdBy: {
    _id: mongoose.Schema.Types.ObjectId,
    name: String
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes
centralInvoiceSchema.index({ _originalId: 1, _sourceClinic: 1 }, { unique: true });
centralInvoiceSchema.index({ invoiceNumber: 1, _sourceClinic: 1 });
centralInvoiceSchema.index({ invoiceDate: -1 });
centralInvoiceSchema.index({ status: 1, invoiceDate: -1 });
centralInvoiceSchema.index({ category: 1, invoiceDate: -1 });
centralInvoiceSchema.index({ 'patient.patientId': 1 });

// Static: Get consolidated revenue report
centralInvoiceSchema.statics.getConsolidatedRevenue = async function(options = {}) {
  const { startDate, endDate, groupBy = 'clinic', status = 'paid' } = options;

  const matchStage = {
    _deleted: { $ne: true }
  };

  if (status) {
    matchStage.status = status;
  }

  if (startDate || endDate) {
    matchStage.invoiceDate = {};
    if (startDate) matchStage.invoiceDate.$gte = new Date(startDate);
    if (endDate) matchStage.invoiceDate.$lte = new Date(endDate);
  }

  let groupByField;
  switch (groupBy) {
    case 'clinic':
      groupByField = '$_sourceClinic';
      break;
    case 'category':
      groupByField = '$category';
      break;
    case 'month':
      groupByField = { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } };
      break;
    case 'day':
      groupByField = { $dateToString: { format: '%Y-%m-%d', date: '$invoiceDate' } };
      break;
    case 'paymentMethod':
      groupByField = { $arrayElemAt: ['$payments.method', 0] };
      break;
    default:
      groupByField = '$_sourceClinic';
  }

  const revenue = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: groupByField,
        totalRevenue: { $sum: '$total' },
        totalPaid: { $sum: '$paidAmount' },
        totalOutstanding: { $sum: '$balance' },
        invoiceCount: { $sum: 1 },
        avgInvoice: { $avg: '$total' },
        minInvoice: { $min: '$total' },
        maxInvoice: { $max: '$total' },
        insuranceCovered: {
          $sum: { $ifNull: ['$insurance.coveredAmount', 0] }
        },
        conventionCovered: {
          $sum: { $ifNull: ['$convention.coveredAmount', 0] }
        }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);

  // Get grand totals
  const totals = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        grandTotal: { $sum: '$total' },
        totalPaid: { $sum: '$paidAmount' },
        totalOutstanding: { $sum: '$balance' },
        totalInvoices: { $sum: 1 },
        avgInvoice: { $avg: '$total' }
      }
    }
  ]);

  return {
    groupBy,
    data: revenue,
    totals: totals[0] || {
      grandTotal: 0,
      totalPaid: 0,
      totalOutstanding: 0,
      totalInvoices: 0,
      avgInvoice: 0
    }
  };
};

// Static: Get clinic comparison
centralInvoiceSchema.statics.getClinicComparison = async function(options = {}) {
  const { period = 'month' } = options;

  const now = new Date();
  let currentStart, previousStart, previousEnd;

  if (period === 'month') {
    currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (period === 'quarter') {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    currentStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
    previousStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
    previousEnd = new Date(now.getFullYear(), currentQuarter * 3, 0);
  } else if (period === 'year') {
    currentStart = new Date(now.getFullYear(), 0, 1);
    previousStart = new Date(now.getFullYear() - 1, 0, 1);
    previousEnd = new Date(now.getFullYear() - 1, 11, 31);
  }

  const [currentRevenue, previousRevenue] = await Promise.all([
    this.aggregate([
      {
        $match: {
          invoiceDate: { $gte: currentStart },
          status: 'paid',
          _deleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$_sourceClinic',
          revenue: { $sum: '$total' },
          count: { $sum: 1 },
          avgTicket: { $avg: '$total' }
        }
      }
    ]),
    this.aggregate([
      {
        $match: {
          invoiceDate: { $gte: previousStart, $lte: previousEnd },
          status: 'paid',
          _deleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$_sourceClinic',
          revenue: { $sum: '$total' },
          count: { $sum: 1 },
          avgTicket: { $avg: '$total' }
        }
      }
    ])
  ]);

  // Merge and calculate growth
  const previousMap = previousRevenue.reduce((acc, p) => {
    acc[p._id] = p;
    return acc;
  }, {});

  const comparison = currentRevenue.map(c => {
    const prev = previousMap[c._id] || { revenue: 0, count: 0, avgTicket: 0 };
    return {
      clinic: c._id,
      currentPeriod: {
        revenue: c.revenue,
        invoiceCount: c.count,
        avgTicket: c.avgTicket
      },
      previousPeriod: {
        revenue: prev.revenue,
        invoiceCount: prev.count,
        avgTicket: prev.avgTicket
      },
      growth: {
        revenue: prev.revenue > 0
          ? ((c.revenue - prev.revenue) / prev.revenue * 100).toFixed(1)
          : 100,
        count: prev.count > 0
          ? ((c.count - prev.count) / prev.count * 100).toFixed(1)
          : 100
      }
    };
  });

  return {
    period,
    currentPeriodStart: currentStart,
    previousPeriodStart: previousStart,
    previousPeriodEnd: previousEnd,
    comparison
  };
};

// Static: Get revenue by category across clinics
centralInvoiceSchema.statics.getRevenueByCategory = async function(options = {}) {
  const { startDate, endDate, clinicId } = options;

  const matchStage = {
    status: 'paid',
    _deleted: { $ne: true }
  };

  if (startDate || endDate) {
    matchStage.invoiceDate = {};
    if (startDate) matchStage.invoiceDate.$gte = new Date(startDate);
    if (endDate) matchStage.invoiceDate.$lte = new Date(endDate);
  }

  if (clinicId) {
    matchStage._sourceClinic = clinicId;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          clinic: '$_sourceClinic',
          category: '$category'
        },
        revenue: { $sum: '$total' },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.clinic',
        categories: {
          $push: {
            category: '$_id.category',
            revenue: '$revenue',
            count: '$count'
          }
        },
        totalRevenue: { $sum: '$revenue' }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);
};

// Static: Get payment method distribution
centralInvoiceSchema.statics.getPaymentMethodDistribution = async function(options = {}) {
  const { startDate, endDate } = options;

  const matchStage = {
    status: 'paid',
    _deleted: { $ne: true }
  };

  if (startDate || endDate) {
    matchStage.invoiceDate = {};
    if (startDate) matchStage.invoiceDate.$gte = new Date(startDate);
    if (endDate) matchStage.invoiceDate.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: matchStage },
    { $unwind: '$payments' },
    {
      $group: {
        _id: {
          clinic: '$_sourceClinic',
          method: '$payments.method'
        },
        amount: { $sum: '$payments.amount' },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.clinic',
        methods: {
          $push: {
            method: '$_id.method',
            amount: '$amount',
            count: '$count'
          }
        },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
};

// Static: Upsert from clinic sync
centralInvoiceSchema.statics.upsertFromSync = async function(clinicId, invoiceData) {
  const { _id, patient, visit, items, ...data } = invoiceData;

  // Summarize items by category
  const itemsSummary = {
    totalItems: items?.length || 0,
    byCategory: {}
  };

  if (items) {
    for (const item of items) {
      const cat = item.category || 'other';
      itemsSummary.byCategory[cat] = (itemsSummary.byCategory[cat] || 0) + 1;
    }
  }

  return this.findOneAndUpdate(
    { _originalId: _id, _sourceClinic: clinicId },
    {
      $set: {
        _originalId: _id,
        _sourceClinic: clinicId,
        _syncedAt: new Date(),
        _lastModified: data.updatedAt || new Date(),
        invoiceNumber: data.invoiceNumber,
        patient: patient ? {
          _id: patient._id || patient,
          patientId: data.patientId,
          name: data.patientName
        } : null,
        visit: visit ? {
          _id: visit._id || visit,
          visitNumber: data.visitNumber
        } : null,
        invoiceDate: data.invoiceDate || data.createdAt,
        dueDate: data.dueDate,
        status: data.status,
        category: data.category || 'consultation',
        subtotal: data.subtotal || 0,
        taxAmount: data.taxAmount || 0,
        discountAmount: data.discountAmount || 0,
        total: data.total || 0,
        paidAmount: data.paidAmount || 0,
        balance: data.balance || (data.total - (data.paidAmount || 0)),
        currency: data.currency || 'CDF',
        payments: data.payments || [],
        insurance: data.insurance,
        convention: data.convention,
        itemsSummary,
        fiscalYear: data.fiscalYear,
        createdBy: data.createdBy ? {
          _id: data.createdBy._id || data.createdBy,
          name: data.createdByName
        } : null
      },
      $inc: { _version: 1 }
    },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('CentralInvoice', centralInvoiceSchema);
