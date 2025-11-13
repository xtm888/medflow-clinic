const mongoose = require('mongoose');

const insuranceProviderSchema = new mongoose.Schema({
  // Basic provider information
  name: {
    type: String,
    required: true,
    unique: true
  },

  code: {
    type: String,
    required: true,
    unique: true
  },

  type: {
    type: String,
    enum: ['private', 'government', 'hmo', 'ppo', 'pos', 'epo', 'medicaid', 'medicare'],
    required: true
  },

  // Contact information
  contact: {
    phone: {
      main: String,
      claims: String,
      authorization: String,
      provider: String
    },
    fax: String,
    email: {
      general: String,
      claims: String,
      authorization: String
    },
    website: String,
    portal: String
  },

  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },

  // Insurance plans
  plans: [{
    planId: {
      type: String,
      required: true
    },
    planName: {
      type: String,
      required: true
    },
    planType: {
      type: String,
      enum: ['individual', 'family', 'group', 'medicare-advantage', 'medicaid-managed']
    },
    tier: {
      type: String,
      enum: ['bronze', 'silver', 'gold', 'platinum', 'basic', 'premium']
    },

    // Coverage details
    coverage: {
      // Medical coverage
      medical: {
        primaryCare: {
          copay: Number,
          coinsurance: Number,
          deductibleApplies: Boolean
        },
        specialist: {
          copay: Number,
          coinsurance: Number,
          requiresReferral: Boolean,
          deductibleApplies: Boolean
        },
        emergency: {
          copay: Number,
          coinsurance: Number
        },
        urgentCare: {
          copay: Number,
          coinsurance: Number
        },
        preventiveCare: {
          covered: Boolean,
          copay: Number,
          frequency: String
        }
      },

      // Vision coverage
      vision: {
        included: Boolean,
        examCopay: Number,
        examFrequency: String,
        materialsAllowance: Number,
        materialsFrequency: String,
        contactLensAllowance: Number,
        frames: {
          allowance: Number,
          frequency: String,
          inNetworkDiscount: Number
        },
        lenses: {
          singleVision: Number,
          bifocal: Number,
          trifocal: Number,
          progressive: Number,
          coatings: {
            antiReflective: Number,
            scratch: Number,
            uv: Number,
            transition: Number
          }
        }
      },

      // Pharmacy coverage
      pharmacy: {
        tiers: [{
          tier: Number,
          name: String,
          copay: {
            retail30: Number,
            retail90: Number,
            mailOrder90: Number
          },
          coinsurance: Number
        }],
        deductible: Number,
        outOfPocketMax: Number,
        preferredPharmacies: [String]
      },

      // Lab and imaging
      laboratory: {
        copay: Number,
        coinsurance: Number,
        preauthorizationRequired: Boolean
      },
      imaging: {
        xray: {
          copay: Number,
          coinsurance: Number
        },
        mri: {
          copay: Number,
          coinsurance: Number,
          preauthorizationRequired: Boolean
        },
        ct: {
          copay: Number,
          coinsurance: Number,
          preauthorizationRequired: Boolean
        }
      },

      // Procedures
      procedures: {
        preauthorizationRequired: [String],
        coveredProcedures: [{
          code: String,
          description: String,
          coverage: Number,
          limitations: String
        }]
      }
    },

    // Financial details
    financials: {
      deductible: {
        individual: Number,
        family: Number,
        met: Number
      },
      outOfPocketMax: {
        individual: Number,
        family: Number,
        met: Number
      },
      copayMax: Number,
      lifetimeMax: Number
    },

    // Network information
    network: {
      type: String,
      providers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }],
      facilities: [String]
    },

    // Effective dates
    effectiveDates: {
      start: Date,
      end: Date
    },

    active: {
      type: Boolean,
      default: true
    }
  }],

  // Authorization requirements
  authorizationRequirements: {
    procedures: [{
      cptCode: String,
      description: String,
      requiresAuth: Boolean,
      validityPeriod: Number, // days
      documentation: [String]
    }],
    medications: [{
      drug: String,
      requiresAuth: Boolean,
      criteria: String,
      alternatives: [String]
    }],
    specialists: [{
      specialty: String,
      requiresReferral: Boolean,
      requiresAuth: Boolean
    }],
    dme: [{
      item: String,
      requiresAuth: Boolean,
      documentation: [String]
    }]
  },

  // Claim submission
  claimSubmission: {
    electronic: {
      enabled: Boolean,
      clearinghouse: String,
      payerId: String,
      submitterInfo: {
        id: String,
        name: String
      }
    },
    paper: {
      address: {
        street: String,
        city: String,
        state: String,
        postalCode: String
      },
      forms: [String]
    },
    timeLimits: {
      standard: Number, // days
      corrected: Number,
      appeal: Number
    }
  },

  // API integration
  apiIntegration: {
    enabled: Boolean,
    baseUrl: String,
    authType: {
      type: String,
      enum: ['oauth2', 'api-key', 'basic', 'certificate']
    },
    credentials: {
      clientId: String,
      clientSecret: String,
      apiKey: String
    },
    endpoints: {
      eligibility: String,
      authorization: String,
      claimStatus: String,
      benefits: String,
      formulary: String
    },
    rateLimit: {
      requests: Number,
      period: String
    }
  },

  // Fee schedules
  feeSchedules: [{
    year: Number,
    specialty: String,
    fees: [{
      code: String,
      description: String,
      allowedAmount: Number,
      effectiveDate: Date
    }]
  }],

  // Contract details
  contracts: [{
    contractId: String,
    startDate: Date,
    endDate: Date,
    terms: String,
    reimbursementRates: mongoose.Schema.Types.Mixed,
    status: {
      type: String,
      enum: ['active', 'pending', 'expired', 'terminated']
    }
  }],

  // Performance metrics
  metrics: {
    averageReimbursementTime: Number, // days
    denialRate: Number, // percentage
    appealSuccessRate: Number,
    averagePaymentAmount: Number,
    patientSatisfaction: Number
  },

  // Notes and documentation
  notes: [{
    date: Date,
    subject: String,
    content: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'terminated'],
    default: 'active'
  },

  // Metadata
  lastUpdated: Date,
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
insuranceProviderSchema.index({ name: 1 });
insuranceProviderSchema.index({ code: 1 });
insuranceProviderSchema.index({ status: 1 });
insuranceProviderSchema.index({ 'plans.planId': 1 });

