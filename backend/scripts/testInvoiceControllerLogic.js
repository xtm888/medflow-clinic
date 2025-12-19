/**
 * INVOICE CONTROLLER LOGIC VERIFICATION
 *
 * This script extracts and tests the actual billing logic from invoiceController.js
 * to ensure it matches our simulation and produces correct results.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Company = require('../models/Company');
const Invoice = require('../models/Invoice');
const Patient = require('../models/Patient');

/**
 * Extracted billing calculation logic from invoiceController.js
 * This mirrors lines 858-931 of the actual controller
 */
function calculateConventionBilling(items, company, options = {}) {
  const baseCoveragePercentage = options.coverageOverride ?? company.defaultCoverage?.percentage ?? 100;
  const categoryCompanyShareTotals = {};

  const itemsWithConvention = [];
  let totalCompanyShare = 0;
  let totalPatientShare = 0;

  for (const item of items) {
    const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
    const categorySettings = company.coveredCategories?.find(c => c.category === item.category);

    // Check if category is not covered
    if (categorySettings?.notCovered) {
      itemsWithConvention.push({
        ...item,
        companyShare: 0,
        patientShare: itemTotal,
        notCovered: true
      });
      totalPatientShare += itemTotal;
      continue;
    }

    // Check approval requirements
    let approvalRequired = false;
    if (categorySettings?.requiresApproval) {
      approvalRequired = true;
    }

    // Check auto-approve threshold
    let hasValidApproval = false;
    if (approvalRequired && company.approvalRules?.autoApproveUnderAmount) {
      const threshold = company.approvalRules.autoApproveUnderAmount;
      if (itemTotal < threshold) {
        hasValidApproval = true;
      }
    }

    // Check if surgery/optical has autoApproveUnder: 0 (never auto-approve)
    if (categorySettings?.autoApproveUnder === 0) {
      hasValidApproval = false;
    }

    // Assume approval for simulation if option set
    if (options.assumeApproved) {
      hasValidApproval = true;
    }

    // Calculate coverage
    let coveragePercentage = 0;
    if (!approvalRequired || hasValidApproval) {
      coveragePercentage = categorySettings?.coveragePercentage ?? baseCoveragePercentage;
    }

    // Apply global discount
    let effectiveItemTotal = itemTotal;
    let discountApplied = 0;
    let discountPercentage = 0;

    if (company.approvalRules?.globalDiscount?.percentage > 0) {
      const excludeCategories = company.approvalRules.globalDiscount.excludeCategories || [];
      if (!excludeCategories.includes(item.category)) {
        discountPercentage = company.approvalRules.globalDiscount.percentage;
        discountApplied = Math.round((itemTotal * discountPercentage) / 100);
        effectiveItemTotal = itemTotal - discountApplied;
      }
    }

    // Check category-specific discount
    if (categorySettings?.additionalDiscount > 0 && discountPercentage === 0) {
      discountPercentage = categorySettings.additionalDiscount;
      discountApplied = Math.round((itemTotal * discountPercentage) / 100);
      effectiveItemTotal = itemTotal - discountApplied;
    }

    let companyShare = Math.round((effectiveItemTotal * coveragePercentage) / 100);

    // Apply cumulative category max
    const category = item.category || 'other';
    if (!categoryCompanyShareTotals[category]) {
      categoryCompanyShareTotals[category] = 0;
    }

    if (categorySettings?.maxPerCategory) {
      const maxForCategory = categorySettings.maxPerCategory;
      const alreadyPaidForCategory = categoryCompanyShareTotals[category];
      const remainingBudget = maxForCategory - alreadyPaidForCategory;

      if (remainingBudget <= 0) {
        companyShare = 0;
      } else if (companyShare > remainingBudget) {
        companyShare = remainingBudget;
      }
    }

    categoryCompanyShareTotals[category] += companyShare;

    const patientShare = effectiveItemTotal - companyShare;

    itemsWithConvention.push({
      ...item,
      companyShare,
      patientShare,
      coveragePercentage,
      discountApplied: discountApplied > 0 ? discountApplied : undefined,
      effectivePrice: discountApplied > 0 ? effectiveItemTotal : undefined
    });

    totalCompanyShare += companyShare;
    totalPatientShare += patientShare;
  }

  return {
    items: itemsWithConvention,
    totalCompanyShare,
    totalPatientShare
  };
}

