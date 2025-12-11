const mongoose = require('mongoose');
const Counter = require('./Counter');

/**
 * Company Model (Entreprise Conventionnée)
 * Manages corporate/insurance contracts for patient billing
 * Supports: Employers, Insurance companies, NGOs, Government entities
 */

const companySchema = new mongoose.Schema({
  // Unique identifier (auto-generated)
  companyId: {
    type: String,
    unique: true
  },

  // Parent Convention Reference (for sub-companies like "MSO VODACOM" -> parent "MSO")
  parentConvention: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null
  },

  // Flag to identify parent conventions vs sub-companies
  isParentConvention: {
    type: Boolean,
    default: false
  },

  // Convention code for parent (e.g., "MSO", "ACTIVA", "GGA")
  conventionCode: {
    type: String,
    trim: true,
    uppercase: true
  },

  // Package type (P0-P9) and tariff structure (CV, MSP, TJ)
  packageType: {
    type: String,
    enum: ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', null],
    default: null
  },
  tariffStructure: {
    type: String,
    enum: ['CV', 'MSP', 'TJ', null],
    default: null
  },

  // Company Information
  name: {
    type: String,
    required: [true, 'Le nom de l\'entreprise est requis'],
    trim: true,
    uppercase: true
  },
  // Display name for invoices (e.g., "MSO VODACOM" not just "VODACOM")
  invoiceDisplayName: {
    type: String,
    trim: true,
    uppercase: true
  },
  shortName: {
    type: String,
    trim: true,
    uppercase: true
  },
  type: {
    type: String,
    enum: ['employer', 'insurance', 'ngo', 'government', 'convention', 'other'],
    required: true,
    default: 'employer'
  },
  registrationNumber: {
    type: String,
    trim: true
  },
  taxId: {
    type: String,
    trim: true
  },

  // Contact Information
  contact: {
    primaryPhone: {
      type: String,
      required: [true, 'Le numéro de téléphone est requis']
    },
    secondaryPhone: String,
    email: {
      type: String,
      lowercase: true
    },
    website: String,
    address: {
      street: String,
      city: String,
      province: String,
      country: {
        type: String,
        default: 'RD Congo'
      },
      postalCode: String
    }
  },

  // Contact Person
  contactPerson: {
    name: String,
    title: String,
    phone: String,
    email: {
      type: String,
      lowercase: true
    }
  },

  // Contract Details
  contract: {
    contractNumber: String,
    startDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    endDate: Date,
    renewalDate: Date,
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended', 'terminated', 'expired'],
      default: 'active'
    },
    paymentTerms: {
      type: Number,
      default: 30 // Days to pay invoices
    },
    invoiceFrequency: {
      type: String,
      enum: ['per_visit', 'weekly', 'biweekly', 'monthly', 'quarterly'],
      default: 'monthly'
    },
    notes: String
  },

  // Default Coverage Settings
  defaultCoverage: {
    // Percentage covered by company (patient pays the rest)
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 100
    },
    // Maximum amount per visit
    maxPerVisit: {
      type: Number,
      default: null
    },
    // Maximum annual coverage per employee
    maxAnnual: {
      type: Number,
      default: null
    },
    // Copay amount (fixed amount patient pays)
    copayAmount: {
      type: Number,
      default: 0
    },
    // Currency for limits
    currency: {
      type: String,
      enum: ['CDF', 'USD', 'EUR'],
      default: 'CDF'
    }
  },

  // Acts/Services requiring pre-approval
  actsRequiringApproval: [{
    actCode: String,
    actName: String,
    reason: String
  }],

  // Categories covered
  coveredCategories: [{
    category: {
      type: String,
      enum: ['consultation', 'procedure', 'medication', 'imaging', 'laboratory', 'therapy', 'device', 'surgery', 'examination', 'optical', 'other']
    },
    coveragePercentage: {
      type: Number,
      min: 0,
      max: 100
    },
    maxPerCategory: Number,
    requiresApproval: {
      type: Boolean,
      default: false
    },
    // Category not covered at all (e.g., CIGNA/GGA - optical not covered)
    notCovered: {
      type: Boolean,
      default: false
    },
    // Auto-approve if price under this threshold (e.g., ACTIVA - auto under $100)
    autoApproveUnder: {
      type: Number,
      default: null
    },
    // Special notes for this category
    notes: String,
    // Additional discount for this category (e.g., LISUNGI 15% surgery discount)
    additionalDiscount: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    }
  }],

  // Package deals (BRALIMA, MSO, LISUNGI style bundles)
  packageDeals: [{
    name: {
      type: String,
      required: true
    },
    code: String,
    price: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD'
    },
    // Acts included in the package
    includedActs: [{
      actCode: String,
      actName: String
    }],
    // Additional discount on other services
    additionalDiscount: {
      type: Number,
      default: 0
    },
    notes: String,
    active: {
      type: Boolean,
      default: true
    }
  }],

  // Global approval rules
  approvalRules: {
    // Auto-approve acts priced under this amount (ACTIVA/CICR style)
    autoApproveUnderAmount: {
      type: Number,
      default: null
    },
    autoApproveUnderCurrency: {
      type: String,
      enum: ['CDF', 'USD', 'EUR'],
      default: 'USD'
    },
    // Require medical report for certain categories
    requiresMedicalReport: [{
      type: String,
      enum: ['surgery', 'procedure', 'imaging', 'optical']
    }],
    // Global discount percentage (TEMOINS DE JEHOVAH style)
    globalDiscount: {
      percentage: {
        type: Number,
        default: 0
      },
      excludeCategories: [{
        type: String,
        enum: ['surgery', 'optical', 'procedure']
      }]
    }
  },

  // Custom fee schedule for this company
  customFeeSchedule: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConventionFeeSchedule'
  },

  // Account Balance
  balance: {
    totalBilled: {
      type: Number,
      default: 0
    },
    totalPaid: {
      type: Number,
      default: 0
    },
    outstanding: {
      type: Number,
      default: 0
    },
    lastInvoiceDate: Date,
    lastPaymentDate: Date,
    lastPaymentAmount: Number
  },

  // Statistics
  stats: {
    totalEmployees: {
      type: Number,
      default: 0
    },
    activeEmployees: {
      type: Number,
      default: 0
    },
    totalVisits: {
      type: Number,
      default: 0
    },
    totalInvoices: {
      type: Number,
      default: 0
    }
  },

  // Documents (contracts, amendments)
  documents: [{
    name: String,
    type: {
      type: String,
      enum: ['contract', 'amendment', 'fee_schedule', 'correspondence', 'other']
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Status flags
  isActive: {
    type: Boolean,
    default: true
  },
  allowNewPatients: {
    type: Boolean,
    default: true
  },

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String

}, {
  timestamps: true
});

// Indexes
companySchema.index({ companyId: 1 }, { unique: true });
companySchema.index({ name: 'text', shortName: 'text', invoiceDisplayName: 'text' });
companySchema.index({ type: 1, 'contract.status': 1 });
companySchema.index({ isActive: 1 });
companySchema.index({ 'contact.email': 1 });
companySchema.index({ parentConvention: 1 }); // For finding sub-companies
companySchema.index({ isParentConvention: 1 }); // For listing parent conventions
companySchema.index({ conventionCode: 1 }); // For lookup by convention code

// Pre-save hook to generate companyId
companySchema.pre('save', async function(next) {
  if (!this.companyId) {
    try {
      const counterId = 'company';
      const sequence = await Counter.getNextSequence(counterId);
      this.companyId = `ENT${String(sequence).padStart(4, '0')}`;
    } catch (error) {
      // Fallback if Counter fails
      const timestamp = Date.now().toString(36).toUpperCase();
      this.companyId = `ENT${timestamp}`;
    }
  }

  // Update outstanding balance
  this.balance.outstanding = this.balance.totalBilled - this.balance.totalPaid;

  // Check contract expiry
  if (this.contract.endDate && new Date(this.contract.endDate) < new Date()) {
    this.contract.status = 'expired';
  }

  next();
});

// Virtual for contract status display
companySchema.virtual('contractStatusDisplay').get(function() {
  const statusMap = {
    active: 'Actif',
    pending: 'En attente',
    suspended: 'Suspendu',
    terminated: 'Résilié',
    expired: 'Expiré'
  };
  return statusMap[this.contract.status] || this.contract.status;
});

// Virtual for formatted balance
companySchema.virtual('formattedBalance').get(function() {
  const currency = this.defaultCoverage?.currency || 'CDF';
  const totalBilled = this.balance?.totalBilled ?? 0;
  const totalPaid = this.balance?.totalPaid ?? 0;
  const outstanding = this.balance?.outstanding ?? 0;
  return {
    totalBilled: `${totalBilled.toLocaleString()} ${currency}`,
    totalPaid: `${totalPaid.toLocaleString()} ${currency}`,
    outstanding: `${outstanding.toLocaleString()} ${currency}`
  };
});

// Method to check if an act requires approval
companySchema.methods.requiresApproval = function(actCode) {
  // Check specific acts
  const specificAct = this.actsRequiringApproval.find(a => a.actCode === actCode);
  if (specificAct) return true;

  // Check category-based approval
  // Would need to look up the act's category from FeeSchedule
  return false;
};

// Method to get coverage for a specific category
companySchema.methods.getCategorySettings = function(category) {
  const categorySettings = this.coveredCategories.find(c => c.category === category);
  if (categorySettings) {
    return {
      covered: true,
      percentage: categorySettings.coveragePercentage ?? this.defaultCoverage.percentage,
      maxAmount: categorySettings.maxPerCategory ?? this.defaultCoverage.maxPerVisit,
      requiresApproval: categorySettings.requiresApproval
    };
  }
  return {
    covered: true,
    percentage: this.defaultCoverage.percentage,
    maxAmount: this.defaultCoverage.maxPerVisit,
    requiresApproval: false
  };
};

// Method to calculate patient's share
companySchema.methods.calculatePatientShare = function(totalAmount, category = null) {
  let coveragePercentage = this.defaultCoverage.percentage;
  let maxAmount = this.defaultCoverage.maxPerVisit;

  if (category) {
    const settings = this.getCategorySettings(category);
    coveragePercentage = settings.percentage;
    maxAmount = settings.maxAmount;
  }

  // Calculate company's share
  let companyShare = (totalAmount * coveragePercentage) / 100;

  // Apply maximum limit if set
  if (maxAmount && companyShare > maxAmount) {
    companyShare = maxAmount;
  }

  // Patient pays the rest
  const patientShare = totalAmount - companyShare;

  return {
    total: totalAmount,
    companyShare: Math.round(companyShare),
    patientShare: Math.round(patientShare),
    coveragePercentage,
    maxApplied: maxAmount && companyShare >= maxAmount
  };
};

// Method to update balance
companySchema.methods.updateBalance = async function(amount, type = 'billed') {
  if (type === 'billed') {
    this.balance.totalBilled += amount;
    this.balance.lastInvoiceDate = new Date();
  } else if (type === 'paid') {
    this.balance.totalPaid += amount;
    this.balance.lastPaymentDate = new Date();
    this.balance.lastPaymentAmount = amount;
  }
  this.balance.outstanding = this.balance.totalBilled - this.balance.totalPaid;
  return this.save();
};

// Static method to get active companies
companySchema.statics.getActiveCompanies = function() {
  return this.find({
    isActive: true,
    'contract.status': 'active'
  }).sort('name');
};

// Static method to get companies with outstanding balance
companySchema.statics.getWithOutstanding = function(minAmount = 0) {
  return this.find({
    isActive: true,
    'balance.outstanding': { $gt: minAmount }
  }).sort({ 'balance.outstanding': -1 });
};

// Static method to get expiring contracts
companySchema.statics.getExpiringContracts = function(daysAhead = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return this.find({
    isActive: true,
    'contract.status': 'active',
    'contract.endDate': {
      $lte: futureDate,
      $gte: new Date()
    }
  }).sort('contract.endDate');
};

// Static method to search companies
companySchema.statics.search = function(query) {
  return this.find({
    isActive: true,
    $or: [
      { name: new RegExp(query, 'i') },
      { shortName: new RegExp(query, 'i') },
      { companyId: new RegExp(query, 'i') },
      { invoiceDisplayName: new RegExp(query, 'i') },
      { conventionCode: new RegExp(query, 'i') }
    ]
  }).limit(20);
};

// Static method to get all parent conventions
companySchema.statics.getParentConventions = function() {
  return this.find({
    isActive: true,
    isParentConvention: true,
    'contract.status': 'active'
  }).sort('name');
};

// Static method to get sub-companies of a parent convention
companySchema.statics.getSubCompanies = function(parentId) {
  return this.find({
    isActive: true,
    parentConvention: parentId
  }).sort('name');
};

// Static method to get by convention code (e.g., "MSO", "ACTIVA")
companySchema.statics.getByConventionCode = function(code) {
  return this.findOne({
    isActive: true,
    isParentConvention: true,
    conventionCode: code.toUpperCase()
  });
};

// Method to get the name to display on invoices
companySchema.methods.getInvoiceDisplayName = function() {
  // Use invoiceDisplayName if set, otherwise use name
  return this.invoiceDisplayName || this.name;
};

// Method to get effective settings (inherit from parent if not overridden)
companySchema.methods.getEffectiveSettings = async function() {
  // If this is a parent convention or has no parent, return own settings
  if (this.isParentConvention || !this.parentConvention) {
    return {
      defaultCoverage: this.defaultCoverage,
      actsRequiringApproval: this.actsRequiringApproval,
      coveredCategories: this.coveredCategories,
      packageDeals: this.packageDeals,
      approvalRules: this.approvalRules,
      source: 'self'
    };
  }

  // Get parent settings
  const parent = await this.constructor.findById(this.parentConvention);
  if (!parent) {
    return {
      defaultCoverage: this.defaultCoverage,
      actsRequiringApproval: this.actsRequiringApproval,
      coveredCategories: this.coveredCategories,
      packageDeals: this.packageDeals,
      approvalRules: this.approvalRules,
      source: 'self'
    };
  }

  // Merge settings - sub-company overrides parent
  return {
    defaultCoverage: {
      ...parent.defaultCoverage?.toObject?.() || parent.defaultCoverage,
      ...this.defaultCoverage?.toObject?.() || this.defaultCoverage,
      // Keep parent's percentage if sub-company doesn't override
      percentage: this.defaultCoverage?.percentage ?? parent.defaultCoverage?.percentage ?? 100
    },
    actsRequiringApproval: this.actsRequiringApproval?.length > 0
      ? this.actsRequiringApproval
      : parent.actsRequiringApproval,
    coveredCategories: this.coveredCategories?.length > 0
      ? this.coveredCategories
      : parent.coveredCategories,
    packageDeals: this.packageDeals?.length > 0
      ? this.packageDeals
      : parent.packageDeals,
    approvalRules: {
      ...parent.approvalRules?.toObject?.() || parent.approvalRules,
      ...this.approvalRules?.toObject?.() || this.approvalRules
    },
    source: 'merged',
    parentName: parent.name
  };
};

// Virtual to get parent convention name
companySchema.virtual('parentConventionName', {
  ref: 'Company',
  localField: 'parentConvention',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name conventionCode' }
});

// Ensure virtuals are included in JSON
companySchema.set('toJSON', { virtuals: true });
companySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Company', companySchema);
