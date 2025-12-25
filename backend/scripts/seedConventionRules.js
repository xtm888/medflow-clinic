/**
 * Seed Convention Rules
 *
 * Configures all convention-specific billing rules based on actual business requirements:
 * - Coverage percentages
 * - Approval requirements
 * - Package deals ($65 consultation)
 * - Discounts (LISUNGI 15%, TEMOINS DE JEHOVAH 25%)
 * - Category exclusions (AAC optical-only, CIGNA/GGA no optical)
 * - Auto-approval thresholds (ACTIVA/CICR under $100)
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedConventionRules.js');

const Company = require('../models/Company');

// Standard categories for full coverage with surgery/optical approval
const STANDARD_FULL_COVERAGE_CATEGORIES = [
  { category: 'consultation', coveragePercentage: 100, requiresApproval: false, notCovered: false },
  { category: 'examination', coveragePercentage: 100, requiresApproval: false, notCovered: false },
  { category: 'procedure', coveragePercentage: 100, requiresApproval: false, notCovered: false },
  { category: 'imaging', coveragePercentage: 100, requiresApproval: false, notCovered: false },
  { category: 'laboratory', coveragePercentage: 100, requiresApproval: false, notCovered: false },
  { category: 'medication', coveragePercentage: 100, requiresApproval: false, notCovered: false },
  { category: 'surgery', coveragePercentage: 100, requiresApproval: true, notCovered: false },
  { category: 'optical', coveragePercentage: 100, requiresApproval: true, notCovered: false }
];

// $65 Consultation Package - BRALIMA version (includes non-dilated fundus, no retinal photography)
const PACKAGE_65_BRALIMA = {
  name: 'Forfait Consultation Ophtalmo',
  code: 'PKG-CONSULT-65',
  price: 65,
  currency: 'USD',
  includedActs: [
    { actCode: 'CONSULT', actName: 'Consultation' },
    { actCode: 'REFRACTO', actName: 'Réfractométrie' },
    { actCode: 'TONO', actName: 'Tonométrie' },
    { actCode: 'BIOMICRO', actName: 'Biomicroscopie' },
    { actCode: 'FOND-ND', actName: 'Fond d\'oeil non dilaté' },
    { actCode: 'FLUORO', actName: 'Test fluorescéine' }
  ],
  active: true
};

// $65 Consultation Package - MSO KINSHASA & LISUNGI version (includes keratometry & retinal photography)
const PACKAGE_65_MSO_LISUNGI = {
  name: 'Forfait Consultation Ophtalmo',
  code: 'PKG-CONSULT-65',
  price: 65,
  currency: 'USD',
  includedActs: [
    { actCode: 'CONSULT', actName: 'Consultation' },
    { actCode: 'REFRACTO', actName: 'Réfractométrie/Réfraction' },
    { actCode: 'TONO', actName: 'Tonométrie' },
    { actCode: 'FLUORO', actName: 'Test fluorescéine' },
    { actCode: 'KERATO', actName: 'Kératométrie' },
    { actCode: 'RETINO', actName: 'Rétinographie' }
  ],
  active: true
};

// Convention Rules Configuration
const CONVENTION_RULES = {
  // ============================================
  // 1. AAC - OPTICAL ONLY
  // ============================================
  'AAC': {
    defaultCoverage: { percentage: 100 },
    coveredCategories: [
      { category: 'consultation', notCovered: true, coveragePercentage: 0 },
      { category: 'examination', notCovered: true, coveragePercentage: 0 },
      { category: 'procedure', notCovered: true, coveragePercentage: 0 },
      { category: 'imaging', notCovered: true, coveragePercentage: 0 },
      { category: 'laboratory', notCovered: true, coveragePercentage: 0 },
      { category: 'medication', notCovered: true, coveragePercentage: 0 },
      { category: 'surgery', notCovered: true, coveragePercentage: 0 },
      { category: 'optical', notCovered: false, coveragePercentage: 100, requiresApproval: false, notes: 'Selon grille tarifaire spécifique' }
    ],
    approvalRules: {
      requiresMedicalReport: [],
      notes: 'Optical uniquement selon grille. Ordonnance pré-validée requise.'
    }
  },

  // ============================================
  // 2. ACTIVA (all plans) - Auto under $100
  // ============================================
  'ACTIVA': {
    defaultCoverage: { percentage: 100 },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 100, requiresApproval: false },
      { category: 'examination', coveragePercentage: 100, requiresApproval: false },
      { category: 'procedure', coveragePercentage: 100, requiresApproval: false }, // Auto under $100 handled by autoApproveUnderAmount
      { category: 'imaging', coveragePercentage: 100, requiresApproval: false },
      { category: 'laboratory', coveragePercentage: 100, requiresApproval: false },
      { category: 'medication', coveragePercentage: 100, requiresApproval: false },
      { category: 'surgery', coveragePercentage: 100, requiresApproval: true },
      { category: 'optical', coveragePercentage: 100, requiresApproval: true }
    ],
    approvalRules: {
      autoApproveUnderAmount: 100,
      autoApproveUnderCurrency: 'USD',
      notes: 'Auto-approve under $100. Surgery and optical always require approval.'
    }
  },

  // ============================================
  // 3. CICR - Same as ACTIVA
  // ============================================
  'CICR CROIX ROUGE': {
    defaultCoverage: { percentage: 100 },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 100, requiresApproval: false },
      { category: 'examination', coveragePercentage: 100, requiresApproval: false },
      { category: 'procedure', coveragePercentage: 100, requiresApproval: false },
      { category: 'imaging', coveragePercentage: 100, requiresApproval: false },
      { category: 'laboratory', coveragePercentage: 100, requiresApproval: false },
      { category: 'medication', coveragePercentage: 100, requiresApproval: false },
      { category: 'surgery', coveragePercentage: 100, requiresApproval: true },
      { category: 'optical', coveragePercentage: 100, requiresApproval: true }
    ],
    approvalRules: {
      autoApproveUnderAmount: 100,
      autoApproveUnderCurrency: 'USD',
      notes: 'Auto-approve under $100. Surgery and optical always require approval.'
    }
  },

  // ============================================
  // 4. ASCOMA/PACTILIS - Most restrictive
  // Only consultation and pharmacy auto
  // ============================================
  'PACTILIS': {
    defaultCoverage: { percentage: 100 },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 100, requiresApproval: false },
      { category: 'examination', coveragePercentage: 100, requiresApproval: true },
      { category: 'procedure', coveragePercentage: 100, requiresApproval: true },
      { category: 'imaging', coveragePercentage: 100, requiresApproval: true },
      { category: 'laboratory', coveragePercentage: 100, requiresApproval: true },
      { category: 'medication', coveragePercentage: 100, requiresApproval: false }, // Pharmacy auto
      { category: 'surgery', coveragePercentage: 100, requiresApproval: true },
      { category: 'optical', coveragePercentage: 100, requiresApproval: true }
    ],
    approvalRules: {
      notes: 'Only consultation and pharmacy automatic. All other services require approval from conventions office.'
    }
  },

  // ============================================
  // 5. MSO KINSHASA - Only $65 package auto
  // ============================================
  'MSO KINSHASA': {
    defaultCoverage: { percentage: 100 },
    coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES,
    packageDeals: [PACKAGE_65_MSO_LISUNGI],
    approvalRules: {
      notes: 'Only $65 consultation package automatic. All services beyond package require validation.'
    }
  },

  // ============================================
  // 6. BRALIMA - Full coverage + $65 package
  // ============================================
  'BRALIMA': {
    defaultCoverage: { percentage: 100 },
    coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES,
    packageDeals: [PACKAGE_65_BRALIMA],
    approvalRules: {
      notes: '$65 consultation package included. Surgery and optical require approval.'
    }
  },

  // ============================================
  // 7. LISUNGI - Full + $65 package + 15% surgery discount
  // ============================================
  'LISUNGI': {
    defaultCoverage: { percentage: 100 },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 100, requiresApproval: false },
      { category: 'examination', coveragePercentage: 100, requiresApproval: false },
      { category: 'procedure', coveragePercentage: 100, requiresApproval: false },
      { category: 'imaging', coveragePercentage: 100, requiresApproval: false },
      { category: 'laboratory', coveragePercentage: 100, requiresApproval: false },
      { category: 'medication', coveragePercentage: 100, requiresApproval: false },
      { category: 'surgery', coveragePercentage: 100, requiresApproval: true, additionalDiscount: 15 },
      { category: 'optical', coveragePercentage: 100, requiresApproval: true }
    ],
    packageDeals: [PACKAGE_65_MSO_LISUNGI],
    approvalRules: {
      globalDiscount: {
        percentage: 15,
        onlyCategories: ['surgery'] // 15% discount ONLY on surgery
      },
      notes: '$65 consultation package included. 15% discount on all surgical procedures.'
    }
  },

  // ============================================
  // 8. TEMOINS DE JEHOVAH - 25% discount non-surgery
  // ============================================
  'TÉMOINS DE JÉHOVAH': {
    defaultCoverage: { percentage: 100 },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 100, requiresApproval: false, additionalDiscount: 25 },
      { category: 'examination', coveragePercentage: 100, requiresApproval: false, additionalDiscount: 25 },
      { category: 'procedure', coveragePercentage: 100, requiresApproval: false, additionalDiscount: 25 },
      { category: 'imaging', coveragePercentage: 100, requiresApproval: false, additionalDiscount: 25 },
      { category: 'laboratory', coveragePercentage: 100, requiresApproval: false, additionalDiscount: 25 },
      { category: 'medication', coveragePercentage: 100, requiresApproval: false, additionalDiscount: 25 },
      { category: 'surgery', coveragePercentage: 100, requiresApproval: true, additionalDiscount: 0 }, // No discount on surgery
      { category: 'optical', coveragePercentage: 100, requiresApproval: true, additionalDiscount: 0 }  // No discount on optical
    ],
    approvalRules: {
      globalDiscount: {
        percentage: 25,
        excludeCategories: ['surgery', 'optical']
      },
      notes: '25% discount on all non-surgical procedures. Surgery and optical require validation with no discount.'
    }
  },

  // Also update the alternate spelling
  'TEMOIN DE JEHOVAH': {
    defaultCoverage: { percentage: 100 },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 100, requiresApproval: false, additionalDiscount: 25 },
      { category: 'examination', coveragePercentage: 100, requiresApproval: false, additionalDiscount: 25 },
      { category: 'procedure', coveragePercentage: 100, requiresApproval: false, additionalDiscount: 25 },
      { category: 'imaging', coveragePercentage: 100, requiresApproval: false, additionalDiscount: 25 },
      { category: 'laboratory', coveragePercentage: 100, requiresApproval: false, additionalDiscount: 25 },
      { category: 'medication', coveragePercentage: 100, requiresApproval: false, additionalDiscount: 25 },
      { category: 'surgery', coveragePercentage: 100, requiresApproval: true, additionalDiscount: 0 },
      { category: 'optical', coveragePercentage: 100, requiresApproval: true, additionalDiscount: 0 }
    ],
    approvalRules: {
      globalDiscount: {
        percentage: 25,
        excludeCategories: ['surgery', 'optical']
      },
      notes: '25% discount on all non-surgical procedures. Surgery and optical require validation with no discount.'
    }
  },

  // ============================================
  // 9. CIGNA - Excludes optical, tiered coverage
  // ============================================
  'CIGNA 100%': {
    defaultCoverage: { percentage: 100 },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 100, requiresApproval: false },
      { category: 'examination', coveragePercentage: 100, requiresApproval: false },
      { category: 'procedure', coveragePercentage: 100, requiresApproval: false },
      { category: 'imaging', coveragePercentage: 100, requiresApproval: false },
      { category: 'laboratory', coveragePercentage: 100, requiresApproval: false },
      { category: 'medication', coveragePercentage: 100, requiresApproval: false },
      { category: 'surgery', coveragePercentage: 100, requiresApproval: true },
      { category: 'optical', notCovered: true, coveragePercentage: 0 } // EXCLUDED
    ],
    approvalRules: {
      notes: 'Full coverage (100%). Optical services EXCLUDED. Surgery requires approval.'
    }
  },

  'CIGNA 80%': {
    defaultCoverage: { percentage: 80 },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 80, requiresApproval: false },
      { category: 'examination', coveragePercentage: 80, requiresApproval: false },
      { category: 'procedure', coveragePercentage: 80, requiresApproval: false },
      { category: 'imaging', coveragePercentage: 80, requiresApproval: false },
      { category: 'laboratory', coveragePercentage: 80, requiresApproval: false },
      { category: 'medication', coveragePercentage: 80, requiresApproval: false },
      { category: 'surgery', coveragePercentage: 80, requiresApproval: true },
      { category: 'optical', notCovered: true, coveragePercentage: 0 } // EXCLUDED
    ],
    approvalRules: {
      notes: '80% coverage - patient pays 20% cash. Optical services EXCLUDED. Surgery requires approval.'
    }
  },

  'CIGNA': {
    defaultCoverage: { percentage: 100 },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 100, requiresApproval: false },
      { category: 'examination', coveragePercentage: 100, requiresApproval: false },
      { category: 'procedure', coveragePercentage: 100, requiresApproval: false },
      { category: 'imaging', coveragePercentage: 100, requiresApproval: false },
      { category: 'laboratory', coveragePercentage: 100, requiresApproval: false },
      { category: 'medication', coveragePercentage: 100, requiresApproval: false },
      { category: 'surgery', coveragePercentage: 100, requiresApproval: true },
      { category: 'optical', notCovered: true, coveragePercentage: 0 }
    ],
    approvalRules: {
      notes: 'Default CIGNA - Full coverage. Optical EXCLUDED. Surgery requires approval.'
    }
  },

  // ============================================
  // 10. GGA - Excludes optical, tiered coverage
  // ============================================
  'GGA 100%': {
    defaultCoverage: { percentage: 100 },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 100, requiresApproval: false },
      { category: 'examination', coveragePercentage: 100, requiresApproval: false },
      { category: 'procedure', coveragePercentage: 100, requiresApproval: false },
      { category: 'imaging', coveragePercentage: 100, requiresApproval: false },
      { category: 'laboratory', coveragePercentage: 100, requiresApproval: false },
      { category: 'medication', coveragePercentage: 100, requiresApproval: false },
      { category: 'surgery', coveragePercentage: 100, requiresApproval: true },
      { category: 'optical', notCovered: true, coveragePercentage: 0 }
    ],
    approvalRules: {
      notes: 'Full coverage (100%). Optical services EXCLUDED. Surgery requires approval.'
    }
  },

  'GGA 90%': {
    defaultCoverage: { percentage: 90 },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 90, requiresApproval: false },
      { category: 'examination', coveragePercentage: 90, requiresApproval: false },
      { category: 'procedure', coveragePercentage: 90, requiresApproval: false },
      { category: 'imaging', coveragePercentage: 90, requiresApproval: false },
      { category: 'laboratory', coveragePercentage: 90, requiresApproval: false },
      { category: 'medication', coveragePercentage: 90, requiresApproval: false },
      { category: 'surgery', coveragePercentage: 90, requiresApproval: true },
      { category: 'optical', notCovered: true, coveragePercentage: 0 }
    ],
    approvalRules: {
      notes: '90% coverage - patient pays 10% cash. Optical services EXCLUDED. Surgery requires approval.'
    }
  },

  'GGA 80%': {
    defaultCoverage: { percentage: 80 },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 80, requiresApproval: false },
      { category: 'examination', coveragePercentage: 80, requiresApproval: false },
      { category: 'procedure', coveragePercentage: 80, requiresApproval: false },
      { category: 'imaging', coveragePercentage: 80, requiresApproval: false },
      { category: 'laboratory', coveragePercentage: 80, requiresApproval: false },
      { category: 'medication', coveragePercentage: 80, requiresApproval: false },
      { category: 'surgery', coveragePercentage: 80, requiresApproval: true },
      { category: 'optical', notCovered: true, coveragePercentage: 0 }
    ],
    approvalRules: {
      notes: '80% coverage - patient pays 20% cash. Optical services EXCLUDED. Surgery requires approval.'
    }
  },

  'GGA': {
    defaultCoverage: { percentage: 100 },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 100, requiresApproval: false },
      { category: 'examination', coveragePercentage: 100, requiresApproval: false },
      { category: 'procedure', coveragePercentage: 100, requiresApproval: false },
      { category: 'imaging', coveragePercentage: 100, requiresApproval: false },
      { category: 'laboratory', coveragePercentage: 100, requiresApproval: false },
      { category: 'medication', coveragePercentage: 100, requiresApproval: false },
      { category: 'surgery', coveragePercentage: 100, requiresApproval: true },
      { category: 'optical', notCovered: true, coveragePercentage: 0 }
    ],
    approvalRules: {
      notes: 'Default GGA - Full coverage. Optical EXCLUDED. Surgery requires approval.'
    }
  },

  // ============================================
  // 11. BCC - Medical report required for surgery
  // ============================================
  'BANQUE CENTRALE DU CONGO': {
    defaultCoverage: { percentage: 100 },
    coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES,
    approvalRules: {
      requiresMedicalReport: ['surgery'],
      notes: 'Full coverage. Medical report MANDATORY for all surgical procedures.'
    }
  },

  // ============================================
  // 12. BOA - $60 frame limit
  // ============================================
  'BANK OF AFRICA': {
    defaultCoverage: { percentage: 100 },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 100, requiresApproval: false },
      { category: 'examination', coveragePercentage: 100, requiresApproval: false },
      { category: 'procedure', coveragePercentage: 100, requiresApproval: false },
      { category: 'imaging', coveragePercentage: 100, requiresApproval: false },
      { category: 'laboratory', coveragePercentage: 100, requiresApproval: false },
      { category: 'medication', coveragePercentage: 100, requiresApproval: false },
      { category: 'surgery', coveragePercentage: 100, requiresApproval: true },
      { category: 'optical', coveragePercentage: 100, requiresApproval: true, maxPerItem: 60, maxPerItemCurrency: 'USD', notes: 'Frames capped at $60. Lenses per tariff grid.' }
    ],
    approvalRules: {
      notes: 'Full coverage. Frames limited to $60. Lenses per tariff grid. Verify name against beneficiary list.'
    }
  },

  // ============================================
  // 13. Standard Full Coverage Plans
  // All procedures covered, surgery/optical need approval
  // ============================================
  'ADELIZ': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Surgery and optical require approval. Voucher required.' } },
  'AFIA BORA': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Surgery and optical require approval. Voucher required.' } },
  'AFRICA IN': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Surgery and optical require approval. Voucher required.' } },
  'CAPITAL HR': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Surgery and optical require approval. Voucher required.' } },
  'COBIL': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Surgery and optical require approval. Voucher required.' } },
  'CORDAID': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Surgery and optical require approval. Voucher required.' } },
  'DISPROMALT': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Surgery and optical require approval. Voucher required.' } },
  'MSF': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Surgery and optical require approval. Voucher required.' } },
  'MEDECIN SANS FRONTIERE': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Surgery and optical require approval. Voucher required.' } },
  'SUNU': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Surgery and optical require approval. Voucher required.' } },
  'TFM': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Surgery and optical require approval. Voucher required.' } },
  'AMBASSADE USA': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Surgery and optical require approval. Voucher required.' } },
  'ENGEN': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Surgery and optical require approval.' } },
  'MSH': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Verify card AND name against beneficiary list.' } },
  'POLYCLINIQUE DE KINSHASA': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Only perform services specified on voucher.' } },
  'POLYCLINIQUE KIN': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Only perform services specified on voucher.' } },
  'CENTRE DIAMANT': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Only perform services specified on voucher.' } },
  'CENTRE MEDICAL DIAMANT': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Only perform services specified on voucher.' } },
  'RAWSUR': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Verify beneficiary list or accept card in emergencies. Forms must be signed.' } },
  'SEP CONGO': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Emergency card acceptance. Patient must be registered in software.' } },
  'SEP CONGO KINSHASA': { defaultCoverage: { percentage: 100 }, coveredCategories: STANDARD_FULL_COVERAGE_CATEGORIES, approvalRules: { notes: 'Full coverage. Emergency card acceptance. Patient must be registered in software.' } }
};

async function seedConventionRules() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    let updated = 0;
    let notFound = 0;
    let errors = 0;

    for (const [companyName, rules] of Object.entries(CONVENTION_RULES)) {
      try {
        // Find company by exact name or partial match
        let company = await Company.findOne({ name: companyName });

        if (!company) {
          // Try case-insensitive match
          company = await Company.findOne({ name: { $regex: new RegExp(`^${companyName}$`, 'i') } });
        }

        if (!company) {
          console.log(`⚠️  Company not found: ${companyName}`);
          notFound++;
          continue;
        }

        // Update the company with new rules
        const updateData = {
          coveredCategories: rules.coveredCategories,
          approvalRules: rules.approvalRules || {}
        };

        if (rules.defaultCoverage) {
          updateData['defaultCoverage.percentage'] = rules.defaultCoverage.percentage;
        }

        if (rules.packageDeals) {
          updateData.packageDeals = rules.packageDeals;
        }

        await Company.findByIdAndUpdate(company._id, { $set: updateData });
        console.log(`✅ Updated: ${company.name}`);
        updated++;

      } catch (err) {
        console.error(`❌ Error updating ${companyName}:`, err.message);
        errors++;
      }
    }

    // Also update all ACTIVA sub-companies with auto-approve rule
    const activaSubCompanies = await Company.find({
      name: { $regex: /^ACTIVA /i },
      'approvalRules.autoApproveUnderAmount': { $exists: false }
    });

    for (const company of activaSubCompanies) {
      await Company.findByIdAndUpdate(company._id, {
        $set: {
          'approvalRules.autoApproveUnderAmount': 100,
          'approvalRules.autoApproveUnderCurrency': 'USD'
        }
      });
      console.log(`✅ Added auto-approve to: ${company.name}`);
      updated++;
    }

    console.log('\n========================================');
    console.log(`✅ Updated: ${updated} companies`);
    console.log(`⚠️  Not found: ${notFound} companies`);
    console.log(`❌ Errors: ${errors}`);
    console.log('========================================\n');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedConventionRules();
}

module.exports = { seedConventionRules, CONVENTION_RULES };
