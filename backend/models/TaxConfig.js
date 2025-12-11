const mongoose = require('mongoose');

const taxConfigSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: String,
  rate: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  applicableTo: [{
    type: String,
    enum: ['consultation', 'procedure', 'medication', 'imaging', 'laboratory', 'therapy', 'device', 'surgery', 'other', 'all']
  }],
  exemptions: [{
    category: String,
    reason: String
  }],
  compoundable: {
    type: Boolean,
    default: false
  },
  priority: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  },
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  effectiveTo: Date,
  region: {
    type: String,
    default: 'national'
  },
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

taxConfigSchema.index({ code: 1 }, { unique: true });
taxConfigSchema.index({ active: 1, effectiveFrom: 1 });

taxConfigSchema.statics.getActiveTaxes = function(category = 'all') {
  const now = new Date();
  return this.find({
    active: true,
    effectiveFrom: { $lte: now },
    $and: [
      // Check effective date is not expired
      {
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: now } }
        ]
      },
      // Check category applies
      {
        $or: [
          { applicableTo: 'all' },
          { applicableTo: category }
        ]
      }
    ]
  }).sort('priority');
};

taxConfigSchema.statics.calculateTax = async function(amount, category = 'all') {
  const taxes = await this.getActiveTaxes(category);
  let totalTax = 0;
  let taxBreakdown = [];

  for (const tax of taxes) {
    let taxAmount = 0;
    if (tax.type === 'percentage') {
      taxAmount = (amount * tax.rate) / 100;
    } else {
      taxAmount = tax.rate;
    }
    totalTax += taxAmount;
    taxBreakdown.push({
      code: tax.code,
      name: tax.name,
      rate: tax.rate,
      type: tax.type,
      amount: taxAmount
    });
  }

  return { totalTax, taxBreakdown };
};

module.exports = mongoose.model('TaxConfig', taxConfigSchema);
