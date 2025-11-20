const mongoose = require('mongoose');

const letterTemplateSchema = new mongoose.Schema({
  // Template Information
  name: {
    type: String,
    required: true
  },

  // Category
  category: {
    type: String,
    required: true,
    enum: [
      'CERTIFICAT',
      'CERTIFICAT_APTITUDE',
      'COMPTE_RENDU_OPERATOIRE',
      'COURRIER_CONFRERE',
      'ORDONNANCE_POSTOP',
      'CONSENTEMENT_CHIRURGIE',
      'RAPPEL_RDV',
      'RELANCE_PAIEMENT',
      'ECHOGRAPHIE',
      'CHAMP_VISUEL'
    ]
  },

  // Template Content (with {{variable}} placeholders)
  content: {
    type: String,
    required: true
  },

  // Variables for template substitution
  variables: [{
    name: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'select'],
      default: 'text'
    },
    options: [String], // For select type
    required: {
      type: Boolean,
      default: false
    }
  }],

  // Status
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
letterTemplateSchema.index({ name: 1 });
letterTemplateSchema.index({ category: 1, active: 1 });

const LetterTemplate = mongoose.model('LetterTemplate', letterTemplateSchema);

module.exports = LetterTemplate;