// Methods
insuranceProviderSchema.methods.getPlan = function(planId) {
  return this.plans.find(p => p.planId === planId);
};

insuranceProviderSchema.methods.checkCoverage = function(planId, serviceType, serviceCode) {
  const plan = this.getPlan(planId);
  if (!plan) return null;

  // Check specific coverage based on service type
  // This would be expanded based on actual implementation needs
  return plan.coverage;
};

insuranceProviderSchema.methods.requiresAuthorization = function(type, code) {
  if (type === 'procedure') {
    const proc = this.authorizationRequirements.procedures.find(p => p.cptCode === code);
    return proc ? proc.requiresAuth : false;
  } else if (type === 'medication') {
    const med = this.authorizationRequirements.medications.find(m => m.drug === code);
    return med ? med.requiresAuth : false;
  }
  return false;
};

// Static methods
insuranceProviderSchema.statics.verifyEligibility = async function(providerId, planId, patientInfo) {
  const provider = await this.findById(providerId);
  if (!provider || !provider.apiIntegration.enabled) {
    return { eligible: false, reason: 'Provider not found or API not enabled' };
  }

  // This would make actual API call to insurance provider
  // For now, return mock response
  return {
    eligible: true,
    effectiveDate: new Date(),
    terminationDate: null,
    copay: 25,
    deductible: { amount: 1000, met: 500 },
    outOfPocketMax: { amount: 5000, met: 1000 }
  };
};

insuranceProviderSchema.statics.submitClaim = async function(providerId, claimData) {
  const provider = await this.findById(providerId);
  if (!provider) {
    throw new Error('Insurance provider not found');
  }

  // This would submit actual claim
  // For now, return mock response
  return {
    claimId: `CLM${Date.now()}`,
    status: 'submitted',
    submittedAt: new Date(),
    trackingNumber: `TRK${Date.now()}`
  };
};

module.exports = mongoose.model('InsuranceProvider', insuranceProviderSchema);