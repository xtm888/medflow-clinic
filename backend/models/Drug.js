const mongoose = require('mongoose');

const drugSchema = new mongoose.Schema({
  // Basic drug information
  genericName: {
    type: String,
    required: true,
    index: true
  },

  genericNameFr: {
    type: String,
    index: true
  },

  brandNames: [{
    name: String,
    nameFr: String,
    manufacturer: String,
    country: String
  }],

  drugClass: {
    primary: String,
    secondary: [String],
    therapeutic: String,
    pharmacologic: String
  },

  category: {
    type: String,
    enum: ['antibiotic', 'analgesic', 'antihypertensive', 'antidiabetic', 'anticoagulant',
           'antidepressant', 'antipsychotic', 'anticonvulsant', 'antihistamine', 'antiviral',
           'antifungal', 'bronchodilator', 'corticosteroid', 'diuretic', 'proton-pump-inhibitor',
           'statin', 'nsaid', 'opioid', 'sedative', 'vitamin', 'supplement', 'vaccine',
           'ophthalmic', 'otic', 'topical', 'other']
  },

  // French categorization from Care Vision
  categoryFr: {
    id: String,
    name: String,
    nameEn: String
  },

  // Storage requirements
  storage: {
    temperature: {
      type: String,
      enum: ['room_temperature', 'refrigerated', 'frozen', 'controlled_room_temperature']
    },
    temperatureRange: String, // e.g., "2-8°C"
    lightProtection: Boolean,
    specialInstructions: String,
    shelfLife: String,
    afterOpening: String
  },

  // Formulations and strengths
  formulations: [{
    form: {
      type: String,
      enum: ['tablet', 'capsule', 'liquid', 'injection', 'patch', 'cream', 'ointment',
             'gel', 'drops', 'spray', 'inhaler', 'suppository', 'implant', 'powder']
    },
    strengths: [{
      value: Number,
      unit: String
    }],
    route: {
      type: String,
      enum: ['oral', 'intravenous', 'intramuscular', 'subcutaneous', 'topical',
             'ophthalmic', 'otic', 'nasal', 'inhalation', 'rectal', 'vaginal',
             'transdermal', 'sublingual', 'buccal']
    }
  }],

  // Dosing information
  dosing: {
    adult: {
      standard: {
        dose: String,
        frequency: String,
        maxDaily: String
      },
      indications: [{
        indication: String,
        dose: String,
        frequency: String,
        duration: String,
        notes: String
      }],
      adjustments: {
        elderly: String,
        obesity: String
      }
    },
    pediatric: {
      weightBased: {
        dose: String, // mg/kg
        frequency: String,
        maxDose: String
      },
      ageBased: [{
        ageRange: String,
        dose: String,
        frequency: String
      }]
    },
    renalImpairment: [{
      creatinineClearance: String,
      adjustment: String
    }],
    hepaticImpairment: [{
      severity: String,
      adjustment: String
    }]
  },

  // Contraindications and warnings
  contraindications: {
    absolute: [String],
    relative: [String]
  },

  warnings: {
    blackBox: String,
    precautions: [String],
    monitoring: [String]
  },

  // Drug interactions
  interactions: [{
    drug: String,
    severity: {
      type: String,
      enum: ['contraindicated', 'major', 'moderate', 'minor']
    },
    effect: String,
    mechanism: String,
    management: String
  }],

  foodInteractions: [{
    food: String,
    effect: String,
    recommendation: String
  }],

  // Side effects
  sideEffects: {
    common: [{
      effect: String,
      frequency: String // percentage or description
    }],
    serious: [{
      effect: String,
      frequency: String,
      action: String
    }],
    rare: [String]
  },

  // Pregnancy and lactation
  pregnancy: {
    category: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'X', 'N'] // FDA categories
    },
    description: String,
    recommendation: String
  },

  lactation: {
    compatible: Boolean,
    riskCategory: String,
    recommendation: String
  },

  // Pharmacokinetics
  pharmacokinetics: {
    absorption: {
      bioavailability: String,
      tmax: String,
      foodEffect: String
    },
    distribution: {
      vd: String,
      proteinBinding: String
    },
    metabolism: {
      primarySite: String,
      enzymes: [String],
      metabolites: [String]
    },
    elimination: {
      halfLife: String,
      clearance: String,
      route: [String]
    }
  },

  // Mechanism of action
  mechanismOfAction: String,

  // Ophthalmic-specific information
  ophthalmicUse: {
    indication: [String],
    dosing: {
      standard: String,
      pediatric: String
    },
    administration: String,
    preservativeFree: Boolean,
    contactLensCompatible: Boolean,
    storage: String,
    sideEffects: [String],
    contraindications: [String]
  },

  // Cost and availability
  costInfo: {
    genericAvailable: Boolean,
    averageWholesalePrice: Number,
    typicalRetailPrice: Number,
    insuranceTier: String
  },

  // Monitoring parameters
  monitoring: {
    baseline: [String],
    routine: [{
      parameter: String,
      frequency: String
    }],
    therapeutic: {
      targetLevel: String,
      timing: String
    }
  },

  // Patient counseling points
  patientCounseling: {
    administration: [String],
    storage: String,
    missedDose: String,
    sideEffectsToReport: [String],
    lifestyle: [String],
    whenToExpectResults: String
  },

  // References and approval
  references: [{
    source: String,
    url: String,
    lastUpdated: Date
  }],

  fdaApproval: {
    date: Date,
    indications: [String],
    rems: Boolean
  },

  controlledSubstance: {
    scheduled: Boolean,
    schedule: {
      type: String,
      enum: ['I', 'II', 'III', 'IV', 'V']
    }
  },

  // Metadata
  active: {
    type: Boolean,
    default: true
  },

  lastReviewed: Date,

  alternatives: [{
    drug: String,
    reason: String
  }],

  therapeuticEquivalents: [String]
}, {
  timestamps: true
});

