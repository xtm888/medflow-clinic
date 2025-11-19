const mongoose = require('mongoose');

const laboratoryTemplateSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: [
      'CHECK UP PROMO',
      'HEMOGRAMME',
      'CHIRURGIE OPHTALMOLOGIQUE',
      'FONCTION HEPATO-RENALE',
      'PROFIL DIABETIQUE A',
      'PROFIL DIABETIQUE B',
      'PROFIL INFECTIEUX',
      'PROFIL LIPIDIQUE',
      'BACTERIOLOGIE',
      'BIOCHIMIE FONCTION HEPATIQUE',
      'BIOCHIMIE FONCTION RENALE',
      'BIOCHIMIE LIPIDES',
      'BIOCHIMIE MYOCARDE',
      'BIOCHIMIE PANCREAS',
      'BIOCHIMIE TEST INFLAMMATOIRE',
      'BIOCHIMIE URINAIRE',
      'DIVERS',
      'HEMATOLOGIE',
      'HORMONOLOGIE',
      'IMMUNO-SEROLOGIE',
      'PARASITOLOGIE',
      'SEDIMENT URINAIRE',
      'SEROLOGIE',
      'SEROLOGIE VIRALE',
      'COAGULATION',
      'PROTEINES',
      'IONOGRAMME SANGUIN',
      'REINS',
      'FOIE',
      'PANCREAS',
      'THYROIDE',
      'SEROLOGIE AUTO IMMUNE',
      'DIABETE',
      'COPRO-PARASITOLOGIE',
      'MARQUEURS TUMORAUX',
      'MARQUEURS CARDIAQUES',
      'URINES',
      'URINES DE 24',
      'PROFIL UVEITE'
    ]
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  description: {
    type: String,
    trim: true
  },
  specimen: {
    type: String,
    enum: ['Sang', 'Urine', 'Selles', 'LCR', 'Prélèvement', 'Autre'],
    default: 'Sang'
  },
  normalRange: {
    type: String,
    trim: true
  },
  unit: {
    type: String,
    trim: true
  },
  turnaroundTime: {
    type: Number, // in hours
    default: 24
  },
  price: {
    type: Number,
    default: 0
  },
  isProfile: {
    type: Boolean,
    default: false // true if this is a collection of tests (e.g., CHECK UP PROMO)
  },
  profileTests: [{
    type: mongoose.Schema.ObjectId,
    ref: 'LaboratoryTemplate'
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
laboratoryTemplateSchema.index({ name: 'text', description: 'text' });
laboratoryTemplateSchema.index({ category: 1, name: 1 });
laboratoryTemplateSchema.index({ code: 1 });
laboratoryTemplateSchema.index({ isProfile: 1 });

module.exports = mongoose.model('LaboratoryTemplate', laboratoryTemplateSchema);
