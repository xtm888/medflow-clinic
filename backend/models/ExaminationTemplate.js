const mongoose = require('mongoose');

const examinationTemplateSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: [
      'TYPE REFRACTION',
      'OPHTALMOLOGIE',
      'ECHOGRAPHIE',
      'RENDEZ-VOUS POUR EXAMENS'
    ]
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  code: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  duration: {
    type: Number, // Duration in minutes
    default: 30
  },
  requiresAnesthesia: {
    type: Boolean,
    default: false
  },
  requiresDilation: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
examinationTemplateSchema.index({ name: 'text', description: 'text' });
examinationTemplateSchema.index({ category: 1, name: 1 });
examinationTemplateSchema.index({ code: 1 });

module.exports = mongoose.model('ExaminationTemplate', examinationTemplateSchema);
