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
  },

  // Soft delete support
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date,

  // Audit fields
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

// Indexes
clinicalTemplateSchema.index({ category: 1, name: 1 });
clinicalTemplateSchema.index({ name: 'text', value: 'text' });

module.exports = mongoose.model('ClinicalTemplate', clinicalTemplateSchema);
