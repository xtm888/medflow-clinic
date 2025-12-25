/**
 * Verify Convention Rules - Comprehensive Check
 *
 * Verifies each convention matches the EXACT business rules provided
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { requireNonProduction } = require('./_guards');
requireNonProduction('verifyConventionRules.js');

const mongoose = require('mongoose');

const Company = require('../models/Company');

// EXACT RULES FROM BUSINESS SPECIFICATIONS
const BUSINESS_RULES = {
  'AAC': {
    description: 'Optical ONLY - Patient brings pre-validated prescription',
    rules: {
      opticalOnly: true,
      opticalCovered: true,
      allOtherNotCovered: true
    }
  },

  'ACTIVA': {
    description: 'All acts <$100 auto. >$100, surgery, optical need validation',
    rules: {
      defaultCoverage: 100,
      autoApproveUnder: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'ADELIZ': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'AFIA BORA': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'AFRICA IN': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'ASCOMA': {
    description: 'PACTILIS type - Only consultation + pharmacy auto',
    rules: {
      defaultCoverage: 100,
      consultationAuto: true,
      pharmacyAuto: true,
      examinationApproval: true,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'PACTILIS': {
    description: 'Only consultation + pharmacy auto. All else needs approval',
    rules: {
      defaultCoverage: 100,
      consultationAuto: true,
      pharmacyAuto: true,
      examinationApproval: true,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'BCC': {
    description: 'All acts. Surgery needs validation + medical report',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      requiresMedicalReport: ['surgery']
    }
  },

  'BANQUE CENTRALE DU CONGO': {
    description: 'All acts. Surgery needs validation + medical report',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      requiresMedicalReport: ['surgery']
    }
  },

  'BOA': {
    description: 'All acts. Surgery validation. Frame limit $60',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalFrameLimit: 60
    }
  },

  'BANK OF AFRICA': {
    description: 'All acts. Surgery validation. Frame limit $60',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalFrameLimit: 60
    }
  },

  'BRALIMA': {
    description: '$65 package: CONS+REFRACTO+TONO+BIOMICRO+FOND-ND+FLUORO. Surgery+optical approval',
    rules: {
      defaultCoverage: 100,
      hasPackage: true,
      packagePrice: 65,
      packageActs: ['CONSULT', 'REFRACTO', 'TONO', 'BIOMICRO', 'FOND-ND', 'FLUORO'],
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'CAPITAL HR': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'CAPITAL RH': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'CENTRE MEDICAL DIAMANT': {
    description: 'All acts covered',
    rules: {
      defaultCoverage: 100
    }
  },

  'CENTRE DIAMANT': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'CICR': {
    description: 'All acts <$100 auto. >$100, surgery, optical need validation',
    rules: {
      defaultCoverage: 100,
      autoApproveUnder: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'CICR CROIX ROUGE': {
    description: 'All acts <$100 auto. >$100, surgery, optical need validation',
    rules: {
      defaultCoverage: 100,
      autoApproveUnder: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'CIGNA': {
    description: 'All acts. Surgery needs validation. NO OPTICAL. 80%/100% tiers',
    rules: {
      surgeryApproval: true,
      opticalExcluded: true,
      hasTiers: true
    }
  },

  'CIGNA 80%': {
    description: 'CIGNA 80% tier - patient pays 20%. NO OPTICAL',
    rules: {
      defaultCoverage: 80,
      surgeryApproval: true,
      opticalExcluded: true
    }
  },

  'CIGNA 100%': {
    description: 'CIGNA 100% tier - full coverage. NO OPTICAL',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalExcluded: true
    }
  },

  'COBIL': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'CORDAID': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'DISPROMALT': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'ENGEN': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'GGA': {
    description: 'All acts. Surgery needs validation. NO OPTICAL. 80%/90%/100% tiers',
    rules: {
      surgeryApproval: true,
      opticalExcluded: true,
      hasTiers: true
    }
  },

  'GGA 80%': {
    description: 'GGA 80% tier - patient pays 20%. NO OPTICAL',
    rules: {
      defaultCoverage: 80,
      surgeryApproval: true,
      opticalExcluded: true
    }
  },

  'GGA 90%': {
    description: 'GGA 90% tier - patient pays 10%. NO OPTICAL',
    rules: {
      defaultCoverage: 90,
      surgeryApproval: true,
      opticalExcluded: true
    }
  },

  'GGA 100%': {
    description: 'GGA 100% tier - full coverage. NO OPTICAL',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalExcluded: true
    }
  },

  'MSO KINSHASA': {
    description: '$65 package: CONS+TONO+REFRACTION+FLUORO+KERA+RETINO. All other acts need validation',
    rules: {
      defaultCoverage: 100,
      hasPackage: true,
      packagePrice: 65,
      packageActs: ['CONSULT', 'REFRACTO', 'TONO', 'FLUORO', 'KERATO', 'RETINO'],
      allOtherActsNeedApproval: true
    }
  },

  'LISUNGI': {
    description: '$65 package + 15% surgery discount. Surgery + optical approval',
    rules: {
      defaultCoverage: 100,
      hasPackage: true,
      packagePrice: 65,
      surgeryDiscount: 15,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'MSF': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'MEDECIN SANS FRONTIERE': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'MSH': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'POLYCLINIQUE DE KINSHASA': {
    description: 'All acts covered',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'POLYCLINIQUE KIN': {
    description: 'All acts covered',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'RAWSUR': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'SEP CONGO': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'SEP CONGO KINSHASA': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'SUNU': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'TEMOINS DE JEHOVAH': {
    description: '25% discount on NON-surgical acts. Surgery + optical need approval',
    rules: {
      defaultCoverage: 100,
      globalDiscount: 25,
      discountExcludesSurgery: true,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'TEMOIN DE JEHOVAH': {
    description: '25% discount on NON-surgical acts. Surgery + optical need approval',
    rules: {
      defaultCoverage: 100,
      globalDiscount: 25,
      discountExcludesSurgery: true,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'TÉMOINS DE JÉHOVAH': {
    description: '25% discount on NON-surgical acts. Surgery + optical need approval',
    rules: {
      defaultCoverage: 100,
      globalDiscount: 25,
      discountExcludesSurgery: true,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'TFM': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'US EMBASSY': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  },

  'AMBASSADE USA': {
    description: 'All acts covered. Surgery + optical need validation',
    rules: {
      defaultCoverage: 100,
      surgeryApproval: true,
      opticalApproval: true
    }
  }
};

function getCategorySettings(company, category) {
  return company.coveredCategories?.find(c => c.category === category) || null;
}

function verifyCompany(company, expectedRules) {
  const issues = [];
  const passed = [];
  const rules = expectedRules.rules;

  // Get category settings
  const consultation = getCategorySettings(company, 'consultation');
  const examination = getCategorySettings(company, 'examination');
  const procedure = getCategorySettings(company, 'procedure');
  const surgery = getCategorySettings(company, 'surgery');
  const optical = getCategorySettings(company, 'optical');
  const medication = getCategorySettings(company, 'medication');
  const imaging = getCategorySettings(company, 'imaging');
  const laboratory = getCategorySettings(company, 'laboratory');

  // 1. Check default coverage
  if (rules.defaultCoverage !== undefined) {
    const actual = company.defaultCoverage?.percentage;
    if (actual === rules.defaultCoverage) {
      passed.push(`Coverage: ${actual}%`);
    } else {
      issues.push(`Coverage should be ${rules.defaultCoverage}%, got ${actual}%`);
    }
  }

  // 2. Check optical-only (AAC)
  if (rules.opticalOnly) {
    if (optical && !optical.notCovered) {
      passed.push('Optical: COVERED');
    } else {
      issues.push('Optical should be COVERED');
    }

    // All other categories should be notCovered
    const checkNotCovered = ['consultation', 'examination', 'procedure', 'imaging', 'laboratory', 'surgery'];
    checkNotCovered.forEach(cat => {
      const catSettings = getCategorySettings(company, cat);
      if (!catSettings?.notCovered) {
        issues.push(`${cat} should be NOT COVERED (optical-only company)`);
      }
    });
  }

  // 3. Check optical excluded (CIGNA/GGA)
  if (rules.opticalExcluded) {
    if (optical?.notCovered) {
      passed.push('Optical: EXCLUDED');
    } else {
      issues.push('Optical should be EXCLUDED (notCovered: true)');
    }
  }

  // 4. Check auto-approve threshold
  if (rules.autoApproveUnder) {
    const actual = company.approvalRules?.autoApproveUnderAmount;
    if (actual === rules.autoApproveUnder) {
      passed.push(`Auto-approve under: $${actual}`);
    } else {
      issues.push(`Auto-approve should be $${rules.autoApproveUnder}, got $${actual || 0}`);
    }
  }

  // 5. Check surgery approval required
  if (rules.surgeryApproval) {
    if (surgery?.requiresApproval) {
      passed.push('Surgery: requires approval');
    } else {
      issues.push('Surgery should require approval');
    }
  }

  // 6. Check optical approval required
  if (rules.opticalApproval) {
    if (optical?.requiresApproval) {
      passed.push('Optical: requires approval');
    } else if (optical?.notCovered) {
      passed.push('Optical: excluded (N/A for approval)');
    } else {
      issues.push('Optical should require approval');
    }
  }

  // 7. Check package deals
  if (rules.hasPackage) {
    const packages = company.packageDeals || [];
    if (packages.length > 0) {
      const pkg = packages[0];
      if (pkg.price === rules.packagePrice) {
        passed.push(`Package: $${pkg.price}`);
      } else {
        issues.push(`Package price should be $${rules.packagePrice}, got $${pkg.price || 0}`);
      }

      // Check included acts
      if (rules.packageActs) {
        const pkgCodes = pkg.includedActs?.map(a => a.actCode?.toUpperCase()) || [];
        const missing = rules.packageActs.filter(code => !pkgCodes.includes(code));
        if (missing.length === 0) {
          passed.push(`Package acts: ${pkgCodes.join(', ')}`);
        } else {
          issues.push(`Package missing acts: ${missing.join(', ')}`);
        }
      }
    } else {
      issues.push('Missing $65 package deal');
    }
  }

  // 8. Check global discount
  if (rules.globalDiscount) {
    const actual = company.approvalRules?.globalDiscount?.percentage;
    if (actual === rules.globalDiscount) {
      passed.push(`Global discount: ${actual}%`);
    } else {
      issues.push(`Global discount should be ${rules.globalDiscount}%, got ${actual || 0}%`);
    }

    // Check if surgery is excluded from discount
    if (rules.discountExcludesSurgery) {
      const excludes = company.approvalRules?.globalDiscount?.excludeCategories || [];
      if (excludes.includes('surgery')) {
        passed.push('Surgery excluded from discount');
      } else {
        issues.push('Surgery should be excluded from discount');
      }
    }
  }

  // 9. Check surgery discount (LISUNGI)
  if (rules.surgeryDiscount) {
    const discount = company.approvalRules?.globalDiscount?.percentage;
    // Check if surgery has specific discount
    if (discount === rules.surgeryDiscount || surgery?.additionalDiscount === rules.surgeryDiscount) {
      passed.push(`Surgery discount: ${rules.surgeryDiscount}%`);
    } else {
      issues.push(`Surgery discount should be ${rules.surgeryDiscount}%`);
    }
  }

  // 10. Check medical report requirement
  if (rules.requiresMedicalReport) {
    const requires = company.approvalRules?.requiresMedicalReport || [];
    if (rules.requiresMedicalReport.every(cat => requires.includes(cat))) {
      passed.push(`Medical report required: ${requires.join(', ')}`);
    } else {
      issues.push(`Medical report should be required for: ${rules.requiresMedicalReport.join(', ')}`);
    }
  }

  // 11. Check frame limit
  if (rules.opticalFrameLimit) {
    const limit = optical?.maxPerCategory;
    if (limit === rules.opticalFrameLimit) {
      passed.push(`Frame limit: $${limit}`);
    } else {
      issues.push(`Frame limit should be $${rules.opticalFrameLimit}, got $${limit || 'not set'}`);
    }
  }

  // 12. Check PACTILIS-style restrictive rules
  if (rules.consultationAuto) {
    if (consultation && !consultation.requiresApproval && !consultation.notCovered) {
      passed.push('Consultation: auto (no approval)');
    } else {
      issues.push('Consultation should be auto (no approval required)');
    }
  }

  if (rules.pharmacyAuto) {
    if (medication && !medication.requiresApproval && !medication.notCovered) {
      passed.push('Pharmacy/Medication: auto');
    } else {
      issues.push('Pharmacy/Medication should be auto (no approval required)');
    }
  }

  if (rules.examinationApproval) {
    if (examination?.requiresApproval) {
      passed.push('Examination: requires approval');
    } else {
      issues.push('Examination should require approval');
    }
  }

  return { issues, passed };
}

async function runVerification() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    console.log('═'.repeat(80));
    console.log('  CONVENTION RULES VERIFICATION');
    console.log('  Checking each convention against business specifications');
    console.log('═'.repeat(80));

    const companies = await Company.find({}).sort('name');
    console.log(`\nTotal companies in database: ${companies.length}\n`);

    let totalVerified = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalIssues = 0;
    const failedCompanies = [];

    console.log('─'.repeat(80));
    console.log('  VERIFICATION RESULTS');
    console.log('─'.repeat(80));

    // Check each company with defined rules
    for (const [companyName, expected] of Object.entries(BUSINESS_RULES)) {
      const company = companies.find(c => c.name === companyName);

      if (!company) {
        console.log(`\n⚠️  ${companyName}: NOT FOUND IN DATABASE`);
        continue;
      }

      totalVerified++;
      const result = verifyCompany(company, expected);

      if (result.issues.length === 0) {
        totalPassed++;
        console.log(`\n✅ ${companyName}`);
        console.log(`   ${expected.description}`);
        result.passed.forEach(p => console.log(`   ✓ ${p}`));
      } else {
        totalFailed++;
        totalIssues += result.issues.length;
        failedCompanies.push({ name: companyName, issues: result.issues, expected });
        console.log(`\n❌ ${companyName}`);
        console.log(`   ${expected.description}`);
        result.passed.forEach(p => console.log(`   ✓ ${p}`));
        result.issues.forEach(i => console.log(`   ✗ ${i}`));
      }
    }

    // Summary
    console.log(`\n${'═'.repeat(80)}`);
    console.log('  VERIFICATION SUMMARY');
    console.log('═'.repeat(80));
    console.log(`\n  Total Verified: ${totalVerified}`);
    console.log(`  ✅ Passed: ${totalPassed}`);
    console.log(`  ❌ Failed: ${totalFailed}`);
    console.log(`  Total Issues: ${totalIssues}`);

    // Return failed companies for fixing
    if (failedCompanies.length > 0) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log('  COMPANIES NEEDING FIXES');
      console.log('─'.repeat(80));
      failedCompanies.forEach(fc => {
        console.log(`\n  ${fc.name}:`);
        fc.issues.forEach(i => console.log(`    - ${i}`));
      });

      return failedCompanies;
    }

    return [];

  } catch (error) {
    console.error('Verification error:', error);
    return [];
  } finally {
    await mongoose.disconnect();
    console.log('\n\nDisconnected from MongoDB');
  }
}

runVerification();