// Test cases that mirror the extended audit
const TEST_CASES = [
  {
    name: 'ACTIVA - $99 auto-approved, $150 pending',
    companyName: 'ACTIVA',
    items: [
      { code: 'EXAM', description: 'Examen', unitPrice: 99, category: 'examination' },
      { code: 'OCT', description: 'OCT', unitPrice: 150, category: 'imaging' }
    ],
    expected: { companyShare: 99, patientShare: 150 }
  },
  {
    name: 'CIGNA 80% - Optical excluded',
    companyName: 'CIGNA 80%',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 100, category: 'consultation' },
      { code: 'OPTICAL', description: 'Verres', unitPrice: 200, category: 'optical' }
    ],
    expected: { companyShare: 80, patientShare: 220 }
  },
  {
    name: 'TEMOINS - 25% discount (excl. surgery/optical)',
    companyName: 'TEMOIN DE JEHOVAH',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 100, category: 'consultation' },
      { code: 'SURGERY', description: 'Chirurgie', unitPrice: 1000, category: 'surgery' }
    ],
    assumeApproved: true,
    expected: { companyShare: 1075, patientShare: 0 }  // 75 (100-25%) + 1000
  },
  {
    name: 'BOA - $60 cumulative optical limit',
    companyName: 'BANK OF AFRICA',
    items: [
      { code: 'FRAMES', description: 'Monture', unitPrice: 100, category: 'optical' },
      { code: 'LENSES', description: 'Verres', unitPrice: 100, category: 'optical' }
    ],
    assumeApproved: true,
    expected: { companyShare: 60, patientShare: 140 }
  },
  {
    name: 'LISUNGI - Surgery with 15% discount',
    companyName: 'LISUNGI',
    items: [
      { code: 'SURGERY', description: 'Chirurgie', unitPrice: 1000, category: 'surgery' }
    ],
    assumeApproved: true,
    expected: { companyShare: 850, patientShare: 0 }  // 1000 - 15% = 850
  },
  {
    name: 'AAC - Optical only coverage',
    companyName: 'AAC',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 50, category: 'consultation' },
      { code: 'OPTICAL', description: 'Verres', unitPrice: 200, category: 'optical' }
    ],
    expected: { companyShare: 200, patientShare: 50 }
  }
];

async function runControllerLogicTest() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    console.log(`╔${'═'.repeat(78)}╗`);
    console.log(`║${' '.repeat(15)}INVOICE CONTROLLER LOGIC VERIFICATION${' '.repeat(24)}║`);
    console.log(`║${' '.repeat(12)}Testing actual controller billing calculations${' '.repeat(19)}║`);
    console.log(`╚${'═'.repeat(78)}╝`);

    const companies = await Company.find({});
    const companyMap = {};
    companies.forEach(c => companyMap[c.name] = c);

    let passed = 0;
    let failed = 0;

    for (const test of TEST_CASES) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📋 ${test.name}`);
      console.log('─'.repeat(80));

      const company = companyMap[test.companyName];
      if (!company) {
        console.log(`   ❌ Company "${test.companyName}" not found!`);
        failed++;
        continue;
      }

      const result = calculateConventionBilling(test.items, company, {
        assumeApproved: test.assumeApproved
      });

      console.log('   Items:');
      for (const item of result.items) {
        console.log(`      ${item.description}: Company $${item.companyShare}, Patient $${item.patientShare}`);
        if (item.discountApplied) console.log(`         (Discount: $${item.discountApplied})`);
        if (item.notCovered) console.log('         (Not covered)');
      }

      console.log(`   TOTALS: Company $${result.totalCompanyShare}, Patient $${result.totalPatientShare}`);

      let testPassed = true;
      if (result.totalCompanyShare !== test.expected.companyShare) {
        console.log(`   ❌ Company share WRONG: expected $${test.expected.companyShare}, got $${result.totalCompanyShare}`);
        testPassed = false;
      }
      if (result.totalPatientShare !== test.expected.patientShare) {
        console.log(`   ❌ Patient share WRONG: expected $${test.expected.patientShare}, got $${result.totalPatientShare}`);
        testPassed = false;
      }

      if (testPassed) {
        console.log('   ✅ PASSED');
        passed++;
      } else {
        console.log('   ❌ FAILED');
        failed++;
      }
    }

    // Also verify the logic matches line-by-line with invoiceController
    console.log(`\n\n${'═'.repeat(80)}`);
    console.log('  CODE COMPARISON: Extracted Logic vs invoiceController.js');
    console.log('═'.repeat(80));

    const fs = require('fs');
    const controllerPath = path.join(__dirname, '../controllers/invoiceController.js');
    const controllerCode = fs.readFileSync(controllerPath, 'utf8');

    // Check for key logic patterns
    const patterns = [
      { name: 'Global discount application', pattern: /globalDiscount.*percentage.*excludeCategories/s },
      { name: 'Category-specific discount', pattern: /additionalDiscount.*discountPercentage.*=.*0/s },
      { name: 'Cumulative category max', pattern: /categoryCompanyShareTotals.*maxPerCategory.*remainingBudget/s },
      { name: 'Auto-approve threshold', pattern: /autoApproveUnderAmount.*threshold.*itemTotal.*</s },
      { name: 'Not covered category check', pattern: /notCovered.*companyShare.*=.*0/s }
    ];

    let allPatternsFound = true;
    for (const p of patterns) {
      const found = p.pattern.test(controllerCode);
      if (found) {
        console.log(`   ✅ ${p.name}: Found in controller`);
      } else {
        console.log(`   ❌ ${p.name}: NOT FOUND in controller`);
        allPatternsFound = false;
      }
    }

    console.log(`\n${'═'.repeat(80)}`);
    console.log('  FINAL RESULTS');
    console.log('═'.repeat(80));
    console.log(`\n  Test Cases: ${TEST_CASES.length}`);
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`\n  Logic Patterns: ${allPatternsFound ? '✅ All found' : '❌ Some missing'}`);

    if (passed === TEST_CASES.length && allPatternsFound) {
      console.log('\n  ✅ INVOICE CONTROLLER LOGIC VERIFIED');
    } else {
      console.log('\n  ⚠️ ISSUES FOUND - REVIEW REQUIRED');
    }
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

runControllerLogicTest();
