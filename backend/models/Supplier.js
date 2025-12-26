const mongoose = require('mongoose');
const Counter = require('./Counter');

/**
 * Supplier Model
 * Manages suppliers for purchase orders across all inventory types
 * (pharmacy, optical, lab, surgical supplies, general)
 */
const supplierSchema = new mongoose.Schema({
  // Unique identifier (auto-generated)
  supplierId: {
    type: String,
    unique: true,
    sparse: true
  },

  // Supplier Information
  name: {
    type: String,
    required: [true, 'Le nom du fournisseur est requis'],
    trim: true
  },

  shortName: {
    type: String,
    trim: true
  },

  // Category/Type of supplier
  category: {
    type: String,
    enum: ['pharmacy', 'optical', 'lab', 'surgical', 'general', 'multiple'],
    required: true,
    default: 'general',
    index: true
  },

  // Multiple categories support (e.g., supplier provides both pharmacy and lab items)
  categories: [{
    type: String,
    enum: ['pharmacy', 'optical', 'lab', 'surgical', 'general']
  }],

  // Company registration
  registrationNumber: {
    type: String,
    trim: true
  },

  taxId: {
    type: String,
    trim: true
  },

  // Contact Person
  contactPerson: {
    type: String,
    trim: true
  },

  contactTitle: {
    type: String,
    trim: true
  },

  // Contact Information
  email: {
    type: String,
    lowercase: true,
    trim: true
  },

  phone: {
    type: String,
    trim: true
  },

  secondaryPhone: {
    type: String,
    trim: true
  },

  fax: {
    type: String,
    trim: true
  },

  website: {
    type: String,
    trim: true
  },

  // Address
  address: {
    street: String,
    city: String,
    province: String,
    country: {
      type: String,
      default: 'RD Congo'
    },
    postalCode: String
  },

  // Shipping/Warehouse address (if different)
  shippingAddress: {
    street: String,
    city: String,
    province: String,
    country: String,
    postalCode: String
  },

  // Business Terms
  paymentTerms: {
    type: String,
    default: 'Net 30'
  },

  paymentTermsDays: {
    type: Number,
    default: 30
  },

  creditLimit: {
    type: Number,
    default: 0
  },

  currency: {
    type: String,
    enum: ['CDF', 'USD', 'EUR'],
    default: 'USD'
  },

  // Bank Details
  bankDetails: {
    bankName: String,
    accountName: String,
    accountNumber: String,
    swiftCode: String,
    iban: String,
    routingNumber: String,
    branchCode: String,
    notes: String
  },

  // Service Level
  leadTime: {
    type: Number,
    default: 7,
    min: 0
  },

  minimumOrderValue: {
    type: Number,
    default: 0
  },

  shippingCost: {
    type: Number,
    default: 0
  },

  freeShippingThreshold: {
    type: Number,
    default: 0
  },

  // Rating and Performance
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },

  reliabilityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },

  qualityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'blocked'],
    default: 'active',
    index: true
  },

  isPreferred: {
    type: Boolean,
    default: false
  },

  isApproved: {
    type: Boolean,
    default: true
  },

  // Certifications and Compliance
  certifications: [{
    name: String,
    certificateNumber: String,
    issuedDate: Date,
    expiryDate: Date,
    issuingAuthority: String,
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document'
    }
  }],

  // Products/Services provided
  productsSupplied: [{
    productName: String,
    productCode: String,
    category: String,
    unitPrice: Number,
    currency: String,
    leadTime: Number,
    minimumOrderQuantity: Number,
    lastUpdated: Date
  }],

  // Statistics
  stats: {
    totalOrders: {
      type: Number,
      default: 0
    },
    totalValue: {
      type: Number,
      default: 0
    },
    lastOrderDate: Date,
    lastOrderAmount: Number,
    averageOrderValue: Number,
    onTimeDeliveryRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    defectRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },

  // Documents (contracts, certifications, etc.)
  documents: [{
    name: String,
    type: {
      type: String,
      enum: ['contract', 'certification', 'tax_document', 'insurance', 'price_list', 'catalog', 'correspondence', 'other']
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document'
    },
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    expiryDate: Date
  }],

  // Contract Details
  contract: {
    contractNumber: String,
    startDate: Date,
    endDate: Date,
    renewalDate: Date,
    autoRenew: {
      type: Boolean,
      default: false
    },
    terms: String,
    notes: String
  },

  // Notes and Comments
  notes: String,

  internalNotes: String,

  tags: [String],

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

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  approvedAt: Date,

  // History/Audit trail
  history: [{
    action: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    details: mongoose.Schema.Types.Mixed
  }]
,

  // Soft delete support
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date
}, {
  timestamps: true
});

// Indexes
supplierSchema.index({ name: 'text', shortName: 'text' });
supplierSchema.index({ supplierId: 1 }, { unique: true, sparse: true });
supplierSchema.index({ category: 1, status: 1 });
supplierSchema.index({ status: 1 });
supplierSchema.index({ isPreferred: 1, status: 1 });
supplierSchema.index({ email: 1 });
supplierSchema.index({ phone: 1 });
supplierSchema.index({ tags: 1 });

