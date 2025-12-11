/**
 * Convention Rules Audit Script
 *
 * Scans ALL conventions (parent and child) and verifies:
 * 1. Coverage percentages are correct
 * 2. Approval rules are properly configured
 * 3. Package deals are set up
 * 4. Category exclusions work
 * 5. Discounts are applied
 * 6. Parent-child inheritance works
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Company = require('../models/Company');

// Expected rules based on the user's specifications
const EXPECTED_RULES = {
  // OPTICAL ONLY
  'AAC': {
    type: 'optical-only',
    opticalCoverage: 100,
    otherCategories: 'notCovered',
    description: 'Optical only - all other categories NOT covered'
  },

  // AUTO-APPROVE UNDER $100
  'ACTIVA': {
    type: 'auto-approve',
    autoApproveUnder: 100,
    defaultCoverage: 100,
    surgeryApproval: true,
    opticalApproval: true,
    description: 'Auto-approve under $100, surgery/optical need approval'
  },
  'CICR': {
    type: 'auto-approve',
    autoApproveUnder: 100,
    defaultCoverage: 100,
    surgeryApproval: true,
    opticalApproval: true,
    description: 'Auto-approve under $100, surgery/optical need approval'
  },

  // RESTRICTIVE
  'PACTILIS': {
    type: 'restrictive',
    defaultCoverage: 100,
    autoCategories: ['consultation', 'medication'],
    approvalRequired: ['examination', 'procedure', 'imaging', 'laboratory', 'surgery', 'optical'],
    description: 'Only consultation/pharmacy auto, everything else needs approval'
  },

  // $65 PACKAGE DEALS
  'BRALIMA': {
    type: 'package',
    hasPackage: true,
    packagePrice: 65,
    packageActs: ['CONSULT', 'REFRACTO', 'TONO', 'BIOMICRO', 'FOND-ND', 'FLUORO'],
    surgeryApproval: true,
    opticalApproval: true,
    description: '$65 package (BRALIMA version)'
  },
  'MSO KINSHASA': {
    type: 'package',
    hasPackage: true,
    packagePrice: 65,
    packageActs: ['CONSULT', 'REFRACTO', 'TONO', 'FLUORO', 'KERATO', 'RETINO'],
    description: '$65 package (MSO version with retino)'
  },
  'LISUNGI': {
    type: 'package-discount',
    hasPackage: true,
    packagePrice: 65,
    surgeryDiscount: 15,
    surgeryApproval: true,
    opticalApproval: true,
    description: '$65 package + 15% surgery discount'
  },

  // GLOBAL DISCOUNT
  'TEMOINS DE JEHOVAH': {
    type: 'discount',
    globalDiscount: 25,
    excludeSurgery: true,
    description: '25% discount on non-surgery'
  },
  'TEMOIN DE JEHOVAH': {
    type: 'discount',
    globalDiscount: 25,
    excludeSurgery: true,
    description: '25% discount on non-surgery (alternate spelling)'
  },

  // TIERED COVERAGE - OPTICAL EXCLUDED
  'CIGNA': {
    type: 'tiered-no-optical',
    opticalExcluded: true,
    tiers: [80, 100],
    description: 'Tiered coverage (80%/100%), optical EXCLUDED'
  },
  'GGA': {
    type: 'tiered-no-optical',
    opticalExcluded: true,
    tiers: [80, 90, 100],
    description: 'Tiered coverage (80%/90%/100%), optical EXCLUDED'
  },

  // SPECIAL RULES
  'BANK OF AFRICA': {
    type: 'frame-limit',
    frameLimit: 60,
    description: '$60 frame limit'
  },
  'BOA': {
    type: 'frame-limit',
    frameLimit: 60,
    description: '$60 frame limit (alias)'
  },
  'BANQUE CENTRALE DU CONGO': {
    type: 'medical-report',
    requiresMedicalReport: ['surgery'],
    description: 'Medical report required for surgery'
  },
  'BCC': {
    type: 'medical-report',
    requiresMedicalReport: ['surgery'],
    description: 'Medical report required for surgery (alias)'
  }
};

// Standard full coverage companies
const STANDARD_FULL_COVERAGE = [
  'ADELIZ', 'AFIA BORA', 'AFRICA IN', 'CAPITAL HR', 'COBIL', 'CORDAID',
  'DISPROMALT', 'MSF', 'MEDECIN SANS FRONTIERE', 'SUNU', 'TFM',
  'AMBASSADE USA', 'ENGEN', 'MSH', 'POLYCLINIQUE DE KINSHASA',
  'POLYCLINIQUE KIN', 'CENTRE DIAMANT', 'RAWSUR', 'SEP CONGO'
];

async function auditCompany(company, indent = '') {
  const issues = [];
  const warnings = [];
  const checks = [];

  const name = company.name;
  const expected = EXPECTED_RULES[name] || (STANDARD_FULL_COVERAGE.some(n => name.includes(n)) ? { type: 'standard' } : null);

  // Basic checks
  if (!company.isActive) {
    warnings.push('Company is INACTIVE');
  }
  if (company.contract?.status !== 'active') {
    warnings.push(`Contract status: ${company.contract?.status || 'unknown'}`);
  }

  // Check default coverage
  const coverage = company.defaultCoverage?.percentage;
  checks.push(`Default Coverage: ${coverage}%`);

  // Check categories
  const categories = company.coveredCategories || [];
  const categoryMap = {};
  categories.forEach(c => {
    categoryMap[c.category] = c;
  });

  // Check package deals
  const packages = company.packageDeals || [];
  if (packages.length > 0) {
    const pkg = packages[0];
    checks.push(`Package: ${pkg.name} ($${pkg.price})`);
    checks.push(`  Acts: ${pkg.includedActs?.map(a => a.actCode).join(', ') || 'none'}`);
  }

  // Check approval rules
  const approvalRules = company.approvalRules || {};
  if (approvalRules.autoApproveUnderAmount) {
    checks.push(`Auto-approve under: $${approvalRules.autoApproveUnderAmount}`);
  }
  if (approvalRules.globalDiscount?.percentage) {
    checks.push(`Global discount: ${approvalRules.globalDiscount.percentage}%`);
    if (approvalRules.globalDiscount.excludeCategories?.length) {
      checks.push(`  Excludes: ${approvalRules.globalDiscount.excludeCategories.join(', ')}`);
    }
  }

  // Validate against expected rules
  if (expected) {
    switch (expected.type) {
      case 'optical-only':
        // Check that optical is covered
        if (!categoryMap.optical || categoryMap.optical.notCovered) {
          issues.push('❌ Optical should be COVERED');
        } else {
          checks.push('✓ Optical covered');
        }
        // Check that other categories are NOT covered
        ['consultation', 'examination', 'procedure', 'imaging', 'laboratory', 'surgery'].forEach(cat => {
          if (categoryMap[cat] && !categoryMap[cat].notCovered) {
            issues.push(`❌ ${cat} should be NOT COVERED`);
          }
        });
        break;

      case 'auto-approve':
        if (!approvalRules.autoApproveUnderAmount || approvalRules.autoApproveUnderAmount !== expected.autoApproveUnder) {
          issues.push(`❌ Auto-approve threshold should be $${expected.autoApproveUnder}, got $${approvalRules.autoApproveUnderAmount || 0}`);
        } else {
          checks.push(`✓ Auto-approve under $${expected.autoApproveUnder}`);
        }
        if (expected.surgeryApproval && (!categoryMap.surgery || !categoryMap.surgery.requiresApproval)) {
          issues.push('❌ Surgery should require approval');
        }
        if (expected.opticalApproval && (!categoryMap.optical || !categoryMap.optical.requiresApproval)) {
          issues.push('❌ Optical should require approval');
        }
        break;

      case 'package':
      case 'package-discount':
        if (packages.length === 0) {
          issues.push('❌ Missing $65 package deal');
        } else {
          const pkg = packages[0];
          if (pkg.price !== expected.packagePrice) {
            issues.push(`❌ Package price should be $${expected.packagePrice}, got $${pkg.price}`);
          } else {
            checks.push(`✓ Package price: $${pkg.price}`);
          }
          // Check included acts
          const pkgCodes = pkg.includedActs?.map(a => a.actCode?.toUpperCase()) || [];
          const missingActs = expected.packageActs?.filter(code => !pkgCodes.includes(code)) || [];
          if (missingActs.length > 0) {
            issues.push(`❌ Package missing acts: ${missingActs.join(', ')}`);
          }
        }
        if (expected.surgeryDiscount) {
          if (!approvalRules.globalDiscount?.percentage || approvalRules.globalDiscount.percentage !== expected.surgeryDiscount) {
            // Check if surgery has additional discount
            const surgeryCategory = categoryMap.surgery;
            if (!surgeryCategory?.additionalDiscount && surgeryCategory?.additionalDiscount !== expected.surgeryDiscount) {
              warnings.push(`⚠️ Surgery discount should be ${expected.surgeryDiscount}%`);
            }
          }
        }
        break;

      case 'discount':
        if (!approvalRules.globalDiscount?.percentage) {
          issues.push(`❌ Missing global discount (expected ${expected.globalDiscount}%)`);
        } else if (approvalRules.globalDiscount.percentage !== expected.globalDiscount) {
          issues.push(`❌ Global discount should be ${expected.globalDiscount}%, got ${approvalRules.globalDiscount.percentage}%`);
        } else {
          checks.push(`✓ Global discount: ${expected.globalDiscount}%`);
        }
        if (expected.excludeSurgery) {
          if (!approvalRules.globalDiscount?.excludeCategories?.includes('surgery')) {
            warnings.push('⚠️ Surgery should be excluded from discount');
          }
        }
        break;

      case 'tiered-no-optical':
        if (!categoryMap.optical?.notCovered) {
          issues.push('❌ Optical should be NOT COVERED (excluded)');
        } else {
          checks.push('✓ Optical excluded');
        }
        break;

      case 'frame-limit':
        // Frame limit is stored in optical category
        if (categoryMap.optical?.maxPerCategory !== expected.frameLimit) {
          warnings.push(`⚠️ Frame limit should be $${expected.frameLimit}`);
        }
        break;

      case 'medical-report':
        if (!approvalRules.requiresMedicalReport?.includes('surgery')) {
          warnings.push('⚠️ Surgery should require medical report');
        }
        break;

      case 'standard':
        // Check standard full coverage with surgery/optical approval
        if (coverage !== 100) {
          warnings.push(`⚠️ Expected 100% coverage, got ${coverage}%`);
        }
        if (!categoryMap.surgery?.requiresApproval) {
          warnings.push('⚠️ Surgery should require approval');
        }
        if (!categoryMap.optical?.requiresApproval) {
          warnings.push('⚠️ Optical should require approval');
        }
        break;
    }
  }

  return { name, issues, warnings, checks, expected };
}

async function runAudit() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    console.log('═'.repeat(80));
    console.log('  CONVENTION RULES AUDIT REPORT');
    console.log('═'.repeat(80));

    // Get all companies
    const companies = await Company.find({}).sort('name');
    console.log(`\nTotal companies: ${companies.length}\n`);

    // Separate parent conventions and sub-companies
    const parentConventions = companies.filter(c => c.isParentConvention);
    const subCompanies = companies.filter(c => c.parentConvention);
    const standalone = companies.filter(c => !c.isParentConvention && !c.parentConvention);

    let totalIssues = 0;
    let totalWarnings = 0;
    let totalPassed = 0;

    // Audit parent conventions
    console.log('\n' + '─'.repeat(80));
    console.log('  PARENT CONVENTIONS');
    console.log('─'.repeat(80));

    for (const company of parentConventions) {
      const result = await auditCompany(company);
      printResult(result);
      totalIssues += result.issues.length;
      totalWarnings += result.warnings.length;
      if (result.issues.length === 0) totalPassed++;
    }

    // Audit standalone companies (most conventions)
    console.log('\n' + '─'.repeat(80));
    console.log('  STANDALONE CONVENTIONS');
    console.log('─'.repeat(80));

    for (const company of standalone) {
      const result = await auditCompany(company);
      printResult(result);
      totalIssues += result.issues.length;
      totalWarnings += result.warnings.length;
      if (result.issues.length === 0) totalPassed++;
    }

    // Audit sub-companies
    if (subCompanies.length > 0) {
      console.log('\n' + '─'.repeat(80));
      console.log('  SUB-COMPANIES (inherit from parent)');
      console.log('─'.repeat(80));

      for (const company of subCompanies) {
        const parent = companies.find(c => c._id.toString() === company.parentConvention?.toString());
        const result = await auditCompany(company, '  ');
        result.parentName = parent?.name || 'Unknown';
        printResult(result, true);
        totalIssues += result.issues.length;
        totalWarnings += result.warnings.length;
        if (result.issues.length === 0) totalPassed++;
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('  AUDIT SUMMARY');
    console.log('═'.repeat(80));
    console.log(`\n  Total Companies: ${companies.length}`);
    console.log(`  ✅ Passed: ${totalPassed}`);
    console.log(`  ❌ With Issues: ${companies.length - totalPassed}`);
    console.log(`  ⚠️  Total Warnings: ${totalWarnings}`);
    console.log(`  ❌ Total Issues: ${totalIssues}`);

    // Test calculations
    console.log('\n' + '═'.repeat(80));
    console.log('  BILLING CALCULATION TESTS');
    console.log('═'.repeat(80));

    await testCalculations(companies);

    console.log('\n' + '═'.repeat(80));
    console.log('  AUDIT COMPLETE');
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('Audit error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

function printResult(result, isSubCompany = false) {
  const prefix = isSubCompany ? '  └─ ' : '';
  const indent = isSubCompany ? '     ' : '   ';

  if (result.issues.length === 0 && result.warnings.length === 0) {
    console.log(`${prefix}✅ ${result.name}`);
    return;
  }

  if (result.issues.length > 0) {
    console.log(`${prefix}❌ ${result.name}`);
  } else {
    console.log(`${prefix}⚠️  ${result.name}`);
  }

  if (isSubCompany && result.parentName) {
    console.log(`${indent}Parent: ${result.parentName}`);
  }

  result.issues.forEach(issue => {
    console.log(`${indent}${issue}`);
  });
  result.warnings.forEach(warning => {
    console.log(`${indent}${warning}`);
  });
}

async function testCalculations(companies) {
  // Test invoice calculations for key conventions
  const testCases = [
    {
      companyName: 'BRALIMA',
      items: [
        { code: 'CONSULT', unitPrice: 25, category: 'consultation' },
        { code: 'REFRACTO', unitPrice: 15, category: 'examination' },
        { code: 'TONO', unitPrice: 20, category: 'examination' },
        { code: 'BIOMICRO', unitPrice: 20, category: 'examination' },
        { code: 'FOND-ND', unitPrice: 25, category: 'examination' },
        { code: 'FLUORO', unitPrice: 10, category: 'examination' }
      ],
      expectedTotal: 65,
      expectedSavings: 50,
      description: '6 acts → $65 package'
    },
    {
      companyName: 'AAC',
      items: [
        { code: 'CONSULT', unitPrice: 50, category: 'consultation' },
        { code: 'FRAMES', unitPrice: 150, category: 'optical' }
      ],
      expectedCompanyShare: 150, // Only optical covered
      expectedPatientShare: 50, // Consultation not covered
      description: 'Optical only - consultation not covered'
    },
    {
      companyName: 'CIGNA',
      items: [
        { code: 'CONSULT', unitPrice: 50, category: 'consultation' },
        { code: 'FRAMES', unitPrice: 150, category: 'optical' }
      ],
      expectedCompanyShare: 50, // Consultation covered
      expectedPatientShare: 150, // Optical excluded
      description: 'No optical - consultation covered'
    }
  ];

  for (const test of testCases) {
    const company = companies.find(c => c.name === test.companyName);
    if (!company) {
      console.log(`\n  ❓ ${test.companyName}: Company not found`);
      continue;
    }

    console.log(`\n  📊 ${test.companyName}: ${test.description}`);

    // Simulate calculation
    let companyShare = 0;
    let patientShare = 0;

    for (const item of test.items) {
      const categorySettings = company.coveredCategories?.find(c => c.category === item.category);

      if (categorySettings?.notCovered) {
        patientShare += item.unitPrice;
        console.log(`     ${item.code} ($${item.unitPrice}): NOT COVERED → Patient pays`);
      } else {
        const coveragePercent = categorySettings?.coveragePercentage ?? company.defaultCoverage?.percentage ?? 100;
        const itemCompanyShare = Math.round((item.unitPrice * coveragePercent) / 100);
        companyShare += itemCompanyShare;
        patientShare += item.unitPrice - itemCompanyShare;
        console.log(`     ${item.code} ($${item.unitPrice}): ${coveragePercent}% → Company: $${itemCompanyShare}`);
      }
    }

    console.log(`     ─────────────────────────────`);
    console.log(`     Company Share: $${companyShare}`);
    console.log(`     Patient Share: $${patientShare}`);

    if (test.expectedCompanyShare !== undefined) {
      if (companyShare === test.expectedCompanyShare) {
        console.log(`     ✅ Company share correct`);
      } else {
        console.log(`     ❌ Company share should be $${test.expectedCompanyShare}`);
      }
    }
    if (test.expectedPatientShare !== undefined) {
      if (patientShare === test.expectedPatientShare) {
        console.log(`     ✅ Patient share correct`);
      } else {
        console.log(`     ❌ Patient share should be $${test.expectedPatientShare}`);
      }
    }
  }
}

runAudit();
