const mongoose = require('mongoose');

const glassesOrderSchema = new mongoose.Schema({
  // Order identification
  orderNumber: {
    type: String,
    unique: true
  },

  // Links to related records
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OphthalmologyExam',
    required: true
  },
  prescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription'
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  orderedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Order type
  orderType: {
    type: String,
    enum: ['glasses', 'contact-lenses', 'both'],
    required: true
  },

  // Prescription data (from exam)
  prescriptionData: {
    od: {
      sphere: Number,
      cylinder: Number,
      axis: Number,
      add: Number,
      prism: Number,
      prismBase: String,
      visualAcuity: String
    },
    os: {
      sphere: Number,
      cylinder: Number,
      axis: Number,
      add: Number,
      prism: Number,
      prismBase: String,
      visualAcuity: String
    },
    pd: {
      binocular: Number,
      monocularOd: Number,
      monocularOs: Number
    }
  },

  // Glasses specifications
  glasses: {
    lensType: {
      type: String,
      enum: ['single-vision-distance', 'single-vision-near', 'bifocal', 'progressive', 'varifocal', 'two-pairs']
    },
    lensMaterial: {
      type: String,
      enum: ['cr39', 'polycarbonate', 'trivex', 'hi-index-1.60', 'hi-index-1.67', 'hi-index-1.74']
    },
    coatings: [{
      type: String,
      enum: ['anti-reflective', 'blue-light', 'photochromic', 'polarized', 'scratch-resistant', 'uv-protection', 'hydrophobic']
    }],
    tint: {
      type: String,
      enum: ['clear', 'gradient', 'solid', 'mirror']
    },
    tintColor: String,
    frame: {
      brand: String,
      model: String,
      color: String,
      size: String,
      material: String
    }
  },

  // Contact lens specifications
  contactLenses: {
    od: {
      brand: String,
      baseCurve: Number,
      diameter: Number,
      power: Number,
      cylinder: Number,
      axis: Number,
      color: String
    },
    os: {
      brand: String,
      baseCurve: Number,
      diameter: Number,
      power: Number,
      cylinder: Number,
      axis: Number,
      color: String
    },
    wearSchedule: {
      type: String,
      enum: ['daily', 'bi-weekly', 'monthly', 'extended']
    },
    boxQuantity: {
      od: { type: Number, default: 1 },
      os: { type: Number, default: 1 }
    }
  },

  // Order status workflow
  status: {
    type: String,
    enum: ['draft', 'confirmed', 'sent-to-lab', 'in-production', 'ready', 'delivered', 'cancelled'],
    default: 'draft'
  },

  // Priority
  priority: {
    type: String,
    enum: ['normal', 'urgent', 'rush'],
    default: 'normal'
  },

  // Timeline tracking
  timeline: {
    createdAt: { type: Date, default: Date.now },
    confirmedAt: Date,
    sentToLabAt: Date,
    productionStartedAt: Date,
    readyAt: Date,
    deliveredAt: Date,
    cancelledAt: Date
  },

  // Estimated delivery
  estimatedDelivery: Date,

  // Lab/Supplier information
  lab: {
    name: String,
    orderReference: String,
    contactInfo: String
  },

  // Pricing
  items: [{
    description: String,
    category: {
      type: String,
      enum: ['lens', 'frame', 'coating', 'contact-lens', 'accessory', 'service']
    },
    quantity: { type: Number, default: 1 },
    unitPrice: Number,
    discount: { type: Number, default: 0 },
    total: Number
  }],

  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  total: { type: Number, default: 0 },

  // Payment tracking
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid', 'refunded'],
    default: 'unpaid'
  },
  amountPaid: { type: Number, default: 0 },

  // Patient contact for delivery
  deliveryInfo: {
    method: {
      type: String,
      enum: ['pickup', 'delivery'],
      default: 'pickup'
    },
    address: String,
    phone: String,
    instructions: String
  },

  // Notes
  notes: {
    clinical: String,
    production: String,
    internal: String
  },

  // Notifications
  notifications: [{
    type: {
      type: String,
      enum: ['sms', 'email', 'call']
    },
    sentAt: Date,
    message: String,
    status: String
  }]

}, {
  timestamps: true
});

// Generate order number before saving
glassesOrderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('GlassesOrder').countDocuments();
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    this.orderNumber = `GO-${year}${month}-${(count + 1).toString().padStart(4, '0')}`;
  }

  // Calculate totals
  if (this.items && this.items.length > 0) {
    this.subtotal = this.items.reduce((sum, item) => sum + (item.total || 0), 0);
    this.total = this.subtotal - (this.discount || 0) + (this.tax || 0);
  }

  next();
});

// Update status timestamps
glassesOrderSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    const now = new Date();
    switch (this.status) {
      case 'confirmed':
        this.timeline.confirmedAt = now;
        break;
      case 'sent-to-lab':
        this.timeline.sentToLabAt = now;
        break;
      case 'in-production':
        this.timeline.productionStartedAt = now;
        break;
      case 'ready':
        this.timeline.readyAt = now;
        break;
      case 'delivered':
        this.timeline.deliveredAt = now;
        break;
      case 'cancelled':
        this.timeline.cancelledAt = now;
        break;
    }
  }
  next();
});

// Virtual for balance due
glassesOrderSchema.virtual('balanceDue').get(function() {
  return this.total - this.amountPaid;
});

// Index for efficient queries
glassesOrderSchema.index({ patient: 1, createdAt: -1 });
glassesOrderSchema.index({ exam: 1 });
glassesOrderSchema.index({ status: 1 });
glassesOrderSchema.index({ orderNumber: 1 });

module.exports = mongoose.model('GlassesOrder', glassesOrderSchema);