// Pre-save hook to generate supplierId
supplierSchema.pre('save', async function(next) {
  if (!this.supplierId) {
    try {
      const counterId = 'supplier';
      const sequence = await Counter.getNextSequence(counterId);
      this.supplierId = `SUP${String(sequence).padStart(5, '0')}`;
    } catch (error) {
      // Fallback if Counter fails
      const timestamp = Date.now().toString(36).toUpperCase();
      this.supplierId = `SUP${timestamp}`;
    }
  }

  // Calculate average order value if we have orders
  if (this.stats.totalOrders > 0 && this.stats.totalValue > 0) {
    this.stats.averageOrderValue = this.stats.totalValue / this.stats.totalOrders;
  }

  // Populate categories array from category field if not already set
  if (this.category && (!this.categories || this.categories.length === 0)) {
    if (this.category === 'multiple') {
      this.categories = [];
    } else {
      this.categories = [this.category];
    }
  }

  next();
});

// Virtual for display name
supplierSchema.virtual('displayName').get(function() {
  return this.shortName || this.name;
});

// Virtual for full address
supplierSchema.virtual('fullAddress').get(function() {
  if (!this.address) return '';

  const parts = [
    this.address.street,
    this.address.city,
    this.address.province,
    this.address.country
  ].filter(Boolean);

  return parts.join(', ');
});

// Method to add history entry
supplierSchema.methods.addHistory = function(action, userId, details) {
  this.history.push({
    action,
    performedBy: userId,
    performedAt: new Date(),
    details
  });
};

// Method to update statistics after order
supplierSchema.methods.updateOrderStats = function(orderValue) {
  this.stats.totalOrders = (this.stats.totalOrders || 0) + 1;
  this.stats.totalValue = (this.stats.totalValue || 0) + orderValue;
  this.stats.lastOrderDate = new Date();
  this.stats.lastOrderAmount = orderValue;

  if (this.stats.totalOrders > 0) {
    this.stats.averageOrderValue = this.stats.totalValue / this.stats.totalOrders;
  }
};

// Method to update delivery performance
supplierSchema.methods.updateDeliveryPerformance = function(onTime, hasDefects) {
  const totalOrders = this.stats.totalOrders || 1;

  // Update on-time delivery rate (rolling average)
  const currentOnTime = this.stats.onTimeDeliveryRate || 0;
  this.stats.onTimeDeliveryRate = ((currentOnTime * (totalOrders - 1)) + (onTime ? 100 : 0)) / totalOrders;

  // Update defect rate (rolling average)
  const currentDefect = this.stats.defectRate || 0;
  this.stats.defectRate = ((currentDefect * (totalOrders - 1)) + (hasDefects ? 100 : 0)) / totalOrders;

  // Update reliability score (weighted combination)
  this.reliabilityScore = (this.stats.onTimeDeliveryRate * 0.7) + ((100 - this.stats.defectRate) * 0.3);
};

// Method to activate supplier
supplierSchema.methods.activate = function(userId) {
  this.status = 'active';
  this.addHistory('activated', userId);
  return this.save();
};

// Method to deactivate supplier
supplierSchema.methods.deactivate = function(userId, reason) {
  this.status = 'inactive';
  this.addHistory('deactivated', userId, { reason });
  return this.save();
};

// Method to suspend supplier
supplierSchema.methods.suspend = function(userId, reason) {
  this.status = 'suspended';
  this.addHistory('suspended', userId, { reason });
  return this.save();
};

// Method to block supplier
supplierSchema.methods.block = function(userId, reason) {
  this.status = 'blocked';
  this.addHistory('blocked', userId, { reason });
  return this.save();
};

// Static method to get active suppliers
supplierSchema.statics.getActiveSuppliers = function(category = null) {
  const query = { status: 'active' };

  if (category) {
    query.$or = [
      { category },
      { categories: category }
    ];
  }

  return this.find(query).sort('name');
};

// Static method to get preferred suppliers
supplierSchema.statics.getPreferredSuppliers = function(category = null) {
  const query = {
    status: 'active',
    isPreferred: true
  };

  if (category) {
    query.$or = [
      { category },
      { categories: category }
    ];
  }

  return this.find(query).sort('-rating name');
};

// Static method to search suppliers
supplierSchema.statics.search = function(query) {
  return this.find({
    $or: [
      { name: new RegExp(query, 'i') },
      { shortName: new RegExp(query, 'i') },
      { supplierId: new RegExp(query, 'i') },
      { email: new RegExp(query, 'i') }
    ],
    status: { $ne: 'blocked' }
  }).limit(20);
};

// Static method to get suppliers by category
supplierSchema.statics.getByCategory = function(category) {
  return this.find({
    $or: [
      { category },
      { categories: category }
    ],
    status: 'active'
  }).sort('name');
};

// Static method to get top suppliers by order value
supplierSchema.statics.getTopSuppliers = function(limit = 10) {
  return this.find({ status: 'active' })
    .sort({ 'stats.totalValue': -1 })
    .limit(limit)
    .select('name supplierId category stats rating');
};

// Static method to get suppliers with expiring contracts
supplierSchema.statics.getExpiringContracts = function(daysAhead = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return this.find({
    status: 'active',
    'contract.endDate': {
      $lte: futureDate,
      $gte: new Date()
    }
  }).sort('contract.endDate');
};

// Static method to get suppliers with expiring certifications
supplierSchema.statics.getExpiringCertifications = function(daysAhead = 60) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return this.find({
    status: 'active',
    'certifications.expiryDate': {
      $lte: futureDate,
      $gte: new Date()
    }
  }).sort('certifications.expiryDate');
};

// Ensure virtuals are included in JSON
supplierSchema.set('toJSON', { virtuals: true });
supplierSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Supplier', supplierSchema);
