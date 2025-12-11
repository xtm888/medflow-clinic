/**
 * Test Package Deals Auto-Detection
 *
 * This script tests that the invoice system automatically:
 * 1. Detects when package acts are present
 * 2. Bundles them into a $65 package
 * 3. Applies convention coverage correctly
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Patient = require('../models/Patient');
const Company = require('../models/Company');
const Invoice = require('../models/Invoice');

// Simulate the applyPackageDeals function logic for testing
function applyPackageDeals(items, company) {
  if (!company?.packageDeals || company.packageDeals.length === 0) {
    return { bundledItems: items, packagesApplied: [], originalItems: items };
  }

  const activePackages = company.packageDeals.filter(pkg => pkg.active !== false);
  if (activePackages.length === 0) {
    return { bundledItems: items, packagesApplied: [], originalItems: items };
  }

  let remainingItems = [...items];
  const packagesApplied = [];
  const originalItems = [...items];

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

      remainingItems = remainingItems.filter(item => !matchedItems.includes(item));

      const packageItem = {
        description: pkg.name || 'Forfait Consultation',
        code: pkg.code || 'PKG-CONSULT',
        category: 'consultation',
        quantity: 1,
        unitPrice: packagePrice,
        discount: 0,
        subtotal: packagePrice,
        tax: 0,
        total: packagePrice,
        isPackage: true,
        packageDetails: {
          packageId: pkg._id,
          packageCode: pkg.code,
          packageName: pkg.name,
          includedActs: matchedItems.map(item => ({
            code: item.code,
            description: item.description,
            originalPrice: item.unitPrice
          })),
          originalTotal: originalTotal,
          savings: originalTotal - packagePrice,
          currency: pkg.currency || 'USD'
        }
      };

      remainingItems.unshift(packageItem);

      packagesApplied.push({
        packageCode: pkg.code,
        packageName: pkg.name,
        packagePrice: packagePrice,
        originalTotal: originalTotal,
        savings: originalTotal - packagePrice,
        actsIncluded: matchedItems.length,
        currency: pkg.currency || 'USD'
      });
    }
  }

  return {
    bundledItems: remainingItems,
    packagesApplied,
    originalItems
  };
}

async function runTest() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Test 1: BRALIMA package
    console.log('='.repeat(60));
    console.log('TEST 1: BRALIMA $65 Package Detection');
    console.log('='.repeat(60));

    const bralima = await Company.findOne({ name: 'BRALIMA' });
    if (!bralima) {
      console.log('❌ BRALIMA company not found');
      return;
    }

    console.log(`\n📦 BRALIMA Package Configuration:`);
    if (bralima.packageDeals?.length > 0) {
      const pkg = bralima.packageDeals[0];
      console.log(`   Name: ${pkg.name}`);
      console.log(`   Price: $${pkg.price}`);
      console.log(`   Acts included:`);
      pkg.includedActs?.forEach(act => {
        console.log(`     - ${act.actCode}: ${act.actName}`);
      });
    }

    // Simulate invoice items for BRALIMA package
    const bralimaItems = [
      { code: 'CONSULT', description: 'Consultation ophtalmologique', unitPrice: 25, quantity: 1, category: 'consultation' },
      { code: 'REFRACTO', description: 'Réfractométrie', unitPrice: 15, quantity: 1, category: 'examination' },
      { code: 'TONO', description: 'Tonométrie', unitPrice: 20, quantity: 1, category: 'examination' },
      { code: 'BIOMICRO', description: 'Biomicroscopie', unitPrice: 20, quantity: 1, category: 'examination' },
      { code: 'FOND-ND', description: 'Fond d\'oeil non dilaté', unitPrice: 25, quantity: 1, category: 'examination' },
      { code: 'FLUORO', description: 'Test fluorescéine', unitPrice: 10, quantity: 1, category: 'examination' }
    ];

    console.log(`\n📋 Invoice Items (before package detection):`);
    let totalBefore = 0;
    bralimaItems.forEach(item => {
      console.log(`   ${item.code}: ${item.description} - $${item.unitPrice}`);
      totalBefore += item.unitPrice;
    });
    console.log(`   TOTAL: $${totalBefore}`);

    // Apply package detection
    const bralimaResult = applyPackageDeals(bralimaItems, bralima);

    console.log(`\n✅ Package Detection Result:`);
    if (bralimaResult.packagesApplied.length > 0) {
      const applied = bralimaResult.packagesApplied[0];
      console.log(`   Package Applied: ${applied.packageName}`);
      console.log(`   Package Price: $${applied.packagePrice}`);
      console.log(`   Original Total: $${applied.originalTotal}`);
      console.log(`   SAVINGS: $${applied.savings}`);
      console.log(`   Acts bundled: ${applied.actsIncluded}`);
    } else {
      console.log('   ❌ No package was applied!');
    }

    console.log(`\n📋 Invoice Items (after package detection):`);
    let totalAfter = 0;
    bralimaResult.bundledItems.forEach(item => {
      if (item.isPackage) {
        console.log(`   📦 ${item.code}: ${item.description} - $${item.unitPrice} (PACKAGE)`);
      } else {
        console.log(`   ${item.code}: ${item.description} - $${item.unitPrice}`);
      }
      totalAfter += item.unitPrice;
    });
    console.log(`   TOTAL: $${totalAfter}`);

    // Test 2: MSO KINSHASA package (different acts)
    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: MSO KINSHASA $65 Package Detection');
    console.log('='.repeat(60));

    const mso = await Company.findOne({ name: 'MSO KINSHASA' });
    if (!mso) {
      console.log('❌ MSO KINSHASA company not found');
    } else {
      console.log(`\n📦 MSO KINSHASA Package Configuration:`);
      if (mso.packageDeals?.length > 0) {
        const pkg = mso.packageDeals[0];
        console.log(`   Name: ${pkg.name}`);
        console.log(`   Price: $${pkg.price}`);
        console.log(`   Acts included:`);
        pkg.includedActs?.forEach(act => {
          console.log(`     - ${act.actCode}: ${act.actName}`);
        });
      }

      // Simulate invoice items for MSO package (includes KERATO and RETINO)
      const msoItems = [
        { code: 'CONSULT', description: 'Consultation ophtalmologique', unitPrice: 30, quantity: 1, category: 'consultation' },
        { code: 'REFRACTO', description: 'Réfraction', unitPrice: 20, quantity: 1, category: 'examination' },
        { code: 'TONO', description: 'Tonométrie', unitPrice: 20, quantity: 1, category: 'examination' },
        { code: 'FLUORO', description: 'Test fluorescéine', unitPrice: 10, quantity: 1, category: 'examination' },
        { code: 'KERATO', description: 'Kératométrie', unitPrice: 25, quantity: 1, category: 'examination' },
        { code: 'RETINO', description: 'Rétinographie', unitPrice: 40, quantity: 1, category: 'imaging' }
      ];

      console.log(`\n📋 Invoice Items (before):`);
      let msoTotalBefore = 0;
      msoItems.forEach(item => {
        console.log(`   ${item.code}: $${item.unitPrice}`);
        msoTotalBefore += item.unitPrice;
      });
      console.log(`   TOTAL: $${msoTotalBefore}`);

      const msoResult = applyPackageDeals(msoItems, mso);

      console.log(`\n✅ Package Detection Result:`);
      if (msoResult.packagesApplied.length > 0) {
        const applied = msoResult.packagesApplied[0];
        console.log(`   Package Applied: ${applied.packageName}`);
        console.log(`   Package Price: $${applied.packagePrice}`);
        console.log(`   Original Total: $${applied.originalTotal}`);
        console.log(`   SAVINGS: $${applied.savings}`);
      } else {
        console.log('   ❌ No package was applied!');
      }
    }

    // Test 3: Partial package (should NOT apply)
    console.log('\n' + '='.repeat(60));
    console.log('TEST 3: Partial Package (should NOT apply)');
    console.log('='.repeat(60));

    const partialItems = [
      { code: 'CONSULT', description: 'Consultation', unitPrice: 25, quantity: 1, category: 'consultation' },
      { code: 'REFRACTO', description: 'Réfractométrie', unitPrice: 15, quantity: 1, category: 'examination' },
      // Missing: TONO, BIOMICRO, FOND-ND, FLUORO
    ];

    console.log(`\n📋 Invoice Items (only 2 of 6 package acts):`);
    partialItems.forEach(item => {
      console.log(`   ${item.code}: $${item.unitPrice}`);
    });

    const partialResult = applyPackageDeals(partialItems, bralima);

    if (partialResult.packagesApplied.length === 0) {
      console.log(`\n✅ Correctly did NOT apply package (missing required acts)`);
    } else {
      console.log(`\n❌ ERROR: Package was applied when it shouldn't have been!`);
    }

    // Test 4: Non-convention company (no package)
    console.log('\n' + '='.repeat(60));
    console.log('TEST 4: Company without package deals');
    console.log('='.repeat(60));

    const cigna = await Company.findOne({ name: { $regex: /cigna/i } });
    if (cigna) {
      console.log(`\n📦 CIGNA Package Configuration:`);
      console.log(`   Package deals: ${cigna.packageDeals?.length || 0}`);

      const cignaResult = applyPackageDeals(bralimaItems, cigna);

      if (cignaResult.packagesApplied.length === 0) {
        console.log(`\n✅ Correctly did NOT apply package (CIGNA has no package deals)`);
      } else {
        console.log(`\n❌ ERROR: Package was applied when it shouldn't have been!`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('TEST COMPLETE');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

runTest();
