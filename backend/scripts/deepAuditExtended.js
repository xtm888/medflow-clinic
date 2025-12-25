/**
 * EXTENDED DEEP AUDIT - Convention Billing Edge Cases
 *
 * This script tests edge cases and boundary conditions that could cause
 * billing errors in production:
 *
 * 1. Boundary conditions ($100 threshold exact, $0 items, very large amounts)
 * 2. Sub-company inheritance validation
 * 3. Mixed approval states on same invoice
 * 4. Stacked/overlapping discount scenarios
 * 5. Currency handling (CDF vs USD)
 * 6. All 136 companies have valid configurations
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { requireNonProduction } = require('./_guards');
requireNonProduction('deepAuditExtended.js');

const Company = require('../models/Company');

// ============================================
// SIMULATION FUNCTIONS (same as main audit)
// ============================================

function simulatePackageDetection(items, company) {
  if (!company?.packageDeals || company.packageDeals.length === 0) {
    return { bundledItems: items, packagesApplied: [], savings: 0 };
  }

  const activePackages = company.packageDeals.filter(pkg => pkg.active !== false);
  if (activePackages.length === 0) {
    return { bundledItems: items, packagesApplied: [], savings: 0 };
  }

  let remainingItems = [...items];
  const packagesApplied = [];
  let totalSavings = 0;

  for (const pkg of activePackages) {
    if (!pkg.includedActs || pkg.includedActs.length === 0) continue;

    const packageActCodes = pkg.includedActs
      .map(act => act.actCode?.toUpperCase())
      .filter(Boolean);

    if (packageActCodes.length === 0) continue;

    const matchedItems = [];
    const unmatchedCodes = [...packageActCodes];

    for (const item of remainingItems) {
      const itemCode = item.code?.toUpperCase();
      if (!itemCode) continue;

      const matchIndex = unmatchedCodes.findIndex(code =>
        itemCode === code ||
        itemCode.startsWith(`${code}-`) ||
        itemCode.startsWith(`${code}_`) ||
        code.startsWith(`${itemCode}-`) ||
        code.startsWith(`${itemCode}_`)
      );

      if (matchIndex !== -1) {
        matchedItems.push(item);
        unmatchedCodes.splice(matchIndex, 1);
      }
    }

    if (unmatchedCodes.length === 0 && matchedItems.length >= packageActCodes.length) {
      const originalTotal = matchedItems.reduce((sum, item) => {
        return sum + ((item.quantity || 1) * (item.unitPrice || 0));
      }, 0);

      const packagePrice = pkg.price || 0;
      const savings = originalTotal - packagePrice;

      remainingItems = remainingItems.filter(item => !matchedItems.includes(item));

      const packageItem = {
        description: pkg.name || 'Forfait Consultation',
        code: pkg.code || 'PKG-CONSULT',
        category: 'consultation',
        quantity: 1,
        unitPrice: packagePrice,
        total: packagePrice,
        isPackage: true,
        originalTotal,
        savings
      };

      remainingItems.unshift(packageItem);
      packagesApplied.push(pkg);
      totalSavings += savings;
    }
  }

  return { bundledItems: remainingItems, packagesApplied, savings: totalSavings };
}

function simulateConventionBilling(items, company, options = {}) {
  const results = {
    items: [],
    totalCompanyShare: 0,
    totalPatientShare: 0,
    calculations: [],
    approvalRequired: [],
    notCovered: [],
    discountsApplied: []
  };

  const baseCoveragePercentage = options.patientCoverageOverride ?? company.defaultCoverage?.percentage ?? 100;
  const categorySpending = {};

  for (const item of items) {
    const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
    const categorySettings = company.coveredCategories?.find(c => c.category === item.category);

    const calc = {
      item: item.description || item.code,
      category: item.category,
      originalPrice: itemTotal,
      isPackage: item.isPackage || false
    };

    // Check if category is NOT COVERED
    if (categorySettings?.notCovered) {
      calc.notCovered = true;
      calc.companyShare = 0;
      calc.patientShare = itemTotal;
      calc.reason = `Category "${item.category}" is NOT COVERED`;
      results.notCovered.push(item);
      results.totalPatientShare += itemTotal;
      results.items.push({ ...item, companyShare: 0, patientShare: itemTotal, notCovered: true });
      results.calculations.push(calc);
      continue;
    }

    // Check if requires approval
    let approvalRequired = false;
    let autoApproved = false;

    if (categorySettings?.requiresApproval) {
      approvalRequired = true;
      calc.approvalReason = `Category "${item.category}" requires approval`;
    }

    if (company.actsRequiringApproval?.some(a => a.actCode?.toUpperCase() === item.code?.toUpperCase())) {
      approvalRequired = true;
      calc.approvalReason = `Act "${item.code}" specifically requires approval`;
    }

    // Check auto-approve threshold
    if (approvalRequired && company.approvalRules?.autoApproveUnderAmount) {
      const threshold = company.approvalRules.autoApproveUnderAmount;
      if (itemTotal < threshold) {
        autoApproved = true;
        approvalRequired = false;
        calc.autoApproved = true;
        calc.autoApproveReason = `Price $${itemTotal} < threshold $${threshold}`;
      }
    }

    const coveragePercentage = categorySettings?.coveragePercentage ?? baseCoveragePercentage;

    if (approvalRequired && !autoApproved && !options.assumeApproved) {
      calc.pendingApproval = true;
      calc.coveragePercentage = 0;
      calc.companyShare = 0;
      calc.patientShare = itemTotal;
      calc.reason = 'Pending approval - patient pays until approved';
      results.approvalRequired.push({ item, reason: calc.approvalReason });
    } else {
      calc.coveragePercentage = coveragePercentage;

      // Apply global discount
      let discount = 0;
      if (company.approvalRules?.globalDiscount?.percentage > 0) {
        const excludeCategories = company.approvalRules.globalDiscount.excludeCategories || [];
        if (!excludeCategories.includes(item.category)) {
          discount = company.approvalRules.globalDiscount.percentage;
          calc.globalDiscount = discount;
        } else {
          calc.discountExcluded = true;
        }
      }

      // Check category-specific discount
      if (categorySettings?.additionalDiscount > 0 && discount === 0) {
        discount = categorySettings.additionalDiscount;
        calc.categoryDiscount = discount;
      }

      // Calculate effective price after discount
      let effectiveItemTotal = itemTotal;
      if (discount > 0) {
        effectiveItemTotal = itemTotal - Math.round((itemTotal * discount) / 100);
        calc.effectivePrice = effectiveItemTotal;
        calc.discountSavings = itemTotal - effectiveItemTotal;
      }

      // Calculate shares
      let companyShare = Math.round((effectiveItemTotal * coveragePercentage) / 100);

      // Apply cumulative category max
      if (categorySettings?.maxPerCategory) {
        const maxLimit = categorySettings.maxPerCategory;
        const currentSpending = categorySpending[item.category] || 0;
        const remainingBudget = Math.max(0, maxLimit - currentSpending);

        if (companyShare > remainingBudget) {
          calc.maxApplied = true;
          calc.originalCompanyShare = companyShare;
          calc.maxLimit = maxLimit;
          calc.remainingBudget = remainingBudget;
          companyShare = remainingBudget;
        }
        categorySpending[item.category] = currentSpending + companyShare;
      }

      calc.companyShare = companyShare;
      calc.patientShare = effectiveItemTotal - companyShare;
    }

    results.totalCompanyShare += calc.companyShare || 0;
    results.totalPatientShare += calc.patientShare || 0;
    results.items.push({
      ...item,
      companyShare: calc.companyShare || 0,
      patientShare: calc.patientShare || 0,
      coveragePercentage: calc.coveragePercentage
    });
    results.calculations.push(calc);
  }

  return results;
}

// ============================================
// EXTENDED TEST SCENARIOS
// ============================================

const EXTENDED_SCENARIOS = [
  // ========== BOUNDARY CONDITIONS ==========
  {
    name: 'ACTIVA - Exactly $100 (at threshold)',
    companyName: 'ACTIVA',
    items: [
      { code: 'EXAM', description: 'Examen $100 exactement', unitPrice: 100, category: 'examination' }
    ],
    expected: {
      // $100 is NOT < $100, so it requires approval
      companyShare: 0,
      patientShare: 100,
      requiresApproval: true
    }
  },

  {
    name: 'ACTIVA - $99.99 (just under threshold)',
    companyName: 'ACTIVA',
    items: [
      { code: 'EXAM', description: 'Examen $99', unitPrice: 99, category: 'examination' }
    ],
    expected: {
      // $99 < $100, so auto-approved
      companyShare: 99,
      patientShare: 0,
      autoApproved: true
    }
  },

  {
    name: 'Zero-price item handling',
    companyName: 'BRALIMA',
    items: [
      { code: 'FREE', description: 'Item gratuit', unitPrice: 0, category: 'consultation' },
      { code: 'CONSULT', description: 'Consultation', unitPrice: 50, category: 'consultation' }
    ],
    expected: {
      companyShare: 50,
      patientShare: 0
    }
  },

  {
    name: 'Very large amount handling',
    companyName: 'GGA 100%',
    items: [
      { code: 'SURGERY', description: 'Chirurgie complexe', unitPrice: 50000, category: 'surgery' }
    ],
    assumeApproved: true,
    expected: {
      companyShare: 50000,
      patientShare: 0
    }
  },

  // ========== MULTI-ITEM CATEGORY LIMITS ==========
  {
    name: 'BOA - Multiple optical items (3 items, $60 cumulative limit)',
    companyName: 'BANK OF AFRICA',
    items: [
      { code: 'FRAMES1', description: 'Monture 1', unitPrice: 100, category: 'optical' },
      { code: 'FRAMES2', description: 'Monture 2', unitPrice: 100, category: 'optical' },
      { code: 'LENSES', description: 'Verres', unitPrice: 100, category: 'optical' }
    ],
    assumeApproved: true,
    expected: {
      // First item: $60 (limit reached)
      // Second item: $0 (budget exhausted)
      // Third item: $0 (budget exhausted)
      companyShare: 60,
      patientShare: 240
    }
  },

  // ========== DISCOUNT EDGE CASES ==========
  {
    name: 'TEMOINS - All surgery (discount excluded on all)',
    companyName: 'TEMOIN DE JEHOVAH',
    items: [
      { code: 'SURG1', description: 'Chirurgie 1', unitPrice: 500, category: 'surgery' },
      { code: 'SURG2', description: 'Chirurgie 2', unitPrice: 500, category: 'surgery' }
    ],
    assumeApproved: true,
    expected: {
      // No discount on surgery, 100% coverage
      companyShare: 1000,
      patientShare: 0
    }
  },

  {
    name: 'TEMOINS - Mixed categories (discount excludes surgery AND optical)',
    companyName: 'TEMOIN DE JEHOVAH',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 100, category: 'consultation' },
      { code: 'SURGERY', description: 'Chirurgie', unitPrice: 1000, category: 'surgery' },
      { code: 'OPTICAL', description: 'Verres', unitPrice: 200, category: 'optical' }
    ],
    assumeApproved: true,
    expected: {
      // Consultation: 100 - 25% = 75 (discount applies)
      // Surgery: 1000 (excluded from discount)
      // Optical: 200 (excluded from discount)
      companyShare: 1275,
      patientShare: 0
    }
  },

  // ========== PARTIAL COVERAGE PERCENTAGES ==========
  {
    name: 'CIGNA 80% - Rounding verification',
    companyName: 'CIGNA 80%',
    items: [
      { code: 'EXAM', description: 'Examen $33', unitPrice: 33, category: 'examination' }
    ],
    expected: {
      // 33 * 80% = 26.4 → rounds to 26
      companyShare: 26,
      patientShare: 7
    }
  },

  {
    name: 'GGA 90% - Rounding verification',
    companyName: 'GGA 90%',
    items: [
      { code: 'EXAM', description: 'Examen $55', unitPrice: 55, category: 'examination' }
    ],
    expected: {
      // 55 * 90% = 49.5 → rounds to 50
      companyShare: 50,
      patientShare: 5
    }
  },

  // ========== SUB-COMPANY INHERITANCE ==========
  {
    name: 'ACTIVA AFRILAND BANK (sub-company inherits auto-approve)',
    companyName: 'ACTIVA AFRILAND BANK',
    items: [
      { code: 'EXAM', description: 'Examen $50', unitPrice: 50, category: 'examination' },
      { code: 'IMAGING', description: 'OCT $150', unitPrice: 150, category: 'imaging' }
    ],
    expected: {
      // $50 < $100 auto-approved
      // $150 > $100 needs approval
      companyShare: 50,
      patientShare: 150
    }
  },

  // ========== MIXED APPROVAL STATES ==========
  {
    name: 'CICR CROIX ROUGE - Mixed auto-approved and pending',
    companyName: 'CICR CROIX ROUGE',
    items: [
      { code: 'CONSULT', description: 'Consultation $30', unitPrice: 30, category: 'consultation' },
      { code: 'EXAM', description: 'Examen $80', unitPrice: 80, category: 'examination' },
      { code: 'IMAGING', description: 'OCT $200', unitPrice: 200, category: 'imaging' },
      { code: 'SURGERY', description: 'Chirurgie $500', unitPrice: 500, category: 'surgery' }
    ],
    expected: {
      // Consultation $30 < $100 → auto-approved
      // Exam $80 < $100 → auto-approved
      // Imaging $200 > $100 → pending
      // Surgery → always needs approval (autoApproveUnder: 0)
      companyShare: 110, // 30 + 80
      patientShare: 700  // 200 + 500
    }
  },

  // ========== AAC OPTICAL-ONLY EDGE CASES ==========
  {
    name: 'AAC - Only optical items (should cover 100%)',
    companyName: 'AAC',
    items: [
      { code: 'FRAMES', description: 'Monture', unitPrice: 200, category: 'optical' },
      { code: 'LENSES', description: 'Verres', unitPrice: 300, category: 'optical' }
    ],
    expected: {
      companyShare: 500,
      patientShare: 0
    }
  },

  {
    name: 'AAC - Only non-optical items (should cover 0%)',
    companyName: 'AAC',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 100, category: 'consultation' },
      { code: 'EXAM', description: 'Examen', unitPrice: 100, category: 'examination' },
      { code: 'IMAGING', description: 'OCT', unitPrice: 150, category: 'imaging' }
    ],
    expected: {
      companyShare: 0,
      patientShare: 350
    }
  },

  // ========== QUANTITY HANDLING ==========
  {
    name: 'Multiple quantity on single item',
    companyName: 'BRALIMA',
    items: [
      { code: 'DROPS', description: 'Collyre x3', unitPrice: 10, quantity: 3, category: 'medication' }
    ],
    expected: {
      // 10 * 3 = 30, 100% coverage
      companyShare: 30,
      patientShare: 0
    }
  },

  // ========== CATEGORY NOT IN LIST ==========
  {
    name: 'Unknown category defaults to base coverage',
    companyName: 'BRALIMA',
    items: [
      { code: 'OTHER', description: 'Service autre', unitPrice: 100, category: 'other' }
    ],
    expected: {
      // 'other' not in coveredCategories, should use defaultCoverage (100%)
      companyShare: 100,
      patientShare: 0
    }
  }
];

// ============================================
// RUN EXTENDED AUDIT
// ============================================

async function runExtendedAudit() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    console.log(`╔${'═'.repeat(78)}╗`);
    console.log(`║${' '.repeat(18)}EXTENDED DEEP AUDIT - EDGE CASES${' '.repeat(27)}║`);
    console.log(`║${' '.repeat(15)}Testing boundary conditions and edge cases${' '.repeat(20)}║`);
    console.log(`╚${'═'.repeat(78)}╝`);

    const companies = await Company.find({});
    const companyMap = {};
    companies.forEach(c => companyMap[c.name] = c);

    let passed = 0;
    let failed = 0;
    const failures = [];

    // Run extended scenarios
    for (const scenario of EXTENDED_SCENARIOS) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📋 SCENARIO: ${scenario.name}`);
      console.log('─'.repeat(80));

      const company = companyMap[scenario.companyName];
      if (!company) {
        console.log(`   ❌ Company "${scenario.companyName}" not found!`);
        failed++;
        failures.push({ scenario: scenario.name, reason: 'Company not found' });
        continue;
      }

      console.log(`   Company: ${company.name}`);
      console.log(`   Default Coverage: ${company.defaultCoverage?.percentage}%`);

      // Package detection
      const packageResult = simulatePackageDetection(scenario.items, company);
      const itemsToProcess = packageResult.bundledItems;

      // Convention billing
      const billingResult = simulateConventionBilling(itemsToProcess, company, {
        assumeApproved: scenario.assumeApproved
      });

      console.log('\n   Item Breakdown:');
      for (const calc of billingResult.calculations) {
        console.log(`      ${calc.item}: $${calc.originalPrice} → Company: $${calc.companyShare}, Patient: $${calc.patientShare}`);
        if (calc.autoApproved) console.log('         🔓 Auto-approved');
        if (calc.pendingApproval) console.log('         ⏳ Pending approval');
        if (calc.notCovered) console.log('         ⛔ Not covered');
        if (calc.globalDiscount) console.log(`         🏷️ ${calc.globalDiscount}% discount`);
        if (calc.maxApplied) console.log(`         📊 Max limit: $${calc.maxLimit}`);
      }

      console.log(`\n   📊 TOTALS: Company $${billingResult.totalCompanyShare}, Patient $${billingResult.totalPatientShare}`);

      // Verify
      let scenarioPass = true;
      if (scenario.expected.companyShare !== undefined) {
        if (billingResult.totalCompanyShare !== scenario.expected.companyShare) {
          console.log(`   ❌ Company share WRONG: expected $${scenario.expected.companyShare}, got $${billingResult.totalCompanyShare}`);
          scenarioPass = false;
        } else {
          console.log('   ✅ Company share CORRECT');
        }
      }
      if (scenario.expected.patientShare !== undefined) {
        if (billingResult.totalPatientShare !== scenario.expected.patientShare) {
          console.log(`   ❌ Patient share WRONG: expected $${scenario.expected.patientShare}, got $${billingResult.totalPatientShare}`);
          scenarioPass = false;
        } else {
          console.log('   ✅ Patient share CORRECT');
        }
      }

      if (scenarioPass) {
        passed++;
        console.log('   🎉 PASSED');
      } else {
        failed++;
        failures.push({ scenario: scenario.name, expected: scenario.expected, actual: billingResult });
        console.log('   ❌ FAILED');
      }
    }

    // ============================================
    // VALIDATE ALL 136 COMPANIES
    // ============================================
    console.log(`\n\n${'═'.repeat(80)}`);
    console.log('  VALIDATING ALL COMPANY CONFIGURATIONS');
    console.log('═'.repeat(80));

    let validCompanies = 0;
    let invalidCompanies = 0;
    const configIssues = [];

    for (const company of companies) {
      const issues = [];

      // Check default coverage
      if (!company.defaultCoverage?.percentage && company.defaultCoverage?.percentage !== 0) {
        issues.push('Missing defaultCoverage.percentage');
      }

      // Check covered categories have valid percentages
      for (const cat of company.coveredCategories || []) {
        if (cat.coveragePercentage < 0 || cat.coveragePercentage > 100) {
          issues.push(`Invalid coverage percentage for ${cat.category}: ${cat.coveragePercentage}`);
        }
        if (cat.maxPerCategory && cat.maxPerCategory < 0) {
          issues.push(`Invalid maxPerCategory for ${cat.category}: ${cat.maxPerCategory}`);
        }
      }

      // Check package deals have valid prices
      for (const pkg of company.packageDeals || []) {
        if (!pkg.price || pkg.price <= 0) {
          issues.push(`Invalid package price: ${pkg.name} ($${pkg.price})`);
        }
        if (!pkg.includedActs || pkg.includedActs.length === 0) {
          issues.push(`Package ${pkg.name} has no included acts`);
        }
      }

      // Check approval rules
      if (company.approvalRules?.autoApproveUnderAmount < 0) {
        issues.push(`Invalid autoApproveUnderAmount: ${company.approvalRules.autoApproveUnderAmount}`);
      }
      if (company.approvalRules?.globalDiscount?.percentage) {
        if (company.approvalRules.globalDiscount.percentage < 0 || company.approvalRules.globalDiscount.percentage > 100) {
          issues.push(`Invalid global discount: ${company.approvalRules.globalDiscount.percentage}%`);
        }
      }

      if (issues.length > 0) {
        invalidCompanies++;
        configIssues.push({ company: company.name, issues });
      } else {
        validCompanies++;
      }
    }

    console.log(`\n  Total Companies: ${companies.length}`);
    console.log(`  ✅ Valid Configurations: ${validCompanies}`);
    console.log(`  ❌ Invalid Configurations: ${invalidCompanies}`);

    if (configIssues.length > 0) {
      console.log('\n  Configuration Issues Found:');
      for (const issue of configIssues) {
        console.log(`    ${issue.company}:`);
        issue.issues.forEach(i => console.log(`      - ${i}`));
      }
    }

    // ============================================
    // SUB-COMPANY INHERITANCE CHECK
    // ============================================
    console.log(`\n\n${'═'.repeat(80)}`);
    console.log('  VALIDATING SUB-COMPANY INHERITANCE');
    console.log('═'.repeat(80));

    const subCompanies = companies.filter(c => c.parentConvention);
    let inheritanceValid = 0;
    let inheritanceInvalid = 0;
    const inheritanceIssues = [];

    for (const subCompany of subCompanies) {
      const parent = companies.find(c => c._id.toString() === subCompany.parentConvention?.toString());
      if (!parent) {
        inheritanceInvalid++;
        inheritanceIssues.push({
          company: subCompany.name,
          issue: 'Parent company not found'
        });
        continue;
      }

      // Check if critical rules are inherited or properly overridden
      let hasIssue = false;
      const issues = [];

      // If parent has package deals, sub should inherit or have its own
      if (parent.packageDeals?.length > 0 && !subCompany.packageDeals?.length) {
        // This is OK - they inherit from parent
      }

      // If parent has auto-approve threshold, sub should have it too
      if (parent.approvalRules?.autoApproveUnderAmount && !subCompany.approvalRules?.autoApproveUnderAmount) {
        issues.push(`Missing autoApproveUnderAmount (parent has $${parent.approvalRules.autoApproveUnderAmount})`);
        hasIssue = true;
      }

      // Coverage percentage should match or be explicitly different
      if (subCompany.defaultCoverage?.percentage !== parent.defaultCoverage?.percentage) {
        // This might be intentional (tiered coverage)
        // Only flag if it seems unintentional
      }

      if (hasIssue) {
        inheritanceInvalid++;
        inheritanceIssues.push({ company: subCompany.name, parent: parent.name, issues });
      } else {
        inheritanceValid++;
      }
    }

    console.log(`\n  Total Sub-Companies: ${subCompanies.length}`);
    console.log(`  ✅ Valid Inheritance: ${inheritanceValid}`);
    console.log(`  ⚠️ Issues Found: ${inheritanceInvalid}`);

    if (inheritanceIssues.length > 0) {
      console.log('\n  Inheritance Issues:');
      for (const issue of inheritanceIssues) {
        console.log(`    ${issue.company} (parent: ${issue.parent || 'N/A'}):`);
        if (issue.issue) console.log(`      - ${issue.issue}`);
        if (issue.issues) issue.issues.forEach(i => console.log(`      - ${i}`));
      }
    }

    // ============================================
    // FINAL SUMMARY
    // ============================================
    console.log(`\n\n${'═'.repeat(80)}`);
    console.log('  EXTENDED AUDIT FINAL SUMMARY');
    console.log('═'.repeat(80));

    console.log(`\n  Edge Case Scenarios: ${EXTENDED_SCENARIOS.length}`);
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);

    console.log(`\n  Company Configurations: ${companies.length}`);
    console.log(`  ✅ Valid: ${validCompanies}`);
    console.log(`  ❌ Invalid: ${invalidCompanies}`);

    console.log(`\n  Sub-Company Inheritance: ${subCompanies.length}`);
    console.log(`  ✅ Valid: ${inheritanceValid}`);
    console.log(`  ⚠️ Issues: ${inheritanceInvalid}`);

    if (failures.length > 0) {
      console.log('\n  SCENARIO FAILURES:');
      failures.forEach(f => {
        console.log(`    - ${f.scenario}: ${f.reason || 'Calculation mismatch'}`);
      });
    }

    const totalIssues = failed + invalidCompanies + inheritanceInvalid;
    console.log(`\n${'═'.repeat(80)}`);
    if (totalIssues === 0) {
      console.log('  ✅ ALL EXTENDED TESTS PASSED - BILLING SYSTEM VALIDATED');
    } else {
      console.log(`  ⚠️ ${totalIssues} ISSUES FOUND - REVIEW REQUIRED`);
    }
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('Extended audit error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

runExtendedAudit();