// Indexes
drugSchema.index({ genericName: 'text', genericNameFr: 'text', 'brandNames.name': 'text', 'brandNames.nameFr': 'text' });
drugSchema.index({ category: 1 });
drugSchema.index({ 'categoryFr.id': 1 });
drugSchema.index({ 'drugClass.primary': 1 });
drugSchema.index({ active: 1 });

// Methods
drugSchema.methods.checkInteraction = function(otherDrugId) {
  return this.interactions.find(i => i.drug === otherDrugId);
};

drugSchema.methods.getDosingForIndication = function(indication) {
  return this.dosing.adult.indications.find(i =>
    i.indication.toLowerCase().includes(indication.toLowerCase())
  );
};

drugSchema.methods.getOphthalmicDosing = function() {
  if (this.ophthalmicUse && this.ophthalmicUse.dosing) {
    return this.ophthalmicUse.dosing;
  }
  return null;
};

// Static methods
drugSchema.statics.searchDrugs = async function(query, options = {}) {
  const searchOptions = {
    $or: [
      { genericName: new RegExp(query, 'i') },
      { 'brandNames.name': new RegExp(query, 'i') }
    ],
    active: true
  };

  if (options.category) {
    searchOptions.category = options.category;
  }

  if (options.ophthalmicOnly) {
    searchOptions['ophthalmicUse.indication'] = { $exists: true, $ne: [] };
  }

  return this.find(searchOptions)
    .limit(options.limit || 20)
    .select('genericName brandNames category drugClass');
};

drugSchema.statics.checkInteractions = async function(drugIds) {
  const drugs = await this.find({ _id: { $in: drugIds } });
  const interactions = [];

  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      const drug1 = drugs[i];
      const drug2 = drugs[j];

      // Check if drug1 has interaction with drug2
      const interaction = drug1.interactions.find(int =>
        int.drug.toLowerCase() === drug2.genericName.toLowerCase()
      );

      if (interaction) {
        interactions.push({
          drug1: drug1.genericName,
          drug2: drug2.genericName,
          severity: interaction.severity,
          effect: interaction.effect,
          management: interaction.management
        });
      }
    }
  }

  return interactions;
};

drugSchema.statics.getAlternatives = async function(drugId, reason) {
  const drug = await this.findById(drugId);
  if (!drug) return [];

  // Find drugs in same therapeutic class
  const alternatives = await this.find({
    'drugClass.therapeutic': drug.drugClass.therapeutic,
    _id: { $ne: drugId },
    active: true
  }).limit(5);

  return alternatives;
};

module.exports = mongoose.model('Drug', drugSchema);