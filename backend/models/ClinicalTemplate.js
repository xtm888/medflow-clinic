const mongoose = require('mongoose');

const clinicalTemplateSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: [
      'ANAMNESE MOBILE',
      'DOMINANTE',
      'NOTE',
      'OCULAIRE DESCRIPTION'
    ]
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  value: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
clinicalTemplateSchema.index({ category: 1, name: 1 });
clinicalTemplateSchema.index({ name: 'text', value: 'text' });

module.exports = mongoose.model('ClinicalTemplate', clinicalTemplateSchema);
