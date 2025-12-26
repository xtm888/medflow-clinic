const mongoose = require('mongoose');

const medicationTemplateSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: [
      'A.I.N.S GENERAUX + CORTICOIDES',
      'A.I.N.S LOCAUX',
      'ANESTHESIE LOCALES',
      'ANTIPALUDIQUES',
      'ANTI SPASMODIQUES',
      'ANTI ALLERGIQUES',
      'ANTI HYPERTENSEURS',
      'ANTI MYCOSIQUES',
      'ANTISEPT SANS VASOCONS',
      'ANTITUSSIF',
      'ANTI VIRAUX',
      'ANTIBIOTIQUE LOCAUX',
      'ANTIBIOTIQUE GENERAUX',
      'ANTI CATARACTE',
      'ANTI GLAUCOMATEUX',
      'ANTI HISTAMINIQUES GENERAUX',
      'CICATRISANTS',
      'CORTICOIDES + ANTIBIOTIQUES',
      'CORTICOIDES LOCAUX',
      'CREMES DERMIQUES',
      'DECONGESTIONNANT',
      'DIVERS OPHA',
      'GOUTTES NASALES',
      'HYPO CHOLESTEROLEMIANTS',
      'LARMES ARTIFICIELLES',
      'LARMES LOTIONS CONTACTO',
      'LAXATIFS ET ANTI DIARRHEIQUES',
      'MAGNESIUM',
      'MYDRIATIQUES',
      'OVULES VAGINALES',
      'PANSEMENTS GASTRIQUES',
      'POTASSIUM',
      'SEDATIF',
      'VASCULOTROPES',
      'VERMIFUGES',
      'VITAMINES'
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
  form: {
    type: String, // cp, collyre, pom opht, sol buv, inj, etc.
    trim: true
  },
  dosage: {
    type: String, // 500 mg, 0.5%, etc.
    trim: true
  },
  packaging: {
    type: String, // fl 5ml, tube 5g, boite de 20, etc.
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  searchTerms: [{
    type: String,
    trim: true
  }],

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

// Indexes for fast searching
medicationTemplateSchema.index({ name: 'text', description: 'text', searchTerms: 'text' });
medicationTemplateSchema.index({ category: 1, name: 1 });
medicationTemplateSchema.index({ isActive: 1 });

module.exports = mongoose.model('MedicationTemplate', medicationTemplateSchema);
