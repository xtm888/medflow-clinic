/**
 * Fix Invoice Approval Flags
 *
 * This script updates convention invoices to properly show which items
 * require délibération (approval) based on the convention rules.
 *
 * Run with: node scripts/fixInvoiceApprovalFlags.js
 * Dry run:  node scripts/fixInvoiceApprovalFlags.js --dry-run
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { requireNonProductionStrict } = require('./_guards');
requireNonProductionStrict('fixInvoiceApprovalFlags.js');

const Invoice = require('../models/Invoice');
const Company = require('../models/Company');
const Approval = require('../models/Approval');
const Patient = require('../models/Patient'); // Required for populate

const isDryRun = process.argv.includes('--dry-run');

async function fixInvoiceApprovalFlags() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log(isDryRun ? '\n=== DRY RUN MODE - No changes will be made ===\n' : '');

    // Find all convention invoices
    const invoices = await Invoice.find({
      isConventionInvoice: true,
      'companyBilling.company': { $exists: true }
    }).populate('patient');

    console.log(`Found ${invoices.length} convention invoices to check\n`);

    let fixedCount = 0;
    let alreadyCorrectCount = 0;

    for (const invoice of invoices) {
      const company = await Company.findById(invoice.companyBilling?.company);
      if (!company) {
        console.log(`⚠️  Company not found for invoice ${invoice.invoiceNumber}`);
        continue;
      }

      let needsUpdate = false;
      let hasApprovalIssues = false;
      let itemsNeedingApproval = 0;
      const updatedItems = [];

      for (const item of invoice.items) {
        const categorySettings = company.coveredCategories?.find(c => c.category === item.category);

        // Determine if this item requires approval
        let requiresApproval = false;

        // Check category-level approval requirement
        if (categorySettings?.requiresApproval) {
          requiresApproval = true;
        }

        // Check specific acts requiring approval
        if (company.actsRequiringApproval?.some(a =>
          a.actCode?.toUpperCase() === item.code?.toUpperCase()
        )) {
          requiresApproval = true;
        }

        // Check auto-approve threshold (e.g., ACTIVA < $100 auto-approved)
        // IMPORTANT: Auto-approve does NOT override category-level requiresApproval
        // (e.g., ACTIVA: "Surgery and optical ALWAYS require approval")
        const categoryLevelRequiresApproval = categorySettings?.requiresApproval || false;
        if (requiresApproval && !categoryLevelRequiresApproval && company.approvalRules?.autoApproveUnderAmount) {
          const threshold = company.approvalRules.autoApproveUnderAmount;
          const rate = 0.00036; // CDF to USD
          const priceInUSD = (item.total || item.unitPrice || 0) * rate;
          if (priceInUSD < threshold) {
            requiresApproval = false;
          }
        }

        // Check if there's a valid approval
        let hasApproval = false;
        if (requiresApproval && invoice.patient) {
          const approval = await Approval.findOne({
            patient: invoice.patient._id || invoice.patient,
            company: company._id,
            actCode: item.code?.toUpperCase(),
            status: 'approved',
            $or: [
              { validUntil: null },
              { validUntil: { $gte: new Date() } }
            ]
          });
          hasApproval = !!approval;
        }

        // Calculate per-item coverage
        let coveragePercentage = 100;
        let companyShare = 0;
        let patientShare = item.total || item.unitPrice || 0;

        if (categorySettings?.notCovered) {
          coveragePercentage = 0;
        } else if (!requiresApproval || hasApproval) {
          coveragePercentage = categorySettings?.coveragePercentage
            ?? company.defaultCoverage?.percentage
            ?? 100;
          companyShare = Math.round((item.total || 0) * coveragePercentage / 100);
          patientShare = (item.total || 0) - companyShare;
        }

        // Track approval issues
        if (requiresApproval && !hasApproval) {
          hasApprovalIssues = true;
          itemsNeedingApproval++;
        }

        // Check if item needs update
        const currentApprovalRequired = item.approvalRequired ?? false;
        const currentHasApproval = item.hasApproval ?? false;

        // Force update if any of these conditions are met
        if (currentApprovalRequired !== requiresApproval ||
            currentHasApproval !== hasApproval ||
            item.companyShare === undefined ||
            item.patientShare === undefined ||
            item.approvalStatus === undefined ||
            (requiresApproval && !hasApproval && item.companyShare > 0) || // Approval missing but company share > 0
            (requiresApproval && !currentApprovalRequired)) { // Should require approval but doesn't
          needsUpdate = true;
        }

        const updatedItem = item.toObject ? item.toObject() : { ...item };
        updatedItem.approvalRequired = requiresApproval; // Schema field name is approvalRequired
        updatedItem.hasApproval = hasApproval;
        updatedItem.companyShare = companyShare;
        updatedItem.patientShare = patientShare;
        updatedItem.coveragePercentage = coveragePercentage;
        updatedItem.notCovered = categorySettings?.notCovered || false;
        // Set approvalStatus for frontend display
        updatedItem.approvalStatus = requiresApproval
          ? (hasApproval ? 'approved' : 'missing')
          : 'not_required';
        updatedItems.push(updatedItem);
      }

      if (needsUpdate) {
        console.log(`\n📋 Invoice ${invoice.invoiceNumber} (${company.name}):`);

        for (const item of updatedItems) {
          const status = item.notCovered
            ? '❌ NOT COVERED'
            : item.approvalRequired && !item.hasApproval
              ? '⚠️  NEEDS DÉLIBÉRATION'
              : item.approvalRequired && item.hasApproval
                ? '✅ APPROVED'
                : '✅ AUTO';
          console.log(`   - ${item.description} (${item.category}): ${status}`);
          console.log(`     Coverage: ${item.coveragePercentage}% | Company: ${item.companyShare?.toLocaleString()} | Patient: ${item.patientShare?.toLocaleString()}`);
        }

        if (!isDryRun) {
          await Invoice.updateOne(
            { _id: invoice._id },
            {
              $set: {
                items: updatedItems,
                'companyBilling.hasApprovalIssues': hasApprovalIssues,
                'companyBilling.itemsNeedingApproval': itemsNeedingApproval
              }
            }
          );
        }
        fixedCount++;
      } else {
        alreadyCorrectCount++;
      }
    }

    console.log('\n========================================');
    console.log(`✅ ${isDryRun ? 'Would fix' : 'Fixed'}: ${fixedCount} invoices`);
    console.log(`✓  Already correct: ${alreadyCorrectCount} invoices`);
    console.log('========================================\n');

    if (isDryRun && fixedCount > 0) {
      console.log('Run without --dry-run to apply fixes.\n');
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fixInvoiceApprovalFlags();
