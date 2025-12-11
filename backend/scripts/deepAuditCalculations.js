/**
 * DEEP AUDIT - Convention Billing Calculations
 *
 * This script simulates REAL invoice scenarios for every convention type
 * and traces through every calculation step to verify correctness.
 *
 * Tests:
 * 1. Package deal auto-detection and bundling
 * 2. Coverage percentage calculations
 * 3. Category exclusions (CIGNA/GGA no optical, AAC optical-only)
 * 4. Auto-approve thresholds (ACTIVA/CICR $100)
 * 5. Global discounts (TEMOINS DE JEHOVAH 25%)
 * 6. Surgery discounts (LISUNGI 15%)
 * 7. Tiered coverage (CIGNA 80%/100%, GGA 80%/90%/100%)
 * 8. Frame limits (BOA $60)
 * 9. Approval workflow logic
 * 10. Parent-child company inheritance
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Company = require('../models/Company');

// ============================================
// SIMULATION FUNCTIONS (mirror invoiceController logic)
// ============================================

/**
 * Simulates applyPackageDeals from invoiceController
 */
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
        itemCode.startsWith(code + '-') ||
        itemCode.startsWith(code + '_') ||
        code.startsWith(itemCode + '-') ||
        code.startsWith(itemCode + '_')
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

/**
 * Simulates convention billing calculation from invoiceController
 */
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

  // Track cumulative category spending for maxPerCategory limits
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

    // Check category-level approval
    if (categorySettings?.requiresApproval) {
      approvalRequired = true;
      calc.approvalReason = `Category "${item.category}" requires approval`;
    }

    // Check specific acts requiring approval
    if (company.actsRequiringApproval?.some(a => a.actCode?.toUpperCase() === item.code?.toUpperCase())) {
      approvalRequired = true;
      calc.approvalReason = `Act "${item.code}" specifically requires approval`;
    }

    // Check auto-approve threshold
    if (approvalRequired && company.approvalRules?.autoApproveUnderAmount) {
      const threshold = company.approvalRules.autoApproveUnderAmount;
      // Assume USD for simplicity
      if (itemTotal < threshold) {
        autoApproved = true;
        approvalRequired = false;
        calc.autoApproved = true;
        calc.autoApproveReason = `Price $${itemTotal} < threshold $${threshold}`;
      }
    }

    // Calculate coverage
    let coveragePercentage = categorySettings?.coveragePercentage ?? baseCoveragePercentage;

    // If approval required and not auto-approved, no coverage (would need manual approval)
    if (approvalRequired && !autoApproved && !options.assumeApproved) {
      calc.pendingApproval = true;
      calc.coveragePercentage = 0;
      calc.companyShare = 0;
      calc.patientShare = itemTotal;
      calc.reason = 'Pending approval - patient pays until approved';
      results.approvalRequired.push({ item, reason: calc.approvalReason });
    } else {
      calc.coveragePercentage = coveragePercentage;

      // Apply global discount if applicable
      let discount = 0;
      if (company.approvalRules?.globalDiscount?.percentage) {
        const excludeCategories = company.approvalRules.globalDiscount.excludeCategories || [];
        if (!excludeCategories.includes(item.category)) {
          discount = company.approvalRules.globalDiscount.percentage;
          calc.globalDiscount = discount;
          results.discountsApplied.push({
            item: item.description,
            discount: `${discount}%`,
            reason: 'Global convention discount'
          });
        } else {
          calc.discountExcluded = true;
          calc.discountExcludeReason = `Category "${item.category}" excluded from discount`;
        }
      }

      // Check category-specific discount (e.g., LISUNGI 15% surgery)
      if (categorySettings?.additionalDiscount > 0 && discount === 0) {
        discount = categorySettings.additionalDiscount;
        calc.categoryDiscount = discount;
        results.discountsApplied.push({
          item: item.description,
          discount: `${discount}%`,
          reason: `Category-specific discount for "${item.category}"`
        });
      }

      // Calculate effective price after discount
      let effectiveItemTotal = itemTotal;
      if (discount > 0) {
        effectiveItemTotal = itemTotal - Math.round((itemTotal * discount) / 100);
        calc.effectivePrice = effectiveItemTotal;
        calc.discountSavings = itemTotal - effectiveItemTotal;
      }

      // Calculate shares based on effective price
      let companyShare = Math.round((effectiveItemTotal * coveragePercentage) / 100);

      // Apply cumulative category max if set
      if (categorySettings?.maxPerCategory) {
        const maxLimit = categorySettings.maxPerCategory;
        const currentSpending = categorySpending[item.category] || 0;
        const remainingBudget = Math.max(0, maxLimit - currentSpending);

        if (companyShare > remainingBudget) {
          calc.maxApplied = true;
          calc.originalCompanyShare = companyShare;
          calc.maxLimit = maxLimit;
          calc.remainingBudget = remainingBudget;
          calc.cumulativeSpending = currentSpending;
          companyShare = remainingBudget;
        }

        // Track cumulative spending
        categorySpending[item.category] = currentSpending + companyShare;
      }

      calc.companyShare = companyShare;
      calc.patientShare = effectiveItemTotal - companyShare; // Patient pays effective price minus company share
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
// TEST SCENARIOS
// ============================================

const TEST_SCENARIOS = [
  // ========== SCENARIO 1: BRALIMA $65 PACKAGE ==========
  {
    name: 'BRALIMA - $65 Package Auto-Detection',
    companyName: 'BRALIMA',
    items: [
      { code: 'CONSULT', description: 'Consultation ophtalmologique', unitPrice: 30, category: 'consultation' },
      { code: 'REFRACTO', description: 'Réfractométrie', unitPrice: 20, category: 'examination' },
      { code: 'TONO', description: 'Tonométrie', unitPrice: 25, category: 'examination' },
      { code: 'BIOMICRO', description: 'Biomicroscopie', unitPrice: 20, category: 'examination' },
      { code: 'FOND-ND', description: 'Fond d\'oeil non dilaté', unitPrice: 30, category: 'examination' },
      { code: 'FLUORO', description: 'Test fluorescéine', unitPrice: 15, category: 'examination' }
    ],
    expected: {
      packageApplied: true,
      packagePrice: 65,
      originalTotal: 140,
      savings: 75,
      companyShare: 65, // 100% coverage
      patientShare: 0
    }
  },

  // ========== SCENARIO 2: MSO KINSHASA $65 PACKAGE ==========
  {
    name: 'MSO KINSHASA - $65 Package (with RETINO)',
    companyName: 'MSO KINSHASA',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 30, category: 'consultation' },
      { code: 'REFRACTO', description: 'Réfraction', unitPrice: 25, category: 'examination' },
      { code: 'TONO', description: 'Tonométrie', unitPrice: 25, category: 'examination' },
      { code: 'FLUORO', description: 'Test fluorescéine', unitPrice: 15, category: 'examination' },
      { code: 'KERATO', description: 'Kératométrie', unitPrice: 30, category: 'examination' },
      { code: 'RETINO', description: 'Rétinographie', unitPrice: 50, category: 'imaging' }
    ],
    expected: {
      packageApplied: true,
      packagePrice: 65,
      originalTotal: 175,
      savings: 110,
      companyShare: 65,
      patientShare: 0
    }
  },

  // ========== SCENARIO 3: AAC - OPTICAL ONLY ==========
  {
    name: 'AAC - Optical Only (Consultation NOT covered)',
    companyName: 'AAC',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 50, category: 'consultation' },
      { code: 'EXAM', description: 'Examen', unitPrice: 30, category: 'examination' },
      { code: 'FRAMES', description: 'Monture', unitPrice: 150, category: 'optical' },
      { code: 'LENSES', description: 'Verres', unitPrice: 200, category: 'optical' }
    ],
    expected: {
      notCoveredItems: ['consultation', 'examination'],
      coveredItems: ['optical'],
      companyShare: 350, // Only optical (150 + 200)
      patientShare: 80  // consultation + examination (50 + 30)
    }
  },

  // ========== SCENARIO 4: CIGNA 80% - No Optical ==========
  {
    name: 'CIGNA 80% - Tiered Coverage, No Optical',
    companyName: 'CIGNA 80%',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 100, category: 'consultation' },
      { code: 'OCT', description: 'OCT Scan', unitPrice: 150, category: 'imaging' },
      { code: 'FRAMES', description: 'Monture', unitPrice: 200, category: 'optical' }
    ],
    expected: {
      opticalExcluded: true,
      coveragePercentage: 80,
      // Consultation: 100 * 80% = 80 company, 20 patient
      // OCT: 150 * 80% = 120 company, 30 patient
      // Optical: NOT COVERED - 0 company, 200 patient
      companyShare: 200, // 80 + 120 + 0
      patientShare: 250  // 20 + 30 + 200
    }
  },

  // ========== SCENARIO 5: CIGNA 100% - No Optical ==========
  {
    name: 'CIGNA 100% - Full Coverage, No Optical',
    companyName: 'CIGNA 100%',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 100, category: 'consultation' },
      { code: 'OCT', description: 'OCT Scan', unitPrice: 150, category: 'imaging' },
      { code: 'FRAMES', description: 'Monture', unitPrice: 200, category: 'optical' }
    ],
    expected: {
      opticalExcluded: true,
      coveragePercentage: 100,
      // Consultation: 100 * 100% = 100 company, 0 patient
      // OCT: 150 * 100% = 150 company, 0 patient
      // Optical: NOT COVERED - 0 company, 200 patient
      companyShare: 250, // 100 + 150 + 0
      patientShare: 200  // 0 + 0 + 200
    }
  },

  // ========== SCENARIO 6: GGA 90% - Tiered No Optical ==========
  {
    name: 'GGA 90% - 90% Coverage, No Optical',
    companyName: 'GGA 90%',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 100, category: 'consultation' },
      { code: 'SURGERY', description: 'Chirurgie cataracte', unitPrice: 1000, category: 'surgery' }
    ],
    assumeApproved: true, // Assume surgery was pre-approved
    expected: {
      coveragePercentage: 90,
      // Consultation: 100 * 90% = 90 company, 10 patient
      // Surgery: 1000 * 90% = 900 company, 100 patient
      companyShare: 990,
      patientShare: 110
    }
  },

  // ========== SCENARIO 7: ACTIVA - Auto-Approve Under $100 ==========
  {
    name: 'ACTIVA - Auto-Approve < $100',
    companyName: 'ACTIVA',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 50, category: 'consultation' },
      { code: 'TONO', description: 'Tonométrie', unitPrice: 30, category: 'examination' },
      { code: 'OCT', description: 'OCT (expensive)', unitPrice: 150, category: 'imaging' }
    ],
    expected: {
      autoApproveThreshold: 100,
      // All categories now have requiresApproval: true, so threshold applies
      // Consultation $50 < $100 → auto-approved, 100% = 50 company
      // Tono $30 < $100 → auto-approved, 100% = 30 company
      // OCT $150 > $100 → needs approval (pending)
      autoApprovedItems: ['CONSULT', 'TONO'],
      pendingApprovalItems: ['OCT'],
      companyShare: 80, // 50 + 30 (OCT pending)
      patientShare: 150 // OCT pending until approved
    }
  },

  // ========== SCENARIO 8: TEMOINS DE JEHOVAH - 25% Discount ==========
  {
    name: 'TEMOINS DE JEHOVAH - 25% Discount (excl. surgery)',
    companyName: 'TEMOIN DE JEHOVAH',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 100, category: 'consultation' },
      { code: 'EXAM', description: 'Examen complet', unitPrice: 200, category: 'examination' },
      { code: 'SURGERY', description: 'Chirurgie', unitPrice: 1000, category: 'surgery' }
    ],
    assumeApproved: true,
    expected: {
      globalDiscount: 25,
      discountExcludes: ['surgery'],
      // Consultation: 100 - 25% = 75 effective, 100% coverage = 75 company, 0 patient
      // Examination: 200 - 25% = 150 effective, 100% coverage = 150 company, 0 patient
      // Surgery: NO DISCOUNT (excluded), 100% coverage = 1000 company, 0 patient
      // Total company: 75 + 150 + 1000 = 1225
      // Total patient: 0
      companyShare: 1225,
      patientShare: 0,
      discountSavings: 75 // 25% off 300 (consult + exam)
    }
  },

  // ========== SCENARIO 9: LISUNGI - $65 Package + 15% Surgery Discount ==========
  {
    name: 'LISUNGI - $65 Package + 15% Surgery Discount',
    companyName: 'LISUNGI',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 30, category: 'consultation' },
      { code: 'REFRACTO', description: 'Réfraction', unitPrice: 25, category: 'examination' },
      { code: 'TONO', description: 'Tonométrie', unitPrice: 25, category: 'examination' },
      { code: 'FLUORO', description: 'Test fluorescéine', unitPrice: 15, category: 'examination' },
      { code: 'KERATO', description: 'Kératométrie', unitPrice: 30, category: 'examination' },
      { code: 'RETINO', description: 'Rétinographie', unitPrice: 50, category: 'imaging' },
      { code: 'CATARACT', description: 'Chirurgie cataracte', unitPrice: 1000, category: 'surgery' }
    ],
    assumeApproved: true,
    expected: {
      packageApplied: true,
      packagePrice: 65,
      surgeryDiscount: 15, // 15% off surgery = 1000 * 0.85 = 850
      // Package: $65 → 100% coverage = 65 company
      // Surgery: $1000 - 15% = $850 → 100% coverage = 850 company
      companyShare: 915, // 65 + 850
      patientShare: 0
    }
  },

  // ========== SCENARIO 10: PACTILIS - Restrictive Approval ==========
  {
    name: 'PACTILIS - Only Consultation + Pharmacy Auto',
    companyName: 'PACTILIS',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 50, category: 'consultation' },
      { code: 'MEDS', description: 'Médicaments', unitPrice: 30, category: 'medication' },
      { code: 'EXAM', description: 'Examen biomicroscopie', unitPrice: 40, category: 'examination' },
      { code: 'OCT', description: 'OCT', unitPrice: 100, category: 'imaging' }
    ],
    expected: {
      autoItems: ['consultation', 'medication'],
      pendingApprovalItems: ['examination', 'imaging'],
      // Consultation: auto, 100% = 50 company
      // Medication: auto, 100% = 30 company
      // Examination: needs approval → pending
      // Imaging: needs approval → pending
      companyShare: 80,  // 50 + 30
      patientShare: 140  // 40 + 100 (pending)
    }
  },

  // ========== SCENARIO 11: BOA - Frame Limit $60 ==========
  {
    name: 'BOA - $60 Frame Limit',
    companyName: 'BANK OF AFRICA',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 50, category: 'consultation' },
      { code: 'FRAMES', description: 'Monture premium', unitPrice: 150, category: 'optical' },
      { code: 'LENSES', description: 'Verres progressifs', unitPrice: 200, category: 'optical' }
    ],
    assumeApproved: true,
    expected: {
      frameLimit: 60,
      // Consultation: 100% = 50 company
      // Optical (frames + lenses = 350): Limited to $60 for frames portion
      // Actually the limit is per category, so optical max = $60
      companyShare: 110, // 50 + 60 (capped)
      patientShare: 290  // 0 + 290 (excess optical)
    }
  },

  // ========== SCENARIO 12: PARTIAL PACKAGE (should NOT bundle) ==========
  {
    name: 'BRALIMA - Partial Package (3 of 6 acts)',
    companyName: 'BRALIMA',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 30, category: 'consultation' },
      { code: 'REFRACTO', description: 'Réfractométrie', unitPrice: 20, category: 'examination' },
      { code: 'TONO', description: 'Tonométrie', unitPrice: 25, category: 'examination' }
      // Missing: BIOMICRO, FOND-ND, FLUORO
    ],
    expected: {
      packageApplied: false,
      // No package, individual pricing
      companyShare: 75, // 30 + 20 + 25
      patientShare: 0
    }
  },

  // ========== SCENARIO 13: SUB-COMPANY INHERITANCE ==========
  {
    name: 'MSO VODACOM - Inherits from MSO parent',
    companyName: 'MSO VODACOM',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 50, category: 'consultation' },
      { code: 'OCT', description: 'OCT', unitPrice: 100, category: 'imaging' }
    ],
    expected: {
      inheritsFrom: 'MSO',
      companyShare: 150, // Should inherit 100% coverage
      patientShare: 0
    }
  },

  // ========== SCENARIO 14: ACTIVA SUB-COMPANY ==========
  {
    name: 'ACTIVA GIZ - Inherits Auto-Approve $100',
    companyName: 'ACTIVA GIZ',
    items: [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 80, category: 'consultation' },
      { code: 'PROCEDURE', description: 'Procédure laser', unitPrice: 200, category: 'procedure' }
    ],
    expected: {
      inheritsFrom: 'ACTIVA',
      autoApproveThreshold: 100,
      // Consultation $80 < $100 → auto, 100% = 80
      // Procedure $200 > $100 → pending
      companyShare: 80,
      patientShare: 200
    }
  }
];

