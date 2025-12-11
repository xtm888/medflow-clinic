const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Service name is required'],
    trim: true
  },
  code: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['consultation', 'procedure', 'examination', 'imaging', 'laboratory', 'therapy', 'surgery', 'other'],
    required: true
  },
  department: {
    type: String,
    enum: ['general', 'ophthalmology', 'orthoptics', 'pharmacy', 'laboratory', 'imaging'],
    default: 'general'
  },
  basePrice: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    enum: ['CDF', 'USD', 'EUR'],
    default: 'CDF'
  },
  duration: {
    type: Number, // Duration in minutes
    default: 30
  },
  requiresEquipment: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  taxable: {
    type: Boolean,
    default: false
  },
  taxRate: {
    type: Number,
    default: 0
  },
  insuranceCoverage: {
    covered: {
      type: Boolean,
      default: true
    },
    coveragePercentage: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    requiresPreAuth: {
      type: Boolean,
      default: false
    }
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes
serviceSchema.index({ name: 'text', description: 'text' });
serviceSchema.index({ category: 1, department: 1 });
serviceSchema.index({ isActive: 1 });
serviceSchema.index({ code: 1 });

// Virtual for formatted price
serviceSchema.virtual('formattedPrice').get(function() {
  return `${this.basePrice.toLocaleString()} ${this.currency}`;
});

// Static method to get services by category
serviceSchema.statics.getByCategory = async function(category) {
  return this.find({ category, isActive: true }).sort('name');
};

// Static method to get services by department
serviceSchema.statics.getByDepartment = async function(department) {
  return this.find({ department, isActive: true }).sort('name');
};

module.exports = mongoose.model('Service', serviceSchema);
