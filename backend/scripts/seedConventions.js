/**
 * Seed Script for Insurance Conventions and Sub-Companies
 *
 * This script populates all parent conventions and their associated sub-companies
 * Based on the FICHIER-CONVENTION.xlsx data
 *
 * Structure:
 * - Parent conventions (ACTIVA, MSO, GGA, CIGNA, FACILITY, PACTILIS)
 * - Sub-companies under each parent (e.g., MSO VODACOM, ACTIVA TOTAL RDC)
 * - Standalone conventions (no parent)
 *
 * Usage: node scripts/seedConventions.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedConventions.js');

const Company = require('../models/Company');
const User = require('../models/User');

// ============================================
// PARENT CONVENTIONS WITH SUB-COMPANIES
// ============================================
const CONVENTIONS = {
  ACTIVA: {
    name: 'ACTIVA',
    conventionCode: 'ACTIVA',
    type: 'insurance',
    defaultCoverage: { percentage: 100, currency: 'USD' },
    approvalRules: {
      autoApproveUnderAmount: 100,
      autoApproveUnderCurrency: 'USD'
    },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 100, requiresApproval: false },
      { category: 'examination', coveragePercentage: 100, requiresApproval: false },
      { category: 'procedure', coveragePercentage: 100, requiresApproval: true },
      { category: 'surgery', coveragePercentage: 100, requiresApproval: true },
      { category: 'optical', coveragePercentage: 100, requiresApproval: true },
      { category: 'imaging', coveragePercentage: 100, requiresApproval: false },
      { category: 'laboratory', coveragePercentage: 100, requiresApproval: false },
      { category: 'medication', coveragePercentage: 100, requiresApproval: false }
    ],
    notes: 'Actes < 100$ auto-approuvés. Chirurgie et optique: validation requise.',
    subCompanies: [
      'ACTIVA AFENET',
      'ACTIVA AFRILAND BANK',
      'ACTIVA AIR LIQUIDE',
      'ACTIVA AMBASSADE C,I',
      'ACTIVA ASSURANCES RDC',
      'ACTIVA AUF',
      'ACTIVA CENI',
      'ACTIVA CENTRE MISSIONNAIRE PHILADELPHIE',
      'ACTIVA CHEMONICS',
      'ACTIVA CSM',
      'ACTIVA ECHO',
      'ACTIVA ESTCASTEL INFRASTRUCTURE',
      'ACTIVA FHI 360',
      'ACTIVA GIZ',
      'ACTIVA HAVAS AFRICA RDC',
      'ACTIVA INTERPEACE',
      'ACTIVA IPAS',
      'ACTIVA MANGIFERA ENERGY',
      'ACTIVA ROCHE RDC',
      'ACTIVA SEGUCE',
      'ACTIVA SERVTEC',
      'ACTIVA SESOMO',
      'ACTIVA SESOMO TSCO',
      'ACTIVA SODEICO',
      'ACTIVA THE MITCHELL GROUP (TMG)',
      'ACTIVA TMG',
      'ACTIVA TOTAL RDC'
    ]
  },

  MSO: {
    name: 'MSO',
    conventionCode: 'MSO',
    type: 'insurance',
    defaultCoverage: { percentage: 100, currency: 'USD' },
    packageDeals: [
      { name: 'Forfait MSO Standard', code: 'MSO-STD', price: 65, currency: 'USD', active: true }
    ],
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 100, requiresApproval: false },
      { category: 'examination', coveragePercentage: 100, requiresApproval: true },
      { category: 'procedure', coveragePercentage: 100, requiresApproval: true },
      { category: 'surgery', coveragePercentage: 100, requiresApproval: true },
      { category: 'optical', coveragePercentage: 100, requiresApproval: true },
      { category: 'imaging', coveragePercentage: 100, requiresApproval: true },
      { category: 'laboratory', coveragePercentage: 100, requiresApproval: true },
      { category: 'medication', coveragePercentage: 100, requiresApproval: true }
    ],
    notes: 'Forfait consultation (65$). Autres actes: validation requise.',
    subCompanies: [
      'MSO ACTIVA',
      'MSO AETNA',
      'MSO AIRTEL',
      'MSO BAT',
      'MSO BCS',
      'MSO BGFI BANK',
      'MSO CJCLDS',
      'MSO CONVIVA',
      'MSO DGCPT',
      'MSO DHL',
      'MSO EDC',
      'MSO EQUITY BCDC',
      'MSO FINA',
      'MSO FONAREV',
      'MSO FONDATION DN',
      'MSO HELIOS DRC',
      'MSO HUAWEI',
      'MSO IBM',
      'MSO IPAS',
      'MSO KIBALI',
      'MSO LIQUID TELECOM',
      'MSO MGT',
      'MSO MH Luxembourg',
      'MSO MIN.DES FINANCES',
      'MSO MSI',
      'MSO ORANGE RDC',
      'MSO PATH',
      'MSO PAY NET WORK',
      'MSO PROFESSEUR UNIV',
      'MSO RAW BANK',
      'MSO RAWSUR',
      'MSO RESONNANCE',
      'MSO SAMSUNG',
      'MSO SARW',
      'MSO SFA',
      'MSO TETRA TECH',
      'MSO VITALITY',
      'MSO VODACOM'
    ]
  },

  GGA: {
    name: 'GGA',
    conventionCode: 'GGA',
    type: 'insurance',
    defaultCoverage: { percentage: 100, currency: 'USD' },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 100, requiresApproval: false },
      { category: 'examination', coveragePercentage: 100, requiresApproval: false },
      { category: 'procedure', coveragePercentage: 100, requiresApproval: false },
      { category: 'surgery', coveragePercentage: 100, requiresApproval: true },
      { category: 'optical', notCovered: true, coveragePercentage: 0, requiresApproval: false, notes: 'Optique NON couvert' },
      { category: 'imaging', coveragePercentage: 100, requiresApproval: false },
      { category: 'laboratory', coveragePercentage: 100, requiresApproval: false },
      { category: 'medication', coveragePercentage: 100, requiresApproval: false }
    ],
    notes: 'OPTIQUE NON COUVERT. Chirurgie: validation requise.',
    subCompanies: [
      { name: 'GGA 80%', coverage: 80 },
      { name: 'GGA 90%', coverage: 90 },
      { name: 'GGA CFAO MOTORS', coverage: 100 },
      { name: 'GGA GLOBE MED.', coverage: 100 },
      { name: 'GGA RAWSUR', coverage: 100 }
    ]
  },

  CIGNA: {
    name: 'CIGNA',
    conventionCode: 'CIGNA',
    type: 'insurance',
    defaultCoverage: { percentage: 100, currency: 'USD' },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 100, requiresApproval: false },
      { category: 'examination', coveragePercentage: 100, requiresApproval: false },
      { category: 'procedure', coveragePercentage: 100, requiresApproval: false },
      { category: 'surgery', coveragePercentage: 100, requiresApproval: true },
      { category: 'optical', notCovered: true, coveragePercentage: 0, requiresApproval: false, notes: 'Optique NON couvert' },
      { category: 'imaging', coveragePercentage: 100, requiresApproval: false },
      { category: 'laboratory', coveragePercentage: 100, requiresApproval: false },
      { category: 'medication', coveragePercentage: 100, requiresApproval: false }
    ],
    notes: 'OPTIQUE NON COUVERT. Chirurgie: validation requise.',
    subCompanies: [
      { name: 'CIGNA 100%', coverage: 100 },
      { name: 'CIGNA 80%', coverage: 80 }
    ]
  },

  FACILITY: {
    name: 'FACILITY',
    conventionCode: 'FACILITY',
    type: 'insurance',
    defaultCoverage: { percentage: 100, currency: 'USD' },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 100, requiresApproval: false },
      { category: 'examination', coveragePercentage: 100, requiresApproval: false },
      { category: 'procedure', coveragePercentage: 100, requiresApproval: false },
      { category: 'surgery', coveragePercentage: 100, requiresApproval: true },
      { category: 'optical', coveragePercentage: 100, requiresApproval: true },
      { category: 'imaging', coveragePercentage: 100, requiresApproval: false },
      { category: 'laboratory', coveragePercentage: 100, requiresApproval: false },
      { category: 'medication', coveragePercentage: 100, requiresApproval: false }
    ],
    notes: 'Chirurgie et optique: validation requise.',
    subCompanies: [
      'FACILITY INOVIE',
      'FACILITY SERVICES',
      'FACILLITY BAOBA',
      'FACILLITY ADVANS BANK',
      'FACILLITY DKT'
    ]
  },

  PACTILIS: {
    name: 'PACTILIS',
    conventionCode: 'PACTILIS',
    type: 'insurance',
    defaultCoverage: { percentage: 100, currency: 'USD' },
    coveredCategories: [
      { category: 'consultation', coveragePercentage: 100, requiresApproval: false },
      { category: 'examination', coveragePercentage: 100, requiresApproval: false },
      { category: 'procedure', coveragePercentage: 100, requiresApproval: false },
      { category: 'surgery', coveragePercentage: 100, requiresApproval: true },
      { category: 'optical', coveragePercentage: 100, requiresApproval: true },
      { category: 'imaging', coveragePercentage: 100, requiresApproval: false },
      { category: 'laboratory', coveragePercentage: 100, requiresApproval: false },
      { category: 'medication', coveragePercentage: 100, requiresApproval: false }
    ],
    notes: 'Chirurgie et optique: validation requise.',
    subCompanies: [
      'PACTILIS',
      'PACTILIS MGT'
    ]
  }
};

// ============================================
// STANDALONE CONVENTIONS (NO PARENT)
// ============================================
const STANDALONE_CONVENTIONS = [
  { name: 'ADELIZ', coverage: 100, type: 'insurance' },
  { name: 'AFRICA IN', coverage: 100, type: 'insurance' },
  { name: 'AFRIK INTERIM', coverage: 100, type: 'employer' },
  { name: 'AFYA BORA', coverage: 100, type: 'insurance', shortName: 'AFIA BORA' },
  { name: 'AMBASSADE USA', coverage: 100, type: 'government' },
  { name: 'BANK OF AFRICA', coverage: 100, type: 'employer', shortName: 'BOA' },
  { name: 'BANQUE CENTRALE DU CONGO', coverage: 100, type: 'government', shortName: 'BCC' },
  { name: 'BON-SECOURS', coverage: 100, type: 'employer' },
  {
    name: 'BRALIMA',
    coverage: 100,
    type: 'employer',
    packageDeals: [
      { name: 'Forfait BRALIMA Ophtalmo', code: 'BRAL-65', price: 65, currency: 'USD', active: true }
    ],
    notes: 'Forfait Package (65$). Chirurgie et optique: validation requise.'
  },
  { name: 'BUPHE', coverage: 100, type: 'employer' },
  { name: 'CAPITAL HR', coverage: 100, type: 'employer' },
  { name: 'CASH', coverage: 100, type: 'other', notes: 'Paiement comptant' },
  { name: 'CENTRE DIAMANT', coverage: 100, type: 'employer' },
  {
    name: 'CICR CROIX ROUGE',
    coverage: 100,
    type: 'ngo',
    shortName: 'CICR',
    approvalRules: { autoApproveUnderAmount: 100, autoApproveUnderCurrency: 'USD' },
    notes: 'Actes < 100$ auto-approuvés.'
  },
  { name: 'CMK', coverage: 100, type: 'employer' },
  { name: 'CMOC CONGO', coverage: 100, type: 'employer' },
  { name: 'COBIL', coverage: 100, type: 'employer' },
  { name: 'CORDAID', coverage: 100, type: 'ngo' },
  { name: 'CPTE PAIMENT A L\'ETRANGER', coverage: 100, type: 'other', notes: 'Paiement étranger' },
  { name: 'DISPROMALT', coverage: 100, type: 'employer' },
  { name: 'ENGEN', coverage: 100, type: 'employer' },
  { name: 'FAMILLE NZOLANTIMA', coverage: 50, type: 'other', notes: 'Couverture 50% seulement' },
  { name: 'FM', coverage: 100, type: 'employer' },
  { name: 'GLENCORE RDC', coverage: 100, type: 'employer' },
  { name: 'INTEGRAL', coverage: 100, type: 'insurance' },
  {
    name: 'LISUNGI',
    coverage: 100,
    type: 'employer',
    packageDeals: [
      { name: 'Forfait LISUNGI', code: 'LISU-65', price: 65, currency: 'USD', active: true }
    ],
    approvalRules: { globalDiscount: { percentage: 15, excludeCategories: [] } },
    notes: 'Forfait (65$) + 15% réduction sur chirurgies.'
  },
  { name: 'LOXEA RDC', coverage: 100, type: 'employer' },
  { name: 'MEDECIN SANS FRONTIERE', coverage: 100, type: 'ngo', shortName: 'MSF', notes: 'Strictement selon bon MSF.' },
  { name: 'MESP', coverage: 100, type: 'employer' },
  { name: 'MSH', coverage: 100, type: 'ngo' },
  { name: 'OGEFREM MATADI', coverage: 100, type: 'government' },
  { name: 'POLYCLINIQUE DE KINSHASA', coverage: 100, type: 'employer', notes: 'Actes selon bon uniquement.' },
  { name: 'PROFORMA', coverage: 100, type: 'other', notes: 'Facture proforma' },
  { name: 'PROSPERITY ASSISTANCE', coverage: 100, type: 'ngo' },
  { name: 'RAWSUR', coverage: 100, type: 'insurance', notes: 'Accès par bon/carte.' },
  { name: 'SEP CONGO', coverage: 100, type: 'employer', notes: 'Formulaire + enregistrement requis.' },
  { name: 'SOS MDN', coverage: 100, type: 'ngo' },
  { name: 'SUNU', coverage: 100, type: 'insurance', notes: 'Validation via bon.' },
  {
    name: 'TEMOIN DE JEHOVAH',
    coverage: 100,
    type: 'ngo',
    shortName: 'TJ',
    approvalRules: { globalDiscount: { percentage: 10, excludeCategories: ['surgery', 'optical'] } },
    notes: 'Tarif TJ: 10% remise (sauf chirurgie/optique).'
  },
  { name: 'TFM', coverage: 100, type: 'employer' },
  { name: 'AAC', coverage: 100, type: 'insurance', notes: 'Optique uniquement selon grille.',
    coveredCategories: [
      { category: 'optical', coveragePercentage: 100, requiresApproval: true },
      { category: 'consultation', coveragePercentage: 0, requiresApproval: false },
      { category: 'examination', coveragePercentage: 0, requiresApproval: false }
    ]
  }
];

// ============================================
// SEED FUNCTION
// ============================================
async function seedConventions() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('✅ Connected to MongoDB');

    // Get admin user for createdBy
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.error('❌ No admin user found. Please create an admin user first.');
      process.exit(1);
    }

    let parentCount = 0;
    let subCount = 0;
    let standaloneCount = 0;
    let updatedCount = 0;

    // ========================================
    // 1. CREATE PARENT CONVENTIONS
    // ========================================
    console.log('\n📦 Creating parent conventions and sub-companies...\n');

    for (const [code, convention] of Object.entries(CONVENTIONS)) {
      // Check if parent already exists
      let parent = await Company.findOne({
        conventionCode: code,
        isParentConvention: true
      });

      if (!parent) {
        parent = await Company.create({
          name: convention.name,
          conventionCode: convention.conventionCode,
          invoiceDisplayName: convention.name,
          isParentConvention: true,
          type: convention.type || 'insurance',
          defaultCoverage: convention.defaultCoverage || { percentage: 100, currency: 'USD' },
          coveredCategories: convention.coveredCategories || [],
          packageDeals: convention.packageDeals || [],
          approvalRules: convention.approvalRules || {},
          actsRequiringApproval: convention.actsRequiringApproval || [],
          notes: convention.notes,
          contact: { primaryPhone: '+243' },
          contract: { startDate: new Date(), status: 'active' },
          isActive: true,
          createdBy: adminUser._id
        });
        console.log(`  ✅ Parent: ${parent.name} (${parent.companyId})`);
        parentCount++;
      } else {
        // Update existing parent
        parent.coveredCategories = convention.coveredCategories || parent.coveredCategories;
        parent.approvalRules = convention.approvalRules || parent.approvalRules;
        parent.notes = convention.notes || parent.notes;
        await parent.save();
        console.log(`  ⏭️  Parent exists: ${parent.name} (updated)`);
        updatedCount++;
      }

      // Create sub-companies
      for (const sub of convention.subCompanies || []) {
        const subName = typeof sub === 'string' ? sub : sub.name;
        const subCoverage = typeof sub === 'object' ? sub.coverage : null;

        // Check if sub-company already exists
        const exists = await Company.findOne({
          invoiceDisplayName: subName.toUpperCase()
        });

        if (!exists) {
          const subCompany = await Company.create({
            name: subName,
            invoiceDisplayName: subName.toUpperCase(),
            conventionCode: code,
            parentConvention: parent._id,
            isParentConvention: false,
            type: 'employer',
            defaultCoverage: subCoverage
              ? { percentage: subCoverage, currency: 'USD' }
              : { ...parent.defaultCoverage.toObject() },
            contact: { primaryPhone: '+243' },
            contract: { startDate: new Date(), status: 'active' },
            isActive: true,
            createdBy: adminUser._id
          });
          console.log(`    📎 Sub: ${subCompany.invoiceDisplayName}`);
          subCount++;
        }
      }
    }

    // ========================================
    // 2. CREATE STANDALONE CONVENTIONS
    // ========================================
    console.log('\n🏢 Creating standalone conventions...\n');

    for (const standalone of STANDALONE_CONVENTIONS) {
      const exists = await Company.findOne({
        name: standalone.name.toUpperCase()
      });

      if (!exists) {
        const company = await Company.create({
          name: standalone.name.toUpperCase(),
          invoiceDisplayName: standalone.name.toUpperCase(),
          shortName: standalone.shortName?.toUpperCase(),
          isParentConvention: false,
          parentConvention: null,
          type: standalone.type || 'employer',
          defaultCoverage: {
            percentage: standalone.coverage || 100,
            currency: 'USD'
          },
          coveredCategories: standalone.coveredCategories || [],
          packageDeals: standalone.packageDeals || [],
          approvalRules: standalone.approvalRules || {},
          notes: standalone.notes,
          contact: { primaryPhone: '+243' },
          contract: { startDate: new Date(), status: 'active' },
          isActive: true,
          createdBy: adminUser._id
        });
        console.log(`  ✅ ${company.name} (${company.companyId})`);
        standaloneCount++;
      } else {
        console.log(`  ⏭️  Exists: ${standalone.name}`);
      }
    }

    // ========================================
    // SUMMARY
    // ========================================
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 SEED SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Parent conventions created:  ${parentCount}`);
    console.log(`  Sub-companies created:       ${subCount}`);
    console.log(`  Standalone companies created: ${standaloneCount}`);
    console.log(`  Records updated:             ${updatedCount}`);
    console.log(`  Total new records:           ${parentCount + subCount + standaloneCount}`);

    // Database totals
    const totalCompanies = await Company.countDocuments({ isActive: true });
    const totalParents = await Company.countDocuments({ isParentConvention: true, isActive: true });
    const totalSubs = await Company.countDocuments({ parentConvention: { $ne: null }, isActive: true });

    console.log('\n📈 DATABASE TOTALS');
    console.log(`  Total active companies: ${totalCompanies}`);
    console.log(`  Parent conventions:     ${totalParents}`);
    console.log(`  Sub-companies:          ${totalSubs}`);
    console.log(`  Standalone:             ${totalCompanies - totalParents - totalSubs}`);

    console.log('\n✅ Seed completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding conventions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  seedConventions();
}

module.exports = { seedConventions, CONVENTIONS, STANDALONE_CONVENTIONS };
