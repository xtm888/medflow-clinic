const mongoose = require('mongoose');
const Counter = require('./Counter');

const optionSchema = new mongoose.Schema({
  value: {
    type: String,
    required: true
  },
  labelFr: {
    type: String,
    required: true
  },
  textFr: {
    type: String,
    required: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, { _id: false });

const doseTemplateSchema = new mongoose.Schema({
  templateId: {
    type: String,
    unique: true,
    sparse: true // Allow multiple null values
  },

  medicationForm: {
    type: String,
    required: true,
    unique: true, // Each medication form should have only one template
    enum: [
      'collyre',              // Eye drops
      'pommade_ophtalmique',  // Ophthalmic ointment
      'comprime',             // Tablet
      'gelule',               // Capsule
      'sirop',                // Syrup
      'solution_buvable',     // Oral solution
      'suppositoire',         // Suppository
      'injectable',           // Injectable
      'patch',                // Patch
      'creme',                // Cream
      'gel',                  // Gel
      'aerosol',              // Aerosol
      'poudre'                // Powder
    ]
  },

  // Dose options (e.g., "1 goutte", "2 comprimés")
  doseOptions: [optionSchema],

  // Posologie options (e.g., "dans chaque œil", "matin et soir")
  posologieOptions: [optionSchema],

  // Details options (e.g., "à jeun", "au coucher")
  detailsOptions: [optionSchema],

  // Duration options (e.g., "7 jours", "1 mois")
  durationOptions: [optionSchema],

  isActive: {
    type: Boolean,
    default: true
  },

  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }

}, {
  timestamps: true
});

// Indexes
doseTemplateSchema.index({ medicationForm: 1, isActive: 1 });

// Generate template ID
doseTemplateSchema.pre('save', async function(next) {
  if (!this.templateId) {
    const sequence = await Counter.getNextSequence('doseTemplate');
    this.templateId = `DOSE${String(sequence).padStart(6, '0')}`;
  }
  next();
});

// Static method to get template by form
doseTemplateSchema.statics.getByForm = async function(form) {
  return await this.findOne({ medicationForm: form, isActive: true });
};

module.exports = mongoose.model('DoseTemplate', doseTemplateSchema);
