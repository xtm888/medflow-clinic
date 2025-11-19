const mongoose = require('mongoose');

const pathologyTemplateSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: [
      'Inspect/OCME',
      'LAF',
      'MOTIF DE CONSULTATION',
      'GONIOSCOPIE',
      'AV/RPM',
      'Cataracte',
      'champ visuel',
      'Chirurgie de cataracte',
      'Conjonctivite',
      'Cornée',
      'Diabète',
      'Glaucome',
      'HTA',
      'Normal',
      'Paupière',
      'Rétine Centrale',
      'Rétine Périphérique',
      'Traumatologie',
      'Uvéite'
    ]
  },
  subcategory: {
    type: String,
    trim: true // e.g., "Conjonctive", "Cornée", "Cristallin", etc.
  },
  type: {
    type: String,
    required: true,
    enum: ['symptom', 'description', 'finding']
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
  laterality: {
    type: [String],
    enum: ['OD', 'OG', 'ODG', 'Droite', 'Gauche', 'Bilatéral'],
    default: []
  },
  severity: {
    type: [String],
    enum: ['-', '+/-', '+', '++', '+++', '++++', '0'],
    default: []
  },
  location: {
    type: [String],
    enum: ['Nasal', 'Temporal', 'Inférieur', 'Supérieur', 'Central', 'Périphérique'],
    default: []
  },
  clockPosition: {
    type: [String],
    enum: ['1h', '2h', '3h', '4h', '5h', '6h', '7h', '8h', '9h', '10h', '11h', '12h', 'toute la périph'],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
pathologyTemplateSchema.index({ category: 1, subcategory: 1, type: 1 });
pathologyTemplateSchema.index({ name: 'text', value: 'text' });
pathologyTemplateSchema.index({ isActive: 1 });

module.exports = mongoose.model('PathologyTemplate', pathologyTemplateSchema);
