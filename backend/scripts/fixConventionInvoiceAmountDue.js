/**
 * Fix Convention Invoice Amount Due
 *
 * This script fixes a bug where convention invoices had amountDue set to
 * total - amountPaid instead of patientShare - amountPaid.
 *
 * For 100% coverage conventions, the patient should owe 0 FC, but the bug
 * was causing them to see the full invoice amount as owed.
 *
 * Run with: node scripts/fixConventionInvoiceAmountDue.js
 * Dry run:  node scripts/fixConventionInvoiceAmountDue.js --dry-run
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');

const isDryRun = process.argv.includes('--dry-run');

async function fixConventionInvoices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    console.log(isDryRun ? '\n=== DRY RUN MODE - No changes will be made ===\n' : '');

    // Find all convention invoices
    const conventionInvoices = await Invoice.find({
      isConventionInvoice: true,
      'companyBilling.patientShare': { $exists: true }
    });

    console.log(`Found ${conventionInvoices.length} convention invoices to check\n`);

    let fixedCount = 0;
    let alreadyCorrectCount = 0;
    const issues = [];

    for (const invoice of conventionInvoices) {
      const patientShare = invoice.companyBilling?.patientShare ?? 0;
      const amountPaid = invoice.summary?.amountPaid ?? 0;
      const currentAmountDue = invoice.summary?.amountDue ?? 0;
      const correctAmountDue = Math.max(0, patientShare - amountPaid);

      // Check if the amount due is incorrect
      if (Math.abs(currentAmountDue - correctAmountDue) > 0.01) {
        const coveragePercent = invoice.companyBilling?.coveragePercentage ?? 0;
        const companyShare = invoice.companyBilling?.companyShare ?? 0;

        issues.push({
          invoiceNumber: invoice.invoiceNumber,
          total: invoice.summary?.total,
          coveragePercent,
          companyShare,
          patientShare,
          amountPaid,
          currentAmountDue,
          correctAmountDue,
          difference: currentAmountDue - correctAmountDue
        });

        if (!isDryRun) {
          // Fix the invoice
          invoice.summary.amountDue = correctAmountDue;

          // Also update status if now fully paid
          if (correctAmountDue <= 0 && invoice.summary.total > 0) {
            invoice.status = 'paid';
            if (!invoice.paidDate) {
              invoice.paidDate = new Date();
            }
          } else if (amountPaid > 0 && correctAmountDue > 0) {
            invoice.status = 'partial';
          }

          // Use updateOne to bypass pre-save hook
          await Invoice.updateOne(
            { _id: invoice._id },
            {
              $set: {
                'summary.amountDue': correctAmountDue,
                status: invoice.status,
                paidDate: invoice.paidDate
              }
            }
          );
        }

        fixedCount++;
      } else {
        alreadyCorrectCount++;
      }
    }

    console.log('=== RESULTS ===\n');

    if (issues.length > 0) {
      console.log('Invoices with incorrect amountDue:');
      console.log('-'.repeat(120));
      console.log(
        'Invoice Number'.padEnd(25) +
        'Total'.padStart(15) +
        'Coverage'.padStart(10) +
        'Company'.padStart(15) +
        'Patient'.padStart(15) +
        'Paid'.padStart(15) +
        'Was Due'.padStart(15) +
        'Should Be'.padStart(15)
      );
      console.log('-'.repeat(120));

      for (const issue of issues) {
        const invNum = (issue.invoiceNumber || 'N/A').padEnd(25);
        const total = (issue.total || 0).toLocaleString().padStart(15);
        const coverage = `${issue.coveragePercent}%`.padStart(10);
        const company = (issue.companyShare || 0).toLocaleString().padStart(15);
        const patient = (issue.patientShare || 0).toLocaleString().padStart(15);
        const paid = (issue.amountPaid || 0).toLocaleString().padStart(15);
        const wasDue = (issue.currentAmountDue || 0).toLocaleString().padStart(15);
        const shouldBe = (issue.correctAmountDue || 0).toLocaleString().padStart(15);
        console.log(invNum + total + coverage + company + patient + paid + wasDue + shouldBe);
      }
      console.log('-'.repeat(120));
    }

    console.log('\nSummary:');
    console.log(`  - Convention invoices checked: ${conventionInvoices.length}`);
    console.log(`  - Already correct: ${alreadyCorrectCount}`);
    console.log(`  - ${isDryRun ? 'Would fix' : 'Fixed'}: ${fixedCount}`);

    if (isDryRun && fixedCount > 0) {
      console.log('\nRun without --dry-run to apply fixes.');
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

fixConventionInvoices();