// ============================================
// RUN DEEP AUDIT
// ============================================

async function runDeepAudit() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    console.log('╔' + '═'.repeat(78) + '╗');
    console.log('║' + ' '.repeat(20) + 'DEEP AUDIT - BILLING CALCULATIONS' + ' '.repeat(23) + '║');
    console.log('║' + ' '.repeat(15) + 'Tracing every calculation step in detail' + ' '.repeat(22) + '║');
    console.log('╚' + '═'.repeat(78) + '╝');

    const companies = await Company.find({});
    const companyMap = {};
    companies.forEach(c => companyMap[c.name] = c);

    let passed = 0;
    let failed = 0;
    const failures = [];

    for (const scenario of TEST_SCENARIOS) {
      console.log('\n' + '─'.repeat(80));
      console.log(`📋 SCENARIO: ${scenario.name}`);
      console.log('─'.repeat(80));

      const company = companyMap[scenario.companyName];
      if (!company) {
        console.log(`   ❌ Company "${scenario.companyName}" not found!`);
        failed++;
        failures.push({ scenario: scenario.name, reason: 'Company not found' });
        continue;
      }

      console.log(`\n   Company: ${company.name}`);
      console.log(`   Default Coverage: ${company.defaultCoverage?.percentage}%`);
      console.log(`   Package Deals: ${company.packageDeals?.length || 0}`);
      if (company.approvalRules?.autoApproveUnderAmount) {
        console.log(`   Auto-Approve Under: $${company.approvalRules.autoApproveUnderAmount}`);
      }
      if (company.approvalRules?.globalDiscount?.percentage) {
        console.log(`   Global Discount: ${company.approvalRules.globalDiscount.percentage}%`);
      }

      // Step 1: Package Detection
      console.log('\n   📦 STEP 1: Package Detection');
      const packageResult = simulatePackageDetection(scenario.items, company);

      if (packageResult.packagesApplied.length > 0) {
        const pkg = packageResult.packagesApplied[0];
        console.log(`      ✓ Package APPLIED: "${pkg.name}" ($${pkg.price})`);
        console.log(`      ✓ Original total: $${packageResult.bundledItems[0]?.originalTotal || 'N/A'}`);
        console.log(`      ✓ Savings: $${packageResult.savings}`);

        if (scenario.expected.packageApplied === true) {
          if (pkg.price === scenario.expected.packagePrice) {
            console.log(`      ✅ Package price CORRECT: $${pkg.price}`);
          } else {
            console.log(`      ❌ Package price WRONG: expected $${scenario.expected.packagePrice}, got $${pkg.price}`);
          }
        }
      } else {
        console.log(`      → No package applied`);
        if (scenario.expected.packageApplied === false) {
          console.log(`      ✅ Correctly did NOT apply package`);
        } else if (scenario.expected.packageApplied === true) {
          console.log(`      ❌ Package should have been applied!`);
        }
      }

      // Step 2: Convention Billing
      console.log('\n   💰 STEP 2: Convention Billing Calculation');
      const itemsToProcess = packageResult.bundledItems;
      const billingResult = simulateConventionBilling(itemsToProcess, company, {
        assumeApproved: scenario.assumeApproved
      });

      console.log('\n   Item-by-Item Breakdown:');
      console.log('   ' + '─'.repeat(70));

      for (const calc of billingResult.calculations) {
        console.log(`\n      ${calc.item} (${calc.category})`);
        console.log(`         Original Price: $${calc.originalPrice}`);

        if (calc.isPackage) {
          console.log(`         📦 This is a PACKAGE item`);
        }

        if (calc.notCovered) {
          console.log(`         ⛔ NOT COVERED: ${calc.reason}`);
          console.log(`         → Patient pays: $${calc.patientShare}`);
        } else if (calc.pendingApproval) {
          console.log(`         ⏳ PENDING APPROVAL: ${calc.approvalReason}`);
          console.log(`         → Patient pays until approved: $${calc.patientShare}`);
        } else {
          console.log(`         Coverage: ${calc.coveragePercentage}%`);
          if (calc.autoApproved) {
            console.log(`         🔓 Auto-approved: ${calc.autoApproveReason}`);
          }
          if (calc.globalDiscount) {
            console.log(`         🏷️ Global discount: ${calc.globalDiscount}%`);
          }
          if (calc.discountExcluded) {
            console.log(`         ⚠️ Discount excluded: ${calc.discountExcludeReason}`);
          }
          if (calc.maxApplied) {
            console.log(`         📊 Max limit applied: $${calc.maxLimit} (was $${calc.originalCompanyShare})`);
          }
          console.log(`         → Company: $${calc.companyShare} | Patient: $${calc.patientShare}`);
        }
      }

      // Summary
      console.log('\n   ' + '─'.repeat(70));
      console.log(`\n   📊 SUMMARY:`);
      console.log(`      Total Company Share: $${billingResult.totalCompanyShare}`);
      console.log(`      Total Patient Share: $${billingResult.totalPatientShare}`);

      if (billingResult.approvalRequired.length > 0) {
        console.log(`      ⏳ Items pending approval: ${billingResult.approvalRequired.length}`);
      }
      if (billingResult.notCovered.length > 0) {
        console.log(`      ⛔ Items not covered: ${billingResult.notCovered.length}`);
      }

      // Verify against expected
      console.log('\n   ✔️ VERIFICATION:');
      let scenarioPass = true;

      if (scenario.expected.companyShare !== undefined) {
        if (billingResult.totalCompanyShare === scenario.expected.companyShare) {
          console.log(`      ✅ Company share CORRECT: $${billingResult.totalCompanyShare}`);
        } else {
          console.log(`      ❌ Company share WRONG: expected $${scenario.expected.companyShare}, got $${billingResult.totalCompanyShare}`);
          scenarioPass = false;
        }
      }

      if (scenario.expected.patientShare !== undefined) {
        if (billingResult.totalPatientShare === scenario.expected.patientShare) {
          console.log(`      ✅ Patient share CORRECT: $${billingResult.totalPatientShare}`);
        } else {
          console.log(`      ❌ Patient share WRONG: expected $${scenario.expected.patientShare}, got $${billingResult.totalPatientShare}`);
          scenarioPass = false;
        }
      }

      if (scenarioPass) {
        passed++;
        console.log(`\n   🎉 SCENARIO PASSED`);
      } else {
        failed++;
        failures.push({ scenario: scenario.name, expected: scenario.expected, actual: billingResult });
        console.log(`\n   ❌ SCENARIO FAILED`);
      }
    }

    // Final Summary
    console.log('\n' + '═'.repeat(80));
    console.log('  DEEP AUDIT SUMMARY');
    console.log('═'.repeat(80));
    console.log(`\n  Total Scenarios: ${TEST_SCENARIOS.length}`);
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);

    if (failures.length > 0) {
      console.log('\n  FAILURES:');
      failures.forEach(f => {
        console.log(`    - ${f.scenario}: ${f.reason || 'Calculation mismatch'}`);
      });
    }

    console.log('\n' + '═'.repeat(80));

  } catch (error) {
    console.error('Deep audit error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

runDeepAudit();
